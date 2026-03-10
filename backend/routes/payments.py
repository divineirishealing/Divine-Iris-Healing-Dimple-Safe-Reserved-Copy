from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime, timezone
import uuid

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionRequest, CheckoutSessionResponse, CheckoutStatusResponse
)

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/api/payments", tags=["Payments"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')

# Currency multipliers for multi-currency (AED as base)
CURRENCY_SYMBOLS = {
    'aed': 'AED', 'usd': '$', 'inr': '₹', 'eur': '€', 'gbp': '£'
}


class CreateCheckoutRequest(BaseModel):
    item_type: str  # "program" or "session"
    item_id: str
    currency: str = "usd"
    origin_url: str


class CheckStatusRequest(BaseModel):
    session_id: str


@router.post("/create-checkout")
async def create_checkout(req: CreateCheckoutRequest, http_request: Request):
    # Fetch item from DB to get the price (NEVER from frontend)
    if req.item_type == "program":
        item = await db.programs.find_one({"id": req.item_id})
        if not item:
            raise HTTPException(status_code=404, detail="Program not found")
        if not item.get("enrollment_open", True):
            raise HTTPException(status_code=400, detail="Enrollment is not open for this program")
    elif req.item_type == "session":
        item = await db.sessions.find_one({"id": req.item_id})
        if not item:
            raise HTTPException(status_code=404, detail="Session not found")
    else:
        raise HTTPException(status_code=400, detail="Invalid item type")

    # Get price for the requested currency from DB
    currency = req.currency.lower()
    price_field = f"price_{currency}"

    # Check offer price first for programs
    amount = 0.0
    if req.item_type == "program" and item.get("offer_price_usd", 0) > 0 and currency == "usd":
        amount = float(item.get("offer_price_usd", 0))
    elif req.item_type == "program" and item.get("offer_price_inr", 0) > 0 and currency == "inr":
        amount = float(item.get("offer_price_inr", 0))
    else:
        amount = float(item.get(price_field, 0))

    if amount <= 0:
        raise HTTPException(status_code=400, detail=f"No price set for currency: {currency}")

    # Build URLs
    origin = req.origin_url.rstrip('/')
    success_url = f"{origin}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/payment/cancel?item_type={req.item_type}&item_id={req.item_id}"

    # Initialize Stripe checkout
    host_url = str(http_request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    # Create checkout session
    checkout_request = CheckoutSessionRequest(
        amount=float(amount),
        currency=currency,
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "item_type": req.item_type,
            "item_id": req.item_id,
            "item_title": item.get("title", ""),
            "currency": currency,
        }
    )

    session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)

    # Create payment transaction record BEFORE redirect
    transaction = {
        "id": str(uuid.uuid4()),
        "stripe_session_id": session.session_id,
        "item_type": req.item_type,
        "item_id": req.item_id,
        "item_title": item.get("title", ""),
        "amount": float(amount),
        "currency": currency,
        "payment_status": "pending",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.payment_transactions.insert_one(transaction)

    return {"url": session.url, "session_id": session.session_id}


@router.get("/status/{session_id}")
async def check_payment_status(session_id: str, http_request: Request):
    # Check if already processed
    tx = await db.payment_transactions.find_one({"stripe_session_id": session_id})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # If already marked as paid, return immediately (prevent double processing)
    if tx.get("payment_status") == "paid":
        return {
            "status": "complete",
            "payment_status": "paid",
            "amount": tx.get("amount", 0),
            "currency": tx.get("currency", "usd"),
            "item_title": tx.get("item_title", ""),
        }

    # Poll Stripe for status
    host_url = str(http_request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    try:
        status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)

        # Update transaction
        new_status = status.payment_status
        await db.payment_transactions.update_one(
            {"stripe_session_id": session_id},
            {"$set": {
                "payment_status": new_status,
                "updated_at": datetime.now(timezone.utc),
            }}
        )

        return {
            "status": status.status,
            "payment_status": new_status,
            "amount": status.amount_total / 100,  # Convert from cents
            "currency": status.currency,
            "item_title": tx.get("item_title", ""),
        }
    except Exception as e:
        return {
            "status": "pending",
            "payment_status": "pending",
            "amount": tx.get("amount", 0),
            "currency": tx.get("currency", "usd"),
            "item_title": tx.get("item_title", ""),
            "error": str(e),
        }


@router.get("/transactions")
async def get_transactions():
    transactions = await db.payment_transactions.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return transactions
