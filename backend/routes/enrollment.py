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

# ─── PPP TIERS (fixed, not live conversion) ───
# Only India gets PPP discount. Everyone else → AED base.
PPP_TIERS = {
    "inr": {"multiplier": 0.14, "symbol": "₹", "name": "Indian Rupee"},
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
    relationship: str  # Myself, Mother, Father, Sister, Brother, Spouse, Friend, Husband, Wife, Colleague, Other
    age: int
    gender: str
    country: str = "AE"
    attendance_mode: str = "online"  # "online" or "offline"
    notify: bool = False
    email: Optional[str] = None
    phone: Optional[str] = None


class ProfileData(BaseModel):
    booker_name: str
    booker_email: str
    booker_country: str = "AE"
    participants: list[ParticipantData]


class EmailValidation(BaseModel):
    email: str


class PhoneOTPRequest(BaseModel):
    phone: str
    country_code: str = "+91"


class PhoneOTPVerify(BaseModel):
    phone: str
    country_code: str = "+91"
    otp: str


class EnrollmentSubmit(BaseModel):
    enrollment_id: str
    item_type: str
    item_id: str
    currency: str


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

@router.post("/start")
async def start_enrollment(profile: ProfileData, request: Request):
    """Step 1: Create enrollment with booker info + participants (each with country, attendance, notify prefs) + IP detection"""
    ip_info = await detect_ip_info(request)

    if not profile.participants or len(profile.participants) == 0:
        raise HTTPException(status_code=400, detail="At least one participant is required")

    # Validate booker email (format + MX)
    email = profile.booker_email.strip().lower()
    if not validate_email_format(email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    domain = email.split("@")[1]
    if not check_mx_record(domain):
        raise HTTPException(status_code=400, detail=f"Email domain '{domain}' cannot receive emails. Please use a valid email.")
    disposable_domains = ["tempmail.com", "throwaway.email", "guerrillamail.com", "mailinator.com", "yopmail.com", "10minutemail.com"]
    if domain in disposable_domains:
        raise HTTPException(status_code=400, detail="Disposable email addresses are not allowed.")

    # Validate per-participant data
    for i, p in enumerate(profile.participants):
        if p.attendance_mode not in ["online", "offline"]:
            raise HTTPException(status_code=400, detail=f"Participant {i+1}: attendance mode must be 'online' or 'offline'")
        if p.notify:
            if p.email and not validate_email_format(p.email.strip()):
                raise HTTPException(status_code=400, detail=f"Participant {i+1}: invalid email format")

    enrollment = {
        "id": str(uuid.uuid4()),
        "status": "profile_complete",
        "step": 1,
        "booker_name": profile.booker_name,
        "booker_email": email,
        "booker_country": profile.booker_country,
        "participants": [p.dict() for p in profile.participants],
        "participant_count": len(profile.participants),
        "ip_info": ip_info,
        "phone": None,
        "phone_verified": False,
        "vpn_blocked": ip_info["is_vpn"] or ip_info["is_proxy"] or ip_info["is_hosting"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.enrollments.insert_one(enrollment)

    return {
        "enrollment_id": enrollment["id"],
        "step": 1,
        "participant_count": len(profile.participants),
        "ip_country": ip_info["country"],
        "vpn_detected": enrollment["vpn_blocked"],
        "message": f"Profile saved for {len(profile.participants)} participant(s). Proceed to verification.",
    }


@router.post("/{enrollment_id}/send-otp")
async def send_phone_otp(enrollment_id: str, data: PhoneOTPRequest):
    """Step 3b: Send OTP to phone (MOCK - logs to console, ready for Firebase swap)"""
    enrollment = await db.enrollments.find_one({"id": enrollment_id})
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    phone = data.phone.strip()
    if not re.match(r'^\d{7,15}$', phone):
        raise HTTPException(status_code=400, detail="Invalid phone number format")

    # Generate 6-digit OTP
    otp = str(random.randint(100000, 999999))
    expires = datetime.now(timezone.utc) + timedelta(minutes=5)

    # Store OTP in DB
    await db.phone_otps.update_one(
        {"phone": f"{data.country_code}{phone}"},
        {"$set": {
            "otp": otp,
            "expires": expires.isoformat(),
            "attempts": 0,
            "enrollment_id": enrollment_id,
        }},
        upsert=True,
    )

    # MOCK: Log OTP (replace with Firebase/Twilio in production)
    full_phone = f"{data.country_code}{phone}"
    logger.info(f"[MOCK OTP] Phone: {full_phone} → OTP: {otp}")
    print(f"\n{'='*50}")
    print(f"  MOCK OTP for {full_phone}: {otp}")
    print(f"{'='*50}\n")

    await db.enrollments.update_one(
        {"id": enrollment_id},
        {"$set": {
            "phone": full_phone,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )

    return {
        "sent": True,
        "phone": f"{data.country_code}{'*' * (len(phone)-3)}{phone[-3:]}",
        "message": "OTP sent to your phone. Valid for 5 minutes.",
        # MOCK ONLY: Include OTP in response for testing. Remove in production.
        "mock_otp": otp,
    }


@router.post("/{enrollment_id}/verify-otp")
async def verify_phone_otp(enrollment_id: str, data: PhoneOTPVerify):
    """Step 3b: Verify phone OTP"""
    full_phone = f"{data.country_code}{data.phone.strip()}"

    otp_record = await db.phone_otps.find_one({"phone": full_phone, "enrollment_id": enrollment_id})
    if not otp_record:
        raise HTTPException(status_code=400, detail="No OTP sent for this number. Please request a new one.")

    # Check attempts
    if otp_record.get("attempts", 0) >= 5:
        raise HTTPException(status_code=429, detail="Too many attempts. Please request a new OTP.")

    # Increment attempts
    await db.phone_otps.update_one(
        {"phone": full_phone, "enrollment_id": enrollment_id},
        {"$inc": {"attempts": 1}}
    )

    # Check expiry
    expires = datetime.fromisoformat(otp_record["expires"])
    if datetime.now(timezone.utc) > expires:
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")

    # Verify
    if data.otp != otp_record["otp"]:
        remaining = 5 - otp_record.get("attempts", 0) - 1
        raise HTTPException(status_code=400, detail=f"Incorrect OTP. {remaining} attempts remaining.")

    # Mark verified
    await db.enrollments.update_one(
        {"id": enrollment_id},
        {"$set": {
            "phone_verified": True,
            "step": 3,
            "status": "contact_verified",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )

    # Cleanup OTP
    await db.phone_otps.delete_one({"phone": full_phone, "enrollment_id": enrollment_id})

    return {"verified": True, "message": "Phone verified successfully."}


@router.get("/{enrollment_id}/pricing")
async def get_enrollment_pricing(enrollment_id: str, item_type: str, item_id: str):
    """Step 4: Get pricing with strict India-gating for INR prices.
    
    To get INR pricing, ALL of the following must be true:
    1. IP is detected as India (no VPN/proxy/hosting)
    2. Claimed country is India
    3. Phone number has +91 prefix
    If ANY check fails → AED base price.
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
    phone = enrollment.get("phone") or ""
    participant_count = enrollment.get("participant_count", 1)

    # ─── STRICT INDIA VALIDATION ───
    checks = {
        "ip_is_india": ip_country == "IN",
        "claimed_india": claimed_country == "IN",
        "no_vpn": not vpn_blocked,
        "phone_is_indian": phone.startswith("+91") if phone else False,
    }
    all_india_checks_pass = all(checks.values())

    # Determine currency
    if all_india_checks_pass:
        allowed_currency = "inr"
        fraud_warning = None
    else:
        allowed_currency = "aed"
        # Build specific rejection reasons
        reasons = []
        if not checks["no_vpn"]:
            reasons.append("VPN/Proxy detected")
        if not checks["ip_is_india"]:
            reasons.append(f"IP location is {ip_country}, not India")
        if not checks["claimed_india"]:
            reasons.append("Country not set to India")
        if not checks["phone_is_indian"]:
            reasons.append("Phone number is not Indian (+91)")
        fraud_warning = f"INR pricing unavailable: {'; '.join(reasons)}. Defaulting to AED."

    # Get price from item
    base_aed = float(item.get("price_aed", 0))
    if allowed_currency == "inr":
        price = float(item.get("price_inr", 0))
        if price <= 0 and base_aed > 0:
            price = round(base_aed * PPP_TIERS["inr"]["multiplier"], 2)
        symbol = "₹"
    else:
        price = base_aed
        symbol = "AED "

    # Offer price
    offer_price = 0.0
    if allowed_currency == "inr":
        offer_price = float(item.get("offer_price_inr", 0))

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
            "inr_eligible": all_india_checks_pass,
        },
    }


@router.post("/{enrollment_id}/checkout")
async def enrollment_checkout(enrollment_id: str, data: EnrollmentSubmit, request: Request):
    """Step 4: Create Stripe checkout with verified enrollment data"""
    enrollment = await db.enrollments.find_one({"id": enrollment_id})
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    # Verify enrollment is complete
    if not enrollment.get("phone_verified"):
        raise HTTPException(status_code=400, detail="Phone not verified")

    # Get pricing (server-side, not from client)
    pricing_resp = await get_enrollment_pricing(enrollment_id, data.item_type, data.item_id)
    total = pricing_resp["pricing"]["total"]
    currency = pricing_resp["pricing"]["currency"]

    if total <= 0:
        raise HTTPException(status_code=400, detail="Invalid price")

    # BIN validation placeholder - in production, this would check card BIN vs location
    # For now, we log the mismatch for monitoring
    if pricing_resp["security"]["country_mismatch"]:
        logger.warning(
            f"Country mismatch for enrollment {enrollment_id}: "
            f"IP={pricing_resp['security']['ip_country']}, "
            f"Claimed={pricing_resp['security']['claimed_country']}"
        )

    # Create Stripe checkout via existing payments system
    from routes.payments import STRIPE_API_KEY
    from emergentintegrations.payments.stripe.checkout import (
        StripeCheckout, CheckoutSessionRequest
    )

    collection = "programs" if data.item_type == "program" else "sessions"
    item = await db[collection].find_one({"id": data.item_id})

    origin = str(request.headers.get("origin", request.base_url)).rstrip('/')
    host_url = str(request.base_url).rstrip('/')
    success_url = f"{origin}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/payment/cancel?item_type={data.item_type}&item_id={data.item_id}"

    stripe_checkout = StripeCheckout(
        api_key=STRIPE_API_KEY,
        webhook_url=f"{host_url}/api/webhook/stripe"
    )

    checkout_request = CheckoutSessionRequest(
        amount=float(total),
        currency=currency,
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "enrollment_id": enrollment_id,
            "item_type": data.item_type,
            "item_id": data.item_id,
            "item_title": item.get("title", ""),
            "email": enrollment.get("booker_email", ""),
            "phone": enrollment.get("phone", ""),
            "name": enrollment.get("booker_name", ""),
            "participant_count": str(enrollment.get("participant_count", 1)),
            "currency": currency,
            "booker_country": enrollment.get("booker_country", ""),
        }
    )

    session = await stripe_checkout.create_checkout_session(checkout_request)

    # Save transaction
    transaction = {
        "id": str(uuid.uuid4()),
        "enrollment_id": enrollment_id,
        "stripe_session_id": session.session_id,
        "item_type": data.item_type,
        "item_id": data.item_id,
        "item_title": item.get("title", ""),
        "amount": float(total),
        "currency": currency,
        "payment_status": "pending",
        "booker_name": enrollment.get("booker_name"),
        "booker_email": enrollment.get("booker_email"),
        "phone": enrollment.get("phone"),
        "participants": enrollment.get("participants"),
        "participant_count": enrollment.get("participant_count", 1),
        "attendance": enrollment.get("attendance"),
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
