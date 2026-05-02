"""
AWRP / client journey progress records (admin tools + student Sacred Home submit).

Stores structured snapshots for holistic tracking — supports cadence-tagged
rhythm reflections (monthly / quarterly / 6-month / year), checkpoints, and
lightweight aha-moment logs. Scores use 0–10 (new); legacy rows may use 1–5.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional, Union

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from pathlib import Path
import os
import re

from routes.auth import assert_admin_session_or_password
from routes.student import get_current_student_user, _profile_snapshot_for_prefill
from utils.canonical_id import new_entity_id

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
_client = AsyncIOMotorClient(mongo_url)
db = _client[os.environ["DB_NAME"]]

router = APIRouter(prefix="/api/admin/intake-progress", tags=["Intake Progress"])
student_router = APIRouter(prefix="/api/student/journey-intake", tags=["Student Journey Intake"])

COLLECTION = "awrp_intake_progress"

RecordType = Literal[
    "baseline",
    "monthly",
    "quarterly",
    "six_month",
    "yearly",
    "checkpoint",
    "aha_moment",
]
RhythmCadence = Literal["monthly", "quarterly", "six_month", "yearly"]
ExperienceCategory = Literal["relationships", "finances", "health", "self_evolution", "other"]

SCORE_KEYS_5 = [
    "score_physical",
    "score_mental",
    "score_emotional",
    "score_relational",
    "score_spiritual",
]
SCORE_KEYS_7 = SCORE_KEYS_5 + ["score_financial", "score_other_areas"]

NARRATIVE_PAIRS = [
    ("issues_physical", "narrative_physical", "Physical"),
    ("issues_mental", "narrative_mental", "Mental"),
    ("issues_emotional", "narrative_emotional", "Emotional"),
    ("issues_relational", "narrative_relational", "Relational"),
    ("issues_spiritual", "narrative_spiritual", "Spiritual"),
    ("issues_financial", "narrative_financial", "Financial"),
    ("issues_other_areas", "narrative_other_areas", "Other areas"),
]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _is_legacy_1_5_row(r: dict) -> bool:
    if (r.get("score_scale") or "") == "0_10":
        return False
    vals = [r.get(k) for k in SCORE_KEYS_5 if r.get(k) is not None]
    if not vals:
        return True
    try:
        return max(int(x) for x in vals) <= 5
    except (TypeError, ValueError):
        return True


def _gentle_threshold_for_row(r: dict) -> int:
    """Integer scores <= this value (inclusive) count as asking for gentleness."""
    return 2 if _is_legacy_1_5_row(r) else 3


def _period_bucket_for_row(r: dict) -> str:
    b = (r.get("analysis_period_bucket") or "").strip()
    if b:
        return b
    pm = (r.get("period_month") or "").strip()
    if pm:
        return pm
    try:
        return str(r.get("created_at") or "")[:7] or "unknown"
    except Exception:
        return "unknown"


_PERIOD_MONTH_RE = re.compile(r"^\d{4}-\d{2}$")
_PERIOD_QUARTER_RE = re.compile(r"^\d{4}-Q[1-4]$")
_PERIOD_HALF_RE = re.compile(r"^\d{4}-H[1-2]$")
_PERIOD_YEAR_RE = re.compile(r"^\d{4}$")
_EXPERIENCE_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _validate_period_bucket(cadence: str, bucket: str) -> None:
    b = (bucket or "").strip()
    if cadence == "monthly" and not _PERIOD_MONTH_RE.match(b):
        raise HTTPException(status_code=400, detail="Monthly rhythm uses YYYY-MM (for example 2026-04).")
    if cadence == "quarterly" and not _PERIOD_QUARTER_RE.match(b):
        raise HTTPException(status_code=400, detail="Quarterly rhythm uses YYYY-Q1 … YYYY-Q4.")
    if cadence == "six_month" and not _PERIOD_HALF_RE.match(b):
        raise HTTPException(status_code=400, detail="Six-month rhythm uses YYYY-H1 or YYYY-H2.")
    if cadence == "yearly" and not _PERIOD_YEAR_RE.match(b):
        raise HTTPException(status_code=400, detail="Yearly rhythm uses YYYY.")


def _validate_narratives_for_checked_areas(body: "IntakeProgressFieldsCore") -> None:
    for flag_name, narr_name, label in NARRATIVE_PAIRS:
        if bool(getattr(body, flag_name, False)):
            text = (getattr(body, narr_name, "") or "").strip()
            if len(text) < 8:
                raise HTTPException(
                    status_code=400,
                    detail=f"You marked {label} as a tending area — please add a short narrative (at least a few words).",
                )


class IntakeProgressFieldsCore(BaseModel):
    """Journey snapshot fields (student + admin), without client_id."""

    phone: Optional[str] = Field(None, max_length=80)
    whatsapp: Optional[str] = Field(None, max_length=80)
    secondary_email: Optional[str] = Field(None, max_length=320)
    dob: Optional[str] = Field(None, max_length=32)
    city: Optional[str] = Field(None, max_length=120)
    profession: Optional[str] = Field(None, max_length=160)
    record_type: RecordType = "baseline"
    period_month: Optional[str] = Field(None, max_length=7)
    rhythm_cadence: Optional[RhythmCadence] = None
    analysis_period_bucket: Optional[str] = Field(None, max_length=24)

    issues_physical: bool = False
    issues_mental: bool = False
    issues_emotional: bool = False
    issues_relational: bool = False
    issues_spiritual: bool = False
    issues_financial: bool = False
    issues_other_areas: bool = False
    issues_other_note: str = Field("", max_length=2000)
    issues_detail: str = Field("", max_length=8000)

    narrative_physical: str = Field("", max_length=4000)
    narrative_mental: str = Field("", max_length=4000)
    narrative_emotional: str = Field("", max_length=4000)
    narrative_relational: str = Field("", max_length=4000)
    narrative_spiritual: str = Field("", max_length=4000)
    narrative_financial: str = Field("", max_length=4000)
    narrative_other_areas: str = Field("", max_length=4000)

    score_physical: int = Field(5, ge=0, le=10)
    score_mental: int = Field(5, ge=0, le=10)
    score_emotional: int = Field(5, ge=0, le=10)
    score_relational: int = Field(5, ge=0, le=10)
    score_spiritual: int = Field(5, ge=0, le=10)
    score_financial: int = Field(5, ge=0, le=10)
    score_other_areas: int = Field(5, ge=0, le=10)
    score_life_growth: Optional[int] = Field(None, ge=0, le=10)

    weight_kg: Optional[float] = None
    waist_in: Optional[float] = None
    clothing_size: str = Field("", max_length=80)
    health_issues_text: str = Field("", max_length=8000)
    cravings_habits: str = Field("", max_length=4000)
    past_actions: str = Field("", max_length=8000)
    primary_purpose: str = Field("", max_length=2000)
    heard_how: str = Field("", max_length=120)
    referral_name: str = Field("", max_length=200)
    experiences_aha_text: str = Field("", max_length=8000)
    # Calendar day when the experience happened (esp. aha_moment); distinct from created_at server timestamp
    experience_event_date: Optional[str] = Field(None, max_length=32)
    # Thematic bucket for aha / quick logs (student + admin)
    experience_category: Optional[ExperienceCategory] = None


class IntakeProgressFieldsShared(IntakeProgressFieldsCore):
    client_id: Optional[str] = Field(None, max_length=64)


class IntakeProgressCreate(IntakeProgressFieldsShared):
    """Admin-entered journey snapshot."""

    email: str = Field(..., max_length=320)
    full_name: str = Field(..., max_length=200)
    notes_internal: str = Field("", max_length=8000)


class StudentJourneySubmit(IntakeProgressFieldsCore):
    """Student Sacred Home body (no client_id; email from session)."""

    entry_kind: Literal["reflection", "aha"] = "reflection"
    full_name: Optional[str] = Field(None, max_length=200)


def _build_intake_doc(
    body: Union[IntakeProgressFieldsCore, IntakeProgressFieldsShared],
    *,
    rid: str,
    now: str,
    email: str,
    full_name: str,
    client_id: Optional[str],
    notes_internal: str,
    submission_source: Optional[str] = None,
    score_scale: str = "0_10",
) -> Dict[str, Any]:
    em = email.strip().lower()
    pm = (body.period_month or "").strip() or None
    apb = (body.analysis_period_bucket or "").strip() or None
    if not apb and pm:
        apb = pm
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
        "period_month": pm,
        "rhythm_cadence": body.rhythm_cadence,
        "analysis_period_bucket": apb,
        "issues_physical": bool(body.issues_physical),
        "issues_mental": bool(body.issues_mental),
        "issues_emotional": bool(body.issues_emotional),
        "issues_relational": bool(body.issues_relational),
        "issues_spiritual": bool(body.issues_spiritual),
        "issues_financial": bool(body.issues_financial),
        "issues_other_areas": bool(body.issues_other_areas),
        "issues_other_note": body.issues_other_note.strip(),
        "issues_detail": body.issues_detail.strip(),
        "narrative_physical": body.narrative_physical.strip(),
        "narrative_mental": body.narrative_mental.strip(),
        "narrative_emotional": body.narrative_emotional.strip(),
        "narrative_relational": body.narrative_relational.strip(),
        "narrative_spiritual": body.narrative_spiritual.strip(),
        "narrative_financial": body.narrative_financial.strip(),
        "narrative_other_areas": body.narrative_other_areas.strip(),
        "score_physical": body.score_physical,
        "score_mental": body.score_mental,
        "score_emotional": body.score_emotional,
        "score_relational": body.score_relational,
        "score_spiritual": body.score_spiritual,
        "score_financial": body.score_financial,
        "score_other_areas": body.score_other_areas,
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
        "experiences_aha_text": body.experiences_aha_text.strip(),
        "experience_event_date": (body.experience_event_date or "").strip() or None,
        "experience_category": body.experience_category,
        "notes_internal": (notes_internal or "").strip(),
        "score_scale": score_scale,
        "created_at": now,
        "updated_at": now,
    }
    if submission_source:
        doc["submission_source"] = submission_source
    return doc


class IntakeProgressPatch(BaseModel):
    """Partial update for practitioner notes or corrections."""

    client_id: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    city: Optional[str] = None
    profession: Optional[str] = None
    period_month: Optional[str] = None
    analysis_period_bucket: Optional[str] = None
    score_physical: Optional[int] = Field(None, ge=0, le=10)
    score_mental: Optional[int] = Field(None, ge=0, le=10)
    score_emotional: Optional[int] = Field(None, ge=0, le=10)
    score_relational: Optional[int] = Field(None, ge=0, le=10)
    score_spiritual: Optional[int] = Field(None, ge=0, le=10)
    score_financial: Optional[int] = Field(None, ge=0, le=10)
    score_other_areas: Optional[int] = Field(None, ge=0, le=10)
    score_life_growth: Optional[int] = Field(None, ge=0, le=10)
    health_issues_text: Optional[str] = None
    notes_internal: Optional[str] = None
    experience_event_date: Optional[str] = None
    experience_category: Optional[str] = None


async def _client_row_for_intake(client_id: Optional[str]) -> dict:
    if not client_id:
        return {}
    return await db.clients.find_one(
        {"id": client_id},
        {"_id": 0, "phone": 1, "phone_code": 1, "city": 1, "email": 1, "whatsapp": 1},
    ) or {}


def _student_contact_overlay(user: dict, client: dict) -> Dict[str, Any]:
    snap = _profile_snapshot_for_prefill(user, client)
    phone_n = (snap.get("phone") or "").strip()
    code = (
        str(user.get("phone_code") or "").strip()
        or str((client or {}).get("phone_code") or "").strip()
        or ""
    )
    wa = (
        str(user.get("whatsapp") or "").strip()
        or str((client or {}).get("whatsapp") or "").strip()
        or phone_n
    )
    sec = str(user.get("secondary_email") or "").strip()
    dob = (snap.get("date_of_birth") or str(user.get("date_of_birth") or "").strip())[:10]
    return {
        "phone": phone_n or None,
        "phone_code": code or None,
        "whatsapp": wa or None,
        "city": (snap.get("city") or "").strip() or None,
        "profession": (snap.get("profession") or "").strip() or None,
        "dob": dob or None,
        "secondary_email": sec.lower() if sec else None,
    }


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
    apb = (body.analysis_period_bucket or "").strip() or None
    pm = (body.period_month or "").strip() or None
    if not apb and pm:
        apb = pm
    body_adj = body.model_copy(update={"analysis_period_bucket": apb, "period_month": pm})
    doc = _build_intake_doc(
        body_adj,
        rid=rid,
        now=now,
        email=body.email,
        full_name=body.full_name,
        client_id=body.client_id,
        notes_internal=body.notes_internal,
        submission_source=None,
        score_scale="0_10",
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

    keys = list(SCORE_KEYS_7)

    latest_list = list(latest_by_email.values())
    cohort_latest_avg = _avg(keys, latest_list)

    by_bucket: Dict[str, List[dict]] = {}
    for r in rows:
        bk = _period_bucket_for_row(r)
        by_bucket.setdefault(bk, []).append(r)

    monthly_trend: List[Dict[str, Any]] = []
    for bk in sorted(by_bucket.keys()):
        chunk = by_bucket[bk]
        av = _avg(keys, chunk)
        monthly_trend.append({"month": bk, "count": len(chunk), **av})

    gentle_attention: List[Dict[str, str]] = []
    for r in rows[:200]:
        scores = [int(r[k]) for k in keys if isinstance(r.get(k), (int, float))]
        if not scores:
            continue
        thr = _gentle_threshold_for_row(r)
        if min(scores) <= thr:
            gentle_attention.append(
                {
                    "email": r.get("email") or "",
                    "name": r.get("full_name") or "",
                    "record_id": r.get("id") or "",
                    "record_type": r.get("record_type") or "",
                    "created_at": r.get("created_at") or "",
                }
            )

    first_baseline: Dict[str, dict] = {}
    for r in reversed(rows):
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
                if b or ln:
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
        "monthly_trend": monthly_trend[-36:],
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
    client = await _client_row_for_intake(user.get("client_id"))
    snap = _profile_snapshot_for_prefill(user, client)
    overlay = _student_contact_overlay(user, client)
    phone_display = ""
    if overlay.get("phone"):
        pc = overlay.get("phone_code") or ""
        phone_display = f"{pc} {overlay['phone']}".strip()
    profile_prefill = {
        "full_name": snap.get("name") or (user.get("name") or ""),
        "email": snap.get("email") or em,
        "phone_display": phone_display,
        "whatsapp": overlay.get("whatsapp") or "",
        "city": overlay.get("city") or "",
        "profession": overlay.get("profession") or "",
        "dob": overlay.get("dob") or snap.get("date_of_birth") or "",
        "secondary_email": overlay.get("secondary_email") or "",
    }
    return {
        "has_baseline": baseline is not None,
        "baseline_submitted_at": baseline.get("created_at") if baseline else None,
        "baseline_id": baseline.get("id") if baseline else None,
        "latest_record_id": latest.get("id") if latest else None,
        "latest_created_at": latest.get("created_at") if latest else None,
        "latest_record_type": latest.get("record_type") if latest else None,
        "profile_prefill": profile_prefill,
    }


def _rhythm_duplicate_query(em: str, record_type: str, bucket: str) -> Dict[str, Any]:
    return {
        "email": em,
        "record_type": record_type,
        "analysis_period_bucket": bucket,
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

    client = await _client_row_for_intake(user.get("client_id"))
    overlay = _student_contact_overlay(user, client)

    if body.entry_kind == "aha":
        txt = (body.experiences_aha_text or "").strip()
        if len(txt) < 12:
            raise HTTPException(
                status_code=400,
                detail="Please share your experience or aha moment in a few sentences (at least 12 characters).",
            )
        evd = (body.experience_event_date or "").strip()
        if not evd or not _EXPERIENCE_DATE_RE.match(evd):
            raise HTTPException(
                status_code=400,
                detail="Please choose the calendar date this experience refers to (YYYY-MM-DD).",
            )
        if not body.experience_category:
            raise HTTPException(
                status_code=400,
                detail="Please choose a category for this experience (Relationships, Finances, Health, Self evolution, or Other).",
            )
        payload = body.model_copy(
            update={
                "record_type": "aha_moment",
                "rhythm_cadence": None,
                "analysis_period_bucket": None,
                "period_month": None,
                "experience_event_date": evd,
                "experience_category": body.experience_category,
                "phone": overlay.get("phone") or body.phone,
                "whatsapp": overlay.get("whatsapp") or body.whatsapp,
                "city": overlay.get("city") or body.city,
                "profession": overlay.get("profession") or body.profession,
                "dob": overlay.get("dob") or body.dob,
                "secondary_email": overlay.get("secondary_email") or body.secondary_email,
            }
        )
    else:
        _validate_narratives_for_checked_areas(body)
        has_base = await db[COLLECTION].find_one({"email": em, "record_type": "baseline"}, {"_id": 0, "id": 1})

        if not has_base:
            payload = body.model_copy(
                update={
                    "record_type": "baseline",
                    "period_month": None,
                    "rhythm_cadence": None,
                    "analysis_period_bucket": None,
                    "phone": overlay.get("phone") or body.phone,
                    "whatsapp": overlay.get("whatsapp") or body.whatsapp,
                    "city": overlay.get("city") or body.city,
                    "profession": overlay.get("profession") or body.profession,
                    "dob": overlay.get("dob") or body.dob,
                    "secondary_email": overlay.get("secondary_email") or body.secondary_email,
                }
            )
        else:
            rt = body.record_type
            if rt == "baseline":
                raise HTTPException(
                    status_code=409,
                    detail="Your opening reflection is already held. Choose a rhythm (monthly, quarterly, six months, or year), a checkpoint, or an aha-moment note.",
                )
            if rt == "aha_moment":
                raise HTTPException(status_code=400, detail="Use the Aha & experiences tab for aha-moment entries.")
            if rt == "checkpoint":
                bucket = (body.analysis_period_bucket or "").strip() or None
                payload = body.model_copy(
                    update={
                        "record_type": "checkpoint",
                        "rhythm_cadence": None,
                        "analysis_period_bucket": bucket,
                        "period_month": bucket if bucket and _PERIOD_MONTH_RE.match(bucket) else None,
                        "phone": overlay.get("phone") or body.phone,
                        "whatsapp": overlay.get("whatsapp") or body.whatsapp,
                        "city": overlay.get("city") or body.city,
                        "profession": overlay.get("profession") or body.profession,
                        "dob": overlay.get("dob") or body.dob,
                        "secondary_email": overlay.get("secondary_email") or body.secondary_email,
                    }
                )
            elif rt in ("monthly", "quarterly", "six_month", "yearly"):
                cadence = str(rt)
                bucket = (body.analysis_period_bucket or "").strip()
                if not bucket:
                    raise HTTPException(status_code=400, detail="Choose the period label for this rhythm (for example 2026-04 or 2026-Q2).")
                _validate_period_bucket(cadence, bucket)
                dup = await db[COLLECTION].find_one(_rhythm_duplicate_query(em, rt, bucket), {"_id": 0, "id": 1})
                if dup:
                    raise HTTPException(
                        status_code=409,
                        detail="You already submitted a reflection for that period and cadence.",
                    )
                pm_val = bucket if cadence == "monthly" and _PERIOD_MONTH_RE.match(bucket) else None
                payload = body.model_copy(
                    update={
                        "record_type": rt,
                        "rhythm_cadence": cadence,
                        "analysis_period_bucket": bucket,
                        "period_month": pm_val,
                        "phone": overlay.get("phone") or body.phone,
                        "whatsapp": overlay.get("whatsapp") or body.whatsapp,
                        "city": overlay.get("city") or body.city,
                        "profession": overlay.get("profession") or body.profession,
                        "dob": overlay.get("dob") or body.dob,
                        "secondary_email": overlay.get("secondary_email") or body.secondary_email,
                    }
                )
            else:
                raise HTTPException(status_code=400, detail="Unsupported reflection type for this form.")

    rid = new_entity_id()
    now = _now_iso()
    cid = str(user.get("client_id") or "").strip() or None
    doc = _build_intake_doc(
        payload,
        rid=rid,
        now=now,
        email=em,
        full_name=display,
        client_id=cid,
        notes_internal="",
        submission_source="dashboard_student",
        score_scale="0_10",
    )
    await db[COLLECTION].insert_one(doc)
    return {"id": rid, "ok": True, "record_type": doc["record_type"]}
