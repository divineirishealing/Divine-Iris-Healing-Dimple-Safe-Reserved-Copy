"""Public India landing checkout for Shri Mahalakshmi Akshaya Samriddhi.

Charges the advertised energy exchange of ₹666 through Razorpay and records
an enrollment plus payment transaction so the booking shows in admin.
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

router = APIRouter(prefix="/api/landing/shri-mahalakshmi", tags=["Mahalakshmi landing"])
logger = logging.getLogger(__name__)

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

PROGRAM_ID = "4e564441-9f90-400b-ae44-b192fedf2f15"
PROGRAM_TITLE = "Shri Mahalakshmi Akshaya Samriddhi"
PRICE_INR = 666
DISPOSABLE_DOMAINS = {
    "tempmail.com",
    "throwaway.email",
    "guerrillamail.com",
    "mailinator.com",
    "yopmail.com",
    "10minutemail.com",
}


class MahalakshmiCheckoutBody(BaseModel):
    name: str
    email: str
    phone: str
    attendance_mode: str = "online"
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

    @field_validator("attendance_mode")
    @classmethod
    def clean_mode(cls, v: str) -> str:
        mode = (v or "").strip().lower()
        if mode not in ("online", "offline"):
            raise ValueError("Choose Online (Zoom) or Offline (Remote)")
        return mode

    @field_validator("utm_source", "utm_medium", "utm_campaign", "utm_content")
    @classmethod
    def clean_utm(cls, v: str) -> str:
        return (v or "").strip()[:200]


def _program_doc() -> dict:
    now = datetime.now(timezone.utc)
    return {
        "id": PROGRAM_ID,
        "title": PROGRAM_TITLE,
        "category": "Diwali Money Healing",
        "description": (
            "The 6-Day Diwali Money Healing Experience. "
            "Heal within, align with abundance, and welcome Samriddhi."
        ),
        "image": "",
        "link": "/india/shri-mahalakshmi-akshaya-samriddhi",
        "price_usd": 0.0,
        "price_inr": PRICE_INR,
        "price_eur": 0.0,
        "price_gbp": 0.0,
        "price_aed": 0.0,
        "duration": "6 Days",
        "visible": False,
        "order": 0,
        "program_type": "hybrid",
        "session_mode": "both",
        "enable_online": True,
        "enable_offline": True,
        "enable_in_person": False,
        "offer_price_inr": 0.0,
        "is_upcoming": False,
        "is_flagship": False,
        "enrollment_open": True,
        "enrollment_status": "open",
        "time_zone": "IST",
        "india_tax_enabled": False,
        "pay_as_you_wish": False,
        "content_sections": [],
        "created_at": now,
    }


async def _ensure_program() -> tuple:
    """Use the workshop saved in Programs. Do not overwrite its admin fields."""
    program = await db.programs.find_one(
        {"id": PROGRAM_ID},
        {"_id": 0, "title": 1, "price_inr": 1, "offer_price_inr": 1, "enrollment_open": 1},
    )
    if not program:
        raise HTTPException(status_code=404, detail="This workshop is not available.")
    if program.get("enrollment_open") is False:
        raise HTTPException(status_code=400, detail="Enrollment is closed.")
    offer = float(program.get("offer_price_inr") or 0)
    listed = float(program.get("price_inr") or 0)
    amount = offer if offer > 0 else listed
    if amount <= 0:
        amount = float(PRICE_INR)
    title = (program.get("title") or PROGRAM_TITLE).strip() or PROGRAM_TITLE
    return amount, title


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
async def create_mahalakshmi_checkout(body: MahalakshmiCheckoutBody):
    """Create a ₹666 Razorpay order for the India landing page."""
    from key_manager import get_key
    from routes.clients import ensure_client_from_enrollment_lead

    key_id = (await get_key("razorpay_key_id") or "").strip()
    key_secret = (await get_key("razorpay_key_secret") or "").strip()
    if not key_id or not key_secret:
        raise HTTPException(status_code=503, detail="Razorpay is not configured.")

    price_inr, item_title = await _ensure_program()

    now = datetime.now(timezone.utc)
    enrollment_id = await _next_receipt_id()
    mode_label = "Online (Zoom)" if body.attendance_mode == "online" else "Offline (Remote)"
    participant = {
        "name": body.name,
        "relationship": "Self",
        "country": "IN",
        "attendance_mode": body.attendance_mode,
        "notify": True,
        "email": body.email,
        "phone": body.phone,
        "whatsapp": body.phone,
        "program_id": PROGRAM_ID,
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
        "attendance": body.attendance_mode,
        "attendance_label": mode_label,
        "item_type": "program",
        "item_id": PROGRAM_ID,
        "item_title": item_title,
        "currency": "inr",
        "amount": price_inr,
        "created_via": "india_landing",
        "landing_path": "/india/shri-mahalakshmi-akshaya-samriddhi",
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
        logger.warning("mahalakshmi lead client: %s", ex)

    month_prefix = now.strftime("%Y-%m")
    count = await db.payment_transactions.count_documents({"invoice_number": {"$regex": f"^{month_prefix}"}})
    invoice_number = f"{month_prefix}-{str(count + 1).zfill(3)}"
    session_key = f"rz_{uuid.uuid4().hex}"
    receipt = f"LK-{invoice_number}"[:40]
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
                    "landing": "shri-mahalakshmi",
                    "enrollment_id": enrollment_id,
                    "item_id": PROGRAM_ID,
                    "internal_session": session_key,
                },
            },
        )
    if ro.status_code >= 400:
        logger.warning("Mahalakshmi Razorpay order error: %s", ro.text[:500])
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
        "item_id": PROGRAM_ID,
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
        "inr_total": price_inr,
    }
