from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Tuple
import os
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from dotenv import load_dotenv
from pathlib import Path
from .auth import get_current_user
from models_extended import JourneyLog
from iris_journey import resolve_iris_journey

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/api/student", tags=["Student Dashboard"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

def _merge_global_schedule_into_programs(programs_list: List[dict], global_programs: List[dict]) -> List[dict]:
    """Attach dates from admin program schedule (same merge as subscribers sync)."""
    if not global_programs or not programs_list:
        return programs_list
    merged_out = []
    for local_prog in programs_list:
        gp = next((g for g in global_programs if g.get("name") == local_prog.get("name")), None)
        if not gp:
            merged_out.append(local_prog)
            continue
        old_sched = local_prog.get("schedule") or []
        old_sched_map = {
            (s.get("month") or s.get("session", 0)): s for s in old_sched
        }
        new_sched = []
        for gs in gp.get("schedule", []):
            key = gs.get("month") or gs.get("session", 0)
            old = old_sched_map.get(key, {})
            new_sched.append({**gs, "mode_choice": old.get("mode_choice", gs.get("mode_choice", ""))})
        merged_out.append({**local_prog, "schedule": new_sched})
    return merged_out


def _build_schedule_preview(programs_list: List[dict], limit: int = 8) -> List[dict]:
    """Next dated slots (not completed), today onward, for dashboard."""
    today = datetime.now(timezone.utc).date()
    rows = []
    for p in programs_list:
        pname = p.get("name") or ""
        schedule = p.get("schedule") or []
        for session_index, s in enumerate(schedule):
            raw = s.get("date")
            if not raw:
                continue
            ds = str(raw).strip()[:10]
            try:
                slot_date = datetime.strptime(ds, "%Y-%m-%d").date()
            except ValueError:
                continue
            if s.get("completed"):
                continue
            if slot_date < today:
                continue
            rows.append({
                "program_name": pname,
                "date": ds,
                "end_date": (str(s.get("end_date") or "").strip()[:10] or ""),
                "time": s.get("time") or "",
                "note": s.get("note") or "",
                "mode_choice": (s.get("mode_choice") or "").strip().lower(),
                "session_index": session_index,
            })
    rows.sort(key=lambda x: x["date"])
    return rows[:limit]


async def _raw_programs_from_subscription(sub: dict) -> List[dict]:
    """Same program list construction as /home before global schedule merge."""
    raw_programs = list(sub.get("programs_detail") or [])
    if not raw_programs:
        pkg_id = sub.get("package_id", "")
        pkg_config = await db.annual_packages.find_one({"package_id": pkg_id}, {"_id": 0}) if pkg_id else None
        simple_names = sub.get("programs") or []
        if pkg_config:
            for inc in pkg_config.get("included_programs", []):
                raw_programs.append({
                    "name": inc["name"],
                    "duration_value": inc.get("duration_value", 0),
                    "duration_unit": inc.get("duration_unit", "months"),
                    "start_date": sub.get("start_date", ""),
                    "end_date": sub.get("end_date", ""),
                    "status": "active"
                })
        else:
            for name in simple_names:
                raw_programs.append({
                    "name": name, "duration_value": 0, "duration_unit": "",
                    "start_date": "", "end_date": "", "status": "active"
                })
    return raw_programs


async def _merged_programs_list_for_client(client_doc: dict) -> List[dict]:
    sub = client_doc.get("subscription", {})
    programs_list = await _raw_programs_from_subscription(sub)
    sched_doc = await db.program_schedule.find_one({"id": "global"}, {"_id": 0})
    global_sched = sched_doc.get("programs", []) if sched_doc else []
    return _merge_global_schedule_into_programs(programs_list, global_sched)


def _sort_upcoming_for_dashboard(programs: List[dict]) -> List[dict]:
    """Soonest deadline/start first; trim for dashboard."""
    def sort_key(p):
        raw = p.get("deadline_date") or p.get("start_date") or ""
        return str(raw)
    rows = sorted(programs or [], key=sort_key)
    return rows[:12]


def _is_annual_subscriber(sub: dict, client: dict) -> bool:
    """Heuristic: annual program name, package, or program detail labels."""
    if (sub.get("annual_program") or "").strip():
        return True
    if sub.get("package_id"):
        return True
    for p in sub.get("programs_detail") or []:
        blob = f"{p.get('label', '')} {p.get('name', '')}".lower()
        if "annual" in blob or "year" in blob:
            return True
    return False


def _overlay_program_metadata(merged_programs: List[dict], old_detail: List[dict]) -> List[dict]:
    """Keep admin/student fields from stored programs_detail; dates come from merged list."""
    old_by_name = {p.get("name"): p for p in (old_detail or []) if p.get("name")}
    out = []
    for p in merged_programs:
        old = old_by_name.get(p.get("name"), {})
        old_sched = old.get("schedule") or []
        old_sched_map = {
            (s.get("month") or s.get("session", 0)): s for s in old_sched
        }
        new_sched = []
        for s in p.get("schedule") or []:
            key = s.get("month") or s.get("session", 0)
            o = old_sched_map.get(key, {})
            new_sched.append({**s, "mode_choice": o.get("mode_choice", s.get("mode_choice", ""))})
        out.append({
            **p,
            "schedule": new_sched,
            "allow_pause": old.get("allow_pause", False),
            "pause_start": old.get("pause_start", ""),
            "pause_end": old.get("pause_end", ""),
            "pause_reason": old.get("pause_reason", ""),
            "status": old.get("status", p.get("status", "active")),
            "mode": old.get("mode", p.get("mode", "online")),
            "visible": old.get("visible", True),
        })
    return out


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    gender: Optional[str] = None
    place_of_birth: Optional[str] = None
    date_of_birth: Optional[str] = None
    city: Optional[str] = None
    qualification: Optional[str] = None
    profession: Optional[str] = None
    phone: Optional[str] = None


class PointsBonusClaim(BaseModel):
    kind: str


