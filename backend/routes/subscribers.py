"""
Annual Subscriber Management - Excel Upload/Download & Student Data API
Handles: EMI tracking, session management, program progress, and Excel import/export
"""
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
import pandas as pd
import io
import uuid
import math
from datetime import datetime, timezone
import calendar
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path
from utils.canonical_id import new_entity_id, new_internal_diid
from utils.garden_labels import iris_label_for_year
from utils.person_name import normalize_person_name

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

from iris_journey import iris_journey_catalog, resolve_iris_journey  # noqa: E402

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


def _excel_cell_present(row, key):
    v = row.get(key)
    if v is None:
        return False
    if isinstance(v, float) and math.isnan(v):
        return False
    if isinstance(v, str) and not str(v).strip():
        return False
    return True


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
    # Pricing period for this row (e.g. FY / cohort). Empty = no restriction in UI.
    valid_from: str = ""
    valid_to: str = ""
    duration_months: int = 12
    included_programs: List[IncludedProgram] = []
    additional_discount_pct: float = 0  # extra % off after line-item offers
    # Per-currency tax rate as decimal, e.g. 0.18 = 18%. Empty key → client uses defaults.
    tax_rates: Dict[str, float] = {}
    offer_total: Dict[str, float] = {}  # {INR: 500000, ...} final package offer price (override)
    default_sessions_current: int = 12
    late_fee_per_day: float = 0  # fixed daily late fee (INR)
    channelization_fee: float = 0  # one-time fee when payment is late
    show_late_fees: bool = False  # toggle: show/hide late fees by default
    default_currency: str = "INR"  # default currency for subscribers
    # Optional: suggest membership / EMI start anchored to this calendar day (1–28); 0 = any day.
    preferred_membership_day_of_month: int = 0
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
        # Seed single Home Coming bundle — line items are fixed; use offer_total + tax for catalog price.
        default = AnnualPackage(
            package_id="PKG-HOME-COMING",
            package_name="Home Coming",
            valid_from="",
            valid_to="",
            tax_rates={"INR": 0, "AED": 0, "USD": 0},
            offer_total={},
            included_programs=[
                IncludedProgram(name="AWRP", duration_value=12, duration_unit="months"),
                IncludedProgram(name="Money Magic Multiplier", duration_value=6, duration_unit="months"),
                IncludedProgram(name="Turbo Release", duration_value=4, duration_unit="sessions"),
                IncludedProgram(name="Meta Downloads", duration_value=2, duration_unit="sessions"),
            ],
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
            pkg_id = "PKG-HOME-COMING"
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




# ─── GLOBAL PROGRAM SCHEDULE (common for all subscribers) ───

@router.get("/program-schedule")
async def get_program_schedule():
    """Get the global program schedule."""
    doc = await db.program_schedule.find_one({"id": "global"}, {"_id": 0})
    if not doc:
        return []
    return doc.get("programs", [])

@router.put("/program-schedule")
async def update_program_schedule(programs: List[Dict]):
    """Save global program schedule and sync to all clients that have subscription data."""
    await db.program_schedule.update_one(
        {"id": "global"},
        {"$set": {"id": "global", "programs": programs, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )

    # Sync to all subscribers: update their programs_detail schedule where program names match
    subscribers = await db.clients.find(
        {"subscription": {"$exists": True}},
        {"_id": 0, "id": 1, "subscription": 1}
    ).to_list(5000)

    for sub_doc in subscribers:
        subscription = sub_doc.get("subscription", {})
        pd = subscription.get("programs_detail", [])
        updated = False
        for global_prog in programs:
            for local_prog in pd:
                if local_prog["name"] == global_prog["name"]:
                    # Merge: keep student's mode_choice, update dates from global
                    old_sched = {(s.get("month") or s.get("session", 0)): s for s in local_prog.get("schedule", [])}
                    new_sched = []
                    for gs in global_prog.get("schedule", []):
                        key = gs.get("month") or gs.get("session", 0)
                        old = old_sched.get(key, {})
                        merged = {**gs, "mode_choice": old.get("mode_choice", "")}
                        new_sched.append(merged)
                    local_prog["schedule"] = new_sched
                    updated = True
        if updated:
            subscription["programs_detail"] = pd
            await db.clients.update_one(
                {"id": sub_doc["id"]},
                {"$set": {"subscription": subscription}}
            )

    return {"message": f"Schedule saved & synced to {len(subscribers)} subscribers"}


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
            name_raw = safe_str(row.get("name")).strip()
            name = normalize_person_name(name_raw) if name_raw else ""

            if not email and not name:
                stats["skipped"] += 1
                continue

            query = None
            if email:
                query = {"email": email}
            elif name:
                query = {"name": {"$regex": f"^{name}$", "$options": "i"}}
            existing = await db.clients.find_one(query) if query else None
            prev_sub = (existing or {}).get("subscription") or {}

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

            if _excel_cell_present(row, "iris_year"):
                subscription["iris_year"] = max(1, min(12, safe_int(row.get("iris_year")) or 1))
            else:
                subscription["iris_year"] = max(1, min(12, safe_int(prev_sub.get("iris_year")) or 1))

            if _excel_cell_present(row, "iris_year_mode"):
                _m = safe_str(row.get("iris_year_mode")).lower()
                subscription["iris_year_mode"] = _m if _m in ("manual", "auto") else "manual"
            else:
                subscription["iris_year_mode"] = prev_sub.get("iris_year_mode") or "manual"

            subscription["updated_at"] = datetime.now(timezone.utc).isoformat()

            subscription["package_id"] = (
                safe_str(row.get("package_id", ""))
                if _excel_cell_present(row, "package_id")
                else prev_sub.get("package_id", "")
            )
            if _excel_cell_present(row, "individual_discount_pct"):
                subscription["individual_discount_pct"] = safe_float(row.get("individual_discount_pct"))
            else:
                subscription["individual_discount_pct"] = prev_sub.get("individual_discount_pct")
            if _excel_cell_present(row, "individual_tax_pct"):
                subscription["individual_tax_pct"] = safe_float(row.get("individual_tax_pct"))
            else:
                subscription["individual_tax_pct"] = prev_sub.get("individual_tax_pct")

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
                _now = datetime.now(timezone.utc).isoformat()
                new_client = {
                    "id": new_entity_id(),
                    "did": f"DID-{str(uuid.uuid4())[:8].upper()}",
                    "diid": new_internal_diid(name, _now),
                    "email": email,
                    "name": name,
                    "phone": "",
                    "label": iris_label_for_year(1),
                    "label_manual": iris_label_for_year(1),
                    "sources": ["Subscriber Upload"],
                    "conversions": [],
                    "timeline": [{
                        "type": "Subscriber Upload",
                        "detail": f"Annual: {subscription['annual_program']}",
                        "date": _now,
                    }],
                    "subscription": subscription,
                    "notes": "",
                    "created_at": _now,
                    "updated_at": _now,
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
    cols = ["Name", "Email", "Package ID", "Annual Program", "Start Date", "End Date",
            "Total Fee", "Currency", "Payment Mode", "Number of EMIs",
            "Individual Discount Pct", "Individual Tax Pct",
            "Iris Year", "Iris Year Mode"]
    for i in range(1, 13):
        cols.extend([f"EMI_{i}_Date", f"EMI_{i}_Amount", f"EMI_{i}_Remaining", f"EMI_{i}_DueDate"])
    cols.extend(["Bi-Annual Download", "Quarterly Releases",
                 "Sessions Carry Forward", "Sessions Current", "Sessions Availed", "Sessions Due",
                 "Scheduled Dates", "Programs"])

    df = pd.DataFrame(columns=cols)
    # Add one example row
    example = {"Name": "Example Student", "Email": "student@example.com",
               "Package ID": "PKG-STANDARD", "Annual Program": "Quad Layer Healing", "Start Date": "2026-03-27",
               "End Date": "2027-03-26", "Total Fee": 50000, "Currency": "INR",
               "Payment Mode": "EMI", "Number of EMIs": 3,
               "Individual Discount Pct": "", "Individual Tax Pct": "",
               "Iris Year": 1, "Iris Year Mode": "manual",
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
            "Package ID": sub.get("package_id", ""),
            "Annual Program": sub.get("annual_program", ""),
            "Start Date": sub.get("start_date", ""),
            "End Date": sub.get("end_date", ""),
            "Total Fee": sub.get("total_fee", 0),
            "Currency": sub.get("currency", ""),
            "Payment Mode": sub.get("payment_mode", ""),
            "Number of EMIs": sub.get("num_emis", 0),
            "Individual Discount Pct": sub.get("individual_discount_pct", ""),
            "Individual Tax Pct": sub.get("individual_tax_pct", ""),
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
        row["Iris Year"] = sub.get("iris_year", 1)
        row["Iris Year Mode"] = sub.get("iris_year_mode", "manual")
        row["Iris Journey (effective)"] = resolve_iris_journey(sub).get("label", "")
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
        {"_id": 0, "id": 1, "name": 1, "email": 1, "label": 1, "subscription": 1, "awrp_batch_id": 1},
    ).to_list(5000)
    return clients


@router.get("/iris-journey-catalog")
async def get_iris_journey_catalog():
    """Canonical Year 1–12 labels for admin UI and docs."""
    return {"years": iris_journey_catalog()}


# ─── CREATE / UPDATE SUBSCRIBER (manual) ───

class EMIInput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    number: int
    date: str = ""
    amount: float = 0
    remaining: float = 0
    due_date: str = ""
    status: str = "pending"

class SessionsInput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    carry_forward: int = 0
    current: int = 0
    total: int = 0
    availed: int = 0
    yet_to_avail: int = 0
    due: int = 0
    scheduled_dates: List[str] = []

class ProgramDetail(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    duration_value: int = 0
    duration_unit: str = "months"
    start_date: str = ""
    end_date: str = ""
    status: str = "active"  # active | paused
    mode: str = "online"  # online | offline
    visible: bool = True
    allow_pause: bool = False  # admin toggle: allow student to pause this program
    pause_start: str = ""
    pause_end: str = ""
    pause_reason: str = ""
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
    # Per-subscriber UPI / bank instructions when payment_methods includes gpay or bank (see student dashboard + EMI modal)
    payment_destinations: Optional[Dict[str, Any]] = None  # { "gpay": [{id,label,upi_id}], "bank": [{id,label,account_name,...}] }
    # Tag to one row from Site Settings → India proof (india_gpay_accounts[].id or tag_id; bank uses same tag as admin UI)
    preferred_india_gpay_id: Optional[str] = ""
    preferred_india_bank_id: Optional[str] = ""
    # Optional overrides vs standard package catalog (same programs for everyone; pricing can differ per person)
    individual_discount_pct: Optional[float] = None  # extra % off line-offer subtotal; None = use package pkg discount
    individual_tax_pct: Optional[float] = None  # tax % for this subscriber (e.g. 18.0); None = use package tax for currency
    # Iris annual journey (access tier by year on the path). manual = fixed year; auto = from start_date anniversaries
    iris_year: int = 1
    iris_year_mode: str = "manual"  # "manual" | "auto"
    # Sacred Home portal cohort (Admin → Dashboard → AWRP batches); optional
    awrp_batch_id: Optional[str] = None


def _normalize_awrp_batch_id(v: Any) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    return s if s else None


def _normalize_iris_fields(data: SubscriberCreate) -> Dict[str, object]:
    mode = (data.iris_year_mode or "manual").strip().lower()
    if mode not in ("manual", "auto"):
        mode = "manual"
    try:
        y = int(data.iris_year)
    except (TypeError, ValueError):
        y = 1
    y = max(1, min(12, y))
    return {"iris_year": y, "iris_year_mode": mode}


def _emi_due_date_iso(start_yyyy_mm_dd: str, month_offset: int, emi_day: int) -> str:
    """Due month = start month + month_offset (same as Subscribers); day = min(emi_day, days in month).

    Iris Annual Abundance regenerations pass emi_day=27 so dues land on the 27th when the month allows.
    """
    if not start_yyyy_mm_dd or len(start_yyyy_mm_dd) < 10:
        return ""
    day = int(emi_day) if emi_day else 27
    if day < 1:
        day = 27
    try:
        y = int(start_yyyy_mm_dd[0:4])
        mo = int(start_yyyy_mm_dd[5:7])
        total_m = mo - 1 + month_offset
        y += total_m // 12
        m2 = total_m % 12 + 1
        dim = calendar.monthrange(y, m2)[1]
        d = min(day, dim)
        return f"{y:04d}-{m2:02d}-{d:02d}"
    except (ValueError, TypeError):
        return ""


def _regenerate_emi_schedule_inplace(sub: Dict[str, Any]) -> None:
    """Align EMI rows with payment_mode, num_emis, total_fee (preserve paid rows).

    Dues use the 27th of the month (clamped to month length). Optional ``installment_surcharge_percent``
    inflates the split total (e.g. quarterly / monthly plans) before dividing across EMIs.
    """
    pm = (sub.get("payment_mode") or "No EMI").strip()
    n = int(sub.get("num_emis") or 0)
    if pm != "EMI":
        sub["num_emis"] = 0
        sub["emis"] = []
        return
    n = max(0, min(12, n))
    sub["num_emis"] = n
    if n <= 0:
        sub["emis"] = []
        return
    fee = float(sub.get("total_fee") or 0)
    try:
        sur = float(sub.get("installment_surcharge_percent") or 0)
    except (TypeError, ValueError):
        sur = 0.0
    sur = max(0.0, min(100.0, sur))
    gross = round(fee * (1.0 + sur / 100.0), 2) if fee > 0 else 0.0
    start = (sub.get("start_date") or "").strip()[:10]
    emi_day_portal = 27
    sub["emi_day"] = emi_day_portal
    cents_total = int(round(gross * 100))
    base_cents = cents_total // n if n else 0
    extra = cents_total % n if n else 0
    installment_amounts: List[float] = []
    for i in range(n):
        c = base_cents + (1 if i < extra else 0)
        installment_amounts.append(round(c / 100.0, 2))
    old_list = list(sub.get("emis") or [])
    new_emis: List[Dict[str, Any]] = []
    for i in range(1, n + 1):
        ex = next((e for e in old_list if int(e.get("number") or 0) == i), None)
        if ex and str(ex.get("status", "")).lower() == "paid":
            new_emis.append(dict(ex))
            continue
        due = _emi_due_date_iso(start, i - 2, emi_day_portal)
        per_inst = installment_amounts[i - 1] if i <= len(installment_amounts) else 0.0
        merged = dict(ex) if ex else {}
        merged.update(
            {
                "number": i,
                "amount": per_inst,
                "due_date": due,
            }
        )
        if "date" not in merged:
            merged["date"] = ""
        if merged.get("remaining") is None:
            merged["remaining"] = 0
        if not merged.get("status"):
            merged["status"] = "due"
        new_emis.append(merged)
    sub["emis"] = new_emis


class AnnualPackageFieldsPatch(BaseModel):
    """Partial update for Iris annual subscriber package row (matches Subscribers tab fields)."""

    total_fee: Optional[float] = None
    currency: Optional[str] = None
    payment_mode: Optional[str] = None  # EMI | No EMI | Full Paid
    num_emis: Optional[int] = None
    iris_year: Optional[int] = None
    iris_year_mode: Optional[str] = None  # manual | auto
    # Extra % on base package fee before splitting across EMIs (quarterly / monthly plans).
    installment_surcharge_percent: Optional[float] = None


@router.patch("/annual-package/{client_id}")
async def patch_annual_package_fields(client_id: str, data: AnnualPackageFieldsPatch):
    """
    Update subscription package scalars for admin grids (e.g. Iris Annual Abundance inline edit).
    Regenerates EMI schedule when mode/count/fee change; preserves paid EMI rows.
    """
    client_doc = await db.clients.find_one({"id": client_id})
    if not client_doc:
        raise HTTPException(status_code=404, detail="Client not found")
    sub = dict(client_doc.get("subscription") or {})
    if not sub:
        asy = client_doc.get("annual_subscription") or {}
        if bool(client_doc.get("annual_member_dashboard")) or (
            (asy.get("start_date") or "").strip() or (asy.get("end_date") or "").strip()
        ):
            start_g = (asy.get("start_date") or "").strip()[:10]
            sub = {
                "currency": "INR",
                "total_fee": 0.0,
                "payment_mode": "No EMI",
                "num_emis": 0,
                "iris_year": 1,
                "iris_year_mode": "manual",
                "emis": [],
                "installment_surcharge_percent": 0.0,
            }
            if start_g:
                sub["start_date"] = start_g
            end_g = (asy.get("end_date") or "").strip()[:10]
            if end_g:
                sub["end_date"] = end_g
        else:
            raise HTTPException(
                status_code=400,
                detail="No subscription package on this client — enable Annual dashboard access or set Home Coming dates, or add a row in Subscribers.",
            )

    raw = data.model_dump(exclude_unset=True)
    if "currency" in raw:
        c = str(raw["currency"] or "").strip().upper()
        if c:
            sub["currency"] = c
            sub["display_currency"] = c
    if "total_fee" in raw:
        tf = raw["total_fee"]
        if tf is None:
            sub["total_fee"] = 0
        else:
            sub["total_fee"] = max(0.0, float(tf))
    if "payment_mode" in raw:
        pm = str(raw["payment_mode"] or "").strip()
        allowed = {"EMI", "No EMI", "Full Paid"}
        if pm not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"payment_mode must be one of: {', '.join(sorted(allowed))}",
            )
        sub["payment_mode"] = pm
    if "num_emis" in raw:
        ne = raw["num_emis"]
        if ne is None:
            sub["num_emis"] = 0
        else:
            sub["num_emis"] = max(0, min(12, int(ne)))
    if "iris_year" in raw:
        iy = raw["iris_year"]
        if iy is None:
            sub["iris_year"] = 1
        else:
            sub["iris_year"] = max(1, min(12, int(iy)))
    if "iris_year_mode" in raw:
        m = str(raw["iris_year_mode"] or "").strip().lower()
        if m not in ("manual", "auto"):
            raise HTTPException(status_code=400, detail="iris_year_mode must be manual or auto")
        sub["iris_year_mode"] = m
    if "installment_surcharge_percent" in raw:
        sp = raw["installment_surcharge_percent"]
        if sp is None:
            sub["installment_surcharge_percent"] = 0.0
        else:
            sub["installment_surcharge_percent"] = max(0.0, min(100.0, float(sp)))

    _regenerate_emi_schedule_inplace(sub)
    now = datetime.now(timezone.utc).isoformat()
    sub["updated_at"] = now
    await db.clients.update_one(
        {"id": client_id},
        {"$set": {"subscription": sub, "updated_at": now}},
    )
    return {"subscription": sub}


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
        "payment_destinations": data.payment_destinations if data.payment_destinations is not None else {},
        "preferred_india_gpay_id": (data.preferred_india_gpay_id or "").strip(),
        "preferred_india_bank_id": (data.preferred_india_bank_id or "").strip(),
        "individual_discount_pct": data.individual_discount_pct,
        "individual_tax_pct": data.individual_tax_pct,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        **_normalize_iris_fields(data),
    }

    # Check if client exists
    existing = None
    if data.email:
        existing = await db.clients.find_one({"email": data.email.lower()})
    if not existing and data.name:
        existing = await db.clients.find_one({"name": {"$regex": f"^{data.name}$", "$options": "i"}})

    if existing:
        raw_nm = str(data.name or "").strip()
        set_nm = normalize_person_name(raw_nm) if raw_nm else (existing.get("name") or "")
        await db.clients.update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    "subscription": subscription,
                    "name": set_nm,
                    "awrp_batch_id": _normalize_awrp_batch_id(data.awrp_batch_id),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        )
        return {"message": "Subscriber updated", "id": existing["id"]}
    else:
        _now = datetime.now(timezone.utc).isoformat()
        client_id = new_entity_id()
        disp_nm = normalize_person_name(str(data.name or "").strip())
        new_client = {
            "id": client_id,
            "did": f"DID-{str(uuid.uuid4())[:8].upper()}",
            "diid": new_internal_diid(disp_nm or "", _now),
            "email": data.email.lower() if data.email else "",
            "name": disp_nm,
            "phone": "",
            "label": iris_label_for_year(1),
            "label_manual": iris_label_for_year(1),
            "sources": ["Admin Manual"],
            "conversions": [],
            "timeline": [{"type": "Admin Manual", "detail": f"Annual: {data.annual_program}", "date": _now}],
            "subscription": subscription,
            "notes": "",
            "awrp_batch_id": _normalize_awrp_batch_id(data.awrp_batch_id),
            "created_at": _now,
            "updated_at": _now,
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
        "payment_destinations": data.payment_destinations if data.payment_destinations is not None else {},
        "preferred_india_gpay_id": (data.preferred_india_gpay_id or "").strip(),
        "preferred_india_bank_id": (data.preferred_india_bank_id or "").strip(),
        "individual_discount_pct": data.individual_discount_pct,
        "individual_tax_pct": data.individual_tax_pct,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        **_normalize_iris_fields(data),
    }

    update_fields = {
        "subscription": subscription,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "awrp_batch_id": _normalize_awrp_batch_id(data.awrp_batch_id),
    }
    if data.name:
        update_fields["name"] = normalize_person_name(str(data.name).strip())
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
