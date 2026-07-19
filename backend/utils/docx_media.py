"""Persist images extracted from .docx imports (blog articles)."""
from __future__ import annotations

import logging
import mimetypes
import os
import uuid
from pathlib import Path

import s3_storage

logger = logging.getLogger(__name__)

UPLOAD_DIR = Path(__file__).parent.parent / "uploads"


def _host_uses_ephemeral_disk() -> bool:
    if (os.environ.get("ALLOW_EPHEMERAL_UPLOADS") or "").lower() in ("true", "1", "yes"):
        return False
    if (os.environ.get("RENDER") or "").lower() in ("true", "1", "yes"):
        return True
    if (os.environ.get("RAILWAY_ENVIRONMENT") or "").strip():
        return True
    if (os.environ.get("K_SERVICE") or "").strip():
        return True
    return False


def persist_docx_image(data: bytes, ext: str) -> str:
    """Upload an embedded docx image; return a URL path or full HTTPS URL."""
    ext = (ext or "png").lower().lstrip(".")
    unique = f"blog-{uuid.uuid4().hex[:12]}.{ext}"
    content_type = mimetypes.guess_type(f"file.{ext}")[0] or "application/octet-stream"
    prefix = (os.environ.get("AWS_S3_PREFIX") or "uploads").strip().strip("/")
    s3_key = f"{prefix}/{unique}"

    if s3_storage.is_s3_enabled():
        try:
            return s3_storage.upload_bytes(s3_key, data, content_type)
        except Exception as exc:
            logger.warning("S3 upload for docx image failed: %s", exc)
            if s3_storage.media_must_use_s3() or _host_uses_ephemeral_disk():
                raise

    if _host_uses_ephemeral_disk():
        raise RuntimeError("Ephemeral host requires S3 for docx image uploads")

    UPLOAD_DIR.mkdir(exist_ok=True)
    (UPLOAD_DIR / unique).write_bytes(data)
    return f"/api/image/{unique}"
