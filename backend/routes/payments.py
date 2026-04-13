from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime, timezone
import uuid
import logging

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionRequest, CheckoutSessionResponse, CheckoutStatusResponse
)
from routes.emails import send_email, enrollment_confirmation_email, participant_notification_email
from utils.uid_generator import generate_uid
import stripe as stripe_lib
import re

# Timezone offsets for conversion
COUNTRY_TZ = {
    'IN': (5.5, 'IST'), 'AE': (4, 'GST'), 'US': (-5, 'EST'), 'GB': (0, 'GMT'),
    'CA': (-5, 'EST'), 'AU': (10, 'AEST'), 'SG': (8, 'SGT'), 'DE': (1, 'CET'),
    'SA': (3, 'AST'), 'QA': (3, 'AST'), 'PK': (5, 'PKT'), 'BD': (6, 'BST'),
    'MY': (8, 'MYT'), 'JP': (9, 'JST'), 'FR': (1, 'CET'), 'LK': (5.5, 'IST'),
    'ZA': (2, 'SAST'), 'NP': (5.75, 'NPT'), 'KW': (3, 'AST'), 'OM': (4, 'GST'),
    'BH': (3, 'AST'), 'PH': (8, 'PHT'), 'ID': (7, 'WIB'), 'TH': (7, 'ICT'),
    'KE': (3, 'EAT'), 'NG': (1, 'WAT'), 'EG': (2, 'EET'), 'TR': (3, 'TRT'),
    'IT': (1, 'CET'), 'ES': (1, 'CET'), 'NL': (1, 'CET'), 'NZ': (12, 'NZST'),
}
TZ_OFFSETS = {
    'GST': 4, 'Dubai': 4, 'UAE': 4, 'IST': 5.5, 'India': 5.5,
    'EST': -5, 'EDT': -4, 'CST': -6, 'CDT': -5, 'PST': -8, 'PDT': -7,
    'GMT': 0, 'UTC': 0, 'BST': 1, 'CET': 1, 'CEST': 2,
    'AEST': 10, 'AEDT': 11, 'JST': 9, 'SGT': 8, 'AST': 3, 'PKT': 5,
}

def convert_timing_for_country(timing: str, src_tz: str, country_code: str) -> tuple:
    """Convert timing string from source timezone to viewer's country timezone.
    Returns (converted_timing, tz_abbr) or (original_timing, src_tz) if same or can't convert."""
    if not timing or not src_tz or not country_code:
        return timing or "", src_tz or ""
    
    viewer = COUNTRY_TZ.get(country_code)
    if not viewer:
        return timing, src_tz
    viewer_offset, viewer_abbr = viewer
    
    # Find source timezone offset
    src_offset = None
    for key, val in TZ_OFFSETS.items():
        if key.upper() in src_tz.upper():
            src_offset = val
            break
    if src_offset is None:
        return timing, src_tz
    
    # Same timezone — return as-is
    if abs(viewer_offset - src_offset) < 0.1:
        return timing, viewer_abbr
    
    # Convert each time part
    parts = re.split(r'\s*[-–—]\s*|\s+to\s+', timing, flags=re.IGNORECASE)
    converted = []
    for p in parts:
        m = re.match(r'(\d{1,2})(?::(\d{2}))?\s*(AM|PM)', p.strip(), re.IGNORECASE)
        if not m:
            continue
        h = int(m.group(1))
        mins = int(m.group(2) or 0)
        ap = m.group(3).upper()
        if ap == 'PM' and h != 12: h += 12
        if ap == 'AM' and h == 12: h = 0
        total_min = (h * 60 + mins) - int(src_offset * 60) + int(viewer_offset * 60)
        total_min = total_min % 1440
        lh = total_min // 60
        lm = total_min % 60
        period = 'PM' if lh >= 12 else 'AM'
        dh = lh % 12 or 12
        converted.append(f"{dh}:{lm:02d} {period}" if lm else f"{dh} {period}")
    
    if converted:
        return " - ".join(converted), viewer_abbr
    return timing, src_tz

