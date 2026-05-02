"""
AWRP / client journey progress records (admin tools + student Sacred Home submit).

Stores structured snapshots (baseline, monthly, checkpoint) for holistic
tracking — not clinical; supports research-style aggregates and exports.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from pathlib import Path
import os
import re

from routes.auth import assert_admin_session_or_password
from routes.student import get_current_student_user
from utils.canonical_id import new_entity_id

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
_client = AsyncIOMotorClient(mongo_url)
db = _client[os.environ["DB_NAME"]]

router = APIRouter(prefix="/api/admin/intake-progress", tags=["Intake Progress"])
student_router = APIRouter(prefix="/api/student/journey-intake", tags=["Student Journey Intake"])

COLLECTION = "awrp_intake_progress"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class IntakeProgressFieldsShared(BaseModel):
    """Shared AWRP-style fields (admin create + student submit)."""

    client_id: Optional[str] = Field(None, max_length=64)
    phone: Optional[str] = Field(None, max_length=80)
    whatsapp: Optional[str] = Field(None, max_length=80)
    secondary_email: Optional[str] = Field(None, max_length=320)
    dob: Optional[str] = Field(None, max_length=32)
    city: Optional[str] = Field(None, max_length=120)
    profession: Optional[str] = Field(None, max_length=160)
    record_type: Literal["baseline", "monthly", "checkpoint"] = "baseline"
    period_month: Optional[str] = Field(None, max_length=7)  # YYYY-MM for monthly

    issues_physical: bool = False
    issues_mental: bool = False
    issues_emotional: bool = False
    issues_other_note: str = Field("", max_length=2000)
    issues_detail: str = Field("", max_length=8000)

    score_physical: int = Field(..., ge=1, le=5)
    score_mental: int = Field(..., ge=1, le=5)
    score_emotional: int = Field(..., ge=1, le=5)
    score_relational: int = Field(..., ge=1, le=5)
    score_spiritual: int = Field(..., ge=1, le=5)
    score_life_growth: Optional[int] = Field(None, ge=1, le=5)

    weight_kg: Optional[float] = None
    waist_in: Optional[float] = None
    clothing_size: str = Field("", max_length=80)
    health_issues_text: str = Field("", max_length=8000)
    cravings_habits: str = Field("", max_length=4000)
    past_actions: str = Field("", max_length=8000)
    primary_purpose: str = Field("", max_length=2000)
    heard_how: str = Field("", max_length=120)
    referral_name: str = Field("", max_length=200)


class IntakeProgressCreate(IntakeProgressFieldsShared):
    """Mirrors the public AWRP-style intake; all optional except identity + scores."""

    email: str = Field(..., max_length=320)
    full_name: str = Field(..., max_length=200)
    notes_internal: str = Field("", max_length=8000)


class StudentJourneySubmit(IntakeProgressFieldsShared):
    """Student Sacred Home submission; email comes from session, not the body."""

    full_name: Optional[str] = Field(None, max_length=200)


def _build_intake_doc(
    body: IntakeProgressFieldsShared,
    *,
    rid: str,
    now: str,
    email: str,
    full_name: str,
    client_id: Optional[str],
    notes_internal: str,
    submission_source: Optional[str] = None,
) -> Dict[str, Any]:
    em = email.strip().lower()
    doc: Dict[str, Any] = {
        "id": rid,
        "client_id": (client_id or "").strip() or None,
        "email": em,
        "full_name": full_name.strip(),
        "phone": (body.phone or "").strip() or None,
        "whatsapp": (body.whatsapp or "").strip() or None,
        "secondary_email": (body.secondary_email or "").strip().lower() or None,
        "dob": (body.dob or "").strip() or None,
        "city": (body.city or "").strip() or None,
        "profession": (body.profession or "").strip() or None,
        "record_type": body.record_type,
        "period_month": (body.period_month or "").strip() or None,
        "issues_physical": bool(body.issues_physical),
        "issues_mental": bool(body.issues_mental),
        "issues_emotional": bool(body.issues_emotional),
        "issues_other_note": body.issues_other_note.strip(),
        "issues_detail": body.issues_detail.strip(),
        "score_physical": body.score_physical,
        "score_mental": body.score_mental,
        "score_emotional": body.score_emotional,
        "score_relational": body.score_relational,
        "score_spiritual": body.score_spiritual,
        "score_life_growth": body.score_life_growth,
        "weight_kg": body.weight_kg,
        "waist_in": body.waist_in,
        "clothing_size": body.clothing_size.strip(),
        "health_issues_text": body.health_issues_text.strip(),
        "cravings_habits": body.cravings_habits.strip(),
        "past_actions": body.past_actions.strip(),
        "primary_purpose": body.primary_purpose.strip(),
        "heard_how": body.heard_how.strip(),
        "referral_name": body.referral_name.strip(),
        "notes_internal": (notes_internal or "").strip(),
        "created_at": now,
        "updated_at": now,
    }
    if submission_source:
        doc["submission_source"] = submission_source
    return doc


_PERIOD_MONTH_RE = re.compile(r"^\d{4}-\d{2}$")


class IntakeProgressPatch(BaseModel):
    """Partial update for practitioner notes or corrections."""

    client_id: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    city: Optional[str] = None
    profession: Optional[str] = None
    period_month: Optional[str] = None
    score_physical: Optional[int] = Field(None, ge=1, le=5)
    score_mental: Optional[int] = Field(None, ge=1, le=5)
    score_emotional: Optional[int] = Field(None, ge=1, le=5)
    score_relational: Optional[int] = Field(None, ge=1, le=5)
    score_spiritual: Optional[int] = Field(None, ge=1, le=5)
    score_life_growth: Optional[int] = Field(None, ge=1, le=5)
    health_issues_text: Optional[str] = None
    notes_internal: Optional[str] = None


@router.get("/records")
async def list_records(
    request: Request,
    email: Optional[str] = Query(None),
    client_id: Optional[str] = Query(None),
    record_type: Optional[str] = Query(None),
    limit: int = Query(80, ge=1, le=500),
    skip: int = Query(0, ge=0, le=10_000),
):
    await assert_admin_session_or_password(request, None)
    q: Dict[str, Any] = {}
    if email:
        q["email"] = email.strip().lower()
    if client_id:
        q["client_id"] = client_id.strip()
    if record_type:
        q["record_type"] = record_type.strip()
    cur = (
        db[COLLECTION]
        .find(q, {"_id": 0})
        .sort([("created_at", -1)])
        .skip(skip)
        .limit(limit)
    )
    items = await cur.to_list(limit)
    total = await db[COLLECTION].count_documents(q)
    return {"items": items, "total": total}


@router.post("/records")
async def create_record(request: Request, body: IntakeProgressCreate):
    await assert_admin_session_or_password(request, None)
    rid = new_entity_id()
    now = _now_iso()
    doc = _build_intake_doc(
        body,
        rid=rid,
        now=now,
        email=body.email,
        full_name=body.full_name,
        client_id=body.client_id,
        notes_internal=body.notes_internal,
    )
    await db[COLLECTION].insert_one(doc)
    return {"id": rid, "record": {k: v for k, v in doc.items() if k != "_id"}}


@router.get("/records/{record_id}")
async def get_record(request: Request, record_id: str):
    await assert_admin_session_or_password(request, None)
    doc = await db[COLLECTION].find_one({"id": record_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Record not found")
    return doc


@router.patch("/records/{record_id}")
async def patch_record(request: Request, record_id: str, body: IntakeProgressPatch):
    await assert_admin_session_or_password(request, None)
    existing = await db[COLLECTION].find_one({"id": record_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Record not found")
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        return {"ok": True, "id": record_id}
    updates["updated_at"] = _now_iso()
    await db[COLLECTION].update_one({"id": record_id}, {"$set": updates})
    doc = await db[COLLECTION].find_one({"id": record_id}, {"_id": 0})
    return doc


@router.get("/analytics/overview")
async def analytics_overview(request: Request, limit: int = Query(600, ge=50, le=5000)):
    await assert_admin_session_or_password(request, None)
    rows = await db[COLLECTION].find({}, {"_id": 0}).sort([("created_at", -1)]).limit(limit).to_list(limit)
    emails = {r.get("email") for r in rows if r.get("email")}
    # latest record per email (rows are newest-first; first seen wins)
    latest_by_email: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        em = r.get("email")
        if em and em not in latest_by_email:
            latest_by_email[em] = r

    def _avg(keys: List[str], docs: List[dict]) -> Dict[str, float]:
        out: Dict[str, float] = {}
        for k in keys:
            vals = [float(d[k]) for d in docs if d.get(k) is not None]
            out[k] = round(sum(vals) / len(vals), 2) if vals else 0.0
        return out

    keys = [
        "score_physical",
        "score_mental",
        "score_emotional",
        "score_relational",
        "score_spiritual",
    ]
    latest_list = list(latest_by_email.values())
    cohort_latest_avg = _avg(keys, latest_list)

    # monthly trend: group by period_month or created_at month
    by_month: Dict[str, List[dict]] = {}
    for r in rows:
        pm = (r.get("period_month") or "").strip()
        if not pm and r.get("created_at"):
            try:
                pm = str(r["created_at"])[:7]
            except Exception:
                pm = "unknown"
        if not pm:
            pm = "unknown"
        by_month.setdefault(pm, []).append(r)

    monthly_trend: List[Dict[str, Any]] = []
    for pm in sorted(by_month.keys()):
        chunk = by_month[pm]
        av = _avg(keys, chunk)
        monthly_trend.append({"month": pm, "count": len(chunk), **av})

    gentle_attention: List[Dict[str, str]] = []
    for r in rows[:200]:
        scores = [r.get(k) for k in keys if isinstance(r.get(k), (int, float))]
        if scores and min(int(s) for s in scores) <= 2:
            gentle_attention.append(
                {
                    "email": r.get("email") or "",
                    "name": r.get("full_name") or "",
                    "record_id": r.get("id") or "",
                    "record_type": r.get("record_type") or "",
                    "created_at": r.get("created_at") or "",
                }
            )

    baselines = [r for r in rows if r.get("record_type") == "baseline"]
    first_baseline: Dict[str, dict] = {}
    for r in reversed(rows):  # oldest first within slice
        em = r.get("email")
        if em and r.get("record_type") == "baseline" and em not in first_baseline:
            first_baseline[em] = r

    transformation_hints: List[Dict[str, Any]] = []
    for em, latest in latest_by_email.items():
        base = first_baseline.get(em)
        if not base or base.get("id") == latest.get("id"):
            continue
        deltas = {}
        for k in keys:
            try:
                b = int(base.get(k) or 0)
                ln = int(latest.get(k) or 0)
                if b and ln:
                    deltas[k] = ln - b
            except (TypeError, ValueError):
                pass
        if deltas:
            transformation_hints.append(
                {
                    "email": em,
                    "name": latest.get("full_name"),
                    "baseline_at": base.get("created_at"),
                    "latest_at": latest.get("created_at"),
                    "deltas": deltas,
                }
            )

    return {
        "total_snapshots": len(rows),
        "distinct_emails": len(emails),
        "cohort_latest_avg": cohort_latest_avg,
        "monthly_trend": monthly_trend[-24:],  # cap
        "gentle_attention": gentle_attention[:40],
        "transformation_hints": transformation_hints[:60],
    }


@router.get("/analytics/client")
async def analytics_client(request: Request, email: str = Query(..., min_length=3, max_length=320)):
    await assert_admin_session_or_password(request, None)
    em = email.strip().lower()
    rows = (
        await db[COLLECTION]
        .find({"email": em}, {"_id": 0})
        .sort([("created_at", 1)])
        .to_list(500)
    )
    return {"email": em, "timeline": rows}


@student_router.get("/status")
async def student_journey_intake_status(user: dict = Depends(get_current_student_user)):
    em = (user.get("email") or "").strip().lower()
    if not em:
        raise HTTPException(status_code=400, detail="Account email is missing for this session.")
    baseline = await db[COLLECTION].find_one(
        {"email": em, "record_type": "baseline"},
        {"_id": 0, "id": 1, "created_at": 1},
    )
    latest = await db[COLLECTION].find_one({"email": em}, {"_id": 0}, sort=[("created_at", -1)])
    return {
        "has_baseline": baseline is not None,
        "baseline_submitted_at": baseline.get("created_at") if baseline else None,
        "baseline_id": baseline.get("id") if baseline else None,
        "latest_record_id": latest.get("id") if latest else None,
        "latest_created_at": latest.get("created_at") if latest else None,
        "latest_record_type": latest.get("record_type") if latest else None,
    }


@student_router.post("/submit")
async def student_journey_intake_submit(
    body: StudentJourneySubmit,
    user: dict = Depends(get_current_student_user),
):
    em = (user.get("email") or "").strip().lower()
    if not em:
        raise HTTPException(status_code=400, detail="Account email is missing for this session.")

    display = (body.full_name or "").strip() or (user.get("name") or "").strip()
    if not display:
        raise HTTPException(
            status_code=400,
            detail="Please enter the name you wish us to use, or set your name on Profile first.",
        )

    has_base = await db[COLLECTION].find_one({"email": em, "record_type": "baseline"}, {"_id": 0, "id": 1})

    if not has_base:
        payload = body.model_copy(update={"record_type": "baseline", "period_month": None})
    else:
        rt = body.record_type
        if rt == "baseline":
            raise HTTPException(
                status_code=409,
                detail="Your opening reflection is already held here. Choose monthly tending or a checkpoint, or contact the team if you need a correction.",
            )
        if rt == "monthly":
            pm = (body.period_month or "").strip()
            if not _PERIOD_MONTH_RE.match(pm):
                raise HTTPException(
                    status_code=400,
                    detail="For monthly tending, enter the rhythm month as YYYY-MM (for example 2026-04).",
                )
            dup = await db[COLLECTION].find_one(
                {"email": em, "record_type": "monthly", "period_month": pm},
                {"_id": 0, "id": 1},
            )
            if dup:
                raise HTTPException(
                    status_code=409,
                    detail="You already submitted a monthly check-in for that month.",
                )
        payload = body.model_copy(update={"record_type": rt})

    rid = new_entity_id()
    now = _now_iso()
    cid = (str(user.get("client_id") or "").strip() or str(body.client_id or "").strip() or None)
    doc = _build_intake_doc(
        payload,
        rid=rid,
        now=now,
        email=em,
        full_name=display,
        client_id=cid,
        notes_internal="",
        submission_source="dashboard_student",
    )
    await db[COLLECTION].insert_one(doc)
    return {"id": rid, "ok": True, "record_type": doc["record_type"]}
