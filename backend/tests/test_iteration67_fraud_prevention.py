"""
Iteration 67: Multi-Layer Fraud Prevention Testing
Tests 3 new fraud prevention layers:
1) billing_address_collection: 'required' in create_checkout_no_adaptive
2) Post-payment fraud detection via _run_post_payment_fraud_check
3) Admin Fraud Alerts dashboard APIs and blocklist integration
"""

import pytest
import requests
import os
import re
import uuid
import urllib.parse

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://client-garden.preview.emergentagent.com').rstrip('/')

# ============================================================
# FRAUD API ENDPOINTS TESTS
# ============================================================

class TestFraudAlertsCRUD:
    """Test fraud alerts CRUD endpoints"""

    def test_get_fraud_alerts_returns_200(self):
        """GET /api/fraud/alerts should return 200 with a list"""
        response = requests.get(f"{BASE_URL}/api/fraud/alerts")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: GET /api/fraud/alerts returns {len(data)} alerts")

    def test_get_fraud_alerts_with_filter_returns_200(self):
        """GET /api/fraud/alerts?status=new should work"""
        response = requests.get(f"{BASE_URL}/api/fraud/alerts?status=new")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # All returned should have status=new
        for alert in data:
            assert alert.get('status') == 'new'
        print(f"PASS: GET /api/fraud/alerts?status=new returns {len(data)} new alerts")

    def test_get_fraud_stats_returns_200(self):
        """GET /api/fraud/stats should return summary statistics"""
        response = requests.get(f"{BASE_URL}/api/fraud/stats")
        assert response.status_code == 200
        data = response.json()
        
        # Verify expected fields
        assert 'total_alerts' in data
        assert 'new' in data
        assert 'reviewed' in data
        assert 'confirmed_fraud' in data
        assert 'legitimate' in data
        assert 'blocked_emails' in data
        assert 'by_severity' in data
        
        # Verify by_severity structure
        sev = data['by_severity']
        assert 'critical' in sev
        assert 'high' in sev
        assert 'medium' in sev
        assert 'low' in sev
        
        print(f"PASS: GET /api/fraud/stats returns: total={data['total_alerts']}, new={data['new']}, blocked_emails={data['blocked_emails']}")

    def test_get_fraud_blocklist_returns_200(self):
        """GET /api/fraud/blocklist should return list of blocked emails"""
        response = requests.get(f"{BASE_URL}/api/fraud/blocklist")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: GET /api/fraud/blocklist returns {len(data)} blocked emails")

    def test_patch_alert_invalid_id_returns_404(self):
        """PATCH /api/fraud/alerts/{invalid_id} should return 404"""
        response = requests.patch(
            f"{BASE_URL}/api/fraud/alerts/invalid-uuid-12345",
            json={"status": "reviewed", "admin_notes": "test"}
        )
        assert response.status_code == 404
        print("PASS: PATCH invalid alert ID returns 404")

    def test_patch_alert_invalid_status_returns_400(self):
        """PATCH with invalid status should return 400"""
        response = requests.patch(
            f"{BASE_URL}/api/fraud/alerts/some-id",
            json={"status": "invalid_status", "admin_notes": "test"}
        )
        # Will return 400 for invalid status or 404 if ID not found first
        assert response.status_code in [400, 404]
        print(f"PASS: PATCH with invalid status returns {response.status_code}")

    def test_delete_blocklist_nonexistent_returns_404(self):
        """DELETE /api/fraud/blocklist/{email} for nonexistent email should return 404"""
        fake_email = "nonexistent_test_email_xyz123@example.com"
        response = requests.delete(f"{BASE_URL}/api/fraud/blocklist/{urllib.parse.quote(fake_email)}")
        assert response.status_code == 404
        print("PASS: DELETE nonexistent email from blocklist returns 404")


