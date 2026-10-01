# -*- coding: utf-8 -*-
"""Tests for S04: Runtime Status Aggregator — history endpoint + inflight enrichment.

B01 tests appended: Scheduler run truth hardening for backfill jobs.
"""

from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from service_ops.registry import ensure_service_registry

from service_ops.tests.envelope import unwrapped_json

User = get_user_model()

_HISTORY_URL = '/core/v1/operator/scraping/dataops/scheduler/jobs/{job_key}/history/'


class SchedulerJobHistoryS04Tests(TestCase):
    """S04: history endpoint returns ServiceRunLog data."""

    @classmethod
    def setUpTestData(cls):
        ensure_service_registry()
        cls.admin = User.objects.create_user(
            username='sched-s04-admin',
            email='sched-s04-admin@test.local',
            password='pass123',
        )
        cls.admin.is_staff = True
        cls.admin.is_superuser = True
        cls.admin.save(update_fields=['is_staff', 'is_superuser'])

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_history_returns_pagination_fields(self):
        url = _HISTORY_URL.format(job_key='market-data-queue-tier-scheduler-30s')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        data = unwrapped_json(response)
        self.assertIn('count', data)
        self.assertIn('page', data)
        self.assertIn('page_size', data)
        self.assertIn('total_pages', data)
        self.assertIn('results', data)

    def test_history_count_is_int(self):
        url = _HISTORY_URL.format(job_key='market-data-queue-tier-scheduler-30s')
        response = self.client.get(url)
        data = unwrapped_json(response)
        self.assertIsInstance(data['count'], int)

    def test_history_results_is_list(self):
        url = _HISTORY_URL.format(job_key='market-data-queue-tier-scheduler-30s')
        response = self.client.get(url)
        data = unwrapped_json(response)
        self.assertIsInstance(data['results'], list)

    def test_history_shows_run_log_when_service_key_mapped(self):
        """If service_key is mapped, ServiceRunLog entries appear in history."""
        from service_ops.models import ServiceDefinition, ServiceRunLog
        # Only runs if the service registry has vnbroker_price_board
        svc = ServiceDefinition.objects.filter(service_key='vnbroker_price_board').first()
        if svc is None:
            self.skipTest('vnbroker_price_board service not in registry')
        run_log = ServiceRunLog.objects.create(
            service=svc,
            celery_task_id='test-task-s04-xyz',
            status='success',
        )
        url = _HISTORY_URL.format(job_key='market-data-queue-tier-scheduler-30s')
        response = self.client.get(url)
        data = unwrapped_json(response)
        self.assertGreater(data['count'], 0)
        ids = [r['id'] for r in data['results']]
        self.assertIn(run_log.pk, ids)
        run_log.delete()

    def test_history_result_items_have_required_fields(self):
        """Each result item must have standard log fields."""
        from service_ops.models import ServiceDefinition, ServiceRunLog
        svc = ServiceDefinition.objects.filter(service_key='vnbroker_price_board').first()
        if svc is None:
            self.skipTest('vnbroker_price_board service not in registry')
        run_log = ServiceRunLog.objects.create(
            service=svc,
            celery_task_id='test-task-s04-fields',
            status='success',
        )
        url = _HISTORY_URL.format(job_key='market-data-queue-tier-scheduler-30s')
        response = self.client.get(url)
        data = unwrapped_json(response)
        if data['results']:
            item = data['results'][0]
            for field in ('id', 'celery_task_id', 'status', 'started_at'):
                self.assertIn(field, item)
        run_log.delete()

    def test_history_unknown_job_returns_404(self):
        url = _HISTORY_URL.format(job_key='non-existent-scheduler-job-s04')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 404)

    def test_history_page_size_param_respected(self):
        url = _HISTORY_URL.format(job_key='market-data-queue-tier-scheduler-30s')
        response = self.client.get(url + '?page_size=5')
        data = unwrapped_json(response)
        self.assertLessEqual(len(data['results']), 5)
        self.assertEqual(data['page_size'], 5)


