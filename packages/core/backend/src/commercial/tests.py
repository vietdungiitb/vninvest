"""
Tests for Stripe Billing Integration
"""
import sys
from unittest.mock import MagicMock, Mock, patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from commercial.stripe_service import StripeService
from identity_access.models import CoreTenant

# Mock stripe module before it's imported
mock_stripe = Mock()
mock_stripe.Customer = Mock()
mock_stripe.Customer.create = Mock()
mock_stripe.Customer.retrieve = Mock()
mock_stripe.checkout = Mock()
mock_stripe.checkout.Session = Mock()
mock_stripe.checkout.Session.create = Mock()
mock_stripe.billing_portal = Mock()
mock_stripe.billing_portal.Session = Mock()
mock_stripe.billing_portal.Session.create = Mock()
mock_stripe.Webhook = Mock()
mock_stripe.Webhook.construct_event = Mock()
mock_stripe.Subscription = Mock()
mock_stripe.Subscription.retrieve = Mock()
mock_stripe.Subscription.modify = Mock()
mock_stripe.Subscription.delete = Mock()
mock_stripe.Invoice = Mock()
mock_stripe.Invoice.upcoming = Mock()
mock_stripe.error = Mock()
mock_stripe.error.InvalidRequestError = Exception
mock_stripe.error.SignatureVerificationError = Exception

sys.modules['stripe'] = mock_stripe


@override_settings(
    STRIPE_SECRET_KEY='sk_test_fake',
    STRIPE_WEBHOOK_SECRET='whsec_fake',
    STRIPE_PRICE_IDS={
        'starter': 'price_starter',
        'pro': 'price_pro',
        'enterprise': 'price_enterprise',
    }
)
class StripeServiceTestCase(TestCase):
    """Test StripeService functionality."""

    def setUp(self):
        self.user = User.objects.create_user(username='testuser', email='test@example.com')
        self.tenant = CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code='TEST001',
            display_name='Test Tenant',
            plan=CoreTenant.PlanChoices.FREE,
        )

    def test_stripe_service_initialization(self):
        """Test StripeService initializes with settings."""
        service = StripeService()
        self.assertEqual(service.api_key, 'sk_test_fake')
        self.assertEqual(service.webhook_secret, 'whsec_fake')
        self.assertEqual(service.price_ids['pro'], 'price_pro')

    def test_is_configured(self):
        """Test is_configured returns True when keys are set."""
        service = StripeService()
        self.assertTrue(service.is_configured())

    def test_is_configured_false_when_missing_keys(self):
        """Test is_configured returns False when keys missing."""
        with override_settings(STRIPE_SECRET_KEY='', STRIPE_WEBHOOK_SECRET=''):
            service = StripeService()
            self.assertFalse(service.is_configured())

    def test_get_price_id(self):
        """Test get_price_id returns correct price ID."""
        service = StripeService()
        self.assertEqual(service.get_price_id('starter'), 'price_starter')
        self.assertEqual(service.get_price_id('pro'), 'price_pro')
        self.assertEqual(service.get_price_id('enterprise'), 'price_enterprise')
        self.assertEqual(service.get_price_id('unknown'), '')

    @patch('commercial.stripe_service._get_stripe')
    def test_create_customer(self, mock_get_stripe):
        """Test create_customer calls Stripe API."""
        mock_stripe = mock_get_stripe.return_value
        mock_customer = MagicMock()
        mock_customer.id = 'cus_test123'
        mock_stripe.Customer.create.return_value = mock_customer

        service = StripeService()
        customer = service.create_customer(self.tenant)

        self.assertEqual(customer.id, 'cus_test123')
        mock_stripe.Customer.create.assert_called_once()

    @patch('commercial.stripe_service._get_stripe')
    def test_get_or_create_customer_creates_new(self, mock_get_stripe):
        """Test get_or_create_customer creates new when no ID exists."""
        mock_stripe = mock_get_stripe.return_value
        mock_customer = MagicMock()
        mock_customer.id = 'cus_new123'
        mock_stripe.Customer.create.return_value = mock_customer

        service = StripeService()
        customer = service.get_or_create_customer(self.tenant)

        self.assertEqual(customer.id, 'cus_new123')
        self.tenant.refresh_from_db()
        self.assertEqual(self.tenant.stripe_customer_id, 'cus_new123')

    @patch('commercial.stripe_service._get_stripe')
    def test_get_or_create_customer_retrieves_existing(self, mock_get_stripe):
        """Test get_or_create_customer retrieves existing customer."""
        self.tenant.stripe_customer_id = 'cus_existing'
        self.tenant.save()

        mock_stripe = mock_get_stripe.return_value
        mock_customer = MagicMock()
        mock_customer.id = 'cus_existing'
        mock_stripe.Customer.retrieve.return_value = mock_customer

        service = StripeService()
        customer = service.get_or_create_customer(self.tenant)

        self.assertEqual(customer.id, 'cus_existing')
        mock_stripe.Customer.retrieve.assert_called_once_with('cus_existing')
        mock_stripe.Customer.create.assert_not_called()

    @patch('commercial.stripe_service._get_stripe')
    def test_get_or_create_customer_fallback_on_invalid(self, mock_get_stripe):
        """Test get_or_create_customer creates new when existing ID invalid."""
        self.tenant.stripe_customer_id = 'cus_invalid'
        self.tenant.save()

        mock_stripe = mock_get_stripe.return_value
        # Create a proper exception class
        class InvalidRequestError(Exception):
            pass
        mock_stripe.error.InvalidRequestError = InvalidRequestError
        mock_stripe.Customer.retrieve.side_effect = InvalidRequestError('Not found')
        
        mock_customer = MagicMock()
        mock_customer.id = 'cus_new456'
        mock_stripe.Customer.create.return_value = mock_customer

        service = StripeService()
        customer = service.get_or_create_customer(self.tenant)

        self.assertEqual(customer.id, 'cus_new456')
        self.tenant.refresh_from_db()
        self.assertEqual(self.tenant.stripe_customer_id, 'cus_new456')


