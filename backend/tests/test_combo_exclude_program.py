"""Combo discount respects exclude_from_combo_discount on programs."""
import asyncio
import pytest

from utils.discount_engine import calculate_cart_discounts


class _FakeCursor:
    def __init__(self, docs):
        self._docs = docs

    def __aiter__(self):
        self._i = 0
        return self

    async def __anext__(self):
        if self._i >= len(self._docs):
            raise StopAsyncIteration
        doc = self._docs[self._i]
        self._i += 1
        return doc


class FakeDB:
    def __init__(self, programs, enrollments=None):
        self.programs = _Programs(programs)
        self.enrollments = _Enrollments(enrollments or [])


class _Programs:
    def __init__(self, by_id):
        self._by_id = by_id

    def find(self, query, projection):
        ids = (query.get("id") or {}).get("$in") or []
        docs = [
            {"id": pid, "exclude_from_combo_discount": self._by_id[pid].get("exclude_from_combo_discount")}
            for pid in ids
            if pid in self._by_id
        ]
        return _FakeCursor(docs)

    async def find_one(self, query, projection):
        pid = query.get("id")
        return self._by_id.get(pid)


class _Enrollments:
    def __init__(self, items):
        self._items = items

    async def find_one(self, *args, **kwargs):
        return self._items[0] if self._items else None


@pytest.mark.asyncio
async def test_combo_excludes_flagged_program_from_discount_base():
    intro_id = "intro-id"
    prog_b = "prog-b"
    prog_c = "prog-c"
    programs = {
        intro_id: {
            "id": intro_id,
            "exclude_from_combo_discount": True,
            "duration_tiers": [],
            "price_inr": 2500.0,
        },
        prog_b: {
            "id": prog_b,
            "exclude_from_combo_discount": False,
            "duration_tiers": [],
            "price_inr": 10000.0,
        },
        prog_c: {
            "id": prog_c,
            "exclude_from_combo_discount": False,
            "duration_tiers": [],
            "price_inr": 10000.0,
        },
    }
    db = FakeDB(programs)
    settings = {
        "enable_combo_discount": True,
        "combo_rules": [
            {
                "min_programs": 2,
                "discount_pct": 20,
                "code": "COMBO02",
                "program_ids": [intro_id, prog_b, prog_c],
            }
        ],
    }
    data = {
        "subtotal": 22500.0,
        "num_programs": 3,
        "num_participants": 1,
        "currency": "inr",
        "program_ids": [intro_id, prog_b, prog_c],
        "cart_items": [
            {"program_id": intro_id, "tier_index": 0},
            {"program_id": prog_b, "tier_index": 0},
            {"program_id": prog_c, "tier_index": 0},
        ],
    }
    out = await calculate_cart_discounts(settings, data, db)
    # Combo applies to prog_b + prog_c only (20000) → 20% = 4000, not 20% of 22500
    assert out["combo_discount"] == 4000


@pytest.mark.asyncio
async def test_combo_excluded_program_does_not_count_toward_minimum():
    intro_id = "intro-id"
    prog_b = "prog-b"
    programs = {
        intro_id: {"id": intro_id, "exclude_from_combo_discount": True, "duration_tiers": [], "price_inr": 2500.0},
        prog_b: {"id": prog_b, "exclude_from_combo_discount": False, "duration_tiers": [], "price_inr": 10000.0},
    }
    db = FakeDB(programs)
    settings = {
        "enable_combo_discount": True,
        "combo_rules": [{"min_programs": 2, "discount_pct": 20, "code": "COMBO02", "program_ids": [intro_id, prog_b]}],
    }
    data = {
        "subtotal": 12500.0,
        "num_programs": 2,
        "num_participants": 1,
        "currency": "inr",
        "program_ids": [intro_id, prog_b],
        "cart_items": [{"program_id": intro_id, "tier_index": 0}, {"program_id": prog_b, "tier_index": 0}],
    }
    out = await calculate_cart_discounts(settings, data, db)
    assert out["combo_discount"] == 0