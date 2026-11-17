"""India program Razorpay payment-link helpers."""
from utils.india_program_razorpay_plink import _cache_id


def test_cache_id_stable():
    pid = "66cf875c-d6d0-4b74-8250-080411cb9639"
    assert _cache_id(pid) == "india_program_66cf875c-d6d0-4b74-8250-080411cb9639"