"""
AWS S3 uploads (optional). When the bucket is set and credentials (or IAM role
mode) are available, media uploads use S3 and return public HTTPS URLs.

Env:
  AWS_S3_BUCKET           — required to enable S3
  AWS_ACCESS_KEY_ID       — IAM user (typical on Render)
  AWS_SECRET_ACCESS_KEY
  AWS_REGION or AWS_DEFAULT_REGION — must match the bucket’s region
  AWS_S3_USE_IAM_ROLE — set true on EC2/ECS if you use an instance/task role instead of static keys
  AWS_S3_PREFIX           — optional key prefix (default: uploads)
  AWS_S3_PUBLIC_BASE_URL  — optional CloudFront / website origin, no trailing slash
  AWS_S3_ENDPOINT_URL     — optional (MinIO, LocalStack)
  AWS_S3_OBJECT_ACL       — optional e.g. public-read (omit if bucket uses “Bucket owner enforced” + bucket policy)
  AWS_S3_ADDRESSING_STYLE — optional path | virtual (default auto; try path for some S3-compatible APIs)

Objects must be readable in the browser: use a bucket policy allowing s3:GetObject
on arn:aws:s3:::YOUR_BUCKET/uploads/* (or your prefix). Do not rely on ACLs if
Object Ownership is “Bucket owner enforced”.
"""
from __future__ import annotations

import logging
import os
import urllib.parse
from pathlib import Path

logger = logging.getLogger(__name__)

# When env region ≠ bucket region, first put_object may fail; we retry using
# x-amz-bucket-region and cache it for later requests.
_bucket_region_cache: dict[str, str] = {}


def _region() -> str:
    return (
        os.environ.get("AWS_REGION")
        or os.environ.get("AWS_DEFAULT_REGION")
        or "ap-southeast-1"
    )


def _prefix() -> str:
    p = (os.environ.get("AWS_S3_PREFIX") or "uploads").strip().strip("/")
    return p


def use_iam_role_without_static_keys() -> bool:
    """EC2 instance profile, ECS task role, etc. — no ACCESS_KEY_ID in env."""
    return (os.environ.get("AWS_S3_USE_IAM_ROLE") or "").lower() in ("true", "1", "yes")


def is_s3_enabled() -> bool:
    """
    True when S3 upload should be attempted: bucket is set and we expect boto3
    to resolve credentials (static keys or explicit IAM-role mode).

    A bucket name alone is not enough (avoids noisy failed PutObject on every upload).
    """
    bucket = (os.environ.get("AWS_S3_BUCKET") or "").strip()
    if not bucket:
        return False
    if use_iam_role_without_static_keys():
        return True
    return credentials_configured()


def _public_url(bucket: str, key: str, *, s3_region: str | None = None) -> str:
    base = (os.environ.get("AWS_S3_PUBLIC_BASE_URL") or "").strip().rstrip("/")
    encoded = urllib.parse.quote(key, safe="/")
    if base:
        return f"{base}/{encoded}"
    region = s3_region or _bucket_region_cache.get(bucket) or _region()
    if region == "us-east-1":
        host = f"{bucket}.s3.amazonaws.com"
    else:
        host = f"{bucket}.s3.{region}.amazonaws.com"
    return f"https://{host}/{encoded}"


def _client(region_name: str | None = None):
    import boto3
    from botocore.config import Config

    kwargs = {"region_name": region_name or _region()}
    endpoint = (os.environ.get("AWS_S3_ENDPOINT_URL") or "").strip()
    if endpoint:
        kwargs["endpoint_url"] = endpoint
    style = (os.environ.get("AWS_S3_ADDRESSING_STYLE") or "").strip().lower()
    s3_cfg = {}
    if style == "path":
        s3_cfg["addressing_style"] = "path"
    elif style == "virtual":
        s3_cfg["addressing_style"] = "virtual"
    cfg = (
        Config(signature_version="s3v4", s3=s3_cfg)
        if s3_cfg
        else Config(signature_version="s3v4")
    )
    kwargs["config"] = cfg
    return boto3.client("s3", **kwargs)


def _bucket_region_from_client_error(exc: BaseException) -> str | None:
    """Read bucket's actual region from S3 error (e.g. PermanentRedirect)."""
    try:
        from botocore.exceptions import ClientError

        if not isinstance(exc, ClientError):
            return None
        err = exc.response.get("Error") or {}
        code = str(err.get("Code", ""))
        if code not in ("PermanentRedirect", "301", "AuthorizationHeaderMalformed"):
            return None
        hdrs = exc.response.get("ResponseMetadata", {}).get("HTTPHeaders") or {}
        r = hdrs.get("x-amz-bucket-region")
        if r:
            return str(r)
        msg = str(err.get("Message", ""))
        # "The authorization header is malformed; the region 'us-east-1' is wrong; expecting 'ap-southeast-1'"
        if "expecting" in msg.lower():
            import re

            m = re.search(r"expecting\s+['\"]([a-z0-9-]+)['\"]", msg, re.I)
            if m:
                return m.group(1)
    except ImportError:
        pass
    return None


