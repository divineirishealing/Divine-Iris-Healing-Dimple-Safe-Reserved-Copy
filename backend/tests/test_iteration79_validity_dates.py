"""
Test Iteration 79: Independent Annual Pricing Config with Validity Dates
Tests: valid_from/valid_to fields in pricing config, persistence, and regression
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPricingConfigValidityDates:
    """Tests for valid_from and valid_to date fields in annual pricing config"""
    
    def test_get_pricing_config_has_valid_from_field(self):
        """GET /api/admin/subscribers/pricing-config returns valid_from field"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        assert response.status_code == 200
        data = response.json()
        assert "valid_from" in data, "valid_from field should exist in response"
        print(f"valid_from value: {data['valid_from']}")
    
    def test_get_pricing_config_has_valid_to_field(self):
        """GET /api/admin/subscribers/pricing-config returns valid_to field"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        assert response.status_code == 200
        data = response.json()
        assert "valid_to" in data, "valid_to field should exist in response"
        print(f"valid_to value: {data['valid_to']}")
    
    def test_validity_dates_have_expected_format(self):
        """Validity dates should be in YYYY-MM-DD format"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        assert response.status_code == 200
        data = response.json()
        
        # Check valid_from format if non-empty
        if data.get('valid_from'):
            assert len(data['valid_from']) == 10, "valid_from should be 10 chars (YYYY-MM-DD)"
            assert data['valid_from'][4] == '-' and data['valid_from'][7] == '-', "valid_from should be YYYY-MM-DD"
        
        # Check valid_to format if non-empty
        if data.get('valid_to'):
            assert len(data['valid_to']) == 10, "valid_to should be 10 chars (YYYY-MM-DD)"
            assert data['valid_to'][4] == '-' and data['valid_to'][7] == '-', "valid_to should be YYYY-MM-DD"
        
        print(f"Validity period: {data.get('valid_from')} to {data.get('valid_to')}")
    
    def test_update_pricing_config_with_validity_dates(self):
        """PUT /api/admin/subscribers/pricing-config saves valid_from and valid_to"""
        # Get current config
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        assert response.status_code == 200
        original_config = response.json()
        
        # Update with new validity dates
        updated_config = {
            "package_name": original_config.get("package_name", "Annual Healing Package"),
            "valid_from": "2026-05-01",
            "valid_to": "2027-04-30",
            "duration_months": original_config.get("duration_months", 12),
            "pricing": original_config.get("pricing", {}),
            "included_programs": original_config.get("included_programs", []),
            "overall_discount_pct": original_config.get("overall_discount_pct", 0),
            "default_sessions_current": original_config.get("default_sessions_current", 12),
            "default_sessions_carry_forward": original_config.get("default_sessions_carry_forward", 0),
            "notes": original_config.get("notes", "")
        }
        
        response = requests.put(f"{BASE_URL}/api/admin/subscribers/pricing-config", json=updated_config)
        assert response.status_code == 200
        
        # Verify persistence
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        assert response.status_code == 200
        data = response.json()
        assert data["valid_from"] == "2026-05-01", f"Expected '2026-05-01', got '{data['valid_from']}'"
        assert data["valid_to"] == "2027-04-30", f"Expected '2027-04-30', got '{data['valid_to']}'"
        print(f"Validity dates updated and persisted: {data['valid_from']} to {data['valid_to']}")
        
        # Restore original dates
        updated_config["valid_from"] = original_config.get("valid_from", "2026-04-01")
        updated_config["valid_to"] = original_config.get("valid_to", "2027-03-31")
        requests.put(f"{BASE_URL}/api/admin/subscribers/pricing-config", json=updated_config)
    
    def test_empty_validity_dates_allowed(self):
        """Validity dates can be empty strings"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        assert response.status_code == 200
        original_config = response.json()
        
        # Update with empty validity dates
        updated_config = {
            "package_name": original_config.get("package_name", "Annual Healing Package"),
            "valid_from": "",
            "valid_to": "",
            "duration_months": original_config.get("duration_months", 12),
            "pricing": original_config.get("pricing", {}),
            "included_programs": original_config.get("included_programs", []),
            "overall_discount_pct": original_config.get("overall_discount_pct", 0),
            "default_sessions_current": original_config.get("default_sessions_current", 12),
            "default_sessions_carry_forward": original_config.get("default_sessions_carry_forward", 0),
            "notes": original_config.get("notes", "")
        }
        
        response = requests.put(f"{BASE_URL}/api/admin/subscribers/pricing-config", json=updated_config)
        assert response.status_code == 200
        
        # Verify persistence
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        assert response.status_code == 200
        data = response.json()
        assert data["valid_from"] == "", "valid_from should be empty"
        assert data["valid_to"] == "", "valid_to should be empty"
        print("Empty validity dates accepted and persisted")
        
        # Restore original dates
        updated_config["valid_from"] = original_config.get("valid_from", "2026-04-01")
        updated_config["valid_to"] = original_config.get("valid_to", "2027-03-31")
        requests.put(f"{BASE_URL}/api/admin/subscribers/pricing-config", json=updated_config)


class TestPricingConfigAllFields:
    """Tests for all pricing config fields including existing ones"""
    
    def test_pricing_config_has_all_required_fields(self):
        """Config should have all expected fields"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        assert response.status_code == 200
        data = response.json()
        
        required_fields = [
            "package_name", "valid_from", "valid_to", "duration_months",
            "pricing", "included_programs", "overall_discount_pct",
            "default_sessions_current", "default_sessions_carry_forward", "notes"
        ]
        
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        print(f"All required fields present: {required_fields}")
    
    def test_pricing_has_all_currencies(self):
        """Pricing dict should have INR, USD, AED, EUR, GBP"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        assert response.status_code == 200
        data = response.json()
        
        currencies = ["INR", "USD", "AED", "EUR", "GBP"]
        for cur in currencies:
            assert cur in data["pricing"], f"Missing currency: {cur}"
            assert isinstance(data["pricing"][cur], (int, float)), f"{cur} should be numeric"
        
        print(f"Pricing currencies: {data['pricing']}")
    
    def test_notes_field_is_editable(self):
        """Notes field should be saveable"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        assert response.status_code == 200
        original_config = response.json()
        
        # Update notes
        updated_config = {
            "package_name": original_config.get("package_name", "Annual Healing Package"),
            "valid_from": original_config.get("valid_from", ""),
            "valid_to": original_config.get("valid_to", ""),
            "duration_months": original_config.get("duration_months", 12),
            "pricing": original_config.get("pricing", {}),
            "included_programs": original_config.get("included_programs", []),
            "overall_discount_pct": original_config.get("overall_discount_pct", 0),
            "default_sessions_current": original_config.get("default_sessions_current", 12),
            "default_sessions_carry_forward": original_config.get("default_sessions_carry_forward", 0),
            "notes": "Test note for iteration 79"
        }
        
        response = requests.put(f"{BASE_URL}/api/admin/subscribers/pricing-config", json=updated_config)
        assert response.status_code == 200
        
        # Verify persistence
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        assert response.status_code == 200
        data = response.json()
        assert data["notes"] == "Test note for iteration 79", f"Notes not saved: {data['notes']}"
        print(f"Notes saved: {data['notes']}")
        
        # Restore original notes
        updated_config["notes"] = original_config.get("notes", "")
        requests.put(f"{BASE_URL}/api/admin/subscribers/pricing-config", json=updated_config)


