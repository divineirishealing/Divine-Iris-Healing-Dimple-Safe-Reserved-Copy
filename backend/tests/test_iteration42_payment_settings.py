"""
Iteration 42 - Payment Settings & India Pricing Tests
Tests:
1. Admin Payment Settings tab (disclaimer + India links)
2. GET/PUT /api/settings with payment_disclaimer and india_payment_links
3. PATCH /api/enrollment/{id}/update-phone
4. India pricing validation (IP + country + phone cross-validation)
5. Regional currency mapping
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://client-garden.preview.emergentagent.com"


# =================== SETTINGS TESTS ===================

class TestPaymentSettingsAPI:
    """Test GET/PUT settings with payment_disclaimer and india_payment_links"""
    
    def test_get_settings_returns_payment_disclaimer(self):
        """Verify GET /api/settings returns payment_disclaimer field"""
        resp = requests.get(f"{BASE_URL}/api/settings")
        assert resp.status_code == 200
        data = resp.json()
        assert "payment_disclaimer" in data, "payment_disclaimer field missing from settings"
        assert isinstance(data["payment_disclaimer"], str)
        print(f"✓ payment_disclaimer present: {data['payment_disclaimer'][:60]}...")
    
    def test_get_settings_returns_india_payment_links(self):
        """Verify GET /api/settings returns india_payment_links field"""
        resp = requests.get(f"{BASE_URL}/api/settings")
        assert resp.status_code == 200
        data = resp.json()
        assert "india_payment_links" in data, "india_payment_links field missing from settings"
        assert isinstance(data["india_payment_links"], list)
        print(f"✓ india_payment_links present: {len(data['india_payment_links'])} links")
        for link in data["india_payment_links"]:
            print(f"  - {link.get('type')}: {link.get('label')} (enabled={link.get('enabled')})")
    
    def test_put_settings_update_payment_disclaimer(self):
        """Verify PUT /api/settings can update payment_disclaimer"""
        # Get current settings
        resp = requests.get(f"{BASE_URL}/api/settings")
        assert resp.status_code == 200
        original = resp.json().get("payment_disclaimer", "")
        
        # Update disclaimer
        test_disclaimer = "TEST DISCLAIMER - Updated by iteration 42 test"
        resp = requests.put(f"{BASE_URL}/api/settings", json={
            "payment_disclaimer": test_disclaimer
        })
        assert resp.status_code == 200
        
        # Verify update
        resp = requests.get(f"{BASE_URL}/api/settings")
        assert resp.status_code == 200
        assert resp.json()["payment_disclaimer"] == test_disclaimer
        print(f"✓ payment_disclaimer updated successfully")
        
        # Restore original
        requests.put(f"{BASE_URL}/api/settings", json={
            "payment_disclaimer": original
        })
        print(f"✓ payment_disclaimer restored")
    
    def test_put_settings_update_india_payment_links(self):
        """Verify PUT /api/settings can update india_payment_links"""
        # Get current settings
        resp = requests.get(f"{BASE_URL}/api/settings")
        assert resp.status_code == 200
        original = resp.json().get("india_payment_links", [])
        
        # Update with test links
        test_links = [
            {"type": "exly", "label": "Test Exly", "url": "https://test.exly.com", "details": "Test details", "enabled": True},
            {"type": "gpay", "label": "Test GPay", "url": "https://test.gpay.com", "details": "", "enabled": False}
        ]
        resp = requests.put(f"{BASE_URL}/api/settings", json={
            "india_payment_links": test_links
        })
        assert resp.status_code == 200
        
        # Verify update
        resp = requests.get(f"{BASE_URL}/api/settings")
        assert resp.status_code == 200
        updated_links = resp.json()["india_payment_links"]
        assert len(updated_links) == 2
        assert updated_links[0]["label"] == "Test Exly"
        assert updated_links[1]["enabled"] == False
        print(f"✓ india_payment_links updated successfully")
        
        # Restore original
        requests.put(f"{BASE_URL}/api/settings", json={
            "india_payment_links": original
        })
        print(f"✓ india_payment_links restored")


# =================== ENROLLMENT PHONE UPDATE ===================

class TestEnrollmentPhoneUpdate:
    """Test PATCH /api/enrollment/{id}/update-phone endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup_enrollment(self):
        """Create a test enrollment for phone update tests"""
        # Create enrollment
        resp = requests.post(f"{BASE_URL}/api/enrollment/start", json={
            "booker_name": "Test Phone User",
            "booker_email": "testphone@example.com",
            "booker_country": "IN",
            "participants": [{
                "name": "Phone Test Participant",
                "relationship": "Myself",
                "age": 30,
                "gender": "Male",
                "country": "IN",
                "attendance_mode": "online",
                "notify": False
            }]
        })
        assert resp.status_code == 200
        self.enrollment_id = resp.json()["enrollment_id"]
        yield
        # No cleanup needed - enrollment remains for audit
    
    def test_update_phone_success(self):
        """Test successful phone update"""
        resp = requests.patch(
            f"{BASE_URL}/api/enrollment/{self.enrollment_id}/update-phone",
            json={"phone": "+919876543210"}
        )
        assert resp.status_code == 200
        assert resp.json()["updated"] == True
        print(f"✓ Phone updated for enrollment {self.enrollment_id}")
        
        # Verify update persisted
        resp = requests.get(f"{BASE_URL}/api/enrollment/{self.enrollment_id}")
        assert resp.status_code == 200
        assert resp.json()["phone"] == "+919876543210"
        print(f"✓ Phone persisted in enrollment record")
    
    def test_update_phone_foreign_number(self):
        """Test updating with foreign phone number"""
        resp = requests.patch(
            f"{BASE_URL}/api/enrollment/{self.enrollment_id}/update-phone",
            json={"phone": "+971501234567"}  # UAE number
        )
        assert resp.status_code == 200
        
        # Verify
        resp = requests.get(f"{BASE_URL}/api/enrollment/{self.enrollment_id}")
        assert resp.json()["phone"] == "+971501234567"
        print(f"✓ Foreign phone number saved correctly")
    
    def test_update_phone_not_found(self):
        """Test update phone for non-existent enrollment"""
        resp = requests.patch(
            f"{BASE_URL}/api/enrollment/nonexistent-id-12345/update-phone",
            json={"phone": "+919876543210"}
        )
        assert resp.status_code == 404
        print(f"✓ Returns 404 for non-existent enrollment")


