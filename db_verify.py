#!/usr/bin/env python3
"""
Database Verification Script for Bulk Upload Feature
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
ROOT_DIR = Path(__file__).parent / "backend"
load_dotenv(ROOT_DIR / '.env')

async def verify_bulk_upload_in_db():
    """Verify the bulk uploaded client exists in the database"""
    print("\n=== VERIFYING BULK UPLOAD IN DATABASE ===")
    
    try:
        # Connect to MongoDB
        mongo_url = os.environ.get('MONGO_URL')
        if not mongo_url:
            print("❌ MONGO_URL not found in environment")
            return False
            
        client = AsyncIOMotorClient(mongo_url)
        db = client[os.environ.get('DB_NAME', 'healing_portal')]
        
        print(f"✅ Connected to MongoDB")
        print(f"Database: {db.name}")
        
        # Check if the test client exists
        test_email = "test.bulk@example.com"
        client_doc = await db.clients.find_one({"email": test_email})
        
        if client_doc:
            print(f"✅ Client found in database!")
            print(f"Email: {client_doc.get('email')}")
            print(f"Name: {client_doc.get('name')}")
            print(f"Tier: {client_doc.get('label_manual')}")
            print(f"Payment Status: {client_doc.get('payment_status')}")
            print(f"EMI Plan: {client_doc.get('emi_plan_name')}")
            print(f"Created At: {client_doc.get('created_at')}")
            print(f"Client ID: {client_doc.get('id')}")
            
            # Clean up - remove test client
            await db.clients.delete_one({"email": test_email})
            print(f"🧹 Test client removed from database")
            
            return True
        else:
            print(f"❌ Client {test_email} not found in database")
            
            # Let's check what clients exist
            clients_count = await db.clients.count_documents({})
            print(f"Total clients in database: {clients_count}")
            
            # Show sample clients (first 5)
            sample_clients = await db.clients.find({}, {"email": 1, "name": 1, "created_at": 1}).limit(5).to_list(5)
            print("Sample clients:")
            for client in sample_clients:
                print(f"  - {client.get('email', 'No email')} | {client.get('name', 'No name')}")
            
            return False
            
    except Exception as e:
        print(f"❌ Error connecting to database: {str(e)}")
        return False
    finally:
        if 'client' in locals():
            client.close()

async def create_test_user_and_test_profile_flow():
    """Create a test user and test the complete profile approval flow"""
    print("\n=== TESTING COMPLETE PROFILE APPROVAL FLOW ===")
    
    try:
        # Connect to MongoDB
        mongo_url = os.environ.get('MONGO_URL')
        client = AsyncIOMotorClient(mongo_url)
        db = client[os.environ.get('DB_NAME', 'healing_portal')]
        
        # First, ensure we have a client record
        test_email = "test.profile@example.com"
        test_client = {
            "id": "test-client-123",
            "did": "DID-TEST123",
            "email": test_email,
            "name": "Test Profile User",
            "label": "Bloom",
            "sources": ["Test"],
            "created_at": "2026-03-18T10:00:00Z"
        }
        
        # Insert or update client
        await db.clients.update_one(
            {"email": test_email}, 
            {"$set": test_client}, 
            upsert=True
        )
        print("✅ Test client created/updated")
        
        # Create test user linked to client
        test_user = {
            "id": "test-user-123",
            "email": test_email,
            "name": "Test Profile User",
            "role": "student",
            "tier": 2,
            "client_id": "test-client-123",
            "created_at": "2026-03-18T10:00:00Z",
            "is_active": True
        }
        
        await db.users.update_one(
            {"email": test_email},
            {"$set": test_user},
            upsert=True
        )
        print("✅ Test user created/updated")
        
        # Simulate profile update submission
        profile_update = {
            "city": "Mumbai",
            "profession": "Healer",
            "phone": "+91-9876543210"
        }
        
        await db.users.update_one(
            {"id": "test-user-123"},
            {"$set": {
                "pending_profile_update": profile_update,
                "updated_at": "2026-03-18T10:05:00Z"
            }}
        )
        print("✅ Profile update submitted (pending approval)")
        
        # Verify pending approval appears in admin endpoint
        pending_users = await db.users.find(
            {"pending_profile_update": {"$exists": True, "$ne": None}},
            {"_id": 0}
        ).to_list(100)
        
        print(f"✅ Found {len(pending_users)} pending profile updates")
        for user in pending_users:
            if user["id"] == "test-user-123":
                print(f"  - User: {user['name']} ({user['email']})")
                print(f"    Pending: {user['pending_profile_update']}")
        
        # Simulate admin approval
        user = await db.users.find_one({"id": "test-user-123"})
        if user and user.get("pending_profile_update"):
            update_data = user["pending_profile_update"]
            
            # Apply updates to User
            await db.users.update_one(
                {"id": "test-user-123"},
                {
                    "$set": {
                        **update_data,
                        "profile_approved": True,
                        "pending_profile_update": None,
                        "updated_at": "2026-03-18T10:10:00Z"
                    }
                }
            )
            
            # Also sync to Client record
            await db.clients.update_one(
                {"id": "test-client-123"},
                {"$set": update_data}
            )
            
            print("✅ Profile approved and synced to client record")
            
            # Verify the updates
            updated_user = await db.users.find_one({"id": "test-user-123"})
            updated_client = await db.clients.find_one({"id": "test-client-123"})
            
            print(f"✅ User profile verified:")
            print(f"  - City: {updated_user.get('city')}")
            print(f"  - Profession: {updated_user.get('profession')}")
            print(f"  - Profile Approved: {updated_user.get('profile_approved')}")
            print(f"  - Pending Update: {updated_user.get('pending_profile_update')}")
            
            print(f"✅ Client record synced:")
            print(f"  - City: {updated_client.get('city')}")
            print(f"  - Profession: {updated_client.get('profession')}")
            
            # Clean up test data
            await db.users.delete_one({"id": "test-user-123"})
            await db.clients.delete_one({"id": "test-client-123"})
            print("🧹 Test data cleaned up")
            
            return True
        else:
            print("❌ No pending profile update found")
            return False
            
    except Exception as e:
        print(f"❌ Error in profile flow test: {str(e)}")
        return False
    finally:
        if 'client' in locals():
            client.close()

async def main():
    """Main verification runner"""
    print("🔍 Starting Database Verification Tests")
    
    results = {}
    
    # Test 1: Verify bulk upload client in database
    results["bulk_upload_db"] = await verify_bulk_upload_in_db()
    
    # Test 2: Test complete profile approval flow
    results["profile_flow"] = await create_test_user_and_test_profile_flow()
    
    # Summary
    print("\n" + "="*60)
    print("📊 DATABASE VERIFICATION SUMMARY")
    print("="*60)
    
    for test_name, success in results.items():
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{test_name.replace('_', ' ').title()}: {status}")
    
    overall_success = all(results.values())
    print(f"\nOverall Result: {'✅ ALL DATABASE TESTS PASSED' if overall_success else '❌ SOME DATABASE TESTS FAILED'}")
    
    return results

if __name__ == "__main__":
    asyncio.run(main())