from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime, timezone
import uuid
import logging

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionRequest, CheckoutSessionResponse, CheckoutStatusResponse
)
from routes.emails import send_email, enrollment_confirmation_email, participant_notification_email
from utils.uid_generator import generate_uid

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/api/payments", tags=["Payments"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')

logger = logging.getLogger(__name__)


async def _get_stripe_key():
    """Get Stripe key from key_manager (MongoDB) with .env fallback."""
    try:
        from key_manager import get_key
        key = await get_key("stripe_api_key")
        return key or STRIPE_API_KEY
    except Exception:
        return STRIPE_API_KEY

CURRENCY_SYMBOLS = {
    'aed': 'AED ', 'usd': '$', 'inr': '₹', 'eur': '€', 'gbp': '£'
}


async def generate_participant_uids(session_id: str):
    """Generate UIDs for all participants in an enrollment linked to this payment."""
    tx = await db.payment_transactions.find_one({"stripe_session_id": session_id}, {"_id": 0})
    if not tx:
        return

    enrollment_id = tx.get("enrollment_id")
    if not enrollment_id:
        return

    enrollment = await db.enrollments.find_one({"id": enrollment_id})
    if not enrollment:
        return

    participants = enrollment.get("participants", [])
    item_title = tx.get("item_title", "Program")
    updated = False

    for i, p in enumerate(participants):
        if not p.get("uid"):
            uid = await generate_uid(db, item_title, p.get("name", "Unknown"))
            participants[i]["uid"] = uid
            updated = True

    if updated:
        await db.enrollments.update_one(
            {"id": enrollment_id},
            {"$set": {"participants": participants}}
        )


async def send_enrollment_emails(session_id: str):
    """Send confirmation email to booker + notification emails to participants who opted in."""
    tx = await db.payment_transactions.find_one({"stripe_session_id": session_id}, {"_id": 0})
    if not tx:
        return

    enrollment_id = tx.get("enrollment_id")
    if not enrollment_id:
        return

    enrollment = await db.enrollments.find_one({"id": enrollment_id}, {"_id": 0})
    if not enrollment:
        return

    booker_name = enrollment.get("booker_name", "")
    booker_email = enrollment.get("booker_email", "")
    phone = enrollment.get("phone", "")
    participants = enrollment.get("participants", [])
    item_title = tx.get("item_title", "")
    total = tx.get("amount", 0)
    currency = tx.get("currency", "aed")
    symbol = CURRENCY_SYMBOLS.get(currency, currency.upper() + " ")

    # Fetch program links
    program_links = {}
    item_id = tx.get("item_id")
    item_type = tx.get("item_type")
    if item_id and item_type == "program":
        program = await db.programs.find_one({"id": item_id}, {"_id": 0})
        if program:
            if program.get("show_whatsapp_link") and program.get("whatsapp_group_link"):
                program_links["whatsapp_group_link"] = program["whatsapp_group_link"]
            if program.get("show_zoom_link") and program.get("zoom_link"):
                program_links["zoom_link"] = program["zoom_link"]
            if program.get("show_custom_link") and program.get("custom_link"):
                program_links["custom_link"] = program["custom_link"]
                program_links["custom_link_label"] = program.get("custom_link_label", "Link")

    # 1. Send booker confirmation (from receipt email)
    if booker_email:
        # Get program/session details
        program_description = ""
        program_start_date = ""
        program_duration = ""
        program_end_date = ""
        program_timing = ""
        program_timezone = ""
        if item_id and item_type == "program":
            program = await db.programs.find_one({"id": item_id}, {"_id": 0})
            if program:
                program_description = program.get("description", "")
                program_start_date = program.get("start_date", "")
                program_duration = program.get("duration", "")
                program_end_date = program.get("end_date", "")
                program_timing = program.get("timing", "") or ""
                program_timezone = program.get("time_zone", "") or ""
        elif item_id and item_type == "session":
            session = await db.sessions.find_one({"id": item_id}, {"_id": 0})
            if session:
                program_description = session.get("description", "")
                program_duration = session.get("duration", "")
                program_timing = session.get("timing", "") or ""
                program_timezone = session.get("time_zone", "") or ""

        # Get receipt template and logo
        from routes.emails import get_receipt_template
        receipt_tpl, logo_path = await get_receipt_template()
        logo_url = ""
        if logo_path:
            host = os.environ.get('HOST_URL', '')
            logo_url = f"{host}{logo_path}" if logo_path.startswith("/api") else logo_path

        html = enrollment_confirmation_email(
            booker_name=booker_name,
            item_title=item_title,
            participants=participants,
            total=total,
            currency_symbol=symbol,
            attendance_modes=[p.get("attendance_mode", "online") for p in participants],
            booker_email=booker_email,
            phone=phone,
            program_links=program_links,
            program_description=program_description,
            program_start_date=program_start_date,
            program_duration=program_duration,
            program_end_date=program_end_date,
            program_timing=program_timing,
            program_timezone=program_timezone,
            logo_url=logo_url,
            receipt_template=receipt_tpl,
        )
        from key_manager import get_key
        receipt_sender = await get_key("receipt_email") or os.environ.get("RECEIPT_EMAIL", "receipt@divineirishealing.com")
        await send_email(booker_email, f"Payment Receipt — {item_title} — Divine Iris Healing", html, from_email=receipt_sender)

    # 2. Send participant notifications (only those who opted in)
    for p in participants:
        if p.get("notify") and p.get("email"):
            p_html = participant_notification_email(
                participant_name=p["name"],
                item_title=item_title,
                attendance_mode=p.get("attendance_mode", "online"),
                booker_name=booker_name,
            )
            await send_email(p["email"], f"You've Been Enrolled — {item_title}", p_html)

    # Mark emails as sent
    await db.payment_transactions.update_one(
        {"stripe_session_id": session_id},
        {"$set": {"emails_sent": True, "updated_at": datetime.now(timezone.utc)}}
    )


