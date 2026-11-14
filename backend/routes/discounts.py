from fastapi import APIRouter
import os
from routes.points_logic import load_points_config
from utils.discount_engine import calculate_cart_discounts, resolve_discount_settings
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/api/discounts", tags=["Discounts"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


def _discount_bool(doc: dict, key: str, default: bool = False) -> bool:
    """Mongo may store null; dict.get(key, default) returns None when key exists with null."""
    if not doc or key not in doc:
        return default
    v = doc[key]
    if v is None:
        return default
    return bool(v)


@router.get("/settings")
async def get_discount_settings():
    """Get global discount & loyalty settings."""
    settings = await db.site_settings.find_one({"id": "site_settings"}, {"_id": 0})
    if not settings:
        return {
            "enable_referral": True,
            "enable_group_discount": False,
            "group_discount_rules": [],
            "enable_combo_discount": False,
            "combo_discount_pct": 0,
            "combo_min_programs": 2,
            "checkout_promo_code_visible": True,
            "enable_loyalty": False,
            "loyalty_discount_pct": 0,
            "points_enabled": True,
            "points_max_basket_pct": 20.0,
            "points_expiry_months": 6,
            "points_inr_per_point": 1.0,
            "points_usd_per_point": 0.01,
            "points_aed_per_point": 0.037,
            "points_earn_per_inr_paid": 0.5,
            "points_earn_per_usd_paid": 0.5,
            "points_earn_per_aed_paid": 0.5,
            "points_bonus_streak_30": 50,
            "points_bonus_review": 50,
            "points_bonus_referral": 500,
            "points_redeem_excludes_flagship": True,
            "points_activities": load_points_config({}).get("activities", []),
            "cross_sell_rules": [],
            "enable_cross_sell": False,
        }
    pts_cfg = load_points_config(settings or {})
    return {
        "enable_referral": settings.get("enable_referral", True),
        "enable_group_discount": settings.get("enable_group_discount", False),
        "group_discount_rules": settings.get("group_discount_rules", []),
        "enable_combo_discount": settings.get("enable_combo_discount", False),
        "combo_discount_pct": settings.get("combo_discount_pct", 0),
        "combo_min_programs": settings.get("combo_min_programs", 2),
        "combo_rules": settings.get("combo_rules", []),
        "checkout_promo_code_visible": settings.get("checkout_promo_code_visible", True),
        "enable_loyalty": settings.get("enable_loyalty", False),
        "loyalty_discount_pct": settings.get("loyalty_discount_pct", 0),
        "cross_sell_rules": settings.get("cross_sell_rules", []),
        "enable_cross_sell": _discount_bool(settings, "enable_cross_sell", False),
        "dashboard_discount_settings": settings.get("dashboard_discount_settings") or {},
        "discounts_apply_to_annual_portal": settings.get("discounts_apply_to_annual_portal")
        or {"group": True, "combo": True, "loyalty": True, "cross_sell": True},
        "special_offers": settings.get("special_offers", []),
        "points_enabled": settings.get("points_enabled", True),
        "points_max_basket_pct": settings.get("points_max_basket_pct", 20.0),
        "points_expiry_months": settings.get("points_expiry_months", 6),
        "points_inr_per_point": settings.get("points_inr_per_point", 1.0),
        "points_usd_per_point": settings.get("points_usd_per_point", 0.01),
        "points_aed_per_point": settings.get("points_aed_per_point", 0.037),
        "points_earn_per_inr_paid": settings.get("points_earn_per_inr_paid", 0.5),
        "points_earn_per_usd_paid": settings.get("points_earn_per_usd_paid", 0.5),
        "points_earn_per_aed_paid": settings.get("points_earn_per_aed_paid", 0.5),
        "points_bonus_streak_30": settings.get("points_bonus_streak_30", 50),
        "points_bonus_review": settings.get("points_bonus_review", 50),
        "points_bonus_referral": settings.get("points_bonus_referral", 500),
        "points_redeem_excludes_flagship": pts_cfg.get("redeem_excludes_flagship", True),
        "points_activities": pts_cfg.get("activities", []),
    }


@router.get("/check-loyalty/{email}")
async def check_loyalty(email: str):
    """Check if a user is a returning client (has existing enrollment with UID)."""
    enrollment = await db.enrollments.find_one(
        {"booker_email": email, "participants.uid": {"$exists": True, "$ne": ""}},
        {"_id": 0, "participants": 1}
    )
    if enrollment:
        # Find any UID from their previous enrollments
        for p in enrollment.get("participants", []):
            if p.get("uid"):
                return {"is_returning": True, "uid": p["uid"]}
    return {"is_returning": False, "uid": None}


@router.post("/calculate")
async def calculate_discounts(data: dict):
    """Calculate all applicable discounts for a cart/enrollment.
    
    Input: { num_programs, num_participants, subtotal, email, currency, program_ids, cart_items,
             annual_portal_access?: bool }
    """
    settings = await db.site_settings.find_one({"id": "site_settings"}, {"_id": 0})
    if not settings:
        return {
            "group_discount": 0,
            "combo_discount": 0,
            "loyalty_discount": 0,
            "cross_sell_discount": 0,
            "total_discount": 0,
        }

    annual_portal = bool(data.get("annual_portal_access") or data.get("annual_portal"))
    effective = resolve_discount_settings(settings, annual_portal=annual_portal)
    out = await calculate_cart_discounts(effective, data, db)
    out["used_annual_discount_rules"] = bool(
        annual_portal and (settings.get("dashboard_discount_settings") or {}).get("enabled")
    )
    return out



@router.get("/usage-report")
async def get_discount_usage_report():
    """Get discount usage stats from enrollments."""
    pipeline = [
        {"$match": {"status": {"$in": ["completed", "paid", "checkout_started"]}}},
        {"$project": {
            "_id": 0,
            "id": 1,
            "booker_name": 1,
            "booker_email": 1,
            "item_title": 1,
            "participant_count": 1,
            "promo_code": 1,
            "combo_code": 1,
            "discounts_applied": 1,
            "created_at": 1,
            "status": 1,
        }}
    ]
    enrollments = await db.enrollments.aggregate(pipeline).to_list(500)
    
    # Count promo & combo usage
    promo_counts = {}
    combo_counts = {}
    for e in enrollments:
        pc = e.get("promo_code", "")
        cc = e.get("combo_code", "") or e.get("discounts_applied", {}).get("combo_code", "")
        if pc:
            promo_counts[pc] = promo_counts.get(pc, 0) + 1
        if cc:
            combo_counts[cc] = combo_counts.get(cc, 0) + 1
    
    return {
        "promo_usage": promo_counts,
        "combo_usage": combo_counts,
        "total_enrollments_with_discounts": sum(1 for e in enrollments if e.get("promo_code") or e.get("combo_code") or e.get("discounts_applied")),
        "recent": enrollments[:20],
    }
