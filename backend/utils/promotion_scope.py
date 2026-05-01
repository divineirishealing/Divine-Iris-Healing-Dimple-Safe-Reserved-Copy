"""
Program + duration-tier scope for promotions (coupons).

`applicable_tier_indices_by_program`: optional map program_id -> list of 0-based tier indices.
Missing key or empty list means any tier for that program.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

__all__ = [
    "build_cart_lines_from_payload",
    "promo_applies_to_cart_lines",
    "promo_line_in_scope",
    "eligible_participant_units_for_fixed_promo",
]


def _norm_pid(pid: Any) -> str:
    return str(pid or "").strip()


def build_cart_lines_from_payload(data: dict) -> List[Tuple[str, Optional[int]]]:
    """
    Build (program_id, tier_index) tuples from validate/checkout-style payloads.
    Accepts cart_items / cart_lines with program_id (or programId) and tier_index (or tierIndex).
    If no cart list, uses top-level program_id + tier_index.
    """
    raw_lines = data.get("cart_items") or data.get("cart_lines")
    out: List[Tuple[str, Optional[int]]] = []

    if isinstance(raw_lines, list) and raw_lines:
        for row in raw_lines:
            if not isinstance(row, dict):
                continue
            pid = row.get("program_id") if row.get("program_id") is not None else row.get("programId")
            if not _norm_pid(pid):
                continue
            ti = row.get("tier_index")
            if ti is None:
                ti = row.get("tierIndex")
            if ti is not None and ti != "":
                try:
                    ti_int: Optional[int] = int(ti)
                except (TypeError, ValueError):
                    ti_int = None
            else:
                ti_int = None
            out.append((_norm_pid(pid), ti_int))
        return out

    pid = data.get("program_id") if data.get("program_id") is not None else data.get("programId")
    if not _norm_pid(pid):
        return []
    ti = data.get("tier_index")
    if ti is None:
        ti = data.get("tierIndex")
    if ti is not None and ti != "":
        try:
            ti_top: Optional[int] = int(ti)
        except (TypeError, ValueError):
            ti_top = None
    else:
        ti_top = None
    return [(_norm_pid(pid), ti_top)]


def _normalized_tier_map(promo: dict) -> Dict[str, List[int]]:
    raw = promo.get("applicable_tier_indices_by_program") or {}
    if not isinstance(raw, dict):
        return {}
    tier_map: Dict[str, List[int]] = {}
    for k, v in raw.items():
        ks = _norm_pid(k)
        if not ks or not isinstance(v, list):
            continue
        ints: List[int] = []
        for x in v:
            if x is None or (isinstance(x, str) and not str(x).strip()):
                continue
            try:
                ints.append(int(x))
            except (TypeError, ValueError):
                continue
        if ints:
            tier_map[ks] = ints
    return tier_map


def promo_line_in_scope(promo: dict, program_id: str, tier: Optional[int]) -> bool:
    """True if this program + tier satisfies program list and tier map for the promo."""
    pid = _norm_pid(program_id)
    if not pid:
        return False
    applicable_to = (promo.get("applicable_to") or "all").strip()
    specific_ids = {
        _norm_pid(x) for x in (promo.get("applicable_program_ids") or []) if x is not None and _norm_pid(x)
    }
    if applicable_to == "specific" and pid not in specific_ids:
        return False
    tier_map = _normalized_tier_map(promo)
    allowed = tier_map.get(pid)
    if not allowed:
        return True
    if tier is None:
        return False
    try:
        ti = int(tier)
    except (TypeError, ValueError):
        return False
    return ti in allowed


def promo_applies_to_cart_lines(promo: dict, lines: List[Tuple[str, Optional[int]]]) -> Tuple[bool, str]:
    """
    Returns (ok, error_message). Empty error_message when ok.
    When lines is empty, program/tier rules are not enforced (legacy clients).
    """
    if not lines:
        return True, ""

    applicable_to = (promo.get("applicable_to") or "all").strip()
    specific_ids = {
        _norm_pid(x) for x in (promo.get("applicable_program_ids") or []) if x is not None and _norm_pid(x)
    }

    for pid, tier in lines:
        if not pid:
            continue
        if promo_line_in_scope(promo, pid, tier):
            continue
        if applicable_to == "specific" and pid not in specific_ids:
            return False, "This coupon is not valid for one or more programs in your cart"
        return False, "This coupon is not valid for the selected duration tier"

    return True, ""


def _cart_row_participant_count(row: dict) -> int:
    try:
        n = int(row.get("participants_count") or row.get("participantsCount") or 0)
    except (TypeError, ValueError):
        n = 0
    return max(1, n)


def _cart_row_pid_tier(row: dict) -> Optional[Tuple[str, Optional[int]]]:
    if not isinstance(row, dict):
        return None
    pid = row.get("program_id") if row.get("program_id") is not None else row.get("programId")
    pid = _norm_pid(pid)
    if not pid:
        return None
    ti = row.get("tier_index")
    if ti is None:
        ti = row.get("tierIndex")
    if ti is not None and ti != "":
        try:
            ti_int: Optional[int] = int(ti)
        except (TypeError, ValueError):
            ti_int = None
    else:
        ti_int = None
    return (pid, ti_int)


def eligible_participant_units_for_fixed_promo(
    promo: dict,
    data: dict,
    *,
    fallback_participants: int = 1,
) -> int:
    """
    Billable participant count for scaling fixed-amount promos when fixed_per_participant is True.
    Sums participants_count on in-scope cart lines; otherwise uses participant_count on the payload
    (single-program flow).
    """
    if not promo.get("fixed_per_participant"):
        return 1

    fb = max(1, int(fallback_participants or 1))

    raw = data.get("cart_items") or data.get("cart_lines")
    if isinstance(raw, list) and len(raw) > 0:
        total = 0
        for row in raw:
            if not isinstance(row, dict):
                continue
            details = _cart_row_pid_tier(row)
            if not details:
                continue
            pid, ti_int = details
            if not promo_line_in_scope(promo, pid, ti_int):
                continue
            total += _cart_row_participant_count(row)
        return max(1, total) if total > 0 else fb

    pid = data.get("program_id") if data.get("program_id") is not None else data.get("programId")
    pid = _norm_pid(pid)
    if not pid:
        return fb
    ti = data.get("tier_index")
    if ti is None:
        ti = data.get("tierIndex")
    if ti is not None and ti != "":
        try:
            ti_top: Optional[int] = int(ti)
        except (TypeError, ValueError):
            ti_top = None
    else:
        ti_top = None
    if not promo_line_in_scope(promo, pid, ti_top):
        return fb
    try:
        pc = int(data.get("participant_count") or data.get("participantCount") or fb)
    except (TypeError, ValueError):
        pc = fb
    return max(1, pc)
