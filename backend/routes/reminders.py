"""Abandoned enrollment reminders and registration-deadline nudges.

- Abandonment (programs only when registration is open): first nudge after 15 minutes from
  enrollment start; then at most once every 3 days.
- Deadline: one email ~1 hour before registration closes, and one ~10 minutes before
  (program deadline_date / start_date, or session last available date).

Call check_and_send_reminders periodically (e.g. every 10 minutes).
"""
import os
import logging
from datetime import datetime, timezone, timedelta
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
    "profile_complete",
    "contact_verified",
    "checkout_started",
    "otp_verified",
]

# Wait this long after enrollment start before the first abandonment email can send
ABANDON_MINUTES_AFTER_START = 15
# Minimum time between abandonment emails (same enrollment)
ABANDON_COOLDOWN_HOURS = 72  # 3 days

# Minutes before registration close; slack so a ~10-minute cron still catches the window
DEADLINE_1H_TARGET_MIN = 60
DEADLINE_10M_TARGET_MIN = 10
DEADLINE_1H_SLACK_MIN = 12
DEADLINE_10M_SLACK_MIN = 6

DEADLINE_1H_LABEL = "deadline_1h"
DEADLINE_10M_LABEL = "deadline_10m"


def _parse_dt(val) -> datetime | None:
    if not val:
        return None
    if isinstance(val, datetime):
        dt = val
    else:
        s = str(val).strip().replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(s)
        except (ValueError, TypeError):
            return None
    if not dt.tzinfo:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _registration_close_utc(item: dict | None, item_type: str) -> datetime | None:
    """End of registration moment in UTC for reminder scheduling."""
    if not item:
        return None
    item_type = (item_type or "program").strip().lower()

    if item_type == "session":
        dates = item.get("available_dates") or []
        if not dates:
            return None
        try:
            last_day = max(str(d) for d in dates)
        except (TypeError, ValueError):
            return None
        if "T" in last_day:
            return _parse_dt(last_day)
        try:
            return datetime.fromisoformat(f"{last_day}T23:59:59+00:00")
        except (ValueError, TypeError):
            return None

    deadline = (item.get("deadline_date") or item.get("start_date") or "").strip()
    if not deadline:
        return None
    if "T" in deadline:
        return _parse_dt(deadline)
    try:
        return datetime.fromisoformat(deadline + "T23:59:59+00:00")
    except (ValueError, TypeError):
        return None


def _program_registration_still_open(program: dict) -> bool:
    if not program:
        return False
    if program.get("enrollment_open") is False:
        return False
    if (program.get("enrollment_status") or "").lower() == "closed":
        return False
    return True


async def _load_item_for_enrollment(enrollment: dict) -> tuple[dict | None, str]:
    item_type = (enrollment.get("item_type") or "program").strip() or "program"
    item_id = (enrollment.get("item_id") or "").strip()
    if not item_id:
        for p in enrollment.get("participants") or []:
            if isinstance(p, dict) and p.get("program_id"):
                item_id = str(p["program_id"]).strip()
                item_type = "program"
                break
    if not item_id:
        return None, item_type
    coll = "sessions" if item_type == "session" else "programs"
    item = await db[coll].find_one({"id": item_id}, {"_id": 0})
    return item, item_type


def _resume_url(enrollment: dict) -> str:
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


