from utils.checkout_channel import resolve_checkout_channel, checkout_channel_label


def test_india_qr_from_payment_link_flag():
    e = {"created_via": "india_landing", "landing_path": "/india/program/x"}
    t = {"razorpay_payment_link": True, "payment_provider": "razorpay"}
    assert resolve_checkout_channel(e, t) == "india_qr"


def test_india_page_form_checkout_started():
    e = {
        "status": "checkout_started",
        "created_via": "india_landing",
        "landing_path": "/india/program/x",
    }
    t = {"payment_provider": "razorpay", "payment_status": "pending", "created_via": "india_landing"}
    assert resolve_checkout_channel(e, t) == "india_page"


def test_stripe_website():
    e = {"currency": "usd"}
    t = {"payment_provider": "stripe", "stripe_session_id": "cs_test_123"}
    assert resolve_checkout_channel(e, t) == "stripe"
    assert checkout_channel_label("india_qr") == "India QR"


def test_india_cart_rz_session_not_stripe():
    e = {"currency": "inr", "cart_items": [{"program_id": "p1"}], "booker_country": "IN"}
    t = {"payment_provider": "razorpay", "stripe_session_id": "rz_abc123", "payment_status": "pending"}
    assert resolve_checkout_channel(e, t) == "india_page"