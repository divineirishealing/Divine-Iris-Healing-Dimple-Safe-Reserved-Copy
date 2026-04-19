from fastapi import APIRouter, HTTPException, Request, Depends, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Tuple
import os
import re
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from dotenv import load_dotenv
from pathlib import Path
from .auth import get_current_user
from models_extended import JourneyLog
from iris_journey import resolve_iris_journey
from routes.programs import fetch_programs_with_deadline_sync, sort_programs_like_homepage
from routes.enrollment import ProfileData, insert_enrollment_from_profile

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/api/student", tags=["Student Dashboard"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


def _immediate_family_has_names(rows: Optional[List[dict]]) -> bool:
    return any(((m.get("name") or "").strip()) for m in (rows or []))


def _immediate_family_effective_locked(client_doc: dict) -> bool:
    """True if the list is treated as locked (explicit flag or legacy rows on file before lock shipped)."""
    if bool(client_doc.get("immediate_family_locked")):
        return True
    return _immediate_family_has_names(client_doc.get("immediate_family"))


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


class DashboardGuestSeatPref(BaseModel):
    """Per-guest choices at checkout (not stored on the saved family list)."""
    family_member_id: str
    attendance_mode: str = "online"
    notify_enrollment: bool = False


class DashboardPayIn(BaseModel):
    program_id: str
    family_count: int = 0
    family_member_ids: List[str] = []
    currency: str = "aed"
    origin_url: str = ""
    booker_attendance_mode: Optional[str] = "online"
    booker_notify: bool = True
    guest_seat_prefs: List[DashboardGuestSeatPref] = []


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


def _pick_self_and_family_tier_indices(
    program: dict, tier_index_override: Optional[int] = None
) -> Tuple[Optional[int], Optional[int]]:
    tiers = program.get("duration_tiers") or []
    if not program.get("is_flagship") or not tiers:
        return None, None
    if tier_index_override is not None:
        try:
            ti = int(tier_index_override)
        except (TypeError, ValueError):
            ti = -1
        if 0 <= ti < len(tiers):
            return ti, ti
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


def _merge_program_dashboard_offers(
    global_ao: dict,
    global_fo: dict,
    global_eo: dict,
    program_id: str,
    per_map: Optional[dict],
) -> Tuple[dict, dict, dict]:
    """Shallow-merge global annual / family / extended guest offer dicts with per-program overrides."""
    pid = str(program_id)
    row = (per_map or {}).get(pid) if isinstance(per_map, dict) else None
    if not isinstance(row, dict):
        row = {}
    ao = {**(global_ao or {}), **(row.get("annual") or {})}
    fo = {**(global_fo or {}), **(row.get("family") or {})}
    eo = {**(global_eo or {}), **(row.get("extended") or {})}
    return ao, fo, eo


def _program_has_portal_pricing_override(per_map: Optional[dict], program_id: str) -> bool:
    row = (per_map or {}).get(str(program_id)) if isinstance(per_map, dict) else None
    if not isinstance(row, dict):
        return False
    a = row.get("annual")
    f = row.get("family")
    e = row.get("extended")
    if isinstance(a, dict) and len(a) > 0:
        return True
    if isinstance(f, dict) and len(f) > 0:
        return True
    if isinstance(e, dict) and len(e) > 0:
        return True
    return False


def _all_dashboard_guest_rows(client: dict) -> List[dict]:
    """Immediate household + friends/extended — same shape; IDs must be unique across both lists."""
    im = list(client.get("immediate_family") or [])
    og = list(client.get("other_guests") or [])
    return im + og


def _resolve_family_rows(client: dict, family_member_ids: List[str], fallback_count: int) -> List[dict]:
    fam = _all_dashboard_guest_rows(client)
    ids = [str(x).strip() for x in (family_member_ids or []) if str(x).strip()]
    if ids:
        by_id = {str(m.get("id")): m for m in fam if m.get("id")}
        out = []
        for i in ids:
            if i not in by_id:
                raise HTTPException(
                    status_code=400,
                    detail="Unknown or removed guest — save your lists below and try again",
                )
            out.append(by_id[i])
        return out
    n = max(0, int(fallback_count))
    return fam[:n]


def _split_resolved_guest_rows_by_bucket(client: dict, rows: List[dict]) -> Tuple[int, int]:
    """Count immediate-family vs friends/extended rows (by id membership)."""
    im_ids = {str(m.get("id")) for m in (client.get("immediate_family") or []) if m.get("id")}
    imm = sum(1 for r in rows if str(r.get("id") or "") in im_ids)
    return imm, len(rows) - imm


