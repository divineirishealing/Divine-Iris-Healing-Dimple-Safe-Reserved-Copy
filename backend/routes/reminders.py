"""Abandoned enrollment/cart reminder system.

Checks for enrollments stuck at 'otp_verified' or 'checkout_started' 
and sends reminder emails after 30 min, 24 hours, and 72 hours.
"""
import os, logging
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

logger = logging.getLogger("routes.reminders")

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

REMINDER_SCHEDULE = [
    {"after_minutes": 30, "label": "30min", "subject": "You're almost there! Complete your enrollment"},
    {"after_minutes": 1440, "label": "24hr", "subject": "We saved your spot — complete your enrollment today"},
    {"after_minutes": 4320, "label": "72hr", "subject": "Last chance — your enrollment is waiting for you"},
]


def _build_reminder_html(booker_name, item_title, reminder_label, resume_url, receipt_template=None):
    """Build the reminder email HTML."""
    name = booker_name or "Beautiful Soul"
    tpl = receipt_template or {}
    accent = tpl.get("accent_color", "#D4AF37")
    heading_font = tpl.get("heading_font", "'Playfair Display', serif")

    if reminder_label == "30min":
        headline = "You're So Close!"
        message = f"We noticed you started enrolling for <strong>{item_title}</strong> but didn't complete the payment. Your spot is still reserved — pick up right where you left off."
        cta = "Complete My Enrollment"
        urgency = ""
    elif reminder_label == "24hr":
        headline = "Your Healing Journey Awaits"
        message = f"Hey {name}, just a gentle reminder — your enrollment for <strong>{item_title}</strong> is still waiting. The universe brought you this far for a reason."
        cta = "Resume Enrollment"
        urgency = '<p style="font-size:12px;color:#e74c3c;margin-top:8px;font-weight:600">Spots are limited — don\'t let this opportunity slip away</p>'
    else:
        headline = "Last Gentle Nudge"
        message = f"This is our final reminder about your enrollment for <strong>{item_title}</strong>. We'd love to have you on this transformative journey, {name}."
        cta = "Join Now"
        urgency = '<p style="font-size:12px;color:#e74c3c;margin-top:8px;font-weight:600">This is your last reminder — we won\'t bother you again</p>'

    return f'''<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f1eb;font-family:'Lato',Arial,sans-serif">
<div style="max-width:560px;margin:24px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
  <div style="background:linear-gradient(135deg,#1a0b2e 0%,#2d1b4e 100%);padding:32px 24px;text-align:center">
    <h1 style="font-family:{heading_font};color:{accent};font-size:24px;margin:0">{headline}</h1>
  </div>
  <div style="padding:28px 24px">
    <p style="font-size:15px;color:#333;line-height:1.7;margin:0 0 16px">{message}</p>
    {urgency}
    <div style="text-align:center;margin:24px 0">
      <a href="{resume_url}" style="display:inline-block;background:{accent};color:#fff;text-decoration:none;padding:14px 32px;border-radius:50px;font-weight:600;font-size:14px;font-family:{heading_font}">{cta}</a>
    </div>
    <p style="font-size:12px;color:#999;text-align:center;margin-top:20px">If you have any questions, just reply to this email. We're here for you.</p>
  </div>
  <div style="background:#f8f6f2;padding:16px 24px;text-align:center;border-top:1px solid #eee">
    <p style="font-size:11px;color:#999;margin:0">Divine Iris Healing</p>
  </div>
</div>
</body></html>'''


async def check_and_send_reminders():
    """Check for abandoned enrollments and send reminders.
    Call this periodically (e.g., every 10 minutes).
    """
    now = datetime.now(timezone.utc)
    sent_count = 0

    # Get receipt template for email styling
    settings = await db.site_settings.find_one({"id": "site_settings"}, {"_id": 0, "receipt_template": 1})
    receipt_tpl = (settings or {}).get("receipt_template", {})

    # Find abandoned enrollments
    abandoned_statuses = ["otp_verified", "checkout_started"]
    enrollments = await db.enrollments.find(
        {"status": {"$in": abandoned_statuses}},
        {"_id": 0}
    ).to_list(200)

    for enrollment in enrollments:
        created_at = enrollment.get("created_at")
        if not created_at:
            continue

        # Parse created_at
        if isinstance(created_at, str):
            try:
                created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            except (ValueError, TypeError):
                continue
        if not created_at.tzinfo:
            created_at = created_at.replace(tzinfo=timezone.utc)

        minutes_since = (now - created_at).total_seconds() / 60
        reminders_sent = enrollment.get("reminders_sent", [])
        booker_email = enrollment.get("booker_email", "")
        if not booker_email:
            continue

        # Check each reminder stage
        for reminder in REMINDER_SCHEDULE:
            if minutes_since >= reminder["after_minutes"] and reminder["label"] not in reminders_sent:
                # Build resume URL
                item_type = enrollment.get("item_type", "program")
                item_id = enrollment.get("item_id", "")
                enrollment_id = enrollment.get("id", "")
                site_url = os.environ.get("FRONTEND_URL", "https://divineirishealing.com")
                resume_url = f"{site_url}/enroll/{item_type}/{item_id}?resume={enrollment_id}"

                # Send reminder
                try:
                    from routes.emails import send_email
                    html = _build_reminder_html(
                        enrollment.get("booker_name", ""),
                        enrollment.get("item_title", "your program"),
                        reminder["label"],
                        resume_url,
                        receipt_tpl,
                    )
                    await send_email(
                        to_email=booker_email,
                        subject=reminder["subject"],
                        html=html,
                    )
                    # Mark reminder as sent
                    await db.enrollments.update_one(
                        {"id": enrollment_id},
                        {"$push": {"reminders_sent": reminder["label"]},
                         "$set": {"last_reminder_at": now.isoformat()}}
                    )
                    sent_count += 1
                    logger.info(f"Reminder '{reminder['label']}' sent to {booker_email} for enrollment {enrollment_id}")
                except Exception as e:
                    logger.error(f"Failed to send reminder to {booker_email}: {e}")
                break  # Only send one reminder per check cycle

    return sent_count
