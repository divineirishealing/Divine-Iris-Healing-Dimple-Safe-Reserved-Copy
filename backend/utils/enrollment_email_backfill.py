"""Resend confirmation + WhatsApp-link emails for paid enrollments that missed hooks."""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


async def ensure_paid_enrollment_emails(db, session_id: str) -> bool:
    """Run Razorpay success hooks (receipt + participant notify) when not yet sent."""
    sid = (session_id or "").strip()
    if not sid:
        return False
    tx = await db.payment_transactions.find_one({"stripe_session_id": sid}, {"_id": 0})
    if not tx:
        return False
    if str(tx.get("payment_status") or "").lower() != "paid":
        return False
    if not (tx.get("enrollment_id") or "").strip():
        return False
    if tx.get("emails_sent"):
        return False
    from routes.payments import run_enrollment_razorpay_success_hooks

    await run_enrollment_razorpay_success_hooks(sid)
    return True


async def backfill_paid_enrollment_emails(db, *, limit: int = 40) -> int:
    """Find recent paid enrollments missing confirmation email and send."""
    query = {
        "payment_status": {"$in": ["paid", "completed", "complete"]},
        "enrollment_id": {"$nin": [None, ""]},
        "$or": [
            {"emails_sent": {"$exists": False}},
            {"emails_sent": False},
            {"emails_sent": None},
        ],
    }
    txs = await db.payment_transactions.find(query, {"_id": 0, "stripe_session_id": 1}).sort(
        "paid_at", -1
    ).limit(limit).to_list(limit)
    sent = 0
    for tx in txs:
        sid = (tx.get("stripe_session_id") or "").strip()
        if not sid:
            continue
        try:
            if await ensure_paid_enrollment_emails(db, sid):
                sent += 1
        except Exception as exc:
            logger.warning("backfill enrollment email %s: %s", sid, exc)
    return sent