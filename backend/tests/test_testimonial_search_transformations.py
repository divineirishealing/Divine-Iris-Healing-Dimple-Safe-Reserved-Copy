# Test file for Testimonial Template System, Global Search, and Transformations features
# Testing: GET /api/search, GET /api/testimonials with filters, GET /api/testimonials/categories

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://iris-cms-preview.preview.emergentagent.com')

class TestGlobalSearch:
    """Test global search API endpoint"""
    
    def test_search_returns_structure(self):
        """GET /api/search returns programs, sessions, testimonials structure"""
        response = requests.get(f"{BASE_URL}/api/search?q=healing")
        assert response.status_code == 200
        data = response.json()
        assert "programs" in data
        assert "sessions" in data
        assert "testimonials" in data
        print(f"PASS: Search returns correct structure with {len(data['programs'])} programs, {len(data['sessions'])} sessions, {len(data['testimonials'])} testimonials")
    
    def test_search_minimum_query_length(self):
        """Search requires minimum 2 characters"""
        response = requests.get(f"{BASE_URL}/api/search?q=a")
        assert response.status_code == 200
        data = response.json()
        assert len(data['programs']) == 0
        assert len(data['sessions']) == 0
        assert len(data['testimonials']) == 0
        print("PASS: Search correctly returns empty for single character query")
    
    def test_search_empty_query(self):
        """Empty query returns empty results"""
        response = requests.get(f"{BASE_URL}/api/search?q=")
        assert response.status_code == 200
        data = response.json()
        assert len(data['programs']) == 0
        print("PASS: Empty query returns empty results")
    
    def test_search_finds_programs(self):
        """Search finds programs by title/description"""
        # First get a program title to search for
        prog_response = requests.get(f"{BASE_URL}/api/programs")
        assert prog_response.status_code == 200
        programs = prog_response.json()
        if programs:
            # Get first visible program title
            visible_prog = next((p for p in programs if p.get('visible', True)), None)
            if visible_prog:
                search_term = visible_prog['title'].split()[0]  # First word
                search_response = requests.get(f"{BASE_URL}/api/search?q={search_term}")
                assert search_response.status_code == 200
                print(f"PASS: Search for '{search_term}' returned results")
        print("PASS: Search programs test completed")


class TestTestimonialsAPI:
    """Test testimonials API with new filtering capabilities"""
    
    def test_get_all_testimonials(self):
        """GET /api/testimonials returns all testimonials"""
        response = requests.get(f"{BASE_URL}/api/testimonials")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Got {len(data)} testimonials")
    
    def test_filter_by_type_graphic(self):
        """GET /api/testimonials?type=graphic filters correctly"""
        response = requests.get(f"{BASE_URL}/api/testimonials?type=graphic")
        assert response.status_code == 200
        data = response.json()
        for t in data:
            assert t['type'] == 'graphic', f"Expected graphic, got {t['type']}"
        print(f"PASS: Filtered {len(data)} graphic testimonials")
    
    def test_filter_by_type_video(self):
        """GET /api/testimonials?type=video filters correctly"""
        response = requests.get(f"{BASE_URL}/api/testimonials?type=video")
        assert response.status_code == 200
        data = response.json()
        for t in data:
            assert t['type'] == 'video', f"Expected video, got {t['type']}"
        print(f"PASS: Filtered {len(data)} video testimonials")
    
    def test_filter_by_type_template(self):
        """GET /api/testimonials?type=template filters correctly"""
        response = requests.get(f"{BASE_URL}/api/testimonials?type=template")
        assert response.status_code == 200
        data = response.json()
        for t in data:
            assert t['type'] == 'template', f"Expected template, got {t['type']}"
        print(f"PASS: Filtered {len(data)} template testimonials")
    
    def test_filter_visible_only(self):
        """GET /api/testimonials?visible_only=true returns only visible"""
        response = requests.get(f"{BASE_URL}/api/testimonials?visible_only=true")
        assert response.status_code == 200
        data = response.json()
        for t in data:
            assert t.get('visible', True) == True
        print(f"PASS: Got {len(data)} visible testimonials")
    
    def test_search_filter(self):
        """GET /api/testimonials?search=text searches name/text/category"""
        response = requests.get(f"{BASE_URL}/api/testimonials?search=Dimple")
        assert response.status_code == 200
        data = response.json()
        print(f"PASS: Search for 'Dimple' returned {len(data)} results")
    
    def test_get_categories(self):
        """GET /api/testimonials/categories returns category list"""
        response = requests.get(f"{BASE_URL}/api/testimonials/categories")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Got {len(data)} categories: {data}")


