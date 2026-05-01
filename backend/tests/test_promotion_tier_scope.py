"""Unit tests for promotion program + tier scope helpers."""

from utils.promotion_scope import (
    build_cart_lines_from_payload,
    eligible_participant_units_for_fixed_promo,
    fixed_promo_scales_with_participants,
    promo_applies_to_cart_lines,
    promo_line_in_scope,
)


def test_fixed_scale_defaults_true():
    assert fixed_promo_scales_with_participants({"discount_type": "fixed"}) is True
    assert fixed_promo_scales_with_participants({"discount_type": "fixed", "fixed_per_participant": None}) is True


def test_fixed_scale_explicit_false():
    assert fixed_promo_scales_with_participants({"fixed_per_participant": False}) is False


def test_eligible_units_missing_key_scales():
    promo = {"applicable_to": "all"}
    data = {"program_id": "9", "tier_index": 0, "participant_count": 2}
    assert eligible_participant_units_for_fixed_promo(promo, data, fallback_participants=1) == 2


def test_promo_line_in_scope_specific_program():
    promo = {"applicable_to": "specific", "applicable_program_ids": ["1"]}
    assert promo_line_in_scope(promo, "1", 0)
    assert not promo_line_in_scope(promo, "2", 0)


def test_eligible_units_sums_cart_participants():
    promo = {
        "applicable_to": "all",
        "fixed_per_participant": True,
        "applicable_tier_indices_by_program": None,
    }
    data = {
        "cart_items": [
            {"program_id": "1", "tier_index": 0, "participants_count": 2},
            {"program_id": "1", "tier_index": 0, "participants_count": 1},
        ]
    }
    assert eligible_participant_units_for_fixed_promo(promo, data, fallback_participants=1) == 3


def test_eligible_units_single_program_participant_count():
    promo = {"applicable_to": "all", "fixed_per_participant": True}
    data = {"program_id": "9", "tier_index": 0, "participant_count": 3}
    assert eligible_participant_units_for_fixed_promo(promo, data, fallback_participants=1) == 3


def test_eligible_units_off_when_not_fixed_per_person():
    promo = {"applicable_to": "all", "fixed_per_participant": False}
    data = {"participant_count": 99, "cart_items": [{"program_id": "1", "participants_count": 5}]}
    assert eligible_participant_units_for_fixed_promo(promo, data, fallback_participants=1) == 1


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
