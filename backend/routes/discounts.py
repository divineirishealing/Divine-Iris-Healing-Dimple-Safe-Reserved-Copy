from fastapi import APIRouter
import os
from routes.points_logic import load_points_config
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

    # 4. Cross-sell discount (program+tier specific, multi-target)
    cross_sell_discount = 0
    cross_sell_details = []
    cart_items = data.get("cart_items", [])
    if settings.get("enable_cross_sell") and program_ids and len(program_ids) >= 2:
        cross_sell_rules = settings.get("cross_sell_rules", [])
        pid_set = set(str(p) for p in program_ids)
        cart_tier_set = set()
        for ci in cart_items:
            cart_tier_set.add((str(ci.get("program_id", "")), str(ci.get("tier_index", ""))))
        
        for rule in cross_sell_rules:
            if not rule.get("enabled", True):
                continue
            buy_id = str(rule.get("buy_program_id", ""))
            buy_tier = str(rule.get("buy_tier", ""))
            
            buy_match = False
            if buy_tier and buy_tier != "None" and buy_tier != "":
                buy_match = (buy_id, buy_tier) in cart_tier_set
            else:
                buy_match = buy_id in pid_set
            
            if not buy_match:
                continue
            
            # Process targets (new format) or legacy single target
            targets = rule.get("targets", [])
            if not targets and rule.get("get_program_id"):
                targets = [{"program_id": rule["get_program_id"], "tier": rule.get("get_tier", ""), "discount_value": rule.get("discount_value", 0), "discount_type": rule.get("discount_type", "percentage")}]
            
            for target in targets:
                get_id = str(target.get("program_id", ""))
                get_tier = str(target.get("tier", ""))
                if get_id not in pid_set:
                    continue
                
                disc_type = target.get("discount_type", "percentage")
                disc_val = target.get("discount_value", 0)
                if disc_type == "percentage":
                    target_prog = await db.programs.find_one({"id": get_id}, {"_id": 0})
                    if target_prog:
                        currency = data.get("currency", "usd")
                        if get_tier and get_tier != "None" and get_tier != "":
                            tiers = target_prog.get("duration_tiers", [])
                            ti = int(get_tier) if get_tier.isdigit() else 0
                            if ti < len(tiers):
                                # Use offer price if available, else original
                                target_price = tiers[ti].get(f"offer_price_{currency}", 0) or tiers[ti].get(f"price_{currency}", 0)
                            else:
                                target_price = 0
                        else:
                            # Use offer price if available, else original
                            target_price = target_prog.get(f"offer_price_{currency}", 0) or target_prog.get(f"price_{currency}", 0)
                        amt = round(target_price * disc_val / 100)
                        cross_sell_discount += amt
                        cross_sell_details.append({"rule": rule.get("label", ""), "code": rule.get("code", ""), "amount": amt})
                else:
                    cross_sell_discount += disc_val
                    cross_sell_details.append({"rule": rule.get("label", ""), "code": rule.get("code", ""), "amount": disc_val})

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
