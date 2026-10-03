"""Sync scheduler queue fields to expected values."""
from django.core.management.base import BaseCommand
from django_celery_beat.models import PeriodicTask

from vninvest_core.queue_policy import SCHEDULER_QUEUE_MAP


class Command(BaseCommand):
    help = 'Sync scheduler queue fields to expected values'

    QUEUE_MAP = SCHEDULER_QUEUE_MAP

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
