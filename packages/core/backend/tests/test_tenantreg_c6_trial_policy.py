"""Slice C / C6 — one authoritative trial policy, and a warning that is actually sent.

C6 defect (verified file:line before the fix):
  tenant_lifecycle/tasks.py:26-49  auto_expire_trials   trial_ends_at < now   -> SUSPENDED
  identity_access/tasks.py:386-416 auto_disable_expired_trials
                                   trial_ends_at <= today-3d -> DEPROVISIONED
  Two contradictory handlers for the same condition, and the DEPROVISIONED one was
  NOT in CELERY_BEAT_SCHEDULE, so only the SUSPENDED one ever ran.

  send_trial_expiry_warning (tenant_lifecycle/tasks.py:91-109) reported
  queued_count=1 per tenant on the milestone day while sending NOTHING:
  _enqueue_trial_warning_email (:18-23) was a bare logger.info. Worse, the 8-day
  Redis dedup key at :103 was written BEFORE the enqueue, so the milestone was
  burned on the first run even if a real enqueue would have failed.

Also unscheduled: identity_access/tasks.py:346 check_trial_expirations (a second,
divergent 7/3/1 reminder implementation) and commercial/tasks.py:252
manage_subscriptions_lifecycle (the only downgrade path — see C7).
"""
from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone

from identity_access.models import CoreTenant
from tenant_lifecycle.models import TenantLifecycleEvent
from tenant_lifecycle.tasks import (
    TRIAL_EXPIRED_TERMINAL_STATUS,
    TRIAL_EXPIRY_REMINDER_DAYS,
    auto_expire_trials,
    auto_deprovision_stale,
    send_trial_expiry_warning,
    send_trial_expiry_warning_email,
)


User = get_user_model()


class SingleTrialPolicyTests(TestCase):
    def setUp(self):
        cache.clear()
        self.owner = User.objects.create_user(
            username='c6owner', email='c6owner@vninvest.vn', password='x'
        )

    def _trial(self, username, *, days_until_end, status=CoreTenant.StatusChoices.TRIAL):
        return CoreTenant.objects.create(
            owner_user=User.objects.create_user(
                username=username, email=f'{username}@vninvest.vn', password='x'
            ),
            tenant_code=username,
            display_name=username,
            status=status,
            trial_ends_at=timezone.now() + timedelta(days=days_until_end),
        )

    def test_c6_policy_is_suspend_not_deprovision(self):
        self.assertEqual(TRIAL_EXPIRED_TERMINAL_STATUS, CoreTenant.StatusChoices.SUSPENDED)

    def test_c6_contradictory_handlers_are_gone(self):
        import identity_access.tasks as ia_tasks

        self.assertFalse(
            hasattr(ia_tasks, 'auto_disable_expired_trials'),
            'the DEPROVISIONED trial handler must not come back — it contradicted '
            'auto_expire_trials and skipped the 30-day grace',
        )
        self.assertFalse(
            hasattr(ia_tasks, 'check_trial_expirations'),
            'the second, divergent 7/3/1 reminder implementation must not come back',
        )

    def test_c6_expired_trial_suspends_and_is_recoverable(self):
        tenant = self._trial('c6expired', days_until_end=-1)

        result = auto_expire_trials.run()

        self.assertEqual(result['expired_count'], 1)
        tenant.refresh_from_db()
        self.assertEqual(tenant.status, CoreTenant.StatusChoices.SUSPENDED)
        self.assertIsNotNone(tenant.suspended_at)
        self.assertTrue(
            TenantLifecycleEvent.objects.filter(
                tenant=tenant, event_type=TenantLifecycleEvent.EventType.TRIAL_EXPIRED
            ).exists()
        )

    def test_c6_deprovision_is_owned_only_by_the_stale_sweep_after_30_days(self):
        recently_suspended = self._trial('c6recent', days_until_end=-1)
        CoreTenant.objects.filter(pk=recently_suspended.pk).update(
            status=CoreTenant.StatusChoices.SUSPENDED,
            suspended_at=timezone.now() - timedelta(days=2),
        )
        long_suspended = self._trial('c6old', days_until_end=-40)
        CoreTenant.objects.filter(pk=long_suspended.pk).update(
            status=CoreTenant.StatusChoices.SUSPENDED,
            suspended_at=timezone.now() - timedelta(days=31),
        )

        result = auto_deprovision_stale.run()

        self.assertEqual(result['deprovisioned_count'], 1)
        recently_suspended.refresh_from_db()
        long_suspended.refresh_from_db()
        self.assertEqual(
            recently_suspended.status,
            CoreTenant.StatusChoices.SUSPENDED,
            'a customer suspended 2 days ago must not be deprovisioned',
        )
        self.assertEqual(long_suspended.status, CoreTenant.StatusChoices.DEPROVISIONED)


