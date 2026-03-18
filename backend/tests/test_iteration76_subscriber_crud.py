"""
Iteration 76: Test new subscriber CRUD endpoints for admin panel
- POST /api/admin/subscribers/create - Create subscriber with all fields
- PUT /api/admin/subscribers/update/{client_id} - Update subscriber
- POST /api/admin/subscribers/emi-payment - Mark EMI as paid (quick action)
- POST /api/admin/subscribers/session-update - Increment session availed
- DELETE /api/admin/subscribers/delete/{client_id} - Remove subscription
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSubscriberCreate:
    """Test POST /api/admin/subscribers/create endpoint"""
    
    def test_create_new_subscriber_minimal(self):
        """Create subscriber with minimal fields (name only required)"""
        unique_name = f"TEST_Subscriber_{uuid.uuid4().hex[:8]}"
        payload = {
            "name": unique_name,
            "email": f"test_{uuid.uuid4().hex[:6]}@example.com",
            "annual_program": "Test Program",
            "total_fee": 25000,
            "currency": "INR",
            "payment_mode": "No EMI",
            "num_emis": 0
        }
        
        response = requests.post(f"{BASE_URL}/api/admin/subscribers/create", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain 'id'"
        assert "message" in data, "Response should contain 'message'"
        assert data["message"] in ["Subscriber created", "Subscriber updated"]
        
        # Store for cleanup
        self.created_id = data["id"]
        print(f"Created subscriber: {unique_name} with id {self.created_id}")
    
    def test_create_subscriber_with_emis(self):
        """Create subscriber with EMI schedule"""
        unique_name = f"TEST_EMI_Sub_{uuid.uuid4().hex[:8]}"
        payload = {
            "name": unique_name,
            "email": f"emi_{uuid.uuid4().hex[:6]}@example.com",
            "annual_program": "EMI Test Program",
            "start_date": "2026-01-01",
            "end_date": "2027-01-01",
            "total_fee": 60000,
            "currency": "INR",
            "payment_mode": "EMI",
            "num_emis": 3,
            "emis": [
                {"number": 1, "date": "", "amount": 20000, "remaining": 20000, "due_date": "2026-01-15", "status": "pending"},
                {"number": 2, "date": "", "amount": 20000, "remaining": 20000, "due_date": "2026-02-15", "status": "pending"},
                {"number": 3, "date": "", "amount": 20000, "remaining": 20000, "due_date": "2026-03-15", "status": "pending"}
            ],
            "programs": ["Program A", "Program B"],
            "sessions": {
                "carry_forward": 2,
                "current": 10,
                "total": 12,
                "availed": 0,
                "yet_to_avail": 12,
                "due": 0,
                "scheduled_dates": ["2026-01-20", "2026-02-05"]
            }
        }
        
        response = requests.post(f"{BASE_URL}/api/admin/subscribers/create", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data
        
        # Verify by fetching subscriber list
        list_resp = requests.get(f"{BASE_URL}/api/admin/subscribers/list")
        assert list_resp.status_code == 200
        
        subscribers = list_resp.json()
        found = next((s for s in subscribers if s.get("id") == data["id"]), None)
        assert found is not None, "Created subscriber should appear in list"
        assert found["subscription"]["num_emis"] == 3
        assert len(found["subscription"]["emis"]) == 3
        
        print(f"Created subscriber with EMIs: {unique_name}")
    
    def test_create_subscriber_updates_if_email_exists(self):
        """Creating with existing email should update instead of creating duplicate"""
        email = f"update_test_{uuid.uuid4().hex[:6]}@example.com"
        
        # First create
        payload1 = {
            "name": "Original Name",
            "email": email,
            "annual_program": "Original Program",
            "total_fee": 10000,
            "currency": "INR"
        }
        resp1 = requests.post(f"{BASE_URL}/api/admin/subscribers/create", json=payload1)
        assert resp1.status_code == 200
        id1 = resp1.json()["id"]
        
        # Second create with same email - should update
        payload2 = {
            "name": "Updated Name",
            "email": email,
            "annual_program": "Updated Program",
            "total_fee": 20000,
            "currency": "USD"
        }
        resp2 = requests.post(f"{BASE_URL}/api/admin/subscribers/create", json=payload2)
        assert resp2.status_code == 200
        
        data2 = resp2.json()
        assert data2["message"] == "Subscriber updated", "Should update existing, not create new"
        assert data2["id"] == id1, "Should return same ID for existing client"
        
        print(f"Verified create-or-update behavior for email: {email}")


class TestSubscriberUpdate:
    """Test PUT /api/admin/subscribers/update/{client_id} endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup_subscriber(self):
        """Create a test subscriber to update"""
        self.unique_name = f"TEST_Update_{uuid.uuid4().hex[:8]}"
        payload = {
            "name": self.unique_name,
            "email": f"update_{uuid.uuid4().hex[:6]}@example.com",
            "annual_program": "Initial Program",
            "total_fee": 30000,
            "currency": "INR",
            "payment_mode": "No EMI",
            "num_emis": 0,
            "sessions": {"carry_forward": 0, "current": 5, "total": 5, "availed": 1, "yet_to_avail": 4, "due": 0, "scheduled_dates": []}
        }
        resp = requests.post(f"{BASE_URL}/api/admin/subscribers/create", json=payload)
        assert resp.status_code == 200
        self.client_id = resp.json()["id"]
        yield
        # Cleanup after test
        requests.delete(f"{BASE_URL}/api/admin/subscribers/delete/{self.client_id}")
    
    def test_update_subscriber_full(self):
        """Update subscriber with all fields"""
        update_payload = {
            "name": f"{self.unique_name}_Updated",
            "email": f"updated_{uuid.uuid4().hex[:6]}@example.com",
            "annual_program": "Updated Program",
            "start_date": "2026-02-01",
            "end_date": "2027-02-01",
            "total_fee": 50000,
            "currency": "USD",
            "payment_mode": "EMI",
            "num_emis": 2,
            "emis": [
                {"number": 1, "date": "", "amount": 25000, "remaining": 25000, "due_date": "2026-02-15", "status": "pending"},
                {"number": 2, "date": "", "amount": 25000, "remaining": 25000, "due_date": "2026-03-15", "status": "pending"}
            ],
            "programs": ["New Program A", "New Program B"],
            "sessions": {"carry_forward": 3, "current": 8, "total": 11, "availed": 2, "yet_to_avail": 9, "due": 1, "scheduled_dates": ["2026-02-20"]}
        }
        
        response = requests.put(f"{BASE_URL}/api/admin/subscribers/update/{self.client_id}", json=update_payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["message"] == "Subscriber updated"
        
        # Verify update by fetching list
        list_resp = requests.get(f"{BASE_URL}/api/admin/subscribers/list")
        subscribers = list_resp.json()
        found = next((s for s in subscribers if s.get("id") == self.client_id), None)
        
        assert found is not None
        assert found["subscription"]["annual_program"] == "Updated Program"
        assert found["subscription"]["total_fee"] == 50000
        assert found["subscription"]["currency"] == "USD"
        assert len(found["subscription"]["emis"]) == 2
        
        print(f"Successfully updated subscriber {self.client_id}")
    
    def test_update_nonexistent_subscriber_returns_404(self):
        """Update with invalid client_id should return 404"""
        fake_id = "nonexistent-uuid-12345"
        payload = {"name": "Test", "annual_program": "Test", "total_fee": 1000}
        
        response = requests.put(f"{BASE_URL}/api/admin/subscribers/update/{fake_id}", json=payload)
        assert response.status_code == 404, f"Expected 404 for nonexistent ID, got {response.status_code}"


class TestEMIPayment:
    """Test POST /api/admin/subscribers/emi-payment (Mark EMI as paid quick action)"""
    
    @pytest.fixture(autouse=True)
    def setup_subscriber_with_emis(self):
        """Create subscriber with unpaid EMIs"""
        self.unique_name = f"TEST_EMI_Pay_{uuid.uuid4().hex[:8]}"
        payload = {
            "name": self.unique_name,
            "email": f"emipay_{uuid.uuid4().hex[:6]}@example.com",
            "annual_program": "EMI Payment Test",
            "total_fee": 30000,
            "currency": "INR",
            "payment_mode": "EMI",
            "num_emis": 3,
            "emis": [
                {"number": 1, "date": "", "amount": 10000, "remaining": 10000, "due_date": "2026-01-15", "status": "pending"},
                {"number": 2, "date": "", "amount": 10000, "remaining": 10000, "due_date": "2026-02-15", "status": "pending"},
                {"number": 3, "date": "", "amount": 10000, "remaining": 10000, "due_date": "2026-03-15", "status": "pending"}
            ]
        }
        resp = requests.post(f"{BASE_URL}/api/admin/subscribers/create", json=payload)
        assert resp.status_code == 200
        self.client_id = resp.json()["id"]
        yield
        requests.delete(f"{BASE_URL}/api/admin/subscribers/delete/{self.client_id}")
    
    def test_mark_emi_as_paid(self):
        """Mark first EMI as paid"""
        payment_payload = {
            "client_id": self.client_id,
            "emi_number": 1,
            "paid_date": "2026-01-10",
            "amount_paid": 10000
        }
        
        response = requests.post(f"{BASE_URL}/api/admin/subscribers/emi-payment", json=payment_payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["message"] == "EMI #1 updated"
        
        # Verify EMI status changed
        list_resp = requests.get(f"{BASE_URL}/api/admin/subscribers/list")
        subscribers = list_resp.json()
        found = next((s for s in subscribers if s.get("id") == self.client_id), None)
        
        emi1 = next((e for e in found["subscription"]["emis"] if e["number"] == 1), None)
        assert emi1 is not None
        assert emi1["status"] == "paid", f"EMI status should be 'paid', got {emi1['status']}"
        assert emi1["remaining"] == 0, f"EMI remaining should be 0, got {emi1['remaining']}"
        
        print(f"EMI #1 marked as paid for client {self.client_id}")
    
    def test_partial_emi_payment(self):
        """Partial EMI payment sets status to 'partial'"""
        payment_payload = {
            "client_id": self.client_id,
            "emi_number": 2,
            "paid_date": "2026-02-10",
            "amount_paid": 5000  # Half of 10000
        }
        
        response = requests.post(f"{BASE_URL}/api/admin/subscribers/emi-payment", json=payment_payload)
        assert response.status_code == 200
        
        # Verify partial status
        list_resp = requests.get(f"{BASE_URL}/api/admin/subscribers/list")
        subscribers = list_resp.json()
        found = next((s for s in subscribers if s.get("id") == self.client_id), None)
        
        emi2 = next((e for e in found["subscription"]["emis"] if e["number"] == 2), None)
        assert emi2["status"] == "partial"
        assert emi2["remaining"] == 5000
        
        print(f"Partial payment recorded - EMI #2 has {emi2['remaining']} remaining")
    
    def test_emi_payment_invalid_client(self):
        """EMI payment with invalid client_id returns 404"""
        payload = {
            "client_id": "fake-client-id",
            "emi_number": 1,
            "paid_date": "2026-01-10",
            "amount_paid": 10000
        }
        
        response = requests.post(f"{BASE_URL}/api/admin/subscribers/emi-payment", json=payload)
        assert response.status_code == 404


class TestSessionUpdate:
    """Test POST /api/admin/subscribers/session-update (Increment session quick action)"""
    
    @pytest.fixture(autouse=True)
    def setup_subscriber_with_sessions(self):
        """Create subscriber with session data"""
        self.unique_name = f"TEST_Session_{uuid.uuid4().hex[:8]}"
        payload = {
            "name": self.unique_name,
            "email": f"session_{uuid.uuid4().hex[:6]}@example.com",
            "annual_program": "Session Test",
            "total_fee": 20000,
            "sessions": {
                "carry_forward": 2,
                "current": 10,
                "total": 12,
                "availed": 3,
                "yet_to_avail": 9,
                "due": 0,
                "scheduled_dates": []
            }
        }
        resp = requests.post(f"{BASE_URL}/api/admin/subscribers/create", json=payload)
        assert resp.status_code == 200
        self.client_id = resp.json()["id"]
        yield
        requests.delete(f"{BASE_URL}/api/admin/subscribers/delete/{self.client_id}")
    
    def test_increment_session_availed(self):
        """Increment session availed by 1"""
        payload = {
            "client_id": self.client_id,
            "availed_increment": 1
        }
        
        response = requests.post(f"{BASE_URL}/api/admin/subscribers/session-update", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["message"] == "Session updated"
        
        # Verify session count changed
        list_resp = requests.get(f"{BASE_URL}/api/admin/subscribers/list")
        subscribers = list_resp.json()
        found = next((s for s in subscribers if s.get("id") == self.client_id), None)
        
        sessions = found["subscription"]["sessions"]
        assert sessions["availed"] == 4, f"Availed should be 4, got {sessions['availed']}"
        assert sessions["yet_to_avail"] == 8, f"Yet to avail should be 8, got {sessions['yet_to_avail']}"
        
        print(f"Session incremented: availed={sessions['availed']}, yet_to_avail={sessions['yet_to_avail']}")
    
    def test_add_scheduled_date(self):
        """Add a new scheduled date"""
        payload = {
            "client_id": self.client_id,
            "new_scheduled_date": "2026-04-15"
        }
        
        response = requests.post(f"{BASE_URL}/api/admin/subscribers/session-update", json=payload)
        assert response.status_code == 200
        
        # Verify date added
        list_resp = requests.get(f"{BASE_URL}/api/admin/subscribers/list")
        subscribers = list_resp.json()
        found = next((s for s in subscribers if s.get("id") == self.client_id), None)
        
        scheduled = found["subscription"]["sessions"]["scheduled_dates"]
        assert "2026-04-15" in scheduled, f"Expected '2026-04-15' in scheduled dates, got {scheduled}"
        
        print(f"Scheduled date added: {scheduled}")


class TestSubscriberDelete:
    """Test DELETE /api/admin/subscribers/delete/{client_id}"""
    
    def test_delete_subscriber_subscription(self):
        """Delete removes subscription but not the client"""
        # First create a subscriber
        unique_name = f"TEST_Delete_{uuid.uuid4().hex[:8]}"
        payload = {
            "name": unique_name,
            "email": f"delete_{uuid.uuid4().hex[:6]}@example.com",
            "annual_program": "Delete Test",
            "total_fee": 15000
        }
        create_resp = requests.post(f"{BASE_URL}/api/admin/subscribers/create", json=payload)
        assert create_resp.status_code == 200
        client_id = create_resp.json()["id"]
        
        # Verify it appears in list
        list_resp1 = requests.get(f"{BASE_URL}/api/admin/subscribers/list")
        subscribers1 = list_resp1.json()
        found1 = next((s for s in subscribers1 if s.get("id") == client_id), None)
        assert found1 is not None, "Subscriber should exist before delete"
        
        # Delete subscription
        delete_resp = requests.delete(f"{BASE_URL}/api/admin/subscribers/delete/{client_id}")
        assert delete_resp.status_code == 200, f"Expected 200, got {delete_resp.status_code}"
        assert delete_resp.json()["message"] == "Subscription removed"
        
        # Verify no longer in subscriber list
        list_resp2 = requests.get(f"{BASE_URL}/api/admin/subscribers/list")
        subscribers2 = list_resp2.json()
        found2 = next((s for s in subscribers2 if s.get("id") == client_id), None)
        assert found2 is None, "Subscriber should not appear in list after delete"
        
        print(f"Subscription deleted for client {client_id}")
    
    def test_delete_nonexistent_returns_404(self):
        """Delete with invalid client_id returns 404"""
        response = requests.delete(f"{BASE_URL}/api/admin/subscribers/delete/fake-id-12345")
        assert response.status_code == 404


class TestExistingEndpointsStillWork:
    """Verify existing endpoints from iteration 75 still work (regression check)"""
    
    def test_list_subscribers(self):
        """GET /api/admin/subscribers/list returns array"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/list")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print(f"List endpoint returns {len(response.json())} subscribers")
    
    def test_download_template(self):
        """GET /api/admin/subscribers/download-template returns Excel"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/download-template")
        assert response.status_code == 200
        assert "spreadsheet" in response.headers.get("content-type", "")
    
    def test_export_subscribers(self):
        """GET /api/admin/subscribers/export returns Excel"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/export")
        assert response.status_code == 200
        assert "spreadsheet" in response.headers.get("content-type", "")
    
    def test_student_financials_with_session(self):
        """Student home endpoint still works with session cookie"""
        session_token = "test-session-22fbe1e5"
        response = requests.get(
            f"{BASE_URL}/api/student/home",
            cookies={"session_token": session_token}
        )
        assert response.status_code == 200
        data = response.json()
        assert "financials" in data
        assert "package" in data
        print(f"Student home returns financials with {data['financials'].get('num_emis', 0)} EMIs")
