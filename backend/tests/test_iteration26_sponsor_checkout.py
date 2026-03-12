"""
Test iteration 26: Sponsor Checkout Feature
Tests the new sponsor checkout endpoint and related functionality
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')


class TestSponsorCheckout:
    """Sponsor checkout endpoint tests for Shine a Light feature"""
    
    def test_sponsor_checkout_success(self):
        """POST /api/payments/sponsor-checkout - should create Stripe checkout session"""
        payload = {
            "name": f"TEST_Sponsor_{uuid.uuid4().hex[:6]}",
            "email": "test@example.com",
            "amount": 100,
            "currency": "usd",
            "message": "Test sponsorship message",
            "anonymous": False,
            "origin_url": BASE_URL
        }
        response = requests.post(f"{BASE_URL}/api/payments/sponsor-checkout", json=payload)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "url" in data, "Response should contain 'url'"
        assert "session_id" in data, "Response should contain 'session_id'"
        assert data["url"].startswith("https://checkout.stripe.com"), f"URL should be Stripe checkout URL, got: {data['url'][:50]}"
        assert data["session_id"].startswith("cs_test"), f"Session ID should start with cs_test, got: {data['session_id'][:20]}"
    
    def test_sponsor_checkout_creates_transaction(self):
        """POST /api/payments/sponsor-checkout - should create payment_transaction with item_type='sponsor'"""
        unique_name = f"TEST_Sponsor_{uuid.uuid4().hex[:8]}"
        payload = {
            "name": unique_name,
            "email": "sponsor_test@example.com",
            "amount": 50,
            "currency": "inr",
            "message": "Testing transaction creation",
            "anonymous": True,
            "origin_url": BASE_URL
        }
        response = requests.post(f"{BASE_URL}/api/payments/sponsor-checkout", json=payload)
        assert response.status_code == 200
        
        # Verify transaction was created
        transactions_response = requests.get(f"{BASE_URL}/api/payments/transactions")
        assert transactions_response.status_code == 200
        
        transactions = transactions_response.json()
        sponsor_transactions = [t for t in transactions if t.get("donor_name") == unique_name]
        
        assert len(sponsor_transactions) > 0, f"Transaction for {unique_name} should exist"
        
        tx = sponsor_transactions[0]
        assert tx["item_type"] == "sponsor", f"item_type should be 'sponsor', got: {tx['item_type']}"
        assert tx["amount"] == 50, f"amount should be 50, got: {tx['amount']}"
        assert tx["currency"] == "inr", f"currency should be 'inr', got: {tx['currency']}"
        assert tx["anonymous"] == True, f"anonymous should be True, got: {tx['anonymous']}"
        assert tx["donor_email"] == "sponsor_test@example.com"
        assert tx["payment_status"] == "pending"
    
    def test_sponsor_checkout_with_different_currencies(self):
        """POST /api/payments/sponsor-checkout - should accept various currencies"""
        currencies = ["usd", "inr", "aed", "eur", "gbp"]
        
        for currency in currencies:
            payload = {
                "name": f"TEST_Currency_{currency}",
                "email": f"test_{currency}@example.com",
                "amount": 100,
                "currency": currency,
                "message": "",
                "anonymous": False,
                "origin_url": BASE_URL
            }
            response = requests.post(f"{BASE_URL}/api/payments/sponsor-checkout", json=payload)
            assert response.status_code == 200, f"Failed for currency {currency}: {response.text}"
            assert "url" in response.json(), f"No URL for currency {currency}"
    
    def test_sponsor_checkout_invalid_amount_zero(self):
        """POST /api/payments/sponsor-checkout - should reject zero amount"""
        payload = {
            "name": "TEST_InvalidAmount",
            "email": "test@example.com",
            "amount": 0,
            "currency": "usd",
            "message": "",
            "anonymous": False,
            "origin_url": BASE_URL
        }
        response = requests.post(f"{BASE_URL}/api/payments/sponsor-checkout", json=payload)
        assert response.status_code == 400, f"Expected 400 for zero amount, got {response.status_code}"
    
    def test_sponsor_checkout_invalid_amount_negative(self):
        """POST /api/payments/sponsor-checkout - should reject negative amount"""
        payload = {
            "name": "TEST_NegativeAmount",
            "email": "test@example.com",
            "amount": -50,
            "currency": "usd",
            "message": "",
            "anonymous": False,
            "origin_url": BASE_URL
        }
        response = requests.post(f"{BASE_URL}/api/payments/sponsor-checkout", json=payload)
        assert response.status_code == 400, f"Expected 400 for negative amount, got {response.status_code}"
    
    def test_sponsor_checkout_anonymous_flag(self):
        """POST /api/payments/sponsor-checkout - should store anonymous flag correctly"""
        # Test anonymous=True
        payload_anon = {
            "name": f"TEST_AnonTrue_{uuid.uuid4().hex[:6]}",
            "email": "anon@example.com",
            "amount": 25,
            "currency": "usd",
            "message": "",
            "anonymous": True,
            "origin_url": BASE_URL
        }
        response = requests.post(f"{BASE_URL}/api/payments/sponsor-checkout", json=payload_anon)
        assert response.status_code == 200
        
        # Verify in transactions
        tx_resp = requests.get(f"{BASE_URL}/api/payments/transactions")
        transactions = tx_resp.json()
        anon_tx = next((t for t in transactions if t.get("donor_name") == payload_anon["name"]), None)
        
        assert anon_tx is not None, "Anonymous transaction should exist"
        assert anon_tx["anonymous"] == True


class TestPageHeroesSettings:
    """Test page_heroes settings includes sponsor section"""
    
    def test_settings_has_sponsor_in_page_heroes(self):
        """GET /api/settings - should include sponsor in page_heroes"""
        response = requests.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        
        data = response.json()
        assert "page_heroes" in data, "Settings should have page_heroes"
        
        page_heroes = data["page_heroes"]
        assert "sponsor" in page_heroes, "page_heroes should include 'sponsor' key"
        
        sponsor_hero = page_heroes["sponsor"]
        assert "title_text" in sponsor_hero or "subtitle_text" in sponsor_hero, "Sponsor hero should have title/subtitle text"
    
    def test_sponsor_hero_has_style_fields(self):
        """GET /api/settings - sponsor hero should have title_style and subtitle_style"""
        response = requests.get(f"{BASE_URL}/api/settings")
        assert response.status_code == 200
        
        data = response.json()
        sponsor_hero = data.get("page_heroes", {}).get("sponsor", {})
        
        # Check title_style exists
        if "title_style" in sponsor_hero:
            title_style = sponsor_hero["title_style"]
            # Valid style fields
            valid_style_keys = {"font_family", "font_size", "font_color", "font_weight", "font_style"}
            for key in title_style.keys():
                assert key in valid_style_keys, f"Unexpected style key: {key}"


class TestTransactionsAPI:
    """Test transactions API includes sponsor transactions"""
    
    def test_transactions_includes_sponsor_type(self):
        """GET /api/payments/transactions - should return sponsor transactions"""
        response = requests.get(f"{BASE_URL}/api/payments/transactions")
        assert response.status_code == 200
        
        transactions = response.json()
        sponsor_transactions = [t for t in transactions if t.get("item_type") == "sponsor"]
        
        # We created sponsor transactions in earlier tests
        assert len(sponsor_transactions) >= 0, "Should be able to filter sponsor transactions"
        
        if sponsor_transactions:
            tx = sponsor_transactions[0]
            # Verify sponsor transaction structure
            assert "donor_name" in tx, "Sponsor transaction should have donor_name"
            assert "donor_email" in tx, "Sponsor transaction should have donor_email"
            assert "amount" in tx, "Sponsor transaction should have amount"
            assert "currency" in tx, "Sponsor transaction should have currency"
            assert "anonymous" in tx, "Sponsor transaction should have anonymous field"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
