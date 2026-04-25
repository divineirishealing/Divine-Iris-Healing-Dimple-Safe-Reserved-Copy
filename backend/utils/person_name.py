"""Normalize human display names for Client Garden and related records."""

from __future__ import annotations

import re
from typing import Optional


def normalize_person_name(value: Optional[str]) -> str:
    """
    Title-style casing: first letter of each word upper, remaining letters lower.
    Hyphens and apostrophes split segments (e.g. O'Brien, Mary-Jane).
    """
    if value is None:
        return ""
    s = " ".join(str(value).split())
    if not s:
        return ""

    def cap_segment(seg: str) -> str:
        if not seg:
            return seg
        return seg[0].upper() + seg[1:].lower()

    def cap_token(tok: str) -> str:
        if not tok:
            return tok
        parts = re.split(r"([\-'])", tok)
        out: list[str] = []
        for p in parts:
            if p in "-'":
                out.append(p)
            else:
                out.append(cap_segment(p))
        return "".join(out)

    return " ".join(cap_token(w) for w in s.split(" "))
