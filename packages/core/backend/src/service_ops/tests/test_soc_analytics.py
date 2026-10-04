"""R8.1 tests: SOC analytics growth (staff-only, read-only).

Chạy: python manage.py test service_ops.tests.test_soc_analytics
"""
from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from commercial.models import Invoice, QuotaRecord, Subscription
from identity_access.models import CoreTenant

from service_ops.tests.envelope import unwrapped_json

BASE = '/api/soc/analytics/growth/'
COHORTS = '/api/soc/analytics/cohorts/'
ALERTS = '/api/soc/analytics/alerts/'


class SocAnalyticsGrowthTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user(username='an_staff', password='x')
        self.staff.is_staff = True
        self.staff.save(update_fields=['is_staff'])
        self.plain = User.objects.create_user(username='an_plain', password='x')
        self.staff_client = APIClient()
        self.staff_client.force_authenticate(user=self.staff)
        self.plain_client = APIClient()
        self.plain_client.force_authenticate(user=self.plain)
        now = timezone.now()
        owner = User.objects.create_user(username='an_owner', password='x')
        owner.date_joined = now - timedelta(days=2)
        owner.save(update_fields=['date_joined'])
        self.owner_date_joined = owner.date_joined
        tenant = CoreTenant.objects.create(
            tenant_code='an_t', display_name='An T', owner_user=owner,
            status=CoreTenant.StatusChoices.TRIAL)
        tenant.created_at = now - timedelta(days=2)
        tenant.save(update_fields=['created_at'])
        self.tenant_created_at = tenant.created_at
        Subscription.objects.create(
            tenant=tenant, plan='pro', status=Subscription.StatusChoices.ACTIVE,
            current_period_start=now.date() - timedelta(days=1),
            current_period_end=now.date() + timedelta(days=29))

    def test_non_staff_forbidden(self):
        self.assertEqual(self.plain_client.get(BASE).status_code, 403)

    def test_series_shape_and_counts(self):
        body = unwrapped_json(self.staff_client.get(f'{BASE}?days=7'))
        self.assertEqual(body['days'], 7)
        for key in ('signups', 'trials', 'paid_new', 'churned'):
            self.assertEqual(len(body[key]), 7)
        by_date = {r['date']: r['count'] for r in body['signups']}
        # Derive the expected day from the stored instant rendered in the CURRENT
        # timezone, because that is what `date_joined__date` does server-side
        # (`analytics.py:34-38`, TIME_ZONE=Asia/Ho_Chi_Minh). Calling `.date()` on
        # the UTC-aware `timezone.now()` instead is off by one day during
        # 17:00-24:00 UTC, which made this test time-of-day flaky.
        target = timezone.localtime(self.owner_date_joined).date().isoformat()
        self.assertGreaterEqual(by_date.get(target, 0), 1)
        trials = {r['date']: r['count'] for r in body['trials']}
        target_trial = timezone.localtime(self.tenant_created_at).date().isoformat()
        self.assertGreaterEqual(trials.get(target_trial, 0), 1)

    def test_days_clamped(self):
        body = unwrapped_json(self.staff_client.get(f'{BASE}?days=500'))
        self.assertEqual(body['days'], 90)
        self.assertEqual(len(body['signups']), 90)


class SocAnalyticsCohortsTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user(username='co_staff', password='x')
        self.staff.is_staff = True
        self.staff.save(update_fields=['is_staff'])
        self.plain = User.objects.create_user(username='co_plain', password='x')
        self.staff_client = APIClient()
        self.staff_client.force_authenticate(user=self.staff)
        self.plain_client = APIClient()
        self.plain_client.force_authenticate(user=self.plain)
        today = timezone.now().date()

        def make_tenant(code, owner_name, status, plan):
            owner = User.objects.create_user(username=owner_name, password='x')
            return CoreTenant.objects.create(
                tenant_code=code, display_name=code, owner_user=owner,
                status=status, plan=plan)

        # Trial chưa trả phí.
        make_tenant('co_trial', 'co_owner', CoreTenant.StatusChoices.TRIAL, 'free')
        # Trial ĐÃ trả phí (overlap — chỉ đếm 1 lần ở mẫu số).
        overlap = make_tenant('co_overlap', 'co_owner2',
                              CoreTenant.StatusChoices.TRIAL, 'free')
        Invoice.objects.create(
            tenant=overlap, invoice_number='INV-CO-1',
            status=Invoice.StatusChoices.PAID, amount_due=100,
            period_start=today - timedelta(days=30), period_end=today,
            paid_at=timezone.now())
        # Active đã trả phí.
        paid = make_tenant('co_paid', 'co_owner3',
                           CoreTenant.StatusChoices.ACTIVE, 'pro')
        Invoice.objects.create(
            tenant=paid, invoice_number='INV-CO-2',
            status=Invoice.StatusChoices.PAID, amount_due=200,
            period_start=today - timedelta(days=30), period_end=today,
            paid_at=timezone.now())
        # Có subscription nhưng CHƯA trả invoice nào → không tính converted
        # (chứng minh đếm theo Invoice paid, không theo Subscription).
        sub_only = make_tenant('co_subonly', 'co_owner4',
                               CoreTenant.StatusChoices.ACTIVE, 'pro')
        Subscription.objects.create(
            tenant=sub_only, plan='pro',
            status=Subscription.StatusChoices.ACTIVE,
            current_period_start=today, current_period_end=today + timedelta(days=30))

    def test_non_staff_forbidden(self):
        self.assertEqual(self.plain_client.get(COHORTS).status_code, 403)

    def test_cohort_numbers_distinct_and_invoice_based(self):
        body = unwrapped_json(self.staff_client.get(COHORTS))
        self.assertEqual(body['trial_active'], 2)
        self.assertEqual(body['converted_paid'], 2)
        # ever = 2 trial + 2 converted − 1 overlap = 3 → rate 2/3.
        self.assertAlmostEqual(body['conversion_rate'], 2 / 3, places=4)
        plans = {r['plan']: r['count'] for r in body['plan_mix']}
        self.assertEqual(plans.get('pro'), 2)
        self.assertIn('conversion', body['notes'])


class SocAnalyticsAlertsTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user(username='al_staff', password='x')
        self.staff.is_staff = True
        self.staff.save(update_fields=['is_staff'])
        self.plain = User.objects.create_user(username='al_plain', password='x')
        self.staff_client = APIClient()
        self.staff_client.force_authenticate(user=self.staff)
        self.plain_client = APIClient()
        self.plain_client.force_authenticate(user=self.plain)
        today = timezone.now().date()
        owner = User.objects.create_user(username='al_owner', password='x')
        trial = CoreTenant.objects.create(
            tenant_code='al_trial', display_name='Al Trial', owner_user=owner,
            status=CoreTenant.StatusChoices.TRIAL)
        trial.trial_ends_at = timezone.now() + timedelta(days=2)
        trial.save(update_fields=['trial_ends_at'])
        owner2 = User.objects.create_user(username='al_owner2', password='x')
        hot = CoreTenant.objects.create(
            tenant_code='al_hot', display_name='Al Hot', owner_user=owner2,
            status=CoreTenant.StatusChoices.ACTIVE)
        QuotaRecord.objects.create(
            tenant=hot, period_start=today - timedelta(days=5),
            period_end=today + timedelta(days=25),
            api_calls_used=95, api_calls_limit=100)
        Invoice.objects.create(
            tenant=hot, invoice_number='INV-AL-1',
            status=Invoice.StatusChoices.PAST_DUE, amount_due=1000,
            period_start=today - timedelta(days=30), period_end=today)

    def test_non_staff_forbidden(self):
        self.assertEqual(self.plain_client.get(ALERTS).status_code, 403)

    def test_each_alert_kind_present(self):
        body = unwrapped_json(self.staff_client.get(ALERTS))
        kinds = {(a['kind'], a['tenant_code']) for a in body['alerts']}
        self.assertIn(('trial_expiring', 'al_trial'), kinds)
        self.assertIn(('quota_critical', 'al_hot'), kinds)
        self.assertIn(('invoice_past_due', 'al_hot'), kinds)
        self.assertIn('suspended_spike_7d', body)
