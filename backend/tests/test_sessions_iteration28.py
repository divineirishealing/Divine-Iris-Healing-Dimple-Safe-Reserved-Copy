"""
Test file for Session Model Updates - Iteration 28
Tests for: session_mode, available_dates, time_slots, testimonial_text, title_style, description_style
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

class TestSessionsAPI:
    """Test Session CRUD operations and new fields"""
    
    def test_get_sessions_list(self):
        """Test GET /api/sessions returns sessions with new fields"""
        response = requests.get(f"{BASE_URL}/api/sessions")
        assert response.status_code == 200
        
        sessions = response.json()
        assert isinstance(sessions, list)
        assert len(sessions) > 0, "Expected at least one session in database"
        
        # Verify new fields exist in response
        session = sessions[0]
        assert "id" in session
        assert "title" in session
        assert "description" in session
        assert "session_mode" in session, "session_mode field missing"
        assert "available_dates" in session, "available_dates field missing"
        assert "time_slots" in session, "time_slots field missing"
        assert "testimonial_text" in session, "testimonial_text field missing"
        assert "title_style" in session, "title_style field missing"
        assert "description_style" in session, "description_style field missing"
        print(f"PASS: Sessions endpoint returns {len(sessions)} sessions with all new fields")
    
    def test_get_single_session(self):
        """Test GET /api/sessions/{id} returns session with new fields"""
        # First get all sessions to find an ID
        response = requests.get(f"{BASE_URL}/api/sessions")
        sessions = response.json()
        assert len(sessions) > 0, "Need at least one session to test"
        
        session_id = sessions[0]["id"]
        response = requests.get(f"{BASE_URL}/api/sessions/{session_id}")
        assert response.status_code == 200
        
        session = response.json()
        assert session["id"] == session_id
        assert "session_mode" in session
        assert "time_slots" in session
        assert "testimonial_text" in session
        print(f"PASS: Single session endpoint returns session with all fields")
    
    def test_create_session_with_new_fields(self):
        """Test POST /api/sessions with new fields"""
        new_session = {
            "title": "TEST_Session_Iteration28",
            "description": "Test session for iteration 28 testing",
            "session_mode": "both",
            "available_dates": ["2026-02-15", "2026-02-16"],
            "time_slots": ["10:00 AM", "2:00 PM", "5:00 PM"],
            "testimonial_text": "This healing session changed my life! The energy was transformative.",
            "price_usd": 100,
            "price_inr": 8000,
            "price_aed": 350,
            "duration": "90 minutes",
            "visible": True
        }
        
        response = requests.post(f"{BASE_URL}/api/sessions", json=new_session)
        assert response.status_code == 200
        
        created = response.json()
        assert created["title"] == new_session["title"]
        assert created["session_mode"] == "both", f"Expected 'both', got {created['session_mode']}"
        assert created["time_slots"] == ["10:00 AM", "2:00 PM", "5:00 PM"]
        assert created["testimonial_text"] == new_session["testimonial_text"]
        assert "id" in created
        
        # Verify persistence with GET
        get_response = requests.get(f"{BASE_URL}/api/sessions/{created['id']}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["session_mode"] == "both"
        assert fetched["testimonial_text"] == new_session["testimonial_text"]
        
        print(f"PASS: Created session with ID {created['id']} with all new fields")
        return created["id"]
    
    def test_update_session_with_new_fields(self):
        """Test PUT /api/sessions/{id} updates new fields"""
        # Create a session first
        new_session = {
            "title": "TEST_Update_Session",
            "description": "Session to test updates",
            "session_mode": "online",
            "time_slots": [],
            "testimonial_text": "",
            "price_usd": 50,
            "duration": "60 minutes",
            "visible": True
        }
        
        create_response = requests.post(f"{BASE_URL}/api/sessions", json=new_session)
        assert create_response.status_code == 200
        session_id = create_response.json()["id"]
        
        # Update with new field values
        update_data = {
            "title": "TEST_Update_Session",
            "description": "Updated description",
            "session_mode": "offline",
            "time_slots": ["9:00 AM", "3:00 PM"],
            "testimonial_text": "Amazing session, highly recommend!",
            "price_usd": 75,
            "duration": "75 minutes",
            "visible": True
        }
        
        update_response = requests.put(f"{BASE_URL}/api/sessions/{session_id}", json=update_data)
        assert update_response.status_code == 200
        
        updated = update_response.json()
        assert updated["session_mode"] == "offline"
        assert updated["time_slots"] == ["9:00 AM", "3:00 PM"]
        assert updated["testimonial_text"] == "Amazing session, highly recommend!"
        
        # Verify persistence
        get_response = requests.get(f"{BASE_URL}/api/sessions/{session_id}")
        fetched = get_response.json()
        assert fetched["session_mode"] == "offline"
        assert fetched["testimonial_text"] == "Amazing session, highly recommend!"
        
        print(f"PASS: Updated session {session_id} with new fields")
        return session_id
    
    def test_session_mode_values(self):
        """Test that session_mode accepts all valid values: online, offline, both"""
        modes = ["online", "offline", "both"]
        created_ids = []
        
        for mode in modes:
            session = {
                "title": f"TEST_Mode_{mode}",
                "description": f"Test session with mode {mode}",
                "session_mode": mode,
                "time_slots": [],
                "testimonial_text": "",
                "price_usd": 0,
                "duration": "60 minutes",
                "visible": True
            }
            response = requests.post(f"{BASE_URL}/api/sessions", json=session)
            assert response.status_code == 200
            created = response.json()
            assert created["session_mode"] == mode, f"Expected mode '{mode}', got '{created['session_mode']}'"
            created_ids.append(created["id"])
        
        print(f"PASS: All session_mode values (online, offline, both) work correctly")
        return created_ids
    
    def test_visibility_toggle(self):
        """Test PATCH /api/sessions/{id}/visibility endpoint"""
        # Get a session
        response = requests.get(f"{BASE_URL}/api/sessions")
        sessions = response.json()
        assert len(sessions) > 0
        
        session_id = sessions[0]["id"]
        original_visible = sessions[0].get("visible", True)
        
        # Toggle visibility
        toggle_response = requests.patch(
            f"{BASE_URL}/api/sessions/{session_id}/visibility",
            json={"visible": not original_visible}
        )
        assert toggle_response.status_code == 200
        
        # Verify change
        get_response = requests.get(f"{BASE_URL}/api/sessions/{session_id}")
        updated = get_response.json()
        assert updated["visible"] == (not original_visible)
        
        # Restore original
        requests.patch(
            f"{BASE_URL}/api/sessions/{session_id}/visibility",
            json={"visible": original_visible}
        )
        print(f"PASS: Visibility toggle works correctly")
    
    def test_delete_test_sessions(self):
        """Cleanup: Delete all TEST_ prefixed sessions"""
        response = requests.get(f"{BASE_URL}/api/sessions")
        sessions = response.json()
        
        deleted_count = 0
        for session in sessions:
            if session["title"].startswith("TEST_"):
                del_response = requests.delete(f"{BASE_URL}/api/sessions/{session['id']}")
                if del_response.status_code == 200:
                    deleted_count += 1
        
        print(f"CLEANUP: Deleted {deleted_count} test sessions")


class TestSessionsFiltering:
    """Test sessions filtering functionality"""
    
    def test_visible_only_filter(self):
        """Test GET /api/sessions?visible_only=true returns only visible sessions"""
        response = requests.get(f"{BASE_URL}/api/sessions?visible_only=true")
        assert response.status_code == 200
        
        sessions = response.json()
        for session in sessions:
            assert session.get("visible", True) == True, f"Session {session['id']} should be visible"
        
        print(f"PASS: visible_only=true filter returns {len(sessions)} visible sessions")


class TestSessionResponseStructure:
    """Test that session response has correct structure for frontend consumption"""
    
    def test_session_fields_for_frontend(self):
        """Verify all fields needed by SessionsSection.jsx are present"""
        response = requests.get(f"{BASE_URL}/api/sessions")
        assert response.status_code == 200
        
        sessions = response.json()
        if len(sessions) == 0:
            pytest.skip("No sessions available to test structure")
        
        session = sessions[0]
        
        # Fields used by SessionsSection.jsx
        required_fields = [
            "id", "title", "description", "duration", 
            "session_mode", "available_dates", "time_slots", "testimonial_text",
            "price_usd", "price_inr", "price_aed",
            "title_style", "description_style", "visible", "order"
        ]
        
        for field in required_fields:
            assert field in session, f"Missing required field: {field}"
        
        # Verify types
        assert isinstance(session["available_dates"], list), "available_dates should be a list"
        assert isinstance(session["time_slots"], list), "time_slots should be a list"
        assert isinstance(session["testimonial_text"], str), "testimonial_text should be a string"
        assert session["session_mode"] in ["online", "offline", "both"], f"Invalid session_mode: {session['session_mode']}"
        
        print("PASS: Session response has correct structure for frontend")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
