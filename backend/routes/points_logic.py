"""Loyalty points (earn & burn) — balances, grants, redemption, purchase earn."""
from __future__ import annotations

import hashlib
import logging
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse, urlunparse

logger = logging.getLogger(__name__)

# Default earn activities (admin can override points, enabled, program_ids in site_settings.points_activities)
DEFAULT_POINTS_ACTIVITIES: List[Dict[str, Any]] = [
    {"id": "profile_complete", "label": "Profile approved (complete)", "points": 25, "enabled": True, "program_ids": []},
    {"id": "testimonial_template_written", "label": "Written testimonial (template, public)", "points": 40, "enabled": True, "program_ids": []},
    {"id": "testimonial_video_public", "label": "Video testimonial (public)", "points": 60, "enabled": True, "program_ids": []},
    {"id": "transformation_before_after", "label": "Before/after transformation (public)", "points": 80, "enabled": True, "program_ids": []},
    {"id": "streak_30", "label": "30-day dashboard streak (student claim)", "points": 50, "enabled": True, "program_ids": []},
    {"id": "review_submitted", "label": "Review submitted (student claim)", "points": 50, "enabled": True, "program_ids": []},
    {"id": "review_google", "label": "Google review (link + moderation)", "points": 50, "enabled": True, "program_ids": []},
    {"id": "review_trustpilot", "label": "Trustpilot review (link + moderation)", "points": 50, "enabled": True, "program_ids": []},
    {"id": "review_facebook", "label": "Facebook review (link + moderation)", "points": 50, "enabled": True, "program_ids": []},
    {"id": "referral_signup_bonus", "label": "Referrer bonus (new member paid)", "points": 500, "enabled": True, "program_ids": []},
]

# Public review platforms — idempotent per account per normalized URL.
EXTERNAL_REVIEW_ACTIVITY_IDS = frozenset({"review_google", "review_trustpilot", "review_facebook"})
EXTERNAL_REVIEW_ACTIVITY_ORDER: Tuple[str, ...] = ("review_google", "review_trustpilot", "review_facebook")

ACTIVITY_LEDGER_PREFIX = "activity_"


def normalize_email(email: str) -> str:
    return (email or "").lower().strip()


def _default_config() -> dict:
    return {
        "enabled": True,
        "max_basket_pct": 20.0,
        "expiry_months": 6,
        "points_inr_per_point": 1.0,
        "points_usd_per_point": 0.01,
        "points_aed_per_point": 0.037,
        "points_earn_per_inr_paid": 0.5,
        "points_earn_per_usd_paid": 0.5,
        "points_earn_per_aed_paid": 0.5,
        "points_bonus_streak_30": 50,
        "points_bonus_review": 50,
        "points_bonus_referral": 500,
        "redeem_excludes_flagship": True,
        "activities": list(DEFAULT_POINTS_ACTIVITIES),
    }


def merge_points_activities(stored: Optional[list]) -> List[Dict[str, Any]]:
    """Merge DB overrides into defaults; preserve order (defaults first, then unknown ids)."""
    by_id: Dict[str, Dict[str, Any]] = {}
    for row in DEFAULT_POINTS_ACTIVITIES:
        by_id[row["id"]] = {**row, "program_ids": list(row.get("program_ids") or [])}
    if stored:
        for row in stored:
            aid = row.get("id")
            if not aid:
                continue
            aid = str(aid)
            if aid in by_id:
                cur = by_id[aid]
                if row.get("label") is not None:
                    cur["label"] = str(row.get("label") or "")
                if row.get("points") is not None:
                    cur["points"] = int(row.get("points") or 0)
                if row.get("enabled") is not None:
                    cur["enabled"] = bool(row.get("enabled"))
                if row.get("program_ids") is not None:
                    cur["program_ids"] = [str(x) for x in (row.get("program_ids") or []) if x is not None]
            else:
                by_id[aid] = {
                    "id": aid,
                    "label": str(row.get("label") or aid),
                    "points": int(row.get("points") or 0),
                    "enabled": bool(row.get("enabled", True)),
                    "program_ids": [str(x) for x in (row.get("program_ids") or []) if x is not None],
                }
    ordered_ids = [r["id"] for r in DEFAULT_POINTS_ACTIVITIES]
    known = set(ordered_ids)
    out = [by_id[i] for i in ordered_ids if i in by_id]
    out.extend(by_id[k] for k in by_id if k not in known)
    return out


