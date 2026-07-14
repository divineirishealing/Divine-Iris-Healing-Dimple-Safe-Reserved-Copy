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
from typing import Any, Dict, List, Optional

import httpx
import stripe as stripe_lib
from dotenv import load_dotenv
from fastapi import APIRouter, Body, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr

from routes.auth import assert_admin_session_or_password
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

MANUAL_PAYMENT_METHODS = frozenset({"stripe", "gpay", "cash", "bank", "exly", "other"})

MANUAL_PAYMENT_METHOD_LABELS = {
    "stripe": "Card / Stripe",
    "gpay": "GPay / UPI",
    "cash": "Cash",
    "bank": "Bank transfer",
    "exly": "Exly",
    "other": "Other",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


INSTALLMENT_PLANS = frozenset({"equal", "quarter_then_monthly", "down_then_emi"})
ANNUAL_QUARTER_THEN_MONTHLY_COUNT = 10
ANNUAL_PRESET_DOWN_PCT = 25.0
ANNUAL_PRESET_EMI_COUNT = 9


def _normalize_down_pct(raw: Optional[float]) -> float:
    try:
        pct = float(raw if raw is not None else ANNUAL_PRESET_DOWN_PCT)
    except (TypeError, ValueError):
        pct = ANNUAL_PRESET_DOWN_PCT
    return max(1.0, min(90.0, pct))


def _normalize_emi_count(raw: Optional[int]) -> int:
    try:
        n = int(raw if raw is not None else ANNUAL_PRESET_EMI_COUNT)
    except (TypeError, ValueError):
        n = ANNUAL_PRESET_EMI_COUNT
    return max(1, min(11, n))


def _split_installment_amounts(total: float, n: int) -> List[float]:
    """Split total into *n* installments (remainder cents on earliest payments)."""
    n = max(2, min(12, int(n)))
    cents_total = int(round(float(total) * 100))
    if cents_total <= 0:
        return [0.0] * n
    base = cents_total // n
    extra = cents_total % n
    return [round((base + (1 if i < extra else 0)) / 100.0, 2) for i in range(n)]


def _down_then_emi_amounts(total: float, down_pct: float, emi_count: int) -> List[float]:
    """First payment = down_pct % of total; remainder split across emi_count equal EMIs."""
    cents_total = int(round(float(total) * 100))
    n_emi = _normalize_emi_count(emi_count)
    if cents_total <= 0:
        return [0.0] * (1 + n_emi)
    pct = _normalize_down_pct(down_pct)
    down_cents = int(round(cents_total * pct / 100.0))
    down_cents = max(1, min(cents_total - n_emi, down_cents))
    remainder = cents_total - down_cents
    base = remainder // n_emi
    extra = remainder % n_emi
    emis = [base + (1 if i < extra else 0) for i in range(n_emi)]
    return [round(c / 100.0, 2) for c in [down_cents] + emis]


def _quarter_plus_nine_monthly_amounts(total: float) -> List[float]:
    """Annual preset: 25% down + 9 monthly EMIs (10 payments)."""
    return _down_then_emi_amounts(total, ANNUAL_PRESET_DOWN_PCT, ANNUAL_PRESET_EMI_COUNT)


def _installment_amounts_for_plan(
    total: float,
    plan: str,
    num_installments: int,
    *,
    down_pct: Optional[float] = None,
    emi_count: Optional[int] = None,
) -> List[float]:
    p = (plan or "equal").strip().lower()
    if p == "quarter_then_monthly":
        return _quarter_plus_nine_monthly_amounts(total)
    if p == "down_then_emi":
        return _down_then_emi_amounts(
            total,
            _normalize_down_pct(down_pct),
            _normalize_emi_count(emi_count),
        )
    return _split_installment_amounts(total, num_installments)


def _installment_amounts_for_row(row: dict) -> List[float]:
    stored = row.get("installment_amounts") or []
    if isinstance(stored, list) and len(stored) >= 2:
        return [round(float(x), 2) for x in stored]
    if row.get("installments_enabled"):
        plan = (row.get("installment_plan") or "equal").strip().lower()
        n = int(row.get("num_installments") or 2)
        return _installment_amounts_for_plan(
            float(row.get("amount") or 0),
            plan,
            n,
            down_pct=row.get("installment_down_pct"),
            emi_count=row.get("installment_emi_count"),
        )
    return [round(float(row.get("amount") or 0), 2)]


def _installments_paid_count(row: dict) -> int:
    payments = row.get("installment_payments") or []
    if isinstance(payments, list) and payments:
        return len(payments)
    return int(row.get("installments_paid") or 0)


def _minimum_amount_for_row(row: dict) -> float:
    return round(max(0.01, float(row.get("minimum_amount") or 1)), 2)


def _resolve_client_charge_amount(row: dict, payer_amount: Optional[float]) -> float:
    """Fixed/installment links ignore payer_amount; pay-as-you-wish requires it."""
    if row.get("pay_as_you_wish"):
        if payer_amount is None:
            raise HTTPException(400, "Enter the amount you wish to pay.")
        charge = round(float(payer_amount), 2)
        minimum = _minimum_amount_for_row(row)
        if charge < minimum:
            raise HTTPException(400, "Please enter a higher contribution amount.")
        return charge
    checkout = _checkout_state_for_row(row)
    return round(float(checkout["checkout_amount"]), 2)


def _checkout_state_for_row(row: dict) -> Dict[str, Any]:
    """Derive what the client pays next on a payment link."""
    total = round(float(row.get("amount") or 0), 2)
    if row.get("pay_as_you_wish"):
        minimum = _minimum_amount_for_row(row)
        return {
            "pay_as_you_wish": True,
            "suggested_amount": total,
            "minimum_amount": minimum,
            "installments_enabled": False,
            "total_amount": total,
            "checkout_amount": 0.0,
            "installment_current": 1,
            "num_installments": 1,
            "installments_paid": 0,
            "installments_remaining": 0,
            "installment_amounts": [],
        }
    if not row.get("installments_enabled"):
        return {
            "installments_enabled": False,
            "total_amount": total,
            "checkout_amount": total,
            "installment_current": 1,
            "num_installments": 1,
            "installments_paid": 0,
            "installments_remaining": 0,
            "installment_amounts": [total],
        }
    amounts = _installment_amounts_for_row(row)
    n = len(amounts)
    paid = _installments_paid_count(row)
    remaining = max(0, n - paid)
    current = paid + 1 if remaining > 0 else n
    checkout = amounts[paid] if paid < n else 0.0
    return {
        "installments_enabled": True,
        "total_amount": total,
        "checkout_amount": checkout,
        "installment_current": current,
        "num_installments": n,
        "installments_paid": paid,
        "installments_remaining": remaining,
        "installment_amounts": amounts,
    }


def _can_checkout_payment_request(row: dict) -> bool:
    st = (row.get("status") or "").lower()
    if st in ("paid", "cancelled"):
        return False
    if row.get("installments_enabled"):
        state = _checkout_state_for_row(row)
        return state["installments_remaining"] > 0 and state["checkout_amount"] > 0
    return st == "active"


def _public_payment_request_view(row: dict) -> dict:
    """Public API shape for /pay/:id (never includes admin note)."""
    out = {k: v for k, v in row.items() if k != "note"}
    out.update(_checkout_state_for_row(row))
    payments = out.get("installment_payments") or []
    if isinstance(payments, list):
        out["installment_payments"] = [
            {k: v for k, v in p.items() if k != "_id"} for p in payments if isinstance(p, dict)
        ]
    return out


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
    item_type: Optional[str] = ""  # program | session | annual_package | ""
    item_id: Optional[str] = ""
    item_title: Optional[str] = ""
    tier_index: Optional[int] = None
    chosen_start_date: Optional[str] = ""
    chosen_end_date: Optional[str] = ""
    chosen_tier_label: Optional[str] = ""
    session_date: Optional[str] = ""
    installments_enabled: Optional[bool] = False
    num_installments: Optional[int] = None
    installment_plan: Optional[str] = "equal"  # equal | quarter_then_monthly | down_then_emi
    installment_down_pct: Optional[float] = None
    installment_emi_count: Optional[int] = None
    pay_as_you_wish: Optional[bool] = False
    minimum_amount: Optional[float] = 1.0


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
    installments_enabled: Optional[bool] = None
    num_installments: Optional[int] = None
    installment_plan: Optional[str] = None
    installment_down_pct: Optional[float] = None
    installment_emi_count: Optional[int] = None
    pay_as_you_wish: Optional[bool] = None
    minimum_amount: Optional[float] = None


class RazorpayVerifyBody(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    payer_name: Optional[str] = ""
    payer_email: Optional[str] = ""


class StripeCheckoutBody(BaseModel):
    payer_name: Optional[str] = ""
    payer_email: Optional[str] = ""
    payer_amount: Optional[float] = None


class RecordManualPaymentBody(BaseModel):
    """Admin: record offline payment (GPay, cash, bank, etc.) against a payment link."""
    amount: Optional[float] = None
    payment_method: str = "cash"
    payer_name: Optional[str] = ""
    payer_email: Optional[str] = ""
    reference: Optional[str] = ""
    notes: Optional[str] = ""
    paid_at: Optional[str] = ""


# ── CRUD ─────────────────────────────────────────────────────────────────────

@router.post("")
async def create_payment_request(body: CreatePaymentRequestBody, request: Request):
    """Admin: create a new payment request link."""
    await assert_admin_session_or_password(request, None)
    pay_as_you_wish = bool(body.pay_as_you_wish)
    if not pay_as_you_wish and body.amount <= 0:
        raise HTTPException(400, "Amount must be > 0")
    if pay_as_you_wish and body.amount < 0:
        raise HTTPException(400, "Suggested amount cannot be negative")
    item_type = (body.item_type or "").strip().lower()
    if item_type not in ("program", "session", "annual_package", ""):
        item_type = ""
    installments_enabled = bool(body.installments_enabled) and not pay_as_you_wish
    installment_plan = (body.installment_plan or "equal").strip().lower()
    if installment_plan not in INSTALLMENT_PLANS:
        installment_plan = "equal"
    num_installments = int(body.num_installments or 2) if installments_enabled else 1
    installment_down_pct: Optional[float] = None
    installment_emi_count: Optional[int] = None
    if installments_enabled:
        if installment_plan in ("quarter_then_monthly", "down_then_emi"):
            if installment_plan == "quarter_then_monthly":
                installment_down_pct = ANNUAL_PRESET_DOWN_PCT
                installment_emi_count = ANNUAL_PRESET_EMI_COUNT
            else:
                installment_down_pct = _normalize_down_pct(body.installment_down_pct)
                installment_emi_count = _normalize_emi_count(body.installment_emi_count)
            num_installments = 1 + int(installment_emi_count)
        elif num_installments < 2 or num_installments > 12:
            raise HTTPException(400, "Installments must be between 2 and 12")
    installment_amounts = (
        _installment_amounts_for_plan(
            round(body.amount, 2),
            installment_plan,
            num_installments,
            down_pct=installment_down_pct,
            emi_count=installment_emi_count,
        )
        if installments_enabled
        else []
    )
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
        "installments_enabled": installments_enabled,
        "installment_plan": installment_plan if installments_enabled else "equal",
        "installment_down_pct": installment_down_pct,
        "installment_emi_count": installment_emi_count,
        "num_installments": num_installments if installments_enabled else 1,
        "installment_amounts": installment_amounts,
        "installments_paid": 0,
        "installment_payments": [],
        "pay_as_you_wish": pay_as_you_wish,
        "minimum_amount": _minimum_amount_for_row({"minimum_amount": body.minimum_amount}),
        "status": "active",          # active | partially_paid | paid | cancelled
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
async def list_payment_requests(request: Request):
    """Admin: list all payment requests (newest first)."""
    await assert_admin_session_or_password(request, None)
    rows = await db.payment_requests.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return rows


@router.get("/{req_id}")
async def get_payment_request(req_id: str):
    """Public: get a single payment request (for the /pay/:id page)."""
    row = await db.payment_requests.find_one({"id": req_id}, {"_id": 0})
    if not row:
        raise HTTPException(404, "Payment request not found")
    return _public_payment_request_view(row)


@router.patch("/{req_id}")
async def update_payment_request(req_id: str, body: UpdatePaymentRequestBody, request: Request):
    """Admin: update title, description, amount, currency, status, etc."""
    await assert_admin_session_or_password(request, None)
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
async def delete_payment_request(req_id: str, request: Request):
    """Admin: delete a payment request."""
    await assert_admin_session_or_password(request, None)
    result = await db.payment_requests.delete_one({"id": req_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Payment request not found")
    return {"ok": True}


# ── Stripe checkout ───────────────────────────────────────────────────────────

@router.post("/{req_id}/checkout")
async def create_stripe_checkout(
    req_id: str,
    request: Request,
    body: StripeCheckoutBody = Body(default_factory=StripeCheckoutBody),
):
    """Public: create a Stripe Checkout Session for this payment request."""
    row = await db.payment_requests.find_one({"id": req_id}, {"_id": 0})
    if not row:
        raise HTTPException(404, "Payment request not found")
    if not _can_checkout_payment_request(row):
        raise HTTPException(400, f"This payment link is {row.get('status')}")

    payer_name = (body.payer_name or "").strip() or (row.get("recipient_name") or "").strip()
    payer_email = (body.payer_email or "").strip().lower() or (row.get("recipient_email") or "").strip().lower()

    checkout = _checkout_state_for_row(row)
    charge_amount = _resolve_client_charge_amount(row, body.payer_amount)
    inst_n = int(checkout["installment_current"])
    inst_total = int(checkout["num_installments"])

    api_key = await _stripe_key()
    if not api_key:
        raise HTTPException(503, "Stripe not configured")

    stripe_lib.api_key = api_key
    currency = row["currency"].lower()
    amount_cents = int(round(charge_amount * 100))
    if amount_cents <= 0:
        raise HTTPException(400, "Nothing left to pay on this link")

    line_name = row["title"]
    if row.get("installments_enabled") and inst_total > 1:
        line_name = f"{row['title']} · Installment {inst_n} of {inst_total}"

    session_params: dict = {
        "line_items": [{
            "price_data": {
                "currency": currency,
                "product_data": {"name": line_name[:500]},
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
            "payer_name": payer_name[:200],
            "payer_email": payer_email[:200],
            "installment_number": str(inst_n),
            "num_installments": str(inst_total),
            "total_amount": str(charge_amount if row.get("pay_as_you_wish") else round(float(row.get("amount") or 0), 2)),
            "pay_as_you_wish": "1" if row.get("pay_as_you_wish") else "0",
        },
        "billing_address_collection": "required",
    }
    if payer_email:
        session_params["customer_email"] = payer_email

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
        "amount": charge_amount,
        "currency": currency,
        "booker_name": payer_name or row.get("recipient_name", ""),
        "booker_email": payer_email or row.get("recipient_email", ""),
        "payment_request_id": req_id,
        "created_via": "payment_request",
        "installment_number": inst_n,
        "num_installments": inst_total,
        "payment_request_total": round(float(row.get("amount") or 0), 2),
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


async def _settle_payment_request_tx(
    req_id: str,
    tx: dict,
    *,
    payer_name: str = "",
    payer_email: str = "",
    session_key: str = "",
) -> None:
    """Update payment_request status after a paid transaction (Stripe or manual)."""
    req = await db.payment_requests.find_one({"id": req_id}, {"_id": 0})
    if not req:
        return
    st = (req.get("status") or "").lower()
    if st in ("paid", "cancelled"):
        return

    sid = (session_key or tx.get("stripe_session_id") or "").strip()
    payer_email = (payer_email or tx.get("booker_email") or "").strip().lower()
    payer_name = (payer_name or tx.get("booker_name") or "").strip()
    now = tx.get("paid_at") or _now_iso()

    payments = list(req.get("installment_payments") or [])
    if sid and any(isinstance(p, dict) and p.get("stripe_session_id") == sid for p in payments):
        return

    inst_n = int(tx.get("installment_number") or 0) or (_installments_paid_count(req) + 1)
    pay_method = str(tx.get("payment_method") or "stripe").strip().lower()
    pay_provider = str(tx.get("payment_provider") or "stripe").strip().lower()

    payment_entry = {
        "number": inst_n,
        "amount": round(float(tx.get("amount") or 0), 2),
        "paid_at": now,
        "transaction_id": tx.get("id"),
        "stripe_session_id": sid,
        "payment_method": pay_method,
        "payment_provider": pay_provider,
        "manual_reference": tx.get("manual_reference") or "",
    }

    if req.get("installments_enabled"):
        payments.append(payment_entry)
        paid_count = len(payments)
        n_total = int(req.get("num_installments") or len(_installment_amounts_for_row(req)))
        new_status = "paid" if paid_count >= n_total else "partially_paid"
        patch: Dict[str, Any] = {
            "installments_paid": paid_count,
            "installment_payments": payments,
            "status": new_status,
            "payer_name": payer_name or req.get("recipient_name", ""),
            "payer_email": payer_email or req.get("recipient_email", ""),
            "payment_transaction_id": tx.get("id"),
        }
        if sid:
            patch["stripe_session_id"] = sid
        if new_status == "paid":
            patch["paid_at"] = now
        await db.payment_requests.update_one({"id": req_id}, {"$set": patch})
    elif st == "active":
        paid_patch: Dict[str, Any] = {
            "status": "paid",
            "paid_at": now,
            "payer_name": payer_name or req.get("recipient_name", ""),
            "payer_email": payer_email or req.get("recipient_email", ""),
            "payment_transaction_id": tx.get("id"),
            **({"stripe_session_id": sid} if sid else {}),
            "installment_payments": [payment_entry],
        }
        if req.get("pay_as_you_wish"):
            paid_patch["amount"] = round(float(tx.get("amount") or 0), 2)
        await db.payment_requests.update_one({"id": req_id}, {"$set": paid_patch})
    else:
        return

    try:
        from utils.payment_request_enrollment import ensure_enrollment_for_payment_request_tx

        tx_fresh = await db.payment_transactions.find_one({"id": tx.get("id")}, {"_id": 0}) or tx
        await ensure_enrollment_for_payment_request_tx(db, {**tx_fresh, "payment_status": "paid"})
    except Exception as exc:
        logger.warning("payment link enrollment after settle: %s", exc)


# ── Stripe webhook top-up (called by existing webhook route) ─────────────────
# The existing Stripe webhook already marks payment_transactions as paid.
# When that happens we also need to mark the payment_request paid.
# We expose a helper so the webhook route can call it.

async def mark_payment_request_paid_by_session(session_id: str, payer_name: str = "", payer_email: str = "") -> None:
    """Called by the Stripe webhook after verifying a payment_request checkout."""
    tx = await db.payment_transactions.find_one({"stripe_session_id": session_id}, {"_id": 0})
    if not tx:
        return
    is_pr = (
        (tx.get("item_type") or "").lower() == "payment_request"
        or tx.get("created_via") == "payment_request"
        or tx.get("payment_request_id")
    )
    if not is_pr:
        return
    req_id = (tx.get("payment_request_id") or tx.get("item_id") or "").strip()
    if not req_id:
        return

    if not payer_email or not payer_name:
        api_key = await _stripe_key()
        if api_key:
            try:
                stripe_lib.api_key = api_key
                sess = stripe_lib.checkout.Session.retrieve(session_id)
                cd = sess.customer_details or {}
                payer_email = payer_email or (getattr(cd, "email", None) or (cd.get("email") if isinstance(cd, dict) else "") or "")
                payer_name = payer_name or (getattr(cd, "name", None) or (cd.get("name") if isinstance(cd, dict) else "") or "")
            except Exception as e:
                logger.warning("Could not load Stripe session for payment request: %s", e)

    payer_email = (payer_email or tx.get("booker_email") or "").strip().lower()
    payer_name = (payer_name or tx.get("booker_name") or "").strip()

    if payer_email or payer_name:
        await db.payment_transactions.update_one(
            {"stripe_session_id": session_id},
            {"$set": {
                "booker_email": payer_email or tx.get("booker_email", ""),
                "booker_name": payer_name or tx.get("booker_name", ""),
                "updated_at": _now_iso(),
            }},
        )

    req = await db.payment_requests.find_one({"id": req_id})
    if not req:
        return
    st = (req.get("status") or "").lower()
    if st in ("paid", "cancelled"):
        return

    await _settle_payment_request_tx(
        req_id,
        tx,
        payer_name=payer_name,
        payer_email=payer_email,
        session_key=session_id,
    )


@router.post("/{req_id}/record-manual-payment")
async def record_manual_payment(req_id: str, body: RecordManualPaymentBody, request: Request):
    """
    Admin: record an offline payment (GPay, cash, bank transfer, etc.) on a custom link.
    Creates a paid transaction and enrollment row for tracking.
    """
    await assert_admin_session_or_password(request, None)

    row = await db.payment_requests.find_one({"id": req_id}, {"_id": 0})
    if not row:
        raise HTTPException(404, "Payment request not found")
    if not _can_checkout_payment_request(row):
        raise HTTPException(400, f"Cannot record payment — link status is {row.get('status')}")

    method = str(body.payment_method or "cash").strip().lower()
    if method not in MANUAL_PAYMENT_METHODS:
        raise HTTPException(400, f"Invalid payment_method. Use one of: {', '.join(sorted(MANUAL_PAYMENT_METHODS))}")

    checkout = _checkout_state_for_row(row)
    amount = round(float(body.amount if body.amount is not None else checkout["checkout_amount"]), 2)
    if amount <= 0:
        raise HTTPException(400, "Amount must be greater than zero")

    payer_name = (body.payer_name or row.get("recipient_name") or row.get("payer_name") or "").strip()
    payer_email = (body.payer_email or row.get("recipient_email") or row.get("payer_email") or "").strip().lower()
    paid_at = (body.paid_at or "").strip() or _now_iso()

    inst_n = int(checkout.get("installment_current") or 1)
    inst_total = int(checkout.get("num_installments") or 1)
    session_id = f"manual_{uuid.uuid4().hex[:20]}"
    tx_id = str(uuid.uuid4())
    now = _now_iso()

    tx_doc = {
        "id": tx_id,
        "stripe_session_id": session_id,
        "payment_provider": "manual",
        "payment_method": method,
        "payment_status": "paid",
        "item_type": "payment_request",
        "item_id": req_id,
        "item_title": row["title"],
        "amount": amount,
        "currency": row["currency"],
        "booker_name": payer_name,
        "booker_email": payer_email,
        "payment_request_id": req_id,
        "created_via": "payment_request",
        "installment_number": inst_n,
        "num_installments": inst_total,
        "payment_request_total": round(float(row.get("amount") or 0), 2),
        "catalog_item_type": row.get("item_type") or "",
        "catalog_item_id": row.get("item_id") or "",
        "catalog_item_title": row.get("item_title") or "",
        "tier_index": row.get("tier_index"),
        "chosen_start_date": row.get("chosen_start_date") or "",
        "chosen_end_date": row.get("chosen_end_date") or "",
        "chosen_tier_label": row.get("chosen_tier_label") or "",
        "session_date": row.get("session_date") or "",
        "manual_reference": (body.reference or "").strip(),
        "manual_notes": (body.notes or "").strip(),
        "recorded_by": "admin",
        "paid_at": paid_at,
        "created_at": now,
        "updated_at": now,
    }
    await db.payment_transactions.insert_one(tx_doc)

    await _settle_payment_request_tx(
        req_id,
        tx_doc,
        payer_name=payer_name,
        payer_email=payer_email,
        session_key=session_id,
    )

    updated = await db.payment_requests.find_one({"id": req_id}, {"_id": 0})
    enrollment_id = (updated or {}).get("enrollment_id")
    return {
        "ok": True,
        "status": (updated or {}).get("status"),
        "transaction_id": tx_id,
        "enrollment_id": enrollment_id,
        "payment_method": method,
        "amount": amount,
    }


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
                    now = _now_iso()
                    await db.payment_transactions.update_one(
                        {"stripe_session_id": check_id},
                        {"$set": {"payment_status": "paid", "paid_at": now, "updated_at": now}}
                    )
                    await mark_payment_request_paid_by_session(check_id)
                    row = await db.payment_requests.find_one({"id": req_id}, {"_id": 0}) or row
                    out = {"status": row.get("status"), "paid_at": row.get("paid_at")}
                    out.update(_checkout_state_for_row(row))
                    return out
            except Exception as e:
                logger.warning("Status check error: %s", e)

    out = {"status": row["status"]}
    out.update(_checkout_state_for_row(row))
    return out


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
    if tx:
        try:
            from utils.payment_request_enrollment import ensure_enrollment_for_payment_request_tx

            await ensure_enrollment_for_payment_request_tx(db, {**tx, "payment_status": "paid"})
        except Exception as exc:
            logger.warning("payment link enrollment (razorpay): %s", exc)
    return {"status": "paid"}
