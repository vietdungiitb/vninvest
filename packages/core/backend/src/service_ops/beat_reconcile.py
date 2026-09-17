"""
Shared reconcile logic for beat schedule SSOT.

Used by:
- management/commands/repair_beat_schedule.py (manual / entrypoint)
- tasks.reconcile_beat_schedule_ssot (beat 5m)

Idempotent, handles Interval/Crontab FK, queue, enabled.
"""
import json
import logging

from django.conf import settings
from django_celery_beat.models import CrontabSchedule, IntervalSchedule, PeriodicTask

logger = logging.getLogger(__name__)

CRITICAL_JOBS = [
    "market-data-queue-tier-scheduler-30s",
    "ingest-price-board-60s",
    "warm-intraday-realtime-5m",
    "schedule-realtime-prefetch-shards",
]

def reconcile_beat_schedule(dry_run: bool = False) -> dict:
    """
    Reconcile django_celery_beat_periodictask with settings.CELERY_BEAT_SCHEDULE.

    Returns dict with counts: {re_enabled, created, queue_fixed}
    """
    schedule_map = dict(getattr(settings, "CELERY_BEAT_SCHEDULE", {}))
    re_enabled = []
    created = []
    queue_fixed = []

    for job_key, schedule_def in schedule_map.items():
        schedule_def = dict(schedule_def or {})
        desired_enabled = schedule_def.get("enabled", True)
        if job_key == "ingest-daily-prices-1705":
            desired_enabled = False

        is_critical = job_key in CRITICAL_JOBS

        try:
            pt = PeriodicTask.objects.get(name=job_key)
            exists = True
        except PeriodicTask.DoesNotExist:
            pt = None
            exists = False

        if not exists:
            if dry_run:
                created.append(job_key)
                continue
            schedule = schedule_def.get("schedule")
            interval = None
            crontab = None
            if isinstance(schedule, (int, float)):
                interval, _ = IntervalSchedule.objects.get_or_create(every=int(schedule), period="seconds")
            else:
                try:
                    crontab = CrontabSchedule.from_schedule(schedule)
                    tz_str = str(getattr(crontab, "timezone", ""))
                    if tz_str != "Asia/Ho_Chi_Minh":
                        crontab.timezone = "Asia/Ho_Chi_Minh"
                    if crontab.pk is None:
                        crontab, _ = CrontabSchedule.objects.get_or_create(
                            minute=crontab.minute,
                            hour=crontab.hour,
                            day_of_week=crontab.day_of_week,
                            day_of_month=crontab.day_of_month,
                            month_of_year=crontab.month_of_year,
                            timezone="Asia/Ho_Chi_Minh",
                        )
                    else:
                        if str(getattr(crontab, "timezone", "")) != "Asia/Ho_Chi_Minh":
                            CrontabSchedule.objects.filter(pk=crontab.pk).update(timezone="Asia/Ho_Chi_Minh")
                            crontab.refresh_from_db()
                except Exception as e:
                    logger.warning("[reconcile] Failed to build crontab for %s: %s", job_key, e)
                    crontab = None

            queue = (schedule_def.get("options") or {}).get("queue")
            if not queue:
                try:
                    from vninvest_core.queue_policy import SCHEDULER_QUEUE_MAP
                    queue = SCHEDULER_QUEUE_MAP.get(job_key, "celery")
                except Exception:
                    queue = "celery"

            kwargs = schedule_def.get("kwargs") or {}
            PeriodicTask.objects.create(
                name=job_key,
                task=schedule_def.get("task", ""),
                interval=interval,
                crontab=crontab,
                queue=queue or None,
                enabled=bool(desired_enabled),
                kwargs=json.dumps(kwargs) if kwargs else "{}",
                args="[]",
            )
            created.append(job_key)
            continue

        # Exists: fix enabled if critical
        if is_critical and not pt.enabled and desired_enabled:
            if dry_run:
                re_enabled.append(job_key)
            else:
                pt.enabled = True
                pt.save(update_fields=["enabled"])
                re_enabled.append(job_key)

        # Fix queue
        desired_queue = (schedule_def.get("options") or {}).get("queue")
        if not desired_queue:
            try:
                from vninvest_core.queue_policy import SCHEDULER_QUEUE_MAP
                desired_queue = SCHEDULER_QUEUE_MAP.get(job_key)
            except Exception:
                desired_queue = None
        if desired_queue and pt.queue != desired_queue:
            if dry_run:
                queue_fixed.append(f"{job_key}: {pt.queue} -> {desired_queue}")
            else:
                pt.queue = desired_queue
                pt.save(update_fields=["queue"])
                queue_fixed.append(f"{job_key}: -> {desired_queue}")

        # Fix crontab timezone
        try:
            pt_tz_str = str(getattr(pt.crontab, "timezone", "")) if pt.crontab else ""
            if pt.crontab and pt_tz_str != "Asia/Ho_Chi_Minh":
                if dry_run:
                    queue_fixed.append(f"{job_key}: crontab timezone {pt_tz_str} -> Asia/Ho_Chi_Minh")
                else:
                    CrontabSchedule.objects.filter(pk=pt.crontab.pk).update(timezone="Asia/Ho_Chi_Minh")
                    queue_fixed.append(f"{job_key}: crontab timezone -> Asia/Ho_Chi_Minh")
        except Exception:
            pass

    return {"re_enabled": re_enabled, "created": created, "queue_fixed": queue_fixed}
