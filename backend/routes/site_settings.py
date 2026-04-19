from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
from models import SiteSettings, SiteSettingsUpdate
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

import s3_storage

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/api/settings", tags=["Settings"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

DEFAULT_SETTINGS = SiteSettings().model_dump() if hasattr(SiteSettings(), "model_dump") else SiteSettings().dict()


def _normalize_inr_whitelist_from_payload(val: Any) -> List[str]:
    if val is None:
        return []
    if not isinstance(val, list):
        return []
    out = []
    for e in val:
        s = str(e).strip().lower()
        if s and "@" in s:
            out.append(s)
    return out


def _mongo_doc_for_site_settings(doc: Optional[dict]) -> dict:
    """Strip Mongo _id and normalize fields so SiteSettings() always sees a stable inr_whitelist_emails list."""
    if not doc:
        return {}
    out = dict(doc)
    out.pop("_id", None)
    wl = out.get("inr_whitelist_emails")
    if wl is None:
        out["inr_whitelist_emails"] = []
    elif not isinstance(wl, list):
        out["inr_whitelist_emails"] = []
    else:
        out["inr_whitelist_emails"] = _normalize_inr_whitelist_from_payload(wl)
    return out


def _with_public_api_base(obj: SiteSettings) -> SiteSettings:
    host = (os.environ.get("HOST_URL") or "").strip().rstrip("/")
    bucket = (os.environ.get("AWS_S3_BUCKET") or "").strip()
    force_vh = (os.environ.get("S3_PROXY_VIRTUAL_HOST_URLS") or "").lower() in ("true", "1", "yes")
    mode = s3_storage.s3_url_for_browser_mode()
    use_proxy_vh = (
        bool(host)
        and bool(bucket)
        and s3_storage.is_s3_enabled()
        and (mode in ("api", "proxy", "backend") or force_vh)
    )
    return obj.model_copy(
        update={
            "public_api_base": host,
            "s3_media_bucket": bucket if use_proxy_vh else "",
            "s3_proxy_virtual_host_urls": use_proxy_vh,
        }
    )

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
        return _with_public_api_base(SiteSettings(**_mongo_doc_for_site_settings(DEFAULT_SETTINGS)))
    # Auto-seed section template if empty
    if not settings.get("program_section_template"):
        settings["program_section_template"] = DEFAULT_SECTION_TEMPLATE
        await db.site_settings.update_one({"id": "site_settings"}, {"$set": {"program_section_template": DEFAULT_SECTION_TEMPLATE}})
    # Legacy default was 70px (not on size picker); migrate to medium 44px once
    if settings.get("hero_title_size") == "70px":
        await db.site_settings.update_one({"id": "site_settings"}, {"$set": {"hero_title_size": "44px"}})
        settings["hero_title_size"] = "44px"
    return _with_public_api_base(SiteSettings(**_mongo_doc_for_site_settings(settings)))

class InrWhitelistEmailsBody(BaseModel):
    emails: List[str] = []


@router.put("/inr-whitelist-emails")
async def put_inr_whitelist_emails(body: InrWhitelistEmailsBody):
    """Persist INR NRI email list only (avoids losing the field on partial SiteSettings PUT quirks)."""
    normalized = []
    for e in body.emails or []:
        s = str(e).strip().lower()
        if s and "@" in s:
            normalized.append(s)
    existing = await db.site_settings.find_one({"id": "site_settings"})
    if not existing:
        doc = {**DEFAULT_SETTINGS, **{"id": "site_settings", "inr_whitelist_emails": normalized}}
        await db.site_settings.insert_one(doc)
    else:
        await db.site_settings.update_one({"id": "site_settings"}, {"$set": {"inr_whitelist_emails": normalized}})
    updated = await db.site_settings.find_one({"id": "site_settings"})
    return {"inr_whitelist_emails": (updated or {}).get("inr_whitelist_emails", [])}


