"""Enrollment checkout status helpers — align enrollment.status with paid transactions."""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

PAID_TRANSACTION_STATUSES = frozenset({"paid", "complete", "completed"})
COMPLETED_ENROLLMENT_STATUSES = frozenset({"completed", "paid", "india_payment_approved"})
INCOMPLETE_CHECKOUT_STATUSES = frozenset({"checkout_started", "otp_verified", "started", "pending"})


def _txn_sort_ts(t: dict) -> float:
    v = t.get("updated_at") or t.get("created_at") or t.get("paid_at")
    if v is None:
        return 0.0
    if hasattr(v, "timestamp"):
        try:
            return float(v.timestamp())
        except Exception:
            return 0.0
    if isinstance(v, str):
        try:
            return datetime.fromisoformat(v.replace("Z", "+00:00")).timestamp()
        except Exception:
            return 0.0
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def transaction_is_paid(txn: Optional[dict]) -> bool:
    if not txn:
        return False
    return str(txn.get("payment_status") or "").strip().lower() in PAID_TRANSACTION_STATUSES


def enrollment_is_completed(enrollment: Optional[dict]) -> bool:
    if not enrollment:
        return False
    return str(enrollment.get("status") or "").strip().lower() in COMPLETED_ENROLLMENT_STATUSES


def effective_enrollment_status(enrollment: dict, txn: Optional[dict]) -> str:
    """Display/logical status: paid transaction wins over stale checkout_started."""
    raw = str(enrollment.get("status") or "pending").strip()
    if enrollment_is_completed(enrollment):
        return raw or "completed"
    if transaction_is_paid(txn):
        return "completed"
    return raw or "pending"


def payment_method_from_transaction(txn: dict) -> str:
    provider = str(txn.get("payment_provider") or "").strip().lower()
    method = str(txn.get("payment_method") or "").strip().lower()
    if method in ("stripe", "razorpay", "india_bank", "manual_proof", "exly", "gpay", "cash", "bank", "other"):
        return method
    if provider == "razorpay":
        return "razorpay"
    if provider == "manual":
        return method or "cash"
    return "stripe"


def stripe_session_is_paid(sess: Any) -> bool:
    """True when Stripe Checkout Session reflects a successful payment."""
    ps = str(getattr(sess, "payment_status", "") or "").lower()
    st = str(getattr(sess, "status", "") or "").lower()
    if ps == "paid":
        return True
    if st == "complete" and ps not in ("unpaid", "failed", ""):
        return True
    return False


def collect_stripe_session_ids(enrollment: dict, txns: List[dict]) -> List[str]:
    """All Stripe Checkout session ids linked to this enrollment (newest first)."""
    seen = set()
    out: List[str] = []

    def add(raw: Any) -> None:
        sid = str(raw or "").strip()
        if not sid or sid.startswith("rz_") or sid in seen:
            return
        seen.add(sid)
        out.append(sid)

    add(enrollment.get("stripe_session_id"))
    for txn in sorted(txns, key=_txn_sort_ts, reverse=True):
        if txn.get("payment_provider") == "razorpay":
            continue
        add(txn.get("stripe_session_id"))

    return out


async def get_stripe_api_key() -> str:
    """Stripe secret key from key_manager (stripe_api_key) with .env fallback."""
    try:
        from key_manager import get_key

        key = (await get_key("stripe_api_key")).strip()
        if key:
            return key
    except Exception as exc:
        logger.warning("get_stripe_api_key key_manager: %s", exc)
    return (os.environ.get("STRIPE_API_KEY") or "").strip()


async def search_stripe_checkout_session_ids(
    stripe_api_key: str,
    *,
    enrollment_id: str = "",
    invoice_number: str = "",
) -> List[str]:
    """Find Checkout Session ids in Stripe via Search API (metadata)."""
    key = str(stripe_api_key or "").strip()
    if not key:
        return []

    import stripe as stripe_lib

    stripe_lib.api_key = key
    queries: List[str] = []
    eid = str(enrollment_id or "").strip()
    inv = str(invoice_number or "").strip()
    if eid:
        queries.append(f"metadata['enrollment_id']:'{eid}'")
    if inv:
        queries.append(f"metadata['invoice_number']:'{inv}'")

    found: List[str] = []
    seen = set()
    for query in queries:
        try:
            page = stripe_lib.checkout.Session.search(query=query, limit=20)
            for sess in page.data or []:
                sid = str(getattr(sess, "id", "") or "").strip()
                if sid and sid not in seen:
                    seen.add(sid)
                    found.append(sid)
        except Exception as exc:
            logger.warning("Stripe session search (%s): %s", query, exc)
    return found


