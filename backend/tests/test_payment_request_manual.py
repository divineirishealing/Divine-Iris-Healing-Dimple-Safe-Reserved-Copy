from routes.payment_requests import MANUAL_PAYMENT_METHODS, _checkout_state_for_row


def test_manual_payment_methods_include_gpay_cash():
    assert "gpay" in MANUAL_PAYMENT_METHODS
    assert "cash" in MANUAL_PAYMENT_METHODS
    assert "stripe" in MANUAL_PAYMENT_METHODS


def test_checkout_state_single_payment():
    row = {"amount": 100, "installments_enabled": False, "status": "active"}
    state = _checkout_state_for_row(row)
    assert state["checkout_amount"] == 100
