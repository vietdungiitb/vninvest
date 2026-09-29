"""
Stripe Webhook Handlers

Handles Stripe webhook events for subscription lifecycle management.
"""
import logging
from django.utils import timezone
from django.db import transaction
from rest_framework import permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response

from identity_access.models import CoreTenant
from commercial.models import Subscription, Invoice
from commercial.stripe_service import stripe_service

logger = logging.getLogger(__name__)

# Lazy stripe import for type hints
_stripe = None


def _get_stripe():
    global _stripe
    if _stripe is None:
        import stripe as _stripe_module
        _stripe = _stripe_module
    return _stripe


class StripeWebhookView(APIView):
    """
    POST /api/core/v1/billing/stripe/webhook/
    
    Handles Stripe webhook events:
    - customer.subscription.created
    - customer.subscription.updated
    - customer.subscription.deleted
    - invoice.payment_succeeded
    - invoice.payment_failed
    - customer.subscription.trial_will_end
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        if not stripe_service.is_configured():
            logger.error("Stripe webhook received but Stripe not configured")
            return Response(
                {'error': 'Stripe not configured'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        payload = request.body
        sig_header = request.META.get('HTTP_STRIPE_SIGNATURE', '')

        if not sig_header:
            logger.warning("Stripe webhook missing signature header")
            return Response(
                {'error': 'Missing Stripe signature'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verify webhook signature
        try:
            event = stripe_service.verify_webhook_signature(payload, sig_header)
        except ValueError as e:
            logger.error(f"Stripe webhook signature verification failed: {e}")
            return Response(
                {'error': 'Invalid signature'},
                status=status.HTTP_400_BAD_REQUEST
            )

        logger.info(f"Received Stripe webhook: {event.type} (id: {event.id})")

        # Process event based on type
        try:
            if event.type == 'customer.subscription.created':
                self._handle_subscription_created(event.data.object)
            elif event.type == 'customer.subscription.updated':
                self._handle_subscription_updated(event.data.object)
            elif event.type == 'customer.subscription.deleted':
                self._handle_subscription_deleted(event.data.object)
            elif event.type == 'invoice.payment_succeeded':
                self._handle_invoice_payment_succeeded(event.data.object)
            elif event.type == 'invoice.payment_failed':
                self._handle_invoice_payment_failed(event.data.object)
            elif event.type == 'customer.subscription.trial_will_end':
                self._handle_trial_will_end(event.data.object)
            else:
                logger.info(f"Unhandled Stripe event type: {event.type}")
        except Exception as e:
            logger.error(f"Error processing Stripe webhook {event.type}: {e}", exc_info=True)
            # Return 200 to avoid Stripe retrying, but log the error
            return Response({'received': True, 'error': str(e)}, status=status.HTTP_200_OK)

        return Response({'received': True}, status=status.HTTP_200_OK)

    def _get_tenant_from_customer(self, customer_id: str) -> CoreTenant:
        """Get tenant by Stripe customer ID."""
        try:
            return CoreTenant.objects.get(stripe_customer_id=customer_id)
        except CoreTenant.DoesNotExist:
            logger.error(f"No tenant found for Stripe customer {customer_id}")
            raise

    def _plan_from_price_id(self, price_id: str) -> str:
        """Map Stripe Price ID to internal plan code."""
        price_ids = getattr(stripe_service, 'price_ids', {})
        for plan, pid in price_ids.items():
            if pid == price_id:
                return plan
        return 'pro'  # fallback

    def _handle_subscription_created(self, subscription):
        """Handle subscription created event."""
        customer_id = subscription.customer
        tenant = self._get_tenant_from_customer(customer_id)
        
        price_id = subscription.items.data[0].price.id if subscription.items.data else None
        plan = self._plan_from_price_id(price_id) if price_id else tenant.plan

        with transaction.atomic():
            # Update tenant
            tenant.stripe_subscription_id = subscription.id
            tenant.stripe_price_id = price_id
            tenant.stripe_current_period_end = timezone.datetime.fromtimestamp(
                subscription.current_period_end, tz=timezone.UTC
            )
            tenant.stripe_cancel_at_period_end = subscription.cancel_at_period_end
            tenant.plan = plan
            tenant.save(update_fields=[
                'stripe_subscription_id', 'stripe_price_id', 
                'stripe_current_period_end', 'stripe_cancel_at_period_end', 'plan'
            ])

            # Create/update local subscription record
            sub, created = Subscription.objects.update_or_create(
                tenant=tenant,
                defaults={
                    'plan': plan,
                    'status': self._map_stripe_status(subscription.status),
                    'current_period_start': timezone.datetime.fromtimestamp(
                        subscription.current_period_start, tz=timezone.UTC
                    ).date(),
                    'current_period_end': timezone.datetime.fromtimestamp(
                        subscription.current_period_end, tz=timezone.UTC
                    ).date(),
                    'cancel_at_period_end': subscription.cancel_at_period_end,
                }
            )
            logger.info(f"Subscription created for tenant {tenant.public_id}: {subscription.id} ({plan})")

    def _handle_subscription_updated(self, subscription):
        """Handle subscription updated event."""
        customer_id = subscription.customer
        tenant = self._get_tenant_from_customer(customer_id)
        
        price_id = subscription.items.data[0].price.id if subscription.items.data else None
        plan = self._plan_from_price_id(price_id) if price_id else tenant.plan

        with transaction.atomic():
            # Update tenant
            tenant.stripe_subscription_id = subscription.id
            tenant.stripe_price_id = price_id
            tenant.stripe_current_period_end = timezone.datetime.fromtimestamp(
                subscription.current_period_end, tz=timezone.UTC
            )
            tenant.stripe_cancel_at_period_end = subscription.cancel_at_period_end
            tenant.plan = plan
            tenant.save(update_fields=[
                'stripe_subscription_id', 'stripe_price_id',
                'stripe_current_period_end', 'stripe_cancel_at_period_end', 'plan'
            ])

            # Update local subscription record
            Subscription.objects.update_or_create(
                tenant=tenant,
                defaults={
                    'plan': plan,
                    'status': self._map_stripe_status(subscription.status),
                    'current_period_start': timezone.datetime.fromtimestamp(
                        subscription.current_period_start, tz=timezone.UTC
                    ).date(),
                    'current_period_end': timezone.datetime.fromtimestamp(
                        subscription.current_period_end, tz=timezone.UTC
                    ).date(),
                    'cancel_at_period_end': subscription.cancel_at_period_end,
                }
            )
            logger.info(f"Subscription updated for tenant {tenant.public_id}: {subscription.id} ({plan})")

    def _handle_subscription_deleted(self, subscription):
        """Handle subscription deleted event."""
        customer_id = subscription.customer
        tenant = self._get_tenant_from_customer(customer_id)

        with transaction.atomic():
            # Update tenant - revert to free plan
            tenant.stripe_subscription_id = None
            tenant.stripe_price_id = None
            tenant.stripe_current_period_end = None
            tenant.stripe_cancel_at_period_end = False
            tenant.plan = CoreTenant.PlanChoices.FREE
            tenant.save(update_fields=[
                'stripe_subscription_id', 'stripe_price_id',
                'stripe_current_period_end', 'stripe_cancel_at_period_end', 'plan'
            ])

            # Update local subscription record
            Subscription.objects.filter(tenant=tenant).update(
                status=Subscription.StatusChoices.CANCELLED,
                cancel_at_period_end=True,
            )
            logger.info(f"Subscription deleted for tenant {tenant.public_id}: {subscription.id}")

    def _handle_invoice_payment_succeeded(self, invoice):
        """Handle successful invoice payment."""
        customer_id = invoice.customer
        tenant = self._get_tenant_from_customer(customer_id)
        
        # Create/update local invoice record
        if invoice.subscription:
            with transaction.atomic():
                Invoice.objects.update_or_create(
                    tenant=tenant,
                    invoice_number=f"STRIPE-{invoice.id}",
                    defaults={
                        'status': Invoice.StatusChoices.PAID,
                        'amount_due': invoice.amount_paid / 100,  # Convert from cents
                        'currency': invoice.currency.upper(),
                        'period_start': timezone.datetime.fromtimestamp(
                            invoice.period_start, tz=timezone.UTC
                        ).date() if invoice.period_start else timezone.now().date(),
                        'period_end': timezone.datetime.fromtimestamp(
                            invoice.period_end, tz=timezone.UTC
                        ).date() if invoice.period_end else timezone.now().date(),
                        'due_date': timezone.datetime.fromtimestamp(
                            invoice.due_date, tz=timezone.UTC
                        ).date() if invoice.due_date else None,
                        'paid_at': timezone.datetime.fromtimestamp(
                            invoice.status_transitions.paid_at, tz=timezone.UTC
                        ) if invoice.status_transitions and invoice.status_transitions.paid_at else timezone.now(),
                    }
                )
                logger.info(f"Invoice payment succeeded for tenant {tenant.public_id}: {invoice.id}")

    def _handle_invoice_payment_failed(self, invoice):
        """Handle failed invoice payment."""
        customer_id = invoice.customer
        tenant = self._get_tenant_from_customer(customer_id)
        
        with transaction.atomic():
            Invoice.objects.update_or_create(
                tenant=tenant,
                invoice_number=f"STRIPE-{invoice.id}",
                defaults={
                    'status': Invoice.StatusChoices.PAST_DUE,
                    'amount_due': invoice.amount_due / 100,
                    'currency': invoice.currency.upper(),
                    'period_start': timezone.datetime.fromtimestamp(
                        invoice.period_start, tz=timezone.UTC
                    ).date() if invoice.period_start else timezone.now().date(),
                    'period_end': timezone.datetime.fromtimestamp(
                        invoice.period_end, tz=timezone.UTC
                    ).date() if invoice.period_end else timezone.now().date(),
                    'due_date': timezone.datetime.fromtimestamp(
                        invoice.due_date, tz=timezone.UTC
                    ).date() if invoice.due_date else None,
                }
            )
            logger.warning(f"Invoice payment failed for tenant {tenant.public_id}: {invoice.id}")

    def _handle_trial_will_end(self, subscription):
        """Handle trial ending soon notification."""
        customer_id = subscription.customer
        tenant = self._get_tenant_from_customer(customer_id)
        logger.info(f"Trial will end soon for tenant {tenant.public_id}: {subscription.id}")
        # Could send notification email here

    def _map_stripe_status(self, stripe_status: str) -> str:
        """Map Stripe subscription status to local status."""
        mapping = {
            'active': Subscription.StatusChoices.ACTIVE,
            'trialing': Subscription.StatusChoices.TRIALING,
            'past_due': Subscription.StatusChoices.PAST_DUE,
            'canceled': Subscription.StatusChoices.CANCELLED,
            'incomplete': Subscription.StatusChoices.PAST_DUE,
            'incomplete_expired': Subscription.StatusChoices.CANCELLED,
            'unpaid': Subscription.StatusChoices.PAST_DUE,
        }
        return mapping.get(stripe_status, Subscription.StatusChoices.ACTIVE)