"""
Iteration 57 Tests: About Page Hero Section Controls and Pricing Hub Bug Fix

Tests:
1. GET /api/settings returns page_heroes.about structure
2. PUT /api/settings saves hero section visibility/alignment settings
3. GET /api/programs returns programs with pricing data
4. GET /api/sessions returns sessions with pricing data
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAboutHeroSettings:
    """Test About page hero section admin controls via settings API"""
    
    def test_get_settings_has_page_heroes_about(self):
        """Verify settings endpoint returns page_heroes.about structure"""
        response = requests.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        
        data = response.json()
        assert 'page_heroes' in data, "settings should have page_heroes key"
        assert 'about' in data['page_heroes'], "page_heroes should have about key"
        print(f"✓ page_heroes.about structure exists: {data['page_heroes']['about'].keys() if data['page_heroes']['about'] else 'empty'}")
    
    def test_update_about_hero_visibility_toggles(self):
        """Test saving hero visibility toggles via PUT /api/settings"""
        # First get current settings
        get_resp = requests.get(f"{BASE_URL}/api/settings")
        assert get_resp.status_code == 200
        settings = get_resp.json()
        
        # Update page_heroes.about with visibility toggles
        if 'page_heroes' not in settings:
            settings['page_heroes'] = {}
        if 'about' not in settings['page_heroes']:
            settings['page_heroes']['about'] = {}
        
        # Set test values for hero section
        test_hero_config = {
            'title_visible': True,
            'title_alignment': 'center',
            'title_text': 'Test Title',
            'subtitle_visible': True,
            'subtitle_alignment': 'center',
            'subtitle_text': 'Test Subtitle',
            'divider_visible': True,
            'divider_color': '#D4AF37',
            'divider_width': '56',
            'divider_thickness': '2',
            'logo_visible': False
        }
        
        settings['page_heroes']['about'].update(test_hero_config)
        
        # Save settings
        put_resp = requests.put(f"{BASE_URL}/api/settings", json=settings)
        assert put_resp.status_code == 200
        print("✓ PUT /api/settings successful")
        
        # Verify settings were saved by getting them again
        verify_resp = requests.get(f"{BASE_URL}/api/settings")
        assert verify_resp.status_code == 200
        saved = verify_resp.json()
        
        about_hero = saved.get('page_heroes', {}).get('about', {})
        assert about_hero.get('title_visible') == True, "title_visible should be True"
        assert about_hero.get('title_alignment') == 'center', "title_alignment should be center"
        assert about_hero.get('divider_visible') == True, "divider_visible should be True"
        assert about_hero.get('divider_color') == '#D4AF37', "divider_color should be gold"
        print("✓ About hero settings saved and verified correctly")
    
    def test_about_hero_alignment_options(self):
        """Test setting different alignment values for title and subtitle"""
        get_resp = requests.get(f"{BASE_URL}/api/settings")
        settings = get_resp.json()
        
        # Test left alignment
        settings['page_heroes']['about']['title_alignment'] = 'left'
        settings['page_heroes']['about']['subtitle_alignment'] = 'right'
        
        put_resp = requests.put(f"{BASE_URL}/api/settings", json=settings)
        assert put_resp.status_code == 200
        
        verify_resp = requests.get(f"{BASE_URL}/api/settings")
        about_hero = verify_resp.json().get('page_heroes', {}).get('about', {})
        assert about_hero.get('title_alignment') == 'left'
        assert about_hero.get('subtitle_alignment') == 'right'
        print("✓ Alignment settings (left/right) saved correctly")
        
        # Reset to center
        settings['page_heroes']['about']['title_alignment'] = 'center'
        settings['page_heroes']['about']['subtitle_alignment'] = 'center'
        requests.put(f"{BASE_URL}/api/settings", json=settings)


class TestPricingHubData:
    """Test programs and sessions APIs for Pricing Hub"""
    
    def test_get_programs(self):
        """Verify GET /api/programs returns program list with pricing"""
        response = requests.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        
        programs = response.json()
        assert isinstance(programs, list), "programs should be a list"
        print(f"✓ Found {len(programs)} programs")
        
        # Check first program has pricing fields
        if len(programs) > 0:
            p = programs[0]
            assert 'id' in p, "program should have id"
            assert 'title' in p, "program should have title"
            # Pricing fields
            pricing_fields = ['price_aed', 'price_inr', 'price_usd']
            for field in pricing_fields:
                assert field in p, f"program should have {field}"
            print(f"✓ Program '{p.get('title', 'N/A')[:30]}...' has all pricing fields")
    
    def test_get_sessions(self):
        """Verify GET /api/sessions returns session list with pricing"""
        response = requests.get(f"{BASE_URL}/api/sessions")
        assert response.status_code == 200
        
        sessions = response.json()
        assert isinstance(sessions, list), "sessions should be a list"
        print(f"✓ Found {len(sessions)} sessions")
        
        # Check first session has pricing fields
        if len(sessions) > 0:
            s = sessions[0]
            assert 'id' in s, "session should have id"
            # Pricing fields
            pricing_fields = ['price_aed', 'price_inr', 'price_usd']
            for field in pricing_fields:
                assert field in s, f"session should have {field}"
            print(f"✓ Session has all pricing fields")
    
    def test_programs_have_duration_tiers(self):
        """Verify programs can have duration_tiers array"""
        response = requests.get(f"{BASE_URL}/api/programs")
        programs = response.json()
        
        # Find a program with duration_tiers
        programs_with_tiers = [p for p in programs if p.get('duration_tiers') and len(p.get('duration_tiers', [])) > 0]
        
        if programs_with_tiers:
            p = programs_with_tiers[0]
            tiers = p.get('duration_tiers', [])
            print(f"✓ Found program '{p.get('title', 'N/A')[:25]}' with {len(tiers)} duration tiers")
            
            # Check tier structure
            if len(tiers) > 0:
                tier = tiers[0]
                assert 'label' in tier or 'duration_unit' in tier, "tier should have label or duration_unit"
                tier_pricing = ['price_aed', 'price_inr', 'price_usd']
                for field in tier_pricing:
                    assert field in tier, f"tier should have {field}"
                print(f"✓ Tier has correct structure with pricing fields")
        else:
            print("○ No programs with duration_tiers found (this is okay)")


class TestAboutPageDataValidation:
    """Validate About page data from settings"""
    
    def test_about_bio_fields_exist(self):
        """Verify about section fields exist in settings"""
        response = requests.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        
        data = response.json()
        about_fields = ['about_name', 'about_title', 'about_bio', 'about_image']
        
        for field in about_fields:
            assert field in data, f"settings should have {field}"
        
        print(f"✓ About name: {data.get('about_name', 'N/A')}")
        print(f"✓ About title: {data.get('about_title', 'N/A')}")
        print(f"✓ About image: {'Present' if data.get('about_image') else 'Not set'}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
