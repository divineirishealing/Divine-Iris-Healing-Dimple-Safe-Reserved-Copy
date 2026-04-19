"""
Public client intake endpoint.
Clients fill in the form from a shared link → creates / updates a record in
the existing `clients` collection with portal_login_allowed=False and
intake_pending=True.  Admin then reviews in Client Garden.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import os
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/api/client-intake", tags=["Client Intake"])

mongo_url = os.environ['MONGO_URL']
_client = AsyncIOMotorClient(mongo_url)
db = _client[os.environ['DB_NAME']]

VALID_PAYMENT_METHODS = {"gpay", "upi", "bank_transfer", "cash_deposit"}


class ClientIntakeSubmit(BaseModel):
    name: str
    email: str
    phone: str                          # includes country code, e.g. +91 9876543210
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    preferred_payment_method: Optional[str] = None   # gpay | upi | bank_transfer | cash_deposit


@router.post("")
async def submit_intake(data: ClientIntakeSubmit):
    name  = (data.name or "").strip()
    email = (data.email or "").strip().lower()
    phone = (data.phone or "").strip()

    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    if not phone:
        raise HTTPException(status_code=400, detail="Phone is required")

    pm = (data.preferred_payment_method or "").strip().lower()
    if pm and pm not in VALID_PAYMENT_METHODS:
        raise HTTPException(status_code=400, detail="Invalid payment method")

    now = datetime.now(timezone.utc).isoformat()
    intake_fields = {
        "intake_pending":        True,
        "intake_submitted_at":   now,
        "portal_login_allowed":  False,
        "updated_at":            now,
    }
    if data.city:    intake_fields["city"]    = data.city.strip()
    if data.state:   intake_fields["state"]   = data.state.strip()
    if data.country: intake_fields["country_name"] = data.country.strip()
    if pm:           intake_fields["preferred_payment_method"] = pm

    existing = await db.clients.find_one({"email": email})

    if existing:
        # Update basic info + intake fields without touching any payment/tax/discount settings
        update = {
            **intake_fields,
            "name":  name,
            "phone": phone,
        }
        await db.clients.update_one({"email": email}, {"$set": update})
        return {"status": "updated", "message": "Your details have been received. We will be in touch soon."}

    # Create new client record
    new_doc = {
        "id":         str(uuid.uuid4()),
        "name":       name,
        "email":      email,
        "phone":      phone,
        "label":      "Dew",
        "sources":    ["intake_form"],
        "conversions": [],
        "created_at": now,
        **intake_fields,
    }
    await db.clients.insert_one(new_doc)
    return {"status": "created", "message": "Your details have been received. We will be in touch soon."}


@router.get("/pending-count")
async def pending_count():
    """Admin helper — how many intake submissions are pending review."""
    count = await db.clients.count_documents({"intake_pending": True})
    return {"count": count}
