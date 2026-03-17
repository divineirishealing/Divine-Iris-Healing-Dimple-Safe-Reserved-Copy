"""
Backend API Tests for Divine Iris Healing Website
Tests: Programs, Sessions, Testimonials, Stats, Newsletter, Image Upload endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://wellness-crm-deploy.preview.emergentagent.com')

class TestHealthCheck:
    """Basic API health checks"""
    
    def test_api_root_returns_200(self):
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ API root endpoint working: {data['message']}")


class TestProgramsAPI:
    """Programs CRUD endpoint tests"""
    
    def test_get_all_programs(self):
        response = requests.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/programs returned {len(data)} programs")
        
        # Verify data structure if programs exist
        if len(data) > 0:
            program = data[0]
            assert "id" in program
            assert "title" in program
            assert "description" in program
            assert "image" in program
            print(f"  First program: {program['title']}")
    
    def test_get_single_program(self):
        # First get all programs to get a valid ID
        response = requests.get(f"{BASE_URL}/api/programs")
        programs = response.json()
        
        if len(programs) > 0:
            program_id = programs[0]["id"]
            response = requests.get(f"{BASE_URL}/api/programs/{program_id}")
            assert response.status_code == 200
            data = response.json()
            assert data["id"] == program_id
            print(f"✓ GET /api/programs/{program_id} returned program: {data['title']}")
        else:
            pytest.skip("No programs in database to test single fetch")
    
    def test_get_nonexistent_program_returns_404(self):
        response = requests.get(f"{BASE_URL}/api/programs/nonexistent-id-12345")
        assert response.status_code == 404
        print("✓ GET /api/programs/nonexistent returns 404")
    
    def test_create_program(self):
        payload = {
            "title": "TEST_Program_Automated",
            "category": "Testing",
            "description": "This is an automated test program",
            "image": "https://example.com/test.jpg",
            "link": "/program/test"
        }
        response = requests.post(f"{BASE_URL}/api/programs", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == payload["title"]
        assert "id" in data
        print(f"✓ POST /api/programs created program with id: {data['id']}")
        
        # Cleanup
        cleanup_response = requests.delete(f"{BASE_URL}/api/programs/{data['id']}")
        assert cleanup_response.status_code == 200
        print(f"  Cleaned up test program {data['id']}")


class TestSessionsAPI:
    """Sessions CRUD endpoint tests"""
    
    def test_get_all_sessions(self):
        response = requests.get(f"{BASE_URL}/api/sessions")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/sessions returned {len(data)} sessions")
        
        if len(data) > 0:
            session = data[0]
            assert "id" in session
            assert "title" in session
            assert "description" in session
            print(f"  First session: {session['title']}")
    
    def test_get_single_session(self):
        response = requests.get(f"{BASE_URL}/api/sessions")
        sessions = response.json()
        
        if len(sessions) > 0:
            session_id = sessions[0]["id"]
            response = requests.get(f"{BASE_URL}/api/sessions/{session_id}")
            assert response.status_code == 200
            data = response.json()
            assert data["id"] == session_id
            print(f"✓ GET /api/sessions/{session_id} returned session: {data['title']}")
        else:
            pytest.skip("No sessions in database")
    
    def test_create_session(self):
        payload = {
            "title": "TEST_Session_Automated",
            "description": "This is an automated test session",
            "image": "https://example.com/test.jpg"
        }
        response = requests.post(f"{BASE_URL}/api/sessions", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == payload["title"]
        print(f"✓ POST /api/sessions created session with id: {data['id']}")
        
        # Cleanup
        cleanup_response = requests.delete(f"{BASE_URL}/api/sessions/{data['id']}")
        assert cleanup_response.status_code == 200
        print(f"  Cleaned up test session {data['id']}")


class TestTestimonialsAPI:
    """Testimonials endpoint tests"""
    
    def test_get_all_testimonials(self):
        response = requests.get(f"{BASE_URL}/api/testimonials")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/testimonials returned {len(data)} testimonials")
        
        if len(data) > 0:
            testimonial = data[0]
            assert "id" in testimonial
            assert "videoId" in testimonial
            assert "thumbnail" in testimonial
            print(f"  First testimonial videoId: {testimonial['videoId']}")
    
    def test_create_testimonial(self):
        payload = {
            "videoId": "TEST_video_id_123"
        }
        response = requests.post(f"{BASE_URL}/api/testimonials", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["videoId"] == payload["videoId"]
        print(f"✓ POST /api/testimonials created testimonial with id: {data['id']}")
        
        # Cleanup
        cleanup_response = requests.delete(f"{BASE_URL}/api/testimonials/{data['id']}")
        assert cleanup_response.status_code == 200
        print(f"  Cleaned up test testimonial {data['id']}")


class TestStatsAPI:
    """Stats endpoint tests"""
    
    def test_get_all_stats(self):
        response = requests.get(f"{BASE_URL}/api/stats")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/stats returned {len(data)} stats")
        
        if len(data) > 0:
            stat = data[0]
            assert "id" in stat
            assert "value" in stat
            assert "label" in stat
            print(f"  First stat: {stat['value']} {stat['label']}")


class TestNewsletterAPI:
    """Newsletter subscription tests"""
    
    def test_get_newsletter_subscribers(self):
        response = requests.get(f"{BASE_URL}/api/newsletter")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/newsletter returned {len(data)} subscribers")
    
    def test_subscribe_to_newsletter(self):
        import uuid
        test_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        payload = {"email": test_email}
        
        response = requests.post(f"{BASE_URL}/api/newsletter", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data or "email" in data
        print(f"✓ POST /api/newsletter subscribed: {test_email}")


class TestImageServing:
    """Test image upload and serving endpoints"""
    
    def test_serve_existing_image(self):
        # Test with a known uploaded image
        response = requests.get(f"{BASE_URL}/api/image/3543df83-750b-4049-a832-657b4c7c36c8.png")
        assert response.status_code == 200
        assert "image" in response.headers.get("Content-Type", "")
        print(f"✓ GET /api/image/{{filename}} serves images with correct content type")
    
    def test_serve_nonexistent_image_returns_404(self):
        response = requests.get(f"{BASE_URL}/api/image/nonexistent-image-12345.png")
        assert response.status_code == 404
        print("✓ GET /api/image/nonexistent returns 404")


class TestImageResolving:
    """Test that programs/sessions have properly resolvable image URLs"""
    
    def test_program_images_are_resolvable(self):
        response = requests.get(f"{BASE_URL}/api/programs")
        programs = response.json()
        
        for program in programs[:3]:  # Test first 3
            image_url = program.get("image", "")
            if image_url.startswith("/api/image/"):
                # Relative path - test it
                full_url = f"{BASE_URL}{image_url}"
                img_response = requests.get(full_url)
                assert img_response.status_code == 200, f"Failed to load image for program {program['title']}: {full_url}"
                print(f"  ✓ Program '{program['title']}' image loads correctly")
            elif image_url.startswith("http"):
                print(f"  ✓ Program '{program['title']}' has external image URL")
        
        print("✓ Program images are resolvable")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
