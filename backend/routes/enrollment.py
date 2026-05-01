from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List

from country_normalize import normalize_country_iso2
from routes.clients import ensure_client_from_enrollment_lead
import os, re, random, uuid, logging, httpx, dns.resolver, html, asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/api/enrollment", tags=["Enrollment"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

logger = logging.getLogger(__name__)


async def _attach_portal_ids_to_transaction(transaction: dict, enrollment: dict) -> None:
    """Link Stripe/manual enrollment payments to portal users for order history (matches India approval flow)."""
    be_norm = (enrollment.get("booker_email") or "").strip().lower()
    if not be_norm:
        return
    portal_user_doc = await db.users.find_one({"email": be_norm}, {"id": 1, "client_id": 1})
    if not portal_user_doc:
        return
    transaction["portal_user_id"] = portal_user_doc.get("id")
    pcid = (portal_user_doc.get("client_id") or "").strip()
    if pcid:
        transaction["portal_client_id"] = pcid


def _per_person_price_for_program(program: dict, tier_index: Optional[int], currency: str) -> float:
    """Per-person list price for cart checkout (offer price wins when set). Matches get_enrollment_pricing tier logic."""
    cur = (currency or "aed").lower()
    tiers = program.get("duration_tiers") or []
    ti = None
    if tier_index is not None and str(tier_index).strip() != "":
        try:
            ti = int(tier_index)
        except (TypeError, ValueError):
            ti = None
    has_tier = bool(tiers) and ti is not None and 0 <= ti < len(tiers)
    if has_tier:
        tier = tiers[ti]
        price_aed = float(tier.get("price_aed", 0) or 0)
        price_inr = float(tier.get("price_inr", 0) or 0)
        price_usd = float(tier.get("price_usd", 0) or 0)
        offer_aed = float(tier.get("offer_price_aed", 0) or 0)
        offer_inr = float(tier.get("offer_price_inr", 0) or 0)
        offer_usd = float(tier.get("offer_price_usd", 0) or 0)
    else:
        price_aed = float(program.get("price_aed", 0) or 0)
        price_inr = float(program.get("price_inr", 0) or 0)
        price_usd = float(program.get("price_usd", 0) or 0)
        offer_aed = float(program.get("offer_price_aed", 0) or 0)
        offer_inr = float(program.get("offer_price_inr", 0) or 0)
        offer_usd = float(program.get("offer_price_usd", 0) or 0)
    if cur == "inr":
        price, offer_price = price_inr, offer_inr
    elif cur == "usd":
        price = price_usd if price_usd > 0 else price_aed
        offer_price = offer_usd if offer_usd > 0 else offer_aed
        if price <= 0:
            price, offer_price = price_aed, offer_aed
    else:
        price, offer_price = price_aed, offer_aed
        if price <= 0 and price_usd > 0:
            price = price_usd
            offer_price = offer_usd if offer_usd > 0 else price_usd
    per = float(offer_price) if offer_price and float(offer_price) > 0 else float(price)
    return per


async def _checkout_total_from_cart_items(cart_items: list, currency: str):
    """Sum line totals for multi-program cart; returns (subtotal, headcount)."""
    subtotal = 0.0
    headcount = 0
    for ci in cart_items or []:
        pid = str(ci.get("program_id") or "").strip()
        try:
            npc = int(ci.get("participants_count") or 0)
        except (TypeError, ValueError):
            npc = 0
        if not pid or npc <= 0:
            continue
        program = await db.programs.find_one({"id": pid}, {"_id": 0})
        if not program:
            logger.warning("Cart checkout: program id=%s not found", pid)
            continue
        per = _per_person_price_for_program(program, ci.get("tier_index"), currency)
        subtotal += round(float(per) * npc, 2)
        headcount += npc
    return subtotal, headcount


# ─── PPP TIERS (fixed, not live conversion) ───
# Only India gets PPP discount. Other regions use AED or USD hub per routes.currency.get_base_currency.
PPP_TIERS = {
    "inr": {"multiplier": 0.01, "symbol": "₹", "name": "Indian Rupee"},
}

# Countries that get PPP pricing (strict - ONLY India)
PPP_ELIGIBLE_COUNTRIES = {"IN"}

# Indian phone prefixes
INDIA_PHONE_PREFIXES = ["+91"]

# BIN ranges for Indian banks (first 6 digits of card)
# Major Indian bank BIN prefixes - Visa/Mastercard/RuPay issued in India
INDIA_BIN_PREFIXES = [
    "356150", "400837", "400959", "401757", "403011", "405487",
    "411550", "417613", "419756", "421527", "431940", "436468",
    "450443", "457323", "459725", "462580", "468805", "472605",
    "485541", "488845", "490222", "512345", "516073", "524266",
    "526461", "530816", "534680", "540359", "543217", "547043",
    "552076", "556398", "606985", "607026", "607094", "607115",
    "607162", "607189", "607384", "607514", "607677", "608001",
    "608117", "608200", "608208", "608316", "608351", "652150",
    "652152", "652172", "652182", "652192", "652198", "652199",
    "653028",
]


# ─── MODELS ───
class ParticipantData(BaseModel):
    name: str
    relationship: str
    age: int
    gender: str
    country: str = "AE"
    city: str = ""
    state: str = ""
    attendance_mode: str = "online"
    notify: bool = False
    email: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    program_id: Optional[str] = None
    program_title: Optional[str] = None
    is_first_time: bool = False
    referral_source: str = ""
    referred_by_name: str = ""
    referred_by_email: Optional[str] = None


class PortalCartLineIn(BaseModel):
    """Annual portal Divine Cart: one line per program so server can set dashboard_mixed_total like dashboard-pay."""
    program_id: str
    tier_index: int = 0
    family_member_ids: List[str] = Field(default_factory=list)
    booker_joins: bool = True


class ProfileData(BaseModel):
    booker_name: str
    booker_email: str
    booker_country: str = "AE"
    participants: list[ParticipantData]
    # Filled by enrollment UI so abandoned-checkout reminder links work before payment step
    item_type: Optional[str] = None
    item_id: Optional[str] = None
    item_title: Optional[str] = None
    portal_cart_currency: Optional[str] = None
    portal_cart_lines: Optional[List[PortalCartLineIn]] = None


