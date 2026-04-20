"""Normalize free-text or ISO country to ISO 3166-1 alpha-2 (same basis as payment / enrollment fraud checks)."""

from typing import Optional

# Lowercased common names / aliases → ISO2 (extend as needed)
_NAME_TO_ISO2 = {
    "india": "IN",
    "indian": "IN",
    "united states": "US",
    "united states of america": "US",
    "usa": "US",
    "u.s.": "US",
    "u.s.a.": "US",
    "us": "US",
    "united arab emirates": "AE",
    "uae": "AE",
    "dubai": "AE",
    "abu dhabi": "AE",
    "canada": "CA",
    "united kingdom": "GB",
    "uk": "GB",
    "great britain": "GB",
    "england": "GB",
    "scotland": "GB",
    "wales": "GB",
    "australia": "AU",
    "new zealand": "NZ",
    "singapore": "SG",
    "saudi arabia": "SA",
    "qatar": "QA",
    "kuwait": "KW",
    "oman": "OM",
    "bahrain": "BH",
    "jordan": "JO",
    "lebanon": "LB",
    "pakistan": "PK",
    "bangladesh": "BD",
    "sri lanka": "LK",
    "nepal": "NP",
    "nigeria": "NG",
    "south africa": "ZA",
    "kenya": "KE",
    "egypt": "EG",
    "germany": "DE",
    "france": "FR",
    "netherlands": "NL",
    "italy": "IT",
    "spain": "ES",
    "japan": "JP",
    "china": "CN",
    "hong kong": "HK",
    "taiwan": "TW",
    "malaysia": "MY",
    "thailand": "TH",
    "indonesia": "ID",
    "philippines": "PH",
    "vietnam": "VN",
    "brazil": "BR",
    "mexico": "MX",
    "israel": "IL",
    "turkey": "TR",
    "russia": "RU",
    "ireland": "IE",
    "belgium": "BE",
    "switzerland": "CH",
    "austria": "AT",
    "sweden": "SE",
    "norway": "NO",
    "denmark": "DK",
    "finland": "FI",
    "poland": "PL",
    "portugal": "PT",
    "greece": "GR",
}


def normalize_country_iso2(raw: Optional[str]) -> str:
    """Return a 2-letter country code; default AE (same default as enrollment models)."""
    if raw is None:
        return "AE"
    s = str(raw).strip()
    if not s:
        return "AE"
    if len(s) == 2 and s.isalpha():
        return s.upper()
    key = " ".join(s.lower().split())
    if key in _NAME_TO_ISO2:
        return _NAME_TO_ISO2[key]
    # Prefix: "India (Kerala)" → India
    first = key.split("(")[0].strip()
    if first in _NAME_TO_ISO2:
        return _NAME_TO_ISO2[first]
    return "AE"
