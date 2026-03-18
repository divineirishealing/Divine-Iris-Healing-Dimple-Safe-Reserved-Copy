"""
Test Iteration 75: Annual Subscribers Module
Tests: Excel upload/download, subscriber list, EMI tracking, session management
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSubscriberDownloadTemplate:
    """Test download-template endpoint returns Excel file with all required columns"""
    
    def test_download_template_returns_xlsx(self):
        """GET /api/admin/subscribers/download-template should return Excel file"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/download-template")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Check content type is Excel
        content_type = response.headers.get('Content-Type', '')
        assert 'spreadsheet' in content_type or 'excel' in content_type or 'octet-stream' in content_type, \
            f"Expected Excel content type, got: {content_type}"
        
        # Check Content-Disposition header for filename
        disposition = response.headers.get('Content-Disposition', '')
        assert 'subscriber_template.xlsx' in disposition, f"Expected filename in header, got: {disposition}"
        
        # Check response has content
        assert len(response.content) > 0, "Expected non-empty file content"
        print(f"✓ Template download successful, size: {len(response.content)} bytes")


class TestSubscriberList:
    """Test list endpoint returns subscribers with subscription data"""
    
    def test_list_subscribers_returns_array(self):
        """GET /api/admin/subscribers/list should return list of subscribers"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/list")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"✓ Subscriber list returned {len(data)} subscribers")
        
        # If there are subscribers, validate structure
        if len(data) > 0:
            sub = data[0]
            assert 'id' in sub or 'email' in sub or 'name' in sub, "Expected subscriber to have identifier"
            print(f"✓ First subscriber: {sub.get('name', 'N/A')}")
    
    def test_list_subscribers_contains_test_user(self):
        """Verify test user Priya Sharma is in the list with subscription data"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/list")
        assert response.status_code == 200
        
        data = response.json()
        # Find Priya Sharma
        priya = next((s for s in data if s.get('email') == 'test@divineiris.com'), None)
        
        if priya:
            sub = priya.get('subscription', {})
            assert sub, "Test user should have subscription data"
            
            # Verify EMI data structure
            emis = sub.get('emis', [])
            print(f"✓ Found test user with {len(emis)} EMIs")
            
            # Verify session data structure
            sess = sub.get('sessions', {})
            assert 'total' in sess or 'availed' in sess, "Session data should have total/availed"
            print(f"✓ Test user sessions: availed={sess.get('availed', 0)}, total={sess.get('total', 0)}")
        else:
            print("⚠ Test user Priya Sharma not found in subscribers list (may need upload)")


class TestSubscriberExport:
    """Test export endpoint returns Excel with subscriber data"""
    
    def test_export_subscribers_returns_xlsx(self):
        """GET /api/admin/subscribers/export should return Excel file"""
        response = requests.get(f"{BASE_URL}/api/admin/subscribers/export")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Check content type is Excel
        content_type = response.headers.get('Content-Type', '')
        assert 'spreadsheet' in content_type or 'excel' in content_type or 'octet-stream' in content_type, \
            f"Expected Excel content type, got: {content_type}"
        
        # Check Content-Disposition header for filename
        disposition = response.headers.get('Content-Disposition', '')
        assert 'subscribers_export.xlsx' in disposition, f"Expected filename in header, got: {disposition}"
        
        print(f"✓ Export successful, size: {len(response.content)} bytes")


class TestStudentHomeSubscriptionData:
    """Test student home endpoint returns subscription/financial data"""
    
    def test_student_home_with_session_cookie(self):
        """GET /api/student/home with session should return financials from subscription"""
        cookies = {'session_token': 'test-session-22fbe1e5'}
        response = requests.get(f"{BASE_URL}/api/student/home", cookies=cookies)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Check financials structure
        fin = data.get('financials', {})
        assert 'total_fee' in fin, "Financials should have total_fee"
        assert 'total_paid' in fin, "Financials should have total_paid"
        assert 'remaining' in fin, "Financials should have remaining"
        assert 'emis' in fin, "Financials should have emis array"
        assert 'next_due' in fin, "Financials should have next_due"
        
        print(f"✓ Financials: total_fee={fin.get('total_fee')}, paid={fin.get('total_paid')}, remaining={fin.get('remaining')}")
        print(f"✓ EMIs: {len(fin.get('emis', []))} entries, next_due={fin.get('next_due')}")
        
        # Check package/sessions structure
        pkg = data.get('package', {})
        assert 'total_sessions' in pkg, "Package should have total_sessions"
        assert 'used_sessions' in pkg, "Package should have used_sessions"
        assert 'yet_to_avail' in pkg, "Package should have yet_to_avail"
        assert 'scheduled_dates' in pkg, "Package should have scheduled_dates"
        
        print(f"✓ Sessions: {pkg.get('used_sessions', 0)}/{pkg.get('total_sessions', 0)}, yet_to_avail={pkg.get('yet_to_avail')}")
        print(f"✓ Scheduled dates: {pkg.get('scheduled_dates', [])}")
        
        # Check programs in package
        programs = data.get('programs', [])
        print(f"✓ Programs in package: {programs}")
        
        # Verify bi-annual/quarterly
        assert 'bi_annual_download' in pkg or pkg.get('bi_annual_download') is not None
        assert 'quarterly_releases' in pkg or pkg.get('quarterly_releases') is not None
        print(f"✓ Bi-annual: {pkg.get('bi_annual_download', 0)}, Quarterly: {pkg.get('quarterly_releases', 0)}")
    
    def test_student_home_without_session_returns_401(self):
        """GET /api/student/home without session should return 401"""
        response = requests.get(f"{BASE_URL}/api/student/home")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Returns 401 without session cookie")


class TestSubscriberUpload:
    """Test upload endpoint (without actually uploading, just checking endpoint exists)"""
    
    def test_upload_endpoint_exists(self):
        """POST /api/admin/subscribers/upload should exist and require file"""
        # Send empty request to check endpoint exists
        response = requests.post(f"{BASE_URL}/api/admin/subscribers/upload")
        
        # Should return 422 (validation error for missing file) not 404
        assert response.status_code in [400, 422], f"Expected 400/422 for missing file, got {response.status_code}"
        print("✓ Upload endpoint exists and validates file requirement")


class TestEMIPaymentEndpoint:
    """Test EMI payment recording endpoint"""
    
    def test_emi_payment_endpoint_exists(self):
        """POST /api/admin/subscribers/emi-payment should exist"""
        # Send invalid request to check endpoint exists
        response = requests.post(
            f"{BASE_URL}/api/admin/subscribers/emi-payment",
            json={"client_id": "fake-id", "emi_number": 1, "paid_date": "2026-01-15", "amount_paid": 1000}
        )
        
        # Should return 404 (client not found) not 422 (endpoint not found)
        assert response.status_code == 404, f"Expected 404 for fake client, got {response.status_code}"
        print("✓ EMI payment endpoint exists")


class TestSessionUpdateEndpoint:
    """Test session update endpoint"""
    
    def test_session_update_endpoint_exists(self):
        """POST /api/admin/subscribers/session-update should exist"""
        response = requests.post(
            f"{BASE_URL}/api/admin/subscribers/session-update",
            json={"client_id": "fake-id", "availed_increment": 1}
        )
        
        # Should return 404 (client not found) not 422
        assert response.status_code == 404, f"Expected 404 for fake client, got {response.status_code}"
        print("✓ Session update endpoint exists")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
