"""Tests for scheduler management commands."""
from io import StringIO

from django.core.management import call_command
from django.test import TestCase
from django_celery_beat.models import IntervalSchedule, PeriodicTask

from vninvest_core.management.commands.check_scheduler_queue_drift import Command as CheckSchedulerQueueDriftCommand
from vninvest_core.management.commands.sync_scheduler_queues import Command as SyncSchedulerQueuesCommand
from vninvest_core.queue_policy import SCHEDULER_QUEUE_MAP


class CheckSchedulerQueueDriftTestCase(TestCase):
    """Test cases for check_scheduler_queue_drift management command."""

    def setUp(self):
        """Set up test data."""
        self.out = StringIO()
        # Create an interval schedule for testing
        self.interval, _ = IntervalSchedule.objects.get_or_create(
            every=60,
            period='seconds',
        )

    def test_no_drift_detected(self):
        """Test when no drift is detected."""
        # Queue comes from the SSOT, not a hardcoded literal. The task moved to
        # `enrichment_eod` (commit 1e6ebf26a, "batch slow-lane to enrichment_eod")
        # and this test file was never updated, so the literal went stale.
        task_name = 'materialize-symbol-snapshot-60s'
        # Populate PeriodicTask first: `check_scheduler_queue_drift` gained a
        # MISSING_ROW check (commit 9b2b6d2b0), so a sparse table is no longer
        # "healthy". Canonical pattern: `service_ops/tests/test_drift_enabled_missing.py`.
        call_command('repair_beat_schedule', stdout=StringIO())
        # `update_or_create`, not `create`: repair_beat_schedule just inserted this
        # task, so a plain create() is a unique-name violation.
        PeriodicTask.objects.update_or_create(
            name=task_name,
            defaults={
                'task': 'test.task',
                'queue': SCHEDULER_QUEUE_MAP[task_name],
                'interval': self.interval,
            },
        )

        call_command(
            'check_scheduler_queue_drift',
            stdout=self.out,
        )

        output = self.out.getvalue()
        self.assertIn('No queue drift detected', output)

    def test_queue_policy_ssot_is_shared_by_commands(self):
        self.assertEqual(CheckSchedulerQueueDriftCommand.EXPECTED_QUEUES, SCHEDULER_QUEUE_MAP)
        self.assertEqual(SyncSchedulerQueuesCommand.QUEUE_MAP, SCHEDULER_QUEUE_MAP)

    def test_drift_detected_with_warn_only(self):
        """Test drift detection with --warn-only flag."""
        # Create periodic task with incorrect queue
        PeriodicTask.objects.create(
            name='materialize-symbol-snapshot-60s',
            task='test.task',
            queue='wrong_queue',
            interval=self.interval,
        )

        call_command(
            'check_scheduler_queue_drift',
            '--warn-only',
            stdout=self.out,
        )

        output = self.out.getvalue()
        self.assertIn('DRIFT DETECTED', output)
        self.assertIn('materialize-symbol-snapshot-60s', output)

    def test_drift_detected_without_warn_only_exits(self):
        """Test drift detection without --warn-only exits with error."""
        # Create periodic task with incorrect queue
        PeriodicTask.objects.create(
            name='materialize-symbol-snapshot-60s',
            task='test.task',
            queue='wrong_queue',
            interval=self.interval,
        )

        with self.assertRaises(SystemExit) as cm:
            call_command(
                'check_scheduler_queue_drift',
                stdout=self.out,
            )

        self.assertEqual(cm.exception.code, 1)

    def test_multiple_drifts_detected(self):
        """Test detection of multiple queue drifts."""
        # Create multiple periodic tasks with incorrect queues
        PeriodicTask.objects.create(
            name='materialize-symbol-snapshot-60s',
            task='test.task',
            queue='wrong_queue',
            interval=self.interval,
        )
        PeriodicTask.objects.create(
            name='materialize-session-facts-5m',
            task='test.task',
            queue='wrong_queue',
            interval=self.interval,
        )

        call_command(
            'check_scheduler_queue_drift',
            '--warn-only',
            stdout=self.out,
        )

        output = self.out.getvalue()
        # Count the QUEUE_DRIFT lines, not the global total: the command also
        # reports MISSING_ROW / ENABLED_DRIFT, so the total is no longer "2".
        queue_drifts = [ln for ln in output.splitlines() if 'QUEUE_DRIFT' in ln]
        self.assertEqual(len(queue_drifts), 2, output)

    def test_ignores_unknown_tasks(self):
        """Test that unknown tasks are ignored."""
        # Populate PeriodicTask first — the MISSING_ROW check (commit 9b2b6d2b0)
        # reports every beat job absent from the table as drift, so without this
        # the command exits non-zero for reasons unrelated to the unknown task.
        call_command('repair_beat_schedule', stdout=StringIO())
        # Create a task not in EXPECTED_QUEUES
        PeriodicTask.objects.create(
            name='unknown-task',
            task='test.task',
            queue='some_queue',
            interval=self.interval,
        )

        call_command(
            'check_scheduler_queue_drift',
            stdout=self.out,
        )

        output = self.out.getvalue()
        self.assertIn('No queue drift detected', output)