@router.put("")
async def update_settings(payload: Dict[str, Any]):
    """Accept raw JSON so inr_whitelist_emails is persisted whenever the key is present (axios/FastAPI/Pydantic can omit model_fields_set)."""
    try:
        settings = SiteSettingsUpdate.model_validate(payload)
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))
    raw = settings.model_dump(exclude_unset=True) if hasattr(settings, "model_dump") else settings.dict(exclude_unset=True)
    # Allow empty strings and empty lists (only skip None). Booleans may be False — must not drop them.
    update_data = {k: v for k, v in raw.items() if v is not None}
    # Raw body key — source of truth for NRI whitelist (do not rely on model_fields_set alone).
    if "inr_whitelist_emails" in payload:
        update_data["inr_whitelist_emails"] = _normalize_inr_whitelist_from_payload(payload.get("inr_whitelist_emails"))
    # Defensive: Pydantic v2 partial bodies should still persist explicit False
    if hasattr(settings, "model_fields_set") and "checkout_promo_code_visible" in settings.model_fields_set:
        update_data["checkout_promo_code_visible"] = bool(settings.checkout_promo_code_visible)
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
    if raw.get('dashboard_bg_video') is not None:
        update_data['dashboard_bg_video'] = raw['dashboard_bg_video']
    if raw.get('dashboard_sanctuary_video_url') is not None:
        update_data['dashboard_sanctuary_video_url'] = raw['dashboard_sanctuary_video_url']
    if raw.get('dashboard_offer_annual') is not None:
        update_data['dashboard_offer_annual'] = raw['dashboard_offer_annual']
    if raw.get('dashboard_offer_family') is not None:
        update_data['dashboard_offer_family'] = raw['dashboard_offer_family']
    if raw.get('dashboard_offer_extended') is not None:
        update_data['dashboard_offer_extended'] = raw['dashboard_offer_extended']
    if raw.get('annual_package_included_program_ids') is not None:
        update_data['annual_package_included_program_ids'] = raw['annual_package_included_program_ids']
    if raw.get('dashboard_program_offers') is not None:
        update_data['dashboard_program_offers'] = raw['dashboard_program_offers']
    if raw.get('dashboard_element_visibility') is not None:
        update_data['dashboard_element_visibility'] = raw['dashboard_element_visibility']
    if raw.get('india_payment_gateway') is not None:
        update_data['india_payment_gateway'] = raw['india_payment_gateway']
    if raw.get('india_bank_accounts') is not None:
        update_data['india_bank_accounts'] = raw['india_bank_accounts']
    if hasattr(settings, "model_fields_set") and "dashboard_annual_quote_show_tax" in settings.model_fields_set:
        update_data["dashboard_annual_quote_show_tax"] = bool(settings.dashboard_annual_quote_show_tax)
    if raw.get('india_gpay_accounts') is not None:
        update_data['india_gpay_accounts'] = raw['india_gpay_accounts']
    if raw.get('india_bank_details') is not None:
        update_data['india_bank_details'] = raw['india_bank_details']
    if raw.get('admin_password') is not None:
        update_data['admin_password'] = raw['admin_password']
    if raw.get('combo_rules') is not None:
        update_data['combo_rules'] = raw['combo_rules']
    if raw.get('cross_sell_rules') is not None:
        update_data['cross_sell_rules'] = raw['cross_sell_rules']
    if raw.get('special_offers') is not None:
        update_data['special_offers'] = raw['special_offers']
    if raw.get('points_activities') is not None:
        update_data['points_activities'] = raw['points_activities']
    if raw.get('points_redeem_excludes_flagship') is not None:
        update_data['points_redeem_excludes_flagship'] = raw['points_redeem_excludes_flagship']
    existing = await db.site_settings.find_one({"id": "site_settings"})
    if not existing:
        full_settings = {**DEFAULT_SETTINGS, **update_data}
        await db.site_settings.insert_one(full_settings)
    else:
        await db.site_settings.update_one({"id": "site_settings"}, {"$set": update_data})
    updated = await db.site_settings.find_one({"id": "site_settings"})
    return SiteSettings(**_mongo_doc_for_site_settings(updated))
