"""Unit tests for promotion program + tier scope helpers."""

from utils.promotion_scope import build_cart_lines_from_payload, promo_applies_to_cart_lines


def test_build_lines_from_cart_items():
    lines = build_cart_lines_from_payload(
        {
            "cart_items": [
                {"program_id": "1", "tier_index": 2},
                {"programId": "2", "tierIndex": 0},
            ]
        }
    )
    assert lines == [("1", 2), ("2", 0)]


def test_build_lines_single_program():
    assert build_cart_lines_from_payload({"program_id": "1", "tier_index": 0}) == [("1", 0)]
    assert build_cart_lines_from_payload({"program_id": "1"}) == [("1", None)]


def test_promo_specific_program_rejects_extra_line():
    promo = {
        "applicable_to": "specific",
        "applicable_program_ids": ["1"],
        "applicable_tier_indices_by_program": None,
    }
    ok, _ = promo_applies_to_cart_lines(promo, [("1", 0), ("2", 0)])
    assert ok is False


def test_promo_tier_map_restricts():
    promo = {
        "applicable_to": "all",
        "applicable_program_ids": [],
        "applicable_tier_indices_by_program": {"1": [0]},
    }
    assert promo_applies_to_cart_lines(promo, [("1", 0)])[0] is True
    assert promo_applies_to_cart_lines(promo, [("1", 1)])[0] is False


def test_promo_tier_none_when_restricted():
    promo = {
        "applicable_to": "all",
        "applicable_program_ids": [],
        "applicable_tier_indices_by_program": {"1": [0]},
    }
    assert promo_applies_to_cart_lines(promo, [("1", None)])[0] is False


def test_empty_lines_skips_scope():
    promo = {
        "applicable_to": "specific",
        "applicable_program_ids": ["1"],
        "applicable_tier_indices_by_program": {"1": [0]},
    }
    assert promo_applies_to_cart_lines(promo, []) == (True, "")
