from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional
import os, uuid, shutil, logging
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/api/india-payments", tags=["India Payments"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

logger = logging.getLogger(__name__)

UPLOAD_DIR = ROOT_DIR / "uploads" / "payment_proofs"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/submit-proof")
async def submit_payment_proof(
    enrollment_id: str = Form(...),
    payer_name: str = Form(...),
    payment_date: str = Form(...),
    bank_name: str = Form(""),
    transaction_id: str = Form(...),
    amount: str = Form(...),
    city: str = Form(""),
    state: str = Form(""),
    payment_method: str = Form(""),
    program_type: str = Form(""),
    is_emi: str = Form("false"),
    emi_total_months: str = Form(""),
    emi_months_covered: str = Form(""),
    screenshot: UploadFile = File(...),
    notes: str = Form(""),
):
    """Submit India alternative payment proof for admin approval."""
    # Validate enrollment exists (skip for standalone 'MANUAL' submissions)
    enrollment = {}
    if enrollment_id != "MANUAL":
        enrollment = await db.enrollments.find_one({"id": enrollment_id}, {"_id": 0}) or {}

    # Save screenshot
    ext = screenshot.filename.split(".")[-1] if "." in screenshot.filename else "png"
    filename = f"{uuid.uuid4().hex[:12]}.{ext}"
    filepath = UPLOAD_DIR / filename
    with open(filepath, "wb") as f:
        shutil.copyfileobj(screenshot.file, f)

    proof = {
        "id": str(uuid.uuid4()),
        "enrollment_id": enrollment_id,
        "booker_name": enrollment.get("booker_name", payer_name),
        "booker_email": enrollment.get("booker_email", ""),
        "payer_name": payer_name,
        "payment_date": payment_date,
        "bank_name": bank_name,
        "transaction_id": transaction_id,
        "program_type": program_type,
        "program_title": enrollment.get("item_title", program_type),
        "amount": amount,
        "city": city,
        "state": state,
        "payment_method": payment_method,
        "is_emi": is_emi == "true",
        "emi_total_months": int(emi_total_months) if emi_total_months else None,
        "emi_months_covered": int(emi_months_covered) if emi_months_covered else None,
        "notes": notes,
        "screenshot_url": f"/api/uploads/payment_proofs/{filename}",
        "status": "pending",
        "participants": enrollment.get("participants", []),
        "participant_count": enrollment.get("participant_count", 1),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.india_payment_proofs.insert_one(proof)

    # Update enrollment status if linked
    if enrollment_id != "MANUAL" and enrollment:
        await db.enrollments.update_one(
            {"id": enrollment_id},
            {"$set": {
                "status": "india_payment_proof_submitted",
                "india_payment_proof_id": proof["id"],
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }}
        )

    logger.info(f"[INDIA PAYMENT PROOF] enrollment={enrollment_id}, txn={transaction_id}, amount={amount}")
    return {"message": "Payment proof submitted successfully. Awaiting admin approval.", "proof_id": proof["id"]}


@router.get("/admin/list")
async def list_payment_proofs():
    """Admin: list all India payment proofs."""
    proofs = await db.india_payment_proofs.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return proofs


@router.post("/admin/{proof_id}/approve")
async def approve_payment_proof(proof_id: str):
    """Admin: approve India payment proof and complete enrollment."""
    proof = await db.india_payment_proofs.find_one({"id": proof_id}, {"_id": 0})
    if not proof:
        raise HTTPException(status_code=404, detail="Payment proof not found")

    # Mark proof as approved
    await db.india_payment_proofs.update_one(
        {"id": proof_id},
        {"$set": {"status": "approved", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    enrollment_id = proof.get("enrollment_id")
    if enrollment_id:
        # Create a completed transaction
        fake_session_id = f"india_{uuid.uuid4().hex[:12]}"
        transaction = {
            "id": str(uuid.uuid4()),
            "enrollment_id": enrollment_id,
            "stripe_session_id": fake_session_id,
            "item_type": "program",
            "item_id": "",
            "item_title": proof.get("program_title", ""),
            "amount": float(proof.get("amount", 0)),
            "currency": "inr",
            "payment_status": "paid",
            "booker_name": proof.get("booker_name"),
            "booker_email": proof.get("booker_email"),
            "participants": proof.get("participants", []),
            "participant_count": proof.get("participant_count", 1),
            "is_india_alt": True,
            "india_proof_id": proof_id,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        await db.payment_transactions.insert_one(transaction)

        # Complete enrollment
        await db.enrollments.update_one(
            {"id": enrollment_id},
            {"$set": {
                "step": 5,
                "status": "completed",
                "stripe_session_id": fake_session_id,
                "is_india_alt": True,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }}
        )

        # Generate UIDs and send emails
        try:
            from routes.payments import generate_participant_uids, send_enrollment_emails
            await generate_participant_uids(fake_session_id)
            import asyncio
            asyncio.create_task(send_enrollment_emails(fake_session_id))
        except Exception as e:
            logger.warning(f"Error generating UIDs/emails for India payment: {e}")

    return {"message": "Payment proof approved. Enrollment completed.", "status": "approved"}


@router.post("/admin/{proof_id}/reject")
async def reject_payment_proof(proof_id: str, reason: str = ""):
    """Admin: reject India payment proof."""
    proof = await db.india_payment_proofs.find_one({"id": proof_id})
    if not proof:
        raise HTTPException(status_code=404, detail="Payment proof not found")

    await db.india_payment_proofs.update_one(
        {"id": proof_id},
        {"$set": {"status": "rejected", "reject_reason": reason, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    enrollment_id = proof.get("enrollment_id")


@router.get("/admin/enrollments")
async def list_enrollments():
    """Admin: list all enrollments."""
    enrollments = await db.enrollments.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    # Also fetch associated transactions
    for e in enrollments:
        txn = await db.payment_transactions.find_one(
            {"enrollment_id": e.get("id")}, {"_id": 0, "amount": 1, "currency": 1, "payment_status": 1}
        )
        e["payment"] = txn if txn else None
    return enrollments


@router.get("/admin/enrollments/export")
async def export_enrollments_excel():
    """Admin: export all enrollments as Excel file."""
    import io
    try:
        import openpyxl
    except ImportError:
        raise HTTPException(status_code=500, detail="openpyxl not installed")

    enrollments = await db.enrollments.find({}, {"_id": 0}).sort("created_at", -1).to_list(5000)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Enrollments"

    headers = [
        "Receipt ID", "Status", "Booker Name", "Booker Email", "Booker Country",
        "Phone", "Item Type", "Item Title", "Participant Count",
        "Participants", "Created At", "Updated At"
    ]
    ws.append(headers)

    for e in enrollments:
        participants_str = "; ".join(
            [f"{p.get('name', '')} ({p.get('email', '')})" for p in e.get("participants", [])]
        )
        ws.append([
            e.get("id", ""),
            e.get("status", ""),
            e.get("booker_name", ""),
            e.get("booker_email", ""),
            e.get("booker_country", ""),
            e.get("phone", ""),
            e.get("item_type", ""),
            e.get("item_title", ""),
            e.get("participant_count", 0),
            participants_str,
            e.get("created_at", ""),
            e.get("updated_at", ""),
        ])

    # Auto-size columns
    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 2, 50)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    from fastapi.responses import StreamingResponse
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=enrollments.xlsx"}
    )

    if enrollment_id:
        await db.enrollments.update_one(
            {"id": enrollment_id},
            {"$set": {"status": "india_payment_rejected", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

    return {"message": "Payment proof rejected.", "status": "rejected"}
