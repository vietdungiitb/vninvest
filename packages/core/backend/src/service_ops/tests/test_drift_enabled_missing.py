"""
Test for drift-check extended (enabled + missing) — S3 DoD.
"""
from django.test import TestCase
from django_celery_beat.models import PeriodicTask
from django.core.management import call_command
from io import StringIO


class DriftEnabledMissingTest(TestCase):
    def setUp(self):
        # Ensure DB is populated
        call_command("repair_beat_schedule", stdout=StringIO())

    def test_enabled_drift_detected(self):
        PeriodicTask.objects.filter(name="ingest-price-board-60s").update(enabled=False)
        out = StringIO()
        # Use --warn-only to avoid SystemExit
        call_command("check_scheduler_queue_drift", "--warn-only", stdout=out)
        self.assertIn("ENABLED_DRIFT", out.getvalue())
        self.assertIn("ingest-price-board-60s", out.getvalue())
        # Restore
        PeriodicTask.objects.filter(name="ingest-price-board-60s").update(enabled=True)

    def test_missing_row_detected(self):
        pt = PeriodicTask.objects.get(name="warm-intraday-realtime-5m")
        pt.delete()
        out = StringIO()
        call_command("check_scheduler_queue_drift", "--warn-only", stdout=out)
        self.assertIn("MISSING_ROW", out.getvalue())
        self.assertIn("warm-intraday-realtime-5m", out.getvalue())
        # Restore via repair
        call_command("repair_beat_schedule", stdout=StringIO())
        self.assertTrue(PeriodicTask.objects.filter(name="warm-intraday-realtime-5m").exists())

    def test_no_drift_when_healthy(self):
        out = StringIO()
        call_command("check_scheduler_queue_drift", "--warn-only", stdout=out)
        self.assertIn("No queue drift detected", out.getvalue())
