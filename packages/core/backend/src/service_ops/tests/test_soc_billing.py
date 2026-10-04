"""R2 tests: SOC billing fleet aggregates (staff-only, read-only).

Chạy: python manage.py test service_ops.tests.test_soc_billing
"""
from datetime import date, timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from commercial.models import Invoice, Subscription
from identity_access.models import CoreTenant

from service_ops.tests.envelope import unwrapped_json

OVERVIEW = '/api/soc/billing/overview/'
INVOICES = '/api/soc/billing/invoices/'


class SocBillingFleetTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user(username='bill_staff', password='x')
        self.staff.is_staff = True
        self.staff.save(update_fields=['is_staff'])
        self.plain = User.objects.create_user(username='bill_plain', password='x')
        self.staff_client = APIClient()
        self.staff_client.force_authenticate(user=self.staff)
        self.plain_client = APIClient()
        self.plain_client.force_authenticate(user=self.plain)
        today = date.today()
        self.tenants = []
        for i, plan in enumerate(('pro', 'starter')):
            owner = User.objects.create_user(username=f'bill_owner_{i}', password='x')
            tenant = CoreTenant.objects.create(
                tenant_code=f'bill_t_{i}', display_name=f'Bill T {i}',
                owner_user=owner, status=CoreTenant.StatusChoices.ACTIVE,
                plan=plan)
            Subscription.objects.create(
                tenant=tenant, plan=plan,
                status=Subscription.StatusChoices.ACTIVE,
                current_period_start=today - timedelta(days=10),
                current_period_end=today + timedelta(days=20))
            Invoice.objects.create(
                tenant=tenant, invoice_number=f'INV-R2-{i}',
                status=Invoice.StatusChoices.PAID, amount_due=100000 + i,
                period_start=today - timedelta(days=30), period_end=today,
                paid_at=timezone.now())
            self.tenants.append(tenant)
        Invoice.objects.create(
            tenant=self.tenants[0], invoice_number='INV-R2-OD',
            status=Invoice.StatusChoices.PAST_DUE, amount_due=50000,
            period_start=today - timedelta(days=30), period_end=today)

    def test_non_staff_forbidden(self):
        self.assertEqual(self.plain_client.get(OVERVIEW).status_code, 403)
        self.assertEqual(self.plain_client.get(INVOICES).status_code, 403)

    def test_overview_numbers(self):
        body = unwrapped_json(self.staff_client.get(OVERVIEW))
        self.assertEqual(body['mrr'], 600000)
        self.assertEqual(body['arr'], 7200000)
        self.assertEqual(body['currency'], 'VND')
        mix = {r['plan']: r for r in body['plan_mix']}
        self.assertEqual(mix['pro']['count'], 1)
        self.assertEqual(mix['pro']['mrr'], 500000)
        self.assertEqual(body['invoices_failed_30d'], 1)
        cur_month = date.today().strftime('%Y-%m')
        months = {r['month']: r for r in body['revenue_6m']}
        self.assertEqual(len(body['revenue_6m']), 6)
        # `Invoice.amount_due` is `DecimalField(decimal_places=2)`
        # (commercial/models.py:73), so `Sum(...)` yields Decimal('200001.00') and
        # `str(total)` (billing.py:73) renders two decimals. The old '200001'
        # expectation could only hold while the aggregate fell back to int 0.
        self.assertEqual(months[cur_month]['total'], '200001.00')

    def test_invoices_list_filter_paginate(self):
        body = unwrapped_json(self.staff_client.get(INVOICES))
        self.assertEqual(body['count'], 3)
        body = unwrapped_json(self.staff_client.get(f'{INVOICES}?status=paid'))
        self.assertEqual(body['count'], 2)
        self.assertTrue(all(r['status'] == 'paid' for r in body['results']))
        body = unwrapped_json(self.staff_client.get(f'{INVOICES}?search=bill_t_0'))
        self.assertTrue(all(r['tenant_code'] == 'bill_t_0' for r in body['results']))
        body = unwrapped_json(self.staff_client.get(f'{INVOICES}?page=2&page_size=2'))
        self.assertEqual(len(body['results']), 1)
        resp = self.staff_client.get(f'{INVOICES}?status=nope')
        self.assertEqual(resp.status_code, 400)

    def test_invoices_csv_export(self):
        resp = self.staff_client.get(f'{INVOICES}?download=csv&status=paid')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('text/csv', resp['Content-Type'])
        content = b''.join(resp.streaming_content).decode('utf-8')
        lines = content.strip().splitlines()
        self.assertTrue(lines[0].startswith('invoice_number,'))
        self.assertEqual(len(lines), 3)  # header + 2 paid
        self.assertIn('INV-R2-0', content)
        self.assertNotIn('secret', content.lower())
        resp = self.plain_client.get(f'{INVOICES}?download=csv')
        self.assertEqual(resp.status_code, 403)
