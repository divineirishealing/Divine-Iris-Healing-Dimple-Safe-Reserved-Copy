from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr
from typing import Optional
import os, re, random, uuid, logging, httpx, dns.resolver
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


class ProfileData(BaseModel):
    booker_name: str
    booker_email: str
    booker_country: str = "AE"
    participants: list[ParticipantData]
    # Filled by enrollment UI so abandoned-checkout reminder links work before payment step
    item_type: Optional[str] = None
    item_id: Optional[str] = None
    item_title: Optional[str] = None


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

    enrollment = {
        "id": receipt_id,
        "status": "contact_verified" if trusted_contact else "profile_complete",
        "step": 3 if trusted_contact else 1,
        "booker_name": profile.booker_name,
        "booker_email": email,
        "booker_country": profile.booker_country,
        "participants": [p.model_dump(mode="python") for p in profile.participants],
        "participant_count": len(profile.participants),
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
        if profile.item_title:
            enrollment["item_title"] = profile.item_title.strip()
    else:
        p0 = profile.participants[0]
        if p0.program_id:
            enrollment["item_type"] = "program"
            enrollment["item_id"] = str(p0.program_id).strip()
            if p0.program_title:
                enrollment["item_title"] = str(p0.program_title).strip()

    await db.enrollments.insert_one(enrollment)

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
    from routes.currency import get_base_currency as _get_base_currency
    if inr_eligible:
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
    if client_currency in ("inr", "aed", "usd"):
        if not (is_blocklisted and client_currency == "inr"):
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
        raise HTTPException(status_code=403, detail="Phone not verified")

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
    """Step 4: Create Stripe checkout with verified enrollment data"""
    enrollment = await db.enrollments.find_one({"id": enrollment_id})
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    # Verify enrollment is complete
    if not enrollment.get("phone_verified"):
        raise HTTPException(status_code=400, detail="Phone not verified")

    # ── Currency verification: re-check IP before payment ──
    from routes.currency import detect_ip_info, get_base_currency
    ip_country, vpn_detected = await detect_ip_info(request)
    server_currency = get_base_currency(ip_country, vpn_detected)
    claimed_currency = (data.currency or "usd").lower()
    
    # ── INR Override: Check 3 methods for NRI/whitelisted students ──
    inr_override = False
    booker_email = enrollment.get("booker_email", "").lower().strip()
    
    # Method 1: Email whitelist
    settings = await db.site_settings.find_one({"id": "site_settings"}, {"_id": 0, "inr_whitelist_emails": 1})
    whitelist = [e.lower().strip() for e in (settings or {}).get("inr_whitelist_emails", [])]
    if booker_email in whitelist:
        inr_override = True
    
    # Method 2: Invite token (stored in enrollment)
    if enrollment.get("inr_invite_token"):
        token_doc = await db.inr_invite_tokens.find_one({"token": enrollment["inr_invite_token"], "active": True})
        if token_doc:
            inr_override = True
    
    # Method 3: INR promo code (stored in enrollment)
    if enrollment.get("inr_promo_applied"):
        inr_override = True
    
    # Apply INR override or strict protection
    if inr_override and claimed_currency == "inr":
        pass  # Allow INR even from abroad
    elif claimed_currency == "inr" and server_currency != "inr":
        raise HTTPException(status_code=403, detail="Currency mismatch — your region does not qualify for INR pricing. Please refresh the page.")
    if claimed_currency == "aed" and server_currency == "usd" and not inr_override:
        raise HTTPException(status_code=403, detail="Currency mismatch — please refresh the page.")
    
    # Force correct base currency from server-side IP check (overrides stale frontend cache)
    if server_currency == "inr" and claimed_currency != "inr":
        data.currency = "inr"
        data.display_currency = "inr"
    elif server_currency == "aed" and claimed_currency not in ("aed", "inr") and not inr_override:
        data.currency = "aed"
        if not data.display_currency or data.display_currency == "usd":
            data.display_currency = "aed"

    # Always enforce display_currency server-side from live IP detection.
    # This ensures the Stripe page always matches what was shown on the homepage,
    # regardless of whether the frontend passed display_currency correctly.
    from routes.currency import get_display_currency as _get_display_currency
    server_display_currency = _get_display_currency(ip_country, vpn_detected)
    if server_display_currency:
        data.display_currency = server_display_currency

    # Get pricing (server-side, not from client)
    # Store browser signals for fraud detection audit trail
    if data.browser_timezone or data.browser_languages:
        await db.enrollments.update_one({"id": enrollment_id}, {"$set": {
            "browser_timezone": data.browser_timezone,
            "browser_languages": data.browser_languages,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }})

    if enrollment.get("dashboard_mixed_total") is not None:
        total = float(enrollment["dashboard_mixed_total"])
        currency = (enrollment.get("dashboard_mixed_currency") or data.currency or "aed").lower()
        participant_count = enrollment.get("participant_count", 1)
        pricing_resp = {
            "pricing": {"total": total, "currency": currency, "participant_count": participant_count},
            "security": {
                "vpn_blocked": False,
                "fraud_warning": None,
                "checks": {},
                "ip_country": ip_country,
                "claimed_country": enrollment.get("booker_country", ""),
                "country_mismatch": False,
                "inr_eligible": currency == "inr",
            },
        }
    else:
        pricing_resp = await get_enrollment_pricing(
            enrollment_id, data.item_type, data.item_id,
            tier_index=data.tier_index, client_currency=data.currency,
            browser_timezone=data.browser_timezone, browser_languages=data.browser_languages,
        )
        total = pricing_resp["pricing"]["total"]
        currency = pricing_resp["pricing"]["currency"]
        participant_count = enrollment.get("participant_count", 1)

        cart_lines = data.cart_items or []
        if cart_lines:
            agg_total, agg_headcount = await _checkout_total_from_cart_items(cart_lines, currency)
            if agg_total > 0 and agg_headcount > 0:
                total = agg_total
                participant_count = agg_headcount
                pricing_resp["pricing"]["total"] = total
                pricing_resp["pricing"]["participant_count"] = participant_count

    # Apply promo code discount (server-side validation) — skip if dashboard already baked promos into total
    promo_discount = 0
    if enrollment.get("dashboard_mixed_total") is None and data.promo_code:
        try:
            promo = await db.promotions.find_one({"code": data.promo_code.strip().upper(), "active": True}, {"_id": 0})
            if promo:
                discount_type = promo.get("discount_type", "percentage")
                if discount_type == "percentage":
                    pct = promo.get("discount_percentage", 0)
                    promo_discount = round(total * pct / 100, 2)
                else:
                    promo_discount = float(promo.get(f"discount_{currency}", promo.get("discount_aed", 0)))
        except Exception as e:
            logger.warning(f"Promo code error: {e}")

    # Apply auto-discounts (group, loyalty, etc.)
    auto_discount = 0
    try:
        from routes.discounts import calculate_discounts as _calc_discounts
        cart_lines_dc = data.cart_items or []
        num_programs_dc = len(cart_lines_dc) if cart_lines_dc else 1
        num_participants_dc = participant_count
        if cart_lines_dc:
            npc_sum = sum(int(ci.get("participants_count") or 0) for ci in cart_lines_dc)
            if npc_sum > 0:
                num_participants_dc = npc_sum
        program_ids_dc = [str(ci.get("program_id")) for ci in cart_lines_dc if ci.get("program_id")]
        disc_result = await _calc_discounts({
            "num_programs": num_programs_dc,
            "num_participants": num_participants_dc,
            "subtotal": total,
            "email": enrollment.get("booker_email", ""),
            "currency": currency,
            "program_ids": program_ids_dc,
            "cart_items": cart_lines_dc,
        })
        auto_discount = float(disc_result.get("total_discount", 0))
    except Exception as e:
        logger.warning(f"Auto discount calc error: {e}")

    # Apply Special/VIP Offers — match by email or phone
    vip_discount = 0
    vip_offer_name = ""
    try:
        settings = await db.site_settings.find_one({"id": "site_settings"}, {"_id": 0, "special_offers": 1})
        special_offers = (settings or {}).get("special_offers", [])
        booker_email = (enrollment.get("booker_email") or "").lower().strip()
        booker_phone = (enrollment.get("phone") or "").replace(" ", "").replace("-", "").replace("+", "").lstrip("0")
        # Also check participant emails/phones
        participants = enrollment.get("participants", [])
        all_emails = {booker_email} | {(p.get("email") or "").lower().strip() for p in participants}
        all_phones = {booker_phone} | {(p.get("phone") or "").replace(" ", "").replace("-", "").replace("+", "").lstrip("0") for p in participants}
        all_emails.discard("")
        all_phones.discard("")

        for offer in special_offers:
            if not offer.get("enabled", True):
                continue
            # Check if this offer applies to this program
            offer_programs = offer.get("program_ids", [])
            if offer_programs and data.item_id and str(data.item_id) not in [str(p) for p in offer_programs]:
                continue
            # Match by email or phone
            offer_people = offer.get("people", [])
            matched = False
            for person in offer_people:
                person_email = (person.get("email") or "").lower().strip()
                person_phone = (person.get("phone") or "").replace(" ", "").replace("-", "").replace("+", "").lstrip("0")
                if person_email and person_email in all_emails:
                    matched = True
                    break
                if person_phone and person_phone in all_phones:
                    matched = True
                    break
            if matched:
                if offer.get("discount_type") == "fixed":
                    vip_discount = float(offer.get("discount_amount", 0))
                else:
                    vip_discount = round(total * float(offer.get("discount_pct", 0)) / 100, 2)
                vip_offer_name = offer.get("label", offer.get("code", "VIP"))
                logger.info(f"VIP offer '{vip_offer_name}' matched for {booker_email or booker_phone}: -{vip_discount}")
                break
    except Exception as e:
        logger.warning(f"VIP offer check error: {e}")

    # NO STACKING: Only the single best discount applies
    # Priority: VIP > Promo > auto (combo/group/loyalty/cross-sell)
    best_discount = 0
    best_source = ""
    if vip_discount > 0:
        best_discount = vip_discount
        best_source = f"vip:{vip_offer_name}"
    elif promo_discount > 0:
        best_discount = promo_discount
        best_source = f"promo:{data.promo_code}"
    elif auto_discount > 0:
        best_discount = auto_discount
        best_source = "auto"

    final_total = max(0, total - best_discount)

    # ── Loyalty points (redeem up to % of basket; burn on payment webhook) ──
    points_redeemed = 0
    points_discount = 0.0
    pre_points_total = float(final_total)
    try:
        from routes.points_logic import (
            fetch_points_config,
            available_balance,
            compute_points_redemption,
            normalize_email,
            flagship_blocks_points_redemption,
        )

        cfg_pts = await fetch_points_config(db)
        cart_prog_ids = [str(ci.get("program_id")) for ci in (data.cart_items or []) if ci.get("program_id")]
        blocked_flagship, _ = await flagship_blocks_points_redemption(
            db,
            cfg_pts,
            item_type=data.item_type or "",
            item_id=data.item_id or "",
            cart_program_ids=cart_prog_ids,
        )
        req_pts = 0 if blocked_flagship else int(data.points_to_redeem or 0)
        if cfg_pts["enabled"] and req_pts > 0 and final_total > 0:
            be_pts = normalize_email(enrollment.get("booker_email", ""))
            avail_pts = await available_balance(db, be_pts)
            points_redeemed, points_discount = compute_points_redemption(
                req_pts, float(final_total), currency, avail_pts, cfg_pts
            )
            final_total = max(0.0, round(float(final_total) - float(points_discount), 2))
    except Exception as e:
        logger.warning(f"Points redemption calc error: {e}")

    # Store VIP discount in enrollment
    if vip_discount > 0:
        await db.enrollments.update_one({"id": enrollment_id}, {"$set": {
            "vip_discount": vip_discount, "vip_offer_name": vip_offer_name,
        }})

    # Store item info in enrollment for reference
    collection = "programs" if data.item_type == "program" else "sessions"
    item = await db[collection].find_one({"id": data.item_id}, {"_id": 0})
    await db.enrollments.update_one({"id": enrollment_id}, {"$set": {
        "item_type": data.item_type, "item_id": data.item_id,
        "item_title": item.get("title", "") if item else "",
    }})

    if final_total <= 0:
        # Free enrollment — skip Stripe, complete directly
        fake_session_id = f"free_{uuid.uuid4().hex[:12]}"

        transaction = {
            "id": str(uuid.uuid4()),
            "enrollment_id": enrollment_id,
            "stripe_session_id": fake_session_id,
            "item_type": data.item_type,
            "item_id": data.item_id,
            "item_title": item.get("title", "") if item else "",
            "amount": 0,
            "currency": currency,
            "payment_status": "paid",
            "booker_name": enrollment.get("booker_name"),
            "booker_email": enrollment.get("booker_email"),
            "phone": enrollment.get("phone"),
            "participants": enrollment.get("participants"),
            "participant_count": participant_count,
            "attendance": enrollment.get("attendance"),
            "tier_index": data.tier_index,
            "is_free": True,
            "pre_points_total": pre_points_total,
            "points_redeemed": points_redeemed,
            "points_discount": round(float(points_discount), 2),
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        await db.payment_transactions.insert_one(transaction)

        await db.enrollments.update_one(
            {"id": enrollment_id},
            {"$set": {
                "step": 5,
                "status": "completed",
                "stripe_session_id": fake_session_id,
                "is_free": True,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }}
        )

        # Generate UIDs for participants
        from routes.payments import generate_participant_uids, send_enrollment_emails
        await generate_participant_uids(fake_session_id)

        # Send confirmation emails in background
        import asyncio
        asyncio.create_task(send_enrollment_emails(fake_session_id))

        logger.info(f"[FREE ENROLLMENT] enrollment_id={enrollment_id}, item={data.item_id}")
        return {"url": f"__FREE_SUCCESS__", "session_id": fake_session_id}

    # BIN validation placeholder - in production, this would check card BIN vs location
    # For now, we log the mismatch for monitoring
    if pricing_resp["security"]["country_mismatch"]:
        logger.warning(
            f"Country mismatch for enrollment {enrollment_id}: "
            f"IP={pricing_resp['security']['ip_country']}, "
            f"Claimed={pricing_resp['security']['claimed_country']}"
        )

    # Create Stripe checkout via existing payments system
    from routes.payments import _get_stripe_key
    from emergentintegrations.payments.stripe.checkout import (
        StripeCheckout, CheckoutSessionRequest
    )

    collection = "programs" if data.item_type == "program" else "sessions"
    item = await db[collection].find_one({"id": data.item_id})

    # Build public-facing URLs for Stripe redirects
    # Priority: client origin_url > Origin header > X-Forwarded-Host > Referer > base_url
    origin = ""
    if data.origin_url and "cluster-" not in data.origin_url:
        origin = data.origin_url.strip().rstrip('/')
    if not origin:
        origin = request.headers.get("origin", "").strip()
    if not origin or "cluster-" in origin:
        fwd_host = request.headers.get("x-forwarded-host", "").strip()
        if fwd_host and "cluster-" not in fwd_host:
            scheme = request.headers.get("x-forwarded-proto", "https")
            origin = f"{scheme}://{fwd_host}"
        else:
            referer = request.headers.get("referer", "").strip()
            if referer:
                from urllib.parse import urlparse
                parsed = urlparse(referer)
                origin = f"{parsed.scheme}://{parsed.netloc}"
            else:
                origin = str(request.base_url).rstrip('/')
    origin = origin.rstrip('/')

    host_url = str(request.base_url).rstrip('/')
    success_url = f"{origin}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/enroll/{data.item_type}/{data.item_id}?resume={enrollment_id}"
    if data.tier_index is not None:
        cancel_url += f"&tier={data.tier_index}"

    stripe_checkout = StripeCheckout(
        api_key=await _get_stripe_key(),
        webhook_url=f"{host_url}/api/webhook/stripe"
    )

    # Stripe charge rules:
    # - INR: ALWAYS charge the exact ₹ price from the pricing hub. Never convert.
    # - AED (UAE exact) / USD (US exact): charge as-is for those countries.
    # - AED/USD base for OTHER countries (UK→GBP, SG→SGD, etc.): convert to local currency.
    stripe_currency = currency
    stripe_amount = float(final_total)
    if currency != "inr" and data.display_currency and data.display_currency != currency:
        from routes.currency import fetch_live_rates, convert_amount
        rates = await fetch_live_rates()
        converted = convert_amount(float(final_total), currency, data.display_currency, rates)
        if converted and converted > 0:
            stripe_currency = data.display_currency
            stripe_amount = float(converted)

    checkout_request = CheckoutSessionRequest(
        amount=stripe_amount,
        currency=stripe_currency,
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "enrollment_id": enrollment_id,
            "item_type": data.item_type,
            "item_id": data.item_id,
            "item_title": item.get("title", ""),
            "email": enrollment.get("booker_email", "") or "",
            "phone": enrollment.get("phone", "") or "",
            "name": enrollment.get("booker_name", "") or "",
            "participant_count": str(participant_count),
            "currency": currency,
            "booker_country": enrollment.get("booker_country", "") or "",
        }
    )

    from routes.payments import create_checkout_no_adaptive
    session = await create_checkout_no_adaptive(stripe_checkout, checkout_request)

    # Generate invoice number: YYYY-MM-001
    now = datetime.now(timezone.utc)
    month_prefix = now.strftime("%Y-%m")
    count = await db.payment_transactions.count_documents({"invoice_number": {"$regex": f"^{month_prefix}"}})
    invoice_number = f"{month_prefix}-{str(count + 1).zfill(3)}"

    # Save transaction
    transaction = {
        "id": str(uuid.uuid4()),
        "invoice_number": invoice_number,
        "enrollment_id": enrollment_id,
        "stripe_session_id": session.session_id,
        "item_type": data.item_type,
        "item_id": data.item_id,
        "item_title": item.get("title", ""),
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
        "pre_points_total": pre_points_total,
        "points_redeemed": points_redeemed,
        "points_discount": round(float(points_discount), 2),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.payment_transactions.insert_one(transaction)

    # Update enrollment status
    await db.enrollments.update_one(
        {"id": enrollment_id},
        {"$set": {
            "step": 4,
            "status": "checkout_started",
            "stripe_session_id": session.session_id,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )

    return {"url": session.url, "session_id": session.session_id}


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
