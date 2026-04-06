from fastapi import APIRouter, HTTPException
from models import Testimonial, TestimonialCreate
from typing import List, Optional
import os, re, urllib.parse
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/api/testimonials", tags=["Testimonials"])

def _derive_video_meta(data: dict) -> dict:
    """Derive videoId + thumbnail from video_url if not already set."""
    url = data.get("video_url", "")
    if url:
        yt = re.search(r"(?:youtube\.com/watch\?v=|youtu\.be/)([a-zA-Z0-9_-]{11})", url)
        if yt:
            data.setdefault("videoId", yt.group(1))
            if not data.get("thumbnail"):
                data["thumbnail"] = f"https://img.youtube.com/vi/{yt.group(1)}/maxresdefault.jpg"
    elif data.get("videoId") and not data.get("thumbnail"):
        data["thumbnail"] = f"https://img.youtube.com/vi/{data['videoId']}/maxresdefault.jpg"
    return data

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

@router.get("", response_model=List[Testimonial])
async def get_testimonials(
    type: Optional[str] = None,
    program_id: Optional[str] = None,
    session_id: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    visible_only: Optional[bool] = None
):
    query = {}
    if type:
        query["type"] = type
    if program_id:
        query["$or"] = [
            {"program_id": program_id},
            {"program_tags": program_id},
        ]
    if session_id:
        query["session_tags"] = session_id
    if category:
        query["category"] = category
    if visible_only:
        query["visible"] = True
    if search:
        search_filter = [
            {"text": {"$regex": re.escape(search), "$options": "i"}},
            {"name": {"$regex": re.escape(search), "$options": "i"}},
            {"category": {"$regex": re.escape(search), "$options": "i"}},
            {"role": {"$regex": re.escape(search), "$options": "i"}}
        ]
        if "$or" in query:
            query["$and"] = [{"$or": query.pop("$or")}, {"$or": search_filter}]
        else:
            query["$or"] = search_filter
    testimonials = await db.testimonials.find(query).sort("order", 1).to_list(500)
    return [Testimonial(**t) for t in testimonials]

@router.get("/categories")
async def get_categories():
    categories = await db.testimonials.distinct("category", {"category": {"$ne": ""}})
    return sorted([c for c in categories if c])

@router.get("/{testimonial_id}", response_model=Testimonial)
async def get_testimonial(testimonial_id: str):
    t = await db.testimonials.find_one({"id": testimonial_id})
    if not t:
        raise HTTPException(status_code=404, detail="Testimonial not found")
    return Testimonial(**t)

@router.post("", response_model=Testimonial)
async def create_testimonial(testimonial: TestimonialCreate):
    data = testimonial.dict()
    data = _derive_video_meta(data)
    count = await db.testimonials.count_documents({})
    data.pop("order", None)
    testimonial_obj = Testimonial(**data, order=count)
    await db.testimonials.insert_one(testimonial_obj.dict())
    return testimonial_obj

@router.put("/{testimonial_id}", response_model=Testimonial)
async def update_testimonial(testimonial_id: str, testimonial: TestimonialCreate):
    existing = await db.testimonials.find_one({"id": testimonial_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Testimonial not found")
    update_data = {k: v for k, v in testimonial.dict().items() if v is not None}
    update_data = _derive_video_meta(update_data)
    # Always update list fields even if empty
    for field in ['program_tags', 'session_tags', 'photos', 'photo_labels']:
        if field in testimonial.dict():
            update_data[field] = testimonial.dict()[field] or []
    await db.testimonials.update_one({"id": testimonial_id}, {"$set": update_data})
    updated = await db.testimonials.find_one({"id": testimonial_id})
    return Testimonial(**updated)

@router.patch("/{testimonial_id}/visibility")
async def toggle_visibility(testimonial_id: str, data: dict):
    existing = await db.testimonials.find_one({"id": testimonial_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Testimonial not found")
    await db.testimonials.update_one({"id": testimonial_id}, {"$set": {"visible": data.get("visible", True)}})
    return {"message": "Visibility updated"}

@router.delete("/{testimonial_id}")
async def delete_testimonial(testimonial_id: str):
    result = await db.testimonials.delete_one({"id": testimonial_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Testimonial not found")
    return {"message": "Testimonial deleted successfully"}