async def create_checkout_no_adaptive(stripe_checkout: StripeCheckout, request: CheckoutSessionRequest) -> CheckoutSessionResponse:
    """Create a Stripe checkout session with Adaptive Pricing DISABLED and billing address collection REQUIRED."""
    stripe_lib.api_key = stripe_checkout.api_key
    product_name = request.metadata.get("item_title", "Payment") if request.metadata else "Payment"
    line_items = [{
        "price_data": {
            "currency": request.currency,
            "product_data": {"name": product_name or "Payment"},
            "unit_amount": int(round(request.amount * 100)),
        },
        "quantity": 1,
    }]
    session_params = {
        "line_items": line_items,
        "mode": "payment",
        "success_url": request.success_url,
        "cancel_url": request.cancel_url,
        "metadata": request.metadata or {},
        "adaptive_pricing": {"enabled": False},
        "billing_address_collection": "required",
    }
    if request.payment_methods:
        session_params["payment_method_types"] = request.payment_methods
    # Pre-fill customer email if available
    customer_email = (request.metadata or {}).get("email")
    if customer_email:
        session_params["customer_email"] = customer_email
    session = stripe_lib.checkout.Session.create(**session_params)
    return CheckoutSessionResponse(session_id=session.id, url=session.url)

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/api/payments", tags=["Payments"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')

logger = logging.getLogger(__name__)


async def _get_stripe_key():
    """Get Stripe key from key_manager (MongoDB) with .env fallback."""
    try:
        from key_manager import get_key
        key = await get_key("stripe_api_key")
        return key or STRIPE_API_KEY
    except Exception:
        return STRIPE_API_KEY

CURRENCY_SYMBOLS = {
    'aed': 'AED ', 'usd': '$', 'inr': '₹', 'eur': '€', 'gbp': '£'
}

# Gulf countries for AED pricing
AED_COUNTRIES = {"AE", "SA", "QA", "KW", "OM", "BH"}


