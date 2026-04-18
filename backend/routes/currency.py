from fastapi import APIRouter, Request
from typing import Optional
from models import CurrencyInfo
import httpx
import logging
import os
import time
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/api/currency", tags=["Currency"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

logger = logging.getLogger(__name__)

# ── Region → Base Currency Mapping ──
INDIA = {"IN"}
UAE_ONLY = {"AE"}
GULF_MIDDLE_EAST = {"SA", "QA", "KW", "OM", "BH", "JO", "LB", "IQ", "YE", "SY", "IR", "TR", "IL", "PS"}
ASIAN = {"SG", "MY", "PH", "TH", "ID", "VN", "KR", "JP", "CN", "HK", "TW", "BD", "LK", "NP", "PK", "MM", "KH", "LA", "MN", "UZ", "KZ", "TJ", "TM", "KG", "AZ", "AM", "GE"}
US_ONLY = {"US"}
# Europe, Oceania, and the Americas are not enumerated here: they use USD hub prices (get_base_currency fallthrough).
AFRICA = {
    "ZA", "NG", "KE", "EG", "MA", "TN", "GH", "ET", "TZ", "UG",
    "DZ", "LY", "SD", "SN", "CI", "CM", "AO", "MZ", "ZM", "ZW",
    "RW", "MW", "BW", "NA", "GA", "CG", "CD", "MG", "MU",
}

# Country → local currency code
COUNTRY_CURRENCY = {
    "IN": "inr", "AE": "aed", "US": "usd",
    "SA": "sar", "QA": "qar", "KW": "kwd", "OM": "omr", "BH": "bhd", "JO": "jod", "LB": "lbp", "IQ": "iqd",
    "SG": "sgd", "MY": "myr", "PH": "php", "TH": "thb", "ID": "idr", "VN": "vnd",
    "KR": "krw", "JP": "jpy", "CN": "cny", "HK": "hkd", "TW": "twd",
    "BD": "bdt", "LK": "lkr", "NP": "npr", "PK": "pkr",
    "CA": "cad", "MX": "mxn", "BR": "brl", "AR": "ars", "CL": "clp", "CO": "cop", "PE": "pen",
    # Western Europe
    "GB": "gbp", "CH": "chf", "SE": "sek", "NO": "nok", "DK": "dkk", "IS": "isk", "LI": "chf",
    "DE": "eur", "FR": "eur", "IT": "eur", "ES": "eur", "NL": "eur", "BE": "eur", "PT": "eur",
    "AT": "eur", "FI": "eur", "IE": "eur", "LU": "eur", "MT": "eur", "CY": "eur",
    "MC": "eur", "AD": "eur", "SM": "eur", "VA": "eur",
    # Eastern Europe
    "PL": "pln", "HU": "huf", "CZ": "czk", "RO": "ron", "BG": "bgn",
    "HR": "eur", "SK": "eur", "SI": "eur", "LT": "eur", "LV": "eur", "EE": "eur", "GR": "eur",
    "RS": "rsd", "UA": "uah", "BY": "byr", "MD": "mdl", "BA": "bam", "MK": "mkd", "AL": "all", "ME": "eur", "XK": "eur",
    "RU": "rub",
    # Middle East / Turkey
    "TR": "try", "IL": "ils", "PS": "ils",
    # Oceania
    "AU": "aud", "NZ": "nzd",
    # Africa
    "ZA": "zar", "NG": "ngn", "KE": "kes", "EG": "egp", "MA": "mad", "TN": "tnd",
    "GH": "ghs", "TZ": "tzs", "UG": "ugx", "RW": "rwf", "MU": "mur", "BW": "bwp", "NA": "nad",
}

CURRENCY_SYMBOLS = {
    "aed": "AED", "inr": "₹", "usd": "$", "gbp": "£", "eur": "€",
    "cad": "C$", "aud": "A$", "sgd": "S$", "jpy": "¥", "krw": "₩",
    "sar": "SAR", "qar": "QAR", "kwd": "KWD", "omr": "OMR", "bhd": "BHD",
    "pkr": "PKR", "bdt": "BDT", "lkr": "LKR", "npr": "NPR", "myr": "MYR",
    "zar": "ZAR", "ngn": "NGN", "kes": "KES", "egp": "EGP", "php": "PHP",
    "thb": "THB", "idr": "IDR", "vnd": "VND", "brl": "R$", "mxn": "MX$",
    "try": "TRY", "cny": "¥", "hkd": "HK$", "twd": "NT$",
    "nzd": "NZ$", "chf": "CHF", "sek": "SEK", "nok": "NOK", "dkk": "DKK", "pln": "PLN",
    "czk": "CZK", "huf": "HUF", "ron": "RON", "bgn": "BGN", "ars": "ARS", "clp": "CLP", "cop": "COP", "pen": "PEN",
    "jod": "JOD", "lbp": "LBP", "iqd": "IQD",
    "isk": "ISK", "rsd": "RSD", "uah": "UAH", "rub": "RUB", "byr": "BYR", "mdl": "MDL",
    "bam": "BAM", "mkd": "MKD", "all": "ALL",
    "try": "₺", "ils": "₪",
    "mad": "MAD", "tnd": "TND", "ghs": "GHS", "tzs": "TZS", "ugx": "UGX",
    "rwf": "RWF", "mur": "MUR", "bwp": "BWP", "nad": "NAD",
}


