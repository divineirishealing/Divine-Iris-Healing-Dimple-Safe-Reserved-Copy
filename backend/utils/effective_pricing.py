"""Resolve early-bird vs regular offer prices based on early_bird_date."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple


def _parse_pricing_date(date_str: Any) -> Optional[datetime]:
    if not date_str or not str(date_str).strip():
        return None
    s = str(date_str).strip()
    try:
        if "T" in s:
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        else:
            dt = datetime.fromisoformat(f"{s}T23:59:59")
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, TypeError):
        return None


def is_early_bird_active(source: Optional[Dict[str, Any]]) -> bool:
    if not source:
        return False
    end = _parse_pricing_date(source.get("early_bird_date"))
    if not end:
        return False
    now = datetime.now(timezone.utc)
    return now <= end.astimezone(timezone.utc)


def _price_field(source: Dict[str, Any], prefix: str, currency: str) -> float:
    key = f"{prefix}_{currency.lower()}"
    try:
        return float(source.get(key, 0) or 0)
    except (TypeError, ValueError):
        return 0.0


def resolve_effective_offer(
    source: Optional[Dict[str, Any]], currency: str
) -> Tuple[float, str, bool]:
    """Return (effective_offer_price, badge_text, is_early_bird)."""
    if not source:
        return 0.0, "", False
    cur = (currency or "aed").lower()
    if is_early_bird_active(source):
        eb = _price_field(source, "early_bird_price", cur)
        if eb > 0:
            text = str(source.get("early_bird_text") or "Early Bird").strip()
            return eb, text, True
    offer = _price_field(source, "offer_price", cur)
    text = str(source.get("offer_text") or "").strip()
    return offer, text, False


def resolve_program_offer(
    program: Dict[str, Any], tier_index: Optional[int], currency: str
) -> Tuple[float, str, bool]:
    tiers = program.get("duration_tiers") or []
    ti: Optional[int] = None
    if tier_index is not None and str(tier_index).strip() != "":
        try:
            ti = int(tier_index)
        except (TypeError, ValueError):
            ti = None
    if tiers and ti is not None and 0 <= ti < len(tiers):
        return resolve_effective_offer(tiers[ti], currency)
    return resolve_effective_offer(program, currency)
