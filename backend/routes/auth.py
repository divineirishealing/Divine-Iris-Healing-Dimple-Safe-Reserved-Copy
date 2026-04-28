from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel
from typing import Any, Optional, Tuple
import os
import uuid
import secrets
import httpx
from utils.canonical_id import new_entity_id
from utils.garden_labels import client_tier_from_label
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
from urllib.parse import quote_plus, urlencode
from starlette.responses import RedirectResponse


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


async def _finalize_google_profile_login(response: Optional[Response], email_raw: str, name: str, picture: str) -> dict:
    """
    Validate Client Garden whitelist, upsert portal user, session + cookie + JSON body (same contract as legacy OAuth).
    """
    email = _normalize_email(email_raw)
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="No email provided by Google")

    client_doc = await _pick_client_by_email(email, prefer_login_eligible=True)

    if not client_doc:
        raise HTTPException(status_code=403, detail="Account not found. Access is restricted to registered students.")

    if client_doc.get("portal_login_allowed") is False:
        raise HTTPException(
            status_code=403,
            detail="Portal sign-in is not enabled for your account yet. Please wait for approval from your host.",
        )

    user = await db.users.find_one({"email": email})

    if not user:
        tier = client_tier_from_label(client_doc.get("label", ""))
        user_id = new_entity_id()
        new_user = {
            "id": user_id,
            "email": email,
            "name": name or client_doc.get("name") or "Student",
            "picture": picture or "",
            "role": "student",
            "tier": tier,
            "client_id": client_doc.get("id"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "is_active": True,
            "created_via": "google_oauth",
        }
        await db.users.insert_one(new_user)
        user = new_user
    else:
        if picture and user.get("picture") != picture:
            await db.users.update_one({"id": user["id"]}, {"$set": {"picture": picture}})
            user["picture"] = picture

    session_token = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    await db.sessions.insert_one(
        {
            "token": session_token,
            "user_id": user["id"],
            "email": email,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": expires_at.isoformat(),
        }
    )

    if response is not None:
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
        "session_token": session_token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user.get("role", "student"),
            "tier": user.get("tier", 1),
            "picture": user.get("picture"),
        },
    }


def _public_frontend_base() -> str:
    base = (os.environ.get("FRONTEND_URL") or "").strip().rstrip("/")
    return base if base else "http://localhost:3000"


def _google_oauth_redirect_uri(request: Request) -> str:
    explicit = (os.environ.get("GOOGLE_OAUTH_REDIRECT_URI") or "").strip().rstrip("/")
    if explicit:
        return explicit
    scheme = (request.headers.get("x-forwarded-proto") or request.url.scheme or "https").split(",")[0].strip()
    host = (request.headers.get("x-forwarded-host") or request.headers.get("host") or "").strip()
    if not host:
        raise HTTPException(status_code=500, detail="Cannot determine OAuth redirect URI — check proxy headers.")
    return f"{scheme}://{host}/api/auth/google/callback"


