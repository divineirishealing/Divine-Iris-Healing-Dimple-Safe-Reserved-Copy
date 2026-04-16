"""Scheduled email: participant-level enrollment Excel (same data as Admin → Enrollments → By participant)."""
import logging
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / ".env")

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/enrollment-report", tags=["Enrollment auto-report"])

mongo_url = os.environ["MONGO_URL"]
_client = AsyncIOMotorClient(mongo_url)
db = _client[os.environ["DB_NAME"]]


async def maybe_send_enrollment_report(db) -> int:
    """
    If enabled and interval elapsed, build Excel and email all configured addresses.
    Returns number of successful sends.
    """
    settings = await db.site_settings.find_one({"id": "site_settings"}, {"_id": 0})
    if not settings or not settings.get("enrollment_auto_report_enabled"):
        return 0

    emails_raw = (settings.get("enrollment_auto_report_emails") or "").strip()
    if not emails_raw:
        logger.warning("enrollment_auto_report_enabled but enrollment_auto_report_emails is empty")
        return 0

    interval = int(settings.get("enrollment_auto_report_interval_hours") or 24)
    interval = max(6, min(168, interval))
    paid_only = settings.get("enrollment_auto_report_paid_only", True)

    now = datetime.now(timezone.utc)
    last = settings.get("enrollment_auto_report_last_sent_at") or ""
    if last:
        try:
            last_dt = datetime.fromisoformat(last.replace("Z", "+00:00"))
            if now - last_dt < timedelta(hours=interval):
                return 0
        except Exception:
            pass

    from routes.india_payments import build_participant_report_xlsx_bytes

    try:
        xlsx = await build_participant_report_xlsx_bytes(paid_completed_only=paid_only)
    except RuntimeError as e:
        logger.error(f"Enrollment report Excel build failed: {e}")
        return 0
    except Exception as e:
        logger.error(f"Enrollment report Excel build failed: {e}")
        return 0

    recipients = [e.strip() for e in emails_raw.split(",") if e.strip()]
    from routes.emails import send_email_with_attachment

    subject = f"Enrollment report — {now.strftime('%Y-%m-%d %H:%M UTC')}"
    html = f"""<!DOCTYPE html><html><body style="font-family:Georgia,serif">
<p>Automated <strong>participant-level</strong> enrollment export.</p>
<p>Paid / completed only: <strong>{'yes' if paid_only else 'no'}</strong> · Recipients: <strong>{len(recipients)}</strong>.</p>
<p style="color:#666;font-size:12px">Same data as Admin → Enrollments → By participant.</p>
</body></html>"""

    ok = 0
    for to in recipients:
        try:
            r = await send_email_with_attachment(
                to,
                subject,
                html,
                f"enrollments_by_participant_{now.strftime('%Y%m%d_%H%M')}.xlsx",
                xlsx,
            )
            if r:
                ok += 1
        except Exception as e:
            logger.error(f"Enrollment report email failed for {to}: {e}")

    if ok > 0:
        await db.site_settings.update_one(
            {"id": "site_settings"},
            {"$set": {"enrollment_auto_report_last_sent_at": now.isoformat()}},
        )
    return ok


@router.post("/send-now")
async def send_enrollment_report_now():
    """
    Send the participant Excel immediately to all addresses in settings (for testing).
    Does not require the schedule to be enabled; still requires non-empty email list.
    """
    settings = await db.site_settings.find_one({"id": "site_settings"}, {"_id": 0})
    emails_raw = (settings or {}).get("enrollment_auto_report_emails") or ""
    emails_raw = emails_raw.strip()
    if not emails_raw:
        raise HTTPException(status_code=400, detail="Set enrollment report emails in Admin → Enrollments first")

    paid_only = (settings or {}).get("enrollment_auto_report_paid_only", True)
    from routes.india_payments import build_participant_report_xlsx_bytes
    from routes.emails import send_email_with_attachment

    try:
        xlsx = await build_participant_report_xlsx_bytes(paid_completed_only=paid_only)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    now = datetime.now(timezone.utc)
    recipients = [e.strip() for e in emails_raw.split(",") if e.strip()]
    subject = f"[Test] Enrollment report — {now.strftime('%Y-%m-%d %H:%M UTC')}"
    html = f"""<!DOCTYPE html><html><body style="font-family:Georgia,serif">
<p>Manual <strong>send now</strong> from admin.</p>
<p>Paid / completed only: <strong>{'yes' if paid_only else 'no'}</strong>.</p>
</body></html>"""

    sent = 0
    errors = []
    for to in recipients:
        try:
            r = await send_email_with_attachment(
                to,
                subject,
                html,
                f"enrollments_by_participant_{now.strftime('%Y%m%d_%H%M')}.xlsx",
                xlsx,
            )
            if r:
                sent += 1
            else:
                errors.append(to)
        except Exception as e:
            errors.append(f"{to}: {e}")

    return {
        "message": f"Sent to {sent} of {len(recipients)} address(es)",
        "sent": sent,
        "failed": errors,
    }
