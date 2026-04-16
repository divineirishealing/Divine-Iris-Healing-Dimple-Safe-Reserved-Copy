from fastapi import APIRouter, HTTPException
from models import Program, ProgramCreate
from typing import List, Optional
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


def _program_status_rank(prog: Program) -> int:
    raw = (prog.enrollment_status or "").strip().lower()
    if raw in _STATUS_ORDER_HOME:
        return _STATUS_ORDER_HOME[raw]
    fallback = "open" if prog.enrollment_open is not False else "closed"
    return _STATUS_ORDER_HOME.get(fallback, 1)


def sort_programs_like_homepage(programs: List[Program]) -> List[Program]:
    return sorted(programs, key=lambda p: (_program_status_rank(p), p.order))


async def fetch_programs_with_deadline_sync(
    db_ref,
    visible_only: Optional[bool] = None,
    upcoming_only: Optional[bool] = None,
) -> List[Program]:
    """Load programs from Mongo, apply the same deadline auto-close as the public API, optionally persist."""
    query = {}
    if visible_only:
        query["visible"] = True
    if upcoming_only:
        query["is_upcoming"] = True
    raw_list = await db_ref.programs.find(query).sort("order", 1).to_list(100)
    now = datetime.now(timezone.utc)
    result: List[Program] = []
    for p in raw_list:
        prog = Program(**p)
        deadline = p.get("deadline_date") or p.get("start_date") or ""
        if deadline and prog.enrollment_status == "open":
            try:
                dl = datetime.fromisoformat(deadline + "T23:59:59+00:00") if "T" not in deadline else datetime.fromisoformat(deadline)
                if dl < now:
                    prog = prog.model_copy(update={
                        "enrollment_status": "closed",
                        "enrollment_open": False,
                        "closure_text": prog.closure_text or "Registration Closed",
                    })
                    await db_ref.programs.update_one(
                        {"id": prog.id},
                        {"$set": {"enrollment_status": "closed", "enrollment_open": False}},
                    )
            except (ValueError, TypeError):
                pass
        result.append(prog)
    return result


@router.get("", response_model=List[Program])
async def get_programs(visible_only: Optional[bool] = None, upcoming_only: Optional[bool] = None):
    return await fetch_programs_with_deadline_sync(db, visible_only, upcoming_only)

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
