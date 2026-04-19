"""Public contact-update forms (shareable links) and admin export."""

import csv
import io
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
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


class DeactivateBody(BaseModel):
    token: str


class SubmitBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr
    phone: str = Field(..., min_length=1, max_length=80)
    city: str = Field(..., min_length=1, max_length=120)
    country: str = Field(..., min_length=1, max_length=120)


async def _upsert_client_from_contact_form(
    email: str, name: str, phone: str, city: str, country: str, now: str
) -> None:
    """Create or update Client Garden row. New contacts cannot use Google portal until admin sets portal_login_allowed."""
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
        return
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
        "portal_login_allowed": False,
    }
    await db.clients.insert_one(client_doc)


@public_router.get("/{token}")
async def get_link_meta(token: str):
    doc = await db.contact_update_links.find_one({"token": token, "active": True}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="This link is invalid or no longer active.")
    return {"ok": True, "label": doc.get("label") or ""}


@public_router.post("/{token}")
async def submit_contact_update(token: str, body: SubmitBody):
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

    now = datetime.now(timezone.utc).isoformat()
    link_label = doc.get("label") or ""

    existing_sub = await db.contact_update_submissions.find_one({"token": token, "email": email}, {"_id": 0})
    if existing_sub:
        await db.contact_update_submissions.update_one(
            {"token": token, "email": email},
            {
                "$set": {
                    "name": name,
                    "phone": phone,
                    "city": city,
                    "country": country,
                    "link_label": link_label,
                    "updated_at": now,
                }
            },
        )
    else:
        sub_id = str(uuid.uuid4())
        await db.contact_update_submissions.insert_one(
            {
                "id": sub_id,
                "token": token,
                "email": email,
                "name": name,
                "phone": phone,
                "city": city,
                "country": country,
                "link_label": link_label,
                "created_at": now,
                "updated_at": now,
            }
        )

    await _upsert_client_from_contact_form(email, name, phone, city, country, now)

    return {
        "success": True,
        "message": "Thank you — your details have been saved.",
        "dashboard_access": False,
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


def _sort_submissions_newest_first(items: list) -> list:
    def key_row(it: dict) -> str:
        return (it.get("updated_at") or it.get("created_at") or "") or ""

    return sorted(items, key=key_row, reverse=True)


@admin_router.get("/submissions")
async def admin_list_submissions():
    items = await db.contact_update_submissions.find({}, {"_id": 0}).to_list(5000)
    return _sort_submissions_newest_first(items)


@admin_router.get("/submissions/export")
async def admin_export_submissions_csv():
    items = await db.contact_update_submissions.find({}, {"_id": 0}).to_list(5000)
    items = _sort_submissions_newest_first(items)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(
        [
            "created_at",
            "updated_at",
            "name",
            "email",
            "phone",
            "city",
            "country",
            "link_label",
            "token",
            "submission_id",
        ]
    )
    for it in items:
        w.writerow(
            [
                it.get("created_at") or "",
                it.get("updated_at") or "",
                it.get("name") or "",
                it.get("email") or "",
                it.get("phone") or "",
                it.get("city") or "",
                it.get("country") or "",
                it.get("link_label") or "",
                it.get("token") or "",
                it.get("id") or "",
            ]
        )
    return Response(
        content="\ufeff" + buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="contact-update-submissions.csv"'},
    )