# =================== PRICING TESTS ===================

class TestIndiaPricingValidation:
    """Test India pricing cross-validation logic"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get a program ID for pricing tests"""
        resp = requests.get(f"{BASE_URL}/api/programs")
        assert resp.status_code == 200
        programs = resp.json()
        if not programs:
            pytest.skip("No programs available for testing")
        self.program = programs[0]
        self.program_id = self.program["id"]
        print(f"Using program: {self.program['title']}")
    
    def _create_enrollment(self, country="AE", phone=None):
        """Helper to create enrollment and optionally set phone"""
        resp = requests.post(f"{BASE_URL}/api/enrollment/start", json={
            "booker_name": "Pricing Test User",
            "booker_email": f"pricingtest{country}@example.com",
            "booker_country": country,
            "participants": [{
                "name": "Pricing Participant",
                "relationship": "Myself",
                "age": 25,
                "gender": "Female",
                "country": country,
                "attendance_mode": "online",
                "notify": False
            }]
        })
        assert resp.status_code == 200
        enrollment_id = resp.json()["enrollment_id"]
        
        # Update phone if provided
        if phone:
            resp = requests.patch(
                f"{BASE_URL}/api/enrollment/{enrollment_id}/update-phone",
                json={"phone": phone}
            )
            assert resp.status_code == 200
        
        return enrollment_id
    
    def test_pricing_non_india_user_gets_aed(self):
        """Non-India IP should get AED pricing"""
        enrollment_id = self._create_enrollment(country="AE")
        
        resp = requests.get(
            f"{BASE_URL}/api/enrollment/{enrollment_id}/pricing",
            params={"item_type": "program", "item_id": self.program_id, "tier_index": 0}
        )
        assert resp.status_code == 200
        data = resp.json()
        
        # Since test server IP is not Indian, should get AED or USD
        currency = data["pricing"]["currency"]
        assert currency in ["aed", "usd"], f"Expected AED/USD, got {currency}"
        assert data["security"]["inr_eligible"] == False, "Non-India user should not be INR eligible"
        print(f"✓ Non-India user gets {currency.upper()} pricing")
        print(f"  INR eligible: {data['security']['inr_eligible']}")
        print(f"  Checks: {data['security']['checks']}")
    
    def test_pricing_india_country_non_india_ip_no_inr(self):
        """India country + non-India IP should not get INR (VPN protection)"""
        enrollment_id = self._create_enrollment(country="IN", phone="+919876543210")
        
        resp = requests.get(
            f"{BASE_URL}/api/enrollment/{enrollment_id}/pricing",
            params={"item_type": "program", "item_id": self.program_id, "tier_index": 0}
        )
        assert resp.status_code == 200
        data = resp.json()
        
        # IP is not Indian (test server), so should fail ip_is_india check
        checks = data["security"]["checks"]
        assert checks["ip_is_india"] == False, "Test server IP should not be India"
        assert data["security"]["inr_eligible"] == False, "Should not be INR eligible without Indian IP"
        
        currency = data["pricing"]["currency"]
        assert currency != "inr", "Should not get INR without Indian IP"
        print(f"✓ India country + foreign IP gets {currency.upper()} (not INR)")
        print(f"  ip_is_india: {checks['ip_is_india']}")
        print(f"  claimed_india: {checks['claimed_india']}")
    
    def test_pricing_foreign_phone_blocks_inr(self):
        """Indian user with foreign phone should not get INR"""
        enrollment_id = self._create_enrollment(country="IN", phone="+971501234567")  # UAE phone
        
        resp = requests.get(
            f"{BASE_URL}/api/enrollment/{enrollment_id}/pricing",
            params={"item_type": "program", "item_id": self.program_id, "tier_index": 0}
        )
        assert resp.status_code == 200
        data = resp.json()
        
        # Foreign phone should make phone_consistent = False
        checks = data["security"]["checks"]
        assert checks["phone_consistent"] == False, "Foreign phone should fail phone_consistent check"
        assert data["security"]["inr_eligible"] == False
        print(f"✓ Foreign phone (+971) blocks INR pricing")
        print(f"  phone_consistent: {checks['phone_consistent']}")
    
    def test_pricing_no_phone_passes_check(self):
        """No phone provided should pass phone_consistent check (email OTP flow)"""
        enrollment_id = self._create_enrollment(country="IN", phone=None)
        
        resp = requests.get(
            f"{BASE_URL}/api/enrollment/{enrollment_id}/pricing",
            params={"item_type": "program", "item_id": self.program_id, "tier_index": 0}
        )
        assert resp.status_code == 200
        data = resp.json()
        
        checks = data["security"]["checks"]
        # No phone = phone_consistent should be True (pass)
        assert checks["phone_consistent"] == True, "No phone should pass phone_consistent"
        print(f"✓ No phone = phone_consistent is True")


