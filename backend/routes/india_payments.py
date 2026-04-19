from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional, Any, Dict, List
import os, uuid, logging
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime, timezone
import mimetypes

import s3_storage

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/api/india-payments", tags=["India Payments"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

logger = logging.getLogger(__name__)

# ─── Admin enrollment reporting: one `enrollments` collection for all flows ───


def _txn_sort_key(t: dict) -> float:
    v = t.get("updated_at") or t.get("created_at") or t.get("paid_at")
    if v is None:
        return 0.0
    if hasattr(v, "timestamp"):
        try:
            return float(v.timestamp())
        except Exception:
            return 0.0
    if isinstance(v, str):
        try:
            from datetime import datetime as dt

            return dt.fromisoformat(v.replace("Z", "+00:00")).timestamp()
        except Exception:
            return 0.0
    return 0.0


def _pick_best_transaction(txns: List[dict]) -> Optional[dict]:
    """Prefer paid/completed txns; else most recently updated."""
    if not txns:
        return None

    def _is_paid(t: dict) -> bool:
        s = str(t.get("payment_status", "")).lower()
        return s in ("paid", "complete", "completed")

    paid_pool = [t for t in txns if _is_paid(t)]
    pool = paid_pool if paid_pool else txns
    return max(pool, key=_txn_sort_key)


async def _transactions_grouped_by_enrollment(enrollment_ids: List[str]) -> Dict[str, List[dict]]:
    if not enrollment_ids:
        return {}
    all_tx = await db.payment_transactions.find(
        {"enrollment_id": {"$in": enrollment_ids}},
        {"_id": 0},
    ).to_list(20000)
    out: Dict[str, List[dict]] = {}
    for t in all_tx:
        eid = t.get("enrollment_id")
        if not eid:
            continue
        out.setdefault(eid, []).append(t)
    return out


def _enrollment_origin(e: dict) -> str:
    """Rough source: student dashboard annual flow vs public site (cart / program / session pages)."""
    if e.get("dashboard_checkout_ready") or e.get("dashboard_mixed_total") is not None:
        return "dashboard"
    return "website"


def _clean_str(val: Any) -> str:
    if val is None:
        return ""
    s = str(val)
    if s in ("None", "null"):
        return ""
    return s


def _scalar_field(d: dict, *keys: str) -> Any:
    """First non-empty value for any of the keys (exact or case-insensitive)."""
    if not isinstance(d, dict):
        return None
    lower_map = {str(k).lower(): v for k, v in d.items()}
    for k in keys:
        if k in d:
            v = d[k]
            if v is not None and v != "":
                return v
        lk = k.lower()
        if lk in lower_map:
            v = lower_map[lk]
            if v is not None and v != "":
                return v
    return None


def _format_age_for_report(val: Any) -> str:
    if val is None or val == "":
        return ""
    try:
        if isinstance(val, float):
            return str(int(val)) if val == int(val) else str(val).strip()
        return str(int(val))
    except (TypeError, ValueError):
        s = str(val).strip()
        return s


def _merge_participants_for_report(enrollment: dict, txn: Optional[dict]) -> List[dict]:
    """
    Prefer enrollment.participants; merge with transaction.participants index-wise so
    missing fields on one side are filled from the other. If enrollment has no dict rows
    but the txn snapshot does, use txn (fixes sparse / legacy enrollments).
    """
    raw = [x for x in (enrollment.get("participants") or []) if isinstance(x, dict)]
    tx_list = [x for x in ((txn or {}).get("participants") or []) if isinstance(x, dict)]
    if not raw:
        return list(tx_list)
    if not tx_list:
        return list(raw)
    merged: List[dict] = []
    n = max(len(raw), len(tx_list))
    for i in range(n):
        a = raw[i] if i < len(raw) else {}
        b = tx_list[i] if i < len(tx_list) else {}
        m = {**b, **a}
        for k, v in b.items():
            if (m.get(k) in (None, "")) and v not in (None, ""):
                m[k] = v
        merged.append(m)
    return merged


def _notify_yes_from_participant(p: dict) -> bool:
    v = _scalar_field(p, "notify", "notify_enrollment", "Notify")
    if v is None:
        return False
    if isinstance(v, bool):
        return v
    s = str(v).strip().lower()
    return s in ("1", "true", "yes", "y", "on")


def _attendance_mode_from_participant(p: dict) -> str:
    v = _scalar_field(p, "attendance_mode", "attendanceMode", "session_mode", "mode")
    return _clean_str(v).lower() if v is not None and v != "" else ""


def _payment_amount_currency(e: dict, txn: Optional[dict]) -> tuple:
    """Display amount + currency; fall back to dashboard quote when no txn yet."""
    if txn:
        return txn.get("amount", 0) or 0, _clean_str(txn.get("currency")).lower()
    amt = e.get("dashboard_mixed_total")
    cur = _clean_str(e.get("dashboard_mixed_currency")).lower()
    if amt is not None:
        try:
            return float(amt), cur
        except Exception:
            return 0, cur
    return 0, cur


