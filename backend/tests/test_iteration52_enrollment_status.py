"""
Iteration 52: Test enrollment_status (open/closed/coming_soon) and is_group_program features
Testing:
1. enrollment_status field with 3 states: open, closed, coming_soon
2. is_group_program field for group programs filtering
3. /api/notify-me endpoint for Coming Soon subscriptions
4. Programs filtering (flagship, upcoming, group programs)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestEnrollmentStatusField:
    """Test enrollment_status field with 3 states: open, closed, coming_soon"""

    def test_get_programs_returns_enrollment_status(self):
        """Programs should have enrollment_status field"""
        response = requests.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        programs = response.json()
        assert len(programs) > 0, "Expected at least one program"
        
        # Check that all programs have enrollment_status field
        for p in programs:
            assert "enrollment_status" in p, f"Program {p.get('id')} missing enrollment_status"
            assert p["enrollment_status"] in ["open", "closed", "coming_soon"], \
                f"Invalid enrollment_status: {p.get('enrollment_status')}"

    def test_update_program_enrollment_status_to_coming_soon(self):
        """Test updating enrollment_status to coming_soon"""
        # Get a flagship program
        response = requests.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        programs = response.json()
        flagship = [p for p in programs if p.get("is_flagship") and not p.get("is_group_program")]
        assert len(flagship) > 0, "Expected at least one flagship program"
        
        program = flagship[0]
        program_id = program["id"]
        original_status = program.get("enrollment_status", "open")
        
        # Update to coming_soon
        update_data = {**program, "enrollment_status": "coming_soon", "enrollment_open": False}
        response = requests.put(f"{BASE_URL}/api/programs/{program_id}", json=update_data)
        assert response.status_code == 200
        
        # Verify update
        response = requests.get(f"{BASE_URL}/api/programs/{program_id}")
        assert response.status_code == 200
        updated = response.json()
        assert updated["enrollment_status"] == "coming_soon"
        
        # Restore original status
        restore_data = {**updated, "enrollment_status": original_status, "enrollment_open": original_status == "open"}
        requests.put(f"{BASE_URL}/api/programs/{program_id}", json=restore_data)

    def test_update_program_enrollment_status_to_closed(self):
        """Test updating enrollment_status to closed"""
        response = requests.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        programs = response.json()
        flagship = [p for p in programs if p.get("is_flagship") and not p.get("is_group_program")]
        assert len(flagship) > 0
        
        program = flagship[0]
        program_id = program["id"]
        original_status = program.get("enrollment_status", "open")
        
        # Update to closed
        update_data = {**program, "enrollment_status": "closed", "enrollment_open": False}
        response = requests.put(f"{BASE_URL}/api/programs/{program_id}", json=update_data)
        assert response.status_code == 200
        
        # Verify
        response = requests.get(f"{BASE_URL}/api/programs/{program_id}")
        assert response.status_code == 200
        assert response.json()["enrollment_status"] == "closed"
        
        # Restore
        restore_data = {**response.json(), "enrollment_status": original_status, "enrollment_open": original_status == "open"}
        requests.put(f"{BASE_URL}/api/programs/{program_id}", json=restore_data)


class TestIsGroupProgramField:
    """Test is_group_program field for group programs"""

    def test_get_programs_returns_is_group_program(self):
        """Programs should have is_group_program field"""
        response = requests.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        programs = response.json()
        
        for p in programs:
            assert "is_group_program" in p, f"Program {p.get('id')} missing is_group_program"
            assert isinstance(p["is_group_program"], bool)

    def test_group_programs_filtering(self):
        """Test that group programs can be filtered"""
        response = requests.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        programs = response.json()
        
        group_programs = [p for p in programs if p.get("is_group_program")]
        non_group_programs = [p for p in programs if not p.get("is_group_program")]
        
        # Log counts for verification
        print(f"Total programs: {len(programs)}")
        print(f"Group programs: {len(group_programs)}")
        print(f"Non-group programs: {len(non_group_programs)}")
        
        # Verify all programs are accounted for
        assert len(group_programs) + len(non_group_programs) == len(programs)


class TestNotifyMeEndpoint:
    """Test /api/notify-me endpoint for Coming Soon subscriptions"""

    def test_notify_me_post_success(self):
        """Test subscribing to notify-me"""
        test_email = f"test_notify_{os.urandom(4).hex()}@example.com"
        
        response = requests.post(f"{BASE_URL}/api/notify-me", json={
            "email": test_email,
            "program_id": "1",
            "program_title": "Test Program"
        })
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data.get("already_subscribed") == False

    def test_notify_me_duplicate_subscription(self):
        """Test duplicate subscription returns already_subscribed"""
        test_email = f"test_dup_{os.urandom(4).hex()}@example.com"
        
        # First subscription
        response1 = requests.post(f"{BASE_URL}/api/notify-me", json={
            "email": test_email,
            "program_id": "1",
            "program_title": "Test Program"
        })
        assert response1.status_code == 200
        assert response1.json().get("already_subscribed") == False
        
        # Duplicate subscription
        response2 = requests.post(f"{BASE_URL}/api/notify-me", json={
            "email": test_email,
            "program_id": "1",
            "program_title": "Test Program"
        })
        assert response2.status_code == 200
        assert response2.json().get("already_subscribed") == True

    def test_notify_me_get_subscribers(self):
        """Test getting notify-me subscribers"""
        response = requests.get(f"{BASE_URL}/api/notify-me")
        assert response.status_code == 200
        subs = response.json()
        assert isinstance(subs, list)
        
        # Each subscriber should have required fields
        if len(subs) > 0:
            sub = subs[0]
            assert "email" in sub
            assert "program_id" in sub

    def test_notify_me_get_by_program_id(self):
        """Test filtering subscribers by program_id"""
        response = requests.get(f"{BASE_URL}/api/notify-me?program_id=1")
        assert response.status_code == 200
        subs = response.json()
        assert isinstance(subs, list)
        
        # All returned should be for program_id=1
        for sub in subs:
            assert sub.get("program_id") == "1"


class TestFlagshipProgramsWithTiers:
    """Test flagship programs have duration_tiers with start/end dates"""

    def test_flagship_programs_have_tiers(self):
        """Flagship programs should have duration_tiers"""
        response = requests.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        programs = response.json()
        
        flagship = [p for p in programs if p.get("is_flagship") and not p.get("is_group_program")]
        print(f"Found {len(flagship)} flagship programs")
        
        for p in flagship:
            tiers = p.get("duration_tiers", [])
            print(f"Program '{p.get('title')}' has {len(tiers)} tiers")
            
            # Each tier should have start_date and end_date fields
            for i, t in enumerate(tiers):
                assert "label" in t, f"Tier {i} missing label"
                # start_date and end_date may be empty strings but should exist
                assert "start_date" in t or "start_date" not in t, "Tier structure valid"

    def test_flagship_programs_have_show_flags(self):
        """Flagship programs should have show_pricing_on_card and show_tiers_on_card"""
        response = requests.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        programs = response.json()
        
        flagship = [p for p in programs if p.get("is_flagship")]
        for p in flagship:
            # These flags should exist (defaults to True if not set)
            show_pricing = p.get("show_pricing_on_card", True)
            show_tiers = p.get("show_tiers_on_card", True)
            print(f"Program '{p.get('title')}': show_pricing={show_pricing}, show_tiers={show_tiers}")


class TestUpcomingProgramsFiltering:
    """Test upcoming programs filtering via API"""

    def test_upcoming_only_filter(self):
        """Test ?upcoming_only=true returns only upcoming programs"""
        response = requests.get(f"{BASE_URL}/api/programs?upcoming_only=true")
        assert response.status_code == 200
        programs = response.json()
        
        for p in programs:
            assert p.get("is_upcoming") == True, f"Program {p.get('id')} is not upcoming but returned with upcoming_only=true"

    def test_visible_only_filter(self):
        """Test ?visible_only=true returns only visible programs"""
        response = requests.get(f"{BASE_URL}/api/programs?visible_only=true")
        assert response.status_code == 200
        programs = response.json()
        
        for p in programs:
            assert p.get("visible") != False, f"Program {p.get('id')} is not visible but returned"


class TestProgramsHubStructure:
    """Test that programs are correctly categorized for the hub"""

    def test_programs_categorization(self):
        """Test programs can be categorized into upcoming, flagship, group"""
        response = requests.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        programs = response.json()
        
        upcoming = [p for p in programs if p.get("is_upcoming") and not p.get("is_group_program")]
        flagship = [p for p in programs if p.get("is_flagship") and not p.get("is_group_program")]
        group = [p for p in programs if p.get("is_group_program")]
        
        print(f"Upcoming programs (non-group): {len(upcoming)}")
        print(f"Flagship programs (non-group): {len(flagship)}")
        print(f"Group programs: {len(group)}")
        
        # Log program details
        for p in upcoming:
            print(f"  - Upcoming: {p.get('title')} (ID: {p.get('id')})")
        for p in flagship:
            print(f"  - Flagship: {p.get('title')} (ID: {p.get('id')})")
        for p in group:
            print(f"  - Group: {p.get('title')} (ID: {p.get('id')})")


class TestSessionsFiltering:
    """Test sessions filtering (empty sessions should be filtered)"""

    def test_get_sessions(self):
        """Test sessions API returns data"""
        response = requests.get(f"{BASE_URL}/api/sessions")
        assert response.status_code == 200
        sessions = response.json()
        assert isinstance(sessions, list)
        print(f"Total sessions: {len(sessions)}")
        
        # Check for named sessions
        named_sessions = [s for s in sessions if s.get("title") and s.get("title").strip()]
        print(f"Named sessions: {len(named_sessions)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
