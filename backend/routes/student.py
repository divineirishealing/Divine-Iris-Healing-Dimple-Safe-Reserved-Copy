from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from dotenv import load_dotenv
from pathlib import Path
from .auth import get_current_user

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
    """Fetch personalized home data: Upcoming Programs, Payment Status."""
    
    # 1. Upcoming Programs (visible to all)
    upcoming = await db.programs.find(
        {"is_upcoming": True, "visible": True}, 
        {"_id": 0}
    ).to_list(10)
    
    # Personalized Pricing Logic
    # If user has a tier, maybe apply discount? For now, we return base prices.
    # Frontend can display "Special Price" if we add logic here.
    
    # 2. Payment/EMI Status
    # Fetch from Client record
    client = await db.clients.find_one({"id": user.get("client_id")}, {"_id": 0})
    financials = {
        "status": client.get("payment_status", "N/A"),
        "emi_plan": client.get("emi_plan_name", ""),
        "next_due": "No pending dues", # Placeholder until real EMI logic
        "history": [] 
    }
    
    # 3. Profile Status
    profile_status = "complete" if user.get("profile_approved") else "pending"
    if not user.get("profile_approved") and not user.get("pending_profile_update"):
        profile_status = "incomplete"

    return {
        "upcoming_programs": upcoming,
        "financials": financials,
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

@router.get("/profile")
async def get_profile(user: dict = Depends(get_current_user)):
    # Return user data + pending updates if any
    return {
        **user,
        "pending_update": user.get("pending_profile_update")
    }
