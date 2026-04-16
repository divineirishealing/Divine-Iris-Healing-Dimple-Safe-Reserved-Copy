"""Stream S3 objects through the API for browsers when the bucket is not public (S3_URL_FOR_BROWSER=api)."""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

import s3_storage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["S3 media"])


@router.get("/s3-media/{key_path:path}")
async def serve_s3_media(key_path: str):
    if not s3_storage.is_s3_enabled():
        raise HTTPException(status_code=404, detail="Not found")
    try:
        key = s3_storage.validate_public_proxy_key(key_path)
    except ValueError:
        raise HTTPException(status_code=404, detail="Not found") from None
    try:
        body, ctype = s3_storage.get_object_bytes(key)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Not found") from None
    except Exception as e:
        logger.warning("s3-media proxy failed for key=%s: %s", key, e)
        raise HTTPException(status_code=502, detail="Could not load media") from e
    return Response(
        content=body,
        media_type=ctype,
        headers={
            "Cache-Control": "public, max-age=31536000",
            "Access-Control-Allow-Origin": "*",
        },
    )
