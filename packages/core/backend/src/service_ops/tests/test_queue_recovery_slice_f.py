"""
Slice F (QueueRecovery) — materialize-symbol-snapshot-60s được reconcile bảo vệ.

Covers:
- CRITICAL_JOBS đồng bộ 2 nơi và chứa snapshot job
- reconcile bật lại snapshot job bị tắt
- drift-check báo ENABLED_DRIFT khi snapshot bị tắt
"""
from io import StringIO

from django.core.management import call_command
from django.test import TestCase
from django_celery_beat.models import PeriodicTask


class SnapshotCriticalProtectionTest(TestCase):
    def test_critical_lists_in_sync_and_include_snapshot(self):
        from service_ops.beat_reconcile import CRITICAL_JOBS as RECONCILE_CRITICAL
        from vninvest_core.management.commands.check_scheduler_queue_drift import (
            CRITICAL_JOBS as DRIFT_CRITICAL,
        )
        self.assertEqual(sorted(RECONCILE_CRITICAL), sorted(DRIFT_CRITICAL))
        self.assertIn('materialize-symbol-snapshot-60s', RECONCILE_CRITICAL)

    def test_reconcile_re_enables_snapshot(self):
        call_command('repair_beat_schedule', stdout=StringIO())
        PeriodicTask.objects.filter(name='materialize-symbol-snapshot-60s').update(enabled=False)
        call_command('repair_beat_schedule', stdout=StringIO())
        self.assertTrue(
            PeriodicTask.objects.get(name='materialize-symbol-snapshot-60s').enabled)

    def test_drift_check_flags_disabled_snapshot(self):
        call_command('repair_beat_schedule', stdout=StringIO())
        PeriodicTask.objects.filter(name='materialize-symbol-snapshot-60s').update(enabled=False)
        out = StringIO()
        try:
            call_command('check_scheduler_queue_drift', stdout=out)
        except SystemExit:
            pass
        self.assertIn('ENABLED_DRIFT materialize-symbol-snapshot-60s', out.getvalue())
        # restore
        call_command('repair_beat_schedule', stdout=StringIO())
        self.assertTrue(
            PeriodicTask.objects.get(name='materialize-symbol-snapshot-60s').enabled)
