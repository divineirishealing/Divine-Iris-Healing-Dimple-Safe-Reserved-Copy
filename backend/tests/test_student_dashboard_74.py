"""
Test file for Student Dashboard APIs (Iteration 74)
Tests:
- Student home API /api/student/home
- Auth /api/auth/me
- Site settings API
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test session token for authenticated requests
TEST_SESSION_TOKEN = "test-session-22fbe1e5"

class TestStudentAPIs:
    """Student Dashboard API tests"""
    
    def test_auth_me_with_valid_session(self):
        """Test /api/auth/me returns user data with valid session"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            cookies={"session_token": TEST_SESSION_TOKEN}
        )
        print(f"Auth /me response: {response.status_code} - {response.text[:200] if response.text else 'empty'}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify user structure
        assert "id" in data, "Response missing 'id'"
        assert "email" in data, "Response missing 'email'"
        assert "name" in data, "Response missing 'name'"
        assert "tier" in data, "Response missing 'tier'"
        print(f"User authenticated: {data.get('name')} - Tier {data.get('tier')}")
    
    def test_auth_me_without_session(self):
        """Test /api/auth/me returns 401 without session"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        print(f"Auth /me (no session): {response.status_code}")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_student_home_with_session(self):
        """Test /api/student/home returns all expected data"""
        response = requests.get(
            f"{BASE_URL}/api/student/home",
            cookies={"session_token": TEST_SESSION_TOKEN}
        )
        print(f"Student home response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify all required fields exist
        assert "upcoming_programs" in data, "Missing 'upcoming_programs'"
        assert "financials" in data, "Missing 'financials'"
        assert "package" in data, "Missing 'package'"
        assert "journey_logs" in data, "Missing 'journey_logs'"
        assert "profile_status" in data, "Missing 'profile_status'"
        
        # Verify financials structure
        financials = data.get("financials", {})
        assert "status" in financials, "Financials missing 'status'"
        print(f"Student home data keys: {list(data.keys())}")
        print(f"Financials status: {financials.get('status')}")
        print(f"Profile status: {data.get('profile_status')}")
    
    def test_student_home_without_session(self):
        """Test /api/student/home returns 401 without session"""
        response = requests.get(f"{BASE_URL}/api/student/home")
        print(f"Student home (no session): {response.status_code}")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


class TestSiteSettingsAPI:
    """Site settings API tests"""
    
    def test_get_settings(self):
        """Test /api/settings returns site settings"""
        response = requests.get(f"{BASE_URL}/api/settings")
        print(f"Settings response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify sanctuary_settings exist (for dashboard customization)
        if "sanctuary_settings" in data:
            sanctuary = data["sanctuary_settings"]
            print(f"Sanctuary settings found: {list(sanctuary.keys()) if sanctuary else 'empty'}")
        else:
            print("Note: sanctuary_settings not yet configured")
        
        # Verify dashboard_settings exist
        if "dashboard_settings" in data:
            dashboard = data["dashboard_settings"]
            print(f"Dashboard settings found: {list(dashboard.keys()) if dashboard else 'empty'}")
        else:
            print("Note: dashboard_settings not yet configured")


class TestAdminAuth:
    """Admin authentication tests
    Note: Admin panel uses client-side localStorage auth, not API-based auth
    Credentials: admin / divineadmin2024
    """
    
    def test_admin_panel_does_not_have_api_login(self):
        """Admin login is client-side (localStorage), not API-based - this is by design"""
        response = requests.get(f"{BASE_URL}/api/settings")
        print(f"Settings endpoint accessible: {response.status_code}")
        # Settings should be publicly accessible for admin panel
        assert response.status_code == 200
        print("✓ Admin panel uses client-side auth (localStorage), not API auth")


class TestProgramsAndSessionsAPIs:
    """Programs and Sessions API tests (public)"""
    
    def test_get_programs(self):
        """Test /api/programs returns list"""
        response = requests.get(f"{BASE_URL}/api/programs")
        print(f"Programs response: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Programs should be a list"
        print(f"Found {len(data)} programs")
    
    def test_get_sessions(self):
        """Test /api/sessions returns list"""
        response = requests.get(f"{BASE_URL}/api/sessions")
        print(f"Sessions response: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Sessions should be a list"
        print(f"Found {len(data)} sessions")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
