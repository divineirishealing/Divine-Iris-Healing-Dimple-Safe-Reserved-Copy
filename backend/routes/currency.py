from fastapi import APIRouter, Request
from models import CurrencyInfo

router = APIRouter(prefix="/api/currency", tags=["Currency"])

CURRENCY_MAP = {
    "AE": {"currency": "aed", "symbol": "AED", "country": "UAE"},
    "US": {"currency": "usd", "symbol": "$", "country": "United States"},
    "IN": {"currency": "inr", "symbol": "₹", "country": "India"},
    "GB": {"currency": "gbp", "symbol": "£", "country": "United Kingdom"},
    "DE": {"currency": "eur", "symbol": "€", "country": "Germany"},
    "FR": {"currency": "eur", "symbol": "€", "country": "France"},
    "IT": {"currency": "eur", "symbol": "€", "country": "Italy"},
    "ES": {"currency": "eur", "symbol": "€", "country": "Spain"},
    "NL": {"currency": "eur", "symbol": "€", "country": "Netherlands"},
}

@router.get("/detect", response_model=CurrencyInfo)
async def detect_currency(request: Request, country_code: str = None):
    if country_code and country_code.upper() in CURRENCY_MAP:
        return CurrencyInfo(**CURRENCY_MAP[country_code.upper()])
    cf_country = request.headers.get("CF-IPCountry", "")
    if cf_country in CURRENCY_MAP:
        return CurrencyInfo(**CURRENCY_MAP[cf_country])
    # Default to AED (base currency)
    return CurrencyInfo(**CURRENCY_MAP["AE"])

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
