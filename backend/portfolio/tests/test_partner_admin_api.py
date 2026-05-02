from datetime import timedelta

from django.contrib.auth.models import User
from django.core.cache import cache
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from portfolio.models import CorePATCredential, CoreServiceAccount, CoreTenant, UserConfig
from portfolio.opencore_revenue import DPIInvoice, DPIRevenuePlan, DPISubscription
from portfolio.quota_service import VN_TZ


class PartnerAdminApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='tenant_machine_admin',
            email='tenant-machine@example.com',
            password='Test@123456',
        )
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'pro', 'email_verified': True},
        )
        self.client.force_authenticate(user=self.user)

    def test_service_account_list_and_create(self):
        existing = CoreServiceAccount.objects.create(
            owner_user=self.user,
            created_by=self.user,
            name='vip-alpha-prod',
            environment=CoreServiceAccount.EnvironmentChoices.PROD,
            policy_ids=['pol_market_read'],
        )

        self.assertFalse(CoreTenant.objects.filter(owner_user=self.user).exists())

        list_response = self.client.get('/api/core/v1/partner/service-accounts/')

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data['object'], 'list')
        self.assertEqual(len(list_response.data['data']), 1)
        self.assertEqual(list_response.data['data'][0]['id'], existing.public_id)
        self.assertEqual(list_response.data['data'][0]['tenant_id'], f'ten_usr_{self.user.id}')
        self.assertIn('X-Core-Request-Id', list_response)
        tenant = CoreTenant.objects.get(owner_user=self.user)
        self.assertEqual(tenant.public_id, f'ten_usr_{self.user.id}')
        self.assertEqual(tenant.plan_code, 'pro')

        missing_key_response = self.client.post(
            '/api/core/v1/partner/service-accounts/',
            {
                'name': 'vip-alpha-staging',
                'environment': 'staging',
                'policy_ids': ['pol_market_read', 'pol_signals_read'],
            },
            format='json',
        )

        self.assertEqual(missing_key_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(missing_key_response.data['error']['code'], 'missing_idempotency_key')

        create_response = self.client.post(
            '/api/core/v1/partner/service-accounts/',
            {
                'name': 'vip-alpha-staging',
                'environment': 'staging',
                'policy_ids': ['pol_market_read', 'pol_signals_read'],
                'metadata': {'owner_team': 'analytics'},
            },
            format='json',
            HTTP_IDEMPOTENCY_KEY='create-service-account-1',
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create_response.data['object'], 'service_account')
        self.assertEqual(create_response.data['environment'], 'staging')
        self.assertEqual(create_response.data['policy_ids'], ['pol_market_read', 'pol_signals_read'])

    def test_pat_issue_list_rotate_and_revoke(self):
        service_account = CoreServiceAccount.objects.create(
            owner_user=self.user,
            created_by=self.user,
            name='vip-main-prod',
            environment=CoreServiceAccount.EnvironmentChoices.PROD,
            policy_ids=['pol_market_read', 'pol_ai_invoke'],
        )

        issue_response = self.client.post(
            '/api/core/v1/partner/pats/issue/',
            {
                'service_account_id': service_account.public_id,
                'scope_codes': ['market:read', 'signals:read', 'ai:invoke'],
                'display_name': 'prod-main-token',
            },
            format='json',
            HTTP_IDEMPOTENCY_KEY='issue-pat-1',
        )

        self.assertEqual(issue_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(issue_response.data['object'], 'pat_credential')
        self.assertIn('secret', issue_response.data)
        self.assertTrue(issue_response.data['token_prefix'].startswith('vni_pat_live_'))

        credential = CorePATCredential.objects.get(public_id=issue_response.data['id'])
        self.assertNotEqual(credential.token_secret_hash, issue_response.data['secret'])
        self.assertEqual(credential.service_account_id, service_account.id)

        list_response = self.client.get('/api/core/v1/partner/pats/')

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data['object'], 'list')
        self.assertEqual(len(list_response.data['data']), 1)
        self.assertNotIn('secret', list_response.data['data'][0])
        self.assertEqual(list_response.data['data'][0]['service_account_id'], service_account.public_id)

        rotate_response = self.client.post(
            f"/api/core/v1/partner/pats/{credential.public_id}/rotate/",
            {'grace_period_seconds': 1800},
            format='json',
            HTTP_IDEMPOTENCY_KEY='rotate-pat-1',
        )

        self.assertEqual(rotate_response.status_code, status.HTTP_200_OK)
        self.assertEqual(rotate_response.data['object'], 'pat_rotation')
        self.assertEqual(rotate_response.data['old_token_id'], credential.public_id)
        self.assertIn('secret', rotate_response.data['new_token'])

        credential.refresh_from_db()
        self.assertEqual(credential.status, CorePATCredential.StatusChoices.ROTATING)
        self.assertIsNotNone(credential.grace_until)

        new_token_id = rotate_response.data['new_token']['id']
        revoke_response = self.client.post(
            f'/api/core/v1/partner/pats/{new_token_id}/revoke/',
            {'reason': 'credential_leak_suspected'},
            format='json',
            HTTP_IDEMPOTENCY_KEY='revoke-pat-1',
        )

        self.assertEqual(revoke_response.status_code, status.HTTP_200_OK)
        self.assertEqual(revoke_response.data['object'], 'pat_revocation')

        revoked_token = CorePATCredential.objects.get(public_id=new_token_id)
        self.assertEqual(revoked_token.status, CorePATCredential.StatusChoices.REVOKED)
        self.assertEqual(revoked_token.metadata['revoke_reason'], 'credential_leak_suspected')

    def test_free_plan_cannot_access_partner_machine_access(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'free', 'email_verified': True},
        )
        self.user.refresh_from_db()
        self.client.force_authenticate(user=self.user)

        response = self.client.get('/api/core/v1/partner/service-accounts/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_partner_usage_and_billing_read_paths(self):
        now_vn = timezone.now().astimezone(VN_TZ)
        day_key = now_vn.date().isoformat()
        cache.set(f'open_core_quota:{day_key}:user:{self.user.id}:api_calls_per_day', 42, timeout=86400)
        cache.set(f'open_core_quota:{day_key}:user:{self.user.id}:ai_regenerate_per_day', 3, timeout=86400)

        revenue_plan, _ = DPIRevenuePlan.objects.update_or_create(
            plan='pro',
            defaults={
                'annual_price_usd': '490.00',
                'monthly_price_usd': '49.00',
                'per_api_call_cost': '0.0000',
                'per_team_member_cost': '0.00',
                'included_api_calls': 3000,
                'included_team_members': 1,
            },
        )
        DPISubscription.objects.update_or_create(
            user=self.user,
            defaults={
                'plan': revenue_plan,
                'billing_cycle': 'monthly',
                'renewal_date': timezone.now().date() + timedelta(days=30),
                'auto_renew': True,
            },
        )
        DPIInvoice.objects.create(
            user=self.user,
            invoice_number=f'INV-{self.user.id}-001',
            status='issued',
            issue_date=timezone.now().date(),
            due_date=timezone.now().date() + timedelta(days=7),
            subscription_amount='49.00',
            usage_based_amount='0.00',
            discount_amount='0.00',
            tax_amount='0.00',
            total_amount='49.00',
        )

        meters_response = self.client.get('/api/core/v1/partner/usage/meters/')
        self.assertEqual(meters_response.status_code, status.HTTP_200_OK)
        self.assertEqual(meters_response.data['object'], 'list')
        self.assertGreaterEqual(len(meters_response.data['data']), 4)
        api_calls_row = next(row for row in meters_response.data['data'] if row['meter_code'] == 'api_calls_per_day')
        self.assertEqual(api_calls_row['consumed_amount'], 42)
        self.assertEqual(api_calls_row['tenant_id'], f'ten_usr_{self.user.id}')

        quotas_response = self.client.get('/api/core/v1/partner/usage/quotas/')
        self.assertEqual(quotas_response.status_code, status.HTTP_200_OK)
        self.assertEqual(quotas_response.data['object'], 'list')
        quota_row = next(row for row in quotas_response.data['data'] if row['meter_code'] == 'api_calls_per_day')
        self.assertEqual(quota_row['object'], 'quota_snapshot')
        self.assertEqual(quota_row['consumed_amount'], 42)
        self.assertEqual(quota_row['entitled_amount'], 3000)

        subscription_response = self.client.get('/api/core/v1/partner/billing/subscription/')
        self.assertEqual(subscription_response.status_code, status.HTTP_200_OK)
        self.assertEqual(subscription_response.data['object'], 'subscription_summary')
        self.assertEqual(subscription_response.data['tenant_id'], f'ten_usr_{self.user.id}')
        self.assertEqual(subscription_response.data['plan_code'], 'pro')
        self.assertEqual(subscription_response.data['billing_cycle'], 'monthly')

        invoices_response = self.client.get('/api/core/v1/partner/billing/invoices/')
        self.assertEqual(invoices_response.status_code, status.HTTP_200_OK)
        self.assertEqual(invoices_response.data['object'], 'list')
        self.assertEqual(len(invoices_response.data['data']), 1)
        self.assertEqual(invoices_response.data['data'][0]['object'], 'invoice_summary')
        self.assertEqual(invoices_response.data['data'][0]['invoice_number'], f'INV-{self.user.id}-001')