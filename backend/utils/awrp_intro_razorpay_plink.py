"""AWRP Intro Call — shared Razorpay Payment Link + post-pay enrollment."""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from utils.razorpay_payment_links import (
    cancel_razorpay_payment_link,
    create_razorpay_payment_link,
    fetch_razorpay_payment,
)

logger = logging.getLogger(__name__)

CACHE_DOC_ID = "awrp_intro"
LANDING_PATH = "/india/awrp-intro-call"
PROGRAM_TITLE = "AWRP Intro Call"


def _frontend_base_url() -> str:
    return (
        os.environ.get("PUBLIC_SITE_URL")
        or os.environ.get("FRONTEND_URL")
        or "https://www.divineirishealing.com"
    ).strip().rstrip("/")


def normalize_phone(raw: str) -> str:
    text = re.sub(r"[^\d+]", "", (raw or "").strip())
    digits = re.sub(r"\D", "", text)
    if len(digits) == 10:
        return "+91" + digits
    if text.startswith("+"):
        return "+" + digits
    if digits:
        return "+" + digits
    return ""


def _customer_from_payment(payment: dict) -> Tuple[str, str, str]:
    email = (payment.get("email") or "").strip().lower()
    phone = normalize_phone(payment.get("contact") or "")
    notes = payment.get("notes") or {}
    name = (
        (payment.get("notes", {}) or {}).get("name")
        or notes.get("customer_name")
        or ""
    )
    if not name.strip():
        vpa = (payment.get("vpa") or "").strip()
        name = email.split("@", 1)[0].replace(".", " ").title() if email else (vpa or "Guest")
    return name.strip()[:200] or "Guest", email, phone


def verify_payment_link_callback_signature(
    *,
    payment_link_id: str,
    payment_id: str,
    status: str,
    reference_id: str,
    signature: str,
    key_secret: str,
) -> bool:
    if not key_secret.strip() or not signature.strip():
        return False
    payload = "|".join(
        [
            (payment_link_id or "").strip(),
            (payment_id or "").strip(),
            (status or "").strip(),
            (reference_id or "").strip(),
        ]
    )
    expected = hmac.new(key_secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature.strip())


async def _next_receipt_id(db: AsyncIOMotorDatabase) -> str:
    now = datetime.now(timezone.utc)
    counter = await db.counters.find_one_and_update(
        {"_id": f"receipt_{now.strftime('%Y')}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
        projection={"_id": 0, "seq": 1},
    )
    seq = counter["seq"]
    mystery = f"{now.month}{seq * 3:02d}"
    return f"DIH-{mystery}-{seq:03d}"


async def ensure_awrp_intro_payment_link(
    db: AsyncIOMotorDatabase,
    *,
    key_id: str,
    key_secret: str,
    amount_inr: float,
    program_id: str,
    item_title: str,
) -> dict:
    """Return cached Razorpay Payment Link (recreate when INR price changes)."""
    amount_paise = int(round(float(amount_inr) * 100))
    cached = await db.razorpay_cached_payment_links.find_one({"_id": CACHE_DOC_ID}, {"_id": 0})

    if (
        cached
        and cached.get("amount_paise") == amount_paise
        and cached.get("program_id") == program_id
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
            logger.warning("Cancel old AWRP payment link: %s", exc)

    reference_id = f"awrpintro{amount_paise}"[:40]
    callback_url = (
        f"{_frontend_base_url()}/payment/success"
        f"?from=india-awrp-intro&plink=1"
    )
    created = await create_razorpay_payment_link(
        key_id=key_id,
        key_secret=key_secret,
        amount_paise=amount_paise,
        description=item_title or PROGRAM_TITLE,
        reference_id=reference_id,
        callback_url=callback_url,
        notes={
            "landing": "awrp-intro",
            "program_id": program_id,
            "item_id": program_id,
        },
        context="AWRP intro payment link",
    )

    doc = {
        "_id": CACHE_DOC_ID,
        "payment_link_id": created.get("id"),
        "short_url": created.get("short_url"),
        "amount_inr": float(amount_inr),
        "amount_paise": amount_paise,
        "program_id": program_id,
        "item_title": item_title,
        "reference_id": reference_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.razorpay_cached_payment_links.replace_one({"_id": CACHE_DOC_ID}, doc, upsert=True)
    return {k: v for k, v in doc.items() if k != "_id"}


async def fulfill_awrp_intro_payment_link_payment(
    db: AsyncIOMotorDatabase,
    *,
    key_id: str,
    key_secret: str,
    payment_id: str,
    payment_link_id: Optional[str] = None,
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
    if (notes.get("landing") or "") != "awrp-intro" and payment_link_id:
        cached = await db.razorpay_cached_payment_links.find_one({"_id": CACHE_DOC_ID}, {"_id": 0})
        if not cached or cached.get("payment_link_id") != payment_link_id:
            raise HTTPException(status_code=400, detail="Payment is not for the AWRP intro link.")

    program_id = (notes.get("program_id") or notes.get("item_id") or "").strip()
    if not program_id:
        cached = await db.razorpay_cached_payment_links.find_one({"_id": CACHE_DOC_ID}, {"_id": 0}) or {}
        program_id = (cached.get("program_id") or "").strip()
    if not program_id:
        from utils.awrp_intro_program import awrp_intro_program_id

        program_id = awrp_intro_program_id()

    amount_paise = int(payment.get("amount") or 0)
    amount_inr = amount_paise / 100.0 if amount_paise else 0.0
    pending_title = PROGRAM_TITLE

    prog = await db.programs.find_one({"id": program_id}, {"_id": 0, "title": 1})
    if prog:
        pending_title = (prog.get("title") or PROGRAM_TITLE).strip()

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
        "tier_index": 0,
        "currency": "inr",
        "amount": amount_inr,
        "created_via": "india_landing",
        "landing_path": LANDING_PATH,
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
        "tier_index": 0,
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
        logger.warning("awrp plink lead client: %s", exc)

    from routes.payments import run_enrollment_razorpay_success_hooks

    await run_enrollment_razorpay_success_hooks(session_id)
    return {"ok": True, "session_id": session_id, "already_fulfilled": False}