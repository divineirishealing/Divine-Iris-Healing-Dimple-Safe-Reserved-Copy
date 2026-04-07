from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from dotenv import load_dotenv
from pathlib import Path
from .auth import get_current_user
from models_extended import JourneyLog
from iris_journey import resolve_iris_journey

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/api/student", tags=["Student Dashboard"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

def _merge_global_schedule_into_programs(programs_list: List[dict], global_programs: List[dict]) -> List[dict]:
    """Attach dates from admin program schedule (same merge as subscribers sync)."""
    if not global_programs or not programs_list:
        return programs_list
    merged_out = []
    for local_prog in programs_list:
        gp = next((g for g in global_programs if g.get("name") == local_prog.get("name")), None)
        if not gp:
            merged_out.append(local_prog)
            continue
        old_sched = local_prog.get("schedule") or []
        old_sched_map = {
            (s.get("month") or s.get("session", 0)): s for s in old_sched
        }
        new_sched = []
        for gs in gp.get("schedule", []):
            key = gs.get("month") or gs.get("session", 0)
            old = old_sched_map.get(key, {})
            new_sched.append({**gs, "mode_choice": old.get("mode_choice", gs.get("mode_choice", ""))})
        merged_out.append({**local_prog, "schedule": new_sched})
    return merged_out


def _build_schedule_preview(programs_list: List[dict], limit: int = 8) -> List[dict]:
    """Next dated slots (not completed), today onward, for dashboard."""
    today = datetime.now(timezone.utc).date()
    rows = []
    for p in programs_list:
        pname = p.get("name") or ""
        for s in p.get("schedule") or []:
            raw = s.get("date")
            if not raw:
                continue
            ds = str(raw).strip()[:10]
            try:
                slot_date = datetime.strptime(ds, "%Y-%m-%d").date()
            except ValueError:
                continue
            if s.get("completed"):
                continue
            if slot_date < today:
                continue
            rows.append({
                "program_name": pname,
                "date": ds,
                "end_date": (str(s.get("end_date") or "").strip()[:10] or ""),
                "time": s.get("time") or "",
                "note": s.get("note") or "",
                "mode_choice": s.get("mode_choice") or "",
            })
    rows.sort(key=lambda x: x["date"])
    return rows[:limit]


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    gender: Optional[str] = None
    place_of_birth: Optional[str] = None
    date_of_birth: Optional[str] = None
    city: Optional[str] = None
    qualification: Optional[str] = None
    profession: Optional[str] = None
    phone: Optional[str] = None

