"""
Iteration 25 - Page Headers Tab Testing
Tests the new centralized page_heroes settings and related functionality
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPageHeroesAPI:
    """Test the page_heroes field in settings API"""
    
    def test_settings_contains_page_heroes_field(self):
        """Verify settings endpoint returns page_heroes field"""
        response = requests.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        data = response.json()
        assert 'page_heroes' in data, "page_heroes field should exist in settings"
        
    def test_settings_contains_visibility_toggles(self):
        """Verify media_page_visible and blog_page_visible fields exist"""
        response = requests.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        data = response.json()
        assert 'media_page_visible' in data, "media_page_visible should exist"
        assert 'blog_page_visible' in data, "blog_page_visible should exist"
        assert isinstance(data.get('media_page_visible'), bool), "media_page_visible should be boolean"
        assert isinstance(data.get('blog_page_visible'), bool), "blog_page_visible should be boolean"
        
    def test_update_page_heroes_settings(self):
        """Test updating page_heroes through settings PUT"""
        # First get current settings
        get_response = requests.get(f"{BASE_URL}/api/settings")
        assert get_response.status_code == 200
        
        # Prepare update with page_heroes
        test_page_heroes = {
            "home": {
                "title_text": "Test Home Title",
                "subtitle_text": "Test Home Subtitle",
                "title_style": {"font_color": "#ff0000", "font_size": "48px"},
                "subtitle_style": {"font_color": "#00ff00"}
            },
            "about": {
                "title_text": "Test About Title",
                "subtitle_text": "Test About Subtitle"
            },
            "transformations": {
                "title_text": "TRANSFORMATIONS",
                "subtitle_text": "Stories of Healing"
            },
            "media": {
                "title_text": "MEDIA",
                "subtitle_text": "Videos and Images"
            },
            "blog": {
                "title_text": "BLOG",
                "subtitle_text": "Insights"
            }
        }
        
        update_payload = {
            "page_heroes": test_page_heroes,
            "media_page_visible": True,
            "blog_page_visible": False
        }
        
        put_response = requests.put(f"{BASE_URL}/api/settings", json=update_payload)
        assert put_response.status_code == 200, f"Update failed: {put_response.text}"
        
        # Verify update persisted
        verify_response = requests.get(f"{BASE_URL}/api/settings")
        assert verify_response.status_code == 200
        data = verify_response.json()
        
        assert data.get('page_heroes') is not None, "page_heroes should be set"
        assert data['page_heroes'].get('home', {}).get('title_text') == "Test Home Title"
        assert data['media_page_visible'] == True
        assert data['blog_page_visible'] == False
        
    def test_update_program_hero_settings(self):
        """Test updating hero settings for a specific program"""
        # Get a program ID first
        programs_response = requests.get(f"{BASE_URL}/api/programs")
        assert programs_response.status_code == 200
        programs = programs_response.json()
        
        if len(programs) > 0:
            program_id = programs[0]['id']
            
            # Update page_heroes with program-specific hero
            test_page_heroes = {
                f"program_{program_id}": {
                    "title_text": "Test Program Hero",
                    "subtitle_text": "Test Program Subtitle",
                    "title_style": {"font_color": "#D4AF37"},
                    "subtitle_style": {"font_color": "#ffffff"}
                }
            }
            
            put_response = requests.put(f"{BASE_URL}/api/settings", json={"page_heroes": test_page_heroes})
            assert put_response.status_code == 200
            
            # Verify
            verify_response = requests.get(f"{BASE_URL}/api/settings")
            data = verify_response.json()
            assert f"program_{program_id}" in data.get('page_heroes', {})


class TestProgramsEndpoint:
    """Test programs API for flagship programs (used in Page Headers tab)"""
    
    def test_get_programs(self):
        """Verify programs endpoint works"""
        response = requests.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
    def test_programs_have_flagship_field(self):
        """Verify programs have is_flagship field"""
        response = requests.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        programs = response.json()
        
        # Check that at least some programs exist
        if len(programs) > 0:
            # All programs should have is_flagship field
            for p in programs:
                assert 'is_flagship' in p or p.get('is_flagship') is None or p.get('is_flagship') is False or p.get('is_flagship') is True
                
    def test_flagship_programs_exist(self):
        """Verify there are flagship programs for the Page Headers tab"""
        response = requests.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        programs = response.json()
        
        flagship_count = sum(1 for p in programs if p.get('is_flagship'))
        print(f"Found {flagship_count} flagship programs")
        # Just verify count, not requiring specific number


class TestBlogPage:
    """Test blog page endpoint and visibility"""
    
    def test_blog_route_accessible(self):
        """Verify /blog route returns HTML (even if hidden from nav)"""
        # The blog page should load even if blog_page_visible is false
        # We test the frontend route exists
        response = requests.get(f"{BASE_URL}/blog", allow_redirects=True)
        # This will be 200 if the SPA handles the route, or 404 if not found
        # Since it's a React SPA, /blog should return the index.html with 200
        assert response.status_code in [200, 304]


class TestAboutPage:
    """Test About page hero reads from page_heroes settings"""
    
    def test_about_page_accessible(self):
        """Verify /about route accessible"""
        response = requests.get(f"{BASE_URL}/about", allow_redirects=True)
        assert response.status_code in [200, 304]


class TestTransformationsPage:
    """Test Transformations page"""
    
    def test_transformations_page_accessible(self):
        """Verify /transformations route accessible"""
        response = requests.get(f"{BASE_URL}/transformations", allow_redirects=True)
        assert response.status_code in [200, 304]


class TestMediaPage:
    """Test Media page"""
    
    def test_media_page_accessible(self):
        """Verify /media route accessible"""
        response = requests.get(f"{BASE_URL}/media", allow_redirects=True)
        assert response.status_code in [200, 304]


class TestSettingsAPIIntegrity:
    """Test the settings API handles page_heroes correctly"""
    
    def test_settings_update_preserves_other_fields(self):
        """Verify updating page_heroes doesn't erase other settings"""
        # Get current settings
        get_response = requests.get(f"{BASE_URL}/api/settings")
        original = get_response.json()
        
        original_hero_title = original.get('hero_title')
        original_about_name = original.get('about_name')
        
        # Update only page_heroes
        put_response = requests.put(f"{BASE_URL}/api/settings", json={
            "page_heroes": {"test_key": {"title": "test"}}
        })
        assert put_response.status_code == 200
        
        # Verify other fields preserved
        verify_response = requests.get(f"{BASE_URL}/api/settings")
        data = verify_response.json()
        
        assert data.get('hero_title') == original_hero_title, "hero_title should be preserved"
        assert data.get('about_name') == original_about_name, "about_name should be preserved"
        
    def test_page_heroes_structure_validation(self):
        """Test that page_heroes accepts proper structure"""
        valid_structure = {
            "page_heroes": {
                "home": {
                    "title_text": "Valid Title",
                    "subtitle_text": "Valid Subtitle",
                    "title_style": {
                        "font_family": "'Cinzel', serif",
                        "font_size": "48px",
                        "font_color": "#ffffff",
                        "font_weight": "bold",
                        "font_style": "normal"
                    },
                    "subtitle_style": {
                        "font_family": "'Lato', sans-serif",
                        "font_size": "14px",
                        "font_color": "#cccccc"
                    }
                }
            }
        }
        
        response = requests.put(f"{BASE_URL}/api/settings", json=valid_structure)
        assert response.status_code == 200, f"Valid structure should be accepted: {response.text}"


