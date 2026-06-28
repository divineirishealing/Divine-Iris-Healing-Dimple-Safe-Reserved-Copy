"""Create enrollment rows for completed custom payment link checkouts."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from utils.enrollment_checkout_status import transaction_is_paid

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def payment_link_enrollment_id(req_id: str) -> str:
    """Stable enrollment id per payment link (same link → same row, including installments)."""
    rid = str(req_id or "").strip()
    if not rid:
        return f"PL-{uuid.uuid4().hex[:12]}"
    return f"PL-{rid}"


def _enrollment_status_from_request(req: dict, tx: dict) -> str:
    req_st = str(req.get("status") or "").lower()
    if req_st == "paid":
        return "completed"
    if req_st == "partially_paid":
        return "partially_paid"
    if transaction_is_paid(tx):
        return "completed"
    return "checkout_started"


def _resolve_catalog_fields(req: dict, tx: dict) -> Dict[str, Any]:
    cat_type = str(req.get("item_type") or tx.get("catalog_item_type") or "").strip().lower()
    cat_id = str(req.get("item_id") or tx.get("catalog_item_id") or "").strip()
    cat_title = str(req.get("item_title") or tx.get("catalog_item_title") or "").strip()
    link_title = str(req.get("title") or tx.get("item_title") or "").strip()

    if cat_type in ("program", "session", "annual_package") and cat_id:
        item_type = cat_type
        item_id = cat_id
        item_title = cat_title or link_title
    else:
        item_type = "payment_link"
        item_id = str(req.get("id") or tx.get("payment_request_id") or tx.get("item_id") or "").strip()
        item_title = link_title or "Custom payment link"

    return {
        "item_type": item_type,
        "item_id": item_id,
        "item_title": item_title,
        "tier_index": req.get("tier_index") if req.get("tier_index") is not None else tx.get("tier_index"),
        "chosen_start_date": req.get("chosen_start_date") or tx.get("chosen_start_date") or "",
        "chosen_end_date": req.get("chosen_end_date") or tx.get("chosen_end_date") or "",
        "chosen_tier_label": req.get("chosen_tier_label") or tx.get("chosen_tier_label") or "",
        "session_date": req.get("session_date") or tx.get("session_date") or "",
    }


async def ensure_enrollment_for_payment_request_tx(db, tx: dict) -> Optional[str]:
    """
    Ensure a paid custom payment link checkout has a row in `enrollments`.
    Links all related transactions to the same enrollment id.
    """
    if not transaction_is_paid(tx):
        return None

    req_id = str(tx.get("payment_request_id") or tx.get("item_id") or "").strip()
    if not req_id:
        return None

    is_link = (
        str(tx.get("item_type") or "").lower() == "payment_request"
        or tx.get("created_via") == "payment_request"
        or tx.get("payment_request_id")
    )
    if not is_link:
        return None

    req = await db.payment_requests.find_one({"id": req_id}, {"_id": 0})
    if not req:
        return None

    eid = str(tx.get("enrollment_id") or req.get("enrollment_id") or "").strip() or payment_link_enrollment_id(req_id)

    booker_name = (
        str(tx.get("booker_name") or req.get("payer_name") or req.get("recipient_name") or "").strip()
    )
    booker_email = (
        str(tx.get("booker_email") or req.get("payer_email") or req.get("recipient_email") or "")
        .strip()
        .lower()
    )
    catalog = _resolve_catalog_fields(req, tx)
    enroll_status = _enrollment_status_from_request(req, tx)
    paid_at = tx.get("paid_at") or req.get("paid_at") or _now_iso()
    provider = str(tx.get("payment_provider") or "stripe").strip().lower()
    method = str(tx.get("payment_method") or "").strip().lower()
    if method in ("gpay", "cash", "bank", "exly", "other", "stripe", "razorpay", "manual_proof"):
        payment_method = method
    elif provider == "razorpay":
        payment_method = "razorpay"
    elif provider == "manual":
        payment_method = method or "cash"
    else:
        payment_method = "stripe"

    participant = {"name": booker_name, "email": booker_email}
    patch: Dict[str, Any] = {
        "booker_name": booker_name,
        "booker_email": booker_email,
        "phone": str(req.get("recipient_phone") or "").strip(),
        "status": enroll_status,
        "step": 5,
        "payment_method": payment_method,
        "paid_at": paid_at,
        "updated_at": _now_iso(),
        "stripe_session_id": tx.get("stripe_session_id") or req.get("stripe_session_id"),
        "payment_request_id": req_id,
        "enrollment_origin": "payment_link",
        "participant_count": 1,
        "participants": [participant],
        **catalog,
    }

    existing = await db.enrollments.find_one({"id": eid}, {"_id": 0})
    if existing:
        await db.enrollments.update_one({"id": eid}, {"$set": patch})
    else:
        doc = {
            "id": eid,
            "created_at": tx.get("created_at") or req.get("created_at") or _now_iso(),
            **patch,
        }
        await db.enrollments.insert_one(doc)
        try:
            from routes.clients import ensure_client_from_enrollment_lead

            await ensure_client_from_enrollment_lead(doc)
        except Exception as exc:
            logger.warning("ensure_client_from_payment_link: %s", exc)

    await db.payment_transactions.update_many(
        {
            "$or": [
                {"payment_request_id": req_id},
                {"item_type": "payment_request", "item_id": req_id},
            ]
        },
        {"$set": {"enrollment_id": eid}},
    )
    await db.payment_requests.update_one({"id": req_id}, {"$set": {"enrollment_id": eid}})
    return eid


async def backfill_payment_link_enrollments(db, *, limit: int = 100) -> int:
    """Create missing enrollment rows for already-paid custom payment links."""
    query = {
        "$and": [
            {
                "$or": [
                    {"item_type": "payment_request"},
                    {"created_via": "payment_request"},
                    {"payment_request_id": {"$exists": True, "$ne": ""}},
                ]
            },
            {"payment_status": {"$in": ["paid", "complete", "completed"]}},
            {
                "$or": [
                    {"enrollment_id": {"$exists": False}},
                    {"enrollment_id": None},
                    {"enrollment_id": ""},
                ]
            },
        ]
    }
    txs = await db.payment_transactions.find(query, {"_id": 0}).sort("paid_at", -1).limit(limit).to_list(limit)
    created = 0
    seen_req: set[str] = set()
    for tx in txs:
        req_id = str(tx.get("payment_request_id") or tx.get("item_id") or "").strip()
        if not req_id or req_id in seen_req:
            continue
        seen_req.add(req_id)
        if await ensure_enrollment_for_payment_request_tx(db, tx):
            created += 1
    return created