def build_participant_report_rows(
    enrollments: List[dict],
    txns_by_eid: Dict[str, List[dict]],
    *,
    paid_completed_only: bool = False,
) -> List[dict]:
    """
    One row per participant (or one booker row if participants missing).
    Includes enrollment form fields: relationship, gender, city, state, attendance, notify, referral, etc.
    Covers dashboard, cart, program page, session page, upcoming — all use `enrollments`.
    """
    rows: List[dict] = []
    done_status = frozenset(
        {
            "completed",
            "paid",
            "india_payment_approved",
        }
    )

    for e in enrollments:
        eid = e.get("id") or ""
        st = (e.get("status") or "").lower()
        txn = _pick_best_transaction(txns_by_eid.get(eid) or [])
        pay_st = _clean_str((txn or {}).get("payment_status")).lower()
        is_done = (
            pay_st in ("paid", "complete", "completed")
            or st in done_status
            or e.get("step") == 5
        )

        if paid_completed_only and not is_done:
            continue

        amt, cur = _payment_amount_currency(e, txn)
        inv = _clean_str((txn or {}).get("invoice_number")) or _clean_str(e.get("invoice_number"))
        program = _clean_str(e.get("item_title"))
        item_type = _clean_str(e.get("item_type"))
        booker_name = _clean_str(e.get("booker_name"))
        booker_email = _clean_str(e.get("booker_email"))
        booker_phone = _clean_str(e.get("phone"))
        booker_country = _clean_str(e.get("booker_country"))
        created = _clean_str(e.get("created_at"))
        origin = _enrollment_origin(e)

        participants = _merge_participants_for_report(e, txn)
        total_slots = len(participants) if participants else 1

        def push_row(p: Optional[dict], index: int, *, booker_only: bool) -> None:
            if booker_only or p is None:
                ph = booker_phone
                wa = booker_phone
                rows.append(
                    {
                        "invoice_number": inv,
                        "enrollment_id": eid,
                        "program": program,
                        "item_type": item_type,
                        "enrollment_status": _clean_str(e.get("status")),
                        "enrollment_origin": origin,
                        "booker_name": booker_name,
                        "booker_email": booker_email,
                        "booker_phone": booker_phone,
                        "booker_country": booker_country,
                        "participant_index": 1,
                        "participant_total": 1,
                        "participant_name": booker_name,
                        "relationship": "",
                        "age": "",
                        "gender": "",
                        "country": booker_country,
                        "city": "",
                        "state": "",
                        "attendance_mode": "",
                        "notify_enrollment": "",
                        "participant_email": booker_email,
                        "phone": ph,
                        "whatsapp": wa,
                        "is_first_time": "",
                        "referral_source": "",
                        "referred_by_name": "",
                        "referred_by_email": "",
                        "participant_program_id": "",
                        "participant_program_title": "",
                        "participant_uid": "",
                        "payment_amount": amt,
                        "payment_currency": cur,
                        "payment_status": pay_st or _clean_str(e.get("status")),
                        "created_at": created,
                    }
                )
                return

            p_phone = _clean_str(_scalar_field(p, "phone", "Phone"))
            p_wa = _clean_str(_scalar_field(p, "whatsapp", "WhatsApp"))
            ph = p_phone or booker_phone
            wa = (p_wa or p_phone) or ph
            notify_yes = _notify_yes_from_participant(p)
            first_time_v = _scalar_field(p, "is_first_time", "isFirstTime")
            is_first = bool(first_time_v) if isinstance(first_time_v, bool) else str(first_time_v).strip().lower() in ("1", "true", "yes")
            rows.append(
                {
                    "invoice_number": inv,
                    "enrollment_id": eid,
                    "program": program,
                    "item_type": item_type,
                    "enrollment_status": _clean_str(e.get("status")),
                    "enrollment_origin": origin,
                    "booker_name": booker_name,
                    "booker_email": booker_email,
                    "booker_phone": booker_phone,
                    "booker_country": booker_country,
                    "participant_index": index,
                    "participant_total": total_slots,
                    "participant_name": _clean_str(_scalar_field(p, "name", "Name")) or booker_name,
                    "relationship": _clean_str(_scalar_field(p, "relationship", "Relationship")),
                    "age": _format_age_for_report(_scalar_field(p, "age", "Age")),
                    "gender": _clean_str(_scalar_field(p, "gender", "Gender")),
                    "country": _clean_str(_scalar_field(p, "country", "Country")) or booker_country,
                    "city": _clean_str(_scalar_field(p, "city", "City")),
                    "state": _clean_str(_scalar_field(p, "state", "State")),
                    "attendance_mode": _attendance_mode_from_participant(p),
                    "notify_enrollment": "Yes" if notify_yes else "No",
                    "participant_email": _clean_str(_scalar_field(p, "email", "Email")),
                    "phone": ph,
                    "whatsapp": wa,
                    "is_first_time": "Yes" if is_first else "No",
                    "referral_source": _clean_str(_scalar_field(p, "referral_source", "referralSource")),
                    "referred_by_name": _clean_str(_scalar_field(p, "referred_by_name", "referredByName")),
                    "referred_by_email": _clean_str(_scalar_field(p, "referred_by_email", "referredByEmail")),
                    "participant_program_id": _clean_str(_scalar_field(p, "program_id", "programId")),
                    "participant_program_title": _clean_str(_scalar_field(p, "program_title", "programTitle")),
                    "participant_uid": _clean_str(_scalar_field(p, "uid", "UID")),
                    "payment_amount": amt,
                    "payment_currency": cur,
                    "payment_status": pay_st or _clean_str(e.get("status")),
                    "created_at": created,
                }
            )

        if not participants:
            push_row(None, 1, booker_only=True)
        else:
            for i, p in enumerate(participants, start=1):
                push_row(p, i, booker_only=False)

    return rows


