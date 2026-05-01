from fastapi import APIRouter, HTTPException, Request, Depends, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Tuple, Set, Any
import os
import re
import uuid
import logging
from motor.motor_asyncio import AsyncIOMotorClient
import calendar
import math
from datetime import datetime, timezone, date
from dotenv import load_dotenv
from pathlib import Path
from .auth import get_current_user, _get_valid_session_and_user
from models_extended import JourneyLog
from iris_journey import resolve_iris_journey, iris_journey_with_year
from routes.programs import (
    fetch_programs_with_deadline_sync,
    program_dict_with_deadline_sync,
    sort_programs_like_homepage,
)
from routes.enrollment import ProfileData, insert_enrollment_from_profile
from routes.clients import (
    HOME_COMING_SKU,
    annual_portal_lifecycle_payload,
    annual_renewal_reminder_for_portal,
    annual_subscription_period_expired,
    ensure_client_from_enrollment_lead,
)
from routes.currency import assert_claimed_hub_matches_stripe
from country_normalize import normalize_country_iso2
from utils.person_name import normalize_person_name
from utils.garden_labels import (
    iris_anniversary_year_from_client,
    iris_year_from_garden_label,
    label_stripe_key,
)
from utils.india_checkout_math import _resolve_india_discount_rule

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/api/student", tags=["Student Dashboard"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

logger = logging.getLogger(__name__)


def _optional_float(v: Any) -> Optional[float]:
    if v is None or v == "":
        return None
    try:
        n = float(v)
        return n if math.isfinite(n) else None
    except (TypeError, ValueError):
        return None


def _subscription_is_authoritative(sub: Optional[dict]) -> bool:
    """True when Excel/subscriber row carries a priced package (overrides CRM portal fee defaults)."""
    if not sub:
        return False
    if str(sub.get("package_id") or "").strip():
        return True
    try:
        if float(sub.get("total_fee") or 0) > 0:
            return True
    except (TypeError, ValueError):
        pass
    emis = sub.get("emis")
    return isinstance(emis, list) and len(emis) > 0


def _merge_portal_late_channel_show(client: dict, sub: Optional[dict], site_doc: dict) -> Dict[str, Any]:
    sub = sub or {}
    ss = site_doc or {}
    auth = _subscription_is_authoritative(sub)
    std_late = _optional_float(ss.get("portal_standard_late_fee_per_day"))
    if std_late is None:
        std_late = 0.0
    std_ch = _optional_float(ss.get("portal_standard_channelization_fee"))
    if std_ch is None:
        std_ch = 0.0
    std_show_raw = ss.get("portal_standard_show_late_fees")
    std_show = True if std_show_raw is None else bool(std_show_raw)

    crm_late = _optional_float(client.get("crm_late_fee_per_day"))
    crm_ch = _optional_float(client.get("crm_channelization_fee"))
    crm_show = client.get("crm_show_late_fees")

    late_sub = _optional_float(sub.get("late_fee_per_day")) if auth else None
    ch_sub = _optional_float(sub.get("channelization_fee")) if auth else None

    late = late_sub if late_sub is not None else (crm_late if crm_late is not None else std_late)
    channel = ch_sub if ch_sub is not None else (crm_ch if crm_ch is not None else std_ch)

    if auth and sub.get("show_late_fees") is not None:
        show = bool(sub.get("show_late_fees"))
    elif crm_show is not None:
        show = bool(crm_show)
    else:
        show = std_show

    return {"late_fee_per_day": late, "channelization_fee": channel, "show_late_fees": show}


def _portal_std_india_tax(site_doc: dict) -> float:
    ss = site_doc or {}
    v = _optional_float(ss.get("portal_standard_india_tax_percent"))
    if v is not None:
        return v
    g = _optional_float(ss.get("india_gst_percent"))
    return float(g if g is not None else 18.0)


def _crm_only_discount_dict(client: Optional[dict]) -> dict:
    """CRM `india_discount_percent` + member bands only (not site portal default %)."""
    c = client or {}
    return {
        "india_discount_percent": c.get("india_discount_percent"),
        "india_discount_member_bands": c.get("india_discount_member_bands"),
    }


def _dashboard_quote_participant_count(
    include_self: bool,
    imm_plain: int,
    imm_peer: int,
    ext_fc: int,
) -> int:
    n = (1 if include_self else 0) + max(0, int(imm_plain)) + max(0, int(imm_peer)) + max(0, int(ext_fc))
    return max(1, n)


def _apply_crm_discount_to_total(
    total_before: float,
    currency: str,
    client: dict,
    participant_count: int,
) -> Tuple[float, float, Optional[float]]:
    """Apply CRM percent / INR amount rules to a single total. Returns (after, discount_amt, percent_or_none)."""
    cur = (currency or "").lower()
    t = float(total_before or 0)
    if t <= 0:
        return t, 0.0, None
    rule = _resolve_india_discount_rule(_crm_only_discount_dict(client), participant_count)
    mode = rule.get("mode") or "percent"
    disc_amt = 0.0
    pct_out: Optional[float] = None
    if mode == "percent":
        pct = float(rule.get("percent") or 0)
        if pct > 0:
            disc_amt = round(t * pct / 100.0, 2)
            pct_out = pct
    elif mode == "amount" and cur == "inr":
        amt = float(rule.get("amount_inr") or 0)
        if amt > 0:
            disc_amt = round(min(t, amt), 2)
    after = round(max(0.0, t - disc_amt), 2)
    return after, disc_amt, pct_out


def _apply_crm_portal_discount_to_pricing_total(
    pricing: dict,
    client: dict,
    currency: str,
    participant_count: int,
) -> dict:
    """Extend portal pricing dict so Sacred Home quotes match Client Garden CRM discount."""
    tot = float(pricing.get("total") or 0)
    after, disc_amt, disc_pct = _apply_crm_discount_to_total(tot, currency, client, participant_count)
    if disc_amt <= 0:
        return {**pricing, "client_crm_discount_amount": None, "client_crm_discount_percent": None}
    portal_disc = float(pricing.get("portal_discount_total") or 0)
    return {
        **pricing,
        "total": after,
        "offer_subtotal": after,
        "portal_discount_total": round(portal_disc + disc_amt, 2),
        "client_crm_discount_amount": disc_amt,
        "client_crm_discount_percent": disc_pct,
    }


def _merge_client_india_pricing_portal(client: dict, sub: Optional[dict], site_doc: dict) -> Dict[str, Any]:
    """Merged India manual-checkout fields for Sacred Home.

    Discount: authoritative subscription ``individual_discount_pct`` when set; else CRM
    ``india_discount_percent`` when parsed; else **0** (unset/blank CRM is not filled from site defaults).
    Tax still follows subscription overrides or CRM/site merge below. Member bands use the merged percent context.
    """
    sub = sub or {}
    auth = _subscription_is_authoritative(sub)
    std_tax = _portal_std_india_tax(site_doc)

    sub_disc_f = _optional_float(sub.get("individual_discount_pct")) if auth else None

    if auth and sub_disc_f is not None:
        eff_disc = float(sub_disc_f)
    else:
        cp = _optional_float(client.get("india_discount_percent"))
        eff_disc = float(cp if cp is not None else 0.0)

    sub_tax_f = _optional_float(sub.get("individual_tax_pct")) if auth else None

    if auth and sub_tax_f is not None:
        eff_tax = float(sub_tax_f)
        eff_tax_enabled = eff_tax > 0
        eff_label = client.get("india_tax_label") or "GST"
    else:
        eff_tax_enabled = bool(client.get("india_tax_enabled"))
        eff_label = client.get("india_tax_label") or "GST"
        if eff_tax_enabled:
            cp = _optional_float(client.get("india_tax_percent"))
            eff_tax = float(cp if cp is not None else std_tax)
        else:
            eff_tax = float(_optional_float(client.get("india_tax_percent")) or 0.0)

    bands = client.get("india_discount_member_bands")
    if not isinstance(bands, list):
        bands = None

    pm = (client.get("india_payment_method") or "").strip()
    return {
        "india_payment_method": pm or None,
        "india_discount_percent": eff_disc,
        "india_discount_member_bands": bands or None,
        "india_tax_enabled": eff_tax_enabled,
        "india_tax_percent": eff_tax,
        "india_tax_label": eff_label,
    }


async def _student_client_row_with_expiry(client_id: Optional[str]) -> dict:
    """Load client row. Effective annual access is date-gated in :func:`_annual_dashboard_access` (CRM flag kept for admin)."""
    if not client_id:
        return {}
    return await db.clients.find_one({"id": client_id}, {"_id": 0}) or {}


async def get_current_student_user(request: Request, user: dict = Depends(get_current_user)):
    """Like ``get_current_user`` but enforces Sacred Home maintenance mode (503) when enabled."""
    session, _ = await _get_valid_session_and_user(request)
    if session and session.get("impersonation"):
        return user
    doc = await db.site_settings.find_one(
        {"id": "site_settings"},
        {
            "_id": 0,
            "dashboard_maintenance_enabled": 1,
            "dashboard_maintenance_message": 1,
            "dashboard_maintenance_bypass_emails": 1,
        },
    )
    if not doc or not bool(doc.get("dashboard_maintenance_enabled")):
        return user
    em = (user.get("email") or "").strip().lower()
    bypass = doc.get("dashboard_maintenance_bypass_emails") or []
    bypass_set = {
        str(x).strip().lower()
        for x in bypass
        if str(x).strip() and "@" in str(x)
    }
    if em in bypass_set:
        return user
    msg = (doc.get("dashboard_maintenance_message") or "").strip() or (
        "Sacred Home is temporarily unavailable while we make improvements. Please check back soon."
    )
    raise HTTPException(
        status_code=503,
        detail={"maintenance": True, "message": msg},
    )


async def _student_enrolled_program_choices(email: str) -> List[dict]:
    from routes.points_logic import normalize_email

    em = normalize_email(email or "")
    if not em:
        return []
    seen: Dict[str, dict] = {}
    cursor = db.enrollments.find(
        {"booker_email": em, "item_type": "program", "item_id": {"$exists": True, "$ne": ""}},
        {"_id": 0, "item_id": 1, "item_title": 1},
    )
    async for doc in cursor:
        pid = str(doc.get("item_id") or "").strip()
        if not pid or pid in seen:
            continue
        seen[pid] = {
            "id": pid,
            "title": (doc.get("item_title") or "").strip() or pid,
        }
    return list(seen.values())


async def _student_has_enrollment_for_program(email: str, program_id: str) -> bool:
    from routes.points_logic import normalize_email

    em = normalize_email(email or "")
    pid = (program_id or "").strip()
    if not em or not pid:
        return False
    doc = await db.enrollments.find_one(
        {"booker_email": em, "item_type": "program", "item_id": pid},
        {"_id": 1},
    )
    return doc is not None


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


def _merged_preferred_india_ids(sub: dict, client: dict) -> Tuple[str, str]:
    """Subscription tags win when set; client-level tags apply for intake-only / CRM rows."""
    gpay_sub = (sub.get("preferred_india_gpay_id") or "").strip()
    bank_sub = (sub.get("preferred_india_bank_id") or "").strip()
    gpay_cli = (client.get("preferred_india_gpay_id") or "").strip()
    bank_cli = (client.get("preferred_india_bank_id") or "").strip()
    return (gpay_sub or gpay_cli, bank_sub or bank_cli)


_HOME_COMING_INCLUDES: List[Dict[str, str]] = [
    {"id": "awrp", "short": "AWRP", "summary": "12 months · Atomic Weight Release Program"},
    {"id": "mmm", "short": "MMM", "summary": "6 months · Money Magic Multiplier"},
    {"id": "turbo", "short": "Turbo Release", "summary": "4 Turbo Release sessions"},
    {"id": "meta", "short": "Meta Downloads", "summary": "2 Meta Downloads sessions"},
]


def _offer_total_from_annual_package(pkg_row: Optional[dict], currency: str) -> float:
    """Admin Home Coming bundle total on ``annual_packages.offer_total`` (keys INR / USD / AED).

    Mirrors subscriber add/edit logic: this is the canonical catalog checkout total when present.
    """
    if not pkg_row or not isinstance(pkg_row.get("offer_total"), dict):
        return 0.0
    ot = pkg_row["offer_total"]
    cu = (currency or "aed").strip().lower()
    for k in (cu.upper(), cu, cu.capitalize()):
        if k in ot and ot[k] is not None and str(ot[k]).strip() != "":
            try:
                return max(0.0, round(float(ot[k]), 2))
            except (TypeError, ValueError):
                pass
    for key, val in ot.items():
        if key is not None and str(key).lower() == cu:
            try:
                return max(0.0, round(float(val), 2))
            except (TypeError, ValueError):
                return 0.0
    return 0.0


def _trim_calendar_ymd(v: Any) -> str:
    """Return YYYY-MM-DD prefix when plausible; otherwise ''."""
    x = str(v or "").strip()
    return x[:10] if len(x) >= 10 and x[4] == "-" and x[7] == "-" else ""


def _last_annual_package_portal_payload(
    client: dict,
    sub: dict,
    pkg_row_home: Optional[dict],
) -> Optional[dict]:
    """Current / last Sacred Home enrollment window (subscription Excel + Client Garden annual_subscription)."""
    asy = client.get("annual_subscription") or {}
    start = _trim_calendar_ymd(asy.get("start_date")) or _trim_calendar_ymd(sub.get("start_date"))
    end = _trim_calendar_ymd(asy.get("end_date")) or _trim_calendar_ymd(sub.get("end_date"))
    if not start and not end:
        return None
    prog = (sub.get("annual_program") or "").strip()
    if not prog:
        prog = str((pkg_row_home or {}).get("package_name") or "").strip()
    if not prog:
        prog = str(asy.get("package_sku") or "").strip()
    pkg_id = (sub.get("package_id") or "").strip() or str(asy.get("package_sku") or "").strip()
    return {
        "program_label": prog or "Annual program",
        "package_id": pkg_id or None,
        "start_date": start or None,
        "end_date": end or None,
    }


