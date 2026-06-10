from datetime import date

from routes.india_payments import (
    _anchor_home_coming_bundle_start,
    _iso_updated_on_or_before_payment,
    _resolve_home_coming_checkout_start_date,
    _subscription_start_looks_unsynced,
)


def test_anchor_home_coming_bundle_start():
    assert _anchor_home_coming_bundle_start(date(2026, 7, 15)) == date(2026, 7, 3)
    assert _anchor_home_coming_bundle_start(date(2026, 6, 1)) == date(2026, 6, 3)


def test_resolve_start_from_prefs_before_payment():
    cl = {
        "annual_package_offer_prefs": {
            "desired_start_date": "2026-06-03",
            "updated_at": "2026-05-20T10:00:00+00:00",
        }
    }
    start = _resolve_home_coming_checkout_start_date(cl, {}, date(2026, 5, 25))
    assert start == date(2026, 6, 3)


def test_resolve_start_ignores_prefs_updated_after_payment():
    cl = {
        "annual_package_offer_prefs": {
            "desired_start_date": "2026-07-03",
            "updated_at": "2026-06-10T10:00:00+00:00",
        }
    }
    start = _resolve_home_coming_checkout_start_date(cl, {}, date(2026, 5, 25))
    assert start == date(2026, 6, 3)


def test_subscription_start_looks_unsynced_near_payment_day():
    checkout = date(2026, 6, 3)
    sub = {"start_date": "2026-05-25"}
    assert _subscription_start_looks_unsynced(sub, date(2026, 5, 25), checkout) is True
    sub_ok = {"start_date": "2026-06-03"}
    assert _subscription_start_looks_unsynced(sub_ok, date(2026, 5, 25), checkout) is False


def test_iso_updated_on_or_before_payment():
    assert _iso_updated_on_or_before_payment("2026-05-20T10:00:00+00:00", date(2026, 5, 25))
    assert not _iso_updated_on_or_before_payment("2026-06-10T10:00:00+00:00", date(2026, 5, 25))
