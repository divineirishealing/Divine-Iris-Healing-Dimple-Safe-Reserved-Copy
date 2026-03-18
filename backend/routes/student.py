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

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/api/student", tags=["Student Dashboard"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

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
    """Fetch personalized home data: Schedule, Package, Financials."""
    client_id = user.get("client_id")
    client = await db.clients.find_one({"id": client_id}, {"_id": 0}) or {}

    # 1. Upcoming Programs (General)
    upcoming = await db.programs.find(
        {"is_upcoming": True, "visible": True}, 
        {"_id": 0}
    ).to_list(10)
    
    # 2. Financials
    financials = {
        "status": client.get("payment_status", "N/A"),
        "emi_plan": client.get("emi_plan_name", ""),
        "next_due": "No pending dues", 
        "history": [] 
    }
    
    # 3. Package & Schedule (Personalized)
    # Fetch manual package data from client record
    package = client.get("active_package", {
        "program_name": "No Active Package",
        "total_sessions": 0,
        "used_sessions": 0,
        "next_session_date": None
    })
    
    # 4. Journey Logs (Last 3)
    logs = await db.journey_logs.find(
        {"client_id": client_id}, {"_id": 0}
    ).sort("date", -1).to_list(3)

    # 5. Profile Status
    profile_status = "complete" if user.get("profile_approved") else "pending"
    if not user.get("profile_approved") and not user.get("pending_profile_update"):
        profile_status = "incomplete"

    return {
        "upcoming_programs": upcoming,
        "financials": financials,
        "package": package,
        "journey_logs": logs,
        "profile_status": profile_status,
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