async def _active_home_coming_package_catalog_row() -> Optional[dict]:
    """Highest-version annual package row that is still active for catalog/pricing defaults."""
    rows = (
        await db.annual_packages.find(
            {},
            {
                "_id": 0,
                "package_id": 1,
                "package_name": 1,
                "duration_months": 1,
                "valid_from": 1,
                "valid_to": 1,
                "offer_total": 1,
                "is_active": 1,
                "version": 1,
            },
        )
        .sort([("version", -1)])
        .to_list(60)
    )
    if not rows:
        return None
    for r in rows:
        if r.get("is_active") is not False:
            return r
    return rows[0]


def _home_coming_branding_dict(client: dict, iris_journey: dict) -> dict:
    """Home Coming UI: year labels + pillar includes (no subscriber gate)."""
    try:
        y = int(iris_journey.get("year") or 1)
    except (TypeError, ValueError):
        y = 1
    y = max(1, min(12, y))
    a_sub = client.get("annual_subscription") or {}
    sku_hc = (a_sub.get("package_sku") or "").strip() == HOME_COMING_SKU
    meta_title = (iris_journey.get("title") or "").strip()
    meta_sub = (iris_journey.get("subtitle") or "").strip()
    poetic = (iris_journey.get("label") or "").strip()
    return {
        "display_name": "Home Coming",
        "year": y,
        "version_label": f"Year {y}",
        "full_label": f"Home Coming · Year {y}",
        "iris_title": meta_title,
        "iris_subtitle": meta_sub,
        "iris_poetic_label": poetic,
        "subscription_sku_home_coming": sku_hc,
        "includes": [dict(x) for x in _HOME_COMING_INCLUDES],
    }


def _home_coming_payload(client: dict, sub: dict, iris_journey: dict) -> Optional[dict]:
    """Home Coming (annual) brand + version year + four pillars for the student dashboard."""
    if not _is_annual_subscriber(sub, client):
        return None
    return _home_coming_branding_dict(client, iris_journey)


def _effective_iris_journey_year(client: dict, sub: dict, iris_journey: dict) -> int:
    """Iris year for portal copy — aligns with Iris Annual Abundance / subscriber row.

    **Manual** ``iris_year_mode``: use subscription ``iris_year`` only (admin grid / Subscribers).
    **Auto**: subscription-computed year, then max with Client Garden ``Year n:`` label and
    ``annual_subscription`` anniversary (months-based), capped 1–12.
    """
    if not isinstance(client, dict):
        return 1
    sub = sub or {}
    label_raw = client.get("label") or ""
    key = label_stripe_key(label_raw)
    if key in ("dew", "seed", "root", "bloom", "iris_seeker") and not _is_annual_subscriber(sub, client):
        return 1
    try:
        jy = int((iris_journey or {}).get("year") or 1)
    except (TypeError, ValueError):
        jy = 1
    jy = max(1, min(12, jy))

    mode = (sub.get("iris_year_mode") or "manual").strip().lower()
    if mode not in ("manual", "auto"):
        mode = "manual"
    if mode == "manual":
        return min(12, jy)

    y_label = iris_year_from_garden_label(label_raw)
    if y_label is not None:
        jy = max(jy, y_label)
    ann = iris_anniversary_year_from_client(client)
    jy = max(jy, ann)
    return min(12, jy)


def _portal_home_coming_sessions_student_safe(raw: Any) -> List[Dict[str, Any]]:
    """Minimal session rows for student portal (program / slot / date / attended only)."""
    if not isinstance(raw, list):
        return []
    out: List[Dict[str, Any]] = []
    for item in raw[:48]:
        if not isinstance(item, dict):
            continue
        prog = str(item.get("program") or "").strip().lower()
        if prog not in ("awrp", "mmm", "turbo", "meta"):
            continue
        row: Dict[str, Any] = {"program": prog}
        try:
            slot = int(item.get("slot"))
            if 1 <= slot <= 24:
                row["slot"] = slot
        except (TypeError, ValueError):
            pass
        ds = item.get("date")
        if ds is not None and str(ds).strip():
            d_str = str(ds).strip()[:10]
            if len(d_str) == 10 and d_str[4] == "-" and d_str[7] == "-":
                row["date"] = d_str
        av = item.get("attended")
        if isinstance(av, bool):
            row["attended"] = av
        out.append(row)
    return out


def _portal_annual_period_ledger_safe(raw: Any) -> List[Dict[str, Any]]:
    """Student-safe slice of ``annual_period_ledger`` (prior Home Coming windows)."""
    if not isinstance(raw, list):
        return []
    allow = {
        "id",
        "archived_at",
        "source",
        "start_date",
        "end_date",
        "annual_diid",
        "package_sku",
        "iris_year_at_archive",
        "total_fee",
        "currency",
        "payment_mode",
        "annual_program",
        "num_emis",
    }
    out: List[Dict[str, Any]] = []
    for e in raw:
        if not isinstance(e, dict):
            continue
        row = {k: e[k] for k in allow if k in e}
        hcs = e.get("home_coming_sessions")
        if isinstance(hcs, list) and hcs:
            safe_hcs = _portal_home_coming_sessions_student_safe(hcs)
            if safe_hcs:
                row["home_coming_sessions"] = safe_hcs
        if row:
            out.append(row)
    return out


def renewal_entering_iris_year(client: dict, sub: dict, iris_journey: dict) -> int:
    """Which Iris year (1–12) the member is *entering* on Home Coming — automatic from Client Garden label + journey.

    Uses the canonical garden taxonomy (Dew → Year 1 entry; ``Year n: Iris …`` labels; Purple Bees / Iris Bees
    follow subscription journey). When the annual period is in renewal window, lapsed, or past end date, steps
    forward one year (max 12).
    """
    jy = _effective_iris_journey_year(client, sub, iris_journey or {})
    life = annual_portal_lifecycle_payload(client)
    st = (life or {}).get("status") or ""
    step_up = (
        st in ("expired", "renewal_due")
        or annual_subscription_period_expired(client)
    )
    if step_up:
        return min(12, jy + 1)
    return min(12, jy)


def _subscription_annual_package_signals(sub: dict) -> bool:
    """True when the subscriber record looks like a paid annual package (no CRM dashboard flag)."""
    if (sub.get("annual_program") or "").strip():
        return True
    if sub.get("package_id"):
        return True
    for p in sub.get("programs_detail") or []:
        blob = f"{p.get('label', '')} {p.get('name', '')}".lower()
        if "annual" in blob or "year" in blob or "home coming" in blob or "homecoming" in blob:
            return True
    return False


def _annual_dashboard_access(client: dict) -> bool:
    """True when the client may use Annual portal pricing (same gate as ``annual_portal_access`` on ``/home``).

    **Primary (Client Garden):** ``annual_member_dashboard`` — the **Annual program / Home Coming** cohort
    (column often shown as HC Yes / annual portal access on the client row).

    **Fallback:** subscription-shaped data (package id, annual_program, programs_detail heuristics) when CRM
    has not set the flag yet.

    **Expiry:** if ``annual_subscription.end_date`` (or equivalent) is past, :func:`annual_subscription_period_expired`
    clears effective access even when flags were left on in admin UIs.

    Drives portal offers, tier promotional pricing, package inclusion, and household club eligibility.
    """
    if annual_subscription_period_expired(client):
        return False
    if bool(client.get("annual_member_dashboard")):
        return True
    sub = client.get("subscription") or {}
    return _subscription_annual_package_signals(sub)


def _is_annual_subscriber(sub: dict, client: dict) -> bool:
    """Heuristic: annual program name, package, program detail labels, or admin CRM flag."""
    if _annual_dashboard_access(client):
        return True
    return _subscription_annual_package_signals(sub)


