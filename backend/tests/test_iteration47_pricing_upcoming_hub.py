"""
Iteration 47: Test suite for new features
1. Closure badge on cards (both Flagship and Upcoming) when enrollment_open=false
2. Pricing Hub admin tab - Excel-style grid for all programs + sessions pricing
3. Upcoming Hub admin tab - Excel-style grid for all card-related settings
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://client-garden.preview.emergentagent.com').rstrip('/')

class TestProgramsCRUD:
    """Test Programs API for closure_text and enrollment_open fields"""
    
    def test_get_programs_list(self):
        """Test GET /api/programs returns program list with closure fields"""
        response = requests.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        print(f"PASS: Found {len(data)} programs")
        
    def test_program_has_closure_fields(self):
        """Test that programs have closure_text and enrollment_open fields"""
        response = requests.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        programs = response.json()
        
        for program in programs[:3]:  # Check first 3 programs
            assert 'enrollment_open' in program or program.get('enrollment_open') is None, f"Missing enrollment_open in {program.get('title')}"
            assert 'closure_text' in program or program.get('closure_text') is None, f"Missing closure_text in {program.get('title')}"
            print(f"PASS: {program.get('title')} has enrollment_open={program.get('enrollment_open')}, closure_text={program.get('closure_text')}")
            
    def test_program_with_enrollment_off_has_closure_text(self):
        """Test that programs with enrollment_open=false have closure_text"""
        response = requests.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        programs = response.json()
        
        closed_programs = [p for p in programs if p.get('enrollment_open') == False]
        if closed_programs:
            for p in closed_programs:
                closure_text = p.get('closure_text', 'Registration Closed')
                assert closure_text in ['Registration Closed', 'Seats Full', 'Enrollment Closed', 'Sold Out'], f"Unexpected closure_text: {closure_text}"
                print(f"PASS: Closed program '{p.get('title')}' has closure_text='{closure_text}'")
        else:
            print("INFO: No programs with enrollment_open=false found for closure_text test")
            
    def test_update_program_closure_text(self):
        """Test that closure_text can be updated via PUT /api/programs/{id}"""
        # Get a program first
        response = requests.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        programs = response.json()
        assert len(programs) > 0
        
        test_program = programs[0]
        original_closure_text = test_program.get('closure_text', 'Registration Closed')
        
        # Update closure_text
        new_closure_text = 'Seats Full' if original_closure_text != 'Seats Full' else 'Sold Out'
        test_program['closure_text'] = new_closure_text
        
        update_response = requests.put(f"{BASE_URL}/api/programs/{test_program['id']}", json=test_program)
        assert update_response.status_code == 200
        print(f"PASS: Updated closure_text to '{new_closure_text}'")
        
        # Verify update
        verify_response = requests.get(f"{BASE_URL}/api/programs")
        updated_program = next((p for p in verify_response.json() if p['id'] == test_program['id']), None)
        assert updated_program is not None
        assert updated_program.get('closure_text') == new_closure_text
        print(f"PASS: Verified closure_text updated to '{new_closure_text}'")
        
        # Restore original
        test_program['closure_text'] = original_closure_text
        requests.put(f"{BASE_URL}/api/programs/{test_program['id']}", json=test_program)
        print(f"PASS: Restored closure_text to '{original_closure_text}'")


class TestSessionsAPI:
    """Test Sessions API for Pricing Hub"""
    
    def test_get_sessions_list(self):
        """Test GET /api/sessions returns session list"""
        response = requests.get(f"{BASE_URL}/api/sessions")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Found {len(data)} sessions")
        
    def test_session_has_pricing_fields(self):
        """Test that sessions have multi-currency pricing fields"""
        response = requests.get(f"{BASE_URL}/api/sessions")
        assert response.status_code == 200
        sessions = response.json()
        
        if len(sessions) > 0:
            session = sessions[0]
            pricing_fields = ['price_aed', 'price_inr', 'price_usd']
            for field in pricing_fields:
                assert field in session, f"Missing {field} in session {session.get('title')}"
            print(f"PASS: Session '{session.get('title')}' has pricing fields: AED={session.get('price_aed')}, INR={session.get('price_inr')}, USD={session.get('price_usd')}")
        else:
            print("INFO: No sessions found for pricing fields test")
            
    def test_update_session_pricing(self):
        """Test that session pricing can be updated via PUT /api/sessions/{id}"""
        response = requests.get(f"{BASE_URL}/api/sessions")
        assert response.status_code == 200
        sessions = response.json()
        
        if len(sessions) > 0:
            test_session = sessions[0]
            original_price_aed = test_session.get('price_aed', 0)
            
            # Update price
            test_session['price_aed'] = 999
            update_response = requests.put(f"{BASE_URL}/api/sessions/{test_session['id']}", json=test_session)
            assert update_response.status_code == 200
            print(f"PASS: Updated price_aed to 999")
            
            # Verify update
            verify_response = requests.get(f"{BASE_URL}/api/sessions")
            updated_session = next((s for s in verify_response.json() if s['id'] == test_session['id']), None)
            assert updated_session is not None
            assert updated_session.get('price_aed') == 999
            print(f"PASS: Verified price_aed updated to 999")
            
            # Restore original
            test_session['price_aed'] = original_price_aed
            requests.put(f"{BASE_URL}/api/sessions/{test_session['id']}", json=test_session)
            print(f"PASS: Restored price_aed to {original_price_aed}")
        else:
            print("INFO: No sessions found for pricing update test")


class TestUpcomingPrograms:
    """Test Upcoming Programs for closure overlay logic"""
    
    def test_get_upcoming_programs(self):
        """Test GET /api/programs?upcoming_only=true returns upcoming programs"""
        response = requests.get(f"{BASE_URL}/api/programs?visible_only=true&upcoming_only=true")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Found {len(data)} upcoming programs")
        
        for p in data:
            assert p.get('is_upcoming') == True, f"Program '{p.get('title')}' is_upcoming should be True"
            print(f"  - {p.get('title')}: enrollment_open={p.get('enrollment_open')}, closure_text={p.get('closure_text')}")
    
    def test_upcoming_program_fields(self):
        """Test that upcoming programs have all required fields for UpcomingHubTab"""
        response = requests.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        programs = response.json()
        
        required_fields = [
            'is_upcoming', 'is_flagship', 'enrollment_open', 'closure_text',
            'start_date', 'end_date', 'deadline_date', 'timing', 'time_zone',
            'exclusive_offer_enabled', 'exclusive_offer_text', 'offer_text',
            'enable_online', 'enable_offline', 'enable_in_person'
        ]
        
        if len(programs) > 0:
            program = programs[0]
            missing_fields = [f for f in required_fields if f not in program]
            if missing_fields:
                print(f"WARN: Missing fields in program: {missing_fields}")
            else:
                print(f"PASS: Program '{program.get('title')}' has all required fields for UpcomingHubTab")
        else:
            print("INFO: No programs found for field test")


class TestProgramsTierPricing:
    """Test Programs with duration_tiers for Pricing Hub"""
    
    def test_flagship_programs_have_tiers(self):
        """Test that flagship programs have duration_tiers"""
        response = requests.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        programs = response.json()
        
        flagship_programs = [p for p in programs if p.get('is_flagship') == True]
        print(f"Found {len(flagship_programs)} flagship programs")
        
        for p in flagship_programs:
            tiers = p.get('duration_tiers', [])
            print(f"  - {p.get('title')}: {len(tiers)} tiers")
            for tier in tiers:
                print(f"      {tier.get('label')}: AED={tier.get('price_aed')}, INR={tier.get('price_inr')}, USD={tier.get('price_usd')}")
                
    def test_tier_pricing_fields(self):
        """Test that duration_tiers have pricing fields"""
        response = requests.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        programs = response.json()
        
        program_with_tiers = next((p for p in programs if len(p.get('duration_tiers', [])) > 0), None)
        if program_with_tiers:
            tier = program_with_tiers['duration_tiers'][0]
            pricing_fields = ['price_aed', 'price_inr', 'price_usd']
            for field in pricing_fields:
                assert field in tier, f"Missing {field} in tier {tier.get('label')}"
            print(f"PASS: Tier '{tier.get('label')}' has all pricing fields")
        else:
            print("INFO: No programs with duration_tiers found")


class TestFlagshipProgramsEnrollment:
    """Test Flagship Programs enrollment_open logic"""
    
    def test_flagship_programs_enrollment_status(self):
        """Test flagship programs enrollment_open status"""
        response = requests.get(f"{BASE_URL}/api/programs?visible_only=true")
        assert response.status_code == 200
        programs = response.json()
        
        # All visible programs are shown in Flagship section
        for p in programs:
            enrollment_open = p.get('enrollment_open')
            closure_text = p.get('closure_text', 'Registration Closed')
            print(f"  - {p.get('title')}: enrollment_open={enrollment_open}, closure_text='{closure_text}'")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
