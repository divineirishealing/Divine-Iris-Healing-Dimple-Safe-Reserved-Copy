from fastapi import APIRouter, HTTPException
from models import Testimonial, TestimonialCreate
from typing import List, Optional, Any
import os, re, json
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/api/testimonials", tags=["Testimonials"])


def _coerce_url_list(val: Any) -> List[str]:
    """Mongo or imports may store photos as a list, a JSON string, or a single URL string."""
    if val is None:
        return []
    if isinstance(val, list):
        out: List[str] = []
        for x in val:
            if x is None:
                continue
            if isinstance(x, str):
                s = x.strip()
                if s:
                    out.append(s)
            elif isinstance(x, dict):
                u = str(x.get("url") or x.get("secure_url") or "").strip()
                if u:
                    out.append(u)
            else:
                s = str(x).strip()
                if s and (s.startswith("http") or s.startswith("/") or s.startswith("data:")):
                    out.append(s)
        return out
    if isinstance(val, dict):
        keys = [k for k in val.keys() if str(k).isdigit()]
        if keys:
            keys_sorted = sorted(keys, key=lambda k: int(str(k)))
            return _coerce_url_list([val[k] for k in keys_sorted])
        u = str(val.get("url") or val.get("secure_url") or "").strip()
        if u:
            return [u]
        return []
    if isinstance(val, str):
        s = val.strip()
        if not s:
            return []
        if s.startswith("["):
            try:
                j = json.loads(s)
                if isinstance(j, list):
                    return _coerce_url_list(j)
            except json.JSONDecodeError:
                pass
        return [s]
    return []


def _coerce_label_list(val: Any) -> List[str]:
    if val is None:
        return []
    if isinstance(val, list):
        return ["" if x is None else str(x) for x in val]
    if isinstance(val, str):
        s = val.strip()
        if s.startswith("["):
            try:
                j = json.loads(s)
                if isinstance(j, list):
                    return ["" if x is None else str(x) for x in j]
            except json.JSONDecodeError:
                pass
    return []


def _prepare_testimonial_write(data: dict) -> dict:
    """Normalize photos/labels; sync legacy image/before_image with photos for template (written) testimonials."""
    t = dict(data)
    typ = (t.get("type") or "graphic").strip().lower()
    photos = _coerce_url_list(t.get("photos"))
    labels = _coerce_label_list(t.get("photo_labels"))
    img = str(t.get("image") or "").strip()
    before = str(t.get("before_image") or "").strip()
    mode = (t.get("photo_mode") or "single").strip()

    if typ == "template":
        if not photos:
            if mode == "before_after" and before and img:
                photos = [before, img]
            elif img:
                photos = [img]
            elif before:
                photos = [before]

        if photos:
            if mode == "before_after" and len(photos) >= 2:
                t["before_image"] = photos[0]
                t["image"] = photos[1]
            elif mode == "progressive":
                t["image"] = photos[0] if photos else ""
                t["before_image"] = ""
            else:
                t["image"] = photos[0]
                t["before_image"] = ""

        if mode == "before_after" and len(photos) >= 2 and (not labels or all(x == "" for x in labels)):
            labels = ["Before", "After"]

    t["photos"] = photos
    t["photo_labels"] = labels
    return t


def _doc_to_testimonial(raw: dict) -> Testimonial:
    """Strip Mongo _id and coerce null / odd-shaped photo fields so the client always gets arrays + strings."""
    t = dict(raw)
    t.pop("_id", None)
    t["photos"] = _coerce_url_list(t.get("photos"))
    t["photo_labels"] = _coerce_label_list(t.get("photo_labels"))
    typ = (t.get("type") or "").strip().lower()
    # Template: backfill photos from legacy image fields; sync image/before_image from photos when missing
    if typ == "template":
        img = str(t.get("image") or "").strip()
        before = str(t.get("before_image") or "").strip()
        mode = (t.get("photo_mode") or "single").strip()
        if not t["photos"]:
            if mode == "before_after" and before and img:
                t["photos"] = [before, img]
            elif img:
                t["photos"] = [img]
            elif before:
                t["photos"] = [before]
        elif t["photos"]:
            if mode == "before_after" and len(t["photos"]) >= 2:
                if not before:
                    t["before_image"] = t["photos"][0]
                if not img:
                    t["image"] = t["photos"][1]
            elif mode == "progressive" and not img:
                t["image"] = t["photos"][0]
            elif not img:
                t["image"] = t["photos"][0]
    for key in ("program_tags", "session_tags"):
        v = t.get(key)
        if v is None:
            t[key] = []
        elif isinstance(v, list):
            t[key] = [str(x) for x in v if x is not None]
        else:
            t[key] = []
    for key in ("image", "before_image", "text", "name", "role", "program_name", "photo_mode"):
        if t.get(key) is None:
            t[key] = "" if key != "photo_mode" else "single"
    return Testimonial(**t)

