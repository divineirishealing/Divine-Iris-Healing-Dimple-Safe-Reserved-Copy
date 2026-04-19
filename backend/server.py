from fastapi import FastAPI, APIRouter, Request, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
import mimetypes

# Import routes
from routes import programs, sessions, testimonials, stats, newsletter, upload, payments, webhook, currency, site_settings, seo_sitemap, enrollment, promotions, discounts, session_extras, india_payments, notify_me, inbox, clients, text_testimonials, upcoming_card_quotes, search, fraud
from routes import s3_media_proxy
from routes import admin_clients, student, points as points_admin
from routes import auth
from routes import contact_update
from routes.auth import get_current_user
from routes.student import list_student_orders_impl
from routes import subscribers
from routes import emi_payments
from routes import annual_subscribers as annual_subscribers_module
from routes import client_intake as client_intake_module
from routes import reminders as reminders_module
from routes import enrollment_auto_report as enrollment_auto_report_module
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Create uploads directory
UPLOAD_DIR = ROOT_DIR / 'uploads'
UPLOAD_DIR.mkdir(exist_ok=True)

# Initialize mimetypes
mimetypes.init()

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(title="Divine Iris Healing API")


def _public_site_url() -> str:
    """Where the React app is hosted (not this API). Used when users open /manual-payment on Render by mistake."""
    return (
        os.environ.get("PUBLIC_SITE_URL")
        or os.environ.get("FRONTEND_URL")
        or "https://divineirishealing.com"
    ).rstrip("/")


@app.get("/manual-payment")
async def redirect_manual_payment_standalone(request: Request):
    dest = f"{_public_site_url()}/manual-payment"
    if request.url.query:
        dest = f"{dest}?{request.url.query}"
    return RedirectResponse(url=dest, status_code=307)


@app.get("/manual-payment/{enrollment_id}")
async def redirect_manual_payment_enrollment(enrollment_id: str, request: Request):
    dest = f"{_public_site_url()}/manual-payment/{enrollment_id}"
    if request.url.query:
        dest = f"{dest}?{request.url.query}"
    return RedirectResponse(url=dest, status_code=307)


@app.get("/india-payment/{enrollment_id}")
async def redirect_india_payment_page(enrollment_id: str, request: Request):
    dest = f"{_public_site_url()}/india-payment/{enrollment_id}"
    if request.url.query:
        dest = f"{dest}?{request.url.query}"
    return RedirectResponse(url=dest, status_code=307)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Paths that are high-volume file serving — excluded from request logging
_SKIP_LOG_PREFIXES = ("/api/image/", "/api/uploads/", "/api/s3-media/", "/static/", "/api/health")

@app.middleware("http")
async def log_api_requests(request: Request, call_next):
    if any(request.url.path.startswith(p) for p in _SKIP_LOG_PREFIXES):
        return await call_next(request)
    start = time.monotonic()
    response = await call_next(request)
    duration_ms = round((time.monotonic() - start) * 1000)
    try:
        await db.api_logs.insert_one({
            "path": request.url.path,
            "method": request.method,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
            "is_error": response.status_code >= 400,
            "ip": request.client.host if request.client else None,
            "timestamp": datetime.now(timezone.utc),
        })
    except Exception:
        pass
    return response

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Divine Iris Healing API - Welcome!"}


@api_router.get("/health")
async def health():
    """For Render health checks and uptime monitors. Verifies MongoDB is reachable."""
    try:
        await db.command("ping")
        return {"status": "ok", "db": "connected"}
    except Exception:
        return JSONResponse(
            status_code=503,
            content={"status": "error", "db": "unreachable"},
        )


@api_router.get("/student/orders", tags=["Student Dashboard"])
@api_router.get("/student/order-history", tags=["Student Dashboard"])
async def student_orders_list(user: dict = Depends(get_current_user)):
    """Registered on api_router (same mount chain as /api/health) so order history is always reachable."""
    return await list_student_orders_impl(user)