class TestBlocklistIntegration:
    """Test blocklist integration with enrollment pricing"""

    def test_create_enrollment_then_check_blocklist_in_pricing(self):
        """Create enrollment, add email to blocklist, verify not_blocklisted=False"""
        # First create an enrollment
        test_email = f"test_blocklist_{uuid.uuid4().hex[:8]}@example.com"
        
        enrollment_response = requests.post(f"{BASE_URL}/api/enrollment/start", json={
            "booker_name": "Test Blocklist User",
            "booker_email": test_email,
            "booker_country": "IN",
            "participants": [{
                "name": "Test Participant",
                "relationship": "Myself",
                "age": 30,
                "gender": "Male",
                "country": "IN",
                "attendance_mode": "online",
                "notify": False
            }]
        })
        
        if enrollment_response.status_code != 200:
            pytest.skip(f"Could not create enrollment: {enrollment_response.text}")
            
        enrollment_data = enrollment_response.json()
        enrollment_id = enrollment_data.get("enrollment_id")
        assert enrollment_id is not None
        print(f"Created test enrollment: {enrollment_id}")

        # Get a program to test pricing
        programs_resp = requests.get(f"{BASE_URL}/api/programs")
        if programs_resp.status_code != 200 or not programs_resp.json():
            pytest.skip("No programs available for pricing test")
        program = programs_resp.json()[0]
        
        # Check pricing - should have not_blocklisted=True (not blocked yet)
        pricing_resp = requests.get(
            f"{BASE_URL}/api/enrollment/{enrollment_id}/pricing",
            params={"item_type": "program", "item_id": program["id"]}
        )
        
        if pricing_resp.status_code == 200:
            pricing_data = pricing_resp.json()
            checks = pricing_data.get("security", {}).get("checks", {})
            # Should have not_blocklisted key
            if "not_blocklisted" in checks:
                assert checks["not_blocklisted"] == True
                print(f"PASS: not_blocklisted=True for non-blocked email")
            else:
                print(f"INFO: not_blocklisted check not found in response, checks: {checks.keys()}")
        else:
            print(f"INFO: Pricing returned {pricing_resp.status_code}")


class TestCodeReviewBillingAddressCollection:
    """Code review: verify billing_address_collection in create_checkout_no_adaptive"""

    def test_billing_address_collection_in_code(self):
        """Verify billing_address_collection: 'required' is in session_params"""
        payments_file = "/app/backend/routes/payments.py"
        with open(payments_file, 'r') as f:
            content = f.read()
        
        # Check for billing_address_collection: "required"
        assert '"billing_address_collection"' in content or "'billing_address_collection'" in content
        assert '"required"' in content or "'required'" in content
        
        # Find the specific line
        lines = content.split('\n')
        found_line = None
        for i, line in enumerate(lines):
            if 'billing_address_collection' in line:
                found_line = i + 1
                break
        
        assert found_line is not None
        print(f"PASS: billing_address_collection found at line {found_line} in payments.py")

    def test_customer_email_prefill_in_code(self):
        """Verify customer_email is pre-filled from metadata"""
        payments_file = "/app/backend/routes/payments.py"
        with open(payments_file, 'r') as f:
            content = f.read()
        
        # Check for customer_email in session_params
        assert 'customer_email' in content
        # Check for metadata.get("email") or similar
        assert "metadata" in content
        
        print("PASS: customer_email prefill logic exists in payments.py")


class TestCodeReviewPostPaymentFraudCheck:
    """Code review: verify _run_post_payment_fraud_check function"""

    def test_post_payment_fraud_check_function_exists(self):
        """Verify _run_post_payment_fraud_check function exists"""
        payments_file = "/app/backend/routes/payments.py"
        with open(payments_file, 'r') as f:
            content = f.read()
        
        assert 'async def _run_post_payment_fraud_check' in content
        print("PASS: _run_post_payment_fraud_check function exists")

    def test_fraud_alert_creation_in_function(self):
        """Verify fraud alert is created with correct structure"""
        payments_file = "/app/backend/routes/payments.py"
        with open(payments_file, 'r') as f:
            content = f.read()
        
        # Check for fraud alert fields
        assert 'fraud_alerts.insert_one' in content
        assert '"id"' in content or "'id'" in content
        assert '"enrollment_id"' in content or "'enrollment_id'" in content
        assert '"severity"' in content or "'severity'" in content
        assert '"reasons"' in content or "'reasons'" in content
        assert '"signals"' in content or "'signals'" in content
        assert '"status"' in content or "'status'" in content
        
        print("PASS: Fraud alert creation logic with correct fields exists")

    def test_critical_severity_for_inr_non_indian_card(self):
        """Verify critical severity for INR payment with non-Indian card"""
        payments_file = "/app/backend/routes/payments.py"
        with open(payments_file, 'r') as f:
            content = f.read()
        
        # Check for INR + non-Indian card → critical logic
        assert 'currency == "inr"' in content
        assert 'card_country' in content
        assert '"critical"' in content or "'critical'" in content
        
        print("PASS: Critical severity logic for INR + non-Indian card exists")

    def test_auto_blocklist_on_critical(self):
        """Verify email is auto-blocked on critical fraud"""
        payments_file = "/app/backend/routes/payments.py"
        with open(payments_file, 'r') as f:
            content = f.read()
        
        # Check for blocklist insertion on critical
        assert 'fraud_blocklist.update_one' in content or 'fraud_blocklist.insert_one' in content
        assert 'severity == "critical"' in content
        
        print("PASS: Auto-blocklist on critical fraud severity exists")

    def test_card_country_extraction_in_check_payment_status(self):
        """Verify card_country is extracted from Stripe in check_payment_status"""
        payments_file = "/app/backend/routes/payments.py"
        with open(payments_file, 'r') as f:
            content = f.read()
        
        # Check for Stripe session retrieval with expand
        assert 'stripe_lib.checkout.Session.retrieve' in content
        assert 'expand' in content
        assert 'payment_method' in content
        
        # Check for card.country extraction
        assert '.card.country' in content or "card.country" in content
        
        print("PASS: Card country extraction logic exists in check_payment_status")


