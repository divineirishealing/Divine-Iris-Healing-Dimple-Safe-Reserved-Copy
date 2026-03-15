"""
Backend API Tests for Divine Iris Healing - NEW FEATURES
Tests: Visibility toggle, Reorder, Site Settings, Testimonial Search/Filter
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://divine-checkout-flow.preview.emergentagent.com')


# =============================================
# PROGRAMS - Visibility & Reorder Tests
# =============================================
class TestProgramsVisibility:
    """Test program visibility toggle feature"""
    
    def test_get_all_programs_includes_visible_field(self):
        """Verify programs have visible field"""
        response = requests.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        data = response.json()
        assert len(data) > 0, "No programs in database"
        
        for program in data:
            assert "visible" in program, f"Program {program['id']} missing visible field"
            assert "order" in program, f"Program {program['id']} missing order field"
        print(f"✓ All {len(data)} programs have visible and order fields")
    
    def test_toggle_program_visibility_patch(self):
        """Test PATCH /api/programs/{id}/visibility endpoint"""
        # Get first program
        response = requests.get(f"{BASE_URL}/api/programs")
        programs = response.json()
        assert len(programs) > 0
        
        program_id = programs[0]["id"]
        original_visible = programs[0]["visible"]
        
        # Toggle visibility
        patch_response = requests.patch(
            f"{BASE_URL}/api/programs/{program_id}/visibility",
            json={"visible": not original_visible}
        )
        assert patch_response.status_code == 200
        result = patch_response.json()
        assert "visible" in result
        assert result["visible"] == (not original_visible)
        print(f"✓ PATCH /api/programs/{program_id}/visibility toggled from {original_visible} to {not original_visible}")
        
        # Restore original state
        restore_response = requests.patch(
            f"{BASE_URL}/api/programs/{program_id}/visibility",
            json={"visible": original_visible}
        )
        assert restore_response.status_code == 200
        print(f"  Restored visibility to {original_visible}")
    
    def test_get_programs_visible_only_filter(self):
        """Test ?visible_only=true query parameter"""
        # Get all programs
        all_response = requests.get(f"{BASE_URL}/api/programs")
        all_programs = all_response.json()
        
        # Get visible only
        visible_response = requests.get(f"{BASE_URL}/api/programs?visible_only=true")
        assert visible_response.status_code == 200
        visible_programs = visible_response.json()
        
        # All returned programs should have visible=true
        for program in visible_programs:
            assert program["visible"] == True, f"Program {program['id']} should be visible"
        
        print(f"✓ GET /api/programs?visible_only=true returns {len(visible_programs)} visible programs (total: {len(all_programs)})")


class TestProgramsReorder:
    """Test program reorder feature"""
    
    def test_programs_are_sorted_by_order(self):
        """Verify programs are returned sorted by order field"""
        response = requests.get(f"{BASE_URL}/api/programs")
        programs = response.json()
        
        for i in range(len(programs) - 1):
            assert programs[i]["order"] <= programs[i + 1]["order"], \
                f"Programs not sorted: {programs[i]['order']} > {programs[i+1]['order']}"
        print(f"✓ Programs are correctly sorted by order field")
    
    def test_reorder_programs_patch(self):
        """Test PATCH /api/programs/reorder endpoint"""
        response = requests.get(f"{BASE_URL}/api/programs")
        programs = response.json()
        
        if len(programs) < 2:
            pytest.skip("Need at least 2 programs to test reorder")
        
        # Get original order
        original_ids = [p["id"] for p in programs]
        
        # Swap first two
        new_order = [original_ids[1], original_ids[0]] + original_ids[2:]
        
        reorder_response = requests.patch(
            f"{BASE_URL}/api/programs/reorder",
            json={"order": new_order}
        )
        assert reorder_response.status_code == 200
        print(f"✓ PATCH /api/programs/reorder accepted new order")
        
        # Verify order changed
        verify_response = requests.get(f"{BASE_URL}/api/programs")
        reordered = verify_response.json()
        assert reordered[0]["id"] == original_ids[1]
        assert reordered[1]["id"] == original_ids[0]
        print(f"  Programs reordered: {original_ids[0][:8]} and {original_ids[1][:8]} swapped")
        
        # Restore original order
        restore_response = requests.patch(
            f"{BASE_URL}/api/programs/reorder",
            json={"order": original_ids}
        )
        assert restore_response.status_code == 200
        print(f"  Restored original order")


# =============================================
# SESSIONS - Visibility & Reorder Tests (21 sessions)
# =============================================
class TestSessionsVisibility:
    """Test session visibility toggle feature"""
    
    def test_get_all_sessions_count_and_fields(self):
        """Verify all 21 sessions are present with required fields"""
        response = requests.get(f"{BASE_URL}/api/sessions")
        assert response.status_code == 200
        sessions = response.json()
        
        assert len(sessions) == 21, f"Expected 21 sessions, got {len(sessions)}"
        
        for session in sessions:
            assert "visible" in session, f"Session {session['id']} missing visible field"
            assert "order" in session, f"Session {session['id']} missing order field"
            assert "title" in session
        print(f"✓ All 21 sessions have visible and order fields")
    
    def test_toggle_session_visibility_patch(self):
        """Test PATCH /api/sessions/{id}/visibility endpoint"""
        response = requests.get(f"{BASE_URL}/api/sessions")
        sessions = response.json()
        
        session_id = sessions[0]["id"]
        original_visible = sessions[0]["visible"]
        
        # Toggle visibility
        patch_response = requests.patch(
            f"{BASE_URL}/api/sessions/{session_id}/visibility",
            json={"visible": not original_visible}
        )
        assert patch_response.status_code == 200
        result = patch_response.json()
        assert "visible" in result
        print(f"✓ PATCH /api/sessions/{session_id}/visibility works")
        
        # Restore original state
        restore_response = requests.patch(
            f"{BASE_URL}/api/sessions/{session_id}/visibility",
            json={"visible": original_visible}
        )
        assert restore_response.status_code == 200
    
    def test_get_sessions_visible_only_filter(self):
        """Test ?visible_only=true query parameter for sessions"""
        visible_response = requests.get(f"{BASE_URL}/api/sessions?visible_only=true")
        assert visible_response.status_code == 200
        visible_sessions = visible_response.json()
        
        for session in visible_sessions:
            assert session["visible"] == True
        print(f"✓ GET /api/sessions?visible_only=true returns {len(visible_sessions)} sessions")


class TestSessionsReorder:
    """Test session reorder feature"""
    
    def test_reorder_sessions_patch(self):
        """Test PATCH /api/sessions/reorder endpoint"""
        response = requests.get(f"{BASE_URL}/api/sessions")
        sessions = response.json()
        
        original_ids = [s["id"] for s in sessions]
        
        # Swap first two
        new_order = [original_ids[1], original_ids[0]] + original_ids[2:]
        
        reorder_response = requests.patch(
            f"{BASE_URL}/api/sessions/reorder",
            json={"order": new_order}
        )
        assert reorder_response.status_code == 200
        print(f"✓ PATCH /api/sessions/reorder accepted new order")
        
        # Restore original order
        restore_response = requests.patch(
            f"{BASE_URL}/api/sessions/reorder",
            json={"order": original_ids}
        )
        assert restore_response.status_code == 200
        print(f"  Restored original order")


# =============================================
# TESTIMONIALS - Type Filter & Search (44 total: 32 graphic + 12 video)
# =============================================
class TestTestimonialsCount:
    """Verify testimonial counts"""
    
    def test_testimonials_total_count(self):
        """Verify 44 testimonials exist"""
        response = requests.get(f"{BASE_URL}/api/testimonials")
        assert response.status_code == 200
        testimonials = response.json()
        
        assert len(testimonials) == 44, f"Expected 44 testimonials, got {len(testimonials)}"
        print(f"✓ Total testimonials: {len(testimonials)}")
    
    def test_testimonials_type_distribution(self):
        """Verify 32 graphic and 12 video testimonials"""
        response = requests.get(f"{BASE_URL}/api/testimonials")
        testimonials = response.json()
        
        graphic_count = sum(1 for t in testimonials if t.get("type") == "graphic")
        video_count = sum(1 for t in testimonials if t.get("type") == "video")
        
        assert graphic_count == 32, f"Expected 32 graphic, got {graphic_count}"
        assert video_count == 12, f"Expected 12 video, got {video_count}"
        print(f"✓ Testimonials: {graphic_count} graphic, {video_count} video")


class TestTestimonialsTypeFilter:
    """Test testimonial type filtering"""
    
    def test_filter_graphic_testimonials(self):
        """Test GET /api/testimonials?type=graphic"""
        response = requests.get(f"{BASE_URL}/api/testimonials?type=graphic")
        assert response.status_code == 200
        testimonials = response.json()
        
        assert len(testimonials) == 32, f"Expected 32 graphic testimonials, got {len(testimonials)}"
        
        for t in testimonials:
            assert t["type"] == "graphic", f"Testimonial {t['id']} is not graphic type"
            assert t.get("image"), f"Graphic testimonial {t['id']} should have image"
        print(f"✓ GET /api/testimonials?type=graphic returns {len(testimonials)} graphic testimonials")
    
    def test_filter_video_testimonials(self):
        """Test GET /api/testimonials?type=video"""
        response = requests.get(f"{BASE_URL}/api/testimonials?type=video")
        assert response.status_code == 200
        testimonials = response.json()
        
        assert len(testimonials) == 12, f"Expected 12 video testimonials, got {len(testimonials)}"
        
        for t in testimonials:
            assert t["type"] == "video", f"Testimonial {t['id']} is not video type"
            assert t.get("videoId"), f"Video testimonial {t['id']} should have videoId"
        print(f"✓ GET /api/testimonials?type=video returns {len(testimonials)} video testimonials")


class TestTestimonialsSearch:
    """Test testimonial search functionality"""
    
    def test_search_testimonials_by_text(self):
        """Test GET /api/testimonials?search=healing"""
        response = requests.get(f"{BASE_URL}/api/testimonials?search=healing")
        assert response.status_code == 200
        testimonials = response.json()
        
        assert len(testimonials) > 0, "Search for 'healing' should return results"
        
        for t in testimonials:
            text = (t.get("text", "") + t.get("name", "")).lower()
            assert "healing" in text, f"Testimonial {t['id']} doesn't contain 'healing'"
        print(f"✓ GET /api/testimonials?search=healing returns {len(testimonials)} results")
    
    def test_search_testimonials_case_insensitive(self):
        """Test search is case-insensitive"""
        lower_response = requests.get(f"{BASE_URL}/api/testimonials?search=transformation")
        upper_response = requests.get(f"{BASE_URL}/api/testimonials?search=TRANSFORMATION")
        
        assert lower_response.status_code == 200
        assert upper_response.status_code == 200
        
        lower_results = lower_response.json()
        upper_results = upper_response.json()
        
        # Should return same results regardless of case
        assert len(lower_results) == len(upper_results), "Search should be case-insensitive"
        print(f"✓ Search is case-insensitive: {len(lower_results)} results")
    
    def test_search_with_no_results(self):
        """Test search returns empty array for non-matching query"""
        response = requests.get(f"{BASE_URL}/api/testimonials?search=xyznonsensequery123")
        assert response.status_code == 200
        testimonials = response.json()
        
        assert len(testimonials) == 0, "Non-matching search should return empty array"
        print(f"✓ Non-matching search returns empty array")
    
    def test_search_combined_with_type_filter(self):
        """Test search combined with type filter"""
        response = requests.get(f"{BASE_URL}/api/testimonials?search=transformation&type=graphic")
        assert response.status_code == 200
        testimonials = response.json()
        
        for t in testimonials:
            assert t["type"] == "graphic"
        print(f"✓ Combined search+type filter returns {len(testimonials)} results")


class TestTestimonialsVisibility:
    """Test testimonial visibility toggle"""
    
    def test_toggle_testimonial_visibility(self):
        """Test PATCH /api/testimonials/{id}/visibility"""
        response = requests.get(f"{BASE_URL}/api/testimonials")
        testimonials = response.json()
        
        t_id = testimonials[0]["id"]
        original_visible = testimonials[0]["visible"]
        
        patch_response = requests.patch(
            f"{BASE_URL}/api/testimonials/{t_id}/visibility",
            json={"visible": not original_visible}
        )
        assert patch_response.status_code == 200
        print(f"✓ PATCH /api/testimonials/{t_id}/visibility works")
        
        # Restore
        restore_response = requests.patch(
            f"{BASE_URL}/api/testimonials/{t_id}/visibility",
            json={"visible": original_visible}
        )
        assert restore_response.status_code == 200


# =============================================
# SITE SETTINGS - Font, Color, Size Settings
# =============================================
class TestSiteSettingsGet:
    """Test GET /api/settings endpoint"""
    
    def test_get_site_settings(self):
        """Test GET /api/settings returns all required fields"""
        response = requests.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        settings = response.json()
        
        # Check all required fields
        required_fields = [
            "id", "heading_font", "body_font", 
            "heading_color", "body_color", "accent_color",
            "heading_size", "body_size"
        ]
        
        for field in required_fields:
            assert field in settings, f"Missing field: {field}"
        
        assert settings["id"] == "site_settings"
        print(f"✓ GET /api/settings returns all required fields")
        print(f"  heading_font: {settings['heading_font']}")
        print(f"  body_font: {settings['body_font']}")
        print(f"  accent_color: {settings['accent_color']}")
    
    def test_settings_have_valid_font_values(self):
        """Verify font settings have valid values"""
        response = requests.get(f"{BASE_URL}/api/settings")
        settings = response.json()
        
        valid_fonts = [
            'Playfair Display', 'Lato', 'Cinzel', 'Caveat', 'Montserrat',
            'Poppins', 'Raleway', 'Cormorant Garamond', 'Italiana', 'Josefin Sans',
            'Great Vibes', 'Dancing Script', 'Merriweather', 'Libre Baskerville',
            'Roboto Slab', 'Open Sans', 'Source Sans Pro', 'Nunito'
        ]
        
        assert settings["heading_font"] in valid_fonts, f"Invalid heading font: {settings['heading_font']}"
        assert settings["body_font"] in valid_fonts, f"Invalid body font: {settings['body_font']}"
        print(f"✓ Font settings have valid values")
    
    def test_settings_have_valid_size_values(self):
        """Verify size settings have valid values"""
        response = requests.get(f"{BASE_URL}/api/settings")
        settings = response.json()
        
        valid_sizes = ['small', 'default', 'large', 'extra-large']
        
        assert settings["heading_size"] in valid_sizes, f"Invalid heading size: {settings['heading_size']}"
        assert settings["body_size"] in valid_sizes, f"Invalid body size: {settings['body_size']}"
        print(f"✓ Size settings have valid values")


class TestSiteSettingsUpdate:
    """Test PUT /api/settings endpoint"""
    
    def test_update_site_settings(self):
        """Test PUT /api/settings updates settings"""
        # Get original settings
        original_response = requests.get(f"{BASE_URL}/api/settings")
        original = original_response.json()
        
        # Update with new values
        new_settings = {
            "heading_font": "Cinzel",
            "body_font": "Montserrat",
            "heading_color": "#2a2a2a",
            "body_color": "#5a5a5a",
            "accent_color": "#B8860B",
            "heading_size": "large",
            "body_size": "default"
        }
        
        update_response = requests.put(f"{BASE_URL}/api/settings", json=new_settings)
        assert update_response.status_code == 200
        updated = update_response.json()
        
        # Verify update
        assert updated["heading_font"] == "Cinzel"
        assert updated["body_font"] == "Montserrat"
        assert updated["accent_color"] == "#B8860B"
        print(f"✓ PUT /api/settings updates settings correctly")
        
        # Restore original settings
        restore_response = requests.put(f"{BASE_URL}/api/settings", json={
            "heading_font": original["heading_font"],
            "body_font": original["body_font"],
            "heading_color": original["heading_color"],
            "body_color": original["body_color"],
            "accent_color": original["accent_color"],
            "heading_size": original["heading_size"],
            "body_size": original["body_size"]
        })
        assert restore_response.status_code == 200
        print(f"  Restored original settings")
    
    def test_partial_update_settings(self):
        """Test partial update only changes specified fields"""
        # Get original
        original_response = requests.get(f"{BASE_URL}/api/settings")
        original = original_response.json()
        
        # Partial update
        partial_update = {"heading_font": "Caveat"}
        update_response = requests.put(f"{BASE_URL}/api/settings", json=partial_update)
        assert update_response.status_code == 200
        updated = update_response.json()
        
        assert updated["heading_font"] == "Caveat"
        # Other fields should remain unchanged
        assert updated["body_font"] == original["body_font"]
        print(f"✓ Partial update only changes specified fields")
        
        # Restore
        restore_response = requests.put(f"{BASE_URL}/api/settings", json={"heading_font": original["heading_font"]})
        assert restore_response.status_code == 200


# =============================================
# CRUD Operations with Visibility/Order
# =============================================
class TestCRUDWithNewFields:
    """Test CRUD operations include new fields"""
    
    def test_create_program_with_visibility(self):
        """Test creating program with visible field"""
        payload = {
            "title": "TEST_Program_Visibility",
            "category": "Testing",
            "description": "Test program with visibility",
            "image": "https://example.com/test.jpg",
            "visible": False
        }
        
        response = requests.post(f"{BASE_URL}/api/programs", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data["visible"] == False, "Program should be created with visible=False"
        assert "order" in data, "Program should have order field"
        print(f"✓ Created program with visible=False")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/programs/{data['id']}")
    
    def test_create_testimonial_with_type_graphic(self):
        """Test creating graphic testimonial"""
        payload = {
            "type": "graphic",
            "name": "TEST_Graphic_Testimonial",
            "text": "This is a test graphic testimonial for search testing",
            "image": "https://example.com/test.jpg"
        }
        
        response = requests.post(f"{BASE_URL}/api/testimonials", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data["type"] == "graphic"
        assert data["name"] == "TEST_Graphic_Testimonial"
        assert data["text"] == payload["text"]
        print(f"✓ Created graphic testimonial")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/testimonials/{data['id']}")
    
    def test_create_testimonial_with_type_video(self):
        """Test creating video testimonial auto-generates thumbnail"""
        payload = {
            "type": "video",
            "name": "TEST_Video_Testimonial",
            "videoId": "dQw4w9WgXcQ"
        }
        
        response = requests.post(f"{BASE_URL}/api/testimonials", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data["type"] == "video"
        assert data["videoId"] == "dQw4w9WgXcQ"
        assert "youtube.com" in data["thumbnail"], "Should auto-generate YouTube thumbnail"
        print(f"✓ Created video testimonial with auto-generated thumbnail")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/testimonials/{data['id']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
