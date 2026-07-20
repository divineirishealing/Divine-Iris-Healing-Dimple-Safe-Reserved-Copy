"""Unit tests for early bird vs offer price resolution."""
from datetime import datetime, timedelta, timezone

from utils.effective_pricing import is_early_bird_active, resolve_effective_offer, resolve_program_offer


def _future_date(days: int = 7) -> str:
    d = datetime.now(timezone.utc) + timedelta(days=days)
    return d.strftime("%Y-%m-%d")


def _past_date(days: int = 1) -> str:
    d = datetime.now(timezone.utc) - timedelta(days=days)
    return d.strftime("%Y-%m-%d")


def test_early_bird_active_when_date_in_future():
    tier = {
        "early_bird_date": _future_date(),
        "early_bird_price_inr": 699,
        "offer_price_inr": 999,
        "offer_text": "Special Offer",
    }
    price, text, is_eb = resolve_effective_offer(tier, "inr")
    assert is_eb is True
    assert price == 699
    assert text == "Early Bird"


def test_falls_back_to_offer_after_early_bird_date():
    tier = {
        "early_bird_date": _past_date(),
        "early_bird_price_inr": 699,
        "offer_price_inr": 999,
        "offer_text": "Special Offer",
    }
    price, text, is_eb = resolve_effective_offer(tier, "inr")
    assert is_eb is False
    assert price == 999
    assert text == "Special Offer"


def test_program_tier_early_bird():
    program = {
        "duration_tiers": [
            {
                "early_bird_date": _future_date(),
                "early_bird_price_aed": 450,
                "offer_price_aed": 699,
            }
        ]
    }
    price, _, is_eb = resolve_program_offer(program, 0, "aed")
    assert is_eb is True
    assert price == 450


def test_early_bird_honors_time_with_timezone_offset():
    future = datetime.now(timezone.utc) + timedelta(hours=3)
    iso = future.strftime("%Y-%m-%dT%H:%M:00+00:00")
    tier = {
        "early_bird_date": iso,
        "early_bird_price_inr": 699,
        "offer_price_inr": 999,
    }
    price, _, is_eb = resolve_effective_offer(tier, "inr")
    assert is_eb is True
    assert price == 699


def test_early_bird_expired_after_time_passes():
    past = datetime.now(timezone.utc) - timedelta(minutes=5)
    iso = past.strftime("%Y-%m-%dT%H:%M:00+00:00")
    tier = {
        "early_bird_date": iso,
        "early_bird_price_inr": 699,
        "offer_price_inr": 999,
        "offer_text": "Regular Offer",
    }
    price, text, is_eb = resolve_effective_offer(tier, "inr")
    assert is_eb is False
    assert price == 999
    assert text == "Regular Offer"


def test_tier_unit_price_prefers_early_bird_over_offer():
    from routes.student import _tier_list_unit_price, _tier_unit_price

    program = {
        "price_inr": 21000,
        "offer_price_inr": 7500,
        "early_bird_date": _future_date(),
        "early_bird_price_inr": 4200,
    }
    assert _tier_unit_price(program, None, "inr") == 4200
    assert _tier_list_unit_price(program, None, "inr") == 21000