async def _google_exchange_code(code: str, redirect_uri: str) -> dict:
    client_id = (os.environ.get("GOOGLE_OAUTH_CLIENT_ID") or "").strip()
    secret = (os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET") or "").strip()
    if not client_id or not secret:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured (missing client id or secret).")
    async with httpx.AsyncClient(timeout=35.0) as http:
        resp = await http.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": client_id,
                "client_secret": secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        if resp.status_code >= 400:
            raise HTTPException(status_code=400, detail=f"Google token exchange failed: {resp.text[:400]}")
        return resp.json()


async def _google_fetch_userinfo(access_token: str) -> dict:
    async with httpx.AsyncClient(timeout=20.0) as http:
        resp = await http.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        resp.raise_for_status()
        return resp.json()


class GoogleFinishBody(BaseModel):
    exchange_token: str


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


@router.get("/google/start")
async def google_oauth_start(request: Request):
    """Begin Google OAuth — redirects to accounts.google.com (no third-party auth host)."""
    client_id = (os.environ.get("GOOGLE_OAUTH_CLIENT_ID") or "").strip()
    if not client_id:
        fe = _public_frontend_base().rstrip("/")
        q = quote_plus(
            "Google sign-in is not configured yet. Add GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET "
            "in Render (backend service) → Environment, then redeploy."
        )
        return RedirectResponse(url=f"{fe}/login?error={q}", status_code=302)
    redirect_uri = _google_oauth_redirect_uri(request)
    state = secrets.token_urlsafe(32)
    await db.oauth_states.insert_one(
        {
            "state": state,
            "expires_at": datetime.now(timezone.utc) + timedelta(minutes=20),
        }
    )
    await db.oauth_states.delete_many({"expires_at": {"$lt": datetime.now(timezone.utc)}})

    params = urlencode(
        {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "access_type": "online",
            "include_granted_scopes": "true",
            "prompt": "select_account",
        }
    )
    return RedirectResponse(url="https://accounts.google.com/o/oauth2/v2/auth?" + params)


@router.get("/google/callback")
async def google_oauth_callback(request: Request, code: str = "", state: str = "", error: str = ""):
    frontend = _public_frontend_base()
    if error:
        return RedirectResponse(url=f"{frontend}/login?error={quote_plus(error)}")
    if not code or not state:
        return RedirectResponse(url=f"{frontend}/login?error={quote_plus('missing_oauth_params')}")

    await db.oauth_states.delete_many({"expires_at": {"$lt": datetime.now(timezone.utc)}})
    st = await db.oauth_states.find_one_and_delete({"state": state})
    if not st:
        return RedirectResponse(url=f"{frontend}/login?error={quote_plus('invalid_or_expired_state')}")

    redirect_uri = _google_oauth_redirect_uri(request)
    try:
        token_payload = await _google_exchange_code(code, redirect_uri)
    except HTTPException as he:
        msg = he.detail if isinstance(he.detail, str) else "oauth_error"
        return RedirectResponse(url=f"{frontend}/login?error={quote_plus(msg)}")
    access = token_payload.get("access_token")
    if not access:
        return RedirectResponse(url=f"{frontend}/login?error={quote_plus('no_access_token')}")

    try:
        info = await _google_fetch_userinfo(access)
    except Exception as e:
        return RedirectResponse(url=f"{frontend}/login?error={quote_plus(str(e))}")

    email = (info.get("email") or "").strip()
    name = (info.get("name") or "").strip()
    picture = (info.get("picture") or "").strip()

    try:
        payload = await _finalize_google_profile_login(None, email, name, picture)
    except HTTPException as he:
        detail = he.detail if isinstance(he.detail, str) else "forbidden"
        return RedirectResponse(url=f"{frontend}/login?error={quote_plus(detail)}")

    session_token = payload["session_token"]
    exch = secrets.token_urlsafe(48)
    await db.oauth_exchange_tokens.delete_many({"expires_at": {"$lt": datetime.now(timezone.utc)}})
    await db.oauth_exchange_tokens.insert_one(
        {
            "token": exch,
            "session_token": session_token,
            "expires_at": datetime.now(timezone.utc) + timedelta(minutes=8),
        }
    )

    return RedirectResponse(url=f"{frontend}/login#exchange={exch}")


@router.post("/google/finish")
async def google_oauth_finish(body: GoogleFinishBody, response: Response):
    """Exchange one-time token from URL hash for session cookie + JSON (cross-site SPA)."""
    raw = (body.exchange_token or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Missing exchange token.")

    await db.oauth_exchange_tokens.delete_many({"expires_at": {"$lt": datetime.now(timezone.utc)}})
    doc = await db.oauth_exchange_tokens.find_one_and_delete({"token": raw})
    if not doc:
        raise HTTPException(status_code=400, detail="Invalid or expired sign-in. Please try Google sign-in again.")

    session_token = doc.get("session_token")
    if not session_token:
        raise HTTPException(status_code=400, detail="Invalid sign-in payload.")

    sess = await db.sessions.find_one({"token": session_token})
    if not sess:
        raise HTTPException(status_code=400, detail="Session expired. Please sign in again.")

    exp = _parse_session_expires_at(sess)
    if exp and exp < datetime.now(timezone.utc):
        await db.sessions.delete_one({"token": session_token})
        raise HTTPException(status_code=400, detail="Session expired. Please sign in again.")

    user = await db.users.find_one({"id": sess["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=400, detail="User record missing.")

    response.set_cookie(
        key="session_token",
        value=session_token,
        path="/",
        httponly=True,
        secure=True,
        samesite="none",
        max_age=int((exp - datetime.now(timezone.utc)).total_seconds()) if exp else 60 * 60 * 24 * 7,
    )

    return {
        "message": "Authenticated",
        "session_token": session_token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user.get("role", "student"),
            "tier": user.get("tier", 1),
            "picture": user.get("picture"),
        },
    }


@router.post("/google")
async def google_auth_legacy(_: AuthSessionStart):
    """
    Legacy Emergent-hosted OAuth exchange — removed. Use GET /api/auth/google/start from the login page.
    """
    raise HTTPException(
        status_code=410,
        detail="Sign-in was updated. Close this tab and use “Continue with Google” on the Divine Iris login page again.",
    )


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
