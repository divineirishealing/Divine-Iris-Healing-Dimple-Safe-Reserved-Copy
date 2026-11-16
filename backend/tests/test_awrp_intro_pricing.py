from utils.awrp_intro_pricing import resolve_awrp_intro_inr


def test_intro_inr_uses_tier_offer_not_program_list():
    program = {
        "price_inr": 2500.0,
        "offer_price_inr": 0.0,
        "duration_tiers": [
            {"price_inr": 2500.0, "offer_price_inr": 99.0},
        ],
    }
    assert resolve_awrp_intro_inr(program) == 99.0


def test_intro_inr_program_level_offer():
    program = {"price_inr": 2500.0, "offer_price_inr": 99.0, "duration_tiers": []}
    assert resolve_awrp_intro_inr(program) == 99.0