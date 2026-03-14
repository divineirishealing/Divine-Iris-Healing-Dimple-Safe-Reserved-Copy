from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from datetime import datetime, timezone
import os
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/api/notify-me", tags=["NotifyMe"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


class NotifyMeRequest(BaseModel):
    email: EmailStr
    program_id: str
    program_title: str = ""


@router.post("")
async def subscribe_notify(req: NotifyMeRequest):
    existing = await db.notify_me.find_one({"email": req.email, "program_id": req.program_id})
    if existing:
        return {"message": "Already subscribed", "already_subscribed": True}
    doc = {
        "id": str(uuid.uuid4()),
        "email": req.email,
        "program_id": req.program_id,
        "program_title": req.program_title,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.notify_me.insert_one(doc)
    return {"message": "Subscribed successfully", "already_subscribed": False}


@router.get("")
async def get_notify_subscribers(program_id: str = None):
    query = {}
    if program_id:
        query["program_id"] = program_id
    subs = await db.notify_me.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return subs