def credentials_configured() -> bool:
    """IAM user keys or instance role; session token optional."""
    return bool(
        (os.environ.get("AWS_ACCESS_KEY_ID") or "").strip()
        and (os.environ.get("AWS_SECRET_ACCESS_KEY") or "").strip()
    )


def upload_bytes(key: str, body: bytes, content_type: str) -> str:
    """Upload bytes to S3; return public URL for the object."""
    bucket = (os.environ.get("AWS_S3_BUCKET") or "").strip()
    if not bucket:
        raise RuntimeError("AWS_S3_BUCKET is not set")

    extra: dict = {
        "ContentType": content_type or "application/octet-stream",
        "CacheControl": "public, max-age=31536000",
    }
    acl = (os.environ.get("AWS_S3_OBJECT_ACL") or "").strip()
    if acl:
        extra["ACL"] = acl
    preferred = _bucket_region_cache.get(bucket) or _region()
    success_region = preferred

    def _put(reg: str) -> None:
        _client(reg).put_object(Bucket=bucket, Key=key, Body=body, **extra)

    try:
        _put(preferred)
    except Exception as e:
        try:
            from botocore.exceptions import NoCredentialsError

            if isinstance(e, NoCredentialsError):
                raise RuntimeError(
                    "S3: no AWS credentials. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY on the API host, "
                    "or set AWS_S3_USE_IAM_ROLE=true if this server uses an IAM role (EC2/ECS)."
                ) from e
        except ImportError:
            pass
        if "Unable to locate credentials" in str(e):
            raise RuntimeError(
                "S3: unable to locate credentials. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY, "
                "or AWS_S3_USE_IAM_ROLE=true for role-based access."
            ) from e
        redirect_region = _bucket_region_from_client_error(e)
        if redirect_region and redirect_region != preferred:
            logger.warning(
                "S3 put_object region mismatch; retrying with bucket region %s (was %s)",
                redirect_region,
                preferred,
            )
            try:
                _put(redirect_region)
                _bucket_region_cache[bucket] = redirect_region
                success_region = redirect_region
            except Exception as e2:
                logger.exception("S3 put_object failed after region retry: bucket=%s key=%s", bucket, key)
                msg = _friendly_s3_error(e2, bucket, key)
                raise RuntimeError(msg) from e2
        else:
            logger.exception("S3 put_object failed: bucket=%s key=%s", bucket, key)
            msg = _friendly_s3_error(e, bucket, key)
            raise RuntimeError(msg) from e

    return _public_url(bucket, key, s3_region=success_region)


def _friendly_s3_error(exc: BaseException, bucket: str, key: str) -> str:
    """Map boto ClientError to admin-actionable text (still safe to return in API detail)."""
    try:
        from botocore.exceptions import ClientError

        if isinstance(exc, ClientError):
            err = exc.response.get("Error") or {}
            code = err.get("Code", "")
            amsg = err.get("Message", "") or str(exc)
            if code == "AccessDenied":
                return (
                    f"S3 AccessDenied for bucket “{bucket}”. IAM user needs s3:PutObject (and s3:PutObjectAcl only if you set AWS_S3_OBJECT_ACL) "
                    f"on arn:aws:s3:::{bucket}/* — key {key!r}. If PutObject works but images 403 in the browser, add a bucket policy "
                    f"allowing s3:GetObject on arn:aws:s3:::{bucket}/{_prefix()}/* (see env.example)."
                )
            if code in ("InvalidAccessKeyId", "SignatureDoesNotMatch"):
                return f"S3 rejected AWS credentials ({code}). Check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY on the API host."
            if code == "NoSuchBucket":
                return f"S3 bucket “{bucket}” does not exist in region {_region()} (or wrong AWS_REGION)."
            if code == "PermanentRedirect":
                return (
                    f"S3 PermanentRedirect: bucket “{bucket}” is in a different region. Set AWS_REGION (or AWS_DEFAULT_REGION) "
                    "to the bucket’s region."
                )
            if code == "IllegalLocationConstraintException":
                return (
                    f"S3 IllegalLocationConstraintException: create the bucket in region {_region()} or set AWS_REGION "
                    f"to the region where the bucket was created."
                )
            return f"S3 error {code}: {amsg}"
    except ImportError:
        pass
    return f"S3 upload failed: {exc}"


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
        _client(_bucket_region_cache.get(bucket)).delete_object(Bucket=bucket, Key=key)
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
