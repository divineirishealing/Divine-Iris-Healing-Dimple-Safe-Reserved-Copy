"""Public contact-update forms (shareable links) and admin export."""

import csv
import io
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Response
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
mongo_client = AsyncIOMotorClient(mongo_url)
db = mongo_client[os.environ["DB_NAME"]]

public_router = APIRouter(prefix="/api/contact-update", tags=["Contact Update"])
admin_router = APIRouter(prefix="/api/admin/contact-update", tags=["Admin Contact Update"])


class CreateLinkBody(BaseModel):
    label: str = ""
    # When True, submit also ensures Client Garden + portal user and returns a session (dashboard).
    grant_dashboard_access: bool = True


class DeactivateBody(BaseModel):
    token: str


class SubmitBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr
    phone: str = Field(..., min_length=1, max_length=80)
    city: str = Field(..., min_length=1, max_length=120)
    country: str = Field(..., min_length=1, max_length=120)


def _tier_from_label(label: str) -> int:
    tier_map = {
        "Dew": 1,
        "Seed": 1,
        "Root": 2,
        "Bloom": 2,
        "Iris": 4,
        "Purple Bees": 4,
        "Iris Bees": 4,
    }
    return tier_map.get(label or "Dew", 1)


async def _ensure_client_for_contact(
    email: str, name: str, phone: str, city: str, country: str, now: str
) -> dict:
    existing = await db.clients.find_one({"email": email}, {"_id": 0})
    if existing:
        await db.clients.update_one(
            {"id": existing["id"]},
            {
                "$set": {
                    "name": name,
                    "phone": phone,
                    "city": city,
                    "country": country,
                    "updated_at": now,
                }
            },
        )
        u = await db.clients.find_one({"id": existing["id"]}, {"_id": 0})
        return u or existing
    cid = str(uuid.uuid4())
    did = f"DID-{str(uuid.uuid4())[:8].upper()}"
    client_doc = {
        "id": cid,
        "did": did,
        "email": email,
        "name": name,
        "phone": phone,
        "city": city,
        "country": country,
        "label": "Dew",
        "label_manual": "",
        "sources": ["Contact update link"],
        "conversions": [],
        "timeline": [{"type": "Contact update link", "detail": "Submitted contact details", "date": now}],
        "notes": "",
        "created_at": now,
        "updated_at": now,
    }
    await db.clients.insert_one(client_doc)
    return client_doc


async def _ensure_user_for_contact(client_doc: dict, email: str, name: str, now: str) -> dict:
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if user:
        await db.users.update_one({"id": user["id"]}, {"$set": {"name": name, "updated_at": now}})
        return await db.users.find_one({"id": user["id"]}, {"_id": 0})
    label = client_doc.get("label", "Dew")
    tier = _tier_from_label(label)
    uid = str(uuid.uuid4())
    new_user = {
        "id": uid,
        "email": email,
        "name": name,
        "picture": "",
        "role": "student",
        "tier": tier,
        "client_id": client_doc.get("id"),
        "created_at": now,
        "updated_at": now,
        "is_active": True,
        "created_via": "contact_update_link",
    }
    await db.users.insert_one(new_user)
    return new_user


@public_router.get("/{token}")
async def get_link_meta(token: str):
    doc = await db.contact_update_links.find_one({"token": token, "active": True}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="This link is invalid or no longer active.")
    grant = doc.get("grant_dashboard_access")
    if grant is None:
        grant = True
    return {"ok": True, "label": doc.get("label") or "", "grant_dashboard_access": bool(grant)}


@public_router.post("/{token}")
async def submit_contact_update(token: str, body: SubmitBody, response: Response):
    doc = await db.contact_update_links.find_one({"token": token, "active": True})
    if not doc:
        raise HTTPException(status_code=404, detail="This link is invalid or no longer active.")
    name = body.name.strip()
    email = str(body.email).strip().lower()
    phone = body.phone.strip()
    city = body.city.strip()
    country = body.country.strip()
    if not name or not email:
        raise HTTPException(status_code=400, detail="Name and email are required.")
    if not phone or not city or not country:
        raise HTTPException(status_code=400, detail="Phone, city, and country are required.")

    grant_dash = doc.get("grant_dashboard_access")
    if grant_dash is None:
        grant_dash = True

    sub_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    row = {
        "id": sub_id,
        "token": token,
        "link_label": doc.get("label") or "",
        "name": name,
        "email": email,
        "phone": phone,
        "city": city,
        "country": country,
        "created_at": now,
        "dashboard_access_granted": False,
    }
    await db.contact_update_submissions.insert_one(row)

    if not grant_dash:
        existing = await db.clients.find_one({"email": email})
        if existing:
            await db.clients.update_one(
                {"id": existing["id"]},
                {
                    "$set": {
                        "name": name,
                        "phone": phone,
                        "city": city,
                        "country": country,
                        "updated_at": now,
                    }
                },
            )
        return {
            "success": True,
            "message": "Thank you — your details have been saved.",
            "dashboard_access": False,
        }

    client_doc = await _ensure_client_for_contact(email, name, phone, city, country, now)
    user = await _ensure_user_for_client(client_doc, email, name, now)

    session_token = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.sessions.insert_one(
        {
            "token": session_token,
            "user_id": user["id"],
            "email": email,
            "created_at": now,
            "expires_at": expires_at.isoformat(),
            "via_contact_update": True,
            "contact_update_submission_id": sub_id,
        }
    )

    await db.contact_update_submissions.update_one(
        {"id": sub_id},
        {"$set": {"dashboard_access_granted": True}},
    )

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
        "success": True,
        "message": "Welcome — you're signed in.",
        "dashboard_access": True,
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


@admin_router.post("/links")
async def admin_create_link(body: CreateLinkBody):
    token = uuid.uuid4().hex
    await db.contact_update_links.insert_one(
        {
            "token": token,
            "label": (body.label or "").strip(),
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "grant_dashboard_access": bool(body.grant_dashboard_access),
        }
    )
    return {"token": token, "path": f"/update-contact/{token}"}


@admin_router.get("/links")
async def admin_list_links():
    items = await db.contact_update_links.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


@admin_router.post("/links/deactivate")
async def admin_deactivate_link(body: DeactivateBody):
    token = (body.token or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="token required")
    await db.contact_update_links.update_one({"token": token}, {"$set": {"active": False}})
    return {"ok": True}


@admin_router.get("/submissions")
async def admin_list_submissions():
    items = await db.contact_update_submissions.find({}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    return items


@admin_router.get("/submissions/export")
async def admin_export_submissions_csv():
    items = await db.contact_update_submissions.find({}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(
        [
            "created_at",
            "name",
            "email",
            "phone",
            "city",
            "country",
            "link_label",
            "token",
            "submission_id",
            "dashboard_access_granted",
        ]
    )
    for it in items:
        w.writerow(
            [
                it.get("created_at") or "",
                it.get("name") or "",
                it.get("email") or "",
                it.get("phone") or "",
                it.get("city") or "",
                it.get("country") or "",
                it.get("link_label") or "",
                it.get("token") or "",
                it.get("id") or "",
                "yes" if it.get("dashboard_access_granted") else "no",
            ]
        )
    return Response(
        content="\ufeff" + buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="contact-update-submissions.csv"'},
    )
