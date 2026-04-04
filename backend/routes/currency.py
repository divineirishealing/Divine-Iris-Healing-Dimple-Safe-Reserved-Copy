from fastapi import APIRouter, Request
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
GULF_MIDDLE_EAST = {"SA", "QA", "KW", "OM", "BH", "JO", "LB", "IQ", "YE", "SY", "IR"}
ASIAN = {"SG", "MY", "PH", "TH", "ID", "VN", "KR", "JP", "CN", "HK", "TW", "BD", "LK", "NP", "PK", "MM", "KH", "LA", "MN", "UZ", "KZ", "AZ", "AM", "GE"}
US_ONLY = {"US"}
AMERICAS_CONVERT = {"CA", "MX", "BR", "AR", "CL", "CO", "PE"}
# Western Europe → USD base (affluent, USD-familiar)
WESTERN_EUROPE = {"GB", "DE", "FR", "IT", "ES", "NL", "BE", "PT", "AT", "CH", "SE", "NO", "DK", "FI", "IE", "LU", "MT", "CY"}
# Eastern Europe → AED base (closer economic alignment)
EASTERN_EUROPE = {"PL", "CZ", "HU", "RO", "GR", "HR", "BG", "SK", "SI", "LT", "LV", "EE", "UA", "RS", "BA", "MK", "AL", "ME", "MD"}
OCEANIA = {"AU", "NZ"}
AFRICA = {"ZA", "NG", "KE", "EG", "MA", "TN", "GH", "ET", "TZ", "UG", "DZ", "LY", "SD", "SN", "CI", "CM", "AO", "MZ", "ZM", "ZW"}

# Country → local currency code
COUNTRY_CURRENCY = {
    "IN": "inr", "AE": "aed", "US": "usd",
    "SA": "sar", "QA": "qar", "KW": "kwd", "OM": "omr", "BH": "bhd", "JO": "jod", "LB": "lbp", "IQ": "iqd",
    "SG": "sgd", "MY": "myr", "PH": "php", "TH": "thb", "ID": "idr", "VN": "vnd",
    "KR": "krw", "JP": "jpy", "CN": "cny", "HK": "hkd", "TW": "twd",
    "BD": "bdt", "LK": "lkr", "NP": "npr", "PK": "pkr",
    "CA": "cad", "MX": "mxn", "BR": "brl", "AR": "ars", "CL": "clp", "CO": "cop", "PE": "pen",
    "GB": "gbp", "CH": "chf", "SE": "sek", "NO": "nok", "DK": "dkk", "PL": "pln", "HU": "huf", "CZ": "czk", "RO": "ron", "HR": "eur", "BG": "bgn",
    "DE": "eur", "FR": "eur", "IT": "eur", "ES": "eur", "NL": "eur", "BE": "eur", "PT": "eur", "AT": "eur", "FI": "eur", "IE": "eur", "GR": "eur", "SK": "eur", "SI": "eur", "LT": "eur", "LV": "eur", "EE": "eur", "LU": "eur", "MT": "eur", "CY": "eur",
    "AU": "aud", "NZ": "nzd",
    "ZA": "zar", "NG": "ngn", "KE": "kes", "EG": "egp",
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
}


def get_base_currency(country_code, vpn_detected):
    """Determine base currency (what price field to use) based on region.

    Rules:
    - India: exact INR price. VPN from India = no INR (protect Indian pricing).
    - UAE: exact AED price.
    - USA: exact USD price.
    - Gulf / Middle East / Asia / Africa / Eastern Europe: AED base → convert to local on Stripe.
    - Western Europe / Americas / Oceania: USD base → convert to local on Stripe.
    """
    if country_code in INDIA:
        if vpn_detected:
            return "usd"
        return "inr"
    if country_code in UAE_ONLY:
        return "aed"
    if country_code in US_ONLY:
        return "usd"
    # AED base: Gulf, Middle East, Asia, Africa, Eastern Europe
    if (country_code in GULF_MIDDLE_EAST or country_code in ASIAN
            or country_code in AFRICA or country_code in EASTERN_EUROPE):
        return "aed"
    # USD base: Western Europe, Americas, Oceania, and anything else
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


# ── Endpoints ──
@router.get("/detect")
async def detect_currency(request: Request, preview_country: str = None):
    """Detect user's currency from IP. Returns locked currency info."""
    if preview_country:
        country = preview_country.upper()
        vpn_detected = False
    else:
        country, vpn_detected = await detect_ip_info(request)

    base_currency = get_base_currency(country, vpn_detected)
    display_currency = get_display_currency(country, vpn_detected)
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
        "country": country,
        "vpn_detected": vpn_detected,
        "display_currency": display_currency,
        "display_symbol": display_symbol,
        "display_rate": display_rate,
        "is_primary": base_currency == display_currency,
    }


@router.post("/verify")
async def verify_currency_at_payment(request: Request, data: dict):
    """Server-side re-verification at payment time.
    Compares frontend-claimed currency with fresh IP detection."""
    claimed_currency = data.get("claimed_currency", "usd")

    country, vpn_detected = await detect_ip_info(request)
    actual_base = get_base_currency(country, vpn_detected)

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
