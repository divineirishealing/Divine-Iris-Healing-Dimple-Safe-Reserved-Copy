"""Razorpay Orders + payment verification for INR checkout (alongside Stripe)."""
from __future__ import annotations

import hashlib
import hmac
import logging
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
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
    """Verify signature from Checkout.js handler, then complete enrollment like Stripe webhook."""
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
