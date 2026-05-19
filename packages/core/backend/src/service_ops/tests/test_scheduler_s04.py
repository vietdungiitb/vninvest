# -*- coding: utf-8 -*-
"""Tests for S04: Runtime Status Aggregator — history endpoint + inflight enrichment.

B01 tests appended: Scheduler run truth hardening for backfill jobs.
"""

from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from service_ops.registry import ensure_service_registry

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
        data = response.json()
        self.assertIn('count', data)
        self.assertIn('page', data)
        self.assertIn('page_size', data)
        self.assertIn('total_pages', data)
        self.assertIn('results', data)

    def test_history_count_is_int(self):
        url = _HISTORY_URL.format(job_key='market-data-queue-tier-scheduler-30s')
        response = self.client.get(url)
        data = response.json()
        self.assertIsInstance(data['count'], int)

    def test_history_results_is_list(self):
        url = _HISTORY_URL.format(job_key='market-data-queue-tier-scheduler-30s')
        response = self.client.get(url)
        data = response.json()
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
        data = response.json()
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
        data = response.json()
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
        data = response.json()
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
        data = response.json()
        self.assertGreater(data['count'], 0)
        ids = [r['id'] for r in data['results']]
        self.assertIn(self.daily_log.pk, ids)

    def test_deep_history_bootstrap_history_returns_results(self):
        if self.deep_log is None:
            self.skipTest('deep_history_bootstrap ServiceDefinition not found')
        url = _HISTORY_URL.format(job_key='deep-history-bootstrap-weekly')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertGreater(data['count'], 0)
        ids = [r['id'] for r in data['results']]
        self.assertIn(self.deep_log.pk, ids)

    def test_daily_backfill_history_result_items_have_trigger_field(self):
        if self.daily_log is None:
            self.skipTest('backfill_daily_prices ServiceDefinition not found')
        url = _HISTORY_URL.format(job_key='daily-backfill-prices-1700')
        response = self.client.get(url)
        data = response.json()
        if data['results']:
            item = data['results'][0]
            self.assertIn('input_summary', item)


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
