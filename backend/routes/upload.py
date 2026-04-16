from fastapi import APIRouter, UploadFile, File, HTTPException
from pathlib import Path
import shutil
import uuid
import os
import mimetypes

import s3_storage

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


def _guess_content_type(filename: str) -> str:
    mime, _ = mimetypes.guess_type(filename)
    return mime or "application/octet-stream"


def _image_upload_backend() -> str:
    if s3_storage.is_s3_enabled():
        return "s3"
    if _CLOUDINARY_AVAILABLE:
        return "cloudinary"
    return "local"


@router.get("/storage-status")
async def upload_storage_status():
    """Which backend image uploads use (no secrets). Open after setting Render env + deploy."""
    bucket = (os.environ.get("AWS_S3_BUCKET") or "").strip()
    region = (
        os.environ.get("AWS_REGION")
        or os.environ.get("AWS_DEFAULT_REGION")
        or "ap-southeast-1"
    )
    return {
        "image_upload_will_use": _image_upload_backend(),
        "s3_enabled": s3_storage.is_s3_enabled(),
        "s3_bucket": bucket if bucket else None,
        "aws_region_configured": region,
        "aws_static_access_key_configured": bool(s3_storage.credentials_configured()),
        "cloudinary_enabled": _CLOUDINARY_AVAILABLE,
        "hint": "If uploads fail: set AWS_S3_BUCKET; IAM user needs AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY (or use an instance/task role). "
        "Policy: s3:PutObject on arn:aws:s3:::BUCKET/*. AWS_REGION must match the bucket. Error detail from POST /api/upload/image includes the S3 code.",
    }


@router.post("/image")
async def upload_image(file: UploadFile = File(...)):
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type not allowed. Allowed: {', '.join(IMAGE_EXTENSIONS)}")
    try:
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        if s3_storage.is_s3_enabled():
            file_bytes = await file.read()
            key = s3_storage.image_key(unique_filename)
            url = s3_storage.upload_bytes(key, file_bytes, _guess_content_type(unique_filename))
            return {"url": url, "filename": unique_filename}
        if _CLOUDINARY_AVAILABLE:
            file_bytes = await file.read()
            url = _upload_to_cloudinary(file_bytes, unique_filename)
            return {"url": url, "filename": Path(url).name}
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
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        if s3_storage.is_s3_enabled():
            file_bytes = await file.read()
            key = s3_storage.video_key(unique_filename)
            url = s3_storage.upload_bytes(key, file_bytes, _guess_content_type(unique_filename))
            return {"url": url, "filename": unique_filename}
        if _CLOUDINARY_AVAILABLE:
            file_bytes = await file.read()
            url = _upload_to_cloudinary(file_bytes, unique_filename, resource_type="video")
            return {"url": url, "filename": Path(url).name}
        url = _save_locally(file.file, unique_filename)
        return {"url": url, "filename": unique_filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")


@router.delete("/image/{filename}")
async def delete_image(filename: str):
    safe_name = Path(filename).name
    if s3_storage.is_s3_enabled():
        key = s3_storage.image_key(safe_name)
        if s3_storage.delete_object_key(key):
            return {"message": "File deleted successfully"}
    file_path = UPLOAD_DIR / safe_name
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
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        if s3_storage.is_s3_enabled():
            file_bytes = await file.read()
            key = s3_storage.document_key(unique_filename)
            url = s3_storage.upload_bytes(key, file_bytes, _guess_content_type(unique_filename))
            return {"url": url, "filename": unique_filename, "original_name": file.filename}
        if _CLOUDINARY_AVAILABLE and file_ext in IMAGE_EXTENSIONS:
            file_bytes = await file.read()
            url = _upload_to_cloudinary(file_bytes, unique_filename)
            return {"url": url, "filename": Path(url).name, "original_name": file.filename}
        url = _save_locally(file.file, unique_filename)
        return {"url": url, "filename": unique_filename, "original_name": file.filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