class TrialWarningActuallySendsTests(TestCase):
    def setUp(self):
        cache.clear()
        self.owner = User.objects.create_user(
            username='c6warn', email='c6warn@vninvest.vn', password='x'
        )

    def _trial_ending_in(self, days):
        return CoreTenant.objects.create(
            owner_user=User.objects.create_user(
                username=f'c6w{days}', email=f'c6w{days}@vninvest.vn', password='x'
            ),
            tenant_code=f'c6w{days}',
            display_name=f'c6w{days}',
            status=CoreTenant.StatusChoices.TRIAL,
            trial_ends_at=timezone.now() + timedelta(days=days),
        )

    def test_c6_warning_enqueues_a_real_task_for_every_milestone(self):
        for days in TRIAL_EXPIRY_REMINDER_DAYS:
            self._trial_ending_in(days)

        with patch('tenant_lifecycle.tasks.send_trial_expiry_warning_email.delay') as mock_delay:
            result = send_trial_expiry_warning.run()

        self.assertEqual(result['queued_count'], len(TRIAL_EXPIRY_REMINDER_DAYS))
        self.assertEqual(mock_delay.call_count, len(TRIAL_EXPIRY_REMINDER_DAYS))

    def test_c6_3_day_milestone_is_covered(self):
        # the old milestones were (7, 1) and dropped the 3-day nudge
        self.assertIn(3, TRIAL_EXPIRY_REMINDER_DAYS)
        self._trial_ending_in(3)
        with patch('tenant_lifecycle.tasks.send_trial_expiry_warning_email.delay') as mock_delay:
            send_trial_expiry_warning.run()
        mock_delay.assert_called_once()

    def test_c6_non_milestone_days_send_nothing(self):
        self._trial_ending_in(5)
        with patch('tenant_lifecycle.tasks.send_trial_expiry_warning_email.delay') as mock_delay:
            result = send_trial_expiry_warning.run()
        self.assertEqual(result['queued_count'], 0)
        mock_delay.assert_not_called()

    def test_c6_milestone_fires_once_per_tenant(self):
        self._trial_ending_in(7)
        with patch('tenant_lifecycle.tasks.send_trial_expiry_warning_email.delay'):
            first = send_trial_expiry_warning.run()
            second = send_trial_expiry_warning.run()
        self.assertEqual(first['queued_count'], 1)
        self.assertEqual(second['queued_count'], 0)

    def test_c6_failed_enqueue_does_not_burn_the_milestone(self):
        """C6: the dedup key used to be written BEFORE the enqueue."""
        self._trial_ending_in(7)

        with patch(
            'tenant_lifecycle.tasks.send_trial_expiry_warning_email.delay',
            side_effect=RuntimeError('broker down'),
        ):
            first = send_trial_expiry_warning.run()

        self.assertEqual(first['queued_count'], 0)
        self.assertFalse(
            cache.get(f'tenant:trial_warning:{CoreTenant.objects.get(tenant_code="c6w7").public_id}:7'),
            'a failed enqueue must not leave a dedup key behind',
        )

        # broker recovers -> the customer still gets the reminder
        with patch('tenant_lifecycle.tasks.send_trial_expiry_warning_email.delay') as mock_delay:
            second = send_trial_expiry_warning.run()
        self.assertEqual(second['queued_count'], 1)
        mock_delay.assert_called_once()

    def test_c6_email_task_actually_calls_the_mail_service(self):
        tenant = self._trial_ending_in(7)
        with patch('identity_access.mail_service.send_system_email') as mock_send:
            result = send_trial_expiry_warning_email.run(tenant.public_id, 7)

        self.assertEqual(result['status'], 'sent')
        mock_send.assert_called_once()
        kwargs = mock_send.call_args.kwargs
        self.assertEqual(kwargs['recipient_list'], [tenant.owner_user.email])
        self.assertIn('7', kwargs['subject'])
        self.assertIn('7', kwargs['message'])

    def test_c6_email_task_is_a_noop_without_an_owner_email(self):
        tenant = self._trial_ending_in(7)
        User.objects.filter(pk=tenant.owner_user_id).update(email='')
        with patch('identity_access.mail_service.send_system_email') as mock_send:
            result = send_trial_expiry_warning_email.run(tenant.public_id, 7)
        self.assertEqual(result['status'], 'skipped')
        mock_send.assert_not_called()

    def test_c6_email_task_is_a_noop_for_a_deleted_tenant(self):
        result = send_trial_expiry_warning_email.run(
            '00000000-0000-0000-0000-000000000000', 7
        )
        self.assertEqual(result['status'], 'skipped')
        self.assertEqual(result['reason'], 'tenant_missing')

    def test_c6_email_task_declares_a_retry_policy(self):
        # send_system_email raising must not lose the reminder
        self.assertIn(Exception, send_trial_expiry_warning_email.autoretry_for)
