"""Short program-specific quotes shown on upcoming program cards on the homepage."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api/upcoming-card-quotes", tags=["Upcoming Card Quotes"])


def get_db():
    from server import db
    return db


class UpcomingCardQuoteCreate(BaseModel):
    program_id: str
    text: str
    author: Optional[str] = ""
    role: Optional[str] = ""
    visible: bool = True
    order: int = 0


def _serialize_quote(doc: dict) -> dict:
    out = {k: v for k, v in doc.items() if k != "_id"}
    pid = out.get("program_id")
    if pid is not None:
        out["program_id"] = str(pid).strip()
    return out


@router.get("")
async def list_upcoming_card_quotes(visible_only: bool = False):
    db = get_db()
    if visible_only:
        # Treat missing `visible` as public (older docs / imports)
        query = {"$or": [{"visible": True}, {"visible": {"$exists": False}}]}
    else:
        query = {}
    items = await db.upcoming_card_quotes.find(query, {"_id": 0}).sort(
        [("program_id", 1), ("order", 1)]
    ).to_list(800)
    return [_serialize_quote(x) for x in items]


@router.post("")
async def create_upcoming_card_quote(data: UpcomingCardQuoteCreate):
    db = get_db()
    count = await db.upcoming_card_quotes.count_documents({})
    item = {
        "id": str(uuid.uuid4()),
        "program_id": (data.program_id or "").strip(),
        "text": (data.text or "").strip(),
        "author": (data.author or "").strip(),
        "role": (data.role or "").strip(),
        "visible": data.visible,
        "order": data.order if data.order is not None else count,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if not item["program_id"]:
        raise HTTPException(status_code=400, detail="program_id is required")
    await db.upcoming_card_quotes.insert_one(item)
    item.pop("_id", None)  # Motor may mutate the dict
    return item


@router.put("/{qid}")
async def update_upcoming_card_quote(qid: str, data: UpcomingCardQuoteCreate):
    db = get_db()
    existing = await db.upcoming_card_quotes.find_one({"id": qid})
    if not existing:
        raise HTTPException(status_code=404, detail="Quote not found")
    pid = (data.program_id or "").strip()
    if not pid:
        raise HTTPException(status_code=400, detail="program_id is required")
    update = {
        "program_id": pid,
        "text": (data.text or "").strip(),
        "author": (data.author or "").strip(),
        "role": (data.role or "").strip(),
        "visible": data.visible,
        "order": data.order,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.upcoming_card_quotes.update_one({"id": qid}, {"$set": update})
    doc = await db.upcoming_card_quotes.find_one({"id": qid}, {"_id": 0})
    return doc


@router.delete("/{qid}")
async def delete_upcoming_card_quote(qid: str):
    db = get_db()
    await db.upcoming_card_quotes.delete_one({"id": qid})
    return {"message": "Deleted"}