@router.get("/home")
async def get_student_home(user: dict = Depends(get_current_user)):
    """Fetch personalized home data: Schedule, Package, Financials, Programs."""
    client_id = user.get("client_id")
    client = await db.clients.find_one({"id": client_id}, {"_id": 0}) or {}

    # 1. Upcoming Programs (General)
    upcoming = await db.programs.find(
        {"is_upcoming": True, "visible": True}, 
        {"_id": 0}
    ).to_list(10)
    
    # 2. Subscription data (from Excel upload)
    sub = client.get("subscription", {})
    sess = sub.get("sessions", {})
    emis = sub.get("emis", [])

    # 3. Financials - derived from subscription
    paid_emis = sum(1 for e in emis if e.get("status") == "paid")
    total_emis = len(emis)
    total_paid = sum(e.get("amount", 0) for e in emis if e.get("status") == "paid")
    total_fee = sub.get("total_fee", 0)
    remaining = total_fee - total_paid

    financials = {
        "status": client.get("payment_status") or ("Paid" if remaining <= 0 and total_fee > 0 else ("EMI" if total_emis > 0 else "N/A")),
        "total_fee": total_fee,
        "currency": sub.get("currency", "INR"),
        "total_paid": total_paid,
        "remaining": remaining,
        "payment_mode": sub.get("payment_mode", ""),
        "emi_plan": f"{paid_emis}/{total_emis} EMIs Paid" if total_emis > 0 else "",
        "emis": emis,
        "next_due": "No pending dues",
    }

    # Find next due EMI
    for emi in emis:
        if emi.get("status") in ("due", "pending") and emi.get("due_date"):
            financials["next_due"] = emi["due_date"]
            break
    
    # 4. Package & Sessions
    package = {
        "program_name": sub.get("annual_program") or client.get("active_package", {}).get("program_name", "No Active Package"),
        "total_sessions": sess.get("total", 0),
        "used_sessions": sess.get("availed", 0),
        "yet_to_avail": sess.get("yet_to_avail", 0),
        "carry_forward": sess.get("carry_forward", 0),
        "current": sess.get("current", 0),
        "due": sess.get("due", 0),
        "scheduled_dates": sess.get("scheduled_dates", []),
        "next_session_date": sess.get("scheduled_dates", [None])[0] if sess.get("scheduled_dates") else client.get("active_package", {}).get("next_session_date"),
        "start_date": sub.get("start_date", ""),
        "end_date": sub.get("end_date", ""),
        "bi_annual_download": sub.get("bi_annual_download", 0),
        "quarterly_releases": sub.get("quarterly_releases", 0),
    }

    # 5. Programs in their kitty — rich objects with duration, dates, status
    raw_programs = sub.get("programs_detail", [])
    if not raw_programs:
        # Fallback: build from package config included_programs + simple names
        pkg_id = sub.get("package_id", "")
        pkg_config = await db.annual_packages.find_one({"package_id": pkg_id}, {"_id": 0}) if pkg_id else None
        simple_names = sub.get("programs", [])
        if pkg_config:
            for inc in pkg_config.get("included_programs", []):
                raw_programs.append({
                    "name": inc["name"],
                    "duration_value": inc.get("duration_value", 0),
                    "duration_unit": inc.get("duration_unit", "months"),
                    "start_date": sub.get("start_date", ""),
                    "end_date": sub.get("end_date", ""),
                    "status": "active"
                })
        else:
            for name in simple_names:
                raw_programs.append({"name": name, "duration_value": 0, "duration_unit": "", "start_date": "", "end_date": "", "status": "active"})
    programs_list = raw_programs

    # 5b. Global program schedule (admin Scheduler) — always merge so dashboard/calendar see dates
    sched_doc = await db.program_schedule.find_one({"id": "global"}, {"_id": 0})
    global_sched = sched_doc.get("programs", []) if sched_doc else []
    programs_list = _merge_global_schedule_into_programs(programs_list, global_sched)
    schedule_preview = _build_schedule_preview(programs_list)

    # 5c. If no dated slots yet, surface admin-entered 1:1 dates from subscription
    if not schedule_preview and sess.get("scheduled_dates"):
        for d in sess.get("scheduled_dates", [])[:8]:
            if not d:
                continue
            ds = str(d).strip()[:10]
            try:
                slot_date = datetime.strptime(ds, "%Y-%m-%d").date()
            except ValueError:
                continue
            if slot_date < datetime.now(timezone.utc).date():
                continue
            schedule_preview.append({
                "program_name": "1:1 Session",
                "date": ds,
                "end_date": "",
                "time": "",
                "note": "",
                "mode_choice": "",
            })
        schedule_preview.sort(key=lambda x: x["date"])

    # 6. Journey Logs (Last 3)
    logs = await db.journey_logs.find(
        {"client_id": client_id}, {"_id": 0}
    ).sort("date", -1).to_list(3)

    # 7. Profile Status
    profile_status = "complete" if user.get("profile_approved") else "pending"
    if not user.get("profile_approved") and not user.get("pending_profile_update"):
        profile_status = "incomplete"

    # 8. Payment methods & bank details
    payment_methods = sub.get("payment_methods", ["stripe", "manual"])
    banks = await db.bank_accounts.find({"is_active": True}, {"_id": 0}).to_list(10)

    iris_journey = resolve_iris_journey(sub)

    return {
        "client_id": client_id,
        "upcoming_programs": upcoming,
        "financials": financials,
        "package": package,
        "programs": programs_list,
        "schedule_preview": schedule_preview,
        "journey_logs": logs,
        "profile_status": profile_status,
        "payment_methods": payment_methods,
        "bank_accounts": banks,
        "late_fee_per_day": sub.get("late_fee_per_day", 0),
        "channelization_fee": sub.get("channelization_fee", 0),
        "show_late_fees": sub.get("show_late_fees", False),
        "iris_journey": iris_journey,
        "user_details": {
            "full_name": user.get("full_name") or user.get("name"),
            "city": user.get("city"),
            "tier": user.get("tier")
        }
    }

@router.put("/profile")
async def update_profile(data: ProfileUpdate, user: dict = Depends(get_current_user)):
    """Submit profile for approval."""
    update_dict = {k: v for k, v in data.dict().items() if v is not None}
    
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "pending_profile_update": update_dict,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"message": "Profile submitted for approval"}

class JourneyLogCreate(BaseModel):
    date: str
    title: str
    category: str
    experience: str
    learning: str
    rating: int

@router.post("/logs")
async def create_journey_log(data: JourneyLogCreate, user: dict = Depends(get_current_user)):
    client_id = user.get("client_id")
    if not client_id:
        raise HTTPException(status_code=400, detail="User not linked to client record")
        
    log = JourneyLog(
        client_id=client_id,
        **data.dict()
    )
    await db.journey_logs.insert_one(log.dict())
    return {"message": "Log saved", "id": log.id}

