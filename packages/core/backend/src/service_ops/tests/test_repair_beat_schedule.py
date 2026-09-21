"""
Test for repair_beat_schedule command — S1 DoD.

Covers:
- dry-run does not write
- re-enable disabled critical job
- create missing job with correct queue
- keep ingest-daily-prices-1705 disabled
"""
from django.test import TestCase
from django_celery_beat.models import PeriodicTask
from django.core.management import call_command
from io import StringIO


class RepairBeatScheduleTest(TestCase):
    def setUp(self):
        # Ensure DB is populated with all jobs before each test
        call_command("repair_beat_schedule", stdout=StringIO())

    def test_dry_run_does_not_write(self):
        # Disable one critical
        PeriodicTask.objects.filter(name="ingest-price-board-60s").update(enabled=False)
        self.assertFalse(PeriodicTask.objects.get(name="ingest-price-board-60s").enabled)
        out = StringIO()
        call_command("repair_beat_schedule", "--dry-run", stdout=out)
        # Still disabled after dry-run
        self.assertFalse(PeriodicTask.objects.get(name="ingest-price-board-60s").enabled)
        self.assertIn("Re-enabled 1", out.getvalue())
        # Clean up
        PeriodicTask.objects.filter(name="ingest-price-board-60s").update(enabled=True)

    def test_re_enable_disabled_critical(self):
        PeriodicTask.objects.filter(name="warm-intraday-realtime-5m").update(enabled=False)
        call_command("repair_beat_schedule", stdout=StringIO())
        self.assertTrue(PeriodicTask.objects.get(name="warm-intraday-realtime-5m").enabled)

    def test_create_missing_job(self):
        PeriodicTask.objects.filter(name="schedule-realtime-prefetch-shards").delete()
        self.assertFalse(PeriodicTask.objects.filter(name="schedule-realtime-prefetch-shards").exists())
        call_command("repair_beat_schedule", stdout=StringIO())
        pt = PeriodicTask.objects.get(name="schedule-realtime-prefetch-shards")
        self.assertTrue(pt.enabled)
        # Slice D (QueueRecovery): heartbeat 3s sang queue riêng realtime_scheduler.
        self.assertEqual(pt.queue, "realtime_scheduler")
        self.assertIsNotNone(pt.interval)

    def test_ingest_daily_prices_manually_enabled_stays_enabled(self):
        """Manual enable of ingest-daily-prices-1705 is NOT auto-disabled (by design — only 4 critical auto-enable)."""
        pt = PeriodicTask.objects.get(name="ingest-daily-prices-1705")
        original = pt.enabled
        pt.enabled = True
        pt.save(update_fields=["enabled"])
        call_command("repair_beat_schedule", stdout=StringIO())
        # Code warns but leaves as is (enabled True) — does not auto-disable
        self.assertTrue(PeriodicTask.objects.get(name="ingest-daily-prices-1705").enabled)
        # Restore by design disabled
        pt.enabled = original
        pt.save(update_fields=["enabled"])
        self.assertFalse(PeriodicTask.objects.get(name="ingest-daily-prices-1705").enabled)

    def test_ingest_daily_prices_disabled_stays_disabled(self):
        """By design disabled stays disabled after reconcile (no auto-enable)."""
        pt = PeriodicTask.objects.get(name="ingest-daily-prices-1705")
        self.assertFalse(pt.enabled)
        call_command("repair_beat_schedule", stdout=StringIO())
        self.assertFalse(PeriodicTask.objects.get(name="ingest-daily-prices-1705").enabled)

    def test_idempotent_second_run_no_changes(self):
        # Ensure DB is populated first
        call_command("repair_beat_schedule", stdout=StringIO())
        out = StringIO()
        call_command("repair_beat_schedule", stdout=out)
        self.assertIn("No changes (0 rows)", out.getvalue())
        out2 = StringIO()
        call_command("repair_beat_schedule", stdout=out2)
        self.assertIn("No changes (0 rows)", out2.getvalue())
