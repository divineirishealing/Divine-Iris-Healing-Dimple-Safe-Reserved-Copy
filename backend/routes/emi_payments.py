"""
Payment Management - Bank Accounts, Manual Payments, Approvals
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List
import uuid, os
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import mimetypes

import s3_storage

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/api/payment-mgmt", tags=["Payment Management"])

mongo_url = os.environ['MONGO_URL']
_client = AsyncIOMotorClient(mongo_url)
db = _client[os.environ['DB_NAME']]

UPLOAD_DIR = ROOT_DIR / 'uploads' / 'payment_proofs'
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# ═══ BANK ACCOUNTS ═══

class BankAccount(BaseModel):
    bank_code: str = ""  # unique code e.g. "HDFC-001"
    bank_name: str = ""
    account_name: str = ""
    account_number: str = ""
    ifsc_code: str = ""
    branch: str = ""
    upi_id: str = ""
    notes: str = ""
    is_active: bool = True

@router.get("/bank-accounts")
async def list_bank_accounts():
    accounts = await db.bank_accounts.find({}, {"_id": 0}).to_list(50)
    return accounts

@router.post("/bank-accounts")
async def create_bank_account(data: BankAccount):
    acc = data.dict()
    if not acc["bank_code"]:
        acc["bank_code"] = f"BANK-{str(uuid.uuid4())[:6].upper()}"
    existing = await db.bank_accounts.find_one({"bank_code": acc["bank_code"]})
    if existing:
        raise HTTPException(status_code=400, detail="Bank code already exists")
    acc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.bank_accounts.insert_one(acc)
    return {"message": "Bank account added", "bank_code": acc["bank_code"]}

@router.put("/bank-accounts/{bank_code}")
async def update_bank_account(bank_code: str, data: BankAccount):
    acc = data.dict()
    acc["bank_code"] = bank_code
    acc["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.bank_accounts.update_one({"bank_code": bank_code}, {"$set": acc})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Bank account not found")
    return {"message": "Bank account updated"}

@router.delete("/bank-accounts/{bank_code}")
async def delete_bank_account(bank_code: str):
    result = await db.bank_accounts.delete_one({"bank_code": bank_code})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"message": "Deleted"}


# ═══ PAYMENT METHODS CONFIG (per subscriber) ═══
# Stored in client.subscription.payment_methods = ["stripe", "exly", "manual"]
# Admin can tag which methods are available per subscriber


# ═══ MANUAL PAYMENT SUBMISSION (Student → Admin Approval) ═══

@router.post("/submit")
async def submit_manual_payment(
    client_id: str = Form(...),
    emi_number: int = Form(0),
    payment_method: str = Form(...),  # neft, rtgs, upi, cash, gpay
    bank_code: str = Form(""),
    transaction_id: str = Form(""),
    amount: float = Form(0),
    paid_by_name: str = Form(""),  # if paid by someone else
    notes: str = Form(""),
    is_voluntary: bool = Form(False),  # True = flexible timing/amount, credit toward balance (not a specific EMI row)
    receipt: Optional[UploadFile] = File(None)
):
    """Student submits manual payment proof for admin approval."""
    receipt_url = ""
    eff_emi = 0 if is_voluntary else emi_number
    if not is_voluntary and eff_emi < 1:
        raise HTTPException(status_code=400, detail="emi_number is required for scheduled EMI payments (or use voluntary payment).")
    if amount is None or float(amount) <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than zero.")

    if receipt:
        ext = receipt.filename.split(".")[-1] if "." in receipt.filename else "png"
        fname = f"{client_id}_{eff_emi}_{uuid.uuid4().hex[:8]}.{ext}"
        content = await receipt.read()
        mime = mimetypes.types_map.get(f".{ext.lower()}") or "image/png"
        if s3_storage.is_s3_enabled():
            key = s3_storage.payment_proof_key(fname)
            receipt_url = s3_storage.upload_bytes(key, content, mime)
        else:
            fpath = UPLOAD_DIR / fname
            with open(fpath, "wb") as f:
                f.write(content)
            receipt_url = f"/api/uploads/payment_proofs/{fname}"

    submission = {
        "id": str(uuid.uuid4()),
        "client_id": client_id,
        "emi_number": eff_emi,
        "is_voluntary": bool(is_voluntary),
        "payment_method": payment_method,
        "bank_code": bank_code,
        "transaction_id": transaction_id,
        "amount": float(amount),
        "paid_by_name": paid_by_name,
        "receipt_url": receipt_url,
        "notes": notes,
        "status": "pending",  # pending → approved → rejected
        "submitted_at": datetime.now(timezone.utc).isoformat()
    }
    await db.payment_submissions.insert_one(submission)
    return {"message": "Payment submitted for approval", "id": submission["id"]}


# ═══ ADMIN: PAYMENT APPROVALS ═══

@router.get("/pending")
async def get_pending_payments():
    """Get all pending payment submissions."""
    submissions = await db.payment_submissions.find(
        {"status": "pending"}, {"_id": 0}
    ).sort("submitted_at", -1).to_list(200)
    # Enrich with client name
    for s in submissions:
        client = await db.clients.find_one({"id": s["client_id"]}, {"_id": 0, "name": 1, "email": 1})
        s["client_name"] = client.get("name", "Unknown") if client else "Unknown"
        s["client_email"] = client.get("email", "") if client else ""
    return submissions

@router.post("/approve/{submission_id}")
async def approve_payment(submission_id: str):
    """Approve a manual payment and update the EMI status."""
    sub = await db.payment_submissions.find_one({"id": submission_id})
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    # Update EMI in client subscription — or credit voluntary pool
    client = await db.clients.find_one({"id": sub["client_id"]})
    if client:
        subscription = client.get("subscription", {})
        amt = float(sub.get("amount") or 0)
        if sub.get("is_voluntary") or sub.get("emi_number") == 0:
            vc = float(subscription.get("voluntary_credits_total") or 0)
            subscription["voluntary_credits_total"] = round(vc + amt, 2)
        else:
            emis = subscription.get("emis", [])
            for emi in emis:
                if emi["number"] == sub["emi_number"]:
                    emi["status"] = "paid"
                    emi["date"] = sub["submitted_at"][:10]
                    emi["payment_method"] = sub["payment_method"]
                    emi["transaction_id"] = sub.get("transaction_id", "")
                    emi["paid_by"] = sub.get("paid_by_name", "")
                    emi["remaining"] = max(0, emi.get("remaining", 0) - amt)
                    break
            subscription["emis"] = emis
        await db.clients.update_one(
            {"id": sub["client_id"]},
            {"$set": {"subscription": subscription, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

    await db.payment_submissions.update_one(
        {"id": submission_id},
        {"$set": {"status": "approved", "approved_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Payment approved"}

@router.post("/reject/{submission_id}")
async def reject_payment(submission_id: str):
    await db.payment_submissions.update_one(
        {"id": submission_id},
        {"$set": {"status": "rejected", "rejected_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Payment rejected"}

@router.get("/history/{client_id}")
async def get_payment_history(client_id: str):
    """Get all payment submissions for a client."""
    submissions = await db.payment_submissions.find(
        {"client_id": client_id}, {"_id": 0}
    ).sort("submitted_at", -1).to_list(100)
    return submissions


# ═══ STUDENT: GET BANK DETAILS & PAYMENT OPTIONS ═══

@router.get("/options/{client_id}")
async def get_payment_options(client_id: str):
    """Get available payment methods and bank details for a subscriber."""
    client = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    sub = client.get("subscription", {})
    methods = sub.get("payment_methods", ["stripe", "manual"])  # default: stripe + manual

    # Get bank accounts
    banks = await db.bank_accounts.find({"is_active": True}, {"_id": 0}).to_list(10)

    return {
        "enabled_methods": methods,
        "bank_accounts": banks,
        "display_currency": sub.get("display_currency", "INR")
    }