class FamilyMemberIn(BaseModel):
    id: Optional[str] = None
    name: str
    relationship: str = "Other"
    email: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None
    city: Optional[str] = None
    age: Optional[str] = None
    # Session preference + enrollment email (stored on client; flows into ParticipantData on dashboard-pay)
    attendance_mode: Optional[str] = "online"  # "online" | "offline"
    country: Optional[str] = ""
    notify_enrollment: bool = False


class FamilyUpdate(BaseModel):
    members: List[FamilyMemberIn] = []


class DashboardPayIn(BaseModel):
    program_id: str
    family_count: int = 0
    family_member_ids: List[str] = []
    currency: str = "aed"
    origin_url: str = ""


def _tier_unit_price(program: dict, tier_index: Optional[int], cur: str) -> float:
    cur = (cur or "aed").lower()
    tiers = program.get("duration_tiers") or []
    if program.get("is_flagship") and tiers and tier_index is not None and 0 <= tier_index < len(tiers):
        t = tiers[tier_index]
    else:
        t = program
    off = float(t.get(f"offer_price_{cur}", 0) or 0)
    base = float(t.get(f"price_{cur}", 0) or 0)
    return off if off > 0 else base


def _pick_self_and_family_tier_indices(program: dict) -> Tuple[Optional[int], Optional[int]]:
    tiers = program.get("duration_tiers") or []
    if not program.get("is_flagship") or not tiers:
        return None, None
    self_idx = None
    for i, t in enumerate(tiers):
        lab = (t.get("label") or "").lower()
        if "annual" in lab or "year" in lab or t.get("duration_unit") == "year":
            self_idx = i
            break
    if self_idx is None:
        self_idx = 0
    fam_idx = 0
    return self_idx, fam_idx


async def _promo_doc_for_program(code: str, program_id: str) -> Optional[dict]:
    if not (code or "").strip():
        return None
    promo = await db.promotions.find_one({"code": code.strip().upper(), "active": True}, {"_id": 0})
    if not promo:
        return None
    if promo.get("applicable_to") == "specific":
        ids = [str(x) for x in promo.get("applicable_program_ids", [])]
        if str(program_id) not in ids:
            return None
    return promo


def _promo_discount_on_line(promo: Optional[dict], line_subtotal: float, cur: str) -> float:
    if not promo or line_subtotal <= 0:
        return 0.0
    dt = promo.get("discount_type", "percentage")
    if dt == "percentage":
        return round(line_subtotal * float(promo.get("discount_percentage", 0)) / 100, 2)
    fixed = float(promo.get(f"discount_{cur}", promo.get("discount_aed", 0)))
    return min(line_subtotal, fixed)


def _read_currency_amount(offer: dict, prefix: str, cur: str) -> float:
    """Read offer[prefix_cur] with fallback across common currencies."""
    cur = (cur or "aed").lower()
    for key in (f"{prefix}_{cur}", f"{prefix}_aed", f"{prefix}_usd", f"{prefix}_inr", f"{prefix}_eur", f"{prefix}_gbp"):
        v = offer.get(key)
        if v is None or str(v).strip() == "":
            continue
        try:
            return float(v)
        except (TypeError, ValueError):
            continue
    return 0.0


def _program_included_in_annual_package(program: dict, configured_ids: Optional[List] = None) -> bool:
    """Programs in annual package: member seat included; they only pay for family add-ons.

    If `annual_package_included_program_ids` in site settings is non-empty, only those IDs match.
    If empty, fall back to title/category keywords (MMM, AWRP, …).
    """
    ids = [str(x).strip() for x in (configured_ids or []) if str(x).strip()]
    if ids:
        pid = str(program.get("id") or "")
        return pid in set(ids)
    blob = f"{program.get('title') or ''} {program.get('category') or ''}".lower()
    keys = ("money magic", "mmm", "atomic weight", "awrp")
    return any(k in blob for k in keys)


def _merge_program_dashboard_offers(global_ao: dict, global_fo: dict, program_id: str, per_map: Optional[dict]) -> Tuple[dict, dict]:
    """Shallow-merge global annual/family offer dicts with per-program overrides from site settings."""
    pid = str(program_id)
    row = (per_map or {}).get(pid) if isinstance(per_map, dict) else None
    if not isinstance(row, dict):
        row = {}
    ao = {**(global_ao or {}), **(row.get("annual") or {})}
    fo = {**(global_fo or {}), **(row.get("family") or {})}
    return ao, fo


def _program_has_portal_pricing_override(per_map: Optional[dict], program_id: str) -> bool:
    row = (per_map or {}).get(str(program_id)) if isinstance(per_map, dict) else None
    if not isinstance(row, dict):
        return False
    a = row.get("annual")
    f = row.get("family")
    if isinstance(a, dict) and len(a) > 0:
        return True
    if isinstance(f, dict) and len(f) > 0:
        return True
    return False


def _resolve_family_rows(client: dict, family_member_ids: List[str], fallback_count: int) -> List[dict]:
    fam = client.get("immediate_family") or []
    ids = [str(x).strip() for x in (family_member_ids or []) if str(x).strip()]
    if ids:
        by_id = {str(m.get("id")): m for m in fam if m.get("id")}
        out = []
        for i in ids:
            if i not in by_id:
                raise HTTPException(status_code=400, detail="Unknown or removed family member — save your family list and try again")
            out.append(by_id[i])
        return out
    n = max(0, int(fallback_count))
    return fam[:n]


