"""
Test Suite for Stripe Payment Gateway Integration (Iteration 4)
Tests: Currency detection, checkout creation, payment status, transactions, enrollment_open toggle
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')


class TestCurrencyEndpoints:
    """Currency detection and supported currencies tests"""

    def test_currency_detect_returns_aed_as_default(self):
        """GET /api/currency/detect returns AED as default currency"""
        response = requests.get(f"{BASE_URL}/api/currency/detect")
        assert response.status_code == 200
        data = response.json()
        assert data['currency'] == 'aed', f"Expected 'aed', got {data['currency']}"
        assert data['symbol'] == 'AED', f"Expected 'AED', got {data['symbol']}"
        assert data['country'] == 'UAE', f"Expected 'UAE', got {data['country']}"
        print(f"PASS: Currency detect returns AED as default: {data}")

    def test_currency_supported_returns_5_currencies(self):
        """GET /api/currency/supported returns 5 currencies"""
        response = requests.get(f"{BASE_URL}/api/currency/supported")
        assert response.status_code == 200
        data = response.json()
        currencies = data.get('currencies', [])
        assert len(currencies) == 5, f"Expected 5 currencies, got {len(currencies)}"
        codes = [c['code'] for c in currencies]
        expected_codes = ['aed', 'usd', 'inr', 'eur', 'gbp']
        for code in expected_codes:
            assert code in codes, f"Currency {code} not found in supported currencies"
        print(f"PASS: Supported currencies: {codes}")


class TestPaymentCheckout:
    """Stripe checkout session creation tests"""

    def test_create_checkout_program_usd(self):
        """POST /api/payments/create-checkout with program id=1, currency=usd creates Stripe session"""
        # First get program ID from list
        programs_resp = requests.get(f"{BASE_URL}/api/programs")
        assert programs_resp.status_code == 200
        programs = programs_resp.json()
        assert len(programs) > 0, "No programs found"
        
        # Use first program
        program_id = programs[0]['id']
        
        response = requests.post(f"{BASE_URL}/api/payments/create-checkout", json={
            "item_type": "program",
            "item_id": program_id,
            "currency": "usd",
            "origin_url": BASE_URL
        })
        assert response.status_code == 200, f"Failed to create checkout: {response.text}"
        data = response.json()
        assert 'url' in data, "Response should contain 'url'"
        assert 'session_id' in data, "Response should contain 'session_id'"
        assert data['url'].startswith('https://checkout.stripe.com'), f"URL should be Stripe checkout URL, got {data['url']}"
        print(f"PASS: Created USD checkout session with URL: {data['url'][:50]}...")

    def test_create_checkout_program_aed(self):
        """POST /api/payments/create-checkout with currency=aed works"""
        programs_resp = requests.get(f"{BASE_URL}/api/programs")
        programs = programs_resp.json()
        program_id = programs[0]['id']
        
        response = requests.post(f"{BASE_URL}/api/payments/create-checkout", json={
            "item_type": "program",
            "item_id": program_id,
            "currency": "aed",
            "origin_url": BASE_URL
        })
        assert response.status_code == 200, f"Failed to create AED checkout: {response.text}"
        data = response.json()
        assert 'url' in data
        assert 'session_id' in data
        print(f"PASS: Created AED checkout session")

    def test_create_checkout_program_inr(self):
        """POST /api/payments/create-checkout with currency=inr works"""
        programs_resp = requests.get(f"{BASE_URL}/api/programs")
        programs = programs_resp.json()
        program_id = programs[0]['id']
        
        response = requests.post(f"{BASE_URL}/api/payments/create-checkout", json={
            "item_type": "program",
            "item_id": program_id,
            "currency": "inr",
            "origin_url": BASE_URL
        })
        assert response.status_code == 200, f"Failed to create INR checkout: {response.text}"
        data = response.json()
        assert 'url' in data
        print(f"PASS: Created INR checkout session")

    def test_create_checkout_program_eur(self):
        """POST /api/payments/create-checkout with currency=eur works"""
        programs_resp = requests.get(f"{BASE_URL}/api/programs")
        programs = programs_resp.json()
        program_id = programs[0]['id']
        
        response = requests.post(f"{BASE_URL}/api/payments/create-checkout", json={
            "item_type": "program",
            "item_id": program_id,
            "currency": "eur",
            "origin_url": BASE_URL
        })
        assert response.status_code == 200, f"Failed to create EUR checkout: {response.text}"
        data = response.json()
        assert 'url' in data
        print(f"PASS: Created EUR checkout session")

    def test_create_checkout_program_gbp(self):
        """POST /api/payments/create-checkout with currency=gbp works"""
        programs_resp = requests.get(f"{BASE_URL}/api/programs")
        programs = programs_resp.json()
        program_id = programs[0]['id']
        
        response = requests.post(f"{BASE_URL}/api/payments/create-checkout", json={
            "item_type": "program",
            "item_id": program_id,
            "currency": "gbp",
            "origin_url": BASE_URL
        })
        assert response.status_code == 200, f"Failed to create GBP checkout: {response.text}"
        data = response.json()
        assert 'url' in data
        print(f"PASS: Created GBP checkout session")

    def test_create_checkout_invalid_program_returns_404(self):
        """POST /api/payments/create-checkout with invalid program returns 404"""
        response = requests.post(f"{BASE_URL}/api/payments/create-checkout", json={
            "item_type": "program",
            "item_id": "non-existent-id-12345",
            "currency": "usd",
            "origin_url": BASE_URL
        })
        assert response.status_code == 404, f"Expected 404 for non-existent program, got {response.status_code}"
        print(f"PASS: Non-existent program returns 404")

    def test_create_checkout_invalid_item_type_returns_400(self):
        """POST /api/payments/create-checkout with invalid item_type returns 400"""
        response = requests.post(f"{BASE_URL}/api/payments/create-checkout", json={
            "item_type": "invalid",
            "item_id": "some-id",
            "currency": "usd",
            "origin_url": BASE_URL
        })
        assert response.status_code == 400, f"Expected 400 for invalid item type, got {response.status_code}"
        print(f"PASS: Invalid item type returns 400")


class TestPaymentTransactions:
    """Payment transactions endpoint tests"""

    def test_get_transactions_returns_list(self):
        """GET /api/payments/transactions returns list of payment transactions"""
        response = requests.get(f"{BASE_URL}/api/payments/transactions")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"PASS: Transactions endpoint returns list with {len(data)} items")

    def test_get_status_invalid_session_returns_404(self):
        """GET /api/payments/status/{session_id} with invalid session returns 404"""
        response = requests.get(f"{BASE_URL}/api/payments/status/invalid-session-id")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"PASS: Invalid session ID returns 404")


class TestEnrollmentOpenToggle:
    """Tests for enrollment_open toggle on programs"""

    def test_program_has_enrollment_open_field(self):
        """Programs should have enrollment_open field"""
        response = requests.get(f"{BASE_URL}/api/programs")
        assert response.status_code == 200
        programs = response.json()
        assert len(programs) > 0
        # Check first program has enrollment_open field
        program = programs[0]
        assert 'enrollment_open' in program, "Program should have enrollment_open field"
        print(f"PASS: Program has enrollment_open field: {program['enrollment_open']}")

    def test_program_has_price_aed_field(self):
        """Programs should have price_aed field"""
        response = requests.get(f"{BASE_URL}/api/programs")
        programs = response.json()
        program = programs[0]
        assert 'price_aed' in program, "Program should have price_aed field"
        assert program['price_aed'] > 0, f"Program should have AED price set, got {program['price_aed']}"
        print(f"PASS: Program has price_aed: {program['price_aed']}")


class TestSessionPayments:
    """Tests for session purchase functionality"""

    def test_session_has_price_aed_field(self):
        """Sessions should have price_aed field"""
        response = requests.get(f"{BASE_URL}/api/sessions")
        assert response.status_code == 200
        sessions = response.json()
        assert len(sessions) > 0
        session = sessions[0]
        assert 'price_aed' in session, "Session should have price_aed field"
        print(f"PASS: Session has price_aed field: {session.get('price_aed', 0)}")

    def test_create_checkout_session(self):
        """POST /api/payments/create-checkout with session item_type works"""
        sessions_resp = requests.get(f"{BASE_URL}/api/sessions")
        sessions = sessions_resp.json()
        
        if len(sessions) == 0:
            pytest.skip("No sessions available to test")
        
        # Find a session with price set
        session = None
        for s in sessions:
            if s.get('price_usd', 0) > 0:
                session = s
                break
        
        if not session:
            pytest.skip("No session with price_usd > 0 found")
        
        response = requests.post(f"{BASE_URL}/api/payments/create-checkout", json={
            "item_type": "session",
            "item_id": session['id'],
            "currency": "usd",
            "origin_url": BASE_URL
        })
        
        if response.status_code == 400 and "No price set" in response.text:
            print(f"SKIP: Session {session['id']} has no price for USD")
            pytest.skip("Session has no USD price set")
        
        assert response.status_code == 200, f"Failed to create session checkout: {response.text}"
        data = response.json()
        assert 'url' in data
        print(f"PASS: Created session checkout with URL: {data['url'][:50]}...")


class TestTransactionCreation:
    """Test that transactions are created when checkout is initiated"""

    def test_transaction_created_on_checkout(self):
        """When checkout is created, a transaction record should be created"""
        # Get initial transaction count
        initial_resp = requests.get(f"{BASE_URL}/api/payments/transactions")
        initial_count = len(initial_resp.json())
        
        # Create a checkout
        programs_resp = requests.get(f"{BASE_URL}/api/programs")
        programs = programs_resp.json()
        program_id = programs[0]['id']
        
        checkout_resp = requests.post(f"{BASE_URL}/api/payments/create-checkout", json={
            "item_type": "program",
            "item_id": program_id,
            "currency": "usd",
            "origin_url": BASE_URL
        })
        assert checkout_resp.status_code == 200
        
        # Check transaction count increased
        new_resp = requests.get(f"{BASE_URL}/api/payments/transactions")
        new_count = len(new_resp.json())
        assert new_count > initial_count, f"Transaction count should increase, was {initial_count}, now {new_count}"
        print(f"PASS: Transaction created on checkout. Count: {initial_count} -> {new_count}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
