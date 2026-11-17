"""Classify how a checkout started: Stripe, India landing, India QR, dashboard, pay link."""
from __future__ import annotations

from typing import Any, Dict, Optional

CHECKOUT_CHANNEL_LABELS: Dict[str, str] = {
    "stripe": "Stripe",
    "india_page": "India page",
    "india_qr": "India QR",
    "dashboard": "Dashboard",
    "payment_link": "Pay link",
}


def checkout_channel_label(channel: str) -> str:
    key = (channel or "").strip().lower()
    return CHECKOUT_CHANNEL_LABELS.get(key, "Stripe" if key == "website" else (key or "Stripe"))


def resolve_checkout_channel(enrollment: dict, txn: Optional[dict] = None) -> str:
    """
    Return a stable channel key for admin reports.
    - stripe: international website / Stripe Checkout
    - india_page: /india/* Razorpay form (incl. checkout_started before pay)
    - india_qr: Razorpay Payment Link scanned from poster / WhatsApp QR
    """
    e = enrollment or {}
    t = txn or {}

    if t.get("razorpay_payment_link"):
        return "india_qr"

    if e.get("payment_request_id") or e.get("enrollment_origin") == "payment_link":
        return "payment_link"
    if e.get("dashboard_checkout_ready") or e.get("dashboard_mixed_total") is not None:
        return "dashboard"

    created_via = str(t.get("created_via") or e.get("created_via") or "").strip().lower()
    if created_via == "india_landing_plink":
        return "india_qr"
    utm = e.get("ad_utm") if isinstance(e.get("ad_utm"), dict) else {}
    if str(utm.get("utm_medium") or "").strip().lower() == "razorpay_plink":
        return "india_qr"

    landing = str(e.get("landing_path") or "").strip()
    cart_items = e.get("cart_items") if isinstance(e.get("cart_items"), list) else []
    has_cart = len(cart_items) > 0
    india_site = e.get("india_site_checkout") in (True, "true", 1)

    if created_via == "india_landing" or landing.startswith("/india/") or has_cart or india_site:
        return "india_page"

    provider = str(t.get("payment_provider") or "").strip().lower()
    pm = str(t.get("payment_method") or e.get("payment_method") or "").strip().lower()
    session = str(t.get("stripe_session_id") or e.get("stripe_session_id") or "").strip()

    # Razorpay reuses stripe_session_id for rz_* internal session keys — not Stripe Checkout.
    if provider == "razorpay" or pm == "razorpay" or session.startswith("rz_") or t.get("razorpay_order_id") or t.get("razorpay_payment_id"):
        return "india_page"
    if str(e.get("booker_country") or "").upper() == "IN" and str(e.get("currency") or "").lower() == "inr":
        return "india_page"
    if str(e.get("currency") or "").lower() == "inr" and not session.startswith("cs_"):
        return "india_page"

    if provider == "stripe" or pm == "stripe" or session.startswith("cs_"):
        return "stripe"

    stored = str(e.get("checkout_channel") or "").strip().lower()
    if stored in CHECKOUT_CHANNEL_LABELS:
        return stored

    return "stripe"


def checkout_channel_fields(enrollment: dict, txn: Optional[dict] = None) -> Dict[str, Any]:
    channel = resolve_checkout_channel(enrollment, txn)
    return {
        "checkout_channel": channel,
        "checkout_channel_label": checkout_channel_label(channel),
        # Legacy bucket for existing filters (dashboard / payment_link / website)
        "enrollment_origin": _legacy_enrollment_origin(enrollment, channel),
    }


def _legacy_enrollment_origin(enrollment: dict, channel: str) -> str:
    if channel in ("dashboard", "payment_link"):
        return channel
    if channel in ("india_page", "india_qr"):
        return "website"
    return "website"