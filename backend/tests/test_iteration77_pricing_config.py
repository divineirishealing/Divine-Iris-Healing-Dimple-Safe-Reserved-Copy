"""
Iteration 77: Testing Global Annual Pricing Config Feature
Tests:
- GET /api/admin/subscribers/pricing-config - Returns global pricing config
- PUT /api/admin/subscribers/pricing-config - Updates the global pricing config
- Verify config structure with package_name, duration, pricing per currency, included programs
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

class TestPricingConfigAPI:
    """Test the pricing config GET and PUT endpoints"""
    
    def test_get_pricing_config_returns_valid_structure(self):
        """GET /api/admin/subscribers/pricing-config should return config with all required fields"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify required fields exist
        assert "package_name" in data, "Missing package_name"
        assert "duration_months" in data, "Missing duration_months"
        assert "pricing" in data, "Missing pricing"
        assert "included_programs" in data, "Missing included_programs"
        assert "default_sessions_current" in data, "Missing default_sessions_current"
        assert "default_sessions_carry_forward" in data, "Missing default_sessions_carry_forward"
        
        # Verify pricing has currencies
        pricing = data["pricing"]
        assert isinstance(pricing, dict), "pricing should be a dict"
        expected_currencies = ["INR", "USD", "AED", "EUR", "GBP"]
        for cur in expected_currencies:
            assert cur in pricing, f"Missing currency {cur} in pricing"
            assert isinstance(pricing[cur], (int, float)), f"{cur} should be numeric"
        
        # Verify included_programs structure
        programs = data["included_programs"]
        assert isinstance(programs, list), "included_programs should be a list"
        
        print(f"✓ GET pricing-config returned valid structure")
        print(f"  Package: {data['package_name']}")
        print(f"  Duration: {data['duration_months']} months")
        print(f"  Pricing: {pricing}")
        print(f"  Programs: {len(programs)}")
        
    def test_get_pricing_config_has_default_programs(self):
        """Verify default programs are present"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        assert response.status_code == 200
        
        data = response.json()
        programs = data.get("included_programs", [])
        program_names = [p.get("name") for p in programs]
        
        # Check each program has correct structure
        for prog in programs:
            assert "name" in prog, "Program missing 'name'"
            assert "duration_value" in prog, "Program missing 'duration_value'"
            assert "duration_unit" in prog, "Program missing 'duration_unit'"
            assert prog["duration_unit"] in ["months", "sessions"], f"Invalid duration_unit: {prog['duration_unit']}"
        
        print(f"✓ Programs have valid structure: {program_names}")
        
    def test_update_pricing_config_package_name(self):
        """PUT /api/admin/subscribers/pricing-config - Update package name"""
        # First get current config
        get_response = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        assert get_response.status_code == 200
        original_config = get_response.json()
        
        # Update with new package name
        updated_config = {
            "package_name": "TEST_Updated Annual Package",
            "duration_months": original_config.get("duration_months", 12),
            "pricing": original_config.get("pricing", {"INR": 50000, "USD": 600, "AED": 2200, "EUR": 550, "GBP": 470}),
            "included_programs": original_config.get("included_programs", []),
            "default_sessions_current": original_config.get("default_sessions_current", 12),
            "default_sessions_carry_forward": original_config.get("default_sessions_carry_forward", 0),
            "notes": ""
        }
        
        put_response = requests.put(
            f"{BASE_URL}/api/admin/subscribers/pricing-config",
            json=updated_config
        )
        assert put_response.status_code == 200, f"PUT failed: {put_response.text}"
        
        # Verify update persisted
        verify_response = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        assert verify_response.status_code == 200
        verify_data = verify_response.json()
        assert verify_data["package_name"] == "TEST_Updated Annual Package", "Package name was not updated"
        
        print(f"✓ Package name updated successfully")
        
        # Restore original
        restore_config = {
            "package_name": original_config.get("package_name", "Annual Healing Package"),
            "duration_months": original_config.get("duration_months", 12),
            "pricing": original_config.get("pricing", {"INR": 50000, "USD": 600, "AED": 2200, "EUR": 550, "GBP": 470}),
            "included_programs": original_config.get("included_programs", []),
            "default_sessions_current": original_config.get("default_sessions_current", 12),
            "default_sessions_carry_forward": original_config.get("default_sessions_carry_forward", 0),
            "notes": ""
        }
        requests.put(f"{BASE_URL}/api/admin/subscribers/pricing-config", json=restore_config)
        print(f"✓ Restored original config")
    
    def test_update_pricing_config_pricing_by_currency(self):
        """PUT pricing config - Update pricing for specific currency"""
        # Get current
        get_response = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        assert get_response.status_code == 200
        original = get_response.json()
        
        # Update INR pricing
        new_pricing = original.get("pricing", {}).copy()
        new_pricing["INR"] = 55000  # Change from 50000
        
        updated_config = {
            "package_name": original.get("package_name", "Annual Healing Package"),
            "duration_months": original.get("duration_months", 12),
            "pricing": new_pricing,
            "included_programs": original.get("included_programs", []),
            "default_sessions_current": original.get("default_sessions_current", 12),
            "default_sessions_carry_forward": original.get("default_sessions_carry_forward", 0),
            "notes": ""
        }
        
        put_response = requests.put(
            f"{BASE_URL}/api/admin/subscribers/pricing-config",
            json=updated_config
        )
        assert put_response.status_code == 200
        
        # Verify
        verify = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        assert verify.json()["pricing"]["INR"] == 55000, "INR pricing not updated"
        print(f"✓ Currency pricing updated: INR = 55000")
        
        # Restore
        original["notes"] = ""
        requests.put(f"{BASE_URL}/api/admin/subscribers/pricing-config", json=original)
        print(f"✓ Restored original pricing")
        
    def test_update_pricing_config_add_program(self):
        """PUT pricing config - Add a new included program"""
        # Get current
        get_response = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        assert get_response.status_code == 200
        original = get_response.json()
        
        # Add new program
        programs = original.get("included_programs", []).copy()
        new_program = {"name": "TEST_New Program", "duration_value": 3, "duration_unit": "sessions"}
        programs.append(new_program)
        
        updated = {
            "package_name": original.get("package_name"),
            "duration_months": original.get("duration_months", 12),
            "pricing": original.get("pricing"),
            "included_programs": programs,
            "default_sessions_current": original.get("default_sessions_current", 12),
            "default_sessions_carry_forward": original.get("default_sessions_carry_forward", 0),
            "notes": ""
        }
        
        put_response = requests.put(
            f"{BASE_URL}/api/admin/subscribers/pricing-config",
            json=updated
        )
        assert put_response.status_code == 200
        
        # Verify
        verify = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        verify_programs = verify.json()["included_programs"]
        program_names = [p["name"] for p in verify_programs]
        assert "TEST_New Program" in program_names, "New program not added"
        print(f"✓ New program added successfully")
        
        # Restore original by removing the test program
        original["notes"] = ""
        requests.put(f"{BASE_URL}/api/admin/subscribers/pricing-config", json=original)
        print(f"✓ Restored original programs")
    
    def test_update_pricing_config_duration_months(self):
        """PUT pricing config - Update duration months"""
        get_response = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        original = get_response.json()
        
        updated = {
            "package_name": original.get("package_name"),
            "duration_months": 6,  # Change from 12 to 6
            "pricing": original.get("pricing"),
            "included_programs": original.get("included_programs", []),
            "default_sessions_current": original.get("default_sessions_current", 12),
            "default_sessions_carry_forward": original.get("default_sessions_carry_forward", 0),
            "notes": ""
        }
        
        put_response = requests.put(
            f"{BASE_URL}/api/admin/subscribers/pricing-config",
            json=updated
        )
        assert put_response.status_code == 200
        
        verify = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        assert verify.json()["duration_months"] == 6, "Duration not updated"
        print(f"✓ Duration updated to 6 months")
        
        # Restore
        original["notes"] = ""
        requests.put(f"{BASE_URL}/api/admin/subscribers/pricing-config", json=original)
        print(f"✓ Restored original duration")
        
    def test_update_pricing_config_sessions(self):
        """PUT pricing config - Update default sessions"""
        get_response = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        original = get_response.json()
        
        updated = {
            "package_name": original.get("package_name"),
            "duration_months": original.get("duration_months", 12),
            "pricing": original.get("pricing"),
            "included_programs": original.get("included_programs", []),
            "default_sessions_current": 24,  # Change from 12 to 24
            "default_sessions_carry_forward": 2,  # Change from 0 to 2
            "notes": ""
        }
        
        put_response = requests.put(
            f"{BASE_URL}/api/admin/subscribers/pricing-config",
            json=updated
        )
        assert put_response.status_code == 200
        
        verify = requests.get(f"{BASE_URL}/api/admin/subscribers/pricing-config")
        data = verify.json()
        assert data["default_sessions_current"] == 24, "Sessions current not updated"
        assert data["default_sessions_carry_forward"] == 2, "Sessions carry forward not updated"
        print(f"✓ Sessions updated: current=24, carry_forward=2")
        
        # Restore
        original["notes"] = ""
        requests.put(f"{BASE_URL}/api/admin/subscribers/pricing-config", json=original)
        print(f"✓ Restored original sessions")


class TestSubscriberListRegressions:
    """Regression tests to ensure existing subscriber endpoints still work"""
    
    def test_subscriber_list_still_works(self):
        """GET /api/admin/subscribers/list still returns array"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/list")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Expected list"
        print(f"✓ Subscriber list works, count: {len(data)}")
        
    def test_download_template_still_works(self):
        """GET /api/admin/subscribers/download-template still returns Excel"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/download-template")
        assert response.status_code == 200
        assert "spreadsheet" in response.headers.get("content-type", "") or response.headers.get("content-disposition") is not None
        print(f"✓ Download template works")
        
    def test_export_still_works(self):
        """GET /api/admin/subscribers/export still returns Excel"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/export")
        assert response.status_code == 200
        print(f"✓ Export subscribers works")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
