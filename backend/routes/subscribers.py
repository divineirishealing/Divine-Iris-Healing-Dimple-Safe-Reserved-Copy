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


# ═══════════════════════════════════════════
# MULTI-PACKAGE ANNUAL PRICING
# ═══════════════════════════════════════════

class IncludedProgram(BaseModel):
    name: str
    program_id: str = ""
    duration_value: int = 12
    duration_unit: str = "months"  # months | sessions
    price_per_unit: Dict[str, float] = {}    # {INR: 90000, ...} original price per unit
    offer_per_unit: Dict[str, float] = {}    # {INR: 75000, ...} offer price per unit
    # Auto-calc: total = price_per_unit × duration, offer_total = offer_per_unit × duration, disc = (total-offer)/total×100

class AnnualPackage(BaseModel):
    package_id: str = ""
    package_name: str = "Standard Annual"
    version: int = 1
    valid_from: str = ""
    valid_to: str = ""
    duration_months: int = 12
    included_programs: List[IncludedProgram] = []
    additional_discount_pct: float = 0
    offer_total: Dict[str, float] = {}  # {INR: 500000, ...} final package offer price (override)
    default_sessions_current: int = 12
    late_fee_per_day: float = 0  # fixed daily late fee (INR)
    channelization_fee: float = 0  # one-time fee when payment is late
    show_late_fees: bool = False  # toggle: show/hide late fees by default
    default_currency: str = "INR"  # default currency for subscribers
    notes: str = ""
    is_locked: bool = False  # safety lock — prevents accidental edits
    is_active: bool = True  # can still tag subscribers when locked+active
    is_retired: bool = False  # retired = no new subscribers

# --- CRUD for packages ---