def load_points_config(raw: Optional[dict]) -> dict:
    s = raw or {}
    base = _default_config()
    # Default True when the key is omitted so older site_settings docs activate the wallet without a migration.
    base["enabled"] = bool(s.get("points_enabled", True))
    base["max_basket_pct"] = float(s.get("points_max_basket_pct", 20.0))
    base["expiry_months"] = int(s.get("points_expiry_months", 6))
    base["points_inr_per_point"] = float(s.get("points_inr_per_point", 1.0))
    base["points_usd_per_point"] = float(s.get("points_usd_per_point", 0.01))
    base["points_aed_per_point"] = float(s.get("points_aed_per_point", 0.037))
    base["points_earn_per_inr_paid"] = float(s.get("points_earn_per_inr_paid", 0.5))
    base["points_earn_per_usd_paid"] = float(s.get("points_earn_per_usd_paid", 0.5))
    base["points_earn_per_aed_paid"] = float(s.get("points_earn_per_aed_paid", 0.5))
    base["redeem_excludes_flagship"] = bool(s.get("points_redeem_excludes_flagship", True))
    base["activities"] = merge_points_activities(s.get("points_activities"))
    # Legacy numeric keys — keep in sync with activity rows when present
    _amap = {a["id"]: a for a in base["activities"]}
    if "streak_30" in _amap:
        base["points_bonus_streak_30"] = int(_amap["streak_30"].get("points") or 0)
    else:
        base["points_bonus_streak_30"] = int(s.get("points_bonus_streak_30", 50))
    if "review_submitted" in _amap:
        base["points_bonus_review"] = int(_amap["review_submitted"].get("points") or 0)
    else:
        base["points_bonus_review"] = int(s.get("points_bonus_review", 50))
    if "referral_signup_bonus" in _amap:
        base["points_bonus_referral"] = int(_amap["referral_signup_bonus"].get("points") or 0)
    else:
        base["points_bonus_referral"] = int(s.get("points_bonus_referral", 500))
    return base


async def fetch_points_config(db) -> dict:
    doc = await db.site_settings.find_one({"id": "site_settings"}, {"_id": 0})
    return load_points_config(doc or {})


def fiat_per_point(currency: str, cfg: dict) -> float:
    cur = (currency or "aed").lower()
    key = {
        "inr": "points_inr_per_point",
        "usd": "points_usd_per_point",
        "aed": "points_aed_per_point",
    }.get(cur, "points_aed_per_point")
    v = float(cfg.get(key) or 0)
    if v <= 0:
        return 0.0001
    return v


def earn_rate_per_unit(currency: str, cfg: dict) -> float:
    cur = (currency or "aed").lower()
    key = {
        "inr": "points_earn_per_inr_paid",
        "usd": "points_earn_per_usd_paid",
        "aed": "points_earn_per_aed_paid",
    }.get(cur, "points_earn_per_aed_paid")
    return max(0.0, float(cfg.get(key) or 0))


async def expire_stale_batches(db, email: str) -> None:
    em = normalize_email(email)
    if not em:
        return
    now = datetime.now(timezone.utc)
    cursor = db.points_batches.find(
        {"email": em, "remaining": {"$gt": 0}, "expires_at": {"$lt": now}},
        {"_id": 1, "remaining": 1},
    )
    async for doc in cursor:
        lost = int(doc.get("remaining") or 0)
        if lost <= 0:
            continue
        await db.points_batches.update_one(
            {"_id": doc["_id"]},
            {"$set": {"remaining": 0, "expired_cleared_at": now.isoformat()}},
        )
        await append_ledger(
            db,
            em,
            -lost,
            "expired",
            ref_id=str(doc["_id"]),
            meta={"batch_id": doc.get("id")},
        )


