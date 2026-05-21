"""Tests for Home Coming vs non–Home Coming CRM discount scope on India checkout paths."""

from utils.home_coming_crm_fields import client_pricing_row_for_india_checkout
from utils.home_coming_discount_scope import (
    checkout_program_ids_from_submit,
    filter_client_pricing_for_home_coming_checkout,
    home_coming_catalog_checkout_from_context,
)


class _Submit:
    def __init__(self, item_type=None, item_id=None, cart_items=None, **kwargs):
        self.item_type = item_type
        self.item_id = item_id
        self.cart_items = cart_items
        for k, v in kwargs.items():
            setattr(self, k, v)


def test_checkout_ids_from_cart():
    s = _Submit(
        cart_items=[{"program_id": "abc"}, {"program_id": "abc"}],
    )
    assert checkout_program_ids_from_submit(s) == ["abc", "abc"]


def test_checkout_ids_single_program():
    s = _Submit(item_type="program", item_id="pin-1")
    assert checkout_program_ids_from_submit(s) == ["pin-1"]


def test_filter_applies_hc_discount_when_catalog_checkout_and_all_match_pin():
    raw = {"india_discount_percent": 1.0, "home_coming_india_discount_percent": 8.0}
    cp = client_pricing_row_for_india_checkout(raw)
    out = filter_client_pricing_for_home_coming_checkout(
        cp,
        pin_program_id="same",
        checkout_program_ids=["same", "same"],
        home_coming_catalog_checkout=True,
    )
    assert out["india_discount_percent"] == 8.0
    assert "_hc_india_discount_percent" not in out


def test_filter_keeps_other_program_discount_when_pin_matches_but_not_catalog():
    raw = {
        "india_discount_percent": 7.5,
        "home_coming_india_discount_percent": 8.25,
    }
    cp = client_pricing_row_for_india_checkout(raw)
    out = filter_client_pricing_for_home_coming_checkout(
        cp,
        pin_program_id="awrp-pin",
        checkout_program_ids=["awrp-pin"],
        home_coming_catalog_checkout=False,
    )
    assert out["india_discount_percent"] == 7.5
    assert "_hc_india_discount_percent" not in out


def test_filter_keeps_other_program_discount_when_mixed_cart():
    raw = {
        "india_discount_percent": 3.0,
        "home_coming_india_discount_percent": 8.0,
    }
    cp = client_pricing_row_for_india_checkout(raw)
    out = filter_client_pricing_for_home_coming_checkout(
        cp,
        pin_program_id="pin",
        checkout_program_ids=["pin", "other"],
        home_coming_catalog_checkout=True,
    )
    assert out["india_discount_percent"] == 3.0
    assert "_hc_india_discount_percent" not in out


def test_home_coming_catalog_checkout_from_submit_flag():
    assert home_coming_catalog_checkout_from_context(_Submit(home_coming_catalog_checkout=True))
    assert not home_coming_catalog_checkout_from_context(_Submit(home_coming_catalog_checkout=False))
    assert home_coming_catalog_checkout_from_context(_Submit(home_coming_pay_installment_n=2))
    assert home_coming_catalog_checkout_from_context(
        {"home_coming_catalog_checkout": True},
    )


def test_filter_none_pricing():
    assert filter_client_pricing_for_home_coming_checkout(None, pin_program_id="x", checkout_program_ids=["x"]) is None