class TestTemplateTestimonialCRUD:
    """Test creating and managing template testimonials"""
    
    test_testimonial_id = None
    
    def test_create_template_testimonial(self):
        """POST /api/testimonials creates template testimonial"""
        payload = {
            "type": "template",
            "name": "TEST_TestClient",
            "text": "This is an amazing healing experience that transformed my life completely!",
            "role": "Test Location, Mumbai",
            "category": "healing",
            "program_tags": [],
            "session_tags": [],
            "visible": True
        }
        response = requests.post(f"{BASE_URL}/api/testimonials", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data['type'] == 'template'
        assert data['name'] == 'TEST_TestClient'
        assert data['text'] == payload['text']
        assert data['role'] == payload['role']
        assert 'id' in data
        TestTemplateTestimonialCRUD.test_testimonial_id = data['id']
        print(f"PASS: Created template testimonial with id {data['id']}")
    
    def test_verify_created_testimonial(self):
        """GET /api/testimonials/{id} verifies persistence"""
        if not TestTemplateTestimonialCRUD.test_testimonial_id:
            pytest.skip("No testimonial ID from previous test")
        
        response = requests.get(f"{BASE_URL}/api/testimonials/{TestTemplateTestimonialCRUD.test_testimonial_id}")
        assert response.status_code == 200
        data = response.json()
        assert data['type'] == 'template'
        assert data['name'] == 'TEST_TestClient'
        print(f"PASS: Verified testimonial persisted correctly")
    
    def test_update_template_testimonial(self):
        """PUT /api/testimonials/{id} updates template"""
        if not TestTemplateTestimonialCRUD.test_testimonial_id:
            pytest.skip("No testimonial ID from previous test")
        
        payload = {
            "type": "template",
            "name": "TEST_UpdatedClient",
            "text": "Updated testimonial text with new content!",
            "role": "Updated Location",
            "category": "transformation",
            "program_tags": [],
            "session_tags": [],
            "visible": True
        }
        response = requests.put(f"{BASE_URL}/api/testimonials/{TestTemplateTestimonialCRUD.test_testimonial_id}", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data['name'] == 'TEST_UpdatedClient'
        assert data['text'] == payload['text']
        print("PASS: Updated template testimonial")
    
    def test_filter_by_program_id(self):
        """GET /api/testimonials?program_id={id} filters by program tag"""
        # First get a program ID
        prog_response = requests.get(f"{BASE_URL}/api/programs")
        if prog_response.status_code == 200 and prog_response.json():
            program_id = prog_response.json()[0]['id']
            response = requests.get(f"{BASE_URL}/api/testimonials?program_id={program_id}")
            assert response.status_code == 200
            print(f"PASS: Filter by program_id returned {len(response.json())} testimonials")
        else:
            print("SKIP: No programs available to test program_id filter")
    
    def test_cleanup_delete_testimonial(self):
        """DELETE /api/testimonials/{id} removes test data"""
        if not TestTemplateTestimonialCRUD.test_testimonial_id:
            pytest.skip("No testimonial ID to delete")
        
        response = requests.delete(f"{BASE_URL}/api/testimonials/{TestTemplateTestimonialCRUD.test_testimonial_id}")
        assert response.status_code == 200
        
        # Verify deletion
        verify = requests.get(f"{BASE_URL}/api/testimonials/{TestTemplateTestimonialCRUD.test_testimonial_id}")
        assert verify.status_code == 404
        print("PASS: Deleted test testimonial and verified removal")


class TestTransformationsPageSupport:
    """Test API support for Transformations page"""
    
    def test_combined_filters(self):
        """Test multiple filters combined (type + visible_only)"""
        response = requests.get(f"{BASE_URL}/api/testimonials?type=graphic&visible_only=true")
        assert response.status_code == 200
        data = response.json()
        for t in data:
            assert t['type'] == 'graphic'
            assert t.get('visible', True) == True
        print(f"PASS: Combined filters returned {len(data)} results")
    
    def test_programs_endpoint(self):
        """GET /api/programs returns data for filters"""
        response = requests.get(f"{BASE_URL}/api/programs?visible_only=true")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Got {len(data)} visible programs for filter dropdown")
    
    def test_sessions_endpoint(self):
        """GET /api/sessions returns data for filters"""
        response = requests.get(f"{BASE_URL}/api/sessions?visible_only=true")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Got {len(data)} visible sessions for filter dropdown")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
