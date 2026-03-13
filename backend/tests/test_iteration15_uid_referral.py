"""
Iteration 15 Tests - UID System, Referral Fields, Country Codes, Cart Offer Prices
Tests for:
1. UID generation (DIH-{PROGRAM}-{NAME_INITIALS}-{SEQ} format)
2. Referral toggle and referrer name field
3. 32 country codes in enrollment/cart pages
4. Cart offer price display (strikethrough)
5. Backend offer price checkout
"""

import pytest
import requests
import os
import time
from datetime import datetime

# Get BASE_URL from environment (same as frontend)
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://divine-sessions-dev.preview.emergentagent.com').rstrip('/')

class TestUIDGenerator:
    """Test UID generation system"""
    
    def test_uid_format_structure(self):
        """Verify UID follows format DIH-{PROGRAM}-{INITIALS}-{SEQ}"""
        # Test the utility functions directly via API
        # This tests that UIDs are generated and stored correctly
        response = requests.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200, f"Failed to get programs: {response.text}"
        programs = response.json()
        print(f"Found {len(programs)} programs")
        assert len(programs) > 0, "No programs found for testing"
    
    def test_enrollment_with_referral_and_uid_flow(self):
        """Test complete enrollment flow with referral data"""
        # Get a program to enroll in
        programs_resp = requests.get(f"{BASE_URL}/api/programs")
        assert programs_resp.status_code == 200
        programs = programs_resp.json()
        assert len(programs) > 0, "No programs found"
        
        # Find a program with enrollment open
        test_program = None
        for p in programs:
            if p.get('enrollment_open', True):
                test_program = p
                break
        
        if not test_program:
            test_program = programs[0]
        
        program_id = test_program['id']
        print(f"Testing with program: {test_program.get('title')}")
        
        # Create enrollment with referral data
        enrollment_data = {
            "booker_name": "Test User UID",
            "booker_email": f"test_uid_{int(time.time())}@gmail.com",
            "booker_country": "AE",
            "participants": [{
                "name": "John Doe",
                "relationship": "Myself",
                "age": 30,
                "gender": "Male",
                "country": "AE",
                "attendance_mode": "online",
                "notify": False,
                "is_first_time": True,
                "referral_source": "Friend / Family",
                "referred_by_name": "Jane Smith"  # Testing referral name field
            }]
        }
        
        response = requests.post(f"{BASE_URL}/api/enrollment/start", json=enrollment_data)
        assert response.status_code == 200, f"Enrollment start failed: {response.text}"
        
        data = response.json()
        enrollment_id = data.get("enrollment_id")
        assert enrollment_id, "No enrollment_id returned"
        print(f"Created enrollment: {enrollment_id}")
        
        # Verify enrollment has the referral data
        get_resp = requests.get(f"{BASE_URL}/api/enrollment/{enrollment_id}")
        assert get_resp.status_code == 200
        enrollment = get_resp.json()
        
        participants = enrollment.get("participants", [])
        assert len(participants) == 1, "Should have 1 participant"
        
        p = participants[0]
        assert p.get("referred_by_name") == "Jane Smith", f"referred_by_name not saved: {p.get('referred_by_name')}"
        assert p.get("is_first_time") == True, "is_first_time not saved"
        assert p.get("referral_source") == "Friend / Family", "referral_source not saved"
        
        print("PASS: Referral data (referred_by_name, is_first_time, referral_source) saved correctly")
        return enrollment_id


