"""
Stripe Billing Service Layer

Encapsulates all Stripe API interactions for the VNInvest SaaS billing system.
"""
import logging

from django.conf import settings

from identity_access.models import CoreTenant

logger = logging.getLogger(__name__)

# Lazy import stripe to avoid import errors during Django startup if not installed
_stripe = None


def _get_stripe():
    global _stripe
    if _stripe is None:
        import stripe as _stripe_module
        _stripe = _stripe_module
    return _stripe


class StripeService:
    """Service class for Stripe billing operations."""

    def __init__(self):
        self.api_key = getattr(settings, 'STRIPE_SECRET_KEY', '')
        self.webhook_secret = getattr(settings, 'STRIPE_WEBHOOK_SECRET', '')
        self.price_ids = getattr(settings, 'STRIPE_PRICE_IDS', {})
        
        if self.api_key:
            _get_stripe().api_key = self.api_key

    def is_configured(self) -> bool:
        """Check if Stripe is properly configured."""
        return bool(self.api_key and self.webhook_secret)

    def get_price_id(self, plan_code: str) -> str:
        """Get Stripe Price ID for a plan code (delegate to plan_catalog)."""
        from .plan_catalog import get_stripe_price_id, normalize_plan

        canonical = normalize_plan(plan_code)
        if not canonical:
            return ''
        return get_stripe_price_id(canonical)

    # ─── Customer Management ────────────────────────────────────────────────

    def create_customer(self, tenant: CoreTenant, email: str = None):
        """Create a Stripe Customer for the tenant."""
        if not self.api_key:
            raise ValueError("Stripe not configured: STRIPE_SECRET_KEY missing")

        customer = _get_stripe().Customer.create(
            email=email or tenant.owner_user.email,
            name=tenant.display_name,
            metadata={
                'tenant_id': tenant.public_id,
                'tenant_code': tenant.tenant_code,
            },
        )
        logger.info(f"Created Stripe Customer {customer.id} for tenant {tenant.public_id}")
        return customer

    def get_or_create_customer(self, tenant: CoreTenant):
        """Get existing Stripe Customer or create new one."""
        if tenant.stripe_customer_id:
            try:
                customer = _get_stripe().Customer.retrieve(tenant.stripe_customer_id)
                logger.debug(f"Retrieved existing Stripe Customer {customer.id} for tenant {tenant.public_id}")
                return customer
            except _get_stripe().error.InvalidRequestError:
                logger.warning(f"Stripe Customer {tenant.stripe_customer_id} not found, creating new one")

        customer = self.create_customer(tenant)
        tenant.stripe_customer_id = customer.id
        tenant.save(update_fields=['stripe_customer_id'])
        return customer

    # ─── Checkout Session (Subscription) ────────────────────────────────────

    def create_checkout_session(
        self,
        tenant: CoreTenant,
        price_id: str,
        success_url: str,
        cancel_url: str,
        trial_period_days: int = None,
    ):
        """Create a Stripe Checkout Session for subscription."""
        if not self.api_key:
            raise ValueError("Stripe not configured: STRIPE_SECRET_KEY missing")

        customer = self.get_or_create_customer(tenant)

        session_params = {
            'customer': customer.id,
            'payment_method_types': ['card'],
            'line_items': [{
                'price': price_id,
                'quantity': 1,
            }],
            'mode': 'subscription',
            'success_url': success_url,
            'cancel_url': cancel_url,
            'metadata': {
                'tenant_id': tenant.public_id,
            },
            'subscription_data': {
                'metadata': {
                    'tenant_id': tenant.public_id,
                },
            },
            'allow_promotion_codes': True,
            'billing_address_collection': 'required',
        }

        if trial_period_days:
            session_params['subscription_data']['trial_period_days'] = trial_period_days

        session = _get_stripe().checkout.Session.create(**session_params)
        logger.info(f"Created Checkout Session {session.id} for tenant {tenant.public_id}, price {price_id}")
        return session

    # ─── Customer Portal Session ────────────────────────────────────────────

    def create_portal_session(self, tenant: CoreTenant, return_url: str):
        """Create a Stripe Customer Portal Session."""
        if not self.api_key:
            raise ValueError("Stripe not configured: STRIPE_SECRET_KEY missing")

        if not tenant.stripe_customer_id:
            raise ValueError("Tenant has no Stripe Customer ID")

        session = _get_stripe().billing_portal.Session.create(
            customer=tenant.stripe_customer_id,
            return_url=return_url,
        )
        logger.info(f"Created Portal Session for tenant {tenant.public_id}")
        return session

    # ─── Webhook Verification ───────────────────────────────────────────────

    def verify_webhook_signature(self, payload: bytes, sig_header: str):
        """Verify Stripe webhook signature and return parsed event."""
        if not self.webhook_secret:
            raise ValueError("Stripe webhook secret not configured")

        try:
            event = _get_stripe().Webhook.construct_event(
                payload=payload,
                sig_header=sig_header,
                secret=self.webhook_secret,
            )
            return event
        except _get_stripe().error.SignatureVerificationError as e:
            logger.error(f"Stripe webhook signature verification failed: {e}")
            raise ValueError("Invalid webhook signature") from e

    # ─── Subscription Helpers ───────────────────────────────────────────────

    def get_subscription(self, subscription_id: str):
        """Retrieve a Stripe Subscription."""
        if not self.api_key:
            raise ValueError("Stripe not configured")
        return _get_stripe().Subscription.retrieve(subscription_id)

    def cancel_subscription(self, subscription_id: str, at_period_end: bool = True):
        """Cancel a Stripe Subscription."""
        if not self.api_key:
            raise ValueError("Stripe not configured")
        
        if at_period_end:
            return _get_stripe().Subscription.modify(subscription_id, cancel_at_period_end=True)
        else:
            return _get_stripe().Subscription.delete(subscription_id)

    def get_upcoming_invoice(self, customer_id: str):
        """Get upcoming invoice for a customer."""
        if not self.api_key:
            raise ValueError("Stripe not configured")
        return _get_stripe().Invoice.upcoming(customer=customer_id)


# Singleton instance
stripe_service = StripeService()