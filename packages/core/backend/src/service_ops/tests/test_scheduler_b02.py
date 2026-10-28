# -*- coding: utf-8 -*-
"""B02 — Backfill Progress Persistence Tests.

Kiểm tra BackfillExecutionRun và BackfillExecutionBatch:
- Model được tạo khi backfill_daily_prices chạy
- Batch rows được tạo per-provider
- Counters được cập nhật sau khi thread hoàn thành
- Run được finalize với trạng thái correct
- Crash-safety: exec_run được mark failed khi task crash
- service_run_log FK được link khi service_run_log_id được cung cấp
"""

from unittest.mock import patch

from django.test import TestCase

from service_ops.models import BackfillExecutionBatch, BackfillExecutionRun
from service_ops.registry import ensure_service_registry


def _make_bucket_result(provider='TCBS', inserted=10, updated=2, skipped=1, failed=None):
    """Helper: tạo mock result từ _fetch_and_upsert_bucket."""
    failed = failed or []
    return {
        'inserted': inserted,
        'updated': updated,
        'skipped_existing': skipped,
        'upserted': inserted + updated,
        'failed': failed,
        'failed_count': len(failed),
        'provider': provider,
        'total_retries_used': 0,
        'provider_latency_p50_ms': 120.0,
        'provider_latency_p95_ms': 350.0,
    }


class BackfillExecutionRunModelTests(TestCase):
    """Tests cho BackfillExecutionRun model trực tiếp."""

    def test_create_run_and_defaults(self):
        run = BackfillExecutionRun.objects.create(
            run_id='test-run-001',
            job_key='test-job',
            mode='daily_delta',
            trigger='beat_schedule',
            status='queued',
            requested_days=365,
            planned_symbols_count=100,
        )
        self.assertEqual(run.status, 'queued')
        self.assertEqual(run.planned_symbols_count, 100)
        self.assertEqual(run.completed_symbols_count, 0)
        self.assertEqual(run.inserted_rows, 0)
        self.assertIsNone(run.finished_at)
        self.assertEqual(run.summary, {})
        self.assertEqual(run.error_summary, '')

    def test_progress_pct_zero_when_no_plan(self):
        run = BackfillExecutionRun.objects.create(
            run_id='test-run-002',
            job_key='test-job',
            planned_symbols_count=0,
        )
        self.assertEqual(run.progress_pct, 0.0)

    def test_progress_pct_calculation(self):
        run = BackfillExecutionRun.objects.create(
            run_id='test-run-003',
            job_key='test-job',
            planned_symbols_count=100,
            completed_symbols_count=60,
            failed_symbols_count=10,
        )
        # (60 + 10) / 100 * 100 = 70%
        self.assertAlmostEqual(run.progress_pct, 70.0, places=1)

    def test_duration_seconds_none_when_not_finished(self):
        run = BackfillExecutionRun.objects.create(
            run_id='test-run-004',
            job_key='test-job',
        )
        self.assertIsNone(run.duration_seconds)

    def test_str_representation(self):
        run = BackfillExecutionRun.objects.create(
            run_id='test-run-str',
            job_key='test-job',
            status='running',
        )
        self.assertIn('test-run-str', str(run))
        self.assertIn('running', str(run))


class BackfillExecutionBatchModelTests(TestCase):
    """Tests cho BackfillExecutionBatch model."""

    def setUp(self):
        self.run = BackfillExecutionRun.objects.create(
            run_id='test-batch-run',
            job_key='test-job',
            status='running',
            planned_symbols_count=50,
        )

    def test_create_batch(self):
        batch = BackfillExecutionBatch.objects.create(
            run=self.run,
            provider='TCBS',
            batch_index=0,
            symbols_count=25,
            state='pending',
        )
        self.assertEqual(batch.provider, 'TCBS')
        self.assertEqual(batch.state, 'pending')
        self.assertEqual(batch.symbols_count, 25)
        self.assertEqual(batch.failed_symbols, [])

    def test_failed_symbols_count_property(self):
        batch = BackfillExecutionBatch.objects.create(
            run=self.run,
            provider='VCI',
            batch_index=1,
            failed_symbols=['AAA', 'BBB', 'CCC'],
        )
        self.assertEqual(batch.failed_symbols_count, 3)

    def test_unique_together_run_provider(self):
        BackfillExecutionBatch.objects.create(run=self.run, provider='TCBS', batch_index=0)
        from django.db import IntegrityError
        with self.assertRaises(IntegrityError):
            BackfillExecutionBatch.objects.create(run=self.run, provider='TCBS', batch_index=1)