class SchedulerCatalogInflightEnrichmentTests(TestCase):
    """S04: is_inflight enrichment in catalog from ServiceRunLog."""

    @classmethod
    def setUpTestData(cls):
        ensure_service_registry()

    def test_inflight_is_true_when_running_run_log_exists(self):
        """build_scheduler_catalog marks is_inflight=True when ServiceRunLog status=running."""
        from service_ops.models import ServiceDefinition, ServiceRunLog
        from service_ops.scheduler_catalog import build_scheduler_catalog

        svc = ServiceDefinition.objects.filter(service_key='vnbroker_price_board').first()
        if svc is None:
            self.skipTest('vnbroker_price_board service not in registry')

        run_log = ServiceRunLog.objects.create(
            service=svc,
            celery_task_id='test-inflight-catalog',
            status='running',
        )
        import service_ops.scheduler_catalog as cat_mod
        schedule = {
            'market-data-queue-tier-scheduler-30s': {
                'task': 'service_ops.run_market_data_queue_tier_scheduler',
                'schedule': 30.0,
                'options': {'queue': 'manual_on_demand'},
            }
        }
        catalog = build_scheduler_catalog(schedule_map=schedule)
        job = next((j for j in catalog if j['job_key'] == 'market-data-queue-tier-scheduler-30s'), None)
        self.assertIsNotNone(job)
        self.assertTrue(job['is_inflight'])
        self.assertEqual(job['status'], 'running')
        run_log.delete()

    def test_inflight_is_false_when_no_running_logs(self):
        """build_scheduler_catalog marks is_inflight=False when no running ServiceRunLog."""
        from django.core.cache import cache as _test_cache
        from service_ops.scheduler_catalog import build_scheduler_catalog
        # Clear LocMem cache bleed from earlier run_now tests (run_now writes
        # scheduler:inflight:{job_key} even with mocked broker).
        _test_cache.delete('scheduler:inflight:market-data-queue-tier-scheduler-30s')
        _test_cache.delete('scheduler:manual_run:market-data-queue-tier-scheduler-30s')
        schedule = {
            'market-data-queue-tier-scheduler-30s': {
                'task': 'service_ops.run_market_data_queue_tier_scheduler',
                'schedule': 30.0,
                'options': {'queue': 'manual_on_demand'},
            }
        }
        catalog = build_scheduler_catalog(schedule_map=schedule)
        job = next((j for j in catalog if j['job_key'] == 'market-data-queue-tier-scheduler-30s'), None)
        self.assertIsNotNone(job)
        self.assertFalse(job['is_inflight'])


# ──────────────────────────────────────────────────────────────────────────────
# B01 — Scheduler run truth hardening tests
# ──────────────────────────────────────────────────────────────────────────────

class B01BackfillJobServiceKeyTests(TestCase):
    """B01: backfill jobs have valid service_key in CATALOG_JOB_METADATA."""

    def test_daily_backfill_has_service_key(self):
        from service_ops.scheduler_catalog import CATALOG_JOB_METADATA
        meta = CATALOG_JOB_METADATA.get('daily-backfill-prices-1700', {})
        self.assertEqual(meta.get('service_key'), 'backfill_daily_prices')

    def test_deep_history_bootstrap_has_service_key(self):
        from service_ops.scheduler_catalog import CATALOG_JOB_METADATA
        meta = CATALOG_JOB_METADATA.get('deep-history-bootstrap-weekly', {})
        self.assertEqual(meta.get('service_key'), 'deep_history_bootstrap')

    def test_pre5y_backfill_has_service_key(self):
        from service_ops.scheduler_catalog import CATALOG_JOB_METADATA
        meta = CATALOG_JOB_METADATA.get('pre5y-history-backfill-weekly', {})
        self.assertEqual(meta.get('service_key'), 'pre5y_history_backfill')

    def test_backfill_service_definition_exists(self):
        from service_ops.registry import ensure_service_registry
        from service_ops.models import ServiceDefinition
        ensure_service_registry()
        svc = ServiceDefinition.objects.filter(service_key='backfill_daily_prices').first()
        self.assertIsNotNone(svc, 'ServiceDefinition for backfill_daily_prices must exist')
        self.assertEqual(svc.domain, 'dataops')

    def test_deep_history_service_definition_exists(self):
        from service_ops.registry import ensure_service_registry
        from service_ops.models import ServiceDefinition
        ensure_service_registry()
        svc = ServiceDefinition.objects.filter(service_key='deep_history_bootstrap').first()
        self.assertIsNotNone(svc, 'ServiceDefinition for deep_history_bootstrap must exist')
        self.assertEqual(svc.domain, 'dataops')

    def test_pre5y_history_service_definition_exists(self):
        from service_ops.registry import ensure_service_registry
        from service_ops.models import ServiceDefinition
        ensure_service_registry()
        svc = ServiceDefinition.objects.filter(service_key='pre5y_history_backfill').first()
        self.assertIsNotNone(svc, 'ServiceDefinition for pre5y_history_backfill must exist')
        self.assertEqual(svc.domain, 'dataops')


