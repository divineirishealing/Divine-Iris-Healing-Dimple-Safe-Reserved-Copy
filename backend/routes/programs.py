from fastapi import APIRouter, File, HTTPException, UploadFile
from models import Program, ProgramCreate
from typing import List, Optional

from utils.docx_import import (
    build_draft_sections_from_docx,
    build_draft_sections_from_text,
    docx_bytes_to_text,
    finalize_document_only_sections,
    merge_live_preserved_sections,
)
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

from datetime import datetime, timezone

router = APIRouter(prefix="/api/programs", tags=["Programs"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Mirrors public homepage sort (UpcomingProgramsSection.jsx): open → coming_soon → closed, then admin `order`.
_STATUS_ORDER_HOME = {"open": 0, "coming_soon": 1, "closed": 2}


def _deadline_to_utc_aware(deadline) -> datetime | None:
    """Parse program deadline for comparison with UTC now. Date-only → end of that day UTC."""
    if not deadline:
        return None
    s = str(deadline).strip()
    if "T" not in s:
        try:
            day = s[:10]
            return datetime.fromisoformat(day + "T23:59:59+00:00")
        except ValueError:
            return None
    s = s.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(s)
    except (ValueError, TypeError):
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _program_status_rank(prog: Program) -> int:
    raw = (prog.enrollment_status or "").strip().lower()
    if raw in _STATUS_ORDER_HOME:
        return _STATUS_ORDER_HOME[raw]
    fallback = "open" if prog.enrollment_open is not False else "closed"
    return _STATUS_ORDER_HOME.get(fallback, 1)


def sort_programs_like_homepage(programs: List[Program]) -> List[Program]:
    return sorted(programs, key=lambda p: (_program_status_rank(p), p.order))


async def program_dict_with_deadline_sync(db_ref, program_id: str) -> Optional[dict]:
    """Load one program by id, apply the same enrollment deadline auto-close as the public list. Returns model_dump or None."""
    raw = await db_ref.programs.find_one({"id": program_id}, {"_id": 0})
    if not raw:
        return None
    prog = Program(**raw)
    now = datetime.now(timezone.utc)
    deadline = raw.get("deadline_date") or raw.get("start_date") or ""
    if deadline and prog.enrollment_status == "open":
        dl = _deadline_to_utc_aware(deadline)
        if dl is not None and dl < now:
            prog = prog.model_copy(
                update={
                    "enrollment_status": "closed",
                    "enrollment_open": False,
                    "closure_text": prog.closure_text or "Registration Closed",
                }
            )
            await db_ref.programs.update_one(
                {"id": prog.id},
                {"$set": {"enrollment_status": "closed", "enrollment_open": False}},
            )
    return prog.model_dump()


async def fetch_programs_with_deadline_sync(
    db_ref,
    visible_only: Optional[bool] = None,
    upcoming_only: Optional[bool] = None,
    blueprint_only: Optional[bool] = None,
) -> List[Program]:
    """Load programs from Mongo, apply the same deadline auto-close as the public API, optionally persist."""
    query = {}
    if visible_only:
        query["visible"] = True
    if upcoming_only:
        query["is_upcoming"] = True
    if blueprint_only:
        query["is_blueprint_immersion"] = True
    raw_list = await db_ref.programs.find(query).sort("order", 1).to_list(100)
    now = datetime.now(timezone.utc)
    result: List[Program] = []
    for p in raw_list:
        prog = Program(**p)
        deadline = p.get("deadline_date") or p.get("start_date") or ""
        if deadline and prog.enrollment_status == "open":
            dl = _deadline_to_utc_aware(deadline)
            if dl is not None and dl < now:
                prog = prog.model_copy(update={
                    "enrollment_status": "closed",
                    "enrollment_open": False,
                    "closure_text": prog.closure_text or "Registration Closed",
                })
                await db_ref.programs.update_one(
                    {"id": prog.id},
                    {"$set": {"enrollment_status": "closed", "enrollment_open": False}},
                )
        result.append(prog)
    return result


@router.get("", response_model=List[Program])
async def get_programs(visible_only: Optional[bool] = None, upcoming_only: Optional[bool] = None, blueprint_only: Optional[bool] = None):
    return await fetch_programs_with_deadline_sync(db, visible_only, upcoming_only, blueprint_only)

@router.get("/{program_id}", response_model=Program)
async def get_program(program_id: str):
    program = await db.programs.find_one({"id": program_id})
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    return Program(**program)

@router.post("", response_model=Program)
async def create_program(program: ProgramCreate):
    count = await db.programs.count_documents({})
    data = program.dict()
    data.pop("order", None)  # Remove order from input to use count
    program_obj = Program(**data, order=count)
    await db.programs.insert_one(program_obj.dict())
    return program_obj

@router.put("/{program_id}", response_model=Program)
async def update_program(program_id: str, program: ProgramCreate):
    existing = await db.programs.find_one({"id": program_id})
    if not existing:
        # Upsert: create the program if it doesn't exist
        count = await db.programs.count_documents({})
        data = program.dict()
        data["id"] = program_id
        program_obj = Program(**data, order=data.get("order", count))
        await db.programs.insert_one(program_obj.dict())
        return program_obj
    update_data = program.dict(exclude_unset=True)
    await db.programs.update_one({"id": program_id}, {"$set": update_data})
    updated = await db.programs.find_one({"id": program_id})
    return Program(**updated)

@router.post("/{program_id}/import-docx")
async def import_docx_for_program(program_id: str, file: UploadFile = File(...)):
    """Parse a .docx and save draft_content_sections on this program only."""
    existing = await db.programs.find_one({"id": program_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Program not found")
    name = (file.filename or "").lower()
    if not name.endswith(".docx"):
        raise HTTPException(status_code=400, detail="Please upload a .docx file (Word: Save As → Word Document .docx)")
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="File is empty")
    if len(raw) > 15 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 15 MB)")
    try:
        sections = build_draft_sections_from_docx(raw, existing.get("content_sections"))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read document: {exc}") from exc
    now = datetime.now(timezone.utc).isoformat()
    await db.programs.update_one(
        {"id": program_id},
        {"$set": {
            "draft_content_sections": sections,
            "draft_import_filename": file.filename or "",
            "draft_import_at": now,
        }},
    )
    content_count = sum(1 for s in sections if (s.get("body") or "").strip())
    return {
        "program_id": program_id,
        "draft_content_sections": sections,
        "section_count": len(sections),
        "content_section_count": content_count,
        "filename": file.filename,
        "draft_import_filename": file.filename or "",
        "draft_import_at": now,
    }


@router.post("/import-docx")
async def import_docx_draft(file: UploadFile = File(...)):
    """Parse a .docx file into draft_content_sections (preview only — prefer /{program_id}/import-docx)."""
    name = (file.filename or "").lower()
    if not name.endswith(".docx"):
        raise HTTPException(status_code=400, detail="Please upload a .docx file")
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="File is empty")
    if len(raw) > 15 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 15 MB)")
    try:
        sections = build_draft_sections_from_docx(raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read document: {exc}") from exc
    content_count = sum(1 for s in sections if (s.get("body") or "").strip())
    return {
        "draft_content_sections": sections,
        "section_count": len(sections),
        "content_section_count": content_count,
        "filename": file.filename,
    }


@router.patch("/{program_id}/draft-content")
async def save_draft_content(program_id: str, data: dict):
    """Save draft content sections without touching the live content_sections."""
    existing = await db.programs.find_one({"id": program_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Program not found")
    sections = data.get("draft_content_sections", [])
    patch: dict = {"draft_content_sections": sections}
    if "draft_import_filename" in data:
        patch["draft_import_filename"] = data.get("draft_import_filename") or ""
    if "draft_import_at" in data:
        patch["draft_import_at"] = data.get("draft_import_at") or ""
    await db.programs.update_one({"id": program_id}, {"$set": patch})
    return {"message": "Draft saved", "draft_content_sections": sections}


@router.delete("/{program_id}/draft-content")
async def clear_draft_content(program_id: str):
    """Remove staged draft for one program (live content_sections unchanged)."""
    existing = await db.programs.find_one({"id": program_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Program not found")
    await db.programs.update_one(
        {"id": program_id},
        {"$set": {
            "draft_content_sections": [],
            "draft_import_filename": "",
            "draft_import_at": "",
        }},
    )
    return {"message": "Draft cleared", "program_id": program_id}

@router.post("/{program_id}/publish-draft")
async def publish_draft_content(program_id: str):
    """Copy draft_content_sections → content_sections (goes live on the website)."""
    existing = await db.programs.find_one({"id": program_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Program not found")
    draft = existing.get("draft_content_sections", [])
    if not draft:
        raise HTTPException(status_code=400, detail="No draft content to publish")
    live = existing.get("content_sections", [])
    draft = merge_live_preserved_sections(draft, live)
    draft = finalize_document_only_sections(draft)
    await db.programs.update_one({"id": program_id}, {"$set": {"content_sections": draft}})
    return {"message": "Draft published to live", "content_sections": draft}

@router.patch("/{program_id}/visibility")
async def toggle_visibility(program_id: str, data: dict):
    existing = await db.programs.find_one({"id": program_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Program not found")
    await db.programs.update_one({"id": program_id}, {"$set": {"visible": data.get("visible", True)}})
    return {"message": "Visibility updated", "visible": data.get("visible", True)}

@router.patch("/reorder")
async def reorder_programs(data: dict):
    order_list = data.get("order", [])
    for idx, program_id in enumerate(order_list):
        await db.programs.update_one({"id": program_id}, {"$set": {"order": idx}})
    return {"message": "Programs reordered successfully"}

@router.delete("/{program_id}")
async def delete_program(program_id: str):
    result = await db.programs.delete_one({"id": program_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Program not found")
    return {"message": "Program deleted successfully"}
