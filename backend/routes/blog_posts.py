from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import re

from models import BlogPost, BlogPostCreate
from utils.docx_html import docx_html_document_body

router = APIRouter(prefix="/api/blog-posts", tags=["Blog Posts"])


def get_db():
    from server import db
    return db


def _slugify(text: str) -> str:
    s = (text or "").lower().strip()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[\s_-]+", "-", s)
    return s.strip("-") or str(uuid.uuid4())[:8]


def _doc_to_blog_post(raw: dict) -> BlogPost:
    data = {k: v for k, v in raw.items() if k != "_id"}
    return BlogPost(**data)


async def _parse_docx_upload(file: UploadFile) -> str:
    name = (file.filename or "").lower()
    if not name.endswith(".docx"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a .docx file (Word: Save As → Word Document .docx)",
        )
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="File is empty")
    if len(raw) > 15 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 15 MB)")
    try:
        return docx_html_document_body(raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read document: {exc}") from exc


@router.get("", response_model=List[BlogPost])
async def list_blog_posts(
    visible_only: bool = Query(False),
    featured_only: bool = Query(False),
    search: Optional[str] = Query(None),
):
    db = get_db()
    query = {}
    if visible_only:
        query["visible"] = True
    if featured_only:
        query["featured"] = True
    if search and search.strip():
        q = search.strip()
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"excerpt": {"$regex": q, "$options": "i"}},
            {"body": {"$regex": q, "$options": "i"}},
            {"author": {"$regex": q, "$options": "i"}},
        ]
    docs = await db.blog_posts.find(query, {"_id": 0}).sort(
        [("order", 1), ("published_at", -1), ("created_at", -1)]
    ).to_list(200)
    return [_doc_to_blog_post(d) for d in docs]


@router.get("/slug/{slug}", response_model=BlogPost)
async def get_blog_post_by_slug(slug: str, visible_only: bool = Query(True)):
    db = get_db()
    query = {"slug": slug}
    if visible_only:
        query["visible"] = True
    doc = await db.blog_posts.find_one(query, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Blog post not found")
    return _doc_to_blog_post(doc)


@router.get("/{post_id}", response_model=BlogPost)
async def get_blog_post(post_id: str):
    db = get_db()
    doc = await db.blog_posts.find_one({"id": post_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Blog post not found")
    return _doc_to_blog_post(doc)


@router.post("/import-docx")
async def import_docx_preview(file: UploadFile = File(...)):
    """Parse a .docx into styled HTML for the full article body (preview before save)."""
    body = await _parse_docx_upload(file)
    return {"body": body, "filename": file.filename or ""}


@router.post("/{post_id}/import-docx", response_model=BlogPost)
async def import_docx_for_post(post_id: str, file: UploadFile = File(...)):
    """Parse a .docx and save as the full article body on this blog post."""
    db = get_db()
    existing = await db.blog_posts.find_one({"id": post_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Blog post not found")
    body = await _parse_docx_upload(file)
    now = datetime.now(timezone.utc)
    await db.blog_posts.update_one(
        {"id": post_id},
        {
            "$set": {
                "body": body,
                "import_filename": file.filename or "",
                "import_at": now.isoformat(),
                "updated_at": now,
            }
        },
    )
    doc = await db.blog_posts.find_one({"id": post_id}, {"_id": 0})
    return _doc_to_blog_post(doc)


@router.post("", response_model=BlogPost)
async def create_blog_post(data: BlogPostCreate):
    db = get_db()
    payload = data.model_dump(exclude_unset=True)
    if not payload.get("slug"):
        payload["slug"] = _slugify(payload.get("title") or "blog-post")
    existing = await db.blog_posts.find_one({"slug": payload["slug"]})
    if existing:
        payload["slug"] = f"{payload['slug']}-{str(uuid.uuid4())[:6]}"
    if not payload.get("published_at"):
        payload["published_at"] = datetime.now(timezone.utc).date().isoformat()
    count = await db.blog_posts.count_documents({})
    obj = BlogPost(**payload, order=payload.get("order", count))
    doc = obj.model_dump()
    await db.blog_posts.insert_one(doc)
    return obj


@router.put("/{post_id}", response_model=BlogPost)
async def update_blog_post(post_id: str, data: BlogPostCreate):
    db = get_db()
    existing = await db.blog_posts.find_one({"id": post_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Blog post not found")
    payload = data.model_dump(exclude_unset=True)
    if payload.get("slug"):
        clash = await db.blog_posts.find_one({"slug": payload["slug"], "id": {"$ne": post_id}})
        if clash:
            raise HTTPException(status_code=400, detail="Slug already in use")
    payload["updated_at"] = datetime.now(timezone.utc)
    await db.blog_posts.update_one({"id": post_id}, {"$set": payload})
    doc = await db.blog_posts.find_one({"id": post_id}, {"_id": 0})
    return _doc_to_blog_post(doc)


@router.patch("/{post_id}/visibility")
async def toggle_visibility(post_id: str, body: dict):
    db = get_db()
    visible = bool(body.get("visible", True))
    result = await db.blog_posts.update_one({"id": post_id}, {"$set": {"visible": visible}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Blog post not found")
    return {"visible": visible}


@router.delete("/{post_id}")
async def delete_blog_post(post_id: str):
    db = get_db()
    result = await db.blog_posts.delete_one({"id": post_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Blog post not found")
    return {"message": "Deleted"}
