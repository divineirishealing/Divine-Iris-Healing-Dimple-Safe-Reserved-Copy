"""Cohort / per-program portal merges: infer ``enabled`` when pricing is set without the flag."""
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

pytest.importorskip("fastapi")

from routes.student import (  # noqa: E402
    _batch_portal_row_for_program,
    _client_awrp_batch_id,
    _merge_program_dashboard_offers,
    _merge_program_dashboard_offers_with_batch,
    _merged_portal_offers_for_payer,
)


def test_cohort_annual_patch_enables_when_global_disabled():
    g_ao = {"enabled": False}
    batch_row = {"annual": {"pricing_rule": "fixed_price", "fixed_price_inr": 13734}}
    ao, _fo, _eo = _merge_program_dashboard_offers_with_batch(
        g_ao, {}, {}, "p1", {}, batch_row, None
    )
    assert ao.get("enabled") is True
    assert ao.get("fixed_price_inr") == 13734


def test_explicit_enabled_false_in_patch_not_overridden():
    ao, _fo, _eo = _merge_program_dashboard_offers_with_batch(
        {"enabled": True},
        {},
        {},
        "p1",
        {},
        {"annual": {"enabled": False, "pricing_rule": "fixed_price", "fixed_price_inr": 100}},
        None,
    )
    assert ao.get("enabled") is False


def test_per_program_by_tier_enables_family():
    per_map = {
        "p1": {
            "by_tier": {
                "1": {
                    "family": {"pricing_rule": "fixed_price", "fixed_price_aed": 50},
                }
            }
        }
    }
    _ao, fo, _eo = _merge_program_dashboard_offers(
        {"enabled": False}, {"enabled": False}, {}, "p1", per_map, 1
    )
    assert fo.get("enabled") is True


def test_batch_portal_row_resolves_program_id_case():
    pid_upper = "550E8400-E29B-41D4-A716-446655440000"
    pid_lower = "550e8400-e29b-41d4-a716-446655440000"
    root = {
        "cohort-x": {
            pid_upper: {
                "annual": {"pricing_rule": "fixed_price", "fixed_price_inr": 13734},
            }
        }
    }
    row = _batch_portal_row_for_program(root, "cohort-x", pid_lower)
    assert row is not None
    assert (row.get("annual") or {}).get("fixed_price_inr") == 13734


def test_merged_offers_cohort_only_without_annual_access():
    settings = {
        "awrp_batch_program_offers": {
            "c1": {
                "prog-a": {
                    "annual": {"pricing_rule": "fixed_price", "fixed_price_inr": 13734},
                }
            }
        }
    }
    client = {"awrp_batch_id": "c1"}
    ao, fo, eo, bid = _merged_portal_offers_for_payer(False, "prog-a", settings, client)
    assert bid == "c1"
    assert ao.get("enabled") is True
    assert ao.get("fixed_price_inr") == 13734
    assert fo == {} and eo == {}


def test_client_awrp_batch_from_annual_subscription():
    bid = "cohort-1777195028718"
    c = {"annual_subscription": {"awrp_batch_id": bid}}
    assert _client_awrp_batch_id(c) == bid
