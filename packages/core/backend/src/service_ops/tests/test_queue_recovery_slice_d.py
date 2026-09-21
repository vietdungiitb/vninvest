"""
Slice D (QueueRecovery) — tách queue realtime_scheduler.

Covers:
- SCHEDULER_QUEUE_MAP trỏ heartbeat 3s sang realtime_scheduler, các task khác giữ nguyên
- QUEUE_NAMES + CELERY_TASK_QUEUES chứa queue mới
- orphan-check (_is_celery_task_live) biết queue mới
- reconcile + drift-check pass end-to-end với queue mới
"""
import inspect

from django.test import TestCase
from django.core.management import call_command
from io import StringIO

from vninvest_core.queue_policy import CELERY_TASK_QUEUES, QUEUE_NAMES, SCHEDULER_QUEUE_MAP


class SchedulerQueueSplitTest(TestCase):
    def test_heartbeat_routed_to_dedicated_queue(self):
        self.assertEqual(
            SCHEDULER_QUEUE_MAP.get('schedule-realtime-prefetch-shards'),
            'realtime_scheduler',
        )

    def test_materialize_ingest_stay_on_realtime_prefetch(self):
        # Corrective v4: batch provider-bound chậm (snapshot, price-board) rời fast lane.
        # Meta-audit fix: enrichment_eod thay manual_on_demand (manual depth > 20 kích
        # backpressure guard, skip tier recovery_backlog vĩnh viễn + fail test_soc_tasks live).
        # Session-facts (nhanh) + warm chunk (bounded) ở lại fast lane.
        for job_key in (
            'materialize-session-facts-5m',
            'warm-intraday-realtime-5m',
        ):
            self.assertEqual(SCHEDULER_QUEUE_MAP.get(job_key), 'realtime_prefetch', job_key)
        for job_key in (
            'materialize-symbol-snapshot-60s',
            'ingest-price-board-60s',
        ):
            self.assertEqual(SCHEDULER_QUEUE_MAP.get(job_key), 'enrichment_eod', job_key)

    def test_queue_registered_in_broker_queues(self):
        self.assertIn('realtime_scheduler', QUEUE_NAMES)
        self.assertIn('realtime_scheduler', [q.name for q in CELERY_TASK_QUEUES])

    def test_orphan_check_knows_new_queue(self):
        from service_ops import tasks as ops_tasks
        src = inspect.getsource(ops_tasks._is_celery_task_live)
        self.assertIn("'realtime_scheduler'", src)

    def test_reconcile_then_drift_check_clean(self):
        call_command('repair_beat_schedule', stdout=StringIO())
        out = StringIO()
        call_command('check_scheduler_queue_drift', stdout=out)
        self.assertIn('No queue drift detected', out.getvalue())
