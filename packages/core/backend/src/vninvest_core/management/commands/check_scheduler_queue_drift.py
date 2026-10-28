"""Check for queue drift + enabled/missing drift between code and DB scheduler."""
import sys

from django.conf import settings
from django.core.management.base import BaseCommand
from django_celery_beat.models import PeriodicTask

from vninvest_core.queue_policy import SCHEDULER_QUEUE_MAP

# Slice F (QueueRecovery): đồng bộ với service_ops.beat_reconcile.CRITICAL_JOBS —
# materialize-symbol-snapshot-60s được bảo vệ khỏi tắt lặng lẽ.
CRITICAL_JOBS = [
    "market-data-queue-tier-scheduler-30s",
    "ingest-price-board-60s",
    "warm-intraday-realtime-5m",
    "schedule-realtime-prefetch-shards",
    "materialize-symbol-snapshot-60s",
]

class Command(BaseCommand):
    help = 'Check for queue drift + enabled/missing drift between code and DB scheduler'

    EXPECTED_QUEUES = SCHEDULER_QUEUE_MAP

    def add_arguments(self, parser):
        parser.add_argument(
            '--warn-only',
            action='store_true',
            help='Warn but do not fail',
        )

    def handle(self, *args, **options):
        drift_count = 0
        drifts = []

        # 1. Queue drift (existing)
        for task in PeriodicTask.objects.all():
            expected = self.EXPECTED_QUEUES.get(task.name)
            if expected and task.queue != expected:
                drift_count += 1
                drifts.append(f"QUEUE_DRIFT {task.name}: expected={expected}, actual={task.queue}")

        # 2. Enabled drift for CRITICAL_JOBS
        for job_key in CRITICAL_JOBS:
            try:
                pt = PeriodicTask.objects.get(name=job_key)
                if not pt.enabled:
                    drift_count += 1
                    drifts.append(f"ENABLED_DRIFT {job_key}: enabled=False in DB but should be True (critical)")
            except PeriodicTask.DoesNotExist:
                pass

        # 3. Missing row for any job in CELERY_BEAT_SCHEDULE
        schedule_map = dict(getattr(settings, "CELERY_BEAT_SCHEDULE", {}))
        for job_key in schedule_map.keys():
            if not PeriodicTask.objects.filter(name=job_key).exists():
                drift_count += 1
                drifts.append(f"MISSING_ROW {job_key}: no PeriodicTask row (should exist per CELERY_BEAT_SCHEDULE)")

        if drifts:
            self.stdout.write(self.style.WARNING(f'DRIFT DETECTED: {drift_count} tasks'))
            for d in drifts:
                self.stdout.write(f"  {d}")

            if not options['warn_only']:
                sys.exit(1)
        else:
            self.stdout.write(self.style.SUCCESS('No queue drift detected'))