class SyncSchedulerQueuesTestCase(TestCase):
    """Test cases for sync_scheduler_queues management command."""

    def setUp(self):
        """Set up test data."""
        self.out = StringIO()
        # Create an interval schedule for testing
        self.interval, _ = IntervalSchedule.objects.get_or_create(
            every=60,
            period='seconds',
        )

    def test_sync_single_task(self):
        """Test syncing a single task queue."""
        task = PeriodicTask.objects.create(
            name='materialize-symbol-snapshot-60s',
            task='test.task',
            queue='wrong_queue',
            interval=self.interval,
        )

        call_command(
            'sync_scheduler_queues',
            stdout=self.out,
        )

        task.refresh_from_db()
        self.assertEqual(task.queue, SCHEDULER_QUEUE_MAP['materialize-symbol-snapshot-60s'])

        output = self.out.getvalue()
        self.assertIn('Updated materialize-symbol-snapshot-60s', output)
        self.assertIn('Updated 1 tasks', output)

    def test_sync_multiple_tasks(self):
        """Test syncing multiple tasks."""
        PeriodicTask.objects.create(
            name='materialize-symbol-snapshot-60s',
            task='test.task',
            queue='wrong_queue',
            interval=self.interval,
        )
        PeriodicTask.objects.create(
            name='detect_and_store_global_whale_alerts',
            task='test.task',
            queue='wrong_queue',
            interval=self.interval,
        )

        call_command(
            'sync_scheduler_queues',
            stdout=self.out,
        )

        task1 = PeriodicTask.objects.get(
            name='materialize-symbol-snapshot-60s'
        )
        task2 = PeriodicTask.objects.get(
            name='detect_and_store_global_whale_alerts'
        )

        self.assertEqual(task1.queue, SCHEDULER_QUEUE_MAP['materialize-symbol-snapshot-60s'])
        self.assertEqual(task2.queue, SCHEDULER_QUEUE_MAP['detect_and_store_global_whale_alerts'])

        output = self.out.getvalue()
        self.assertIn('Updated 2 tasks', output)

    def test_sync_with_correct_queue_no_update(self):
        """Test that correctly queued tasks are not updated."""
        PeriodicTask.objects.create(
            name='materialize-symbol-snapshot-60s',
            task='test.task',
            # Already correct per the SSOT, so the command must report no change.
            queue=SCHEDULER_QUEUE_MAP['materialize-symbol-snapshot-60s'],
            interval=self.interval,
        )

        call_command(
            'sync_scheduler_queues',
            stdout=self.out,
        )

        output = self.out.getvalue()
        self.assertIn('Updated 0 tasks', output)

    def test_sync_ignores_unknown_tasks(self):
        """Test that unknown tasks are not updated."""
        PeriodicTask.objects.create(
            name='unknown-task',
            task='test.task',
            queue='unknown_queue',
            interval=self.interval,
        )

        call_command(
            'sync_scheduler_queues',
            stdout=self.out,
        )

        task = PeriodicTask.objects.get(name='unknown-task')
        self.assertEqual(task.queue, 'unknown_queue')

        output = self.out.getvalue()
        self.assertIn('Updated 0 tasks', output)
