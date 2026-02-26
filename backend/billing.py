"""
Stripe billing integration for JegsMedLab.
Handles subscriptions, webhooks, and plan enforcement.
"""
import stripe
import os
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")

STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PRO_PRICE_ID = os.getenv("STRIPE_PRO_PRICE_ID", "")

FREE_LIMITS = {
    "uploads_per_month": 3,
    "questions_per_month": 10,
}


def is_stripe_configured() -> bool:
    return bool(stripe.api_key and stripe.api_key.startswith("sk_"))


def create_checkout_session(user_email: str, user_id: str, success_url: str, cancel_url: str) -> str:
    """Create a Stripe Checkout session for Pro subscription."""
    if not is_stripe_configured():
        raise ValueError("Stripe is not configured. Add STRIPE_SECRET_KEY to .env")

    session = stripe.checkout.Session.create(
        customer_email=user_email,
        payment_method_types=["card"],
        line_items=[{"price": STRIPE_PRO_PRICE_ID, "quantity": 1}],
        mode="subscription",
        success_url=success_url + "?session_id={CHECKOUT_SESSION_ID}",
        cancel_url=cancel_url,
        metadata={"user_id": user_id},
        subscription_data={
            "trial_period_days": 7,
            "metadata": {"user_id": user_id},
        },
    )
    return session.url


def create_billing_portal_session(stripe_customer_id: str, return_url: str) -> str:
    """Create a Stripe Customer Portal session for managing subscription."""
    if not is_stripe_configured():
        raise ValueError("Stripe is not configured.")

    session = stripe.billing_portal.Session.create(
        customer=stripe_customer_id,
        return_url=return_url,
    )
    return session.url


def handle_webhook(payload: bytes, sig_header: str) -> dict:
    """Process a Stripe webhook event. Returns event data for routing."""
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except stripe.error.SignatureVerificationError:
        raise ValueError("Invalid webhook signature")

    return {"type": event["type"], "data": event["data"]["object"]}


def get_subscription_status(stripe_customer_id: str) -> dict:
    """Check current subscription status for a customer."""
    if not is_stripe_configured() or not stripe_customer_id:
        return {"plan": "free", "status": "active"}

    try:
        subscriptions = stripe.Subscription.list(
            customer=stripe_customer_id,
            status="active",
            limit=1,
        )
        if subscriptions.data:
            sub = subscriptions.data[0]
            return {
                "plan": "pro",
                "status": sub.status,
                "current_period_end": datetime.fromtimestamp(sub.current_period_end, tz=timezone.utc).isoformat(),
                "cancel_at_period_end": sub.cancel_at_period_end,
            }
    except Exception as e:
        logger.error(f"Stripe subscription check error: {e}")

    return {"plan": "free", "status": "active"}
