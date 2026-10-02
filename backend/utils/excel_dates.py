"""Calendar dates for Excel import/export (DD/MM/YYYY display; YYYY-MM-DD in DB)."""
from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any, Optional, Tuple

_ISO_YMD_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")
_DD_MM_YYYY_RE = re.compile(r"^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$")


def iso_ymd_to_dd_mm_yyyy(iso: Any) -> Optional[str]:
    """``2026-04-01`` → ``01/04/2026``."""
    if iso is None:
        return None
    t = str(iso).strip()[:10]
    m = _ISO_YMD_RE.match(t)
    if not m:
        return None
    y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    try:
        date(y, mo, d)
    except ValueError:
        return None
    return f"{d:02d}/{mo:02d}/{y}"


def parse_calendar_date_to_iso(value: Any, label: str = "date") -> Tuple[Optional[str], Optional[str]]:
    """
    Accept ISO ``YYYY-MM-DD``, ``DD/MM/YYYY`` or ``DD-MM-YYYY``, or ``date``/``datetime`` cells.
    Returns ``(iso_yyyy_mm_dd, error_message)``.
    """
    if value is None:
        return None, None
    if isinstance(value, datetime):
        return value.date().isoformat(), None
    if isinstance(value, date):
        return value.isoformat(), None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        try:
            from openpyxl.utils.datetime import from_excel

            dt = from_excel(float(value))
            return dt.date().isoformat(), None
        except Exception:
            pass

    s = str(value).strip()
    if not s:
        return None, None

    if _ISO_YMD_RE.match(s[:10] if len(s) >= 10 else s):
        chunk = s[:10]
        try:
            datetime.strptime(chunk, "%Y-%m-%d")
            return chunk, None
        except ValueError:
            return None, f"invalid {label} (use DD/MM/YYYY)"

    m = _DD_MM_YYYY_RE.match(s)
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        try:
            return date(y, mo, d).isoformat(), None
        except ValueError:
            return None, f"invalid {label} (use DD/MM/YYYY)"

    return None, f"invalid {label} (use DD/MM/YYYY)"


def normalize_stored_date_field(val: Any) -> Optional[str]:
    """Normalize optional date strings on upload (ISO or DD/MM/YYYY) to ISO for storage."""
    iso, err = parse_calendar_date_to_iso(val, "date")
    if err:
        return None
    return iso