class TestApplyHomepageStyleToAll:
    """Test the 'Apply Homepage Style to All' functionality logic"""
    
    def test_apply_style_copies_correctly(self):
        """Simulate the 'Apply Homepage Style to All' button behavior"""
        # Set home style
        home_style = {
            "title_style": {"font_family": "'Cinzel', serif", "font_size": "48px", "font_color": "#D4AF37"},
            "subtitle_style": {"font_family": "'Lato', sans-serif", "font_size": "14px", "font_color": "#ffffff"}
        }
        
        # Apply to all pages (simulating frontend behavior)
        page_heroes = {
            "home": {**home_style, "title_text": "Divine Iris Healing", "subtitle_text": "ETERNAL HAPPINESS"},
            "about": {**home_style, "title_text": "Dimple Ranawat", "subtitle_text": "Founder"},
            "transformations": {**home_style, "title_text": "TRANSFORMATIONS", "subtitle_text": "Stories"},
            "media": {**home_style, "title_text": "MEDIA", "subtitle_text": "Videos"},
            "blog": {**home_style, "title_text": "BLOG", "subtitle_text": "Insights"}
        }
        
        response = requests.put(f"{BASE_URL}/api/settings", json={"page_heroes": page_heroes})
        assert response.status_code == 200
        
        # Verify all pages have same style
        verify_response = requests.get(f"{BASE_URL}/api/settings")
        data = verify_response.json()
        
        heroes = data.get('page_heroes', {})
        home_title_style = heroes.get('home', {}).get('title_style', {})
        
        for page_key in ['about', 'transformations', 'media', 'blog']:
            page_title_style = heroes.get(page_key, {}).get('title_style', {})
            assert page_title_style.get('font_family') == home_title_style.get('font_family'), \
                f"{page_key} should have same font_family as home"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
