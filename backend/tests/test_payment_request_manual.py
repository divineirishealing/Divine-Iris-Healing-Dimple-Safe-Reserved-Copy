from routes.payment_requests import (
    MANUAL_PAYMENT_METHODS,
    _checkout_state_for_row,
    _down_then_emi_amounts,
    _quarter_plus_nine_monthly_amounts,
)


def test_manual_payment_methods_include_gpay_cash():
    assert "gpay" in MANUAL_PAYMENT_METHODS
    assert "cash" in MANUAL_PAYMENT_METHODS
    assert "stripe" in MANUAL_PAYMENT_METHODS


def test_checkout_state_single_payment():
    row = {"amount": 100, "installments_enabled": False, "status": "active"}
    state = _checkout_state_for_row(row)
    assert state["checkout_amount"] == 100


def test_checkout_state_pay_as_you_wish():
    row = {
        "amount": 500,
        "pay_as_you_wish": True,
        "minimum_amount": 100,
        "installments_enabled": False,
        "status": "active",
    }
    state = _checkout_state_for_row(row)
    assert state["pay_as_you_wish"] is True
    assert state["suggested_amount"] == 500
    assert state["minimum_amount"] == 100
    assert state["checkout_amount"] == 0


def test_quarter_plus_nine_monthly_splits_twelve_months():
    amounts = _quarter_plus_nine_monthly_amounts(1200.0)
    assert len(amounts) == 10
    assert amounts[0] == 300.0
    assert amounts[1] == 100.0
    assert sum(amounts) == 1200.0


def test_checkout_state_annual_emi_first_is_quarter():
    row = {
        "amount": 1200,
        "installments_enabled": True,
        "installment_plan": "quarter_then_monthly",
        "num_installments": 10,
        "installment_amounts": _quarter_plus_nine_monthly_amounts(1200),
        "installments_paid": 0,
    }
    state = _checkout_state_for_row(row)
    assert state["checkout_amount"] == 300.0
    assert state["num_installments"] == 10


def test_down_then_emi_custom_percent():
    amounts = _down_then_emi_amounts(1000.0, 30.0, 6)
    assert len(amounts) == 7
    assert amounts[0] == 300.0
    assert sum(amounts) == 1000.0
    assert len(set(amounts[1:])) <= 2  # equal EMIs ± cent remainder