def _derive_video_meta(data: dict) -> dict:
    """Derive videoId + thumbnail from video_url if not already set."""
    url = data.get("video_url", "")
    if url:
        yt = re.search(r"(?:youtube\.com/watch\?v=|youtu\.be/)([a-zA-Z0-9_-]{11})", url)
        if yt:
            data.setdefault("videoId", yt.group(1))
            if not data.get("thumbnail"):
                data["thumbnail"] = f"https://img.youtube.com/vi/{yt.group(1)}/maxresdefault.jpg"
    elif data.get("videoId") and not data.get("thumbnail"):
        data["thumbnail"] = f"https://img.youtube.com/vi/{data['videoId']}/maxresdefault.jpg"
    return data

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

@router.get("", response_model=List[Testimonial])
async def get_testimonials(
    type: Optional[str] = None,
    program_id: Optional[str] = None,
    program_name: Optional[str] = None,
    session_id: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    visible_only: Optional[bool] = None
):
    query = {}
    if type:
        query["type"] = type
    if program_id:
        query["$or"] = [
            {"program_id": program_id},
            {"program_tags": program_id},
        ]
    if program_name and not program_id:
        # Case-insensitive match on program_name field
        query["program_name"] = {"$regex": f"^{re.escape(program_name)}$", "$options": "i"}
    if session_id:
        query["session_tags"] = session_id
    if category:
        query["category"] = category
    if visible_only:
        query["visible"] = True
    if search:
        search_filter = [
            {"text": {"$regex": re.escape(search), "$options": "i"}},
            {"name": {"$regex": re.escape(search), "$options": "i"}},
            {"category": {"$regex": re.escape(search), "$options": "i"}},
            {"role": {"$regex": re.escape(search), "$options": "i"}}
        ]
        if "$or" in query:
            query["$and"] = [{"$or": query.pop("$or")}, {"$or": search_filter}]
        else:
            query["$or"] = search_filter
    testimonials = await db.testimonials.find(query).sort("order", 1).to_list(500)
    return [_doc_to_testimonial(t) for t in testimonials]

@router.get("/categories")
async def get_categories():
    categories = await db.testimonials.distinct("category", {"category": {"$ne": ""}})
    return sorted([c for c in categories if c])

@router.get("/{testimonial_id}", response_model=Testimonial)
async def get_testimonial(testimonial_id: str):
    t = await db.testimonials.find_one({"id": testimonial_id})
    if not t:
        raise HTTPException(status_code=404, detail="Testimonial not found")
    return _doc_to_testimonial(t)

def _testimonial_field_names() -> set:
    return set(Testimonial.model_fields.keys())


def _incoming_dict(t: TestimonialCreate, *, exclude_unset: bool = False) -> dict:
    """PUT uses exclude_unset so omitted JSON fields do not overwrite Mongo with model defaults."""
    return t.model_dump(exclude_unset=exclude_unset)


@router.post("", response_model=Testimonial)
async def create_testimonial(testimonial: TestimonialCreate):
    data = _incoming_dict(testimonial)
    data = _prepare_testimonial_write(data)
    data = _derive_video_meta(data)
    count = await db.testimonials.count_documents({})
    data.pop("order", None)
    testimonial_obj = Testimonial(**data, order=count)
    await db.testimonials.insert_one(testimonial_obj.model_dump())
    return testimonial_obj

@router.put("/{testimonial_id}", response_model=Testimonial)
async def update_testimonial(testimonial_id: str, testimonial: TestimonialCreate):
    existing = await db.testimonials.find_one({"id": testimonial_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Testimonial not found")
    merged = {**existing, **_incoming_dict(testimonial, exclude_unset=True)}
    merged.pop("_id", None)
    merged["id"] = testimonial_id
    merged = _prepare_testimonial_write(merged)
    merged = _derive_video_meta(merged)
    allowed = _testimonial_field_names()
    try:
        testimonial_obj = Testimonial(**{k: merged[k] for k in allowed if k in merged})
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    await db.testimonials.update_one({"id": testimonial_id}, {"$set": testimonial_obj.model_dump()})
    updated = await db.testimonials.find_one({"id": testimonial_id})
    return _doc_to_testimonial(updated)

@router.patch("/{testimonial_id}/visibility")
async def toggle_visibility(testimonial_id: str, data: dict):
    existing = await db.testimonials.find_one({"id": testimonial_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Testimonial not found")
    await db.testimonials.update_one({"id": testimonial_id}, {"$set": {"visible": data.get("visible", True)}})
    return {"message": "Visibility updated"}

@router.delete("/{testimonial_id}")
async def delete_testimonial(testimonial_id: str):
    result = await db.testimonials.delete_one({"id": testimonial_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Testimonial not found")
    return {"message": "Testimonial deleted successfully"}
