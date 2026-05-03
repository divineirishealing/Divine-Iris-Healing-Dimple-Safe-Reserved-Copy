"""Tests for Home Coming vs non–Home Coming CRM discount scope on India checkout paths."""

from utils.home_coming_crm_fields import client_pricing_row_for_india_checkout
from utils.home_coming_discount_scope import (
    checkout_program_ids_from_submit,
    filter_client_pricing_for_home_coming_checkout,
)


class _Submit:
    def __init__(self, item_type=None, item_id=None, cart_items=None):
        self.item_type = item_type
        self.item_id = item_id
        self.cart_items = cart_items


def test_checkout_ids_from_cart():
    s = _Submit(
        cart_items=[{"program_id": "abc"}, {"program_id": "abc"}],
    )
    assert checkout_program_ids_from_submit(s) == ["abc", "abc"]


def test_checkout_ids_single_program():
    s = _Submit(item_type="program", item_id="pin-1")
    assert checkout_program_ids_from_submit(s) == ["pin-1"]


def test_filter_applies_hc_discount_when_all_match_pin():
    raw = {"india_discount_percent": 1.0, "home_coming_india_discount_percent": 8.0}
    cp = client_pricing_row_for_india_checkout(raw)
    out = filter_client_pricing_for_home_coming_checkout(
        cp,
        pin_program_id="same",
        checkout_program_ids=["same", "same"],
    )
    assert out["india_discount_percent"] == 8.0
    assert "_hc_india_discount_percent" not in out


def test_filter_keeps_general_discount_when_program_mismatch():
    raw = {
        "india_discount_percent": 3.0,
        "home_coming_india_discount_percent": 8.0,
        "india_discount_member_bands": [{"min": 1, "max": 2, "percent": 2.0}],
    }
    cp = client_pricing_row_for_india_checkout(raw)
    out = filter_client_pricing_for_home_coming_checkout(
        cp,
        pin_program_id="hc",
        checkout_program_ids=["other"],
    )
    assert out["india_discount_percent"] == 3.0
    assert out["india_discount_member_bands"][0]["percent"] == 2.0
    assert "_hc_india_discount_percent" not in out


def test_filter_empty_checkout_ids_keeps_general():
    raw = {"india_discount_percent": 4.0, "home_coming_india_discount_percent": 9.0}
    cp = client_pricing_row_for_india_checkout(raw)
    out = filter_client_pricing_for_home_coming_checkout(
        cp,
        pin_program_id="hc",
        checkout_program_ids=[],
    )
    assert out["india_discount_percent"] == 4.0


def test_filter_legacy_client_same_discount_both_paths():
    raw = {"india_discount_percent": 7.0}
    cp = client_pricing_row_for_india_checkout(raw)
    out_hc = filter_client_pricing_for_home_coming_checkout(
        cp, pin_program_id="x", checkout_program_ids=["x"]
    )
    assert out_hc["india_discount_percent"] == 7.0
    out_other = filter_client_pricing_for_home_coming_checkout(
        cp, pin_program_id="x", checkout_program_ids=["y"]
    )
    assert out_other["india_discount_percent"] == 7.0


def test_filter_passes_through_none():
    assert filter_client_pricing_for_home_coming_checkout(None, pin_program_id="x", checkout_program_ids=["x"]) is None


def test_filter_strips_admin_extra_on_hc_only_cart():
    raw = {
        "india_discount_percent": 2.0,
        "home_coming_india_discount_percent": 5.0,
        "sacred_home_extra_discount_kind": "inr",
        "sacred_home_extra_discount_value": 100.0,
        "sacred_home_extra_discount_per": "cart",
    }
    cp = client_pricing_row_for_india_checkout(raw)
    out = filter_client_pricing_for_home_coming_checkout(
        cp,
        pin_program_id="hc",
        checkout_program_ids=["hc"],
    )
    assert out.get("sacred_home_extra_discount_kind") is None
    assert out.get("sacred_home_extra_discount_value") is None


def test_filter_keeps_admin_extra_on_non_hc_cart():
    raw = {
        "india_discount_percent": 2.0,
        "home_coming_india_discount_percent": 5.0,
        "sacred_home_extra_discount_kind": "inr",
        "sacred_home_extra_discount_value": 50.0,
        "sacred_home_extra_discount_per": "participant",
    }
    cp = client_pricing_row_for_india_checkout(raw)
    out = filter_client_pricing_for_home_coming_checkout(
        cp,
        pin_program_id="hc",
        checkout_program_ids=["other"],
    )
    assert out["sacred_home_extra_discount_kind"] == "inr"
    assert out["sacred_home_extra_discount_value"] == 50.0
