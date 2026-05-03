"""Home Coming (Iris Annual Abundance) CRM discount fields vs Dashboard Access ``india_discount_*``."""

from __future__ import annotations

from typing import Any, Dict, Optional


def home_coming_crm_discount_fields(client: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Discount % / bands for the **Sacred Home Home Coming catalog package only** (quotes, package UI,
    and India checkout math after :func:`filter_client_pricing_for_home_coming_checkout`).

    These fields must **not** affect other program checkouts. Once ``home_coming_india_discount_percent``
    or ``home_coming_india_discount_member_bands`` exists on the client (set from Iris Annual Abundance),
    they are the source for Home Coming. Legacy ``india_discount_*`` is used only until split fields are saved.
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
