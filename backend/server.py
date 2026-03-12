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
from routes import programs, sessions, testimonials, stats, newsletter, upload, payments, webhook, currency, site_settings, enrollment, promotions, discounts

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

# Include all route modules (image route MUST be before upload router)
app.include_router(programs.router)
app.include_router(sessions.router)
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

# Include the main router in the app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
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
