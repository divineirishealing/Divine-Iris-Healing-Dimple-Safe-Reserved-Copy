from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import os
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/api/clients", tags=["Clients"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Label hierarchy (garden journey)
LABELS = ["Dew", "Seed", "Root", "Bloom", "Iris", "Purple Bees", "Iris Bees"]
LABEL_DESCRIPTIONS = {
    "Dew": "Inquired or expressed interest",
    "Seed": "Joined a workshop",
    "Root": "Converted to a flagship program",
    "Bloom": "Enrolled in multiple programs or repeat client",
    "Iris": "Annual Program Subscriber",
    "Purple Bees": "Soulful referral partner",
    "Iris Bees": "Brand Ambassador",
}


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def normalize_phone(phone: str) -> str:
    return (phone or "").strip().replace(" ", "").replace("-", "")


def enrollment_counts_as_paid_conversion(enrollment: Dict[str, Any], txs_for_enrollment: List[dict]) -> bool:
    """
    A conversion is recorded only after the payment/checkout loop succeeds.
    Enrollments move to status 'completed' when Stripe (or webhook), free checkout,
    or India manual proof flow finishes; we also require a paid transaction when one exists.
    """
    if (enrollment.get("status") or "").strip().lower() != "completed":
        return False
    if txs_for_enrollment:
        return any(str(t.get("payment_status", "")).strip().lower() == "paid" for t in txs_for_enrollment)
    # Legacy completed rows with no transaction document — still count if marked paid/free on enrollment
    return bool(enrollment.get("paid_at")) or bool(enrollment.get("is_free"))


async def compute_label(client_doc: dict) -> str:
    """
    Auto-label from paid conversions only (see sync). Manual garden label always wins.

    - No manual override and zero paid-program conversions → Dew (leads, first-time,
      or checkout not finished).
    - With conversions, stage advances (Seed → Root → Bloom / Iris) from program data.
    """
    lm = (client_doc.get("label_manual") or "").strip()
    if lm:
        return lm

    conversions = client_doc.get("conversions", [])
    if not conversions:
        return "Dew"

    flagship_count = sum(1 for c in conversions if c.get("is_flagship"))
    workshop_count = sum(1 for c in conversions if not c.get("is_flagship"))
    total = len(conversions)

    # Check for annual subscription (Iris) - any program with "annual" in tier
    has_annual = any(
        "annual" in (c.get("tier_label", "") or "").lower()
        or (c.get("duration_unit", "") == "year")
        for c in conversions
    )
    if has_annual:
        return "Iris"
    if total >= 3 or (flagship_count >= 1 and workshop_count >= 1):
        return "Bloom"
    if flagship_count >= 1:
        return "Root"
    if workshop_count >= 1 or total >= 1:
        return "Seed"
    return "Dew"


# ========== SYNC / BACKFILL ==========

