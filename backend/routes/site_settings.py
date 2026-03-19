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

DEFAULT_SECTION_TEMPLATE = [
    {"id": "journey", "section_type": "journey", "default_title": "The Journey", "default_subtitle": "", "order": 0, "is_enabled": True},
    {"id": "who_for", "section_type": "who_for", "default_title": "Who It Is For?", "default_subtitle": "A Sacred Invitation for those who resonate", "order": 1, "is_enabled": True},
    {"id": "experience", "section_type": "experience", "default_title": "Your Experience", "default_subtitle": "", "order": 2, "is_enabled": True},
    {"id": "why_now", "section_type": "why_now", "default_title": "Why You Need This Now?", "default_subtitle": "", "order": 3, "is_enabled": True},
]

@router.get("", response_model=SiteSettings)
async def get_settings():
    settings = await db.site_settings.find_one({"id": "site_settings"})
    if not settings:
        await db.site_settings.insert_one(DEFAULT_SETTINGS)
        return SiteSettings(**DEFAULT_SETTINGS)
    # Auto-seed section template if empty
    if not settings.get("program_section_template"):
        settings["program_section_template"] = DEFAULT_SECTION_TEMPLATE
        await db.site_settings.update_one({"id": "site_settings"}, {"$set": {"program_section_template": DEFAULT_SECTION_TEMPLATE}})
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
    if raw.get('program_section_template') is not None:
        update_data['program_section_template'] = raw['program_section_template']
    if raw.get('footer_menu_items') is not None:
        update_data['footer_menu_items'] = raw['footer_menu_items']
    if raw.get('india_payment_links') is not None:
        update_data['india_payment_links'] = raw['india_payment_links']
    if raw.get('receipt_template') is not None:
        update_data['receipt_template'] = raw['receipt_template']
    if raw.get('exclusive_offer') is not None:
        update_data['exclusive_offer'] = raw['exclusive_offer']
    if raw.get('community_whatsapp_link') is not None:
        update_data['community_whatsapp_link'] = raw['community_whatsapp_link']
    if raw.get('payment_disclaimer_style') is not None:
        update_data['payment_disclaimer_style'] = raw['payment_disclaimer_style']
    if raw.get('enrollment_urgency_quotes') is not None:
        update_data['enrollment_urgency_quotes'] = raw['enrollment_urgency_quotes']
    existing = await db.site_settings.find_one({"id": "site_settings"})
    if not existing:
        full_settings = {**DEFAULT_SETTINGS, **update_data}
        await db.site_settings.insert_one(full_settings)
    else:
        await db.site_settings.update_one({"id": "site_settings"}, {"$set": update_data})
    updated = await db.site_settings.find_one({"id": "site_settings"})
    return SiteSettings(**updated)
