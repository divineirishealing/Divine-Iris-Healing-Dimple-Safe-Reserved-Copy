"""Enrollment checkout status helpers — align enrollment.status with paid transactions."""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import List, Optional, Tuple

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
    if provider == "razorpay":
        return "razorpay"
    method = str(txn.get("payment_method") or "").strip().lower()
    if method in ("stripe", "razorpay", "india_bank", "manual_proof", "exly"):
        return method
    return "stripe"


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
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )
    return True


async def try_reconcile_stripe_checkout_session(db, session_id: str, stripe_api_key: str) -> bool:
    """
    Poll Stripe Checkout; if paid, update transaction + enrollment.
    Used by admin lists to heal missed webhooks / success-page polls.
    """
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

    stripe_status = str(getattr(sess, "payment_status", "") or "").lower()
    if stripe_status != "paid":
        logger.info("Stripe session %s payment_status=%s (not paid yet)", sid, stripe_status or "unknown")
        return False

    tx = await db.payment_transactions.find_one({"stripe_session_id": sid}, {"_id": 0})
    if not tx:
        return False

    now = datetime.now(timezone.utc)
    await db.payment_transactions.update_one(
        {"stripe_session_id": sid},
        {
            "$set": {
                "payment_status": "paid",
                "paid_at": tx.get("paid_at") or now.isoformat(),
                "updated_at": now,
            }
        },
    )

    enrollment_id = tx.get("enrollment_id")
    if enrollment_id:
        await reconcile_enrollment_with_paid_transaction(
            db,
            enrollment_id,
            {**tx, "payment_status": "paid"},
        )
        logger.info("Reconciled paid Stripe checkout %s → enrollment %s", sid, enrollment_id)
    return True


async def reconcile_enrollment_checkout_from_db(
    db,
    enrollment: dict,
    txns: List[dict],
    *,
    stripe_key: str = "",
    poll_stripe: bool = True,
) -> Tuple[dict, List[dict], dict]:
    """
    Heal one enrollment: optional Stripe poll, then align status with paid txns.
    Returns (enrollment, txns, result_meta).
    """
    eid = enrollment.get("id")
    meta = {"stripe_polled": False, "stripe_paid": False, "enrollment_updated": False}
    if not eid:
        return enrollment, txns, meta

    key = stripe_key or (await get_stripe_api_key())
    st = str(enrollment.get("status") or "").strip().lower()
    has_paid = any(transaction_is_paid(t) for t in txns)

    if poll_stripe and key and st in INCOMPLETE_CHECKOUT_STATUSES and not has_paid:
        for txn in sorted(txns, key=_txn_sort_ts, reverse=True):
            if transaction_is_paid(txn):
                break
            sid = (txn.get("stripe_session_id") or enrollment.get("stripe_session_id") or "").strip()
            if not sid or sid.startswith("rz_") or txn.get("payment_provider") == "razorpay":
                continue
            meta["stripe_polled"] = True
            if await try_reconcile_stripe_checkout_session(db, sid, key):
                meta["stripe_paid"] = True
                txns = await db.payment_transactions.find({"enrollment_id": eid}, {"_id": 0}).to_list(50)
            break

    for txn in txns:
        if transaction_is_paid(txn):
            if await reconcile_enrollment_with_paid_transaction(db, eid, txn, enrollment=enrollment):
                meta["enrollment_updated"] = True
                enrollment["status"] = "completed"
                enrollment["payment_method"] = txn.get("payment_method") or enrollment.get("payment_method")
            break

    return enrollment, txns, meta
