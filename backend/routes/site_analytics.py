"""Anonymous SPA page-view analytics: public collect + admin-only summaries."""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from pathlib import Path
import os

from routes.auth import assert_admin_session_or_password

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

collect_router = APIRouter(prefix="/api/analytics", tags=["Site Analytics"])
admin_router = APIRouter(prefix="/api/admin/analytics", tags=["Site Analytics"])


class CollectBody(BaseModel):
    path: str = Field("", max_length=512)
    referrer: str = Field(default="", max_length=2000)


def _sanitize_path(p: str) -> Optional[str]:
    p = (p or "").strip()
    if not p.startswith("/"):
        return None
    if ".." in p or "\x00" in p:
        return None
    if len(p) > 512:
        return None
    # Strip query/hash client may have appended
    p = p.split("?")[0].split("#")[0]
    if not p:
        p = "/"
    low = p.lower()
    if low.startswith("/admin"):
        return None
    return p


@collect_router.post("/collect")
async def collect_page_view(body: CollectBody):
    path = _sanitize_path(body.path)
    if not path:
        raise HTTPException(status_code=400, detail="invalid path")
    ref = (body.referrer or "").strip()[:2000]
    await db.site_page_views.insert_one(
        {
            "path": path,
            "referrer": ref,
            "ts": datetime.now(timezone.utc),
        }
    )
    return {"ok": True}


@admin_router.get("/summary")
async def analytics_summary(
    request: Request,
    days: int = Query(7, ge=1, le=90),
) -> Dict[str, Any]:
    await assert_admin_session_or_password(request, None)
    start = datetime.now(timezone.utc) - timedelta(days=days)

    total = await db.site_page_views.count_documents({"ts": {"$gte": start}})

    top_pipeline: List[Dict[str, Any]] = [
        {"$match": {"ts": {"$gte": start}}},
        {"$group": {"_id": "$path", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 40},
    ]
    top_raw = await db.site_page_views.aggregate(top_pipeline).to_list(40)
    top_paths = [{"path": x["_id"], "count": x["count"]} for x in top_raw]

    day_pipeline: List[Dict[str, Any]] = [
        {"$match": {"ts": {"$gte": start}}},
        {
            "$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$ts"}},
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"_id": 1}},
    ]
    day_raw = await db.site_page_views.aggregate(day_pipeline).to_list(400)
    by_day = [{"date": x["_id"], "count": x["count"]} for x in day_raw]

    return {
        "days": days,
        "total_views": total,
        "by_day": by_day,
        "top_paths": top_paths,
    }
