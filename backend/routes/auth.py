from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel
from typing import Optional, Tuple
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


def _parse_session_expires_at(session: dict) -> Optional[datetime]:
    expires_at = session.get("expires_at")
    if not expires_at:
        return None
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return expires_at


async def _get_valid_session_and_user(request: Request) -> Tuple[Optional[dict], Optional[dict]]:
    """Return (session, user) or (None, None) if missing / invalid / expired."""
    session_token = _session_token_from_request(request)
    if not session_token:
        return None, None
    session = await db.sessions.find_one({"token": session_token})
    if not session:
        return None, None
    expires_at = _parse_session_expires_at(session)
    if expires_at and expires_at < datetime.now(timezone.utc):
        await db.sessions.delete_one({"token": session_token})
        return None, None
    user = await db.users.find_one({"id": session["user_id"]}, {"_id": 0})
    if not user:
        return None, None
    return session, user


async def get_current_user(request: Request):
    _session, user = await _get_valid_session_and_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


async def get_optional_user(request: Request):
    """Same session resolution as get_current_user, but returns None if not signed in."""
    _session, user = await _get_valid_session_and_user(request)
    return user


async def _verify_admin_password(password: str) -> None:
    settings = await db.site_settings.find_one({"id": "site_settings"}, {"_id": 0, "admin_password": 1})
    stored = (settings or {}).get("admin_password", "divineadmin2024")
    if password != stored:
        raise HTTPException(status_code=401, detail="Invalid admin password")


async def _ensure_user_for_impersonation(email: Optional[str], user_id: Optional[str]) -> dict:
    """Resolve a portal user; create from Client Garden if needed (same rules as Google OAuth)."""
    if user_id:
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user:
            return user
        raise HTTPException(status_code=404, detail="No portal user with this id")
    em = (email or "").strip().lower()
    if not em or "@" not in em:
        raise HTTPException(status_code=400, detail="Valid email is required")
    user = await db.users.find_one({"email": em}, {"_id": 0})
    if user:
        return user
    client_doc = await db.clients.find_one(
        {"$or": [{"email": em}, {"email": em.strip()}]},
        {"_id": 0},
    )
    if not client_doc:
        raise HTTPException(
            status_code=404,
            detail="No client or portal user for this email. Add them to Client Garden first.",
        )
    label = client_doc.get("label", "Dew")
    tier_map = {
        "Dew": 1, "Seed": 1,
        "Root": 2, "Bloom": 2,
        "Iris": 4, "Purple Bees": 4, "Iris Bees": 4,
    }
    tier = tier_map.get(label, 1)
    new_id = str(uuid.uuid4())
    new_user = {
        "id": new_id,
        "email": em,
        "name": client_doc.get("name") or "Student",
        "picture": "",
        "role": "student",
        "tier": tier,
        "client_id": client_doc.get("id"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True,
        "created_via": "admin_impersonation",
    }
    await db.users.insert_one(new_user)
    return new_user


class ImpersonateBody(BaseModel):
    admin_password: str
    email: Optional[str] = None
    user_id: Optional[str] = None

# --- ROUTES ---

@router.post("/impersonate")
async def admin_impersonate(body: ImpersonateBody, response: Response):
    """
    Admin-only: open a real student session for a user (same portal rules as OAuth).
    Requires the site admin password. Marks the session so /me reports impersonating.
    """
    if not body.email and not body.user_id:
        raise HTTPException(status_code=400, detail="Provide email or user_id")
    await _verify_admin_password(body.admin_password)
    user = await _ensure_user_for_impersonation(body.email, body.user_id)

    session_token = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    await db.sessions.insert_one({
        "token": session_token,
        "user_id": user["id"],
        "email": user.get("email", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": expires_at.isoformat(),
        "impersonation": True,
    })

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
        "message": "Impersonation session created",
        "session_token": session_token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user.get("role", "student"),
            "tier": user.get("tier", 1),
            "picture": user.get("picture"),
            "impersonating": True,
        },
    }


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

    # Portal access must be explicitly allowed (e.g. after contact form, admin enables in Client Garden).
    if client_doc.get("portal_login_allowed") is False:
        raise HTTPException(
            status_code=403,
            detail="Portal sign-in is not enabled for your account yet. Please wait for approval from your host.",
        )

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
    session, user = await _get_valid_session_and_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user.get("role", "student"),
        "tier": user.get("tier", 1),
        "picture": user.get("picture", ""),
        "client_id": user.get("client_id") or None,
        # India hub pricing (INR / Stripe) — same as geo-India when set or whitelisted
        "pricing_country_override": user.get("pricing_country_override") or None,
        "impersonating": bool(session and session.get("impersonation")),
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
