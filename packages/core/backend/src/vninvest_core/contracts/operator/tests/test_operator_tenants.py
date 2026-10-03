"""R1 tests: operator tenants list — staff-only, filters, pagination (Standard).

Chạy: python manage.py test vninvest_core.contracts.operator.tests.test_operator_tenants
"""
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from identity_access.models import CoreTenant

BASE = '/core/v1/operator/tenants/'


class OperatorTenantListTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user(username='op_staff', password='x')
        self.staff.is_staff = True
        self.staff.save(update_fields=['is_staff'])
        self.plain = User.objects.create_user(username='op_plain', password='x')
        self.staff_client = APIClient()
        self.staff_client.force_authenticate(user=self.staff)
        self.plain_client = APIClient()
        self.plain_client.force_authenticate(user=self.plain)
        for i in range(25):
            owner = User.objects.create_user(username=f'op_owner_{i}', password='x')
            CoreTenant.objects.create(
                tenant_code=f'op_tenant_{i:02d}',
                display_name=f'Op Tenant {i:02d}',
                owner_user=owner,
                status=CoreTenant.StatusChoices.SUSPENDED if i % 5 == 0
                else CoreTenant.StatusChoices.ACTIVE,
                plan=CoreTenant.PlanChoices.PRO if i % 2 == 0
                else CoreTenant.PlanChoices.FREE)

    def test_non_staff_forbidden(self):
        resp = self.plain_client.get(BASE)
        self.assertEqual(resp.status_code, 403)

    def test_envelope_and_summary_cards(self):
        resp = self.staff_client.get(BASE)
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body['object'], 'operator_tenant_list')
        for key in ('data', 'summary_cards', 'count', 'next', 'previous'):
            self.assertIn(key, body)
        self.assertEqual(body['count'], 25)
        self.assertEqual(len(body['data']), 20)
        self.assertIsNotNone(body['next'])
        self.assertIsNone(body['previous'])
        keys = {c['key'] for c in body['summary_cards']}
        self.assertTrue({'total_tenants', 'active_tenants', 'suspended_tenants',
                         'trial_tenants'} <= keys)

    def test_page_two_and_page_size(self):
        resp = self.staff_client.get(f'{BASE}?page=2&page_size=10')
        body = resp.json()
        self.assertEqual(body['count'], 25)
        self.assertEqual(len(body['data']), 10)
        self.assertIsNotNone(body['previous'])
        resp = self.staff_client.get(f'{BASE}?page_size=500')
        self.assertLessEqual(len(resp.json()['data']), 100)

    def test_search_and_status_filter(self):
        resp = self.staff_client.get(f'{BASE}?search=op_tenant_01')
        body = resp.json()
        self.assertEqual(body['count'], 1)
        self.assertEqual(body['data'][0]['tenant_code'], 'op_tenant_01')
        resp = self.staff_client.get(
            f'{BASE}?status={CoreTenant.StatusChoices.SUSPENDED}&page_size=100')
        body = resp.json()
        self.assertEqual(body['count'], 5)
        self.assertTrue(all(r['status'] == CoreTenant.StatusChoices.SUSPENDED
                            for r in body['data']))

    def test_list_query_count_bounded(self):
        with self.assertNumQueries(8):
            resp = self.staff_client.get(f'{BASE}?page_size=20')
            self.assertEqual(resp.status_code, 200)
