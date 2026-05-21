"""Tests for Home Coming vs Dashboard Access CRM discount field split."""

from utils.home_coming_crm_fields import home_coming_crm_discount_fields


def test_hc_fields_never_fall_back_to_india_discount():
    client = {"india_discount_percent": 7.0, "india_discount_member_bands": None}
    out = home_coming_crm_discount_fields(client)
    assert out["india_discount_percent"] is None
    assert out["india_discount_member_bands"] is None


def test_split_uses_home_coming_only():
    client = {
        "india_discount_percent": 99.0,
        "home_coming_india_discount_percent": 5.0,
        "home_coming_india_discount_member_bands": None,
    }
    out = home_coming_crm_discount_fields(client)
    assert out["india_discount_percent"] == 5.0


def test_loose_string_hc_percent():
    client = {"home_coming_india_discount_percent": "8.25(relax)"}
    out = home_coming_crm_discount_fields(client)
    assert out["india_discount_percent"] == 8.25
