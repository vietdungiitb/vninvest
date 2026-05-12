"""
Tests for onboarding views — T08 self-service tenant registration.
"""
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from tenant_lifecycle.models import TenantLifecycleEvent
from identity_access.models import CoreTenant

User = get_user_model()


class OnboardingRegisterTenantTest(TestCase):
    """T08: Self-service onboarding endpoint tests."""

    def setUp(self):
        """Create test user and API client."""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='test_onboarding_user',
            email='onboarding@example.com',
            password='test_password',
            is_active=True,
        )
        self.url = '/api/core/v1/onboarding/register'

    def test_register_tenant_success_creates_trial(self):
        """Test: User creates tenant → status=trial, trial_ends_at=now+14d, 201."""
        self.client.force_authenticate(user=self.user)
        payload = {'display_name': 'Test Company'}
        
        response = self.client.post(self.url, payload, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'trial')
        self.assertIsNotNone(response.data['trial_ends_at'])
        self.assertEqual(response.data['display_name'], 'Test Company')
        
        # Verify tenant was created
        tenant = CoreTenant.objects.get(display_name='Test Company')
        self.assertEqual(tenant.owner_user, self.user)
        self.assertEqual(tenant.status, CoreTenant.StatusChoices.TRIAL)
        self.assertEqual(tenant.plan, CoreTenant.PlanChoices.FREE)
        
        # Verify trial_ends_at is ~14 days from now
        days_diff = (tenant.trial_ends_at.date() - timezone.now().date()).days
        self.assertIn(days_diff, [13, 14])  # Allow for timezone rounding

    def test_register_tenant_duplicate_409(self):
        """Test: User already has tenant → 409 Conflict."""
        # Create tenant for user
        CoreTenant.objects.create(
            owner_user=self.user,
            display_name='Existing Tenant',
            tenant_code='existing-001',
            plan=CoreTenant.PlanChoices.FREE,
            status=CoreTenant.StatusChoices.ACTIVE,
        )
        
        self.client.force_authenticate(user=self.user)
        payload = {'display_name': 'Another Company'}
        
        response = self.client.post(self.url, payload, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn('already has tenant', response.data.get('message', ''))

    def test_register_tenant_missing_display_name_400(self):
        """Test: display_name empty → 400 Bad Request."""
        self.client.force_authenticate(user=self.user)
        payload = {'display_name': ''}
        
        response = self.client.post(self.url, payload, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('display_name', response.data.get('details', {}))

    def test_register_tenant_creates_lifecycle_event(self):
        """Test: RegisterTenantView creates TenantLifecycleEvent(TRIAL_STARTED)."""
        self.client.force_authenticate(user=self.user)
        payload = {'display_name': 'Lifecycle Test Tenant'}
        
        response = self.client.post(self.url, payload, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Verify lifecycle event was created
        tenant = CoreTenant.objects.get(display_name='Lifecycle Test Tenant')
        event = TenantLifecycleEvent.objects.filter(
            tenant=tenant,
            event_type=TenantLifecycleEvent.EventType.TRIAL_STARTED,
        ).first()
        self.assertIsNotNone(event)
        self.assertEqual(event.actor_type, 'self_service')
        self.assertEqual(event.actor_user, self.user)
        self.assertIn('status', event.new_value)
        self.assertIn('trial_ends_at', event.new_value)

    def test_register_tenant_unauthenticated_401(self):
        """Test: Unauthenticated request → 401 Unauthorized."""
        # Don't authenticate
        payload = {'display_name': 'Test Company'}
        
        response = self.client.post(self.url, payload, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_register_tenant_with_whitespace_display_name(self):
        """Test: display_name with leading/trailing whitespace is stripped."""
        self.client.force_authenticate(user=self.user)
        payload = {'display_name': '  Whitespace Company  '}
        
        response = self.client.post(self.url, payload, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['display_name'], 'Whitespace Company')

    def test_register_tenant_max_length_display_name(self):
        """Test: display_name at max length (120 chars) succeeds."""
        self.client.force_authenticate(user=self.user)
        long_name = 'A' * 120
        payload = {'display_name': long_name}
        
        response = self.client.post(self.url, payload, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['display_name'], long_name)

    def test_register_tenant_over_max_length_display_name(self):
        """Test: display_name over 120 chars → 400."""
        self.client.force_authenticate(user=self.user)
        long_name = 'A' * 121
        payload = {'display_name': long_name}
        
        response = self.client.post(self.url, payload, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_tenant_response_has_required_fields(self):
        """Test: Response includes all required tenant fields."""
        self.client.force_authenticate(user=self.user)
        payload = {'display_name': 'Fields Test Tenant'}
        
        response = self.client.post(self.url, payload, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        required_fields = [
            'tenant_id', 'tenant_code', 'display_name', 'plan', 'status',
            'trial_ends_at', 'created_at', 'updated_at'
        ]
        for field in required_fields:
            self.assertIn(field, response.data)
