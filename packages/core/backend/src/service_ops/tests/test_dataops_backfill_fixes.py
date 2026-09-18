from unittest.mock import patch

from celery.exceptions import SoftTimeLimitExceeded
from django.core.cache import cache
from django.test import TestCase

from data_ingest.tasks import (
    _fetch_and_upsert_bucket,
    backfill_daily_prices,
    synthesize_intraday_bars_from_ticks,
)
from service_ops.models import ServiceRunLog
from service_ops.registry import ensure_service_registry, get_registered_service


class BackfillDedupGuardTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        ensure_service_registry()

    def setUp(self):
        cache.delete('scheduler:inflight:dedup-job')

    def tearDown(self):
        cache.delete('scheduler:inflight:dedup-job')

    @patch('data_ingest.tasks._fetch_and_upsert_bucket')
    def test_beat_run_skipped_when_already_inflight(self, fetch_mock):
        cache.set('scheduler:inflight:dedup-job', 'task-1', timeout=600)

        result = backfill_daily_prices.run(
            days=1,
            symbols=['HPG'],
            _scheduler_job_key='dedup-job',
            celery_task_id='task-2',
        )

        self.assertEqual(result['status'], 'skipped_dedup')
        fetch_mock.assert_not_called()

    @patch('data_ingest.tasks._refresh_coverage_for_symbols', return_value=0)
    @patch('data_ingest.tasks._fetch_and_upsert_bucket')
    def test_operator_run_not_blocked_by_inflight_marker(self, fetch_mock, refresh_mock):
        fetch_mock.return_value = {
            'inserted': 1,
            'updated': 0,
            'skipped_existing': 0,
            'upserted': 1,
            'failed': [],
            'failed_count': 0,
            'provider': 'KBS',
            'total_retries_used': 0,
            'provider_latency_p50_ms': 0.0,
            'provider_latency_p95_ms': 0.0,
        }
        cache.set('scheduler:inflight:dedup-job', 'task-1', timeout=600)
        service = get_registered_service('backfill_daily_prices')
        run_log = ServiceRunLog.objects.create(
            service=service,
            status='queued',
            celery_task_id='task-3',
            input_summary={'triggered_by': 'operator_run_now'},
            output_summary={},
        )

        result = backfill_daily_prices.run(
            days=1,
            symbols=['HPG'],
            service_run_log_id=run_log.id,
            _scheduler_job_key='dedup-job',
            celery_task_id='task-3',
        )

        self.assertEqual(result.get('status'), 'ok')
        fetch_mock.assert_called()


class BackfillCoverageRefreshTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        ensure_service_registry()

    def setUp(self):
        cache.delete('scheduler:inflight:coverage-job')

    def tearDown(self):
        cache.delete('scheduler:inflight:coverage-job')

    @patch('data_ingest.tasks._refresh_coverage_for_symbols', return_value=3)
    @patch('data_ingest.tasks._fetch_and_upsert_bucket')
    def test_finalize_refreshes_coverage_for_planned_symbols(self, fetch_mock, refresh_mock):
        fetch_mock.return_value = {
            'inserted': 2,
            'updated': 1,
            'skipped_existing': 0,
            'upserted': 3,
            'failed': [],
            'failed_count': 0,
            'provider': 'KBS',
            'total_retries_used': 0,
            'provider_latency_p50_ms': 0.0,
            'provider_latency_p95_ms': 0.0,
        }

        result = backfill_daily_prices.run(
            days=1,
            symbols=['HPG', 'VNM', 'FPT'],
            _scheduler_job_key='coverage-job',
            celery_task_id='task-cover',
        )

        refresh_mock.assert_called_once()
        called_symbols = sorted(refresh_mock.call_args.args[0])
        self.assertEqual(called_symbols, ['FPT', 'HPG', 'VNM'])
        self.assertEqual(result.get('coverage_refreshed'), 3)


class BucketProgressHeartbeatTestCase(TestCase):
    @patch('data_ingest.tasks._fetch_daily_history_with_retry', return_value=([], 1, 5.0))
    def test_progress_callback_fires_every_50_symbols(self, fetch_mock):
        calls = []
        symbols = [f'S{i:03d}' for i in range(120)]

        _fetch_and_upsert_bucket(
            symbols,
            'KBS',
            1,
            inter_symbol_delay=0.0,
            progress_callback=lambda *args: calls.append(args),
        )

        self.assertEqual(len(calls), 2)
        self.assertEqual(calls[0][1], 50)
        self.assertEqual(calls[1][1], 100)


class BackfillSoftTimeLimitTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        ensure_service_registry()

    def setUp(self):
        cache.delete('scheduler:inflight:slow-job')

    def tearDown(self):
        cache.delete('scheduler:inflight:slow-job')

    @patch('data_ingest.tasks._backfill_daily_prices_impl', side_effect=SoftTimeLimitExceeded())
    def test_soft_time_limit_reraises_and_clears_inflight(self, impl_mock):
        cache.set('scheduler:inflight:slow-job', 'task-slow', timeout=600)

        with self.assertRaises(SoftTimeLimitExceeded):
            backfill_daily_prices.run(
                days=1,
                symbols=['HPG'],
                _scheduler_job_key='slow-job',
                celery_task_id='task-slow',
            )

        self.assertIsNone(cache.get('scheduler:inflight:slow-job'))


class SynthesizeBarsCoverageRefreshTestCase(TestCase):
    @patch('data_ingest.tasks._refresh_coverage_for_symbols', return_value=1)
    @patch('data_ingest.tasks._synthesize_bars_from_db_ticks')
    def test_synthesize_bars_refreshes_coverage(self, synthesize_mock, refresh_mock):
        synthesize_mock.return_value = {
            'ticks_read': 120,
            'bars_computed': 20,
            'inserted': 20,
            'updated': 0,
            'skipped': 0,
        }

        result = synthesize_intraday_bars_from_ticks.run(
            symbol='hpg',
            trade_date='2026-09-17',
        )

        self.assertEqual(result.get('coverage_refreshed'), 1)
        refresh_mock.assert_called_once()
        self.assertEqual(refresh_mock.call_args.args[0], ['HPG'])