async def reconcile_enrollment_with_paid_transaction(
    db,
    enrollment_id: str,
    txn: dict,
    *,
    enrollment: Optional[dict] = None,
) -> bool:
    """Mark enrollment completed when its transaction is paid. Returns True if updated."""
    if not enrollment_id or not transaction_is_paid(txn):
        return False
    if enrollment is None:
        enrollment = await db.enrollments.find_one({"id": enrollment_id}, {"_id": 0})
    if not enrollment or enrollment_is_completed(enrollment):
        return False

    paid_at = txn.get("paid_at") or datetime.now(timezone.utc).isoformat()
    await db.enrollments.update_one(
        {"id": enrollment_id},
        {
            "$set": {
                "status": "completed",
                "payment_method": payment_method_from_transaction(txn),
                "paid_at": paid_at,
                "stripe_session_id": txn.get("stripe_session_id") or enrollment.get("stripe_session_id"),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )
    return True


async def apply_paid_stripe_session_to_db(
    db,
    sess: Any,
    *,
    fallback_enrollment_id: str = "",
    fallback_invoice_number: str = "",
) -> bool:
    """
    Persist a paid Stripe Checkout Session to payment_transactions + enrollment.
    Handles paid session ids that differ from the latest pending txn row.
    """
    sid = str(getattr(sess, "id", "") or "").strip()
    if not sid or not stripe_session_is_paid(sess):
        return False

    meta = dict(getattr(sess, "metadata", None) or {})
    enrollment_id = str(meta.get("enrollment_id") or fallback_enrollment_id or "").strip()
    invoice_number = str(meta.get("invoice_number") or fallback_invoice_number or "").strip()

    tx = await db.payment_transactions.find_one({"stripe_session_id": sid}, {"_id": 0})
    if not tx and enrollment_id:
        tx = await db.payment_transactions.find_one(
            {"enrollment_id": enrollment_id, "stripe_session_id": sid},
            {"_id": 0},
        )
    if not tx and invoice_number:
        tx = await db.payment_transactions.find_one({"invoice_number": invoice_number}, {"_id": 0})
    if not tx and enrollment_id:
        pending = await db.payment_transactions.find(
            {"enrollment_id": enrollment_id},
            {"_id": 0},
        ).sort("created_at", -1).to_list(20)
        stripe_pending = [
            t
            for t in pending
            if t.get("payment_provider") != "razorpay"
            and not str(t.get("stripe_session_id") or "").startswith("rz_")
            and not transaction_is_paid(t)
        ]
        sess_cents = getattr(sess, "amount_total", None)
        if sess_cents is not None and stripe_pending:
            try:
                sess_amt = float(sess_cents) / 100.0
                for t in stripe_pending:
                    if abs(float(t.get("amount") or 0) - sess_amt) < 0.02:
                        tx = t
                        break
            except (TypeError, ValueError):
                pass
        if not tx and stripe_pending:
            tx = stripe_pending[0]

    if not tx:
        logger.warning("Paid Stripe session %s — no matching transaction in DB", sid)
        return False

    enrollment_id = str(tx.get("enrollment_id") or enrollment_id or "").strip()
    now = datetime.now(timezone.utc)
    paid_at = tx.get("paid_at")
    if not paid_at and getattr(sess, "created", None):
        try:
            paid_at = datetime.fromtimestamp(int(sess.created), tz=timezone.utc).isoformat()
        except Exception:
            paid_at = now.isoformat()
    if not paid_at:
        paid_at = now.isoformat()

    await db.payment_transactions.update_one(
        {"id": tx["id"]},
        {
            "$set": {
                "stripe_session_id": sid,
                "payment_status": "paid",
                "payment_provider": tx.get("payment_provider") or "stripe",
                "paid_at": paid_at,
                "updated_at": now,
            }
        },
    )

    if enrollment_id:
        await reconcile_enrollment_with_paid_transaction(
            db,
            enrollment_id,
            {**tx, "stripe_session_id": sid, "payment_status": "paid", "paid_at": paid_at},
        )
        logger.info("Applied paid Stripe session %s → enrollment %s", sid, enrollment_id)
    return True


async def try_reconcile_stripe_checkout_session(
    db,
    session_id: str,
    stripe_api_key: str,
    *,
    fallback_enrollment_id: str = "",
    fallback_invoice_number: str = "",
) -> bool:
    """Poll one Stripe Checkout Session; if paid, update transaction + enrollment."""
    sid = str(session_id or "").strip()
    key = str(stripe_api_key or "").strip()
    if not sid or sid.startswith("rz_") or not key:
        return False

    import stripe as stripe_lib

    stripe_lib.api_key = key
    try:
        sess = stripe_lib.checkout.Session.retrieve(sid)
    except Exception as exc:
        logger.warning("Stripe session retrieve failed for %s: %s", sid, exc)
        return False

    if not stripe_session_is_paid(sess):
        ps = str(getattr(sess, "payment_status", "") or "").lower()
        st = str(getattr(sess, "status", "") or "").lower()
        logger.info("Stripe session %s status=%s payment_status=%s", sid, st, ps or "unknown")
        return False

    return await apply_paid_stripe_session_to_db(
        db,
        sess,
        fallback_enrollment_id=fallback_enrollment_id,
        fallback_invoice_number=fallback_invoice_number,
    )


async def reconcile_enrollment_stripe_payments(
    db,
    enrollment: dict,
    txns: List[dict],
    stripe_key: str,
    *,
    invoice_number: str = "",
    thorough: bool = False,
) -> Tuple[List[dict], dict]:
    """
    Check every known session id + Stripe metadata search for a paid checkout.
    Returns (possibly refreshed txns, meta).
    """
    eid = str(enrollment.get("id") or "").strip()
    meta: Dict[str, Any] = {
        "stripe_polled": False,
        "stripe_paid": False,
        "enrollment_updated": False,
        "sessions_checked": [],
        "stripe_errors": [],
    }
    if not eid:
        return txns, meta

    key = str(stripe_key or "").strip()
    if not key:
        meta["stripe_errors"].append("Stripe API key not configured")
        return txns, meta

    if any(transaction_is_paid(t) for t in txns):
        return txns, meta

    st = str(enrollment.get("status") or "").strip().lower()
    if st not in INCOMPLETE_CHECKOUT_STATUSES and not thorough:
        return txns, meta

    session_ids = collect_stripe_session_ids(enrollment, txns)
    if thorough:
        session_ids = list(
            dict.fromkeys(
                session_ids
                + await search_stripe_checkout_session_ids(
                    key,
                    enrollment_id=eid,
                    invoice_number=invoice_number or "",
                )
            )
        )

    for sid in session_ids:
        meta["stripe_polled"] = True
        meta["sessions_checked"].append(sid)
        try:
            if await try_reconcile_stripe_checkout_session(
                db,
                sid,
                key,
                fallback_enrollment_id=eid,
                fallback_invoice_number=invoice_number,
            ):
                meta["stripe_paid"] = True
                txns = await db.payment_transactions.find({"enrollment_id": eid}, {"_id": 0}).to_list(50)
                break
        except Exception as exc:
            meta["stripe_errors"].append(f"{sid}: {exc}")
            logger.warning("Stripe reconcile %s: %s", sid, exc)

    if not meta["stripe_paid"] and thorough:
        search_ids = await search_stripe_checkout_session_ids(
            key,
            enrollment_id=eid,
            invoice_number=invoice_number or "",
        )
        for sid in search_ids:
            if sid in meta["sessions_checked"]:
                continue
            meta["stripe_polled"] = True
            meta["sessions_checked"].append(sid)
            if await try_reconcile_stripe_checkout_session(
                db,
                sid,
                key,
                fallback_enrollment_id=eid,
                fallback_invoice_number=invoice_number,
            ):
                meta["stripe_paid"] = True
                txns = await db.payment_transactions.find({"enrollment_id": eid}, {"_id": 0}).to_list(50)
                break

    return txns, meta


async def reconcile_enrollment_checkout_from_db(
    db,
    enrollment: dict,
    txns: List[dict],
    *,
    stripe_key: str = "",
    poll_stripe: bool = True,
    invoice_number: str = "",
    thorough: bool = False,
) -> Tuple[dict, List[dict], dict]:
    """
    Heal one enrollment: optional Stripe poll, then align status with paid txns.
    Returns (enrollment, txns, result_meta).
    """
    eid = enrollment.get("id")
    meta: Dict[str, Any] = {
        "stripe_polled": False,
        "stripe_paid": False,
        "enrollment_updated": False,
        "sessions_checked": [],
        "stripe_errors": [],
    }
    if not eid:
        return enrollment, txns, meta

    key = stripe_key or (await get_stripe_api_key())

    if poll_stripe or thorough:
        txns, stripe_meta = await reconcile_enrollment_stripe_payments(
            db,
            enrollment,
            txns,
            key,
            invoice_number=invoice_number,
            thorough=thorough,
        )
        meta.update(stripe_meta)

    for txn in txns:
        if transaction_is_paid(txn):
            if await reconcile_enrollment_with_paid_transaction(db, eid, txn, enrollment=enrollment):
                meta["enrollment_updated"] = True
                enrollment["status"] = "completed"
                enrollment["payment_method"] = txn.get("payment_method") or enrollment.get("payment_method")
            break

    return enrollment, txns, meta
