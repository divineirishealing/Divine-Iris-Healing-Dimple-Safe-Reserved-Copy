"""Create Razorpay orders with consistent errors (landings + enrollment)."""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, Optional

import httpx
from fastapi import HTTPException

logger = logging.getLogger(__name__)

RAZORPAY_ORDERS_URL = "https://api.razorpay.com/v1/orders"


def unique_razorpay_receipt(session_key: str, *, prefix: str = "") -> str:
    """Razorpay receipt: max 40 chars, unique, alphanumeric."""
    raw = re.sub(r"[^a-zA-Z0-9]", "", session_key or "")
    pre = re.sub(r"[^a-zA-Z0-9]", "", prefix or "")[:8]
    body = raw[-24:] or raw
    out = f"{pre}{body}"[:40]
    return out or "DIH" + raw[:37]


def http_detail_from_razorpay_response(response: httpx.Response, *, context: str = "") -> str:
    default = "Could not start payment. Please try again."
    try:
        payload = response.json()
        err = payload.get("error") or {}
        desc = (err.get("description") or err.get("reason") or "").strip()
        code = (err.get("code") or "").strip()
    except Exception:
        desc = ""
        code = ""

    if response.status_code == 401 or (
        desc and "authentication" in desc.lower()
    ):
        return (
            "Razorpay rejected the API keys. In Admin → API Keys, paste a fresh Key ID and "
            "Key Secret from Razorpay (Settings → API Keys). Use both live or both test—no spaces."
        )
    if desc:
        logger.warning("%s Razorpay order HTTP %s: %s", context, response.status_code, desc)
        return desc
    if code:
        return f"Razorpay error ({code}). Please try again."
    logger.warning("%s Razorpay order HTTP %s: %s", context, response.status_code, response.text[:500])
    return default


async def create_razorpay_order(
    *,
    key_id: str,
    key_secret: str,
    amount_paise: int,
    receipt: str,
    notes: Optional[Dict[str, Any]] = None,
    currency: str = "INR",
    timeout: float = 45.0,
    context: str = "checkout",
) -> dict:
    if amount_paise < 100:
        raise HTTPException(status_code=400, detail="Amount is below Razorpay minimum (₹1).")
    if not key_id.strip() or not key_secret.strip():
        raise HTTPException(status_code=503, detail="Razorpay is not configured.")

    async with httpx.AsyncClient(timeout=timeout) as http:
        ro = await http.post(
            RAZORPAY_ORDERS_URL,
            auth=(key_id.strip(), key_secret.strip()),
            json={
                "amount": int(amount_paise),
                "currency": currency.upper(),
                "receipt": receipt[:40],
                "notes": notes or {},
            },
        )

    if ro.status_code >= 400:
        detail = http_detail_from_razorpay_response(ro, context=context)
        raise HTTPException(status_code=502, detail=detail)

    order = ro.json()
    order_id = order.get("id")
    if not order_id:
        raise HTTPException(status_code=502, detail="Could not start payment. Please try again.")
    return order