from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, Request, Query, Body
from pydantic import BaseModel
from typing import Optional, List
import pandas as pd
import io
import uuid
import secrets
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

from routes.auth import assert_admin_session_or_password
from utils.canonical_id import new_entity_id, new_internal_diid
from routes.student import build_admin_dashboard_pricing_snapshot


class DashboardPreviewBody(BaseModel):
    admin_password: Optional[str] = None


async def _dashboard_pricing_snapshot_response(client_id: str, currency: str):
    snap = await build_admin_dashboard_pricing_snapshot(client_id, currency=(currency or "inr").lower())
    if snap is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return snap

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/api/admin/clients", tags=["Admin Clients"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# --- BULK UPLOAD ---

@router.post("/upload-bulk")
async def upload_bulk_clients(file: UploadFile = File(...)):
    """
    Upload Excel/CSV to bulk create/update clients.
    Expected Columns: Name, Email, Phone, City, Tier, Program, Payment Status, EMI Plan, Notes
    """
    contents = await file.read()
    try:
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid file format: {str(e)}")

    # Normalize columns
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    
    stats = {"created": 0, "updated": 0, "errors": []}
    
    for _, row in df.iterrows():
        try:
            email = str(row.get("email", "")).strip().lower()
            if not email or email == "nan":
                continue
                
            name = str(row.get("name", "")).strip()
            phone = str(row.get("phone", "")).strip()
            tier = str(row.get("tier", "Dew")).strip()
            city = str(row.get("city", "")).strip()
            program = str(row.get("program", "")).strip()
            payment_status = str(row.get("payment_status", "")).strip() # Paid, Due, EMI
            emi_plan = str(row.get("emi_plan", "")).strip() # e.g. "3 Months"
            notes = str(row.get("notes", "")).strip()

            # Check existing
            existing = await db.clients.find_one({"email": email})
            
            update_data = {
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "label_manual": tier if tier else None, # Override label
                "city": city,
                "manual_program": program,
                "payment_status": payment_status,
                "notes": notes if notes != "nan" else ""
            }
            
            # Generate EMI Schedule if specified
            if emi_plan and "month" in emi_plan.lower():
                try:
                    months = int(''.join(filter(str.isdigit, emi_plan)))
                    schedule = []
                    # Simple logic: start next month
                    # Real logic needs amount. Assume placeholder for now or prompt user.
                    # We will just store the PLAN name for now, and admin can edit details later.
                    update_data["emi_plan_name"] = emi_plan
                except:
                    pass

            if existing:
                await db.clients.update_one({"_id": existing["_id"]}, {"$set": update_data})
                stats["updated"] += 1
            else:
                # Create new
                _now = datetime.now(timezone.utc).isoformat()
                new_client = {
                    "id": new_entity_id(),
                    "did": f"DID-{str(uuid.uuid4())[:8].upper()}",
                    "diid": new_internal_diid(name, _now),
                    "email": email,
                    "name": name,
                    "phone": phone,
                    "label": tier,
                    "label_manual": tier,
                    "sources": ["Bulk Upload"],
                    "created_at": _now,
                    **update_data
                }
                await db.clients.insert_one(new_client)
                stats["created"] += 1
                
        except Exception as e:
            stats["errors"].append(f"Row error: {str(e)}")

    return {"message": "Bulk upload complete", "stats": stats}

# --- PROFILE APPROVALS ---

def _pending_profile_to_stored_fields(pending: dict) -> dict:
    """Map dashboard profile payload onto user/client fields. `full_name` becomes `name`."""
    if not pending:
        return {}
    out = {k: v for k, v in pending.items() if k != "full_name"}
    fn = pending.get("full_name")
    if fn is not None and str(fn).strip():
        out["name"] = str(fn).strip()
    return out


@router.get("/approvals")
async def get_pending_approvals():
    """Get users with pending profile updates."""
    # We will store pending updates in 'users' collection under 'pending_profile_update'
    users = await db.users.find(
        {"pending_profile_update": {"$exists": True, "$ne": None}}, 
        {"_id": 0}
    ).to_list(100)
    return users

@router.post("/approve/{user_id}")
async def approve_profile(user_id: str):
    user = await db.users.find_one({"id": user_id})
    if not user or not user.get("pending_profile_update"):
        raise HTTPException(status_code=404, detail="No pending update found")
    
    update_data = user["pending_profile_update"]
    stored_fields = _pending_profile_to_stored_fields(update_data)
    now = datetime.now(timezone.utc).isoformat()

    # Apply updates to User (`name` is canonical; avoid persisting duplicate `full_name`)
    await db.users.update_one(
        {"id": user_id},
        {
            "$set": {
                **stored_fields,
                "profile_approved": True,
                "pending_profile_update": None,
                "updated_at": now,
            },
            "$unset": {"full_name": ""},
        },
    )

    # Also sync to Client record if linked (clients use `name`, not `full_name`)
    if user.get("client_id") and stored_fields:
        await db.clients.update_one(
            {"id": user["client_id"]},
            {"$set": {**stored_fields, "updated_at": now}},
        )

    try:
        from routes.points_logic import try_award_activity_points, normalize_email

        user_after = await db.users.find_one({"id": user_id}, {"_id": 0, "email": 1})
        merged_email = normalize_email((user_after or {}).get("email") or user.get("email") or "")
        if merged_email:
            await try_award_activity_points(
                db,
                merged_email,
                "profile_complete",
                ref_unique=f"profile_complete:{user_id}",
                program_id=None,
                meta={"user_id": user_id},
            )
    except Exception:
        pass

    return {"message": "Profile approved"}

@router.post("/reject/{user_id}")
async def reject_profile(user_id: str):
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"pending_profile_update": None}} # Just clear it
    )
    return {"message": "Profile update rejected"}


@router.get("/{client_id}/dashboard-pricing-preview")
async def dashboard_pricing_preview_get(
    client_id: str,
    request: Request,
    currency: str = Query("inr"),
):
    """Admin-only: portal-style self-seat quotes (session header only). Prefer POST for password fallback."""
    await assert_admin_session_or_password(request, None)
    return await _dashboard_pricing_snapshot_response(client_id, currency)


@router.post("/{client_id}/dashboard-pricing-preview")
async def dashboard_pricing_preview_post(
    client_id: str,
    request: Request,
    body: DashboardPreviewBody = Body(default_factory=DashboardPreviewBody),
    currency: str = Query("inr"),
):
    """Admin-only: same as GET; body may include `admin_password` when admin session token is missing."""
    await assert_admin_session_or_password(request, body.admin_password)
    return await _dashboard_pricing_snapshot_response(client_id, currency)


# Admin login — returns a server-side session token for impersonation (X-Admin-Session) without re-entering password.
@router.post("/login")
async def admin_login(data: dict):
    username = data.get("username", "")
    password = data.get("password", "")
    # Check stored password in settings, fallback to default
    settings = await db.site_settings.find_one({"id": "site_settings"}, {"_id": 0, "admin_password": 1})
    stored = (settings or {}).get("admin_password", "divineadmin2024")
    if username == "admin" and password == stored:
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        await db.admin_sessions.insert_one({
            "token": token,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": expires_at.isoformat(),
        })
        return {"success": True, "token": token}
    raise HTTPException(status_code=401, detail="Invalid credentials")