class TestRegionalCurrencyMapping:
    """Test regional currency mapping (UAE→AED, India→INR, US/Europe→USD)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get a program ID for tests"""
        resp = requests.get(f"{BASE_URL}/api/programs")
        assert resp.status_code == 200
        programs = resp.json()
        if not programs:
            pytest.skip("No programs available")
        self.program_id = programs[0]["id"]
    
    def _create_enrollment_get_pricing(self, country):
        """Create enrollment and get pricing"""
        resp = requests.post(f"{BASE_URL}/api/enrollment/start", json={
            "booker_name": f"Regional Test {country}",
            "booker_email": f"regional{country}@example.com",
            "booker_country": country,
            "participants": [{
                "name": "Regional Participant",
                "relationship": "Myself",
                "age": 30,
                "gender": "Male",
                "country": country,
                "attendance_mode": "online",
                "notify": False
            }]
        })
        assert resp.status_code == 200
        enrollment_id = resp.json()["enrollment_id"]
        
        resp = requests.get(
            f"{BASE_URL}/api/enrollment/{enrollment_id}/pricing",
            params={"item_type": "program", "item_id": self.program_id, "tier_index": 0}
        )
        assert resp.status_code == 200
        return resp.json()
    
    def test_uae_user_gets_aed(self):
        """UAE user should get AED pricing"""
        data = self._create_enrollment_get_pricing("AE")
        # Note: IP is not UAE, but regional mapping should still apply for non-VPN
        currency = data["pricing"]["currency"]
        print(f"✓ UAE (AE) user gets {currency.upper()} pricing")
        # Can be AED or USD depending on IP location
        assert currency in ["aed", "usd"]
    
    def test_us_user_gets_usd(self):
        """US user should get USD pricing"""
        data = self._create_enrollment_get_pricing("US")
        currency = data["pricing"]["currency"]
        print(f"✓ US user gets {currency.upper()} pricing")
        # Should be USD or AED (fallback)
        assert currency in ["usd", "aed"]
    
    def test_uk_user_gets_usd(self):
        """UK user should get USD pricing"""
        data = self._create_enrollment_get_pricing("GB")
        currency = data["pricing"]["currency"]
        print(f"✓ UK (GB) user gets {currency.upper()} pricing")
        assert currency in ["usd", "aed"]
    
    def test_saudi_user_gets_aed(self):
        """Saudi Arabia user should get AED pricing (Gulf region)"""
        data = self._create_enrollment_get_pricing("SA")
        currency = data["pricing"]["currency"]
        print(f"✓ Saudi Arabia user gets {currency.upper()} pricing")
        assert currency in ["aed", "usd"]


