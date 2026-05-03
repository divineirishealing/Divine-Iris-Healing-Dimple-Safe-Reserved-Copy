"""
Strip CRM India discount from checkout unless every cart line is the pinned Home Coming program.

``dashboard_sacred_home_annual_program_id`` identifies the Home Coming package; other programs never
receive ``home_coming_india_discount_*`` / merged courtesy % in enrollment India math.
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


def filter_client_pricing_for_home_coming_checkout(
    client_pricing: Optional[Dict[str, Any]],
    *,
    pin_program_id: str,
    checkout_program_ids: List[str],
) -> Optional[Dict[str, Any]]:
    """
    After :func:`client_pricing_row_for_india_checkout`, choose which discount applies:

    * **HC-only cart** (every line is ``dashboard_sacred_home_annual_program_id``): set
      ``india_discount_*`` from ``_hc_india_discount_*`` (Home Coming courtesy / legacy HC discount).
    * **Any other cart**: keep CRM ``india_discount_*`` on the client (other programs); Home Coming courtesy
      is not applied.

    Ephemeral ``_hc_india_discount_*`` keys are always removed from the returned dict.
    """
    if not client_pricing:
        return client_pricing
    pin = (pin_program_id or "").strip()
    ids = [str(p).strip() for p in checkout_program_ids if p and str(p).strip()]
    allow = bool(pin and ids and all(p == pin for p in ids))
    out = dict(client_pricing)
    hc_pct = out.pop("_hc_india_discount_percent", None)
    hc_bands = out.pop("_hc_india_discount_member_bands", None)
    if allow:
        out["india_discount_percent"] = hc_pct
        out["india_discount_member_bands"] = hc_bands
        return out
    return out