class EmailValidation(BaseModel):
    email: str


class EmailOTPRequest(BaseModel):
    email: str

class EmailOTPVerify(BaseModel):
    email: str
    otp: str

class PhoneUpdate(BaseModel):
    phone: str


class EnrollmentSubmit(BaseModel):
    enrollment_id: str
    item_type: str
    item_id: str
    currency: str
    display_currency: Optional[str] = None
    display_rate: Optional[float] = None
    origin_url: Optional[str] = None
    promo_code: Optional[str] = None
    tier_index: Optional[int] = None
    cart_items: Optional[list] = None
    browser_timezone: Optional[str] = None
    browser_languages: Optional[list] = None
    points_to_redeem: Optional[int] = 0
    # When True, Stripe cancel/back returns to portal Divine Cart instead of public /enroll.
    portal_checkout_cancel: Optional[bool] = None
    # Optional: UI total after discounts/points; server uses it only if within tight tolerance of recomputed amount.
    client_declared_payable: Optional[float] = None


def stripe_checkout_cancel_url(origin: str, data: EnrollmentSubmit, enrollment_id: str) -> str:
    from urllib.parse import urlencode

    if data.portal_checkout_cancel:
        return f"{origin.rstrip('/')}/dashboard/combined-checkout?{urlencode({'eid': enrollment_id})}"
    cancel_url = f"{origin.rstrip('/')}/enroll/{data.item_type}/{data.item_id}?resume={enrollment_id}"
    if data.tier_index is not None:
        cancel_url += f"&tier={data.tier_index}"
    return cancel_url


# ─── HELPERS ───
def validate_email_format(email: str) -> bool:
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def check_mx_record(domain: str) -> bool:
    try:
        dns.resolver.resolve(domain, 'MX')
        return True
    except Exception:
        return False


async def detect_ip_info(request: Request) -> dict:
    """Detect IP info including VPN/proxy status"""
    # Get client IP
    forwarded = request.headers.get("x-forwarded-for", "")
    ip = forwarded.split(",")[0].strip() if forwarded else request.client.host

    result = {"ip": ip, "country": "AE", "is_vpn": False, "is_proxy": False, "is_hosting": False}

    try:
        async with httpx.AsyncClient(timeout=5) as client_http:
            # Use ip-api.com (free, no key needed, 45 req/min)
            resp = await client_http.get(f"http://ip-api.com/json/{ip}?fields=status,country,countryCode,isp,org,hosting,proxy")
            if resp.status_code == 200:
                data = resp.json()
                if data.get("status") == "success":
                    result["country"] = data.get("countryCode", "AE")
                    result["is_proxy"] = data.get("proxy", False)
                    result["is_hosting"] = data.get("hosting", False)
                    isp = (data.get("isp", "") + " " + data.get("org", "")).lower()
                    vpn_keywords = ["vpn", "tor", "proxy", "tunnel", "hide", "nord", "express", "surfshark", "cyberghost", "private internet"]
                    result["is_vpn"] = any(kw in isp for kw in vpn_keywords)
    except Exception as e:
        logger.warning(f"IP detection failed: {e}")

    return result


def get_ppp_price(base_aed_price: float, currency: str) -> float:
    """Apply PPP tier pricing"""
    if currency in PPP_TIERS:
        return round(base_aed_price * PPP_TIERS[currency]["multiplier"], 2)
    return base_aed_price


# ─── ROUTES ───

