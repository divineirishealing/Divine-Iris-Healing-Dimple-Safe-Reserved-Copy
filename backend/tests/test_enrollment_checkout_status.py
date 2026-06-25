from utils.enrollment_checkout_status import (
    effective_enrollment_status,
    reconcile_enrollment_with_paid_transaction,
    transaction_is_paid,
)
import asyncio


def test_transaction_is_paid():
    assert transaction_is_paid({"payment_status": "paid"})
    assert transaction_is_paid({"payment_status": "Complete"})
    assert not transaction_is_paid({"payment_status": "pending"})
    assert not transaction_is_paid(None)


def test_effective_enrollment_status_prefers_paid_transaction():
    enrollment = {"status": "checkout_started"}
    txn = {"payment_status": "paid"}
    assert effective_enrollment_status(enrollment, txn) == "completed"


def test_effective_enrollment_status_keeps_completed():
    enrollment = {"status": "completed"}
    txn = {"payment_status": "pending"}
    assert effective_enrollment_status(enrollment, txn) == "completed"


class _FakeEnrollments:
    def __init__(self, doc):
        self.doc = doc
        self.updates = []

    async def find_one(self, query, projection=None):
        if query.get("id") == self.doc.get("id"):
            return dict(self.doc)
        return None

    async def update_one(self, query, update):
        self.updates.append((query, update))
        if query.get("id") == self.doc.get("id"):
            self.doc.update(update.get("$set", {}))


class _FakeDb:
    def __init__(self, enrollment):
        self.enrollments = _FakeEnrollments(enrollment)


def test_reconcile_enrollment_with_paid_transaction():
    enrollment = {"id": "e1", "status": "checkout_started"}
    db = _FakeDb(enrollment)
    txn = {"payment_status": "paid", "payment_provider": "stripe", "paid_at": "2026-06-25T00:00:00Z"}

    updated = asyncio.run(reconcile_enrollment_with_paid_transaction(db, "e1", txn, enrollment=enrollment))
    assert updated is True
    assert enrollment["status"] == "completed"
    assert db.enrollments.updates


def test_reconcile_skips_already_completed():
    enrollment = {"id": "e1", "status": "completed"}
    db = _FakeDb(enrollment)
    txn = {"payment_status": "paid"}

    updated = asyncio.run(reconcile_enrollment_with_paid_transaction(db, "e1", txn, enrollment=enrollment))
    assert updated is False
    assert not db.enrollments.updates