async def compute_dashboard_annual_family_pricing(
    program: dict,
    program_id: str,
    currency: str,
    family_count: int,
    annual_offer: dict,
    family_offer: dict,
    include_self: bool = True,
) -> dict:
    """Portal-only pricing for annual subscribers.

    `annual_offer` applies only to the member's own seat line; `family_offer` applies only to the family line.
    They are merged independently from site settings (global + per-program overrides) and may use different rules.
    """
    cur = (currency or "aed").lower()
    self_tier, fam_tier = _pick_self_and_family_tier_indices(program)
    self_unit = _tier_unit_price(program, self_tier, cur) if include_self else 0.0
    fam_unit = _tier_unit_price(program, fam_tier, cur)
    fc = max(0, int(family_count))
    fam_line_gross = fam_unit * fc

    ao = annual_offer or {}
    fo = family_offer or {}

    annual_promo_applied = False
    if include_self and ao.get("enabled"):
        rule = (ao.get("pricing_rule") or "promo").lower().strip()
        if rule in ("promo", ""):
            code = (ao.get("promo_code") or "").strip()
            ap = await _promo_doc_for_program(code, program_id) if code else None
            d = _promo_discount_on_line(ap, self_unit, cur)
            self_after = max(0.0, round(self_unit - d, 2))
            annual_promo_applied = bool(ap) and d > 0
            member_rule = "promo"
        elif rule == "percent_off":
            pct = min(100.0, max(0.0, float(ao.get("percent_off") or 0)))
            self_after = max(0.0, round(self_unit * (1 - pct / 100), 2))
            member_rule = "percent_off"
        elif rule == "amount_off":
            amt = _read_currency_amount(ao, "amount_off", cur)
            self_after = max(0.0, round(self_unit - min(self_unit, amt), 2))
            member_rule = "amount_off"
        elif rule == "fixed_price":
            fp = _read_currency_amount(ao, "fixed_price", cur)
            self_after = max(0.0, round(fp, 2)) if fp > 0 else max(0.0, round(self_unit, 2))
            member_rule = "fixed_price"
        else:
            self_after = max(0.0, round(self_unit, 2))
            member_rule = "list"
    elif include_self:
        self_after = max(0.0, round(self_unit, 2))
        member_rule = "list"
    else:
        self_after = 0.0
        member_rule = "included_in_package"

    family_promo_applied = False
    if fc <= 0:
        fam_after = 0.0
        family_rule = "none"
    elif fo.get("enabled"):
        rule = (fo.get("pricing_rule") or "promo").lower().strip()
        if rule in ("promo", ""):
            code = (fo.get("promo_code") or "").strip()
            fp_doc = await _promo_doc_for_program(code, program_id) if code else None
            d = _promo_discount_on_line(fp_doc, fam_line_gross, cur)
            fam_after = max(0.0, round(fam_line_gross - d, 2))
            family_promo_applied = bool(fp_doc) and d > 0
            family_rule = "promo"
        elif rule == "percent_off":
            pct = min(100.0, max(0.0, float(fo.get("percent_off") or 0)))
            fam_after = max(0.0, round(fam_line_gross * (1 - pct / 100), 2))
            family_rule = "percent_off"
        elif rule == "amount_off":
            amt = _read_currency_amount(fo, "amount_off", cur)
            fam_after = max(0.0, round(fam_line_gross - min(fam_line_gross, amt), 2))
            family_rule = "amount_off"
        elif rule == "fixed_price":
            pseat = _read_currency_amount(fo, "fixed_price", cur)
            if pseat > 0:
                fam_after = max(0.0, round(pseat * fc, 2))
            else:
                fam_after = max(0.0, round(fam_line_gross, 2))
            family_rule = "fixed_price"
        else:
            fam_after = max(0.0, round(fam_line_gross, 2))
            family_rule = "list"
    else:
        fam_after = max(0.0, round(fam_line_gross, 2))
        family_rule = "list"

    total = round(self_after + fam_after, 2)
    return {
        "currency": cur,
        "self_tier_index": self_tier,
        "family_tier_index": fam_tier,
        "self_unit": self_unit,
        "self_after_promos": self_after,
        "annual_promo_applied": annual_promo_applied,
        "member_pricing_rule": member_rule,
        "family_unit": fam_unit,
        "family_count": fc,
        "family_line_gross": round(fam_line_gross, 2),
        "family_after_promos": fam_after,
        "family_promo_applied": family_promo_applied,
        "family_pricing_rule": family_rule,
        "total": total,
        "include_self": include_self,
    }


