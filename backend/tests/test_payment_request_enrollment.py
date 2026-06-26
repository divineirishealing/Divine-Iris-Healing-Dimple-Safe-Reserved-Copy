from utils.payment_request_enrollment import (
    _enrollment_status_from_request,
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
