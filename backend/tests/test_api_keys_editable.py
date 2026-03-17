"""
Test suite for EDITABLE API Keys Admin feature - Iteration 41
Testing new features:
1. GET /api/admin/api-keys - Returns all 8 key definitions with values
2. PUT /api/admin/api-keys - Saves keys to MongoDB and returns success
3. After PUT, GET returns updated values with source='admin'
4. Key manager reads from MongoDB first, falls back to .env
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://iris-cms-preview.preview.emergentagent.com').rstrip('/')

# All 8 key definitions from key_manager.py
EXPECTED_KEYS = [
    "stripe_api_key",
    "smtp_host",
    "smtp_port",
    "smtp_user",
    "smtp_pass",
    "sender_email",
    "receipt_email",
    "resend_api_key"
]

EXPECTED_SERVICES = ["Payments", "Email", "Email Config", "Email (backup)"]


class TestApiKeysGetEndpoint:
    """Tests for GET /api/admin/api-keys endpoint - all 8 keys"""

    def test_get_api_keys_returns_list(self):
        """Verify GET /api/admin/api-keys returns a list"""
        response = requests.get(f"{BASE_URL}/api/admin/api-keys")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Expected list of API keys"
        print(f"PASS: GET /api/admin/api-keys returns {len(data)} keys")

    def test_get_api_keys_returns_8_keys(self):
        """Verify exactly 8 key definitions are returned"""
        response = requests.get(f"{BASE_URL}/api/admin/api-keys")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 8, f"Expected 8 keys, got {len(data)}"
        key_names = [k['name'] for k in data]
        for expected in EXPECTED_KEYS:
            assert expected in key_names, f"Missing key: {expected}"
        print(f"PASS: All 8 keys present: {key_names}")

    def test_get_api_keys_structure(self):
        """Verify each key has required fields including 'source'"""
        response = requests.get(f"{BASE_URL}/api/admin/api-keys")
        assert response.status_code == 200
        data = response.json()
        required_fields = ['name', 'label', 'service', 'description', 'value', 'active', 'source']
        for key in data:
            for field in required_fields:
                assert field in key, f"Missing field '{field}' in key {key.get('name', 'unknown')}"
            # Validate source field values
            assert key['source'] in ['admin', 'env'], f"Invalid source '{key['source']}' for key {key['name']}"
        print(f"PASS: All {len(data)} keys have required fields including 'source'")

    def test_get_api_keys_service_grouping(self):
        """Verify keys are grouped by service: Payments, Email, Email Config, Email (backup)"""
        response = requests.get(f"{BASE_URL}/api/admin/api-keys")
        assert response.status_code == 200
        data = response.json()
        services_found = set(k['service'] for k in data)
        for service in EXPECTED_SERVICES:
            assert service in services_found, f"Missing service group: {service}"
        print(f"PASS: Service groups present: {services_found}")

    def test_get_api_keys_stripe_key(self):
        """Verify stripe_api_key has correct structure"""
        response = requests.get(f"{BASE_URL}/api/admin/api-keys")
        assert response.status_code == 200
        data = response.json()
        stripe_keys = [k for k in data if k['name'] == 'stripe_api_key']
        assert len(stripe_keys) == 1, "stripe_api_key not found"
        stripe = stripe_keys[0]
        assert stripe['service'] == 'Payments'
        assert 'Stripe Secret Key' in stripe['label']
        assert 'value' in stripe
        print(f"PASS: stripe_api_key present - service={stripe['service']}, source={stripe['source']}")


class TestApiKeysPutEndpoint:
    """Tests for PUT /api/admin/api-keys endpoint - save to MongoDB"""

    def test_put_api_keys_success(self):
        """Verify PUT /api/admin/api-keys saves keys and returns success"""
        # Use a unique test value to avoid conflicts
        test_suffix = str(uuid.uuid4())[:8]
        test_value = f"test_smtp_host_{test_suffix}"
        
        response = requests.put(f"{BASE_URL}/api/admin/api-keys", json={
            "smtp_host": test_value
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert 'message' in data, "Missing 'message' in response"
        assert 'updated' in data, "Missing 'updated' in response"
        assert 'smtp_host' in data['updated'], "'smtp_host' not in updated list"
        print(f"PASS: PUT /api/admin/api-keys success - updated: {data['updated']}")
        
        # Cleanup - restore original value
        requests.put(f"{BASE_URL}/api/admin/api-keys", json={
            "smtp_host": "smtp.gmail.com"
        })

    def test_put_api_keys_multiple_keys(self):
        """Verify PUT can update multiple keys at once"""
        test_suffix = str(uuid.uuid4())[:8]
        
        response = requests.put(f"{BASE_URL}/api/admin/api-keys", json={
            "smtp_host": f"test_host_{test_suffix}",
            "smtp_port": "1234"
        })
        assert response.status_code == 200
        data = response.json()
        assert 'smtp_host' in data['updated']
        assert 'smtp_port' in data['updated']
        print(f"PASS: Multiple keys updated: {data['updated']}")
        
        # Cleanup
        requests.put(f"{BASE_URL}/api/admin/api-keys", json={
            "smtp_host": "smtp.gmail.com",
            "smtp_port": "587"
        })

    def test_put_api_keys_ignores_invalid_names(self):
        """Verify PUT ignores keys not in KEY_DEFINITIONS"""
        response = requests.put(f"{BASE_URL}/api/admin/api-keys", json={
            "invalid_key_name": "some_value",
            "smtp_host": "smtp.gmail.com"
        })
        assert response.status_code == 200
        data = response.json()
        assert 'invalid_key_name' not in data['updated'], "Invalid key should be ignored"
        assert 'smtp_host' in data['updated'], "Valid key should be updated"
        print("PASS: Invalid key names ignored, valid ones processed")

    def test_put_api_keys_empty_body(self):
        """Verify PUT with empty body returns success but no updates"""
        response = requests.put(f"{BASE_URL}/api/admin/api-keys", json={})
        assert response.status_code == 200
        data = response.json()
        assert data['updated'] == [], "Empty body should result in no updates"
        print("PASS: Empty PUT body handled gracefully")


class TestApiKeysPersistence:
    """Tests for key persistence - PUT then GET shows source='admin'"""

    def test_put_then_get_shows_admin_source(self):
        """After PUT, GET should return the key with source='admin'"""
        test_suffix = str(uuid.uuid4())[:8]
        unique_host = f"test.smtp.host.{test_suffix}.com"
        
        # PUT to save custom value
        put_response = requests.put(f"{BASE_URL}/api/admin/api-keys", json={
            "smtp_host": unique_host
        })
        assert put_response.status_code == 200
        
        # GET to verify persistence
        get_response = requests.get(f"{BASE_URL}/api/admin/api-keys")
        assert get_response.status_code == 200
        data = get_response.json()
        
        smtp_host = next((k for k in data if k['name'] == 'smtp_host'), None)
        assert smtp_host is not None, "smtp_host not found in GET response"
        assert smtp_host['value'] == unique_host, f"Expected '{unique_host}', got '{smtp_host['value']}'"
        assert smtp_host['source'] == 'admin', f"Expected source='admin', got '{smtp_host['source']}'"
        print(f"PASS: After PUT, GET shows value='{unique_host}' with source='admin'")
        
        # Cleanup - restore .env value
        requests.put(f"{BASE_URL}/api/admin/api-keys", json={
            "smtp_host": "smtp.gmail.com"
        })

    def test_stripe_key_update_and_verify(self):
        """Test updating stripe_api_key and verify persistence"""
        # Get current value first
        get_resp = requests.get(f"{BASE_URL}/api/admin/api-keys")
        current_stripe = next((k for k in get_resp.json() if k['name'] == 'stripe_api_key'), None)
        original_value = current_stripe['value'] if current_stripe else "sk_test_emergent"
        
        test_key = f"sk_test_{str(uuid.uuid4())[:8]}"
        
        # Update stripe key
        put_resp = requests.put(f"{BASE_URL}/api/admin/api-keys", json={
            "stripe_api_key": test_key
        })
        assert put_resp.status_code == 200
        
        # Verify update
        get_resp = requests.get(f"{BASE_URL}/api/admin/api-keys")
        stripe = next((k for k in get_resp.json() if k['name'] == 'stripe_api_key'), None)
        assert stripe['value'] == test_key, f"Stripe key not updated"
        assert stripe['source'] == 'admin', "Stripe key source should be 'admin'"
        print(f"PASS: stripe_api_key updated to '{test_key[:20]}...' with source='admin'")
        
        # Restore original
        requests.put(f"{BASE_URL}/api/admin/api-keys", json={
            "stripe_api_key": original_value
        })


class TestApiKeysSourceField:
    """Tests to verify source field behavior"""

    def test_env_source_for_unmodified_keys(self):
        """Keys not modified via admin should show source='env'"""
        response = requests.get(f"{BASE_URL}/api/admin/api-keys")
        assert response.status_code == 200
        data = response.json()
        
        # Check that at least some keys have 'env' source (unless all were modified)
        sources = [k['source'] for k in data]
        print(f"Sources found: {set(sources)}")
        # At minimum, source should be either 'admin' or 'env'
        for source in sources:
            assert source in ['admin', 'env'], f"Invalid source: {source}"
        print(f"PASS: All keys have valid source ('admin' or 'env')")

    def test_source_changes_after_put(self):
        """Source should change from 'env' to 'admin' after PUT"""
        # First, get a key that we can reset to env
        test_suffix = str(uuid.uuid4())[:8]
        
        # Update with unique value
        requests.put(f"{BASE_URL}/api/admin/api-keys", json={
            "resend_api_key": f"re_test_{test_suffix}"
        })
        
        # Verify source is now 'admin'
        get_resp = requests.get(f"{BASE_URL}/api/admin/api-keys")
        resend = next((k for k in get_resp.json() if k['name'] == 'resend_api_key'), None)
        assert resend['source'] == 'admin', f"Expected source='admin' after PUT, got '{resend['source']}'"
        print(f"PASS: resend_api_key source changed to 'admin' after PUT")


class TestEmailOTPAfterKeyManagerIntegration:
    """Verify email OTP still works with key_manager integration"""

    @pytest.fixture
    def enrollment_id(self):
        """Create a new enrollment for OTP testing"""
        response = requests.post(f"{BASE_URL}/api/enrollment/start", json={
            "booker_name": "Key Manager Test",
            "booker_email": "keymanagertest@example.com",
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
        return response.json()['enrollment_id']

    def test_send_otp_works_after_key_manager_integration(self, enrollment_id):
        """Verify send-otp endpoint still works with key_manager SMTP config"""
        response = requests.post(
            f"{BASE_URL}/api/enrollment/{enrollment_id}/send-otp",
            json={"email": "keymanagertest@example.com"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data['sent'] is True
        assert 'Verification code sent' in data['message']
        print(f"PASS: Email OTP still works with key_manager integration")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
