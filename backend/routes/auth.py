from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel
from typing import Any, Optional, Tuple
import os, uuid, httpx
from utils.canonical_id import new_entity_id
from utils.garden_labels import client_tier_from_label
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


async def require_admin_console(request: Request) -> bool:
    """Dependency: valid X-Admin-Session from POST /api/admin/clients/login."""
    hdr = (request.headers.get("X-Admin-Session") or "").strip()
    if await _admin_console_session_valid(hdr):
        return True
    raise HTTPException(
        status_code=401,
        detail="Admin session required. Sign in to admin again.",
    )


async def assert_admin_session_or_password(
    request: Request, admin_password: Optional[str] = None
) -> None:
    """Valid X-Admin-Session **or** site admin password (for preview when session cookie/header is missing)."""
    hdr = (request.headers.get("X-Admin-Session") or "").strip()
    if await _admin_console_session_valid(hdr):
        return
    if (admin_password or "").strip():
        await _verify_admin_password(admin_password.strip())
        return
    raise HTTPException(
        status_code=401,
        detail="Admin session required. Sign in to admin again, or send admin_password in the request body.",
    )


async def _admin_console_session_valid(token: Optional[str]) -> bool:
    """Valid token from POST /api/admin/clients/login (stored in admin_sessions)."""
    if not token or len(token.strip()) < 16:
        return False
    t = token.strip()
    doc = await db.admin_sessions.find_one({"token": t})
    if not doc:
        return False
    exp = _parse_session_expires_at(doc)
    if exp and exp < datetime.now(timezone.utc):
        await db.admin_sessions.delete_one({"token": t})
        return False
    return True


def _normalize_email(email: Optional[str]) -> str:
    return (email or "").strip().lower()


async def _pick_client_by_email(email: str, *, prefer_login_eligible: bool) -> Optional[dict]:
    """Pick one Client Garden row when several share the same email (newest first)."""
    em = _normalize_email(email)
    if not em:
        return None
    raw = (email or "").strip()
    docs = await db.clients.find(
        {"$or": [{"email": em}, {"email": raw}]},
        {"_id": 0},
    ).sort([("updated_at", -1)]).to_list(200)
    if not docs:
        return None
    if prefer_login_eligible:
        for c in docs:
            if c.get("portal_login_allowed") is not False:
                return c
    return docs[0]


def _impersonation_placeholder_email(client_id: str) -> str:
    """Stable synthetic address for portal user rows when Client Garden has no email (admin preview only)."""
    cid = (client_id or "").strip()
    return f"no-email.{cid}@impersonation.internal"


async def _ensure_user_for_impersonation(
    email: Optional[str],
    user_id: Optional[str],
    client_id: Optional[str] = None,
) -> dict:
    """Resolve a portal user; create from Client Garden if needed (same rules as Google OAuth)."""
    if user_id:
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user:
            return user
        raise HTTPException(status_code=404, detail="No portal user with this id")

    cid = (client_id or "").strip()
    client_doc = None
    if cid:
        user = await db.users.find_one({"client_id": cid}, {"_id": 0})
        if user:
            return user
        client_doc = await db.clients.find_one({"id": cid}, {"_id": 0})
        if not client_doc:
            raise HTTPException(status_code=404, detail="No client with this id")

    em_in = _normalize_email(email)
    if client_doc is not None:
        db_em = _normalize_email(client_doc.get("email") or "")
        if em_in and "@" in em_in and db_em and db_em != em_in:
            raise HTTPException(
                status_code=400,
                detail="Email does not match this client record",
            )
        if db_em and "@" in db_em:
            em = db_em
        else:
            em = _impersonation_placeholder_email(cid)
    else:
        em = em_in
        if not em or "@" not in em:
            raise HTTPException(status_code=400, detail="Valid email is required")

    user = await db.users.find_one({"email": em}, {"_id": 0})
    if user:
        return user

    if client_doc is None:
        client_doc = await _pick_client_by_email(em, prefer_login_eligible=False)
    if not client_doc:
        raise HTTPException(
            status_code=404,
            detail="No client or portal user for this email. Add them to Client Garden first.",
        )

    tier = client_tier_from_label(client_doc.get("label", ""))
    new_id = new_entity_id()
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
    """`admin_password` optional when request includes a valid `X-Admin-Session` from admin login."""
    admin_password: Optional[str] = None
    email: Optional[str] = None
    user_id: Optional[str] = None
    client_id: Optional[str] = None

