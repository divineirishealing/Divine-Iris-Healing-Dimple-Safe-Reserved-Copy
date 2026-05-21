"""
Strip CRM India discount from checkout unless checkout is explicitly the Home Coming catalog path.

``dashboard_sacred_home_annual_program_id`` may match a flagship program (e.g. AWRP) that also
appears on Upcoming — HC courtesy % applies only when ``home_coming_catalog_checkout`` is true
(Sacred Home Home Coming package page), not for tier/upcoming enrollment of the same program id.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional


def checkout_program_ids_from_submit(data: Any) -> List[str]:
    """Program UUIDs in scope for this enrollment checkout (cart lines or single program item)."""
    cart_lines = getattr(data, "cart_items", None) or []
    if cart_lines:
        return [
            str(ci.get("program_id") or "").strip()
            for ci in cart_lines
            if ci.get("program_id") and str(ci.get("program_id") or "").strip()
        ]
    if (getattr(data, "item_type", None) or "") == "program" and getattr(data, "item_id", None):
        return [str(data.item_id).strip()]
    return []


def home_coming_catalog_checkout_from_context(ctx: Any) -> bool:
    """
    True when this checkout/enrollment is the Home Coming **catalog package** flow
    (``AnnualPackagePurchasePage`` → combined checkout), not Upcoming tier enrollment.
    """
    if ctx is None:
        return False
    if isinstance(ctx, dict):
        if ctx.get("home_coming_catalog_checkout") is True:
            return True
        try:
            inst = int(ctx.get("home_coming_pay_installment_n") or 0)
        except (TypeError, ValueError):
            inst = 0
        return inst >= 1
    if getattr(ctx, "home_coming_catalog_checkout", None) is True:
        return True
    try:
        inst = int(getattr(ctx, "home_coming_pay_installment_n", 0) or 0)
    except (TypeError, ValueError):
        inst = 0
    return inst >= 1


def filter_client_pricing_for_home_coming_checkout(
    client_pricing: Optional[Dict[str, Any]],
    *,
    pin_program_id: str,
    checkout_program_ids: List[str],
    home_coming_catalog_checkout: bool = False,
) -> Optional[Dict[str, Any]]:
    """
    After :func:`client_pricing_row_for_india_checkout`, choose which discount applies:

    * **Home Coming catalog checkout** (flag true + every line is the pinned program): apply
      ``home_coming_india_discount_*`` via ``_hc_india_discount_*``.
    * **Upcoming / other programs** (including the pinned id without catalog flag): keep client
      ``india_discount_*`` only; Home Coming courtesy is never applied.

    Ephemeral ``_hc_india_discount_*`` keys are always removed from the returned dict.
    """
    if not client_pricing:
        return client_pricing
    pin = (pin_program_id or "").strip()
    ids = [str(p).strip() for p in checkout_program_ids if p and str(p).strip()]
    allow = bool(
        home_coming_catalog_checkout and pin and ids and all(p == pin for p in ids)
    )
    out = dict(client_pricing)
    hc_pct = out.pop("_hc_india_discount_percent", None)
    hc_bands = out.pop("_hc_india_discount_member_bands", None)
    if allow:
        out["india_discount_percent"] = hc_pct
        out["india_discount_member_bands"] = hc_bands
        # Admin “extra” Sacred Home discount must never apply to Home Coming–only carts.
        out.pop("sacred_home_extra_discount_kind", None)
        out.pop("sacred_home_extra_discount_value", None)
        out.pop("sacred_home_extra_discount_per", None)
        return out
    return out