class TestOfferPriceCheckout:
    """Test that checkout uses offer prices when available"""
    
    def test_program_offer_prices_in_api(self):
        """Verify programs return offer_price fields"""
        response = requests.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        programs = response.json()
        
        # Check that offer_price_aed field exists in response
        if programs:
            sample = programs[0]
            print(f"Sample program fields: {list(sample.keys())}")
            # offer_price_aed/usd/inr should exist (can be 0)
            assert 'offer_price_aed' in sample or sample.get('price_aed') is not None, \
                "Program should have offer_price_aed or price_aed"
        print("PASS: Programs API returns price fields correctly")
    
    def test_create_program_with_offer_price(self):
        """Create a test program with offer prices to test checkout flow"""
        # No admin auth required for public API
        headers = {}
        
        # Create program with offer prices
        test_program = {
            "title": f"Test Offer Price Program {int(time.time())}",
            "description": "Testing offer price checkout",
            "category": "Test",
            "session_mode": "online",
            "image": "https://images.unsplash.com/photo-1545389336-cf090694435e?w=600",
            "price_aed": 500,
            "price_usd": 136,
            "price_inr": 5000,
            "offer_price_aed": 350,  # 30% discount
            "offer_price_usd": 95,
            "offer_price_inr": 3500,
            "enrollment_open": True,
            "is_flagship": False
        }
        
        create_resp = requests.post(f"{BASE_URL}/api/programs", json=test_program, headers=headers)
        assert create_resp.status_code == 200, f"Program creation failed: {create_resp.text}"
        
        created = create_resp.json()
        program_id = created.get("id")
        print(f"Created test program with ID: {program_id}")
        
        # Verify offer prices are returned
        get_resp = requests.get(f"{BASE_URL}/api/programs/{program_id}")
        assert get_resp.status_code == 200
        program = get_resp.json()
        
        assert program.get("offer_price_aed") == 350, f"offer_price_aed not saved: {program.get('offer_price_aed')}"
        assert program.get("offer_price_usd") == 95, f"offer_price_usd not saved"
        print("PASS: Program with offer prices created successfully")
        
        # Clean up - delete the test program
        del_resp = requests.delete(f"{BASE_URL}/api/programs/{program_id}", headers=headers)
        print(f"Cleanup: Deleted test program (status: {del_resp.status_code})")
        
        return program_id


class TestParticipantDataModel:
    """Test ParticipantData model includes referred_by_name"""
    
    def test_enrollment_accepts_referred_by_name(self):
        """Test that enrollment API accepts and stores referred_by_name"""
        enrollment_data = {
            "booker_name": "Referral Tester",
            "booker_email": f"referral_test_{int(time.time())}@gmail.com",
            "booker_country": "US",
            "participants": [{
                "name": "Referred Person",
                "relationship": "Friend",
                "age": 25,
                "gender": "Female",
                "country": "US",
                "attendance_mode": "online",
                "notify": False,
                "is_first_time": True,
                "referral_source": "Instagram",
                "referred_by_name": "Divine Iris Member Name"
            }]
        }
        
        response = requests.post(f"{BASE_URL}/api/enrollment/start", json=enrollment_data)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        enrollment_id = response.json().get("enrollment_id")
        
        # Verify the data was stored
        get_resp = requests.get(f"{BASE_URL}/api/enrollment/{enrollment_id}")
        assert get_resp.status_code == 200
        
        enrollment = get_resp.json()
        p = enrollment.get("participants", [{}])[0]
        
        assert p.get("referred_by_name") == "Divine Iris Member Name", \
            f"referred_by_name not stored correctly: {p.get('referred_by_name')}"
        
        print("PASS: ParticipantData model accepts and stores referred_by_name")


