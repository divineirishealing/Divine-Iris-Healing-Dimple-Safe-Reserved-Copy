from fastapi import APIRouter, UploadFile, File, HTTPException
from pathlib import Path
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
    if not (u.startswith("/api/image/") or u.startswith("/api/uploads/")):
        return
    if not _host_uses_ephemeral_disk_by_default():
        return
    raise HTTPException(
        status_code=503,
        detail=(
            "Images cannot be saved to this server’s temporary disk — they are deleted when the service restarts. "
            "Configure AWS S3 on this API (AWS_S3_BUCKET, credentials or IAM role, AWS_REGION matching the bucket), "
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


def _save_locally_bytes(file_bytes: bytes, unique_filename: str) -> str:
    p = UPLOAD_DIR / unique_filename
    p.write_bytes(file_bytes)
    return f"/api/image/{unique_filename}"


def _s3_put_then_fallback(
    file_bytes: bytes,
    unique_filename: str,
    *,
    s3_key: str,
) -> tuple[str, str]:
    """
    Try S3 when enabled; on failure fall back to local disk unless REQUIRE_S3_FOR_UPLOADS.
    Returns (url, filename for client).
    """
    must_s3 = s3_storage.media_must_use_s3()
    if must_s3 and not s3_storage.is_s3_enabled():
        raise HTTPException(
            status_code=503,
            detail=(
                "REQUIRE_S3_FOR_UPLOADS is enabled but S3 is not fully configured. "
                "Set AWS_S3_BUCKET, AWS_REGION (bucket region), and credentials or AWS_S3_USE_IAM_ROLE, then redeploy. "
                "Open GET /api/upload/storage-status for a diagnostic summary."
            ),
        )
    if s3_storage.is_s3_enabled():
        try:
            url = s3_storage.upload_bytes(s3_key, file_bytes, _guess_content_type(unique_filename))
            return _return_upload(url, unique_filename)
        except Exception as e:
            if must_s3:
                logger.warning("S3 upload failed; REQUIRE_S3_FOR_UPLOADS disallows fallback: %s", e)
                raise HTTPException(
                    status_code=503,
                    detail=f"S3 upload failed (no fallback allowed): {e}",
                ) from e
            if _host_uses_ephemeral_disk_by_default():
                logger.warning("S3 upload failed; ephemeral host cannot use local disk: %s", e)
                raise HTTPException(
                    status_code=503,
                    detail=(
                        f"S3 upload failed (images cannot be stored on this server’s disk): {e}. "
                        "Fix IAM (s3:PutObject on your prefix), bucket region = AWS_REGION, and credentials. "
                        "GET /api/upload/storage-status"
                    ),
                ) from e
            logger.warning("S3 upload failed; using local disk: %s", e)
            url = _save_locally_bytes(file_bytes, unique_filename)
            return _return_upload(url, unique_filename)
    if _host_uses_ephemeral_disk_by_default():
        raise HTTPException(
            status_code=503,
            detail=(
                "S3 is not enabled on this API (missing bucket or credentials), and this host cannot store "
                "uploads on disk. Set AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION "
                "on the Render **backend** service (not the Vercel frontend), redeploy, then try again. "
                "GET /api/upload/storage-status"
            ),
        )
    url = _save_locally_bytes(file_bytes, unique_filename)
    return _return_upload(url, unique_filename)


def _guess_content_type(filename: str) -> str:
    mime, _ = mimetypes.guess_type(filename)
    return mime or "application/octet-stream"


def _image_upload_backend() -> str:
    if s3_storage.media_must_use_s3():
        return "s3" if s3_storage.is_s3_enabled() else "blocked_require_s3"
    if s3_storage.is_s3_enabled():
        return "s3"
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
    require_s3 = s3_storage.media_must_use_s3()
    host_u = (os.environ.get("HOST_URL") or "").strip().rstrip("/")
    if s3_on:
        mode = (os.environ.get("S3_URL_FOR_BROWSER") or "direct").strip().lower()
        if mode in ("api", "proxy", "backend"):
            if not host_u:
                plain = (
                    "S3_URL_FOR_BROWSER=api but HOST_URL is empty — set HOST_URL on Render to this API’s https address "
                    "(copy from the service URL in Render), redeploy, then upload again."
                )
            else:
                plain = (
                    "Easy mode: images are served through this API (/api/s3-media/...). You do NOT need to make the S3 "
                    "bucket public. Ensure your IAM user has s3:GetObject on your uploads folder (same user as PutObject)."
                )
        else:
            plain = (
                "New uploads use direct S3 HTTPS links. If images do not show, either make the bucket publicly readable "
                "for uploads/* (AWS S3 bucket policy) or switch S3_URL_FOR_BROWSER=api and set HOST_URL."
            )
    elif ephemeral:
        plain = "S3 is not active on this server — new uploads use temporary disk and can vanish after restart. Check bucket name, region, and API keys on the backend host, then redeploy."
    else:
        plain = "New uploads are saved on this computer’s disk (fine for local development)."
    mode_out = (os.environ.get("S3_URL_FOR_BROWSER") or "direct").strip().lower()
    s3_pref = (os.environ.get("AWS_S3_PREFIX") or "uploads").strip().strip("/")
    checklist = []
    if s3_on and mode_out in ("api", "proxy", "backend"):
        checklist = [
            f"Render: HOST_URL must be your API base, e.g. https://your-service.onrender.com (currently: {host_u or 'NOT SET — fix this'})",
            f"AWS IAM: allow s3:GetObject and s3:PutObject on arn:aws:s3:::{bucket or 'YOUR_BUCKET'}/{s3_pref}/*",
            "Vercel: REACT_APP_BACKEND_URL must match that same API base; redeploy frontend after changes.",
        ]
    return {
        "simple": plain,
        "your_next_steps": checklist,
        "image_upload_will_use": _image_upload_backend(),
        "require_s3_for_uploads": require_s3,
        "s3_enabled": s3_on,
        "s3_bucket": bucket if bucket else None,
        "host_url_configured": bool(host_u),
        "aws_region_configured": region,
        "aws_static_access_key_configured": bool(s3_storage.credentials_configured()),
        "aws_s3_use_iam_role": s3_storage.use_iam_role_without_static_keys(),
        "s3_url_for_browser": mode_out,
        "host_treats_local_disk_as_ephemeral": ephemeral,
        "local_api_image_paths_blocked": ephemeral and not _allow_ephemeral_disk_uploads(),
        "allow_ephemeral_uploads_env_override": _allow_ephemeral_disk_uploads(),
        "hint": (
            "If simple says S3 is off but you set env vars: region must match the bucket; IAM needs s3:PutObject; "
            "on Render use static keys (not AWS_S3_USE_IAM_ROLE unless you know you need it). "
            "Optional: REQUIRE_S3_FOR_UPLOADS=true once uploads work."
        ),
    }


def _image_ext_from_upload(file: UploadFile, file_ext: str) -> str:
    if file_ext in IMAGE_EXTENSIONS:
        return file_ext
    ct = (file.content_type or "").lower()
    if "png" in ct:
        return ".png"
    if "jpeg" in ct or ct == "image/jpg":
        return ".jpg"
    if "webp" in ct:
        return ".webp"
    if "gif" in ct:
        return ".gif"
    return file_ext


@router.post("/image")
async def upload_image(file: UploadFile = File(...)):
    raw_name = (file.filename or "").strip() or "image"
    file_ext = Path(raw_name).suffix.lower()
    file_ext = _image_ext_from_upload(file, file_ext)
    if file_ext not in IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type not allowed. Allowed: {', '.join(IMAGE_EXTENSIONS)}")
    try:
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_bytes = await file.read()
        url, fname = _s3_put_then_fallback(
            file_bytes,
            unique_filename,
            s3_key=s3_storage.image_key(unique_filename),
        )
        return {"url": url, "filename": fname}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")


@router.post("/video")
async def upload_video(file: UploadFile = File(...)):
    raw_name = (file.filename or "").strip() or "video"
    file_ext = Path(raw_name).suffix.lower()
    if not file_ext or file_ext == ".":
        ct = (file.content_type or "").lower()
        if "webm" in ct:
            file_ext = ".webm"
        elif "quicktime" in ct or "/mov" in ct:
            file_ext = ".mov"
        elif "mp4" in ct or ct.startswith("video/"):
            file_ext = ".mp4"
        elif "x-msvideo" in ct:
            file_ext = ".avi"
    if file_ext not in VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"File type not allowed (extension {file_ext!r}, content-type {file.content_type!r}). "
                f"Allowed: {', '.join(sorted(VIDEO_EXTENSIONS))}"
            ),
        )
    try:
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_bytes = await file.read()
        if len(file_bytes) > MAX_VIDEO_SIZE:
            raise HTTPException(
                status_code=413,
                detail=(
                    f"Video too large ({len(file_bytes) // (1024 * 1024)} MB). "
                    f"Maximum is {MAX_VIDEO_SIZE // (1024 * 1024)} MB."
                ),
            )
        url, fname = _s3_put_then_fallback(
            file_bytes,
            unique_filename,
            s3_key=s3_storage.video_key(unique_filename),
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
        url, fname = _s3_put_then_fallback(
            file_bytes,
            unique_filename,
            s3_key=s3_storage.document_key(unique_filename),
        )
        return {"url": url, "filename": fname, "original_name": file.filename}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
