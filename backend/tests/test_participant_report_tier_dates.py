"""Enrollment report tier dates: prefer checkout/payment cohort over live catalog."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017/test")
os.environ.setdefault("DB_NAME", "test")

from routes.india_payments import (
    _resolve_chosen_tier_fields_for_report,
    build_participant_report_rows,
)


MMM_PROGRAM = {
    "id": "mmm-id",
    "title": "Money Magic Multiplier",
    "duration_tiers": [
        {
            "label": "1 Month",
            "start_date": "2026-06-22",
            "end_date": "2026-07-12",
            "price_inr": 32080,
        }
    ],
}


def test_stale_june_snapshot_corrected_to_april_payment_cohort():
    """April payment with live catalog on June should show April batch, not June."""
    enrollment = {
        "id": "DIH-1",
        "status": "completed",
        "item_type": "program",
        "item_id": "mmm-id",
        "chosen_start_date": "2026-06-22",
        "chosen_end_date": "2026-07-12",
        "chosen_tier_label": "1 Month",
        "created_at": "2026-04-18T11:34:00Z",
        "participants": [{"name": "Jyoti", "city": "Ajmer", "attendance_mode": "offline"}],
    }
    txn = {"paid_at": "2026-04-18T11:34:00Z", "payment_status": "paid", "amount": 32080, "currency": "inr"}

    resolved = _resolve_chosen_tier_fields_for_report(
        enrollment,
        txn,
        item_type="program",
        catalog_pid="mmm-id",
        tier_index=0,
        programs_by_id={"mmm-id": MMM_PROGRAM},
        is_done=True,
    )
    assert resolved["chosen_start_date"] == "2026-04-22"
    assert resolved["chosen_end_date"] == "2026-05-12"
    assert resolved["tier_dates_source"] == "payment_cohort_inferred"

    rows = build_participant_report_rows(
        [enrollment],
        txns_by_eid={"DIH-1": [txn]},
        programs_by_id={"mmm-id": MMM_PROGRAM},
    )
    assert len(rows) == 1
    assert rows[0]["chosen_start_date"] == "2026-04-22"


def test_enrollment_snapshot_preserved_when_not_stale():
    enrollment = {
        "chosen_start_date": "2026-04-22",
        "chosen_end_date": "2026-05-12",
        "chosen_tier_label": "1 Month",
        "created_at": "2026-04-18T11:34:00Z",
    }
    txn = {"paid_at": "2026-04-18T11:34:00Z", "payment_status": "paid"}

    resolved = _resolve_chosen_tier_fields_for_report(
        enrollment,
        txn,
        item_type="program",
        catalog_pid="mmm-id",
        tier_index=0,
        programs_by_id={"mmm-id": MMM_PROGRAM},
        is_done=True,
    )
    assert resolved["chosen_start_date"] == "2026-04-22"
    assert resolved["tier_dates_source"] == "enrollment_snapshot"


def test_portal_cohort_batch_id_wins_over_inference():
    enrollment = {
        "created_at": "2026-04-18T11:34:00Z",
        "chosen_tier_label": "1 Month",
    }
    txn = {"paid_at": "2026-04-18T11:34:00Z", "payment_status": "paid"}

    resolved = _resolve_chosen_tier_fields_for_report(
        enrollment,
        txn,
        item_type="program",
        catalog_pid="mmm-id",
        tier_index=0,
        programs_by_id={"mmm-id": MMM_PROGRAM},
        is_done=True,
        portal_cohort="2026-03",
    )
    assert resolved["chosen_start_date"] == "2026-03-22"
    assert resolved["tier_dates_source"] == "portal_cohort_batch"
