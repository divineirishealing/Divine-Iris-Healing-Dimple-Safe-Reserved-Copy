"""
Custom Payment Requests — create a titled payment link, share it, track when paid.

Admin creates a link  →  client opens /pay/:id  →  pays via Stripe or Razorpay
→  transaction recorded in payment_transactions + payment_requests marked paid.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import httpx
import stripe as stripe_lib
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr

from routes.auth import get_current_user
from utils.uid_generator import generate_uid

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / ".env")

router = APIRouter(prefix="/api/payment-requests", tags=["Payment Requests"])
logger = logging.getLogger(__name__)

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

FRONTEND_URL = (
    os.environ.get("PUBLIC_SITE_URL")
    or os.environ.get("FRONTEND_URL")
    or "https://divineirishealing.com"
)

# ── helpers ──────────────────────────────────────────────────────────────────

async def _stripe_key() -> str:
    try:
        from key_manager import get_key
        k = await get_key("stripe_api_key")
        return k or os.environ.get("STRIPE_API_KEY", "")
    except Exception:
        return os.environ.get("STRIPE_API_KEY", "")


async def _razorpay_keys() -> tuple[str, str]:
    try:
        from key_manager import get_key
        kid = (await get_key("razorpay_key_id") or "").strip()
        ksec = (await get_key("razorpay_key_secret") or "").strip()
        return kid, ksec
    except Exception:
        return "", ""


CURRENCY_SYMBOLS = {"aed": "AED ", "usd": "$", "inr": "₹", "eur": "€", "gbp": "£"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Pydantic models ──────────────────────────────────────────────────────────

class CreatePaymentRequestBody(BaseModel):
    title: str
    description: Optional[str] = ""
    amount: float
    currency: str = "aed"          # aed | inr | usd | eur | gbp
    recipient_name: Optional[str] = ""
    recipient_email: Optional[str] = ""
    note: Optional[str] = ""       # internal admin note
    # Optional catalog link (program batch or workshop date)
    item_type: Optional[str] = ""  # program | session | ""
    item_id: Optional[str] = ""
    item_title: Optional[str] = ""
    tier_index: Optional[int] = None
    chosen_start_date: Optional[str] = ""
    chosen_end_date: Optional[str] = ""
    chosen_tier_label: Optional[str] = ""
    session_date: Optional[str] = ""


class UpdatePaymentRequestBody(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    recipient_name: Optional[str] = None
    recipient_email: Optional[str] = None
    note: Optional[str] = None
    status: Optional[str] = None   # active | cancelled
    item_type: Optional[str] = None
    item_id: Optional[str] = None
    item_title: Optional[str] = None
    tier_index: Optional[int] = None
    chosen_start_date: Optional[str] = None
    chosen_end_date: Optional[str] = None
    chosen_tier_label: Optional[str] = None
    session_date: Optional[str] = None


class RazorpayVerifyBody(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    payer_name: Optional[str] = ""
    payer_email: Optional[str] = ""


# ── CRUD ─────────────────────────────────────────────────────────────────────

@router.post("")
async def create_payment_request(body: CreatePaymentRequestBody, _=Depends(get_current_user)):
    """Admin: create a new payment request link."""
    if body.amount <= 0:
        raise HTTPException(400, "Amount must be > 0")
    item_type = (body.item_type or "").strip().lower()
    if item_type not in ("program", "session", ""):
        item_type = ""
    req = {
        "id": str(uuid.uuid4()),
        "title": body.title.strip(),
        "description": (body.description or "").strip(),
        "amount": round(body.amount, 2),
        "currency": body.currency.lower().strip(),
        "recipient_name": (body.recipient_name or "").strip(),
        "recipient_email": (body.recipient_email or "").strip().lower(),
        "note": (body.note or "").strip(),
        "item_type": item_type,
        "item_id": (body.item_id or "").strip(),
        "item_title": (body.item_title or "").strip(),
        "tier_index": body.tier_index,
        "chosen_start_date": (body.chosen_start_date or "").strip()[:10],
        "chosen_end_date": (body.chosen_end_date or "").strip()[:10],
        "chosen_tier_label": (body.chosen_tier_label or "").strip(),
        "session_date": (body.session_date or "").strip()[:10],
        "status": "active",          # active | paid | cancelled
        "created_at": _now_iso(),
        "paid_at": None,
        "stripe_session_id": None,
        "razorpay_order_id": None,
        "payment_transaction_id": None,
        "payer_name": "",
        "payer_email": "",
    }
    await db.payment_requests.insert_one(req)
    req.pop("_id", None)
    return req


@router.get("")
async def list_payment_requests(_=Depends(get_current_user)):
    """Admin: list all payment requests (newest first)."""
    rows = await db.payment_requests.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return rows


@router.get("/{req_id}")
async def get_payment_request(req_id: str):
    """Public: get a single payment request (for the /pay/:id page)."""
    row = await db.payment_requests.find_one({"id": req_id}, {"_id": 0})
    if not row:
        raise HTTPException(404, "Payment request not found")
    # Never expose admin note to public
    row.pop("note", None)
    return row


@router.patch("/{req_id}")
async def update_payment_request(req_id: str, body: UpdatePaymentRequestBody, _=Depends(get_current_user)):
    """Admin: update title, description, amount, currency, status, etc."""
    patch: dict = {}
    for k, v in body.model_dump(exclude_unset=True).items():
        if v is not None:
            patch[k] = v
    if not patch:
        raise HTTPException(400, "Nothing to update")
    result = await db.payment_requests.update_one({"id": req_id}, {"$set": patch})
    if result.matched_count == 0:
        raise HTTPException(404, "Payment request not found")
    row = await db.payment_requests.find_one({"id": req_id}, {"_id": 0})
    return row


@router.delete("/{req_id}")
async def delete_payment_request(req_id: str, _=Depends(get_current_user)):
    """Admin: delete a payment request."""
    result = await db.payment_requests.delete_one({"id": req_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Payment request not found")
    return {"ok": True}


# ── Stripe checkout ───────────────────────────────────────────────────────────

@router.post("/{req_id}/checkout")
async def create_stripe_checkout(req_id: str, request: Request):
    """Public: create a Stripe Checkout Session for this payment request."""
    row = await db.payment_requests.find_one({"id": req_id}, {"_id": 0})
    if not row:
        raise HTTPException(404, "Payment request not found")
    if row["status"] != "active":
        raise HTTPException(400, f"This payment link is {row['status']}")

    api_key = await _stripe_key()
    if not api_key:
        raise HTTPException(503, "Stripe not configured")

    stripe_lib.api_key = api_key
    currency = row["currency"].lower()
    amount_cents = int(round(row["amount"] * 100))

    session_params: dict = {
        "line_items": [{
            "price_data": {
                "currency": currency,
                "product_data": {"name": row["title"]},
                "unit_amount": amount_cents,
            },
            "quantity": 1,
        }],
        "mode": "payment",
        "success_url": f"{FRONTEND_URL}/pay/{req_id}/success?session_id={{CHECKOUT_SESSION_ID}}",
        "cancel_url": f"{FRONTEND_URL}/pay/{req_id}",
        "metadata": {
            "payment_request_id": req_id,
            "item_type": "payment_request",
            "item_title": row["title"],
            "catalog_item_type": row.get("item_type") or "",
            "catalog_item_id": row.get("item_id") or "",
            "chosen_start_date": row.get("chosen_start_date") or "",
            "session_date": row.get("session_date") or "",
        },
        "billing_address_collection": "required",
    }
    if row.get("recipient_email"):
        session_params["customer_email"] = row["recipient_email"]

    try:
        session = stripe_lib.checkout.Session.create(**session_params)
    except Exception as e:
        logger.error("Stripe session create error: %s", e)
        raise HTTPException(502, "Could not create Stripe session")

    # Store pending transaction
    tx_id = str(uuid.uuid4())
    now = _now_iso()
    await db.payment_transactions.insert_one({
        "id": tx_id,
        "stripe_session_id": session.id,
        "payment_provider": "stripe",
        "payment_status": "pending",
        "item_type": "payment_request",
        "item_id": req_id,
        "item_title": row["title"],
        "amount": row["amount"],
        "currency": currency,
        "booker_name": row.get("recipient_name", ""),
        "booker_email": row.get("recipient_email", ""),
        "payment_request_id": req_id,
        "created_via": "payment_request",
        "catalog_item_type": row.get("item_type") or "",
        "catalog_item_id": row.get("item_id") or "",
        "catalog_item_title": row.get("item_title") or "",
        "tier_index": row.get("tier_index"),
        "chosen_start_date": row.get("chosen_start_date") or "",
        "chosen_end_date": row.get("chosen_end_date") or "",
        "chosen_tier_label": row.get("chosen_tier_label") or "",
        "session_date": row.get("session_date") or "",
        "created_at": now,
        "updated_at": now,
    })

    # Save session_id on request so we can check later
    await db.payment_requests.update_one(
        {"id": req_id},
        {"$set": {"stripe_session_id": session.id}}
    )

    return {"url": session.url, "session_id": session.id}


# ── Stripe webhook top-up (called by existing webhook route) ─────────────────
# The existing Stripe webhook already marks payment_transactions as paid.
# When that happens we also need to mark the payment_request paid.
# We expose a helper so the webhook route can call it.

async def mark_payment_request_paid_by_session(session_id: str, payer_name: str = "", payer_email: str = "") -> None:
    """Called by the Stripe webhook after verifying a payment_request checkout."""
    req = await db.payment_requests.find_one({"stripe_session_id": session_id})
    if req and req.get("status") == "active":
        tx = await db.payment_transactions.find_one({"stripe_session_id": session_id}, {"_id": 0})
        await db.payment_requests.update_one(
            {"id": req["id"]},
            {"$set": {
                "status": "paid",
                "paid_at": _now_iso(),
                "payer_name": payer_name or req.get("recipient_name", ""),
                "payer_email": payer_email or req.get("recipient_email", ""),
                "payment_transaction_id": tx["id"] if tx else None,
            }}
        )


# ── Stripe success poll ────────────────────────────────────────────────────────

@router.get("/{req_id}/status")
async def get_payment_request_status(req_id: str, session_id: str = ""):
    """Public: poll payment status; if paid, mark request paid."""
    row = await db.payment_requests.find_one({"id": req_id}, {"_id": 0})
    if not row:
        raise HTTPException(404, "Not found")

    # Already paid — just return
    if row["status"] == "paid":
        return {"status": "paid", "paid_at": row.get("paid_at")}

    # Check Stripe session
    check_id = session_id or row.get("stripe_session_id") or ""
    if check_id:
        api_key = await _stripe_key()
        if api_key:
            try:
                stripe_lib.api_key = api_key
                sess = stripe_lib.checkout.Session.retrieve(check_id)
                if sess.payment_status == "paid":
                    payer_email = (sess.customer_details or {}).get("email", "") if hasattr(sess, "customer_details") else ""
                    payer_name = (sess.customer_details or {}).get("name", "") if hasattr(sess, "customer_details") else ""
                    now = _now_iso()
                    # Mark payment_transactions paid
                    await db.payment_transactions.update_one(
                        {"stripe_session_id": check_id},
                        {"$set": {"payment_status": "paid", "paid_at": now, "updated_at": now}}
                    )
                    tx = await db.payment_transactions.find_one({"stripe_session_id": check_id}, {"_id": 0})
                    await db.payment_requests.update_one(
                        {"id": req_id},
                        {"$set": {
                            "status": "paid",
                            "paid_at": now,
                            "payer_name": payer_name,
                            "payer_email": payer_email,
                            "payment_transaction_id": tx["id"] if tx else None,
                        }}
                    )
                    return {"status": "paid", "paid_at": now}
            except Exception as e:
                logger.warning("Status check error: %s", e)

    return {"status": row["status"]}


# ── Razorpay checkout (INR) ───────────────────────────────────────────────────

@router.post("/{req_id}/checkout-razorpay")
async def create_razorpay_checkout(req_id: str, request: Request):
    """Public: create a Razorpay order for INR payment requests."""
    row = await db.payment_requests.find_one({"id": req_id}, {"_id": 0})
    if not row:
        raise HTTPException(404, "Payment request not found")
    if row["status"] != "active":
        raise HTTPException(400, f"This payment link is {row['status']}")

    kid, ksec = await _razorpay_keys()
    if not kid or not ksec:
        raise HTTPException(503, "Razorpay not configured")

    amount_paise = int(round(row["amount"] * 100))
    rz_payload = {
        "amount": amount_paise,
        "currency": "INR",
        "receipt": f"pr_{req_id[:8]}",
        "notes": {
            "payment_request_id": req_id,
            "title": row["title"][:50],
        },
    }

    try:
        async with httpx.AsyncClient(timeout=15) as hc:
            ro = await hc.post(
                "https://api.razorpay.com/v1/orders",
                json=rz_payload,
                auth=(kid, ksec),
            )
        if ro.status_code not in (200, 201):
            logger.error("Razorpay order error %s: %s", ro.status_code, ro.text[:400])
            raise HTTPException(502, "Could not create Razorpay order")
        rz_order = ro.json()
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Razorpay request failed: %s", e)
        raise HTTPException(502, "Razorpay request failed")

    session_id = f"rz_{uuid.uuid4().hex[:16]}"
    now = _now_iso()
    tx_id = str(uuid.uuid4())
    await db.payment_transactions.insert_one({
        "id": tx_id,
        "stripe_session_id": session_id,
        "razorpay_order_id": rz_order["id"],
        "payment_provider": "razorpay",
        "payment_status": "pending",
        "item_type": "payment_request",
        "item_id": req_id,
        "item_title": row["title"],
        "amount": row["amount"],
        "currency": "inr",
        "booker_name": row.get("recipient_name", ""),
        "booker_email": row.get("recipient_email", ""),
        "payment_request_id": req_id,
        "created_via": "payment_request",
        "catalog_item_type": row.get("item_type") or "",
        "catalog_item_id": row.get("item_id") or "",
        "catalog_item_title": row.get("item_title") or "",
        "tier_index": row.get("tier_index"),
        "chosen_start_date": row.get("chosen_start_date") or "",
        "chosen_end_date": row.get("chosen_end_date") or "",
        "chosen_tier_label": row.get("chosen_tier_label") or "",
        "session_date": row.get("session_date") or "",
        "created_at": now,
        "updated_at": now,
    })

    await db.payment_requests.update_one(
        {"id": req_id},
        {"$set": {"razorpay_order_id": rz_order["id"], "stripe_session_id": session_id}}
    )

    return {
        "key_id": kid,
        "order_id": rz_order["id"],
        "amount": amount_paise,
        "currency": "INR",
        "session_id": session_id,
        "title": row["title"],
    }


@router.post("/{req_id}/razorpay-verify")
async def verify_razorpay_payment(req_id: str, body: RazorpayVerifyBody):
    """Public: verify Razorpay signature and mark request paid."""
    row = await db.payment_requests.find_one({"id": req_id}, {"_id": 0})
    if not row:
        raise HTTPException(404, "Not found")
    if row["status"] == "paid":
        return {"status": "paid"}

    _, ksec = await _razorpay_keys()
    if not ksec:
        raise HTTPException(503, "Razorpay not configured")

    msg = f"{body.razorpay_order_id}|{body.razorpay_payment_id}".encode()
    expected = hmac.new(ksec.encode(), msg, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, body.razorpay_signature):
        raise HTTPException(400, "Invalid payment signature")

    now = _now_iso()
    await db.payment_transactions.update_one(
        {"razorpay_order_id": body.razorpay_order_id},
        {"$set": {
            "payment_status": "paid",
            "razorpay_payment_id": body.razorpay_payment_id,
            "paid_at": now,
            "updated_at": now,
            "booker_name": body.payer_name or row.get("recipient_name", ""),
            "booker_email": body.payer_email or row.get("recipient_email", ""),
        }}
    )
    tx = await db.payment_transactions.find_one(
        {"razorpay_order_id": body.razorpay_order_id}, {"_id": 0}
    )
    await db.payment_requests.update_one(
        {"id": req_id},
        {"$set": {
            "status": "paid",
            "paid_at": now,
            "payer_name": body.payer_name,
            "payer_email": body.payer_email,
            "payment_transaction_id": tx["id"] if tx else None,
        }}
    )
    return {"status": "paid"}