async def _run_post_payment_fraud_check(enrollment_id: str, session_id: str, tx: dict, card_country: str = None, billing_country: str = None):
    """Post-payment fraud detection: compare card/billing country vs claimed country.
    Creates a fraud alert if mismatch detected on INR transactions."""
    enrollment = await db.enrollments.find_one({"id": enrollment_id}, {"_id": 0})
    if not enrollment:
        return

    claimed_country = enrollment.get("booker_country", "")
    ip_country = enrollment.get("ip_info", {}).get("country", "")
    currency = tx.get("currency", "")
    amount = tx.get("amount", 0)
    phone = enrollment.get("phone", "")
    browser_tz = enrollment.get("browser_timezone", "")

    # Build fraud signals
    signals = {
        "claimed_country": claimed_country,
        "ip_country": ip_country,
        "card_country": card_country,
        "billing_country": billing_country,
        "phone": phone,
        "browser_timezone": browser_tz,
        "currency_charged": currency,
        "amount_charged": amount,
    }

    # Determine fraud severity
    fraud_reasons = []
    severity = "none"

    # Check 1: Card country mismatch (strongest signal)
    if card_country and claimed_country:
        if claimed_country == "IN" and card_country != "IN":
            fraud_reasons.append(f"Card issued in {card_country}, not India")
            severity = "high"
        elif claimed_country in AED_COUNTRIES and card_country not in AED_COUNTRIES and card_country != "IN":
            fraud_reasons.append(f"Card issued in {card_country}, not Gulf region")
            severity = "medium"

    # Check 2: Billing country mismatch
    if billing_country and claimed_country and billing_country != claimed_country:
        fraud_reasons.append(f"Billing address country ({billing_country}) differs from claimed ({claimed_country})")
        if severity == "none":
            severity = "medium"

    # Check 3: INR payment with non-Indian card (critical)
    if currency == "inr" and card_country and card_country != "IN":
        fraud_reasons.append(f"Paid in INR but card is from {card_country}")
        severity = "critical"

    # Check 4: VPN was detected during enrollment
    if enrollment.get("vpn_blocked"):
        fraud_reasons.append("VPN/Proxy was detected during enrollment")
        if severity in ("none", "low"):
            severity = "medium"

    # Check 5: IP vs card country mismatch
    if card_country and ip_country and card_country != ip_country:
        fraud_reasons.append(f"IP country ({ip_country}) differs from card country ({card_country})")
        if severity == "none":
            severity = "low"

    if not fraud_reasons:
        # No fraud detected — store clean record
        await db.enrollments.update_one(
            {"id": enrollment_id},
            {"$set": {"fraud_status": "clean", "card_country": card_country, "billing_country": billing_country}}
        )
        return

    # Create fraud alert
    alert = {
        "id": str(uuid.uuid4()),
        "enrollment_id": enrollment_id,
        "stripe_session_id": session_id,
        "booker_name": enrollment.get("booker_name", ""),
        "booker_email": enrollment.get("booker_email", ""),
        "severity": severity,
        "reasons": fraud_reasons,
        "signals": signals,
        "status": "new",  # new → reviewed → confirmed_fraud → legitimate
        "admin_notes": "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.fraud_alerts.insert_one(alert)

    # Update enrollment with fraud flag
    await db.enrollments.update_one(
        {"id": enrollment_id},
        {"$set": {
            "fraud_status": "flagged",
            "fraud_severity": severity,
            "card_country": card_country,
            "billing_country": billing_country,
        }}
    )

    # If critical (INR with non-Indian card), block this email from future INR
    if severity == "critical":
        email = enrollment.get("booker_email", "").lower()
        if email:
            await db.fraud_blocklist.update_one(
                {"email": email},
                {"$set": {
                    "email": email,
                    "reason": "; ".join(fraud_reasons),
                    "enrollment_id": enrollment_id,
                    "blocked_at": datetime.now(timezone.utc).isoformat(),
                }},
                upsert=True,
            )

    logger.warning(f"[FRAUD ALERT] enrollment={enrollment_id} severity={severity} reasons={fraud_reasons}")

    # Send email notification to admin for critical/high severity
    if severity in ("critical", "high"):
        try:
            settings = await db.site_settings.find_one({"id": "site_settings"}, {"_id": 0})
            alert_email = (settings or {}).get("fraud_alert_email", "support@divineirishealing.com")
            if alert_email:
                from routes.emails import send_email as _send_email
                severity_label = severity.upper()
                html = f"""
                <div style="font-family: 'Lato', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: {'#dc2626' if severity == 'critical' else '#ea580c'}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                        <h1 style="margin: 0; font-size: 20px;">Fraud Alert — {severity_label}</h1>
                        <p style="margin: 4px 0 0; opacity: 0.9; font-size: 13px;">Enrollment {enrollment_id}</p>
                    </div>
                    <div style="background: #fff; border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
                        <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                            <tr><td style="padding: 6px 0; color: #6b7280;">Name</td><td style="padding: 6px 0; font-weight: 600;">{enrollment.get('booker_name', 'N/A')}</td></tr>
                            <tr><td style="padding: 6px 0; color: #6b7280;">Email</td><td style="padding: 6px 0; font-weight: 600;">{enrollment.get('booker_email', 'N/A')}</td></tr>
                            <tr><td style="padding: 6px 0; color: #6b7280;">Claimed Country</td><td style="padding: 6px 0; font-weight: 600;">{claimed_country}</td></tr>
                            <tr><td style="padding: 6px 0; color: #6b7280;">IP Country</td><td style="padding: 6px 0; font-weight: 600;">{ip_country}</td></tr>
                            <tr><td style="padding: 6px 0; color: #6b7280;">Card Country</td><td style="padding: 6px 0; font-weight: 600; color: #dc2626;">{card_country or 'N/A'}</td></tr>
                            <tr><td style="padding: 6px 0; color: #6b7280;">Billing Country</td><td style="padding: 6px 0; font-weight: 600;">{billing_country or 'N/A'}</td></tr>
                            <tr><td style="padding: 6px 0; color: #6b7280;">Currency Charged</td><td style="padding: 6px 0; font-weight: 600;">{currency.upper()}</td></tr>
                            <tr><td style="padding: 6px 0; color: #6b7280;">Amount</td><td style="padding: 6px 0; font-weight: 600;">{amount}</td></tr>
                            <tr><td style="padding: 6px 0; color: #6b7280;">Phone</td><td style="padding: 6px 0;">{phone or 'N/A'}</td></tr>
                            <tr><td style="padding: 6px 0; color: #6b7280;">Timezone</td><td style="padding: 6px 0;">{browser_tz or 'N/A'}</td></tr>
                        </table>
                        <div style="margin-top: 16px; padding: 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px;">
                            <p style="margin: 0 0 8px; font-weight: 600; color: #991b1b; font-size: 13px;">Reasons:</p>
                            {''.join(f'<p style="margin: 2px 0; font-size: 12px; color: #b91c1c;">• {r}</p>' for r in fraud_reasons)}
                        </div>
                        {f'<p style="margin-top: 12px; font-size: 12px; color: #dc2626; font-weight: 600;">This email has been auto-blocked from INR pricing.</p>' if severity == 'critical' else ''}
                        <p style="margin-top: 16px; font-size: 11px; color: #9ca3af;">Review this alert in Admin Panel → Fraud Detection</p>
                    </div>
                </div>
                """
                import asyncio
                asyncio.create_task(_send_email(alert_email, f"[{severity_label}] Fraud Alert — {enrollment.get('booker_name', 'Unknown')} — {enrollment_id}", html))
        except Exception as e:
            logger.warning(f"Failed to send fraud alert email: {e}")


async def generate_participant_uids(session_id: str):
    """Generate UIDs for all participants in an enrollment linked to this payment."""
    tx = await db.payment_transactions.find_one({"stripe_session_id": session_id}, {"_id": 0})
    if not tx:
        return

    enrollment_id = tx.get("enrollment_id")
    if not enrollment_id:
        return

    enrollment = await db.enrollments.find_one({"id": enrollment_id})
    if not enrollment:
        return

    participants = enrollment.get("participants", [])
    item_title = tx.get("item_title", "Program")
    updated = False

    for i, p in enumerate(participants):
        if not p.get("uid"):
            uid = await generate_uid(db, item_title, p.get("name", "Unknown"))
            participants[i]["uid"] = uid
            updated = True

    if updated:
        await db.enrollments.update_one(
            {"id": enrollment_id},
            {"$set": {"participants": participants}}
        )


async def send_enrollment_emails(session_id: str):
    """Send confirmation email to booker + notification emails to participants who opted in."""
    tx = await db.payment_transactions.find_one({"stripe_session_id": session_id}, {"_id": 0})
    if not tx:
        return
    await _send_receipt_and_notifications(tx)


async def send_enrollment_receipt(txn: dict, database=None):
    """Called from webhook — sends receipt using transaction data."""
    await _send_receipt_and_notifications(txn)


async def _send_receipt_and_notifications(tx):
    """Internal: send receipt + notifications from a transaction dict."""
    enrollment_id = tx.get("enrollment_id")
    if not enrollment_id:
        return

    enrollment = await db.enrollments.find_one({"id": enrollment_id}, {"_id": 0})
    if not enrollment:
        return

    booker_name = enrollment.get("booker_name", "")
    booker_email = enrollment.get("booker_email", "")
    phone = enrollment.get("phone", "")
    participants = enrollment.get("participants", [])
    item_title = tx.get("item_title", "")
    total = tx.get("amount", 0)
    currency = tx.get("currency", "aed")
    symbol = CURRENCY_SYMBOLS.get(currency, currency.upper() + " ")

    # Fetch program links
    program_links = {}
    item_id = tx.get("item_id")
    item_type = tx.get("item_type")
    if item_id and item_type == "program":
        program = await db.programs.find_one({"id": item_id}, {"_id": 0})
        if program:
            if program.get("show_whatsapp_link") and program.get("whatsapp_group_link"):
                program_links["whatsapp_group_link"] = program["whatsapp_group_link"]
            if program.get("show_whatsapp_link_2") and program.get("whatsapp_group_link_2"):
                program_links["whatsapp_group_link_2"] = program["whatsapp_group_link_2"]
            if program.get("show_zoom_link") and program.get("zoom_link"):
                program_links["zoom_link"] = program["zoom_link"]
            if program.get("show_custom_link") and program.get("custom_link"):
                program_links["custom_link"] = program["custom_link"]
                program_links["custom_link_label"] = program.get("custom_link_label", "Link")

    # Fetch social links and community WhatsApp (global)
    settings = await db.site_settings.find_one({"id": "site_settings"}, {"_id": 0})
    settings = settings or {}
    social_links = {k: v for k, v in settings.items() if k.startswith("social_") or k.startswith("show_")}
    community_whatsapp = settings.get("community_whatsapp_link", "")

    # 1. Send booker confirmation (from receipt email)
    program_description = ""
    program_start_date = ""
    program_duration = ""
    program_end_date = ""
    program_timing = ""
    program_timezone = ""
    logo_url = ""
    tier_index = tx.get("tier_index")
    if booker_email:
        if item_id and item_type == "program":
            program = await db.programs.find_one({"id": item_id}, {"_id": 0})
            if program:
                program_description = program.get("description", "")
                # Use tier-specific dates/duration if available
                tiers = program.get("duration_tiers", [])
                if tier_index is not None and tiers and 0 <= tier_index < len(tiers):
                    tier = tiers[tier_index]
                    program_duration = tier.get("label", program.get("duration", ""))
                    program_start_date = tier.get("start_date", program.get("start_date", ""))
                    program_end_date = tier.get("end_date", program.get("end_date", ""))
                else:
                    program_duration = program.get("duration", "")
                    program_start_date = program.get("start_date", "")
                    program_end_date = program.get("end_date", "")
                program_timing = program.get("timing", "") or ""
                program_timezone = program.get("time_zone", "") or ""
        elif item_id and item_type == "session":
            session = await db.sessions.find_one({"id": item_id}, {"_id": 0})
            if session:
                program_description = session.get("description", "")
                program_duration = session.get("duration", "")
                program_timing = session.get("timing", "") or ""
                program_timezone = session.get("time_zone", "") or ""

        # Get receipt template and logo
        from routes.emails import get_receipt_template
        receipt_tpl, logo_path = await get_receipt_template()
        logo_url = ""
        if logo_path:
            host = os.environ.get('BACKEND_URL', '') or os.environ.get('HOST_URL', '')
            logo_url = f"{host}{logo_path}" if logo_path.startswith("/api") else logo_path

    # Fetch social links from settings
        settings = await db.site_settings.find_one({"id": "site_settings"}, {"_id": 0})
        settings = settings or {}
        social_links = {k: v for k, v in settings.items() if k.startswith("social_") or k.startswith("show_")}

        # Get community WhatsApp link (global from site settings)
        community_whatsapp = settings.get("community_whatsapp_link", "")

        # Convert timing to booker's timezone (IP-detected country)
        if program_timing and program_timezone:
            ip_country = enrollment.get("ip_info", {}).get("country", "") or enrollment.get("booker_country", "")
            converted_timing, converted_tz = convert_timing_for_country(program_timing, program_timezone, ip_country)
            program_timing = converted_timing
            program_timezone = converted_tz

        html = enrollment_confirmation_email(
            booker_name=booker_name,
            item_title=item_title,
            participants=participants,
            total=total,
            currency_symbol=symbol,
            attendance_modes=[p.get("attendance_mode", "online") for p in participants],
            booker_email=booker_email,
            phone=phone,
            program_links=program_links,
            program_description=program_description,
            program_start_date=program_start_date,
            program_duration=program_duration,
            program_end_date=program_end_date,
            program_timing=program_timing,
            program_timezone=program_timezone,
            logo_url=logo_url,
            receipt_template=receipt_tpl,
            social_links=social_links,
            community_whatsapp=community_whatsapp,
            footer_phone=settings.get("footer_phone", ""),
            footer_email=settings.get("footer_email", ""),
            site_url="https://divineirishealing.com",
            currency_code=tx.get("currency", ""),
            invoice_number=tx.get("invoice_number", ""),
        )
        from key_manager import get_key
        receipt_sender = await get_key("receipt_email") or os.environ.get("RECEIPT_EMAIL", "receipt@divineirishealing.com")
        await send_email(booker_email, f"Payment Receipt — {item_title} — Divine Iris Healing", html, from_email=receipt_sender)

    # 2. Send participant notifications (everything except receipt)
    # Get original timing for per-participant conversion
    orig_program = await db.programs.find_one({"id": item_id}, {"_id": 0}) if item_id and item_type == "program" else None
    orig_timing = (orig_program.get("timing", "") if orig_program else "") or ""
    orig_tz = (orig_program.get("time_zone", "") if orig_program else "") or ""
    for p in participants:
        if p.get("notify") and p.get("email"):
            # Convert timing to participant's country
            p_timing = program_timing
            p_tz = program_timezone
            p_country = p.get("country", "")
            if p_country and orig_timing and orig_tz:
                p_timing, p_tz = convert_timing_for_country(orig_timing, orig_tz, p_country)
            p_html = participant_notification_email(
                participant_name=p["name"],
                item_title=item_title,
                attendance_mode=p.get("attendance_mode", "online"),
                booker_name=booker_name,
                program_links=program_links,
                program_description=program_description,
                program_start_date=program_start_date,
                program_duration=program_duration,
                program_end_date=program_end_date,
                program_timing=p_timing,
                program_timezone=p_tz,
                logo_url=logo_url,
                social_links=social_links,
                community_whatsapp=community_whatsapp,
            )
            await send_email(p["email"], f"You've Been Enrolled — {item_title}", p_html)

    # Mark emails as sent
    await db.payment_transactions.update_one(
        {"stripe_session_id": tx.get("stripe_session_id")},
        {"$set": {"emails_sent": True, "updated_at": datetime.now(timezone.utc)}}
    )


class CreateCheckoutRequest(BaseModel):
    item_type: str  # "program" or "session"
    item_id: str
    currency: str = "usd"
    origin_url: str


class CheckStatusRequest(BaseModel):
    session_id: str



class CreateSponsorCheckoutRequest(BaseModel):
    name: str
    email: str
    amount: float
    currency: str = "inr"
    message: str = ""
    anonymous: bool = False
    origin_url: str


@router.post("/sponsor-checkout")
async def create_sponsor_checkout(req: CreateSponsorCheckoutRequest, http_request: Request):
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")

    # ── Currency verification ──
    from routes.currency import detect_ip_info, get_base_currency
    ip_country, vpn_detected = await detect_ip_info(http_request)
    server_currency = get_base_currency(ip_country, vpn_detected)
    claimed_currency = (req.currency or "usd").lower()
    if claimed_currency == "inr" and server_currency != "inr":
        raise HTTPException(status_code=403, detail="Currency mismatch — your region does not qualify for INR pricing. Please refresh the page.")

    currency = req.currency.lower()
    origin = req.origin_url.rstrip('/')
    success_url = f"{origin}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/#sponsor"

    host_url = str(http_request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=await _get_stripe_key(), webhook_url=webhook_url)

    checkout_request = CheckoutSessionRequest(
        amount=float(req.amount),
        currency=currency,
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "item_type": "sponsor",
            "donor_name": req.name if not req.anonymous else "Anonymous",
            "donor_email": req.email,
            "message": req.message,
            "anonymous": str(req.anonymous),
            "currency": currency,
        }
    )

    session: CheckoutSessionResponse = await create_checkout_no_adaptive(stripe_checkout, checkout_request)

    transaction = {
        "id": str(uuid.uuid4()),
        "stripe_session_id": session.session_id,
        "item_type": "sponsor",
        "item_id": "sponsor",
        "item_title": "Shine a Light Contribution",
        "amount": float(req.amount),
        "currency": currency,
        "payment_status": "pending",
        "donor_name": req.name,
        "donor_email": req.email,
        "message": req.message,
        "anonymous": req.anonymous,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.payment_transactions.insert_one(transaction)

    return {"url": session.url, "session_id": session.session_id}



@router.post("/create-checkout")
async def create_checkout(req: CreateCheckoutRequest, http_request: Request):
    # ── Currency verification: re-check IP before payment ──
    from routes.currency import detect_ip_info, get_base_currency
    ip_country, vpn_detected = await detect_ip_info(http_request)
    server_currency = get_base_currency(ip_country, vpn_detected)
    claimed_currency = (req.currency or "usd").lower()
    if claimed_currency == "inr" and server_currency != "inr":
        raise HTTPException(status_code=403, detail="Currency mismatch — your region does not qualify for INR pricing. Please refresh the page.")
    if claimed_currency == "aed" and server_currency == "usd":
        raise HTTPException(status_code=403, detail="Currency mismatch — please refresh the page.")

    # Fetch item from DB to get the price (NEVER from frontend)
    if req.item_type == "program":
        item = await db.programs.find_one({"id": req.item_id})
        if not item:
            raise HTTPException(status_code=404, detail="Program not found")
        if not item.get("enrollment_open", True):
            raise HTTPException(status_code=400, detail="Enrollment is not open for this program")
    elif req.item_type == "session":
        item = await db.sessions.find_one({"id": req.item_id})
        if not item:
            raise HTTPException(status_code=404, detail="Session not found")
    else:
        raise HTTPException(status_code=400, detail="Invalid item type")

    # Get price for the requested currency from DB
    currency = req.currency.lower()
    price_field = f"price_{currency}"

    # Check offer price first for programs
    amount = 0.0
    if req.item_type == "program":
        offer_field = f"offer_price_{currency}"
        offer_amount = float(item.get(offer_field, 0))
        if offer_amount > 0:
            amount = offer_amount
        else:
            amount = float(item.get(price_field, 0))
    else:
        amount = float(item.get(price_field, 0))

    if amount <= 0:
        raise HTTPException(status_code=400, detail=f"No price set for currency: {currency}")

    # Build URLs
    origin = req.origin_url.rstrip('/')
    success_url = f"{origin}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/payment/cancel?item_type={req.item_type}&item_id={req.item_id}"

    # Initialize Stripe checkout
    host_url = str(http_request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=await _get_stripe_key(), webhook_url=webhook_url)

    # Create checkout session
    checkout_request = CheckoutSessionRequest(
        amount=float(amount),
        currency=currency,
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "item_type": req.item_type,
            "item_id": req.item_id,
            "item_title": item.get("title", ""),
            "currency": currency,
        }
    )

    session: CheckoutSessionResponse = await create_checkout_no_adaptive(stripe_checkout, checkout_request)

    # Create payment transaction record BEFORE redirect
    transaction = {
        "id": str(uuid.uuid4()),
        "stripe_session_id": session.session_id,
        "item_type": req.item_type,
        "item_id": req.item_id,
        "item_title": item.get("title", ""),
        "amount": float(amount),
        "currency": currency,
        "payment_status": "pending",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.payment_transactions.insert_one(transaction)

    return {"url": session.url, "session_id": session.session_id}


@router.get("/status/{session_id}")
async def check_payment_status(session_id: str, http_request: Request, background_tasks: BackgroundTasks):
    # Check if already processed
    tx = await db.payment_transactions.find_one({"stripe_session_id": session_id})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Fetch program links if available
    program_links = {}
    item_id = tx.get("item_id")
    item_type = tx.get("item_type")
    if item_id and item_type == "program":
        program = await db.programs.find_one({"id": item_id}, {"_id": 0})
        if program:
            if program.get("show_whatsapp_link") and program.get("whatsapp_group_link"):
                program_links["whatsapp_group_link"] = program["whatsapp_group_link"]
            if program.get("show_whatsapp_link_2") and program.get("whatsapp_group_link_2"):
                program_links["whatsapp_group_link_2"] = program["whatsapp_group_link_2"]
            if program.get("show_zoom_link") and program.get("zoom_link"):
                program_links["zoom_link"] = program["zoom_link"]
            if program.get("show_custom_link") and program.get("custom_link"):
                program_links["custom_link"] = program["custom_link"]
                program_links["custom_link_label"] = program.get("custom_link_label", "Link")

    # Get enrollment details for richer response
    enrollment_id = tx.get("enrollment_id")
    participants = []
    booker_name = ""
    booker_email = ""
    if enrollment_id:
        enrollment = await db.enrollments.find_one({"id": enrollment_id}, {"_id": 0})
        if enrollment:
            participants = enrollment.get("participants", [])
            booker_name = enrollment.get("booker_name", "")
            booker_email = enrollment.get("booker_email", "")

    # Fetch community whatsapp from settings
    settings = await db.site_settings.find_one({"id": "site_settings"}, {"_id": 0})
    community_whatsapp = settings.get("community_whatsapp_link", "") if settings else ""

    # If already marked as paid, return immediately (prevent double processing)
    if tx.get("payment_status") == "paid":
        return {
            "status": "complete",
            "payment_status": "paid",
            "amount": tx.get("amount", 0),
            "currency": tx.get("currency", "usd"),
            "item_title": tx.get("item_title", ""),
            "program_links": program_links,
            "community_whatsapp": community_whatsapp,
            "participants": participants,
            "booker_name": booker_name,
            "booker_email": booker_email,
        }

    # Poll Stripe for status
    host_url = str(http_request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=await _get_stripe_key(), webhook_url=webhook_url)

    try:
        status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)

        # Update transaction
        new_status = status.payment_status
        await db.payment_transactions.update_one(
            {"stripe_session_id": session_id},
            {"$set": {
                "payment_status": new_status,
                "updated_at": datetime.now(timezone.utc),
            }}
        )

        # Complete enrollment and send confirmation when payment is newly confirmed
        if new_status == "paid" and not tx.get("emails_sent"):
            try:
                from routes.points_logic import run_post_payment_loyalty

                tx_clean = {k: v for k, v in tx.items() if k != "_id"}
                await run_post_payment_loyalty(db, tx_clean)
            except Exception as e:
                logger.warning(f"Points status-poll loyalty: {e}")

            # Mark enrollment as completed (primary path — webhook is secondary/redundant)
            if enrollment_id:
                await db.enrollments.update_one(
                    {"id": enrollment_id},
                    {"$set": {
                        "status": "completed",
                        "payment_method": "stripe",
                        "paid_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }}
                )
                logger.info(f"Enrollment {enrollment_id} → completed (via status poll)")

            # Mark emails_sent immediately to prevent duplicate receipts on page refresh
            await db.payment_transactions.update_one(
                {"stripe_session_id": session_id},
                {"$set": {"emails_sent": True, "paid_at": datetime.now(timezone.utc).isoformat()}}
            )

            # Extract card country from Stripe for fraud detection
            try:
                stripe_lib.api_key = await _get_stripe_key()
                stripe_session = stripe_lib.checkout.Session.retrieve(
                    session_id, expand=["payment_intent.payment_method"]
                )
                card_country = None
                billing_country = None
                if stripe_session.payment_intent and stripe_session.payment_intent.payment_method:
                    pm = stripe_session.payment_intent.payment_method
                    if hasattr(pm, 'card') and pm.card:
                        card_country = pm.card.country
                    if hasattr(pm, 'billing_details') and pm.billing_details and pm.billing_details.address:
                        billing_country = pm.billing_details.address.country

                # Store card info in transaction
                card_info = {}
                if card_country:
                    card_info["card_country"] = card_country
                if billing_country:
                    card_info["billing_country"] = billing_country
                if card_info:
                    await db.payment_transactions.update_one(
                        {"stripe_session_id": session_id},
                        {"$set": card_info}
                    )

                # Run post-payment fraud check
                if enrollment_id and (card_country or billing_country):
                    await _run_post_payment_fraud_check(
                        enrollment_id, session_id, tx,
                        card_country=card_country,
                        billing_country=billing_country,
                    )
            except Exception as e:
                logger.warning(f"Card country extraction failed for {session_id}: {e}")

            # Generate UIDs for all participants
            await generate_participant_uids(session_id)
            background_tasks.add_task(send_enrollment_emails, session_id)

        # Re-fetch participants after UID generation
        if enrollment_id:
            enrollment = await db.enrollments.find_one({"id": enrollment_id}, {"_id": 0})
            if enrollment:
                participants = enrollment.get("participants", [])

        return {
            "status": status.status,
            "payment_status": new_status,
            "amount": status.amount_total / 100,  # Convert from cents
            "currency": status.currency,
            "item_title": tx.get("item_title", ""),
            "program_links": program_links,
            "community_whatsapp": community_whatsapp,
            "participants": participants,
            "booker_name": booker_name,
            "booker_email": booker_email,
        }
    except Exception as e:
        return {
            "status": "pending",
            "payment_status": "pending",
            "amount": tx.get("amount", 0),
            "currency": tx.get("currency", "usd"),
            "item_title": tx.get("item_title", ""),
            "program_links": program_links,
            "community_whatsapp": community_whatsapp,
            "participants": participants,
            "booker_name": booker_name,
            "booker_email": booker_email,
            "error": str(e),
        }


@router.get("/transactions")
async def get_transactions():
    transactions = await db.payment_transactions.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return transactions
