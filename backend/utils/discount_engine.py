"""Shared cart discount calculation (public site + annual portal Sacred Home)."""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Set

from utils.effective_pricing import resolve_program_offer

DISCOUNT_LAYER_KEYS = (
    "enable_group_discount",
    "group_discount_rules",
    "enable_combo_discount",
    "combo_discount_pct",
    "combo_min_programs",
    "combo_rules",
    "enable_loyalty",
    "loyalty_discount_pct",
    "enable_cross_sell",
    "cross_sell_rules",
)


def _annual_apply_flags(site_settings: dict) -> dict:
    raw = site_settings.get("discounts_apply_to_annual_portal") or {}
    return {
        "group": raw.get("group", True) is not False,
        "combo": raw.get("combo", True) is not False,
        "loyalty": raw.get("loyalty", True) is not False,
        "cross_sell": raw.get("cross_sell", True) is not False,
    }


def resolve_discount_settings(site_settings: dict, *, annual_portal: bool) -> dict:
    """Annual checkout: separate rules if enabled, else public rules gated by discounts_apply_to_annual_portal."""
    base = dict(site_settings or {})
    if not annual_portal:
        return base
    block = base.get("dashboard_discount_settings") or {}
    if block.get("enabled"):
        merged = {**base}
        for k in DISCOUNT_LAYER_KEYS:
            if k in block:
                merged[k] = block[k]
        return merged
    flags = _annual_apply_flags(base)
    merged = {**base}
    if not flags["group"]:
        merged["enable_group_discount"] = False
    if not flags["combo"]:
        merged["enable_combo_discount"] = False
    if not flags["loyalty"]:
        merged["enable_loyalty"] = False
    if not flags["cross_sell"]:
        merged["enable_cross_sell"] = False
    return merged


def _discount_bool(doc: dict, key: str, default: bool = False) -> bool:
    if not doc or key not in doc:
        return default
    v = doc[key]
    if v is None:
        return default
    return bool(v)


def _qualifying_program_count(
    program_ids: List[Any], rule: dict, *, excluded: Optional[Set[str]] = None
) -> int:
    ex = excluded or set()
    ids = [str(p) for p in (program_ids or []) if p and str(p) not in ex]
    allowed = rule.get("program_ids") or []
    if allowed:
        allow: Set[str] = {str(x) for x in allowed}
        ids = [p for p in ids if p in allow]
    return len(set(ids))


async def _combo_excluded_program_ids(db, program_ids: List[Any]) -> Set[str]:
    ids = [str(p) for p in (program_ids or []) if p]
    if not ids:
        return set()
    excluded: Set[str] = set()
    async for doc in db.programs.find(
        {"id": {"$in": ids}}, {"_id": 0, "id": 1, "exclude_from_combo_discount": 1}
    ):
        if doc.get("exclude_from_combo_discount"):
            excluded.add(str(doc["id"]))
    return excluded


async def _combo_eligible_subtotal(
    db,
    *,
    cart_items: List[dict],
    program_ids: List[Any],
    excluded: Set[str],
    currency: str,
    subtotal: float,
) -> float:
    """Pre-group cart subtotal for lines that count toward combo discount."""
    from routes.enrollment import _per_person_price_for_program

    cur = (currency or "aed").lower()
    ids = {str(p) for p in (program_ids or []) if p}
    eligible_ids = {p for p in ids if p not in excluded}
    if not eligible_ids:
        return 0.0

    if cart_items:
        total = 0.0
        for ci in cart_items:
            pid = str(ci.get("program_id") or "").strip()
            if not pid or pid not in eligible_ids:
                continue
            program = await db.programs.find_one({"id": pid}, {"_id": 0})
            if not program:
                continue
            try:
                npc = int(ci.get("participants_count") or 0)
            except (TypeError, ValueError):
                npc = 0
            if npc <= 0:
                npc = 1
            per = _per_person_price_for_program(program, ci.get("tier_index"), cur)
            total += round(float(per) * npc, 2)
        if total > 0:
            return total

    if subtotal > 0 and ids:
        eligible_count = len(eligible_ids)
        cart_count = len(ids)
        if cart_count > 0:
            return round(subtotal * eligible_count / cart_count, 2)
    return subtotal if eligible_ids else 0.0


