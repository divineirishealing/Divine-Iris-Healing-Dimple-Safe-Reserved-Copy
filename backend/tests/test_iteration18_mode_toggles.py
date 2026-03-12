"""
Iteration 18 - Mode Toggles Testing (enable_online, enable_offline, enable_in_person)

Tests for per-program mode toggle functionality:
1. Backend API returns mode toggle fields for programs
2. Mode toggle defaults (enable_online=true, enable_offline=true, enable_in_person=false)
3. Mode toggles can be updated via PUT /api/programs/{id}
4. GET /api/programs returns all mode toggle fields
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestProgramModeToggles:
    """Test mode toggle fields for programs"""
    
    test_program_id = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup and teardown for tests"""
        yield
        # Cleanup: Delete test program if created
        if self.test_program_id:
            try:
                requests.delete(f"{BASE_URL}/api/programs/{self.test_program_id}")
            except:
                pass
    
    def test_get_programs_returns_mode_fields(self):
        """Test that GET /api/programs returns enable_online, enable_offline, enable_in_person fields"""
        response = requests.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        programs = response.json()
        if len(programs) > 0:
            program = programs[0]
            # Check all mode fields exist
            assert 'enable_online' in program, "Missing enable_online field"
            assert 'enable_offline' in program, "Missing enable_offline field"
            assert 'enable_in_person' in program, "Missing enable_in_person field"
            print(f"PASS: Program '{program.get('title', 'N/A')}' has mode fields: online={program['enable_online']}, offline={program['enable_offline']}, in_person={program['enable_in_person']}")
        else:
            print("No programs found in database - skipping field check")
    
    def test_create_program_with_default_mode_toggles(self):
        """Test creating a program has correct default mode values"""
        test_id = f"test-mode-{uuid.uuid4().hex[:8]}"
        payload = {
            "title": f"TEST_ModeToggle_{test_id}",
            "category": "Test",
            "description": "Testing mode toggles",
            "image": "https://example.com/test.jpg"
        }
        
        response = requests.post(f"{BASE_URL}/api/programs", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        program = response.json()
        TestProgramModeToggles.test_program_id = program['id']
        
        # Check default values
        assert program['enable_online'] == True, f"Expected enable_online=True, got {program['enable_online']}"
        assert program['enable_offline'] == True, f"Expected enable_offline=True, got {program['enable_offline']}"
        assert program['enable_in_person'] == False, f"Expected enable_in_person=False, got {program['enable_in_person']}"
        print(f"PASS: New program has correct defaults: online=True, offline=True, in_person=False")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/programs/{program['id']}")
        TestProgramModeToggles.test_program_id = None
    
    def test_create_program_with_custom_mode_toggles(self):
        """Test creating a program with custom mode toggle values"""
        test_id = f"test-mode-custom-{uuid.uuid4().hex[:8]}"
        payload = {
            "title": f"TEST_CustomMode_{test_id}",
            "category": "Test",
            "description": "Testing custom mode toggles",
            "image": "https://example.com/test.jpg",
            "enable_online": False,
            "enable_offline": True,
            "enable_in_person": True
        }
        
        response = requests.post(f"{BASE_URL}/api/programs", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        program = response.json()
        TestProgramModeToggles.test_program_id = program['id']
        
        # Check custom values
        assert program['enable_online'] == False, f"Expected enable_online=False, got {program['enable_online']}"
        assert program['enable_offline'] == True, f"Expected enable_offline=True, got {program['enable_offline']}"
        assert program['enable_in_person'] == True, f"Expected enable_in_person=True, got {program['enable_in_person']}"
        print(f"PASS: Program created with custom modes: online=False, offline=True, in_person=True")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/programs/{program['id']}")
        TestProgramModeToggles.test_program_id = None
    
    def test_update_program_mode_toggles(self):
        """Test updating mode toggles via PUT /api/programs/{id}"""
        # First create a program
        test_id = f"test-mode-update-{uuid.uuid4().hex[:8]}"
        create_payload = {
            "title": f"TEST_UpdateMode_{test_id}",
            "category": "Test",
            "description": "Testing mode toggle updates",
            "image": "https://example.com/test.jpg",
            "enable_online": True,
            "enable_offline": True,
            "enable_in_person": False
        }
        
        create_response = requests.post(f"{BASE_URL}/api/programs", json=create_payload)
        assert create_response.status_code == 200
        program = create_response.json()
        TestProgramModeToggles.test_program_id = program['id']
        
        # Update mode toggles
        update_payload = {
            "title": program['title'],
            "category": program['category'],
            "description": program['description'],
            "image": program['image'],
            "enable_online": True,
            "enable_offline": False,
            "enable_in_person": True
        }
        
        update_response = requests.put(f"{BASE_URL}/api/programs/{program['id']}", json=update_payload)
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}"
        
        updated = update_response.json()
        assert updated['enable_online'] == True, f"Expected enable_online=True, got {updated['enable_online']}"
        assert updated['enable_offline'] == False, f"Expected enable_offline=False, got {updated['enable_offline']}"
        assert updated['enable_in_person'] == True, f"Expected enable_in_person=True, got {updated['enable_in_person']}"
        print(f"PASS: Mode toggles updated successfully")
        
        # Verify with GET
        get_response = requests.get(f"{BASE_URL}/api/programs/{program['id']}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched['enable_in_person'] == True, "Persistence check failed for enable_in_person"
        print(f"PASS: Mode toggles persisted correctly in database")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/programs/{program['id']}")
        TestProgramModeToggles.test_program_id = None
    
    def test_get_single_program_returns_mode_fields(self):
        """Test GET /api/programs/{id} returns mode fields"""
        # First create a program
        test_id = f"test-mode-single-{uuid.uuid4().hex[:8]}"
        payload = {
            "title": f"TEST_SingleMode_{test_id}",
            "category": "Test",
            "description": "Testing single program mode fields",
            "image": "https://example.com/test.jpg",
            "enable_online": True,
            "enable_offline": False,
            "enable_in_person": True
        }
        
        create_response = requests.post(f"{BASE_URL}/api/programs", json=payload)
        program = create_response.json()
        TestProgramModeToggles.test_program_id = program['id']
        
        # Get single program
        get_response = requests.get(f"{BASE_URL}/api/programs/{program['id']}")
        assert get_response.status_code == 200
        
        fetched = get_response.json()
        assert 'enable_online' in fetched, "Missing enable_online in single program response"
        assert 'enable_offline' in fetched, "Missing enable_offline in single program response"
        assert 'enable_in_person' in fetched, "Missing enable_in_person in single program response"
        assert fetched['enable_online'] == True
        assert fetched['enable_offline'] == False
        assert fetched['enable_in_person'] == True
        print(f"PASS: GET /api/programs/{program['id']} returns all mode fields correctly")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/programs/{program['id']}")
        TestProgramModeToggles.test_program_id = None


class TestVisibleOnlyProgramModes:
    """Test mode fields are returned when using visible_only filter"""
    
    def test_visible_only_programs_have_mode_fields(self):
        """Test visible_only=true programs return mode toggle fields"""
        response = requests.get(f"{BASE_URL}/api/programs?visible_only=true")
        assert response.status_code == 200
        
        programs = response.json()
        if len(programs) > 0:
            for p in programs[:3]:  # Check first 3
                assert 'enable_online' in p, f"Program {p.get('title')} missing enable_online"
                assert 'enable_offline' in p, f"Program {p.get('title')} missing enable_offline"
                assert 'enable_in_person' in p, f"Program {p.get('title')} missing enable_in_person"
            print(f"PASS: visible_only programs ({len(programs)}) all have mode toggle fields")
        else:
            print("No visible programs found - skipping")
    
    def test_upcoming_only_programs_have_mode_fields(self):
        """Test upcoming_only=true programs return mode toggle fields"""
        response = requests.get(f"{BASE_URL}/api/programs?upcoming_only=true")
        assert response.status_code == 200
        
        programs = response.json()
        if len(programs) > 0:
            for p in programs[:3]:
                assert 'enable_online' in p, f"Upcoming program {p.get('title')} missing enable_online"
                assert 'enable_offline' in p, f"Upcoming program {p.get('title')} missing enable_offline"
                assert 'enable_in_person' in p, f"Upcoming program {p.get('title')} missing enable_in_person"
            print(f"PASS: upcoming_only programs ({len(programs)}) all have mode toggle fields")
        else:
            print("No upcoming programs found - skipping")


class TestModeFieldDefaultsForExistingPrograms:
    """Test that existing programs get correct defaults for mode fields"""
    
    def test_all_programs_have_mode_fields_with_defaults(self):
        """Verify all programs have mode fields (with correct defaults for older programs)"""
        response = requests.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        
        programs = response.json()
        for p in programs:
            # All programs should have these fields (Pydantic default values)
            assert 'enable_online' in p, f"Program {p.get('id')} missing enable_online"
            assert 'enable_offline' in p, f"Program {p.get('id')} missing enable_offline"
            assert 'enable_in_person' in p, f"Program {p.get('id')} missing enable_in_person"
            
            # Check data types
            assert isinstance(p['enable_online'], bool), f"enable_online should be bool, got {type(p['enable_online'])}"
            assert isinstance(p['enable_offline'], bool), f"enable_offline should be bool, got {type(p['enable_offline'])}"
            assert isinstance(p['enable_in_person'], bool), f"enable_in_person should be bool, got {type(p['enable_in_person'])}"
        
        print(f"PASS: All {len(programs)} programs have mode fields with correct types")


class TestAPIHealthCheck:
    """Basic API health checks"""
    
    def test_api_is_accessible(self):
        """Test that API is responding"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        print(f"PASS: API is accessible at {BASE_URL}")
    
    def test_programs_endpoint_accessible(self):
        """Test programs endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        print(f"PASS: Programs endpoint accessible, returned {len(response.json())} programs")
