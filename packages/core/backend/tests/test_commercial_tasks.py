"""Tenant upgrade T05 commercial task coverage."""
import os
import sys
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

from django.contrib.auth.models import User
from django.test import SimpleTestCase, TestCase
from django.utils import timezone

from commercial.models import Invoice, QuotaRecord, Subscription
from commercial.quota_period import current_billing_period, month_counter_key
from commercial.tasks import (
    check_overdue_invoices,
    flush_quota_counters,
    generate_monthly_invoices,
    send_quota_warning,
)
from identity_access.models import CoreTenant
from vninvest_core import settings
from vninvest_core.celery import app
from vninvest_core.queue_policy import SCHEDULER_QUEUE_MAP, TASK_ROUTES


class _ScanCacheClient:
    def __init__(self, keys):
        self.keys = keys

    def scan_iter(self, match=None):
        return iter(self.keys)


class _QuotaCacheStub:
    def __init__(self, values):
        self.values = dict(values)
        self._cache = _ScanCacheClient(list(self.values.keys()))
        self.added = set()

    def get(self, key, default=None):
        return self.values.get(key, default)

    def add(self, key, value, timeout=None):
        if key in self.values:
            return False
        self.values[key] = value
        self.added.add(key)
        return True

    def delete(self, key):
        if key in self.values:
            del self.values[key]
        return True


class CommercialTaskScheduleTests(SimpleTestCase):
    def test_commercial_tasks_route_to_default_queue(self):
        self.assertEqual(TASK_ROUTES['commercial.tasks.flush_quota_counters']['queue'], 'celery')
        self.assertEqual(TASK_ROUTES['commercial.tasks.generate_monthly_invoices']['queue'], 'celery')
        self.assertEqual(TASK_ROUTES['commercial.tasks.check_overdue_invoices']['queue'], 'celery')
        self.assertEqual(SCHEDULER_QUEUE_MAP['flush-quota-counters'], 'celery')
        self.assertEqual(settings.CELERY_BEAT_SCHEDULE['flush-quota-counters']['options']['queue'], 'celery')
        self.assertEqual(app.conf.task_routes, TASK_ROUTES)


