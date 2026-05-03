from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from portfolio.models import CorePATCredential, CoreServiceAccount, CoreTenant, UserConfig


class OperatorTenantRegistryApiTests(APITestCase):
    def setUp(self):
        self.admin_user = User.objects.create_superuser(
            username='operator-registry-admin',
            email='operator-registry-admin@example.com',
            password='Admin@123456',
        )
        self.active_user = User.objects.create_user(
            username='alpha-tenant-owner',
            email='alpha-tenant@example.com',
            password='User@123456',
        )
        self.suspended_user = User.objects.create_user(
            username='beta-tenant-owner',
            email='beta-tenant@example.com',
            password='User@123456',
        )

        UserConfig.objects.update_or_create(
            user=self.active_user,
            defaults={'plan': 'pro', 'email_verified': True},
        )
        UserConfig.objects.update_or_create(
            user=self.suspended_user,
            defaults={'plan': 'premium', 'email_verified': True},
        )

        self.active_tenant = CoreTenant.ensure_for_user(self.active_user)
        self.active_tenant.display_name = 'Alpha Desk'
        self.active_tenant.save(update_fields=['display_name', 'updated_at'])

        self.suspended_tenant = CoreTenant.ensure_for_user(self.suspended_user)
        self.suspended_tenant.display_name = 'Beta Desk'
        self.suspended_tenant.status = CoreTenant.StatusChoices.SUSPENDED
        self.suspended_tenant.save(update_fields=['display_name', 'status', 'updated_at'])

        self.service_account = CoreServiceAccount.objects.create(
            owner_user=self.active_user,
            created_by=self.active_user,
            name='alpha-main',
            environment=CoreServiceAccount.EnvironmentChoices.PROD,
            policy_ids=['pol_market_read'],
        )
        self.credential, _raw_secret = CorePATCredential.issue_for_service_account(
            service_account=self.service_account,
            scope_codes=['market:read', 'signals:read'],
            display_name='alpha-token',
            issued_by=self.admin_user,
        )
        self.credential.last_used_at = timezone.now()
        self.credential.save(update_fields=['last_used_at', 'updated_at'])

    def _authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_operator_tenants_requires_admin(self):
        self._authenticate(self.active_user)

        response = self.client.get('/api/core/v1/operator/tenants/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_operator_tenants_returns_filtered_registry(self):
        self._authenticate(self.admin_user)

        response = self.client.get('/api/core/v1/operator/tenants/', {'search': 'Alpha'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['object'], 'list')
        self.assertIn('summary_cards', data)
        self.assertGreaterEqual(len(data['summary_cards']), 4)
        self.assertEqual(len(data['data']), 1)
        row = data['data'][0]
        self.assertEqual(row['id'], self.active_tenant.public_id)
        self.assertEqual(row['tenant_code'], self.active_tenant.tenant_code)
        self.assertEqual(row['active_service_account_count'], 1)
        self.assertEqual(row['active_pat_count'], 1)
        self.assertEqual(row['suspension_state'], 'none')
        self.assertEqual(row['invoice_state'], 'current')
        self.assertIn(row['current_usage_risk'], {'normal', 'warning', 'critical'})

    def test_operator_tenants_supports_status_filter(self):
        self._authenticate(self.admin_user)

        response = self.client.get('/api/core/v1/operator/tenants/', {'status': 'suspended'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(len(data['data']), 1)
        row = data['data'][0]
        self.assertEqual(row['id'], self.suspended_tenant.public_id)
        self.assertEqual(row['suspension_state'], 'manual')

    def test_operator_tenant_detail_returns_summary_sections(self):
        self._authenticate(self.admin_user)

        response = self.client.get(f'/api/core/v1/operator/tenants/{self.active_tenant.public_id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['object'], 'operator_tenant_detail')
        self.assertEqual(data['tenant']['id'], self.active_tenant.public_id)
        self.assertEqual(data['tenant']['plan_code'], 'pro')
        self.assertEqual(data['commercial_summary']['plan_code'], 'pro')
        self.assertEqual(data['security_summary']['service_account_count'], 1)
        self.assertEqual(data['security_summary']['active_pat_count'], 1)
        self.assertGreaterEqual(data['security_summary']['rotations_due_count'], 0)
        self.assertIsNotNone(data['security_summary']['latest_pat_last_used_at'])
        self.assertTrue(data['recent_operator_actions'])
        actions = {item['action'] for item in data['recent_operator_actions']}
        self.assertIn('service_account_created', actions)
        self.assertIn('service_account_rotated', actions)
        self.assertIn('pat_issued', actions)
        self.assertIn('pat_used', actions)

    def test_operator_service_accounts_returns_risk_metadata(self):
        self._authenticate(self.admin_user)

        response = self.client.get(f'/api/core/v1/operator/tenants/{self.active_tenant.public_id}/service-accounts/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['object'], 'list')
        self.assertIn('summary_cards', data)
        self.assertEqual(len(data['data']), 1)
        row = data['data'][0]
        self.assertEqual(row['id'], self.service_account.public_id)
        self.assertEqual(row['tenant_id'], self.active_tenant.public_id)
        self.assertEqual(row['pat_count'], 1)
        self.assertEqual(row['active_pat_count'], 1)
        self.assertIn(row['rotation_risk'], {'normal', 'warning', 'critical'})
        self.assertNotIn('secret', row)

    def test_operator_pats_returns_no_secret_and_anomaly_metadata(self):
        self._authenticate(self.admin_user)

        response = self.client.get(f'/api/core/v1/operator/tenants/{self.active_tenant.public_id}/pats/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['object'], 'list')
        self.assertIn('summary_cards', data)
        self.assertEqual(len(data['data']), 1)
        row = data['data'][0]
        self.assertEqual(row['id'], self.credential.public_id)
        self.assertEqual(row['tenant_id'], self.active_tenant.public_id)
        self.assertEqual(row['service_account_id'], self.service_account.public_id)
        self.assertEqual(row['issuer_actor_type'], 'operator_user')
        self.assertEqual(row['anomaly_state'], 'normal')
        self.assertFalse(row['grace_period_active'])
        self.assertNotIn('secret', row)