@router.post("/sync")
async def sync_clients():
    """Backfill/sync client data from contacts, interests, questions; enrollments count as conversions only after paid checkout."""
    stats = {"new_clients": 0, "updated": 0, "total_sources_scanned": 0, "conversions_pruned_clients": 0}

    # Helper to upsert a client
    async def upsert_client(email: str, phone: str = "", name: str = "", source: str = "", source_detail: str = "", source_date: str = ""):
        email = normalize_email(email)
        phone = normalize_phone(phone)
        if not email and not phone:
            return

        # Find existing by email or phone
        query = []
        if email:
            query.append({"email": email})
        if phone:
            query.append({"phone": phone})
        existing = await db.clients.find_one({"$or": query}) if query else None

        now = datetime.now(timezone.utc).isoformat()
        timeline_entry = {
            "type": source,
            "detail": source_detail,
            "date": source_date or now,
        }

        if existing:
            update = {"$addToSet": {"timeline": timeline_entry, "sources": source}}
            if name and not existing.get("name"):
                update["$set"] = {"name": name}
            if phone and not existing.get("phone"):
                update.setdefault("$set", {})["phone"] = phone
            await db.clients.update_one({"id": existing["id"]}, update)
            stats["updated"] += 1
        else:
            # Generate DID for new clients (first-time joiners)
            did = f"DID-{str(uuid.uuid4())[:8].upper()}"
            client_doc = {
                "id": str(uuid.uuid4()),
                "did": did,
                "email": email,
                "phone": phone,
                "name": name,
                "label": "Dew",
                "label_manual": "",
                "sources": [source],
                "conversions": [],
                "timeline": [timeline_entry],
                "notes": "",
                "created_at": now,
                "updated_at": now,
            }
            await db.clients.insert_one(client_doc)
            stats["new_clients"] += 1

    # 1. Contact form submissions
    contacts = await db.quote_requests.find({}, {"_id": 0}).to_list(2000)
    for c in contacts:
        await upsert_client(
            email=c.get("email", ""),
            phone=c.get("phone", ""),
            name=c.get("name", ""),
            source="Contact Form",
            source_detail=c.get("message", "")[:100],
            source_date=c.get("created_at", ""),
        )
    stats["total_sources_scanned"] += len(contacts)

    # 2. Express your interest
    interests = await db.notify_me.find({}, {"_id": 0}).to_list(2000)
    for i in interests:
        await upsert_client(
            email=i.get("email", ""),
            name=i.get("name", ""),
            source="Express Interest",
            source_detail=i.get("program_title", ""),
            source_date=i.get("created_at", ""),
        )
    stats["total_sources_scanned"] += len(interests)

    # 3. Questions
    questions = await db.session_questions.find({}, {"_id": 0}).to_list(2000)
    for q in questions:
        await upsert_client(
            email=q.get("email", ""),
            name=q.get("name", ""),
            source="Question",
            source_detail=q.get("question", "")[:100],
            source_date=q.get("created_at", ""),
        )
    stats["total_sources_scanned"] += len(questions)

    # 4. Enrollments + Payment Transactions (the conversion data)
    # First build a map of stripe_session_id -> transaction for item_title lookup
    transactions = await db.payment_transactions.find({}, {"_id": 0}).to_list(5000)
    tx_by_enrollment = {}
    for tx in transactions:
        eid = tx.get("enrollment_id", "")
        if eid:
            tx_by_enrollment.setdefault(eid, []).append(tx)

    enrollments = await db.enrollments.find({}, {"_id": 0}).to_list(2000)
    programs_cache = {}
    all_programs = await db.programs.find({}, {"_id": 0}).to_list(100)
    for p in all_programs:
        programs_cache[p["id"]] = p

    sessions_cache = {}
    all_sessions = await db.sessions.find({}, {"_id": 0}).to_list(100)
    for ss in all_sessions:
        sessions_cache[ss["id"]] = ss

    paid_conversion_enrollment_ids = {
        e["id"]
        for e in enrollments
        if enrollment_counts_as_paid_conversion(e, tx_by_enrollment.get(e.get("id", ""), []))
    }

    for e in enrollments:
        email = normalize_email(e.get("booker_email", ""))
        phone = normalize_phone(e.get("booker_phone", ""))
        if not email:
            continue

        enrollment_txs = tx_by_enrollment.get(e.get("id", ""), [])
        if not enrollment_counts_as_paid_conversion(e, enrollment_txs):
            continue

        program_id = e.get("program_id", "") or e.get("selected_program_id", "")
        session_id = e.get("session_id", "") or e.get("selected_session_id", "")
        program = programs_cache.get(program_id, {})

        # Try to get title from transaction data first
        program_title = ""
        if enrollment_txs:
            program_title = enrollment_txs[0].get("item_title", "")
            if not program_id:
                program_id = enrollment_txs[0].get("item_id", "")
                program = programs_cache.get(program_id, {})

        if not program_title:
            program_title = e.get("program_title", "") or e.get("selected_program_title", "") or program.get("title", "")
        if not program_title and session_id:
            program_title = sessions_cache.get(session_id, {}).get("title", "")

        is_flagship = program.get("is_flagship", False)
        status = e.get("status", "") or "completed"

        # Find or create client
        query = [{"email": email}]
        if phone:
            query.append({"phone": phone})
        existing = await db.clients.find_one({"$or": query})

        conversion_entry = {
            "enrollment_id": e.get("id", ""),
            "program_id": program_id,
            "program_title": program_title,
            "is_flagship": is_flagship,
            "status": status,
            "item_type": e.get("item_type", ""),
            "tier_label": e.get("tier_label", ""),
            "duration_unit": e.get("duration_unit", ""),
            "date": e.get("paid_at") or e.get("updated_at") or e.get("created_at", ""),
        }
        timeline_entry = {
            "type": "Enrollment (paid)",
            "detail": f"{program_title} — payment complete",
            "date": e.get("paid_at") or e.get("updated_at") or e.get("created_at", ""),
        }

        if existing:
            # Check if this enrollment already tracked
            existing_enrollment_ids = [c.get("enrollment_id") for c in existing.get("conversions", [])]
            if e.get("id") not in existing_enrollment_ids:
                await db.clients.update_one(
                    {"id": existing["id"]},
                    {
                        "$push": {"conversions": conversion_entry, "timeline": timeline_entry},
                        "$addToSet": {"sources": "Enrollment"},
                    }
                )
            # Update name/phone if missing
            update_set = {}
            if e.get("booker_name") and not existing.get("name"):
                update_set["name"] = e["booker_name"]
            if phone and not existing.get("phone"):
                update_set["phone"] = phone
            if update_set:
                await db.clients.update_one({"id": existing["id"]}, {"$set": update_set})
        else:
            did = f"DID-{str(uuid.uuid4())[:8].upper()}"
            now = datetime.now(timezone.utc).isoformat()
            client_doc = {
                "id": str(uuid.uuid4()),
                "did": did,
                "email": email,
                "phone": phone,
                "name": e.get("booker_name", ""),
                "label": "Dew",
                "label_manual": "",
                "sources": ["Enrollment"],
                "conversions": [conversion_entry],
                "timeline": [timeline_entry],
                "notes": "",
                "created_at": now,
                "updated_at": now,
            }
            await db.clients.insert_one(client_doc)
            stats["new_clients"] += 1

    stats["total_sources_scanned"] += len(enrollments)

    # 4b Remove conversion rows for enrollments that never finished payment
    all_for_prune = await db.clients.find({}, {"_id": 0, "id": 1, "conversions": 1}).to_list(5000)
    for cl in all_for_prune:
        convs = cl.get("conversions") or []
        if not convs:
            continue

        filtered = [
            c
            for c in convs
            if (not c.get("enrollment_id")) or (c.get("enrollment_id") in paid_conversion_enrollment_ids)
        ]
        if len(filtered) != len(convs):
            await db.clients.update_one(
                {"id": cl["id"]},
                {"$set": {"conversions": filtered, "updated_at": datetime.now(timezone.utc).isoformat()}},
            )
            stats["conversions_pruned_clients"] += 1

    # 5. Now recompute labels for all clients
    all_clients = await db.clients.find({}, {"_id": 0}).to_list(5000)
    for cl in all_clients:
        new_label = await compute_label(cl)
        if new_label != cl.get("label"):
            await db.clients.update_one({"id": cl["id"]}, {"$set": {"label": new_label, "updated_at": datetime.now(timezone.utc).isoformat()}})
            stats["updated"] += 1

    return {"message": "Sync complete", "stats": stats}


