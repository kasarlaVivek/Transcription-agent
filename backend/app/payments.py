"""
Stripe payment integration — checkout sessions, webhooks, and customer portal.
"""

import stripe
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel

from app.config import STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRO_PRICE_ID, FRONTEND_URL
from app.auth import get_current_user
from app.database import (
    update_user_plan,
    set_stripe_customer_id,
    get_user_by_stripe_customer,
    get_user_by_id,
)

stripe.api_key = STRIPE_SECRET_KEY

router = APIRouter(prefix="/stripe", tags=["Payments"])


# ── Request schemas ───────────────────────────────────────────────

class CheckoutRequest(BaseModel):
    price_id: str | None = None  # Optional override; defaults to STRIPE_PRO_PRICE_ID


# ── Routes ────────────────────────────────────────────────────────

@router.post("/create-checkout")
async def create_checkout_session(
    req: CheckoutRequest = CheckoutRequest(),
    user: dict = Depends(get_current_user),
):
    """
    Create a Stripe Checkout session for the Professional plan.
    Redirects the user to Stripe's hosted payment page.
    """
    if not STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=503,
            detail="Stripe is not configured. Set STRIPE_SECRET_KEY in .env",
        )

    price_id = req.price_id or STRIPE_PRO_PRICE_ID
    if not price_id:
        raise HTTPException(
            status_code=400,
            detail="No price ID configured. Set STRIPE_PRO_PRICE_ID in .env",
        )

    try:
        # Create or reuse a Stripe customer
        customer_id = user.get("stripe_customer_id")
        if not customer_id:
            customer = stripe.Customer.create(
                email=user["email"],
                name=user["name"],
                metadata={"novameet_user_id": user["id"]},
            )
            customer_id = customer.id
            set_stripe_customer_id(user["id"], customer_id)

        # Create checkout session
        session = stripe.checkout.Session.create(
            customer=customer_id,
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{FRONTEND_URL}?payment=success",
            cancel_url=f"{FRONTEND_URL}?payment=cancelled",
            metadata={"novameet_user_id": user["id"]},
        )

        return {"checkout_url": session.url, "session_id": session.id}

    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/create-portal")
async def create_portal_session(user: dict = Depends(get_current_user)):
    """
    Create a Stripe Customer Portal session for managing subscriptions.
    """
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Stripe is not configured.")

    customer_id = user.get("stripe_customer_id")
    if not customer_id:
        raise HTTPException(
            status_code=400,
            detail="No active subscription found.",
        )

    try:
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=FRONTEND_URL,
        )
        return {"portal_url": session.url}

    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """
    Handle Stripe webhook events.
    Listens for checkout.session.completed and customer.subscription.deleted
    to upgrade/downgrade user plans automatically.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not STRIPE_WEBHOOK_SECRET:
        # In dev mode without webhook secret, try to parse directly
        import json
        event = json.loads(payload)
    else:
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, STRIPE_WEBHOOK_SECRET
            )
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid payload.")
        except stripe.error.SignatureVerificationError:
            raise HTTPException(status_code=400, detail="Invalid signature.")

    event_type = event.get("type", "")
    data = event.get("data", {}).get("object", {})

    # ── Payment successful → upgrade to Professional ──────────────
    if event_type == "checkout.session.completed":
        customer_id = data.get("customer")
        user_id = data.get("metadata", {}).get("novameet_user_id")

        if user_id:
            update_user_plan(user_id, "professional")
        elif customer_id:
            user = get_user_by_stripe_customer(customer_id)
            if user:
                update_user_plan(user["id"], "professional")

    # ── Subscription cancelled → downgrade to Starter ─────────────
    elif event_type == "customer.subscription.deleted":
        customer_id = data.get("customer")
        if customer_id:
            user = get_user_by_stripe_customer(customer_id)
            if user:
                update_user_plan(user["id"], "starter")

    return {"status": "ok"}
