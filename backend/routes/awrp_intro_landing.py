"""Public checkout for the AWRP Intro Call.

India / Meta ads page charges the INR price saved on the separate Programs record
titled "AWRP Intro Call" (not the main AWRP workshop).
"""
from __future__ import annotations

import logging
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, field_validator

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / ".env")

router = APIRouter(prefix="/api/landing/awrp-intro", tags=["AWRP intro landing"])
logger = logging.getLogger(__name__)

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

ITEM_ID = "awrp-intro-call"
PROGRAM_TITLE = "AWRP Intro Call"
LANDING_PATH = "/india/awrp-intro-call"
DISPOSABLE_DOMAINS = {
    "tempmail.com",
    "throwaway.email",
    "guerrillamail.com",
    "mailinator.com",
    "yopmail.com",
    "10minutemail.com",
}


class AwrpIntroCheckoutBody(BaseModel):
    name: str
    email: str
    phone: str
    utm_source: str = ""
    utm_medium: str = ""
    utm_campaign: str = ""
    utm_content: str = ""

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        name = " ".join((v or "").split())
        if len(name) < 2:
            raise ValueError("Please enter your name")
        return name[:200]

    @field_validator("email")
    @classmethod
    def clean_email(cls, v: str) -> str:
        email = (v or "").strip().lower()
        if not re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", email):
            raise ValueError("Please enter a valid email")
        domain = email.split("@", 1)[1]
        if domain in DISPOSABLE_DOMAINS:
            raise ValueError("Please use a regular email address")
        return email

    @field_validator("phone")
    @classmethod
    def clean_phone(cls, v: str) -> str:
        raw = re.sub(r"[^\d+]", "", (v or "").strip())
        digits = re.sub(r"\D", "", raw)
        if len(digits) < 8 or len(digits) > 15:
            raise ValueError("Please enter a valid phone number")
        if len(digits) == 10:
            return "+91" + digits
        if raw.startswith("+"):
            return "+" + digits
        return "+" + digits

    @field_validator("utm_source", "utm_medium", "utm_campaign", "utm_content")
    @classmethod
    def clean_utm(cls, v: str) -> str:
        return (v or "").strip()[:200]


from utils.awrp_intro_program import awrp_intro_program_id

AWRP_INTRO_PROGRAM_ID = awrp_intro_program_id()


def _is_intro_program(program: dict) -> bool:
    if AWRP_INTRO_PROGRAM_ID and program.get("id") == AWRP_INTRO_PROGRAM_ID:
        return True
    title = (program.get("title") or "").strip().lower()
    if title == PROGRAM_TITLE.lower():
        return True
    if title == "awrp introductory call":
        return True
    is_awrp = "awrp" in title or "atomic weight" in title
    if not is_awrp:
        return False
    return "intro call" in title or "introductory call" in title


async def _resolve_offer() -> tuple:
    """Price and program id come from the AWRP Intro Call program in admin."""
    cursor = db.programs.find(
        {},
        {"_id": 0, "id": 1, "title": 1, "price_inr": 1, "offer_price_inr": 1},
    )
    programs = await cursor.to_list(120)
    match = None
    if AWRP_INTRO_PROGRAM_ID:
        match = next((p for p in programs if p.get("id") == AWRP_INTRO_PROGRAM_ID), None)
    if not match:
        match = next(
            (p for p in programs if (p.get("title") or "").strip().lower() == PROGRAM_TITLE.lower()),
            None,
        )
    if not match:
        match = next((p for p in programs if _is_intro_program(p)), None)
    if not match:
        raise HTTPException(
            status_code=404,
            detail=(
                f'Create a program titled "{PROGRAM_TITLE}" with INR pricing '
                "(Upcoming / Pricing), separate from the main AWRP workshop."
            ),
        )
    offer = float(match.get("offer_price_inr") or 0)
    listed = float(match.get("price_inr") or 0)
    amount = offer if offer > 0 else listed
    if amount <= 0:
        raise HTTPException(
            status_code=400,
            detail=f'Set the INR price on "{PROGRAM_TITLE}" in Upcoming programs.',
        )
    title = (match.get("title") or PROGRAM_TITLE).strip() or PROGRAM_TITLE
    program_id = match.get("id")
    if not program_id:
        raise HTTPException(status_code=500, detail="Intro program record is missing an id.")
    return amount, title, program_id


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


@router.post("/checkout")
async def create_awrp_intro_checkout(body: AwrpIntroCheckoutBody):
    """Create a Razorpay order for the India AWRP Intro Call page."""
    from key_manager import get_key
    from routes.clients import ensure_client_from_enrollment_lead

    key_id = (await get_key("razorpay_key_id") or "").strip()
    key_secret = (await get_key("razorpay_key_secret") or "").strip()
    if not key_id or not key_secret:
        raise HTTPException(status_code=503, detail="Razorpay is not configured.")

    price_inr, item_title, item_id = await _resolve_offer()

    now = datetime.now(timezone.utc)
    enrollment_id = await _next_receipt_id()
    participant = {
        "name": body.name,
        "relationship": "Self",
        "country": "IN",
        "attendance_mode": "online",
        "notify": True,
        "email": body.email,
        "phone": body.phone,
        "whatsapp": body.phone,
        "program_id": item_id,
        "program_title": item_title,
    }
    enrollment = {
        "id": enrollment_id,
        "status": "checkout_started",
        "step": 4,
        "booker_name": body.name,
        "booker_email": body.email,
        "booker_country": "IN",
        "phone": body.phone,
        "participants": [participant],
        "participant_count": 1,
        "attendance": "online",
        "attendance_label": "Online (Zoom)",
        "item_type": "program",
        "item_id": item_id,
        "item_title": item_title,
        "currency": "inr",
        "amount": price_inr,
        "created_via": "india_landing",
        "landing_path": LANDING_PATH,
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
        logger.warning("awrp intro lead client: %s", ex)

    month_prefix = now.strftime("%Y-%m")
    count = await db.payment_transactions.count_documents({"invoice_number": {"$regex": f"^{month_prefix}"}})
    invoice_number = f"{month_prefix}-{str(count + 1).zfill(3)}"
    session_key = f"rz_{uuid.uuid4().hex}"
    receipt = f"AWRP-{invoice_number}"[:40]
    amount_paise = int(round(price_inr * 100))

    async with httpx.AsyncClient(timeout=45) as http:
        ro = await http.post(
            "https://api.razorpay.com/v1/orders",
            auth=(key_id, key_secret),
            json={
                "amount": amount_paise,
                "currency": "INR",
                "receipt": receipt,
                "notes": {
                    "landing": "awrp-intro-call",
                    "enrollment_id": enrollment_id,
                    "item_id": item_id,
                    "internal_session": session_key,
                },
            },
        )
    if ro.status_code >= 400:
        logger.warning("AWRP intro Razorpay order error: %s", ro.text[:500])
        raise HTTPException(status_code=502, detail="Could not start payment. Please try again.")

    order = ro.json()
    order_id = order.get("id")
    if not order_id:
        raise HTTPException(status_code=502, detail="Could not start payment. Please try again.")

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
        "amount": price_inr,
        "currency": "inr",
        "stripe_currency": "inr",
        "stripe_amount": price_inr,
        "payment_status": "pending",
        "booker_name": body.name,
        "booker_email": body.email,
        "phone": body.phone,
        "participants": [participant],
        "participant_count": 1,
        "attendance": "online",
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
        "inr_total": price_inr,
    }
