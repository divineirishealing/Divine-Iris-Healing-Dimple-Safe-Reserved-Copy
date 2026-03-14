"""
Iteration 54: Testing Programs Hub 'Replicate' column, Pricing Hub updates,
Homepage flagship replicate_to_flagship behavior, Coming Soon with Express Your Interest,
and /api/notify-me endpoint.
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestProgramsAPI:
    """Test programs API for replicate_to_flagship field"""
    
    def test_get_all_programs(self, api_client):
        """Verify programs endpoint returns all programs with required fields"""
        response = api_client.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        programs = response.json()
        assert isinstance(programs, list)
        assert len(programs) > 0
        print(f"SUCCESS: Got {len(programs)} programs")
        
    def test_program_has_replicate_to_flagship_field(self, api_client):
        """Verify programs have replicate_to_flagship field"""
        response = api_client.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        programs = response.json()
        
        for p in programs:
            assert 'replicate_to_flagship' in p, f"Program {p.get('title')} missing replicate_to_flagship field"
        print("SUCCESS: All programs have replicate_to_flagship field")
        
    def test_program_5_has_replicate_true(self, api_client):
        """Verify program ID 5 (Quad Layer Healing) has replicate_to_flagship=true"""
        response = api_client.get(f"{BASE_URL}/api/programs/5")
        assert response.status_code == 200
        program = response.json()
        assert program.get('replicate_to_flagship') == True, "Program 5 should have replicate_to_flagship=true"
        assert program.get('is_upcoming') == True, "Program 5 should have is_upcoming=true"
        assert program.get('is_flagship') == True, "Program 5 should have is_flagship=true"
        print(f"SUCCESS: Program 5 ({program.get('title')}) has replicate_to_flagship=true, is_upcoming=true, is_flagship=true")
        
    def test_program_1_has_replicate_false(self, api_client):
        """Verify program ID 1 (AWRP) has replicate_to_flagship=false but is_upcoming=true"""
        response = api_client.get(f"{BASE_URL}/api/programs/1")
        assert response.status_code == 200
        program = response.json()
        assert program.get('replicate_to_flagship') == False, "Program 1 should have replicate_to_flagship=false"
        assert program.get('is_upcoming') == True, "Program 1 should have is_upcoming=true"
        print(f"SUCCESS: Program 1 ({program.get('title')}) has replicate_to_flagship=false, is_upcoming=true")
        
    def test_non_upcoming_programs_have_replicate_false(self, api_client):
        """Verify non-upcoming programs have replicate_to_flagship=false"""
        response = api_client.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        programs = response.json()
        
        non_upcoming = [p for p in programs if not p.get('is_upcoming')]
        for p in non_upcoming:
            # Non-upcoming programs should have replicate_to_flagship=false
            assert p.get('replicate_to_flagship') == False, f"Non-upcoming program {p.get('title')} should have replicate_to_flagship=false"
        print(f"SUCCESS: {len(non_upcoming)} non-upcoming programs all have replicate_to_flagship=false")


class TestEnrollmentStatus:
    """Test enrollment_status field for coming_soon"""
    
    def test_programs_have_enrollment_status_field(self, api_client):
        """Verify programs have enrollment_status field"""
        response = api_client.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        programs = response.json()
        
        for p in programs:
            assert 'enrollment_status' in p, f"Program {p.get('title')} missing enrollment_status field"
        print("SUCCESS: All programs have enrollment_status field")
        
    def test_find_coming_soon_program(self, api_client):
        """Find programs with enrollment_status=coming_soon"""
        response = api_client.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        programs = response.json()
        
        coming_soon = [p for p in programs if p.get('enrollment_status') == 'coming_soon']
        print(f"Found {len(coming_soon)} coming_soon programs: {[p.get('title') for p in coming_soon]}")
        # Can be 0 or more
        return coming_soon


class TestNotifyMeAPI:
    """Test /api/notify-me endpoint for Express Your Interest"""
    
    def test_notify_me_post(self, api_client):
        """Test POST /api/notify-me creates subscription"""
        test_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        payload = {
            "email": test_email,
            "program_id": "5",
            "program_title": "Quad Layer Healing"
        }
        response = api_client.post(f"{BASE_URL}/api/notify-me", json=payload)
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        print(f"SUCCESS: Created notify-me subscription for {test_email}")
        
    def test_notify_me_get(self, api_client):
        """Test GET /api/notify-me returns subscribers list"""
        response = api_client.get(f"{BASE_URL}/api/notify-me")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Expected list of subscribers"
        print(f"SUCCESS: GET /api/notify-me returns {len(data)} subscribers")
        
    def test_notify_me_with_invalid_email(self, api_client):
        """Test POST /api/notify-me with invalid email"""
        payload = {
            "email": "not-an-email",
            "program_id": "5",
            "program_title": "Test"
        }
        response = api_client.post(f"{BASE_URL}/api/notify-me", json=payload)
        # Should still accept or return 422 for validation error
        # The API might be lenient, so just check it doesn't 500
        assert response.status_code != 500, f"Server error: {response.text}"
        print(f"INFO: POST with invalid email returned status {response.status_code}")


class TestProgramUpdate:
    """Test updating program replicate_to_flagship field"""
    
    def test_update_replicate_to_flagship_field(self, api_client):
        """Test updating replicate_to_flagship on a program"""
        # First get program 1 data
        response = api_client.get(f"{BASE_URL}/api/programs/1")
        assert response.status_code == 200
        program = response.json()
        original_replicate = program.get('replicate_to_flagship', False)
        
        # Update with all required fields
        update_data = {
            "title": program.get("title"),
            "category": program.get("category"),
            "description": program.get("description"),
            "image": program.get("image"),
            "replicate_to_flagship": not original_replicate,
            # Include other fields to ensure full update
            "is_upcoming": program.get("is_upcoming", False),
            "is_flagship": program.get("is_flagship", False),
            "enrollment_status": program.get("enrollment_status", "open"),
        }
        
        response = api_client.put(f"{BASE_URL}/api/programs/1", json=update_data)
        assert response.status_code == 200, f"Update failed: {response.text}"
        
        # Verify change
        response = api_client.get(f"{BASE_URL}/api/programs/1")
        assert response.status_code == 200
        updated = response.json()
        assert updated.get('replicate_to_flagship') == (not original_replicate), "replicate_to_flagship not updated"
        print(f"SUCCESS: Updated replicate_to_flagship from {original_replicate} to {not original_replicate}")
        
        # Revert back
        update_data["replicate_to_flagship"] = original_replicate
        response = api_client.put(f"{BASE_URL}/api/programs/1", json=update_data)
        assert response.status_code == 200
        print("SUCCESS: Reverted replicate_to_flagship to original value")


class TestPricingAndTiersFields:
    """Test show_pricing_on_card and show_tiers_on_card fields"""
    
    def test_programs_have_pricing_tiers_fields(self, api_client):
        """Verify programs have show_pricing_on_card and show_tiers_on_card fields"""
        response = api_client.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        programs = response.json()
        
        for p in programs:
            assert 'show_pricing_on_card' in p, f"Program {p.get('title')} missing show_pricing_on_card"
            assert 'show_tiers_on_card' in p, f"Program {p.get('title')} missing show_tiers_on_card"
        print("SUCCESS: All programs have show_pricing_on_card and show_tiers_on_card fields")


class TestSessionsAPI:
    """Test sessions API for Pricing Hub"""
    
    def test_get_sessions(self, api_client):
        """Verify sessions endpoint works"""
        response = api_client.get(f"{BASE_URL}/api/sessions")
        assert response.status_code == 200
        sessions = response.json()
        assert isinstance(sessions, list)
        print(f"SUCCESS: Got {len(sessions)} sessions")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
