import pytest
from fastapi import HTTPException

from utils.razorpay_capture import (
    normalize_razorpay_payment_id,
    razorpay_payment_is_captured,
    require_captured_razorpay_payment,
)


def test_normalize_payment_id_adds_prefix():
    assert normalize_razorpay_payment_id("U1HtdLRGSEUuIl") == "pay_U1HtdLRGSEUuIl"
    assert normalize_razorpay_payment_id("pay_abc") == "pay_abc"


def test_captured_only():
    assert razorpay_payment_is_captured({"status": "captured", "amount": 99900})
    assert not razorpay_payment_is_captured({"status": "authorized", "amount": 99900})
    assert not razorpay_payment_is_captured({"status": "failed"})


def test_require_captured_rejects_authorized():
    with pytest.raises(HTTPException) as exc:
        require_captured_razorpay_payment({"status": "authorized", "amount": 99900})
    assert exc.value.status_code == 409