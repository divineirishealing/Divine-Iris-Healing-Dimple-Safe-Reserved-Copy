"""INR checkout totals after cart discounts — mirrors frontend `computeIndiaCheckoutBreakdown` (indiaClientPricing.js)."""

from __future__ import annotations

import math
from typing import Any, Dict, Optional


def _parse_percent(val: Any, default: float) -> float:
    try:
        if val is None:
            return default
        n = float(val)
        return n if math.isfinite(n) else default
    except (TypeError, ValueError):
        return default


def _resolve_india_discount_rule(cp: Dict[str, Any], member_count: int) -> Dict[str, Any]:
    bands = cp.get("india_discount_member_bands")
    n = max(0, int(member_count))
    if isinstance(bands, list) and len(bands) > 0:
        for b in bands:
            if not isinstance(b, dict):
                continue
            lo = max(0, int(b.get("min") or 0))
            hi_raw = b.get("max")
            hi = lo if hi_raw is None else max(lo, int(hi_raw))
            if n < lo or n > hi:
                continue
            amt_raw = b.get("amount")
            if amt_raw is None:
                amt_raw = b.get("amount_inr")
            if amt_raw is not None and amt_raw != "" and float(amt_raw) > 0:
                return {
                    "mode": "amount",
                    "amount_inr": float(amt_raw),
                    "percent": 0.0,
                    "label": "Group discount",
                }
            p = b.get("percent")
            if p is not None and p != "":
                pf = float(p)
                if math.isfinite(pf) and pf >= 0:
                    return {
                        "mode": "percent",
                        "amount_inr": 0.0,
                        "percent": pf,
                        "label": "Group discount",
                    }
    raw_disc = cp.get("india_discount_percent")
    has_client = raw_disc is not None and raw_disc != ""
    if has_client:
        return {
            "mode": "percent",
            "amount_inr": 0.0,
            "percent": float(raw_disc) or 0.0,
            "label": "India discount",
        }
    return {
        "mode": "percent",
        "amount_inr": 0.0,
        "percent": 0.0,
        "label": "No client discount",
    }


def _extra_sacred_home_discount_inr(after_crm_discount: float, cp: Dict[str, Any], member_count: int) -> float:
    """Optional admin extra discount (Dashboard access). Never used on HC-only carts (caller strips keys)."""
    base = max(0.0, float(after_crm_discount))
    if base <= 0:
        return 0.0
    kind = str(cp.get("sacred_home_extra_discount_kind") or "").strip().lower()
    if kind not in ("percent", "inr"):
        return 0.0
    raw_val = cp.get("sacred_home_extra_discount_value")
    if raw_val is None or raw_val == "":
        return 0.0
    try:
        val = float(raw_val)
    except (TypeError, ValueError):
        return 0.0
    if not math.isfinite(val) or val <= 0:
        return 0.0
    per = str(cp.get("sacred_home_extra_discount_per") or "cart").strip().lower()
    mult = max(1, int(member_count)) if per in ("participant", "per_participant") else 1
    if kind == "inr":
        return min(base, val * mult)
    pct = max(0.0, min(100.0, val))
    return base * pct / 100.0


def _apply_rule_to_base(base: float, rule: Dict[str, Any]) -> float:
    b = max(0.0, float(base))
    if not math.isfinite(b) or b <= 0:
        return 0.0
    if rule.get("mode") == "amount" and float(rule.get("amount_inr") or 0) > 0:
        return min(b, float(rule["amount_inr"]))
    pct = float(rule.get("percent") or 0)
    return (b * pct) / 100.0


def compute_india_checkout_breakdown(
    effective_base: float,
    client_pricing: Optional[Dict[str, Any]],
    site_settings: Optional[Dict[str, Any]],
    member_count: int,
) -> Optional[Dict[str, Any]]:
    """
    effective_base: INR after enrollment/cart promo, VIP, auto discounts, points (matches Razorpay/India flows).
    Returns line items for GST + platform on taxable (after optional CRM India discount), or None if base invalid.
    """
    base = float(effective_base)
    if not math.isfinite(base) or base <= 0:
        return None

    s = site_settings or {}
    platform_pct = _parse_percent(s.get("india_platform_charge_percent"), 3.0)
    site_gst = _parse_percent(s.get("india_gst_percent"), 18.0)

    cp = dict(client_pricing or {})
    rule = _resolve_india_discount_rule(cp, member_count)
    discount_amt = _apply_rule_to_base(base, rule)

    if client_pricing:
        tax_enabled = bool(cp.get("india_tax_enabled"))
    else:
        tax_enabled = True

    if not tax_enabled:
        gst_pct = 0.0
    elif bool(cp.get("india_tax_enabled")):
        gst_pct = _parse_percent(cp.get("india_tax_percent"), site_gst)
    else:
        gst_pct = site_gst

    taxable = max(0.0, base - discount_amt)
    extra_inr = _extra_sacred_home_discount_inr(taxable, cp, member_count)
    taxable = max(0.0, taxable - extra_inr)
    gst_amt = (taxable * gst_pct) / 100.0
    platform_amt = (taxable * platform_pct) / 100.0
    final = taxable + gst_amt + platform_amt
    rounded = float(round(final))
    return {
        "list_price_inr": round(base, 2),
        "india_discount_inr": round(discount_amt, 2),
        "sacred_home_extra_discount_inr": round(extra_inr, 2),
        "taxable_inr": round(taxable, 2),
        "gst_pct": gst_pct,
        "gst_inr": round(gst_amt, 2),
        "platform_pct": platform_pct,
        "platform_inr": round(platform_amt, 2),
        "charged_total_inr": round(final, 2),
        "rounded_total_inr": rounded,
    }


def compute_india_checkout_rounded_total(
    effective_base: float,
    client_pricing: Optional[Dict[str, Any]],
    site_settings: Optional[Dict[str, Any]],
    member_count: int,
) -> float:
    """
    effective_base: INR amount after cart-level promo / VIP / auto discounts.
    Returns rounded integer INR (Stripe paise / whole rupees as used elsewhere).
    """
    b = compute_india_checkout_breakdown(effective_base, client_pricing, site_settings, member_count)
    return b["rounded_total_inr"] if b else 0.0