@router.get("/packages")
async def list_packages():
    """List all annual packages."""
    packages = await db.annual_packages.find({}, {"_id": 0}).to_list(100)
    if not packages:
        # Seed a default package
        default = AnnualPackage(
            package_id="PKG-STANDARD",
            package_name="Standard Annual",
            valid_from="2026-04-01",
            valid_to="2027-03-31",
            included_programs=[
                IncludedProgram(name="AWRP", duration_value=12, duration_unit="months",
                    price_per_unit={"INR": 90000, "USD": 1800, "AED": 4500},
                    offer_per_unit={"INR": 45000, "USD": 900, "AED": 2250}),
                IncludedProgram(name="Money Magic Multiplier", duration_value=6, duration_unit="months",
                    price_per_unit={"INR": 20000, "USD": 325, "AED": 1200},
                    offer_per_unit={"INR": 10000, "USD": 163, "AED": 600}),
                IncludedProgram(name="Bi-Annual Downloads", duration_value=2, duration_unit="sessions"),
                IncludedProgram(name="Quarterly Meetups", duration_value=4, duration_unit="sessions"),
            ]
        ).dict()
        default["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.annual_packages.insert_one(default)
        del default["_id"]
        packages = [default]
    return packages

@router.post("/packages")
async def create_package(data: AnnualPackage):
    """Create a new annual package variant."""
    pkg = data.dict()
    if not pkg["package_id"]:
        pkg["package_id"] = f"PKG-{str(uuid.uuid4())[:6].upper()}"
    pkg["included_programs"] = [p.dict() for p in data.included_programs]
    pkg["created_at"] = datetime.now(timezone.utc).isoformat()
    pkg["updated_at"] = datetime.now(timezone.utc).isoformat()
    # Check uniqueness
    existing = await db.annual_packages.find_one({"package_id": pkg["package_id"]})
    if existing:
        raise HTTPException(status_code=400, detail=f"Package ID '{pkg['package_id']}' already exists")
    await db.annual_packages.insert_one(pkg)
    return {"message": "Package created", "package_id": pkg["package_id"]}

@router.put("/packages/{package_id}")
async def update_package(package_id: str, data: AnnualPackage):
    """Update an existing package."""
    pkg = data.dict()
    pkg["package_id"] = package_id
    pkg["included_programs"] = [p.dict() for p in data.included_programs]
    pkg["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.annual_packages.update_one(
        {"package_id": package_id},
        {"$set": pkg}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Package not found")
    return {"message": "Package updated"}

@router.delete("/packages/{package_id}")
async def delete_package(package_id: str):
    result = await db.annual_packages.delete_one({"package_id": package_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Package not found")
    return {"message": "Package deleted"}

@router.get("/packages/{package_id}")
async def get_package(package_id: str):
    doc = await db.annual_packages.find_one({"package_id": package_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Package not found")
    return doc

@router.get("/packages/{package_id}/stats")
async def get_package_stats(package_id: str):
    """Auto-populated stats from subscribers tagged to this package."""
    subs = await db.clients.find(
        {"subscription.package_id": package_id},
        {"_id": 0, "subscription": 1}
    ).to_list(5000)

    total_people = len(subs)
    total_received = 0
    total_due = 0
    emi_count = 0
    emi_received = 0
    emi_due = 0

    for s in subs:
        sub = s.get("subscription", {})
        emis = sub.get("emis", [])
        for emi in emis:
            if emi.get("status") == "paid":
                emi_received += emi.get("amount", 0)
                total_received += emi.get("amount", 0)
            elif emi.get("status") in ("due", "pending", "partial"):
                emi_due += emi.get("amount", 0)
                total_due += emi.get("amount", 0)
        if sub.get("payment_mode") == "EMI":
            emi_count += 1
        # If no EMIs but has total_fee, count as full payment
        if not emis and sub.get("total_fee", 0) > 0:
            total_due += sub.get("total_fee", 0)

    return {
        "total_people": total_people,
        "total_received": round(total_received, 2),
        "total_due": round(total_due, 2),
        "emi_count": emi_count,
        "emi_received": round(emi_received, 2),
        "emi_due": round(emi_due, 2)
    }

@router.post("/packages/{package_id}/new-version")
async def create_new_version(package_id: str):
    """Clone package as new version, lock the old one."""
    old = await db.annual_packages.find_one({"package_id": package_id}, {"_id": 0})
    if not old:
        raise HTTPException(status_code=404, detail="Package not found")

    # Lock the old version
    await db.annual_packages.update_one(
        {"package_id": package_id},
        {"$set": {"is_locked": True}}
    )

    # Create new version
    old_version = old.get("version", 1)
    base_id = package_id.rsplit("-v", 1)[0] if "-v" in package_id else package_id
    new_id = f"{base_id}-v{old_version + 1}"

    new_pkg = {**old}
    new_pkg.pop("_id", None)
    new_pkg["package_id"] = new_id
    new_pkg["version"] = old_version + 1
    new_pkg["is_locked"] = False
    new_pkg["created_at"] = datetime.now(timezone.utc).isoformat()
    new_pkg["updated_at"] = datetime.now(timezone.utc).isoformat()
    new_pkg["notes"] = f"New version from {package_id}"

    await db.annual_packages.insert_one(new_pkg)
    return {"message": f"New version created", "new_package_id": new_id, "old_locked": package_id}

# --- Backward compat: pricing-config returns the first active package ---
@router.get("/pricing-config")
async def get_pricing_config():
    pkg = await db.annual_packages.find_one({"is_active": True}, {"_id": 0})
    if not pkg:
        pkgs = await db.annual_packages.find({}, {"_id": 0}).to_list(1)
        pkg = pkgs[0] if pkgs else None
    if not pkg:
        # trigger default seed
        pkgs = await list_packages()
        pkg = pkgs[0] if pkgs else {}
    return pkg

@router.put("/pricing-config")
async def update_pricing_config(data: AnnualPackage):
    """Backward compat: update the first active package."""
    pkg_id = data.package_id
    if not pkg_id:
        existing = await db.annual_packages.find_one({"is_active": True}, {"_id": 0})
        if existing:
            pkg_id = existing["package_id"]
        else:
            pkg_id = "PKG-STANDARD"
    update = data.dict()
    update["package_id"] = pkg_id
    update["included_programs"] = [p.dict() for p in data.included_programs]
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.annual_packages.update_one(
        {"package_id": pkg_id},
        {"$set": update},
        upsert=True
    )
    return {"message": "Package updated"}



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


# ─── CREATE / UPDATE SUBSCRIBER (manual) ───

class EMIInput(BaseModel):
    number: int
    date: str = ""
    amount: float = 0
    remaining: float = 0
    due_date: str = ""
    status: str = "pending"

class SessionsInput(BaseModel):
    carry_forward: int = 0
    current: int = 0
    total: int = 0
    availed: int = 0
    yet_to_avail: int = 0
    due: int = 0
    scheduled_dates: List[str] = []

class ProgramDetail(BaseModel):
    name: str
    duration_value: int = 0
    duration_unit: str = "months"
    start_date: str = ""
    end_date: str = ""
    status: str = "active"  # active | paused
    mode: str = "online"  # online | offline
    visible: bool = True
    schedule: List[Dict] = []  # [{month/session, date, end_date, time, mode_choice, completed}]

class SubscriberCreate(BaseModel):
    name: str
    email: str = ""
    package_id: str = ""
    display_currency: str = "INR"
    annual_program: str = ""
    start_date: str = ""
    end_date: str = ""
    total_fee: float = 0
    currency: str = "INR"
    payment_mode: str = "No EMI"
    num_emis: int = 0
    emi_day: int = 30  # day of month for EMI due dates
    emis: List[EMIInput] = []
    sessions: Optional[SessionsInput] = None
    programs: List[str] = []
    programs_detail: List[ProgramDetail] = []
    bi_annual_download: int = 0
    quarterly_releases: int = 0
    show_late_fees: bool = False
    late_fee_per_day: float = 0
    channelization_fee: float = 0
    payment_methods: List[str] = ["stripe", "manual"]

@router.post("/create")
async def create_subscriber(data: SubscriberCreate):
    """Manually create a new subscriber from the admin panel."""
    sess = data.sessions.dict() if data.sessions else {
        "carry_forward": 0, "current": 0, "total": 0,
        "availed": 0, "yet_to_avail": 0, "due": 0, "scheduled_dates": []
    }
    if sess["total"] == 0 and (sess["carry_forward"] or sess["current"]):
        sess["total"] = sess["carry_forward"] + sess["current"]
    sess["yet_to_avail"] = sess["total"] - sess["availed"]

    subscription = {
        "package_id": data.package_id,
        "display_currency": data.display_currency,
        "annual_program": data.annual_program,
        "start_date": data.start_date,
        "end_date": data.end_date,
        "total_fee": data.total_fee,
        "currency": data.currency,
        "payment_mode": data.payment_mode,
        "num_emis": data.num_emis,
        "emi_day": data.emi_day,
        "emis": [e.dict() for e in data.emis],
        "sessions": sess,
        "programs": data.programs,
        "programs_detail": [p.dict() for p in data.programs_detail],
        "bi_annual_download": data.bi_annual_download,
        "quarterly_releases": data.quarterly_releases,
        "show_late_fees": data.show_late_fees,
        "late_fee_per_day": data.late_fee_per_day,
        "channelization_fee": data.channelization_fee,
        "payment_methods": data.payment_methods,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    # Check if client exists
    existing = None
    if data.email:
        existing = await db.clients.find_one({"email": data.email.lower()})
    if not existing and data.name:
        existing = await db.clients.find_one({"name": {"$regex": f"^{data.name}$", "$options": "i"}})

    if existing:
        await db.clients.update_one(
            {"_id": existing["_id"]},
            {"$set": {"subscription": subscription, "name": data.name or existing.get("name"), "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"message": "Subscriber updated", "id": existing["id"]}
    else:
        client_id = str(uuid.uuid4())
        new_client = {
            "id": client_id,
            "did": f"DID-{str(uuid.uuid4())[:8].upper()}",
            "email": data.email.lower() if data.email else "",
            "name": data.name,
            "phone": "",
            "label": "Iris",
            "label_manual": "Iris",
            "sources": ["Admin Manual"],
            "conversions": [],
            "timeline": [{"type": "Admin Manual", "detail": f"Annual: {data.annual_program}", "date": datetime.now(timezone.utc).isoformat()}],
            "subscription": subscription,
            "notes": "",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.clients.insert_one(new_client)
        return {"message": "Subscriber created", "id": client_id}


@router.put("/update/{client_id}")
async def update_subscriber(client_id: str, data: SubscriberCreate):
    """Update an existing subscriber's full subscription data."""
    client_doc = await db.clients.find_one({"id": client_id})
    if not client_doc:
        raise HTTPException(status_code=404, detail="Client not found")

    sess = data.sessions.dict() if data.sessions else client_doc.get("subscription", {}).get("sessions", {})
    if sess.get("total", 0) == 0 and (sess.get("carry_forward", 0) or sess.get("current", 0)):
        sess["total"] = sess.get("carry_forward", 0) + sess.get("current", 0)
    sess["yet_to_avail"] = sess.get("total", 0) - sess.get("availed", 0)

    subscription = {
        "package_id": data.package_id,
        "display_currency": data.display_currency,
        "annual_program": data.annual_program,
        "start_date": data.start_date,
        "end_date": data.end_date,
        "total_fee": data.total_fee,
        "currency": data.currency,
        "payment_mode": data.payment_mode,
        "num_emis": data.num_emis,
        "emi_day": data.emi_day,
        "emis": [e.dict() for e in data.emis],
        "sessions": sess,
        "programs": data.programs,
        "programs_detail": [p.dict() for p in data.programs_detail],
        "bi_annual_download": data.bi_annual_download,
        "quarterly_releases": data.quarterly_releases,
        "show_late_fees": data.show_late_fees,
        "late_fee_per_day": data.late_fee_per_day,
        "channelization_fee": data.channelization_fee,
        "payment_methods": data.payment_methods,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    update_fields = {"subscription": subscription, "updated_at": datetime.now(timezone.utc).isoformat()}
    if data.name:
        update_fields["name"] = data.name
    if data.email:
        update_fields["email"] = data.email.lower()

    await db.clients.update_one({"id": client_id}, {"$set": update_fields})
    return {"message": "Subscriber updated"}


@router.delete("/delete/{client_id}")
async def delete_subscriber_subscription(client_id: str):
    """Remove subscription data from a client (does not delete the client)."""
    result = await db.clients.update_one(
        {"id": client_id},
        {"$unset": {"subscription": ""}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Client not found or no subscription")
    return {"message": "Subscription removed"}


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
