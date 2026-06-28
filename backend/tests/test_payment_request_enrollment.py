from utils.payment_request_enrollment import (
    _enrollment_status_from_request,
    _resolve_catalog_fields,
    payment_link_enrollment_id,
)


def test_payment_link_enrollment_id_stable():
    rid = "abc-123-def"
    assert payment_link_enrollment_id(rid) == "PL-abc-123-def"


def test_enrollment_status_completed_when_request_paid():
    req = {"status": "paid"}
    tx = {"payment_status": "paid"}
    assert _enrollment_status_from_request(req, tx) == "completed"


def test_enrollment_status_partially_paid():
    req = {"status": "partially_paid"}
    tx = {"payment_status": "paid"}
    assert _enrollment_status_from_request(req, tx) == "partially_paid"


def test_resolve_catalog_fields_annual_package():
    req = {
        "id": "link-1",
        "title": "Home Coming — Priya",
        "item_type": "annual_package",
        "item_id": "PKG-HOME-COMING",
        "item_title": "Home Coming",
        "chosen_tier_label": "12-month annual",
    }
    tx = {"payment_status": "paid"}
    fields = _resolve_catalog_fields(req, tx)
    assert fields["item_type"] == "annual_package"
    assert fields["item_id"] == "PKG-HOME-COMING"
    assert fields["item_title"] == "Home Coming"
    assert fields["chosen_tier_label"] == "12-month annual"