async def available_balance(db, email: str) -> int:
    em = normalize_email(email)
    if not em:
        return 0
    await expire_stale_batches(db, em)
    now = datetime.now(timezone.utc)
    pipeline = [
        {"$match": {"email": em, "remaining": {"$gt": 0}, "expires_at": {"$gte": now}}},
        {"$group": {"_id": None, "t": {"$sum": "$remaining"}}},
    ]
    agg = await db.points_batches.aggregate(pipeline).to_list(1)
    return int(agg[0]["t"]) if agg else 0


async def append_ledger(
    db,
    email: str,
    delta: int,
    reason: str,
    ref_id: str = "",
    meta: Optional[dict] = None,
) -> None:
    em = normalize_email(email)
    if not em:
        return
    doc = {
        "id": str(uuid.uuid4()),
        "email": em,
        "delta": int(delta),
        "reason": reason,
        "ref_id": ref_id or "",
        "meta": meta or {},
        "created_at": datetime.now(timezone.utc),
    }
    await db.points_ledger.insert_one(doc)


async def grant_points(
    db,
    email: str,
    points: int,
    reason: str,
    ref_id: str = "",
    meta: Optional[dict] = None,
    cfg: Optional[dict] = None,
) -> dict:
    em = normalize_email(email)
    if not em or points <= 0:
        return {"ok": False, "error": "invalid_grant"}
    if cfg is None:
        cfg = await fetch_points_config(db)
    months = max(1, int(cfg.get("expiry_months") or 6))
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=30 * months)
    batch_id = str(uuid.uuid4())
    await db.points_batches.insert_one(
        {
            "id": batch_id,
            "email": em,
            "remaining": int(points),
            "original": int(points),
            "expires_at": expires_at,
            "created_at": now,
            "reason": reason,
            "ref_id": ref_id or "",
        }
    )
    await append_ledger(db, em, int(points), reason, ref_id=ref_id, meta=meta)
    return {"ok": True, "batch_id": batch_id, "expires_at": expires_at.isoformat()}


def compute_points_redemption(
    requested_points: int,
    basket_subtotal: float,
    currency: str,
    available: int,
    cfg: dict,
) -> Tuple[int, float]:
    """
    Returns (points_to_burn, cash_discount) in pricing currency.
    Capped by available balance, basket %, and basket size.
    """
    if not cfg.get("enabled") or requested_points <= 0 or basket_subtotal <= 0:
        return 0, 0.0
    per = fiat_per_point(currency, cfg)
    max_pct = max(0.0, min(100.0, float(cfg.get("max_basket_pct") or 0)))
    max_cash = basket_subtotal * (max_pct / 100.0)
    max_points_by_cash = int(max_cash / per) if per > 0 else 0
    max_points = min(available, max_points_by_cash, int(requested_points))
    if max_points <= 0:
        return 0, 0.0
    cash = min(max_points * per, max_cash, basket_subtotal)
    cash = round(float(cash), 2)
    actual_points = int(round(cash / per)) if per > 0 else 0
    if actual_points > max_points:
        actual_points = max_points
    cash = round(min(actual_points * per, max_cash, basket_subtotal), 2)
    return actual_points, cash


