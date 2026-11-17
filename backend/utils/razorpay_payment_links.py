"""Razorpay Payment Links API helpers."""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

import httpx
from fastapi import HTTPException

from utils.razorpay_orders import http_detail_from_razorpay_response

logger = logging.getLogger(__name__)

RAZORPAY_PAYMENT_LINKS_URL = "https://api.razorpay.com/v1/payment_links"


async def create_razorpay_payment_link(
    *,
    key_id: str,
    key_secret: str,
    amount_paise: int,
    description: str,
    reference_id: str,
    notes: Optional[Dict[str, Any]] = None,
    callback_url: str = "",
    callback_method: str = "get",
    currency: str = "INR",
    timeout: float = 45.0,
    context: str = "payment_link",
) -> dict:
    if amount_paise < 100:
        raise HTTPException(status_code=400, detail="Amount is below Razorpay minimum (₹1).")
    if not key_id.strip() or not key_secret.strip():
        raise HTTPException(status_code=503, detail="Razorpay is not configured.")

    payload: Dict[str, Any] = {
        "amount": int(amount_paise),
        "currency": currency.upper(),
        "accept_partial": False,
        "description": (description or "Payment")[:2048],
        "reference_id": reference_id[:40],
        "notify": {"sms": True, "email": True},
        "reminder_enable": True,
        "notes": notes or {},
    }
    if callback_url.strip():
        payload["callback_url"] = callback_url.strip()[:250]
        payload["callback_method"] = (callback_method or "get").lower()

    async with httpx.AsyncClient(timeout=timeout) as http:
        resp = await http.post(
            RAZORPAY_PAYMENT_LINKS_URL,
            auth=(key_id.strip(), key_secret.strip()),
            json=payload,
        )

    if resp.status_code >= 400:
        detail = http_detail_from_razorpay_response(resp, context=context)
        raise HTTPException(status_code=502, detail=detail)

    data = resp.json()
    if not data.get("id") or not data.get("short_url"):
        raise HTTPException(status_code=502, detail="Could not create Razorpay payment link.")
    return data


async def cancel_razorpay_payment_link(
    *,
    payment_link_id: str,
    key_id: str,
    key_secret: str,
    timeout: float = 30.0,
) -> None:
    plink = (payment_link_id or "").strip()
    if not plink:
        return
    url = f"{RAZORPAY_PAYMENT_LINKS_URL}/{plink}/cancel"
    async with httpx.AsyncClient(timeout=timeout) as http:
        resp = await http.post(url, auth=(key_id.strip(), key_secret.strip()))
    if resp.status_code >= 400 and resp.status_code != 404:
        logger.warning("Cancel payment link %s: HTTP %s %s", plink, resp.status_code, resp.text[:300])


async def fetch_razorpay_payment(
    *,
    payment_id: str,
    key_id: str,
    key_secret: str,
    timeout: float = 30.0,
) -> dict:
    pid = (payment_id or "").strip()
    if not pid:
        raise HTTPException(status_code=400, detail="Missing payment id.")
    url = f"https://api.razorpay.com/v1/payments/{pid}"
    async with httpx.AsyncClient(timeout=timeout) as http:
        resp = await http.get(url, auth=(key_id.strip(), key_secret.strip()))
    if resp.status_code >= 400:
        detail = http_detail_from_razorpay_response(resp, context="payment fetch")
        raise HTTPException(status_code=502, detail=detail)
    return resp.json()


async def fetch_razorpay_payment_link(
    *,
    payment_link_id: str,
    key_id: str,
    key_secret: str,
    timeout: float = 30.0,
) -> dict:
    plink = (payment_link_id or "").strip()
    if not plink:
        raise HTTPException(status_code=400, detail="Missing payment link id.")
    url = f"{RAZORPAY_PAYMENT_LINKS_URL}/{plink}"
    async with httpx.AsyncClient(timeout=timeout) as http:
        resp = await http.get(url, auth=(key_id.strip(), key_secret.strip()))
    if resp.status_code >= 400:
        detail = http_detail_from_razorpay_response(resp, context="payment link fetch")
        raise HTTPException(status_code=502, detail=detail)
    return resp.json()


async def fetch_razorpay_order_payments(
    *,
    order_id: str,
    key_id: str,
    key_secret: str,
    timeout: float = 30.0,
) -> list:
    oid = (order_id or "").strip()
    if not oid:
        return []
    url = f"https://api.razorpay.com/v1/orders/{oid}/payments"
    async with httpx.AsyncClient(timeout=timeout) as http:
        resp = await http.get(url, auth=(key_id.strip(), key_secret.strip()))
    if resp.status_code >= 400:
        logger.warning("Razorpay order payments %s: HTTP %s", oid, resp.status_code)
        return []
    data = resp.json()
    items = data.get("items") if isinstance(data, dict) else None
    return list(items or [])