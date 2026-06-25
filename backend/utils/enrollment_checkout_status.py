"""Enrollment checkout status helpers — align enrollment.status with paid transactions."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

PAID_TRANSACTION_STATUSES = frozenset({"paid", "complete", "completed"})
COMPLETED_ENROLLMENT_STATUSES = frozenset({"completed", "paid", "india_payment_approved"})
INCOMPLETE_CHECKOUT_STATUSES = frozenset({"checkout_started", "otp_verified", "started", "pending"})


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
    except Exception:
        return False

    if str(getattr(sess, "payment_status", "") or "").lower() != "paid":
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
    return True