def _build_reminder_html(
    booker_name,
    item_title,
    reminder_label,
    resume_url,
    receipt_template=None,
    *,
    deadline_human: str | None = None,
):
    name = (booker_name or "there").split()[0] if booker_name else "there"
    tpl = receipt_template or {}
    accent = tpl.get("accent_color", "#D4AF37")
    heading_font = tpl.get("heading_font", "'Playfair Display', serif")
    title = item_title or "your chosen journey"
    dh = deadline_human or ""

    if reminder_label == DEADLINE_10M_LABEL:
        headline = "Registration is closing now"
        message = (
            f"{name}, <strong>{title}</strong> is about to close for registration"
            f"{(' — ' + dh) if dh else ''}. "
            f"If you’re coming in, please complete your enrollment in the next few minutes."
        )
        fomo = (
            '<p style="font-size:13px;color:#991b1b;line-height:1.6;margin:16px 0 0;font-weight:600">'
            "This is the last automated nudge before the window shuts.</p>"
        )
        cta = "Complete registration now"
        subject = f"Closing now — {title}"
    elif reminder_label == DEADLINE_1H_LABEL:
        headline = "About an hour left to register"
        message = (
            f"{name}, registration for <strong>{title}</strong> closes in roughly an hour"
            f"{(' (' + dh + ')') if dh else ''}. "
            f"If you meant to join, this is a good time to finish."
        )
        fomo = (
            '<p style="font-size:13px;color:#b45309;line-height:1.6;margin:16px 0 0;font-weight:600">'
            "After it closes, you may need to wait for the next opening.</p>"
        )
        cta = "Finish enrollment"
        subject = f"1 hour left — {title}"
    else:
        headline = "You’re almost there"
        message = (
            f"Hi {name}, you started enrolling for <strong>{title}</strong> but haven’t finished yet. "
            f"When you’re ready, you can pick up right where you left off."
        )
        fomo = (
            '<p style="font-size:13px;color:#7c3aed;line-height:1.6;margin:16px 0 0;font-weight:600">'
            "Sacred spaces don’t stay open indefinitely — completing soon keeps you aligned with the current wave.</p>"
        )
        cta = "Continue my enrollment"
        subject = f"Still interested in {title}?"

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


def _minutes_before_close(now: datetime, close_dt: datetime) -> float:
    return (close_dt - now).total_seconds() / 60.0


def _in_deadline_window(minutes_before: float, target: float, slack: float) -> bool:
    return abs(minutes_before - target) <= slack


async def _send_one(
    enrollment_id: str,
    booker_email: str,
    subject: str,
    html: str,
    now: datetime,
    *,
    set_last_abandon: bool = False,
    reminder_label: str | None = None,
) -> bool:
    from routes.emails import send_email

    result = await send_email(booker_email, subject, html)
    if not result:
        logger.warning("Reminder email not delivered to %s (mail not configured?)", booker_email)
        return False
    update: dict = {"$set": {"last_reminder_at": now.isoformat()}}
    if set_last_abandon:
        update["$set"]["last_abandon_reminder_at"] = now.isoformat()
    if reminder_label:
        update["$push"] = {"reminders_sent": reminder_label}
    await db.enrollments.update_one({"id": enrollment_id}, update)
    return True


