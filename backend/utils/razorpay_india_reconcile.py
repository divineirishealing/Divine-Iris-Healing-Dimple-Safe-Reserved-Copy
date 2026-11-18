"""Poll Razorpay for captured India landing payments missing in MongoDB."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict

from motor.motor_asyncio import AsyncIOMotorDatabase

from utils.enrollment_checkout_status import INCOMPLETE_CHECKOUT_STATUSES, transaction_is_paid
from utils.india_program_razorpay_plink import (
    _cache_id,
    backfill_india_plink_checkout_orphans,
    fulfill_india_program_payment_link_payment,
)
from utils.razorpay_payment_links import (
    fetch_razorpay_order_payments,
    fetch_razorpay_payment,
    fetch_razorpay_payment_link,
)

logger = logging.getLogger(__name__)


def _digits(phone: str) -> str:
    return "".join(c for c in (phone or "") if c.isdigit())[-10:]


def _contact_matches(enrollment: dict, payment: dict) -> bool:
    email = (enrollment.get("booker_email") or "").strip().lower()
    pay_email = (payment.get("email") or "").strip().lower()
    if email and pay_email and email == pay_email:
        return True
    en_ph = _digits(enrollment.get("phone") or "")
    pay_ph = _digits(payment.get("contact") or payment.get("phone") or "")
    if en_ph and pay_ph and en_ph == pay_ph:
        return True
    return False


async def _mark_order_payment_paid(db, enrollment: dict, txn: dict, payment: dict) -> bool:
    from routes.payments import run_enrollment_razorpay_success_hooks
    from utils.razorpay_capture import razorpay_payment_is_captured

    pid = (payment.get("id") or "").strip()
    if not pid or not razorpay_payment_is_captured(payment):
        return False
    if transaction_is_paid(txn):
        return False

    session_id = (txn.get("stripe_session_id") or enrollment.get("stripe_session_id") or "").strip()
    if not session_id:
        return False

    now = datetime.now(timezone.utc)
    await db.payment_transactions.update_one(
        {"id": txn["id"]},
        {
            "$set": {
                "payment_status": "paid",
                "razorpay_payment_id": pid,
                "paid_at": now.isoformat(),
                "updated_at": now,
            }
        },
    )
    await run_enrollment_razorpay_success_hooks(session_id)
    return True


async def reconcile_india_landing_razorpay_checkouts(db: AsyncIOMotorDatabase, *, limit: int = 150) -> Dict[str, Any]:
    """
    Heal stuck checkout_started rows when Razorpay captured payment but our webhook/verify missed it.
    """
    from key_manager import get_key

    key_id = (await get_key("razorpay_key_id") or "").strip()
    key_secret = (await get_key("razorpay_key_secret") or "").strip()
    meta: Dict[str, Any] = {"orders_synced": 0, "plinks_fulfilled": 0, "skipped": 0}
    if not key_id or not key_secret:
        meta["error"] = "razorpay_not_configured"
        return meta

    query = {
        "status": {"$in": list(INCOMPLETE_CHECKOUT_STATUSES)},
        "$or": [
            {"created_via": "india_landing"},
            {"landing_path": {"$regex": r"^/india/program/"}},
            {"cart_items.0": {"$exists": True}},
            {"india_site_checkout": True},
            {"currency": "inr"},
        ],
    }
    enrollments = await db.enrollments.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)

    for enrollment in enrollments:
        eid = (enrollment.get("id") or "").strip()
        program_id = (enrollment.get("item_id") or "").strip()
        if not eid or not program_id:
            meta["skipped"] += 1
            continue

        txns = await db.payment_transactions.find({"enrollment_id": eid}, {"_id": 0}).sort("created_at", -1).to_list(8)
        if any(transaction_is_paid(t) for t in txns):
            meta["skipped"] += 1
            continue

        synced_order = False
        for txn in txns:
            oid = (txn.get("razorpay_order_id") or "").strip()
            if not oid:
                continue
            try:
                payments = await fetch_razorpay_order_payments(
                    order_id=oid,
                    key_id=key_id,
                    key_secret=key_secret,
                )
            except Exception as exc:
                logger.warning("order payments %s: %s", oid, exc)
                continue
            for payment in payments:
                if not _contact_matches(enrollment, payment):
                    continue
                if await _mark_order_payment_paid(db, enrollment, txn, payment):
                    meta["orders_synced"] += 1
                    synced_order = True
                    break
            if synced_order:
                break

        if synced_order:
            continue

        cached = await db.razorpay_cached_payment_links.find_one({"_id": _cache_id(program_id)}, {"_id": 0})
        plink_id = (cached or {}).get("payment_link_id") or ""
        if not plink_id:
            meta["skipped"] += 1
            continue

        try:
            link_doc = await fetch_razorpay_payment_link(
                payment_link_id=plink_id,
                key_id=key_id,
                key_secret=key_secret,
            )
        except Exception as exc:
            logger.warning("payment link fetch %s: %s", plink_id, exc)
            meta["skipped"] += 1
            continue

        payments = link_doc.get("payments") or []
        for entry in payments:
            pay_id = (entry.get("payment_id") or entry.get("id") or "").strip()
            pay_status = (entry.get("status") or "").lower()
            if not pay_id or pay_status not in ("captured", "paid"):
                continue
            try:
                payment = await fetch_razorpay_payment(
                    payment_id=pay_id,
                    key_id=key_id,
                    key_secret=key_secret,
                )
            except Exception as exc:
                logger.warning("payment fetch %s: %s", pay_id, exc)
                continue
            if not _contact_matches(enrollment, payment):
                continue
            try:
                await fulfill_india_program_payment_link_payment(
                    db,
                    key_id=key_id,
                    key_secret=key_secret,
                    payment_id=pay_id,
                    payment_link_id=plink_id,
                    expected_program_id=program_id,
                )
                meta["plinks_fulfilled"] += 1
                break
            except Exception as exc:
                logger.warning("plink fulfill %s for %s: %s", pay_id, eid, exc)

    await backfill_india_plink_checkout_orphans(db, limit=limit)
    try:
        from utils.enrollment_email_backfill import backfill_paid_enrollment_emails

        meta["emails_backfilled"] = await backfill_paid_enrollment_emails(db, limit=40)
    except Exception as exc:
        logger.warning("reconcile email backfill: %s", exc)
        meta["emails_backfilled"] = 0
    return meta