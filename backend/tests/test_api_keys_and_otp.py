"""
Test suite for API Keys Admin endpoint and Email OTP Verification features
Iteration 40 - Testing new features:
1. GET /api/admin/api-keys - Returns configured API keys for admin display
2. POST /api/enrollment/{id}/send-otp - Sends email OTP
3. POST /api/enrollment/{id}/verify-otp - Verifies OTP (correct/wrong)
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://iris-enrollment-flow.preview.emergentagent.com').rstrip('/')


class TestApiKeysEndpoint:
    """Tests for GET /api/admin/api-keys endpoint"""

    def test_api_keys_returns_list(self):
        """Verify /api/admin/api-keys returns a list of keys"""
        response = requests.get(f"{BASE_URL}/api/admin/api-keys")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Expected list of API keys"
        print(f"PASS: API Keys endpoint returns {len(data)} keys")

    def test_api_keys_contains_stripe(self):
        """Verify Stripe key is present"""
        response = requests.get(f"{BASE_URL}/api/admin/api-keys")
        assert response.status_code == 200
        data = response.json()
        stripe_keys = [k for k in data if k.get('name') == 'stripe']
        assert len(stripe_keys) == 1, "Expected 1 Stripe key"
        stripe = stripe_keys[0]
        assert stripe['label'] == 'Stripe'
        assert stripe['service'] == 'Payments'
        assert 'value' in stripe
        assert stripe['active'] is True
        print(f"PASS: Stripe key present - {stripe['description']}")

    def test_api_keys_contains_smtp(self):
        """Verify Google Workspace SMTP key is present"""
        response = requests.get(f"{BASE_URL}/api/admin/api-keys")
        assert response.status_code == 200
        data = response.json()
        smtp_keys = [k for k in data if k.get('name') == 'smtp']
        assert len(smtp_keys) == 1, "Expected 1 SMTP key"
        smtp = smtp_keys[0]
        assert smtp['label'] == 'Google Workspace SMTP'
        assert smtp['service'] == 'Email'
        assert 'noreply@divineirishealing.com' in smtp['description']
        assert smtp['active'] is True
        print(f"PASS: SMTP key present - {smtp['description']}")

    def test_api_keys_contains_sender_email(self):
        """Verify Sender Email config is present"""
        response = requests.get(f"{BASE_URL}/api/admin/api-keys")
        assert response.status_code == 200
        data = response.json()
        sender_keys = [k for k in data if k.get('name') == 'sender_email']
        assert len(sender_keys) == 1, "Expected 1 Sender Email"
        sender = sender_keys[0]
        assert sender['value'] == 'noreply@divineirishealing.com'
        print(f"PASS: Sender Email present - {sender['value']}")

    def test_api_keys_contains_receipt_email(self):
        """Verify Receipt Email config is present"""
        response = requests.get(f"{BASE_URL}/api/admin/api-keys")
        assert response.status_code == 200
        data = response.json()
        receipt_keys = [k for k in data if k.get('name') == 'receipt_email']
        assert len(receipt_keys) == 1, "Expected 1 Receipt Email"
        receipt = receipt_keys[0]
        assert receipt['value'] == 'receipt@divineirishealing.com'
        print(f"PASS: Receipt Email present - {receipt['value']}")

    def test_api_keys_structure(self):
        """Verify each key has required fields"""
        response = requests.get(f"{BASE_URL}/api/admin/api-keys")
        assert response.status_code == 200
        data = response.json()
        required_fields = ['name', 'label', 'service', 'description', 'value', 'active']
        for key in data:
            for field in required_fields:
                assert field in key, f"Missing field '{field}' in key {key.get('name', 'unknown')}"
        print(f"PASS: All {len(data)} keys have required fields")


class TestEmailOTPFlow:
    """Tests for Email OTP Send and Verify endpoints"""

    @pytest.fixture
    def enrollment_id(self):
        """Create a new enrollment for OTP testing"""
        response = requests.post(f"{BASE_URL}/api/enrollment/start", json={
            "booker_name": "OTP Test User",
            "booker_email": "otptest@example.com",
            "booker_country": "AE",
            "participants": [{
                "name": "Test Participant",
                "relationship": "Myself",
                "age": 30,
                "gender": "Male",
                "country": "AE",
                "attendance_mode": "online",
                "notify": False
            }]
        })
        assert response.status_code == 200, f"Failed to create enrollment: {response.text}"
        enrollment_id = response.json()['enrollment_id']
        print(f"Created enrollment: {enrollment_id}")
        return enrollment_id

    def test_send_otp_success(self, enrollment_id):
        """Test POST /api/enrollment/{id}/send-otp sends OTP successfully"""
        response = requests.post(
            f"{BASE_URL}/api/enrollment/{enrollment_id}/send-otp",
            json={"email": "otptest@example.com"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data['sent'] is True
        assert data['email'] == 'ot***@example.com'  # masked email
        assert 'Verification code sent' in data['message']
        print(f"PASS: OTP sent - {data['message']}")

    def test_send_otp_invalid_email(self, enrollment_id):
        """Test send OTP with invalid email format fails"""
        response = requests.post(
            f"{BASE_URL}/api/enrollment/{enrollment_id}/send-otp",
            json={"email": "invalid-email"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert 'Invalid email' in response.json().get('detail', '')
        print("PASS: Invalid email rejected")

    def test_send_otp_enrollment_not_found(self):
        """Test send OTP for non-existent enrollment"""
        response = requests.post(
            f"{BASE_URL}/api/enrollment/non-existent-id/send-otp",
            json={"email": "test@example.com"}
        )
        assert response.status_code == 404
        assert 'not found' in response.json().get('detail', '').lower()
        print("PASS: Non-existent enrollment rejected")

    def test_verify_otp_wrong_code(self, enrollment_id):
        """Test verify OTP with wrong code fails"""
        # First send OTP
        requests.post(
            f"{BASE_URL}/api/enrollment/{enrollment_id}/send-otp",
            json={"email": "otptest@example.com"}
        )
        time.sleep(0.5)  # Small delay for DB write
        
        # Verify with wrong OTP
        response = requests.post(
            f"{BASE_URL}/api/enrollment/{enrollment_id}/verify-otp",
            json={"email": "otptest@example.com", "otp": "000000"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert 'Incorrect code' in response.json().get('detail', '')
        print("PASS: Wrong OTP rejected with correct error message")

    def test_verify_otp_no_code_sent(self, enrollment_id):
        """Test verify OTP when no code was sent"""
        response = requests.post(
            f"{BASE_URL}/api/enrollment/{enrollment_id}/verify-otp",
            json={"email": "nocodesent@example.com", "otp": "123456"}
        )
        assert response.status_code == 400
        assert 'No verification code' in response.json().get('detail', '')
        print("PASS: Verify without sending code rejected")


class TestEnrollmentStartIntegration:
    """Integration tests for enrollment start endpoint"""

    def test_enrollment_start_success(self):
        """Test enrollment start creates enrollment correctly"""
        response = requests.post(f"{BASE_URL}/api/enrollment/start", json={
            "booker_name": "Integration Test",
            "booker_email": "integration@example.com",
            "booker_country": "IN",
            "participants": [
                {
                    "name": "Person 1",
                    "relationship": "Myself",
                    "age": 25,
                    "gender": "Female",
                    "country": "IN",
                    "attendance_mode": "online",
                    "notify": True,
                    "email": "person1@example.com"
                },
                {
                    "name": "Person 2",
                    "relationship": "Friend",
                    "age": 30,
                    "gender": "Male",
                    "country": "IN",
                    "attendance_mode": "offline",
                    "notify": False
                }
            ]
        })
        assert response.status_code == 200
        data = response.json()
        assert 'enrollment_id' in data
        assert data['participant_count'] == 2
        assert data['step'] == 1
        print(f"PASS: Enrollment created with {data['participant_count']} participants")

    def test_enrollment_start_invalid_email(self):
        """Test enrollment start rejects invalid email"""
        response = requests.post(f"{BASE_URL}/api/enrollment/start", json={
            "booker_name": "Test",
            "booker_email": "invalid-email",
            "booker_country": "AE",
            "participants": [{
                "name": "Test",
                "relationship": "Myself",
                "age": 30,
                "gender": "Male",
                "country": "AE",
                "attendance_mode": "online",
                "notify": False
            }]
        })
        assert response.status_code == 400
        assert 'Invalid email' in response.json().get('detail', '')
        print("PASS: Invalid email rejected at enrollment start")

    def test_enrollment_start_no_participants(self):
        """Test enrollment start rejects empty participants"""
        response = requests.post(f"{BASE_URL}/api/enrollment/start", json={
            "booker_name": "Test",
            "booker_email": "test@example.com",
            "booker_country": "AE",
            "participants": []
        })
        assert response.status_code == 400
        assert 'participant' in response.json().get('detail', '').lower()
        print("PASS: Empty participants rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