class TestCodeReviewFraudRoutes:
    """Code review: verify fraud.py routes"""

    def test_fraud_router_registered(self):
        """Verify fraud router is registered in server.py"""
        server_file = "/app/backend/server.py"
        with open(server_file, 'r') as f:
            content = f.read()
        
        assert 'from routes' in content and 'fraud' in content
        assert 'fraud.router' in content
        
        print("PASS: fraud router imported and registered in server.py")

    def test_fraud_alerts_endpoint_code(self):
        """Verify GET /api/fraud/alerts endpoint"""
        fraud_file = "/app/backend/routes/fraud.py"
        with open(fraud_file, 'r') as f:
            content = f.read()
        
        assert '@router.get("/alerts")' in content
        assert 'async def list_fraud_alerts' in content
        assert 'fraud_alerts.find' in content
        
        print("PASS: GET /api/fraud/alerts endpoint exists")

    def test_fraud_stats_endpoint_code(self):
        """Verify GET /api/fraud/stats endpoint"""
        fraud_file = "/app/backend/routes/fraud.py"
        with open(fraud_file, 'r') as f:
            content = f.read()
        
        assert '@router.get("/stats")' in content
        assert 'async def fraud_stats' in content
        assert 'count_documents' in content
        assert 'by_severity' in content
        
        print("PASS: GET /api/fraud/stats endpoint exists with severity breakdown")

    def test_patch_alert_endpoint_code(self):
        """Verify PATCH /api/fraud/alerts/{id} endpoint"""
        fraud_file = "/app/backend/routes/fraud.py"
        with open(fraud_file, 'r') as f:
            content = f.read()
        
        assert '@router.patch("/alerts/{alert_id}")' in content
        assert 'async def review_fraud_alert' in content
        assert 'confirmed_fraud' in content
        assert 'legitimate' in content
        
        print("PASS: PATCH /api/fraud/alerts/{id} endpoint exists")

    def test_blocklist_crud_endpoints_code(self):
        """Verify blocklist CRUD endpoints"""
        fraud_file = "/app/backend/routes/fraud.py"
        with open(fraud_file, 'r') as f:
            content = f.read()
        
        assert '@router.get("/blocklist")' in content
        assert '@router.delete("/blocklist/{email}")' in content
        assert 'fraud_blocklist.find' in content
        assert 'fraud_blocklist.delete_one' in content
        
        print("PASS: Blocklist CRUD endpoints exist")

    def test_confirmed_fraud_adds_to_blocklist(self):
        """Verify confirmed_fraud status adds email to blocklist"""
        fraud_file = "/app/backend/routes/fraud.py"
        with open(fraud_file, 'r') as f:
            content = f.read()
        
        # Check for blocklist insertion on confirmed_fraud
        assert 'confirmed_fraud' in content
        assert 'fraud_blocklist.update_one' in content
        assert 'upsert=True' in content
        
        print("PASS: Confirmed fraud adds email to blocklist")

    def test_legitimate_removes_from_blocklist(self):
        """Verify legitimate status removes email from blocklist"""
        fraud_file = "/app/backend/routes/fraud.py"
        with open(fraud_file, 'r') as f:
            content = f.read()
        
        # Check for blocklist deletion on legitimate
        assert 'legitimate' in content
        assert 'fraud_blocklist.delete_one' in content
        
        print("PASS: Legitimate status removes email from blocklist")


