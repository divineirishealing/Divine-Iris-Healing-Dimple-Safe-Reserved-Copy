from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api/text-testimonials", tags=["Text Testimonials"])

def get_db():
    from server import db
    return db

class TextTestimonialCreate(BaseModel):
    quote: str
    author: str
    role: Optional[str] = ""
    visible: bool = True
    order: int = 0

@router.get("/")
async def list_text_testimonials(visible_only: bool = False):
    db = get_db()
    query = {"visible": True} if visible_only else {}
    items = await db.text_testimonials.find(query, {"_id": 0}).sort("order", 1).to_list(100)
    return items

@router.get("/visible")
async def list_visible_text_testimonials():
    db = get_db()
    items = await db.text_testimonials.find({"visible": True}, {"_id": 0}).sort("order", 1).to_list(100)
    return items

@router.post("/")
async def create_text_testimonial(data: TextTestimonialCreate):
    db = get_db()
    count = await db.text_testimonials.count_documents({})
    item = {
        "id": str(uuid.uuid4()),
        "quote": data.quote,
        "author": data.author,
        "role": data.role or "",
        "visible": data.visible,
        "order": data.order or count,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.text_testimonials.insert_one(item)
    del item["_id"]
    return item

@router.put("/{tid}")
async def update_text_testimonial(tid: str, data: TextTestimonialCreate):
    db = get_db()
    update = {
        "quote": data.quote,
        "author": data.author,
        "role": data.role or "",
        "visible": data.visible,
        "order": data.order,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.text_testimonials.update_one({"id": tid}, {"$set": update})
    doc = await db.text_testimonials.find_one({"id": tid}, {"_id": 0})
    return doc

@router.delete("/{tid}")
async def delete_text_testimonial(tid: str):
    db = get_db()
    await db.text_testimonials.delete_one({"id": tid})
    return {"message": "Deleted"}
