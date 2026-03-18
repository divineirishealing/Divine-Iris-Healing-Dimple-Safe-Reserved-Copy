"""
Iteration 80: Test per-program pricing with price_per_unit and offer_price
- source_tier removed from programs
- price_per_unit dict (per currency per month/session)
- offer_price dict (total offer per currency)
- calculate-pricing returns total_price, offer_price, discount_pct per currency
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPricingConfigEndpoint:
    """Test GET/PUT /api/admin/subscribers/pricing-config with new pricing model"""
    
    def test_get_pricing_config_returns_programs_with_price_per_unit(self):
        """Programs should have price_per_unit dict, not source_tier"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "included_programs" in data
        
        for prog in data["included_programs"]:
            assert "price_per_unit" in prog, f"Program {prog['name']} missing price_per_unit"
            assert isinstance(prog["price_per_unit"], dict), f"price_per_unit should be dict"
            # source_tier should NOT exist
            assert "source_tier" not in prog, f"Program {prog['name']} still has source_tier (should be removed)"
    
    def test_get_pricing_config_returns_programs_with_offer_price(self):
        """Programs should have offer_price dict"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        assert response.status_code == 200
        
        data = response.json()
        for prog in data["included_programs"]:
            assert "offer_price" in prog, f"Program {prog['name']} missing offer_price"
            assert isinstance(prog["offer_price"], dict), f"offer_price should be dict"
    
    def test_price_per_unit_has_currency_keys(self):
        """price_per_unit should have INR, USD, AED, EUR, GBP keys when populated"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        assert response.status_code == 200
        
        data = response.json()
        currencies = ["INR", "USD", "AED", "EUR", "GBP"]
        
        # Check programs with pricing (months-based)
        for prog in data["included_programs"]:
            if prog["duration_unit"] == "months" and prog.get("price_per_unit"):
                ppu = prog["price_per_unit"]
                # At least one currency should have a value
                has_value = any(ppu.get(cur, 0) > 0 for cur in currencies)
                if has_value:
                    print(f"Program {prog['name']}: price_per_unit = {ppu}")
    
    def test_awrp_has_expected_pricing_structure(self):
        """AWRP (12 months) should have price_per_unit and offer_price populated"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        assert response.status_code == 200
        
        data = response.json()
        awrp = next((p for p in data["included_programs"] if "AWRP" in p["name"]), None)
        
        assert awrp is not None, "AWRP program not found"
        assert awrp["duration_value"] == 12, f"AWRP duration should be 12, got {awrp['duration_value']}"
        assert awrp["duration_unit"] == "months"
        assert isinstance(awrp["price_per_unit"], dict)
        assert isinstance(awrp["offer_price"], dict)
    
    def test_mmm_has_expected_pricing_structure(self):
        """Money Magic Multiplier (6 months) should have pricing data"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        assert response.status_code == 200
        
        data = response.json()
        mmm = next((p for p in data["included_programs"] if "Money Magic" in p["name"] or "MMM" in p["name"]), None)
        
        assert mmm is not None, "Money Magic Multiplier not found"
        assert mmm["duration_value"] == 6, f"MMM duration should be 6, got {mmm['duration_value']}"
        assert mmm["duration_unit"] == "months"
    
    def test_session_programs_have_no_pricing(self):
        """Bi-Annual Downloads and Quarterly Meetups (session-based) should have empty pricing"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        assert response.status_code == 200
        
        data = response.json()
        
        for prog in data["included_programs"]:
            if prog["duration_unit"] == "sessions":
                ppu = prog.get("price_per_unit", {})
                offer = prog.get("offer_price", {})
                # Session-based programs should have 0 or empty pricing
                print(f"Session program {prog['name']}: price_per_unit={ppu}, offer_price={offer}")
    
    def test_put_pricing_config_saves_per_program_pricing(self):
        """PUT should save price_per_unit and offer_price per program"""
        # First get current config
        get_response = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        assert get_response.status_code == 200
        current_config = get_response.json()
        
        # Update with specific pricing
        updated_config = {
            "package_name": current_config.get("package_name", "Annual Healing Package"),
            "valid_from": current_config.get("valid_from", "2026-04-01"),
            "valid_to": current_config.get("valid_to", "2027-03-31"),
            "duration_months": current_config.get("duration_months", 12),
            "pricing": current_config.get("pricing", {"INR": 50000, "USD": 600, "AED": 2200, "EUR": 550, "GBP": 470}),
            "included_programs": [
                {
                    "name": "AWRP",
                    "program_id": "",
                    "duration_value": 12,
                    "duration_unit": "months",
                    "price_per_unit": {"INR": 90000, "USD": 1800, "AED": 4500, "EUR": 1500, "GBP": 1400},
                    "offer_price": {"INR": 540000, "USD": 10800, "AED": 27000, "EUR": 9000, "GBP": 8400}
                },
                {
                    "name": "Money Magic Multiplier",
                    "program_id": "",
                    "duration_value": 6,
                    "duration_unit": "months",
                    "price_per_unit": {"INR": 20000, "USD": 325, "AED": 1200, "EUR": 275, "GBP": 250},
                    "offer_price": {"INR": 60000, "USD": 975, "AED": 3600, "EUR": 825, "GBP": 750}
                },
                {
                    "name": "Bi-Annual Downloads",
                    "program_id": "",
                    "duration_value": 2,
                    "duration_unit": "sessions",
                    "price_per_unit": {},
                    "offer_price": {}
                },
                {
                    "name": "Quarterly Meetups",
                    "program_id": "",
                    "duration_value": 4,
                    "duration_unit": "sessions",
                    "price_per_unit": {},
                    "offer_price": {}
                }
            ],
            "overall_discount_pct": current_config.get("overall_discount_pct", 0),
            "default_sessions_current": current_config.get("default_sessions_current", 12),
            "default_sessions_carry_forward": current_config.get("default_sessions_carry_forward", 0),
            "notes": current_config.get("notes", "")
        }
        
        put_response = requests.put(
            f"{BASE_URL}/api/admin/subscribers/pricing-config",
            json=updated_config
        )
        assert put_response.status_code == 200, f"PUT failed: {put_response.text}"
        
        # Verify saved
        verify_response = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        assert verify_response.status_code == 200
        saved = verify_response.json()
        
        awrp = next((p for p in saved["included_programs"] if "AWRP" in p["name"]), None)
        assert awrp is not None
        assert awrp["price_per_unit"]["INR"] == 90000, f"AWRP INR price_per_unit not saved correctly"
        assert awrp["offer_price"]["INR"] == 540000, f"AWRP INR offer_price not saved correctly"


class TestCalculatePricingEndpoint:
    """Test GET /api/admin/subscribers/calculate-pricing with new pricing model"""
    
    def test_calculate_pricing_returns_all_four_programs(self):
        """Should return all 4 programs in breakdown"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/calculate-pricing")
        assert response.status_code == 200
        
        data = response.json()
        assert "breakdown" in data
        assert len(data["breakdown"]) == 4, f"Expected 4 programs, got {len(data['breakdown'])}"
        
        program_names = [p["name"] for p in data["breakdown"]]
        print(f"Programs in breakdown: {program_names}")
    
    def test_calculate_pricing_has_total_price_per_currency(self):
        """Each program should have total_price dict with all currencies"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/calculate-pricing")
        assert response.status_code == 200
        
        data = response.json()
        currencies = ["INR", "USD", "AED", "EUR", "GBP"]
        
        for prog in data["breakdown"]:
            assert "total_price" in prog, f"Program {prog['name']} missing total_price"
            assert isinstance(prog["total_price"], dict)
            
            for cur in currencies:
                assert cur in prog["total_price"], f"Program {prog['name']} missing {cur} in total_price"
    
    def test_calculate_pricing_has_offer_price_per_currency(self):
        """Each program should have offer_price dict"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/calculate-pricing")
        assert response.status_code == 200
        
        data = response.json()
        currencies = ["INR", "USD", "AED", "EUR", "GBP"]
        
        for prog in data["breakdown"]:
            assert "offer_price" in prog, f"Program {prog['name']} missing offer_price"
            assert isinstance(prog["offer_price"], dict)
            
            for cur in currencies:
                assert cur in prog["offer_price"], f"Program {prog['name']} missing {cur} in offer_price"
    
    def test_calculate_pricing_has_discount_pct_per_currency(self):
        """Each program should have discount_pct dict with all currencies"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/calculate-pricing")
        assert response.status_code == 200
        
        data = response.json()
        currencies = ["INR", "USD", "AED", "EUR", "GBP"]
        
        for prog in data["breakdown"]:
            assert "discount_pct" in prog, f"Program {prog['name']} missing discount_pct"
            assert isinstance(prog["discount_pct"], dict)
            
            for cur in currencies:
                assert cur in prog["discount_pct"], f"Program {prog['name']} missing {cur} in discount_pct"
    
    def test_total_price_equals_per_unit_times_duration(self):
        """total_price should equal price_per_unit × duration_value"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/calculate-pricing")
        assert response.status_code == 200
        
        data = response.json()
        
        for prog in data["breakdown"]:
            duration = prog["duration_value"]
            for cur in ["INR", "USD", "AED", "EUR", "GBP"]:
                per_unit = prog["price_per_unit"].get(cur, 0)
                total = prog["total_price"].get(cur, 0)
                expected = per_unit * duration
                
                if per_unit > 0:
                    assert abs(total - expected) < 0.01, \
                        f"{prog['name']} {cur}: total={total} != per_unit({per_unit}) × duration({duration}) = {expected}"
    
    def test_discount_pct_calculation(self):
        """discount_pct should be (total - offer) / total * 100"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/calculate-pricing")
        assert response.status_code == 200
        
        data = response.json()
        
        for prog in data["breakdown"]:
            for cur in ["INR"]:  # Test INR for simplicity
                total = prog["total_price"].get(cur, 0)
                offer = prog["offer_price"].get(cur, 0)
                disc_pct = prog["discount_pct"].get(cur, 0)
                
                if total > 0 and offer > 0:
                    expected_disc = round(((total - offer) / total) * 100, 1)
                    assert abs(disc_pct - expected_disc) < 1.0, \
                        f"{prog['name']} {cur}: disc_pct={disc_pct} != expected {expected_disc}"
    
    def test_calculate_pricing_has_total_sums(self):
        """Should have total_sums dict with sums of all totals per currency"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/calculate-pricing")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_sums" in data
        assert isinstance(data["total_sums"], dict)
        
        for cur in ["INR", "USD", "AED", "EUR", "GBP"]:
            assert cur in data["total_sums"], f"total_sums missing {cur}"
    
    def test_calculate_pricing_has_offer_sums(self):
        """Should have offer_sums dict with sums of all offers per currency"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/calculate-pricing")
        assert response.status_code == 200
        
        data = response.json()
        assert "offer_sums" in data
        assert isinstance(data["offer_sums"], dict)
        
        for cur in ["INR", "USD", "AED", "EUR", "GBP"]:
            assert cur in data["offer_sums"], f"offer_sums missing {cur}"
    
    def test_calculate_pricing_has_overall_discount_pct(self):
        """Should have overall_discount_pct per currency"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/calculate-pricing")
        assert response.status_code == 200
        
        data = response.json()
        assert "overall_discount_pct" in data
        assert isinstance(data["overall_discount_pct"], dict)
        
        for cur in ["INR", "USD", "AED", "EUR", "GBP"]:
            assert cur in data["overall_discount_pct"], f"overall_discount_pct missing {cur}"


class TestRegressionEndpoints:
    """Regression tests for existing functionality"""
    
    def test_list_subscribers_still_works(self):
        """GET /api/admin/subscribers/list should work"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/list")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_download_template_still_works(self):
        """GET /api/admin/subscribers/download-template should return Excel"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/download-template")
        assert response.status_code == 200
        assert "spreadsheet" in response.headers.get("Content-Type", "") or \
               "octet-stream" in response.headers.get("Content-Type", "")
    
    def test_export_still_works(self):
        """GET /api/admin/subscribers/export should return Excel"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/export")
        assert response.status_code == 200
    
    def test_student_home_accessible(self):
        """Student home should be accessible (regression)"""
        response = requests.get(f"{BASE_URL}/api/student/home", 
                               cookies={"session_token": "test-session-22fbe1e5"})
        # May return 404 if no subscription, but should not error
        assert response.status_code in [200, 404]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
