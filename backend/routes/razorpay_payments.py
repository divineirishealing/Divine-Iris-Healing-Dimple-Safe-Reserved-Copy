"""Razorpay Orders + payment verification for INR checkout (alongside Stripe)."""
from __future__ import annotations

import hashlib
import hmac
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, field_validator
from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / ".env")

router = APIRouter(prefix="/api/payments/razorpay", tags=["Razorpay"])
logger = logging.getLogger(__name__)

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]


class RazorpayVerifyBody(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class RazorpayLandingCreateBody(BaseModel):
    """Standalone Razorpay-only landing: pay for a program or session in INR (no enrollment wizard)."""

    item_type: str
    item_id: str
    customer_name: str
    customer_email: str
    customer_phone: str = ""
    tier_index: Optional[int] = None

    @field_validator("item_type")
    @classmethod
    def norm_type(cls, v: str) -> str:
        t = (v or "").strip().lower()
        if t not in ("program", "session"):
            raise ValueError("item_type must be program or session")
        return t

    @field_validator("customer_email")
    @classmethod
    def norm_email(cls, v: str) -> str:
        e = (v or "").strip().lower()
        if not re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", e):
            raise ValueError("Invalid email")
        return e


def _verify_payment_signature(order_id: str, payment_id: str, signature: str, secret: str) -> bool:
    if not secret or not signature:
        return False
    msg = f"{order_id}|{payment_id}".encode()
    dig = hmac.new(secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()
    return hmac.compare_digest(dig, signature)


@router.get("/config")
async def razorpay_public_config():
    """Expose Key ID for Checkout.js; secret stays server-side only."""
    from key_manager import get_key

    key_id = (await get_key("razorpay_key_id")).strip()
    key_secret = (await get_key("razorpay_key_secret")).strip()
    return {"enabled": bool(key_id and key_secret), "key_id": key_id if key_id else None}


@router.post("/verify")
async def razorpay_verify_payment(body: RazorpayVerifyBody):
    """Verify Checkout.js signature; complete enrollment and/or send landing receipt."""
    from key_manager import get_key
    from routes.payments import run_enrollment_razorpay_success_hooks

    key_secret = (await get_key("razorpay_key_secret")).strip()
    if not key_secret:
        raise HTTPException(status_code=503, detail="Razorpay is not configured.")

    oid = (body.razorpay_order_id or "").strip()
    pid = (body.razorpay_payment_id or "").strip()
    sig = (body.razorpay_signature or "").strip()
    if not oid or not pid or not sig:
        raise HTTPException(status_code=400, detail="Missing Razorpay payment fields.")

    if not _verify_payment_signature(oid, pid, sig, key_secret):
        raise HTTPException(status_code=400, detail="Invalid payment signature.")

    tx = await db.payment_transactions.find_one({"razorpay_order_id": oid})
    if not tx:
        raise HTTPException(status_code=404, detail="No transaction for this order.")

    if tx.get("payment_status") == "paid":
        return {
            "ok": True,
            "session_id": tx.get("stripe_session_id"),
            "already_paid": True,
        }

    session_id = (tx.get("stripe_session_id") or "").strip()
    if not session_id:
        raise HTTPException(status_code=500, detail="Transaction missing session reference.")

    now = datetime.now(timezone.utc)
    await db.payment_transactions.update_one(
        {"razorpay_order_id": oid},
        {
            "$set": {
                "payment_status": "paid",
                "razorpay_payment_id": pid,
                "paid_at": now.isoformat(),
                "updated_at": now,
            }
        },
    )

    try:
        await run_enrollment_razorpay_success_hooks(session_id)
    except Exception as e:
        logger.exception("Razorpay post-payment hooks failed: %s", e)
        raise HTTPException(status_code=500, detail="Payment recorded but fulfillment failed — contact support.") from e

    return {"ok": True, "session_id": session_id, "already_paid": False}


@router.get("/landing/preview")
async def razorpay_landing_preview(
    item_type: str,
    item_id: str,
    tier_index: Optional[int] = None,
):
    """INR total for landing page (server-priced; same rules as create-order)."""
    from routes.enrollment import _per_person_price_for_program

    t = (item_type or "").strip().lower()
    if t not in ("program", "session"):
        raise HTTPException(status_code=400, detail="item_type must be program or session")
    iid = (item_id or "").strip()
    if not iid:
        raise HTTPException(status_code=400, detail="item_id required")

    if t == "program":
        program = await db.programs.find_one({"id": iid}, {"_id": 0})
        if not program:
            raise HTTPException(status_code=404, detail="Program not found")
        if not program.get("enrollment_open", True):
            raise HTTPException(status_code=400, detail="Enrollment is not open for this program")
        title = program.get("title", "")
        amount = float(_per_person_price_for_program(program, tier_index, "inr"))
    else:
        session = await db.sessions.find_one({"id": iid}, {"_id": 0})
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        title = session.get("title", "")
        offer_inr = float(session.get("offer_price_inr", 0) or 0)
        base_inr = float(session.get("price_inr", 0) or 0)
        amount = offer_inr if offer_inr > 0 else base_inr

    if amount <= 0:
        raise HTTPException(status_code=400, detail="No INR price available")

    cfg = await razorpay_public_config()
    return {
        "title": title,
        "inr_total": amount,
        "item_type": t,
        "item_id": iid,
        "tier_index": tier_index,
        "razorpay_enabled": cfg.get("enabled", False),
    }


@router.post("/landing/create-order")
async def razorpay_landing_create_order(body: RazorpayLandingCreateBody):
    """Create Razorpay order + pending transaction for public INR landing (Stripe not involved)."""
    from key_manager import get_key
    from routes.enrollment import _per_person_price_for_program

    key_id = (await get_key("razorpay_key_id")).strip()
    key_secret = (await get_key("razorpay_key_secret")).strip()
    if not key_id or not key_secret:
        raise HTTPException(status_code=503, detail="Razorpay is not configured.")

    item_type = body.item_type
    item_id = (body.item_id or "").strip()
    if not item_id:
        raise HTTPException(status_code=400, detail="item_id required")

    title = ""
    amount = 0.0

    if item_type == "program":
        program = await db.programs.find_one({"id": item_id}, {"_id": 0})
        if not program:
            raise HTTPException(status_code=404, detail="Program not found")
        if not program.get("enrollment_open", True):
            raise HTTPException(status_code=400, detail="Enrollment is not open for this program")
        title = program.get("title", "Program")
        amount = float(_per_person_price_for_program(program, body.tier_index, "inr"))
    else:
        session = await db.sessions.find_one({"id": item_id}, {"_id": 0})
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        title = session.get("title", "Session")
        offer_inr = float(session.get("offer_price_inr", 0) or 0)
        base_inr = float(session.get("price_inr", 0) or 0)
        amount = offer_inr if offer_inr > 0 else base_inr

    if amount <= 0:
        raise HTTPException(status_code=400, detail="No INR price for this offering")

    amount_paise = int(round(amount * 100))
    if amount_paise < 100:
        raise HTTPException(status_code=400, detail="Amount too small (minimum ₹1)")

    session_key = f"rz_{uuid.uuid4().hex}"

    now = datetime.now(timezone.utc)
    month_prefix = now.strftime("%Y-%m")
    count = await db.payment_transactions.count_documents({"invoice_number": {"$regex": f"^{month_prefix}"}})
    invoice_number = f"{month_prefix}-{str(count + 1).zfill(3)}"
    receipt = f"LP-{invoice_number}"[:40]

    async with httpx.AsyncClient(timeout=45) as client:
        ro = await client.post(
            "https://api.razorpay.com/v1/orders",
            auth=(key_id, key_secret),
            json={
                "amount": amount_paise,
                "currency": "INR",
                "receipt": receipt,
                "notes": {
                    "landing": "1",
                    "item_type": item_type,
                    "item_id": item_id,
                    "internal_session": session_key,
                },
            },
        )
    if ro.status_code >= 400:
        logger.warning("Razorpay landing order error: %s", ro.text[:500])
        raise HTTPException(status_code=502, detail="Could not create payment order. Try again later.")

    order = ro.json()
    order_id = order.get("id")
    if not order_id:
        raise HTTPException(status_code=502, detail="Razorpay did not return an order id.")

    name = (body.customer_name or "").strip()[:200]
    email = body.customer_email.strip().lower()
    phone = (body.customer_phone or "").strip()[:40]

    transaction = {
        "id": str(uuid.uuid4()),
        "invoice_number": invoice_number,
        "enrollment_id": None,
        "stripe_session_id": session_key,
        "razorpay_order_id": order_id,
        "payment_provider": "razorpay",
        "razorpay_landing": True,
        "item_type": item_type,
        "item_id": item_id,
        "item_title": title,
        "amount": amount,
        "currency": "inr",
        "stripe_currency": "inr",
        "stripe_amount": amount,
        "payment_status": "pending",
        "booker_name": name,
        "booker_email": email,
        "phone": phone or None,
        "tier_index": body.tier_index,
        "created_at": now,
        "updated_at": now,
    }
    be_norm = email
    if be_norm:
        pud = await db.users.find_one({"email": be_norm}, {"id": 1, "client_id": 1})
        if pud:
            transaction["portal_user_id"] = pud.get("id")
            pcid = (pud.get("client_id") or "").strip()
            if pcid:
                transaction["portal_client_id"] = pcid

    await db.payment_transactions.insert_one(transaction)

    return {
        "key_id": key_id,
        "order_id": order_id,
        "amount": amount_paise,
        "currency": "INR",
        "session_id": session_key,
        "name": name,
        "email": email,
        "description": title[:250],
        "item_title": title,
        "inr_total": amount,
    }
