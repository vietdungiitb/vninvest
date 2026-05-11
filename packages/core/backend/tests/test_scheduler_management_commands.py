"""Tests for scheduler management commands."""
from io import StringIO

from django.core.management import call_command
from django.test import TestCase
from django_celery_beat.models import IntervalSchedule, PeriodicTask


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
        # Create periodic tasks with correct queues
        PeriodicTask.objects.create(
            name='materialize-symbol-snapshot-60s',
            task='test.task',
            queue='realtime_prefetch',
            interval=self.interval,
        )

        call_command(
            'check_scheduler_queue_drift',
            stdout=self.out,
        )

        output = self.out.getvalue()
        self.assertIn('No queue drift detected', output)

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
            name='materialize-session-facts-2m',
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
        self.assertIn('DRIFT DETECTED: 2 tasks', output)

    def test_ignores_unknown_tasks(self):
        """Test that unknown tasks are ignored."""
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
        self.assertEqual(task.queue, 'realtime_prefetch')

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

        self.assertEqual(task1.queue, 'realtime_prefetch')
        self.assertEqual(task2.queue, 'analytics_heavy')

        output = self.out.getvalue()
        self.assertIn('Updated 2 tasks', output)

    def test_sync_with_correct_queue_no_update(self):
        """Test that correctly queued tasks are not updated."""
        PeriodicTask.objects.create(
            name='materialize-symbol-snapshot-60s',
            task='test.task',
            queue='realtime_prefetch',
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
