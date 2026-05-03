"""Home Coming courtesy fields vs CRM ``india_discount_*`` (other programs / Divine Cart)."""

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
    """Merge a Mongo client projection into the shape ``compute_india_checkout_breakdown`` + filter expect.

    ``india_discount_*`` on the document stay the **non–Home Coming** CRM fields (Divine Cart, other programs).
    Home Coming courtesy (split ``home_coming_*`` or legacy fallback) is attached as ``_hc_india_discount_*``
    for :func:`filter_client_pricing_for_home_coming_checkout` to apply only when the cart is HC-only.
    """
    if not client_slice:
        return None
    out = dict(client_slice)
    hc = home_coming_crm_discount_fields(client_slice)
    out["_hc_india_discount_percent"] = hc["india_discount_percent"]
    out["_hc_india_discount_member_bands"] = hc["india_discount_member_bands"]
    return out
