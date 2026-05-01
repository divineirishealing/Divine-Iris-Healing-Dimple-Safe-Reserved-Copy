"""Tests for Home Coming vs Dashboard Access CRM discount field split."""

from utils.home_coming_crm_fields import home_coming_crm_discount_fields


def test_legacy_uses_india_discount_when_no_home_coming_keys():
    client = {"india_discount_percent": 7.0, "india_discount_member_bands": None}
    out = home_coming_crm_discount_fields(client)
    assert out["india_discount_percent"] == 7.0
    assert out["india_discount_member_bands"] is None


def test_split_prefers_home_coming_even_when_legacy_differs():
    client = {
        "india_discount_percent": 99.0,
        "home_coming_india_discount_percent": 5.0,
        "home_coming_india_discount_member_bands": None,
    }
    out = home_coming_crm_discount_fields(client)
    assert out["india_discount_percent"] == 5.0
