"""Personal session appointment date/time chosen at booking."""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def normalize_booking_date(raw: Any) -> str:
    s = str(raw or "").strip()[:10]
    return s if _DATE_RE.match(s) else ""


def normalize_booking_time(raw: Any) -> str:
    s = str(raw or "").strip()
    return s[:48] if s else ""


def _booking_row(
    *,
    session_id: str = "",
    session_title: str = "",
    booking_date: str = "",
    booking_time: str = "",
) -> Optional[dict]:
    d = normalize_booking_date(booking_date)
    t = normalize_booking_time(booking_time)
    if not d and not t:
        return None
    return {
        "session_id": str(session_id or "").strip(),
        "session_title": str(session_title or "").strip(),
        "booking_date": d,
        "booking_time": t,
    }


def booking_from_cart_item(ci: dict) -> Optional[dict]:
    if not isinstance(ci, dict):
        return None
    return _booking_row(
        session_id=str(ci.get("program_id") or ci.get("session_id") or "").strip(),
        session_title=str(ci.get("session_title") or ci.get("item_title") or "").strip(),
        booking_date=ci.get("booking_date") or ci.get("session_booking_date"),
        booking_time=ci.get("booking_time") or ci.get("session_booking_time"),
    )


def collect_session_bookings(
    *,
    cart_items: Optional[list] = None,
    session_bookings: Optional[list] = None,
    session_booking_date: Optional[str] = None,
    session_booking_time: Optional[str] = None,
    item_type: Optional[str] = None,
    item_id: Optional[str] = None,
    item_title: Optional[str] = None,
) -> List[dict]:
    out: List[dict] = []
    seen: set[tuple] = set()

    def add(row: Optional[dict]) -> None:
        if not row:
            return
        key = (row.get("session_id") or "", row.get("booking_date") or "", row.get("booking_time") or "")
        if key in seen:
            return
        seen.add(key)
        out.append(row)

    for sb in session_bookings or []:
        if not isinstance(sb, dict):
            continue
        add(
            _booking_row(
                session_id=sb.get("session_id") or sb.get("item_id"),
                session_title=sb.get("session_title") or sb.get("item_title"),
                booking_date=sb.get("booking_date") or sb.get("session_booking_date"),
                booking_time=sb.get("booking_time") or sb.get("session_booking_time"),
            )
        )

    for ci in cart_items or []:
        add(booking_from_cart_item(ci))

    if str(item_type or "").strip().lower() == "session":
        add(
            _booking_row(
                session_id=item_id,
                session_title=item_title,
                booking_date=session_booking_date,
                booking_time=session_booking_time,
            )
        )

    return out


def primary_session_booking(bookings: List[dict]) -> Dict[str, str]:
    if not bookings:
        return {"session_booking_date": "", "session_booking_time": ""}
    first = bookings[0]
    return {
        "session_booking_date": first.get("booking_date") or "",
        "session_booking_time": first.get("booking_time") or "",
    }


def session_booking_document_fields(bookings: List[dict]) -> dict:
    return {
        **primary_session_booking(bookings),
        "session_bookings": bookings,
    }


def resolve_session_booking_fields(
    *,
    enrollment: Optional[dict] = None,
    cart_items: Optional[list] = None,
    item_type: Optional[str] = None,
    item_id: Optional[str] = None,
    item_title: Optional[str] = None,
) -> dict:
    en = enrollment or {}
    bookings = collect_session_bookings(
        cart_items=cart_items,
        session_bookings=en.get("session_bookings"),
        session_booking_date=en.get("session_booking_date"),
        session_booking_time=en.get("session_booking_time"),
        item_type=item_type or en.get("item_type"),
        item_id=item_id or en.get("item_id"),
        item_title=item_title or en.get("item_title"),
    )
    return session_booking_document_fields(bookings)
