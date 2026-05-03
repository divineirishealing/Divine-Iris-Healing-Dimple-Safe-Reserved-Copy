"""Sacred Home merged India pricing: empty CRM discount must not inherit site portal default %."""
import os
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("DB_NAME", "divine_iris_test")

pytest.importorskip("fastapi")

from routes.student import _merge_client_india_pricing_portal  # noqa: E402


def test_empty_client_discount_is_zero_not_site_default():
    site = {
        "portal_standard_india_discount_percent": 7.5,
        "india_alt_discount_percent": 5,
    }
    out = _merge_client_india_pricing_portal({}, None, site)
    assert out["india_discount_percent"] == 0.0


def test_crm_client_discount_in_general_india_merge_when_sub_not_authoritative():
    """Client ``india_discount_*`` is for non–Home Coming / Divine Cart when subscription is not authoritative."""
    site = {"portal_standard_india_discount_percent": 99}
    out = _merge_client_india_pricing_portal({"india_discount_percent": 9}, None, site)
    assert out["india_discount_percent"] == 9.0
    assert out["india_discount_member_bands"] is None


def test_subscription_authoritative_discount_wins():
    site = {"portal_standard_india_discount_percent": 99}
    sub = {"package_id": "x", "individual_discount_pct": 12}
    out = _merge_client_india_pricing_portal({"india_discount_percent": 5}, sub, site)
    assert out["india_discount_percent"] == 12.0