# Custom route to serve uploaded images with correct content type
@app.get("/api/image/{filename}")
async def serve_image(filename: str):
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="File not found")
    
    # Get the mime type
    mime_type, _ = mimetypes.guess_type(str(file_path))
    if mime_type is None:
        mime_type = "application/octet-stream"
    
    return FileResponse(
        path=str(file_path),
        media_type=mime_type,
        headers={
            "Cache-Control": "public, max-age=31536000",
            "Access-Control-Allow-Origin": "*"
        }
    )

@app.get("/api/admin/guide")
async def serve_admin_guide():
    guide_path = ROOT_DIR / "static" / "admin_guide.html"
    if not guide_path.exists():
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Guide not found")
    return FileResponse(path=str(guide_path), media_type="text/html")

# Abandoned enrollment reminders
@app.post("/api/admin/send-reminders")
async def trigger_reminders():
    """Admin: manually trigger abandoned enrollment reminders."""
    count = await reminders_module.check_and_send_reminders()
    return {"message": f"Sent {count} reminders"}

# Background reminder task — runs every 10 minutes
async def _reminder_loop():
    while True:
        await asyncio.sleep(600)  # 10 minutes
        try:
            count = await reminders_module.check_and_send_reminders()
            if count > 0:
                logging.getLogger("reminders").info(f"Auto-sent {count} abandoned enrollment reminders")
        except Exception as e:
            logging.getLogger("reminders").error(f"Reminder loop error: {e}")


async def _enrollment_report_loop():
    """Hourly check: email participant-level enrollment Excel when interval elapsed (see site settings)."""
    while True:
        await asyncio.sleep(3600)
        try:
            n = await enrollment_auto_report_module.maybe_send_enrollment_report(db)
            if n > 0:
                logging.getLogger("enrollment_report").info(f"Enrollment auto-report sent to {n} address(es)")
        except Exception as e:
            logging.getLogger("enrollment_report").error(f"Enrollment report loop error: {e}")


@app.on_event("startup")
async def start_reminder_loop():
    asyncio.create_task(_reminder_loop())


@app.on_event("startup")
async def start_enrollment_report_loop():
    asyncio.create_task(_enrollment_report_loop())

@app.on_event("startup")
async def ensure_api_logs_ttl_index():
    """Create TTL index on api_logs.timestamp for 30-day automatic rollover."""
    await db.api_logs.create_index(
        "timestamp",
        expireAfterSeconds=2592000,
        background=True,
    )

@app.get("/api/uploads/payment_proofs/{filename}")
async def serve_payment_proof(filename: str):
    file_path = UPLOAD_DIR / "payment_proofs" / filename
    if not file_path.exists():
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="File not found")
    mime_type, _ = mimetypes.guess_type(str(file_path))
    return FileResponse(path=str(file_path), media_type=mime_type or "image/png", headers={"Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*"})

# Include all route modules (image route MUST be before upload router)
app.include_router(programs.router)
app.include_router(sessions.router)
app.include_router(session_extras.router)
app.include_router(testimonials.router)
app.include_router(stats.router)
app.include_router(newsletter.router)
app.include_router(upload.router)
app.include_router(s3_media_proxy.router)
app.include_router(payments.router)
app.include_router(webhook.router)
app.include_router(currency.router)
app.include_router(site_settings.router)
app.include_router(seo_sitemap.router)
app.include_router(enrollment.router)
app.include_router(promotions.router)
app.include_router(discounts.router)
app.include_router(india_payments.router)
app.include_router(notify_me.router)
app.include_router(inbox.router)
app.include_router(clients.router)
app.include_router(text_testimonials.router)
app.include_router(upcoming_card_quotes.router)
app.include_router(search.router)
app.include_router(fraud.router)
app.include_router(admin_clients.router)
app.include_router(points_admin.router)
app.include_router(student.router)
app.include_router(auth.router)
app.include_router(contact_update.public_router)
app.include_router(contact_update.admin_router)
app.include_router(subscribers.router)
app.include_router(emi_payments.router)
app.include_router(annual_subscribers_module.router)
app.include_router(client_intake_module.router)
app.include_router(enrollment_auto_report_module.router)