@router.get("/logs")
async def get_journey_logs(user: dict = Depends(get_current_user)):
    client_id = user.get("client_id")
    logs = await db.journey_logs.find(
        {"client_id": client_id}, {"_id": 0}
    ).sort("date", -1).to_list(100)
    return logs


class ModeChoice(BaseModel):
    program_name: str
    session_index: int
    mode: str  # "online" | "offline"

@router.post("/choose-mode")
async def choose_session_mode(data: ModeChoice, user: dict = Depends(get_current_user)):
    """Student chooses online/offline for a scheduled session."""
    client_id = user.get("client_id")
    client_doc = await db.clients.find_one({"id": client_id})
    if not client_doc:
        raise HTTPException(status_code=404, detail="Client not found")

    sub = client_doc.get("subscription", {})
    programs = sub.get("programs_detail", [])

    updated = False
    for prog in programs:
        if prog["name"] == data.program_name:
            schedule = prog.get("schedule", [])
            if data.session_index < len(schedule):
                schedule[data.session_index]["mode_choice"] = data.mode
                prog["schedule"] = schedule
                updated = True
            break

    if not updated:
        raise HTTPException(status_code=404, detail="Program or session not found")

    sub["programs_detail"] = programs
    await db.clients.update_one(
        {"id": client_id},
        {"$set": {"subscription": sub}}
    )
    return {"message": f"Mode set to {data.mode}"}


# ═══════════════════════════════════════════
# DAILY PROGRESS TRACKING
# ═══════════════════════════════════════════

class DailyProgressCreate(BaseModel):
    date: str  # YYYY-MM-DD
    program_name: str
    notes: str = ""
    rating: int = 3  # 1-5
    completed: bool = True
    is_extraordinary: bool = False
    extraordinary_note: str = ""

