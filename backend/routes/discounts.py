from fastapi import APIRouter
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/api/discounts", tags=["Discounts"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


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
            "enable_loyalty": False,
            "loyalty_discount_pct": 0,
        }
    return {
        "enable_referral": settings.get("enable_referral", True),
        "enable_group_discount": settings.get("enable_group_discount", False),
        "group_discount_rules": settings.get("group_discount_rules", []),
        "enable_combo_discount": settings.get("enable_combo_discount", False),
        "combo_discount_pct": settings.get("combo_discount_pct", 0),
        "combo_min_programs": settings.get("combo_min_programs", 2),
        "enable_loyalty": settings.get("enable_loyalty", False),
        "loyalty_discount_pct": settings.get("loyalty_discount_pct", 0),
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
    
    Input: { num_programs: int, num_participants: int, subtotal: float, email: str, currency: str }
    Returns: { group_discount: float, combo_discount: float, loyalty_discount: float, total_discount: float }
    """
    settings = await db.site_settings.find_one({"id": "site_settings"}, {"_id": 0})
    if not settings:
        return {"group_discount": 0, "combo_discount": 0, "loyalty_discount": 0, "total_discount": 0}

    subtotal = data.get("subtotal", 0)
    num_participants = data.get("num_participants", 1)
    num_programs = data.get("num_programs", 1)
    email = data.get("email", "")
    remaining = subtotal

    group_discount = 0
    combo_discount = 0
    loyalty_discount = 0

    # 1. Group discount (based on participant count)
    if settings.get("enable_group_discount") and num_participants > 1:
        rules = settings.get("group_discount_rules", [])
        # Sort rules by min_participants descending to find best match
        rules_sorted = sorted(rules, key=lambda r: r.get("min_participants", 0), reverse=True)
        for rule in rules_sorted:
            if num_participants >= rule.get("min_participants", 999):
                group_discount = round(remaining * rule.get("discount_pct", 0) / 100)
                remaining -= group_discount
                break

    # 2. Combo discount (2+ programs in cart)
    if settings.get("enable_combo_discount") and num_programs >= settings.get("combo_min_programs", 2):
        pct = settings.get("combo_discount_pct", 0)
        combo_discount = round(remaining * pct / 100)
        remaining -= combo_discount

    # 3. Loyalty discount (returning clients)
    if settings.get("enable_loyalty") and email:
        enrollment = await db.enrollments.find_one(
            {"booker_email": email, "participants.uid": {"$exists": True, "$ne": ""}},
            {"_id": 0}
        )
        if enrollment:
            pct = settings.get("loyalty_discount_pct", 0)
            loyalty_discount = round(remaining * pct / 100)

    total_discount = group_discount + combo_discount + loyalty_discount

    return {
        "group_discount": group_discount,
        "combo_discount": combo_discount,
        "loyalty_discount": loyalty_discount,
        "total_discount": total_discount,
    }