def _parse_ymd_loose(s: Optional[str]) -> Optional[date]:
    if not s or not str(s).strip():
        return None
    try:
        return datetime.strptime(str(s).strip()[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def _add_months_subscription_end(date_str: str, months: int) -> str:
    """Annual bundle end: min(30, dim) in the month before the anniversary month (matches ``addMonthsAnnualBundleEnd``)."""
    if not (date_str or "").strip():
        return ""
    try:
        months_i = int(months)
    except (TypeError, ValueError):
        months_i = 12
    months_i = max(1, min(120, months_i))
    ds = str(date_str).strip()[:10]
    try:
        d = datetime.strptime(ds, "%Y-%m-%d").date()
    except ValueError:
        return ""
    y, m0 = d.year, d.month - 1
    target_month = m0 + months_i
    target_year = y + target_month // 12
    anniv_m = ((target_month % 12) + 12) % 12
    prev_m = anniv_m - 1
    prev_y = target_year
    if prev_m < 0:
        prev_m = 11
        prev_y -= 1
    dim = calendar.monthrange(prev_y, prev_m + 1)[1]
    dom = min(30, dim)
    end = date(prev_y, prev_m + 1, dom)
    return end.isoformat()


def _site_gst_percent(settings_doc: dict) -> float:
    """Site default GST for INR quotes; 0 is valid (do not use ``or 18``)."""
    raw = (settings_doc or {}).get("india_gst_percent")
    if raw is None:
        return 18.0
    try:
        v = float(raw)
    except (TypeError, ValueError):
        return 18.0
    if v != v:  # NaN
        return 18.0
    return v


def _canonical_site_program_id_for_annual_pkg(raw) -> str:
    """Normalize program IDs for annual-package checklist matching (strip; UUID strings are case-insensitive)."""
    s = str(raw or "").strip()
    if not s:
        return ""
    if len(s) == 36 and s.count("-") == 4:
        try:
            return str(uuid.UUID(s))
        except (ValueError, TypeError, AttributeError):
            return s.lower()
    return s


def _portal_nested_program_row(nested: Optional[dict], program_id: str) -> Optional[dict]:
    """Read ``dashboard_program_offers[program_id]`` or inner ``awrp_batch_program_offers[batch][program_id]``.

    Keys saved from admin may not match quote/cart ``program_id`` casing for Mongo / UUID strings.
    """
    if not isinstance(nested, dict):
        return None
    raw_pid = str(program_id or "").strip()
    if not raw_pid:
        return None
    row = nested.get(raw_pid)
    if isinstance(row, dict):
        return row
    canon = _canonical_site_program_id_for_annual_pkg(raw_pid)
    if canon:
        row = nested.get(canon)
        if isinstance(row, dict):
            return row
        c_low = canon.lower()
        for k, v in nested.items():
            if not isinstance(v, dict):
                continue
            ks = str(k).strip()
            if not ks:
                continue
            if ks.lower() == c_low:
                return v
            if _canonical_site_program_id_for_annual_pkg(ks).lower() == c_low:
                return v
    return None


def _awrp_batch_inner_map(batch_offers_root: Optional[dict], batch_id: Optional[str]) -> Optional[dict]:
    """Resolve ``awrp_batch_program_offers[batch_id]`` with relaxed key matching."""
    if not batch_id or not isinstance(batch_offers_root, dict):
        return None
    bid = str(batch_id).strip()
    if not bid:
        return None
    m = batch_offers_root.get(bid)
    if isinstance(m, dict):
        return m
    b_low = bid.lower()
    for k, v in batch_offers_root.items():
        if isinstance(v, dict) and str(k).strip().lower() == b_low:
            return v
    return None


def _portal_included_in_annual_package(program: dict, inc_cfg, _sub: dict, client: dict) -> bool:
    """Whether the booker’s **own member seat** is prepaid by the Home Coming / annual bundle (₹0 self line).

    **Access** — requires :func:`_annual_dashboard_access` (Annual + Dashboard / HC in CRM, subscription not expired).

    **Program** —
    Uses :func:`_program_included_in_annual_package` first (explicit checklist when non-empty **or**
    pillar keywords when the checklist is empty).

    If access passes but the checklist is **non-empty** and the strict id match fails, we still waive the seat
    when :func:`_program_keyword_in_annual_package` matches — so pillar programs (MMM, Atomic Weight/AWRP, …)
    stay aligned with the bundled Home Coming catalog even when admins only ticked some rows in Dashboard settings.

    Turbo / Meta pillars must remain on the explicit list unless their keywords are expanded separately.
    """
    if not _annual_dashboard_access(client):
        return False
    if _program_included_in_annual_package(program, inc_cfg):
        return True
    raw_inc = inc_cfg if isinstance(inc_cfg, list) else []
    configured_ids_nonempty = [
        str(x).strip()
        for x in raw_inc
        if str(x).strip()
    ]
    if configured_ids_nonempty and _program_keyword_in_annual_package(program):
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
    marital_status: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    qualification: Optional[str] = None
    profession: Optional[str] = None
    phone: Optional[str] = None
    phone_code: Optional[str] = None
    # YYYY-MM-DD or ISO; "date of joining Divine Iris"
    joined_divine_iris_at: Optional[str] = None


def _profile_payload_to_stored_fields(payload: dict) -> dict:
    """Map dashboard profile payload onto user/client fields (`full_name` → `name`)."""
    if not payload:
        return {}
    out = {k: v for k, v in payload.items() if k != "full_name"}
    fn = payload.get("full_name")
    if fn is not None and str(fn).strip():
        out["name"] = normalize_person_name(str(fn).strip())
    return out


class PointsBonusClaim(BaseModel):
    kind: str


class ExternalReviewClaim(BaseModel):
    activity_id: str
    review_url: str
    program_id: Optional[str] = ""
    quote: Optional[str] = ""


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
    submit_for_review: bool = True  # False = save draft only; True = notify admin (when list non-empty)


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
    # Flagship duration tier (0 = first tier, e.g. 1 month; 1 = second, e.g. 3 months). Must match dashboard-quote.
    tier_index: Optional[int] = None


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


def _tier_list_unit_price(program: dict, tier_index: Optional[int], cur: str) -> float:
    """Published list price only (no tier offer_price), aligned with public site list column."""
    cur = (cur or "aed").lower()
    tiers = program.get("duration_tiers") or []
    if program.get("is_flagship") and tiers and tier_index is not None and 0 <= tier_index < len(tiers):
        t = tiers[tier_index]
    else:
        t = program
    return float(t.get(f"price_{cur}", 0) or 0)


def _portal_tier_unit_price(
    program: dict, tier_index: Optional[int], cur: str, apply_tier_offer_prices: bool
) -> float:
    if apply_tier_offer_prices:
        return _tier_unit_price(program, tier_index, cur)
    return _tier_list_unit_price(program, tier_index, cur)


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
    # No override: first tier (same default as public site / 1 Month). Callers with tier UI must pass tier_index.
    return 0, 0


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


def _program_keyword_in_annual_package(program: dict) -> bool:
    """Title/category heuristics when the annual-package id list is empty (admin left all unchecked)."""
    blob = f"{program.get('title') or ''} {program.get('category') or ''}".lower()
    keys = ("money magic", "mmm", "atomic weight", "awrp")
    return any(k in blob for k in keys)


def _peer_row_included_in_guest_annual_package(
    program: dict, configured_ids: Optional[List], row: dict
) -> bool:
    """Program is on the prepaid annual-package list and this row is a same-key household peer with
    effective annual portal access. Used when the logged-in payer is not annual but linked accounts are."""
    if not _program_included_in_annual_package(program, configured_ids):
        return False
    if not bool(row.get("household_client_link")):
        return False
    if "annual_portal_access" in row:
        return bool(row.get("annual_portal_access"))
    return _annual_dashboard_access(
        {
            "annual_member_dashboard": row.get("annual_member_dashboard"),
            "subscription": row.get("subscription") or {},
        }
    )


def _program_included_in_annual_package(program: dict, configured_ids: Optional[List] = None) -> bool:
    """Programs in annual package: member seat included; they only pay for family add-ons.

    If the admin saves a non-empty ``annual_package_included_program_ids`` (any program checked),
    inclusion is **only** by id — unchecked programs use normal portal offers. If the list is
    empty (all unchecked), fall back to title keywords (MMM, Money Magic, Atomic Weight / AWRP).

    IDs are compared in canonical form so checklist rows saved from admin still match Mongo
    ``programs.id`` when casing or whitespace differs (UUIDs).
    """
    keyword = _program_keyword_in_annual_package(program)
    ids = [
        _canonical_site_program_id_for_annual_pkg(x) for x in (configured_ids or []) if str(x).strip()
    ]
    if ids:
        pid = _canonical_site_program_id_for_annual_pkg(program.get("id") or program.get("_id") or "")
        return pid in set(ids)
    return keyword


def _portal_tier_key(tier_index: Optional[int]) -> Optional[str]:
    """String key for ``dashboard_program_offers[program_id].by_tier`` (and batch offers)."""
    if tier_index is None:
        return None
    try:
        ti = int(tier_index)
    except (TypeError, ValueError):
        return None
    if ti < 0:
        return None
    return str(ti)


def _coalesce_tier_index_for_flagship_portal(program: Optional[dict], tier_index: Optional[int]) -> Optional[int]:
    """Default missing tier to **0** for flagship programs so ``by_tier`` cohort/per-program patches apply.

    Admin pricing often lives only under ``by_tier[\"0\"]`` (1 Month). If API calls omit ``tier_index``,
    :func:`_portal_tier_key` skips tier merges and checkout uses tier list/offer (e.g. ₹13,999 vs cohort ₹13,734).
    """
    if tier_index is not None:
        try:
            ti = int(tier_index)
        except (TypeError, ValueError):
            return 0
        return ti if ti >= 0 else 0
    if not isinstance(program, dict):
        return None
    if program.get("is_flagship") and (program.get("duration_tiers") or []):
        return 0
    return None


def _portal_offer_scalar_float(val) -> float:
    if val is None or str(val).strip() == "":
        return 0.0
    try:
        return float(val)
    except (TypeError, ValueError):
        return 0.0


def _portal_offer_column_has_pricing_intent(col: dict) -> bool:
    """True when a saved portal column patch clearly defines pricing (cohort / per-program rows).

    Admin UIs often omit ``enabled``; global defaults may keep ``enabled: false``. Without this,
    merged cohort fixed prices are ignored and checkout falls back to tier list (e.g. ₹13,999).
    """
    if not isinstance(col, dict) or not col:
        return False
    rule = (col.get("pricing_rule") or "promo").lower().strip()
    if rule == "percent_off":
        return _portal_offer_scalar_float(col.get("percent_off")) > 0
    if rule == "amount_off":
        for key, raw in col.items():
            if isinstance(key, str) and key.startswith("amount_off_") and _portal_offer_scalar_float(raw) > 0:
                return True
        return _portal_offer_scalar_float(col.get("amount_off")) > 0
    if rule == "fixed_price":
        for key, raw in col.items():
            if isinstance(key, str) and key.startswith("fixed_price_") and _portal_offer_scalar_float(raw) > 0:
                return True
        return False
    # ``promo`` / empty rule — only intentful when a code is set
    return bool(str(col.get("promo_code") or "").strip())


def _merge_portal_offer_column(base: Optional[dict], patch: Optional[dict]) -> dict:
    """Shallow-merge one portal column; infer ``enabled`` when a patch sets prices but not the flag."""
    b = dict(base or {})
    p = patch if isinstance(patch, dict) else {}
    out = {**b, **p}
    if p and "enabled" not in p and _portal_offer_column_has_pricing_intent(p):
        out["enabled"] = True
    return out


def _tier_merge_offer_columns(
    base_annual: dict,
    base_family: dict,
    base_extended: dict,
    tier_patch: Optional[dict],
) -> Tuple[dict, dict, dict]:
    if not isinstance(tier_patch, dict):
        return base_annual, base_family, base_extended
    ao = _merge_portal_offer_column(base_annual, tier_patch.get("annual"))
    fo = _merge_portal_offer_column(base_family, tier_patch.get("family"))
    eo = _merge_portal_offer_column(base_extended, tier_patch.get("extended"))
    return ao, fo, eo


def _merge_program_dashboard_offers(
    global_ao: dict,
    global_fo: dict,
    global_eo: dict,
    program_id: str,
    per_map: Optional[dict],
    tier_index: Optional[int] = None,
) -> Tuple[dict, dict, dict]:
    """Shallow-merge global annual / family / extended guest offer dicts with per-program overrides.

    When ``tier_index`` is set and the program row defines ``by_tier[str(tier_index)]``, those
    annual/family/extended dicts are merged on top (for flagship 1-month vs 3-month, etc.).
    """
    pid = str(program_id)
    row = _portal_nested_program_row(per_map, pid) if isinstance(per_map, dict) else None
    if not isinstance(row, dict):
        row = {}
    ao = _merge_portal_offer_column(global_ao, row.get("annual"))
    fo = _merge_portal_offer_column(global_fo, row.get("family"))
    eo = _merge_portal_offer_column(global_eo, row.get("extended"))
    tk = _portal_tier_key(tier_index)
    if tk:
        bt = row.get("by_tier")
        if isinstance(bt, dict):
            tier_patch = bt.get(tk)
            ao, fo, eo = _tier_merge_offer_columns(ao, fo, eo, tier_patch)
    return ao, fo, eo


def _portal_offer_row_has_overrides(row: Optional[dict]) -> bool:
    if not isinstance(row, dict):
        return False
    for col in ("annual", "family", "extended"):
        x = row.get(col)
        if isinstance(x, dict) and len(x) > 0:
            return True
    return False


def _portal_offer_row_has_overrides_deep(row: Optional[dict]) -> bool:
    """True if program or batch offer row has top-level or any ``by_tier`` overrides."""
    if _portal_offer_row_has_overrides(row):
        return True
    bt = row.get("by_tier") if isinstance(row, dict) else None
    if not isinstance(bt, dict):
        return False
    for sub in bt.values():
        if _portal_offer_row_has_overrides(sub):
            return True
    return False


def _merge_program_dashboard_offers_with_batch(
    global_ao: dict,
    global_fo: dict,
    global_eo: dict,
    program_id: str,
    per_map: Optional[dict],
    batch_program_row: Optional[dict],
    tier_index: Optional[int] = None,
) -> Tuple[dict, dict, dict]:
    """Merge global + per-program portal offers, then layer AWRP / cohort batch row on top (batch wins)."""
    ao, fo, eo = _merge_program_dashboard_offers(
        global_ao, global_fo, global_eo, program_id, per_map, tier_index
    )
    if not isinstance(batch_program_row, dict):
        return ao, fo, eo
    ao = _merge_portal_offer_column(ao, batch_program_row.get("annual"))
    fo = _merge_portal_offer_column(fo, batch_program_row.get("family"))
    eo = _merge_portal_offer_column(eo, batch_program_row.get("extended"))
    tk = _portal_tier_key(tier_index)
    if tk:
        bt = batch_program_row.get("by_tier")
        if isinstance(bt, dict):
            tier_patch = bt.get(tk)
            ao, fo, eo = _tier_merge_offer_columns(ao, fo, eo, tier_patch)
    return ao, fo, eo


def _portal_member_column_for_self(client: dict, annual_dashboard_access: bool) -> bool:
    """Use the **member / annual** portal column for the booker's own seat (not the extended column).

    Annual+Dashboard clients always do. Clients tagged with ``awrp_batch_id`` do as well so cohort member
    prices apply even when they are not on the Home Coming annual bundle.
    """
    if annual_dashboard_access:
        return True
    return bool(_client_awrp_batch_id(client))


def _merged_portal_offers_for_payer(
    annual_dashboard_access: bool,
    program_id: str,
    settings_doc: dict,
    client: dict,
    tier_index: Optional[int] = None,
) -> Tuple[dict, dict, dict, Optional[str]]:
    """Merged portal pricing columns for Sacred Home / Divine Cart.

    **Annual+Dashboard:** global columns + per-program ``dashboard_program_offers`` + cohort batch row.

    **Cohort-only** (``awrp_batch_id`` set, no annual portal access): **cohort batch row only** — no global
    three columns and no per-program portal table (still annual-gated). Untagged non-annual clients use
    catalog tier pricing only (empty merge).
    """
    batch_id = _client_awrp_batch_id(client)
    batch_root = settings_doc.get("awrp_batch_program_offers") or {}
    brow = _batch_portal_row_for_program(batch_root, batch_id, program_id)

    if not annual_dashboard_access:
        if not batch_id:
            return {}, {}, {}, None
        if not brow:
            return {}, {}, {}, batch_id
        ao, fo, eo = _merge_program_dashboard_offers_with_batch(
            {}, {}, {}, program_id, {}, brow, tier_index
        )
        return ao, fo, eo, batch_id

    g_ao = settings_doc.get("dashboard_offer_annual") or {}
    g_fo = settings_doc.get("dashboard_offer_family") or {}
    g_eo = settings_doc.get("dashboard_offer_extended") or {}
    per_map = settings_doc.get("dashboard_program_offers") or {}
    ao, fo, eo = _merge_program_dashboard_offers_with_batch(
        g_ao, g_fo, g_eo, program_id, per_map, brow, tier_index
    )
    return ao, fo, eo, batch_id


def _client_awrp_batch_id(client: Optional[dict]) -> Optional[str]:
    if not client:
        return None
    for key in ("awrp_batch_id",):
        raw = client.get(key)
        if raw is not None and str(raw).strip():
            return str(raw).strip()
    sub = client.get("subscription") or {}
    raw = sub.get("awrp_batch_id")
    if raw is not None and str(raw).strip():
        return str(raw).strip()
    annual_sub = client.get("annual_subscription") or {}
    raw = annual_sub.get("awrp_batch_id")
    if raw is not None and str(raw).strip():
        return str(raw).strip()
    return None


def _batch_portal_row_for_program(batch_offers_root: Optional[dict], batch_id: Optional[str], program_id: str) -> Optional[dict]:
    bmap = _awrp_batch_inner_map(batch_offers_root, batch_id)
    if not bmap:
        return None
    return _portal_nested_program_row(bmap, str(program_id))


def _program_has_portal_pricing_override(
    per_map: Optional[dict],
    program_id: str,
    batch_program_row: Optional[dict] = None,
) -> bool:
    row = _portal_nested_program_row(per_map, str(program_id)) if isinstance(per_map, dict) else None
    if _portal_offer_row_has_overrides_deep(row):
        return True
    return _portal_offer_row_has_overrides_deep(batch_program_row)


def _all_dashboard_guest_rows(client: dict) -> List[dict]:
    """Immediate household + friends/extended — same shape; IDs must be unique across both lists."""
    im = list(client.get("immediate_family") or [])
    og = list(client.get("other_guests") or [])
    return im + og


async def _household_club_all_annual(household_key: str) -> bool:
    """True only when every client with this household_key has effective annual portal access and portal is not blocked."""
    hk = (household_key or "").strip()
    if not hk:
        return False
    rows = await db.clients.find(
        {"household_key": hk},
        {"_id": 0, "annual_member_dashboard": 1, "portal_login_allowed": 1, "subscription": 1},
    ).to_list(100)
    if not rows:
        return False
    for c in rows:
        if not _annual_dashboard_access(c):
            return False
        if c.get("portal_login_allowed") is False:
            return False
    return True


def _family_offer_for_included_package_guests(
    included_in_package: bool,
    payable_immediate_seat_count: int,
    fo_imm: dict,
) -> dict:
    """When the program is included in the prepaid annual package, add-on immediate-family seats
    (non–household-peer guests) must use program tier list/offer — not the global dashboard family
    column (fixed ₹1,111, promos, etc.), which targets other programs like short detoxes.
    """
    if included_in_package and payable_immediate_seat_count > 0:
        return {}
    return fo_imm or {}


async def _household_peer_ids(client_id: str, client: dict) -> Set[str]:
    """Other Client Garden ids sharing the same household_key.

    Used for pricing / cart / checkout. Only the primary household contact may pay for linked accounts.
    """
    if not bool(client.get("is_primary_household_contact")):
        return set()
    hk = (client.get("household_key") or "").strip()
    if not hk or not client_id:
        return set()
    rows = await db.clients.find(
        {"household_key": hk, "id": {"$ne": client_id}},
        {"_id": 0, "id": 1},
    ).to_list(80)
    return {str(r["id"]) for r in rows if r.get("id")}


async def _household_peer_ids_for_pricing(client_id: str, client: dict) -> Set[str]:
    """Other Client Garden ids on the same ``household_key`` as the logged-in client.

    Used to classify Annual Family Club seats for portal pricing even when a guest row is missing
    ``household_client_link`` (merge/id drift). Unlike :func:`_household_peer_ids`, does not require
    primary household contact — classification only; who may pay for whom stays enforced elsewhere.
    """
    hk = (client.get("household_key") or "").strip()
    if not hk or not client_id:
        return set()
    rows = await db.clients.find(
        {"household_key": hk, "id": {"$ne": client_id}},
        {"_id": 0, "id": 1},
    ).to_list(80)
    return {str(r["id"]) for r in rows if r.get("id")}


def _row_is_annual_family_club_peer(r: dict, household_peer_ids: Set[str]) -> bool:
    """True when this guest row is an Annual Family Club / same-key household peer."""
    rid = str(r.get("id") or "").strip()
    return bool(r.get("household_client_link")) or (bool(rid) and rid in household_peer_ids)


async def _household_peer_guest_rows(
    client_id: str, client: dict, *, for_payment: bool = False
) -> List[dict]:
    """Build immediate-family-shaped rows from other clients with the same household_key.

    When ``for_payment`` is True, only the primary household contact gets linked rows (they may pay for
    all clubbed accounts). That path requires ``_household_club_all_annual`` so checkout and cart
    resolution stay consistent.

    When ``for_payment`` is False (Sacred Home / dashboard home), return other same-key clients who
    already have Annual dashboard access and portal login allowed — even if someone else on the key
    (e.g. the primary) is not on Annual yet, so the household is not fully "clubbed."
    """
    if for_payment and not bool(client.get("is_primary_household_contact")):
        return []
    hk = (client.get("household_key") or "").strip()
    if not hk or not client_id:
        return []
    if for_payment:
        if not await _household_club_all_annual(hk):
            return []

    match: dict = {
        "household_key": hk,
        "id": {"$ne": client_id},
        "$nor": [{"portal_login_allowed": False}],
    }

    rows = await db.clients.find(
        match,
        {
            "_id": 0,
            "id": 1,
            "name": 1,
            "email": 1,
            "phone": 1,
            "city": 1,
            "country": 1,
            "annual_member_dashboard": 1,
            "subscription": 1,
            "date_of_birth": 1,
        },
    ).sort([("name", 1)]).to_list(80)
    if not for_payment:
        rows = [m for m in rows if _annual_dashboard_access(m)]
    now = datetime.now(timezone.utc).isoformat()
    out: List[dict] = []
    for m in rows:
        em = (m.get("email") or "").strip()
        dob_raw = (m.get("date_of_birth") or "").strip()[:10]
        age_str = _age_from_dob_iso(dob_raw) if dob_raw else ""
        portal_access = _annual_dashboard_access(m)
        out.append(
            {
                "id": m["id"],
                "name": (m.get("name") or "").strip() or "Household member",
                "relationship": "Household",
                "email": em,
                "phone": (m.get("phone") or "").strip(),
                "date_of_birth": dob_raw,
                "city": (m.get("city") or "").strip(),
                "age": age_str,
                "attendance_mode": "online",
                "country": (m.get("country") or "").strip()[:120] or "",
                "notify_enrollment": bool(em),
                "household_client_link": True,
                "annual_member_dashboard": bool(m.get("annual_member_dashboard")),
                "annual_portal_access": portal_access,
                "updated_at": now,
            }
        )
    return out


def _merge_immediate_family_with_household_peers(stored_im: List[dict], peers: List[dict]) -> List[dict]:
    """Stored rows keep order; on id collision merge household-peer flags from linked Client Garden rows."""
    peer_by_id = {str(p.get("id") or "").strip(): p for p in (peers or []) if p.get("id")}
    seen: Set[str] = set()
    out: List[dict] = []
    for m in stored_im or []:
        if not m.get("id"):
            continue
        mid = str(m["id"]).strip()
        seen.add(mid)
        if mid in peer_by_id:
            p = peer_by_id[mid]
            merged = dict(m)
            merged["household_client_link"] = True
            merged["annual_member_dashboard"] = bool(p.get("annual_member_dashboard"))
            merged["annual_portal_access"] = bool(p.get("annual_portal_access"))
            out.append(merged)
        else:
            out.append(m)
    for p in peers or []:
        pid = str(p.get("id") or "").strip()
        if pid and pid not in seen:
            seen.add(pid)
            out.append(p)
    return out


async def _all_dashboard_guest_rows_with_household(
    client_id: str, client: dict, *, for_payment: bool = False
) -> List[dict]:
    """Stored immediate + other guests + optional same-key Client Garden rows.

    ``for_payment=True`` is for checkout / quotes (primary contact only gets payable peer rows
    from :func:`_household_peer_guest_rows`).

    **Pricing alignment:** Sacred Home lists Annual Family Club using ``for_payment=False`` (peers
    who already have Annual dashboard access). Strict ``for_payment=True`` returns **no** peers
    until *every* client on the household key is Annual + portal-allowed, so merge/append would
    miss linked seats and they would price as plain immediate family. For payment we therefore
    merge and append using the **same dashboard-visible peer list** as Sacred Home, while keeping
    the strict call available for callers that need it elsewhere.

    When someone appears both in saved immediate family and as a household peer, merge
    ``household_client_link`` / ``annual_member_dashboard`` onto the saved row.
    """
    base = _all_dashboard_guest_rows(client)
    if for_payment:
        peers_vis = await _household_peer_guest_rows(client_id, client, for_payment=False)
        peer_by_id = {str(p.get("id") or "").strip(): p for p in (peers_vis or []) if p.get("id")}
        peers_to_append = list(peers_vis or [])
    else:
        peers = await _household_peer_guest_rows(client_id, client, for_payment=False)
        peer_by_id = {str(p.get("id") or "").strip(): p for p in peers if p.get("id")}
        peers_to_append = list(peers)
    out: List[dict] = []
    for m in base:
        mid = str(m.get("id") or "").strip()
        if mid and mid in peer_by_id:
            p = peer_by_id[mid]
            merged = dict(m)
            merged["household_client_link"] = True
            merged["annual_member_dashboard"] = bool(p.get("annual_member_dashboard"))
            merged["annual_portal_access"] = bool(p.get("annual_portal_access"))
            out.append(merged)
        else:
            out.append(m)
    seen = {str(m.get("id")) for m in out if m.get("id")}
    for p in peers_to_append:
        pid = str(p.get("id") or "").strip()
        if pid and pid not in seen:
            seen.add(pid)
            out.append(p)
    return out


async def _resolve_family_rows(
    client_id: str, client: dict, family_member_ids: List[str], fallback_count: int
) -> List[dict]:
    fam = await _all_dashboard_guest_rows_with_household(client_id, client, for_payment=True)
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


def _split_resolved_guest_rows_plain_peer_ext(
    client: dict,
    rows: List[dict],
    *,
    included_in_package: bool = False,
    program: Optional[dict] = None,
    annual_package_program_ids: Optional[List] = None,
    household_peer_ids: Optional[Set[str]] = None,
) -> Tuple[int, int, int]:
    """Split selected guests into plain immediate family, annual household peers, and extended.

    Annual Family Club / same-key peers are priced with the **Annual** portal column (annual member
    discount). A row counts as a peer if ``household_client_link`` is set **or** its id appears in
    ``household_peer_ids`` (other clients on the same ``household_key``), so pricing stays correct
    when merge data omits the link flag. Plain immediate seats use the **Family** column. When
    ``included_in_package`` is True, linked annual peers do not add to tier pricing (covered by
    prepaid package).

    When the payer is not on an annual dashboard package but a peer has Annual access and the program
    is in the annual package list, that peer seat is waived (their own package covers it).
    """
    im_ids = {str(m.get("id")) for m in (client.get("immediate_family") or []) if m.get("id")}
    pid_set = household_peer_ids or set()
    plain = 0
    peer = 0
    ext = 0
    for r in rows:
        rid = str(r.get("id") or "").strip()
        on_household_key = bool(rid) and rid in pid_set
        is_imm = rid in im_ids or bool(r.get("household_client_link")) or on_household_key
        if not is_imm:
            ext += 1
            continue
        is_peer = bool(r.get("household_client_link")) or on_household_key
        if included_in_package and is_peer:
            continue
        if (
            not included_in_package
            and program is not None
            and is_peer
            and _peer_row_included_in_guest_annual_package(program, annual_package_program_ids, r)
        ):
            continue
        if included_in_package and not is_peer:
            plain += 1
            continue
        if is_peer:
            peer += 1
        else:
            plain += 1
    return plain, peer, ext


def _selection_counts_plain_peer_display(
    client: dict,
    rows: List[dict],
    *,
    household_peer_ids: Optional[Set[str]] = None,
) -> Tuple[int, int]:
    """How many selected guests are plain immediate vs same-key annual peers (for UI labels).

    Unlike :func:`_split_resolved_guest_rows_plain_peer_ext`, this always counts peers in the
    selection even when their seats are covered by the prepaid annual package (₹0).
    """
    im_ids = {str(m.get("id")) for m in (client.get("immediate_family") or []) if m.get("id")}
    pid_set = household_peer_ids or set()
    plain = 0
    peer = 0
    for r in rows:
        rid = str(r.get("id") or "").strip()
        on_household_key = bool(rid) and rid in pid_set
        is_peer_row = bool(r.get("household_client_link")) or on_household_key
        is_imm = rid in im_ids or bool(r.get("household_client_link")) or on_household_key
        if not is_imm:
            continue
        if is_peer_row:
            peer += 1
        else:
            plain += 1
    return plain, peer


async def _apply_portal_guest_line_offer(
    program_id: str,
    currency: str,
    fam_unit: float,
    fc: int,
    fo: dict,
    program: Optional[dict] = None,
    *,
    allow_tier_list_fallback: bool = True,
) -> Tuple[float, float, str, bool]:
    """Apply family-style portal rules to one guest bucket. Returns (gross, after, rule, promo_applied).

    When ``allow_tier_list_fallback`` is True and rule is fixed_price, a very low fixed amount vs
    ``fam_unit`` triggers list pricing (avoids applying a short-course global family fixed to a
    flagship tier line). Set False for **annual-offer** household-peer lines so fixed member prices
    (e.g. ₹333) still apply when the tier list unit is higher (e.g. ₹999) — same basis as the
    booker's own annual seat.
    """
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
            # Global dashboard fixed (e.g. ₹1,111 family / ₹1,200 extended) vs a much larger tier list
            # (e.g. MMM): use the program tier line so flagship pricing is not replaced by a short-course
            # global seat price. When fixed is close to tier (e.g. detox), keep fixed — callers route
            # the account holder to the right column (extended vs immediate family).
            use_tier_not_global_fixed = (
                allow_tier_list_fallback and pseat > 0 and fam_unit > 0 and pseat < fam_unit * 0.5
            )
            if use_tier_not_global_fixed:
                fam_after = max(0.0, round(fam_line_gross, 2))
                family_rule = "list"
            elif pseat > 0:
                fam_after = max(0.0, round(pseat * fc, 2))
                family_rule = "fixed_price"
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
    immediate_family_count_plain: int,
    immediate_family_count_peer: int,
    extended_guest_count: int,
    annual_offer: dict,
    family_offer: dict,
    extended_guest_offer: dict,
    include_self: bool = True,
    tier_index_override: Optional[int] = None,
    apply_tier_offer_prices: bool = True,
    *,
    booker_annual_portal: bool = True,
) -> dict:
    """Portal pricing for logged-in clients (Sacred Home + Divine Cart).

    Tier `offer_price_*` is used when set (same basis as the public website). Optional dashboard overlays
    (`annual_offer`, `family_offer`, `extended_guest_offer`) are merged by callers.

    When ``booker_annual_portal`` is True (Client Garden Annual access), the booker's seat uses the
    annual offer column; household peers also use the annual column. When False, the booker's
    **own seat** uses the **extended** offer column (``extended_guest_offer`` — e.g. ₹1,200), not
    the immediate-family column (e.g. ₹1,111). Plain immediate-family guest seats still use
    ``family_offer``; annual peers still use ``annual_offer``.

    ``immediate_family_count_peer`` = same-key annual household peers (Annual portal column);
    ``immediate_family_count_plain`` = saved immediate family who are not linked peers (Family column).
    """
    cur = (currency or "aed").lower()
    self_tier, fam_tier = _pick_self_and_family_tier_indices(program, tier_index_override)
    # Annual member + Annual Family Club seats share the same tier basis as "You (Annual)" before column offers.
    annual_member_list_unit = _portal_tier_unit_price(program, self_tier, cur, apply_tier_offer_prices)
    self_unit_list = annual_member_list_unit if include_self else 0.0
    fam_unit = _portal_tier_unit_price(program, fam_tier, cur, apply_tier_offer_prices)
    imm_fc_plain = max(0, int(immediate_family_count_plain))
    imm_fc_peer = max(0, int(immediate_family_count_peer))
    ext_fc = max(0, int(extended_guest_count))
    imm_fc = imm_fc_plain + imm_fc_peer
    fc_total = imm_fc + ext_fc

    ao = annual_offer or {}

    annual_promo_applied = False
    if include_self:
        if booker_annual_portal:
            self_unit = self_unit_list
            if ao.get("enabled"):
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
            else:
                self_after = max(0.0, round(self_unit, 2))
                member_rule = "list"
        else:
            # Non-annual payer: "You" uses Extended / "other" column — not immediate family (₹1,111).
            self_unit = fam_unit
            _sg, self_after, member_rule, annual_promo_applied = await _apply_portal_guest_line_offer(
                program_id, currency, fam_unit, 1, extended_guest_offer or {}, program
            )
    else:
        self_after = 0.0
        member_rule = "included_in_package"
        self_unit = 0.0

    # Annual household peers: same tier basis and `annual_offer` as the annual member seat — not `fam_unit` alone.
    ig_p, imm_after_p, imm_rule_p, imm_promo_p = await _apply_portal_guest_line_offer(
        program_id,
        currency,
        annual_member_list_unit,
        imm_fc_peer,
        ao,
        program,
        allow_tier_list_fallback=False,
    )
    # Plain immediate family: Family portal column.
    ig_f, imm_after_f, imm_rule_f, imm_promo_f = await _apply_portal_guest_line_offer(
        program_id, currency, fam_unit, imm_fc_plain, family_offer or {}, program
    )
    eg, ext_after, ext_rule, ext_promo = await _apply_portal_guest_line_offer(
        program_id, currency, fam_unit, ext_fc, extended_guest_offer or {}, program
    )

    ig = round(ig_p + ig_f, 2)
    imm_after = round(imm_after_p + imm_after_f, 2)
    imm_promo = imm_promo_p or imm_promo_f
    imm_rule = "mixed" if imm_fc_peer > 0 and imm_fc_plain > 0 else (imm_rule_p if imm_fc_peer > 0 else imm_rule_f)

    fam_line_gross = round(ig + eg, 2)
    fam_after = round(imm_after + ext_after, 2)
    family_promo_applied = imm_promo or ext_promo

    imm_buckets = sum(1 for n in (imm_fc_peer, imm_fc_plain) if n > 0)
    if imm_buckets > 1 or (imm_buckets > 0 and ext_fc > 0):
        family_pricing_rule = "mixed"
    elif imm_fc_peer > 0:
        family_pricing_rule = imm_rule_p
    elif imm_fc_plain > 0:
        family_pricing_rule = imm_rule_f
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
        "immediate_family_only_count": imm_fc_plain,
        "annual_household_peer_count": imm_fc_peer,
        "extended_guest_count": ext_fc,
        "annual_household_line_gross": round(ig_p, 2),
        "annual_household_after_promos": round(imm_after_p, 2),
        "annual_household_pricing_rule": imm_rule_p,
        "annual_household_promo_applied": imm_promo_p,
        "immediate_family_only_line_gross": round(ig_f, 2),
        "immediate_family_only_after_promos": round(imm_after_f, 2),
        "immediate_family_only_pricing_rule": imm_rule_f,
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
    name_raw = (snap.get("full_name") or user.get("name") or "").strip()
    name = normalize_person_name(name_raw) if name_raw else ""
    country = (client or {}).get("country") or user.get("country") or ""
    u_email = (user.get("email") or "").strip()
    c_email = ((client or {}).get("email") or "").strip()
    email = u_email or c_email
    return {
        "name": name,
        "email": email,
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
async def update_immediate_family(data: FamilyUpdate, user: dict = Depends(get_current_student_user)):
    """Save immediate family members for dashboard offers / enrollment context (max 12)."""
    client_id = user.get("client_id")
    if not client_id:
        raise HTTPException(status_code=400, detail="User not linked to client record")

    client_row = await db.clients.find_one(
        {"id": client_id},
        {"immediate_family_locked": 1, "immediate_family_editing_approved": 1, "immediate_family": 1,
         "family_approved": 1, "family_pending_review": 1},
    )
    prev_family = (client_row or {}).get("immediate_family") or []
    locked_flag = bool(client_row and client_row.get("immediate_family_locked"))
    legacy_filled = _immediate_family_has_names(prev_family)
    locked = locked_flag or legacy_filled
    approved = bool(client_row) and client_row.get("immediate_family_editing_approved") is not False
    family_approved = bool(client_row and client_row.get("family_approved"))

    # Permanently frozen — admin has reviewed and approved; no more edits ever
    if family_approved:
        raise HTTPException(
            status_code=403,
            detail="Your family list has been reviewed and confirmed. Please contact support if you need a change.",
        )
    if locked and not approved:
        raise HTTPException(
            status_code=403,
            detail="Your immediate family list is locked. Contact support if you need an admin to allow edits.",
        )

    out: List[dict] = []
    for m in (data.members or [])[:12]:
        name = normalize_person_name((m.name or "").strip())
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
            "country": (m.country or "").strip()[:120] or "",
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
    # Only queue admin review when member explicitly submits (not draft saves)
    if len(out) > 0 and bool(data.submit_for_review):
        set_doc["family_pending_review"] = True

    await db.clients.update_one({"id": client_id}, {"$set": set_doc})
    locked_after = bool(set_doc.get("immediate_family_locked")) or _immediate_family_has_names(out)
    pending_review = set_doc.get("family_pending_review")
    if pending_review is None:
        pending_review = bool((client_row or {}).get("family_pending_review"))
    return {
        "message": "Family list saved",
        "immediate_family": out,
        "immediate_family_locked": locked_after,
        "immediate_family_editing_approved": approved,
        "family_pending_review": bool(pending_review),
        "family_approved": False,
    }


@router.put("/other-guests")
async def update_other_guests(data: FamilyUpdate, user: dict = Depends(get_current_student_user)):
    """Friends, cousins, extended family, etc. — same fields as immediate family; max 12 rows."""
    client_id = user.get("client_id")
    if not client_id:
        raise HTTPException(status_code=400, detail="User not linked to client record")

    client_guest = await db.clients.find_one({"id": client_id}, {"family_pending_review": 1}) or {}

    out: List[dict] = []
    for m in (data.members or [])[:12]:
        name = normalize_person_name((m.name or "").strip())
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
            "country": (m.country or "").strip()[:120] or "",
            "notify_enrollment": bool(m.notify_enrollment) and bool(em),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })

    set_og: dict = {
        "other_guests": out,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if len(out) > 0 and bool(data.submit_for_review):
        set_og["family_pending_review"] = True

    await db.clients.update_one({"id": client_id}, {"$set": set_og})
    pending_review = set_og.get("family_pending_review")
    if pending_review is None:
        pending_review = bool(client_guest.get("family_pending_review"))
    return {
        "message": "Guest list saved",
        "other_guests": out,
        "family_pending_review": bool(pending_review),
    }


@router.get("/enrollment-prefill")
async def get_enrollment_prefill(user: dict = Depends(get_current_student_user)):
    """Profile + family list for dashboard-origin enrollment (skip retyping public form fields)."""
    client_id = user.get("client_id")
    client = await _student_client_row_with_expiry(client_id) if client_id else {}
    self_data = _profile_snapshot_for_prefill(user, client)
    peers = (
        await _household_peer_guest_rows(client_id, client, for_payment=True)
        if client_id
        else []
    )
    family = _merge_immediate_family_with_household_peers(client.get("immediate_family") or [], peers)
    other_guests = client.get("other_guests") or []
    return {"self": self_data, "immediate_family": family, "other_guests": other_guests}


async def _portal_combined_dashboard_total(user: dict, profile: ProfileData) -> Optional[Tuple[float, str]]:
    """Sum portal quotes for cart lines (same basis as GET /dashboard-quote). Sets checkout total like dashboard-pay."""
    lines = profile.portal_cart_lines
    if not lines:
        return None
    client_id = user.get("client_id")
    if not client_id:
        return None
    client = await _student_client_row_with_expiry(client_id)
    sub = client.get("subscription") or {}
    annual_dashboard_access = _annual_dashboard_access(client)
    hp_ids = await _household_peer_ids_for_pricing(client_id, client)
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
            "awrp_batch_program_offers": 1,
        },
    ) or {}
    fam_all = await _all_dashboard_guest_rows_with_household(client_id, client, for_payment=True)
    fam_by_id = {str(m.get("id")) for m in fam_all if m.get("id")}
    fam_by_row = {str(m.get("id")): m for m in fam_all if m.get("id")}
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
        included = _portal_included_in_annual_package(program, inc_cfg, sub, client)
        if id_list:
            resolved_rows = [fam_by_row[i] for i in id_list if i in fam_by_row]
            imm_plain, imm_peer, ext_fc = _split_resolved_guest_rows_plain_peer_ext(
                client,
                resolved_rows,
                included_in_package=included,
                program=program,
                annual_package_program_ids=inc_cfg,
                household_peer_ids=hp_ids,
            )
        else:
            imm_plain, imm_peer, ext_fc = 0, 0, 0
            resolved_rows = []
        if included:
            include_self = False
        else:
            include_self = bool(line.booker_joins)
        merge_tier = _coalesce_tier_index_for_flagship_portal(program, line.tier_index)
        ao, fo, eo, _batch_for_line = _merged_portal_offers_for_payer(
            annual_dashboard_access, pid, settings_doc, client, tier_index=merge_tier
        )
        fo_plain = _family_offer_for_included_package_guests(included, imm_plain, fo)
        pricing = await compute_dashboard_annual_family_pricing(
            program,
            pid,
            cur,
            imm_plain,
            imm_peer,
            ext_fc,
            ao,
            fo_plain,
            eo,
            include_self=include_self,
            tier_index_override=merge_tier,
            apply_tier_offer_prices=True,
            booker_annual_portal=_portal_member_column_for_self(client, annual_dashboard_access),
        )
        qc = _dashboard_quote_participant_count(include_self, imm_plain, imm_peer, ext_fc)
        pricing = _apply_crm_portal_discount_to_pricing_total(pricing, client, cur, qc)
        total += float(pricing.get("total") or 0)
    return round(total, 2), cur