@router.post("/daily-progress")
async def save_daily_progress(data: DailyProgressCreate, user: dict = Depends(get_current_user)):
    """Save or update a daily progress entry."""
    client_id = user.get("client_id")
    if not client_id:
        raise HTTPException(status_code=400, detail="User not linked to client record")

    entry = {
        "client_id": client_id,
        "date": data.date,
        "program_name": data.program_name,
        "notes": data.notes,
        "rating": max(1, min(5, data.rating)),
        "completed": data.completed,
        "is_extraordinary": data.is_extraordinary,
        "extraordinary_note": data.extraordinary_note,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    # Upsert: one entry per client+date+program
    await db.daily_progress.update_one(
        {"client_id": client_id, "date": data.date, "program_name": data.program_name},
        {"$set": entry, "$setOnInsert": {"id": str(__import__('uuid').uuid4()), "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    return {"message": "Progress saved"}

@router.get("/daily-progress")
async def get_daily_progress(month: str = "", user: dict = Depends(get_current_user)):
    """Get daily progress entries. Optional: filter by month (YYYY-MM)."""
    client_id = user.get("client_id")
    query = {"client_id": client_id}
    if month:
        query["date"] = {"$regex": f"^{month}"}
    entries = await db.daily_progress.find(query, {"_id": 0}).sort("date", -1).to_list(366)
    return entries

@router.get("/extraordinary-moments")
async def get_extraordinary_moments(user: dict = Depends(get_current_user)):
    """Get all extraordinary moments for a student."""
    client_id = user.get("client_id")
    entries = await db.daily_progress.find(
        {"client_id": client_id, "is_extraordinary": True},
        {"_id": 0}
    ).sort("date", -1).to_list(100)
    return entries


# ═══════════════════════════════════════════
# STUDENT-INITIATED PAUSE
# ═══════════════════════════════════════════

class PauseRequest(BaseModel):
    program_name: str
    pause_start: str  # YYYY-MM-DD
    pause_end: str    # YYYY-MM-DD
    reason: str = ""

@router.post("/pause-program")
async def pause_program(data: PauseRequest, user: dict = Depends(get_current_user)):
    """Student requests to pause a program (if admin has enabled it)."""
    client_id = user.get("client_id")
    client_doc = await db.clients.find_one({"id": client_id})
    if not client_doc:
        raise HTTPException(status_code=404, detail="Client not found")

    sub = client_doc.get("subscription", {})
    programs = sub.get("programs_detail", [])

    for prog in programs:
        if prog["name"] == data.program_name:
            if not prog.get("allow_pause", False):
                raise HTTPException(status_code=403, detail="Pause not enabled for this program")
            prog["status"] = "paused"
            prog["pause_start"] = data.pause_start
            prog["pause_end"] = data.pause_end
            prog["pause_reason"] = data.reason
            prog["pause_requested_at"] = datetime.now(timezone.utc).isoformat()
            break
    else:
        raise HTTPException(status_code=404, detail="Program not found")

    sub["programs_detail"] = programs
    await db.clients.update_one(
        {"id": client_id},
        {"$set": {"subscription": sub}}
    )
    return {"message": f"{data.program_name} paused until {data.pause_end}"}

@router.post("/resume-program")
async def resume_program(data: ModeChoice, user: dict = Depends(get_current_user)):
    """Student resumes a paused program."""
    client_id = user.get("client_id")
    client_doc = await db.clients.find_one({"id": client_id})
    if not client_doc:
        raise HTTPException(status_code=404, detail="Client not found")

    sub = client_doc.get("subscription", {})
    programs = sub.get("programs_detail", [])

    for prog in programs:
        if prog["name"] == data.program_name:
            prog["status"] = "active"
            prog.pop("pause_start", None)
            prog.pop("pause_end", None)
            prog.pop("pause_reason", None)
            break
    else:
        raise HTTPException(status_code=404, detail="Program not found")

    sub["programs_detail"] = programs
    await db.clients.update_one(
        {"id": client_id},
        {"$set": {"subscription": sub}}
    )
    return {"message": f"{data.program_name} resumed"}

class ResumeRequest(BaseModel):
    program_name: str

@router.post("/resume-program-simple")
async def resume_program_simple(data: ResumeRequest, user: dict = Depends(get_current_user)):
    """Student resumes a paused program (simple)."""
    client_id = user.get("client_id")
    client_doc = await db.clients.find_one({"id": client_id})
    if not client_doc:
        raise HTTPException(status_code=404, detail="Client not found")

    sub = client_doc.get("subscription", {})
    programs = sub.get("programs_detail", [])

    for prog in programs:
        if prog["name"] == data.program_name:
            prog["status"] = "active"
            prog.pop("pause_start", None)
            prog.pop("pause_end", None)
            prog.pop("pause_reason", None)
            break
    else:
        raise HTTPException(status_code=404, detail="Program not found")

    sub["programs_detail"] = programs
    await db.clients.update_one(
        {"id": client_id},
        {"$set": {"subscription": sub}}
    )
    return {"message": f"{data.program_name} resumed"}



# ═══════════════════════════════════════════
# BHAAD PORTAL — Release & Transform
# ═══════════════════════════════════════════

class BhaadRelease(BaseModel):
    original: str
    transformed: str
    date: str

@router.post("/bhaad-release")
async def save_bhaad_release(data: BhaadRelease, user: dict = Depends(get_current_user)):
    client_id = user.get("client_id") or user.get("id")
    entry = {
        "id": str(__import__('uuid').uuid4()),
        "client_id": client_id,
        "original": data.original,
        "transformed": data.transformed,
        "date": data.date,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.bhaad_releases.insert_one(entry)
    return {"message": "Released and transformed"}

@router.get("/bhaad-history")
async def get_bhaad_history(user: dict = Depends(get_current_user)):
    client_id = user.get("client_id") or user.get("id")
    items = await db.bhaad_releases.find({"client_id": client_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return items


# ═══════════════════════════════════════════
# SOUL TRIBE — Community Feed
# ═══════════════════════════════════════════

class TribePostCreate(BaseModel):
    content: str
    image: str = ""

class TribeReact(BaseModel):
    post_id: str
    emoji: str

class TribeComment(BaseModel):
    post_id: str
    text: str

@router.get("/tribe/posts")
async def get_tribe_posts(user: dict = Depends(get_current_user)):
    posts = await db.tribe_posts.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return posts

@router.post("/tribe/posts")
async def create_tribe_post(data: TribePostCreate, user: dict = Depends(get_current_user)):
    post = {
        "id": str(__import__('uuid').uuid4()),
        "author_id": user.get("client_id") or user.get("id"),
        "author_name": user.get("name", "Soul Tribe Member"),
        "content": data.content,
        "image": data.image,
        "reactions": {},
        "comments": [],
        "badge": "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.tribe_posts.insert_one(post)
    post.pop("_id", None)
    return post

@router.post("/tribe/react")
async def react_to_post(data: TribeReact, user: dict = Depends(get_current_user)):
    await db.tribe_posts.update_one(
        {"id": data.post_id},
        {"$inc": {f"reactions.{data.emoji}": 1}}
    )
    return {"message": "Reacted"}

@router.post("/tribe/comment")
async def comment_on_post(data: TribeComment, user: dict = Depends(get_current_user)):
    comment = {
        "author": user.get("name", "Member"),
        "text": data.text,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.tribe_posts.update_one(
        {"id": data.post_id},
        {"$push": {"comments": comment}}
    )
    return comment
