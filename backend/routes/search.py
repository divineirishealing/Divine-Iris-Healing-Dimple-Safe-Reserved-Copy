from fastapi import APIRouter
from typing import Optional
import os, re
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/api/search", tags=["Search"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

@router.get("")
async def global_search(q: str, limit: int = 20):
    if not q or len(q.strip()) < 2:
        return {"programs": [], "sessions": [], "testimonials": []}

    pattern = {"$regex": re.escape(q.strip()), "$options": "i"}

    programs = await db.programs.find(
        {"$or": [{"title": pattern}, {"subtitle": pattern}, {"description": pattern}, {"category": pattern}], "visible": True},
        {"_id": 0, "id": 1, "title": 1, "subtitle": 1, "category": 1, "image": 1, "slug": 1, "is_upcoming": 1}
    ).to_list(limit)

    sessions = await db.sessions.find(
        {"$or": [{"title": pattern}, {"subtitle": pattern}, {"description": pattern}], "visible": True},
        {"_id": 0, "id": 1, "title": 1, "subtitle": 1, "image": 1, "slug": 1}
    ).to_list(limit)

    testimonials = await db.testimonials.find(
        {"$or": [{"name": pattern}, {"text": pattern}, {"category": pattern}, {"role": pattern}], "visible": True},
        {"_id": 0, "id": 1, "name": 1, "text": 1, "type": 1, "image": 1, "thumbnail": 1, "videoId": 1}
    ).to_list(limit)

    return {
        "programs": programs,
        "sessions": sessions,
        "testimonials": testimonials,
    }