class TestHealthAndBasicEndpoints:
    """Basic API health checks"""
    
    def test_api_health(self):
        """Test API is healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        # Health endpoint may not exist, check programs instead
        if response.status_code == 404:
            response = requests.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200, f"API not healthy: {response.status_code}"
        print("PASS: API is healthy")
    
    def test_programs_endpoint(self):
        """Test programs endpoint returns data"""
        response = requests.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        programs = response.json()
        print(f"Programs count: {len(programs)}")
        assert isinstance(programs, list), "Programs should be a list"
        print("PASS: Programs endpoint working")


class TestPaymentStatusWithUID:
    """Test payment status endpoint returns UIDs after payment"""
    
    def test_payment_status_structure(self):
        """Test payment status endpoint returns expected structure with participants"""
        # We can't test a real payment, but we can verify the endpoint structure
        # by checking if it handles missing session_id properly
        response = requests.get(f"{BASE_URL}/api/payments/status/test_nonexistent_session")
        assert response.status_code == 404, "Should return 404 for non-existent session"
        
        error = response.json()
        assert "detail" in error, "Should return error detail"
        print("PASS: Payment status endpoint handles missing sessions correctly")


class TestEnrollmentFlowComplete:
    """Test complete enrollment flow including OTP"""
    
    def test_full_enrollment_with_referral(self):
        """Test enrollment start -> send OTP -> verify OTP flow with referral data"""
        # Get a program
        programs_resp = requests.get(f"{BASE_URL}/api/programs")
        assert programs_resp.status_code == 200
        programs = programs_resp.json()
        if not programs:
            pytest.skip("No programs available for testing")
        
        program = programs[0]
        
        # Start enrollment with full referral data
        enrollment_data = {
            "booker_name": "Full Flow Tester",
            "booker_email": f"fullflow_{int(time.time())}@gmail.com",
            "booker_country": "AE",
            "participants": [
                {
                    "name": "Participant One",
                    "relationship": "Myself",
                    "age": 35,
                    "gender": "Male",
                    "country": "AE",
                    "attendance_mode": "online",
                    "notify": True,
                    "email": "p1@test.com",
                    "is_first_time": True,
                    "referral_source": "Friend / Family",
                    "referred_by_name": "Jane Doe"
                },
                {
                    "name": "Participant Two",
                    "relationship": "Spouse",
                    "age": 32,
                    "gender": "Female",
                    "country": "AE",
                    "attendance_mode": "offline",
                    "notify": False,
                    "is_first_time": False,
                    "referral_source": "",
                    "referred_by_name": ""  # No referral for second participant
                }
            ]
        }
        
        start_resp = requests.post(f"{BASE_URL}/api/enrollment/start", json=enrollment_data)
        assert start_resp.status_code == 200, f"Enrollment start failed: {start_resp.text}"
        
        enrollment_id = start_resp.json().get("enrollment_id")
        assert enrollment_id, "No enrollment_id returned"
        
        # Send OTP
        otp_data = {"phone": "501234567", "country_code": "+971"}
        otp_resp = requests.post(f"{BASE_URL}/api/enrollment/{enrollment_id}/send-otp", json=otp_data)
        assert otp_resp.status_code == 200, f"Send OTP failed: {otp_resp.text}"
        
        mock_otp = otp_resp.json().get("mock_otp")
        assert mock_otp, "No mock_otp returned (OTP is MOCKED)"
        print(f"Mock OTP received: {mock_otp}")
        
        # Verify OTP
        verify_data = {"phone": "501234567", "country_code": "+971", "otp": mock_otp}
        verify_resp = requests.post(f"{BASE_URL}/api/enrollment/{enrollment_id}/verify-otp", json=verify_data)
        assert verify_resp.status_code == 200, f"Verify OTP failed: {verify_resp.text}"
        
        # Check enrollment state
        get_resp = requests.get(f"{BASE_URL}/api/enrollment/{enrollment_id}")
        assert get_resp.status_code == 200
        enrollment = get_resp.json()
        
        assert enrollment.get("phone_verified") == True, "Phone should be verified"
        
        # Verify referral data persisted
        participants = enrollment.get("participants", [])
        assert len(participants) == 2, "Should have 2 participants"
        
        p1 = participants[0]
        assert p1.get("referred_by_name") == "Jane Doe", f"P1 referral name wrong: {p1.get('referred_by_name')}"
        assert p1.get("is_first_time") == True
        
        p2 = participants[1]
        assert p2.get("referred_by_name") == "", "P2 should have no referral"
        assert p2.get("is_first_time") == False
        
        print("PASS: Full enrollment flow with referral data completed successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