async def redeem_points_fifo(
    db,
    email: str,
    points: int,
    ref_id: str,
    reason: str = "redeem_checkout",
) -> Tuple[int, Optional[str]]:
    """Burn points FIFO by created_at. Returns (burned, error if partial)."""
    em = normalize_email(email)
    if not em or points <= 0:
        return 0, None
    await expire_stale_batches(db, em)
    target = int(points)
    need = target
    now = datetime.now(timezone.utc)
    while need > 0:
        batch = await db.points_batches.find_one(
            {"email": em, "remaining": {"$gt": 0}, "expires_at": {"$gte": now}},
            sort=[("created_at", 1)],
        )
        if not batch:
            err = "insufficient_points" if need == target else "partial_redeem"
            if target - need > 0:
                await append_ledger(
                    db,
                    em,
                    -(target - need),
                    reason,
                    ref_id=ref_id,
                    meta={"burned": target - need, "requested": target, "error": err},
                )
            return target - need, err if need > 0 else None
        rem = int(batch["remaining"])
        take = min(rem, need)
        new_rem = rem - take
        res = await db.points_batches.update_one(
            {"_id": batch["_id"], "remaining": rem},
            {"$set": {"remaining": new_rem}},
        )
        if res.modified_count != 1:
            continue
        need -= take
    burned = target
    await append_ledger(
        db,
        em,
        -burned,
        reason,
        ref_id=ref_id,
        meta={"burned": burned},
    )
    return burned, None


async def ledger_has_ref(db, ref_id: str, reason: str) -> bool:
    if not ref_id:
        return False
    doc = await db.points_ledger.find_one({"ref_id": ref_id, "reason": reason}, {"_id": 1})
    return doc is not None


def activity_program_allowed(activity: dict, program_id: Optional[str]) -> bool:
    ids = activity.get("program_ids") or []
    if not ids:
        return True
    pid = (program_id or "").strip()
    if not pid:
        return False
    return str(pid) in [str(x) for x in ids]


async def flagship_blocks_points_redemption(
    db,
    cfg: dict,
    *,
    item_type: str = "",
    item_id: str = "",
    cart_program_ids: Optional[list] = None,
) -> Tuple[bool, str]:
    if not cfg.get("redeem_excludes_flagship", True):
        return False, ""
    it = (item_type or "").lower().strip()
    iid = (item_id or "").strip()
    if it == "program" and iid:
        pr = await db.programs.find_one({"id": iid}, {"_id": 0, "is_flagship": 1})
        if pr and pr.get("is_flagship"):
            return True, "Points cannot be used toward flagship programs."
    seen = set()
    for raw in cart_program_ids or []:
        pid = str(raw).strip() if raw is not None else ""
        if not pid or pid in seen:
            continue
        seen.add(pid)
        pr = await db.programs.find_one({"id": pid}, {"_id": 0, "is_flagship": 1})
        if pr and pr.get("is_flagship"):
            return True, "Points cannot be used when a flagship program is in your cart."
    return False, ""


async def try_award_activity_points(
    db,
    email: str,
    activity_id: str,
    ref_unique: str,
    *,
    program_id: Optional[str] = None,
    meta: Optional[dict] = None,
) -> dict:
    cfg = await fetch_points_config(db)
    if not cfg.get("enabled"):
        return {"awarded": False, "reason": "points_disabled"}
    act = next((a for a in cfg.get("activities") or [] if a.get("id") == activity_id), None)
    if not act:
        return {"awarded": False, "reason": "unknown_activity"}
    if not act.get("enabled", True):
        return {"awarded": False, "reason": "activity_disabled"}
    pts = int(act.get("points") or 0)
    if pts <= 0:
        return {"awarded": False, "reason": "zero_points"}
    if not activity_program_allowed(act, program_id):
        return {"awarded": False, "reason": "program_not_allowed"}
    em = normalize_email(email)
    if not em:
        return {"awarded": False, "reason": "no_email"}
    reason = f"{ACTIVITY_LEDGER_PREFIX}{activity_id}"
    if await ledger_has_ref(db, ref_unique, reason):
        return {"awarded": False, "reason": "already_awarded"}
    await grant_points(
        db,
        em,
        pts,
        reason,
        ref_id=ref_unique,
        meta={**(meta or {}), "activity_id": activity_id},
        cfg=cfg,
    )
    return {"awarded": True, "points": pts}