def _split_guest_ids_by_bucket(client: dict, id_list: List[str]) -> Tuple[int, int]:
    im_ids = {str(m.get("id")) for m in (client.get("immediate_family") or []) if m.get("id")}
    og_ids = {str(m.get("id")) for m in (client.get("other_guests") or []) if m.get("id")}
    imm = sum(1 for i in id_list if i in im_ids)
    ext = sum(1 for i in id_list if i in og_ids)
    return imm, ext


async def _apply_portal_guest_line_offer(
    program_id: str,
    currency: str,
    fam_unit: float,
    fc: int,
    fo: dict,
) -> Tuple[float, float, str, bool]:
    """Apply family-style portal rules to one guest bucket. Returns (gross, after, rule, promo_applied)."""
    cur = (currency or "aed").lower()
    fc = max(0, int(fc))
    if fc <= 0:
        return 0.0, 0.0, "none", False
    fam_line_gross = fam_unit * fc
    fo = fo or {}
    family_promo_applied = False
    if fo.get("enabled"):
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
    return round(fam_line_gross, 2), fam_after, family_rule, family_promo_applied


async def compute_dashboard_annual_family_pricing(
    program: dict,
    program_id: str,
    currency: str,
    immediate_family_count: int,
    extended_guest_count: int,
    annual_offer: dict,
    family_offer: dict,
    extended_guest_offer: dict,
    include_self: bool = True,
    tier_index_override: Optional[int] = None,
) -> dict:
    """Portal-only pricing for annual subscribers.

    Member seat uses `annual_offer`. Immediate household seats use `family_offer`.
    Friends & extended seats use `extended_guest_offer` (when disabled → list / offer unit per seat).
    Legacy API that only passes a total without a split should pass the full count as `immediate_family_count`
    and zero `extended_guest_count`.
    """
    cur = (currency or "aed").lower()
    self_tier, fam_tier = _pick_self_and_family_tier_indices(program, tier_index_override)
    self_unit = _tier_unit_price(program, self_tier, cur) if include_self else 0.0
    fam_unit = _tier_unit_price(program, fam_tier, cur)
    imm_fc = max(0, int(immediate_family_count))
    ext_fc = max(0, int(extended_guest_count))
    fc_total = imm_fc + ext_fc

    ao = annual_offer or {}

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

    ig, imm_after, imm_rule, imm_promo = await _apply_portal_guest_line_offer(
        program_id, currency, fam_unit, imm_fc, family_offer or {}
    )
    eg, ext_after, ext_rule, ext_promo = await _apply_portal_guest_line_offer(
        program_id, currency, fam_unit, ext_fc, extended_guest_offer or {}
    )

    fam_line_gross = round(ig + eg, 2)
    fam_after = round(imm_after + ext_after, 2)
    family_promo_applied = imm_promo or ext_promo

    if imm_fc > 0 and ext_fc > 0:
        family_pricing_rule = "mixed"
    elif imm_fc > 0:
        family_pricing_rule = imm_rule
    elif ext_fc > 0:
        family_pricing_rule = ext_rule
    else:
        family_pricing_rule = "none"

    total = round(self_after + fam_after, 2)
    list_subtotal = round((self_unit if include_self else 0.0) + fam_line_gross, 2)
    portal_discount_total = round(max(0.0, list_subtotal - total), 2)
    return {
        "currency": cur,
        "self_tier_index": self_tier,
        "family_tier_index": fam_tier,
        "self_unit": self_unit,
        "self_after_promos": self_after,
        "annual_promo_applied": annual_promo_applied,
        "member_pricing_rule": member_rule,
        "family_unit": fam_unit,
        "family_count": fc_total,
        "immediate_family_count": imm_fc,
        "extended_guest_count": ext_fc,
        "immediate_family_line_gross": ig,
        "immediate_family_after_promos": imm_after,
        "immediate_family_pricing_rule": imm_rule,
        "immediate_family_promo_applied": imm_promo,
        "extended_guest_line_gross": eg,
        "extended_guests_after_promos": ext_after,
        "extended_guest_pricing_rule": ext_rule,
        "extended_guest_promo_applied": ext_promo,
        "family_line_gross": fam_line_gross,
        "family_after_promos": fam_after,
        "family_promo_applied": family_promo_applied,
        "family_pricing_rule": family_pricing_rule,
        "list_subtotal": list_subtotal,
        "offer_subtotal": total,
        "portal_discount_total": portal_discount_total,
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

    client_row = await db.clients.find_one(
        {"id": client_id},
        {"immediate_family_locked": 1, "immediate_family_editing_approved": 1, "immediate_family": 1},
    )
    prev_family = (client_row or {}).get("immediate_family") or []
    locked_flag = bool(client_row and client_row.get("immediate_family_locked"))
    legacy_filled = _immediate_family_has_names(prev_family)
    locked = locked_flag or legacy_filled
    approved = bool(client_row and client_row.get("immediate_family_editing_approved"))
    if locked and not approved:
        raise HTTPException(
            status_code=403,
            detail="Your immediate family list is locked. Contact support if you need an admin to allow edits.",
        )

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

    now_iso = datetime.now(timezone.utc).isoformat()
    set_doc = {
        "immediate_family": out,
        "updated_at": now_iso,
    }
    if len(out) > 0 or locked_flag or legacy_filled:
        set_doc["immediate_family_locked"] = True

    await db.clients.update_one({"id": client_id}, {"$set": set_doc})
    locked_after = bool(set_doc.get("immediate_family_locked")) or _immediate_family_has_names(out)
    return {
        "message": "Family list saved",
        "immediate_family": out,
        "immediate_family_locked": locked_after,
        "immediate_family_editing_approved": approved,
    }


@router.put("/other-guests")
async def update_other_guests(data: FamilyUpdate, user: dict = Depends(get_current_user)):
    """Friends, cousins, extended family, etc. — same fields as immediate family; max 12 rows."""
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
                detail=f"Guest row “{name}”: add an email address to receive enrollment notifications, or turn off Notify.",
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
            "other_guests": out,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    return {"message": "Guest list saved", "other_guests": out}


@router.get("/enrollment-prefill")
async def get_enrollment_prefill(user: dict = Depends(get_current_user)):
    """Profile + family list for dashboard-origin enrollment (skip retyping public form fields)."""
    client_id = user.get("client_id")
    client = await db.clients.find_one({"id": client_id}, {"_id": 0}) or {} if client_id else {}
    self_data = _profile_snapshot_for_prefill(user, client)
    family = client.get("immediate_family") or []
    other_guests = client.get("other_guests") or []
    return {"self": self_data, "immediate_family": family, "other_guests": other_guests}


async def _portal_combined_dashboard_total(user: dict, profile: ProfileData) -> Optional[Tuple[float, str]]:
    """Sum annual portal quotes for cart lines (same basis as GET /dashboard-quote). Sets checkout total like dashboard-pay."""
    lines = profile.portal_cart_lines
    if not lines:
        return None
    client_id = user.get("client_id")
    if not client_id:
        return None
    client = await db.clients.find_one({"id": client_id}, {"_id": 0}) or {}
    sub = client.get("subscription") or {}
    if not _is_annual_subscriber(sub, client):
        return None
    cur = (profile.portal_cart_currency or "aed").strip().lower()
    settings_doc = await db.site_settings.find_one(
        {"id": "site_settings"},
        {
            "_id": 0,
            "dashboard_offer_annual": 1,
            "dashboard_offer_family": 1,
            "dashboard_offer_extended": 1,
            "annual_package_included_program_ids": 1,
            "dashboard_program_offers": 1,
        },
    ) or {}
    fam_all = _all_dashboard_guest_rows(client)
    fam_by_id = {str(m.get("id")) for m in fam_all if m.get("id")}
    g_ao = settings_doc.get("dashboard_offer_annual") or {}
    g_fo = settings_doc.get("dashboard_offer_family") or {}
    g_eo = settings_doc.get("dashboard_offer_extended") or {}
    per_map = settings_doc.get("dashboard_program_offers") or {}
    inc_cfg = settings_doc.get("annual_package_included_program_ids")
    total = 0.0
    for line in lines:
        pid = str(line.program_id).strip()
        if not pid:
            continue
        program = await db.programs.find_one({"id": pid}, {"_id": 0})
        if not program:
            raise HTTPException(status_code=400, detail=f"Unknown program in cart: {pid}")
        id_list = [str(x).strip() for x in (line.family_member_ids or []) if str(x).strip()]
        for i in id_list:
            if i not in fam_by_id:
                raise HTTPException(status_code=400, detail="Unknown guest id in portal cart")
        if id_list:
            imm_fc, ext_fc = _split_guest_ids_by_bucket(client, id_list)
        else:
            imm_fc, ext_fc = 0, 0
        included = _program_included_in_annual_package(program, inc_cfg)
        if included:
            include_self = False
        else:
            include_self = bool(line.booker_joins)
        ao, fo, eo = _merge_program_dashboard_offers(g_ao, g_fo, g_eo, pid, per_map)
        pricing = await compute_dashboard_annual_family_pricing(
            program,
            pid,
            cur,
            imm_fc,
            ext_fc,
            ao,
            fo,
            eo,
            include_self=include_self,
        )
        total += float(pricing.get("total") or 0)
    return round(total, 2), cur


@router.post("/combined-enrollment-start")
async def student_combined_enrollment_start(profile: ProfileData, request: Request, user: dict = Depends(get_current_user)):
    """Portal Divine Cart: create enrollment without email OTP; booker must match logged-in student."""
    uemail = (user.get("email") or "").strip().lower()
    if not uemail:
        raise HTTPException(status_code=400, detail="Account has no email")
    if uemail != profile.booker_email.strip().lower():
        raise HTTPException(status_code=403, detail="Booker email must match your logged-in account.")
    mixed = await _portal_combined_dashboard_total(user, profile)
    result = await insert_enrollment_from_profile(profile, request, trusted_contact=True)
    if mixed:
        tot, cur = mixed
        await db.enrollments.update_one(
            {"id": result["enrollment_id"]},
            {
                "$set": {
                    "dashboard_mixed_total": tot,
                    "dashboard_mixed_currency": cur,
                    "dashboard_checkout_ready": True,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        )
    return result


@router.get("/dashboard-quote")
async def dashboard_quote(
    program_id: str,
    family_count: int = 0,
    family_ids: str = "",
    currency: str = "aed",
    booker_joins: bool = True,
    tier_index: Optional[int] = Query(None, description="Flagship duration tier index (1 month, 3 month, annual, …)"),
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
    fam = _all_dashboard_guest_rows(client)
    id_list = [x.strip() for x in (family_ids or "").split(",") if x.strip()]
    if id_list:
        fam_by_id = {str(m.get("id")) for m in fam if m.get("id")}
        for i in id_list:
            if i not in fam_by_id:
                raise HTTPException(status_code=400, detail="Unknown guest id")
        fc = len(id_list)
    else:
        fc = max(0, int(family_count))
    if fc > 12:
        raise HTTPException(status_code=400, detail="Invalid family count")
    if fc > len(fam):
        raise HTTPException(status_code=400, detail="Save more people on your dashboard (immediate family or friends & extended) to cover this many seats")
    if id_list:
        imm_fc, ext_fc = _split_guest_ids_by_bucket(client, id_list)
    else:
        imm_fc, ext_fc = fc, 0
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
            "dashboard_offer_extended": 1,
            "annual_package_included_program_ids": 1,
            "dashboard_program_offers": 1,
            "india_gst_percent": 1,
            "dashboard_annual_quote_show_tax": 1,
        },
    ) or {}
    included = _program_included_in_annual_package(program, settings_doc.get("annual_package_included_program_ids"))
    if included:
        include_self = False
    else:
        include_self = bool(booker_joins)
    g_ao = settings_doc.get("dashboard_offer_annual") or {}
    g_fo = settings_doc.get("dashboard_offer_family") or {}
    g_eo = settings_doc.get("dashboard_offer_extended") or {}
    per_map = settings_doc.get("dashboard_program_offers") or {}
    ao, fo, eo = _merge_program_dashboard_offers(g_ao, g_fo, g_eo, program_id, per_map)
    pricing = await compute_dashboard_annual_family_pricing(
        program,
        program_id,
        currency,
        imm_fc,
        ext_fc,
        ao,
        fo,
        eo,
        include_self=include_self,
        tier_index_override=tier_index,
    )
    cur = str(pricing.get("currency") or "aed").lower()
    gst_pct = float(settings_doc.get("india_gst_percent") or 18)
    tot = float(pricing.get("total") or 0)
    quote_show_tax = settings_doc.get("dashboard_annual_quote_show_tax", True)
    if quote_show_tax is None:
        quote_show_tax = True
    quote_show_tax = bool(quote_show_tax)
    tax_included_estimate = 0.0
    if quote_show_tax and cur == "inr" and gst_pct > 0 and tot > 0:
        tax_included_estimate = round(tot - tot / (1 + gst_pct / 100), 2)
    return {
        "program_id": program_id,
        "program_title": program.get("title", ""),
        "included_in_annual_package": included,
        "program_portal_pricing_override": _program_has_portal_pricing_override(per_map, program_id),
        **pricing,
        "quote_show_tax": quote_show_tax,
        "tax_rate_pct": gst_pct if cur == "inr" and quote_show_tax else 0.0,
        "tax_included_estimate": tax_included_estimate if cur == "inr" and quote_show_tax else 0.0,
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
            "dashboard_offer_extended": 1,
            "annual_package_included_program_ids": 1,
            "dashboard_program_offers": 1,
        },
    ) or {}
    included = _program_included_in_annual_package(program, settings_doc.get("annual_package_included_program_ids"))
    all_guests = _all_dashboard_guest_rows(client)
    resolved_family = _resolve_family_rows(client, list(data.family_member_ids or []), int(data.family_count or 0))
    imm_fc, ext_fc = _split_resolved_guest_rows_by_bucket(client, resolved_family)
    fc = len(resolved_family)
    if fc > 12:
        raise HTTPException(status_code=400, detail="Invalid family count")
    if fc > len(all_guests):
        raise HTTPException(status_code=400, detail="Save more people on your dashboard (immediate family or friends & extended) to cover this many seats")

    if included and fc == 0:
        raise HTTPException(
            status_code=400,
            detail="This program is already included in your annual package — select one or more family members to enroll.",
        )

    g_ao = settings_doc.get("dashboard_offer_annual") or {}
    g_fo = settings_doc.get("dashboard_offer_family") or {}
    g_eo = settings_doc.get("dashboard_offer_extended") or {}
    per_map = settings_doc.get("dashboard_program_offers") or {}
    ao, fo, eo = _merge_program_dashboard_offers(g_ao, g_fo, g_eo, data.program_id, per_map)
    quote = await compute_dashboard_annual_family_pricing(
        program,
        data.program_id,
        data.currency,
        imm_fc,
        ext_fc,
        ao,
        fo,
        eo,
        include_self=not included,
    )
    if quote["total"] <= 0:
        raise HTTPException(status_code=400, detail="No payable amount for this program")

    pref_by_id = {
        str(x.family_member_id).strip(): x
        for x in (data.guest_seat_prefs or [])
        if str(x.family_member_id).strip()
    }

    snap = _profile_snapshot_for_prefill(user, client)
    booker_email_raw = (snap.get("email") or user.get("email") or "").strip()
    if not included and bool(data.booker_notify) and not booker_email_raw:
        raise HTTPException(
            status_code=400,
            detail="Your profile needs an email on file to receive enrollment notifications, or turn off Notify for your seat.",
        )
    for m in resolved_family:
        mid = str(m.get("id") or "").strip()
        pref = pref_by_id.get(mid)
        wants = bool(pref.notify_enrollment if pref else False)
        if wants and not (m.get("email") or "").strip():
            raise HTTPException(
                status_code=400,
                detail=f"Add an email for {(m.get('name') or 'guest').strip() or 'this guest'} to use Notify, or turn off Notify for them.",
            )

    def _age_int(raw) -> int:
        try:
            a = int(str(raw).strip())
            return max(5, min(120, a))
        except Exception:
            return 30

    participants: List[ParticipantData] = []
    booker_mode = _normalize_attendance_mode(data.booker_attendance_mode or "online")
    booker_wants_notify = bool(data.booker_notify)
    booker_email = snap.get("email") or user.get("email")
    if not included:
        participants.append(
            ParticipantData(
                name=snap.get("name") or user.get("name") or "Student",
                relationship="Myself",
                age=_age_int(snap.get("age")),
                gender=(snap.get("gender") or "Prefer not to say")[:40],
                country=(snap.get("country") or "AE")[:4],
                city=(snap.get("city") or "")[:120],
                state="",
                attendance_mode=booker_mode,
                notify=booker_wants_notify and bool(booker_email),
                email=booker_email,
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
        mid = str(m.get("id") or "").strip()
        pref = pref_by_id.get(mid)
        fam_mode = _normalize_attendance_mode(
            (pref.attendance_mode if pref else None) or m.get("attendance_mode") or "online"
        )
        notify_opted = bool(pref.notify_enrollment if pref else False)
        notify_ok = notify_opted and bool(fam_email)
        participants.append(
            ParticipantData(
                name=(m.get("name") or "Guest")[:200],
                relationship=(m.get("relationship") or "Other")[:80],
                age=_age_int(m.get("age")),
                gender="Prefer not to say",
                country=fam_country,
                city=(m.get("city") or "")[:120],
                state="",
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
        "participants": [p.model_dump(mode="python") for p in participants],
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

    # 1. Upcoming programs — same pipeline + ordering as public homepage (GET /api/programs?visible_only&upcoming_only)
    upcoming_models = await fetch_programs_with_deadline_sync(db, True, True)
    upcoming = [p.model_dump() for p in sort_programs_like_homepage(upcoming_models)]

    settings_doc = await db.site_settings.find_one(
        {"id": "site_settings"},
        {
            "_id": 0,
            "dashboard_offer_annual": 1,
            "dashboard_offer_family": 1,
            "dashboard_offer_extended": 1,
            "dashboard_program_offers": 1,
            "india_gpay_accounts": 1,
            "india_bank_accounts": 1,
            "india_bank_details": 1,
            "india_upi_id": 1,
        },
    ) or {}
    dashboard_offer_annual = settings_doc.get("dashboard_offer_annual") or {}
    dashboard_offer_family = settings_doc.get("dashboard_offer_family") or {}
    dashboard_offer_extended = settings_doc.get("dashboard_offer_extended") or {}
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

    # 7b. India tax info from the client record (per-user setting)
    india_tax_info = None
    if client.get("india_tax_enabled"):
        india_tax_info = {
            "enabled": True,
            "percent": client.get("india_tax_percent", 18.0),
            "label": client.get("india_tax_label", "GST"),
            "visible_on_dashboard": client.get("india_tax_visible_on_dashboard", True),
        }

    # 8. Payment methods & bank details
    payment_methods = sub.get("payment_methods", ["stripe", "manual"])
    payment_destinations = sub.get("payment_destinations") or {}
    banks = await db.bank_accounts.find({"is_active": True}, {"_id": 0}).to_list(10)

    iris_journey = resolve_iris_journey(sub)

    from routes.points_logic import points_public_summary

    loyalty_points = await points_public_summary(db, user.get("email") or "")

    is_annual = _is_annual_subscriber(sub, client)
    immediate_family = client.get("immediate_family") or []
    other_guests = client.get("other_guests") or []
    immediate_family_locked = _immediate_family_effective_locked(client)
    immediate_family_editing_approved = bool(client.get("immediate_family_editing_approved"))

    return {
        "client_id": client_id,
        "upcoming_programs": upcoming,
        "is_annual_subscriber": is_annual,
        "dashboard_offers": {
            "annual": dashboard_offer_annual,
            "family": dashboard_offer_family,
            "extended": dashboard_offer_extended,
        },
        "dashboard_program_offers": dashboard_program_offers,
        "immediate_family": immediate_family,
        "other_guests": other_guests,
        "immediate_family_locked": immediate_family_locked,
        "immediate_family_editing_approved": immediate_family_editing_approved,
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
        "india_tax_info": india_tax_info,
        "preferred_india_gpay_id": (sub.get("preferred_india_gpay_id") or "").strip(),
        "preferred_india_bank_id": (sub.get("preferred_india_bank_id") or "").strip(),
    }


def _student_order_email_pattern(email: str):
    """Case-insensitive exact match for participant / booker email fields."""
    return re.compile(f"^{re.escape((email or '').strip().lower())}$", re.IGNORECASE)


async def _order_identity_emails(user: dict) -> List[str]:
    """
    Emails used to match payment_transactions and enrollments.
    Includes the portal account email and, when present, the linked Client Garden email
    (covers legacy checkouts booked under the CRM address while login uses Google alias).
    """
    out: List[str] = []

    def push(raw: Optional[str]) -> None:
        s = (raw or "").strip().lower()
        if s and s not in out:
            out.append(s)

    push(user.get("email"))
    cid = (user.get("client_id") or "").strip()
    if cid:
        client_doc = await db.clients.find_one({"id": cid}, {"_id": 0, "email": 1})
        if client_doc:
            push(client_doc.get("email"))
    return out


def _enrollment_booker_email_norm_expr(em: str) -> dict:
    """booker_email equals em after trim + lowercase (handles stray whitespace in DB)."""
    return {
        "$expr": {
            "$eq": [
                {"$toLower": {"$trim": {"input": {"$ifNull": ["$booker_email", ""]}}}},
                em,
            ]
        }
    }


def _enrollment_participant_email_norm_expr(em: str) -> dict:
    """Any participant.email equals em after trim + lowercase."""
    return {
        "$expr": {
            "$gt": [
                {
                    "$size": {
                        "$filter": {
                            "input": {"$ifNull": ["$participants", []]},
                            "as": "p",
                            "cond": {
                                "$eq": [
                                    {
                                        "$toLower": {
                                            "$trim": {
                                                "input": {"$ifNull": ["$$p.email", ""]},
                                            }
                                        }
                                    },
                                    em,
                                ]
                            },
                        }
                    }
                },
                0,
            ]
        }
    }


def _txn_email_field_norm_expr(field: str, em: str) -> dict:
    """payment_transactions: field equals em after trim + lowercase."""
    return {
        "$expr": {
            "$eq": [
                {"$toLower": {"$trim": {"input": {"$ifNull": [f"${field}", ""]}}}},
                em,
            ]
        }
    }


def _india_proof_email_norm_expr(field: str, em: str) -> dict:
    """india_payment_proofs payer/booker email normalized match."""
    return {
        "$expr": {
            "$eq": [
                {"$toLower": {"$trim": {"input": {"$ifNull": [f"${field}", ""]}}}},
                em,
            ]
        }
    }


def _serialize_payment_transaction_row(row: dict) -> dict:
    out: Dict = {}
    for k, v in row.items():
        if k == "_id":
            continue
        if isinstance(v, datetime):
            if v.tzinfo is None:
                v = v.replace(tzinfo=timezone.utc)
            out[k] = v.isoformat()
        else:
            out[k] = v
    return out


def _student_order_sort_ts(doc: dict) -> float:
    for key in ("created_at", "updated_at"):
        v = doc.get(key)
        if v is None:
            continue
        if isinstance(v, datetime):
            if v.tzinfo is None:
                v = v.replace(tzinfo=timezone.utc)
            return v.timestamp()
        if isinstance(v, str):
            try:
                s = v.replace("Z", "+00:00")
                d = datetime.fromisoformat(s)
                if d.tzinfo is None:
                    d = d.replace(tzinfo=timezone.utc)
                return d.timestamp()
            except Exception:
                continue
    return 0.0


def _order_display_title_from_enrollment(
    enrollment: Optional[dict],
    order_row: dict,
    prog_titles_by_id: Dict[str, str],
) -> str:
    """
    Show the program(s) the student actually signed up for.
    Checkout often stores only the lead line's title on the transaction; combined carts
    duplicate each seat's program_title on participant rows and/or list program_id in portal_cart_lines.
    """
    txn_fallback = (order_row.get("item_title") or "").strip()
    if not enrollment:
        return txn_fallback or (order_row.get("item_id") or "") or "Order"

    titles: List[str] = []
    for p in enrollment.get("participants") or []:
        t = (p.get("program_title") or "").strip()
        if t and t not in titles:
            titles.append(t)
    if len(titles) > 1:
        return " · ".join(titles)
    if len(titles) == 1:
        return titles[0]

    for line in enrollment.get("portal_cart_lines") or []:
        pid = str(line.get("program_id") or "").strip()
        t = (prog_titles_by_id.get(pid) or "").strip()
        if t and t not in titles:
            titles.append(t)
    if len(titles) > 1:
        return " · ".join(titles)
    if len(titles) == 1:
        return titles[0]

    lead_pid = (enrollment.get("item_id") or "").strip()
    if lead_pid:
        t = (prog_titles_by_id.get(lead_pid) or "").strip()
        if t:
            return t

    en_title = (enrollment.get("item_title") or "").strip()
    if en_title:
        return en_title

    tid = (order_row.get("item_id") or "").strip()
    if tid and (order_row.get("item_type") or "").lower() == "program":
        t = (prog_titles_by_id.get(tid) or "").strip()
        if t:
            return t

    return txn_fallback or tid or "Order"


async def list_student_orders_impl(user: dict):
    """
    Enrollment-related payment rows for this account: booker, sponsor donor,
    or a seat where this email appears on the enrollment.
    Includes pending India payment proofs (awaiting admin approval) as rows with payment_status pending.
    """
    identity_emails = await _order_identity_emails(user)
    if not identity_emails:
        raise HTTPException(status_code=400, detail="No email on account")

    uid = user.get("id")
    cid = (user.get("client_id") or "").strip()

    participant_or: List[dict] = []
    booker_or: List[dict] = []
    txn_email_or: List[dict] = []
    proof_email_or: List[dict] = []

    for em in identity_emails:
        ep = _student_order_email_pattern(em)
        participant_or.extend(
            [
                {"participants": {"$elemMatch": {"email": ep}}},
                {"participants": {"$elemMatch": {"email": em}}},
                _enrollment_participant_email_norm_expr(em),
            ]
        )
        booker_or.extend(
            [
                {"booker_email": ep},
                {"booker_email": em},
                _enrollment_booker_email_norm_expr(em),
            ]
        )
        txn_email_or.extend(
            [
                {"booker_email": ep},
                {"booker_email": em},
                {"donor_email": ep},
                {"donor_email": em},
                {"payer_email": ep},
                {"payer_email": em},
                _txn_email_field_norm_expr("booker_email", em),
                _txn_email_field_norm_expr("donor_email", em),
                _txn_email_field_norm_expr("payer_email", em),
            ]
        )
        proof_email_or.extend(
            [
                {"payer_email": ep},
                {"booker_email": ep},
                {"payer_email": em},
                {"booker_email": em},
                _india_proof_email_norm_expr("payer_email", em),
                _india_proof_email_norm_expr("booker_email", em),
            ]
        )

    participant_enrollments = await db.enrollments.find(
        {"$or": participant_or},
        {"id": 1, "_id": 0},
    ).to_list(600)
    pid_list = [e["id"] for e in participant_enrollments if e.get("id")]

    # Booker's email is not always duplicated on participant rows; include enrollments they booked.
    booker_enrollments = await db.enrollments.find(
        {"$or": booker_or},
        {"id": 1, "_id": 0},
    ).to_list(600)
    bid_list = [e["id"] for e in booker_enrollments if e.get("id")]
    enrollment_ids_for_user = sorted(set(pid_list) | set(bid_list))

    or_clauses: List[dict] = list(txn_email_or)
    if uid:
        or_clauses.append({"portal_user_id": uid})
    if cid:
        or_clauses.append({"portal_client_id": cid})
    if enrollment_ids_for_user:
        or_clauses.append({"enrollment_id": {"$in": enrollment_ids_for_user}})

    cursor = (
        db.payment_transactions.find({"$or": or_clauses}, {"_id": 0, "participants": 0})
        .sort([("created_at", -1), ("updated_at", -1)])
        .limit(300)
    )
    rows = await cursor.to_list(300)

    proof_or: List[dict] = list(proof_email_or)
    if enrollment_ids_for_user:
        proof_or.append({"enrollment_id": {"$in": enrollment_ids_for_user}})

    pending_proofs = await db.india_payment_proofs.find(
        {"status": "pending", "$or": proof_or},
        {"_id": 0},
    ).sort("created_at", -1).to_list(80)

    paid_eids = {
        str(r.get("enrollment_id") or "")
        for r in rows
        if str(r.get("enrollment_id") or "")
        and str(r.get("payment_status") or "").lower() == "paid"
    }

    pending_as_orders: List[dict] = []
    seen_pending_eid = set()
    for p in pending_proofs:
        eid = str(p.get("enrollment_id") or "")
        if eid and eid in paid_eids:
            continue
        if eid and eid in seen_pending_eid:
            continue
        if eid:
            seen_pending_eid.add(eid)
        pending_as_orders.append(
            {
                "id": f"india-proof-pending-{p['id']}",
                "enrollment_id": p.get("enrollment_id"),
                "stripe_session_id": None,
                "item_type": p.get("item_type") or "program",
                "item_id": p.get("item_id") or "",
                "item_title": p.get("program_title")
                or p.get("selected_item")
                or "India payment (pending approval)",
                "amount": p.get("amount"),
                "currency": "inr",
                "payment_status": "pending",
                "payment_method": "manual_proof",
                "india_payment_method": (p.get("payment_method") or "").strip().lower(),
                "is_india_proof_pending": True,
                "created_at": p.get("created_at"),
                "updated_at": p.get("updated_at") or p.get("created_at"),
                "participant_count": p.get("participant_count", 1),
            }
        )

    combined: List[dict] = [_serialize_payment_transaction_row(r) for r in rows]
    combined.extend(_serialize_payment_transaction_row(r) for r in pending_as_orders)
    combined.sort(key=_student_order_sort_ts, reverse=True)

    eids = {str(o.get("enrollment_id") or "").strip() for o in combined if o.get("enrollment_id")}
    eids.discard("")
    if eids:
        enrollments_list = await db.enrollments.find(
            {"id": {"$in": list(eids)}},
            {"_id": 0, "id": 1, "item_title": 1, "participants": 1, "portal_cart_lines": 1},
        ).to_list(max(len(eids), 1))
        by_eid = {e["id"]: e for e in enrollments_list}
        prog_ids: List[str] = []
        for e in enrollments_list:
            eid0 = str(e.get("item_id") or "").strip()
            if eid0 and eid0 not in prog_ids:
                prog_ids.append(eid0)
            for line in e.get("portal_cart_lines") or []:
                pid = str(line.get("program_id") or "").strip()
                if pid and pid not in prog_ids:
                    prog_ids.append(pid)
        prog_titles_by_id: Dict[str, str] = {}
        for o in combined:
            if (o.get("item_type") or "").lower() == "program":
                tid = str(o.get("item_id") or "").strip()
                if tid and tid not in prog_ids:
                    prog_ids.append(tid)
        if prog_ids:
            for p in await db.programs.find(
                {"id": {"$in": prog_ids}},
                {"_id": 0, "id": 1, "title": 1},
            ).to_list(len(prog_ids)):
                prog_titles_by_id[p["id"]] = (p.get("title") or "").strip()
        for o in combined:
            eid = str(o.get("enrollment_id") or "").strip()
            if not eid:
                continue
            if (o.get("item_type") or "").lower() == "sponsor":
                continue
            o["item_title"] = _order_display_title_from_enrollment(
                by_eid.get(eid),
                o,
                prog_titles_by_id,
            )

    return {"orders": combined}


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
