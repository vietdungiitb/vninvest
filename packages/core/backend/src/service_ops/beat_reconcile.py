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

# Slice F (QueueRecovery): materialize-symbol-snapshot-60s được reconcile bảo vệ —
# job này từng bị tắt lặng lẽ (enabled=False, dừng từ 17/09) mà reconcile bỏ qua.
# Giữ đồng bộ 2 danh sách (đây + check_scheduler_queue_drift.CRITICAL_JOBS).
CRITICAL_JOBS = [
    "market-data-queue-tier-scheduler-30s",
    "ingest-price-board-60s",
    "warm-intraday-realtime-5m",
    "schedule-realtime-prefetch-shards",
    "materialize-symbol-snapshot-60s",
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
            expire_seconds = schedule_def.get("expire_seconds")
            try:
                expire_seconds = int(expire_seconds) if expire_seconds is not None else None
            except (TypeError, ValueError):
                expire_seconds = None
            PeriodicTask.objects.create(
                name=job_key,
                task=schedule_def.get("task", ""),
                interval=interval,
                crontab=crontab,
                queue=queue or None,
                enabled=bool(desired_enabled),
                kwargs=json.dumps(kwargs) if kwargs else "{}",
                args="[]",
                expire_seconds=expire_seconds,
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

        # Corrective live-measured: đồng bộ interval số (vd price-board 60→180s).
        # Chỉ xử lý schedule số (interval); crontab giữ nguyên. Reconcile trước đây không
        # đụng interval nên đổi settings không lan xuống DB.
        desired_schedule = schedule_def.get("schedule")
        if isinstance(desired_schedule, (int, float)) and desired_schedule > 0:
            try:
                current_every = None
                if pt.interval is not None:
                    current_every = int(getattr(pt.interval, "every", 0) or 0)
                if current_every != int(desired_schedule):
                    if dry_run:
                        queue_fixed.append(
                            f"{job_key}: interval {current_every}s -> {int(desired_schedule)}s")
                    else:
                        new_interval, _ = IntervalSchedule.objects.get_or_create(
                            every=int(desired_schedule), period="seconds")
                        pt.interval = new_interval
                        pt.save(update_fields=["interval"])
                        queue_fixed.append(f"{job_key}: interval -> {int(desired_schedule)}s")
            except Exception as e:
                logger.warning("[reconcile] Failed to sync interval for %s: %s", job_key, e)

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

        # Slice B (QueueRecovery): sync per-message TTL into PeriodicTask.expire_seconds.
        desired_expire = schedule_def.get("expire_seconds")
        try:
            desired_expire = int(desired_expire) if desired_expire is not None else None
        except (TypeError, ValueError):
            desired_expire = None
        if desired_expire is not None and pt.expire_seconds != desired_expire:
            if dry_run:
                queue_fixed.append(f"{job_key}: expire_seconds {pt.expire_seconds} -> {desired_expire}")
            else:
                pt.expire_seconds = desired_expire
                pt.save(update_fields=["expire_seconds"])
                queue_fixed.append(f"{job_key}: expire_seconds -> {desired_expire}")

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