@router.post("/combined-enrollment-start")
async def student_combined_enrollment_start(profile: ProfileData, request: Request, user: dict = Depends(get_current_student_user)):
    """Portal Divine Cart: create enrollment without email OTP; booker must match logged-in student."""
    uemail = (user.get("email") or "").strip().lower()
    if not uemail:
        raise HTTPException(status_code=400, detail="Account has no email")
    if uemail != profile.booker_email.strip().lower():
        raise HTTPException(status_code=403, detail="Booker email must match your logged-in account.")
    await assert_claimed_hub_matches_stripe(request, (profile.portal_cart_currency or "aed").strip())
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
    request: Request,
    program_id: str,
    family_count: int = 0,
    family_ids: str = "",
    currency: str = "aed",
    booker_joins: bool = True,
    tier_index: Optional[int] = Query(None, description="Flagship duration tier index (1 month, 3 month, annual, …)"),
    user: dict = Depends(get_current_student_user),
):
    """Portal pricing for logged-in clients (Sacred Home + Divine Cart).

    **Annual+Dashboard** clients use portal columns (annual / family / extended), per-program
    overrides, and AWRP cohort overlays.

    **Cohort-tagged** clients without annual access use **cohort batch pricing only** (no global portal
    columns or per-program portal table). Everyone else logged in uses **catalog tier pricing** only.

    Annual Family Club guest routing still applies when peers are selected; waived seats follow
    package rules only for annual payers.
    """
    client_id = user.get("client_id")
    if not client_id:
        raise HTTPException(status_code=400, detail="User not linked to client record")
    await assert_claimed_hub_matches_stripe(request, currency)
    client = await _student_client_row_with_expiry(client_id)
    sub = client.get("subscription") or {}
    annual_dashboard_access = _annual_dashboard_access(client)
    hp_ids = await _household_peer_ids_for_pricing(client_id, client)
    fam = await _all_dashboard_guest_rows_with_household(client_id, client, for_payment=True)
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
    program = await db.programs.find_one({"id": program_id}, {"_id": 0})
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    if not program.get("enrollment_open", True):
        raise HTTPException(status_code=400, detail="Enrollment is not open for this program")
    tier_index = _coalesce_tier_index_for_flagship_portal(program, tier_index)
    settings_doc = await db.site_settings.find_one(
        {"id": "site_settings"},
        {
            "_id": 0,
            "dashboard_offer_annual": 1,
            "dashboard_offer_family": 1,
            "dashboard_offer_extended": 1,
            "annual_package_included_program_ids": 1,
            "dashboard_program_offers": 1,
            "awrp_batch_program_offers": 1,
            "india_gst_percent": 1,
            "dashboard_annual_quote_show_tax": 1,
            "dashboard_sacred_home_annual_program_id": 1,
        },
    ) or {}
    included = _portal_included_in_annual_package(
        program, settings_doc.get("annual_package_included_program_ids"), sub, client
    )
    if included:
        include_self = False
    else:
        include_self = bool(booker_joins)
    per_map = settings_doc.get("dashboard_program_offers") or {}
    ao, fo, eo, batch_id = _merged_portal_offers_for_payer(
        annual_dashboard_access, program_id, settings_doc, client, tier_index=tier_index
    )
    brow = _batch_portal_row_for_program(
        settings_doc.get("awrp_batch_program_offers") or {},
        batch_id,
        program_id,
    )
    effective_per_map = per_map if annual_dashboard_access else {}
    program_portal_pricing_override = _program_has_portal_pricing_override(
        effective_per_map, program_id, brow
    )
    plain_sel, peer_sel = 0, 0
    inc_cfg = settings_doc.get("annual_package_included_program_ids")
    if id_list:
        fam_by_row = {str(m.get("id")): m for m in fam if m.get("id")}
        resolved_rows = [fam_by_row[i] for i in id_list if i in fam_by_row]
        plain_sel, peer_sel = _selection_counts_plain_peer_display(
            client, resolved_rows, household_peer_ids=hp_ids
        )
        imm_plain, imm_peer, ext_fc = _split_resolved_guest_rows_plain_peer_ext(
            client,
            resolved_rows,
            included_in_package=included,
            program=program,
            annual_package_program_ids=inc_cfg,
            household_peer_ids=hp_ids,
        )
    else:
        resolved_rows = []
        imm_plain, imm_peer, ext_fc = fc, 0, 0
        plain_sel, peer_sel = max(0, int(fc)), 0
    fo_plain = _family_offer_for_included_package_guests(included, imm_plain, fo)
    pricing = await compute_dashboard_annual_family_pricing(
        program,
        program_id,
        currency,
        imm_plain,
        imm_peer,
        ext_fc,
        ao,
        fo_plain,
        eo,
        include_self=include_self,
        tier_index_override=tier_index,
        apply_tier_offer_prices=True,
        booker_annual_portal=_portal_member_column_for_self(client, annual_dashboard_access),
    )
    # Sacred Home pinned program: use Home Coming catalog PACKAGE OFFER total from annual_packages
    # (admin "Package offer (catalog total)") when tier-line math is empty or secondary.
    pin_program_id = (settings_doc.get("dashboard_sacred_home_annual_program_id") or "").strip()
    if (
        pin_program_id
        and str(program_id).strip() == str(pin_program_id).strip()
        and not included
        and not batch_id
    ):
        pkg_cat = await _active_home_coming_package_catalog_row()
        co = _offer_total_from_annual_package(pkg_cat, currency)
        if co > 0:
            pricing["total"] = co
            pricing["offer_subtotal"] = co
            pricing["list_subtotal"] = co
            pricing["portal_discount_total"] = 0.0

    qc = _dashboard_quote_participant_count(include_self, imm_plain, imm_peer, ext_fc)
    pricing = _apply_crm_portal_discount_to_pricing_total(
        pricing,
        client,
        str(pricing.get("currency") or currency or "aed"),
        qc,
    )

    peer_pkg_inc = max(0, int(peer_sel) - int(imm_peer)) if id_list else 0
    cur = str(pricing.get("currency") or "aed").lower()
    gst_pct = _site_gst_percent(settings_doc)
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
        "program_portal_pricing_override": bool(program_portal_pricing_override),
        "awrp_batch_id": batch_id,
        **pricing,
        "annual_household_peer_selected_count": peer_sel,
        "annual_household_peer_package_included_count": peer_pkg_inc,
        "immediate_family_only_selected_count": plain_sel,
        "quote_show_tax": quote_show_tax,
        "tax_rate_pct": gst_pct if cur == "inr" and quote_show_tax else 0.0,
        "tax_included_estimate": tax_included_estimate if cur == "inr" and quote_show_tax else 0.0,
    }