def normalize_and_validate_external_review_url(activity_id: str, raw_url: str) -> Tuple[Optional[str], str]:
    """
    Returns (normalized_url, error_key). error_key is empty on success.
    """
    u = (raw_url or "").strip()
    if not u:
        return None, "url_required"
    if len(u) > 2048:
        return None, "url_too_long"
    try:
        parsed = urlparse(u)
    except Exception:
        return None, "invalid_url"
    if (parsed.scheme or "").lower() not in ("http", "https"):
        return None, "invalid_url"
    host = (parsed.hostname or "").lower()
    if not host:
        return None, "invalid_url"

    if activity_id == "review_google":
        ok = (
            "google." in host
            or host in ("g.page", "maps.app.goo.gl", "g.co", "goo.gl")
            or host.endswith(".g.page")
        )
    elif activity_id == "review_trustpilot":
        ok = "trustpilot." in host
    elif activity_id == "review_facebook":
        ok = "facebook." in host or host in ("fb.com", "fb.me")
    else:
        return None, "unknown_activity"
    if not ok:
        return None, "url_host_mismatch"

    norm = urlunparse(
        (
            (parsed.scheme or "https").lower(),
            parsed.netloc.lower(),
            parsed.path or "",
            parsed.params or "",
            parsed.query or "",
            "",
        )
    )
    return norm, ""


async def try_claim_external_review(
    db,
    *,
    email: str,
    user: dict,
    activity_id: str,
    review_url: str,
    program_id: Optional[str] = None,
    quote: Optional[str] = None,
    program_name: Optional[str] = None,
) -> dict:
    """
    Award points once per (email, activity, normalized URL). Creates a hidden testimonial for admin approval.
    """
    aid = (activity_id or "").strip()
    if aid not in EXTERNAL_REVIEW_ACTIVITY_IDS:
        return {"ok": False, "error": "unknown_activity"}

    norm_url, verr = normalize_and_validate_external_review_url(aid, review_url)
    if verr:
        return {"ok": False, "error": verr}

    em = normalize_email(email)
    if not em:
        return {"ok": False, "error": "no_email"}

    q = (quote or "").strip()
    if len(q) > 2000:
        return {"ok": False, "error": "quote_too_long"}

    ref = hashlib.sha256(f"{em}|{aid}|{norm_url}".encode("utf-8")).hexdigest()
    pid = (program_id or "").strip() or None

    res = await try_award_activity_points(
        db,
        em,
        aid,
        ref_unique=ref,
        program_id=pid,
        meta={"review_url": norm_url[:500]},
    )
    if not res.get("awarded"):
        return {"ok": False, "error": res.get("reason") or "not_awarded"}

    testimonial_id = None
    try:
        from routes.testimonials import create_pending_external_review_testimonial

        testimonial_id = await create_pending_external_review_testimonial(
            db,
            platform_activity_id=aid,
            review_url=norm_url,
            quote=q,
            program_id=pid or "",
            program_name=(program_name or "").strip(),
            display_name=(user.get("full_name") or user.get("name") or "").strip(),
        )
    except Exception as ex:
        logger.warning("try_claim_external_review testimonial: %s", ex)

    return {"ok": True, "points": int(res.get("points") or 0), "testimonial_id": testimonial_id}