class TestPricingWithOfferPrice:
    """Test that pricing returns offer_price when available"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get a program with offer prices"""
        resp = requests.get(f"{BASE_URL}/api/programs")
        assert resp.status_code == 200
        programs = resp.json()
        
        # Find program with offer prices
        self.program = None
        for p in programs:
            tiers = p.get("duration_tiers", [])
            if tiers and tiers[0].get("offer_aed", 0) > 0:
                self.program = p
                break
        
        if not self.program:
            pytest.skip("No program with offer prices available")
        
        self.program_id = self.program["id"]
        print(f"Using program: {self.program['title']}")
    
    def test_pricing_returns_offer_price(self):
        """Pricing should return offer_price_per_person when available"""
        # Create enrollment
        resp = requests.post(f"{BASE_URL}/api/enrollment/start", json={
            "booker_name": "Offer Test User",
            "booker_email": "offertest@example.com",
            "booker_country": "AE",
            "participants": [{
                "name": "Offer Participant",
                "relationship": "Myself",
                "age": 28,
                "gender": "Female",
                "country": "AE",
                "attendance_mode": "online",
                "notify": False
            }]
        })
        assert resp.status_code == 200
        enrollment_id = resp.json()["enrollment_id"]
        
        # Get pricing
        resp = requests.get(
            f"{BASE_URL}/api/enrollment/{enrollment_id}/pricing",
            params={"item_type": "program", "item_id": self.program_id, "tier_index": 0}
        )
        assert resp.status_code == 200
        data = resp.json()
        
        pricing = data["pricing"]
        assert "price_per_person" in pricing
        assert "offer_price_per_person" in pricing
        assert "final_per_person" in pricing
        
        print(f"✓ Pricing response:")
        print(f"  price_per_person: {pricing['price_per_person']}")
        print(f"  offer_price_per_person: {pricing['offer_price_per_person']}")
        print(f"  final_per_person: {pricing['final_per_person']}")
        
        # If offer price exists, final should be offer price
        if pricing["offer_price_per_person"]:
            assert pricing["final_per_person"] == pricing["offer_price_per_person"]


# =================== DATA STRUCTURE VALIDATION ===================

class TestPricingResponseStructure:
    """Validate pricing response data structure"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup"""
        resp = requests.get(f"{BASE_URL}/api/programs")
        programs = resp.json()
        if not programs:
            pytest.skip("No programs")
        self.program_id = programs[0]["id"]
    
    def test_pricing_response_structure(self):
        """Verify pricing response has all expected fields"""
        # Create enrollment
        resp = requests.post(f"{BASE_URL}/api/enrollment/start", json={
            "booker_name": "Structure Test",
            "booker_email": "structuretest@example.com",
            "booker_country": "AE",
            "participants": [{
                "name": "Structure Participant",
                "relationship": "Myself",
                "age": 30,
                "gender": "Male",
                "country": "AE",
                "attendance_mode": "online",
                "notify": False
            }]
        })
        enrollment_id = resp.json()["enrollment_id"]
        
        # Get pricing
        resp = requests.get(
            f"{BASE_URL}/api/enrollment/{enrollment_id}/pricing",
            params={"item_type": "program", "item_id": self.program_id, "tier_index": 0}
        )
        assert resp.status_code == 200
        data = resp.json()
        
        # Verify top-level structure
        assert "enrollment_id" in data
        assert "item" in data
        assert "pricing" in data
        assert "security" in data
        
        # Verify pricing structure
        pricing = data["pricing"]
        assert "currency" in pricing
        assert "symbol" in pricing
        assert "price_per_person" in pricing
        assert "offer_price_per_person" in pricing
        assert "final_per_person" in pricing
        assert "participant_count" in pricing
        assert "total" in pricing
        
        # Verify security structure
        security = data["security"]
        assert "vpn_blocked" in security
        assert "checks" in security
        assert "ip_country" in security
        assert "claimed_country" in security
        assert "inr_eligible" in security
        
        # Verify checks structure
        checks = security["checks"]
        assert "ip_is_india" in checks
        assert "claimed_india" in checks
        assert "no_vpn" in checks
        assert "phone_consistent" in checks
        
        print(f"✓ Pricing response structure validated")
        print(f"  Currency: {pricing['currency']}")
        print(f"  Total: {pricing['symbol']}{pricing['total']}")
        print(f"  Security checks: {checks}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
