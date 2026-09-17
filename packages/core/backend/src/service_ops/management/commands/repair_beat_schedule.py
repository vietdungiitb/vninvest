"""
Repair beat schedule — reconcile django_celery_beat_periodictask with settings.CELERY_BEAT_SCHEDULE.

Root cause: 5 jobs were manually disabled in DB (enabled=False) while
CELERY_BEAT_SCHEDULE has enabled=True. Beat uses DatabaseScheduler →
reads DB, not settings → 4 critical jobs never dispatch.

This command is idempotent, to be called on every api/beat startup
(entrypoint.sh) and manually via `python src/manage.py repair_beat_schedule`.

Handles:
- Re-enable 4 CRITICAL_JOBS if disabled
- Create missing PeriodicTask rows with correct Interval/Crontab FK + queue
- Keep ingest-daily-prices-1705 disabled by design
- --dry-run: print plan without writing
"""
from django.core.management.base import BaseCommand

from service_ops.beat_reconcile import CRITICAL_JOBS

class Command(BaseCommand):
    help = "Reconcile django_celery_beat_periodictask with settings.CELERY_BEAT_SCHEDULE (re-enable 4 critical, create missing)."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Show plan without writing to DB")

    def handle(self, *args, **options):
        from service_ops.beat_reconcile import reconcile_beat_schedule

        dry_run = bool(options.get("dry_run"))
        result = reconcile_beat_schedule(dry_run=dry_run)

        re_enabled = result["re_enabled"]
        created = result["created"]
        queue_fixed = result["queue_fixed"]

        if dry_run:
            self.stdout.write("[repair_beat_schedule] DRY-RUN — no DB write")
        if re_enabled:
            self.stdout.write(self.style.SUCCESS(f"[repair_beat_schedule] Re-enabled {len(re_enabled)} jobs: {', '.join(re_enabled)}"))
        if created:
            self.stdout.write(self.style.SUCCESS(f"[repair_beat_schedule] Created {len(created)} missing jobs: {', '.join(created)}"))
        if queue_fixed:
            self.stdout.write(self.style.WARNING(f"[repair_beat_schedule] Queue fixed {len(queue_fixed)}: {', '.join(queue_fixed)}"))
        if not re_enabled and not created and not queue_fixed:
            self.stdout.write("[repair_beat_schedule] No changes (0 rows)")

        # Verify ingest-daily-prices-1705 stays disabled (handled in reconcile, just log)
        if not dry_run:
            from django_celery_beat.models import PeriodicTask
            try:
                keep_disabled = PeriodicTask.objects.get(name="ingest-daily-prices-1705")
                if keep_disabled.enabled:
                    self.stdout.write(self.style.WARNING("[repair_beat_schedule] ingest-daily-prices-1705 is enabled but should stay disabled by design (settings.py:612) — leaving as is, no auto-disable."))
            except PeriodicTask.DoesNotExist:
                pass

        if dry_run:
            self.stdout.write("[repair_beat_schedule] DRY-RUN Done. No DB changes.")
        else:
            self.stdout.write(f"[repair_beat_schedule] Done. Re-enabled: {len(re_enabled)}, Created: {len(created)}, Queue-fixed: {len(queue_fixed)}")
