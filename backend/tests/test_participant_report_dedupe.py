"""Participant report dedupe: mixed-cart shadow rows vs solo checkouts."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017/test")
os.environ.setdefault("DB_NAME", "test")

from routes.india_payments import build_participant_report_rows


def _uhf_multi(*, eid: str, booker_email: str, participants: list) -> dict:
    return {
        "id": eid,
        "status": "completed",
        "item_type": "program",
        "item_id": "uhf-id",
        "item_title": "UNLEASH HER FIRE",
        "booker_name": participants[0]["name"],
        "booker_email": booker_email,
        "booker_country": "IN",
        "created_at": "2026-05-22T02:16:00Z",
        "participants": participants,
    }


def _solo(*, eid: str, booker_email: str, program_id: str, title: str, participant: dict) -> dict:
    return {
        "id": eid,
        "status": "completed",
        "item_type": "program",
        "item_id": program_id,
        "item_title": title,
        "booker_name": participant["name"],
        "booker_email": booker_email,
        "booker_country": "IN",
        "created_at": "2026-04-01T10:00:00Z",
        "participants": [{**participant, "program_id": program_id, "program_title": title}],
    }


def _txn(eid: str, *, amount: float, seats: int) -> dict:
    return {
        eid: [
            {
                "payment_status": "paid",
                "amount": amount,
                "currency": "inr",
                "participant_count": seats,
            }
        ]
    }


def _names(rows, program_substr: str) -> list:
    sub = program_substr.upper()
    return [
        r["participant_name"]
        for r in rows
        if sub in (r.get("program") or "").upper()
    ]


def test_shared_email_guest_not_dropped_when_booker_has_solo_awrp():
    """Anu + Prema (same email): Prema must remain on UHF when booker has solo AWRP."""
    multi = _uhf_multi(
        eid="DIH-51494-498",
        booker_email="anu2790@gmail.com",
        participants=[
            {
                "name": "Anu Kankariya",
                "email": "anu2790@gmail.com",
                "age": 36,
                "attendance_mode": "online",
                "country": "IN",
                "program_id": "uhf-id",
                "program_title": "UNLEASH HER FIRE",
            },
            {
                "name": "Prema Mehta",
                "email": "anu2790@gmail.com",
                "age": 60,
                "attendance_mode": "offline",
                "country": "IN",
                "program_id": "uhf-id",
                "program_title": "UNLEASH HER FIRE",
            },
        ],
    )
    solo = _solo(
        eid="DIH-ANU-SOLO",
        booker_email="anu2790@gmail.com",
        program_id="awrp-id",
        title="ATOMIC WEIGHT RELEASE PROGRAM",
        participant={
            "name": "Anu Kankariya",
            "email": "anu2790@gmail.com",
            "age": 36,
            "attendance_mode": "online",
            "country": "IN",
        },
    )
    txns = {**_txn("DIH-51494-498", amount=4200, seats=2), **_txn("DIH-ANU-SOLO", amount=14000, seats=1)}
    rows = build_participant_report_rows([multi, solo], txns)
    assert _names(rows, "UNLEASH") == ["Anu Kankariya", "Prema Mehta"]


def test_booker_not_dropped_on_uhf_when_solo_awrp_exists():
    """Asha on UHF multi-seat stays visible when she has a separate solo AWRP checkout."""
    multi = _uhf_multi(
        eid="DIH-51431-477",
        booker_email="asha.kotak1234@gmail.com",
        participants=[
            {
                "name": "Asha Kotak",
                "email": "asha.kotak1234@gmail.com",
                "age": 0,
                "attendance_mode": "online",
                "country": "TH",
                "program_id": "uhf-id",
                "program_title": "UNLEASH HER FIRE",
            },
            {
                "name": "Falak Asanani",
                "age": 16,
                "attendance_mode": "offline",
                "country": "IN",
                "program_id": "uhf-id",
                "program_title": "UNLEASH HER FIRE",
            },
        ],
    )
    solo = _solo(
        eid="DIH-SOLO-AWRP",
        booker_email="asha.kotak1234@gmail.com",
        program_id="awrp-id",
        title="ATOMIC WEIGHT RELEASE PROGRAM",
        participant={
            "name": "Asha Kotak",
            "email": "asha.kotak1234@gmail.com",
            "age": 0,
            "attendance_mode": "online",
            "country": "TH",
        },
    )
    txns = {**_txn("DIH-51431-477", amount=4200, seats=2), **_txn("DIH-SOLO-AWRP", amount=14000, seats=1)}
    rows = build_participant_report_rows([multi, solo], txns)
    assert _names(rows, "UNLEASH") == ["Asha Kotak", "Falak Asanani"]


def test_same_program_solo_still_dedupes_multi_seat_shadow():
    """Original intent: drop multi-seat echo when the same person already has a solo UHF checkout."""
    multi = _uhf_multi(
        eid="DIH-MULTI",
        booker_email="student@example.com",
        participants=[
            {
                "name": "Student",
                "email": "student@example.com",
                "age": 30,
                "attendance_mode": "online",
                "country": "IN",
                "program_id": "uhf-id",
                "program_title": "UNLEASH HER FIRE",
            },
            {
                "name": "Guest",
                "email": "guest@example.com",
                "age": 25,
                "attendance_mode": "offline",
                "country": "IN",
                "program_id": "uhf-id",
                "program_title": "UNLEASH HER FIRE",
            },
        ],
    )
    solo = _solo(
        eid="DIH-SOLO-UHF",
        booker_email="student@example.com",
        program_id="uhf-id",
        title="UNLEASH HER FIRE",
        participant={
            "name": "Student",
            "email": "student@example.com",
            "age": 30,
            "attendance_mode": "online",
            "country": "IN",
        },
    )
    txns = {**_txn("DIH-MULTI", amount=4200, seats=2), **_txn("DIH-SOLO-UHF", amount=2100, seats=1)}
    rows = build_participant_report_rows([multi, solo], txns)
    assert _names(rows, "UNLEASH") == ["Guest", "Student"]
