from utils.awrp_intro_razorpay_plink import (
    normalize_phone,
    verify_payment_link_callback_signature,
)


def test_normalize_phone_india_ten_digit():
    assert normalize_phone("9876543210") == "+919876543210"


def test_plink_callback_signature():
    secret = "test_secret"
    sig = __import__("hmac").new(
        secret.encode(),
        b"plink_x|pay_y|paid|awrpintro250000",
        __import__("hashlib").sha256,
    ).hexdigest()
    assert verify_payment_link_callback_signature(
        payment_link_id="plink_x",
        payment_id="pay_y",
        status="paid",
        reference_id="awrpintro250000",
        signature=sig,
        key_secret=secret,
    )