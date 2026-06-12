"""
Revenue analytics endpoint.
Aggregates payment_transactions by month, program category, and currency.
"""
import os
from pathlib import Path
from fastapi import APIRouter
from datetime import datetime, timezone, timedelta
from collections import defaultdict
from typing import Optional
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import re

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / ".env")

router = APIRouter(prefix="/api/admin/revenue", tags=["Revenue"])

_client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = _client[os.environ["DB_NAME"]]

PAID_STATUSES = {"paid", "complete", "completed", "approved"}


def _to_usd(amount: float, currency: str, rates: dict) -> float:
    """Convert any currency amount to USD for normalisation."""
    if not amount or amount <= 0:
        return 0.0
    c = str(currency).lower().strip()
    if c == "usd":
        return amount
    if c == "aed":
        rate = rates.get("aed_to_usd") or (1 / rates.get("usd_to_aed", 3.67))
        return amount * rate
    if c == "inr":
        rate = rates.get("inr_to_usd") or (1 / rates.get("usd_to_inr", 84))
        return amount * rate
    # Generic: try usd_to_X and invert
    fwd = rates.get(f"usd_to_{c}")
    if fwd and fwd > 0:
        return amount / fwd
    return amount  # fallback: assume USD


def _month_key(dt_val) -> Optional[str]:
    """Return 'YYYY-MM' from a datetime or ISO string."""
    if not dt_val:
        return None
    if isinstance(dt_val, datetime):
        return dt_val.strftime("%Y-%m")
    s = str(dt_val)
    m = re.match(r"(\d{4}-\d{2})", s)
    return m.group(1) if m else None


def _program_category(item_type: str, item_title: str, program_flags: dict) -> str:
    """
    Map a transaction to a display category.
    program_flags: dict of item_id -> {is_flagship, is_upcoming, is_group_program}
    """
    t = str(item_type or "").lower()
    if t == "session":
        return "1:1 Sessions"
    if t == "sponsor":
        return "Sponsor"
    if t == "program":
        flags = program_flags.get("__title__" + str(item_title or "").lower(), {})
        if flags.get("is_upcoming") or flags.get("is_group_program"):
            return "Workshops"
        if flags.get("is_flagship"):
            return "Flagship Programs"
        # Fallback: heuristic on title
        title_lower = str(item_title or "").lower()
        workshop_keywords = ["multiplier", "heal the heart", "dna detox", "musculoskeletal",
                             "soulmate", "neuro", "harmonics", "upcoming", "workshop",
                             "immersion", "group"]
        if any(k in title_lower for k in workshop_keywords):
            return "Workshops"
        return "Flagship Programs"
    return "Other"