class B01RunNowCreatesRunLogTests(TestCase):
    """B01: run_now creates ServiceRunLog and passes service_run_log_id to task."""

    @classmethod
    def setUpTestData(cls):
        from service_ops.registry import ensure_service_registry
        from django.contrib.auth import get_user_model
        ensure_service_registry()
        User = get_user_model()
        cls.admin = User.objects.create_user(
            username='b01-run-now-admin',
            email='b01-run-now-admin@test.local',
            password='pass123',
        )
        cls.admin.is_staff = True
        cls.admin.is_superuser = True
        cls.admin.save(update_fields=['is_staff', 'is_superuser'])

    def setUp(self):
        from rest_framework.test import APIClient
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def _post_run_now(self, job_key: str):
        url = f'/core/v1/operator/scraping/dataops/scheduler/jobs/{job_key}/actions/'
        return self.client.post(url, {'action': 'run_now', 'reason': 'B01 test'}, format='json')

    @patch('celery.current_app.send_task')
    def test_run_now_daily_backfill_creates_run_log(self, mock_send):
        from service_ops.models import ServiceRunLog
        mock_result = MagicMock()
        mock_result.id = 'celery-b01-daily-test'
        mock_send.return_value = mock_result

        before_count = ServiceRunLog.objects.filter(
            service__service_key='backfill_daily_prices'
        ).count()
        response = self._post_run_now('daily-backfill-prices-1700')
        self.assertEqual(response.status_code, 202)
        after_count = ServiceRunLog.objects.filter(
            service__service_key='backfill_daily_prices'
        ).count()
        self.assertGreater(after_count, before_count, 'run_now must create a ServiceRunLog')

    @patch('celery.current_app.send_task')
    def test_run_now_deep_history_creates_run_log(self, mock_send):
        from service_ops.models import ServiceRunLog
        mock_result = MagicMock()
        mock_result.id = 'celery-b01-deep-test'
        mock_send.return_value = mock_result

        before_count = ServiceRunLog.objects.filter(
            service__service_key='deep_history_bootstrap'
        ).count()
        response = self._post_run_now('deep-history-bootstrap-weekly')
        self.assertEqual(response.status_code, 202)
        after_count = ServiceRunLog.objects.filter(
            service__service_key='deep_history_bootstrap'
        ).count()
        self.assertGreater(after_count, before_count, 'run_now must create a ServiceRunLog')

    @patch('celery.current_app.send_task')
    def test_run_now_run_log_starts_queued_with_job_key(self, mock_send):
        from service_ops.models import ServiceRunLog
        mock_result = MagicMock()
        mock_result.id = 'celery-b01-queued-test'
        mock_send.return_value = mock_result

        self._post_run_now('daily-backfill-prices-1700')
        log = ServiceRunLog.objects.filter(
            service__service_key='backfill_daily_prices'
        ).order_by('-started_at').first()
        self.assertIsNotNone(log)
        self.assertEqual(log.status, 'queued')
        self.assertEqual(log.input_summary.get('triggered_by'), 'operator_run_now')
        self.assertEqual(log.input_summary.get('job_key'), 'daily-backfill-prices-1700')

    @patch('celery.current_app.send_task')
    def test_run_now_passes_service_run_log_id_to_task(self, mock_send):
        mock_result = MagicMock()
        mock_result.id = 'celery-b01-pass-id-test'
        mock_send.return_value = mock_result

        self._post_run_now('daily-backfill-prices-1700')
        call_args = mock_send.call_args
        # kwargs may be positional or keyword depending on call signature
        if call_args.kwargs:
            task_kwargs = call_args.kwargs.get('kwargs', {})
        else:
            task_kwargs = call_args[1].get('kwargs', {}) if len(call_args) > 1 and isinstance(call_args[1], dict) else {}
        self.assertIn('service_run_log_id', task_kwargs,
                      'service_run_log_id must be passed to the task')
        self.assertIsInstance(task_kwargs['service_run_log_id'], int)
        self.assertIn('_scheduler_job_key', task_kwargs)
        self.assertEqual(task_kwargs['_scheduler_job_key'], 'daily-backfill-prices-1700')


