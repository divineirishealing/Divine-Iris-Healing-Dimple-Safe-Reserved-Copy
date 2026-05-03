"""
Shared pricing/validation for enrollment Stripe and Razorpay checkout.
Keeps a single source of truth for discounts, points, and currency rules.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Awaitable, Dict, Optional, TYPE_CHECKING

from fastapi import HTTPException, Request

if TYPE_CHECKING:
    from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


def snapshot_chosen_tier_from_program(program: Optional[dict], tier_index: Any) -> Dict[str, str]:
    """
    Fields to persist on the enrollment: the catalog tier row the booker selected
    (label + start/end). Admin reports prefer these over re-deriving from live catalog.
    """
    if not isinstance(program, dict):
        return {}
    tiers = program.get("duration_tiers") or []
    try:
        ti = int(tier_index) if tier_index is not None and str(tier_index).strip() != "" else None
    except (TypeError, ValueError):
        ti = None
    if ti is None or ti < 0 or ti >= len(tiers):
        return {}
    row = tiers[ti]
    if not isinstance(row, dict):
        return {}
    sd = str(row.get("start_date") or "").strip()
    ed = str(row.get("end_date") or "").strip()
    lab = str(row.get("label") or "").strip()
    out: Dict[str, str] = {}
    if sd:
        out["chosen_start_date"] = sd
    if ed:
        out["chosen_end_date"] = ed
    if lab:
        out["chosen_tier_label"] = lab
    return out


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

    from routes.india_payments import display_program_title_for_enrollment

    free_item_title = display_program_title_for_enrollment(
        enrollment,
        enrollment.get("participants"),
        item,
    )

    transaction = {
        "id": str(uuid.uuid4()),
        "enrollment_id": enrollment_id,
        "stripe_session_id": fake_session_id,
        "item_type": data.item_type,
        "item_id": data.item_id,
        "item_title": free_item_title,
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
        resolve_client_pricing_hub_override,
    )

    ip_country, vpn_detected = await detect_ip_info(request)
    server_currency = get_base_currency(ip_country, vpn_detected)
    claimed_currency = (data.currency or "usd").lower()

    inr_override = False
    booker_email = enrollment.get("booker_email", "").lower().strip()
    booker_hub = None

    email_hub = await resolve_booker_pricing_hub_email(booker_email)
    client_id = (enrollment.get("client_id") or "").strip()
    client_hub = await resolve_client_pricing_hub_override(client_id)
    booker_hub = client_hub or email_hub
    if booker_hub:
        server_currency = booker_hub

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

    server_display_currency = booker_hub if booker_hub else get_display_currency(ip_country, vpn_detected)
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
            from utils.promotion_scope import (
                build_cart_lines_from_payload,
                eligible_participant_units_for_fixed_promo,
                fixed_promo_scales_with_participants,
                promo_applies_to_cart_lines,
            )

            promo = await db.promotions.find_one({"code": data.promo_code.strip().upper(), "active": True}, {"_id": 0})
            if promo:
                ci = data.cart_items or []
                scope_payload = (
                    {"cart_items": ci}
                    if ci
                    else {"program_id": data.item_id, "tier_index": data.tier_index}
                )
                lines = build_cart_lines_from_payload(scope_payload)
                ok_scope, err_scope = promo_applies_to_cart_lines(promo, lines)
                if not ok_scope:
                    logger.info("Promo not applied (scope): %s", err_scope)
                    promo = None
            if promo:
                discount_type = promo.get("discount_type", "percentage")
                if discount_type == "percentage":
                    pct = promo.get("discount_percentage", 0)
                    promo_discount = round(total * pct / 100, 2)
                else:
                    base = float(promo.get(f"discount_{currency}", promo.get("discount_aed", 0)))
                    pl = {
                        "cart_items": data.cart_items or [],
                        "program_id": data.item_id,
                        "tier_index": data.tier_index,
                        "participant_count": participant_count,
                    }
                    units_fp = eligible_participant_units_for_fixed_promo(
                        promo, pl, fallback_participants=participant_count
                    )
                    mult = units_fp if fixed_promo_scales_with_participants(promo) else 1
                    promo_discount = round(base * mult, 2)
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

    # Trust UI-declared INR slice when (a) Divine Cart sends portal_checkout_cancel, or (b) checkout
    # references the pinned Home Coming annual program — public /cart/checkout omits the portal flag
    # but still sends client_declared_payable for EMI rows.
    _portal = getattr(data, "portal_checkout_cancel", None) is True
    _hc_annual_checkout = False
    try:
        if str(currency or "").lower() == "inr":
            ss_pin = await db.site_settings.find_one(
                {"id": "site_settings"},
                {"_id": 0, "dashboard_sacred_home_annual_program_id": 1},
            )
            pin_hc = str((ss_pin or {}).get("dashboard_sacred_home_annual_program_id") or "").strip()
            if pin_hc:
                if str(getattr(data, "item_id", None) or "").strip() == pin_hc and getattr(
                    data, "item_type", None
                ) == "program":
                    _hc_annual_checkout = True
                else:
                    for ci in data.cart_items or []:
                        if isinstance(ci, dict) and str(ci.get("program_id") or "").strip() == pin_hc:
                            _hc_annual_checkout = True
                            break
    except Exception as e:
        logger.warning("Home Coming annual pin check for declared slice: %s", e)

    _trust_client_declared_slice = _portal or _hc_annual_checkout

    # Sacred Home / Home Coming: roster can price ₹0 (current seat already inside annual) while the
    # portal sends client_declared_payable from the catalog renewal reference. Dashboard Stripe only.
    _decl_lift = getattr(data, "client_declared_payable", None)
    if (
        _decl_lift is not None
        and float(final_total) <= 0
        and _trust_client_declared_slice
    ):
        try:
            _dl = float(_decl_lift)
            if _dl > 0:
                final_total = round(_dl, 2)
        except (TypeError, ValueError):
            pass

    # Divine Cart / Sacred Home: one EMI or renewal slice is often far below server catalog `get_enrollment_pricing`
    # total. Trust the portal-declared rupees (capped at server total) so Stripe matches the checkout UI.
    if _trust_client_declared_slice and _decl_lift is not None:
        try:
            dcap = float(_decl_lift)
            if dcap >= 0 and dcap > 0:
                ft_cap = float(final_total)
                if ft_cap > 0:
                    final_total = round(min(ft_cap, dcap), 2)
                else:
                    final_total = round(dcap, 2)
        except (TypeError, ValueError):
            pass

    # Portal Stripe (INR): charge taxable base after Client Garden CRM discount (no GST add-on), matching
    # Divine Cart / dashboard flows when `portal_checkout_cancel` is sent. Skip for pre-mixed admin totals.
    if (
        str(currency or "").lower() == "inr"
        and final_total > 0
        and enrollment.get("dashboard_mixed_total") is None
        and _trust_client_declared_slice
    ):
        try:
            ss_inr = await db.site_settings.find_one(
                {"id": "site_settings"},
                {
                    "_id": 0,
                    "india_gst_percent": 1,
                    "india_platform_charge_percent": 1,
                    "dashboard_sacred_home_annual_program_id": 1,
                },
            )
            booker_em = (enrollment.get("booker_email") or "").strip().lower()
            cid = (enrollment.get("client_id") or "").strip()
            cp_proj = {
                "_id": 0,
                "india_discount_percent": 1,
                "india_discount_member_bands": 1,
                "home_coming_india_discount_percent": 1,
                "home_coming_india_discount_member_bands": 1,
                "sacred_home_extra_discount_kind": 1,
                "sacred_home_extra_discount_value": 1,
                "sacred_home_extra_discount_per": 1,
                "india_tax_enabled": 1,
                "india_tax_percent": 1,
                "india_tax_label": 1,
            }
            cp_doc = None
            if cid:
                cp_doc = await db.clients.find_one({"id": cid}, cp_proj)
            if not cp_doc and booker_em:
                cp_doc = await db.clients.find_one({"email": booker_em}, cp_proj)
            from utils.home_coming_crm_fields import client_pricing_row_for_india_checkout

            cp_doc = client_pricing_row_for_india_checkout(cp_doc)
            from utils.home_coming_discount_scope import (
                checkout_program_ids_from_submit,
                filter_client_pricing_for_home_coming_checkout,
            )

            pin_hc = str((ss_inr or {}).get("dashboard_sacred_home_annual_program_id") or "").strip()
            chk_ids = checkout_program_ids_from_submit(data)
            cp_doc = filter_client_pricing_for_home_coming_checkout(
                cp_doc,
                pin_program_id=pin_hc,
                checkout_program_ids=chk_ids,
            )
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

    # Snap Stripe charge to UI when within tolerance (portal INR allows larger drift: bundle/quote vs DB tiers).
    declared = getattr(data, "client_declared_payable", None)
    if declared is not None and float(final_total) > 0:
        try:
            d = float(declared)
            if d >= 0:
                cur = float(final_total)
                diff = abs(cur - d)
                is_portal = _trust_client_declared_slice
                if str(currency or "").lower() == "inr":
                    tol = 500.0 if is_portal else 5.0
                else:
                    tol = 1.0 if is_portal else 0.05
                if diff <= tol + 1e-9:
                    final_total = round(d, 2)
        except (TypeError, ValueError):
            pass

    if vip_discount > 0:
        await db.enrollments.update_one(
            {"id": enrollment_id},
            {"$set": {"vip_discount": vip_discount, "vip_offer_name": vip_offer_name}},
        )

    collection = "programs" if data.item_type == "program" else "sessions"
    item = await db[collection].find_one({"id": data.item_id}, {"_id": 0})
    item_set: Dict[str, Any] = {
        "item_type": data.item_type,
        "item_id": data.item_id,
        "item_title": item.get("title", "") if item else "",
    }
    if data.item_type == "program":
        item_set.update(snapshot_chosen_tier_from_program(item, getattr(data, "tier_index", None)))
    await db.enrollments.update_one(
        {"id": enrollment_id},
        {"$set": item_set},
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
    hub_lower = (booker_hub or "").lower() if booker_hub else None
    cur_lower = str(currency or "").lower()
    if hub_lower and hub_lower == cur_lower and data.display_currency and data.display_currency != hub_lower:
        data.display_currency = hub_lower
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