@router.get("")
async def get_revenue_summary(months: int = 12):
    """
    Return monthly revenue broken down by category.
    months: how many past months to include (default 12).
    """
    # --- fetch exchange rates ---
    rates = {}
    try:
        settings = await db.site_settings.find_one({"id": "site_settings"}, {"_id": 0})
        rates = (settings or {}).get("exchange_rates", {}) or {}
    except Exception:
        pass

    # --- build program flag lookup (title → flags) ---
    program_flags: dict = {}
    try:
        async for prog in db.programs.find({}, {"_id": 0, "id": 1, "title": 1,
                                                "is_flagship": 1, "is_upcoming": 1,
                                                "is_group_program": 1}):
            key = "__title__" + str(prog.get("title") or "").lower()
            program_flags[key] = {
                "is_flagship": bool(prog.get("is_flagship")),
                "is_upcoming": bool(prog.get("is_upcoming")),
                "is_group_program": bool(prog.get("is_group_program")),
            }
    except Exception:
        pass

    # --- date window ---
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=months * 31)
    cutoff_str = cutoff.strftime("%Y-%m")

    # --- generate ordered month labels ---
    all_months = []
    d = datetime(cutoff.year, cutoff.month, 1, tzinfo=timezone.utc)
    while d <= now:
        all_months.append(d.strftime("%Y-%m"))
        if d.month == 12:
            d = d.replace(year=d.year + 1, month=1)
        else:
            d = d.replace(month=d.month + 1)

    CATEGORIES = ["Workshops", "Flagship Programs", "1:1 Sessions", "Sponsor", "Other"]

    # month → category → {usd_total, count, orig_amounts}
    monthly: dict = {m: {c: {"usd": 0.0, "count": 0} for c in CATEGORIES} for m in all_months}
    # totals per category
    cat_totals: dict = {c: 0.0 for c in CATEGORIES}
    # top earners: program_title → usd_total
    top_programs: dict = defaultdict(float)

    # --- payment_transactions (Stripe / Razorpay) ---
    try:
        query = {
            "payment_status": {"$in": list(PAID_STATUSES)},
        }
        cursor = db.payment_transactions.find(query, {
            "_id": 0, "amount": 1, "currency": 1, "item_type": 1,
            "item_title": 1, "paid_at": 1, "created_at": 1,
            "payment_status": 1,
        })
        async for tx in cursor:
            status = str(tx.get("payment_status") or "").lower()
            if status not in PAID_STATUSES:
                continue
            ts = tx.get("paid_at") or tx.get("created_at")
            month = _month_key(ts)
            if not month or month < cutoff_str:
                continue
            amount = float(tx.get("amount") or 0)
            currency = str(tx.get("currency") or "usd")
            usd = _to_usd(amount, currency, rates)
            category = _program_category(
                tx.get("item_type", ""),
                tx.get("item_title", ""),
                program_flags,
            )
            if month in monthly:
                monthly[month][category]["usd"] += usd
                monthly[month][category]["count"] += 1
            cat_totals[category] += usd
            title = str(tx.get("item_title") or "Unknown")
            top_programs[title] += usd
    except Exception:
        pass

    # --- india payment approved enrollments (not already in payment_transactions) ---
    try:
        india_statuses = {"india_payment_approved", "completed"}
        cursor2 = db.enrollments.find(
            {"status": {"$in": list(india_statuses)}},
            {"_id": 0, "paid_at": 1, "created_at": 1, "item_type": 1, "item_title": 1,
             "dashboard_mixed_total": 1, "dashboard_mixed_currency": 1,
             "stripe_session_id": 1},
        )
        # Track stripe sessions already counted above to avoid double counting
        already_counted: set = set()
        async for ptx in db.payment_transactions.find(
            {"payment_status": {"$in": list(PAID_STATUSES)}},
            {"_id": 0, "enrollment_id": 1}
        ):
            eid = ptx.get("enrollment_id")
            if eid:
                already_counted.add(str(eid))

        async for enr in cursor2:
            enr_id = str(enr.get("_id") or "")
            if enr_id in already_counted:
                continue
            ts = enr.get("paid_at") or enr.get("created_at")
            month = _month_key(ts)
            if not month or month < cutoff_str:
                continue
            amount = float(enr.get("dashboard_mixed_total") or 0)
            currency = str(enr.get("dashboard_mixed_currency") or "inr")
            if amount <= 0:
                continue
            usd = _to_usd(amount, currency, rates)
            category = _program_category(
                enr.get("item_type", ""),
                enr.get("item_title", ""),
                program_flags,
            )
            if month in monthly:
                monthly[month][category]["usd"] += usd
                monthly[month][category]["count"] += 1
            cat_totals[category] += usd
            title = str(enr.get("item_title") or "Unknown")
            top_programs[title] += usd
    except Exception:
        pass

    # --- build chart data ---
    chart_months = all_months  # ordered oldest → newest
    series = {c: [] for c in CATEGORIES}
    month_totals = []
    month_labels = []
    for m in chart_months:
        label = datetime.strptime(m, "%Y-%m").strftime("%b %Y")
        month_labels.append(label)
        total = 0.0
        for c in CATEGORIES:
            v = round(monthly[m][c]["usd"], 2)
            series[c].append(v)
            total += v
        month_totals.append(round(total, 2))

    # top programs (top 10)
    top_list = sorted(top_programs.items(), key=lambda x: x[1], reverse=True)[:10]

    grand_total = sum(cat_totals.values())

    return {
        "months": month_labels,
        "month_keys": chart_months,
        "categories": CATEGORIES,
        "series": series,            # {category: [usd_per_month]}
        "month_totals": month_totals,
        "category_totals": {c: round(v, 2) for c, v in cat_totals.items()},
        "grand_total_usd": round(grand_total, 2),
        "top_programs": [{"title": t, "usd": round(v, 2)} for t, v in top_list],
        "window_months": months,
    }
