"""Canonical IDs for long-lived entities (Client Garden, portal users).

- ``new_entity_id()``: UUID v7 (time-ordered) for Mongo ``id`` fields.
- ``new_internal_diid()``: branded internal reference; store on clients only — do not
  expose on student-facing API responses (see /api/auth/me and curated portal payloads).
"""

from __future__ import annotations

import re
import secrets
from datetime import datetime, timezone
from typing import Optional, Tuple

from uuid6 import uuid7

# Annual membership DIID (Client Garden): four letters (2 first + 2 last) + YYMM — unique per subscriber.
_ANNUAL_DIID_RE = re.compile(r"^[A-Za-z]{4}\d{4}$")


def new_entity_id() -> str:
    return str(uuid7())


def _parse_created_at(created_at_iso: str) -> datetime:
    s = (created_at_iso or "").strip()
    if not s:
        return datetime.now(timezone.utc)
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        return datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _name_initial_segment(name: str) -> str:
    """Four A–Z letters from display name (first name + last name when possible)."""

    parts = (name or "").strip().split()

    def letters(w: str) -> str:
        return "".join(c for c in w.upper() if c.isalpha())

    if len(parts) >= 2:
        a = letters(parts[0])[:2].ljust(2, "X")
        b = letters(parts[-1])[:2].ljust(2, "X")
        return (a + b)[:4]
    if len(parts) == 1:
        p = letters(parts[0])
        return (p + "XXXX")[:4]
    return "XXXX"


def normalize_annual_diid(raw: str) -> str:
    return (raw or "").strip().upper()


def validate_annual_diid_format(raw: str) -> bool:
    return bool(_ANNUAL_DIID_RE.match(normalize_annual_diid(raw)))


def annual_diid_yy_mm_from_iso(date_iso: str) -> Optional[Tuple[int, int]]:
    """Return (yy, mm) in UTC from YYYY-MM-DD or ISO datetime string."""

    s = (date_iso or "").strip()
    if not s:
        return None
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        if len(s) >= 10 and s[4] == "-" and s[7] == "-":
            dt = datetime.strptime(s[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
        else:
            dt = datetime.fromisoformat(s)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    dt = dt.astimezone(timezone.utc)
    return (dt.year % 100, dt.month)


def suggest_annual_diid_from_name(name: str, start_date_iso: str) -> Optional[str]:
    """Build FFLlYYMM from display name and subscription start date (no uniqueness check)."""

    yy_mm = annual_diid_yy_mm_from_iso(start_date_iso)
    if not yy_mm:
        return None
    yy, mm = yy_mm
    initials = _name_initial_segment(name)
    return f"{initials}{yy:02d}{mm:02d}"


def new_internal_diid(name: str, created_at_iso: str) -> str:
    """
    Internal DIID, format: DIID-{INITIALS}{YYMM}-{8-hex}
    INITIALS = four letters from name; YYMM from created_at (UTC).
    """

    dt = _parse_created_at(created_at_iso)
    initials = _name_initial_segment(name)
    yy = dt.year % 100
    mm = dt.month
    suffix = secrets.token_hex(4).upper()
    return f"DIID-{initials}{yy:02d}{mm:02d}-{suffix}"
