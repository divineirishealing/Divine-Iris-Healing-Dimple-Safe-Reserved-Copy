#!/usr/bin/env python3
"""
Integrated Test for Bulk Client Upload and Student Profile Approval with Authentication Simulation
"""

import asyncio
import httpx
import os
import tempfile
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime, timezone, timedelta

# Load environment variables
ROOT_DIR = Path(__file__).parent / "backend"
load_dotenv(ROOT_DIR / '.env')

BACKEND_URL = "https://iris-admin-dev.preview.emergentagent.com/api"

async def setup_test_environment():
    """Set up test client and user with valid session"""
    print("\n=== SETTING UP TEST ENVIRONMENT ===")
    
    try:
        # Connect to MongoDB
        mongo_url = os.environ.get('MONGO_URL')
        client = AsyncIOMotorClient(mongo_url)
        db = client[os.environ.get('DB_NAME', 'healing_portal')]
        
        # Create test client
        test_client = {
            "id": "test-integration-client",
            "did": "DID-INTEG123",
            "email": "integration.test@example.com",
            "name": "Integration Test User",
            "label": "Bloom",
            "label_manual": "Bloom",
            "sources": ["Integration Test"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "payment_status": "Due",
            "city": "Test City"
        }
        
        await db.clients.update_one(
            {"email": "integration.test@example.com"}, 
            {"$set": test_client}, 
            upsert=True
        )
        print("✅ Test client created")
        
        # Create test user
        test_user = {
            "id": "test-integration-user",
            "email": "integration.test@example.com",
            "name": "Integration Test User",
            "role": "student",
            "tier": 2,
            "client_id": "test-integration-client",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "is_active": True,
            "profile_approved": False
        }
        
        await db.users.update_one(
            {"email": "integration.test@example.com"},
            {"$set": test_user},
            upsert=True
        )
        print("✅ Test user created")
        
        # Create valid session
        session_token = str(uuid.uuid4())
        expires_at = datetime.now(timezone.utc) + timedelta(days=1)
        
        await db.sessions.insert_one({
            "token": session_token,
            "user_id": "test-integration-user",
            "email": "integration.test@example.com",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": expires_at.isoformat()
        })
        print("✅ Valid session created")
        
        client.close()
        return session_token, test_user, test_client
        
    except Exception as e:
        print(f"❌ Error setting up test environment: {str(e)}")
        return None, None, None

async def cleanup_test_environment():
    """Clean up test data"""
    print("\n=== CLEANING UP TEST ENVIRONMENT ===")
    
    try:
        mongo_url = os.environ.get('MONGO_URL')
        client = AsyncIOMotorClient(mongo_url)
        db = client[os.environ.get('DB_NAME', 'healing_portal')]
        
        # Remove test data
        await db.clients.delete_one({"id": "test-integration-client"})
        await db.users.delete_one({"id": "test-integration-user"})
        await db.sessions.delete_many({"user_id": "test-integration-user"})
        
        print("✅ Test environment cleaned up")
        client.close()
        
    except Exception as e:
        print(f"❌ Error cleaning up: {str(e)}")

async def test_authenticated_profile_update(session_token):
    """Test profile update with valid authentication"""
    print("\n=== TESTING AUTHENTICATED PROFILE UPDATE ===")
    
    headers = {
        "Authorization": f"Bearer {session_token}",
        "Content-Type": "application/json"
    }
    
    profile_data = {
        "city": "Mumbai",
        "profession": "Healer",
        "phone": "+91-9876543210",
        "qualification": "Masters in Healing Arts"
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.put(
                f"{BACKEND_URL}/student/profile",
                json=profile_data,
                headers=headers,
                timeout=30.0
            )
            
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.json()}")
            
            if response.status_code == 200:
                result = response.json()
                if "Profile submitted for approval" in result.get("message", ""):
                    print("✅ Profile update submitted successfully with authentication")
                    return True, result
                else:
                    print(f"❌ Unexpected response: {result}")
                    return False, result
            else:
                print(f"❌ Profile update failed: {response.text}")
                return False, response.json() if response.status_code != 422 else {"error": response.text}
                
    except Exception as e:
        print(f"❌ Exception during authenticated profile update: {str(e)}")
        return False, {"error": str(e)}

async def test_admin_approval_flow():
    """Test the complete admin approval flow"""
    print("\n=== TESTING ADMIN APPROVAL FLOW ===")
    
    try:
        # Step 1: Check pending approvals
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{BACKEND_URL}/admin/clients/approvals", timeout=30.0)
            
            print(f"GET Approvals Status: {response.status_code}")
            approvals = response.json()
            print(f"Pending approvals: {len(approvals)}")
            
            # Find our test user in approvals
            test_user_approval = None
            for approval in approvals:
                if approval.get("id") == "test-integration-user":
                    test_user_approval = approval
                    break
            
            if test_user_approval:
                print("✅ Test user found in pending approvals")
                print(f"Pending updates: {test_user_approval.get('pending_profile_update')}")
                
                # Step 2: Approve the profile
                approve_response = await client.post(
                    f"{BACKEND_URL}/admin/clients/approve/test-integration-user",
                    timeout=30.0
                )
                
                print(f"Approval Status: {approve_response.status_code}")
                print(f"Approval Response: {approve_response.json()}")
                
                if approve_response.status_code == 200:
                    result = approve_response.json()
                    if "Profile approved" in result.get("message", ""):
                        print("✅ Profile approved successfully")
                        return True, {"approvals": approvals, "approval": result}
                    else:
                        print(f"❌ Unexpected approval response: {result}")
                        return False, {"approvals": approvals, "approval": result}
                else:
                    print(f"❌ Profile approval failed")
                    return False, {"approvals": approvals, "approval": approve_response.json()}
            else:
                print("❌ Test user not found in pending approvals")
                return False, {"approvals": approvals}
                
    except Exception as e:
        print(f"❌ Exception during admin approval flow: {str(e)}")
        return False, {"error": str(e)}

async def verify_profile_sync():
    """Verify that the approved profile was synced to both user and client records"""
    print("\n=== VERIFYING PROFILE SYNC ===")
    
    try:
        mongo_url = os.environ.get('MONGO_URL')
        client = AsyncIOMotorClient(mongo_url)
        db = client[os.environ.get('DB_NAME', 'healing_portal')]
        
        # Check user record
        user = await db.users.find_one({"id": "test-integration-user"})
        client_doc = await db.clients.find_one({"id": "test-integration-client"})
        
        if not user:
            print("❌ Test user not found")
            return False
        
        if not client_doc:
            print("❌ Test client not found")
            return False
        
        print("✅ User record verification:")
        print(f"  - City: {user.get('city')}")
        print(f"  - Profession: {user.get('profession')}")
        print(f"  - Phone: {user.get('phone')}")
        print(f"  - Profile Approved: {user.get('profile_approved')}")
        print(f"  - Pending Update: {user.get('pending_profile_update')}")
        
        print("✅ Client record verification:")
        print(f"  - City: {client_doc.get('city')}")
        print(f"  - Profession: {client_doc.get('profession')}")
        print(f"  - Phone: {client_doc.get('phone')}")
        
        # Verify sync
        expected_values = {
            "city": "Mumbai",
            "profession": "Healer",
            "phone": "+91-9876543210"
        }
        
        sync_success = True
        for key, expected_value in expected_values.items():
            if user.get(key) != expected_value:
                print(f"❌ User {key} mismatch: expected {expected_value}, got {user.get(key)}")
                sync_success = False
            if client_doc.get(key) != expected_value:
                print(f"❌ Client {key} mismatch: expected {expected_value}, got {client_doc.get(key)}")
                sync_success = False
        
        if user.get('profile_approved') != True:
            print("❌ User profile not marked as approved")
            sync_success = False
        
        if user.get('pending_profile_update') is not None:
            print("❌ User still has pending profile update")
            sync_success = False
        
        if sync_success:
            print("✅ All profile data synced correctly")
        
        client.close()
        return sync_success
        
    except Exception as e:
        print(f"❌ Error verifying profile sync: {str(e)}")
        return False

async def main():
    """Main integrated test runner"""
    print("🚀 Starting Integrated Tests for Bulk Upload and Profile Approval Features")
    print(f"Backend URL: {BACKEND_URL}")
    
    # Initialize test results
    test_results = {
        "setup": False,
        "bulk_upload": False,
        "authenticated_profile_update": False,
        "admin_approval_flow": False,
        "profile_sync": False,
        "cleanup": False
    }
    
    session_token = None
    
    try:
        # 1. Setup test environment
        session_token, test_user, test_client = await setup_test_environment()
        test_results["setup"] = session_token is not None
        
        if not session_token:
            print("❌ Failed to setup test environment, aborting")
            return test_results
        
        # 2. Test bulk upload (from previous test)
        print("\n" + "="*60)
        csv_content = "Name,Email,Tier,Payment Status,EMI Plan\nBulk Test User,bulk.integration@example.com,Iris,Paid,6 Months"
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(csv_content)
            temp_file = f.name
        
        try:
            async with httpx.AsyncClient() as client:
                with open(temp_file, 'rb') as file:
                    files = {'file': ('test_bulk.csv', file, 'text/csv')}
                    response = await client.post(f"{BACKEND_URL}/admin/clients/upload-bulk", files=files, timeout=30.0)
                
                if response.status_code == 200:
                    result = response.json()
                    print(f"✅ Bulk upload successful: {result.get('stats')}")
                    test_results["bulk_upload"] = True
                else:
                    print(f"❌ Bulk upload failed: {response.text}")
                    
        except Exception as e:
            print(f"❌ Bulk upload exception: {str(e)}")
        finally:
            os.unlink(temp_file)
        
        # 3. Test authenticated profile update
        print("\n" + "="*60)
        profile_success, profile_result = await test_authenticated_profile_update(session_token)
        test_results["authenticated_profile_update"] = profile_success
        
        # 4. Test admin approval flow
        print("\n" + "="*60)
        approval_success, approval_result = await test_admin_approval_flow()
        test_results["admin_approval_flow"] = approval_success
        
        # 5. Verify profile sync
        print("\n" + "="*60)
        sync_success = await verify_profile_sync()
        test_results["profile_sync"] = sync_success
        
    except Exception as e:
        print(f"❌ Critical error during integrated testing: {str(e)}")
    
    finally:
        # 6. Cleanup
        await cleanup_test_environment()
        test_results["cleanup"] = True
    
    # Summary
    print("\n" + "="*70)
    print("📊 INTEGRATED TEST SUMMARY")
    print("="*70)
    
    for test_name, success in test_results.items():
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{test_name.replace('_', ' ').title()}: {status}")
    
    # Focus on core functionality
    core_tests = ["bulk_upload", "authenticated_profile_update", "admin_approval_flow", "profile_sync"]
    core_success = all(test_results[test] for test in core_tests)
    
    print(f"\nCore Features Result: {'✅ ALL CORE FEATURES WORKING' if core_success else '❌ SOME CORE FEATURES FAILED'}")
    
    return test_results

if __name__ == "__main__":
    asyncio.run(main())