async def calculate_cart_discounts(settings: dict, data: dict, db) -> dict:
    subtotal = float(data.get("subtotal") or 0)
    num_participants = int(data.get("num_participants") or 1)
    num_programs = int(data.get("num_programs") or 1)
    email = (data.get("email") or "").strip()
    program_ids = data.get("program_ids") or []
    cart_items = data.get("cart_items") or []
    remaining = subtotal

    group_discount = 0
    combo_discount = 0
    loyalty_discount = 0
    combo_code = ""

    if settings.get("enable_group_discount") and num_participants > 1:
        rules = settings.get("group_discount_rules") or []
        rules_sorted = sorted(rules, key=lambda r: r.get("min_participants", 0), reverse=True)
        for rule in rules_sorted:
            if num_participants >= int(rule.get("min_participants") or 999):
                group_discount = round(remaining * float(rule.get("discount_pct") or 0) / 100)
                remaining -= group_discount
                break

    currency = (data.get("currency") or "aed").lower()
    combo_excluded: Set[str] = set()
    if program_ids:
        combo_excluded = await _combo_excluded_program_ids(db, program_ids)

    if settings.get("enable_combo_discount"):
        combo_rules = settings.get("combo_rules") or []
        if combo_rules:
            rules_sorted = sorted(combo_rules, key=lambda r: int(r.get("min_programs") or 0), reverse=True)
            for rule in rules_sorted:
                min_p = int(rule.get("min_programs") or 999)
                if rule.get("program_ids") or program_ids:
                    qualifying = _qualifying_program_count(program_ids, rule, excluded=combo_excluded)
                else:
                    qualifying = (
                        _qualifying_program_count(program_ids, {}, excluded=combo_excluded)
                        if program_ids
                        else int(num_programs)
                    )
                if qualifying >= min_p and min_p >= 2:
                    pct = float(rule.get("discount_pct") or 0)
                    eligible_pre = await _combo_eligible_subtotal(
                        db,
                        cart_items=cart_items,
                        program_ids=program_ids,
                        excluded=combo_excluded,
                        currency=currency,
                        subtotal=subtotal,
                    )
                    share = (eligible_pre / subtotal) if subtotal > 0 else 1.0
                    combo_base = remaining * share
                    combo_discount = round(combo_base * pct / 100)
                    combo_code = rule.get("code") or f"COMBO{min_p}"
                    remaining -= combo_discount
                    break
        else:
            qualifying = (
                _qualifying_program_count(program_ids, {}, excluded=combo_excluded)
                if program_ids
                else int(num_programs)
            )
            if qualifying >= int(settings.get("combo_min_programs") or 2):
                pct = float(settings.get("combo_discount_pct") or 0)
                eligible_pre = await _combo_eligible_subtotal(
                    db,
                    cart_items=cart_items,
                    program_ids=program_ids,
                    excluded=combo_excluded,
                    currency=currency,
                    subtotal=subtotal,
                )
                share = (eligible_pre / subtotal) if subtotal > 0 else 1.0
                combo_base = remaining * share
                combo_discount = round(combo_base * pct / 100)
                combo_code = "COMBO"
                remaining -= combo_discount

    if settings.get("enable_loyalty") and email:
        enrollment = await db.enrollments.find_one(
            {"booker_email": email, "participants.uid": {"$exists": True, "$ne": ""}},
            {"_id": 0},
        )
        if enrollment:
            pct = float(settings.get("loyalty_discount_pct") or 0)
            loyalty_discount = round(remaining * pct / 100)

    cross_sell_discount = 0
    cross_sell_details: List[dict] = []
    if _discount_bool(settings, "enable_cross_sell", False) and program_ids and len(program_ids) >= 2:
        cross_sell_rules = settings.get("cross_sell_rules") or []
        pid_set = {str(p) for p in program_ids}
        cart_tier_set = set()
        for ci in cart_items:
            pid = str(ci.get("program_id", "") or "").strip()
            if not pid:
                continue
            raw_tier = ci.get("tier_index")
            if raw_tier is None or raw_tier == "":
                tier_key = "0"
            else:
                tier_key = str(raw_tier)
            cart_tier_set.add((pid, tier_key))

        for rule in cross_sell_rules:
            if not rule.get("enabled", True):
                continue
            buy_id = str(rule.get("buy_program_id", ""))
            buy_tier = str(rule.get("buy_tier", ""))

            buy_match = False
            if buy_tier and buy_tier not in ("None", ""):
                buy_match = (buy_id, buy_tier) in cart_tier_set
            else:
                buy_match = buy_id in pid_set

            if not buy_match:
                continue

            targets = rule.get("targets") or []
            if not targets and rule.get("get_program_id"):
                targets = [
                    {
                        "program_id": rule["get_program_id"],
                        "tier": rule.get("get_tier", ""),
                        "discount_value": rule.get("discount_value", 0),
                        "discount_type": rule.get("discount_type", "percentage"),
                    }
                ]

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
                        currency = (data.get("currency", "usd") or "usd").lower()
                        tiers = target_prog.get("duration_tiers") or []
                        cart_line = next(
                            (ci for ci in cart_items if str(ci.get("program_id", "")).strip() == get_id),
                            None,
                        )
                        raw_line_tier = cart_line.get("tier_index") if cart_line else None
                        ti: Optional[int] = None
                        if get_tier and get_tier not in ("None", ""):
                            ti = int(get_tier) if str(get_tier).isdigit() else 0
                        elif raw_line_tier is not None and raw_line_tier != "":
                            try:
                                ti = int(raw_line_tier)
                            except (TypeError, ValueError):
                                ti = 0
                        else:
                            ti = 0
                        target_price = 0.0
                        if tiers and ti is not None and 0 <= ti < len(tiers):
                            offer_p, _, _ = resolve_program_offer(target_prog, ti, currency)
                            row = tiers[ti]
                            target_price = float(offer_p or 0) or float(row.get(f"price_{currency}", 0) or 0)
                        if target_price <= 0 and tiers:
                            offer_p, _, _ = resolve_program_offer(target_prog, 0, currency)
                            row0 = tiers[0]
                            target_price = float(offer_p or 0) or float(row0.get(f"price_{currency}", 0) or 0)
                        if target_price <= 0:
                            offer_p, _, _ = resolve_program_offer(target_prog, None, currency)
                            target_price = float(offer_p or 0) or float(
                                target_prog.get(f"price_{currency}", 0) or 0
                            )
                        amt = int(round(target_price * float(disc_val) / 100))
                        if amt > 0:
                            cross_sell_discount += amt
                            cross_sell_details.append(
                                {"rule": rule.get("label", ""), "code": rule.get("code", ""), "amount": amt}
                            )
                else:
                    cross_sell_discount += disc_val
                    cross_sell_details.append(
                        {"rule": rule.get("label", ""), "code": rule.get("code", ""), "amount": disc_val}
                    )

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