class B01HistoryEndpointBackfillTests(TestCase):
    """B01: history endpoint returns results for backfill jobs."""

    @classmethod
    def setUpTestData(cls):
        from service_ops.registry import ensure_service_registry
        from service_ops.models import ServiceDefinition, ServiceRunLog
        from django.contrib.auth import get_user_model
        ensure_service_registry()
        User = get_user_model()
        cls.admin = User.objects.create_user(
            username='b01-history-admin',
            email='b01-history-admin@test.local',
            password='pass123',
        )
        cls.admin.is_staff = True
        cls.admin.is_superuser = True
        cls.admin.save(update_fields=['is_staff', 'is_superuser'])
        # Seed a run log for each job
        svc_daily = ServiceDefinition.objects.filter(service_key='backfill_daily_prices').first()
        svc_deep = ServiceDefinition.objects.filter(service_key='deep_history_bootstrap').first()
        if svc_daily:
            cls.daily_log = ServiceRunLog.objects.create(
                service=svc_daily,
                celery_task_id='b01-hist-daily',
                status='success',
                input_summary={'triggered_by': 'beat_schedule', 'job_key': 'daily-backfill-prices-1700'},
            )
        else:
            cls.daily_log = None
        if svc_deep:
            cls.deep_log = ServiceRunLog.objects.create(
                service=svc_deep,
                celery_task_id='b01-hist-deep',
                status='success',
                input_summary={'triggered_by': 'beat_schedule', 'job_key': 'deep-history-bootstrap-weekly'},
            )
        else:
            cls.deep_log = None

    def setUp(self):
        from rest_framework.test import APIClient
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_daily_backfill_history_returns_results(self):
        if self.daily_log is None:
            self.skipTest('backfill_daily_prices ServiceDefinition not found')
        url = _HISTORY_URL.format(job_key='daily-backfill-prices-1700')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        data = unwrapped_json(response)
        self.assertGreater(data['count'], 0)
        ids = [r['id'] for r in data['results']]
        self.assertIn(self.daily_log.pk, ids)

    def test_deep_history_bootstrap_history_returns_results(self):
        if self.deep_log is None:
            self.skipTest('deep_history_bootstrap ServiceDefinition not found')
        url = _HISTORY_URL.format(job_key='deep-history-bootstrap-weekly')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        data = unwrapped_json(response)
        self.assertGreater(data['count'], 0)
        ids = [r['id'] for r in data['results']]
        self.assertIn(self.deep_log.pk, ids)

    def test_daily_backfill_history_result_items_have_trigger_field(self):
        if self.daily_log is None:
            self.skipTest('backfill_daily_prices ServiceDefinition not found')
        url = _HISTORY_URL.format(job_key='daily-backfill-prices-1700')
        response = self.client.get(url)
        data = unwrapped_json(response)
        if data['results']:
            item = data['results'][0]
            self.assertIn('input_summary', item)


