"""
Iris annual journey year labels (1–12). Used for subscriber access / display.
Automatic year = floor((today - subscription start_date) / 365 days) + 1, capped 1–12.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

# Year number -> display title & subtitle (tagline)
IRIS_JOURNEY_YEARS: Dict[int, Dict[str, str]] = {
    1: {"title": "Iris Essence", "subtitle": "The Presence"},
    2: {"title": "Iris Alchemy", "subtitle": "The Transformation"},
    3: {"title": "Iris Magic", "subtitle": "The Enchantment"},
    4: {"title": "Iris Zenith", "subtitle": "The Illumination"},
    5: {"title": "Iris Ether", "subtitle": "The Integration"},
    6: {"title": "Iris Infinity", "subtitle": "The Eternal"},
    7: {"title": "Iris Nirvana", "subtitle": "The Transcendence"},
    8: {"title": "Iris Mandala", "subtitle": "The Harmony"},
    9: {"title": "Iris Lumina", "subtitle": "The Pure Light"},
    10: {"title": "Iris Source", "subtitle": "The Divine Origin"},
    11: {"title": "Iris Aurora", "subtitle": "The New Dawn"},
    12: {"title": "Iris Stellaria", "subtitle": "The Cosmic Legacy"},
}


def iris_journey_catalog() -> List[Dict[str, Any]]:
    """Ordered list for API / admin UI."""
    out = []
    for y in range(1, 13):
        meta = IRIS_JOURNEY_YEARS[y]
        out.append({
            "year": y,
            "title": meta["title"],
            "subtitle": meta["subtitle"],
            "label": f"Year {y}: {meta['title']} — {meta['subtitle']}",
        })
    return out


def compute_auto_iris_year(start_date_str: Optional[str]) -> int:
    """
    Year 1 = from start_date through +364 days; each full 365-day block advances one year.
    Capped at 12. If start_date missing or invalid, returns 1.
    """
    if not start_date_str or not str(start_date_str).strip():
        return 1
    try:
        s = str(start_date_str).strip()[:10]
        parts = s.split("-")
        if len(parts) < 3:
            return 1
        y, m, d = int(parts[0]), int(parts[1]), int(parts[2])
        start = datetime(y, m, d, tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return 1
    now = datetime.now(timezone.utc)
    if now < start:
        return 1
    delta_days = (now - start).days
    elapsed = delta_days // 365
    return min(12, max(1, elapsed + 1))


def resolve_iris_journey(sub: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Resolve effective journey from subscription dict.
    mode 'manual' uses stored iris_year; 'auto' uses subscription start_date.
    """
    sub = sub or {}
    mode = (sub.get("iris_year_mode") or "manual").strip().lower()
    if mode not in ("manual", "auto"):
        mode = "manual"

    if mode == "auto":
        year = compute_auto_iris_year(sub.get("start_date"))
        is_auto_computed = True
    else:
        try:
            year = int(sub.get("iris_year") or 1)
        except (TypeError, ValueError):
            year = 1
        year = max(1, min(12, year))
        is_auto_computed = False

    meta = IRIS_JOURNEY_YEARS.get(year) or IRIS_JOURNEY_YEARS[12]
    return {
        "year": year,
        "title": meta["title"],
        "subtitle": meta["subtitle"],
        "label": f"Year {year}: {meta['title']} — {meta['subtitle']}",
        "mode": mode,
        "is_auto_computed": is_auto_computed,
    }
