"""Unit tests for personal session booking payload helpers."""
from utils.session_booking import (
    collect_session_bookings,
    session_booking_document_fields,
    booking_from_cart_item,
)


def test_collect_from_cart_items():
    rows = collect_session_bookings(
        cart_items=[{
            "program_id": "sess-1",
            "booking_date": "2026-08-15",
            "booking_time": "10:00 AM",
        }],
        item_type="program",
    )
    assert len(rows) == 1
    assert rows[0]["session_id"] == "sess-1"
    assert rows[0]["booking_date"] == "2026-08-15"
    assert rows[0]["booking_time"] == "10:00 AM"


def test_collect_deduplicates():
    rows = collect_session_bookings(
        session_booking_date="2026-08-15",
        session_booking_time="2:00 PM",
        item_type="session",
        item_id="sess-2",
        cart_items=[{
            "program_id": "sess-2",
            "booking_date": "2026-08-15",
            "booking_time": "2:00 PM",
        }],
    )
    assert len(rows) == 1


def test_document_fields_primary():
    rows = collect_session_bookings(
        session_booking_date="2026-08-20",
        session_booking_time="5:00 PM",
        item_type="session",
        item_id="s1",
        item_title="Healing Session",
    )
    doc = session_booking_document_fields(rows)
    assert doc["session_booking_date"] == "2026-08-20"
    assert doc["session_booking_time"] == "5:00 PM"
    assert len(doc["session_bookings"]) == 1


def test_booking_from_cart_item_empty_without_slot():
    assert booking_from_cart_item({"program_id": "x"}) is None
