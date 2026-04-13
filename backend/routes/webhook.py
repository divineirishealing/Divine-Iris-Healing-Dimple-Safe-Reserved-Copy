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

            try:
                from routes.points_logic import run_post_payment_loyalty

                txn_clean = {k: v for k, v in txn.items() if k != "_id"}
                await run_post_payment_loyalty(db, txn_clean)
            except Exception as e:
                logger.warning(f"Points webhook loyalty: {e}")

            enrollment_id = txn.get("enrollment_id")
            txn_clean = {k: v for k, v in txn.items() if k != '_id'}
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

        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Webhook processing error: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}


@router.post("/api/webhook/india-payment")
async def india_payment_webhook(request: Request):
    """Webhook for future India payment gateway (Razorpay/PayU).
    Currently a placeholder — will be wired when gateway is configured."""
    body = await request.json()
    logger.info(f"India payment webhook received: {body.get('event', 'unknown')}")
    
    # Future: Handle razorpay.payment.captured, payu.payment.success etc.
    # For now, manual approval flow handles India payments
    
    return {"status": "ok", "message": "Webhook received"}
