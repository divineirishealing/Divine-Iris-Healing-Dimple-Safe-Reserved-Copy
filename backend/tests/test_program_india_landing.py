from utils.india_checkout_math import compute_india_checkout_breakdown
from utils.landing_checkout_validators import IndiaProgramLandingCheckoutBody


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