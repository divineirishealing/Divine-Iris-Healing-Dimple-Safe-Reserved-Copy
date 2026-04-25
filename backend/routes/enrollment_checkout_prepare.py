"""
Shared pricing/validation for enrollment Stripe and Razorpay checkout.
Keeps a single source of truth for discounts, points, and currency rules.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Awaitable, TYPE_CHECKING

from fastapi import HTTPException, Request

if TYPE_CHECKING:
    from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


async def enrollment_run_free_checkout(
    db: "AsyncIOMotorDatabase",
    prep: dict,
    *,
    attach_portal_ids,
) -> dict:
    """Complete $0 enrollment; same side effects as legacy free path."""
    import asyncio

    enrollment_id = prep["enrollment_id"]
    data = prep["data"]
    enrollment = prep["enrollment"]
    currency = prep["currency"]
    item = prep["item"]
    participant_count = prep["participant_count"]
    points_redeemed = prep["points_redeemed"]
    points_discount = prep["points_discount"]
    pre_points_total = prep["pre_points_total"]

    fake_session_id = f"free_{uuid.uuid4().hex[:12]}"

    transaction = {
        "id": str(uuid.uuid4()),
        "enrollment_id": enrollment_id,
        "stripe_session_id": fake_session_id,
        "item_type": data.item_type,
        "item_id": data.item_id,
        "item_title": item.get("title", "") if item else "",
        "amount": 0,
        "currency": currency,
        "payment_status": "paid",
        "booker_name": enrollment.get("booker_name"),
        "booker_email": enrollment.get("booker_email"),
        "phone": enrollment.get("phone"),
        "participants": enrollment.get("participants"),
        "participant_count": participant_count,
        "attendance": enrollment.get("attendance"),
        "tier_index": data.tier_index,
        "is_free": True,
        "pre_points_total": pre_points_total,
        "points_redeemed": points_redeemed,
        "points_discount": round(float(points_discount), 2),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await attach_portal_ids(transaction, enrollment)
    await db.payment_transactions.insert_one(transaction)

    await db.enrollments.update_one(
        {"id": enrollment_id},
        {
            "$set": {
                "step": 5,
                "status": "completed",
                "stripe_session_id": fake_session_id,
                "is_free": True,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )

    from routes.payments import generate_participant_uids, send_enrollment_emails

    await generate_participant_uids(fake_session_id)
    asyncio.create_task(send_enrollment_emails(fake_session_id))

    logger.info("[FREE ENROLLMENT] enrollment_id=%s, item=%s", enrollment_id, data.item_id)
    return {"url": "__FREE_SUCCESS__", "session_id": fake_session_id}


def resolve_checkout_public_origin(data, request: Request) -> str:
    from urllib.parse import urlparse

    origin = ""
    if data.origin_url and "cluster-" not in data.origin_url:
        origin = data.origin_url.strip().rstrip("/")
    if not origin:
        origin = request.headers.get("origin", "").strip()
    if not origin or "cluster-" in origin:
        fwd_host = request.headers.get("x-forwarded-host", "").strip()
        if fwd_host and "cluster-" not in fwd_host:
            scheme = request.headers.get("x-forwarded-proto", "https")
            origin = f"{scheme}://{fwd_host}"
        else:
            referer = request.headers.get("referer", "").strip()
            if referer:
                parsed = urlparse(referer)
                origin = f"{parsed.scheme}://{parsed.netloc}"
            else:
                origin = str(request.base_url).rstrip("/")
    return origin.rstrip("/")


async def enrollment_checkout_prepare(
    db: "AsyncIOMotorDatabase",
    enrollment_id: str,
    data,
    request: Request,
    *,
    get_enrollment_pricing: Callable[..., Awaitable[dict]],
    checkout_total_from_cart_items: Callable[..., Awaitable[tuple]],
) -> dict[str, Any]:
    enrollment = await db.enrollments.find_one({"id": enrollment_id})
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    if not enrollment.get("phone_verified"):
        raise HTTPException(
            status_code=400,
            detail="Complete email verification first (6-digit code). Payment unlocks after that step.",
        )

    from routes.currency import (
        detect_ip_info,
        get_base_currency,
        get_display_currency,
        resolve_booker_pricing_hub_email,
    )

    ip_country, vpn_detected = await detect_ip_info(request)
    server_currency = get_base_currency(ip_country, vpn_detected)
    claimed_currency = (data.currency or "usd").lower()

    inr_override = False
    booker_email = enrollment.get("booker_email", "").lower().strip()

    email_hub = await resolve_booker_pricing_hub_email(booker_email)
    if email_hub:
        server_currency = email_hub

    settings = await db.site_settings.find_one({"id": "site_settings"}, {"_id": 0, "inr_whitelist_emails": 1})
    whitelist = [e.lower().strip() for e in (settings or {}).get("inr_whitelist_emails", [])]
    if booker_email in whitelist:
        inr_override = True

    if enrollment.get("inr_invite_token"):
        token_doc = await db.inr_invite_tokens.find_one({"token": enrollment["inr_invite_token"], "active": True})
        if token_doc:
            inr_override = True

    if enrollment.get("inr_promo_applied"):
        inr_override = True

    if inr_override and claimed_currency == "inr":
        pass
    elif claimed_currency == "inr" and server_currency != "inr":
        raise HTTPException(
            status_code=403,
            detail="Currency mismatch — your region does not qualify for INR pricing. Please refresh the page.",
        )
    if claimed_currency == "aed" and server_currency == "usd" and not inr_override:
        raise HTTPException(status_code=403, detail="Currency mismatch — please refresh the page.")

    if server_currency == "inr" and claimed_currency != "inr":
        data.currency = "inr"
        data.display_currency = "inr"
    elif server_currency == "aed" and claimed_currency not in ("aed", "inr") and not inr_override:
        data.currency = "aed"
        if not data.display_currency or data.display_currency == "usd":
            data.display_currency = "aed"

    server_display_currency = email_hub if email_hub else get_display_currency(ip_country, vpn_detected)
    if server_display_currency:
        data.display_currency = server_display_currency

    if data.browser_timezone or data.browser_languages:
        await db.enrollments.update_one(
            {"id": enrollment_id},
            {
                "$set": {
                    "browser_timezone": data.browser_timezone,
                    "browser_languages": data.browser_languages,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        )

    if enrollment.get("dashboard_mixed_total") is not None:
        total = float(enrollment["dashboard_mixed_total"])
        currency = (enrollment.get("dashboard_mixed_currency") or data.currency or "aed").lower()
        participant_count = enrollment.get("participant_count", 1)
        pricing_resp = {
            "pricing": {"total": total, "currency": currency, "participant_count": participant_count},
            "security": {
                "vpn_blocked": False,
                "fraud_warning": None,
                "checks": {},
                "ip_country": ip_country,
                "claimed_country": enrollment.get("booker_country", ""),
                "country_mismatch": False,
                "inr_eligible": currency == "inr",
            },
        }
    else:
        pricing_resp = await get_enrollment_pricing(
            enrollment_id,
            data.item_type,
            data.item_id,
            tier_index=data.tier_index,
            client_currency=data.currency,
            browser_timezone=data.browser_timezone,
            browser_languages=data.browser_languages,
        )
        total = pricing_resp["pricing"]["total"]
        currency = pricing_resp["pricing"]["currency"]
        participant_count = enrollment.get("participant_count", 1)

        cart_lines = data.cart_items or []
        if cart_lines:
            agg_total, agg_headcount = await checkout_total_from_cart_items(cart_lines, currency)
            if agg_total > 0 and agg_headcount > 0:
                total = agg_total
                participant_count = agg_headcount
                pricing_resp["pricing"]["total"] = total
                pricing_resp["pricing"]["participant_count"] = participant_count

    promo_discount = 0
    if enrollment.get("dashboard_mixed_total") is None and data.promo_code:
        try:
            promo = await db.promotions.find_one({"code": data.promo_code.strip().upper(), "active": True}, {"_id": 0})
            if promo:
                discount_type = promo.get("discount_type", "percentage")
                if discount_type == "percentage":
                    pct = promo.get("discount_percentage", 0)
                    promo_discount = round(total * pct / 100, 2)
                else:
                    promo_discount = float(promo.get(f"discount_{currency}", promo.get("discount_aed", 0)))
        except Exception as e:
            logger.warning("Promo code error: %s", e)

    disc_result: dict = {}
    auto_discount = 0.0
    try:
        from routes.discounts import calculate_discounts as _calc_discounts

        cart_lines_dc = data.cart_items or []
        num_programs_dc = len(cart_lines_dc) if cart_lines_dc else 1
        num_participants_dc = participant_count
        if cart_lines_dc:
            npc_sum = sum(int(ci.get("participants_count") or 0) for ci in cart_lines_dc)
            if npc_sum > 0:
                num_participants_dc = npc_sum
        program_ids_dc = [str(ci.get("program_id")) for ci in cart_lines_dc if ci.get("program_id")]
        disc_result = await _calc_discounts(
            {
                "num_programs": num_programs_dc,
                "num_participants": num_participants_dc,
                "subtotal": total,
                "email": enrollment.get("booker_email", ""),
                "currency": currency,
                "program_ids": program_ids_dc,
                "cart_items": cart_lines_dc,
            }
        )
        auto_discount = float(disc_result.get("total_discount", 0))
    except Exception as e:
        logger.warning("Auto discount calc error: %s", e)
        disc_result = {}
        auto_discount = 0.0

    vip_discount = 0
    vip_offer_name = ""
    try:
        settings_so = await db.site_settings.find_one({"id": "site_settings"}, {"_id": 0, "special_offers": 1})
        special_offers = (settings_so or {}).get("special_offers", [])
        booker_email_v = (enrollment.get("booker_email") or "").lower().strip()
        booker_phone = (enrollment.get("phone") or "").replace(" ", "").replace("-", "").replace("+", "").lstrip("0")
        participants = enrollment.get("participants", [])
        all_emails = {booker_email_v} | {(p.get("email") or "").lower().strip() for p in participants}
        all_phones = {booker_phone} | {
            (p.get("phone") or "").replace(" ", "").replace("-", "").replace("+", "").lstrip("0") for p in participants
        }
        all_emails.discard("")
        all_phones.discard("")

        for offer in special_offers:
            if not offer.get("enabled", True):
                continue
            offer_programs = offer.get("program_ids", [])
            if offer_programs and data.item_id and str(data.item_id) not in [str(p) for p in offer_programs]:
                continue
            offer_people = offer.get("people", [])
            matched = False
            for person in offer_people:
                person_email = (person.get("email") or "").lower().strip()
                person_phone = (person.get("phone") or "").replace(" ", "").replace("-", "").replace("+", "").lstrip("0")
                if person_email and person_email in all_emails:
                    matched = True
                    break
                if person_phone and person_phone in all_phones:
                    matched = True
                    break
            if matched:
                if offer.get("discount_type") == "fixed":
                    vip_discount = float(offer.get("discount_amount", 0))
                else:
                    vip_discount = round(total * float(offer.get("discount_pct", 0)) / 100, 2)
                vip_offer_name = offer.get("label", offer.get("code", "VIP"))
                logger.info("VIP offer '%s' matched: -%s", vip_offer_name, vip_discount)
                break
    except Exception as e:
        logger.warning("VIP offer check error: %s", e)

    # Cart UI stacks promo + group/combo/loyalty/cross-sell. VIP/special offer stays exclusive (single best).
    if vip_discount > 0:
        after_cart_deals = max(0.0, round(float(total) - float(vip_discount), 2))
    else:
        promo_d = float(promo_discount or 0)
        auto_d = float(disc_result.get("total_discount", 0)) if disc_result else 0.0
        after_cart_deals = max(0.0, round(float(total) - promo_d - auto_d, 2))

    final_total = float(after_cart_deals)

    # Portal Stripe (INR): charge taxable base after Client Garden CRM discount (no GST add-on), matching
    # Divine Cart / dashboard flows when `portal_checkout_cancel` is sent. Skip for pre-mixed admin totals.
    if (
        str(currency or "").lower() == "inr"
        and final_total > 0
        and enrollment.get("dashboard_mixed_total") is None
        and getattr(data, "portal_checkout_cancel", None) is True
    ):
        try:
            ss_inr = await db.site_settings.find_one(
                {"id": "site_settings"},
                {"_id": 0, "india_gst_percent": 1, "india_platform_charge_percent": 1},
            )
            booker_em = (enrollment.get("booker_email") or "").strip().lower()
            cid = (enrollment.get("client_id") or "").strip()
            cp_proj = {
                "_id": 0,
                "india_discount_percent": 1,
                "india_discount_member_bands": 1,
                "india_tax_enabled": 1,
                "india_tax_percent": 1,
                "india_tax_label": 1,
            }
            cp_doc = None
            if cid:
                cp_doc = await db.clients.find_one({"id": cid}, cp_proj)
            if not cp_doc and booker_em:
                cp_doc = await db.clients.find_one({"email": booker_em}, cp_proj)
            from utils.india_checkout_math import compute_india_checkout_breakdown

            br = compute_india_checkout_breakdown(
                float(final_total),
                cp_doc,
                ss_inr,
                max(1, int(participant_count or 1)),
            )
            if br:
                tx = float(br.get("taxable_inr") or 0)
                if tx > 0:
                    # Match Divine Cart: Math.round(taxableBase) whole rupees for Stripe.
                    final_total = float(int(round(tx)))
        except Exception as e:
            logger.warning("INR Stripe taxable base alignment error: %s", e)

    points_redeemed = 0
    points_discount = 0.0
    pre_points_total = float(final_total)
    try:
        from routes.points_logic import (
            fetch_points_config,
            available_balance,
            compute_points_redemption,
            normalize_email,
            flagship_blocks_points_redemption,
        )

        cfg_pts = await fetch_points_config(db)
        cart_prog_ids = [str(ci.get("program_id")) for ci in (data.cart_items or []) if ci.get("program_id")]
        blocked_flagship, _ = await flagship_blocks_points_redemption(
            db,
            cfg_pts,
            item_type=data.item_type or "",
            item_id=data.item_id or "",
            cart_program_ids=cart_prog_ids,
        )
        req_pts = 0 if blocked_flagship else int(data.points_to_redeem or 0)
        if cfg_pts["enabled"] and req_pts > 0 and final_total > 0:
            be_pts = normalize_email(enrollment.get("booker_email", ""))
            avail_pts = await available_balance(db, be_pts)
            points_redeemed, points_discount = compute_points_redemption(
                req_pts, float(final_total), currency, avail_pts, cfg_pts
            )
            final_total = max(0.0, round(float(final_total) - float(points_discount), 2))
    except Exception as e:
        logger.warning("Points redemption calc error: %s", e)

    if vip_discount > 0:
        await db.enrollments.update_one(
            {"id": enrollment_id},
            {"$set": {"vip_discount": vip_discount, "vip_offer_name": vip_offer_name}},
        )

    collection = "programs" if data.item_type == "program" else "sessions"
    item = await db[collection].find_one({"id": data.item_id}, {"_id": 0})
    await db.enrollments.update_one(
        {"id": enrollment_id},
        {
            "$set": {
                "item_type": data.item_type,
                "item_id": data.item_id,
                "item_title": item.get("title", "") if item else "",
            }
        },
    )

    if final_total <= 0:
        return {
            "kind": "free",
            "enrollment_id": enrollment_id,
            "data": data,
            "enrollment": enrollment,
            "currency": currency,
            "item": item,
            "participant_count": participant_count,
            "points_redeemed": points_redeemed,
            "points_discount": points_discount,
            "pre_points_total": pre_points_total,
        }

    if pricing_resp["security"]["country_mismatch"]:
        logger.warning(
            "Country mismatch for enrollment %s: IP=%s Claimed=%s",
            enrollment_id,
            pricing_resp["security"]["ip_country"],
            pricing_resp["security"]["claimed_country"],
        )

    stripe_currency = currency
    stripe_amount = float(final_total)
    if currency != "inr" and data.display_currency and data.display_currency != currency:
        from routes.currency import fetch_live_rates, convert_amount

        rates = await fetch_live_rates()
        converted = convert_amount(float(final_total), currency, data.display_currency, rates)
        if converted and converted > 0:
            stripe_currency = data.display_currency
            stripe_amount = float(converted)

    return {
        "kind": "paid",
        "enrollment_id": enrollment_id,
        "enrollment": enrollment,
        "data": data,
        "final_total": final_total,
        "currency": currency,
        "stripe_currency": stripe_currency,
        "stripe_amount": stripe_amount,
        "participant_count": participant_count,
        "item": item,
        "pricing_resp": pricing_resp,
        "points_redeemed": points_redeemed,
        "points_discount": points_discount,
        "pre_points_total": pre_points_total,
    }
