from fastapi import APIRouter, UploadFile, File, HTTPException
from pathlib import Path
import shutil
import uuid
import os
import mimetypes
import logging

import s3_storage

logger = logging.getLogger(__name__)

# ── Ephemeral disk (Render / Railway / etc.) ────────────────────────────────
# Local /api/image/... URLs point at server filesystem, which is wiped on
# redeploy/restart — Mongo still has the path but the bytes are gone. Refuse
# that outcome in production unless ops explicitly opts in.


def _allow_ephemeral_disk_uploads() -> bool:
    return (os.environ.get("ALLOW_EPHEMERAL_UPLOADS") or "").lower() in ("true", "1", "yes")


def _host_uses_ephemeral_disk_by_default() -> bool:
    if _allow_ephemeral_disk_uploads():
        return False
    if (os.environ.get("RENDER") or "").lower() in ("true", "1", "yes"):
        return True
    if (os.environ.get("RAILWAY_ENVIRONMENT") or "").strip():
        return True
    if (os.environ.get("K_SERVICE") or "").strip():  # Cloud Run
        return True
    return False


def _ensure_upload_url_is_durable(url: str) -> None:
    """Raise503 if we would persist only a local API path on an ephemeral host."""
    u = (url or "").strip()
    if not u.startswith("/api/image/"):
        return
    if not _host_uses_ephemeral_disk_by_default():
        return
    raise HTTPException(
        status_code=503,
        detail=(
            "Images cannot be saved to this server’s temporary disk — they are deleted when the service restarts. "
            "Add CLOUDINARY_URL to this API service in your host’s environment (or configure AWS S3 with a public-read bucket), "
            "then redeploy. Open GET /api/upload/storage-status on the API for a diagnostic summary."
        ),
    )


def _return_upload(url: str, fname: str) -> tuple[str, str]:
    _ensure_upload_url_is_durable(url)
    return url, fname

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


def _save_locally_bytes(file_bytes: bytes, unique_filename: str) -> str:
    p = UPLOAD_DIR / unique_filename
    p.write_bytes(file_bytes)
    return f"/api/image/{unique_filename}"


def _s3_put_then_fallback(
    file_bytes: bytes,
    unique_filename: str,
    *,
    s3_key: str,
    cloudinary_resource: str = "image",
    allow_cloudinary: bool = True,
) -> tuple[str, str]:
    """
    Try S3 first when enabled; on any failure use Cloudinary (if allowed+configured) else local disk.
    Returns (url, filename for client).
    """
    if s3_storage.is_s3_enabled():
        try:
            url = s3_storage.upload_bytes(s3_key, file_bytes, _guess_content_type(unique_filename))
            return _return_upload(url, unique_filename)
        except Exception as e:
            logger.warning("S3 upload failed; using fallback: %s", e)
            if _CLOUDINARY_AVAILABLE and allow_cloudinary:
                url = _upload_to_cloudinary(file_bytes, unique_filename, resource_type=cloudinary_resource)
                return _return_upload(url, Path(url).name)
            url = _save_locally_bytes(file_bytes, unique_filename)
            return _return_upload(url, unique_filename)
    if _CLOUDINARY_AVAILABLE and allow_cloudinary:
        url = _upload_to_cloudinary(file_bytes, unique_filename, resource_type=cloudinary_resource)
        return _return_upload(url, Path(url).name)
    url = _save_locally_bytes(file_bytes, unique_filename)
    return _return_upload(url, unique_filename)


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
    ephemeral = _host_uses_ephemeral_disk_by_default()
    s3_on = s3_storage.is_s3_enabled()
    return {
        "image_upload_will_use": _image_upload_backend(),
        "s3_enabled": s3_on,
        "s3_bucket": bucket if bucket else None,
        "aws_region_configured": region,
        "aws_static_access_key_configured": bool(s3_storage.credentials_configured()),
        "aws_s3_use_iam_role": s3_storage.use_iam_role_without_static_keys(),
        "cloudinary_enabled": _CLOUDINARY_AVAILABLE,
        "host_treats_local_disk_as_ephemeral": ephemeral,
        "local_api_image_paths_blocked": ephemeral and not _allow_ephemeral_disk_uploads(),
        "allow_ephemeral_uploads_env_override": _allow_ephemeral_disk_uploads(),
        "hint": "If AWS is incomplete, either fix IAM (s3:PutObject) or set CLOUDINARY_URL on this API — uploads fall back to Cloudinary or local disk when S3 errors. "
        "Easiest fix without AWS: remove AWS_S3_BUCKET and add CLOUDINARY_URL from cloudinary.com, then redeploy. "
        "On Render/Railway, local disk is not persistent — without Cloudinary or working S3, images disappear after restart.",
    }


@router.post("/image")
async def upload_image(file: UploadFile = File(...)):
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type not allowed. Allowed: {', '.join(IMAGE_EXTENSIONS)}")
    try:
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_bytes = await file.read()
        url, fname = _s3_put_then_fallback(
            file_bytes,
            unique_filename,
            s3_key=s3_storage.image_key(unique_filename),
            cloudinary_resource="image",
            allow_cloudinary=True,
        )
        return {"url": url, "filename": fname}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")


@router.post("/video")
async def upload_video(file: UploadFile = File(...)):
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in VIDEO_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type not allowed. Allowed: {', '.join(VIDEO_EXTENSIONS)}")
    try:
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_bytes = await file.read()
        url, fname = _s3_put_then_fallback(
            file_bytes,
            unique_filename,
            s3_key=s3_storage.video_key(unique_filename),
            cloudinary_resource="video",
            allow_cloudinary=True,
        )
        return {"url": url, "filename": fname}
    except HTTPException:
        raise
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
        file_bytes = await file.read()
        use_cdn = file_ext in IMAGE_EXTENSIONS
        url, fname = _s3_put_then_fallback(
            file_bytes,
            unique_filename,
            s3_key=s3_storage.document_key(unique_filename),
            cloudinary_resource="image",
            allow_cloudinary=use_cdn,
        )
        return {"url": url, "filename": fname, "original_name": file.filename}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