async def insert_enrollment_from_profile(profile: ProfileData, request: Request, *, trusted_contact: bool) -> dict:
    """Create enrollment. When trusted_contact=True (logged-in portal combined checkout), skip OTP; checkout may proceed."""
    ip_info = await detect_ip_info(request)

    if not profile.participants or len(profile.participants) == 0:
        raise HTTPException(status_code=400, detail="At least one participant is required")

    email = profile.booker_email.strip().lower()
    if not validate_email_format(email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    domain = email.split("@")[1]
    if not check_mx_record(domain):
        raise HTTPException(status_code=400, detail=f"Email domain '{domain}' cannot receive emails. Please use a valid email.")
    disposable_domains = ["tempmail.com", "throwaway.email", "guerrillamail.com", "mailinator.com", "yopmail.com", "10minutemail.com"]
    if domain in disposable_domains:
        raise HTTPException(status_code=400, detail="Disposable email addresses are not allowed.")

    for i, p in enumerate(profile.participants):
        if p.attendance_mode not in ["online", "offline"]:
            raise HTTPException(status_code=400, detail=f"Participant {i+1}: attendance mode must be 'online' or 'offline'")
        if p.notify:
            if p.email and not validate_email_format(p.email.strip()):
                raise HTTPException(status_code=400, detail=f"Participant {i+1}: invalid email format")

    now = datetime.now(timezone.utc)
    month = now.month
    counter = await db.counters.find_one_and_update(
        {"_id": f"receipt_{now.strftime('%Y')}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
        projection={"_id": 0, "seq": 1}
    )
    seq = counter["seq"]
    mystery = f"{month}{seq * 3:02d}"
    receipt_id = f"DIH-{mystery}-{seq:03d}"

    booker_c = normalize_country_iso2(profile.booker_country)
    norm_participants: List[ParticipantData] = []
    for p in profile.participants:
        pd = p.model_dump(mode="python")
        pd["country"] = normalize_country_iso2(pd.get("country"))
        norm_participants.append(ParticipantData(**pd))

    enrollment = {
        "id": receipt_id,
        "status": "contact_verified" if trusted_contact else "profile_complete",
        "step": 3 if trusted_contact else 1,
        "booker_name": profile.booker_name,
        "booker_email": email,
        "booker_country": booker_c,
        "participants": [p.model_dump(mode="python") for p in norm_participants],
        "participant_count": len(norm_participants),
        "ip_info": ip_info,
        "phone": None,
        "phone_verified": trusted_contact,
        "email_verified": trusted_contact,
        "vpn_blocked": ip_info["is_vpn"] or ip_info["is_proxy"] or ip_info["is_hosting"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if profile.item_type and profile.item_id:
        enrollment["item_type"] = profile.item_type.strip()
        enrollment["item_id"] = profile.item_id.strip()
        p0_pt = ""
        if profile.participants:
            p0_pt = str(profile.participants[0].program_title or "").strip()
        it = str(profile.item_title or "").strip()
        enrollment["item_title"] = it or p0_pt
    else:
        p0 = profile.participants[0]
        if p0.program_id:
            enrollment["item_type"] = "program"
            enrollment["item_id"] = str(p0.program_id).strip()
            if p0.program_title:
                enrollment["item_title"] = str(p0.program_title).strip()

    await db.enrollments.insert_one(enrollment)
    try:
        await ensure_client_from_enrollment_lead(enrollment)
    except Exception as ex:
        logger.warning("ensure_client_from_enrollment_lead after insert: %s", ex)

    msg = (
        "Enrollment saved. You can complete payment below."
        if trusted_contact
        else f"Profile saved for {len(profile.participants)} participant(s). Proceed to verification."
    )
    return {
        "enrollment_id": enrollment["id"],
        "step": enrollment["step"],
        "participant_count": len(profile.participants),
        "ip_country": ip_info["country"],
        "vpn_detected": enrollment["vpn_blocked"],
        "message": msg,
    }


@router.post("/start")
async def start_enrollment(profile: ProfileData, request: Request):
    """Step 1: Create enrollment with booker info + participants (each with country, attendance, notify prefs) + IP detection"""
    return await insert_enrollment_from_profile(profile, request, trusted_contact=False)


@router.post("/{enrollment_id}/send-otp")
async def send_email_otp(enrollment_id: str, data: EmailOTPRequest):
    """Send OTP to email for verification"""
    enrollment = await db.enrollments.find_one({"id": enrollment_id})
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    email = data.email.strip().lower()
    if not re.match(r'^[^@]+@[^@]+\.[^@]+$', email):
        raise HTTPException(status_code=400, detail="Invalid email address")

    # Generate 6-digit OTP
    otp = str(random.randint(100000, 999999))
    expires = datetime.now(timezone.utc) + timedelta(minutes=5)

    # Store OTP in DB
    await db.email_otps.update_one(
        {"email": email, "enrollment_id": enrollment_id},
        {"$set": {
            "otp": otp,
            "expires": expires.isoformat(),
            "attempts": 0,
            "enrollment_id": enrollment_id,
        }},
        upsert=True,
    )

    # Send OTP email via SMTP
    from routes.emails import send_otp_email
    booker_name = enrollment.get("booker_name", "")
    result = await send_otp_email(email, otp, booker_name)

    logger.info(f"[EMAIL OTP] Email: {email} → OTP: {otp} (sent: {result is not None})")

    await db.enrollments.update_one(
        {"id": enrollment_id},
        {"$set": {
            "email": email,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )

    masked_email = email[:2] + '***' + email[email.index('@'):]
    return {
        "sent": True,
        "email": masked_email,
        "message": "Verification code sent to your email. Valid for 5 minutes.",
    }


@router.patch("/{enrollment_id}/update-phone")
async def update_enrollment_phone(enrollment_id: str, data: PhoneUpdate):
    """Update phone on enrollment for pricing cross-validation"""
    enrollment = await db.enrollments.find_one({"id": enrollment_id})
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    await db.enrollments.update_one(
        {"id": enrollment_id},
        {"$set": {"phone": data.phone, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    full = await db.enrollments.find_one({"id": enrollment_id}, {"_id": 0})
    if full:
        try:
            await ensure_client_from_enrollment_lead(full)
        except Exception as ex:
            logger.warning("ensure_client_from_enrollment_lead after update-phone: %s", ex)
    return {"updated": True}



@router.post("/{enrollment_id}/verify-otp")
async def verify_email_otp(enrollment_id: str, data: EmailOTPVerify):
    """Verify email OTP"""
    email = data.email.strip().lower()

    otp_record = await db.email_otps.find_one({"email": email, "enrollment_id": enrollment_id})
    if not otp_record:
        raise HTTPException(status_code=400, detail="No verification code sent for this email. Please request a new one.")

    # Check attempts
    if otp_record.get("attempts", 0) >= 5:
        raise HTTPException(status_code=429, detail="Too many attempts. Please request a new code.")

    # Increment attempts
    await db.email_otps.update_one(
        {"email": email, "enrollment_id": enrollment_id},
        {"$inc": {"attempts": 1}}
    )

    # Check expiry
    expires = datetime.fromisoformat(otp_record["expires"])
    if datetime.now(timezone.utc) > expires:
        raise HTTPException(status_code=400, detail="Code expired. Please request a new one.")

    # Verify
    if data.otp != otp_record["otp"]:
        remaining = 5 - otp_record.get("attempts", 0) - 1
        raise HTTPException(status_code=400, detail=f"Incorrect code. {remaining} attempts remaining.")

    # Mark verified
    await db.enrollments.update_one(
        {"id": enrollment_id},
        {"$set": {
            "email_verified": True,
            "phone_verified": True,
            "step": 3,
            "status": "contact_verified",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )

    # Cleanup OTP
    await db.email_otps.delete_one({"email": email, "enrollment_id": enrollment_id})

    full = await db.enrollments.find_one({"id": enrollment_id}, {"_id": 0})
    if full:
        try:
            await ensure_client_from_enrollment_lead(full)
        except Exception as ex:
            logger.warning("ensure_client_from_enrollment_lead after verify-otp: %s", ex)

    return {"verified": True, "message": "Email verified successfully."}


@router.get("/{enrollment_id}/pricing")
async def get_enrollment_pricing(enrollment_id: str, item_type: str, item_id: str, tier_index: int = None, client_currency: str = None, browser_timezone: str = None, browser_languages: list = None):
    """Step 4: Get pricing with strict India-gating for INR prices.
    
    Supports duration tiers: if tier_index is provided, price comes from that tier.
    Supports client currency: if provided, uses that currency for non-INR pricing.
    """
    enrollment = await db.enrollments.find_one({"id": enrollment_id}, {"_id": 0})
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    # Fetch item
    collection = "programs" if item_type == "program" else "sessions"
    item = await db[collection].find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    ip_country = enrollment.get("ip_info", {}).get("country", "AE")
    claimed_country = enrollment.get("booker_country", enrollment.get("country", ""))
    vpn_blocked = enrollment.get("vpn_blocked", False)
    participant_count = enrollment.get("participant_count", 1)

    # ─── BLOCKLIST CHECK ───
    booker_email = enrollment.get("booker_email", "").lower()
    is_blocklisted = False
    if booker_email:
        blocked = await db.fraud_blocklist.find_one({"email": booker_email})
        is_blocklisted = blocked is not None

    # ─── INDIA VALIDATION: IP + VPN only ───
    # A real India resident has an Indian IP and is not using a VPN.
    # Phone / timezone / claimed-country are NOT used as gates — they
    # caused false failures for legitimate Indian students.
    inr_eligible = ip_country == "IN" and not vpn_blocked and not is_blocklisted

    checks = {
        "ip_is_india": ip_country == "IN",
        "no_vpn": not vpn_blocked,
        "not_blocklisted": not is_blocklisted,
    }

    # ─── REGIONAL CURRENCY MAPPING ───
    from routes.currency import (
        get_base_currency as _get_base_currency,
        resolve_booker_pricing_hub_email,
        resolve_client_pricing_hub_override,
    )

    email_hub = await resolve_booker_pricing_hub_email(booker_email)
    cid = (enrollment.get("client_id") or "").strip()
    client_hub = await resolve_client_pricing_hub_override(cid)
    booker_hub = client_hub or email_hub

    if booker_hub:
        allowed_currency = booker_hub
        if booker_hub == "inr":
            inr_eligible = not is_blocklisted
        else:
            inr_eligible = False
        fraud_warning = None
    elif inr_eligible:
        allowed_currency = "inr"
        fraud_warning = None
    else:
        allowed_currency = _get_base_currency(ip_country, vpn_blocked)
        if is_blocklisted and allowed_currency == "inr":
            allowed_currency = "usd"
        fraud_warning = "VPN detected — using non-INR pricing." if (ip_country == "IN" and vpn_blocked) else None

    # ─── TRUST SERVER-VERIFIED client_currency ───
    # The checkout endpoint re-checks IP at payment time and sets client_currency
    # to the verified base currency. This overrides the stale stored enrollment IP
    # (which defaults to "AE" when IP detection fails at enrollment start).
    # Block only: blocklisted users cannot claim INR.
    # CRM / per-email hub (above) wins over client_currency from the request.
    if client_currency in ("inr", "aed", "usd"):
        if not booker_hub and not (is_blocklisted and client_currency == "inr"):
            allowed_currency = client_currency
            if client_currency == "inr":
                inr_eligible = True
                fraud_warning = None

    all_india_checks_pass = inr_eligible  # kept for backward compat in response

    # ─── GET PRICE FROM TIER OR ITEM ───
    tiers = item.get("duration_tiers", [])
    has_tier = tiers and tier_index is not None and 0 <= tier_index < len(tiers)

    if has_tier:
        tier = tiers[tier_index]
        price_aed = float(tier.get("price_aed", 0))
        price_inr = float(tier.get("price_inr", 0))
        price_usd = float(tier.get("price_usd", 0))
        offer_aed = float(tier.get("offer_price_aed", 0))
        offer_inr = float(tier.get("offer_price_inr", 0))
        offer_usd = float(tier.get("offer_price_usd", 0))
    else:
        price_aed = float(item.get("price_aed", 0))
        price_inr = float(item.get("price_inr", 0))
        price_usd = float(item.get("price_usd", 0))
        offer_aed = float(item.get("offer_price_aed", 0))
        offer_inr = float(item.get("offer_price_inr", 0))
        offer_usd = float(item.get("offer_price_usd", 0))

    # Pick price directly from pricing hub — no cross-currency calculation
    if allowed_currency == "inr":
        price = price_inr  # exact INR from pricing hub, never converted
        offer_price = offer_inr
        symbol = "₹"
    elif allowed_currency == "usd":
        price = price_usd if price_usd > 0 else price_aed
        offer_price = offer_usd
        symbol = "$"
        if price <= 0:
            price = price_aed
            allowed_currency = "aed"
            symbol = "AED "
    else:
        # AED or other currencies - use AED as base
        price = price_aed
        offer_price = offer_aed
        symbol = "AED "
        if price <= 0 and price_usd > 0:
            price = price_usd
            allowed_currency = "usd"
            symbol = "$"

    per_person = offer_price if offer_price > 0 else price
    total = round(per_person * participant_count, 2)

    return {
        "enrollment_id": enrollment_id,
        "item": {
            "id": item.get("id"),
            "title": item.get("title"),
            "description": item.get("description"),
            "image": item.get("image"),
        },
        "pricing": {
            "currency": allowed_currency,
            "symbol": symbol,
            "price_per_person": price,
            "offer_price_per_person": offer_price if offer_price > 0 else None,
            "final_per_person": per_person,
            "participant_count": participant_count,
            "total": total,
            "offer_text": item.get("offer_text", ""),
        },
        "security": {
            "vpn_blocked": vpn_blocked,
            "fraud_warning": fraud_warning,
            "checks": checks,
            "ip_country": ip_country,
            "claimed_country": claimed_country,
            "country_mismatch": ip_country != claimed_country,
            "inr_eligible": inr_eligible,
        },
    }


@router.get("/{enrollment_id}/points-summary")
async def enrollment_points_summary(
    enrollment_id: str,
    basket_subtotal: Optional[float] = None,
    currency: Optional[str] = None,
    item_type: Optional[str] = None,
    item_id: Optional[str] = None,
    cart_program_ids: Optional[str] = None,
):
    """Booker balance + caps for checkout UI (requires verified enrollment)."""
    enrollment = await db.enrollments.find_one(
        {"id": enrollment_id},
        {"_id": 0, "phone_verified": 1, "booker_email": 1},
    )
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    if not enrollment.get("phone_verified"):
        raise HTTPException(
            status_code=403,
            detail="Complete email verification first (6-digit code). Payment unlocks after that step.",
        )

    from routes.points_logic import (
        fetch_points_config,
        available_balance,
        compute_points_redemption,
        fiat_per_point,
        normalize_email,
        flagship_blocks_points_redemption,
    )

    cfg = await fetch_points_config(db)
    em = normalize_email(enrollment.get("booker_email", ""))
    bal = await available_balance(db, em)
    cur = (currency or "aed").lower()
    per = fiat_per_point(cur, cfg)
    cart_ids = [x.strip() for x in (cart_program_ids or "").split(",") if x.strip()]
    blocked, block_reason = await flagship_blocks_points_redemption(
        db, cfg, item_type=item_type or "", item_id=item_id or "", cart_program_ids=cart_ids
    )
    out = {
        "enabled": cfg["enabled"],
        "balance": bal,
        "max_basket_pct": cfg["max_basket_pct"],
        "expiry_months": cfg["expiry_months"],
        "fiat_per_point": per,
        "currency": cur,
        "redeem_blocked": blocked,
        "redeem_blocked_reason": block_reason if blocked else "",
    }
    if basket_subtotal is not None and float(basket_subtotal) > 0 and cfg["enabled"]:
        bs = float(basket_subtotal)
        if blocked:
            out["max_points_usable"] = 0
            out["max_discount"] = 0.0
        else:
            max_pts, max_cash = compute_points_redemption(bal, bs, cur, bal, cfg)
            out["max_points_usable"] = max_pts
            out["max_discount"] = max_cash
    return out


@router.post("/{enrollment_id}/checkout")
async def enrollment_checkout(enrollment_id: str, data: EnrollmentSubmit, request: Request):
    """Create Stripe Checkout for a verified enrollment."""
    from routes.enrollment_checkout_prepare import (
        enrollment_checkout_prepare,
        enrollment_run_free_checkout,
        resolve_checkout_public_origin,
    )

    prep = await enrollment_checkout_prepare(
        db,
        enrollment_id,
        data,
        request,
        get_enrollment_pricing=get_enrollment_pricing,
        checkout_total_from_cart_items=_checkout_total_from_cart_items,
    )
    if prep["kind"] == "free":
        return await enrollment_run_free_checkout(db, prep, attach_portal_ids=_attach_portal_ids_to_transaction)

    from routes.payments import _get_stripe_key, create_checkout_no_adaptive
    from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest

    data = prep["data"]
    enrollment_id = prep["enrollment_id"]
    enrollment = prep["enrollment"]
    final_total = prep["final_total"]
    currency = prep["currency"]
    stripe_currency = prep["stripe_currency"]
    stripe_amount = prep["stripe_amount"]
    participant_count = prep["participant_count"]
    item = prep["item"]

    from routes.india_payments import display_program_title_for_enrollment

    checkout_item_title = display_program_title_for_enrollment(
        enrollment,
        enrollment.get("participants"),
        item,
    )

    origin = resolve_checkout_public_origin(data, request)
    host_url = str(request.base_url).rstrip("/")
    success_url = f"{origin}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = stripe_checkout_cancel_url(origin, data, enrollment_id)

    stripe_checkout = StripeCheckout(
        api_key=await _get_stripe_key(),
        webhook_url=f"{host_url}/api/webhook/stripe",
    )

    checkout_request = CheckoutSessionRequest(
        amount=stripe_amount,
        currency=stripe_currency,
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "enrollment_id": enrollment_id,
            "item_type": data.item_type,
            "item_id": data.item_id,
            "item_title": checkout_item_title,
            "email": enrollment.get("booker_email", "") or "",
            "phone": enrollment.get("phone", "") or "",
            "name": enrollment.get("booker_name", "") or "",
            "participant_count": str(participant_count),
            "currency": currency,
            "booker_country": enrollment.get("booker_country", "") or "",
        },
    )

    session = await create_checkout_no_adaptive(stripe_checkout, checkout_request)

    month_prefix = datetime.now(timezone.utc).strftime("%Y-%m")
    count = await db.payment_transactions.count_documents({"invoice_number": {"$regex": f"^{month_prefix}"}})
    invoice_number = f"{month_prefix}-{str(count + 1).zfill(3)}"

    transaction = {
        "id": str(uuid.uuid4()),
        "invoice_number": invoice_number,
        "enrollment_id": enrollment_id,
        "stripe_session_id": session.session_id,
        "payment_provider": "stripe",
        "item_type": data.item_type,
        "item_id": data.item_id,
        "item_title": checkout_item_title,
        "amount": float(final_total),
        "currency": currency,
        "stripe_currency": stripe_currency,
        "stripe_amount": stripe_amount,
        "payment_status": "pending",
        "booker_name": enrollment.get("booker_name"),
        "booker_email": enrollment.get("booker_email"),
        "phone": enrollment.get("phone"),
        "participants": enrollment.get("participants"),
        "participant_count": participant_count,
        "attendance": enrollment.get("attendance"),
        "tier_index": data.tier_index,
        "pre_points_total": prep["pre_points_total"],
        "points_redeemed": prep["points_redeemed"],
        "points_discount": round(float(prep["points_discount"]), 2),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await _attach_portal_ids_to_transaction(transaction, enrollment)
    await db.payment_transactions.insert_one(transaction)

    await db.enrollments.update_one(
        {"id": enrollment_id},
        {
            "$set": {
                "step": 4,
                "status": "checkout_started",
                "stripe_session_id": session.session_id,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                **({"item_title": checkout_item_title} if checkout_item_title else {}),
            }
        },
    )

    return {"url": session.url, "session_id": session.session_id}


@router.post("/{enrollment_id}/checkout-razorpay")
async def enrollment_checkout_razorpay(enrollment_id: str, data: EnrollmentSubmit, request: Request):
    """Create Razorpay order + pending transaction. Restricted to INR, India IP, and India base country."""
    from routes.enrollment_checkout_prepare import enrollment_checkout_prepare
    from routes.currency import detect_ip_info
    from key_manager import get_key

    prep = await enrollment_checkout_prepare(
        db,
        enrollment_id,
        data,
        request,
        get_enrollment_pricing=get_enrollment_pricing,
        checkout_total_from_cart_items=_checkout_total_from_cart_items,
    )
    if prep["kind"] == "free":
        raise HTTPException(status_code=400, detail="No payment required for this enrollment.")

    enrollment = prep["enrollment"]

    ss_doc = await db.site_settings.find_one(
        {"id": "site_settings"},
        {
            "_id": 0,
            "enrollment_razorpay_enabled": 1,
            "india_gst_percent": 1,
            "india_platform_charge_percent": 1,
            "dashboard_sacred_home_annual_program_id": 1,
        },
    )
    if (ss_doc or {}).get("enrollment_razorpay_enabled") is False:
        raise HTTPException(
            status_code=403,
            detail="Razorpay enrollment checkout is turned off in site settings.",
        )

    ip_country, _ = await detect_ip_info(request)
    if (ip_country or "").upper() != "IN":
        raise HTTPException(
            status_code=403,
            detail="Razorpay is only available when your connection is detected from India.",
        )

    booker_cc = normalize_country_iso2(str(enrollment.get("booker_country") or ""))
    if booker_cc != "IN":
        raise HTTPException(
            status_code=403,
            detail="Razorpay requires India as the selected base country for this enrollment.",
        )

    currency = (prep.get("currency") or "").lower()
    if currency != "inr":
        raise HTTPException(
            status_code=403,
            detail="Razorpay is only available for INR checkout.",
        )

    list_inr = float(prep["final_total"])
    if list_inr <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount.")

    participant_count = max(1, int(prep.get("participant_count") or 1))
    booker_email = (enrollment.get("booker_email") or "").strip().lower()
    client_id = (enrollment.get("client_id") or "").strip()
    _cp_proj = {
        "_id": 0,
        "india_discount_percent": 1,
        "india_discount_member_bands": 1,
        "home_coming_india_discount_percent": 1,
        "home_coming_india_discount_member_bands": 1,
        "india_tax_enabled": 1,
        "india_tax_percent": 1,
        "india_tax_label": 1,
    }
    client_pricing_doc = None
    if client_id:
        client_pricing_doc = await db.clients.find_one({"id": client_id}, _cp_proj)
    if not client_pricing_doc and booker_email:
        client_pricing_doc = await db.clients.find_one({"email": booker_email}, _cp_proj)

    from utils.home_coming_crm_fields import client_pricing_row_for_india_checkout

    client_pricing_doc = client_pricing_row_for_india_checkout(client_pricing_doc)

    from utils.home_coming_discount_scope import (
        checkout_program_ids_from_submit,
        filter_client_pricing_for_home_coming_checkout,
    )

    pin_hc = str((ss_doc or {}).get("dashboard_sacred_home_annual_program_id") or "").strip()
    chk_ids = checkout_program_ids_from_submit(data)
    client_pricing_doc = filter_client_pricing_for_home_coming_checkout(
        client_pricing_doc,
        pin_program_id=pin_hc,
        checkout_program_ids=chk_ids,
    )

    from utils.india_checkout_math import compute_india_checkout_breakdown

    india_br = compute_india_checkout_breakdown(list_inr, client_pricing_doc, ss_doc, participant_count)
    if not india_br or india_br.get("rounded_total_inr", 0) <= 0:
        raise HTTPException(status_code=400, detail="Could not compute India checkout total.")

    charged_inr = float(india_br["rounded_total_inr"])

    key_id = (await get_key("razorpay_key_id")).strip()
    key_secret = (await get_key("razorpay_key_secret")).strip()
    if not key_id or not key_secret:
        raise HTTPException(status_code=503, detail="Razorpay is not configured.")

    amount_paise = int(round(charged_inr * 100))
    if amount_paise < 100:
        raise HTTPException(status_code=400, detail="Amount too small (minimum ₹1).")

    session_key = f"rz_{uuid.uuid4().hex}"

    month_prefix = datetime.now(timezone.utc).strftime("%Y-%m")
    count = await db.payment_transactions.count_documents({"invoice_number": {"$regex": f"^{month_prefix}"}})
    invoice_number = f"{month_prefix}-{str(count + 1).zfill(3)}"
    receipt = f"EN-{invoice_number}"[:40]

    pdata = prep["data"]
    enrollment_id = prep["enrollment_id"]
    item = prep["item"]

    from routes.india_payments import display_program_title_for_enrollment

    checkout_item_title = display_program_title_for_enrollment(
        enrollment,
        enrollment.get("participants"),
        item,
    )

    async with httpx.AsyncClient(timeout=45) as client_http:
        ro = await client_http.post(
            "https://api.razorpay.com/v1/orders",
            auth=(key_id, key_secret),
            json={
                "amount": amount_paise,
                "currency": "INR",
                "receipt": receipt,
                "notes": {
                    "enrollment_id": enrollment_id,
                    "item_type": pdata.item_type,
                    "item_id": pdata.item_id,
                    "internal_session": session_key,
                },
            },
        )
    if ro.status_code >= 400:
        logger.warning("Razorpay enrollment order error: %s", ro.text[:500])
        raise HTTPException(status_code=502, detail="Could not create Razorpay order. Try again later.")

    order = ro.json()
    order_id = order.get("id")
    if not order_id:
        raise HTTPException(status_code=502, detail="Razorpay did not return an order id.")

    transaction = {
        "id": str(uuid.uuid4()),
        "invoice_number": invoice_number,
        "enrollment_id": enrollment_id,
        "stripe_session_id": session_key,
        "razorpay_order_id": order_id,
        "payment_provider": "razorpay",
        "item_type": pdata.item_type,
        "item_id": pdata.item_id,
        "item_title": checkout_item_title,
        "amount": charged_inr,
        "currency": currency,
        "stripe_currency": "inr",
        "stripe_amount": charged_inr,
        "enrollment_list_inr": round(list_inr, 2),
        "india_checkout_breakdown": india_br,
        "payment_status": "pending",
        "booker_name": enrollment.get("booker_name"),
        "booker_email": enrollment.get("booker_email"),
        "phone": enrollment.get("phone"),
        "participants": enrollment.get("participants"),
        "participant_count": participant_count,
        "attendance": enrollment.get("attendance"),
        "tier_index": pdata.tier_index,
        "pre_points_total": prep["pre_points_total"],
        "points_redeemed": prep["points_redeemed"],
        "points_discount": round(float(prep["points_discount"]), 2),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await _attach_portal_ids_to_transaction(transaction, enrollment)
    await db.payment_transactions.insert_one(transaction)

    await db.enrollments.update_one(
        {"id": enrollment_id},
        {
            "$set": {
                "step": 4,
                "status": "checkout_started",
                "stripe_session_id": session_key,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )

    return {
        "key_id": key_id,
        "order_id": order_id,
        "amount": amount_paise,
        "currency": "INR",
        "session_id": session_key,
        "name": (enrollment.get("booker_name") or "")[:200],
        "email": (enrollment.get("booker_email") or "").strip().lower(),
        "description": (item.get("title", "") if item else "Enrollment")[:250],
        "india_breakdown": india_br,
    }


@router.get("/{enrollment_id}")
async def get_enrollment(enrollment_id: str):
    """Get enrollment status"""
    enrollment = await db.enrollments.find_one({"id": enrollment_id}, {"_id": 0})
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    return enrollment


class BINCheckRequest(BaseModel):
    bin_number: str  # First 6 digits of card


class QuoteRequest(BaseModel):
    name: str
    email: str
    phone: str = ""
    program_id: str = ""
    program_title: str = ""
    tier_label: str = ""
    message: str = ""


async def _send_quote_request_notification(quote: dict) -> None:
    """Email footer/support address when someone submits the public contact form."""
    try:
        settings = await db.site_settings.find_one({"id": "site_settings"}, {"_id": 0, "footer_email": 1})
        notify_to = ((settings or {}).get("footer_email") or "").strip() or "support@divineirishealing.com"
        from routes.emails import send_email

        name = html.escape(quote.get("name") or "")
        email = html.escape(quote.get("email") or "")
        phone = html.escape(quote.get("phone") or "")
        program_title = html.escape(quote.get("program_title") or "")
        tier_label = html.escape(quote.get("tier_label") or "")
        program_id = html.escape(quote.get("program_id") or "")
        message = html.escape(quote.get("message") or "")
        qid = html.escape(quote.get("id") or "")

        subject = f"New contact form — {quote.get('name', 'Visitor').strip()[:80] or 'Visitor'}"
        body = f"""
        <div style="font-family: 'Lato', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #1a1a1a; color: #D4AF37; padding: 16px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0; font-size: 18px;">New contact / quote request</h1>
            </div>
            <div style="background: #fff; border: 1px solid #e5e7eb; border-top: none; padding: 20px; border-radius: 0 0 8px 8px; font-size: 14px;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr><td style="padding: 6px 0; color: #6b7280; width: 120px;">ID</td><td style="padding: 6px 0;">{qid}</td></tr>
                    <tr><td style="padding: 6px 0; color: #6b7280;">Name</td><td style="padding: 6px 0; font-weight: 600;">{name}</td></tr>
                    <tr><td style="padding: 6px 0; color: #6b7280;">Email</td><td style="padding: 6px 0;"><a href="mailto:{email}">{email}</a></td></tr>
                    <tr><td style="padding: 6px 0; color: #6b7280;">Phone</td><td style="padding: 6px 0;">{phone or '—'}</td></tr>
                    <tr><td style="padding: 6px 0; color: #6b7280;">Program / topic</td><td style="padding: 6px 0;">{program_title or '—'}</td></tr>
                    <tr><td style="padding: 6px 0; color: #6b7280;">Tier</td><td style="padding: 6px 0;">{tier_label or '—'}</td></tr>
                    <tr><td style="padding: 6px 0; color: #6b7280;">Program ID</td><td style="padding: 6px 0;">{program_id or '—'}</td></tr>
                </table>
                <p style="margin: 16px 0 4px; color: #6b7280; font-size: 12px;">Message</p>
                <div style="background: #f9fafb; padding: 12px; border-radius: 6px; white-space: pre-wrap;">{message or '—'}</div>
                <p style="margin-top: 16px; font-size: 11px; color: #9ca3af;">Also in Admin → Inbox → Contacts.</p>
            </div>
        </div>
        """
        result = await send_email(notify_to, subject, body)
        if not result:
            logger.warning("Quote request notification: send_email returned no result (check SMTP / Resend).")
    except Exception as e:
        logger.warning(f"Quote request notification failed: {e}")


@router.post("/quote-request")
async def submit_quote_request(data: QuoteRequest):
    """Save a quote request for annual/custom pricing programs."""
    if not data.name.strip() or not data.email.strip():
        raise HTTPException(status_code=400, detail="Name and email are required")

    quote = {
        "id": str(uuid.uuid4()),
        "name": data.name.strip(),
        "email": data.email.strip().lower(),
        "phone": data.phone.strip(),
        "program_id": data.program_id,
        "program_title": data.program_title,
        "tier_label": data.tier_label,
        "message": data.message.strip(),
        "status": "new",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.quote_requests.insert_one(quote)
    asyncio.create_task(_send_quote_request_notification(quote))
    return {"message": "Quote request submitted successfully", "id": quote["id"]}


@router.get("/quote-requests")
async def list_quote_requests():
    """Admin endpoint to list all quote requests."""
    quotes = await db.quote_requests.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return quotes


@router.post("/{enrollment_id}/validate-bin")
async def validate_card_bin(enrollment_id: str, data: BINCheckRequest):
    """Validate card BIN matches claimed country.
    If user claims India but card is not Indian → block INR pricing.
    """
    enrollment = await db.enrollments.find_one({"id": enrollment_id})
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    bin_num = data.bin_number.strip()[:6]
    if len(bin_num) < 6 or not bin_num.isdigit():
        raise HTTPException(status_code=400, detail="BIN must be the first 6 digits of the card number")

    # Check BIN against known Indian prefixes
    is_indian_card = any(bin_num.startswith(prefix[:len(bin_num)]) for prefix in INDIA_BIN_PREFIXES)

    # Also try free BIN lookup API
    bin_country = None
    try:
        async with httpx.AsyncClient(timeout=5) as http:
            resp = await http.get(f"https://lookup.binlist.net/{bin_num}")
            if resp.status_code == 200:
                bin_data = resp.json()
                bin_country = bin_data.get("country", {}).get("alpha2", "")
                if bin_country == "IN":
                    is_indian_card = True
    except Exception:
        pass  # BIN API failed, rely on local list

    claimed_country = enrollment.get("booker_country", enrollment.get("country", ""))
    
    # If claiming India but card is not Indian → flag
    if claimed_country == "IN" and not is_indian_card:
        await db.enrollments.update_one(
            {"id": enrollment_id},
            {"$set": {
                "bin_mismatch": True,
                "bin_country": bin_country,
                "vpn_blocked": True,  # Block INR pricing
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }}
        )
        return {
            "valid": False,
            "is_indian_card": False,
            "bin_country": bin_country,
            "message": "Card is not issued by an Indian bank. INR pricing is not available. You will be charged in AED.",
        }

    await db.enrollments.update_one(
        {"id": enrollment_id},
        {"$set": {
            "bin_mismatch": False,
            "bin_country": bin_country or ("IN" if is_indian_card else "UNKNOWN"),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )

    return {
        "valid": True,
        "is_indian_card": is_indian_card,
        "bin_country": bin_country,
        "message": "Card validated successfully.",
    }



# ─── ADMIN: List all enrollments ───
@router.get("/admin/list")
async def list_enrollments():
    """Admin endpoint to list all enrollments."""
    enrollments = await db.enrollments.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return enrollments


@router.get("/{enrollment_id}")
async def get_enrollment(enrollment_id: str):
    """Get a single enrollment by ID."""
    enrollment = await db.enrollments.find_one({"id": enrollment_id}, {"_id": 0})
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    return enrollment



@router.post("/check-vip-offer")
async def check_vip_offer(data: dict):
    """Check if email/phone matches any VIP special offer."""
    email = (data.get("email") or "").lower().strip()
    phone = (data.get("phone") or "").replace(" ", "").replace("-", "").replace("+", "").lstrip("0")
    program_id = str(data.get("program_id", ""))
    
    settings = await db.site_settings.find_one({"id": "site_settings"}, {"_id": 0, "special_offers": 1})
    for offer in (settings or {}).get("special_offers", []):
        if not offer.get("enabled", True):
            continue
        offer_programs = offer.get("program_ids", [])
        if offer_programs and program_id and program_id not in [str(p) for p in offer_programs]:
            continue
        for person in offer.get("people", []):
            pe = (person.get("email") or "").lower().strip()
            pp = (person.get("phone") or "").replace(" ", "").replace("-", "").replace("+", "").lstrip("0")
            if (pe and pe == email) or (pp and pp == phone):
                return {
                    "matched": True,
                    "label": offer.get("label", "Special Offer"),
                    "code": offer.get("code", ""),
                    "discount_type": offer.get("discount_type", "percentage"),
                    "discount_pct": offer.get("discount_pct", 0),
                    "discount_amount": offer.get("discount_amount", 0),
                    "person_name": person.get("name", ""),
                }
    return {"matched": False}


# ═══════════════════════════════════════
# INR PRICING OVERRIDES (NRI Students)
# ═══════════════════════════════════════

@router.post("/inr-override/generate-token")
async def generate_inr_invite_token(data: dict):
    """Admin generates an invite token for INR pricing access."""
    label = data.get("label", "")
    token = f"INR-{uuid.uuid4().hex[:8].upper()}"
    await db.inr_invite_tokens.insert_one({
        "token": token, "label": label, "active": True,
        "used_count": 0, "max_uses": data.get("max_uses", 10),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"token": token}

@router.get("/inr-override/tokens")
async def list_inr_tokens():
    tokens = await db.inr_invite_tokens.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return tokens

@router.delete("/inr-override/tokens/{token}")
async def delete_inr_token(token: str):
    await db.inr_invite_tokens.delete_one({"token": token})
    return {"message": "Deleted"}

@router.post("/inr-override/validate-token")
async def validate_inr_token(data: dict):
    """Frontend calls this to check if an invite token is valid."""
    token = data.get("token", "").strip()
    doc = await db.inr_invite_tokens.find_one({"token": token, "active": True})
    if not doc:
        raise HTTPException(status_code=404, detail="Invalid or expired token")
    if doc.get("max_uses", 10) > 0 and doc.get("used_count", 0) >= doc.get("max_uses", 10):
        raise HTTPException(status_code=410, detail="Token has been fully used")
    return {"valid": True, "label": doc.get("label", "")}

@router.post("/inr-override/apply-to-enrollment")
async def apply_inr_override(data: dict):
    """Apply INR override to an enrollment via token, promo, or whitelist."""
    enrollment_id = data.get("enrollment_id")
    method = data.get("method")  # "token", "promo", "whitelist"
    value = data.get("value", "")
    
    if method == "token":
        doc = await db.inr_invite_tokens.find_one({"token": value, "active": True})
        if not doc:
            raise HTTPException(status_code=404, detail="Invalid token")
        await db.enrollments.update_one({"id": enrollment_id}, {"$set": {"inr_invite_token": value}})
        await db.inr_invite_tokens.update_one({"token": value}, {"$inc": {"used_count": 1}})
    elif method == "promo":
        await db.enrollments.update_one({"id": enrollment_id}, {"$set": {"inr_promo_applied": True}})
    elif method == "whitelist":
        await db.enrollments.update_one({"id": enrollment_id}, {"$set": {"inr_whitelist_match": True}})
    
    return {"message": "INR override applied"}
