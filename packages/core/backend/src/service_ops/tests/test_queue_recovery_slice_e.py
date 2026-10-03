"""
Slice E (QueueRecovery, PA1) — daily-backfill EOD tách khỏi marathon cuối tuần.

Covers:
- SCHEDULER_QUEUE_MAP trỏ daily-backfill sang enrichment_eod, marathon ở lại offhours
- TASK_ROUTES trỏ task backfill_daily_prices sang enrichment_eod
- QUEUE_NAMES chứa enrichment_eod
- orphan-check biết queue mới
"""
import inspect

from django.test import TestCase

from vninvest_core.queue_policy import QUEUE_NAMES, SCHEDULER_QUEUE_MAP, TASK_ROUTES


class EnrichmentIsolationTest(TestCase):
    def test_daily_backfill_on_dedicated_queue(self):
        self.assertEqual(
            SCHEDULER_QUEUE_MAP.get('daily-backfill-prices-1700'),
            'enrichment_eod',
        )
        self.assertEqual(
            TASK_ROUTES.get('data_ingest.tasks.backfill_daily_prices', {}).get('queue'),
            'enrichment_eod',
        )

    def test_marathon_jobs_stay_on_offhours(self):
        for job_key in (
            'deep-history-bootstrap-weekly',
            'pre5y-history-backfill-weekly',
            'dnse-quarterly-backfill-intraday',
        ):
            self.assertEqual(SCHEDULER_QUEUE_MAP.get(job_key), 'enrichment_offhours', job_key)

    def test_queue_registered(self):
        self.assertIn('enrichment_eod', QUEUE_NAMES)

    def test_orphan_check_knows_new_queue(self):
        from service_ops import tasks as ops_tasks
        src = inspect.getsource(ops_tasks._is_celery_task_live)
        self.assertIn("'enrichment_eod'", src)
