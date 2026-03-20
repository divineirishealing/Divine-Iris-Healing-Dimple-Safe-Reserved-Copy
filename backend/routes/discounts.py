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
        "combo_rules": settings.get("combo_rules", []),
        "enable_loyalty": settings.get("enable_loyalty", False),
        "loyalty_discount_pct": settings.get("loyalty_discount_pct", 0),
        "cross_sell_rules": settings.get("cross_sell_rules", []),
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
    program_ids = data.get("program_ids", [])  # list of program IDs in cart
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

    # 2. Combo discount (tiered rules for 2+, 3+ programs)
    combo_code = ""
    if settings.get("enable_combo_discount"):
        combo_rules = settings.get("combo_rules", [])
        if combo_rules:
            # Sort by min_programs descending to find best match
            rules_sorted = sorted(combo_rules, key=lambda r: r.get("min_programs", 0), reverse=True)
            for rule in rules_sorted:
                if num_programs >= rule.get("min_programs", 999):
                    pct = rule.get("discount_pct", 0)
                    combo_discount = round(remaining * pct / 100)
                    combo_code = rule.get("code", f"COMBO{rule.get('min_programs', 0)}")
                    remaining -= combo_discount
                    break
        else:
            # Fallback to simple combo_discount_pct
            if num_programs >= settings.get("combo_min_programs", 2):
                pct = settings.get("combo_discount_pct", 0)
                combo_discount = round(remaining * pct / 100)
                combo_code = "COMBO"
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

    # 4. Cross-sell discount (program-specific: buy A → get X off B)
    cross_sell_discount = 0
    cross_sell_details = []
    if program_ids and len(program_ids) >= 2:
        cross_sell_rules = settings.get("cross_sell_rules", [])
        pid_set = set(str(p) for p in program_ids)
        for rule in cross_sell_rules:
            if not rule.get("enabled", True):
                continue
            buy_id = str(rule.get("buy_program_id", ""))
            get_id = str(rule.get("get_program_id", ""))
            if buy_id in pid_set and get_id in pid_set:
                disc_type = rule.get("discount_type", "percentage")
                if disc_type == "percentage":
                    # Need the target program's price to calculate
                    target_prog = await db.programs.find_one({"id": get_id}, {"_id": 0})
                    if target_prog:
                        currency = data.get("currency", "usd")
                        target_price = target_prog.get(f"price_{currency}", 0)
                        amt = round(target_price * rule.get("discount_value", 0) / 100)
                        cross_sell_discount += amt
                        cross_sell_details.append({"rule": rule.get("label", ""), "code": rule.get("code", ""), "amount": amt})
                else:
                    amt = rule.get("discount_value", 0)
                    cross_sell_discount += amt
                    cross_sell_details.append({"rule": rule.get("label", ""), "code": rule.get("code", ""), "amount": amt})

    total_discount = group_discount + combo_discount + loyalty_discount + cross_sell_discount

    return {
        "group_discount": group_discount,
        "combo_discount": combo_discount,
        "combo_code": combo_code,
        "loyalty_discount": loyalty_discount,
        "cross_sell_discount": cross_sell_discount,
        "cross_sell_details": cross_sell_details,
        "total_discount": total_discount,
    }



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
