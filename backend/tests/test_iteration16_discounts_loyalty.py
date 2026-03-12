"""
Iteration 16: Discounts & Loyalty Settings Tests
Testing: Global discount/loyalty settings for flagship programs
- Referral toggle (show/hide referral field in enrollment forms)
- Group discount (auto-discount based on participant count)
- Combo discount (discount for multiple programs in cart)
- Loyalty program (returning clients with UID get auto-discount)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def api_session():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestDiscountSettings:
    """Test GET /api/discounts/settings endpoint"""

    def test_get_discount_settings_returns_all_fields(self, api_session):
        """GET /api/discounts/settings returns all discount settings"""
        response = api_session.get(f"{BASE_URL}/api/discounts/settings")
        assert response.status_code == 200
        
        data = response.json()
        # Verify all expected fields are present
        assert "enable_referral" in data
        assert "enable_group_discount" in data
        assert "group_discount_rules" in data
        assert "enable_combo_discount" in data
        assert "combo_discount_pct" in data
        assert "combo_min_programs" in data
        assert "enable_loyalty" in data
        assert "loyalty_discount_pct" in data
        
        # Verify data types
        assert isinstance(data["enable_referral"], bool)
        assert isinstance(data["enable_group_discount"], bool)
        assert isinstance(data["group_discount_rules"], list)
        assert isinstance(data["enable_combo_discount"], bool)
        assert isinstance(data["combo_min_programs"], int)
        assert isinstance(data["enable_loyalty"], bool)
        print(f"Discount settings: {data}")


class TestDiscountCalculation:
    """Test POST /api/discounts/calculate endpoint"""

    def test_calculate_group_discount(self, api_session):
        """Group discount applies when num_participants >= rule threshold"""
        # First ensure group discount is enabled with a rule
        api_session.put(f"{BASE_URL}/api/settings", json={
            "enable_group_discount": True,
            "group_discount_rules": [{"min_participants": 3, "discount_pct": 10}]
        })
        
        response = api_session.post(f"{BASE_URL}/api/discounts/calculate", json={
            "num_programs": 1,
            "num_participants": 4,  # >= 3 threshold
            "subtotal": 1000,
            "email": "test@test.com",
            "currency": "usd"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["group_discount"] == 100  # 10% of 1000
        print(f"Group discount result: {data}")

    def test_calculate_combo_discount(self, api_session):
        """Combo discount applies when num_programs >= combo_min_programs"""
        # Ensure combo discount is enabled
        api_session.put(f"{BASE_URL}/api/settings", json={
            "enable_combo_discount": True,
            "combo_discount_pct": 5,
            "combo_min_programs": 2
        })
        
        response = api_session.post(f"{BASE_URL}/api/discounts/calculate", json={
            "num_programs": 3,  # >= 2 threshold
            "num_participants": 1,
            "subtotal": 1000,
            "email": "test@test.com",
            "currency": "usd"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["combo_discount"] == 50  # 5% of 1000
        print(f"Combo discount result: {data}")

    def test_calculate_no_discount_when_disabled(self, api_session):
        """No discount applied when features are disabled"""
        # Disable all discount features
        api_session.put(f"{BASE_URL}/api/settings", json={
            "enable_group_discount": False,
            "enable_combo_discount": False,
            "enable_loyalty": False
        })
        
        response = api_session.post(f"{BASE_URL}/api/discounts/calculate", json={
            "num_programs": 5,
            "num_participants": 10,
            "subtotal": 10000,
            "email": "test@test.com",
            "currency": "usd"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["group_discount"] == 0
        assert data["combo_discount"] == 0
        assert data["loyalty_discount"] == 0
        assert data["total_discount"] == 0
        print(f"No discount when disabled: {data}")

    def test_calculate_combined_discounts(self, api_session):
        """Multiple discounts can stack (group + combo)"""
        # Enable both discounts
        api_session.put(f"{BASE_URL}/api/settings", json={
            "enable_group_discount": True,
            "group_discount_rules": [{"min_participants": 3, "discount_pct": 10}],
            "enable_combo_discount": True,
            "combo_discount_pct": 5,
            "combo_min_programs": 2
        })
        
        response = api_session.post(f"{BASE_URL}/api/discounts/calculate", json={
            "num_programs": 3,
            "num_participants": 4,
            "subtotal": 1000,
            "email": "test@test.com",
            "currency": "usd"
        })
        assert response.status_code == 200
        
        data = response.json()
        # Group: 10% of 1000 = 100, remaining = 900
        # Combo: 5% of 900 = 45
        assert data["group_discount"] == 100
        assert data["combo_discount"] == 45
        assert data["total_discount"] == data["group_discount"] + data["combo_discount"] + data["loyalty_discount"]
        print(f"Combined discounts: {data}")


class TestLoyaltyCheck:
    """Test GET /api/discounts/check-loyalty/{email} endpoint"""

    def test_check_loyalty_new_user(self, api_session):
        """New user (no previous enrollment) is not a returning client"""
        response = api_session.get(f"{BASE_URL}/api/discounts/check-loyalty/newuser12345@example.com")
        assert response.status_code == 200
        
        data = response.json()
        assert data["is_returning"] == False
        assert data["uid"] is None
        print(f"New user loyalty check: {data}")


class TestSettingsSave:
    """Test PUT /api/settings saves discount settings"""

    def test_save_referral_setting(self, api_session):
        """Referral toggle can be saved and persisted"""
        # Save enable_referral = False
        response = api_session.put(f"{BASE_URL}/api/settings", json={
            "enable_referral": False
        })
        assert response.status_code == 200
        
        saved = response.json()
        assert saved["enable_referral"] == False
        
        # Verify via GET
        verify = api_session.get(f"{BASE_URL}/api/discounts/settings")
        assert verify.json()["enable_referral"] == False
        
        # Restore to True
        api_session.put(f"{BASE_URL}/api/settings", json={"enable_referral": True})
        print("Referral toggle save: PASS")

    def test_save_group_discount_rules(self, api_session):
        """Group discount rules can be saved as array"""
        test_rules = [
            {"min_participants": 2, "discount_pct": 5},
            {"min_participants": 5, "discount_pct": 15},
            {"min_participants": 10, "discount_pct": 25}
        ]
        
        response = api_session.put(f"{BASE_URL}/api/settings", json={
            "enable_group_discount": True,
            "group_discount_rules": test_rules
        })
        assert response.status_code == 200
        
        saved = response.json()
        assert len(saved["group_discount_rules"]) == 3
        
        # Verify first rule
        assert saved["group_discount_rules"][0]["min_participants"] == 2
        assert saved["group_discount_rules"][0]["discount_pct"] == 5
        print(f"Group discount rules saved: {saved['group_discount_rules']}")

    def test_save_combo_discount(self, api_session):
        """Combo discount settings can be saved"""
        response = api_session.put(f"{BASE_URL}/api/settings", json={
            "enable_combo_discount": True,
            "combo_discount_pct": 7.5,
            "combo_min_programs": 3
        })
        assert response.status_code == 200
        
        saved = response.json()
        assert saved["enable_combo_discount"] == True
        assert saved["combo_discount_pct"] == 7.5
        assert saved["combo_min_programs"] == 3
        print(f"Combo discount saved: pct={saved['combo_discount_pct']}, min={saved['combo_min_programs']}")

    def test_save_loyalty_discount(self, api_session):
        """Loyalty discount percentage can be saved"""
        response = api_session.put(f"{BASE_URL}/api/settings", json={
            "enable_loyalty": True,
            "loyalty_discount_pct": 12
        })
        assert response.status_code == 200
        
        saved = response.json()
        assert saved["enable_loyalty"] == True
        assert saved["loyalty_discount_pct"] == 12
        print(f"Loyalty discount saved: {saved['loyalty_discount_pct']}%")


class TestGroupDiscountRuleLogic:
    """Test group discount rule selection logic"""

    def test_highest_applicable_rule_selected(self, api_session):
        """When multiple rules match, highest discount applies"""
        # Set multiple rules
        api_session.put(f"{BASE_URL}/api/settings", json={
            "enable_group_discount": True,
            "group_discount_rules": [
                {"min_participants": 2, "discount_pct": 5},
                {"min_participants": 5, "discount_pct": 10},
                {"min_participants": 10, "discount_pct": 20}
            ]
        })
        
        # Test with 7 participants - should match 5+ rule (10%)
        response = api_session.post(f"{BASE_URL}/api/discounts/calculate", json={
            "num_programs": 1,
            "num_participants": 7,
            "subtotal": 1000,
            "email": "",
            "currency": "usd"
        })
        assert response.status_code == 200
        
        data = response.json()
        # 10% of 1000 = 100
        assert data["group_discount"] == 100
        print(f"7 participants -> 10% discount: {data['group_discount']}")

    def test_no_group_discount_below_threshold(self, api_session):
        """No discount when below minimum participants"""
        api_session.put(f"{BASE_URL}/api/settings", json={
            "enable_group_discount": True,
            "group_discount_rules": [{"min_participants": 3, "discount_pct": 10}]
        })
        
        response = api_session.post(f"{BASE_URL}/api/discounts/calculate", json={
            "num_programs": 1,
            "num_participants": 2,  # Below 3 threshold
            "subtotal": 1000,
            "email": "",
            "currency": "usd"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["group_discount"] == 0
        print(f"2 participants (below threshold): no group discount")


class TestResetSettings:
    """Cleanup: Reset settings to known state"""

    def test_reset_to_default_settings(self, api_session):
        """Reset all discount settings to default test state"""
        response = api_session.put(f"{BASE_URL}/api/settings", json={
            "enable_referral": True,
            "enable_group_discount": True,
            "group_discount_rules": [{"min_participants": 3, "discount_pct": 10}],
            "enable_combo_discount": True,
            "combo_discount_pct": 5,
            "combo_min_programs": 2,
            "enable_loyalty": True,
            "loyalty_discount_pct": 8
        })
        assert response.status_code == 200
        print("Settings reset to default test state")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
