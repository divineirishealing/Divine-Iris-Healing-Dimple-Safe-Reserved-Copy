"""Home Coming (Iris Annual Abundance) CRM discount fields vs Dashboard Access ``india_discount_*``."""

from __future__ import annotations

from typing import Any, Dict, Optional


def home_coming_crm_discount_fields(client: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Discount % / bands that apply to **Home Coming package** catalog quotes and student package UI.

    Once ``home_coming_india_discount_percent`` or ``home_coming_india_discount_member_bands`` exists on
    the client document (Mongo key present — set from Iris Annual Abundance), those values are the
    only source for this math. Legacy ``india_discount_*`` remains for **Dashboard Access** and is
    ignored for Home Coming until the split fields are saved.
    """
    c = client or {}
    if "home_coming_india_discount_percent" in c or "home_coming_india_discount_member_bands" in c:
        return {
            "india_discount_percent": c.get("home_coming_india_discount_percent"),
            "india_discount_member_bands": c.get("home_coming_india_discount_member_bands"),
        }
    return {
        "india_discount_percent": c.get("india_discount_percent"),
        "india_discount_member_bands": c.get("india_discount_member_bands"),
    }


def client_pricing_row_for_india_checkout(client_slice: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Merge a Mongo client projection into the shape ``compute_india_checkout_breakdown`` expects."""
    if not client_slice:
        return None
    out = dict(client_slice)
    eff = home_coming_crm_discount_fields(client_slice)
    out["india_discount_percent"] = eff["india_discount_percent"]
    out["india_discount_member_bands"] = eff["india_discount_member_bands"]
    return out