def get_base_currency(country_code, vpn_detected):
    """Which hub price column to use (inr / aed / usd) before optional local conversion.

    Business rules:
    - India (no VPN): INR from pricing hub.
    - India + VPN: USD hub (protect INR pricing).
    - UAE: AED hub.
    - US: USD hub.
    - Asia, Africa, Middle East (incl. Gulf): AED hub, amount shown in local currency via FX.
    - Europe, Oceania, Americas, and any other country: USD hub, amount shown in local currency via FX.
    """
    if country_code in INDIA:
        if vpn_detected:
            return "usd"
        return "inr"
    if country_code in UAE_ONLY:
        return "aed"
    if country_code in US_ONLY:
        return "usd"
    # AED hub: Middle East + Gulf + Asia + Africa (not IN/AE/US — handled above)
    if country_code in GULF_MIDDLE_EAST or country_code in ASIAN or country_code in AFRICA:
        return "aed"
    # USD hub: Europe, Oceania, Americas, and rest of world
    return "usd"


def get_display_currency(country_code, vpn_detected):
    """Determine display currency (what user sees) based on country.
    
    VPN policy:
    - India: STRICT — VPN = USD (no INR for non-residents)
    - Everyone else: VPN ignored, show local currency silently
    """
    if country_code in INDIA:
        if vpn_detected:
            return "usd"  # Strict: no INR pricing
        return "inr"
    # For all others, always show local currency regardless of VPN
    if country_code in UAE_ONLY:
        return "aed"
    if country_code in US_ONLY:
        return "usd"
    return COUNTRY_CURRENCY.get(country_code, "usd")


# ── Live Exchange Rate Cache ──
_rate_cache = {"rates": {}, "timestamp": 0}
CACHE_TTL = 3600  # 1 hour

async def fetch_live_rates():
    """Fetch live exchange rates, cache for 1 hour"""
    now = time.time()
    if _rate_cache["rates"] and (now - _rate_cache["timestamp"]) < CACHE_TTL:
        return _rate_cache["rates"]

    # Try admin-set rates first
    settings = await db.site_settings.find_one({"id": "site_settings"}, {"_id": 0})
    admin_rates = settings.get("exchange_rates", {}) if settings else {}

    # Fetch live rates from free API
    live_rates = {}
    try:
        async with httpx.AsyncClient(timeout=8) as http:
            # Get USD-based rates
            resp = await http.get("https://open.er-api.com/v6/latest/USD")
            if resp.status_code == 200:
                data = resp.json()
                if data.get("result") == "success":
                    usd_rates = data.get("rates", {})
                    # Convert to our format: { "cad": 1.36, "eur": 0.92, ... }
                    for code, rate in usd_rates.items():
                        live_rates[f"usd_to_{code.lower()}"] = rate

            # Get AED-based rates
            resp2 = await http.get("https://open.er-api.com/v6/latest/AED")
            if resp2.status_code == 200:
                data2 = resp2.json()
                if data2.get("result") == "success":
                    aed_rates = data2.get("rates", {})
                    for code, rate in aed_rates.items():
                        live_rates[f"aed_to_{code.lower()}"] = rate
    except Exception as e:
        logger.warning(f"Failed to fetch live rates: {e}")

    # Merge: admin rates override live rates
    merged = {**live_rates, **admin_rates}
    _rate_cache["rates"] = merged
    _rate_cache["timestamp"] = now
    return merged


def convert_amount(amount, base_currency, display_currency, rates):
    """Convert amount from base currency to display currency"""
    if base_currency == display_currency:
        return amount
    key = f"{base_currency}_to_{display_currency}"
    rate = rates.get(key, 0)
    if rate > 0:
        return round(amount * rate)
    return amount


# ── IP Detection with VPN check ──
async def detect_ip_info(request: Request):
    """Detect country and VPN status from IP"""
    forwarded = request.headers.get("x-forwarded-for", "")
    ip = forwarded.split(",")[0].strip() if forwarded else request.client.host

    # Check Cloudflare header first
    cf_country = request.headers.get("CF-IPCountry", "")

    country = "US"  # Default to US (safe — USD)
    vpn_detected = False

    try:
        async with httpx.AsyncClient(timeout=5) as http:
            resp = await http.get(f"http://ip-api.com/json/{ip}?fields=status,countryCode,proxy,hosting")
            if resp.status_code == 200:
                data = resp.json()
                if data.get("status") == "success":
                    country = data.get("countryCode", "US")
                    vpn_detected = data.get("proxy", False) or data.get("hosting", False)
    except Exception as e:
        logger.warning(f"IP detection failed: {e}")
        if cf_country and len(cf_country) == 2:
            country = cf_country.upper()

    return country, vpn_detected


