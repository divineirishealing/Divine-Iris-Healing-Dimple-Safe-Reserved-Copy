from utils.india_checkout_math import compute_india_checkout_breakdown
from utils.landing_checkout_validators import IndiaProgramLandingCheckoutBody


def test_india_program_landing_charges_catalog_inr_without_gst_stack():
    """Generic /india/program/* landings match card price (unlike portal cart GST math)."""
    import asyncio
    from routes import program_india_landing as mod

    program = {"id": "p1", "title": "Stress Detox", "price_inr": 1200, "offer_price_inr": 999}

    list_inr, charged_inr, br = asyncio.run(mod._inr_totals(program, 0))
    assert list_inr == 999.0
    assert charged_inr == 999.0
    assert br["rounded_total_inr"] == 999.0
    assert br.get("landing_price_all_inclusive") is True


def test_india_landing_checkout_normalizes_ten_digit_phone():
    body = IndiaProgramLandingCheckoutBody(
        name="Test User",
        email="test@example.com",
        phone="9876543210",
    )
    assert body.phone == "+919876543210"


def test_india_checkout_breakdown_adds_gst():
    ss = {"india_gst_percent": 18, "india_platform_charge_percent": 3}
    br = compute_india_checkout_breakdown(1000.0, None, ss, 1)
    assert br is not None
    assert br["rounded_total_inr"] > 1000.0