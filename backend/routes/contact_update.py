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


async def _verify_admin_password(password: str) -> None:
    settings = await db.site_settings.find_one({"id": "site_settings"}, {"_id": 0, "admin_password": 1})
    stored = (settings or {}).get("admin_password", "divineadmin2024")
    if password != stored:
        raise HTTPException(status_code=401, detail="Invalid admin password")


class CreateLinkBody(BaseModel):
    admin_password: str
    label: str = ""


class AdminPasswordBody(BaseModel):
    admin_password: str


class SubmitBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr


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
    if not name or not email:
        raise HTTPException(status_code=400, detail="Name and email are required.")

    sub_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    row = {
        "id": sub_id,
        "token": token,
        "link_label": doc.get("label") or "",
        "name": name,
        "email": email,
        "created_at": now,
    }
    await db.contact_update_submissions.insert_one(row)

    existing = await db.clients.find_one({"email": email})
    if existing:
        await db.clients.update_one(
            {"id": existing["id"]},
            {"$set": {"name": name, "updated_at": now}},
        )

    return {"success": True, "message": "Thank you — your details have been saved."}


@admin_router.post("/links")
async def admin_create_link(body: CreateLinkBody):
    await _verify_admin_password(body.admin_password)
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


@admin_router.post("/links/list")
async def admin_list_links(body: AdminPasswordBody):
    await _verify_admin_password(body.admin_password)
    items = await db.contact_update_links.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


@admin_router.post("/links/deactivate")
async def admin_deactivate_link(body: dict):
    await _verify_admin_password(body.get("admin_password") or "")
    token = (body.get("token") or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="token required")
    await db.contact_update_links.update_one({"token": token}, {"$set": {"active": False}})
    return {"ok": True}


@admin_router.post("/submissions/list")
async def admin_list_submissions(body: AdminPasswordBody):
    await _verify_admin_password(body.admin_password)
    items = await db.contact_update_submissions.find({}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    return items


@admin_router.post("/submissions/export")
async def admin_export_submissions_csv(body: AdminPasswordBody):
    await _verify_admin_password(body.admin_password)
    items = await db.contact_update_submissions.find({}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["created_at", "name", "email", "link_label", "token", "submission_id"])
    for it in items:
        w.writerow(
            [
                it.get("created_at") or "",
                it.get("name") or "",
                it.get("email") or "",
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