async def apply_payment_points_side_effects(
    db,
    *,
    booker_email: str,
    stripe_session_id: str,
    points_redeemed: int,
    cash_paid: float,
    currency: str,
) -> None:
    """
    Idempotent: burn redeemed points, grant earn on cash paid, once per session.
    """
    em = normalize_email(booker_email)
    if not em:
        return
    cfg = await fetch_points_config(db)
    if not cfg.get("enabled"):
        return

    if points_redeemed and points_redeemed > 0:
        if not await ledger_has_ref(db, stripe_session_id, "redeem_checkout"):
            burned, err = await redeem_points_fifo(
                db, em, int(points_redeemed), stripe_session_id, "redeem_checkout"
            )
            if err:
                logger.warning(
                    "points redeem shortfall session=%s email=%s requested=%s burned=%s",
                    stripe_session_id,
                    em,
                    points_redeemed,
                    burned,
                )

    earn_reason = "earn_purchase"
    if await ledger_has_ref(db, stripe_session_id, earn_reason):
        return
    rate = earn_rate_per_unit(currency, cfg)
    if cash_paid <= 0 or rate <= 0:
        return
    earned = int(cash_paid * rate)
    if earned <= 0:
        return
    await grant_points(
        db,
        em,
        earned,
        earn_reason,
        ref_id=stripe_session_id,
        meta={"cash_paid": cash_paid, "currency": currency},
        cfg=cfg,
    )


REFERRAL_LEDGER_REASON = "referral_signup_bonus"


async def resolve_referrer_email(db, referred_by_email: str, referred_by_name: str) -> Optional[str]:
    """Prefer explicit referrer email; else exact case-insensitive name match on users or clients."""
    em = normalize_email(referred_by_email or "")
    if em and "@" in em:
        return em
    name = (referred_by_name or "").strip()
    if len(name) < 2:
        return None
    esc = re.escape(name)
    u = await db.users.find_one(
        {
            "$or": [
                {"full_name": {"$regex": f"^{esc}$", "$options": "i"}},
                {"name": {"$regex": f"^{esc}$", "$options": "i"}},
            ]
        },
        {"email": 1},
    )
    if u and (u.get("email") or "").strip():
        return normalize_email(u["email"])
    c = await db.clients.find_one(
        {"name": {"$regex": f"^{esc}$", "$options": "i"}},
        {"email": 1},
    )
    if c and (c.get("email") or "").strip():
        return normalize_email(c["email"])
    return None


async def maybe_grant_referrer_bonus_for_enrollment(
    db,
    *,
    enrollment_id: str,
    session_ref: str,
    cash_paid: float,
    booker_email: str,
) -> None:
    """Grant points_bonus_referral to referrer when a new member pays (once per enrollment)."""
    if not enrollment_id or cash_paid <= 0:
        return
    cfg = await fetch_points_config(db)
    if not cfg.get("enabled"):
        return
    ref_act = next((a for a in cfg.get("activities") or [] if a.get("id") == "referral_signup_bonus"), None)
    if not ref_act or not ref_act.get("enabled", True):
        return
    bonus = int(ref_act.get("points") or 0)
    if bonus <= 0:
        return
    if await ledger_has_ref(db, enrollment_id, REFERRAL_LEDGER_REASON):
        return
    enr = await db.enrollments.find_one(
        {"id": enrollment_id},
        {"_id": 0, "participants": 1, "booker_email": 1},
    )
    if not enr:
        return
    booker = normalize_email(booker_email or enr.get("booker_email") or "")
    referrer = None
    for p in enr.get("participants") or []:
        ref_e = (p.get("referred_by_email") or "").strip()
        ref_n = (p.get("referred_by_name") or "").strip()
        if not ref_e and not ref_n:
            continue
        resolved = await resolve_referrer_email(db, ref_e, ref_n)
        if resolved:
            referrer = resolved
            break
    if not referrer or referrer == booker:
        return
    await grant_points(
        db,
        referrer,
        bonus,
        REFERRAL_LEDGER_REASON,
        ref_id=enrollment_id,
        meta={"new_member": booker, "session_ref": session_ref},
        cfg=cfg,
    )


