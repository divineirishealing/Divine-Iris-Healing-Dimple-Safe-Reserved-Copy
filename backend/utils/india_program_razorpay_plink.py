"""Generic India program landing — Razorpay Payment Link + QR (Stress Detox, etc.)."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from utils.awrp_intro_razorpay_plink import (
    _customer_from_payment,
    _frontend_base_url,
    _next_receipt_id,
    verify_payment_link_callback_signature,
)
from utils.razorpay_payment_links import (
    cancel_razorpay_payment_link,
    create_razorpay_payment_link,
    fetch_razorpay_payment,
)

logger = logging.getLogger(__name__)

LANDING_NOTE = "india-program"
SUCCESS_FROM_QUERY = "india-program-plink"


def _cache_id(program_id: str) -> str:
    return f"india_program_{(program_id or '').strip()}"


async def ensure_india_program_payment_link(
    db: AsyncIOMotorDatabase,
    *,
    key_id: str,
    key_secret: str,
    program_id: str,
    amount_inr: float,
    item_title: str,
    landing_path: str,
    tier_index: int = 0,
) -> dict:
    """Return cached Razorpay Payment Link (recreate when INR price changes)."""
    pid = (program_id or "").strip()
    if not pid:
        raise HTTPException(status_code=400, detail="program_id required")

    amount_paise = int(round(float(amount_inr) * 100))
    cache_key = _cache_id(pid)
    cached = await db.razorpay_cached_payment_links.find_one({"_id": cache_key}, {"_id": 0})

    if (
        cached
        and cached.get("amount_paise") == amount_paise
        and cached.get("program_id") == pid
        and cached.get("tier_index") == tier_index
        and cached.get("short_url")
        and cached.get("payment_link_id")
    ):
        return cached

    if cached and cached.get("payment_link_id"):
        try:
            await cancel_razorpay_payment_link(
                payment_link_id=cached["payment_link_id"],
                key_id=key_id,
                key_secret=key_secret,
            )
        except Exception as exc:
            logger.warning("Cancel old india program payment link %s: %s", pid, exc)

    safe_ref = "".join(c for c in pid if c.isalnum())[:12]
    reference_id = f"indiaprog{amount_paise}{safe_ref}"[:40]
    callback_url = (
        f"{_frontend_base_url()}/payment/success"
        f"?from={SUCCESS_FROM_QUERY}&plink=1&program_id={pid}"
    )
    created = await create_razorpay_payment_link(
        key_id=key_id,
        key_secret=key_secret,
        amount_paise=amount_paise,
        description=item_title or "Program",
        reference_id=reference_id,
        callback_url=callback_url,
        notes={
            "landing": LANDING_NOTE,
            "program_id": pid,
            "item_id": pid,
            "tier_index": str(tier_index),
        },
        context=f"India program payment link ({pid})",
    )

    doc = {
        "_id": cache_key,
        "payment_link_id": created.get("id"),
        "short_url": created.get("short_url"),
        "amount_inr": float(amount_inr),
        "amount_paise": amount_paise,
        "program_id": pid,
        "tier_index": tier_index,
        "item_title": item_title,
        "landing_path": landing_path,
        "reference_id": reference_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.razorpay_cached_payment_links.replace_one({"_id": cache_key}, doc, upsert=True)
    return {k: v for k, v in doc.items() if k != "_id"}


async def fulfill_india_program_payment_link_payment(
    db: AsyncIOMotorDatabase,
    *,
    key_id: str,
    key_secret: str,
    payment_id: str,
    payment_link_id: Optional[str] = None,
    expected_program_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Create enrollment + emails for a captured Payment Link payment (idempotent)."""
    pid = (payment_id or "").strip()
    if not pid:
        raise HTTPException(status_code=400, detail="Missing razorpay_payment_id.")

    existing = await db.payment_transactions.find_one({"razorpay_payment_id": pid}, {"_id": 0})
    if existing and existing.get("payment_status") == "paid" and existing.get("enrollment_id"):
        session_id = (existing.get("stripe_session_id") or "").strip()
        if session_id and not existing.get("emails_sent"):
            from routes.payments import run_enrollment_razorpay_success_hooks

            await run_enrollment_razorpay_success_hooks(session_id)
        return {"ok": True, "session_id": session_id, "already_fulfilled": True}

    payment = await fetch_razorpay_payment(
        payment_id=pid,
        key_id=key_id,
        key_secret=key_secret,
    )
    status = (payment.get("status") or "").lower()
    if status not in ("captured", "authorized"):
        raise HTTPException(status_code=400, detail=f"Payment is not complete (status={status}).")

    notes = payment.get("notes") or {}
    program_id = (notes.get("program_id") or notes.get("item_id") or "").strip()
    if expected_program_id:
        program_id = (expected_program_id or "").strip() or program_id

    tier_index = 0
    try:
        tier_index = int(notes.get("tier_index") or 0)
    except (TypeError, ValueError):
        tier_index = 0

    if payment_link_id and program_id:
        cached = await db.razorpay_cached_payment_links.find_one(
            {"_id": _cache_id(program_id)},
            {"_id": 0},
        )
        if cached and cached.get("payment_link_id") != payment_link_id:
            raise HTTPException(status_code=400, detail="Payment is not for this program link.")

    if not program_id:
        raise HTTPException(status_code=400, detail="Payment missing program id.")

    prog = await db.programs.find_one({"id": program_id}, {"_id": 0})
    if not prog:
        raise HTTPException(status_code=404, detail="Program not found.")

    pending_title = (prog.get("title") or "Program").strip()
    landing_path = f"/india/program/{program_id}"
    cached = await db.razorpay_cached_payment_links.find_one({"_id": _cache_id(program_id)}, {"_id": 0})
    if cached and cached.get("landing_path"):
        landing_path = cached["landing_path"]

    amount_paise = int(payment.get("amount") or 0)
    amount_inr = amount_paise / 100.0 if amount_paise else 0.0

    name, email, phone = _customer_from_payment(payment)
    if not email:
        raise HTTPException(
            status_code=400,
            detail="Payment has no email — ask the payer to retry with email on the Razorpay page.",
        )

    session_id = f"rz_{uuid.uuid4().hex}"
    enrollment_id = await _next_receipt_id(db)
    now = datetime.now(timezone.utc)

    participant = {
        "name": name,
        "relationship": "Self",
        "age": 0,
        "gender": "",
        "country": "IN",
        "city": "",
        "state": "",
        "attendance_mode": "online",
        "notify": True,
        "email": email,
        "phone": phone,
        "whatsapp": phone,
        "program_id": program_id,
        "program_title": pending_title,
        "is_first_time": True,
        "referral_source": "",
        "referred_by_name": "",
    }
    enrollment = {
        "id": enrollment_id,
        "status": "completed",
        "step": 4,
        "booker_name": name,
        "booker_email": email,
        "booker_country": "IN",
        "ip_info": {"country": "IN"},
        "phone": phone,
        "participants": [participant],
        "participant_count": 1,
        "attendance": "online",
        "attendance_label": "Online (Zoom)",
        "item_type": "program",
        "item_id": program_id,
        "item_title": pending_title,
        "tier_index": tier_index,
        "currency": "inr",
        "amount": amount_inr,
        "created_via": "india_landing",
        "landing_path": landing_path,
        "payment_method": "razorpay",
        "ad_utm": {"utm_medium": "razorpay_plink"},
        "email_verified": False,
        "phone_verified": False,
        "stripe_session_id": session_id,
        "paid_at": now.isoformat(),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }

    month_prefix = now.strftime("%Y-%m")
    count = await db.payment_transactions.count_documents({"invoice_number": {"$regex": f"^{month_prefix}"}})
    invoice_number = f"{month_prefix}-{str(count + 1).zfill(3)}"
    order_id = (payment.get("order_id") or "").strip()

    transaction = {
        "id": str(uuid.uuid4()),
        "invoice_number": invoice_number,
        "enrollment_id": enrollment_id,
        "stripe_session_id": session_id,
        "razorpay_order_id": order_id,
        "razorpay_payment_id": pid,
        "razorpay_payment_link_id": (payment_link_id or "").strip(),
        "payment_provider": "razorpay",
        "razorpay_landing": True,
        "razorpay_payment_link": True,
        "created_via": "india_landing_plink",
        "item_type": "program",
        "item_id": program_id,
        "item_title": pending_title,
        "tier_index": tier_index,
        "amount": amount_inr,
        "currency": "inr",
        "stripe_currency": "inr",
        "stripe_amount": amount_inr,
        "payment_status": "paid",
        "booker_name": name,
        "booker_email": email,
        "phone": phone,
        "participants": [participant],
        "participant_count": 1,
        "attendance": "online",
        "paid_at": now.isoformat(),
        "created_at": now,
        "updated_at": now,
    }

    await db.enrollments.insert_one(enrollment)
    await db.payment_transactions.insert_one(transaction)

    try:
        from routes.clients import ensure_client_from_enrollment_lead

        await ensure_client_from_enrollment_lead(enrollment)
    except Exception as exc:
        logger.warning("india program plink lead client: %s", exc)

    from routes.payments import run_enrollment_razorpay_success_hooks

    await run_enrollment_razorpay_success_hooks(session_id)
    return {"ok": True, "session_id": session_id, "already_fulfilled": False}