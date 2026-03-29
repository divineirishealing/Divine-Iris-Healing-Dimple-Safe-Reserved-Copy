from fastapi import FastAPI, APIRouter
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
import mimetypes

# Import routes
from routes import programs, sessions, testimonials, stats, newsletter, upload, payments, webhook, currency, site_settings, enrollment, promotions, discounts, session_extras, india_payments, notify_me, inbox, clients, text_testimonials, search, fraud
from routes import admin_clients, student
from routes import auth
from routes import subscribers
from routes import emi_payments

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

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Divine Iris Healing API - Welcome!"}

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
app.include_router(payments.router)
app.include_router(webhook.router)
app.include_router(currency.router)
app.include_router(site_settings.router)
app.include_router(enrollment.router)
app.include_router(promotions.router)
app.include_router(discounts.router)
app.include_router(india_payments.router)
app.include_router(notify_me.router)
app.include_router(inbox.router)
app.include_router(clients.router)
app.include_router(text_testimonials.router)
app.include_router(search.router)
app.include_router(fraud.router)
app.include_router(admin_clients.router)
app.include_router(student.router)
app.include_router(auth.router)
app.include_router(subscribers.router)
app.include_router(emi_payments.router)

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

_default_origins = "https://divine-iris-healing-dimple-safe-res.vercel.app"
if os.environ.get("ENVIRONMENT", "production").lower() != "production":
    _default_origins += ",http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000"

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("ALLOWED_ORIGINS", _default_origins).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
