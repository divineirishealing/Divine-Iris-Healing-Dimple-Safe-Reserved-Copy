"""Generic India Razorpay landing for any upcoming program (Stress Detox, Heal The Heart, etc.)."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Tuple

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
import os

from utils.landing_checkout_validators import IndiaProgramLandingCheckoutBody

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / ".env")

router = APIRouter(prefix="/api/landing/india-program", tags=["India program landing"])
logger = logging.getLogger(__name__)

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

MAHALAKSHMI_PROGRAM_ID = "4e564441-9f90-400b-ae44-b192fedf2f15"


def _landing_path(program_id: str) -> str:
    return f"/india/program/{program_id}"


async def _next_receipt_id() -> str:
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


async def _load_program(program_id: str) -> dict:
    pid = (program_id or "").strip()
    if not pid:
        raise HTTPException(status_code=400, detail="Program id required")
    program = await db.programs.find_one({"id": pid}, {"_id": 0})
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    if not program.get("enrollment_open", True):
        raise HTTPException(status_code=400, detail="Enrollment is not open for this program")
    return program


def _is_dedicated_landing(program: dict) -> Optional[str]:
    """Programs with bespoke India pages should not use the generic route."""
    from utils.awrp_intro_program import awrp_intro_program_id

    pid = (program.get("id") or "").strip()
    if pid == MAHALAKSHMI_PROGRAM_ID:
        return "/india/shri-mahalakshmi-akshaya-samriddhi"
    intro_id = awrp_intro_program_id()
    if intro_id and pid == intro_id:
        return "/india/awrp-intro-call"
    title = (program.get("title") or "").strip().lower()
    if "awrp" in title and ("intro call" in title or "introductory call" in title):
        return "/india/awrp-intro-call"
    custom = (program.get("link") or "").strip().split("?")[0]
    if custom.startswith("/india/") and custom not in ("/india/program", "/india/program/"):
        if not custom.startswith("/india/program/"):
            return custom
    return None


async def _inr_totals(program: dict, tier_index: int) -> Tuple[float, float, dict]:
    """Catalog offer INR (same as homepage cards) — all-in Razorpay amount, no GST/platform add-on."""
    from routes.enrollment import _per_person_price_for_program

    list_inr = float(_per_person_price_for_program(program, tier_index, "inr"))
    if list_inr <= 0:
        raise HTTPException(status_code=400, detail="Set an INR price for this program in admin.")

    charged = float(round(list_inr))
    india_br = {
        "list_price_inr": round(list_inr, 2),
        "rounded_total_inr": charged,
        "landing_price_all_inclusive": True,
    }
    return list_inr, charged, india_br


@router.get("/{program_id}/quote")
async def india_program_quote(
    program_id: str,
    tier_index: int = Query(0, ge=0),
):
    from routes.razorpay_payments import razorpay_public_config

    program = await _load_program(program_id)
    dedicated = _is_dedicated_landing(program)
    list_inr, charged_inr, breakdown = await _inr_totals(program, tier_index)
    cfg = await razorpay_public_config()
    title = (program.get("title") or "Program").strip()
    return {
        "program_id": program.get("id"),
        "title": title,
        "landing_path": _landing_path(program_id),
        "dedicated_landing_path": dedicated,
        "tier_index": tier_index,
        "list_inr": round(list_inr, 2),
        "charged_inr": round(charged_inr, 2),
        "india_checkout_breakdown": breakdown,
        "razorpay_enabled": bool(cfg.get("enabled")),
    }


@router.post("/{program_id}/checkout")
async def india_program_checkout(program_id: str, body: IndiaProgramLandingCheckoutBody):
    from key_manager import get_key
    from routes.clients import ensure_client_from_enrollment_lead
    from utils.razorpay_orders import create_razorpay_order, unique_razorpay_receipt

    program = await _load_program(program_id)
    dedicated = _is_dedicated_landing(program)
    if dedicated:
        raise HTTPException(
            status_code=400,
            detail=f"This program uses a dedicated India page at {dedicated}.",
        )

    key_id = (await get_key("razorpay_key_id") or "").strip()
    key_secret = (await get_key("razorpay_key_secret") or "").strip()
    if not key_id or not key_secret:
        raise HTTPException(status_code=503, detail="Razorpay is not configured.")

    tier_index = body.tier_index
    list_inr, charged_inr, india_br = await _inr_totals(program, tier_index)
    item_title = (program.get("title") or "Program").strip()
    item_id = program.get("id")
    landing_path = _landing_path(item_id)

    now = datetime.now(timezone.utc)
    enrollment_id = await _next_receipt_id()
    mode_label = "Online (Zoom)" if body.attendance_mode == "online" else "Offline (Remote)"

    participant = {
        "name": body.name,
        "relationship": "Self",
        "age": 0,
        "gender": "",
        "country": "IN",
        "city": "",
        "state": "",
        "attendance_mode": body.attendance_mode,
        "notify": True,
        "email": body.email,
        "phone": body.phone,
        "whatsapp": body.phone,
        "program_id": item_id,
        "program_title": item_title,
        "is_first_time": True,
        "referral_source": "",
        "referred_by_name": "",
    }
    enrollment = {
        "id": enrollment_id,
        "status": "checkout_started",
        "step": 4,
        "booker_name": body.name,
        "booker_email": body.email,
        "booker_country": "IN",
        "ip_info": {"country": "IN"},
        "phone": body.phone,
        "participants": [participant],
        "participant_count": 1,
        "attendance": body.attendance_mode,
        "attendance_label": mode_label,
        "item_type": "program",
        "item_id": item_id,
        "item_title": item_title,
        "tier_index": tier_index,
        "currency": "inr",
        "amount": list_inr,
        "created_via": "india_landing",
        "checkout_channel": "india_page",
        "landing_path": landing_path,
        "ad_utm": {
            "utm_source": body.utm_source,
            "utm_medium": body.utm_medium,
            "utm_campaign": body.utm_campaign,
            "utm_content": body.utm_content,
        },
        "email_verified": False,
        "phone_verified": False,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    await db.enrollments.insert_one(enrollment)
    try:
        await ensure_client_from_enrollment_lead(enrollment)
    except Exception as ex:
        logger.warning("india program landing lead client: %s", ex)

    month_prefix = now.strftime("%Y-%m")
    count = await db.payment_transactions.count_documents({"invoice_number": {"$regex": f"^{month_prefix}"}})
    invoice_number = f"{month_prefix}-{str(count + 1).zfill(3)}"
    session_key = f"rz_{uuid.uuid4().hex}"
    receipt = unique_razorpay_receipt(session_key, prefix="IN")
    amount_paise = int(round(charged_inr * 100))

    order = await create_razorpay_order(
        key_id=key_id,
        key_secret=key_secret,
        amount_paise=amount_paise,
        receipt=receipt,
        notes={
            "landing": "india-program",
            "enrollment_id": enrollment_id,
            "item_id": item_id,
            "session_key": session_key,
        },
        context=f"India program landing ({item_title})",
    )
    order_id = order.get("id")
    if not order_id:
        raise HTTPException(status_code=502, detail="Could not create payment order. Try again later.")

    transaction = {
        "id": str(uuid.uuid4()),
        "invoice_number": invoice_number,
        "enrollment_id": enrollment_id,
        "stripe_session_id": session_key,
        "razorpay_order_id": order_id,
        "payment_provider": "razorpay",
        "razorpay_landing": True,
        "created_via": "india_landing",
        "item_type": "program",
        "item_id": item_id,
        "item_title": item_title,
        "tier_index": tier_index,
        "amount": charged_inr,
        "currency": "inr",
        "stripe_currency": "inr",
        "stripe_amount": charged_inr,
        "enrollment_list_inr": round(list_inr, 2),
        "india_checkout_breakdown": india_br,
        "payment_status": "pending",
        "booker_name": body.name,
        "booker_email": body.email,
        "phone": body.phone,
        "participants": [participant],
        "participant_count": 1,
        "attendance": body.attendance_mode,
        "created_at": now,
        "updated_at": now,
    }
    portal_user = await db.users.find_one({"email": body.email}, {"id": 1, "client_id": 1})
    if portal_user:
        transaction["portal_user_id"] = portal_user.get("id")
        client_id = (portal_user.get("client_id") or "").strip()
        if client_id:
            transaction["portal_client_id"] = client_id

    await db.payment_transactions.insert_one(transaction)
    await db.enrollments.update_one(
        {"id": enrollment_id},
        {"$set": {"stripe_session_id": session_key, "updated_at": now.isoformat()}},
    )

    return {
        "key_id": key_id,
        "order_id": order_id,
        "amount": amount_paise,
        "currency": "INR",
        "session_id": session_key,
        "name": body.name,
        "email": body.email,
        "phone": body.phone,
        "description": item_title,
        "list_inr": round(list_inr, 2),
        "charged_inr": round(charged_inr, 2),
    }


class IndiaProgramPlinkFulfillBody(BaseModel):
    razorpay_payment_id: str
    razorpay_payment_link_id: str = ""
    razorpay_payment_link_reference_id: str = ""
    razorpay_payment_link_status: str = ""
    razorpay_signature: str = ""


@router.get("/{program_id}/razorpay-payment-link")
async def get_india_program_razorpay_payment_link(
    program_id: str,
    tier_index: int = Query(0, ge=0),
):
    """Public: Razorpay Payment Link short URL for workshop QR posters."""
    from key_manager import get_key
    from utils.india_program_razorpay_plink import ensure_india_program_payment_link

    program = await _load_program(program_id)
    dedicated = _is_dedicated_landing(program)
    if dedicated:
        raise HTTPException(
            status_code=400,
            detail=f"This program uses a dedicated India page at {dedicated}.",
        )

    key_id = (await get_key("razorpay_key_id") or "").strip()
    key_secret = (await get_key("razorpay_key_secret") or "").strip()
    if not key_id or not key_secret:
        raise HTTPException(status_code=503, detail="Razorpay is not configured.")

    _list_inr, charged_inr, _breakdown = await _inr_totals(program, tier_index)
    item_title = (program.get("title") or "Program").strip()
    landing_path = _landing_path(program_id)

    cached = await ensure_india_program_payment_link(
        db,
        key_id=key_id,
        key_secret=key_secret,
        program_id=program_id,
        amount_inr=charged_inr,
        item_title=item_title,
        landing_path=landing_path,
        tier_index=tier_index,
    )
    return {
        "payment_link_id": cached.get("payment_link_id"),
        "short_url": cached.get("short_url"),
        "amount_inr": charged_inr,
        "title": item_title,
        "program_id": program_id,
        "landing_path": landing_path,
        "tier_index": tier_index,
        "provider": "razorpay",
    }


@router.post("/{program_id}/fulfill-payment-link")
async def fulfill_india_program_payment_link(program_id: str, body: IndiaProgramPlinkFulfillBody):
    """After Razorpay Payment Link checkout — enroll + confirmation emails."""
    from key_manager import get_key
    from utils.india_program_razorpay_plink import fulfill_india_program_payment_link_payment
    from utils.awrp_intro_razorpay_plink import verify_payment_link_callback_signature

    key_secret = (await get_key("razorpay_key_secret") or "").strip()
    key_id = (await get_key("razorpay_key_id") or "").strip()
    if not key_id or not key_secret:
        raise HTTPException(status_code=503, detail="Razorpay is not configured.")

    pid = (body.razorpay_payment_id or "").strip()
    plink = (body.razorpay_payment_link_id or "").strip()
    sig = (body.razorpay_signature or "").strip()
    if sig and plink and pid:
        ok = verify_payment_link_callback_signature(
            payment_link_id=plink,
            payment_id=pid,
            status=(body.razorpay_payment_link_status or "paid").strip(),
            reference_id=(body.razorpay_payment_link_reference_id or "").strip(),
            signature=sig,
            key_secret=key_secret,
        )
        if not ok:
            raise HTTPException(status_code=400, detail="Invalid Razorpay signature.")

    return await fulfill_india_program_payment_link_payment(
        db,
        key_id=key_id,
        key_secret=key_secret,
        payment_id=pid,
        payment_link_id=plink or None,
        expected_program_id=program_id,
    )