"""
Repair beat schedule — auto re-enable 4 critical market-data jobs.

Root cause: 5 jobs were manually disabled in django_celery_beat_periodictask
(enabled=False) while CELERY_BEAT_SCHEDULE in settings has enabled=True.
Beat uses DatabaseScheduler (entrypoint.sh:43) → reads DB, not settings →
those jobs never dispatch → queue-tier lag 3h51m → freshness missing.

This command is idempotent, to be called on every api/beat startup
(entrypoint.sh) and manually via `python src/manage.py repair_beat_schedule`.

Keeps ingest-daily-prices-1705 disabled by design (settings.py:612 enabled: False).
"""
from django.core.management.base import BaseCommand


CRITICAL_JOBS = [
    "market-data-queue-tier-scheduler-30s",
    "ingest-price-board-60s",
    "warm-intraday-realtime-5m",
    "schedule-realtime-prefetch-shards",
]

class Command(BaseCommand):
    help = "Re-enable 4 critical market-data beat jobs that were manually disabled in DB."

    def handle(self, *args, **options):
        from django_celery_beat.models import PeriodicTask

        qs = PeriodicTask.objects.filter(name__in=CRITICAL_JOBS)
        existing = list(qs.values_list("name", flat=True))
        missing = [n for n in CRITICAL_JOBS if n not in existing]

        updated = qs.update(enabled=True)

        # Log for ConfigChangeAudit trail (optional)
        if updated:
            self.stdout.write(self.style.SUCCESS(f"[repair_beat_schedule] Re-enabled {updated} jobs: {', '.join(existing)}"))
        else:
            self.stdout.write("[repair_beat_schedule] No existing critical jobs to update (0 rows)")

        if missing:
            self.stdout.write(self.style.WARNING(f"[repair_beat_schedule] Missing jobs (will be created by beat from CELERY_BEAT_SCHEDULE on next run): {', '.join(missing)}"))

        # Verify ingest-daily-prices-1705 stays disabled
        try:
            keep_disabled = PeriodicTask.objects.get(name="ingest-daily-prices-1705")
            if keep_disabled.enabled:
                self.stdout.write(self.style.WARNING("[repair_beat_schedule] ingest-daily-prices-1705 is enabled but should stay disabled by design (settings.py:612) — leaving as is, no auto-disable."))
        except PeriodicTask.DoesNotExist:
            pass

        # Summary
        self.stdout.write(f"[repair_beat_schedule] Done. Critical jobs enabled: {CRITICAL_JOBS}")
