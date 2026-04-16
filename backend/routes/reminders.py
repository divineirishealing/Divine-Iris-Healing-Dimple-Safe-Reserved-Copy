"""Abandoned enrollment / checkout reminders (FOMO nudges).

Sends up to 3 emails per enrollment when someone starts but does not complete payment:
30 min, 24 h, 72 h after enrollment was created.

Covers: profile still in progress (email OTP step), verified but not paid, checkout started.
"""
import os
import logging
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / ".env")

logger = logging.getLogger("routes.reminders")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# Statuses where the user has begun but not completed payment
ABANDONED_STATUSES = [
    "profile_complete",  # submitted details; may be stuck on OTP
    "contact_verified",  # after OTP; on pricing / pay step (incl. cart checkout page)
    "checkout_started",  # Stripe session created, not paid
    "otp_verified",  # legacy alias if any old rows exist
]

REMINDER_SCHEDULE = [
    {
        "after_minutes": 30,
        "label": "30min",
        "subject": "Your seat is still open — don’t leave your transformation hanging",
    },
    {
        "after_minutes": 1440,
        "label": "24hr",
        "subject": "Others are moving forward — reclaim your spot today",
    },
    {
        "after_minutes": 4320,
        "label": "72hr",
        "subject": "Final nudge: this portal won’t chase you again",
    },
]


def _resume_url(enrollment: dict) -> str:
    """Deep link back into /enroll/{type}/{id}?resume=… when we know the offering."""
    site = (
        os.environ.get("FRONTEND_URL")
        or os.environ.get("HOST_URL", "").replace("/api", "").rstrip("/")
        or "https://divineirishealing.com"
    )
    site = site.rstrip("/")
    eid = enrollment.get("id") or ""
    item_type = (enrollment.get("item_type") or "program").strip() or "program"
    item_id = (enrollment.get("item_id") or "").strip()

    if not item_id:
        for p in enrollment.get("participants") or []:
            if isinstance(p, dict) and p.get("program_id"):
                item_id = str(p["program_id"]).strip()
                item_type = "program"
                break

    if item_id and eid:
        return f"{site}/enroll/{item_type}/{item_id}?resume={eid}"
    if eid:
        return f"{site}/programs?utm_resume={eid}"
    return f"{site}/programs"


def _build_reminder_html(booker_name, item_title, reminder_label, resume_url, receipt_template=None):
    name = (booker_name or "there").split()[0] if booker_name else "there"
    tpl = receipt_template or {}
    accent = tpl.get("accent_color", "#D4AF37")
    heading_font = tpl.get("heading_font", "'Playfair Display', serif")
    title = item_title or "your chosen journey"

    if reminder_label == "30min":
        headline = "You’re one step away"
        message = (
            f"Hi {name}, you began enrolling for <strong>{title}</strong> — and we held the energy open for you. "
            f"Sacred containers don’t stay open forever; when you’re ready, complete your registration in one go."
        )
        fomo = (
            '<p style="font-size:13px;color:#7c3aed;line-height:1.6;margin:16px 0 0;font-weight:600">'
            "Spots in this journey are limited — the ones who return soon often say they felt nudged to come back.</p>"
        )
        cta = "Complete my enrollment"
    elif reminder_label == "24hr":
        headline = "Still thinking about it?"
        message = (
            f"{name}, your path toward <strong>{title}</strong> is still waiting. "
            f"While you pause, others are saying yes to the same transformation — not to pressure you, "
            f"but because this work moves quickly when the collective is ready."
        )
        fomo = (
            '<p style="font-size:13px;color:#b45309;line-height:1.6;margin:16px 0 0;font-weight:600">'
            "Cohorts fill in waves. If this speaks to you, coming back now keeps you aligned with the current opening.</p>"
        )
        cta = "Reclaim my spot"
    else:
        headline = "Last invitation from us"
        message = (
            f"This is our final note about <strong>{title}</strong>, {name}. "
            f"We won't flood your inbox — we'd rather you choose consciously than wonder 'what if.' "
            f"If it's a no, we honour that. If it's a yes, the door is still here for a little longer."
        )
        fomo = (
            "<p style=\"font-size:13px;color:#991b1b;line-height:1.6;margin:16px 0 0;font-weight:600\">"
            "This is the last automated reminder — after this, the moment passes until you return on your own.</p>"
        )
        cta = "I’m ready — continue"

    return f"""<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f1eb;font-family:'Lato',Arial,sans-serif">
<div style="max-width:560px;margin:24px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
  <div style="background:linear-gradient(135deg,#1a0b2e 0%,#2d1b4e 100%);padding:32px 24px;text-align:center">
    <h1 style="font-family:{heading_font};color:{accent};font-size:22px;margin:0;line-height:1.3">{headline}</h1>
  </div>
  <div style="padding:28px 24px">
    <p style="font-size:15px;color:#333;line-height:1.75;margin:0 0 12px">{message}</p>
    {fomo}
    <div style="text-align:center;margin:26px 0">
      <a href="{resume_url}" style="display:inline-block;background:{accent};color:#1a0a2e;text-decoration:none;padding:14px 32px;border-radius:50px;font-weight:700;font-size:14px;font-family:{heading_font}">{cta}</a>
    </div>
    <p style="font-size:12px;color:#888;text-align:center;margin-top:8px;line-height:1.5">If the button doesn’t work, copy this link into your browser:<br/><span style="word-break:break-all;color:#6b21a8">{resume_url}</span></p>
    <p style="font-size:12px;color:#999;text-align:center;margin-top:20px">Questions? Just reply — a human reads these.</p>
  </div>
  <div style="background:#f8f6f2;padding:16px 24px;text-align:center;border-top:1px solid #eee">
    <p style="font-size:11px;color:#999;margin:0">Divine Iris Healing</p>
  </div>
</div>
</body></html>"""


