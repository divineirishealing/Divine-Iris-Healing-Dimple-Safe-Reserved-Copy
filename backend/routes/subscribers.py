"""
Annual Subscriber Management - Excel Upload/Download & Student Data API
Handles: EMI tracking, session management, program progress, and Excel import/export
"""
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Dict
import pandas as pd
import io
import uuid
import math
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/api/admin/subscribers", tags=["Subscribers"])

mongo_url = os.environ['MONGO_URL']
_client = AsyncIOMotorClient(mongo_url)
db = _client[os.environ['DB_NAME']]


# ─── HELPERS ───

def safe_str(val):
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return ""
    return str(val).strip()

def safe_float(val):
    try:
        if val is None or (isinstance(val, float) and math.isnan(val)):
            return 0.0
        return float(val)
    except (ValueError, TypeError):
        return 0.0

def safe_int(val):
    try:
        if val is None or (isinstance(val, float) and math.isnan(val)):
            return 0
        return int(float(val))
    except (ValueError, TypeError):
        return 0

def safe_date(val):
    """Convert various date formats to ISO string."""
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return ""
    if isinstance(val, datetime):
        return val.strftime("%Y-%m-%d")
    s = str(val).strip()
    if not s or s.lower() == "nan" or s.lower() == "nat":
        return ""
    # Try common formats
    for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%Y-%m-%dT%H:%M:%S"]:
        try:
            return datetime.strptime(s[:10], fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return s


# ─── UPLOAD ───

@router.post("/upload")
async def upload_subscriber_excel(file: UploadFile = File(...)):
    """
    Upload Excel with annual subscriber data.
    Expected columns (flexible naming, case-insensitive):
      Name, Email, Annual Program, Start Date, End Date,
      Total Fee, Currency, Payment Mode, Number of EMIs,
      EMI_1_Date, EMI_1_Amount, EMI_1_Remaining, EMI_1_DueDate ... (up to EMI_12),
      Bi-Annual Download, Quarterly Releases,
      Sessions Carry Forward, Sessions Current, Sessions Availed, Sessions Due,
      Scheduled Dates (comma-separated)
    """
    contents = await file.read()
    try:
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid file: {str(e)}")

    # Normalize column names
    col_map = {}
    for c in df.columns:
        key = c.strip().lower().replace(" ", "_").replace("-", "_")
        col_map[c] = key
    df.rename(columns=col_map, inplace=True)

    stats = {"created": 0, "updated": 0, "skipped": 0, "errors": []}

    for idx, row in df.iterrows():
        try:
            email = safe_str(row.get("email")).lower()
            name = safe_str(row.get("name"))

            if not email and not name:
                stats["skipped"] += 1
                continue

            # Build subscription object
            subscription = {
                "annual_program": safe_str(row.get("annual_program", "")),
                "start_date": safe_date(row.get("start_date")),
                "end_date": safe_date(row.get("end_date")),
                "total_fee": safe_float(row.get("total_fee", 0)),
                "currency": safe_str(row.get("currency", "INR")),
                "payment_mode": safe_str(row.get("payment_mode", "No EMI")),
                "num_emis": safe_int(row.get("number_of_emis", 0)),
                "bi_annual_download": safe_int(row.get("bi_annual_download", 0)),
                "quarterly_releases": safe_int(row.get("quarterly_releases", 0)),
            }

            # Parse EMI schedule (up to 12)
            emis = []
            for i in range(1, 13):
                emi_date = safe_date(row.get(f"emi_{i}_date"))
                emi_amount = safe_float(row.get(f"emi_{i}_amount", 0))
                emi_remaining = safe_float(row.get(f"emi_{i}_remaining", 0))
                emi_due = safe_date(row.get(f"emi_{i}_duedate") or row.get(f"emi_{i}_due_date"))
                if emi_amount > 0 or emi_date:
                    emis.append({
                        "number": i,
                        "date": emi_date,
                        "amount": emi_amount,
                        "remaining": emi_remaining,
                        "due_date": emi_due,
                        "status": "paid" if emi_date and emi_remaining == 0 else ("due" if emi_due else "pending")
                    })
            subscription["emis"] = emis

            # Sessions
            carry_fwd = safe_int(row.get("sessions_carry_forward", 0))
            current = safe_int(row.get("sessions_current", 0))
            availed = safe_int(row.get("sessions_availed", 0))
            due = safe_int(row.get("sessions_due", 0))
            total_sessions = carry_fwd + current
            yet_to_avail = total_sessions - availed

            scheduled_raw = safe_str(row.get("scheduled_dates", ""))
            scheduled_dates = [s.strip() for s in scheduled_raw.split(",") if s.strip()] if scheduled_raw else []

            subscription["sessions"] = {
                "carry_forward": carry_fwd,
                "current": current,
                "total": total_sessions,
                "availed": availed,
                "yet_to_avail": yet_to_avail,
                "due": due,
                "scheduled_dates": scheduled_dates
            }

            # Programs in the annual package
            programs_raw = safe_str(row.get("programs", ""))
            if programs_raw:
                subscription["programs"] = [p.strip() for p in programs_raw.split(",") if p.strip()]
            else:
                subscription["programs"] = [subscription["annual_program"]] if subscription["annual_program"] else []

            subscription["updated_at"] = datetime.now(timezone.utc).isoformat()

            # Find or create client
            query = None
            if email:
                query = {"email": email}
            elif name:
                query = {"name": {"$regex": f"^{name}$", "$options": "i"}}

            existing = await db.clients.find_one(query) if query else None

            if existing:
                await db.clients.update_one(
                    {"_id": existing["_id"]},
                    {"$set": {
                        "subscription": subscription,
                        "name": name or existing.get("name", ""),
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                stats["updated"] += 1
            else:
                new_client = {
                    "id": str(uuid.uuid4()),
                    "did": f"DID-{str(uuid.uuid4())[:8].upper()}",
                    "email": email,
                    "name": name,
                    "phone": "",
                    "label": "Iris",
                    "label_manual": "Iris",
                    "sources": ["Subscriber Upload"],
                    "conversions": [],
                    "timeline": [{
                        "type": "Subscriber Upload",
                        "detail": f"Annual: {subscription['annual_program']}",
                        "date": datetime.now(timezone.utc).isoformat()
                    }],
                    "subscription": subscription,
                    "notes": "",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
                await db.clients.insert_one(new_client)
                stats["created"] += 1

        except Exception as e:
            stats["errors"].append(f"Row {idx + 2}: {str(e)}")

    return {"message": "Subscriber upload complete", "stats": stats}


# ─── DOWNLOAD TEMPLATE / EXPORT ───

@router.get("/download-template")
async def download_template():
    """Download a blank Excel template for subscriber upload."""
    cols = ["Name", "Email", "Annual Program", "Start Date", "End Date",
            "Total Fee", "Currency", "Payment Mode", "Number of EMIs"]
    for i in range(1, 13):
        cols.extend([f"EMI_{i}_Date", f"EMI_{i}_Amount", f"EMI_{i}_Remaining", f"EMI_{i}_DueDate"])
    cols.extend(["Bi-Annual Download", "Quarterly Releases",
                 "Sessions Carry Forward", "Sessions Current", "Sessions Availed", "Sessions Due",
                 "Scheduled Dates", "Programs"])

    df = pd.DataFrame(columns=cols)
    # Add one example row
    example = {"Name": "Example Student", "Email": "student@example.com",
               "Annual Program": "Quad Layer Healing", "Start Date": "2026-03-27",
               "End Date": "2027-03-26", "Total Fee": 50000, "Currency": "INR",
               "Payment Mode": "EMI", "Number of EMIs": 3,
               "EMI_1_Date": "2026-03-27", "EMI_1_Amount": 17000, "EMI_1_Remaining": 33000, "EMI_1_DueDate": "2026-03-27",
               "Sessions Carry Forward": 0, "Sessions Current": 12,
               "Sessions Availed": 0, "Sessions Due": 0,
               "Programs": "Quad Layer Healing, AWRP, SoulSync"}
    df = pd.concat([df, pd.DataFrame([example])], ignore_index=True)

    buf = io.BytesIO()
    df.to_excel(buf, index=False, engine='openpyxl')
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=subscriber_template.xlsx"}
    )


@router.get("/export")
async def export_subscribers():
    """Export all subscribers with subscription data as Excel."""
    clients = await db.clients.find(
        {"subscription": {"$exists": True}},
        {"_id": 0}
    ).to_list(5000)

    rows = []
    for c in clients:
        sub = c.get("subscription", {})
        sess = sub.get("sessions", {})
        row = {
            "Name": c.get("name", ""),
            "Email": c.get("email", ""),
            "Annual Program": sub.get("annual_program", ""),
            "Start Date": sub.get("start_date", ""),
            "End Date": sub.get("end_date", ""),
            "Total Fee": sub.get("total_fee", 0),
            "Currency": sub.get("currency", ""),
            "Payment Mode": sub.get("payment_mode", ""),
            "Number of EMIs": sub.get("num_emis", 0),
        }
        # EMIs
        for emi in sub.get("emis", []):
            i = emi["number"]
            row[f"EMI_{i}_Date"] = emi.get("date", "")
            row[f"EMI_{i}_Amount"] = emi.get("amount", 0)
            row[f"EMI_{i}_Remaining"] = emi.get("remaining", 0)
            row[f"EMI_{i}_DueDate"] = emi.get("due_date", "")

        row["Bi-Annual Download"] = sub.get("bi_annual_download", 0)
        row["Quarterly Releases"] = sub.get("quarterly_releases", 0)
        row["Sessions Carry Forward"] = sess.get("carry_forward", 0)
        row["Sessions Current"] = sess.get("current", 0)
        row["Sessions Availed"] = sess.get("availed", 0)
        row["Sessions Due"] = sess.get("due", 0)
        row["Scheduled Dates"] = ", ".join(sess.get("scheduled_dates", []))
        row["Programs"] = ", ".join(sub.get("programs", []))
        rows.append(row)

    df = pd.DataFrame(rows) if rows else pd.DataFrame()
    buf = io.BytesIO()
    df.to_excel(buf, index=False, engine='openpyxl')
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=subscribers_export.xlsx"}
    )


# ─── LIST SUBSCRIBERS (for admin) ───

@router.get("/list")
async def list_subscribers():
    """Get all clients with subscription data."""
    clients = await db.clients.find(
        {"subscription": {"$exists": True}},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "label": 1, "subscription": 1}
    ).to_list(5000)
    return clients


# ─── UPDATE EMI STATUS (when payment received) ───

class EMIPaymentUpdate(BaseModel):
    client_id: str
    emi_number: int
    paid_date: str
    amount_paid: float

@router.post("/emi-payment")
async def record_emi_payment(data: EMIPaymentUpdate):
    """Record an EMI payment for a subscriber."""
    client_doc = await db.clients.find_one({"id": data.client_id})
    if not client_doc:
        raise HTTPException(status_code=404, detail="Client not found")

    sub = client_doc.get("subscription", {})
    emis = sub.get("emis", [])

    updated = False
    for emi in emis:
        if emi["number"] == data.emi_number:
            emi["date"] = data.paid_date
            emi["remaining"] = max(0, emi.get("remaining", 0) - data.amount_paid)
            emi["status"] = "paid" if emi["remaining"] == 0 else "partial"
            updated = True
            break

    if not updated:
        raise HTTPException(status_code=404, detail=f"EMI #{data.emi_number} not found")

    sub["emis"] = emis
    await db.clients.update_one(
        {"id": data.client_id},
        {"$set": {"subscription": sub, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": f"EMI #{data.emi_number} updated"}


# ─── UPDATE SESSION COUNT ───

class SessionUpdate(BaseModel):
    client_id: str
    availed_increment: int = 0
    new_scheduled_date: Optional[str] = None

@router.post("/session-update")
async def update_session(data: SessionUpdate):
    """Update session availed count or add a scheduled date."""
    client_doc = await db.clients.find_one({"id": data.client_id})
    if not client_doc:
        raise HTTPException(status_code=404, detail="Client not found")

    sub = client_doc.get("subscription", {})
    sess = sub.get("sessions", {})

    if data.availed_increment:
        sess["availed"] = sess.get("availed", 0) + data.availed_increment
        sess["yet_to_avail"] = sess.get("total", 0) - sess["availed"]

    if data.new_scheduled_date:
        dates = sess.get("scheduled_dates", [])
        dates.append(data.new_scheduled_date)
        sess["scheduled_dates"] = dates

    sub["sessions"] = sess
    await db.clients.update_one(
        {"id": data.client_id},
        {"$set": {"subscription": sub, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Session updated"}