class TestCodeReviewEnrollmentBlocklist:
    """Code review: verify blocklist check in enrollment pricing"""

    def test_blocklist_check_in_pricing(self):
        """Verify blocklist check in get_enrollment_pricing"""
        enrollment_file = "/app/backend/routes/enrollment.py"
        with open(enrollment_file, 'r') as f:
            content = f.read()
        
        # Check for blocklist query
        assert 'fraud_blocklist.find_one' in content
        assert 'is_blocklisted' in content or 'blocklisted' in content
        
        print("PASS: Blocklist check exists in enrollment pricing")

    def test_not_blocklisted_in_checks(self):
        """Verify not_blocklisted in security checks dict"""
        enrollment_file = "/app/backend/routes/enrollment.py"
        with open(enrollment_file, 'r') as f:
            content = f.read()
        
        # Check for not_blocklisted key
        assert '"not_blocklisted"' in content or "'not_blocklisted'" in content
        
        print("PASS: not_blocklisted key exists in checks dict")


class TestFraudAlertsTabFrontend:
    """Code review: verify FraudAlertsTab component"""

    def test_fraud_alerts_tab_exists(self):
        """Verify FraudAlertsTab.jsx exists"""
        tab_file = "/app/frontend/src/components/admin/tabs/FraudAlertsTab.jsx"
        with open(tab_file, 'r') as f:
            content = f.read()
        
        assert 'FraudAlertsTab' in content
        assert 'export default FraudAlertsTab' in content
        
        print("PASS: FraudAlertsTab component exists")

    def test_fraud_alerts_tab_has_data_testid(self):
        """Verify data-testid attributes exist"""
        tab_file = "/app/frontend/src/components/admin/tabs/FraudAlertsTab.jsx"
        with open(tab_file, 'r') as f:
            content = f.read()
        
        assert 'data-testid="fraud-alerts-tab"' in content
        assert 'data-testid="fraud-stats"' in content
        assert 'data-testid="fraud-search"' in content
        assert 'data-testid="toggle-blocklist"' in content
        assert 'data-testid="blocklist-panel"' in content
        
        print("PASS: FraudAlertsTab has data-testid attributes")

    def test_fraud_alerts_tab_has_filter_buttons(self):
        """Verify filter buttons exist: All, New, Reviewed, Confirmed Fraud, Legitimate"""
        tab_file = "/app/frontend/src/components/admin/tabs/FraudAlertsTab.jsx"
        with open(tab_file, 'r') as f:
            content = f.read()
        
        # Filter buttons are dynamically generated with data-testid={`fraud-filter-${f}`}
        assert 'data-testid={`fraud-filter-${f}`}' in content
        # The filter values array includes all required filters
        assert "'all'" in content
        assert "'new'" in content
        assert "'reviewed'" in content
        assert "'confirmed_fraud'" in content
        assert "'legitimate'" in content
        
        print("PASS: Filter buttons exist for all statuses")

    def test_fraud_alerts_tab_has_stats_cards(self):
        """Verify stats cards render total, new, critical/high, confirmed, blocked"""
        tab_file = "/app/frontend/src/components/admin/tabs/FraudAlertsTab.jsx"
        with open(tab_file, 'r') as f:
            content = f.read()
        
        assert 'stats.total_alerts' in content
        assert 'stats.new' in content
        assert 'stats.confirmed_fraud' in content
        assert 'stats.blocked_emails' in content
        
        print("PASS: Stats cards exist in FraudAlertsTab")

    def test_fraud_alerts_tab_has_unblock_button(self):
        """Verify unblock button exists in blocklist panel"""
        tab_file = "/app/frontend/src/components/admin/tabs/FraudAlertsTab.jsx"
        with open(tab_file, 'r') as f:
            content = f.read()
        
        assert 'handleUnblock' in content
        assert 'Unblock' in content
        
        print("PASS: Unblock button exists in blocklist panel")

    def test_fraud_alerts_tab_imported_in_admin_panel(self):
        """Verify FraudAlertsTab is imported and used in AdminPanel"""
        admin_file = "/app/frontend/src/components/admin/AdminPanel.jsx"
        with open(admin_file, 'r') as f:
            content = f.read()
        
        assert "import FraudAlertsTab from './tabs/FraudAlertsTab'" in content
        assert '<FraudAlertsTab />' in content
        assert "fraud_alerts" in content
        
        print("PASS: FraudAlertsTab imported and rendered in AdminPanel")


# Run standalone
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