@override_settings(
    STRIPE_SECRET_KEY='sk_test_fake',
    STRIPE_WEBHOOK_SECRET='whsec_fake',
    STRIPE_PRICE_IDS={
        'starter': 'price_starter',
        'pro': 'price_pro',
        'enterprise': 'price_enterprise',
    }
)
class StripeBillingViewsTestCase(TestCase):
    """Test Stripe billing API views."""

    def setUp(self):
        self.user = User.objects.create_user(username='testuser', email='test@example.com', password='testpass123')
        self.tenant = CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code='TEST001',
            display_name='Test Tenant',
            plan=CoreTenant.PlanChoices.FREE,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        
        # Mock stripe_service to be configured
        import commercial.views
        commercial.views.stripe_service.is_configured = lambda: True
        commercial.views.stripe_service.get_price_id = lambda plan: f'price_{plan}'

    @patch('commercial.views.stripe_service')
    def test_create_checkout_session_success(self, mock_stripe_service):
        """Test creating Stripe checkout session."""
        mock_stripe_service.is_configured.return_value = True
        mock_stripe_service.get_price_id.return_value = 'price_pro'
        
        mock_session = MagicMock()
        mock_session.id = 'cs_test123'
        mock_session.url = 'https://checkout.stripe.com/cs_test123'
        mock_stripe_service.create_checkout_session.return_value = mock_session

        response = self.client.post('/core/v1/partner/billing/stripe/session/', {
            'plan': 'pro',
            'success_url': 'https://example.com/success',
            'cancel_url': 'https://example.com/cancel',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # Contract is `{data, meta}` since the envelope migration. These two
        # assertions failed with `KeyError: 'session_id'` right after it, which
        # is how the gap was found — the tests were asserting the pre-migration
        # flat shape while the endpoint returned enveloped data.
        self.assertEqual(response.data['data']['session_id'], 'cs_test123')
        self.assertEqual(response.data['data']['url'], 'https://checkout.stripe.com/cs_test123')

    def test_create_checkout_session_missing_plan(self):
        """Test checkout session fails without plan."""
        response = self.client.post('/core/v1/partner/billing/stripe/session/', {
            'success_url': 'https://example.com/success',
            'cancel_url': 'https://example.com/cancel',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # Error message is in Vietnamese, check for validation error code
        self.assertEqual(response.data['code'], 'validation_error')

    def test_create_checkout_session_missing_urls(self):
        """Test checkout session fails without success/cancel URLs."""
        response = self.client.post('/core/v1/partner/billing/stripe/session/', {
            'plan': 'pro',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('commercial.views.stripe_service')
    def test_create_portal_session_success(self, mock_stripe_service):
        """Test creating Stripe portal session."""
        self.tenant.stripe_customer_id = 'cus_test123'
        self.tenant.save()

        mock_stripe_service.is_configured.return_value = True
        
        mock_session = MagicMock()
        mock_session.url = 'https://billing.stripe.com/session_test123'
        mock_stripe_service.create_portal_session.return_value = mock_session

        response = self.client.post('/core/v1/partner/billing/stripe/portal/', {
            'return_url': 'https://example.com/billing',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['data']['url'], 'https://billing.stripe.com/session_test123')

    def test_create_portal_session_no_customer(self):
        """Test portal session fails when tenant has no Stripe customer."""
        response = self.client.post('/core/v1/partner/billing/stripe/portal/', {
            'return_url': 'https://example.com/billing',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # Error code for missing Stripe customer
        self.assertEqual(response.data['code'], 'stripe_customer_not_found')

    def test_create_portal_session_missing_return_url(self):
        """Test portal session fails without return_url."""
        self.tenant.stripe_customer_id = 'cus_test123'
        self.tenant.save()

        response = self.client.post('/core/v1/partner/billing/stripe/portal/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # Error message is in Vietnamese, check for validation error code
        self.assertEqual(response.data['code'], 'validation_error')


@override_settings(
    STRIPE_SECRET_KEY='sk_test_fake',
    STRIPE_WEBHOOK_SECRET='whsec_fake',
)
class StripeWebhookSignatureTestCase(TestCase):
    """Khoa nhanh verify-fail cua Stripe webhook (F-COM-01b).

    Webhook la endpoint AllowAny duy nhat cham billing nen chu ky la bien
    phong thu duy nhat: thieu header hoac sai chu ky phai 400, khong duoc
    cham vao handler.
    """

    WEBHOOK_URL = '/core/v1/billing/stripe/webhook/'

    @patch('commercial.stripe_webhooks.stripe_service')
    def test_missing_signature_header_returns_400(self, mock_stripe_service):
        """Thieu header Stripe-Signature => 400, khong xu ly event."""
        # Singleton stripe_service doc settings luc import (truoc override)
        # nen mac dinh unconfigured (503). Mock giong test hien co.
        mock_stripe_service.is_configured.return_value = True
        response = self.client.post(self.WEBHOOK_URL, {'type': 'ping'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Missing Stripe signature', str(response.data))

    @patch('commercial.stripe_webhooks.stripe_service')
    def test_invalid_signature_returns_400(self, mock_stripe_service):
        """Chu ky sai (SDK nem ValueError) => 400, khong xu ly event."""
        mock_stripe_service.is_configured.return_value = True
        mock_stripe_service.verify_webhook_signature.side_effect = ValueError(
            'Invalid webhook signature')

        response = self.client.post(
            self.WEBHOOK_URL, {'type': 'ping'}, format='json',
            HTTP_STRIPE_SIGNATURE='t=123,v1=deadbeef')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Invalid signature', str(response.data))
        mock_stripe_service.verify_webhook_signature.assert_called_once()