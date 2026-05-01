"""Tests for Home Coming–only CRM discount scope on generic India checkout paths."""

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


def test_filter_keeps_discount_when_all_match_pin():
    cp = {"india_discount_percent": 8.0, "india_tax_enabled": True}
    out = filter_client_pricing_for_home_coming_checkout(
        cp,
        pin_program_id="same",
        checkout_program_ids=["same", "same"],
    )
    assert out["india_discount_percent"] == 8.0


def test_filter_strips_when_program_mismatch():
    cp = {"india_discount_percent": 8.0, "india_discount_member_bands": [{"min": 1, "max": 5, "percent": 5}]}
    out = filter_client_pricing_for_home_coming_checkout(
        cp,
        pin_program_id="hc",
        checkout_program_ids=["other"],
    )
    assert out["india_discount_percent"] is None
    assert out["india_discount_member_bands"] is None


def test_filter_strips_when_no_checkout_ids():
    cp = {"india_discount_percent": 8.0}
    out = filter_client_pricing_for_home_coming_checkout(
        cp,
        pin_program_id="hc",
        checkout_program_ids=[],
    )
    assert out["india_discount_percent"] is None


def test_filter_passes_through_none():
    assert filter_client_pricing_for_home_coming_checkout(None, pin_program_id="x", checkout_program_ids=["x"]) is None
