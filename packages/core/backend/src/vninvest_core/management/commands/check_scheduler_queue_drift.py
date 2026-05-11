"""Check for queue drift between code and DB scheduler."""
import sys
from django.core.management.base import BaseCommand
from django_celery_beat.models import PeriodicTask


class Command(BaseCommand):
    help = 'Check for queue drift between code and DB scheduler'

    EXPECTED_QUEUES = {
        # Format: task_name: expected_queue
        'materialize-symbol-snapshot-60s': 'realtime_prefetch',
        'materialize-session-facts-2m': 'realtime_prefetch',
        'materialize-unified-alerts-2m': 'realtime_prefetch',
        'materialize-symbol-snapshot-30s': 'realtime_prefetch',
        'materialize-bucket-facts-5m': 'realtime_prefetch',
        'detect_and_store_global_whale_alerts': 'analytics_heavy',
        'detect_order_flow': 'analytics_heavy',
        'run_stream_consumer_batch': 'realtime_stream',
        'enrich_history_bars': 'enrichment_offhours',
        'enrich_fundamentals': 'enrichment_offhours',
        'manual_refresh_task': 'manual_on_demand',
    }

    def add_arguments(self, parser):
        parser.add_argument(
            '--warn-only',
            action='store_true',
            help='Warn but do not fail',
        )

    def handle(self, *args, **options):
        drift_count = 0
        drifts = []

        for task in PeriodicTask.objects.all():
            expected = self.EXPECTED_QUEUES.get(task.name)
            if expected and task.queue != expected:
                drift_count += 1
                drifts.append(
                    {
                        'task': task.name,
                        'expected': expected,
                        'actual': task.queue,
                    }
                )

        if drifts:
            self.stdout.write(
                self.style.WARNING(f'DRIFT DETECTED: {drift_count} tasks')
            )
            for d in drifts:
                self.stdout.write(
                    f"  {d['task']}: expected={d['expected']}, "
                    f"actual={d['actual']}"
                )

            if not options['warn_only']:
                sys.exit(1)
        else:
            self.stdout.write(
                self.style.SUCCESS('No queue drift detected')
            )
