"""Slice C / C7 — a plan downgrade must re-price, not just relabel.

C7 defect (verified file:line before the fix):
  commercial/tasks.py:252 manage_subscriptions_lifecycle is the ONLY downgrade path
  and it is absent from CELERY_BEAT_SCHEDULE, so downgrades never ran at all.
  Even when invoked, its downgrade branch (:262-280) set tenant.plan = FREE but
  touched neither QuotaRecord.api_calls_limit (the value the middleware reads, and
  with C2 live the value auto_suspend_quota_overflow uses) nor
  CoreTenant.max_active_pats — so a tenant that stopped paying kept paid headroom.
"""
from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from commercial.models import Invoice, QuotaRecord, Subscription
from commercial.plan_catalog import get_api_calls_limit
from commercial.tasks import _current_billing_period, manage_subscriptions_lifecycle
from identity_access.models import CoreTenant
from tenant_lifecycle.models import TenantLifecycleEvent


User = get_user_model()


class PlanDowngradeReseedsEntitlementTests(TestCase):
    def setUp(self):
        self.today = timezone.now().date()
        self.owner = User.objects.create_user(
            username='c7owner', email='c7owner@vninvest.vn', password='x'
        )
        self.tenant = CoreTenant.objects.create(
            owner_user=self.owner,
            tenant_code='c7_tenant',
            display_name='C7 tenant',
            plan=CoreTenant.PlanChoices.PRO,
            status=CoreTenant.StatusChoices.ACTIVE,
        )
        self.period_start, self.period_end = _current_billing_period(self.today)
        self.subscription = Subscription.objects.create(
            tenant=self.tenant,
            plan=CoreTenant.PlanChoices.PRO,
            status=Subscription.StatusChoices.ACTIVE,
            current_period_start=self.today - timedelta(days=200),
            current_period_end=self.today - timedelta(days=1),
            cancel_at_period_end=True,
        )

    def _quota_record(self, limit):
        return QuotaRecord.objects.create(
            tenant=self.tenant,
            period_start=self.period_start,
            period_end=self.period_end,
            api_calls_used=1234,
            api_calls_limit=limit,
        )

    def test_c7_downgrade_reseeds_the_current_period_quota_limit(self):
        record = self._quota_record(get_api_calls_limit(CoreTenant.PlanChoices.PRO))

        result = manage_subscriptions_lifecycle.run()

        self.assertEqual(result['downgraded_subscriptions'], 1)
        record.refresh_from_db()
        self.assertEqual(
            record.api_calls_limit,
            get_api_calls_limit(CoreTenant.PlanChoices.FREE),
            'a tenant that stopped paying must not keep the pro allowance',
        )
        self.assertEqual(
            record.api_calls_used, 1234, 'usage history must not be reset by a downgrade'
        )

    def test_c7_downgrade_reseeds_the_tenant_level_limit(self):
        self._quota_record(get_api_calls_limit(CoreTenant.PlanChoices.PRO))
        manage_subscriptions_lifecycle.run()
        self.tenant.refresh_from_db()
        self.assertEqual(self.tenant.plan, CoreTenant.PlanChoices.FREE)
        self.assertEqual(self.tenant.api_calls_limit, get_api_calls_limit(CoreTenant.PlanChoices.FREE))

    def test_c7_downgrade_resets_the_subscription_period(self):
        self._quota_record(get_api_calls_limit(CoreTenant.PlanChoices.PRO))
        manage_subscriptions_lifecycle.run()
        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.plan, CoreTenant.PlanChoices.FREE)
        self.assertFalse(self.subscription.cancel_at_period_end)
        self.assertEqual(self.subscription.current_period_start, self.today)

    def test_c7_downgrade_writes_a_plan_changed_audit_event(self):
        self._quota_record(get_api_calls_limit(CoreTenant.PlanChoices.PRO))
        manage_subscriptions_lifecycle.run()

        event = TenantLifecycleEvent.objects.filter(
            tenant=self.tenant,
            event_type=TenantLifecycleEvent.EventType.PLAN_CHANGED,
        ).first()
        self.assertIsNotNone(event, 'a downgrade that changes a limit must be auditable')
        self.assertEqual(event.old_value['plan'], CoreTenant.PlanChoices.PRO)
        self.assertEqual(event.new_value['plan'], CoreTenant.PlanChoices.FREE)
        self.assertTrue(event.metadata['quota_limit_changed'])
        self.assertFalse(event.metadata['negotiated_override_preserved'])

    def test_c7_downgrade_preserves_a_negotiated_quota_override_but_flags_it(self):
        record = self._quota_record(2_000_000)
        manage_subscriptions_lifecycle.run()

        record.refresh_from_db()
        self.assertEqual(
            record.api_calls_limit,
            2_000_000,
            'a hand-negotiated allowance must not be silently clobbered by a downgrade',
        )
        event = TenantLifecycleEvent.objects.filter(
            tenant=self.tenant, event_type=TenantLifecycleEvent.EventType.PLAN_CHANGED
        ).first()
        self.assertTrue(event.metadata['negotiated_override_preserved'])

    def test_c7_downgrade_is_idempotent(self):
        self._quota_record(get_api_calls_limit(CoreTenant.PlanChoices.PRO))
        manage_subscriptions_lifecycle.run()
        manage_subscriptions_lifecycle.run()
        self.assertEqual(
            QuotaRecord.objects.get().api_calls_limit,
            get_api_calls_limit(CoreTenant.PlanChoices.FREE),
        )

    def test_c7_renewal_path_does_not_downgrade_or_touch_entitlements(self):
        self.subscription.cancel_at_period_end = False
        self.subscription.save()
        self._quota_record(get_api_calls_limit(CoreTenant.PlanChoices.PRO))

        result = manage_subscriptions_lifecycle.run()

        self.assertEqual(result['downgraded_subscriptions'], 0)
        self.tenant.refresh_from_db()
        self.assertEqual(self.tenant.plan, CoreTenant.PlanChoices.PRO)
        self.assertEqual(
            QuotaRecord.objects.get().api_calls_limit,
            get_api_calls_limit(CoreTenant.PlanChoices.PRO),
        )
        self.assertEqual(Invoice.objects.count(), 1)

    def test_c7_tenant_without_a_quota_record_does_not_crash(self):
        self.assertFalse(QuotaRecord.objects.exists())
        result = manage_subscriptions_lifecycle.run()
        self.assertEqual(result['downgraded_subscriptions'], 1)
        self.tenant.refresh_from_db()
        self.assertEqual(self.tenant.plan, CoreTenant.PlanChoices.FREE)

    def test_c7_stale_period_record_is_not_rewritten(self):
        # only the CURRENT period governs enforcement; history must stay as it was
        old_record = QuotaRecord.objects.create(
            tenant=self.tenant,
            period_start=self.today - timedelta(days=90),
            period_end=self.today - timedelta(days=60),
            api_calls_limit=get_api_calls_limit(CoreTenant.PlanChoices.PRO),
        )
        self._quota_record(get_api_calls_limit(CoreTenant.PlanChoices.PRO))
        manage_subscriptions_lifecycle.run()
        old_record.refresh_from_db()
        self.assertEqual(old_record.api_calls_limit, get_api_calls_limit(CoreTenant.PlanChoices.PRO))
