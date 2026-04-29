"""Canonical Client Garden labels, legacy aliases, and tier/styling helpers."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional, Set

LABEL_DEW = "Dew — The Spark (Inquiry)."
LABEL_SEED = "Seed — The Potential (Workshop)."
LABEL_ROOT = "Root — The Grounding (Personal Session)."
LABEL_BLOOM = "Bloom — The Unfolding (Repeat Client)."
LABEL_IRIS_SEEKER = "Iris — The Seeker."

IRIS_YEAR_LABELS: Dict[int, str] = {
    1: "Year 1: Iris Essence — The Presence.",
    2: "Year 2: Iris Alchemy — The Transformation.",
    3: "Year 3: Iris Magic — The Enchantment.",
    4: "Year 4: Iris Zenith — The Illumination.",
    5: "Year 5: Iris Ether — The Integration.",
    6: "Year 6: Iris Infinity — The Eternal.",
    7: "Year 7: Iris Nirvana — The Transcendence.",
    8: "Year 8: Iris Mandala — The Harmony.",
    9: "Year 9: Iris Lumina — The Pure Light.",
    10: "Year 10: Iris Source — The Divine Origin.",
    11: "Year 11: Iris Aurora — The New Dawn.",
    12: "Year 12: Iris Stellaria — The Cosmic Legacy.",
}

LABEL_PURPLE_BEES = "Purple Bees — The Messengers (Referral Partners)."
LABEL_IRIS_BEES = "Iris Bees — Brand Ambassadors"

ORDERED_JOURNEY_LABELS: List[str] = [
    LABEL_DEW,
    LABEL_SEED,
    LABEL_ROOT,
    LABEL_BLOOM,
    LABEL_IRIS_SEEKER,
] + [IRIS_YEAR_LABELS[i] for i in range(1, 13)] + [
    LABEL_PURPLE_BEES,
    LABEL_IRIS_BEES,
]

CANONICAL_LABEL_SET: Set[str] = set(ORDERED_JOURNEY_LABELS)

LEGACY_TO_CANONICAL: Dict[str, str] = {
    "Dew": LABEL_DEW,
    "Seed": LABEL_SEED,
    "Root": LABEL_ROOT,
    "Bloom": LABEL_BLOOM,
    "Iris": IRIS_YEAR_LABELS[1],
    "Purple Bees": LABEL_PURPLE_BEES,
    "Iris Bees": LABEL_IRIS_BEES,
    "dew": LABEL_DEW,
    "seed": LABEL_SEED,
    "root": LABEL_ROOT,
    "bloom": LABEL_BLOOM,
    "iris": IRIS_YEAR_LABELS[1],
    "purple bees": LABEL_PURPLE_BEES,
    "iris bees": LABEL_IRIS_BEES,
    "Iris - The Seeker": LABEL_IRIS_SEEKER,
    "Iris — The Seeker": LABEL_IRIS_SEEKER,
    "Iris The Seeker": LABEL_IRIS_SEEKER,
    "iris - the seeker": LABEL_IRIS_SEEKER,
    "iris the seeker": LABEL_IRIS_SEEKER,
}

LABEL_DESCRIPTIONS: Dict[str, str] = {
    LABEL_DEW: "Inquired or expressed interest — The Spark.",
    LABEL_SEED: "Joined a workshop — The Potential.",
    LABEL_ROOT: "Converted to a flagship program — The Grounding.",
    LABEL_BLOOM: "Multiple programs or repeat client — The Unfolding.",
    LABEL_IRIS_SEEKER: "Exploring before or beside the annual journey — The Seeker.",
    **{IRIS_YEAR_LABELS[i]: f"Annual journey — year {i} of 12." for i in range(1, 13)},
    LABEL_PURPLE_BEES: "Referral partners — The Messengers.",
    LABEL_IRIS_BEES: "Brand Ambassadors.",
}


def iris_label_for_year(year: int) -> str:
    y = max(1, min(12, int(year)))
    return IRIS_YEAR_LABELS[y]


def normalize_label(s: Optional[str]) -> str:
    t = (s or "").strip()
    if not t:
        return ""
    if t in CANONICAL_LABEL_SET:
        return t
    if t in LEGACY_TO_CANONICAL:
        return LEGACY_TO_CANONICAL[t]
    return t


def is_allowed_manual_label(s: Optional[str]) -> bool:
    t = normalize_label(s)
    return t in CANONICAL_LABEL_SET


def label_filter_variants(param: str) -> List[str]:
    """MongoDB ``$in`` values so filters accept short legacy names or canonical strings."""
    p = (param or "").strip()
    if not p:
        return []
    out: Set[str] = {p}
    n = normalize_label(p)
    out.add(n)
    for leg, can in LEGACY_TO_CANONICAL.items():
        if can == n or leg.lower() == p.lower():
            out.add(leg)
            out.add(can)
    return [x for x in out if x]


def label_stripe_key(label: Optional[str]) -> str:
    """Stable bucket for row colors (Excel export, etc.)."""
    n = normalize_label(label or "")
    if n == LABEL_DEW:
        return "dew"
    if n == LABEL_SEED:
        return "seed"
    if n == LABEL_ROOT:
        return "root"
    if n == LABEL_BLOOM:
        return "bloom"
    if n == LABEL_IRIS_SEEKER:
        return "iris_seeker"
    if n == LABEL_PURPLE_BEES:
        return "purple_bees"
    if n == LABEL_IRIS_BEES:
        return "iris_bees"
    for i in range(1, 13):
        if n == IRIS_YEAR_LABELS[i]:
            return "iris"
    return "dew"


def iris_year_from_garden_label(label: Optional[str]) -> Optional[int]:
    """If ``label`` is canonical ``Year n: Iris …``, return *n*; else ``None``."""
    n = normalize_label(label or "")
    for i in range(1, 13):
        if n == IRIS_YEAR_LABELS[i]:
            return i
    return None


def iris_anniversary_year_from_client(client_doc: dict) -> int:
    """Which Iris year (1–12) from ``annual_subscription.start_date``, else 1."""
    sub = client_doc.get("annual_subscription") or {}
    start = sub.get("start_date") or ""
    if isinstance(start, str) and len(start) >= 10:
        try:
            d0 = datetime.strptime(start[:10], "%Y-%m-%d").date()
            today = datetime.now(timezone.utc).date()
            months = (today.year - d0.year) * 12 + (today.month - d0.month)
            if today.day < d0.day:
                months -= 1
            yr = months // 12 + 1
            return max(1, min(12, yr))
        except ValueError:
            pass
    return 1


def client_tier_from_label(label: Optional[str]) -> int:
    """Student portal tier from garden label (supports legacy short names)."""
    key = label_stripe_key(label)
    if key in ("dew", "seed", "iris_seeker"):
        return 1
    if key in ("root", "bloom"):
        return 2
    if key in ("iris", "purple_bees", "iris_bees"):
        return 4
    return 1
