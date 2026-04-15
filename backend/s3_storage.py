"""
AWS S3 uploads (optional). When AWS_S3_BUCKET and credentials are set, media
uploads use S3 and return public HTTPS URLs for storage in MongoDB.

Env:
  AWS_S3_BUCKET           — required to enable S3
  AWS_ACCESS_KEY_ID       — standard boto3
  AWS_SECRET_ACCESS_KEY
  AWS_REGION or AWS_DEFAULT_REGION — default ap-southeast-1
  AWS_S3_PREFIX           — optional key prefix (default: uploads)
  AWS_S3_PUBLIC_BASE_URL  — optional CDN / website endpoint, no trailing slash
  AWS_S3_ENDPOINT_URL     — optional (MinIO, LocalStack)

Bucket objects should be readable via this URL (bucket policy or CloudFront).
Public ACLs are not set; configure access on the bucket side.
"""
from __future__ import annotations

import logging
import os
import urllib.parse
from pathlib import Path

logger = logging.getLogger(__name__)


def _region() -> str:
    return (
        os.environ.get("AWS_REGION")
        or os.environ.get("AWS_DEFAULT_REGION")
        or "ap-southeast-1"
    )


def _prefix() -> str:
    p = (os.environ.get("AWS_S3_PREFIX") or "uploads").strip().strip("/")
    return p


def is_s3_enabled() -> bool:
    return bool((os.environ.get("AWS_S3_BUCKET") or "").strip())


def _public_url(bucket: str, key: str) -> str:
    base = (os.environ.get("AWS_S3_PUBLIC_BASE_URL") or "").strip().rstrip("/")
    encoded = urllib.parse.quote(key, safe="/")
    if base:
        return f"{base}/{encoded}"
    region = _region()
    if region == "us-east-1":
        host = f"{bucket}.s3.amazonaws.com"
    else:
        host = f"{bucket}.s3.{region}.amazonaws.com"
    return f"https://{host}/{encoded}"


def _client():
    import boto3

    kwargs = {"region_name": _region()}
    endpoint = (os.environ.get("AWS_S3_ENDPOINT_URL") or "").strip()
    if endpoint:
        kwargs["endpoint_url"] = endpoint
    return boto3.client("s3", **kwargs)


def upload_bytes(key: str, body: bytes, content_type: str) -> str:
    """Upload bytes to S3; return public URL for the object."""
    bucket = (os.environ.get("AWS_S3_BUCKET") or "").strip()
    if not bucket:
        raise RuntimeError("AWS_S3_BUCKET is not set")

    extra = {
        "ContentType": content_type or "application/octet-stream",
        "CacheControl": "public, max-age=31536000",
    }
    try:
        _client().put_object(Bucket=bucket, Key=key, Body=body, **extra)
    except Exception as e:
        logger.exception("S3 put_object failed: bucket=%s key=%s", bucket, key)
        raise RuntimeError(f"S3 upload failed: {e}") from e

    return _public_url(bucket, key)


def prefixed_key(*parts: str) -> str:
    """Build S3 key under AWS_S3_PREFIX."""
    segs = [_prefix()] + [p.strip("/") for p in parts if p and str(p).strip("/")]
    return "/".join(segs)


def delete_object_key(key: str) -> bool:
    """Delete object by full key. Returns True if delete was attempted."""
    if not is_s3_enabled():
        return False
    bucket = (os.environ.get("AWS_S3_BUCKET") or "").strip()
    try:
        _client().delete_object(Bucket=bucket, Key=key)
        return True
    except Exception as e:
        logger.warning("S3 delete_object failed: %s", e)
        return False


def image_key(filename: str) -> str:
    return prefixed_key("image", Path(filename).name)


def video_key(filename: str) -> str:
    return prefixed_key("video", Path(filename).name)


def document_key(filename: str) -> str:
    return prefixed_key("document", Path(filename).name)


def payment_proof_key(filename: str) -> str:
    return prefixed_key("payment_proofs", Path(filename).name)