# --- ROUTES ---

@router.post("/impersonate")
async def admin_impersonate(request: Request, body: ImpersonateBody, response: Response):
    """
    Admin-only: open a real student session for a user (same portal rules as OAuth).

    Authorization: valid `X-Admin-Session` header (issued by POST /api/admin/clients/login), **or**
    `admin_password` matching site settings. Marks the session so /me reports impersonating.
    """
    if not body.email and not body.user_id and not body.client_id:
        raise HTTPException(status_code=400, detail="Provide email, user_id, or client_id")
    hdr = (request.headers.get("X-Admin-Session") or "").strip()
    if await _admin_console_session_valid(hdr):
        pass
    elif (body.admin_password or "").strip():
        await _verify_admin_password(body.admin_password or "")
    else:
        raise HTTPException(
            status_code=401,
            detail="Admin session missing or expired — sign in to admin again, or send admin_password.",
        )
    user = await _ensure_user_for_impersonation(body.email, body.user_id, body.client_id)

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

    # 2. Check strict whitelist against 'clients' (same email may exist on multiple rows)
    client_doc = await _pick_client_by_email(email, prefer_login_eligible=True)

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
        tier = client_tier_from_label(client_doc.get("label", ""))

        user_id = new_entity_id()
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

def _profile_field_overlay(user: dict, pending: dict, doc_key: str, pend_key: Optional[str] = None) -> Any:
    """Prefer keys present on pending submission so the dashboard matches what was saved for approval."""
    pk = pend_key if pend_key is not None else doc_key
    if pk in pending:
        return pending[pk]
    return user.get(doc_key)


@router.get("/me")
async def get_me(request: Request):
    session, user = await _get_valid_session_and_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    pending = user.get("pending_profile_update") or {}
    joined_divine_iris_at = None
    pend_joined = pending.get("joined_divine_iris_at")
    if pend_joined is not None and str(pend_joined).strip():
        joined_divine_iris_at = str(pend_joined).strip()
    else:
        uj = user.get("joined_divine_iris_at")
        if uj is not None and str(uj).strip():
            joined_divine_iris_at = str(uj).strip()
    cid = user.get("client_id")
    if not joined_divine_iris_at and cid:
        client_doc = await db.clients.find_one({"id": cid}, {"_id": 0, "created_at": 1})
        if client_doc and client_doc.get("created_at"):
            joined_divine_iris_at = client_doc["created_at"]

    display_name = user.get("name") or user.get("full_name") or ""
    if "full_name" in pending:
        display_name = pending["full_name"] or display_name

    return {
        "id": user["id"],
        "email": user["email"],
        "name": display_name,
        "role": user.get("role", "student"),
        "tier": user.get("tier", 1),
        "picture": user.get("picture", ""),
        "client_id": user.get("client_id") or None,
        # First Client Garden record time (UTC ISO) — shown as "date of joining" on dashboard profile
        "joined_divine_iris_at": joined_divine_iris_at,
        "gender": _profile_field_overlay(user, pending, "gender"),
        "place_of_birth": _profile_field_overlay(user, pending, "place_of_birth"),
        "date_of_birth": _profile_field_overlay(user, pending, "date_of_birth"),
        "city": _profile_field_overlay(user, pending, "city"),
        "qualification": _profile_field_overlay(user, pending, "qualification"),
        "profession": _profile_field_overlay(user, pending, "profession"),
        "phone": _profile_field_overlay(user, pending, "phone"),
        "pending_profile_update": user.get("pending_profile_update") or None,
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