# ──────────────────────────────────────────────────────────────────────────────
# B10 — Stuck Run Detection tests
# ──────────────────────────────────────────────────────────────────────────────

class B10StuckRunDetectionTests(TestCase):
    """B10: Phát hiện run kẹt vượt max_expected_run_seconds.

    Khi worker crash (OOM/SIGKILL), ServiceRunLog có thể kẹt ở status='running'
    mãi mãi. Catalog phải hiển thị 'degraded' với warning rõ ràng thay vì 'running'.
    """

    @classmethod
    def setUpTestData(cls):
        from service_ops.registry import ensure_service_registry
        ensure_service_registry()

    def _make_running_log(self, service_key: str, started_seconds_ago: int):
        """Tạo ServiceRunLog với status='running' và started_at trong quá khứ."""
        from datetime import timedelta
        from django.utils import timezone
        from service_ops.models import ServiceDefinition, ServiceRunLog
        svc = ServiceDefinition.objects.filter(service_key=service_key).first()
        if svc is None:
            return None
        log = ServiceRunLog.objects.create(
            service=svc,
            celery_task_id='test-stuck-celery-id',
            status='running',
            input_summary={'triggered_by': 'test'},
        )
        # auto_now_add=True means we must use update() to backdate started_at
        old_started = timezone.now() - timedelta(seconds=started_seconds_ago)
        ServiceRunLog.objects.filter(pk=log.pk).update(started_at=old_started)
        log.refresh_from_db()
        return log

    def setUp(self):
        from service_ops.models import ServiceRunLog
        # Clean up any running logs from previous test runs to ensure isolation
        ServiceRunLog.objects.filter(
            celery_task_id='test-stuck-celery-id',
        ).delete()

    def tearDown(self):
        from service_ops.models import ServiceRunLog
        ServiceRunLog.objects.filter(
            celery_task_id='test-stuck-celery-id',
        ).delete()

    # ── 1. max_expected_run_seconds in metadata ──────────────────────────────

    def test_deep_history_has_max_expected_run_seconds(self):
        from service_ops.scheduler_catalog import CATALOG_JOB_METADATA
        meta = CATALOG_JOB_METADATA.get('deep-history-bootstrap-weekly', {})
        self.assertIsNotNone(meta.get('max_expected_run_seconds'),
                             'deep-history-bootstrap-weekly phải có max_expected_run_seconds')
        self.assertGreater(meta['max_expected_run_seconds'], 3600,
                           'deep-history max phải > 1h')

    def test_daily_backfill_has_max_expected_run_seconds(self):
        from service_ops.scheduler_catalog import CATALOG_JOB_METADATA
        meta = CATALOG_JOB_METADATA.get('daily-backfill-prices-1700', {})
        self.assertIsNotNone(meta.get('max_expected_run_seconds'),
                             'daily-backfill-prices-1700 phải có max_expected_run_seconds')

    # ── 2. _derive_status với is_possibly_stuck ──────────────────────────────

    def test_derive_status_stuck_returns_degraded(self):
        from service_ops.scheduler_catalog import _derive_status
        status, reason = _derive_status(
            enabled=True,
            is_inflight=True,
            freshness_state='fresh',
            lag_seconds=0,
            is_possibly_stuck=True,
        )
        self.assertEqual(status, 'degraded')
        self.assertIsNotNone(reason)
        self.assertIn('worker', reason.lower())

    def test_derive_status_not_stuck_returns_running(self):
        from service_ops.scheduler_catalog import _derive_status
        status, reason = _derive_status(
            enabled=True,
            is_inflight=True,
            freshness_state='fresh',
            lag_seconds=0,
            is_possibly_stuck=False,
        )
        self.assertEqual(status, 'running')
        self.assertIsNone(reason)

    # ── 3. build_scheduler_catalog: stuck run detection end-to-end ───────────

    def test_catalog_flags_stuck_when_exceeded_max_run_time(self):
        """Run kẹt vượt max_expected_run_seconds → is_possibly_stuck=True, status=degraded."""
        from service_ops.models import ServiceDefinition
        svc = ServiceDefinition.objects.filter(service_key='deep_history_bootstrap').first()
        if svc is None:
            self.skipTest('ServiceDefinition deep_history_bootstrap not found')
        from service_ops.scheduler_catalog import CATALOG_JOB_METADATA
        max_secs = CATALOG_JOB_METADATA['deep-history-bootstrap-weekly']['max_expected_run_seconds']
        # Tạo run kẹt — bắt đầu cách đây max_secs + 3600s
        self._make_running_log('deep_history_bootstrap', max_secs + 3600)

        from service_ops.scheduler_catalog import build_scheduler_catalog
        schedule = {
            'deep-history-bootstrap-weekly': {
                'task': 'data_ingest.tasks.backfill_daily_prices',
                'schedule': {'day_of_week': 6},
                'kwargs': {'days': 1825},
                'options': {'queue': 'enrichment_offhours'},
            }
        }
        catalog = build_scheduler_catalog(schedule_map=schedule)
        job = next((j for j in catalog if j['job_key'] == 'deep-history-bootstrap-weekly'), None)
        self.assertIsNotNone(job)
        self.assertTrue(job['is_inflight'], 'ServiceRunLog running → is_inflight phải True')
        self.assertTrue(job['is_possibly_stuck'], 'Vượt max_expected → is_possibly_stuck phải True')
        self.assertEqual(job['status'], 'degraded')
        self.assertIsNotNone(job['inflight_elapsed_seconds'])
        self.assertGreater(job['inflight_elapsed_seconds'], max_secs)

    def test_catalog_not_stuck_within_expected_run_time(self):
        """Run bình thường chưa vượt max → is_possibly_stuck=False, status=running."""
        from service_ops.models import ServiceDefinition
        svc = ServiceDefinition.objects.filter(service_key='deep_history_bootstrap').first()
        if svc is None:
            self.skipTest('ServiceDefinition deep_history_bootstrap not found')
        from service_ops.scheduler_catalog import CATALOG_JOB_METADATA
        max_secs = CATALOG_JOB_METADATA['deep-history-bootstrap-weekly']['max_expected_run_seconds']
        # Run mới bắt đầu 60s trước — còn trong ngưỡng
        self._make_running_log('deep_history_bootstrap', 60)

        from service_ops.scheduler_catalog import build_scheduler_catalog
        schedule = {
            'deep-history-bootstrap-weekly': {
                'task': 'data_ingest.tasks.backfill_daily_prices',
                'schedule': {'day_of_week': 6},
                'kwargs': {'days': 1825},
                'options': {'queue': 'enrichment_offhours'},
            }
        }
        catalog = build_scheduler_catalog(schedule_map=schedule)
        job = next((j for j in catalog if j['job_key'] == 'deep-history-bootstrap-weekly'), None)
        self.assertIsNotNone(job)
        self.assertTrue(job['is_inflight'])
        self.assertFalse(job['is_possibly_stuck'], 'Trong ngưỡng → is_possibly_stuck phải False')
        self.assertEqual(job['status'], 'running')

    def test_catalog_job_without_max_expected_never_stuck(self):
        """Jobs không có max_expected_run_seconds không bao giờ bị đánh dấu stuck."""
        from service_ops.scheduler_catalog import CATALOG_JOB_METADATA
        # market-data-queue-tier-scheduler-30s có service_key nhưng không có max_expected
        meta = CATALOG_JOB_METADATA.get('market-data-queue-tier-scheduler-30s', {})
        self.assertIsNone(meta.get('max_expected_run_seconds'),
                          'market-data-queue-tier scheduler không nên có max_expected_run_seconds')

        from service_ops.models import ServiceDefinition
        svc = ServiceDefinition.objects.filter(service_key='vnbroker_price_board').first()
        if svc is None:
            self.skipTest('ServiceDefinition vnbroker_price_board not found')
        # Tạo run kẹt rất lâu (100 giờ) — nhưng không có max_expected → không phải stuck
        self._make_running_log('vnbroker_price_board', 360000)

        from service_ops.scheduler_catalog import build_scheduler_catalog
        schedule = {
            'market-data-queue-tier-scheduler-30s': {
                'task': 'service_ops.run_market_data_queue_tier_scheduler',
                'schedule': 30.0,
                'options': {'queue': 'manual_on_demand'},
            }
        }
        catalog = build_scheduler_catalog(schedule_map=schedule)
        job = next((j for j in catalog if j['job_key'] == 'market-data-queue-tier-scheduler-30s'), None)
        self.assertIsNotNone(job)
        self.assertFalse(job['is_possibly_stuck'],
                         'Không có max_expected → is_possibly_stuck phải False')

    # ── 4. Catalog dict shape ────────────────────────────────────────────────

    def test_catalog_dict_has_stuck_fields(self):
        """Mọi job trong catalog phải có các fields liên quan stuck."""
        from service_ops.scheduler_catalog import build_scheduler_catalog
        schedule = {
            'deep-history-bootstrap-weekly': {
                'task': 'data_ingest.tasks.backfill_daily_prices',
                'schedule': {'day_of_week': 6},
                'kwargs': {'days': 1825},
                'options': {'queue': 'enrichment_offhours'},
            }
        }
        catalog = build_scheduler_catalog(schedule_map=schedule)
        for job in catalog:
            self.assertIn('is_possibly_stuck', job)
            self.assertIn('inflight_elapsed_seconds', job)
            self.assertIn('max_expected_run_seconds', job)
            self.assertIsInstance(job['is_possibly_stuck'], bool)


