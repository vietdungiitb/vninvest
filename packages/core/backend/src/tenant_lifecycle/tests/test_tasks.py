from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from commercial.models import QuotaRecord
from identity_access.models import CoreTenant
from tenant_lifecycle.models import TenantLifecycleEvent
from tenant_lifecycle.tasks import (
    auto_deprovision_stale,
    auto_expire_trials,
    auto_suspend_quota_overflow,
    send_trial_expiry_warning,
)


class TenantLifecycleTasksTests(TestCase):
    def setUp(self):
        self.user_trial = User.objects.create_user(username='tl-trial-owner', password='testpass123')
        self.user_active = User.objects.create_user(username='tl-active-owner', password='testpass123')
        self.user_suspend = User.objects.create_user(username='tl-suspend-owner', password='testpass123')

        self.trial_tenant = CoreTenant.objects.create(
            owner_user=self.user_trial,
            tenant_code='tl-trial-tenant',
            display_name='TL Trial Tenant',
            status=CoreTenant.StatusChoices.TRIAL,
            trial_ends_at=timezone.now() - timedelta(days=1),
        )
        self.active_tenant = CoreTenant.objects.create(
            owner_user=self.user_active,
            tenant_code='tl-active-tenant',
            display_name='TL Active Tenant',
            status=CoreTenant.StatusChoices.ACTIVE,
        )
        self.suspended_tenant = CoreTenant.objects.create(
            owner_user=self.user_suspend,
            tenant_code='tl-suspended-tenant',
            display_name='TL Suspended Tenant',
            status=CoreTenant.StatusChoices.SUSPENDED,
            suspended_at=timezone.now() - timedelta(days=31),
        )

    def test_auto_expire_trials_suspends_tenant_and_logs_event(self):
        result = auto_expire_trials.run()

        self.trial_tenant.refresh_from_db()
        self.assertEqual(result['expired_count'], 1)
        self.assertEqual(self.trial_tenant.status, CoreTenant.StatusChoices.SUSPENDED)
        self.assertTrue(
            TenantLifecycleEvent.objects.filter(
                tenant=self.trial_tenant,
                event_type=TenantLifecycleEvent.EventType.TRIAL_EXPIRED,
            ).exists()
        )

    def test_auto_suspend_quota_overflow_suspends_tenant(self):
        today = timezone.now().date()
        QuotaRecord.objects.create(
            tenant=self.active_tenant,
            period_start=today.replace(day=1),
            period_end=(today.replace(day=1) + timedelta(days=32)).replace(day=1) - timedelta(days=1),
            api_calls_used=101,
            api_calls_limit=100,
        )

        result = auto_suspend_quota_overflow.run()

        self.active_tenant.refresh_from_db()
        self.assertEqual(result['suspended_count'], 1)
        self.assertEqual(self.active_tenant.status, CoreTenant.StatusChoices.SUSPENDED)
        self.assertTrue(
            TenantLifecycleEvent.objects.filter(
                tenant=self.active_tenant,
                event_type=TenantLifecycleEvent.EventType.QUOTA_EXCEEDED,
            ).exists()
        )

    def test_send_trial_expiry_warning_enqueues_once_per_milestone(self):
        warning_user = User.objects.create_user(username='tl-warning-owner', password='testpass123')
        warning_tenant = CoreTenant.objects.create(
            owner_user=warning_user,
            tenant_code='tl-warning-tenant',
            display_name='TL Warning Tenant',
            status=CoreTenant.StatusChoices.TRIAL,
            trial_ends_at=timezone.now() + timedelta(days=7),
        )

        with patch('tenant_lifecycle.tasks._enqueue_trial_warning_email') as mocked_enqueue:
            first = send_trial_expiry_warning.run()
            second = send_trial_expiry_warning.run()

        self.assertEqual(first['queued_count'], 1)
        self.assertEqual(second['queued_count'], 0)
        mocked_enqueue.assert_called_once()
        self.assertEqual(mocked_enqueue.call_args.kwargs['tenant'].id, warning_tenant.id)

    def test_auto_deprovision_stale_marks_tenant_deprovisioned(self):
        result = auto_deprovision_stale.run()

        self.suspended_tenant.refresh_from_db()
        self.assertEqual(result['deprovisioned_count'], 1)
        self.assertEqual(self.suspended_tenant.status, CoreTenant.StatusChoices.DEPROVISIONED)
        self.assertTrue(
            TenantLifecycleEvent.objects.filter(
                tenant=self.suspended_tenant,
                event_type=TenantLifecycleEvent.EventType.DEPROVISIONED,
            ).exists()
        )
