"""
Local replacement for emergentintegrations.payments.stripe.checkout.
Provides the same interface using the official stripe SDK directly.
"""
import json
import stripe as stripe_lib
from pydantic import BaseModel
from typing import Optional, List, Dict, Any


class CheckoutSessionRequest(BaseModel):
    amount: float
    currency: str
    success_url: str
    cancel_url: str
    metadata: Optional[Dict[str, str]] = None
    payment_methods: Optional[List[str]] = None


class CheckoutSessionResponse(BaseModel):
    session_id: str
    url: str


class CheckoutStatusResponse(BaseModel):
    payment_status: str
    session_id: str
    metadata: Optional[Dict[str, Any]] = None
    status: Optional[str] = None        # Stripe session status: "open" | "complete" | "expired"
    amount_total: Optional[int] = None  # Amount in cents
    currency: Optional[str] = None


class StripeCheckout:
    def __init__(self, api_key: str, webhook_url: str = ""):
        self.api_key = api_key
        self.webhook_url = webhook_url

    async def create_checkout_session(self, request: CheckoutSessionRequest) -> CheckoutSessionResponse:
        stripe_lib.api_key = self.api_key
        product_name = request.metadata.get("item_title", "Payment") if request.metadata else "Payment"
        session = stripe_lib.checkout.Session.create(
            line_items=[{
                "price_data": {
                    "currency": request.currency,
                    "product_data": {"name": product_name},
                    "unit_amount": int(round(request.amount * 100)),
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=request.success_url,
            cancel_url=request.cancel_url,
            metadata=request.metadata or {},
        )
        return CheckoutSessionResponse(session_id=session.id, url=session.url)

    async def get_checkout_status(self, session_id: str) -> CheckoutStatusResponse:
        """Retrieve the current status of a Checkout Session from Stripe."""
        stripe_lib.api_key = self.api_key
        session = stripe_lib.checkout.Session.retrieve(session_id)
        return CheckoutStatusResponse(
            payment_status=session.payment_status,
            session_id=session.id,
            metadata=dict(session.metadata) if session.metadata else None,
            status=session.status,
            amount_total=session.amount_total,
            currency=session.currency,
        )

    async def handle_webhook(self, body: bytes, signature: str) -> CheckoutStatusResponse:
        """
        Parse a Stripe webhook event. Verifies signature if STRIPE_WEBHOOK_SECRET
        is set in the environment, otherwise parses without verification.
        """
        import os
        webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
        try:
            if webhook_secret and signature:
                event = stripe_lib.Webhook.construct_event(body, signature, webhook_secret)
            else:
                event = json.loads(body)

            event_type = event.get("type", "")
            if event_type in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
                session = event["data"]["object"]
                return CheckoutStatusResponse(
                    payment_status=session.get("payment_status", ""),
                    session_id=session.get("id", ""),
                    metadata=session.get("metadata"),
                )
            # Non-payment event — return neutral status
            return CheckoutStatusResponse(payment_status="", session_id="")
        except Exception as e:
            raise Exception(f"Webhook processing failed: {e}")
