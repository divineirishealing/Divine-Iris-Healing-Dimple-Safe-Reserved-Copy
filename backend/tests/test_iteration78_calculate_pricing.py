"""
Iteration 78: Tests for Enhanced Annual Pricing Config with Calculate-Pricing Endpoint
- Tests the calculate-pricing endpoint that pulls monthly prices from programs
- Tests per-program discounts and overall discount
- Tests source_tier and discount_pct fields in included_programs
- Regression tests for subscriber CRUD and student financials
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCalculatePricingEndpoint:
    """Tests for GET /api/admin/subscribers/calculate-pricing"""
    
    def test_calculate_pricing_returns_breakdown(self):
        """Calculate pricing should return breakdown with all program details"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/calculate-pricing")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "breakdown" in data, "Response should have 'breakdown' field"
        assert "subtotals" in data, "Response should have 'subtotals' field"
        assert "overall_discount_pct" in data, "Response should have 'overall_discount_pct' field"
        assert "final_totals" in data, "Response should have 'final_totals' field"
        assert "manual_pricing" in data, "Response should have 'manual_pricing' field"
        print("PASSED: Calculate pricing returns complete breakdown structure")
    
    def test_breakdown_contains_program_details(self):
        """Each breakdown item should have required fields"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/calculate-pricing")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["breakdown"]) > 0, "Breakdown should have items"
        
        for item in data["breakdown"]:
            assert "name" in item, "Breakdown item should have 'name'"
            assert "duration_value" in item, "Breakdown item should have 'duration_value'"
            assert "duration_unit" in item, "Breakdown item should have 'duration_unit'"
            assert "source_tier" in item, "Breakdown item should have 'source_tier'"
            assert "discount_pct" in item, "Breakdown item should have 'discount_pct'"
            assert "monthly_prices" in item, "Breakdown item should have 'monthly_prices'"
            assert "calculated_prices" in item, "Breakdown item should have 'calculated_prices'"
            assert "matched_program" in item, "Breakdown item should have 'matched_program'"
        print("PASSED: Breakdown items have all required fields")
    
    def test_awrp_fuzzy_matches_and_pulls_correct_prices(self):
        """AWRP should fuzzy match to 'Atomic Weight Release Program (AWRP)' and pull 1 Month tier"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/calculate-pricing")
        assert response.status_code == 200
        
        data = response.json()
        awrp = next((b for b in data["breakdown"] if b["name"] == "AWRP"), None)
        assert awrp is not None, "AWRP should be in breakdown"
        
        # Verify fuzzy match worked
        assert awrp["matched_program"] == "Atomic Weight Release Program (AWRP)", \
            f"AWRP should match to full name, got: {awrp['matched_program']}"
        
        # Verify prices pulled from 1 Month tier (INR 90000.01, USD 1800, AED 4500)
        assert awrp["monthly_prices"]["INR"] == 90000.01, \
            f"AWRP monthly INR should be 90000.01, got {awrp['monthly_prices']['INR']}"
        assert awrp["monthly_prices"]["USD"] == 1800, \
            f"AWRP monthly USD should be 1800, got {awrp['monthly_prices']['USD']}"
        assert awrp["monthly_prices"]["AED"] == 4500, \
            f"AWRP monthly AED should be 4500, got {awrp['monthly_prices']['AED']}"
        print("PASSED: AWRP fuzzy matches and pulls correct 1 Month tier prices")
    
    def test_mmm_fuzzy_matches_and_pulls_correct_prices(self):
        """Money Magic Multiplier should match and pull correct prices"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/calculate-pricing")
        assert response.status_code == 200
        
        data = response.json()
        mmm = next((b for b in data["breakdown"] if b["name"] == "Money Magic Multiplier"), None)
        assert mmm is not None, "Money Magic Multiplier should be in breakdown"
        
        # Verify match
        assert "Money Magic Multiplier" in mmm["matched_program"], \
            f"MMM should match, got: {mmm['matched_program']}"
        
        # Verify prices (INR 20000, USD 325, AED 1200)
        assert mmm["monthly_prices"]["INR"] == 20000, \
            f"MMM monthly INR should be 20000, got {mmm['monthly_prices']['INR']}"
        assert mmm["monthly_prices"]["USD"] == 325, \
            f"MMM monthly USD should be 325, got {mmm['monthly_prices']['USD']}"
        assert mmm["monthly_prices"]["AED"] == 1200, \
            f"MMM monthly AED should be 1200, got {mmm['monthly_prices']['AED']}"
        print("PASSED: Money Magic Multiplier matches and pulls correct prices")
    
    def test_sessions_type_programs_have_zero_prices(self):
        """Bi-Annual Downloads and Quarterly Meetups (sessions type) should have zero monetary value"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/calculate-pricing")
        assert response.status_code == 200
        
        data = response.json()
        bi_annual = next((b for b in data["breakdown"] if b["name"] == "Bi-Annual Downloads"), None)
        quarterly = next((b for b in data["breakdown"] if b["name"] == "Quarterly Meetups"), None)
        
        assert bi_annual is not None, "Bi-Annual Downloads should be in breakdown"
        assert quarterly is not None, "Quarterly Meetups should be in breakdown"
        
        # Sessions-type should have zero prices
        for prog in [bi_annual, quarterly]:
            assert prog["monthly_prices"]["INR"] == 0, f"{prog['name']} should have 0 INR"
            assert prog["calculated_prices"]["INR"] == 0, f"{prog['name']} should have 0 calculated INR"
            assert prog["matched_program"] == "", f"{prog['name']} should not match any program"
        print("PASSED: Sessions-type programs have zero monetary values")
    
    def test_calculated_prices_use_duration_multiplier(self):
        """Calculated prices should be monthly_price * duration_value"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/calculate-pricing")
        assert response.status_code == 200
        
        data = response.json()
        awrp = next((b for b in data["breakdown"] if b["name"] == "AWRP"), None)
        
        # AWRP: 12 months * 90000.01 = 1080000.12
        expected_inr = 90000.01 * 12
        assert abs(awrp["calculated_prices"]["INR"] - expected_inr) < 0.1, \
            f"AWRP calculated INR should be {expected_inr}, got {awrp['calculated_prices']['INR']}"
        
        # MMM: 6 months * 20000 = 120000
        mmm = next((b for b in data["breakdown"] if b["name"] == "Money Magic Multiplier"), None)
        assert mmm["calculated_prices"]["INR"] == 120000.0, \
            f"MMM calculated INR should be 120000, got {mmm['calculated_prices']['INR']}"
        print("PASSED: Calculated prices correctly multiply monthly by duration")
    
    def test_subtotals_sum_all_calculated_prices(self):
        """Subtotals should be sum of all calculated_prices"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/calculate-pricing")
        assert response.status_code == 200
        
        data = response.json()
        
        # Calculate expected INR subtotal
        expected_inr = sum(b["calculated_prices"]["INR"] for b in data["breakdown"])
        assert abs(data["subtotals"]["INR"] - expected_inr) < 0.1, \
            f"Subtotal INR should be {expected_inr}, got {data['subtotals']['INR']}"
        print("PASSED: Subtotals correctly sum calculated prices")
    
    def test_final_totals_with_no_overall_discount(self):
        """When overall_discount_pct is 0, final_totals should equal subtotals"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/calculate-pricing")
        assert response.status_code == 200
        
        data = response.json()
        if data["overall_discount_pct"] == 0:
            assert data["final_totals"]["INR"] == data["subtotals"]["INR"], \
                "With 0% discount, final should equal subtotal"
        print("PASSED: Final totals correct with no overall discount")


class TestPricingConfigPutEndpoint:
    """Tests for PUT /api/admin/subscribers/pricing-config with new fields"""
    
    def test_update_overall_discount_pct(self):
        """PUT should accept overall_discount_pct field"""
        # First get current config
        get_res = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        original = get_res.json()
        
        # Update with discount
        updated = {**original, "overall_discount_pct": 10}
        put_res = requests.put(f"{BASE_URL}/api/admin/subscribers/pricing-config", json=updated)
        assert put_res.status_code == 200, f"PUT failed: {put_res.text}"
        
        # Verify saved
        verify_res = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        saved = verify_res.json()
        assert saved["overall_discount_pct"] == 10, f"Overall discount should be 10, got {saved.get('overall_discount_pct')}"
        
        # Restore original
        requests.put(f"{BASE_URL}/api/admin/subscribers/pricing-config", json=original)
        print("PASSED: overall_discount_pct field accepted and persisted")
    
    def test_update_program_source_tier(self):
        """PUT should accept source_tier field in included_programs"""
        get_res = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        original = get_res.json()
        
        # Update first program's source_tier
        updated = {**original}
        if updated.get("included_programs"):
            updated["included_programs"][0]["source_tier"] = "3 Months"
        
        put_res = requests.put(f"{BASE_URL}/api/admin/subscribers/pricing-config", json=updated)
        assert put_res.status_code == 200, f"PUT failed: {put_res.text}"
        
        # Verify
        verify_res = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        saved = verify_res.json()
        assert saved["included_programs"][0]["source_tier"] == "3 Months", \
            f"Source tier should be '3 Months', got {saved['included_programs'][0].get('source_tier')}"
        
        # Restore
        requests.put(f"{BASE_URL}/api/admin/subscribers/pricing-config", json=original)
        print("PASSED: source_tier field in programs accepted and persisted")
    
    def test_update_program_discount_pct(self):
        """PUT should accept discount_pct field in included_programs"""
        get_res = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        original = get_res.json()
        
        # Update first program's discount
        updated = {**original}
        if updated.get("included_programs"):
            updated["included_programs"][0]["discount_pct"] = 15
        
        put_res = requests.put(f"{BASE_URL}/api/admin/subscribers/pricing-config", json=updated)
        assert put_res.status_code == 200
        
        # Verify
        verify_res = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        saved = verify_res.json()
        assert saved["included_programs"][0]["discount_pct"] == 15, \
            f"Discount should be 15, got {saved['included_programs'][0].get('discount_pct')}"
        
        # Restore
        requests.put(f"{BASE_URL}/api/admin/subscribers/pricing-config", json=original)
        print("PASSED: discount_pct field in programs accepted and persisted")
    
    def test_discount_applied_in_calculate_pricing(self):
        """Per-program discount should be applied in calculate-pricing"""
        get_res = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        original = get_res.json()
        
        # Ensure AWRP has source_tier = "1 Month" and set 10% discount
        updated = {**original}
        for prog in updated.get("included_programs", []):
            if prog["name"] == "AWRP":
                prog["source_tier"] = "1 Month"  # Ensure correct tier
                prog["discount_pct"] = 10
        
        requests.put(f"{BASE_URL}/api/admin/subscribers/pricing-config", json=updated)
        
        # Calculate
        calc_res = requests.get(f"{BASE_URL}/api/admin/subscribers/calculate-pricing")
        calc = calc_res.json()
        
        awrp = next((b for b in calc["breakdown"] if b["name"] == "AWRP"), None)
        
        # Verify discount is 10%
        assert awrp["discount_pct"] == 10, f"Discount should be 10, got {awrp['discount_pct']}"
        
        # Calculate expected: monthly * duration * (1 - discount/100)
        monthly = awrp["monthly_prices"]["INR"]
        duration = awrp["duration_value"]
        discount = awrp["discount_pct"]
        expected = monthly * duration * (1 - discount/100)
        
        assert abs(awrp["calculated_prices"]["INR"] - expected) < 1, \
            f"Expected ~{expected}, got {awrp['calculated_prices']['INR']}"
        
        # Restore
        requests.put(f"{BASE_URL}/api/admin/subscribers/pricing-config", json=original)
        print("PASSED: Per-program discount correctly applied in calculations")
    
    def test_overall_discount_applied_in_final_totals(self):
        """Overall discount should be applied to final_totals"""
        get_res = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        original = get_res.json()
        
        # Set 20% overall discount
        updated = {**original, "overall_discount_pct": 20}
        requests.put(f"{BASE_URL}/api/admin/subscribers/pricing-config", json=updated)
        
        # Calculate
        calc_res = requests.get(f"{BASE_URL}/api/admin/subscribers/calculate-pricing")
        calc = calc_res.json()
        
        # final = subtotal * 0.8
        expected_final = calc["subtotals"]["INR"] * 0.8
        assert abs(calc["final_totals"]["INR"] - expected_final) < 1, \
            f"Expected final INR ~{expected_final}, got {calc['final_totals']['INR']}"
        
        # Restore
        requests.put(f"{BASE_URL}/api/admin/subscribers/pricing-config", json=original)
        print("PASSED: Overall discount correctly applied to final totals")


class TestSubscriberCRUDRegression:
    """Regression tests - Subscriber CRUD should still work"""
    
    def test_list_subscribers_still_works(self):
        """GET /api/admin/subscribers/list should return array"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/list")
        assert response.status_code == 200, f"List failed: {response.status_code}"
        assert isinstance(response.json(), list), "Should return list"
        print("PASSED: Subscriber list endpoint works")
    
    def test_create_and_delete_subscriber(self):
        """Full CRUD cycle: create -> verify -> delete"""
        # Create
        test_sub = {
            "name": "TEST_PricingCalc_User",
            "email": "test_pricing_calc@example.com",
            "annual_program": "Test Program",
            "total_fee": 5000,
            "currency": "USD",
            "payment_mode": "No EMI",
            "num_emis": 0,
            "emis": [],
            "programs": [],
            "bi_annual_download": 0,
            "quarterly_releases": 0,
            "sessions": {
                "carry_forward": 0,
                "current": 10,
                "total": 10,
                "availed": 0,
                "yet_to_avail": 10,
                "due": 0,
                "scheduled_dates": []
            }
        }
        
        create_res = requests.post(f"{BASE_URL}/api/admin/subscribers/create", json=test_sub)
        assert create_res.status_code == 200, f"Create failed: {create_res.text}"
        created_id = create_res.json().get("id")
        
        # Verify in list
        list_res = requests.get(f"{BASE_URL}/api/admin/subscribers/list")
        subscribers = list_res.json()
        found = any(s.get("id") == created_id or s.get("name") == "TEST_PricingCalc_User" for s in subscribers)
        assert found, "Created subscriber should be in list"
        
        # Delete
        if created_id:
            del_res = requests.delete(f"{BASE_URL}/api/admin/subscribers/delete/{created_id}")
            assert del_res.status_code == 200, f"Delete failed: {del_res.text}"
        
        print("PASSED: Subscriber CRUD cycle works")
    
    def test_download_template_still_works(self):
        """Download template should return Excel"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/download-template")
        assert response.status_code == 200, f"Template download failed: {response.status_code}"
        assert "spreadsheetml" in response.headers.get("content-type", ""), \
            "Should return Excel file"
        print("PASSED: Download template works")
    
    def test_export_still_works(self):
        """Export should return Excel"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/export")
        assert response.status_code == 200, f"Export failed: {response.status_code}"
        assert "spreadsheetml" in response.headers.get("content-type", ""), \
            "Should return Excel file"
        print("PASSED: Export subscribers works")


class TestStudentFinancialsRegression:
    """Regression tests - Student dashboard should still work"""
    
    def test_student_home_endpoint_exists(self):
        """Student home endpoint should be accessible (may require auth)"""
        # This endpoint requires auth, so we expect 401 or 403 without token
        response = requests.get(f"{BASE_URL}/api/student/home")
        # Without auth, should get 401/403, not 404 or 500
        assert response.status_code in [200, 401, 403, 422], \
            f"Student home endpoint issue: {response.status_code}"
        print("PASSED: Student home endpoint exists")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
