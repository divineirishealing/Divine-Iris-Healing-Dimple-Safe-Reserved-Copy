"""
Iteration 19 Tests: Testing new features:
- Program detail page with content_sections
- Footer gold icons, program links, terms/privacy links
- Admin HeaderFooterTab sub-tabs (Social Media, Terms & Privacy, Sender Emails)
- Admin Programs tab Content Sections editor
- Admin Stats tab icon and font styling
- Backend API returns new fields (social_spotify, show_spotify, terms_content, privacy_content, sender_emails, content_sections)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSettingsAPI:
    """Test GET /api/settings returns new fields"""

    def test_settings_returns_social_spotify(self):
        response = requests.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        data = response.json()
        # Check new social fields exist
        assert "social_spotify" in data, "Missing social_spotify field"
        assert "show_spotify" in data, "Missing show_spotify field"
        print(f"PASS: social_spotify={data.get('social_spotify')}, show_spotify={data.get('show_spotify')}")

    def test_settings_returns_new_social_platforms(self):
        response = requests.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        data = response.json()
        # Check all new social platform fields
        new_social_fields = [
            'social_spotify', 'show_spotify',
            'social_pinterest', 'show_pinterest', 
            'social_tiktok', 'show_tiktok',
            'social_twitter', 'show_twitter',
            'social_apple_music', 'show_apple_music',
            'social_soundcloud', 'show_soundcloud'
        ]
        for field in new_social_fields:
            assert field in data, f"Missing field: {field}"
        print(f"PASS: All new social platform fields present")

    def test_settings_returns_terms_content(self):
        response = requests.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        data = response.json()
        assert "terms_content" in data, "Missing terms_content field"
        print(f"PASS: terms_content field present, value length={len(data.get('terms_content', ''))}")

    def test_settings_returns_privacy_content(self):
        response = requests.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        data = response.json()
        assert "privacy_content" in data, "Missing privacy_content field"
        print(f"PASS: privacy_content field present, value length={len(data.get('privacy_content', ''))}")

    def test_settings_returns_sender_emails(self):
        response = requests.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        data = response.json()
        assert "sender_emails" in data, "Missing sender_emails field"
        assert isinstance(data.get("sender_emails"), list), "sender_emails should be a list"
        print(f"PASS: sender_emails field present as list, count={len(data.get('sender_emails', []))}")


class TestProgramsAPI:
    """Test GET /api/programs returns content_sections field"""

    def test_programs_list_returns_content_sections(self):
        response = requests.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Programs should return list"
        assert len(data) > 0, "Should have at least one program"
        # Check first program has content_sections
        first_program = data[0]
        assert "content_sections" in first_program, "Program missing content_sections field"
        assert isinstance(first_program.get("content_sections"), list), "content_sections should be a list"
        print(f"PASS: Programs list returns content_sections. First program sections count: {len(first_program.get('content_sections', []))}")

    def test_single_program_returns_content_sections(self):
        # First get programs list to get an ID
        response = requests.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        programs = response.json()
        assert len(programs) > 0, "Need at least one program"
        
        program_id = programs[0].get("id")
        # Now get single program
        response = requests.get(f"{BASE_URL}/api/programs/{program_id}")
        assert response.status_code == 200
        program = response.json()
        assert "content_sections" in program, "Single program missing content_sections"
        print(f"PASS: Program {program_id} has content_sections field")


class TestStatsAPI:
    """Test GET /api/stats returns icon and style fields"""

    def test_stats_returns_icon_field(self):
        response = requests.get(f"{BASE_URL}/api/stats")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Stats should return list"
        if len(data) > 0:
            first_stat = data[0]
            assert "icon" in first_stat, "Stat missing icon field"
            print(f"PASS: Stats have icon field. First stat icon: {first_stat.get('icon', 'empty')}")
        else:
            print("PASS: Stats endpoint works (no stats in DB yet)")

    def test_stats_returns_style_fields(self):
        response = requests.get(f"{BASE_URL}/api/stats")
        assert response.status_code == 200
        data = response.json()
        if len(data) > 0:
            first_stat = data[0]
            assert "value_style" in first_stat, "Stat missing value_style field"
            assert "label_style" in first_stat, "Stat missing label_style field"
            print(f"PASS: Stats have style fields")
        else:
            print("PASS: Stats endpoint works (no stats in DB yet)")


class TestProgramDetailPageAPI:
    """Test program detail page loads correctly"""

    def test_program_detail_returns_200(self):
        # Get a program ID first
        response = requests.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        programs = response.json()
        assert len(programs) > 0
        
        program_id = programs[0].get("id")
        response = requests.get(f"{BASE_URL}/api/programs/{program_id}")
        assert response.status_code == 200
        program = response.json()
        assert "title" in program
        assert "content_sections" in program
        print(f"PASS: Program detail for ID {program_id} returns correctly")

    def test_program_not_found_returns_404(self):
        response = requests.get(f"{BASE_URL}/api/programs/nonexistent-id-12345")
        assert response.status_code == 404
        print("PASS: Non-existent program returns 404")


class TestSettingsUpdate:
    """Test PUT /api/settings can update new fields"""

    def test_update_terms_content(self):
        # Get current settings
        response = requests.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        
        # Update terms_content
        test_terms = "Test Terms & Conditions content for iteration 19"
        update_response = requests.put(f"{BASE_URL}/api/settings", json={
            "terms_content": test_terms
        })
        assert update_response.status_code == 200
        
        # Verify it was saved
        verify_response = requests.get(f"{BASE_URL}/api/settings")
        assert verify_response.status_code == 200
        data = verify_response.json()
        assert data.get("terms_content") == test_terms, "terms_content not saved correctly"
        print("PASS: Can update terms_content via PUT /api/settings")

    def test_update_privacy_content(self):
        test_privacy = "Test Privacy Policy content for iteration 19"
        update_response = requests.put(f"{BASE_URL}/api/settings", json={
            "privacy_content": test_privacy
        })
        assert update_response.status_code == 200
        
        verify_response = requests.get(f"{BASE_URL}/api/settings")
        assert verify_response.status_code == 200
        data = verify_response.json()
        assert data.get("privacy_content") == test_privacy
        print("PASS: Can update privacy_content via PUT /api/settings")

    def test_update_social_spotify_toggle(self):
        # Enable Spotify
        update_response = requests.put(f"{BASE_URL}/api/settings", json={
            "social_spotify": "https://spotify.com/test",
            "show_spotify": True
        })
        assert update_response.status_code == 200
        
        verify_response = requests.get(f"{BASE_URL}/api/settings")
        data = verify_response.json()
        assert data.get("social_spotify") == "https://spotify.com/test"
        assert data.get("show_spotify") == True
        print("PASS: Can update Spotify social link and toggle")

    def test_update_sender_emails(self):
        test_emails = [
            {"purpose": "receipt", "email": "receipts@test.com", "label": "Payment Receipts"},
            {"purpose": "newsletter", "email": "news@test.com", "label": "Newsletter"}
        ]
        update_response = requests.put(f"{BASE_URL}/api/settings", json={
            "sender_emails": test_emails
        })
        assert update_response.status_code == 200
        
        verify_response = requests.get(f"{BASE_URL}/api/settings")
        data = verify_response.json()
        assert len(data.get("sender_emails", [])) == 2
        print("PASS: Can update sender_emails configuration")


class TestProgramContentSectionsUpdate:
    """Test program content_sections can be updated"""

    def test_update_program_content_sections(self):
        # Get a program to update
        response = requests.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        programs = response.json()
        assert len(programs) > 0
        
        program = programs[0]
        program_id = program.get("id")
        
        # Create test content sections
        test_sections = [
            {
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
        ]
        
        # Update program with content sections
        update_payload = {
            "title": program.get("title"),
            "category": program.get("category", ""),
            "description": program.get("description", ""),
            "image": program.get("image", ""),
            "content_sections": test_sections
        }
        
        update_response = requests.put(f"{BASE_URL}/api/programs/{program_id}", json=update_payload)
        assert update_response.status_code == 200
        
        # Verify
        verify_response = requests.get(f"{BASE_URL}/api/programs/{program_id}")
        assert verify_response.status_code == 200
        updated_program = verify_response.json()
        assert len(updated_program.get("content_sections", [])) == 1
        assert updated_program["content_sections"][0]["title"] == "Test Section Title"
        print(f"PASS: Can update program content_sections for program {program_id}")


class TestStatsUpdate:
    """Test stats icon and style can be updated"""

    def test_create_stat_with_icon_and_styles(self):
        test_stat = {
            "value": "TEST+",
            "label": "Test Stat",
            "order": 99,
            "icon": "fa-star",
            "value_style": {"font_color": "#d4af37", "font_size": "28px"},
            "label_style": {"font_color": "#ffffff"}
        }
        
        create_response = requests.post(f"{BASE_URL}/api/stats", json=test_stat)
        assert create_response.status_code == 200
        created = create_response.json()
        
        assert created.get("icon") == "fa-star"
        assert created.get("value_style", {}).get("font_color") == "#d4af37"
        
        # Cleanup - delete the test stat
        stat_id = created.get("id")
        requests.delete(f"{BASE_URL}/api/stats/{stat_id}")
        
        print("PASS: Can create stat with icon and style fields")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
