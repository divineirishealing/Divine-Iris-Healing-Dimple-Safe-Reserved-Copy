"""Generic India program landing — Razorpay Payment Link + QR (Stress Detox, etc.)."""
from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from utils.awrp_intro_razorpay_plink import (
    _customer_from_payment,
    _frontend_base_url,
    _next_receipt_id,
    normalize_phone,
    verify_payment_link_callback_signature,
)
from utils.razorpay_payment_links import (
    cancel_razorpay_payment_link,
    create_razorpay_payment_link,
    fetch_razorpay_payment,
)

logger = logging.getLogger(__name__)

LANDING_NOTE = "india-program"
SUCCESS_FROM_QUERY = "india-program-plink"


def _cache_id(program_id: str) -> str:
    return f"india_program_{(program_id or '').strip()}"


async def ensure_india_program_payment_link(
    db: AsyncIOMotorDatabase,
    *,
    key_id: str,
    key_secret: str,
    program_id: str,
    amount_inr: float,
    item_title: str,
    landing_path: str,
    tier_index: int = 0,
) -> dict:
    """Return cached Razorpay Payment Link (recreate when INR price changes)."""
    pid = (program_id or "").strip()
    if not pid:
        raise HTTPException(status_code=400, detail="program_id required")

    amount_paise = int(round(float(amount_inr) * 100))
    cache_key = _cache_id(pid)
    cached = await db.razorpay_cached_payment_links.find_one({"_id": cache_key}, {"_id": 0})

    if (
        cached
        and cached.get("amount_paise") == amount_paise
        and cached.get("program_id") == pid
        and cached.get("tier_index") == tier_index
        and cached.get("short_url")
        and cached.get("payment_link_id")
    ):
        return cached

    if cached and cached.get("payment_link_id"):
        try:
            await cancel_razorpay_payment_link(
                payment_link_id=cached["payment_link_id"],
                key_id=key_id,
                key_secret=key_secret,
            )
        except Exception as exc:
            logger.warning("Cancel old india program payment link %s: %s", pid, exc)

    safe_ref = "".join(c for c in pid if c.isalnum())[:12]
    reference_id = f"indiaprog{amount_paise}{safe_ref}"[:40]
    callback_url = (
        f"{_frontend_base_url()}/payment/success"
        f"?from={SUCCESS_FROM_QUERY}&plink=1&program_id={pid}"
    )
    created = await create_razorpay_payment_link(
        key_id=key_id,
        key_secret=key_secret,
        amount_paise=amount_paise,
        description=item_title or "Program",
        reference_id=reference_id,
        callback_url=callback_url,
        notes={
            "landing": LANDING_NOTE,
            "program_id": pid,
            "item_id": pid,
            "tier_index": str(tier_index),
        },
        context=f"India program payment link ({pid})",
    )

    doc = {
        "_id": cache_key,
        "payment_link_id": created.get("id"),
        "short_url": created.get("short_url"),
        "amount_inr": float(amount_inr),
        "amount_paise": amount_paise,
        "program_id": pid,
        "tier_index": tier_index,
        "item_title": item_title,
        "landing_path": landing_path,
        "reference_id": reference_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.razorpay_cached_payment_links.replace_one({"_id": cache_key}, doc, upsert=True)
    return {k: v for k, v in doc.items() if k != "_id"}


async def _program_id_from_payment_link_cache(
    db: AsyncIOMotorDatabase,
    payment_link_id: Optional[str],
) -> Tuple[str, int, str]:
    """Resolve program_id / tier / landing_path from our cached Razorpay payment link row."""
    plink = (payment_link_id or "").strip()
    if not plink:
        return "", 0, ""
    cached = await db.razorpay_cached_payment_links.find_one({"payment_link_id": plink}, {"_id": 0})
    if not cached:
        return "", 0, ""
    pid = (cached.get("program_id") or "").strip()
    tier = 0
    try:
        tier = int(cached.get("tier_index") or 0)
    except (TypeError, ValueError):
        tier = 0
    landing = (cached.get("landing_path") or "").strip()
    return pid, tier, landing


def _phone_tail(phone: str) -> str:
    digits = "".join(c for c in (phone or "") if c.isdigit())
    return digits[-10:] if len(digits) >= 10 else digits


async def _find_open_india_landing_enrollment(
    db: AsyncIOMotorDatabase,
    *,
    program_id: str,
    email: str,
    phone: str = "",
) -> Optional[dict]:
    """Booking form left checkout_started; payer used QR payment link instead."""
    from utils.enrollment_checkout_status import INCOMPLETE_CHECKOUT_STATUSES

    email_norm = (email or "").strip().lower()
    pid = (program_id or "").strip()
    phone_tail = _phone_tail(normalize_phone(phone) or phone)
    if not pid or (not email_norm and not phone_tail):
        return None
    cursor = db.enrollments.find(
        {
            "status": {"$in": list(INCOMPLETE_CHECKOUT_STATUSES)},
            "$or": [
                {"item_id": pid, "item_type": "program"},
                {"cart_items.program_id": pid},
            ],
        },
        {"_id": 0},
    ).sort("created_at", -1)
    async for row in cursor:
        row_email = (row.get("booker_email") or "").strip().lower()
        if email_norm and row_email == email_norm:
            return row
        if phone_tail and _phone_tail(row.get("phone") or "") == phone_tail:
            return row
    return None


async def _pending_txn_for_enrollment(db: AsyncIOMotorDatabase, enrollment_id: str) -> Optional[dict]:
    from utils.enrollment_checkout_status import transaction_is_paid

    eid = (enrollment_id or "").strip()
    if not eid:
        return None
    txns = await db.payment_transactions.find({"enrollment_id": eid}, {"_id": 0}).sort("created_at", -1).to_list(10)
    for txn in txns:
        if not transaction_is_paid(txn):
            return txn
    return txns[0] if txns else None


async def backfill_india_plink_checkout_orphans(db, *, limit: int = 100) -> int:
    """
    Heal checkout_started India landings when Razorpay Payment Link paid on a duplicate enrollment.
    Relinks the paid plink transaction onto the original invoice/enrollment.
    """
    from routes.payments import run_enrollment_razorpay_success_hooks
    from utils.enrollment_checkout_status import (
        INCOMPLETE_CHECKOUT_STATUSES,
        reconcile_enrollment_with_paid_transaction,
        transaction_is_paid,
    )

    fixed = 0
    enrollments = await db.enrollments.find(
        {
            "status": {"$in": list(INCOMPLETE_CHECKOUT_STATUSES)},
            "$or": [
                {"created_via": "india_landing"},
                {"landing_path": {"$regex": r"^/india/program/"}},
                {"cart_items.0": {"$exists": True}},
                {"india_site_checkout": True},
                {"item_type": "program", "currency": "inr"},
            ],
        },
        {"_id": 0},
    ).sort("created_at", -1).limit(limit).to_list(limit)

    for enrollment in enrollments:
        eid = (enrollment.get("id") or "").strip()
        email = (enrollment.get("booker_email") or "").strip().lower()
        program_id = (enrollment.get("item_id") or "").strip()
        if not eid or not email or not program_id:
            continue

        pending = await _pending_txn_for_enrollment(db, eid)
        if pending and transaction_is_paid(pending):
            continue

        paid_plink = await db.payment_transactions.find_one(
            {
                "razorpay_payment_link": True,
                "item_id": program_id,
                "payment_status": {"$in": ["paid", "complete", "completed"]},
                "booker_email": {"$regex": f"^{re.escape(email)}$", "$options": "i"},
            },
            sort=[("paid_at", -1), ("created_at", -1)],
        )
        if not paid_plink:
            phone_tail = _phone_tail(enrollment.get("phone") or "")
            if phone_tail:
                recent = await db.payment_transactions.find(
                    {
                        "razorpay_payment_link": True,
                        "item_id": program_id,
                        "payment_status": {"$in": ["paid", "complete", "completed"]},
                    },
                    {"_id": 0},
                ).sort("paid_at", -1).limit(40).to_list(40)
                for candidate in recent:
                    if _phone_tail(candidate.get("phone") or "") == phone_tail:
                        paid_plink = candidate
                        break
        if not paid_plink:
            continue

        other_eid = (paid_plink.get("enrollment_id") or "").strip()
        if other_eid == eid:
            await reconcile_enrollment_with_paid_transaction(db, eid, paid_plink, enrollment=enrollment)
            fixed += 1
            continue

        invoice_number = (pending or {}).get("invoice_number") or paid_plink.get("invoice_number")
        session_id = (pending or {}).get("stripe_session_id") or paid_plink.get("stripe_session_id")
        if not session_id:
            session_id = f"rz_{uuid.uuid4().hex}"

        await db.payment_transactions.update_one(
            {"id": paid_plink["id"]},
            {
                "$set": {
                    "enrollment_id": eid,
                    "invoice_number": invoice_number,
                    "stripe_session_id": session_id,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )
        if pending and pending.get("id") and pending["id"] != paid_plink.get("id"):
            await db.payment_transactions.update_one(
                {"id": pending["id"]},
                {
                    "$set": {
                        "payment_status": "superseded",
                        "superseded_by_txn_id": paid_plink["id"],
                        "updated_at": datetime.now(timezone.utc),
                    }
                },
            )

        paid_doc = {
            **paid_plink,
            "enrollment_id": eid,
            "invoice_number": invoice_number,
            "stripe_session_id": session_id,
        }
        now = datetime.now(timezone.utc)
        await db.enrollments.update_one(
            {"id": eid},
            {
                "$set": {
                    "status": "completed",
                    "payment_method": "razorpay",
                    "paid_at": paid_plink.get("paid_at") or now.isoformat(),
                    "stripe_session_id": session_id,
                    "updated_at": now.isoformat(),
                }
            },
        )

        if other_eid and other_eid != eid:
            await db.enrollments.update_one(
                {"id": other_eid},
                {
                    "$set": {
                        "status": "cancelled",
                        "cancel_reason": "india_plink_merged_into_checkout",
                        "merged_into_enrollment_id": eid,
                        "updated_at": now.isoformat(),
                    }
                },
            )

        try:
            await run_enrollment_razorpay_success_hooks(session_id)
        except Exception as exc:
            logger.warning("backfill india plink hooks %s: %s", eid, exc)
        fixed += 1

    return fixed


async def fulfill_india_program_payment_link_payment(
    db: AsyncIOMotorDatabase,
    *,
    key_id: str,
    key_secret: str,
    payment_id: str,
    payment_link_id: Optional[str] = None,
    expected_program_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Create enrollment + emails for a captured Payment Link payment (idempotent)."""
    pid = (payment_id or "").strip()
    if not pid:
        raise HTTPException(status_code=400, detail="Missing razorpay_payment_id.")

    existing = await db.payment_transactions.find_one({"razorpay_payment_id": pid}, {"_id": 0})
    if existing and existing.get("payment_status") == "paid" and existing.get("enrollment_id"):
        session_id = (existing.get("stripe_session_id") or "").strip()
        if session_id and not existing.get("emails_sent"):
            from routes.payments import run_enrollment_razorpay_success_hooks

            await run_enrollment_razorpay_success_hooks(session_id)
        await backfill_india_plink_checkout_orphans(db, limit=50)
        return {"ok": True, "session_id": session_id, "already_fulfilled": True}

    payment = await fetch_razorpay_payment(
        payment_id=pid,
        key_id=key_id,
        key_secret=key_secret,
    )
    status = (payment.get("status") or "").lower()
    if status not in ("captured", "authorized"):
        raise HTTPException(status_code=400, detail=f"Payment is not complete (status={status}).")

    notes = payment.get("notes") or {}
    program_id = (notes.get("program_id") or notes.get("item_id") or "").strip()
    if expected_program_id:
        program_id = (expected_program_id or "").strip() or program_id

    tier_index = 0
    try:
        tier_index = int(notes.get("tier_index") or 0)
    except (TypeError, ValueError):
        tier_index = 0

    if not program_id:
        cached_pid, cached_tier, _cached_path = await _program_id_from_payment_link_cache(db, payment_link_id)
        program_id = cached_pid or program_id
        if cached_tier and tier_index == 0:
            tier_index = cached_tier

    if payment_link_id and program_id:
        cached = await db.razorpay_cached_payment_links.find_one(
            {"_id": _cache_id(program_id)},
            {"_id": 0},
        )
        if cached and cached.get("payment_link_id") != payment_link_id:
            raise HTTPException(status_code=400, detail="Payment is not for this program link.")

    if not program_id:
        raise HTTPException(status_code=400, detail="Payment missing program id.")

    prog = await db.programs.find_one({"id": program_id}, {"_id": 0})
    if not prog:
        raise HTTPException(status_code=404, detail="Program not found.")

    pending_title = (prog.get("title") or "Program").strip()
    landing_path = f"/india/program/{program_id}"
    cached = await db.razorpay_cached_payment_links.find_one({"_id": _cache_id(program_id)}, {"_id": 0})
    if cached and cached.get("landing_path"):
        landing_path = cached["landing_path"]

    amount_paise = int(payment.get("amount") or 0)
    amount_inr = amount_paise / 100.0 if amount_paise else 0.0

    name, email, phone = _customer_from_payment(payment)
    if not email:
        raise HTTPException(
            status_code=400,
            detail="Payment has no email — ask the payer to retry with email on the Razorpay page.",
        )

    now = datetime.now(timezone.utc)
    order_id = (payment.get("order_id") or "").strip()
    open_enrollment = await _find_open_india_landing_enrollment(
        db,
        program_id=program_id,
        email=email,
        phone=phone,
    )

    participant = {
        "name": name,
        "relationship": "Self",
        "age": 0,
        "gender": "",
        "country": "IN",
        "city": "",
        "state": "",
        "attendance_mode": (open_enrollment or {}).get("attendance") or "online",
        "notify": True,
        "email": email,
        "phone": phone or (open_enrollment or {}).get("phone") or "",
        "whatsapp": phone or (open_enrollment or {}).get("phone") or "",
        "program_id": program_id,
        "program_title": pending_title,
        "is_first_time": True,
        "referral_source": "",
        "referred_by_name": "",
    }
    participants_for_enrollment = open_enrollment.get("participants") if open_enrollment else None
    if isinstance(participants_for_enrollment, list) and participants_for_enrollment:
        for p in participants_for_enrollment:
            if isinstance(p, dict):
                p.setdefault("notify", True)
                if email and not (p.get("email") or "").strip():
                    p["email"] = email
    else:
        participants_for_enrollment = [participant]

    from routes.payments import run_enrollment_razorpay_success_hooks

    if open_enrollment:
        enrollment_id = open_enrollment["id"]
        pending_txn = await _pending_txn_for_enrollment(db, enrollment_id)
        session_id = (pending_txn or {}).get("stripe_session_id") or open_enrollment.get("stripe_session_id")
        if not session_id:
            session_id = f"rz_{uuid.uuid4().hex}"
        invoice_number = (pending_txn or {}).get("invoice_number")

        await db.enrollments.update_one(
            {"id": enrollment_id},
            {
                "$set": {
                    "status": "completed",
                    "booker_name": name or open_enrollment.get("booker_name"),
                    "phone": phone or open_enrollment.get("phone"),
                    "participants": participants_for_enrollment,
                    "participant_count": len(participants_for_enrollment),
                    "payment_method": "razorpay",
                    "paid_at": now.isoformat(),
                    "stripe_session_id": session_id,
                    "ad_utm": {**(open_enrollment.get("ad_utm") or {}), "utm_medium": "razorpay_plink"},
                    "checkout_channel": "india_qr",
                    "item_id": program_id,
                    "item_type": "program",
                    "updated_at": now.isoformat(),
                }
            },
        )

        if pending_txn and pending_txn.get("id"):
            await db.payment_transactions.update_one(
                {"id": pending_txn["id"]},
                {
                    "$set": {
                        "payment_status": "paid",
                        "razorpay_payment_id": pid,
                        "razorpay_payment_link_id": (payment_link_id or "").strip(),
                        "razorpay_payment_link": True,
                        "paid_at": now.isoformat(),
                        "booker_name": name,
                        "booker_email": email,
                        "phone": participant["phone"],
                        "participants": participants_for_enrollment,
                        "participant_count": len(participants_for_enrollment),
                        "item_type": "program",
                        "item_id": program_id,
                        "item_title": pending_title,
                        "tier_index": tier_index,
                        "amount": amount_inr,
                        "currency": "inr",
                        "updated_at": now,
                    }
                },
            )
        else:
            month_prefix = now.strftime("%Y-%m")
            count = await db.payment_transactions.count_documents({"invoice_number": {"$regex": f"^{month_prefix}"}})
            invoice_number = invoice_number or f"{month_prefix}-{str(count + 1).zfill(3)}"
            await db.payment_transactions.insert_one(
                {
                    "id": str(uuid.uuid4()),
                    "invoice_number": invoice_number,
                    "enrollment_id": enrollment_id,
                    "stripe_session_id": session_id,
                    "razorpay_order_id": order_id,
                    "razorpay_payment_id": pid,
                    "razorpay_payment_link_id": (payment_link_id or "").strip(),
                    "payment_provider": "razorpay",
                    "razorpay_landing": True,
                    "razorpay_payment_link": True,
                    "created_via": "india_landing_plink",
                    "item_type": "program",
                    "item_id": program_id,
                    "item_title": pending_title,
                    "tier_index": tier_index,
                    "amount": amount_inr,
                    "currency": "inr",
                    "stripe_currency": "inr",
                    "stripe_amount": amount_inr,
                    "payment_status": "paid",
                    "booker_name": name,
                    "booker_email": email,
                    "phone": participant["phone"],
                    "participants": participants_for_enrollment,
                    "participant_count": len(participants_for_enrollment),
                    "attendance": participant["attendance_mode"],
                    "paid_at": now.isoformat(),
                    "created_at": now,
                    "updated_at": now,
                }
            )

        await run_enrollment_razorpay_success_hooks(session_id)
        return {"ok": True, "session_id": session_id, "already_fulfilled": False, "merged_checkout": True}

    session_id = f"rz_{uuid.uuid4().hex}"
    enrollment_id = await _next_receipt_id(db)
    enrollment = {
        "id": enrollment_id,
        "status": "completed",
        "step": 4,
        "booker_name": name,
        "booker_email": email,
        "booker_country": "IN",
        "ip_info": {"country": "IN"},
        "phone": phone,
        "participants": [participant],
        "participant_count": 1,
        "attendance": "online",
        "attendance_label": "Online (Zoom)",
        "item_type": "program",
        "item_id": program_id,
        "item_title": pending_title,
        "tier_index": tier_index,
        "currency": "inr",
        "amount": amount_inr,
        "created_via": "india_landing",
        "checkout_channel": "india_qr",
        "landing_path": landing_path,
        "payment_method": "razorpay",
        "ad_utm": {"utm_medium": "razorpay_plink"},
        "email_verified": False,
        "phone_verified": False,
        "stripe_session_id": session_id,
        "paid_at": now.isoformat(),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }

    month_prefix = now.strftime("%Y-%m")
    count = await db.payment_transactions.count_documents({"invoice_number": {"$regex": f"^{month_prefix}"}})
    invoice_number = f"{month_prefix}-{str(count + 1).zfill(3)}"

    transaction = {
        "id": str(uuid.uuid4()),
        "invoice_number": invoice_number,
        "enrollment_id": enrollment_id,
        "stripe_session_id": session_id,
        "razorpay_order_id": order_id,
        "razorpay_payment_id": pid,
        "razorpay_payment_link_id": (payment_link_id or "").strip(),
        "payment_provider": "razorpay",
        "razorpay_landing": True,
        "razorpay_payment_link": True,
        "created_via": "india_landing_plink",
        "item_type": "program",
        "item_id": program_id,
        "item_title": pending_title,
        "tier_index": tier_index,
        "amount": amount_inr,
        "currency": "inr",
        "stripe_currency": "inr",
        "stripe_amount": amount_inr,
        "payment_status": "paid",
        "booker_name": name,
        "booker_email": email,
        "phone": phone,
        "participants": [participant],
        "participant_count": 1,
        "attendance": "online",
        "paid_at": now.isoformat(),
        "created_at": now,
        "updated_at": now,
    }

    await db.enrollments.insert_one(enrollment)
    await db.payment_transactions.insert_one(transaction)

    try:
        from routes.clients import ensure_client_from_enrollment_lead

        await ensure_client_from_enrollment_lead(enrollment)
    except Exception as exc:
        logger.warning("india program plink lead client: %s", exc)

    await run_enrollment_razorpay_success_hooks(session_id)
    return {"ok": True, "session_id": session_id, "already_fulfilled": False}