async def run_post_payment_loyalty(db, txn: dict) -> None:
    """Burn/redeem points, grant purchase earn, grant referrer bonus — idempotent per session / enrollment."""
    session_id = (txn.get("stripe_session_id") or "").strip()
    if not session_id:
        return
    enrollment_id = txn.get("enrollment_id") or ""
    try:
        await apply_payment_points_side_effects(
            db,
            booker_email=txn.get("booker_email") or "",
            stripe_session_id=session_id,
            points_redeemed=int(txn.get("points_redeemed") or 0),
            cash_paid=float(txn.get("amount") or 0),
            currency=str(txn.get("currency") or "aed").lower(),
        )
    except Exception as ex:
        logger.warning("apply_payment_points_side_effects: %s", ex)
    try:
        await maybe_grant_referrer_bonus_for_enrollment(
            db,
            enrollment_id=enrollment_id,
            session_ref=session_id,
            cash_paid=float(txn.get("amount") or 0),
            booker_email=txn.get("booker_email") or "",
        )
    except Exception as ex:
        logger.warning("maybe_grant_referrer_bonus_for_enrollment: %s", ex)


async def points_public_summary(db, email: str) -> dict:
    cfg = await fetch_points_config(db)
    em = normalize_email(email)
    bal = await available_balance(db, em) if em else 0
    soon = await expiring_points_soon(db, em, days=30) if em else 0
    return {
        "enabled": cfg["enabled"],
        "balance": bal,
        "expiring_within_days_30": soon,
        "max_basket_pct": cfg["max_basket_pct"],
        "expiry_months": cfg["expiry_months"],
        "redeem_excludes_flagship": bool(cfg.get("redeem_excludes_flagship", True)),
    }


async def expiring_points_soon(db, email: str, days: int = 30) -> int:
    em = normalize_email(email)
    if not em:
        return 0
    await expire_stale_batches(db, em)
    now = datetime.now(timezone.utc)
    until = now + timedelta(days=days)
    pipeline = [
        {
            "$match": {
                "email": em,
                "remaining": {"$gt": 0},
                "expires_at": {"$gte": now, "$lte": until},
            }
        },
        {"$group": {"_id": None, "t": {"$sum": "$remaining"}}},
    ]
    agg = await db.points_batches.aggregate(pipeline).to_list(1)
    return int(agg[0]["t"]) if agg else 0


async def recent_ledger(db, email: str, limit: int = 25) -> list:
    em = normalize_email(email)
    if not em:
        return []
    cur = (
        db.points_ledger.find({"email": em}, {"_id": 0})
        .sort("created_at", -1)
        .limit(limit)
    )
    return await cur.to_list(limit)


async def claim_one_time_bonus(db, email: str, kind: str, user: dict) -> dict:
    """
    kind: streak_30 | review
    """
    cfg = await fetch_points_config(db)
    if not cfg.get("enabled"):
        return {"ok": False, "error": "points_disabled"}
    em = normalize_email(email)
    if not em:
        return {"ok": False, "error": "no_email"}

    key = f"bonus_{kind}"
    existing = await db.points_bonus_claims.find_one({"email": em, "kind": kind})
    if existing:
        return {"ok": False, "error": "already_claimed"}

    aid = "streak_30" if kind == "streak_30" else "review_submitted" if kind == "review" else ""
    if not aid:
        return {"ok": False, "error": "unknown_kind"}
    act = next((a for a in cfg.get("activities") or [] if a.get("id") == aid), None)
    if not act or not act.get("enabled", True):
        return {"ok": False, "error": "bonus_not_configured"}
    pts = int(act.get("points") or 0)
    if pts <= 0:
        return {"ok": False, "error": "bonus_not_configured"}

    await db.points_bonus_claims.insert_one(
        {
            "id": str(uuid.uuid4()),
            "email": em,
            "kind": kind,
            "user_id": user.get("id"),
            "created_at": datetime.now(timezone.utc),
        }
    )
    await grant_points(db, em, pts, key, ref_id=user.get("id") or "", cfg=cfg)
    return {"ok": True, "points": pts}
