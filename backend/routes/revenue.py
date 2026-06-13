"""
Revenue analytics endpoint.
Shows amounts in original payment currencies with INR equivalents.
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

CURRENCY_SYMBOLS = {
    "inr": "₹", "usd": "$", "aed": "AED ", "gbp": "£", "eur": "€",
    "cad": "CAD ", "aud": "AUD ", "sgd": "SGD ", "myr": "MYR ",
}


def _to_inr(amount: float, currency: str, rates: dict) -> float:
    """Convert any currency amount to INR."""
    if not amount or amount <= 0:
        return 0.0
    c = str(currency).lower().strip()
    if c == "inr":
        return amount
    # Direct rate: X_to_inr
    direct = rates.get(f"{c}_to_inr")
    if direct and direct > 0:
        return amount * direct
    # Via USD: c → USD → INR
    usd_to_inr = rates.get("usd_to_inr") or 84.0
    if c == "usd":
        return amount * usd_to_inr
    if c == "aed":
        aed_to_usd = rates.get("aed_to_usd") or (1 / rates.get("usd_to_aed", 3.67))
        return amount * aed_to_usd * usd_to_inr
    # Generic: try usd_to_X, invert to get X in USD, then multiply by usd_to_inr
    fwd = rates.get(f"usd_to_{c}")
    if fwd and fwd > 0:
        return (amount / fwd) * usd_to_inr
    # Fallback: treat as USD
    return amount * usd_to_inr


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
        title_lower = str(item_title or "").lower()
        workshop_keywords = ["multiplier", "heal the heart", "dna detox", "musculoskeletal",
                             "soulmate", "neuro", "harmonics", "upcoming", "workshop",
                             "immersion", "group"]
        if any(k in title_lower for k in workshop_keywords):
            return "Workshops"
        return "Flagship Programs"
    return "Other"


def _record(monthly, cat_totals, top_programs, currency_totals,
            month, category, amount, currency, inr, title):
    """Accumulate one transaction into all running totals."""
    cur = str(currency).upper()
    if month in monthly:
        monthly[month][category]["inr"] += inr
        monthly[month][category]["count"] += 1
        monthly[month][category].setdefault("currencies", {})
        monthly[month][category]["currencies"].setdefault(cur, 0.0)
        monthly[month][category]["currencies"][cur] += amount

    cat_totals[category]["inr"] += inr
    cat_totals[category]["count"] += 1
    cat_totals[category].setdefault("currencies", {})
    cat_totals[category]["currencies"].setdefault(cur, 0.0)
    cat_totals[category]["currencies"][cur] += amount

    currency_totals[cur]["original"] += amount
    currency_totals[cur]["inr"] += inr
    currency_totals[cur]["count"] += 1

    top_programs[title]["inr"] += inr
    top_programs[title].setdefault("currencies", {})
    top_programs[title]["currencies"].setdefault(cur, 0.0)
    top_programs[title]["currencies"][cur] += amount


@router.get("")
async def get_revenue_summary(months: int = 12):
    # --- exchange rates ---
    rates = {}
    try:
        settings = await db.site_settings.find_one({"id": "site_settings"}, {"_id": 0})
        rates = (settings or {}).get("exchange_rates", {}) or {}
    except Exception:
        pass

    # --- program flags ---
    program_flags: dict = {}
    try:
        async for prog in db.programs.find({}, {"_id": 0, "title": 1,
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

    all_months = []
    d = datetime(cutoff.year, cutoff.month, 1, tzinfo=timezone.utc)
    while d <= now:
        all_months.append(d.strftime("%Y-%m"))
        if d.month == 12:
            d = d.replace(year=d.year + 1, month=1)
        else:
            d = d.replace(month=d.month + 1)

    CATEGORIES = ["Workshops", "Flagship Programs", "1:1 Sessions", "Sponsor", "Other"]

    monthly: dict = {
        m: {c: {"inr": 0.0, "count": 0, "currencies": {}} for c in CATEGORIES}
        for m in all_months
    }
    cat_totals: dict = {c: {"inr": 0.0, "count": 0, "currencies": {}} for c in CATEGORIES}
    top_programs: dict = defaultdict(lambda: {"inr": 0.0, "currencies": {}})
    currency_totals: dict = defaultdict(lambda: {"original": 0.0, "inr": 0.0, "count": 0})

    # --- payment_transactions ---
    try:
        cursor = db.payment_transactions.find(
            {"payment_status": {"$in": list(PAID_STATUSES)}},
            {"_id": 0, "amount": 1, "currency": 1, "item_type": 1,
             "item_title": 1, "paid_at": 1, "created_at": 1, "payment_status": 1},
        )
        async for tx in cursor:
            if str(tx.get("payment_status") or "").lower() not in PAID_STATUSES:
                continue
            ts = tx.get("paid_at") or tx.get("created_at")
            month = _month_key(ts)
            if not month or month < cutoff_str:
                continue
            amount = float(tx.get("amount") or 0)
            currency = str(tx.get("currency") or "usd").lower()
            if amount <= 0:
                continue
            inr = _to_inr(amount, currency, rates)
            category = _program_category(tx.get("item_type", ""), tx.get("item_title", ""), program_flags)
            title = str(tx.get("item_title") or "Unknown")
            _record(monthly, cat_totals, top_programs, currency_totals,
                    month, category, amount, currency, inr, title)
    except Exception:
        pass

    # --- india-approved enrollments (dedup against payment_transactions) ---
    try:
        already_counted: set = set()
        async for ptx in db.payment_transactions.find(
            {"payment_status": {"$in": list(PAID_STATUSES)}},
            {"_id": 0, "enrollment_id": 1}
        ):
            eid = ptx.get("enrollment_id")
            if eid:
                already_counted.add(str(eid))

        cursor2 = db.enrollments.find(
            {"status": {"$in": ["india_payment_approved", "completed"]}},
            {"_id": 1, "paid_at": 1, "created_at": 1, "item_type": 1, "item_title": 1,
             "dashboard_mixed_total": 1, "dashboard_mixed_currency": 1},
        )
        async for enr in cursor2:
            if str(enr.get("_id") or "") in already_counted:
                continue
            ts = enr.get("paid_at") or enr.get("created_at")
            month = _month_key(ts)
            if not month or month < cutoff_str:
                continue
            amount = float(enr.get("dashboard_mixed_total") or 0)
            currency = str(enr.get("dashboard_mixed_currency") or "inr").lower()
            if amount <= 0:
                continue
            inr = _to_inr(amount, currency, rates)
            category = _program_category(enr.get("item_type", ""), enr.get("item_title", ""), program_flags)
            title = str(enr.get("item_title") or "Unknown")
            _record(monthly, cat_totals, top_programs, currency_totals,
                    month, category, amount, currency, inr, title)
    except Exception:
        pass

    # --- build output ---
    month_labels = []
    month_totals_inr = []
    series: dict = {c: [] for c in CATEGORIES}

    for m in all_months:
        month_labels.append(datetime.strptime(m, "%Y-%m").strftime("%b %Y"))
        total = 0.0
        for c in CATEGORIES:
            v = round(monthly[m][c]["inr"], 2)
            series[c].append(v)
            total += v
        month_totals_inr.append(round(total, 2))

    grand_total_inr = sum(d["inr"] for d in cat_totals.values())

    top_list = sorted(top_programs.items(), key=lambda x: x[1]["inr"], reverse=True)[:10]

    # currency breakdown sorted by INR desc
    cur_breakdown = {
        cur: {
            "original": round(v["original"], 2),
            "inr": round(v["inr"], 2),
            "count": v["count"],
            "symbol": CURRENCY_SYMBOLS.get(cur.lower(), cur + " "),
        }
        for cur, v in sorted(currency_totals.items(), key=lambda x: x[1]["inr"], reverse=True)
    }

    return {
        "months": month_labels,
        "month_keys": all_months,
        "categories": CATEGORIES,
        "series": series,
        "month_totals_inr": month_totals_inr,
        "category_totals": {
            c: {
                "inr": round(d["inr"], 2),
                "count": d["count"],
                "currencies": {k: round(v, 2) for k, v in d["currencies"].items()},
            }
            for c, d in cat_totals.items()
        },
        "grand_total_inr": round(grand_total_inr, 2),
        "currency_breakdown": cur_breakdown,
        "top_programs": [
            {
                "title": t,
                "inr": round(v["inr"], 2),
                "currencies": {k: round(cv, 2) for k, cv in v["currencies"].items()},
            }
            for t, v in top_list
        ],
        "window_months": months,
        "rates_used": {
            "usd_to_inr": rates.get("usd_to_inr", 84.0),
            "aed_to_inr": rates.get("aed_to_inr") or (
                (rates.get("aed_to_usd") or (1 / rates.get("usd_to_aed", 3.67)))
                * rates.get("usd_to_inr", 84.0)
            ),
        },
    }