def _dashboard_tier_index_for_preview(program: dict, annual_dashboard_access: bool) -> Optional[int]:
    """Match dashboard UI: Annual access prefers year-long tier; else first tier."""
    tiers = program.get("duration_tiers") or []
    if not program.get("is_flagship") or not tiers:
        return None
    if annual_dashboard_access:
        for i, t in enumerate(tiers):
            lab = (t.get("label") or "").lower()
            if "annual" in lab or "year" in lab or t.get("duration_unit") == "year":
                return i
    return 0


async def build_admin_dashboard_pricing_snapshot(
    client_id: str, currency: str = "inr", limit: int = 15
) -> Optional[dict]:
    """
    Same portal math as GET /dashboard-quote for each upcoming program (self only, no guests).
    Used by admin Dashboard Access preview — no student session / impersonation.
    """
    client = await _student_client_row_with_expiry(client_id)
    if not client:
        return None
    sub = client.get("subscription") or {}
    annual_dashboard_access = _annual_dashboard_access(client)
    is_annual = _is_annual_subscriber(sub, client)

    upcoming_models = await fetch_programs_with_deadline_sync(db, True, True)
    upcoming = [p.model_dump() for p in sort_programs_like_homepage(upcoming_models)]

    settings_doc = await db.site_settings.find_one(
        {"id": "site_settings"},
        {
            "_id": 0,
            "dashboard_offer_annual": 1,
            "dashboard_offer_family": 1,
            "dashboard_offer_extended": 1,
            "annual_package_included_program_ids": 1,
            "dashboard_program_offers": 1,
            "awrp_batch_program_offers": 1,
            "india_gst_percent": 1,
            "dashboard_annual_quote_show_tax": 1,
        },
    ) or {}
    per_map = settings_doc.get("dashboard_program_offers") or {}
    inc_cfg = settings_doc.get("annual_package_included_program_ids")
    gst_pct = _site_gst_percent(settings_doc)
    qst = settings_doc.get("dashboard_annual_quote_show_tax", True)
    quote_show_tax = True if qst is None else bool(qst)

    cur_in = (currency or "inr").lower()
    program_rows: List[dict] = []
    for raw in upcoming[: max(1, min(limit, 40))]:
        pid = str(raw.get("id") or "")
        if not pid:
            continue
        program = await db.programs.find_one({"id": pid}, {"_id": 0})
        if not program:
            program = raw
        if program.get("enrollment_open") is False:
            continue
        tier_idx = _dashboard_tier_index_for_preview(program, annual_dashboard_access)
        included = _portal_included_in_annual_package(program, inc_cfg, sub, client)
        include_self = False if included else True
        ao, fo, eo, batch_id_snap = _merged_portal_offers_for_payer(
            annual_dashboard_access, pid, settings_doc, client, tier_index=tier_idx
        )
        brow = _batch_portal_row_for_program(
            settings_doc.get("awrp_batch_program_offers") or {},
            batch_id_snap,
            pid,
        )
        effective_per_map = per_map if annual_dashboard_access else {}
        ppo = _program_has_portal_pricing_override(effective_per_map, pid, brow)
        pricing = await compute_dashboard_annual_family_pricing(
            program,
            pid,
            cur_in,
            0,
            0,
            0,
            ao,
            fo,
            eo,
            include_self=include_self,
            tier_index_override=tier_idx,
            apply_tier_offer_prices=True,
            booker_annual_portal=_portal_member_column_for_self(client, annual_dashboard_access),
        )
        qc = _dashboard_quote_participant_count(include_self, 0, 0, 0)
        pricing = _apply_crm_portal_discount_to_pricing_total(pricing, client, cur_in, qc)
        cur = str(pricing.get("currency") or cur_in).lower()
        tot = float(pricing.get("total") or 0)
        tax_included_estimate = 0.0
        if quote_show_tax and cur == "inr" and gst_pct > 0 and tot > 0:
            tax_included_estimate = round(tot - tot / (1 + gst_pct / 100), 2)
        program_rows.append(
            {
                "program_id": pid,
                "program_title": program.get("title") or raw.get("title") or "",
                "included_in_annual_package": included,
                "portal_pricing_override": bool(ppo),
                "tier_index": tier_idx,
                "self_after_promos": pricing.get("self_after_promos"),
                "total": pricing.get("total"),
                "self_unit": pricing.get("self_unit"),
                "member_pricing_rule": pricing.get("member_pricing_rule"),
                "currency": cur,
                "quote_show_tax": quote_show_tax,
                "tax_included_estimate": tax_included_estimate if quote_show_tax and cur == "inr" else None,
            }
        )

    return {
        "client_id": client_id,
        "client_name": client.get("name"),
        "email": client.get("email"),
        "annual_member_dashboard": bool(client.get("annual_member_dashboard")),
        "is_annual_subscriber": is_annual,
        "currency": cur_in,
        "programs": program_rows,
    }


