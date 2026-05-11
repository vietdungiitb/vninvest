"""Sync scheduler queue fields to expected values."""
from django.core.management.base import BaseCommand
from django_celery_beat.models import PeriodicTask


class Command(BaseCommand):
    help = 'Sync scheduler queue fields to expected values'

    QUEUE_MAP = {
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

    def handle(self, *args, **options):
        updated = 0
        for task in PeriodicTask.objects.all():
            expected_queue = self.QUEUE_MAP.get(task.name)
            if expected_queue and task.queue != expected_queue:
                task.queue = expected_queue
                task.save(update_fields=['queue'])
                updated += 1
                self.stdout.write(
                    f"Updated {task.name} -> {expected_queue}"
                )

        self.stdout.write(
            self.style.SUCCESS(f'Updated {updated} tasks')
        )
