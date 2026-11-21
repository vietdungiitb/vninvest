"""S1 (Phase B): ServiceRunLog lookup dùng cột phẳng + index, không scan JSONB.

Fail-before: `filter(trigger=...)` / `queue_tier` / `parent_run_log_id` là
FieldError trên code cũ (chưa có cột).
"""
from django.test import TestCase

from service_ops.models import ServiceDefinition, ServiceRunLog
from service_ops.tasks import _get_latest_queue_tier_run, _has_inflight_child_run

TRIGGER = 'market_data.queue_tier_scheduler'


def _svc(key='s1-svc'):
    return ServiceDefinition.objects.create(service_key=key, name=key, domain='dataops')


class QueueTierLookupTests(TestCase):
    def test_save_syncs_columns_from_input_summary(self):
        svc = _svc()
        run = ServiceRunLog.objects.create(
            service=svc,
            input_summary={'trigger': TRIGGER, 'queue_tier': 'hot'},
        )
        run.refresh_from_db()
        self.assertEqual(run.trigger, TRIGGER)
        self.assertEqual(run.queue_tier, 'hot')

    def test_latest_queue_tier_run_finds_row(self):
        svc = _svc()
        ServiceRunLog.objects.create(
            service=svc,
            input_summary={'trigger': TRIGGER, 'queue_tier': 'hot'},
        )
        run = _get_latest_queue_tier_run(svc, 'hot')
        self.assertIsNotNone(run)
        self.assertEqual(run.trigger, TRIGGER)

    def test_latest_queue_tier_run_ignores_other_tier(self):
        svc = _svc()
        ServiceRunLog.objects.create(
            service=svc,
            input_summary={'trigger': TRIGGER, 'queue_tier': 'cold'},
        )
        self.assertIsNone(_get_latest_queue_tier_run(svc, 'hot'))

    def test_inflight_child_lookup_uses_parent_column(self):
        svc = _svc()
        parent = ServiceRunLog.objects.create(service=svc, input_summary={})
        self.assertFalse(_has_inflight_child_run(parent.id))
        ServiceRunLog.objects.create(
            service=svc,
            status='running',
            input_summary={'parent_run_log_id': parent.id},
        )
        row = ServiceRunLog.objects.filter(parent_run_log_id=parent.id).first()
        self.assertIsNotNone(row)
        self.assertEqual(row.parent_run_log_id, parent.id)
        self.assertTrue(_has_inflight_child_run(parent.id))

    def test_lookup_indexes_exist(self):
        """O4: khóa regression — ai revert lookup về JSONB thì index thiếu sẽ đỏ ở đây."""
        from django.db import connection

        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT indexname FROM pg_indexes WHERE tablename = 'service_ops_servicerunlog'"
            )
            names = {row[0] for row in cursor.fetchall()}
        self.assertIn('runlog_svc_trg_tier_time_idx', names)
        self.assertIn('runlog_trigger_idx', names)
        self.assertIn('runlog_parent_idx', names)
