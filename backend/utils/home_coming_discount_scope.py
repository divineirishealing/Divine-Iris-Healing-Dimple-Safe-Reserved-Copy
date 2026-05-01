"""Iris Annual Abundance (client CRM) India discount applies only to the Sacred Home annual program."""

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
    Return a copy of ``client_pricing`` with ``india_discount_percent`` and
    ``india_discount_member_bands`` cleared unless every checkout program id
    matches ``dashboard_sacred_home_annual_program_id``.
    """
    if not client_pricing:
        return client_pricing
    pin = (pin_program_id or "").strip()
    ids = [str(p).strip() for p in checkout_program_ids if p and str(p).strip()]
    allow = bool(pin and ids and all(p == pin for p in ids))
    if allow:
        return client_pricing
    out = dict(client_pricing)
    out["india_discount_percent"] = None
    out["india_discount_member_bands"] = None
    return out
