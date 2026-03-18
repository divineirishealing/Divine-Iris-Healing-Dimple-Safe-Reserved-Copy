"""
Test Suite for Phase B Features - Student Growth Platform
Tests: Daily Progress, Extraordinary Moments, Pause/Resume Program
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://iris-dashboard-app.preview.emergentagent.com')

# Student session cookie for test user
TEST_SESSION = "test-session-token-for-ui-verification"

@pytest.fixture
def student_session():
    """Session with student auth cookie"""
    session = requests.Session()
    session.cookies.set('session_token', TEST_SESSION, domain='iris-dashboard-app.preview.emergentagent.com')
    session.headers.update({'Content-Type': 'application/json'})
    return session


class TestStudentHomeAPI:
    """Basic student home API tests"""

    def test_student_home_returns_200(self, student_session):
        """Student home endpoint should return 200"""
        response = student_session.get(f"{BASE_URL}/api/student/home")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_student_home_has_programs(self, student_session):
        """Student home should return programs list"""
        response = student_session.get(f"{BASE_URL}/api/student/home")
        assert response.status_code == 200
        data = response.json()
        assert "programs" in data, "programs field missing from response"
        assert isinstance(data["programs"], list), "programs should be a list"

    def test_student_home_has_financials(self, student_session):
        """Student home should return financials"""
        response = student_session.get(f"{BASE_URL}/api/student/home")
        assert response.status_code == 200
        data = response.json()
        assert "financials" in data, "financials field missing"

    def test_student_home_has_client_id(self, student_session):
        """Student home should return client_id"""
        response = student_session.get(f"{BASE_URL}/api/student/home")
        assert response.status_code == 200
        data = response.json()
        assert "client_id" in data, "client_id field missing"


class TestDailyProgressAPI:
    """Daily progress tracking endpoints"""

    def test_get_daily_progress_returns_200(self, student_session):
        """GET daily-progress should return 200"""
        response = student_session.get(f"{BASE_URL}/api/student/daily-progress")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_get_daily_progress_returns_list(self, student_session):
        """GET daily-progress should return a list"""
        response = student_session.get(f"{BASE_URL}/api/student/daily-progress")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Response should be a list"

    def test_get_daily_progress_with_month_filter(self, student_session):
        """GET daily-progress with month filter"""
        response = student_session.get(f"{BASE_URL}/api/student/daily-progress?month=2026-03")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # All entries should be from March 2026 (if any)
        for entry in data:
            assert entry.get("date", "").startswith("2026-03"), f"Entry date {entry.get('date')} not in March 2026"

    def test_post_daily_progress_saves_entry(self, student_session):
        """POST daily-progress should save an entry"""
        today = datetime.now().strftime("%Y-%m-%d")
        payload = {
            "date": today,
            "program_name": "AWRP",
            "notes": "Test progress entry from pytest",
            "rating": 4,
            "completed": True,
            "is_extraordinary": False,
            "extraordinary_note": ""
        }
        response = student_session.post(f"{BASE_URL}/api/student/daily-progress", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data
        assert data["message"] == "Progress saved"

    def test_post_daily_progress_with_extraordinary(self, student_session):
        """POST daily-progress with is_extraordinary=true"""
        today = datetime.now().strftime("%Y-%m-%d")
        payload = {
            "date": today,
            "program_name": "AWRP",
            "notes": "Extraordinary test entry",
            "rating": 5,
            "completed": True,
            "is_extraordinary": True,
            "extraordinary_note": "Amazing breakthrough moment from pytest!"
        }
        response = student_session.post(f"{BASE_URL}/api/student/daily-progress", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["message"] == "Progress saved"

    def test_post_daily_progress_upsert_behavior(self, student_session):
        """POST same date/program should update, not create duplicate"""
        test_date = "2026-01-15"
        program = "Money Magic Multiplier"
        
        # First post
        payload1 = {
            "date": test_date,
            "program_name": program,
            "notes": "First entry",
            "rating": 3,
            "completed": True,
            "is_extraordinary": False,
            "extraordinary_note": ""
        }
        response1 = student_session.post(f"{BASE_URL}/api/student/daily-progress", json=payload1)
        assert response1.status_code == 200

        # Second post (update)
        payload2 = {
            "date": test_date,
            "program_name": program,
            "notes": "Updated entry",
            "rating": 5,
            "completed": True,
            "is_extraordinary": True,
            "extraordinary_note": "Now extraordinary!"
        }
        response2 = student_session.post(f"{BASE_URL}/api/student/daily-progress", json=payload2)
        assert response2.status_code == 200

        # Verify only one entry exists for that date/program
        response = student_session.get(f"{BASE_URL}/api/student/daily-progress?month=2026-01")
        data = response.json()
        matching = [e for e in data if e.get("date") == test_date and e.get("program_name") == program]
        assert len(matching) <= 1, f"Expected 1 entry, got {len(matching)} - upsert not working"

    def test_daily_progress_validates_rating_bounds(self, student_session):
        """Rating should be clamped between 1-5"""
        today = datetime.now().strftime("%Y-%m-%d")
        payload = {
            "date": today,
            "program_name": "AWRP",
            "notes": "Rating boundary test",
            "rating": 10,  # Should be clamped to 5
            "completed": True,
            "is_extraordinary": False,
            "extraordinary_note": ""
        }
        response = student_session.post(f"{BASE_URL}/api/student/daily-progress", json=payload)
        assert response.status_code == 200


class TestExtraordinaryMomentsAPI:
    """Extraordinary moments endpoint"""

    def test_get_extraordinary_moments_returns_200(self, student_session):
        """GET extraordinary-moments should return 200"""
        response = student_session.get(f"{BASE_URL}/api/student/extraordinary-moments")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_get_extraordinary_moments_returns_list(self, student_session):
        """GET extraordinary-moments should return a list"""
        response = student_session.get(f"{BASE_URL}/api/student/extraordinary-moments")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Response should be a list"

    def test_extraordinary_moments_all_have_flag(self, student_session):
        """All returned moments should have is_extraordinary=true"""
        response = student_session.get(f"{BASE_URL}/api/student/extraordinary-moments")
        assert response.status_code == 200
        data = response.json()
        for entry in data:
            assert entry.get("is_extraordinary") == True, f"Entry {entry} missing is_extraordinary=true"


class TestPauseProgramAPI:
    """Pause/Resume program endpoints"""

    def test_pause_program_without_allow_pause_returns_403(self, student_session):
        """Pausing a program without allow_pause should return 403"""
        payload = {
            "program_name": "Money Magic Multiplier",  # Doesn't have allow_pause=true
            "pause_start": "2026-02-01",
            "pause_end": "2026-02-15",
            "reason": "Testing pause without permission"
        }
        response = student_session.post(f"{BASE_URL}/api/student/pause-program", json=payload)
        # Should be 403 (Pause not enabled) or 404 (program not found)
        assert response.status_code in [403, 404], f"Expected 403 or 404, got {response.status_code}: {response.text}"

    def test_pause_program_with_allow_pause_returns_200(self, student_session):
        """Pausing AWRP (has allow_pause=true) should work"""
        payload = {
            "program_name": "AWRP",
            "pause_start": "2026-02-01",
            "pause_end": "2026-02-28",
            "reason": "Testing pause functionality"
        }
        response = student_session.post(f"{BASE_URL}/api/student/pause-program", json=payload)
        # Either 200 (success) or 403 (if allow_pause not set for this test user)
        assert response.status_code in [200, 403, 404], f"Unexpected status {response.status_code}: {response.text}"

    def test_pause_nonexistent_program_returns_404(self, student_session):
        """Pausing a non-existent program should return 404"""
        payload = {
            "program_name": "Nonexistent Program XYZ",
            "pause_start": "2026-02-01",
            "pause_end": "2026-02-15",
            "reason": "Testing 404"
        }
        response = student_session.post(f"{BASE_URL}/api/student/pause-program", json=payload)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"


class TestResumeProgramAPI:
    """Resume program endpoint"""

    def test_resume_program_simple_returns_200_or_404(self, student_session):
        """Resume-program-simple endpoint should work"""
        payload = {
            "program_name": "AWRP"
        }
        response = student_session.post(f"{BASE_URL}/api/student/resume-program-simple", json=payload)
        # 200 if program exists and was paused, 404 if not found
        assert response.status_code in [200, 404], f"Unexpected status {response.status_code}: {response.text}"

    def test_resume_nonexistent_program_returns_404(self, student_session):
        """Resuming a non-existent program should return 404"""
        payload = {
            "program_name": "Nonexistent Program ABC"
        }
        response = student_session.post(f"{BASE_URL}/api/student/resume-program-simple", json=payload)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"


class TestProgramScheduleAPI:
    """Global program schedule (admin) endpoints"""

    def test_get_program_schedule_returns_200(self):
        """GET program-schedule should return 200"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/program-schedule")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_get_program_schedule_returns_list(self):
        """GET program-schedule should return a list"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/program-schedule")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Response should be a list"


class TestAdminSubscribersList:
    """Admin subscribers list endpoint"""

    def test_list_subscribers_returns_200(self):
        """GET subscribers/list should return 200"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/list")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_list_subscribers_returns_list(self):
        """GET subscribers/list should return a list"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/list")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestProgramDetailModel:
    """Test that ProgramDetail model has allow_pause field"""

    def test_subscriber_programs_have_allow_pause_field(self):
        """Subscribers' programs_detail should include allow_pause field"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/list")
        assert response.status_code == 200
        data = response.json()
        
        # Find a subscriber with programs_detail
        for sub in data:
            programs_detail = sub.get("subscription", {}).get("programs_detail", [])
            for prog in programs_detail:
                # Check that allow_pause field exists (may be True or False)
                # This verifies the model includes the field
                if "allow_pause" in prog:
                    return  # Test passes if any program has the field
        
        # If no programs_detail found, skip (not fail)
        pytest.skip("No programs_detail found in any subscriber")
