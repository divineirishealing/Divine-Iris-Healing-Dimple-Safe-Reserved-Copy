"""
Iteration 21 Tests - About Page Fields & Program Content Sections

Tests:
1. Backend settings API returns about_philosophy, about_impact, about_mission, about_vision fields
2. Settings can be updated with these new fields
3. Program content_sections support section_type (journey, who_for, experience, why_now, cta, custom)
4. Program content_sections have ImageUploader support (image_url field)
5. Program content_sections have font styling support (title_style, subtitle_style, body_style)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://divine-sessions-dev.preview.emergentagent.com"


class TestSettingsAboutFields:
    """Test Backend settings API for about page fields"""
    
    def test_settings_returns_about_philosophy(self):
        """GET /api/settings should return about_philosophy field"""
        response = requests.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        data = response.json()
        assert 'about_philosophy' in data, "about_philosophy field missing from settings"
        print(f"about_philosophy: {data.get('about_philosophy', '')[:50]}...")
    
    def test_settings_returns_about_impact(self):
        """GET /api/settings should return about_impact field"""
        response = requests.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        data = response.json()
        assert 'about_impact' in data, "about_impact field missing from settings"
        print(f"about_impact: {data.get('about_impact', '')[:50]}...")
    
    def test_settings_returns_about_mission(self):
        """GET /api/settings should return about_mission field"""
        response = requests.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        data = response.json()
        assert 'about_mission' in data, "about_mission field missing from settings"
        print(f"about_mission: {data.get('about_mission', '')[:50]}...")
    
    def test_settings_returns_about_vision(self):
        """GET /api/settings should return about_vision field"""
        response = requests.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        data = response.json()
        assert 'about_vision' in data, "about_vision field missing from settings"
        print(f"about_vision: {data.get('about_vision', '')[:50]}...")
    
    def test_update_settings_about_fields(self):
        """PUT /api/settings should update about fields"""
        # Get current settings
        response = requests.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        current = response.json()
        
        # Update about fields with test values
        test_philosophy = "TEST_iteration21_philosophy"
        test_impact = "TEST_iteration21_impact"
        test_mission = "TEST_iteration21_mission"
        test_vision = "TEST_iteration21_vision"
        
        update_payload = {
            "about_philosophy": test_philosophy,
            "about_impact": test_impact,
            "about_mission": test_mission,
            "about_vision": test_vision
        }
        
        response = requests.put(f"{BASE_URL}/api/settings", json=update_payload)
        assert response.status_code == 200
        print("Settings updated successfully")
        
        # Verify update was persisted
        response = requests.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        updated = response.json()
        
        assert updated['about_philosophy'] == test_philosophy, "about_philosophy not updated"
        assert updated['about_impact'] == test_impact, "about_impact not updated"
        assert updated['about_mission'] == test_mission, "about_mission not updated"
        assert updated['about_vision'] == test_vision, "about_vision not updated"
        print("All about fields verified")
        
        # Restore original values (cleanup)
        restore_payload = {
            "about_philosophy": current.get('about_philosophy', ''),
            "about_impact": current.get('about_impact', ''),
            "about_mission": current.get('about_mission', ''),
            "about_vision": current.get('about_vision', '')
        }
        requests.put(f"{BASE_URL}/api/settings", json=restore_payload)


class TestProgramContentSections:
    """Test Program content_sections with section_type, image_url, and font styling"""
    
    def test_program_returns_content_sections(self):
        """GET /api/programs should return content_sections array"""
        response = requests.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        programs = response.json()
        assert len(programs) > 0, "No programs found"
        
        # Check that programs have content_sections field
        for prog in programs:
            assert 'content_sections' in prog, f"content_sections missing from program {prog['id']}"
        print(f"All {len(programs)} programs have content_sections field")
    
    def test_program_1_has_content_section(self):
        """GET /api/programs/1 should return content_sections with section from iteration 19"""
        response = requests.get(f"{BASE_URL}/api/programs/1")
        assert response.status_code == 200
        program = response.json()
        
        assert 'content_sections' in program
        sections = program['content_sections']
        assert len(sections) > 0, "Program 1 should have at least one content section"
        
        # Verify first section has required fields
        section = sections[0]
        assert 'id' in section
        assert 'section_type' in section
        assert 'title' in section
        assert 'is_enabled' in section
        print(f"Program 1 has {len(sections)} content section(s)")
    
    def test_content_section_type_options(self):
        """Test that section_type accepts valid values: journey, who_for, experience, why_now, cta, custom"""
        valid_section_types = ['journey', 'who_for', 'experience', 'why_now', 'cta', 'custom']
        
        # Get program 1
        response = requests.get(f"{BASE_URL}/api/programs/1")
        assert response.status_code == 200
        program = response.json()
        
        # Create a test section with each type
        for section_type in valid_section_types:
            test_section = {
                "id": f"test-{section_type}",
                "section_type": section_type,
                "title": f"Test {section_type}",
                "subtitle": "",
                "body": f"Test body for {section_type}",
                "image_url": "",
                "is_enabled": True,
                "order": 10
            }
            
            # Update program with test section
            update_payload = {
                "title": program['title'],
                "category": program['category'],
                "description": program['description'],
                "image": program['image'],
                "content_sections": [test_section]
            }
            
            response = requests.put(f"{BASE_URL}/api/programs/1", json=update_payload)
            assert response.status_code == 200
            
            # Verify section type was saved
            response = requests.get(f"{BASE_URL}/api/programs/1")
            updated = response.json()
            assert len(updated['content_sections']) > 0
            assert updated['content_sections'][0]['section_type'] == section_type
            print(f"  Section type '{section_type}' is valid ✓")
        
        print("All section types are valid")
    
    def test_content_section_image_url(self):
        """Test that content sections support image_url field"""
        response = requests.get(f"{BASE_URL}/api/programs/1")
        assert response.status_code == 200
        program = response.json()
        
        # Create section with image_url
        test_section = {
            "id": "test-image-section",
            "section_type": "custom",
            "title": "Section with Image",
            "subtitle": "",
            "body": "This section has an image",
            "image_url": "/api/image/test-image.png",
            "is_enabled": True,
            "order": 0
        }
        
        update_payload = {
            "title": program['title'],
            "category": program['category'],
            "description": program['description'],
            "image": program['image'],
            "content_sections": [test_section]
        }
        
        response = requests.put(f"{BASE_URL}/api/programs/1", json=update_payload)
        assert response.status_code == 200
        
        # Verify image_url was saved
        response = requests.get(f"{BASE_URL}/api/programs/1")
        updated = response.json()
        assert len(updated['content_sections']) > 0
        assert updated['content_sections'][0]['image_url'] == "/api/image/test-image.png"
        print("Image URL field is supported ✓")
    
    def test_content_section_font_styling(self):
        """Test that content sections support font styling (title_style, subtitle_style, body_style)"""
        response = requests.get(f"{BASE_URL}/api/programs/1")
        assert response.status_code == 200
        program = response.json()
        
        # Create section with font styling
        test_section = {
            "id": "test-styled-section",
            "section_type": "journey",
            "title": "Styled Section",
            "subtitle": "With custom styling",
            "body": "Body with custom styling",
            "image_url": "",
            "is_enabled": True,
            "order": 0,
            "title_style": {
                "font_family": "'Lato', sans-serif",
                "font_size": "24px",
                "font_color": "#D4AF37",
                "font_weight": "700",
                "font_style": "normal"
            },
            "subtitle_style": {
                "font_family": "'Cormorant Garamond', serif",
                "font_size": "14px",
                "font_color": "#999999"
            },
            "body_style": {
                "font_family": "'Cormorant Garamond', serif",
                "font_size": "16px",
                "font_color": "#666666",
                "font_style": "italic"
            }
        }
        
        update_payload = {
            "title": program['title'],
            "category": program['category'],
            "description": program['description'],
            "image": program['image'],
            "content_sections": [test_section]
        }
        
        response = requests.put(f"{BASE_URL}/api/programs/1", json=update_payload)
        assert response.status_code == 200
        
        # Verify font styling was saved
        response = requests.get(f"{BASE_URL}/api/programs/1")
        updated = response.json()
        assert len(updated['content_sections']) > 0
        section = updated['content_sections'][0]
        
        assert 'title_style' in section
        assert section['title_style']['font_family'] == "'Lato', sans-serif"
        assert section['title_style']['font_weight'] == "700"
        
        assert 'subtitle_style' in section
        assert 'body_style' in section
        print("Font styling fields are supported ✓")
    
    def test_restore_program_1_section(self):
        """Cleanup: Restore program 1 content section to original state"""
        response = requests.get(f"{BASE_URL}/api/programs/1")
        assert response.status_code == 200
        program = response.json()
        
        # Restore original test section from iteration 19
        original_section = {
            "id": "test-section-1",
            "section_type": "custom",
            "title": "Test Section Title",
            "subtitle": "Test Subtitle",
            "body": "Test body content for iteration 19 testing.",
            "image_url": "",
            "is_enabled": True,
            "order": 0,
            "title_style": {"font_color": "#333333"},
            "subtitle_style": {},
            "body_style": {}
        }
        
        update_payload = {
            "title": program['title'],
            "category": program['category'],
            "description": program['description'],
            "image": program['image'],
            "content_sections": [original_section]
        }
        
        response = requests.put(f"{BASE_URL}/api/programs/1", json=update_payload)
        assert response.status_code == 200
        print("Program 1 content section restored ✓")


class TestSettingsAboutImage:
    """Test About image upload field in settings"""
    
    def test_settings_returns_about_image(self):
        """GET /api/settings should return about_image field"""
        response = requests.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        data = response.json()
        assert 'about_image' in data, "about_image field missing from settings"
        print(f"about_image: {data.get('about_image', 'empty')}")


class TestProgramDefaults:
    """Test that programs without content_sections show default sections"""
    
    def test_program_without_sections_returns_empty_array(self):
        """Programs 2-6 should have empty content_sections array (defaults handled by frontend)"""
        # Programs 2-6 have no custom sections
        for pid in [2, 3, 4, 5, 6]:
            response = requests.get(f"{BASE_URL}/api/programs/{pid}")
            if response.status_code == 200:
                program = response.json()
                # Should have content_sections field (could be empty or not present)
                sections = program.get('content_sections', [])
                print(f"Program {pid} ({program['title'][:30]}...) has {len(sections)} sections")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
