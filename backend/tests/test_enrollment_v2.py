"""
Enrollment API Tests - 3-Step enrollment with per-participant data
Tests: /api/enrollment/* endpoints (NEW 3-step flow: Participants → Verify → Pay)
- Booker: name, email, country
- Participants: name, relationship, age, gender, country, attendance_mode (online/offline), notify, email, phone
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API_URL = f"{BASE_URL}/api"

# Test program ID (Atomic Weight Release Program)
TEST_PROGRAM_ID = "1"
TEST_PROGRAM_TYPE = "program"


class TestEnrollmentStartV2:
    """Test POST /api/enrollment/start - Step 1: Booker + Participants with per-participant data"""
    
    def test_enrollment_start_single_participant_success(self):
        """Test creating enrollment with single participant"""
        payload = {
            "booker_name": "TEST_BookerV2",
            "booker_email": "testbooker@gmail.com",
            "booker_country": "AE",
            "participants": [{
                "name": "TEST_Participant_1",
                "relationship": "Myself",
                "age": 30,
                "gender": "Female",
                "country": "AE",
                "attendance_mode": "online",
                "notify": False,
                "email": None,
                "phone": None
            }]
        }
        response = requests.post(f"{API_URL}/enrollment/start", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "enrollment_id" in data
        assert data["step"] == 1
        assert data["participant_count"] == 1
        assert "ip_country" in data
        assert "vpn_detected" in data
        
        print(f"Created enrollment: {data['enrollment_id']}, Participants: {data['participant_count']}")
        return data["enrollment_id"]
    
    def test_enrollment_start_multiple_participants(self):
        """Test enrollment with multiple participants (group booking)"""
        payload = {
            "booker_name": "TEST_GroupBooker",
            "booker_email": "groupbooker@gmail.com",
            "booker_country": "AE",
            "participants": [
                {
                    "name": "TEST_Participant_A",
                    "relationship": "Myself",
                    "age": 35,
                    "gender": "Male",
                    "country": "AE",
                    "attendance_mode": "online",
                    "notify": True,
                    "email": "participanta@gmail.com",
                    "phone": "1234567890"
                },
                {
                    "name": "TEST_Participant_B",
                    "relationship": "Spouse",
                    "age": 32,
                    "gender": "Female",
                    "country": "IN",
                    "attendance_mode": "offline",
                    "notify": False,
                    "email": None,
                    "phone": None
                },
                {
                    "name": "TEST_Participant_C",
                    "relationship": "Mother",
                    "age": 60,
                    "gender": "Female",
                    "country": "AE",
                    "attendance_mode": "online",
                    "notify": True,
                    "email": "participantc@gmail.com",
                    "phone": "9876543210"
                }
            ]
        }
        response = requests.post(f"{API_URL}/enrollment/start", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["participant_count"] == 3
        
        print(f"Group enrollment created: {data['enrollment_id']}, Participants: {data['participant_count']}")
    
    def test_enrollment_start_with_different_attendance_modes(self):
        """Test participants can have different attendance modes"""
        payload = {
            "booker_name": "TEST_MixedModeBooker",
            "booker_email": "mixedmode@gmail.com",
            "booker_country": "AE",
            "participants": [
                {
                    "name": "TEST_OnlinePerson",
                    "relationship": "Myself",
                    "age": 28,
                    "gender": "Male",
                    "country": "AE",
                    "attendance_mode": "online",
                    "notify": False
                },
                {
                    "name": "TEST_OfflinePerson",
                    "relationship": "Friend",
                    "age": 30,
                    "gender": "Female",
                    "country": "AE",
                    "attendance_mode": "offline",
                    "notify": False
                }
            ]
        }
        response = requests.post(f"{API_URL}/enrollment/start", json=payload)
        
        assert response.status_code == 200
        
        # Verify by fetching enrollment
        enrollment_id = response.json()["enrollment_id"]
        get_resp = requests.get(f"{API_URL}/enrollment/{enrollment_id}")
        assert get_resp.status_code == 200
        
        enrollment = get_resp.json()
        assert len(enrollment["participants"]) == 2
        assert enrollment["participants"][0]["attendance_mode"] == "online"
        assert enrollment["participants"][1]["attendance_mode"] == "offline"
        
        print("Mixed attendance modes verified: online + offline")
    
    def test_enrollment_start_invalid_attendance_mode(self):
        """Test invalid attendance mode is rejected"""
        payload = {
            "booker_name": "TEST_InvalidMode",
            "booker_email": "invalid@gmail.com",
            "booker_country": "AE",
            "participants": [{
                "name": "TEST_Invalid",
                "relationship": "Myself",
                "age": 25,
                "gender": "Female",
                "country": "AE",
                "attendance_mode": "hybrid",  # Invalid mode
                "notify": False
            }]
        }
        response = requests.post(f"{API_URL}/enrollment/start", json=payload)
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        assert "attendance mode" in response.json()["detail"].lower()
    
    def test_enrollment_start_missing_participants(self):
        """Test enrollment fails without participants"""
        payload = {
            "booker_name": "TEST_NoParticipants",
            "booker_email": "noparticipants@gmail.com",
            "booker_country": "AE",
            "participants": []
        }
        response = requests.post(f"{API_URL}/enrollment/start", json=payload)
        
        assert response.status_code == 400
        assert "at least one participant" in response.json()["detail"].lower()
    
    def test_enrollment_start_invalid_booker_email_format(self):
        """Test invalid booker email format is rejected"""
        payload = {
            "booker_name": "TEST_InvalidEmail",
            "booker_email": "notanemail",
            "booker_country": "AE",
            "participants": [{
                "name": "TEST_Participant",
                "relationship": "Myself",
                "age": 25,
                "gender": "Female",
                "country": "AE",
                "attendance_mode": "online",
                "notify": False
            }]
        }
        response = requests.post(f"{API_URL}/enrollment/start", json=payload)
        
        assert response.status_code == 400
        assert "email" in response.json()["detail"].lower()
    
    def test_enrollment_start_disposable_email_rejected(self):
        """Test disposable emails are rejected"""
        payload = {
            "booker_name": "TEST_DisposableEmail",
            "booker_email": "test@tempmail.com",
            "booker_country": "AE",
            "participants": [{
                "name": "TEST_Participant",
                "relationship": "Myself",
                "age": 25,
                "gender": "Female",
                "country": "AE",
                "attendance_mode": "online",
                "notify": False
            }]
        }
        response = requests.post(f"{API_URL}/enrollment/start", json=payload)
        
        assert response.status_code == 400
        assert "disposable" in response.json()["detail"].lower()


class TestPhoneOTPV2:
    """Test Phone OTP flow (Step 2: Verify)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create enrollment for OTP tests"""
        payload = {
            "booker_name": "TEST_OTP_BookerV2",
            "booker_email": "otpbooker@gmail.com",
            "booker_country": "AE",
            "participants": [{
                "name": "TEST_OTP_Participant",
                "relationship": "Myself",
                "age": 25,
                "gender": "Male",
                "country": "AE",
                "attendance_mode": "online",
                "notify": False
            }]
        }
        response = requests.post(f"{API_URL}/enrollment/start", json=payload)
        assert response.status_code == 200
        self.enrollment_id = response.json()["enrollment_id"]
    
    def test_send_otp_success(self):
        """Test OTP send returns mock OTP for testing"""
        response = requests.post(
            f"{API_URL}/enrollment/{self.enrollment_id}/send-otp",
            json={"phone": "9876543210", "country_code": "+971"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["sent"] is True
        assert "mock_otp" in data  # Mock OTP returned for testing
        assert len(data["mock_otp"]) == 6
        assert data["mock_otp"].isdigit()
        
        print(f"OTP sent. Mock OTP: {data['mock_otp']}")
    
    def test_send_otp_invalid_phone(self):
        """Test invalid phone number is rejected"""
        response = requests.post(
            f"{API_URL}/enrollment/{self.enrollment_id}/send-otp",
            json={"phone": "123", "country_code": "+971"}  # Too short
        )
        assert response.status_code == 400
    
    def test_verify_otp_success(self):
        """Test correct OTP verifies successfully"""
        # Send OTP
        send_resp = requests.post(
            f"{API_URL}/enrollment/{self.enrollment_id}/send-otp",
            json={"phone": "9876543211", "country_code": "+971"}
        )
        assert send_resp.status_code == 200
        mock_otp = send_resp.json()["mock_otp"]
        
        # Verify OTP
        verify_resp = requests.post(
            f"{API_URL}/enrollment/{self.enrollment_id}/verify-otp",
            json={"phone": "9876543211", "country_code": "+971", "otp": mock_otp}
        )
        assert verify_resp.status_code == 200
        
        data = verify_resp.json()
        assert data["verified"] is True
        
        print("OTP verified successfully")
    
    def test_verify_otp_wrong_code(self):
        """Test wrong OTP is rejected"""
        # Send OTP
        send_resp = requests.post(
            f"{API_URL}/enrollment/{self.enrollment_id}/send-otp",
            json={"phone": "9876543212", "country_code": "+971"}
        )
        assert send_resp.status_code == 200
        
        # Verify with wrong OTP
        verify_resp = requests.post(
            f"{API_URL}/enrollment/{self.enrollment_id}/verify-otp",
            json={"phone": "9876543212", "country_code": "+971", "otp": "000000"}
        )
        assert verify_resp.status_code == 400
        assert "incorrect" in verify_resp.json()["detail"].lower()


class TestPricingV2:
    """Test Pricing endpoint (Step 3: Pay) with participant_count"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create and verify enrollment for pricing tests"""
        # Create enrollment with multiple participants
        payload = {
            "booker_name": "TEST_Pricing_BookerV2",
            "booker_email": "pricingbooker@gmail.com",
            "booker_country": "AE",
            "participants": [
                {
                    "name": "TEST_Pricing_P1",
                    "relationship": "Myself",
                    "age": 30,
                    "gender": "Female",
                    "country": "AE",
                    "attendance_mode": "online",
                    "notify": False
                },
                {
                    "name": "TEST_Pricing_P2",
                    "relationship": "Spouse",
                    "age": 35,
                    "gender": "Male",
                    "country": "AE",
                    "attendance_mode": "offline",
                    "notify": False
                }
            ]
        }
        response = requests.post(f"{API_URL}/enrollment/start", json=payload)
        assert response.status_code == 200
        self.enrollment_id = response.json()["enrollment_id"]
        self.participant_count = response.json()["participant_count"]
        
        # Verify phone to get to Step 3
        send_resp = requests.post(
            f"{API_URL}/enrollment/{self.enrollment_id}/send-otp",
            json={"phone": "9876543213", "country_code": "+971"}
        )
        mock_otp = send_resp.json()["mock_otp"]
        
        verify_resp = requests.post(
            f"{API_URL}/enrollment/{self.enrollment_id}/verify-otp",
            json={"phone": "9876543213", "country_code": "+971", "otp": mock_otp}
        )
        assert verify_resp.status_code == 200
    
    def test_pricing_returns_participant_count(self):
        """Test pricing response includes correct participant count"""
        response = requests.get(
            f"{API_URL}/enrollment/{self.enrollment_id}/pricing?item_type={TEST_PROGRAM_TYPE}&item_id={TEST_PROGRAM_ID}"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "pricing" in data
        assert data["pricing"]["participant_count"] == self.participant_count
        
        print(f"Pricing participant_count: {data['pricing']['participant_count']}")
    
    def test_pricing_total_multiplied_by_participant_count(self):
        """Test total price is correctly multiplied by participant count"""
        response = requests.get(
            f"{API_URL}/enrollment/{self.enrollment_id}/pricing?item_type={TEST_PROGRAM_TYPE}&item_id={TEST_PROGRAM_ID}"
        )
        assert response.status_code == 200
        
        data = response.json()
        pricing = data["pricing"]
        
        # Calculate expected total
        per_person = pricing["final_per_person"]
        expected_total = round(per_person * pricing["participant_count"], 2)
        
        assert pricing["total"] == expected_total, f"Expected {expected_total}, got {pricing['total']}"
        
        print(f"Price verification: {pricing['symbol']}{per_person} x {pricing['participant_count']} = {pricing['symbol']}{pricing['total']}")
    
    def test_pricing_security_checks(self):
        """Test pricing returns security validation info"""
        response = requests.get(
            f"{API_URL}/enrollment/{self.enrollment_id}/pricing?item_type={TEST_PROGRAM_TYPE}&item_id={TEST_PROGRAM_ID}"
        )
        assert response.status_code == 200
        
        data = response.json()
        security = data["security"]
        
        # All security fields present
        assert "vpn_blocked" in security
        assert "fraud_warning" in security
        assert "checks" in security
        assert "ip_country" in security
        assert "claimed_country" in security
        assert "inr_eligible" in security
        
        # Checks detail
        checks = security["checks"]
        assert "ip_is_india" in checks
        assert "claimed_india" in checks
        assert "no_vpn" in checks
        assert "phone_is_indian" in checks


class TestEnrollmentGetV2:
    """Test GET enrollment status"""
    
    def test_get_enrollment_with_participants(self):
        """Test getting enrollment returns participants with attendance_mode"""
        # Create enrollment
        payload = {
            "booker_name": "TEST_Get_BookerV2",
            "booker_email": "getbooker@gmail.com",
            "booker_country": "AE",
            "participants": [{
                "name": "TEST_Get_P1",
                "relationship": "Myself",
                "age": 28,
                "gender": "Female",
                "country": "IN",
                "attendance_mode": "offline",
                "notify": True,
                "email": "participant@gmail.com",
                "phone": "1234567890"
            }]
        }
        create_resp = requests.post(f"{API_URL}/enrollment/start", json=payload)
        assert create_resp.status_code == 200
        enrollment_id = create_resp.json()["enrollment_id"]
        
        # Get enrollment
        get_resp = requests.get(f"{API_URL}/enrollment/{enrollment_id}")
        assert get_resp.status_code == 200
        
        data = get_resp.json()
        assert data["id"] == enrollment_id
        assert data["booker_name"] == "TEST_Get_BookerV2"
        assert data["booker_email"] == "getbooker@gmail.com"
        assert data["booker_country"] == "AE"
        assert "participants" in data
        assert len(data["participants"]) == 1
        
        participant = data["participants"][0]
        assert participant["name"] == "TEST_Get_P1"
        assert participant["country"] == "IN"
        assert participant["attendance_mode"] == "offline"
        assert participant["notify"] is True
        assert participant["email"] == "participant@gmail.com"
        
        print(f"Enrollment retrieved successfully with participant data")
    
    def test_get_enrollment_not_found(self):
        """Test 404 for non-existent enrollment"""
        fake_id = str(uuid.uuid4())
        response = requests.get(f"{API_URL}/enrollment/{fake_id}")
        assert response.status_code == 404


class TestFullEnrollmentFlowV2:
    """Integration test - full 3-step enrollment flow"""
    
    def test_complete_3step_flow(self):
        """Test complete enrollment: Participants → Verify (OTP) → Pricing"""
        print("\n=== Full 3-Step Enrollment Flow Test ===\n")
        
        # Step 1: Create enrollment with booker + participants
        print("Step 1: Creating enrollment with booker and participants...")
        payload = {
            "booker_name": "TEST_FullFlow_BookerV2",
            "booker_email": "fullflow@gmail.com",
            "booker_country": "AE",
            "participants": [
                {
                    "name": "TEST_FullFlow_P1",
                    "relationship": "Myself",
                    "age": 30,
                    "gender": "Female",
                    "country": "AE",
                    "attendance_mode": "online",
                    "notify": True,
                    "email": "p1@gmail.com",
                    "phone": "1234567890"
                },
                {
                    "name": "TEST_FullFlow_P2",
                    "relationship": "Mother",
                    "age": 55,
                    "gender": "Female",
                    "country": "IN",
                    "attendance_mode": "offline",
                    "notify": False,
                    "email": None,
                    "phone": None
                }
            ]
        }
        
        create_resp = requests.post(f"{API_URL}/enrollment/start", json=payload)
        assert create_resp.status_code == 200, f"Failed to create enrollment: {create_resp.text}"
        
        data = create_resp.json()
        enrollment_id = data["enrollment_id"]
        assert data["participant_count"] == 2
        print(f"  Created enrollment: {enrollment_id}")
        print(f"  Participants: {data['participant_count']}")
        print(f"  VPN detected: {data['vpn_detected']}")
        
        # Step 2: Verify phone with OTP
        print("\nStep 2: Verifying booker phone with OTP...")
        
        # Send OTP
        send_resp = requests.post(
            f"{API_URL}/enrollment/{enrollment_id}/send-otp",
            json={"phone": "9876543999", "country_code": "+971"}
        )
        assert send_resp.status_code == 200
        mock_otp = send_resp.json()["mock_otp"]
        print(f"  OTP sent. Mock OTP: {mock_otp}")
        
        # Verify OTP
        verify_resp = requests.post(
            f"{API_URL}/enrollment/{enrollment_id}/verify-otp",
            json={"phone": "9876543999", "country_code": "+971", "otp": mock_otp}
        )
        assert verify_resp.status_code == 200
        assert verify_resp.json()["verified"] is True
        print("  Phone verified successfully!")
        
        # Step 3: Get pricing
        print("\nStep 3: Getting pricing with security checks...")
        
        pricing_resp = requests.get(
            f"{API_URL}/enrollment/{enrollment_id}/pricing?item_type=program&item_id=1"
        )
        assert pricing_resp.status_code == 200
        
        pricing_data = pricing_resp.json()
        pricing = pricing_data["pricing"]
        security = pricing_data["security"]
        
        print(f"  Item: {pricing_data['item']['title']}")
        print(f"  Currency: {pricing['currency'].upper()}")
        print(f"  Per person: {pricing['symbol']}{pricing['final_per_person']}")
        print(f"  Participants: {pricing['participant_count']}")
        print(f"  Total: {pricing['symbol']}{pricing['total']}")
        print(f"  INR eligible: {security['inr_eligible']}")
        if security['fraud_warning']:
            print(f"  Warning: {security['fraud_warning']}")
        
        # Verify final enrollment state
        print("\n=== Verifying Final Enrollment State ===")
        
        final_resp = requests.get(f"{API_URL}/enrollment/{enrollment_id}")
        assert final_resp.status_code == 200
        
        enrollment = final_resp.json()
        assert enrollment["phone_verified"] is True
        assert enrollment["status"] == "contact_verified"
        assert len(enrollment["participants"]) == 2
        
        # Verify attendance modes persisted
        assert enrollment["participants"][0]["attendance_mode"] == "online"
        assert enrollment["participants"][1]["attendance_mode"] == "offline"
        
        print(f"  Status: {enrollment['status']}")
        print(f"  Phone verified: {enrollment['phone_verified']}")
        print(f"  Participant 1: {enrollment['participants'][0]['name']} - {enrollment['participants'][0]['attendance_mode']}")
        print(f"  Participant 2: {enrollment['participants'][1]['name']} - {enrollment['participants'][1]['attendance_mode']}")
        
        print("\n=== Full 3-Step Flow PASSED ===")