@router.post("/dashboard-pay")
async def dashboard_pay(data: DashboardPayIn, request: Request, user: dict = Depends(get_current_student_user)):
    """Create a verified enrollment with portal (annual/family) pricing; client then POSTs /api/enrollment/{id}/checkout."""
    from routes.enrollment import ParticipantData, detect_ip_info

    client_id = user.get("client_id")
    if not client_id:
        raise HTTPException(status_code=400, detail="User not linked to client record")
    await assert_claimed_hub_matches_stripe(request, data.currency)
    client = await _student_client_row_with_expiry(client_id)
    sub = client.get("subscription") or {}
    annual_dashboard_access = _annual_dashboard_access(client)
    hp_ids = await _household_peer_ids_for_pricing(client_id, client)
    program = await db.programs.find_one({"id": data.program_id}, {"_id": 0})
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    if not program.get("enrollment_open", True):
        raise HTTPException(status_code=400, detail="Enrollment is not open for this program")
    pay_tier = _coalesce_tier_index_for_flagship_portal(program, data.tier_index)
    settings_doc = await db.site_settings.find_one(
        {"id": "site_settings"},
        {
            "_id": 0,
            "dashboard_offer_annual": 1,
            "dashboard_offer_family": 1,
            "dashboard_offer_extended": 1,
            "annual_package_included_program_ids": 1,
            "dashboard_program_offers": 1,
            "awrp_batch_program_offers": 1,
        },
    ) or {}
    included = _portal_included_in_annual_package(
        program, settings_doc.get("annual_package_included_program_ids"), sub, client
    )
    all_guests = await _all_dashboard_guest_rows_with_household(client_id, client, for_payment=True)
    resolved_family = await _resolve_family_rows(
        client_id, client, list(data.family_member_ids or []), int(data.family_count or 0)
    )
    if included:
        # Same-key household peers are already covered by the prepaid package — not separate enrollments.
        resolved_family = [
            r for r in resolved_family if not _row_is_annual_family_club_peer(r, hp_ids)
        ]
    inc_cfg_pay = settings_doc.get("annual_package_included_program_ids")
    imm_plain, imm_peer, ext_fc = _split_resolved_guest_rows_plain_peer_ext(
        client,
        resolved_family,
        included_in_package=included,
        program=program,
        annual_package_program_ids=inc_cfg_pay,
        household_peer_ids=hp_ids,
    )
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

    ao, fo, eo, _bid = _merged_portal_offers_for_payer(
        annual_dashboard_access, data.program_id, settings_doc, client, tier_index=pay_tier
    )
    fo_plain = _family_offer_for_included_package_guests(included, imm_plain, fo)
    quote = await compute_dashboard_annual_family_pricing(
        program,
        data.program_id,
        data.currency,
        imm_plain,
        imm_peer,
        ext_fc,
        ao,
        fo_plain,
        eo,
        include_self=not included,
        tier_index_override=pay_tier,
        apply_tier_offer_prices=True,
        booker_annual_portal=_portal_member_column_for_self(client, annual_dashboard_access),
    )
    qc = _dashboard_quote_participant_count(not included, imm_plain, imm_peer, ext_fc)
    quote = _apply_crm_portal_discount_to_pricing_total(quote, client, data.currency, qc)
    if quote["total"] < 0:
        raise HTTPException(status_code=400, detail="Invalid quote")
    if quote["total"] == 0 and not included:
        raise HTTPException(status_code=400, detail="No payable amount for this program")

    pref_by_id = {
        str(x.family_member_id).strip(): x
        for x in (data.guest_seat_prefs or [])
        if str(x.family_member_id).strip()
    }

    snap = _profile_snapshot_for_prefill(user, client)
    booker_country_iso = normalize_country_iso2(snap.get("country") or client.get("country"))
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
                country=booker_country_iso,
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
        raw_gc = (m.get("country") or "").strip()
        # Per-guest country only — do not inherit booker's country when family/friends differ (same as gateway ISO claims).
        fam_country = normalize_country_iso2(raw_gc) if raw_gc else "AE"
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
    pref_gpay, pref_bank = _merged_preferred_india_ids(sub, client)
    enrollment = {
        "id": receipt_id,
        "status": "contact_verified",
        "step": 3,
        "item_type": "program",
        "item_id": data.program_id,
        "item_title": program.get("title") or "",
        "booker_name": snap.get("name") or user.get("name") or "Student",
        "booker_email": (user.get("email") or "").lower().strip(),
        "booker_country": booker_country_iso,
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
        "preferred_india_gpay_id": pref_gpay,
        "preferred_india_bank_id": pref_bank,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.enrollments.insert_one(enrollment)
    try:
        await ensure_client_from_enrollment_lead(enrollment)
    except Exception as ex:
        logger.warning("ensure_client_from_enrollment_lead after dashboard enrollment: %s", ex)
    tier_for_checkout = quote.get("family_tier_index") if included else quote.get("self_tier_index")
    return {
        "enrollment_id": receipt_id,
        "pricing": quote,
        "tier_index": tier_for_checkout,
        "included_in_annual_package": included,
    }


@router.get("/home")
async def get_student_home(user: dict = Depends(get_current_student_user)):
    """Fetch personalized home data: Schedule, Package, Financials, Programs."""
    client_id = user.get("client_id")
    client = await _student_client_row_with_expiry(client_id)
    annual_portal_access_effective = _annual_dashboard_access(client)

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
            "dashboard_sacred_home_annual_program_id": 1,
            "dashboard_sacred_home_show_non_annual": 1,
            "awrp_portal_batches": 1,
            "india_gpay_accounts": 1,
            "india_bank_accounts": 1,
            "india_bank_details": 1,
            "india_upi_id": 1,
            "portal_standard_late_fee_per_day": 1,
            "portal_standard_channelization_fee": 1,
            "portal_standard_show_late_fees": 1,
            "portal_standard_india_discount_percent": 1,
            "portal_standard_india_tax_percent": 1,
            "india_alt_discount_percent": 1,
            "india_gst_percent": 1,
        },
    ) or {}
    pin_annual_id = (settings_doc.get("dashboard_sacred_home_annual_program_id") or "").strip()
    show_non_annual_pin = settings_doc.get("dashboard_sacred_home_show_non_annual", True)
    if show_non_annual_pin is None:
        show_non_annual_pin = True
    show_non_annual_pin = bool(show_non_annual_pin)
    show_pin = False
    if pin_annual_id:
        if annual_portal_access_effective:
            show_pin = True
        elif show_non_annual_pin:
            show_pin = True
    if show_pin:
        pin_doc = await program_dict_with_deadline_sync(db, pin_annual_id)
        if pin_doc:
            pin_doc["dashboard_annual_product_pin"] = True
            rest = [p for p in upcoming if str(p.get("id")) != str(pin_annual_id)]
            upcoming = [pin_doc] + rest
    dashboard_offer_annual = settings_doc.get("dashboard_offer_annual") or {}
    dashboard_offer_family = settings_doc.get("dashboard_offer_family") or {}
    dashboard_offer_extended = settings_doc.get("dashboard_offer_extended") or {}
    dashboard_program_offers = settings_doc.get("dashboard_program_offers") or {}
    awrp_batches_cfg = settings_doc.get("awrp_portal_batches") or []
    batch_id_home = _client_awrp_batch_id(client)
    awrp_batch_payload = None
    if batch_id_home and isinstance(awrp_batches_cfg, list):
        meta = next(
            (
                b
                for b in awrp_batches_cfg
                if isinstance(b, dict) and str(b.get("id") or "").strip() == batch_id_home
            ),
            None,
        )
        if meta:
            awrp_batch_payload = {
                "id": batch_id_home,
                "label": (meta.get("label") or batch_id_home).strip(),
                "notes": (meta.get("notes") or "").strip(),
            }
        else:
            awrp_batch_payload = {"id": batch_id_home, "label": batch_id_home, "notes": ""}
    
    # 2. Subscription data (from Excel upload)
    sub = client.get("subscription", {})
    pkg_id_home = (sub.get("package_id") or "").strip()
    pkg_row_home = None
    if pkg_id_home:
        pkg_row_home = await db.annual_packages.find_one(
            {"package_id": pkg_id_home},
            {
                "_id": 0,
                "duration_months": 1,
                "valid_from": 1,
                "valid_to": 1,
                "preferred_membership_day_of_month": 1,
                "package_name": 1,
            },
        )
    dur_months_home = 12
    if pkg_row_home and pkg_row_home.get("duration_months") is not None:
        try:
            dur_months_home = max(1, min(120, int(pkg_row_home["duration_months"])))
        except (TypeError, ValueError):
            dur_months_home = 12
    sess = sub.get("sessions", {})
    emis = sub.get("emis") or []
    pm_sub = (sub.get("payment_mode") or "").strip()
    try:
        sur_pct = float(sub.get("installment_surcharge_percent") or 0)
    except (TypeError, ValueError):
        sur_pct = 0.0
    sur_pct = max(0.0, min(100.0, sur_pct))
    raw_base_package_fee = float(sub.get("total_fee") or 0)
    is_emi_plan = pm_sub == "EMI" and len(emis) > 0
    fam_n_fin = max(1, 1 + len(client.get("immediate_family") or []))
    rule_fin = _resolve_india_discount_rule(_crm_only_discount_dict(client), fam_n_fin)
    adj_base = raw_base_package_fee
    crm_disc_pct_display = None
    crm_disc_amt_display = None
    if raw_base_package_fee > 0 and not is_emi_plan:
        if rule_fin.get("mode") == "percent" and float(rule_fin.get("percent") or 0) > 0:
            crm_disc_pct_display = float(rule_fin["percent"])
            crm_disc_amt_display = round(raw_base_package_fee * crm_disc_pct_display / 100.0, 2)
            adj_base = round(raw_base_package_fee - crm_disc_amt_display, 2)
        elif (
            rule_fin.get("mode") == "amount"
            and float(rule_fin.get("amount_inr") or 0) > 0
            and str(sub.get("currency") or "INR").lower() == "inr"
        ):
            raw_amt = float(rule_fin["amount_inr"])
            crm_disc_amt_display = round(min(raw_base_package_fee, raw_amt), 2)
            adj_base = round(max(0, raw_base_package_fee - crm_disc_amt_display), 2)

    effective_total_fee = (
        round(adj_base * (1.0 + sur_pct / 100.0), 2)
        if is_emi_plan and sur_pct > 0 and adj_base > 0
        else adj_base
    )

    # 3. Financials - derived from subscription
    paid_emis = sum(1 for e in emis if e.get("status") == "paid")
    total_emis = len(emis)
    voluntary_credits = float(sub.get("voluntary_credits_total") or 0)
    total_paid_emis = sum(float(e.get("amount", 0) or 0) for e in emis if e.get("status") == "paid")
    total_paid = total_paid_emis + voluntary_credits
    total_fee = effective_total_fee
    remaining = max(0, total_fee - total_paid)

    hub_ov = str(client.get("pricing_hub_override") or "").strip().lower()
    if hub_ov in ("aed", "usd", "inr"):
        financials_currency = hub_ov.upper()
    else:
        financials_currency = str(sub.get("currency") or "INR").strip().upper() or "INR"

    financials = {
        "status": client.get("payment_status")
        or (
            "Paid"
            if remaining <= 0 and total_fee > 0
            else ("EMI" if total_emis > 0 else "N/A")
        ),
        "total_fee": total_fee,
        "base_package_fee": raw_base_package_fee,
        "installment_surcharge_percent": sur_pct if is_emi_plan else 0.0,
        "currency": financials_currency,
        "total_paid": total_paid,
        "remaining": remaining,
        "voluntary_credits_total": voluntary_credits,
        "payment_mode": sub.get("payment_mode", ""),
        "emi_plan": f"{paid_emis}/{total_emis} EMIs Paid" if total_emis > 0 else "",
        "emis": emis,
        "next_due": "No pending dues",
        "crm_discount_percent": crm_disc_pct_display,
        "crm_discount_amount": crm_disc_amt_display,
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
        "package_id": pkg_id_home,
        "duration_months": dur_months_home,
        "catalog_valid_from": (pkg_row_home.get("valid_from") or "") if pkg_row_home else "",
        "catalog_valid_to": (pkg_row_home.get("valid_to") or "") if pkg_row_home else "",
        "preferred_membership_day_of_month": int(pkg_row_home.get("preferred_membership_day_of_month") or 0)
        if pkg_row_home
        else 0,
        "bi_annual_download": sub.get("bi_annual_download", 0),
        "quarterly_releases": sub.get("quarterly_releases", 0),
    }

    last_annual_package = _last_annual_package_portal_payload(client, sub, pkg_row_home)
    if last_annual_package:
        plab = (last_annual_package.get("program_label") or "").strip()
        if (not plab) or (plab == "Annual program"):
            pid = (last_annual_package.get("package_id") or sub.get("package_id") or "").strip()
            if pid:
                prow = await db.annual_packages.find_one(
                    {"package_id": pid},
                    {"_id": 0, "package_name": 1},
                )
                if prow and prow.get("package_name"):
                    last_annual_package["program_label"] = str(prow["package_name"]).strip()

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
    eff_iris_y = _effective_iris_journey_year(client, sub, iris_journey)
    iris_journey_merged = iris_journey_with_year(eff_iris_y, iris_journey)
    home_coming = _home_coming_payload(client, sub, iris_journey_merged)
    if home_coming is None and last_annual_package:
        # Lapsed / between-year renewals: keep four-pillar copy when a previous annual window exists on file.
        home_coming = _home_coming_branding_dict(client, iris_journey_merged)
    if home_coming:
        package = {**package, "home_coming_label": home_coming["full_label"]}

    from routes.points_logic import points_public_summary

    loyalty_points = await points_public_summary(db, user.get("email") or "")

    is_annual = _is_annual_subscriber(sub, client)
    pref_gpay_m, pref_bank_m = _merged_preferred_india_ids(sub, client)
    hk = (client.get("household_key") or "").strip()
    annual_household_club_ok = bool(hk) and await _household_club_all_annual(hk) if client_id else False
    annual_household_peers = (
        await _household_peer_guest_rows(client_id, client, for_payment=False) if client_id else []
    )
    immediate_family = client.get("immediate_family") or []
    other_guests = client.get("other_guests") or []
    immediate_family_locked = _immediate_family_effective_locked(client)
    immediate_family_editing_approved = client.get("immediate_family_editing_approved") is not False
    family_approved = bool(client.get("family_approved"))
    family_pending_review = bool(client.get("family_pending_review"))

    crm_email_raw = (client.get("email") or "").strip()
    portal_email_raw = (user.get("email") or "").strip()
    synthetic_portal = portal_email_raw.lower().endswith("@impersonation.internal")
    can_add_contact_email = bool(client_id) and (not crm_email_raw or synthetic_portal)

    annual_catalog_bundle = None
    cat_row = await _active_home_coming_package_catalog_row()
    if cat_row:
        annual_catalog_bundle = {
            "package_id": str(cat_row.get("package_id") or ""),
            "package_name": str(cat_row.get("package_name") or ""),
            "duration_months": cat_row.get("duration_months"),
            "valid_from": str(cat_row.get("valid_from") or ""),
            "valid_to": str(cat_row.get("valid_to") or ""),
            "offer_total": cat_row.get("offer_total") if isinstance(cat_row.get("offer_total"), dict) else {},
        }

    return {
        "client_id": client_id,
        "upcoming_programs": upcoming,
        "is_annual_subscriber": is_annual,
        "annual_member_dashboard": bool(client.get("annual_member_dashboard")),
        "annual_portal_access": annual_portal_access_effective,
        "subscription_annual_package_signals": _subscription_annual_package_signals(sub),
        "dashboard_offers": (
            {
                "annual": dashboard_offer_annual,
                "family": dashboard_offer_family,
                "extended": dashboard_offer_extended,
            }
            if annual_portal_access_effective
            else {"annual": {}, "family": {}, "extended": {}}
        ),
        "dashboard_program_offers": dashboard_program_offers if annual_portal_access_effective else {},
        "awrp_batch": awrp_batch_payload if annual_portal_access_effective else None,
        "immediate_family": immediate_family,
        "annual_household_peers": annual_household_peers,
        "annual_household_club_ok": annual_household_club_ok,
        "has_household_key": bool(hk),
        "is_primary_household_contact": bool(client.get("is_primary_household_contact")),
        "other_guests": other_guests,
        "immediate_family_locked": immediate_family_locked,
        "immediate_family_editing_approved": immediate_family_editing_approved,
        "family_approved": family_approved,
        "family_pending_review": family_pending_review,
        "financials": financials,
        "package": package,
        "programs": programs_list,
        "schedule_preview": schedule_preview,
        "journey_logs": logs,
        "profile_status": profile_status,
        "payment_methods": payment_methods,
        "payment_destinations": payment_destinations,
        "bank_accounts": banks,
        **_merge_portal_late_channel_show(client, sub, settings_doc),
        "iris_journey": iris_journey_merged,
        # Automatic "journey year you are entering" for Home Coming renewal (garden label + lifecycle).
        "renewal_entering_iris_year": renewal_entering_iris_year(client, sub, iris_journey),
        # Manual / auto iris year from Client Garden subscription (renewal UI default).
        "subscription_journey": {
            "iris_year": sub.get("iris_year"),
            "iris_year_mode": sub.get("iris_year_mode") or "manual",
        },
        "home_coming": home_coming,
        "points": loyalty_points,
        "user_details": {
            "full_name": user.get("full_name") or user.get("name"),
            "city": user.get("city") or client.get("city"),
            "tier": user.get("tier"),
            "email": (portal_email_raw or crm_email_raw).strip() or None,
            "state": user.get("state") or client.get("state"),
            "country": user.get("country") or client.get("country"),
            "gender": user.get("gender") or client.get("gender"),
            "phone": user.get("phone") or client.get("phone") or "",
            "phone_code": user.get("phone_code") or client.get("phone_code") or "",
        },
        "india_payment_reference": {
            "india_gpay_accounts": settings_doc.get("india_gpay_accounts") or [],
            "india_bank_accounts": settings_doc.get("india_bank_accounts") or [],
            "india_bank_details": settings_doc.get("india_bank_details") or {},
            "india_upi_id": settings_doc.get("india_upi_id") or "",
        },
        "india_tax_info": india_tax_info,
        # Mirrors Client Garden + site portal defaults (subscription Excel overrides when authoritative).
        "client_india_pricing": _merge_client_india_pricing_portal(client, sub, settings_doc),
        # Raw CRM % / bands (portal merge in `client_india_pricing` may inject site defaults — use this for catalog list vs offer).
        "client_discount_source": {
            "india_discount_percent": client.get("india_discount_percent"),
            "india_discount_member_bands": client.get("india_discount_member_bands"),
        },
        "preferred_payment_method": (client.get("preferred_payment_method") or "").strip() or None,
        "preferred_india_gpay_id": pref_gpay_m,
        "preferred_india_bank_id": pref_bank_m,
        "contact_email": crm_email_raw or None,
        "can_add_contact_email": can_add_contact_email,
        "annual_renewal_reminder": annual_renewal_reminder_for_portal(client),
        "annual_portal_lifecycle": annual_portal_lifecycle_payload(client),
        # Student-chosen prefs for Home Coming / annual package (shown on dedicated purchase page; admin-visible on client doc).
        "annual_package_offer_prefs": client.get("annual_package_offer_prefs") if isinstance(client.get("annual_package_offer_prefs"), dict) else None,
        # Home Coming payment structure: each EMI / Flexi option only when admin set True on the client.
        "annual_package_offer_monthly_emi_visible": client.get("annual_package_offer_monthly_emi_visible") is True,
        "annual_package_offer_quarterly_emi_visible": client.get("annual_package_offer_quarterly_emi_visible")
        is True,
        "annual_package_offer_yearly_emi_visible": client.get("annual_package_offer_yearly_emi_visible") is True,
        "annual_package_offer_flexi_visible": client.get("annual_package_offer_flexi_visible") is True,
        # Active Home Coming catalog row (admin annual_packages): multi-currency offer_total for display on Home Coming package page.
        "annual_catalog_bundle": annual_catalog_bundle,
        # Enrollment window + label from subscription / annual_subscription — Home Coming gratitude card.
        "last_annual_package": last_annual_package,
        "annual_period_ledger": _portal_annual_period_ledger_safe(client.get("annual_period_ledger")),
    }