async def _next_receipt_id() -> str:
    now = datetime.now(timezone.utc)
    month = now.month
    counter = await db.counters.find_one_and_update(
        {"_id": f"receipt_{now.strftime('%Y')}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
        projection={"_id": 0, "seq": 1},
    )
    seq = counter["seq"]
    mystery = f"{month}{seq * 3:02d}"
    return f"DIH-{mystery}-{seq:03d}"


def _age_from_dob_iso(dob_str: Optional[str]) -> str:
    if not dob_str:
        return ""
    try:
        ds = str(dob_str).strip()[:10]
        bd = datetime.strptime(ds, "%Y-%m-%d").date()
        today = datetime.now(timezone.utc).date()
        years = today.year - bd.year - ((today.month, today.day) < (bd.month, bd.day))
        return str(max(0, years))
    except (ValueError, TypeError):
        return ""


def _profile_snapshot_for_prefill(user: dict, client: dict) -> dict:
    """Merge approved profile, pending update, and client fallbacks for enrollment prefill."""
    keys = ["full_name", "gender", "place_of_birth", "date_of_birth", "city", "qualification", "profession", "phone"]
    if user.get("profile_approved"):
        snap = {k: user.get(k) for k in keys if user.get(k) is not None and str(user.get(k)).strip() != ""}
    else:
        pending = user.get("pending_profile_update") or {}
        snap = {}
        for k in keys:
            v = pending.get(k) if pending.get(k) not in (None, "") else user.get(k)
            if v is not None and str(v).strip() != "":
                snap[k] = v
    phone = snap.get("phone") or (client or {}).get("phone") or ""
    city = snap.get("city") or (client or {}).get("city") or ""
    dob = snap.get("date_of_birth") or ""
    age = _age_from_dob_iso(dob) if dob else ""
    name = snap.get("full_name") or user.get("name") or ""
    country = (client or {}).get("country") or user.get("country") or ""
    return {
        "name": name,
        "email": (user.get("email") or "").strip(),
        "phone": str(phone).strip(),
        "city": str(city).strip(),
        "gender": snap.get("gender") or "",
        "date_of_birth": str(dob).strip()[:10] if dob else "",
        "age": age,
        "country": str(country).strip() if country else "",
        "place_of_birth": snap.get("place_of_birth") or "",
        "qualification": snap.get("qualification") or "",
        "profession": snap.get("profession") or "",
    }


def _normalize_attendance_mode(raw: Optional[str]) -> str:
    v = (raw or "online").strip().lower()
    return v if v in ("online", "offline") else "online"


@router.put("/family")
async def update_immediate_family(data: FamilyUpdate, user: dict = Depends(get_current_user)):
    """Save immediate family members for dashboard offers / enrollment context (max 12)."""
    client_id = user.get("client_id")
    if not client_id:
        raise HTTPException(status_code=400, detail="User not linked to client record")

    out: List[dict] = []
    for m in (data.members or [])[:12]:
        name = (m.name or "").strip()
        if not name:
            continue
        em = (m.email or "").strip()
        if m.notify_enrollment and not em:
            raise HTTPException(
                status_code=400,
                detail=f"Family row “{name}”: add an email address to receive enrollment notifications, or turn off Notify.",
            )
        mid = (m.id or "").strip() or str(uuid.uuid4())
        dob = (m.date_of_birth or "").strip()[:10] if m.date_of_birth else ""
        age_val = (m.age or "").strip()
        if not age_val and dob:
            age_val = _age_from_dob_iso(dob)
        out.append({
            "id": mid,
            "name": name,
            "relationship": (m.relationship or "Other").strip() or "Other",
            "email": em,
            "phone": (m.phone or "").strip(),
            "date_of_birth": dob,
            "city": (m.city or "").strip(),
            "age": age_val,
            "attendance_mode": _normalize_attendance_mode(m.attendance_mode),
            "country": (m.country or "").strip()[:4] or "",
            "notify_enrollment": bool(m.notify_enrollment) and bool(em),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })

    await db.clients.update_one(
        {"id": client_id},
        {"$set": {
            "immediate_family": out,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    return {"message": "Family list saved", "immediate_family": out}


@router.get("/enrollment-prefill")
async def get_enrollment_prefill(user: dict = Depends(get_current_user)):
    """Profile + family list for dashboard-origin enrollment (skip retyping public form fields)."""
    client_id = user.get("client_id")
    client = await db.clients.find_one({"id": client_id}, {"_id": 0}) or {} if client_id else {}
    self_data = _profile_snapshot_for_prefill(user, client)
    family = client.get("immediate_family") or []
    return {"self": self_data, "immediate_family": family}


@router.get("/dashboard-quote")
async def dashboard_quote(
    program_id: str,
    family_count: int = 0,
    family_ids: str = "",
    currency: str = "aed",
    user: dict = Depends(get_current_user),
):
    """Annual members: mixed pricing; MMM/AWRP-style programs = family only (included in annual package)."""
    client_id = user.get("client_id")
    if not client_id:
        raise HTTPException(status_code=400, detail="User not linked to client record")
    client = await db.clients.find_one({"id": client_id}, {"_id": 0}) or {}
    sub = client.get("subscription") or {}
    if not _is_annual_subscriber(sub, client):
        raise HTTPException(status_code=403, detail="Annual member dashboard pricing is for annual subscribers only")
    fam = client.get("immediate_family") or []
    id_list = [x.strip() for x in (family_ids or "").split(",") if x.strip()]
    if id_list:
        fam_by_id = {str(m.get("id")) for m in fam if m.get("id")}
        for i in id_list:
            if i not in fam_by_id:
                raise HTTPException(status_code=400, detail="Unknown family member id")
        fc = len(id_list)
    else:
        fc = max(0, int(family_count))
    if fc > 12:
        raise HTTPException(status_code=400, detail="Invalid family count")
    if fc > len(fam):
        raise HTTPException(status_code=400, detail="Save more family members on your dashboard to cover this many seats")
    program = await db.programs.find_one({"id": program_id}, {"_id": 0})
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    if not program.get("enrollment_open", True):
        raise HTTPException(status_code=400, detail="Enrollment is not open for this program")
    settings_doc = await db.site_settings.find_one(
        {"id": "site_settings"},
        {
            "_id": 0,
            "dashboard_offer_annual": 1,
            "dashboard_offer_family": 1,
            "annual_package_included_program_ids": 1,
            "dashboard_program_offers": 1,
        },
    ) or {}
    included = _program_included_in_annual_package(program, settings_doc.get("annual_package_included_program_ids"))
    include_self = not included
    g_ao = settings_doc.get("dashboard_offer_annual") or {}
    g_fo = settings_doc.get("dashboard_offer_family") or {}
    per_map = settings_doc.get("dashboard_program_offers") or {}
    ao, fo = _merge_program_dashboard_offers(g_ao, g_fo, program_id, per_map)
    pricing = await compute_dashboard_annual_family_pricing(
        program, program_id, currency, fc, ao, fo, include_self=include_self
    )
    return {
        "program_id": program_id,
        "program_title": program.get("title", ""),
        "included_in_annual_package": included,
        "program_portal_pricing_override": _program_has_portal_pricing_override(per_map, program_id),
        **pricing,
    }


@router.post("/dashboard-pay")
async def dashboard_pay(data: DashboardPayIn, request: Request, user: dict = Depends(get_current_user)):
    """Create a verified enrollment with mixed annual/family pricing; client then POSTs /api/enrollment/{id}/checkout."""
    from routes.enrollment import ParticipantData, detect_ip_info

    client_id = user.get("client_id")
    if not client_id:
        raise HTTPException(status_code=400, detail="User not linked to client record")
    client = await db.clients.find_one({"id": client_id}, {"_id": 0}) or {}
    sub = client.get("subscription") or {}
    if not _is_annual_subscriber(sub, client):
        raise HTTPException(status_code=403, detail="Annual member dashboard pricing is for annual subscribers only")
    program = await db.programs.find_one({"id": data.program_id}, {"_id": 0})
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    if not program.get("enrollment_open", True):
        raise HTTPException(status_code=400, detail="Enrollment is not open for this program")

    settings_doc = await db.site_settings.find_one(
        {"id": "site_settings"},
        {
            "_id": 0,
            "dashboard_offer_annual": 1,
            "dashboard_offer_family": 1,
            "annual_package_included_program_ids": 1,
            "dashboard_program_offers": 1,
        },
    ) or {}
    included = _program_included_in_annual_package(program, settings_doc.get("annual_package_included_program_ids"))
    fam = client.get("immediate_family") or []
    resolved_family = _resolve_family_rows(client, list(data.family_member_ids or []), int(data.family_count or 0))
    fc = len(resolved_family)
    if fc > 12:
        raise HTTPException(status_code=400, detail="Invalid family count")
    if fc > len(fam):
        raise HTTPException(status_code=400, detail="Save more family members on your dashboard to cover this many seats")

    if included and fc == 0:
        raise HTTPException(
            status_code=400,
            detail="This program is already included in your annual package — select one or more family members to enroll.",
        )

    g_ao = settings_doc.get("dashboard_offer_annual") or {}
    g_fo = settings_doc.get("dashboard_offer_family") or {}
    per_map = settings_doc.get("dashboard_program_offers") or {}
    ao, fo = _merge_program_dashboard_offers(g_ao, g_fo, data.program_id, per_map)
    quote = await compute_dashboard_annual_family_pricing(
        program, data.program_id, data.currency, fc, ao, fo, include_self=not included
    )
    if quote["total"] <= 0:
        raise HTTPException(status_code=400, detail="No payable amount for this program")

    snap = _profile_snapshot_for_prefill(user, client)

    def _age_int(raw) -> int:
        try:
            a = int(str(raw).strip())
            return max(5, min(120, a))
        except Exception:
            return 30

    participants: List[ParticipantData] = []
    if not included:
        participants.append(
            ParticipantData(
                name=snap.get("name") or user.get("name") or "Student",
                relationship="Myself",
                age=_age_int(snap.get("age")),
                gender=(snap.get("gender") or "Prefer not to say")[:40],
                country=(snap.get("country") or "AE")[:4],
                attendance_mode="online",
                notify=True,
                email=snap.get("email") or user.get("email"),
                phone=snap.get("phone"),
                whatsapp=snap.get("phone"),
                program_id=data.program_id,
                program_title=program.get("title"),
            )
        )
    for m in resolved_family:
        fam_email = (m.get("email") or "").strip() or None
        fam_country = (m.get("country") or "").strip() or (snap.get("country") or "AE")
        fam_country = str(fam_country)[:4] or "AE"
        fam_mode = _normalize_attendance_mode(m.get("attendance_mode"))
        notify_ok = bool(m.get("notify_enrollment")) and bool(fam_email)
        participants.append(
            ParticipantData(
                name=(m.get("name") or "Guest")[:200],
                relationship=(m.get("relationship") or "Other")[:80],
                age=_age_int(m.get("age")),
                gender="Prefer not to say",
                country=fam_country,
                attendance_mode=fam_mode,
                notify=notify_ok,
                email=fam_email,
                phone=(m.get("phone") or "").strip() or None,
                whatsapp=(m.get("phone") or "").strip() or None,
                program_id=data.program_id,
                program_title=program.get("title"),
            )
        )

    ip_info = await detect_ip_info(request)
    receipt_id = await _next_receipt_id()
    enrollment = {
        "id": receipt_id,
        "status": "contact_verified",
        "step": 3,
        "item_type": "program",
        "item_id": data.program_id,
        "item_title": program.get("title") or "",
        "booker_name": snap.get("name") or user.get("name") or "Student",
        "booker_email": (user.get("email") or "").lower().strip(),
        "booker_country": snap.get("country") or "AE",
        "participants": [p.dict() for p in participants],
        "participant_count": len(participants),
        "ip_info": ip_info,
        "phone": snap.get("phone"),
        "phone_verified": True,
        "email_verified": True,
        "vpn_blocked": bool(ip_info.get("is_vpn") or ip_info.get("is_proxy") or ip_info.get("is_hosting")),
        "dashboard_mixed_total": quote["total"],
        "dashboard_mixed_currency": quote["currency"],
        "dashboard_checkout_ready": True,
        "preferred_india_gpay_id": (sub.get("preferred_india_gpay_id") or "").strip(),
        "preferred_india_bank_id": (sub.get("preferred_india_bank_id") or "").strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.enrollments.insert_one(enrollment)
    tier_for_checkout = quote.get("family_tier_index") if included else quote.get("self_tier_index")
    return {
        "enrollment_id": receipt_id,
        "pricing": quote,
        "tier_index": tier_for_checkout,
        "included_in_annual_package": included,
    }


@router.get("/home")
async def get_student_home(user: dict = Depends(get_current_user)):
    """Fetch personalized home data: Schedule, Package, Financials, Programs."""
    client_id = user.get("client_id")
    client = await db.clients.find_one({"id": client_id}, {"_id": 0}) or {}

    # 1. Upcoming Programs (General) — sorted soonest first for dashboard
    upcoming_raw = await db.programs.find(
        {"is_upcoming": True, "visible": True},
        {"_id": 0}
    ).to_list(24)
    upcoming = _sort_upcoming_for_dashboard(upcoming_raw)

    settings_doc = await db.site_settings.find_one(
        {"id": "site_settings"},
        {
            "_id": 0,
            "dashboard_offer_annual": 1,
            "dashboard_offer_family": 1,
            "dashboard_program_offers": 1,
            "india_gpay_accounts": 1,
            "india_bank_accounts": 1,
            "india_bank_details": 1,
            "india_upi_id": 1,
        },
    ) or {}
    dashboard_offer_annual = settings_doc.get("dashboard_offer_annual") or {}
    dashboard_offer_family = settings_doc.get("dashboard_offer_family") or {}
    dashboard_program_offers = settings_doc.get("dashboard_program_offers") or {}
    
    # 2. Subscription data (from Excel upload)
    sub = client.get("subscription", {})
    sess = sub.get("sessions", {})
    emis = sub.get("emis", [])

    # 3. Financials - derived from subscription
    paid_emis = sum(1 for e in emis if e.get("status") == "paid")
    total_emis = len(emis)
    voluntary_credits = float(sub.get("voluntary_credits_total") or 0)
    total_paid_emis = sum(e.get("amount", 0) for e in emis if e.get("status") == "paid")
    total_paid = total_paid_emis + voluntary_credits
    total_fee = sub.get("total_fee", 0)
    remaining = max(0, total_fee - total_paid)

    financials = {
        "status": client.get("payment_status") or ("Paid" if remaining <= 0 and total_fee > 0 else ("EMI" if total_emis > 0 else "N/A")),
        "total_fee": total_fee,
        "currency": sub.get("currency", "INR"),
        "total_paid": total_paid,
        "remaining": remaining,
        "voluntary_credits_total": voluntary_credits,
        "payment_mode": sub.get("payment_mode", ""),
        "emi_plan": f"{paid_emis}/{total_emis} EMIs Paid" if total_emis > 0 else "",
        "emis": emis,
        "next_due": "No pending dues",
    }

    # Find next due EMI
    for emi in emis:
        if emi.get("status") in ("due", "pending") and emi.get("due_date"):
            financials["next_due"] = emi["due_date"]
            break
    
    # 4. Package & Sessions
    package = {
        "program_name": sub.get("annual_program") or client.get("active_package", {}).get("program_name", "No Active Package"),
        "total_sessions": sess.get("total", 0),
        "used_sessions": sess.get("availed", 0),
        "yet_to_avail": sess.get("yet_to_avail", 0),
        "carry_forward": sess.get("carry_forward", 0),
        "current": sess.get("current", 0),
        "due": sess.get("due", 0),
        "scheduled_dates": sess.get("scheduled_dates", []),
        "next_session_date": sess.get("scheduled_dates", [None])[0] if sess.get("scheduled_dates") else client.get("active_package", {}).get("next_session_date"),
        "start_date": sub.get("start_date", ""),
        "end_date": sub.get("end_date", ""),
        "bi_annual_download": sub.get("bi_annual_download", 0),
        "quarterly_releases": sub.get("quarterly_releases", 0),
    }

    # 5. Programs in their kitty — rich objects with duration, dates, status
    programs_list = await _raw_programs_from_subscription(sub)

    # 5b. Global program schedule (admin Scheduler) — merge for every logged-in student
    sched_doc = await db.program_schedule.find_one({"id": "global"}, {"_id": 0})
    global_sched = sched_doc.get("programs", []) if sched_doc else []
    programs_list = _merge_global_schedule_into_programs(programs_list, global_sched)
    schedule_preview = _build_schedule_preview(programs_list)

    # 5c. If no dated slots yet, surface admin-entered 1:1 dates from subscription
    if not schedule_preview and sess.get("scheduled_dates"):
        for d in sess.get("scheduled_dates", [])[:8]:
            if not d:
                continue
            ds = str(d).strip()[:10]
            try:
                slot_date = datetime.strptime(ds, "%Y-%m-%d").date()
            except ValueError:
                continue
            if slot_date < datetime.now(timezone.utc).date():
                continue
            schedule_preview.append({
                "program_name": "1:1 Session",
                "date": ds,
                "end_date": "",
                "time": "",
                "note": "",
                "mode_choice": "",
                "session_index": None,
            })
        schedule_preview.sort(key=lambda x: x["date"])

    # 6. Journey Logs (Last 3)
    logs = await db.journey_logs.find(
        {"client_id": client_id}, {"_id": 0}
    ).sort("date", -1).to_list(3)

    # 7. Profile Status
    profile_status = "complete" if user.get("profile_approved") else "pending"
    if not user.get("profile_approved") and not user.get("pending_profile_update"):
        profile_status = "incomplete"

    # 8. Payment methods & bank details
    payment_methods = sub.get("payment_methods", ["stripe", "manual"])
    payment_destinations = sub.get("payment_destinations") or {}
    banks = await db.bank_accounts.find({"is_active": True}, {"_id": 0}).to_list(10)

    iris_journey = resolve_iris_journey(sub)

    from routes.points_logic import points_public_summary

    loyalty_points = await points_public_summary(db, user.get("email") or "")

    is_annual = _is_annual_subscriber(sub, client)
    immediate_family = client.get("immediate_family") or []

    return {
        "client_id": client_id,
        "upcoming_programs": upcoming,
        "is_annual_subscriber": is_annual,
        "dashboard_offers": {
            "annual": dashboard_offer_annual,
            "family": dashboard_offer_family,
        },
        "dashboard_program_offers": dashboard_program_offers,
        "immediate_family": immediate_family,
        "financials": financials,
        "package": package,
        "programs": programs_list,
        "schedule_preview": schedule_preview,
        "journey_logs": logs,
        "profile_status": profile_status,
        "payment_methods": payment_methods,
        "payment_destinations": payment_destinations,
        "bank_accounts": banks,
        "late_fee_per_day": sub.get("late_fee_per_day", 0),
        "channelization_fee": sub.get("channelization_fee", 0),
        "show_late_fees": sub.get("show_late_fees", False),
        "iris_journey": iris_journey,
        "points": loyalty_points,
        "user_details": {
            "full_name": user.get("full_name") or user.get("name"),
            "city": user.get("city"),
            "tier": user.get("tier")
        },
        "india_payment_reference": {
            "india_gpay_accounts": settings_doc.get("india_gpay_accounts") or [],
            "india_bank_accounts": settings_doc.get("india_bank_accounts") or [],
            "india_bank_details": settings_doc.get("india_bank_details") or {},
            "india_upi_id": settings_doc.get("india_upi_id") or "",
        },
        "preferred_india_gpay_id": (sub.get("preferred_india_gpay_id") or "").strip(),
        "preferred_india_bank_id": (sub.get("preferred_india_bank_id") or "").strip(),
    }

@router.put("/profile")
async def update_profile(data: ProfileUpdate, user: dict = Depends(get_current_user)):
    """Submit profile for approval."""
    update_dict = {k: v for k, v in data.dict().items() if v is not None}
    
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "pending_profile_update": update_dict,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"message": "Profile submitted for approval"}

class JourneyLogCreate(BaseModel):
    date: str
    title: str
    category: str
    experience: str
    learning: str
    rating: int

@router.post("/logs")
async def create_journey_log(data: JourneyLogCreate, user: dict = Depends(get_current_user)):
    client_id = user.get("client_id")
    if not client_id:
        raise HTTPException(status_code=400, detail="User not linked to client record")
        
    log = JourneyLog(
        client_id=client_id,
        **data.dict()
    )
    await db.journey_logs.insert_one(log.dict())
    return {"message": "Log saved", "id": log.id}

@router.get("/logs")
async def get_journey_logs(user: dict = Depends(get_current_user)):
    client_id = user.get("client_id")
    logs = await db.journey_logs.find(
        {"client_id": client_id}, {"_id": 0}
    ).sort("date", -1).to_list(100)
    return logs


class ModeChoice(BaseModel):
    program_name: str
    session_index: int
    mode: str  # "online" | "offline"

@router.post("/choose-mode")
async def choose_session_mode(data: ModeChoice, user: dict = Depends(get_current_user)):
    """Student chooses online/offline for a scheduled session."""
    client_id = user.get("client_id")
    if not client_id:
        raise HTTPException(status_code=400, detail="User not linked to client record")

    mode = (data.mode or "").strip().lower()
    if mode not in ("online", "offline"):
        raise HTTPException(status_code=400, detail='mode must be "online" or "offline"')

    client_doc = await db.clients.find_one({"id": client_id})
    if not client_doc:
        raise HTTPException(status_code=404, detail="Client not found")

    sub = dict(client_doc.get("subscription") or {})
    merged = await _merged_programs_list_for_client(client_doc)
    old_detail = client_doc.get("subscription", {}).get("programs_detail") or []
    programs = _overlay_program_metadata(merged, old_detail)
    merged_names = {p.get("name") for p in programs if p.get("name")}
    for extra in old_detail:
        if extra.get("name") and extra.get("name") not in merged_names:
            programs.append(extra)

    updated = False
    for prog in programs:
        if prog.get("name") == data.program_name:
            schedule = list(prog.get("schedule") or [])
            if data.session_index < 0 or data.session_index >= len(schedule):
                raise HTTPException(status_code=404, detail="Session index out of range")
            slot = dict(schedule[data.session_index])
            slot["mode_choice"] = mode
            schedule[data.session_index] = slot
            prog["schedule"] = schedule
            updated = True
            break

    if not updated:
        raise HTTPException(status_code=404, detail="Program or session not found")

    sub["programs_detail"] = programs
    await db.clients.update_one(
        {"id": client_id},
        {"$set": {"subscription": sub, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": f"Mode set to {mode}"}


# ═══════════════════════════════════════════
# DAILY PROGRESS TRACKING
# ═══════════════════════════════════════════

class DailyProgressCreate(BaseModel):
    date: str  # YYYY-MM-DD
    program_name: str
    notes: str = ""
    rating: int = 3  # 1-5
    completed: bool = True
    is_extraordinary: bool = False
    extraordinary_note: str = ""

@router.post("/daily-progress")
async def save_daily_progress(data: DailyProgressCreate, user: dict = Depends(get_current_user)):
    """Save or update a daily progress entry."""
    client_id = user.get("client_id")
    if not client_id:
        raise HTTPException(status_code=400, detail="User not linked to client record")

    entry = {
        "client_id": client_id,
        "date": data.date,
        "program_name": data.program_name,
        "notes": data.notes,
        "rating": max(1, min(5, data.rating)),
        "completed": data.completed,
        "is_extraordinary": data.is_extraordinary,
        "extraordinary_note": data.extraordinary_note,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    # Upsert: one entry per client+date+program
    await db.daily_progress.update_one(
        {"client_id": client_id, "date": data.date, "program_name": data.program_name},
        {"$set": entry, "$setOnInsert": {"id": str(__import__('uuid').uuid4()), "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    return {"message": "Progress saved"}

@router.get("/daily-progress")
async def get_daily_progress(month: str = "", user: dict = Depends(get_current_user)):
    """Get daily progress entries. Optional: filter by month (YYYY-MM)."""
    client_id = user.get("client_id")
    query = {"client_id": client_id}
    if month:
        query["date"] = {"$regex": f"^{month}"}
    entries = await db.daily_progress.find(query, {"_id": 0}).sort("date", -1).to_list(366)
    return entries

@router.get("/extraordinary-moments")
async def get_extraordinary_moments(user: dict = Depends(get_current_user)):
    """Get all extraordinary moments for a student."""
    client_id = user.get("client_id")
    entries = await db.daily_progress.find(
        {"client_id": client_id, "is_extraordinary": True},
        {"_id": 0}
    ).sort("date", -1).to_list(100)
    return entries


# ═══════════════════════════════════════════
# STUDENT-INITIATED PAUSE
# ═══════════════════════════════════════════

class PauseRequest(BaseModel):
    program_name: str
    pause_start: str  # YYYY-MM-DD
    pause_end: str    # YYYY-MM-DD
    reason: str = ""

@router.post("/pause-program")
async def pause_program(data: PauseRequest, user: dict = Depends(get_current_user)):
    """Student requests to pause a program (if admin has enabled it)."""
    client_id = user.get("client_id")
    client_doc = await db.clients.find_one({"id": client_id})
    if not client_doc:
        raise HTTPException(status_code=404, detail="Client not found")

    sub = client_doc.get("subscription", {})
    programs = sub.get("programs_detail", [])

    for prog in programs:
        if prog["name"] == data.program_name:
            if not prog.get("allow_pause", False):
                raise HTTPException(status_code=403, detail="Pause not enabled for this program")
            prog["status"] = "paused"
            prog["pause_start"] = data.pause_start
            prog["pause_end"] = data.pause_end
            prog["pause_reason"] = data.reason
            prog["pause_requested_at"] = datetime.now(timezone.utc).isoformat()
            break
    else:
        raise HTTPException(status_code=404, detail="Program not found")

    sub["programs_detail"] = programs
    await db.clients.update_one(
        {"id": client_id},
        {"$set": {"subscription": sub}}
    )
    return {"message": f"{data.program_name} paused until {data.pause_end}"}

@router.post("/resume-program")
async def resume_program(data: ModeChoice, user: dict = Depends(get_current_user)):
    """Student resumes a paused program."""
    client_id = user.get("client_id")
    client_doc = await db.clients.find_one({"id": client_id})
    if not client_doc:
        raise HTTPException(status_code=404, detail="Client not found")

    sub = client_doc.get("subscription", {})
    programs = sub.get("programs_detail", [])

    for prog in programs:
        if prog["name"] == data.program_name:
            prog["status"] = "active"
            prog.pop("pause_start", None)
            prog.pop("pause_end", None)
            prog.pop("pause_reason", None)
            break
    else:
        raise HTTPException(status_code=404, detail="Program not found")

    sub["programs_detail"] = programs
    await db.clients.update_one(
        {"id": client_id},
        {"$set": {"subscription": sub}}
    )
    return {"message": f"{data.program_name} resumed"}

class ResumeRequest(BaseModel):
    program_name: str

@router.post("/resume-program-simple")
async def resume_program_simple(data: ResumeRequest, user: dict = Depends(get_current_user)):
    """Student resumes a paused program (simple)."""
    client_id = user.get("client_id")
    client_doc = await db.clients.find_one({"id": client_id})
    if not client_doc:
        raise HTTPException(status_code=404, detail="Client not found")

    sub = client_doc.get("subscription", {})
    programs = sub.get("programs_detail", [])

    for prog in programs:
        if prog["name"] == data.program_name:
            prog["status"] = "active"
            prog.pop("pause_start", None)
            prog.pop("pause_end", None)
            prog.pop("pause_reason", None)
            break
    else:
        raise HTTPException(status_code=404, detail="Program not found")

    sub["programs_detail"] = programs
    await db.clients.update_one(
        {"id": client_id},
        {"$set": {"subscription": sub}}
    )
    return {"message": f"{data.program_name} resumed"}



# ═══════════════════════════════════════════
# BHAAD PORTAL — Release & Transform
# ═══════════════════════════════════════════

class BhaadRelease(BaseModel):
    original: str
    transformed: str
    date: str

@router.post("/bhaad-release")
async def save_bhaad_release(data: BhaadRelease, user: dict = Depends(get_current_user)):
    client_id = user.get("client_id") or user.get("id")
    entry = {
        "id": str(__import__('uuid').uuid4()),
        "client_id": client_id,
        "original": data.original,
        "transformed": data.transformed,
        "date": data.date,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.bhaad_releases.insert_one(entry)
    return {"message": "Released and transformed"}

@router.get("/bhaad-history")
async def get_bhaad_history(user: dict = Depends(get_current_user)):
    client_id = user.get("client_id") or user.get("id")
    items = await db.bhaad_releases.find({"client_id": client_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return items


# ═══════════════════════════════════════════
# SOUL TRIBE — Community Feed
# ═══════════════════════════════════════════

class TribePostCreate(BaseModel):
    content: str
    image: str = ""

class TribeReact(BaseModel):
    post_id: str
    emoji: str

class TribeComment(BaseModel):
    post_id: str
    text: str

@router.get("/tribe/posts")
async def get_tribe_posts(user: dict = Depends(get_current_user)):
    posts = await db.tribe_posts.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return posts

@router.post("/tribe/posts")
async def create_tribe_post(data: TribePostCreate, user: dict = Depends(get_current_user)):
    post = {
        "id": str(__import__('uuid').uuid4()),
        "author_id": user.get("client_id") or user.get("id"),
        "author_name": user.get("name", "Soul Tribe Member"),
        "content": data.content,
        "image": data.image,
        "reactions": {},
        "comments": [],
        "badge": "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.tribe_posts.insert_one(post)
    post.pop("_id", None)
    return post

@router.post("/tribe/react")
async def react_to_post(data: TribeReact, user: dict = Depends(get_current_user)):
    await db.tribe_posts.update_one(
        {"id": data.post_id},
        {"$inc": {f"reactions.{data.emoji}": 1}}
    )
    return {"message": "Reacted"}

@router.post("/tribe/comment")
async def comment_on_post(data: TribeComment, user: dict = Depends(get_current_user)):
    comment = {
        "author": user.get("name", "Member"),
        "text": data.text,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.tribe_posts.update_one(
        {"id": data.post_id},
        {"$push": {"comments": comment}}
    )
    return comment


@router.get("/points")
async def student_points_detail(user: dict = Depends(get_current_user)):
    from routes.points_logic import points_public_summary, recent_ledger

    email = user.get("email") or ""
    summary = await points_public_summary(db, email)
    ledger = await recent_ledger(db, email, 40)
    return {**summary, "ledger": ledger}


@router.post("/points/claim-bonus")
async def student_points_claim_bonus(data: PointsBonusClaim, user: dict = Depends(get_current_user)):
    from routes.points_logic import claim_one_time_bonus

    return await claim_one_time_bonus(db, user.get("email") or "", data.kind.strip().lower(), user)
