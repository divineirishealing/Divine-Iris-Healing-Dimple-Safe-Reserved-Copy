from fastapi import APIRouter, HTTPException, Response
from models import Stat, StatCreate
from typing import List
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/api/stats", tags=["Stats"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

def _doc_to_stat(raw: dict) -> Stat:
    d = dict(raw)
    d.pop("_id", None)
    return Stat(**d)

@router.get("", response_model=List[Stat])
async def get_stats(response: Response):
    response.headers["Cache-Control"] = "no-store, max-age=0"
    stats = await db.stats.find().sort("order", 1).to_list(100)
    return [_doc_to_stat(s) for s in stats]

@router.put("/{stat_id}", response_model=Stat)
async def update_stat(stat_id: str, stat: StatCreate):
    existing = await db.stats.find_one({"id": stat_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Stat not found")

    merged = {**existing, **stat.dict()}
    updated_stat = _doc_to_stat(merged)
    await db.stats.update_one(
        {"id": stat_id},
        {"$set": updated_stat.dict()}
    )
    return updated_stat


@router.post("", response_model=Stat)
async def create_stat(stat: StatCreate):
    import uuid
    new_stat = Stat(id=str(uuid.uuid4()), **stat.dict())
    await db.stats.insert_one(new_stat.dict())
    return new_stat


@router.delete("/{stat_id}")
async def delete_stat(stat_id: str):
    result = await db.stats.delete_one({"id": stat_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Stat not found")
    return {"message": "Stat deleted"}