class TestCalculatePricingRegression:
    """Regression tests for calculate-pricing endpoint"""
    
    def test_calculate_pricing_still_works(self):
        """GET /api/admin/subscribers/calculate-pricing should return breakdown"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/calculate-pricing")
        assert response.status_code == 200
        data = response.json()
        
        assert "breakdown" in data, "Missing breakdown field"
        assert "subtotals" in data, "Missing subtotals field"
        assert "final_totals" in data, "Missing final_totals field"
        assert "manual_pricing" in data, "Missing manual_pricing field"
        
        print(f"Calculate pricing returns: breakdown ({len(data['breakdown'])} items), subtotals, final_totals")
    
    def test_breakdown_has_program_details(self):
        """Each breakdown item should have all required fields"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/calculate-pricing")
        assert response.status_code == 200
        data = response.json()
        
        if len(data.get("breakdown", [])) > 0:
            first_item = data["breakdown"][0]
            expected_fields = ["name", "duration_value", "duration_unit", "source_tier", "discount_pct", "monthly_prices", "calculated_prices"]
            for field in expected_fields:
                assert field in first_item, f"Breakdown item missing field: {field}"
            print(f"Breakdown item fields present: {list(first_item.keys())}")


class TestSubscriberFormAutoFillRegression:
    """Regression tests for subscriber form auto-fill from config"""
    
    def test_list_subscribers_still_works(self):
        """GET /api/admin/subscribers/list should return array"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/list")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "List response should be an array"
        print(f"Subscribers list: {len(data)} subscribers")
    
    def test_pricing_config_has_auto_fill_fields(self):
        """Config should have fields needed for form auto-fill"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        assert response.status_code == 200
        data = response.json()
        
        # Fields used for auto-fill in SubscriberForm
        autofill_fields = ["package_name", "pricing", "included_programs", "default_sessions_current", "default_sessions_carry_forward"]
        for field in autofill_fields:
            assert field in data, f"Missing auto-fill field: {field}"
        
        print(f"Auto-fill fields present: {autofill_fields}")


class TestStudentDashboardRegression:
    """Regression tests for student dashboard"""
    
    def test_student_home_endpoint(self):
        """GET /api/student/home should be accessible with session cookie"""
        cookies = {"session_token": "test-session-22fbe1e5"}
        response = requests.get(f"{BASE_URL}/api/student/home", cookies=cookies)
        # Student home may return 200 or 404 depending on session validity
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        print(f"Student home endpoint status: {response.status_code}")


class TestAdminPanelRegression:
    """Regression tests for admin panel access"""
    
    def test_programs_list(self):
        """Programs list should work"""
        response = requests.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Programs response should be array"
        print(f"Programs list: {len(data)} programs")
    
    def test_download_template_still_works(self):
        """Template download should return Excel file"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/download-template")
        assert response.status_code == 200
        assert "spreadsheet" in response.headers.get("content-type", "") or response.headers.get("content-disposition", "").endswith(".xlsx")
        print("Template download works")
    
    def test_export_still_works(self):
        """Export should return Excel file"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/export")
        assert response.status_code == 200
        assert "spreadsheet" in response.headers.get("content-type", "") or response.headers.get("content-disposition", "").endswith(".xlsx")
        print("Export works")
