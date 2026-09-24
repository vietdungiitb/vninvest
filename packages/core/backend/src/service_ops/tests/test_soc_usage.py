"""R3 tests: SOC usage fleet aggregates (staff-only, read-only).

Chạy: python manage.py test service_ops.tests.test_soc_usage
"""
from datetime import date, timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from commercial.models import QuotaRecord
from identity_access.models import CoreTenant
from ops_audit.models import ApiCallRollup

OVERVIEW = '/api/soc/usage/overview/'


class SocUsageFleetTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user(username='use_staff', password='x')
        self.staff.is_staff = True
        self.staff.save(update_fields=['is_staff'])
        self.plain = User.objects.create_user(username='use_plain', password='x')
        self.staff_client = APIClient()
        self.staff_client.force_authenticate(user=self.staff)
        self.plain_client = APIClient()
        self.plain_client.force_authenticate(user=self.plain)
        self.today = date.today()
        self.tenants = []
        for i in range(3):
            owner = User.objects.create_user(username=f'use_owner_{i}', password='x')
            tenant = CoreTenant.objects.create(
                tenant_code=f'use_t_{i}', display_name=f'Use T {i}',
                owner_user=owner, status=CoreTenant.StatusChoices.ACTIVE,
                plan=CoreTenant.PlanChoices.PRO)
            self.tenants.append(tenant)
            ApiCallRollup.objects.create(
                tenant_id=tenant.public_id, date=self.today, hour=10,
                endpoint_group='api', status_group='2xx',
                call_count=100 * (i + 1), error_count=10 * i)
            QuotaRecord.objects.create(
                tenant=tenant, period_start=self.today - timedelta(days=5),
                period_end=self.today + timedelta(days=25),
                api_calls_used=90 if i == 0 else 10, api_calls_limit=100)

    def test_non_staff_forbidden(self):
        self.assertEqual(self.plain_client.get(OVERVIEW).status_code, 403)

    def test_overview_numbers(self):
        body = self.staff_client.get(OVERVIEW).json()
        self.assertEqual(body['calls_30d'], 600)
        self.assertEqual(body['calls_today'], 600)
        self.assertAlmostEqual(body['error_rate_30d'], 30 / 600)
        top = body['top_tenants']
        self.assertEqual(len(top), 3)
        self.assertEqual(top[0]['tenant_code'], 'use_t_2')
        self.assertEqual(top[0]['calls'], 300)
        self.assertEqual(top[0]['errors'], 20)

    def test_quotas_near_limit(self):
        body = self.staff_client.get(OVERVIEW).json()
        near = body['quotas_near_limit']
        self.assertEqual(len(near), 1)
        self.assertEqual(near[0]['tenant_code'], 'use_t_0')
        self.assertEqual(near[0]['meter'], 'api_calls')
        self.assertEqual(near[0]['used_pct'], 90.0)

    def test_export_csv(self):
        resp = self.staff_client.get('/api/soc/usage/export/?days=7')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('text/csv', resp['Content-Type'])
        content = b''.join(resp.streaming_content).decode('utf-8')
        self.assertIn('top_tenants', content)
        self.assertIn('use_t_2', content)
        self.assertIn('quotas_near_limit', content)
        resp = self.plain_client.get('/api/soc/usage/export/')
        self.assertEqual(resp.status_code, 403)