class CreateCheckoutRequest(BaseModel):
    item_type: str  # "program" or "session"
    item_id: str
    currency: str = "usd"
    origin_url: str


class CheckStatusRequest(BaseModel):
    session_id: str



class CreateSponsorCheckoutRequest(BaseModel):
    name: str
    email: str
    amount: float
    currency: str = "inr"
    message: str = ""
    anonymous: bool = False
    origin_url: str


@router.post("/sponsor-checkout")
async def create_sponsor_checkout(req: CreateSponsorCheckoutRequest, http_request: Request):
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")

    currency = req.currency.lower()
    origin = req.origin_url.rstrip('/')
    success_url = f"{origin}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/#sponsor"

    host_url = str(http_request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=await _get_stripe_key(), webhook_url=webhook_url)

    checkout_request = CheckoutSessionRequest(
        amount=float(req.amount),
        currency=currency,
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "item_type": "sponsor",
            "donor_name": req.name if not req.anonymous else "Anonymous",
            "donor_email": req.email,
            "message": req.message,
            "anonymous": str(req.anonymous),
            "currency": currency,
        }
    )

    session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)

    transaction = {
        "id": str(uuid.uuid4()),
        "stripe_session_id": session.session_id,
        "item_type": "sponsor",
        "item_id": "sponsor",
        "item_title": "Shine a Light Contribution",
        "amount": float(req.amount),
        "currency": currency,
        "payment_status": "pending",
        "donor_name": req.name,
        "donor_email": req.email,
        "message": req.message,
        "anonymous": req.anonymous,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.payment_transactions.insert_one(transaction)

    return {"url": session.url, "session_id": session.session_id}



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
    if req.item_type == "program":
        offer_field = f"offer_price_{currency}"
        offer_amount = float(item.get(offer_field, 0))
        if offer_amount > 0:
            amount = offer_amount
        else:
            amount = float(item.get(price_field, 0))
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
    stripe_checkout = StripeCheckout(api_key=await _get_stripe_key(), webhook_url=webhook_url)

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
async def check_payment_status(session_id: str, http_request: Request, background_tasks: BackgroundTasks):
    # Check if already processed
    tx = await db.payment_transactions.find_one({"stripe_session_id": session_id})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Fetch program links if available
    program_links = {}
    item_id = tx.get("item_id")
    item_type = tx.get("item_type")
    if item_id and item_type == "program":
        program = await db.programs.find_one({"id": item_id}, {"_id": 0})
        if program:
            if program.get("show_whatsapp_link") and program.get("whatsapp_group_link"):
                program_links["whatsapp_group_link"] = program["whatsapp_group_link"]
            if program.get("show_zoom_link") and program.get("zoom_link"):
                program_links["zoom_link"] = program["zoom_link"]
            if program.get("show_custom_link") and program.get("custom_link"):
                program_links["custom_link"] = program["custom_link"]
                program_links["custom_link_label"] = program.get("custom_link_label", "Link")

    # Get enrollment details for richer response
    enrollment_id = tx.get("enrollment_id")
    participants = []
    booker_name = ""
    booker_email = ""
    if enrollment_id:
        enrollment = await db.enrollments.find_one({"id": enrollment_id}, {"_id": 0})
        if enrollment:
            participants = enrollment.get("participants", [])
            booker_name = enrollment.get("booker_name", "")
            booker_email = enrollment.get("booker_email", "")

    # If already marked as paid, return immediately (prevent double processing)
    if tx.get("payment_status") == "paid":
        return {
            "status": "complete",
            "payment_status": "paid",
            "amount": tx.get("amount", 0),
            "currency": tx.get("currency", "usd"),
            "item_title": tx.get("item_title", ""),
            "program_links": program_links,
            "participants": participants,
            "booker_name": booker_name,
            "booker_email": booker_email,
        }

    # Poll Stripe for status
    host_url = str(http_request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=await _get_stripe_key(), webhook_url=webhook_url)

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

        # Send confirmation emails when payment is newly confirmed
        if new_status == "paid" and not tx.get("emails_sent"):
            # Generate UIDs for all participants
            await generate_participant_uids(session_id)
            background_tasks.add_task(send_enrollment_emails, session_id)

        # Re-fetch participants after UID generation
        if enrollment_id:
            enrollment = await db.enrollments.find_one({"id": enrollment_id}, {"_id": 0})
            if enrollment:
                participants = enrollment.get("participants", [])

        return {
            "status": status.status,
            "payment_status": new_status,
            "amount": status.amount_total / 100,  # Convert from cents
            "currency": status.currency,
            "item_title": tx.get("item_title", ""),
            "program_links": program_links,
            "participants": participants,
            "booker_name": booker_name,
            "booker_email": booker_email,
        }
    except Exception as e:
        return {
            "status": "pending",
            "payment_status": "pending",
            "amount": tx.get("amount", 0),
            "currency": tx.get("currency", "usd"),
            "item_title": tx.get("item_title", ""),
            "program_links": program_links,
            "participants": participants,
            "booker_name": booker_name,
            "booker_email": booker_email,
            "error": str(e),
        }


@router.get("/transactions")
async def get_transactions():
    transactions = await db.payment_transactions.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return transactions
