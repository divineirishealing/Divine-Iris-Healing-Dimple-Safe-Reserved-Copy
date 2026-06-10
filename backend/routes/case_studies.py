from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import re

from models import CaseStudy, CaseStudyCreate, CaseStudyStep

router = APIRouter(prefix="/api/case-studies", tags=["Case Studies"])


def get_db():
    from server import db
    return db


def _slugify(text: str) -> str:
    s = (text or "").lower().strip()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[\s_-]+", "-", s)
    return s.strip("-") or str(uuid.uuid4())[:8]


def _doc_to_case_study(raw: dict) -> CaseStudy:
    data = {k: v for k, v in raw.items() if k != "_id"}
    steps = data.get("timeline") or []
    data["timeline"] = [CaseStudyStep(**s) if isinstance(s, dict) else s for s in steps]
    return CaseStudy(**data)


@router.get("", response_model=List[CaseStudy])
async def list_case_studies(
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
            {"subtitle": {"$regex": q, "$options": "i"}},
            {"summary": {"$regex": q, "$options": "i"}},
            {"client_name": {"$regex": q, "$options": "i"}},
        ]
    docs = await db.case_studies.find(query, {"_id": 0}).sort("order", 1).to_list(100)
    return [_doc_to_case_study(d) for d in docs]


@router.get("/slug/{slug}", response_model=CaseStudy)
async def get_case_study_by_slug(slug: str, visible_only: bool = Query(True)):
    db = get_db()
    query = {"slug": slug}
    if visible_only:
        query["visible"] = True
    doc = await db.case_studies.find_one(query, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Case study not found")
    return _doc_to_case_study(doc)


@router.get("/{case_study_id}", response_model=CaseStudy)
async def get_case_study(case_study_id: str):
    db = get_db()
    doc = await db.case_studies.find_one({"id": case_study_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Case study not found")
    return _doc_to_case_study(doc)


@router.post("", response_model=CaseStudy)
async def create_case_study(data: CaseStudyCreate):
    db = get_db()
    payload = data.model_dump(exclude_unset=True)
    if not payload.get("slug"):
        payload["slug"] = _slugify(payload.get("title") or payload.get("client_name") or "case-study")
    existing = await db.case_studies.find_one({"slug": payload["slug"]})
    if existing:
        payload["slug"] = f"{payload['slug']}-{str(uuid.uuid4())[:6]}"
    count = await db.case_studies.count_documents({})
    obj = CaseStudy(**payload, order=payload.get("order", count))
    doc = obj.model_dump()
    await db.case_studies.insert_one(doc)
    return obj


@router.put("/{case_study_id}", response_model=CaseStudy)
async def update_case_study(case_study_id: str, data: CaseStudyCreate):
    db = get_db()
    existing = await db.case_studies.find_one({"id": case_study_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Case study not found")
    payload = data.model_dump(exclude_unset=True)
    if payload.get("slug"):
        clash = await db.case_studies.find_one({"slug": payload["slug"], "id": {"$ne": case_study_id}})
        if clash:
            raise HTTPException(status_code=400, detail="Slug already in use")
    payload["updated_at"] = datetime.now(timezone.utc)
    await db.case_studies.update_one({"id": case_study_id}, {"$set": payload})
    doc = await db.case_studies.find_one({"id": case_study_id}, {"_id": 0})
    return _doc_to_case_study(doc)


@router.patch("/{case_study_id}/visibility")
async def toggle_visibility(case_study_id: str, body: dict):
    db = get_db()
    visible = bool(body.get("visible", True))
    result = await db.case_studies.update_one({"id": case_study_id}, {"$set": {"visible": visible}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Case study not found")
    return {"visible": visible}


@router.delete("/{case_study_id}")
async def delete_case_study(case_study_id: str):
    db = get_db()
    result = await db.case_studies.delete_one({"id": case_study_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Case study not found")
    return {"message": "Deleted"}


@router.post("/seed/meghavi")
async def seed_meghavi_case_study(replace: bool = Query(False)):
    """Seed the Meghavi Makhecha case study (admin setup)."""
    from case_study_seed import MEGHAVI_CASE_STUDY

    db = get_db()
    slug = MEGHAVI_CASE_STUDY["slug"]
    existing = await db.case_studies.find_one({"slug": slug})
    if existing and not replace:
        return {"message": "Already exists", "id": existing["id"], "slug": slug}
    if existing and replace:
        await db.case_studies.delete_one({"slug": slug})
    doc = {**MEGHAVI_CASE_STUDY, "created_at": datetime.now(timezone.utc)}
    await db.case_studies.insert_one(doc)
    return {"message": "Seeded", "id": doc["id"], "slug": slug}