# ========== LIST / SEARCH ==========

@router.get("")
async def list_clients(label: Optional[str] = None, search: Optional[str] = None, intake_pending: Optional[str] = None):
    query = {}
    if label:
        query["label"] = label
    if intake_pending == "true":
        query["intake_pending"] = True
    if search:
        search_regex = {"$regex": search, "$options": "i"}
        query["$or"] = [
            {"name": search_regex},
            {"email": search_regex},
            {"phone": search_regex},
        ]
    clients_list = await db.clients.find(query, {"_id": 0}).sort("updated_at", -1).to_list(1000)
    return clients_list


class ClientManualCreate(BaseModel):
    """Create a single client from Client Garden (trial / manual entry)."""
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    label_manual: Optional[str] = None  # empty = auto Dew


@router.post("")
async def create_client_manual(data: ClientManualCreate):
    """Manually add a client. Requires name and at least one of email or phone."""
    name = (data.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")

    email_n = normalize_email(data.email or "")
    phone_n = normalize_phone(data.phone or "")
    if not email_n and not phone_n:
        raise HTTPException(status_code=400, detail="Provide at least an email or a phone number")

    label_manual = (data.label_manual or "").strip()
    if label_manual and label_manual not in LABELS:
        raise HTTPException(status_code=400, detail=f"Invalid label. Use one of: {', '.join(LABELS)}")

    dup_query = []
    if email_n:
        dup_query.append({"email": email_n})
    if phone_n:
        dup_query.append({"phone": phone_n})
    existing = await db.clients.find_one({"$or": dup_query})
    if existing:
        raise HTTPException(
            status_code=409,
            detail="A client with this email or phone already exists",
        )

    now = datetime.now(timezone.utc).isoformat()
    did = f"DID-{str(uuid.uuid4())[:8].upper()}"
    cid = str(uuid.uuid4())
    initial_label = label_manual if label_manual else "Dew"
    timeline_entry = {
        "type": "Manual",
        "detail": "Added from Client Garden",
        "date": now,
    }
    client_doc = {
        "id": cid,
        "did": did,
        "email": email_n,
        "phone": phone_n,
        "name": name,
        "label": initial_label,
        "label_manual": label_manual,
        "sources": ["Manual"],
        "conversions": [],
        "timeline": [timeline_entry],
        "notes": (data.notes or "").strip(),
        "created_at": now,
        "updated_at": now,
        "portal_login_allowed": True,
    }
    await db.clients.insert_one(client_doc)

    if not label_manual:
        new_label = await compute_label(client_doc)
        if new_label != initial_label:
            await db.clients.update_one({"id": cid}, {"$set": {"label": new_label, "updated_at": now}})

    return {"message": "Client created", "id": cid}


@router.get("/stats")
async def client_stats():
    pipeline = [
        {"$group": {"_id": "$label", "count": {"$sum": 1}}},
    ]
    results = await db.clients.aggregate(pipeline).to_list(20)
    label_counts = {r["_id"]: r["count"] for r in results}
    total = sum(label_counts.values())
    return {"total": total, "by_label": label_counts}


@router.get("/{client_id}")
async def get_client(client_id: str):
    cl = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not cl:
        raise HTTPException(status_code=404, detail="Client not found")
    return cl


# ========== UPDATE ==========

class ClientUpdate(BaseModel):
    label_manual: Optional[str] = None
    notes: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    immediate_family_editing_approved: Optional[bool] = None
    """When False, Google / student portal sign-in is blocked until set to True."""
    portal_login_allowed: Optional[bool] = None
    india_tax_enabled: Optional[bool] = None
    india_tax_percent: Optional[float] = None
    india_tax_label: Optional[str] = None
    india_tax_visible_on_dashboard: Optional[bool] = None
    india_payment_method: Optional[str] = None   # e.g. "gpay", "upi", "bank_transfer", "any"
    india_discount_percent: Optional[float] = None  # client-specific discount on base price
    intake_pending: Optional[bool] = None
    family_pending_review: Optional[bool] = None
    family_approved: Optional[bool] = None        # once True, list is permanently frozen


@router.put("/{client_id}")
async def update_client(client_id: str, data: ClientUpdate):
    cl = await db.clients.find_one({"id": client_id})
    if not cl:
        raise HTTPException(status_code=404, detail="Client not found")

    update_fields = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.label_manual is not None:
        lm = (data.label_manual or "").strip()
        update_fields["label_manual"] = lm
        if lm:
            update_fields["label"] = lm
    if data.notes is not None:
        update_fields["notes"] = data.notes
    if data.name is not None:
        update_fields["name"] = data.name
    if data.phone is not None:
        update_fields["phone"] = data.phone
    if data.immediate_family_editing_approved is not None:
        update_fields["immediate_family_editing_approved"] = bool(data.immediate_family_editing_approved)
    if data.portal_login_allowed is not None:
        update_fields["portal_login_allowed"] = bool(data.portal_login_allowed)
    if data.india_tax_enabled is not None:
        update_fields["india_tax_enabled"] = bool(data.india_tax_enabled)
    if data.india_tax_percent is not None:
        update_fields["india_tax_percent"] = float(data.india_tax_percent)
    if data.india_tax_label is not None:
        update_fields["india_tax_label"] = data.india_tax_label
    if data.india_tax_visible_on_dashboard is not None:
        update_fields["india_tax_visible_on_dashboard"] = bool(data.india_tax_visible_on_dashboard)
    if data.india_payment_method is not None:
        update_fields["india_payment_method"] = data.india_payment_method
    if data.india_discount_percent is not None:
        update_fields["india_discount_percent"] = float(data.india_discount_percent)
    if data.intake_pending is not None:
        update_fields["intake_pending"] = bool(data.intake_pending)
    if data.family_pending_review is not None:
        update_fields["family_pending_review"] = bool(data.family_pending_review)
    if data.family_approved is not None:
        update_fields["family_approved"] = bool(data.family_approved)
        if data.family_approved:
            # Approve & Freeze: lock the list, clear pending flag, revoke any re-edit approval
            update_fields["immediate_family_locked"] = True
            update_fields["family_pending_review"] = False
            update_fields["immediate_family_editing_approved"] = False

    await db.clients.update_one({"id": client_id}, {"$set": update_fields})

    # Back to automatic rules (usually Dew until paid conversions) when override cleared
    if data.label_manual is not None and not (data.label_manual or "").strip():
        updated = await db.clients.find_one({"id": client_id}, {"_id": 0})
        new_label = await compute_label(updated)
        await db.clients.update_one({"id": client_id}, {"$set": {"label": new_label}})

    return {"message": "Updated"}


# ========== DELETE ==========

@router.delete("/{client_id}")
async def delete_client(client_id: str):
    result = await db.clients.delete_one({"id": client_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    return {"message": "Deleted"}


# ========== DOWNLOAD ==========

@router.get("/export/csv")
async def export_clients_excel():
    import io
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from fastapi.responses import StreamingResponse

    clients_list = await db.clients.find({}, {"_id": 0}).sort("label", 1).to_list(5000)

    wb = Workbook()
    ws = wb.active
    ws.title = "Client Garden"

    headers = ["DID", "Label", "Name", "Email", "Phone", "Sources", "Programs Enrolled", "Total Conversions", "First Contact", "Last Updated", "Notes"]
    header_font = Font(bold=True, color="FFFFFF", size=11)
    header_fill = PatternFill(start_color="1A1A1A", end_color="1A1A1A", fill_type="solid")
    thin_border = Border(bottom=Side(style="thin", color="E8E0C8"))

    label_fills = {
        "Dew": PatternFill(start_color="E0F2FE", end_color="E0F2FE", fill_type="solid"),
        "Seed": PatternFill(start_color="ECFCCB", end_color="ECFCCB", fill_type="solid"),
        "Root": PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid"),
        "Bloom": PatternFill(start_color="FCE7F3", end_color="FCE7F3", fill_type="solid"),
        "Iris": PatternFill(start_color="F3E8FF", end_color="F3E8FF", fill_type="solid"),
        "Purple Bees": PatternFill(start_color="EDE9FE", end_color="EDE9FE", fill_type="solid"),
        "Iris Bees": PatternFill(start_color="FEF9C3", end_color="FEF9C3", fill_type="solid"),
    }

    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")

    for idx, cl in enumerate(clients_list, 2):
        programs = ", ".join(set(c.get("program_title", "") for c in cl.get("conversions", []) if c.get("program_title")))
        sources = ", ".join(set(cl.get("sources", [])))
        label = cl.get("label", "Dew")
        row_data = [cl.get("did", ""), label, cl.get("name", ""), cl.get("email", ""), cl.get("phone", ""), sources, programs, len(cl.get("conversions", [])), cl.get("created_at", ""), cl.get("updated_at", ""), cl.get("notes", "")]

        fill = label_fills.get(label, PatternFill())
        for col, val in enumerate(row_data, 1):
            cell = ws.cell(row=idx, column=col, value=str(val) if val else "")
            cell.fill = fill
            cell.border = thin_border

    col_widths = [14, 12, 20, 30, 18, 25, 40, 16, 22, 22, 30]
    for i, w in enumerate(col_widths):
        ws.column_dimensions[ws.cell(row=1, column=i + 1).column_letter].width = w

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M")

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=divine_iris_clients_{timestamp}.xlsx"}
    )
