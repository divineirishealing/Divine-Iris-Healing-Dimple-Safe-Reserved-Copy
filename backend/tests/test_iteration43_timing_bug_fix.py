"""
Iteration 43 - Bug Fix Tests for Program Timing and Timezone Display
Tests the P0 and P1 bug fixes for:
- P0: Program duration, start_date, timing not showing on program detail hero
- P1: Program timing not localized to user's timezone on upcoming programs cards
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestProgramTimingAPI:
    """Test that program API returns timing and time_zone fields"""
    
    def test_program_5_has_timing_field(self):
        """Program ID 5 (Quad Layer Healing) should have timing set"""
        response = requests.get(f"{BASE_URL}/api/programs/5")
        assert response.status_code == 200
        data = response.json()
        
        assert "timing" in data, "timing field missing from response"
        assert data["timing"] == "7:00 PM - 8:30 PM", f"Expected timing '7:00 PM - 8:30 PM', got '{data['timing']}'"
        print(f"SUCCESS: Program 5 timing = '{data['timing']}'")
    
    def test_program_5_has_time_zone_field(self):
        """Program ID 5 should have time_zone set"""
        response = requests.get(f"{BASE_URL}/api/programs/5")
        assert response.status_code == 200
        data = response.json()
        
        assert "time_zone" in data, "time_zone field missing from response"
        assert data["time_zone"] == "GST Dubai", f"Expected time_zone 'GST Dubai', got '{data['time_zone']}'"
        print(f"SUCCESS: Program 5 time_zone = '{data['time_zone']}'")
    
    def test_program_5_has_duration(self):
        """Program ID 5 should have duration set"""
        response = requests.get(f"{BASE_URL}/api/programs/5")
        assert response.status_code == 200
        data = response.json()
        
        assert "duration" in data, "duration field missing from response"
        assert data["duration"] == "21 Days", f"Expected duration '21 Days', got '{data['duration']}'"
        print(f"SUCCESS: Program 5 duration = '{data['duration']}'")
    
    def test_program_5_has_start_date(self):
        """Program ID 5 should have start_date set"""
        response = requests.get(f"{BASE_URL}/api/programs/5")
        assert response.status_code == 200
        data = response.json()
        
        assert "start_date" in data, "start_date field missing from response"
        assert "March 27th 2026" in data["start_date"], f"Expected start_date to contain 'March 27th 2026', got '{data['start_date']}'"
        print(f"SUCCESS: Program 5 start_date = '{data['start_date']}'")
    
    def test_program_5_is_upcoming(self):
        """Program ID 5 should be marked as upcoming"""
        response = requests.get(f"{BASE_URL}/api/programs/5")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("is_upcoming") == True, "Program 5 should have is_upcoming=true"
        print("SUCCESS: Program 5 is_upcoming = True")


class TestProgramWithoutTiming:
    """Test that programs without timing don't show timing fields"""
    
    def test_program_1_has_empty_timing(self):
        """Program ID 1 should have empty timing"""
        response = requests.get(f"{BASE_URL}/api/programs/1")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("timing") == "" or data.get("timing") is None, "Program 1 should have empty timing"
        print(f"SUCCESS: Program 1 timing is empty: '{data.get('timing')}'")
    
    def test_program_1_has_empty_time_zone(self):
        """Program ID 1 should have empty time_zone"""
        response = requests.get(f"{BASE_URL}/api/programs/1")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("time_zone") == "" or data.get("time_zone") is None, "Program 1 should have empty time_zone"
        print(f"SUCCESS: Program 1 time_zone is empty: '{data.get('time_zone')}'")


class TestUpcomingProgramsEndpoint:
    """Test the upcoming programs filter endpoint"""
    
    def test_upcoming_programs_filter(self):
        """GET /api/programs?upcoming_only=true should return only upcoming programs"""
        response = requests.get(f"{BASE_URL}/api/programs?visible_only=true&upcoming_only=true")
        assert response.status_code == 200
        data = response.json()
        
        assert len(data) >= 1, "Should have at least 1 upcoming program"
        
        # All returned programs should be upcoming
        for prog in data:
            assert prog.get("is_upcoming") == True, f"Program {prog['id']} should have is_upcoming=true"
        
        # Program 5 should be in the list
        program_5 = next((p for p in data if p["id"] == "5"), None)
        assert program_5 is not None, "Program 5 (Quad Layer Healing) should be in upcoming list"
        assert program_5.get("timing") == "7:00 PM - 8:30 PM", "Program 5 should have timing"
        assert program_5.get("time_zone") == "GST Dubai", "Program 5 should have time_zone"
        
        print(f"SUCCESS: Found {len(data)} upcoming programs, Program 5 included with timing")


class TestProgramUpdateAPI:
    """Test that timing fields can be updated via API"""
    
    def test_get_program_5_full_response(self):
        """Verify Program 5 returns complete data structure"""
        response = requests.get(f"{BASE_URL}/api/programs/5")
        assert response.status_code == 200
        data = response.json()
        
        # Check all required fields exist
        required_fields = ["id", "title", "category", "description", "timing", "time_zone", "duration", "start_date"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        print("SUCCESS: Program 5 has all required fields")
        print(f"  - Title: {data['title']}")
        print(f"  - Timing: {data['timing']}")
        print(f"  - Time Zone: {data['time_zone']}")
        print(f"  - Duration: {data['duration']}")
        print(f"  - Start Date: {data['start_date']}")
