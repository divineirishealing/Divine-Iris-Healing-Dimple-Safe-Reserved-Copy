from fastapi import APIRouter, HTTPException
from models import Promotion, PromotionCreate
from typing import List

from utils.promotion_scope import (
    build_cart_lines_from_payload,
    eligible_participant_units_for_fixed_promo,
    fixed_promo_scales_with_headcount,
    promo_applies_to_cart_lines,
)
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/api/promotions", tags=["Promotions"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


@router.get("", response_model=List[Promotion])
async def get_promotions():
    promos = await db.promotions.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [Promotion(**p) for p in promos]


@router.get("/active")
async def get_active_promotions(program_id: str = None):
    """Get active promotions, optionally filtered by program."""
    now = datetime.now(timezone.utc).isoformat()
    query = {"active": True}
    promos = await db.promotions.find(query, {"_id": 0}).to_list(500)

    active = []
    for p in promos:
        # Check expiry
        if p.get("expiry_date"):
            try:
                exp = datetime.fromisoformat(p["expiry_date"].replace("Z", "+00:00"))
                if exp < datetime.now(timezone.utc):
                    continue
            except (ValueError, TypeError):
                pass
        # Check start date
        if p.get("start_date"):
            try:
                start = datetime.fromisoformat(p["start_date"].replace("Z", "+00:00"))
                if start > datetime.now(timezone.utc):
                    continue
            except (ValueError, TypeError):
                pass
        # Check usage limit
        if p.get("usage_limit", 0) > 0 and p.get("used_count", 0) >= p["usage_limit"]:
            continue
        # Check program applicability
        if program_id and p.get("applicable_to") == "specific":
            if program_id not in p.get("applicable_program_ids", []):
                continue
        active.append(Promotion(**p))
    return active


@router.post("", response_model=Promotion)
async def create_promotion(promo: PromotionCreate):
    new_promo = Promotion(**promo.dict())
    if new_promo.code:
        new_promo.code = new_promo.code.strip().upper()
        existing = await db.promotions.find_one({"code": new_promo.code, "active": True})
        if existing:
            raise HTTPException(status_code=400, detail=f"Active promotion with code '{new_promo.code}' already exists")
    await db.promotions.insert_one(new_promo.dict())
    return new_promo


@router.put("/{promo_id}", response_model=Promotion)
async def update_promotion(promo_id: str, promo: PromotionCreate):
    existing = await db.promotions.find_one({"id": promo_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Promotion not found")
    updated = {**existing, **promo.dict()}
    if updated.get("code"):
        updated["code"] = updated["code"].strip().upper()
    del updated["_id"]
    await db.promotions.update_one({"id": promo_id}, {"$set": updated})
    return Promotion(**updated)


@router.delete("/{promo_id}")
async def delete_promotion(promo_id: str):
    result = await db.promotions.delete_one({"id": promo_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Promotion not found")
    return {"message": "Promotion deleted"}


@router.post("/validate")
async def validate_promotion(data: dict):
    """Validate a coupon code and return discount details."""
    code = data.get("code", "").strip().upper()
    program_id = data.get("program_id", "")
    currency = data.get("currency", "aed")

    if not code:
        raise HTTPException(status_code=400, detail="Enter a coupon code")

    promo = await db.promotions.find_one({"code": code, "active": True}, {"_id": 0})
    if not promo:
        raise HTTPException(status_code=404, detail="Invalid or expired coupon code")

    # Check expiry
    if promo.get("expiry_date"):
        try:
            exp = datetime.fromisoformat(promo["expiry_date"].replace("Z", "+00:00"))
            if exp < datetime.now(timezone.utc):
                raise HTTPException(status_code=400, detail="This coupon has expired")
        except (ValueError, TypeError):
            pass

    # Check start date
    if promo.get("start_date"):
        try:
            start = datetime.fromisoformat(promo["start_date"].replace("Z", "+00:00"))
            if start > datetime.now(timezone.utc):
                raise HTTPException(status_code=400, detail="This coupon is not yet active")
        except (ValueError, TypeError):
            pass

    # Check usage limit
    if promo.get("usage_limit", 0) > 0 and promo.get("used_count", 0) >= promo["usage_limit"]:
        raise HTTPException(status_code=400, detail="This coupon has reached its usage limit")

    lines = build_cart_lines_from_payload(data)
    ok_scope, err_scope = promo_applies_to_cart_lines(promo, lines)
    if not ok_scope:
        raise HTTPException(status_code=400, detail=err_scope or "This coupon is not valid for this cart")

    # Legacy single-field check when no structured lines were sent
    if not lines and promo.get("applicable_to") == "specific" and program_id:
        if program_id not in promo.get("applicable_program_ids", []):
            raise HTTPException(status_code=400, detail="This coupon is not valid for this program")

    # Calculate discount
    discount_type = promo.get("discount_type", "percentage")
    if discount_type == "percentage":
        pct = promo.get("discount_percentage", 0)
        return {
            "valid": True,
            "code": code,
            "name": promo.get("name", ""),
            "type": promo.get("type", "coupon"),
            "discount_type": "percentage",
            "discount_percentage": pct,
            "fixed_per_participant": False,
            "promo_billing_units": 1,
            "message": f"{pct}% off applied!",
        }
    else:
        units = eligible_participant_units_for_fixed_promo(promo, data, fallback_participants=1)
        scales = fixed_promo_scales_with_headcount(promo)
        daed = round(float(promo.get("discount_aed", 0)) * units, 2)
        dinr = round(float(promo.get("discount_inr", 0)) * units, 2)
        dusd = round(float(promo.get("discount_usd", 0)) * units, 2)
        msg = (
            f"Discount applied for {units} people!"
            if scales and units > 1
            else "Discount applied!"
        )
        return {
            "valid": True,
            "code": code,
            "name": promo.get("name", ""),
            "type": promo.get("type", "coupon"),
            "discount_type": "fixed",
            "fixed_per_participant": scales,
            "promo_billing_units": units,
            "discount_aed": daed,
            "discount_inr": dinr,
            "discount_usd": dusd,
            "message": msg,
        }
