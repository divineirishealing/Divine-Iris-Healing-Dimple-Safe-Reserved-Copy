from fastapi import APIRouter, Request
import os, logging
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime, timezone

from emergentintegrations.payments.stripe.checkout import StripeCheckout

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(tags=["Webhook"])
logger = logging.getLogger("routes.webhook")

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')


@router.post("/api/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe checkout.session.completed webhook.
    
    Flow:
    1. Verify webhook signature
    2. Find matching transaction by stripe_session_id
    3. Update transaction status → 'paid'
    4. Update enrollment status → 'completed'
    5. Generate participant UIDs
    6. Send custom Divine Iris receipt email
    """
    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")

    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)

        if webhook_response.payment_status == "paid":
            session_id = webhook_response.session_id
            logger.info(f"Stripe payment confirmed: {session_id}")

            # Step 1: Update payment transaction
            txn = await db.payment_transactions.find_one_and_update(
                {"stripe_session_id": session_id},
                {"$set": {
                    "payment_status": "paid",
                    "paid_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }},
                return_document=True
            )

            if not txn:
                logger.warning(f"No transaction found for session: {session_id}")
                return {"status": "ok", "note": "no matching transaction"}

            txn_clean = {k: v for k, v in txn.items() if k != "_id"}
            is_payment_request = (
                (txn_clean.get("item_type") or "").lower() == "payment_request"
                or txn_clean.get("created_via") == "payment_request"
                or txn_clean.get("payment_request_id")
            )
            if is_payment_request:
                try:
                    from routes.payment_requests import mark_payment_request_paid_by_session

                    await mark_payment_request_paid_by_session(session_id)
                    logger.info("Payment request marked paid for session %s", session_id)
                except Exception as e:
                    logger.warning("Payment request webhook mark paid: %s", e)
                return {"status": "ok"}

            enrollment_id = txn.get("enrollment_id")
            from routes.payments import backfill_transaction_portal_ids

            await backfill_transaction_portal_ids(session_id, txn)
            txn = await db.payment_transactions.find_one({"stripe_session_id": session_id}) or txn

            try:
                from routes.points_logic import run_post_payment_loyalty

                txn_clean = {k: v for k, v in txn.items() if k != "_id"}
                await run_post_payment_loyalty(db, txn_clean)
            except Exception as e:
                logger.warning(f"Points webhook loyalty: {e}")

            txn_clean = {k: v for k, v in txn.items() if k != "_id"}
            logger.info(f"Transaction found: {txn_clean.get('id')} for enrollment: {enrollment_id}")

            # Step 2: Update enrollment status
            if enrollment_id:
                await db.enrollments.update_one(
                    {"id": enrollment_id},
                    {"$set": {
                        "status": "completed",
                        "payment_method": "stripe",
                        "paid_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }}
                )
                logger.info(f"Enrollment {enrollment_id} → completed")

            # Step 3: Generate participant UIDs
            try:
                from routes.payments import generate_participant_uids
                await generate_participant_uids(session_id)
                logger.info(f"UIDs generated for {session_id}")
            except Exception as e:
                logger.warning(f"UID generation error: {e}")

            # Step 4: Send custom Divine Iris receipt (only if not already sent by status poll)
            if not txn.get("emails_sent"):
                try:
                    from routes.payments import send_enrollment_receipt
                    await send_enrollment_receipt(txn_clean)
                    await db.payment_transactions.update_one(
                        {"stripe_session_id": session_id},
                        {"$set": {"emails_sent": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
                    )
                    logger.info(f"Receipt sent for {enrollment_id} to {txn_clean.get('booker_email', 'unknown')}")
                except Exception as e:
                    logger.error(f"Receipt email error for {enrollment_id}: {e}")
                    import traceback
                    traceback.print_exc()
            else:
                logger.info(f"Skipping receipt for {enrollment_id} — already sent via status poll")
                try:
                    from routes.india_payments import sync_home_coming_emis_for_paid_enrollment_tx

                    await sync_home_coming_emis_for_paid_enrollment_tx(txn_clean)
                except Exception as ex:
                    logger.warning("Home Coming EMI sync (Stripe webhook, receipt skipped): %s", ex)

        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Webhook processing error: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}


@router.post("/api/webhook/razorpay")
async def razorpay_webhook(request: Request):
    """Razorpay webhooks — AWRP intro Payment Link fulfillment."""
    import hmac
    import hashlib

    from key_manager import get_key

    raw = await request.body()
    signature = (request.headers.get("X-Razorpay-Signature") or "").strip()
    webhook_secret = (await get_key("razorpay_webhook_secret") or os.environ.get("RAZORPAY_WEBHOOK_SECRET") or "").strip()
    if webhook_secret:
        expected = hmac.new(webhook_secret.encode(), raw, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            logger.warning("Razorpay webhook: invalid signature")
            return {"status": "ignored", "reason": "bad_signature"}
    elif signature:
        logger.warning("Razorpay webhook: X-Razorpay-Signature set but no webhook secret configured")

    import json

    try:
        payload = json.loads(raw.decode("utf-8") if isinstance(raw, (bytes, bytearray)) else raw)
    except Exception:
        logger.warning("Razorpay webhook: invalid JSON")
        return {"status": "ignored"}

    event = (payload.get("event") or "").strip()
    ent = payload.get("payload") or {}
    logger.info("Razorpay webhook event: %s", event)

    payment_id = ""
    payment_link_id = ""
    plink_landing = ""
    plink_program_id = ""
    if event == "payment_link.paid":
        pl_ent = (ent.get("payment_link") or {}).get("entity") or {}
        pay_ent = (ent.get("payment") or {}).get("entity") or {}
        payment_link_id = (pl_ent.get("id") or "").strip()
        payment_id = (pay_ent.get("id") or "").strip()
        pl_notes = pl_ent.get("notes") or {}
        plink_landing = (pl_notes.get("landing") or "").strip()
        plink_program_id = (pl_notes.get("program_id") or pl_notes.get("item_id") or "").strip()
    elif event == "payment.captured":
        pay_ent = (ent.get("payment") or {}).get("entity") or {}
        payment_id = (pay_ent.get("id") or "").strip()
        notes = pay_ent.get("notes") or {}
        landing = (notes.get("landing") or "").strip()
        if landing not in ("awrp-intro", "india-program"):
            return {"status": "ok", "note": "not_landing_plink"}

    if not payment_id:
        return {"status": "ok", "note": "no_payment_id"}

    from key_manager import get_key as get_rzp_key
    from utils.razorpay_payment_links import fetch_razorpay_payment

    key_id = (await get_rzp_key("razorpay_key_id") or "").strip()
    key_secret = (await get_rzp_key("razorpay_key_secret") or "").strip()
    if not key_id or not key_secret:
        return {"status": "error", "message": "razorpay_not_configured"}

    try:
        payment = await fetch_razorpay_payment(
            payment_id=payment_id,
            key_id=key_id,
            key_secret=key_secret,
        )
        landing = ((payment.get("notes") or {}).get("landing") or "").strip() or plink_landing
        if landing not in ("awrp-intro", "india-program") and payment_link_id:
            from utils.india_program_razorpay_plink import _program_id_from_payment_link_cache

            cached_pid, _tier, _path = await _program_id_from_payment_link_cache(db, payment_link_id)
            if cached_pid:
                landing = "india-program"
                if not plink_program_id:
                    plink_program_id = cached_pid
        if landing == "india-program":
            from utils.india_program_razorpay_plink import fulfill_india_program_payment_link_payment

            await fulfill_india_program_payment_link_payment(
                db,
                key_id=key_id,
                key_secret=key_secret,
                payment_id=payment_id,
                payment_link_id=payment_link_id or None,
                expected_program_id=plink_program_id or None,
            )
        elif landing == "awrp-intro":
            from utils.awrp_intro_razorpay_plink import fulfill_awrp_intro_payment_link_payment

            await fulfill_awrp_intro_payment_link_payment(
                db,
                key_id=key_id,
                key_secret=key_secret,
                payment_id=payment_id,
                payment_link_id=payment_link_id or None,
            )
        elif event == "payment_link.paid" and payment_link_id:
            from utils.awrp_intro_razorpay_plink import CACHE_DOC_ID, fulfill_awrp_intro_payment_link_payment

            linked = await db.razorpay_cached_payment_links.find_one(
                {"payment_link_id": payment_link_id},
                {"_id": 1},
            )
            if linked and linked.get("_id") == CACHE_DOC_ID:
                await fulfill_awrp_intro_payment_link_payment(
                    db,
                    key_id=key_id,
                    key_secret=key_secret,
                    payment_id=payment_id,
                    payment_link_id=payment_link_id or None,
                )
            else:
                return {"status": "ok", "note": "unknown_payment_link"}
        else:
            return {"status": "ok", "note": "not_landing_plink"}
    except Exception as exc:
        logger.exception("Razorpay webhook fulfillment failed: %s", exc)
        return {"status": "error", "message": str(exc)[:200]}

    return {"status": "ok"}


@router.post("/api/webhook/india-payment")
async def india_payment_webhook(request: Request):
    """Legacy alias — prefer /api/webhook/razorpay."""
    return await razorpay_webhook(request)