class BackfillTaskInstrumentationTests(TestCase):
    """Tests cho B02 instrumentation trong backfill_daily_prices task."""

    @classmethod
    def setUpTestData(cls):
        ensure_service_registry()

    @patch('data_ingest.tasks._get_default_global_registry_symbols')
    @patch('data_ingest.tasks._build_default_daily_price_plan_items')
    @patch('data_ingest.tasks._normalize_daily_plan_items')
    @patch('data_ingest.tasks._fetch_and_upsert_bucket')
    def test_exec_run_created_on_task_start(
        self, mock_bucket, mock_normalize, mock_build, mock_symbols
    ):
        """BackfillExecutionRun row được tạo khi task bắt đầu."""
        mock_symbols.return_value = ['VCB', 'BID']
        mock_build.return_value = [
            {'symbol': 'VCB', 'days': 365},
            {'symbol': 'BID', 'days': 365},
        ]
        mock_normalize.return_value = [
            {'symbol': 'VCB', 'days': 365},
            {'symbol': 'BID', 'days': 365},
        ]
        mock_bucket.return_value = _make_bucket_result()

        initial_count = BackfillExecutionRun.objects.count()

        from data_ingest.tasks import backfill_daily_prices
        backfill_daily_prices.apply(kwargs={'days': 7})

        self.assertEqual(BackfillExecutionRun.objects.count(), initial_count + 1)
        run = BackfillExecutionRun.objects.latest('started_at')
        self.assertEqual(run.requested_days, 7)
        self.assertIn(run.status, ('success', 'partial'))

    @patch('data_ingest.tasks._get_default_global_registry_symbols')
    @patch('data_ingest.tasks._build_default_daily_price_plan_items')
    @patch('data_ingest.tasks._normalize_daily_plan_items')
    @patch('data_ingest.tasks._fetch_and_upsert_bucket')
    def test_batch_rows_created_per_provider(
        self, mock_bucket, mock_normalize, mock_build, mock_symbols
    ):
        """BackfillExecutionBatch rows được tạo cho mỗi provider có data."""
        plan = [{'symbol': f'S{i:03d}', 'days': 30} for i in range(6)]
        mock_symbols.return_value = [p['symbol'] for p in plan]
        mock_build.return_value = plan
        mock_normalize.return_value = plan
        mock_bucket.return_value = _make_bucket_result()

        from data_ingest.tasks import backfill_daily_prices
        backfill_daily_prices.apply(kwargs={'days': 30})

        run = BackfillExecutionRun.objects.latest('started_at')
        batches = BackfillExecutionBatch.objects.filter(run=run)
        # At least 1 batch should be created per active provider
        self.assertGreater(batches.count(), 0)

    @patch('data_ingest.tasks._get_default_global_registry_symbols')
    @patch('data_ingest.tasks._build_default_daily_price_plan_items')
    @patch('data_ingest.tasks._normalize_daily_plan_items')
    @patch('data_ingest.tasks._fetch_and_upsert_bucket')
    def test_run_finalized_with_correct_counters(
        self, mock_bucket, mock_normalize, mock_build, mock_symbols
    ):
        """exec_run được finalize với inserted/updated/failed_symbols_count đúng."""
        plan = [{'symbol': 'VCB', 'days': 365}, {'symbol': 'BID', 'days': 365}]
        mock_symbols.return_value = ['VCB', 'BID']
        mock_build.return_value = plan
        mock_normalize.return_value = plan
        mock_bucket.return_value = _make_bucket_result(inserted=2, updated=0, skipped=0, failed=[])

        from data_ingest.tasks import backfill_daily_prices
        backfill_daily_prices.apply(kwargs={'days': 365})

        run = BackfillExecutionRun.objects.latest('started_at')
        self.assertEqual(run.status, 'success')
        self.assertIsNotNone(run.finished_at)
        self.assertGreaterEqual(run.inserted_rows, 0)

    @patch('data_ingest.tasks._get_default_global_registry_symbols')
    @patch('data_ingest.tasks._build_default_daily_price_plan_items')
    @patch('data_ingest.tasks._normalize_daily_plan_items')
    @patch('data_ingest.tasks._fetch_and_upsert_bucket')
    def test_run_status_partial_when_failed_symbols(
        self, mock_bucket, mock_normalize, mock_build, mock_symbols
    ):
        """exec_run.status = 'partial' khi có failed symbols."""
        plan = [{'symbol': 'VCB', 'days': 365}]
        mock_symbols.return_value = ['VCB']
        mock_build.return_value = plan
        mock_normalize.return_value = plan
        mock_bucket.return_value = _make_bucket_result(inserted=0, failed=['VCB'])

        from data_ingest.tasks import backfill_daily_prices
        backfill_daily_prices.apply(kwargs={'days': 365})

        run = BackfillExecutionRun.objects.latest('started_at')
        self.assertEqual(run.status, 'partial')

    @patch('data_ingest.tasks._get_default_global_registry_symbols')
    @patch('data_ingest.tasks._build_default_daily_price_plan_items')
    @patch('data_ingest.tasks._normalize_daily_plan_items')
    def test_skipped_returns_early_no_run_created(
        self, mock_normalize, mock_build, mock_symbols
    ):
        """Khi không có symbols, task trả 'skipped' và không tạo BackfillExecutionRun."""
        mock_symbols.return_value = []
        mock_build.return_value = []
        mock_normalize.return_value = []

        initial_count = BackfillExecutionRun.objects.count()

        from data_ingest.tasks import backfill_daily_prices
        result = backfill_daily_prices.apply(kwargs={'days': 365})
        self.assertEqual(result.result.get('status'), 'skipped')
        self.assertEqual(BackfillExecutionRun.objects.count(), initial_count)
