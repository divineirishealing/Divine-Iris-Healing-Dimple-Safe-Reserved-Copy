from fastapi import APIRouter
from models import SiteSettings, SiteSettingsUpdate
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/api/settings", tags=["Settings"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

DEFAULT_SETTINGS = SiteSettings().dict()

@router.get("", response_model=SiteSettings)
async def get_settings():
    settings = await db.site_settings.find_one({"id": "site_settings"})
    if not settings:
        await db.site_settings.insert_one(DEFAULT_SETTINGS)
        return SiteSettings(**DEFAULT_SETTINGS)
    return SiteSettings(**settings)

@router.put("")
async def update_settings(settings: SiteSettingsUpdate):
    raw = settings.dict()
    # Allow empty strings and empty lists (only skip None)
    update_data = {k: v for k, v in raw.items() if v is not None}
    # Also include fields explicitly set to empty string or empty list
    for field in ['terms_content', 'privacy_content']:
        if raw.get(field) is not None or (field in raw and raw[field] == ''):
            update_data[field] = raw[field] if raw[field] is not None else ''
    if raw.get('sender_emails') is not None:
        update_data['sender_emails'] = raw['sender_emails']
    existing = await db.site_settings.find_one({"id": "site_settings"})
    if not existing:
        full_settings = {**DEFAULT_SETTINGS, **update_data}
        await db.site_settings.insert_one(full_settings)
    else:
        await db.site_settings.update_one({"id": "site_settings"}, {"$set": update_data})
    updated = await db.site_settings.find_one({"id": "site_settings"})
    return SiteSettings(**updated)