class CommercialTasksTests(TestCase):
    def setUp(self):
        self.owner_one = User.objects.create_user(username='commercial-owner-one', password='testpass123')
        self.owner_two = User.objects.create_user(username='commercial-owner-two', password='testpass123')

        self.tenant_one = CoreTenant.objects.create(
            owner_user=self.owner_one,
            tenant_code='tenant-one',
            display_name='Tenant One',
            plan=CoreTenant.PlanChoices.STARTER,
            status=CoreTenant.StatusChoices.ACTIVE,
        )
        self.tenant_two = CoreTenant.objects.create(
            owner_user=self.owner_two,
            tenant_code='tenant-two',
            display_name='Tenant Two',
            plan=CoreTenant.PlanChoices.PRO,
            status=CoreTenant.StatusChoices.ACTIVE,
        )

    def test_flush_quota_counters_writes_db_and_is_idempotent(self):
        today = timezone.now().date()
        period_start = today.replace(day=1)
        period_end = (period_start + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        QuotaRecord.objects.create(
            tenant=self.tenant_one,
            period_start=period_start,
            period_end=period_end,
            api_calls_used=0,
            api_calls_limit=100,
        )

        # Bo dem TICH LUY THANG la nguon su that cho `api_calls_used`. Khoa bo
        # dem ngay (`quota:api_calls:{tenant}:{YYYY-MM-DD}`) chi 48h nen khong
        # cong don duoc, va doc no vao ban ghi thang chi lay gia tri cua MOT
        # ngay — chinh la ly do truoc day han muc thang ~30x len.
        month_key = month_counter_key(self.tenant_one.public_id, today)
        self.assertRegex(month_key, r'^quota:api_calls:month:[^:]+:\d{4}-\d{2}$')

        cache_stub = _QuotaCacheStub({month_key: 50})
        with patch('commercial.tasks.cache', cache_stub):
            first = flush_quota_counters.run(target_date=today.isoformat())
            cache_stub.delete('commercial:flush_quota_counters:throttle')
            second = flush_quota_counters.run(target_date=today.isoformat())

        quota = QuotaRecord.objects.get(tenant=self.tenant_one, period_start=period_start, period_end=period_end)
        self.assertEqual(first['processed'], 1)
        self.assertEqual(second['processed'], 1)
        self.assertEqual(first['unit'], 'monthly')
        self.assertEqual(quota.api_calls_used, 50)

    def test_month_counter_scan_pattern_excludes_daily_keys(self):
        """Khoa bo dem NGAY khong duoc quet vao ban ghi thang — se lam ~30x.

        Khong assert qua `_QuotaCacheStub` vi stub bo qua `match` (scan_iter cua
        no tra ve moi khoa). Kiem tra truc tiep glob ma Redis thuc su dung.
        """
        from fnmatch import fnmatch

        from commercial.quota_period import month_counter_scan_pattern

        today = timezone.now().date()
        pattern = month_counter_scan_pattern(today)

        self.assertIn(':month:', pattern)
        self.assertIn(today.strftime('%Y-%m'), pattern)
        # Khoa thang khop; khoa ngay khong khop.
        self.assertTrue(fnmatch(f'quota:api_calls:month:tnt_abc:{today:%Y-%m}', pattern))
        self.assertFalse(fnmatch(f'quota:api_calls:tnt_abc:{today.isoformat()}', pattern))
        # Ky truoc khong lan sang ky nay.
        self.assertFalse(fnmatch('quota:api_calls:month:tnt_abc:2020-01', pattern))

    def test_generate_monthly_invoices_creates_rows_for_active_subscriptions(self):
        today = date(2026, 5, 12)
        Subscription.objects.create(
            tenant=self.tenant_one,
            plan=CoreTenant.PlanChoices.STARTER,
            status=Subscription.StatusChoices.ACTIVE,
            current_period_start=date(2026, 5, 1),
            current_period_end=date(2026, 5, 31),
        )
        Subscription.objects.create(
            tenant=self.tenant_two,
            plan=CoreTenant.PlanChoices.PRO,
            status=Subscription.StatusChoices.ACTIVE,
            current_period_start=date(2026, 5, 1),
            current_period_end=date(2026, 5, 31),
        )

        result = generate_monthly_invoices.run(today_iso=today.isoformat())

        self.assertEqual(result['created'], 2)
        invoices = Invoice.objects.filter(period_start=date(2026, 5, 1)).order_by('tenant__tenant_code')
        self.assertEqual(invoices.count(), 2)
        self.assertEqual(invoices[0].status, Invoice.StatusChoices.OPEN)
        self.assertEqual(invoices[0].amount_due, Decimal('490000.00'))
        self.assertEqual(invoices[1].amount_due, Decimal('990000.00'))

    def test_check_overdue_invoices_marks_past_due_and_suspends_tenant(self):
        overdue_today = date(2026, 5, 12)
        due_date = overdue_today - timedelta(days=8)
        subscription = Subscription.objects.create(
            tenant=self.tenant_one,
            plan=CoreTenant.PlanChoices.STARTER,
            status=Subscription.StatusChoices.ACTIVE,
            current_period_start=date(2026, 5, 1),
            current_period_end=date(2026, 5, 31),
        )
        paid_subscription = Subscription.objects.create(
            tenant=self.tenant_two,
            plan=CoreTenant.PlanChoices.PRO,
            status=Subscription.StatusChoices.ACTIVE,
            current_period_start=date(2026, 5, 1),
            current_period_end=date(2026, 5, 31),
        )
        overdue_invoice = Invoice.objects.create(
            tenant=self.tenant_one,
            invoice_number='INV-202605-TENANT-ONE-0001',
            status=Invoice.StatusChoices.OPEN,
            amount_due=Decimal('490000.00'),
            period_start=date(2026, 5, 1),
            period_end=date(2026, 5, 31),
            due_date=due_date,
        )
        paid_invoice = Invoice.objects.create(
            tenant=self.tenant_two,
            invoice_number='INV-202605-TENANT-TWO-0001',
            status=Invoice.StatusChoices.PAID,
            amount_due=Decimal('990000.00'),
            period_start=date(2026, 5, 1),
            period_end=date(2026, 5, 31),
            due_date=due_date,
            paid_at=timezone.now(),
        )

        result = check_overdue_invoices.run(today_iso=overdue_today.isoformat())

        overdue_invoice.refresh_from_db()
        self.tenant_one.refresh_from_db()
        subscription.refresh_from_db()
        paid_invoice.refresh_from_db()
        self.tenant_two.refresh_from_db()
        paid_subscription.refresh_from_db()

        self.assertEqual(result['updated_invoices'], 1)
        self.assertEqual(result['suspended_tenants'], 1)
        self.assertEqual(overdue_invoice.status, Invoice.StatusChoices.PAST_DUE)
        self.assertEqual(self.tenant_one.status, CoreTenant.StatusChoices.SUSPENDED)
        self.assertIsNotNone(self.tenant_one.suspended_at)
        self.assertEqual(subscription.status, Subscription.StatusChoices.PAST_DUE)
        self.assertEqual(paid_invoice.status, Invoice.StatusChoices.PAID)
        self.assertEqual(self.tenant_two.status, CoreTenant.StatusChoices.ACTIVE)
        self.assertEqual(paid_subscription.status, Subscription.StatusChoices.ACTIVE)

    def test_send_quota_warning_deduplicates_per_day(self):
        """W0.6: task phai GUI email that, khong chi ghi log ('queued').

        Truoc day ham tra {'status': 'queued'} ⇒ nguoi dung tin nham da canh bao.
        Nay: lan 1 gui email (sent), lan 2 bi dedup.
        """
        cache_stub = _QuotaCacheStub({})
        with patch('commercial.tasks.cache', cache_stub), \
             patch('commercial.tasks._tenant_owner_email', return_value='owner@example.com'), \
             patch('commercial.tasks.OutboundNotificationService.send_email', return_value=True):
            first = send_quota_warning.run(str(self.tenant_one.public_id), 80)
            second = send_quota_warning.run(str(self.tenant_one.public_id), 80)

        self.assertEqual(first['status'], 'sent')
        self.assertEqual(second['status'], 'skipped')
        self.assertEqual(second['reason'], 'duplicate_warning')