class ContactEmailBody(BaseModel):
    email: str


@router.put("/contact-email")
async def put_contact_email(data: ContactEmailBody, user: dict = Depends(get_current_student_user)):
    """Set Client Garden + portal login email when missing or portal uses an admin preview placeholder."""
    cid = user.get("client_id")
    if not cid:
        raise HTTPException(status_code=400, detail="Your account is not linked to Iris Garden.")
    em = (data.email or "").strip().lower()
    if not em or "@" not in em or len(em) > 200:
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")

    client = await db.clients.find_one({"id": cid}, {"_id": 0, "email": 1}) or {}
    crm_n = (client.get("email") or "").strip().lower()
    u_em = (user.get("email") or "").strip().lower()
    synthetic = u_em.endswith("@impersonation.internal")

    if crm_n and not synthetic:
        raise HTTPException(
            status_code=403,
            detail="Your contact email is already on file. To change it, contact your host.",
        )

    now = datetime.now(timezone.utc).isoformat()
    await db.clients.update_one({"id": cid}, {"$set": {"email": em, "updated_at": now}})
    await db.users.update_one({"id": user["id"]}, {"$set": {"email": em, "updated_at": now}})
    return {"message": "Email saved", "email": em}


class AnnualPackageOfferPrefsBody(BaseModel):
    desired_start_date: Optional[str] = ""
    payment_mode: Optional[str] = "full"
    emi_notes: Optional[str] = ""
    # Home Coming annual bundle: online vs offline participation (no in-person path for this catalog).
    participation_mode: Optional[str] = "online"


