from fastapi import APIRouter, Request
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime, timezone

from emergentintegrations.payments.stripe.checkout import StripeCheckout

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(tags=["Webhook"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')


@router.post("/api/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")

    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)

        if webhook_response.payment_status == "paid":
            session_id = webhook_response.session_id

            # 1. Update payment transaction
            txn = await db.payment_transactions.find_one_and_update(
                {"stripe_session_id": session_id},
                {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc)}},
                return_document=True
            )

            if txn:
                enrollment_id = txn.get("enrollment_id")

                # 2. Update enrollment status to completed
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

                # 3. Send Divine Iris receipt email
                try:
                    from routes.payments import send_enrollment_receipt
                    txn_data = {k: v for k, v in txn.items() if k != '_id'}
                    await send_enrollment_receipt(txn_data, db)
                except Exception as email_err:
                    print(f"Receipt email error: {email_err}")

        return {"status": "ok"}
    except Exception as e:
        print(f"Webhook error: {e}")
        return {"status": "error", "message": str(e)}