async def _inr_whitelist_emails() -> list:
    doc = await db.site_settings.find_one({"id": "site_settings"}, {"_id": 0, "inr_whitelist_emails": 1})
    return [e.lower().strip() for e in (doc or {}).get("inr_whitelist_emails", [])]


def _user_should_see_india_pricing_hub(user: Optional[dict], whitelist: list) -> bool:
    """INR hub + India display rules (same as a geo-India visitor without VPN)."""
    if not user:
        return False
    if (user.get("pricing_country_override") or "").upper() == "IN":
        return True
    em = (user.get("email") or "").lower().strip()
    return bool(em and em in whitelist)


async def resolve_stripe_hub_currency(request: Request, sponsor_or_guest_email: Optional[str] = None) -> str:
    """Which hub (inr / aed / usd) Stripe and cart may charge — matches /currency/detect logic."""
    from routes.auth import get_optional_user

    user = await get_optional_user(request)
    whitelist = await _inr_whitelist_emails()
    if user and _user_should_see_india_pricing_hub(user, whitelist):
        return "inr"
    em = (sponsor_or_guest_email or "").lower().strip()
    if em and em in whitelist:
        return "inr"
    ip_country, vpn_detected = await detect_ip_info(request)
    return get_base_currency(ip_country, vpn_detected)


# ── Endpoints ──
@router.get("/detect")
async def detect_currency(request: Request, preview_country: str = None):
    """Detect user's currency from IP. Returns locked currency info."""
    from routes.auth import get_optional_user

    if preview_country:
        country_display = preview_country.upper()
        vpn_detected = False
        hub_country, hub_vpn = country_display, False
    else:
        ip_country, vpn_raw = await detect_ip_info(request)
        country_display = ip_country
        vpn_detected = vpn_raw
        user = await get_optional_user(request)
        whitelist = await _inr_whitelist_emails()
        if user and _user_should_see_india_pricing_hub(user, whitelist):
            hub_country, hub_vpn = "IN", False
        else:
            hub_country, hub_vpn = ip_country, vpn_raw

    base_currency = get_base_currency(hub_country, hub_vpn)
    display_currency = get_display_currency(hub_country, hub_vpn)
    base_symbol = CURRENCY_SYMBOLS.get(base_currency, base_currency.upper())
    display_symbol = CURRENCY_SYMBOLS.get(display_currency, display_currency.upper())

    rates = await fetch_live_rates()
    display_rate = 1.0
    if base_currency != display_currency:
        key = f"{base_currency}_to_{display_currency}"
        display_rate = rates.get(key, 1.0)

    return {
        "currency": base_currency,
        "symbol": base_symbol,
        "country": country_display,
        "vpn_detected": vpn_detected,
        "display_currency": display_currency,
        "display_symbol": display_symbol,
        "display_rate": display_rate,
        "is_primary": base_currency == display_currency,
        "inr_pricing_as_india": base_currency == "inr" and hub_country == "IN",
    }


@router.post("/verify")
async def verify_currency_at_payment(request: Request, data: dict):
    """Server-side re-verification at payment time.
    Compares frontend-claimed currency with fresh IP detection."""
    claimed_currency = data.get("claimed_currency", "usd")

    actual_base = await resolve_stripe_hub_currency(request, None)

    # If frontend claimed INR but server says not India → reject
    if claimed_currency == "inr" and actual_base != "inr":
        return {"valid": False, "correct_currency": actual_base, "reason": "Currency mismatch — your region does not qualify for INR pricing."}

    # If frontend claimed AED but server says USD → reject
    if claimed_currency == "aed" and actual_base == "usd":
        return {"valid": False, "correct_currency": actual_base, "reason": "Currency mismatch — please refresh the page."}

    return {"valid": True, "correct_currency": actual_base}


@router.get("/exchange-rates")
async def get_rates():
    """Get all exchange rates"""
    rates = await fetch_live_rates()
    return {"rates": rates}


@router.put("/exchange-rates")
async def update_rates(data: dict):
    """Admin: Update fixed exchange rates (overrides live rates)"""
    rates = data.get("rates", {})
    await db.site_settings.update_one(
        {"id": "site_settings"},
        {"$set": {"exchange_rates": rates}},
        upsert=True,
    )
    return {"message": "Exchange rates updated", "rates": rates}


@router.get("/supported")
async def get_supported_currencies():
    return {
        "currencies": [
            {"code": "aed", "symbol": "AED", "name": "UAE Dirham"},
            {"code": "usd", "symbol": "$", "name": "US Dollar"},
            {"code": "inr", "symbol": "₹", "name": "Indian Rupee"},
            {"code": "eur", "symbol": "€", "name": "Euro"},
            {"code": "gbp", "symbol": "£", "name": "British Pound"},
        ]
    }