class B01InflightCacheCleared(TestCase):
    """B01: inflight cache marker cleared when task reaches terminal state."""

    @classmethod
    def setUpTestData(cls):
        from service_ops.registry import ensure_service_registry
        ensure_service_registry()

    def test_b01_clear_inflight_cache_deletes_key(self):
        from django.core.cache import cache
        from data_ingest.tasks import _b01_clear_inflight_cache
        cache.set('scheduler:inflight:daily-backfill-prices-1700', 'celery-xyz', timeout=3600)
        self.assertTrue(bool(cache.get('scheduler:inflight:daily-backfill-prices-1700')))
        _b01_clear_inflight_cache('daily-backfill-prices-1700')
        self.assertIsNone(cache.get('scheduler:inflight:daily-backfill-prices-1700'))

    def test_b01_clear_inflight_cache_noop_on_none(self):
        """Should not raise when job_key is None."""
        from data_ingest.tasks import _b01_clear_inflight_cache
        _b01_clear_inflight_cache(None)  # must not raise

    def test_backfill_task_clears_cache_on_skipped(self):
        """backfill_daily_prices clears inflight cache marker when skipped (empty plan)."""
        from django.core.cache import cache
        from unittest.mock import patch
        from data_ingest.tasks import backfill_daily_prices

        cache.set('scheduler:inflight:daily-backfill-prices-1700', 'celery-fake', timeout=3600)
        self.assertTrue(bool(cache.get('scheduler:inflight:daily-backfill-prices-1700')))

        with patch('data_ingest.tasks._get_default_global_registry_symbols', return_value=[]), \
             patch('data_ingest.tasks._build_default_daily_price_plan_items', return_value=[]), \
             patch('data_ingest.tasks._normalize_daily_plan_items', return_value=[]):
            result = backfill_daily_prices.run(
                days=365,
                _scheduler_job_key='daily-backfill-prices-1700',
            )

        self.assertEqual(result['status'], 'skipped')
        self.assertIsNone(
            cache.get('scheduler:inflight:daily-backfill-prices-1700'),
            'Inflight cache must be cleared on terminal state',
        )
