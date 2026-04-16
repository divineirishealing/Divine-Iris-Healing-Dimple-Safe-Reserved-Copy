"""Stream S3 objects through the API for browsers when the bucket is not public (S3_URL_FOR_BROWSER=api)."""
from __future__ import annotations

import logging
import os

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

import s3_storage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["S3 media"])


@router.get("/s3-media-status")
async def s3_media_status():
    """Diagnostic: confirms route exists and shows the key prefix (must match the path after /api/s3-media/)."""
    pref = (os.environ.get("AWS_S3_PREFIX") or "uploads").strip().strip("/")
    host = (os.environ.get("HOST_URL") or "").strip().rstrip("/")
    bucket = (os.environ.get("AWS_S3_BUCKET") or "").strip()
    return {
        "ok": True,
        "s3_enabled": s3_storage.is_s3_enabled(),
        "bucket": bucket or None,
        "key_prefix": pref,
        "path_must_look_like": f"/api/s3-media/{pref}/image/<filename>.png",
        "example_full_url": (
            f"{host}/api/s3-media/{pref}/image/replace-with-real-uuid.png" if host else None
        ),
        "host_url_set": bool(host),
        "hint": "If /api/s3-media/... returns Not Found: (1) Wrong Render URL — open this JSON from the same host as /api/health. "
        "(2) Path must start with key_prefix above. (3) IAM needs s3:GetObject on that prefix. (4) Filename must exist in S3.",
    }


@router.get("/s3-media/{key_path:path}")
async def serve_s3_media(key_path: str):
    if not s3_storage.is_s3_enabled():
        raise HTTPException(
            status_code=503,
            detail="S3 is not configured on this API (set AWS_S3_BUCKET and keys on Render).",
        )
    try:
        key = s3_storage.validate_public_proxy_key(key_path)
    except ValueError:
        pref = (os.environ.get("AWS_S3_PREFIX") or "uploads").strip().strip("/")
        raise HTTPException(
            status_code=404,
            detail=(
                f"Invalid media path. After /api/s3-media/ the path must start with {pref}/ "
                f"(e.g. {pref}/image/your-file.png). Open GET /api/s3-media-status on this same server."
            ),
        ) from None
    try:
        body, ctype = s3_storage.get_object_bytes(key)
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"No such object in S3: {key!r}. Check the filename or AWS_S3_PREFIX.",
        ) from None
    except PermissionError as e:
        logger.warning("s3-media AccessDenied: %s", e)
        raise HTTPException(status_code=403, detail=str(e)) from e
    except Exception as e:
        logger.warning("s3-media proxy failed for key=%s: %s", key, e)
        raise HTTPException(status_code=502, detail=f"Could not load media: {e}") from e
    return Response(
        content=body,
        media_type=ctype,
        headers={
            "Cache-Control": "public, max-age=31536000",
            "Access-Control-Allow-Origin": "*",
        },
    )
