from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from portfolio.models import CoreTenant, UserConfig
from portfolio.partner_tenant_context import resolve_partner_tenant_context
from tenant_lifecycle.models import TenantLifecycleEvent


class OperatorWriteAPITest(APITestCase):
    def setUp(self):
        self.admin_user = User.objects.create_superuser(
            username='operator-write-admin',
            email='operator-write-admin@example.com',
            password='Admin@123456',
        )
        self.regular_user = User.objects.create_user(
            username='operator-write-user',
            email='operator-write-user@example.com',
            password='User@123456',
        )
        self.tenant_owner = User.objects.create_user(
            username='operator-write-owner',
            email='operator-write-owner@example.com',
            password='User@123456',
        )
        UserConfig.objects.update_or_create(
            user=self.tenant_owner,
            defaults={'plan': 'starter', 'email_verified': True},
        )
        resolve_partner_tenant_context(self.tenant_owner)
        self.tenant = CoreTenant.objects.get(owner_user=self.tenant_owner)

    def _authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_suspend_tenant(self):
        self._authenticate(self.admin_user)

        response = self.client.post(f'/api/core/v1/operator/tenants/{self.tenant.public_id}/suspend/', {'reason': 'ops hold'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.tenant.refresh_from_db()
        self.assertEqual(self.tenant.status, CoreTenant.StatusChoices.SUSPENDED)

    def test_activate_tenant(self):
        self.tenant.status = CoreTenant.StatusChoices.SUSPENDED
        self.tenant.save(update_fields=['status', 'updated_at'])
        self._authenticate(self.admin_user)

        response = self.client.post(f'/api/core/v1/operator/tenants/{self.tenant.public_id}/activate/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.tenant.refresh_from_db()
        self.assertEqual(self.tenant.status, CoreTenant.StatusChoices.ACTIVE)

    def test_change_plan(self):
        self._authenticate(self.admin_user)

        response = self.client.post(
            f'/api/core/v1/operator/tenants/{self.tenant.public_id}/change-plan/',
            {'plan': 'pro', 'reason': 'upgrade request'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.tenant.refresh_from_db()
        self.assertEqual(self.tenant.plan, CoreTenant.PlanChoices.PRO)

    def test_non_admin_forbidden(self):
        self._authenticate(self.regular_user)

        response = self.client.post(f'/api/core/v1/operator/tenants/{self.tenant.public_id}/suspend/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_invalid_tenant_id_404(self):
        self._authenticate(self.admin_user)

        response = self.client.post('/api/core/v1/operator/tenants/not-found-tenant/suspend/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_action_logs_lifecycle_event(self):
        self._authenticate(self.admin_user)

        response = self.client.post(f'/api/core/v1/operator/tenants/{self.tenant.public_id}/suspend/', {'reason': 'manual'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        event = TenantLifecycleEvent.objects.filter(tenant=self.tenant, event_type=TenantLifecycleEvent.EventType.STATUS_CHANGED).order_by('-created_at', '-id').first()
        self.assertIsNotNone(event)
        self.assertEqual(event.actor_type, 'operator')
        self.assertEqual(event.actor_user_id, self.admin_user.id)

    def test_provision_tenant(self):
        self._authenticate(self.admin_user)

        response = self.client.post(
            '/api/core/v1/operator/tenants/',
            {
                'display_name': 'Tenant Provisioned',
                'owner_email': 'tenant-provisioned@example.com',
                'plan': 'starter',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        payload = response.json()
        self.assertEqual(payload['tenant']['display_name'], 'Tenant Provisioned')
        self.assertEqual(payload['tenant']['plan_code'], 'starter')
        provisioned = CoreTenant.objects.get(public_id=payload['tenant_id'])
        event = TenantLifecycleEvent.objects.filter(tenant=provisioned, metadata__action='provision').order_by('-created_at', '-id').first()
        self.assertIsNotNone(event)
