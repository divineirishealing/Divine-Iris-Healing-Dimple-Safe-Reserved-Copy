from fastapi import APIRouter, HTTPException, Request, Response, Depends
from pydantic import BaseModel
from typing import Optional
import os, uuid, httpx
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/api/auth", tags=["Auth"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# --- MODELS ---

class AuthSessionStart(BaseModel):
    session_id: str
    redirect_url: Optional[str] = None

class User(BaseModel):
    id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "student"
    tier: int = 1
    client_id: Optional[str] = None

# --- HELPERS ---

def _session_token_from_request(request: Request) -> Optional[str]:
    """
    Prefer Authorization: Bearer (localStorage / axios interceptor) over the cookie.
    Stale API-domain cookies are common when the SPA stores a fresh token after OAuth;
    cookie-first would ignore Bearer and return 401, breaking dashboard login.
    """
    auth_header = request.headers.get("Authorization") or ""
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        if token:
            return token
    cookie = request.cookies.get("session_token")
    return cookie.strip() if cookie else None


async def get_current_user(request: Request):
    session_token = _session_token_from_request(request)

    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await db.sessions.find_one({"token": session_token})
    if not session:
        raise HTTPException(status_code=401, detail="Session invalid")
    
    # Check expiry
    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
        
    if expires_at < datetime.now(timezone.utc):
        await db.sessions.delete_one({"token": session_token})
        raise HTTPException(status_code=401, detail="Session expired")

    user = await db.users.find_one({"id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user

# --- ROUTES ---

@router.post("/google")
async def google_auth_callback(data: AuthSessionStart, response: Response):
    """
    Exchange session_id for user data via Emergent Auth.
    Verify email exists in 'clients' collection.
    Create/Update user and session.
    """
    # 1. Exchange session_id for user info
    emergent_auth_url = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
    async with httpx.AsyncClient() as http:
        try:
            resp = await http.get(emergent_auth_url, headers={"X-Session-ID": data.session_id})
            resp.raise_for_status()
            user_data = resp.json()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Auth provider error: {str(e)}")

    email = user_data.get("email", "").lower()
    if not email:
        raise HTTPException(status_code=400, detail="No email provided by auth provider")

    # 2. Check strict whitelist against 'clients'
    # We check if this email exists in our CRM (Client Garden)
    client_doc = await db.clients.find_one(
        {"$or": [{"email": email}, {"email": email.strip()}]}, 
        {"_id": 0}
    )

    if not client_doc:
        # REJECT LOGIN - User not in portal
        raise HTTPException(status_code=403, detail="Account not found. Access is restricted to registered students.")

    # 3. Find or Create User in 'users' collection
    user = await db.users.find_one({"email": email})
    
    if not user:
        # Create new user linked to client
        # Determine Tier based on Client Label
        label = client_doc.get("label", "Dew")
        tier_map = {
            "Dew": 1, "Seed": 1, 
            "Root": 2, "Bloom": 2, 
            "Iris": 4, "Purple Bees": 4, "Iris Bees": 4
        }
        tier = tier_map.get(label, 1)

        user_id = str(uuid.uuid4())
        new_user = {
            "id": user_id,
            "email": email,
            "name": user_data.get("name") or client_doc.get("name") or "Student",
            "picture": user_data.get("picture", ""),
            "role": "student",
            "tier": tier,
            "client_id": client_doc.get("id"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "is_active": True
        }
        await db.users.insert_one(new_user)
        user = new_user
    else:
        # Update picture if changed
        if user_data.get("picture") and user.get("picture") != user_data.get("picture"):
            await db.users.update_one({"id": user["id"]}, {"$set": {"picture": user_data.get("picture")}})
            user["picture"] = user_data.get("picture")

    # 4. Create Session
    session_token = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    await db.sessions.insert_one({
        "token": session_token,
        "user_id": user["id"],
        "email": email,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": expires_at.isoformat()
    })

    # 5. Set Cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        path="/",
        httponly=True,
        secure=True,
        samesite="none",
        max_age=int((expires_at - datetime.now(timezone.utc)).total_seconds()),
    )

    return {
        "message": "Authenticated",
        # Also returned in body so the frontend can persist it in localStorage
        # and send it as "Authorization: Bearer <token>" for cross-domain requests
        # where third-party cookies are blocked by the browser.
        "session_token": session_token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user.get("role", "student"),
            "tier": user.get("tier", 1),
            "picture": user.get("picture")
        }
    }

@router.get("/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user.get("role", "student"),
        "tier": user.get("tier", 1),
        "picture": user.get("picture", ""),
        "client_id": user.get("client_id") or None,
    }

@router.post("/logout")
async def logout(response: Response, request: Request):
    session_token = _session_token_from_request(request)
    if session_token:
        await db.sessions.delete_one({"token": session_token})

    response.delete_cookie(
        "session_token",
        path="/",
        secure=True,
        samesite="none",
        httponly=True,
    )
    return {"message": "Logged out"}