async def check_and_send_reminders():
    """Check for abandoned enrollments and send one reminder stage per run. Call every ~10 minutes."""
    now = datetime.now(timezone.utc)
    sent_count = 0

    settings = await db.site_settings.find_one({"id": "site_settings"}, {"_id": 0, "receipt_template": 1})
    receipt_tpl = (settings or {}).get("receipt_template", {})

    enrollments = await db.enrollments.find(
        {"status": {"$in": ABANDONED_STATUSES}},
        {"_id": 0},
    ).to_list(500)

    for enrollment in enrollments:
        created_at = enrollment.get("created_at")
        if not created_at:
            continue

        if isinstance(created_at, str):
            try:
                created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            except (ValueError, TypeError):
                continue
        if not created_at.tzinfo:
            created_at = created_at.replace(tzinfo=timezone.utc)

        minutes_since = (now - created_at).total_seconds() / 60
        reminders_sent = enrollment.get("reminders_sent", []) or []
        booker_email = (enrollment.get("booker_email") or "").strip()
        if not booker_email:
            continue

        enrollment_id = enrollment.get("id", "")
        resume_url = _resume_url(enrollment)
        item_title = enrollment.get("item_title") or "your program"

        for reminder in REMINDER_SCHEDULE:
            if minutes_since >= reminder["after_minutes"] and reminder["label"] not in reminders_sent:
                try:
                    from routes.emails import send_email

                    html = _build_reminder_html(
                        enrollment.get("booker_name", ""),
                        item_title,
                        reminder["label"],
                        resume_url,
                        receipt_tpl,
                    )
                    result = await send_email(
                        booker_email,
                        reminder["subject"],
                        html,
                    )
                    if result:
                        await db.enrollments.update_one(
                            {"id": enrollment_id},
                            {
                                "$push": {"reminders_sent": reminder["label"]},
                                "$set": {"last_reminder_at": now.isoformat()},
                            },
                        )
                        sent_count += 1
                        logger.info(
                            "Reminder '%s' sent to %s for enrollment %s",
                            reminder["label"],
                            booker_email,
                            enrollment_id,
                        )
                    else:
                        logger.warning("Reminder email not delivered to %s (mail not configured?)", booker_email)
                except Exception as e:
                    logger.error("Failed to send reminder to %s: %s", booker_email, e)
                break

    return sent_count
