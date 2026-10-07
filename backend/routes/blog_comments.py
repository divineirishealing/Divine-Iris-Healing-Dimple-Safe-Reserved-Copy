"""Blog reader comments — public submit; admin approves before publish."""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from routes.auth import assert_admin_session_or_password

router = APIRouter(prefix="/api/blog-comments", tags=["Blog Comments"])

MAX_BODY_LEN = 4000
MAX_NAME_LEN = 120
MAX_EMAIL_LEN = 254


def get_db():
    from server import db

    return db


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _comments_enabled() -> bool:
    db = get_db()
    doc = await db.settings.find_one({}, {"_id": 0, "blog_comments_enabled": 1})
    return bool((doc or {}).get("blog_comments_enabled"))


def _strip_comment_body(text: str) -> str:
    s = (text or "").strip()
    s = re.sub(r"<[^>]+>", "", s)
    return s[:MAX_BODY_LEN]


class BlogCommentSubmit(BaseModel):
    post_slug: str
    author_name: str
    author_email: Optional[str] = ""
    body: str


class BlogCommentModerate(BaseModel):
    admin_note: Optional[str] = ""


def _public_comment(doc: dict) -> dict:
    return {
        "id": doc.get("id"),
        "post_slug": doc.get("post_slug"),
        "author_name": doc.get("author_name"),
        "body": doc.get("body"),
        "created_at": doc.get("created_at"),
    }


@router.get("/enabled")
async def blog_comments_enabled_flag():
    return {"enabled": await _comments_enabled()}


@router.get("/by-slug/{slug}")
async def list_approved_for_post(slug: str):
    """Public: approved comments only (newest last for natural reading order)."""
    if not await _comments_enabled():
        return []
    db = get_db()
    post = await db.blog_posts.find_one({"slug": slug, "visible": True}, {"_id": 0, "id": 1})
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")
    docs = await db.blog_comments.find(
        {"post_slug": slug, "status": "approved"},
        {"_id": 0},
    ).sort([("created_at", 1)]).to_list(500)
    return [_public_comment(d) for d in docs]


@router.post("")
async def submit_comment(data: BlogCommentSubmit):
    if not await _comments_enabled():
        raise HTTPException(status_code=403, detail="Comments are not open on the blog right now.")
    slug = (data.post_slug or "").strip()
    if not slug:
        raise HTTPException(status_code=400, detail="post_slug is required")
    name = (data.author_name or "").strip()[:MAX_NAME_LEN]
    body = _strip_comment_body(data.body)
    email = (data.author_email or "").strip().lower()[:MAX_EMAIL_LEN]
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    if len(body) < 2:
        raise HTTPException(status_code=400, detail="Please write a comment")

    db = get_db()
    post = await db.blog_posts.find_one({"slug": slug, "visible": True}, {"_id": 0, "id": 1, "title": 1})
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")

    doc: Dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "post_id": post.get("id"),
        "post_slug": slug,
        "post_title": (post.get("title") or "").strip(),
        "author_name": name,
        "author_email": email,
        "body": body,
        "status": "pending",
        "admin_note": "",
        "created_at": _now_iso(),
        "reviewed_at": None,
    }
    await db.blog_comments.insert_one(doc)
    doc.pop("_id", None)
    return {
        "ok": True,
        "message": "Thank you — your comment was received and will appear after review.",
        "id": doc["id"],
    }


@router.get("")
async def admin_list_comments(
    request: Request,
    status: Optional[str] = Query(None),
    post_slug: Optional[str] = Query(None),
):
    await assert_admin_session_or_password(request, None)
    db = get_db()
    query: Dict[str, Any] = {}
    st = (status or "").strip().lower()
    if st and st != "all":
        if st not in ("pending", "approved", "rejected"):
            raise HTTPException(status_code=400, detail="Invalid status filter")
        query["status"] = st
    if post_slug and post_slug.strip():
        query["post_slug"] = post_slug.strip()
    docs = await db.blog_comments.find(query, {"_id": 0}).sort(
        [("created_at", -1)]
    ).to_list(2000)
    return docs


@router.get("/pending-count")
async def admin_pending_count(request: Request):
    await assert_admin_session_or_password(request, None)
    db = get_db()
    n = await db.blog_comments.count_documents({"status": "pending"})
    return {"count": n}


@router.patch("/{comment_id}/approve")
async def approve_comment(comment_id: str, request: Request, body: BlogCommentModerate = BlogCommentModerate()):
    await assert_admin_session_or_password(request, None)
    db = get_db()
    note = (body.admin_note or "").strip()[:500]
    result = await db.blog_comments.update_one(
        {"id": comment_id},
        {
            "$set": {
                "status": "approved",
                "reviewed_at": _now_iso(),
                **({"admin_note": note} if note else {}),
            }
        },
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Comment not found")
    doc = await db.blog_comments.find_one({"id": comment_id}, {"_id": 0})
    return doc


@router.patch("/{comment_id}/reject")
async def reject_comment(comment_id: str, request: Request, body: BlogCommentModerate = BlogCommentModerate()):
    await assert_admin_session_or_password(request, None)
    db = get_db()
    note = (body.admin_note or "").strip()[:500]
    result = await db.blog_comments.update_one(
        {"id": comment_id},
        {
            "$set": {
                "status": "rejected",
                "reviewed_at": _now_iso(),
                **({"admin_note": note} if note else {}),
            }
        },
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Comment not found")
    doc = await db.blog_comments.find_one({"id": comment_id}, {"_id": 0})
    return doc


@router.delete("/{comment_id}")
async def delete_comment(comment_id: str, request: Request):
    await assert_admin_session_or_password(request, None)
    db = get_db()
    result = await db.blog_comments.delete_one({"id": comment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Comment not found")
    return {"ok": True}