@api_router.get("/admin/api-keys")
async def get_api_keys():
    """Return list of configured API keys for admin display"""
    from key_manager import get_all_keys
    return await get_all_keys()


@api_router.put("/admin/api-keys")
async def update_api_keys(data: dict):
    """Update API keys from admin panel. data = {name: value, ...}"""
    from key_manager import save_all_keys, KEY_DEFINITIONS
    valid_names = {d["name"] for d in KEY_DEFINITIONS}
    to_save = {k: v for k, v in data.items() if k in valid_names}
    await save_all_keys(to_save)
    return {"message": "API keys updated successfully", "updated": list(to_save.keys())}

@api_router.post("/receipt/preview")
async def send_receipt_preview():
    """Send a preview receipt email to admin"""
    from routes.emails import enrollment_confirmation_email, send_email, get_receipt_template
    from key_manager import get_key
    receipt_tpl, logo_path = await get_receipt_template()
    host = os.environ.get('HOST_URL', '')
    logo_url = f"{host}{logo_path}" if logo_path and logo_path.startswith("/api") else (logo_path or "")

    html = enrollment_confirmation_email(
        booker_name="Preview Customer",
        item_title="Sample Healing Program",
        participants=[
            {"name": "Jane Doe", "relationship": "Myself", "attendance_mode": "online", "is_first_time": True, "uid": "SHP-JAN-001", "phone": "+919876543210", "phone_code": "+91", "whatsapp": "9876543210", "wa_code": "+91"},
            {"name": "John Doe", "relationship": "Spouse", "attendance_mode": "online", "is_first_time": False, "uid": "SHP-JOH-002", "referred_by_name": "Dr. Sharma"},
        ],
        total="3,600",
        currency_symbol="INR ",
        attendance_modes=["online", "online"],
        booker_email="preview@example.com",
        phone="+919876543210",
        program_links={"whatsapp_group_link": "https://chat.whatsapp.com/preview", "zoom_link": "https://zoom.us/j/preview"},
        program_description="A transformational journey of deep healing across all layers of being — physical, emotional, mental, and spiritual.",
        program_start_date="March 27th, 2026",
        program_duration="90 days",
        program_end_date="June 25th, 2026",
        program_timing="7:00 PM - 8:30 PM",
        program_timezone="GST (Dubai)",
        logo_url=logo_url,
        receipt_template=receipt_tpl,
    )
    receipt_sender = await get_key("receipt_email") or os.environ.get("RECEIPT_EMAIL", "receipt@divineirishealing.com")
    admin_email = await get_key("smtp_user") or os.environ.get("SMTP_USER", "")
    if admin_email:
        await send_email(admin_email, "Receipt Preview — Divine Iris Healing", html, from_email=receipt_sender)
    return {"sent": True}


# Include the main router in the app
app.include_router(api_router)

_default_origins = (
    "https://divineirishealing.com,"
    "https://www.divineirishealing.com,"
    "https://divine-iris-healing-dimple-safe-res.vercel.app"
)
if os.environ.get("ENVIRONMENT", "production").lower() != "production":
    _default_origins += ",http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000"

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("ALLOWED_ORIGINS", _default_origins).split(",")
    if origin.strip()
]

# Lets browsers on Render / Vercel talk to this API without pasting origins into ALLOWED_ORIGINS.
# Custom domains still need ALLOWED_ORIGINS, e.g. https://yoursite.com
# Set ALLOWED_ORIGINS_REGEX to empty on the server to turn this off.
_cors_regex = os.environ.get(
    "ALLOWED_ORIGINS_REGEX",
    r"https://.+\.onrender\.com\Z|https://.+\.vercel\.app\Z|https://(www\.)?divineirishealing\.com\Z",
)
_cors_mw_kwargs = dict(
    allow_credentials=True,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)
if (_cors_regex or "").strip():
    _cors_mw_kwargs["allow_origin_regex"] = _cors_regex.strip()

app.add_middleware(CORSMiddleware, **_cors_mw_kwargs)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