def _normalize_annual_offer_payment_mode(raw: Optional[str]) -> str:
    s = (raw or "").strip().lower().replace("-", "_")
    allowed = {"full", "emi_monthly", "emi_quarterly", "emi_yearly", "emi_flexi"}
    if s == "emi":
        return "emi_monthly"
    if s == "flexi":
        return "emi_flexi"
    return s if s in allowed else "full"


def _normalize_annual_offer_participation_mode(raw: Optional[str]) -> str:
    s = (raw or "").strip().lower()
    if s in ("offline", "off_line", "off-line"):
        return "offline"
    return "online"


@router.put("/annual-package-offer-preferences")
async def put_annual_package_offer_preferences(
    data: AnnualPackageOfferPrefsBody, user: dict = Depends(get_current_student_user)
):
    """Store Home Coming / annual package purchase preferences on the client record (admin CRM)."""
    cid = user.get("client_id")
    if not cid:
        raise HTTPException(status_code=400, detail="Your account is not linked to Iris Garden.")
    start = (data.desired_start_date or "").strip()[:10]
    if start and len(start) == 10:
        try:
            datetime.strptime(start, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Start date must be YYYY-MM-DD.")
    elif start:
        raise HTTPException(status_code=400, detail="Start date must be YYYY-MM-DD.")
    mode = _normalize_annual_offer_payment_mode(data.payment_mode)
    cli_pm = (
        await db.clients.find_one(
            {"id": cid},
            {
                "_id": 0,
                "annual_package_offer_monthly_emi_visible": 1,
                "annual_package_offer_quarterly_emi_visible": 1,
                "annual_package_offer_yearly_emi_visible": 1,
                "annual_package_offer_flexi_visible": 1,
            },
        )
        or {}
    )

    def _offer_mode_allowed(m: str) -> bool:
        if m == "full":
            return True
        if m == "emi_monthly":
            return cli_pm.get("annual_package_offer_monthly_emi_visible") is True
        if m == "emi_quarterly":
            return cli_pm.get("annual_package_offer_quarterly_emi_visible") is True
        if m == "emi_yearly":
            return cli_pm.get("annual_package_offer_yearly_emi_visible") is True
        if m == "emi_flexi":
            return cli_pm.get("annual_package_offer_flexi_visible") is True
        return False

    if not _offer_mode_allowed(mode):
        mode = "full"
    notes = (data.emi_notes or "").strip()
    if len(notes) > 800:
        raise HTTPException(status_code=400, detail="Note is too long (max 800 characters).")
    now = datetime.now(timezone.utc).isoformat()
    participation = _normalize_annual_offer_participation_mode(data.participation_mode)
    prefs = {
        "desired_start_date": start or None,
        "payment_mode": mode,
        "emi_notes": notes or None,
        "participation_mode": participation,
        "updated_at": now,
    }
    await db.clients.update_one({"id": cid}, {"$set": {"annual_package_offer_prefs": prefs, "updated_at": now}})
    return {"saved": True, "annual_package_offer_prefs": prefs}


class MembershipPeriodBody(BaseModel):
    start_date: str


@router.put("/membership-period")
async def put_membership_period(data: MembershipPeriodBody, user: dict = Depends(get_current_student_user)):
    """Annual package members set membership start; end date is derived from the package duration (same rule as admin)."""
    cid = user.get("client_id")
    if not cid:
        raise HTTPException(status_code=400, detail="Your account is not linked to Iris Garden.")
    client = await _student_client_row_with_expiry(cid)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    sub = dict(client.get("subscription") or {})
    if not _is_annual_subscriber(sub, client):
        raise HTTPException(
            status_code=403,
            detail="Membership dates can only be set for annual package subscribers.",
        )
    pkg_id = (sub.get("package_id") or "").strip()
    if not pkg_id:
        raise HTTPException(
            status_code=400,
            detail="No package is linked to your subscription. Your host must assign a package before you can set membership dates.",
        )
    pkg_row = await db.annual_packages.find_one({"package_id": pkg_id}, {"_id": 0}) or {}
    duration = 12
    if pkg_row.get("duration_months") is not None:
        try:
            duration = max(1, min(120, int(pkg_row["duration_months"])))
        except (TypeError, ValueError):
            duration = 12
    start_d = _parse_ymd_loose(data.start_date)
    if not start_d:
        raise HTTPException(status_code=400, detail="Enter a valid start date (YYYY-MM-DD).")
    vf = _parse_ymd_loose(pkg_row.get("valid_from") or "")
    vt = _parse_ymd_loose(pkg_row.get("valid_to") or "")
    if vf and start_d < vf:
        raise HTTPException(
            status_code=400,
            detail=f"Start date must be on or after the package offer window ({vf.isoformat()}).",
        )
    if vt and start_d > vt:
        raise HTTPException(
            status_code=400,
            detail=f"Start date must be on or before the package offer window ({vt.isoformat()}).",
        )
    emis = sub.get("emis") or []
    if any(isinstance(e, dict) and e.get("status") == "paid" for e in emis):
        raise HTTPException(
            status_code=409,
            detail="Membership start cannot be changed after a payment is recorded. Contact your host to adjust your record.",
        )
    start_s = start_d.isoformat()
    end_s = _add_months_subscription_end(start_s, duration)
    if not end_s:
        raise HTTPException(status_code=400, detail="Could not compute membership end date.")
    sub["start_date"] = start_s
    sub["end_date"] = end_s
    pd = sub.get("programs_detail")
    if isinstance(pd, list):
        for p in pd:
            if isinstance(p, dict):
                p["start_date"] = start_s
                p["end_date"] = end_s
    now = datetime.now(timezone.utc).isoformat()
    await db.clients.update_one(
        {"id": cid},
        {"$set": {"subscription": sub, "updated_at": now}},
    )
    emi_note = None
    if isinstance(emis, list) and len(emis) > 0:
        emi_note = (
            "If you have an EMI plan, due dates may still reflect the previous period until your host updates them."
        )
    return {"start_date": start_s, "end_date": end_s, "emi_schedule_note": emi_note}


class HouseholdPeerRowIn(BaseModel):
    id: str
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    date_of_birth: Optional[str] = None


class HouseholdPeersBody(BaseModel):
    members: List[HouseholdPeerRowIn]


@router.put("/household-peers")
async def put_household_peers(data: HouseholdPeersBody, user: dict = Depends(get_current_student_user)):
    """Primary household contact: update Client Garden fields for other same-key annual portal members."""
    booker_cid = user.get("client_id")
    if not booker_cid:
        raise HTTPException(status_code=400, detail="Your account is not linked to Iris Garden.")
    me = await db.clients.find_one(
        {"id": booker_cid},
        {"_id": 0, "household_key": 1, "is_primary_household_contact": 1},
    )
    if not me or not bool(me.get("is_primary_household_contact")):
        raise HTTPException(
            status_code=403,
            detail="Only the primary household contact can update Annual Family Club details.",
        )
    hk = (me.get("household_key") or "").strip()
    if not hk:
        raise HTTPException(status_code=400, detail="No household key on your record.")

    now = datetime.now(timezone.utc).isoformat()
    for row in data.members or []:
        tid = (row.id or "").strip()
        if not tid or tid == booker_cid:
            continue
        peer = await db.clients.find_one(
            {"id": tid, "household_key": hk},
            {"_id": 0, "id": 1},
        )
        if not peer:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot update this person: not on your household key.",
            )
        set_doc: Dict[str, Any] = {
            "name": normalize_person_name(
                ((row.name or "").strip() or "Household member")
            ),
            "email": (row.email or "").strip().lower(),
            "phone": (row.phone or "").strip(),
            "city": (row.city or "").strip(),
            "country": (row.country or "").strip()[:120],
            "updated_at": now,
        }
        dob = (row.date_of_birth or "").strip()[:10]
        set_doc["date_of_birth"] = dob if dob else None
        await db.clients.update_one({"id": tid}, {"$set": set_doc})

    return {"message": "Annual Family Club details saved"}


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
async def update_profile(data: ProfileUpdate, user: dict = Depends(get_current_student_user)):
    """Save profile immediately. Diffs are appended to `profile_update_log` for admins."""
    uid = user["id"]
    doc = await db.users.find_one({"id": uid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")

    body = {k: v for k, v in data.dict().items() if v is not None}
    stored_fields = _profile_payload_to_stored_fields(body)
    if not stored_fields:
        return {"message": "No profile fields to save", "saved": False}

    changes: Dict[str, Any] = {}
    for key, new_val in stored_fields.items():
        old_val = doc.get(key)
        o = "" if old_val is None else str(old_val).strip()
        n = "" if new_val is None else str(new_val).strip()
        if o != n:
            changes[key] = {"from": old_val, "to": new_val}

    now = datetime.now(timezone.utc).isoformat()
    set_doc = {
        **stored_fields,
        "pending_profile_update": None,
        "profile_approved": True,
        "updated_at": now,
    }
    upd: Dict[str, Any] = {"$set": set_doc, "$unset": {"full_name": ""}}
    if changes:
        upd["$push"] = {
            "profile_update_log": {
                "$each": [{"at": now, "changes": changes}],
                "$slice": -80,
            }
        }

    await db.users.update_one({"id": uid}, upd)

    if doc.get("client_id") and stored_fields:
        await db.clients.update_one(
            {"id": doc["client_id"]},
            {"$set": {**stored_fields, "updated_at": now}},
        )

    try:
        from routes.points_logic import try_award_activity_points, normalize_email

        user_after = await db.users.find_one({"id": uid}, {"_id": 0, "email": 1})
        merged_email = normalize_email((user_after or {}).get("email") or doc.get("email") or "")
        if merged_email:
            await try_award_activity_points(
                db,
                merged_email,
                "profile_complete",
                ref_unique=f"profile_complete:{uid}",
                program_id=None,
                meta={"user_id": uid},
            )
    except Exception:
        pass

    return {"message": "Profile saved", "saved": True}

class JourneyLogCreate(BaseModel):
    date: str
    title: str
    category: str
    experience: str
    learning: str
    rating: int

@router.post("/logs")
async def create_journey_log(data: JourneyLogCreate, user: dict = Depends(get_current_student_user)):
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
async def get_journey_logs(user: dict = Depends(get_current_student_user)):
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
async def choose_session_mode(data: ModeChoice, user: dict = Depends(get_current_student_user)):
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
async def save_daily_progress(data: DailyProgressCreate, user: dict = Depends(get_current_student_user)):
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
async def get_daily_progress(month: str = "", user: dict = Depends(get_current_student_user)):
    """Get daily progress entries. Optional: filter by month (YYYY-MM)."""
    client_id = user.get("client_id")
    query = {"client_id": client_id}
    if month:
        query["date"] = {"$regex": f"^{month}"}
    entries = await db.daily_progress.find(query, {"_id": 0}).sort("date", -1).to_list(366)
    return entries

@router.get("/extraordinary-moments")
async def get_extraordinary_moments(user: dict = Depends(get_current_student_user)):
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
async def pause_program(data: PauseRequest, user: dict = Depends(get_current_student_user)):
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
async def resume_program(data: ModeChoice, user: dict = Depends(get_current_student_user)):
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
async def resume_program_simple(data: ResumeRequest, user: dict = Depends(get_current_student_user)):
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
async def save_bhaad_release(data: BhaadRelease, user: dict = Depends(get_current_student_user)):
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
async def get_bhaad_history(user: dict = Depends(get_current_student_user)):
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
async def get_tribe_posts(user: dict = Depends(get_current_student_user)):
    posts = await db.tribe_posts.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return posts

@router.post("/tribe/posts")
async def create_tribe_post(data: TribePostCreate, user: dict = Depends(get_current_student_user)):
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
async def react_to_post(data: TribeReact, user: dict = Depends(get_current_student_user)):
    await db.tribe_posts.update_one(
        {"id": data.post_id},
        {"$inc": {f"reactions.{data.emoji}": 1}}
    )
    return {"message": "Reacted"}

@router.post("/tribe/comment")
async def comment_on_post(data: TribeComment, user: dict = Depends(get_current_student_user)):
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
async def student_points_detail(user: dict = Depends(get_current_student_user)):
    from routes.points_logic import points_public_summary, recent_ledger, fetch_points_config, EXTERNAL_REVIEW_ACTIVITY_ORDER

    email = user.get("email") or ""
    summary = await points_public_summary(db, email)
    ledger = await recent_ledger(db, email, 40)
    cfg = await fetch_points_config(db)
    amap = {a["id"]: a for a in (cfg.get("activities") or [])}
    external_reviews = []
    for eid in EXTERNAL_REVIEW_ACTIVITY_ORDER:
        if eid not in amap:
            continue
        a = amap[eid]
        external_reviews.append(
            {
                "id": a["id"],
                "label": a["label"],
                "points": int(a.get("points") or 0),
                "enabled": bool(a.get("enabled", True)),
            }
        )
    enrolled_programs = await _student_enrolled_program_choices(email)
    return {**summary, "ledger": ledger, "external_reviews": external_reviews, "enrolled_programs": enrolled_programs}


@router.post("/points/claim-external-review")
async def student_claim_external_review(data: ExternalReviewClaim, user: dict = Depends(get_current_student_user)):
    from routes.points_logic import try_claim_external_review, fetch_points_config

    email = user.get("email") or ""
    cfg = await fetch_points_config(db)
    if not cfg.get("enabled"):
        return {"ok": False, "error": "points_disabled"}

    pid = (data.program_id or "").strip()
    if pid and not await _student_has_enrollment_for_program(email, pid):
        return {"ok": False, "error": "program_not_eligible"}

    program_name = ""
    if pid:
        pr = await db.programs.find_one({"id": pid}, {"_id": 0, "title": 1})
        if pr:
            program_name = (pr.get("title") or "").strip()

    return await try_claim_external_review(
        db,
        email=email,
        user=user,
        activity_id=data.activity_id.strip(),
        review_url=data.review_url,
        program_id=pid or None,
        quote=data.quote or "",
        program_name=program_name,
    )


@router.post("/points/claim-bonus")
async def student_points_claim_bonus(data: PointsBonusClaim, user: dict = Depends(get_current_student_user)):
    from routes.points_logic import claim_one_time_bonus

    return await claim_one_time_bonus(db, user.get("email") or "", data.kind.strip().lower(), user)
