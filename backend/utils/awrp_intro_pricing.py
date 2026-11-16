"""INR amount for AWRP Intro Call — matches enrollment checkout logic."""
from __future__ import annotations

from typing import Any, Dict, Optional

from utils.effective_pricing import resolve_program_offer


def resolve_awrp_intro_inr(program: Optional[Dict[str, Any]], *, tier_index: int = 0) -> float:
    if not program:
        return 0.0
    tiers = program.get("duration_tiers") or []
    ti: Optional[int] = None
    if tiers:
        ti = tier_index if 0 <= tier_index < len(tiers) else 0

    offer, _, _ = resolve_program_offer(program, ti, "inr")
    if offer and float(offer) > 0:
        return float(offer)

    if ti is not None and 0 <= ti < len(tiers):
        listed = float(tiers[ti].get("price_inr") or 0)
        if listed > 0:
            return listed
    return float(program.get("price_inr") or 0)