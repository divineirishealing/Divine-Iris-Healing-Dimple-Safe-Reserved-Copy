from fastapi import APIRouter, UploadFile, File, HTTPException
from pathlib import Path
import shutil
import uuid
import os

router = APIRouter(prefix="/api/upload", tags=["Upload"])

UPLOAD_DIR = Path(__file__).parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
VIDEO_EXTENSIONS = {'.mp4', '.webm', '.mov', '.avi'}
DOCUMENT_EXTENSIONS = {'.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'}
ALL_EXTENSIONS = IMAGE_EXTENSIONS | VIDEO_EXTENSIONS | DOCUMENT_EXTENSIONS
MAX_IMAGE_SIZE = 10 * 1024 * 1024   # 10MB
MAX_VIDEO_SIZE = 100 * 1024 * 1024  # 100MB
MAX_DOC_SIZE = 25 * 1024 * 1024     # 25MB

# ── Cloudinary (optional persistent cloud storage) ──────────────────────────
# Set CLOUDINARY_URL or all three vars in Render environment variables.
# If not set, falls back to local filesystem (ephemeral on Render free tier).
_CLOUDINARY_AVAILABLE = False
try:
    import cloudinary
    import cloudinary.uploader
    cloud_url = os.environ.get("CLOUDINARY_URL", "")
    cloud_name = os.environ.get("CLOUDINARY_CLOUD_NAME", "")
    cloud_key  = os.environ.get("CLOUDINARY_API_KEY", "")
    cloud_sec  = os.environ.get("CLOUDINARY_API_SECRET", "")
    if cloud_url:
        cloudinary.config(cloudinary_url=cloud_url)
        _CLOUDINARY_AVAILABLE = True
    elif cloud_name and cloud_key and cloud_sec:
        cloudinary.config(cloud_name=cloud_name, api_key=cloud_key, api_secret=cloud_sec)
        _CLOUDINARY_AVAILABLE = True
except ImportError:
    pass  # cloudinary not installed — use local fallback


def _upload_to_cloudinary(file_bytes: bytes, filename: str, resource_type: str = "image") -> str:
    """Upload to Cloudinary and return the secure URL."""
    import cloudinary.uploader
    result = cloudinary.uploader.upload(
        file_bytes,
        public_id=f"divine-iris/{Path(filename).stem}",
        resource_type=resource_type,
        overwrite=False,
        unique_filename=True,
    )
    return result["secure_url"]


def _save_locally(file, unique_filename: str) -> str:
    """Save to local uploads dir and return relative API path."""
    file_path = UPLOAD_DIR / unique_filename
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file, buffer)
    return f"/api/image/{unique_filename}"


@router.post("/image")
async def upload_image(file: UploadFile = File(...)):
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type not allowed. Allowed: {', '.join(IMAGE_EXTENSIONS)}")
    try:
        if _CLOUDINARY_AVAILABLE:
            file_bytes = await file.read()
            url = _upload_to_cloudinary(file_bytes, f"{uuid.uuid4()}{file_ext}")
            return {"url": url, "filename": Path(url).name}
        else:
            unique_filename = f"{uuid.uuid4()}{file_ext}"
            url = _save_locally(file.file, unique_filename)
            return {"url": url, "filename": unique_filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")


@router.post("/video")
async def upload_video(file: UploadFile = File(...)):
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in VIDEO_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type not allowed. Allowed: {', '.join(VIDEO_EXTENSIONS)}")
    try:
        if _CLOUDINARY_AVAILABLE:
            file_bytes = await file.read()
            url = _upload_to_cloudinary(file_bytes, f"{uuid.uuid4()}{file_ext}", resource_type="video")
            return {"url": url, "filename": Path(url).name}
        else:
            unique_filename = f"{uuid.uuid4()}{file_ext}"
            url = _save_locally(file.file, unique_filename)
            return {"url": url, "filename": unique_filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")


@router.delete("/image/{filename}")
async def delete_image(filename: str):
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    try:
        file_path.unlink()
        return {"message": "File deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")


@router.post("/document")
async def upload_document(file: UploadFile = File(...)):
    file_ext = Path(file.filename).suffix.lower()
    allowed = DOCUMENT_EXTENSIONS | IMAGE_EXTENSIONS | VIDEO_EXTENSIONS
    if file_ext not in allowed:
        raise HTTPException(status_code=400, detail=f"File type not allowed. Allowed: {', '.join(sorted(allowed))}")
    try:
        if _CLOUDINARY_AVAILABLE and file_ext in IMAGE_EXTENSIONS:
            file_bytes = await file.read()
            url = _upload_to_cloudinary(file_bytes, f"{uuid.uuid4()}{file_ext}")
            return {"url": url, "filename": Path(url).name, "original_name": file.filename}
        else:
            unique_filename = f"{uuid.uuid4()}{file_ext}"
            url = _save_locally(file.file, unique_filename)
            return {"url": url, "filename": unique_filename, "original_name": file.filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