async def check_and_send_reminders():
    """Send at most one actionable reminder per enrollment per run (priority: 10m deadline, 1h deadline, abandon)."""
    now = datetime.now(timezone.utc)
    sent_count = 0

    settings = await db.site_settings.find_one({"id": "site_settings"}, {"_id": 0, "receipt_template": 1})
    receipt_tpl = (settings or {}).get("receipt_template", {})

    enrollments = await db.enrollments.find(
        {"status": {"$in": ABANDONED_STATUSES}},
        {"_id": 0},
    ).to_list(500)

    for enrollment in enrollments:
        booker_email = (enrollment.get("booker_email") or "").strip()
        if not booker_email:
            continue

        enrollment_id = enrollment.get("id", "")
        resume_url = _resume_url(enrollment)
        item_title = enrollment.get("item_title") or "your program"
        reminders_sent = enrollment.get("reminders_sent", []) or []

        created_at = enrollment.get("created_at")
        if created_at:
            created_at = _parse_dt(created_at)
        if not created_at:
            continue

        minutes_since_start = (now - created_at).total_seconds() / 60.0

        item, item_type = await _load_item_for_enrollment(enrollment)
        if item and item_type != "session" and not _program_registration_still_open(item):
            item = None

        close_dt = _registration_close_utc(item, item_type)
        deadline_human = ""
        if close_dt and item:
            if item_type == "session":
                deadline_human = f"last listed date {close_dt.date().isoformat()}"
            else:
                d = (item.get("deadline_date") or item.get("start_date") or "").strip()
                deadline_human = d or close_dt.date().isoformat()

        # --- Priority 1: ~10 minutes before close ---
        if (
            close_dt
            and now < close_dt
            and DEADLINE_10M_LABEL not in reminders_sent
            and _in_deadline_window(
                _minutes_before_close(now, close_dt),
                DEADLINE_10M_TARGET_MIN,
                DEADLINE_10M_SLACK_MIN,
            )
        ):
            html = _build_reminder_html(
                enrollment.get("booker_name", ""),
                item_title,
                DEADLINE_10M_LABEL,
                resume_url,
                receipt_tpl,
                deadline_human=deadline_human or None,
            )
            try:
                if await _send_one(
                    enrollment_id,
                    booker_email,
                    f"Closing now — {item_title}",
                    html,
                    now,
                    reminder_label=DEADLINE_10M_LABEL,
                ):
                    sent_count += 1
                    logger.info("Reminder '%s' sent to %s for enrollment %s", DEADLINE_10M_LABEL, booker_email, enrollment_id)
            except Exception as e:
                logger.error("Failed to send reminder to %s: %s", booker_email, e)
            continue

        # --- Priority 2: ~1 hour before close ---
        if (
            close_dt
            and now < close_dt
            and DEADLINE_1H_LABEL not in reminders_sent
            and _in_deadline_window(
                _minutes_before_close(now, close_dt),
                DEADLINE_1H_TARGET_MIN,
                DEADLINE_1H_SLACK_MIN,
            )
        ):
            html = _build_reminder_html(
                enrollment.get("booker_name", ""),
                item_title,
                DEADLINE_1H_LABEL,
                resume_url,
                receipt_tpl,
                deadline_human=deadline_human or None,
            )
            try:
                if await _send_one(
                    enrollment_id,
                    booker_email,
                    f"1 hour left — {item_title}",
                    html,
                    now,
                    reminder_label=DEADLINE_1H_LABEL,
                ):
                    sent_count += 1
                    logger.info("Reminder '%s' sent to %s for enrollment %s", DEADLINE_1H_LABEL, booker_email, enrollment_id)
            except Exception as e:
                logger.error("Failed to send reminder to %s: %s", booker_email, e)
            continue

        # No abandonment emails after registration has ended (when we can compute a close time)
        if close_dt and now >= close_dt:
            continue

        # Abandonment nudges for programs: only while registration is still open (skip closed/missing program)
        if (item_type or "program").strip().lower() == "program":
            if item is None or not _program_registration_still_open(item):
                continue

        # --- Priority 3: abandonment (max once per 3 days for programs still open) ---
        last_ab = enrollment.get("last_abandon_reminder_at")
        last_ab_dt = _parse_dt(last_ab) if last_ab else None
        cooldown_ok = True
        if last_ab_dt:
            cooldown_ok = (now - last_ab_dt) >= timedelta(hours=ABANDON_COOLDOWN_HOURS)

        if minutes_since_start >= ABANDON_MINUTES_AFTER_START and cooldown_ok:
            html = _build_reminder_html(
                enrollment.get("booker_name", ""),
                item_title,
                "abandon",
                resume_url,
                receipt_tpl,
            )
            try:
                if await _send_one(
                    enrollment_id,
                    booker_email,
                    f"Still interested in {item_title}?",
                    html,
                    now,
                    set_last_abandon=True,
                ):
                    sent_count += 1
                    logger.info("Abandon reminder sent to %s for enrollment %s", booker_email, enrollment_id)
            except Exception as e:
                logger.error("Failed to send abandon reminder to %s: %s", booker_email, e)

    return sent_count
