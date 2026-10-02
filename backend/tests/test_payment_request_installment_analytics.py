from utils.payment_request_installment_analytics import (
    build_annual_installment_analytics,
    is_annual_installment_payment_link,
)


def test_is_annual_link_by_item_type():
    assert is_annual_installment_payment_link(
        {"installments_enabled": True, "item_type": "annual_package"}
    )


def test_build_report_slots_and_summary():
    row = {
        "id": "pr-1",
        "title": "Home Coming 2025",
        "recipient_name": "Jane",
        "recipient_email": "jane@example.com",
        "status": "partially_paid",
        "installments_enabled": True,
        "installment_plan": "quarter_then_monthly",
        "num_installments": 3,
        "installment_amounts": [250.0, 250.0, 250.0],
        "amount": 750.0,
        "currency": "inr",
        "chosen_start_date": "2025-04-01",
        "item_type": "annual_package",
        "installment_payments": [
            {"number": 1, "amount": 250.0, "paid_at": "2025-04-01T10:00:00+00:00"},
        ],
    }
    report = build_annual_installment_analytics([row])
    assert report["summary"]["member_count"] == 1
    assert report["members"][0]["installments_paid"] == 1
    slots = report["members"][0]["installment_slots"]
    assert slots[0]["status"] == "paid"
    assert slots[1]["status"] in ("overdue", "due", "pending")