UPLOAD_DIR = ROOT_DIR / "uploads" / "payment_proofs"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/submit-proof")
async def submit_payment_proof(
    enrollment_id: str = Form(...),
    payer_name: str = Form(...),
    payer_email: str = Form(""),
    payer_phone: str = Form(""),
    payment_date: str = Form(...),
    bank_name: str = Form(""),
    transaction_id: str = Form(...),
    amount: str = Form(...),
    city: str = Form(""),
    state: str = Form(""),
    payment_method: str = Form(""),
    program_type: str = Form(""),
    selected_item: str = Form(""),
    is_emi: str = Form("false"),
    emi_total_months: str = Form(""),
    emi_months_covered: str = Form(""),
    notes: str = Form(""),
    screenshot: Optional[UploadFile] = File(None),
):
    """Submit India alternative payment proof for admin approval."""
    # Validate enrollment exists (skip for standalone 'MANUAL' submissions)
    enrollment = {}
    if enrollment_id != "MANUAL":
        enrollment = await db.enrollments.find_one({"id": enrollment_id}, {"_id": 0}) or {}

    pm = (payment_method or "").strip().lower()
    requires_screenshot = pm in {"cash_deposit", "cheque"}
    if requires_screenshot:
        if screenshot is None or not (getattr(screenshot, "filename", None) or "").strip():
            if pm == "cheque":
                detail = "Payment screenshot is required for cheque (e.g. scan or photo of the cheque / deposit proof)."
            else:
                detail = "Payment screenshot is required for cash deposit (e.g. deposit slip or receipt)."
            raise HTTPException(status_code=400, detail=detail)

    if pm in {"cash_deposit", "cheque"} and not (notes or "").strip():
        raise HTTPException(
            status_code=400,
            detail="Notes are required: who deposited or issued the cheque, which city, and which bank / branch.",
        )

    if pm == "upi" and not (notes or "").strip():
        raise HTTPException(
            status_code=400,
            detail="Notes are required for UPI / GPay: who paid (name as on the app) and when you paid (date/time if possible).",
        )

    screenshot_public_url = ""
    if screenshot is not None and (getattr(screenshot, "filename", None) or "").strip():
        # Save screenshot (S3 when configured, else local disk unless REQUIRE_S3_FOR_UPLOADS)
        ext = screenshot.filename.split(".")[-1] if "." in screenshot.filename else "png"
        filename = f"{uuid.uuid4().hex[:12]}.{ext}"
        proof_bytes = await screenshot.read()
        mime, _ = mimetypes.guess_type(filename)
        mime = mime or "image/png"
        must_s3 = s3_storage.media_must_use_s3()
        if must_s3 and not s3_storage.is_s3_enabled():
            raise HTTPException(
                status_code=503,
                detail=(
                    "Payment proof screenshots must be stored in S3 (REQUIRE_S3_FOR_UPLOADS) but S3 is not configured. "
                    "See GET /api/upload/storage-status."
                ),
            )
        if s3_storage.is_s3_enabled():
            key = s3_storage.payment_proof_key(filename)
            try:
                screenshot_public_url = s3_storage.upload_bytes(key, proof_bytes, mime)
            except Exception as e:
                if must_s3:
                    raise HTTPException(status_code=503, detail=f"S3 upload failed: {e}") from e
                logger.warning("S3 payment proof upload failed; saving locally: %s", e)
                filepath = UPLOAD_DIR / filename
                with open(filepath, "wb") as f:
                    f.write(proof_bytes)
                screenshot_public_url = f"/api/uploads/payment_proofs/{filename}"
        else:
            filepath = UPLOAD_DIR / filename
            with open(filepath, "wb") as f:
                f.write(proof_bytes)
            screenshot_public_url = f"/api/uploads/payment_proofs/{filename}"

    proof = {
        "id": str(uuid.uuid4()),
        "enrollment_id": enrollment_id,
        "booker_name": enrollment.get("booker_name", payer_name),
        "booker_email": enrollment.get("booker_email", payer_email),
        "payer_name": payer_name,
        "payer_email": payer_email,
        "payer_phone": payer_phone,
        "payment_date": payment_date,
        "bank_name": bank_name,
        "transaction_id": transaction_id,
        "program_type": program_type,
        "selected_item": selected_item,
        "item_id": (enrollment.get("item_id") or "").strip() if enrollment else "",
        "item_type": ((enrollment.get("item_type") or "program") if enrollment else "program").strip().lower(),
        "program_title": enrollment.get("item_title", selected_item or program_type),
        "amount": amount,
        "city": city,
        "state": state,
        "payment_method": payment_method,
        "is_emi": is_emi == "true",
        "emi_total_months": int(emi_total_months) if emi_total_months else None,
        "emi_months_covered": int(emi_months_covered) if emi_months_covered else None,
        "notes": notes,
        "screenshot_url": screenshot_public_url,
        "status": "pending",
        "participants": enrollment.get("participants", []),
        "participant_count": enrollment.get("participant_count", 1),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.india_payment_proofs.insert_one(proof)

    # Update enrollment status if linked
    if enrollment_id != "MANUAL" and enrollment:
        await db.enrollments.update_one(
            {"id": enrollment_id},
            {"$set": {
                "status": "india_payment_proof_submitted",
                "india_payment_proof_id": proof["id"],
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }}
        )

    logger.info(f"[INDIA PAYMENT PROOF] enrollment={enrollment_id}, txn={transaction_id}, amount={amount}")
    return {"message": "Payment proof submitted successfully. Awaiting admin approval.", "proof_id": proof["id"]}


@router.get("/admin/list")
async def list_payment_proofs():
    """Admin: list all India payment proofs."""
    proofs = await db.india_payment_proofs.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return proofs


@router.put("/admin/proofs/{proof_id}")
async def update_payment_proof(proof_id: str, data: dict):
    """Admin: edit a submitted payment proof before approving."""
    allowed_fields = ['payer_name', 'booker_email', 'amount', 'transaction_id', 'program_title',
                       'bank_name', 'payment_date', 'payment_method', 'city', 'state', 'admin_notes', 'phone']
    update = {k: v for k, v in data.items() if k in allowed_fields and v is not None}
    if 'amount' in update:
        try: update['amount'] = float(update['amount'])
        except: pass
    update['updated_at'] = datetime.now(timezone.utc).isoformat()
    await db.india_payment_proofs.update_one({"id": proof_id}, {"$set": update})
    return {"message": "Proof updated"}



@router.post("/admin/{proof_id}/approve")
async def approve_payment_proof(proof_id: str):
    """Admin: approve India payment proof and complete enrollment."""
    proof = await db.india_payment_proofs.find_one({"id": proof_id}, {"_id": 0})
    if not proof:
        raise HTTPException(status_code=404, detail="Payment proof not found")

    # Mark proof as approved
    await db.india_payment_proofs.update_one(
        {"id": proof_id},
        {"$set": {"status": "approved", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    enrollment_id = proof.get("enrollment_id")

    program_title_for_match = (proof.get("program_title") or "").strip()
    matched_program = None
    if program_title_for_match:
        matched_program = await db.programs.find_one(
            {"title": {"$regex": program_title_for_match, "$options": "i"}}, {"_id": 0}
        )
        if not matched_program:
            matched_program = await db.programs.find_one(
                {"title": {"$regex": program_title_for_match.split("(")[0].strip(), "$options": "i"}}, {"_id": 0}
            )
    if not matched_program and program_title_for_match:
        matched_program = await db.sessions.find_one(
            {"title": {"$regex": program_title_for_match, "$options": "i"}}, {"_id": 0}
        )

    fallback_item_id = (proof.get("item_id") or "").strip() or (matched_program.get("id") if matched_program else "")
    fallback_item_type = (
        "session"
        if (matched_program and "session_mode" in matched_program and "category" not in matched_program)
        else "program"
    )
    title_for_synthetic = (
        program_title_for_match
        or (proof.get("selected_item") or "").strip()
        or (proof.get("program_type") or "").strip()
    )

    # If no real enrollment exists (manual submissions), create one
    if not enrollment_id or enrollment_id == "MANUAL":
        enrollment_id = f"DIH-{int(datetime.now(timezone.utc).timestamp()) % 100000}-{uuid.uuid4().hex[:3]}"
        new_enrollment = {
            "id": enrollment_id,
            "booker_name": proof.get("payer_name", ""),
            "booker_email": proof.get("booker_email", ""),
            "booker_country": "IN",
            "phone": proof.get("phone", ""),
            "item_type": fallback_item_type,
            "item_id": fallback_item_id,
            "item_title": title_for_synthetic,
            "participant_count": proof.get("participant_count", 1),
            "participants": proof.get("participants", [{"name": proof.get("payer_name", ""), "email": proof.get("booker_email", "")}]),
            "status": "completed",
            "step": 5,
            "payment_method": "manual_proof",
            "bank_name": proof.get("bank_name", ""),
            "is_india_alt": True,
            "paid_at": datetime.now(timezone.utc).isoformat(),
            "created_at": proof.get("created_at", datetime.now(timezone.utc).isoformat()),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.enrollments.insert_one(new_enrollment)
        await db.india_payment_proofs.update_one({"id": proof_id}, {"$set": {"enrollment_id": enrollment_id}})

    if enrollment_id:
        full_enrollment = await db.enrollments.find_one({"id": enrollment_id}, {"_id": 0}) or {}

        resolved_item_id = (
            (full_enrollment.get("item_id") or "").strip()
            or (proof.get("item_id") or "").strip()
            or fallback_item_id
        )
        resolved_item_type = (full_enrollment.get("item_type") or "").strip().lower()
        if resolved_item_type not in ("program", "session"):
            resolved_item_type = fallback_item_type
        resolved_item_title = (
            (full_enrollment.get("item_title") or "").strip()
            or (proof.get("program_title") or "").strip()
            or (proof.get("selected_item") or "").strip()
            or title_for_synthetic
        )
        try:
            resolved_participant_count = int(full_enrollment.get("participant_count") or proof.get("participant_count") or 1)
        except (TypeError, ValueError):
            resolved_participant_count = int(proof.get("participant_count") or 1)
        resolved_participants = full_enrollment.get("participants") or proof.get("participants") or []

        booker_email_resolved = (
            (full_enrollment.get("booker_email") or "").strip()
            or (proof.get("booker_email") or "").strip()
            or (proof.get("payer_email") or "").strip()
        )
        payer_email_resolved = (
            (proof.get("payer_email") or "").strip()
            or (proof.get("booker_email") or "").strip()
            or booker_email_resolved
        )
        booker_name_resolved = (
            (full_enrollment.get("booker_name") or "").strip()
            or (proof.get("booker_name") or "").strip()
            or (proof.get("payer_name") or "").strip()
        )
        phone_resolved = (full_enrollment.get("phone") or "").strip() or (proof.get("payer_phone") or "").strip()

        be_norm = (booker_email_resolved or "").strip().lower()
        pe_norm = (payer_email_resolved or "").strip().lower()
        portal_user_doc = None
        if be_norm:
            portal_user_doc = await db.users.find_one({"email": be_norm}, {"id": 1, "client_id": 1})
        if not portal_user_doc and pe_norm and pe_norm != be_norm:
            portal_user_doc = await db.users.find_one({"email": pe_norm}, {"id": 1, "client_id": 1})

        # Same fields drive receipt email (_send_receipt_and_notifications) and student order history.
        fake_session_id = f"india_{uuid.uuid4().hex[:12]}"
        transaction = {
            "id": str(uuid.uuid4()),
            "enrollment_id": enrollment_id,
            "stripe_session_id": fake_session_id,
            "item_type": resolved_item_type,
            "item_id": resolved_item_id,
            "item_title": resolved_item_title,
            "amount": float(proof.get("amount", 0)),
            "currency": "inr",
            "payment_status": "paid",
            "payment_method": "manual_proof",
            "bank_name": proof.get("bank_name", ""),
            "booker_name": booker_name_resolved,
            "booker_email": be_norm or booker_email_resolved,
            "payer_email": pe_norm or be_norm or payer_email_resolved,
            "phone": phone_resolved,
            "participants": resolved_participants,
            "participant_count": resolved_participant_count,
            "is_india_alt": True,
            "india_proof_id": proof_id,
            "india_payment_method": (proof.get("payment_method") or "").strip().lower(),
            "invoice_number": "",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        if full_enrollment.get("tier_index") is not None:
            try:
                transaction["tier_index"] = int(full_enrollment["tier_index"])
            except (TypeError, ValueError):
                pass
        if portal_user_doc:
            transaction["portal_user_id"] = portal_user_doc.get("id")
            pcid = (portal_user_doc.get("client_id") or "").strip()
            if pcid:
                transaction["portal_client_id"] = pcid
        # Generate invoice number
        month_prefix = datetime.now(timezone.utc).strftime("%Y-%m")
        count = await db.payment_transactions.count_documents({"invoice_number": {"$regex": f"^{month_prefix}"}})
        transaction["invoice_number"] = f"{month_prefix}-{str(count + 1).zfill(3)}"
        await db.payment_transactions.insert_one(transaction)

        try:
            from routes.points_logic import run_post_payment_loyalty

            txn_clean = {k: v for k, v in transaction.items() if k != "_id"}
            await run_post_payment_loyalty(db, txn_clean)
        except Exception as e:
            logger.warning(f"India proof loyalty points: {e}")

        # Complete enrollment — keep booker contact in sync so receipt email + portal order history match the payer
        enrollment_complete = {
            "step": 5,
            "status": "completed",
            "payment_method": "manual_proof",
            "bank_name": proof.get("bank_name", ""),
            "stripe_session_id": fake_session_id,
            "is_india_alt": True,
            "paid_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if (booker_email_resolved or "").strip():
            enrollment_complete["booker_email"] = be_norm or (booker_email_resolved or "").strip().lower()
        if (booker_name_resolved or "").strip():
            enrollment_complete["booker_name"] = (booker_name_resolved or "").strip()
        await db.enrollments.update_one(
            {"id": enrollment_id},
            {"$set": enrollment_complete},
        )

        # Generate UIDs and send receipt email
        try:
            from routes.payments import generate_participant_uids, send_enrollment_receipt
            await generate_participant_uids(fake_session_id)
            # Send receipt directly (not via create_task to avoid silent failures)
            txn_clean = {k: v for k, v in transaction.items() if k != '_id'}
            await send_enrollment_receipt(txn_clean)
            logger.info(
                "Receipt sent for manual proof %s to %s",
                proof_id,
                (booker_email_resolved or proof.get("payer_email") or proof.get("booker_email") or ""),
            )
        except Exception as e:
            logger.warning(f"Error generating UIDs/emails for India payment: {e}")
            import traceback
            traceback.print_exc()

    # Auto-flag as annual subscriber if the program is marked is_annual_program
    try:
        booker_email_for_annual = (booker_email_resolved or proof.get("booker_email") or "").strip().lower()
        if matched_program and matched_program.get("is_annual_program") and booker_email_for_annual:
            await db.clients.update_one(
                {"email": booker_email_for_annual},
                {"$set": {"is_annual_subscriber": True, "portal_login_allowed": True}},
            )
    except Exception as e:
        logger.warning(f"Could not auto-flag annual subscriber: {e}")

    return {"message": "Payment proof approved. Enrollment completed.", "status": "approved"}


@router.post("/admin/{proof_id}/reject")
async def reject_payment_proof(proof_id: str, reason: str = ""):
    """Admin: reject India payment proof."""
    proof = await db.india_payment_proofs.find_one({"id": proof_id})
    if not proof:
        raise HTTPException(status_code=404, detail="Payment proof not found")

    await db.india_payment_proofs.update_one(
        {"id": proof_id},
        {"$set": {"status": "rejected", "reject_reason": reason, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    enrollment_id = proof.get("enrollment_id")


@router.get("/admin/enrollments")
async def list_enrollments():
    """Admin: list all enrollments with payment details (all checkout paths use `enrollments`)."""
    enrollments = await db.enrollments.find({}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    eids = [e.get("id") for e in enrollments if e.get("id")]
    by_e = await _transactions_grouped_by_enrollment(eids)
    for e in enrollments:
        eid = e.get("id")
        txn = _pick_best_transaction(by_e.get(eid) or [])
        e["payment"] = txn
        e["enrollment_origin"] = _enrollment_origin(e)
        if txn and txn.get("invoice_number"):
            e["invoice_number"] = txn["invoice_number"]
    return enrollments


@router.get("/admin/enrollments/participant-rows")
async def participant_enrollment_rows(paid_completed_only: bool = False):
    """
    Flat report: one row per participant (never merged into one cell) with enrollment form fields
    including notify, relationship, city/state, attendance, referral, participant email, etc.
    Payment amount/currency is the checkout total (repeated on each row for multi-seat enrollments).
    """
    enrollments = await db.enrollments.find({}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    eids = [e.get("id") for e in enrollments if e.get("id")]
    by_e = await _transactions_grouped_by_enrollment(eids)
    return build_participant_report_rows(
        enrollments,
        by_e,
        paid_completed_only=paid_completed_only,
    )


async def build_participant_report_xlsx_bytes(paid_completed_only: bool = False) -> bytes:
    """Build participant-level enrollment Excel as raw bytes (HTTP download or email attachment)."""
    import io

    try:
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    except ImportError:
        raise RuntimeError("openpyxl not installed")

    enrollments = await db.enrollments.find({}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    eids = [e.get("id") for e in enrollments if e.get("id")]
    by_e = await _transactions_grouped_by_enrollment(eids)
    rows = build_participant_report_rows(
        enrollments,
        by_e,
        paid_completed_only=paid_completed_only,
    )

    headers = [
        "Invoice #",
        "Enrollment ID",
        "Program",
        "Type",
        "Enrollment status",
        "Origin",
        "Booker name",
        "Booker email",
        "Booker phone",
        "Booker country",
        "Participant #",
        "Of total",
        "Participant name",
        "Relationship",
        "Age",
        "Gender",
        "Country",
        "City",
        "State",
        "Attendance mode",
        "Notify enrollment",
        "Participant email",
        "Phone",
        "WhatsApp",
        "First time",
        "Referral source",
        "Referred by name",
        "Referred by email",
        "Participant program ID",
        "Participant program title",
        "Participant UID",
        "Payment amount",
        "Currency",
        "Payment status",
        "Created",
    ]

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Participants"

    header_font = Font(bold=True, color="FFFFFF", size=11)
    header_fill = PatternFill(start_color="4A148C", end_color="4A148C", fill_type="solid")
    thin_border = Border(
        left=Side(style="thin"),
        right=Side(style="thin"),
        top=Side(style="thin"),
        bottom=Side(style="thin"),
    )

    for col_idx, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_idx, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center", wrap_text=True)
        cell.border = thin_border

    last_col = openpyxl.utils.get_column_letter(len(headers))
    ws.auto_filter.ref = f"A1:{last_col}1"
    ws.freeze_panes = "A2"

    for r in rows:
        created = _clean_str(r.get("created_at"))
        if created:
            try:
                from datetime import datetime as dt

                d = dt.fromisoformat(created.replace("Z", "+00:00"))
                created = d.strftime("%Y-%m-%d %H:%M")
            except Exception:
                pass
        ws.append(
            [
                _clean_str(r.get("invoice_number")),
                _clean_str(r.get("enrollment_id")),
                _clean_str(r.get("program")),
                _clean_str(r.get("item_type")),
                _clean_str(r.get("enrollment_status")),
                _clean_str(r.get("enrollment_origin")),
                _clean_str(r.get("booker_name")),
                _clean_str(r.get("booker_email")),
                _clean_str(r.get("booker_phone")),
                _clean_str(r.get("booker_country")),
                r.get("participant_index", "") or "",
                r.get("participant_total", "") or "",
                _clean_str(r.get("participant_name")),
                _clean_str(r.get("relationship")),
                _clean_str(r.get("age")),
                _clean_str(r.get("gender")),
                _clean_str(r.get("country")),
                _clean_str(r.get("city")),
                _clean_str(r.get("state")),
                _clean_str(r.get("attendance_mode")),
                _clean_str(r.get("notify_enrollment")),
                _clean_str(r.get("participant_email")),
                _clean_str(r.get("phone")),
                _clean_str(r.get("whatsapp")),
                _clean_str(r.get("is_first_time")),
                _clean_str(r.get("referral_source")),
                _clean_str(r.get("referred_by_name")),
                _clean_str(r.get("referred_by_email")),
                _clean_str(r.get("participant_program_id")),
                _clean_str(r.get("participant_program_title")),
                _clean_str(r.get("participant_uid")),
                r.get("payment_amount", 0) or 0,
                _clean_str(r.get("payment_currency")),
                _clean_str(r.get("payment_status")),
                created,
            ]
        )

    for col in ws.columns:
        max_len = min(max(len(str(cell.value or "")) for cell in col) + 2, 45)
        ws.column_dimensions[col[0].column_letter].width = max_len

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output.getvalue()


@router.get("/admin/enrollments/clean-export")
async def export_participant_enrollments_excel(paid_completed_only: bool = False):
    """Excel: one row per participant — clean columns for ops."""
    import io

    try:
        data = await build_participant_report_xlsx_bytes(paid_completed_only=paid_completed_only)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    from fastapi.responses import StreamingResponse

    suffix = "paid_only" if paid_completed_only else "all"
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=enrollments_by_participant_{suffix}.xlsx"
        },
    )


@router.get("/admin/enrollments/export")
async def export_enrollments_excel():
    """Admin: export all enrollments as Excel — wide format, one row per enrollment, database-ready."""
    import io
    try:
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    except ImportError:
        raise HTTPException(status_code=500, detail="openpyxl not installed")

    def clean(val):
        """Convert any value to a clean string. None/null → empty string."""
        if val is None:
            return ""
        s = str(val)
        if s in ("None", "null"):
            return ""
        return s

    enrollments = await db.enrollments.find({}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    eids = [e.get("id") for e in enrollments if e.get("id")]
    by_e = await _transactions_grouped_by_enrollment(eids)

    # Determine max participant count across all enrollments
    max_participants = 0
    for e in enrollments:
        count = len(e.get("participants") or [])
        if count > max_participants:
            max_participants = count
    max_participants = max(max_participants, 1)

    # Payment data (prefer paid txn when multiple exist)
    for e in enrollments:
        txn = _pick_best_transaction(by_e.get(e.get("id")) or [])
        if txn:
            e["invoice_number"] = txn.get("invoice_number", "")
            e["payment_amount"] = txn.get("amount", 0)
            e["payment_currency"] = txn.get("currency", "")
            e["payment_status_txn"] = txn.get("payment_status", "")
            e["payment_method"] = txn.get("payment_method", "") or e.get("payment_method", "")
            e["bank_name"] = txn.get("bank_name", "") or e.get("bank_name", "")
            e["stripe_session_id"] = txn.get("stripe_session_id", "")

    # Build headers: base columns + per-participant columns
    base_headers = [
        "Invoice #", "Receipt ID", "Status", "Program", "Program Type", "Origin",
        "Booker Name", "Booker Email", "Booker Country", "Booker Phone",
        "Participant Count", "Payment Amount", "Payment Currency", "Payment Method",
        "Bank Account", "Payment Status", "Admin Notes", "Promo Code",
        "VPN Detected", "Enrollment Date",
    ]

    participant_fields = [
        "Name", "Relationship", "Age", "Gender", "Country", "City", "State",
        "Attendance Mode", "Notify", "Is First Time", "Referral Source", "Referred By",
        "Referred By Email", "Email", "Phone", "WhatsApp", "UID",
    ]

    headers = list(base_headers)
    for i in range(1, max_participants + 1):
        for field in participant_fields:
            headers.append(f"Participant {i} {field}")

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Enrollments"

    # Style header
    header_font = Font(bold=True, color="FFFFFF", size=11)
    header_fill = PatternFill(start_color="4A148C", end_color="4A148C", fill_type="solid")
    thin_border = Border(
        left=Side(style='thin'), right=Side(style='thin'),
        top=Side(style='thin'), bottom=Side(style='thin')
    )

    for col_idx, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_idx, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal='center', wrap_text=True)
        cell.border = thin_border

    # Build column letter ref for auto_filter
    last_col = openpyxl.utils.get_column_letter(len(headers))
    ws.auto_filter.ref = f"A1:{last_col}1"
    ws.freeze_panes = "A2"

    for e in enrollments:
        # Format created_at
        created_at = clean(e.get("created_at"))
        if created_at:
            try:
                from datetime import datetime as dt
                d = dt.fromisoformat(created_at.replace("Z", "+00:00")) if isinstance(created_at, str) else created_at
                created_at = d.strftime("%Y-%m-%d %H:%M")
            except Exception:
                pass

        # Base row data
        row = [
            clean(e.get("invoice_number")),
            clean(e.get("id")),
            clean(e.get("status")),
            clean(e.get("item_title")),
            clean(e.get("item_type")),
            _enrollment_origin(e),
            clean(e.get("booker_name")),
            clean(e.get("booker_email")),
            clean(e.get("booker_country")),
            clean(e.get("phone")),
            str(e.get("participant_count", 0) or 0),
            str(e.get("payment_amount", 0) or 0),
            clean(e.get("payment_currency")),
            clean(e.get("payment_method")),
            clean(e.get("bank_name")),
            clean(e.get("payment_status_txn") or e.get("status")),
            clean(e.get("admin_notes")),
            clean(e.get("promo_code")),
            "Yes" if e.get("vpn_detected") else "No",
            created_at,
        ]

        # Append participant columns (wide format)
        participants = e.get("participants") or []
        for i in range(max_participants):
            if i < len(participants):
                p = participants[i]
                p_phone = clean(p.get("phone"))
                p_wa = clean(p.get("whatsapp"))
                notify_yes = _notify_yes_from_participant(p)
                row.extend([
                    clean(p.get("name")),
                    clean(p.get("relationship")),
                    clean(p.get("age")),
                    clean(p.get("gender")),
                    clean(p.get("country")),
                    clean(p.get("city")),
                    clean(p.get("state")),
                    clean(p.get("attendance_mode")),
                    "Yes" if notify_yes else "No",
                    "Yes" if p.get("is_first_time") else "No",
                    clean(p.get("referral_source")),
                    clean(p.get("referred_by_name")),
                    clean(p.get("referred_by_email")),
                    clean(p.get("email")),
                    p_phone,
                    p_wa,
                    clean(p.get("uid")),
                ])
            else:
                # Empty columns for missing participants
                row.extend([""] * len(participant_fields))

        ws.append(row)

    # Auto-size columns
    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 3, 40)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    from fastapi.responses import StreamingResponse
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=enrollments.xlsx"}
    )


@router.get("/client-tax/{enrollment_id}")
async def get_client_tax_for_enrollment(enrollment_id: str):
    """Return per-client India tax settings for a given enrollment.

    Used by IndiaPaymentPage to apply the correct tax at checkout.
    Falls back to nulls when no tax is configured for the client.
    """
    enrollment = await db.enrollments.find_one(
        {"id": enrollment_id},
        {"_id": 0, "booker_email": 1, "client_id": 1},
    )
    if not enrollment:
        return {"india_tax_enabled": False}

    # Look up client by email or client_id
    client_doc = None
    booker_email = (enrollment.get("booker_email") or "").strip().lower()
    client_id = (enrollment.get("client_id") or "").strip()

    _proj = {"_id": 0, "india_payment_method": 1, "india_discount_percent": 1, "india_tax_enabled": 1, "india_tax_percent": 1, "india_tax_label": 1, "india_tax_visible_on_dashboard": 1}
    if client_id:
        client_doc = await db.clients.find_one({"id": client_id}, _proj)
    if not client_doc and booker_email:
        client_doc = await db.clients.find_one({"email": booker_email}, _proj)

    if not client_doc:
        return {"india_tax_enabled": False}

    return {
        "india_payment_method": client_doc.get("india_payment_method") or None,
        "india_discount_percent": client_doc.get("india_discount_percent"),  # None = use site default
        "india_tax_enabled": bool(client_doc.get("india_tax_enabled")),
        "india_tax_percent": client_doc.get("india_tax_percent", 18.0),
        "india_tax_label": client_doc.get("india_tax_label", "GST"),
        "india_tax_visible_on_dashboard": client_doc.get("india_tax_visible_on_dashboard", True),
    }
