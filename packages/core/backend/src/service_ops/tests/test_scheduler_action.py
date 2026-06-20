# -*- coding: utf-8 -*-
"""Tests for S02 + S03: Capability Matrix, Ownership Guard, Control Actions Executor."""

from unittest.mock import patch, MagicMock

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from service_ops.registry import ensure_service_registry

User = get_user_model()

_ACTION_URL = '/core/v1/operator/scraping/dataops/scheduler/jobs/{job_key}/actions/'


class SchedulerJobActionOwnershipTests(TestCase):
    """Tests ownership + capability guard for POST .../jobs/{job_key}/actions/."""

    @classmethod
    def setUpTestData(cls):
        ensure_service_registry()
        cls.admin = User.objects.create_user(
            username='sched-action-admin',
            email='sched-action-admin@test.local',
            password='pass123',
        )
        cls.admin.is_staff = True
        cls.admin.is_superuser = True
        cls.admin.save(update_fields=['is_staff', 'is_superuser'])

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_action_valid_job_valid_action_returns_202(self):
        url = _ACTION_URL.format(job_key='market-data-queue-tier-scheduler-30s')
        response = self.client.post(url, {'action': 'enable'}, format='json')
        self.assertEqual(response.status_code, 202)

    def test_action_response_has_required_fields(self):
        url = _ACTION_URL.format(job_key='market-data-queue-tier-scheduler-30s')
        response = self.client.post(url, {'action': 'enable'}, format='json')
        data = response.json()
        self.assertIn('job_key', data)
        self.assertIn('action', data)
        self.assertIn('accepted', data)
        self.assertIn('message', data)
        self.assertIn('executed_at', data)
        self.assertTrue(data['accepted'])

    def test_action_accepted_reflects_action_name(self):
        url = _ACTION_URL.format(job_key='market-data-queue-tier-scheduler-30s')
        response = self.client.post(url, {'action': 'disable'}, format='json')
        data = response.json()
        self.assertEqual(data['action'], 'disable')
        self.assertEqual(data['job_key'], 'market-data-queue-tier-scheduler-30s')

    def test_action_with_reason_is_accepted(self):
        url = _ACTION_URL.format(job_key='market-data-queue-tier-scheduler-30s')
        response = self.client.post(
            url,
            {'action': 'run_now', 'reason': 'Manual trigger for testing'},
            format='json',
        )
        self.assertEqual(response.status_code, 202)

    def test_action_unknown_job_returns_404(self):
        url = _ACTION_URL.format(job_key='non-existent-scheduler-job-xyz')
        response = self.client.post(url, {'action': 'enable'}, format='json')
        self.assertEqual(response.status_code, 404)
        data = response.json()
        self.assertEqual(data['code'], 'SCHEDULER_JOB_NOT_FOUND')

    def test_action_invalid_action_value_returns_400(self):
        url = _ACTION_URL.format(job_key='market-data-queue-tier-scheduler-30s')
        response = self.client.post(url, {'action': 'delete_everything'}, format='json')
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertEqual(data['code'], 'SCHEDULER_ACTION_INVALID_REQUEST')

    def test_action_missing_action_field_returns_400(self):
        url = _ACTION_URL.format(job_key='market-data-queue-tier-scheduler-30s')
        response = self.client.post(url, {}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_action_platform_domain_blocked_returns_403(self):
        # auto-deprovision-stale is platform domain
        url = _ACTION_URL.format(job_key='auto-deprovision-stale')
        response = self.client.post(url, {'action': 'enable'}, format='json')
        self.assertEqual(response.status_code, 403)
        data = response.json()
        self.assertEqual(data['code'], 'SCHEDULER_ACTION_OWNERSHIP_DENIED')

    def test_platform_managed_control_mode_has_no_allowed_actions(self):
        from service_ops.views.scheduler import _ALLOWED_ACTIONS_BY_CONTROL_MODE
        self.assertEqual(len(_ALLOWED_ACTIONS_BY_CONTROL_MODE.get('platform_managed', frozenset())), 0)

    def test_beat_read_only_allows_only_run_now(self):
        from service_ops.views.scheduler import _ALLOWED_ACTIONS_BY_CONTROL_MODE
        allowed = _ALLOWED_ACTIONS_BY_CONTROL_MODE.get('beat_read_only', frozenset())
        self.assertIn('run_now', allowed)
        self.assertNotIn('enable', allowed)
        self.assertNotIn('disable', allowed)
        self.assertNotIn('abort', allowed)

    def test_action_requires_auth(self):
        client = APIClient()
        url = _ACTION_URL.format(job_key='market-data-queue-tier-scheduler-30s')
        response = client.post(url, {'action': 'enable'}, format='json')
        self.assertEqual(response.status_code, 401)

    def test_action_requires_admin(self):
        regular_user = User.objects.create_user(
            username='sched-regular-action',
            email='sched-regular-action@test.local',
            password='pass123',
        )
        client = APIClient()
        client.force_authenticate(user=regular_user)
        url = _ACTION_URL.format(job_key='market-data-queue-tier-scheduler-30s')
        response = client.post(url, {'action': 'enable'}, format='json')
        self.assertEqual(response.status_code, 403)


class SchedulerJobActionS03ExecutionTests(TestCase):
    """S03 tests: actual execution via PeriodicTask toggle + ServiceRunLog."""

    @classmethod
    def setUpTestData(cls):
        ensure_service_registry()
        cls.admin = User.objects.create_user(
            username='sched-s03-admin',
            email='sched-s03-admin@test.local',
            password='pass123',
        )
        cls.admin.is_staff = True
        cls.admin.is_superuser = True
        cls.admin.save(update_fields=['is_staff', 'is_superuser'])

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_enable_toggles_periodic_task(self):
        """enable action sets PeriodicTask.enabled=True."""
        from django_celery_beat.models import PeriodicTask, IntervalSchedule
        schedule, _ = IntervalSchedule.objects.get_or_create(
            every=30, period=IntervalSchedule.SECONDS
        )
        pt = PeriodicTask.objects.create(
            name='market-data-queue-tier-scheduler-30s',
            task='service_ops.run_market_data_queue_tier_scheduler',
            interval=schedule,
            enabled=False,
        )
        url = _ACTION_URL.format(job_key='market-data-queue-tier-scheduler-30s')
        response = self.client.post(url, {'action': 'enable'}, format='json')
        self.assertEqual(response.status_code, 202)
        pt.refresh_from_db()
        self.assertTrue(pt.enabled)
        pt.delete()

    def test_disable_toggles_periodic_task(self):
        """disable action sets PeriodicTask.enabled=False."""
        from django_celery_beat.models import PeriodicTask, IntervalSchedule
        schedule, _ = IntervalSchedule.objects.get_or_create(
            every=30, period=IntervalSchedule.SECONDS
        )
        pt = PeriodicTask.objects.create(
            name='market-data-queue-tier-scheduler-30s-dis',
            task='service_ops.run_market_data_queue_tier_scheduler',
            interval=schedule,
            enabled=True,
        )
        from service_ops.views.scheduler import _execute_scheduler_action
        from service_ops.scheduler_catalog import CATALOG_JOB_METADATA
        meta = dict(CATALOG_JOB_METADATA.get('market-data-queue-tier-scheduler-30s', {}))
        result = _execute_scheduler_action(
            job_key='market-data-queue-tier-scheduler-30s-dis',
            action='disable',
            meta=meta,
            actor='test-operator',
            actor_ip=None,
            reason='test',
            request_id='req-test',
        )
        self.assertTrue(result['accepted'])
        pt.refresh_from_db()
        self.assertFalse(pt.enabled)
        pt.delete()

    def test_run_now_accepted_with_patched_broker(self):
        """run_now returns accepted=True (broker call is patched)."""
        url = _ACTION_URL.format(job_key='market-data-queue-tier-scheduler-30s')
        with patch('celery.app.base.Celery.send_task') as mock_send:
            mock_result = MagicMock()
            mock_result.id = 'mock-task-id-123'
            mock_send.return_value = mock_result
            response = self.client.post(url, {'action': 'run_now'}, format='json')
        self.assertEqual(response.status_code, 202)
        data = response.json()
        self.assertTrue(data['accepted'])

    def test_abort_returns_202_with_revoke_message(self):
        """abort action returns 202 with revoke info message."""
        url = _ACTION_URL.format(job_key='market-data-queue-tier-scheduler-30s')
        with patch('celery.app.control.Control.revoke'):
            response = self.client.post(url, {'action': 'abort'}, format='json')
        self.assertEqual(response.status_code, 202)
        data = response.json()
        self.assertTrue(data['accepted'])
        self.assertIn('revoke', data['message'])

    def test_abort_backfill_job_uses_catalog_service_key_mapping(self):
        """abort must resolve backfill service via CATALOG service_key, not job_key literal."""
        from service_ops.models import ServiceRunLog, BackfillExecutionRun
        from service_ops.registry import get_registered_service

        service = get_registered_service('backfill_daily_prices')
        run_log = ServiceRunLog.objects.create(
            service=service,
            status='running',
            celery_task_id='abort-backfill-task-id',
            input_summary={'trigger': 'test'},
            output_summary={},
        )
        exec_run = BackfillExecutionRun.objects.create(
            run_id='backfill-test-abort-id',
            job_key='daily-backfill-prices-1700',
            service_run_log=run_log,
            status='running',
        )

        url = _ACTION_URL.format(job_key='daily-backfill-prices-1700')
        with patch('celery.app.control.Control.revoke') as revoke_mock:
            response = self.client.post(url, {'action': 'abort'}, format='json')

        self.assertEqual(response.status_code, 202)
        run_log.refresh_from_db()
        self.assertEqual(run_log.status, 'failed')
        self.assertIn('Bị abort bởi operator', run_log.error_detail)
        revoke_mock.assert_called_once_with('abort-backfill-task-id', terminate=True, signal='SIGTERM')

        exec_run.refresh_from_db()
        self.assertEqual(exec_run.status, 'aborted')
        self.assertIn('Bị abort bởi operator', exec_run.error_summary)
