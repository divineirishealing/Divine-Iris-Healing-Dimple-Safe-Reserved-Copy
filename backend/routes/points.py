"""Admin points API."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

from routes.points_logic import grant_points, fetch_points_config, normalize_email

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / ".env")

router = APIRouter(prefix="/api/admin/points", tags=["Admin Points"])

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]


class AdminPointsGrant(BaseModel):
    admin_password: str
    email: EmailStr
    points: int
    reason: str = "admin_grant"


async def _verify_admin_password(password: str) -> None:
    settings = await db.site_settings.find_one({"id": "site_settings"}, {"_id": 0, "admin_password": 1})
    stored = (settings or {}).get("admin_password", "divineadmin2024")
    if password != stored:
        raise HTTPException(status_code=401, detail="Invalid admin password")


@router.post("/grant")
async def admin_grant_points(data: AdminPointsGrant):
    if data.points <= 0 or data.points > 1_000_000:
        raise HTTPException(status_code=400, detail="Invalid points amount")
    await _verify_admin_password(data.admin_password)
    cfg = await fetch_points_config(db)
    if not cfg.get("enabled"):
        raise HTTPException(status_code=400, detail="Points system is disabled in site settings")
    em = normalize_email(str(data.email))
    res = await grant_points(
        db,
        em,
        int(data.points),
        data.reason or "admin_grant",
        ref_id="",
        meta={"source": "admin"},
        cfg=cfg,
    )
    if not res.get("ok"):
        raise HTTPException(status_code=400, detail="Grant failed")
    return {"message": "Points granted", "email": em, "points": data.points, "expires_at": res.get("expires_at")}
