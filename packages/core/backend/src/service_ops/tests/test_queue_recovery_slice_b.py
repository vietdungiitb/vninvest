"""
Slice B (QueueRecovery) — per-message TTL sync via PeriodicTask.expire_seconds.

Covers:
- CELERY_BEAT_SCHEDULE entries carry expire_seconds for realtime heartbeats
- repair_beat_schedule creates missing rows with expire_seconds
- repair_beat_schedule fixes drifted expire_seconds (and dry-run does not write)
- second run is idempotent (no changes)
"""
import os
from io import StringIO

from django.conf import settings as dj_settings
from django.core.management import call_command
from django.test import TestCase
from django_celery_beat.models import PeriodicTask


def _env_int(name, default):
    try:
        return int(os.getenv(name) or default)
    except (TypeError, ValueError):
        return default


EXPECTED_EXPIRE = {
    # Same env wiring as vninvest_core.settings — tests the plumbing, not the value.
    'schedule-realtime-prefetch-shards': _env_int('REALTIME_SCHEDULER_EXPIRE_SECONDS', 30),
    'ingest-price-board-60s': _env_int('PRICE_BOARD_EXPIRE_SECONDS', 300),
    'warm-intraday-realtime-5m': _env_int('WARM_INTRADAY_EXPIRE_SECONDS', 600),
}


class BeatExpireSecondsConfigTest(TestCase):
    def test_schedule_entries_carry_expire_seconds(self):
        schedule_map = dict(getattr(dj_settings, 'CELERY_BEAT_SCHEDULE', {}))
        for job_key, expected in EXPECTED_EXPIRE.items():
            self.assertIn(job_key, schedule_map)
            self.assertEqual(
                schedule_map[job_key].get('expire_seconds'), expected,
                f'{job_key} must declare expire_seconds={expected}',
            )


class RepairBeatExpireSecondsTest(TestCase):
    def setUp(self):
        call_command('repair_beat_schedule', stdout=StringIO())

    def test_reconcile_syncs_expire_seconds(self):
        for job_key, expected in EXPECTED_EXPIRE.items():
            pt = PeriodicTask.objects.get(name=job_key)
            self.assertEqual(pt.expire_seconds, expected, job_key)

    def test_create_missing_row_with_expire_seconds(self):
        PeriodicTask.objects.filter(name='schedule-realtime-prefetch-shards').delete()
        call_command('repair_beat_schedule', stdout=StringIO())
        pt = PeriodicTask.objects.get(name='schedule-realtime-prefetch-shards')
        self.assertEqual(pt.expire_seconds, EXPECTED_EXPIRE['schedule-realtime-prefetch-shards'])

    def test_fix_drifted_expire_seconds(self):
        PeriodicTask.objects.filter(name='ingest-price-board-60s').update(expire_seconds=9999)
        call_command('repair_beat_schedule', stdout=StringIO())
        pt = PeriodicTask.objects.get(name='ingest-price-board-60s')
        self.assertEqual(pt.expire_seconds, EXPECTED_EXPIRE['ingest-price-board-60s'])

    def test_dry_run_does_not_write_expire_seconds(self):
        PeriodicTask.objects.filter(name='ingest-price-board-60s').update(expire_seconds=9999)
        out = StringIO()
        call_command('repair_beat_schedule', '--dry-run', stdout=out)
        pt = PeriodicTask.objects.get(name='ingest-price-board-60s')
        self.assertEqual(pt.expire_seconds, 9999)
        self.assertIn('expire_seconds', out.getvalue())
        # restore for idempotency of other tests
        call_command('repair_beat_schedule', stdout=StringIO())

    def test_second_run_no_changes(self):
        call_command('repair_beat_schedule', stdout=StringIO())
        out = StringIO()
        call_command('repair_beat_schedule', stdout=out)
        self.assertIn('No changes (0 rows)', out.getvalue())

class RepairBeatIntervalSyncTest(TestCase):
    def setUp(self):
        call_command('repair_beat_schedule', stdout=StringIO())

    def test_reconcile_syncs_numeric_interval(self):
        from django_celery_beat.models import IntervalSchedule, PeriodicTask
        pt = PeriodicTask.objects.get(name="ingest-price-board-60s")
        old, _ = IntervalSchedule.objects.get_or_create(every=60, period="seconds")
        pt.interval = old
        pt.save(update_fields=["interval"])
        call_command("repair_beat_schedule", stdout=StringIO())
        pt.refresh_from_db()
        from django.conf import settings as dj_settings
        expected = int(float(
            dict(getattr(dj_settings, "CELERY_BEAT_SCHEDULE", {}))["ingest-price-board-60s"]["schedule"]))
        self.assertEqual(int(pt.interval.every), expected)

    def test_second_run_no_changes(self):
        call_command("repair_beat_schedule", stdout=StringIO())
        out = StringIO()
        call_command("repair_beat_schedule", stdout=out)
        self.assertIn("No changes (0 rows)", out.getvalue())
