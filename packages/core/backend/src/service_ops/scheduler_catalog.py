"""
Scheduler Catalog — unified read model cho mọi periodic/service jobs.

Merge sources:
  1. CELERY_BEAT_SCHEDULE + django_celery_beat.PeriodicTask
  2. ServiceRunLog latest/inflight per job
  3. Runtime ServiceConfig enabled flags (prefetch, dataops)

Output: list of SchedulerJob dicts với canonical fields.
"""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

# ── Static metadata per job_key ────────────────────────────────────────────────
# domain: which operator domain owns this job
# data_types: list of data concerns
# trigger_type: cron | interval | policy_driven
# control_mode: beat_enabled | runtime_enabled | dispatch_quota
# capabilities: which actions are valid for this job
CATALOG_JOB_METADATA: dict[str, dict[str, Any]] = {
    # === Market data SSOT queue-tier scheduler ===
    'market-data-queue-tier-scheduler-30s': {
        'domain': 'dataops',
        'data_types': ['daily_prices', 'price_board', 'intraday_ticks', 'session_facts'],
        'trigger_type': 'interval',
        'control_mode': 'beat_enabled',
        'capabilities': ['enable', 'disable', 'run_now', 'abort_active'],
        'display_name': 'Market data queue-tier scheduler (30s)',
        'service_key': 'vnbroker_price_board',
    },
    'market-data-parity-snapshot-retention-cleanup-hourly': {
        'domain': 'dataops',
        'data_types': ['parity_snapshot'],
        'trigger_type': 'interval',
        'control_mode': 'beat_enabled',
        'capabilities': ['enable', 'disable', 'run_now'],
        'display_name': 'Parity snapshot retention cleanup (hourly)',
    },
    'market-data-parity-retention-health-monitor-2h': {
        'domain': 'dataops',
        'data_types': ['parity_snapshot'],
        'trigger_type': 'interval',
        'control_mode': 'beat_enabled',
        'capabilities': ['enable', 'disable', 'run_now'],
        'display_name': 'Parity retention health monitor (2h)',
    },
    # === Native ingest ===
    'ingest-price-board-60s': {
        'domain': 'dataops',
        'data_types': ['price_board'],
        'trigger_type': 'interval',
        'control_mode': 'beat_enabled',
        'capabilities': ['enable', 'disable', 'run_now', 'abort_active'],
        'display_name': 'Price board ingest (60s)',
    },
    'daily-backfill-prices-1700': {
        'domain': 'dataops',
        'data_types': ['daily_prices'],
        'trigger_type': 'cron',
        'control_mode': 'beat_enabled',
        'capabilities': ['enable', 'disable', 'run_now'],
        'display_name': 'Daily price backfill (17:00 ICT)',
    },
    'ingest-daily-prices-1705': {
        'domain': 'dataops',
        'data_types': ['daily_prices'],
        'trigger_type': 'cron',
        'control_mode': 'beat_enabled',
        'capabilities': ['enable', 'disable', 'run_now'],
        'display_name': 'Daily price ingest shadow (17:05 ICT)',
    },
    'deep-history-bootstrap-weekly': {
        'domain': 'dataops',
        'data_types': ['daily_prices'],
        'trigger_type': 'cron',
        'control_mode': 'beat_enabled',
        'capabilities': ['enable', 'disable', 'run_now'],
        'display_name': 'Deep history bootstrap — 5 năm (Chủ nhật 03:00)',
    },
    # === Materializers ===
    'materialize-symbol-snapshot-60s': {
        'domain': 'materialization',
        'data_types': ['symbol_snapshot'],
        'trigger_type': 'interval',
        'control_mode': 'beat_enabled',
        'capabilities': ['enable', 'disable', 'run_now', 'abort_active'],
        'display_name': 'Symbol snapshot materializer (60s)',
    },
    'materialize-pre-open-snapshots-20m': {
        'domain': 'materialization',
        'data_types': ['pre_open_snapshot'],
        'trigger_type': 'cron',
        'control_mode': 'beat_enabled',
        'capabilities': ['enable', 'disable', 'run_now'],
        'display_name': 'Pre-open snapshot materializer (08:40)',
    },
    'materialize-session-facts-5m': {
        'domain': 'materialization',
        'data_types': ['session_facts'],
        'trigger_type': 'interval',
        'control_mode': 'beat_enabled',
        'capabilities': ['enable', 'disable', 'run_now', 'abort_active'],
        'display_name': 'Session facts materializer (5m)',
    },
    'materialize-unified-alerts-2m': {
        'domain': 'materialization',
        'data_types': ['unified_alerts'],
        'trigger_type': 'interval',
        'control_mode': 'beat_enabled',
        'capabilities': ['enable', 'disable', 'run_now', 'abort_active'],
        'display_name': 'Unified alerts materializer (2m)',
    },
    # === Realtime prefetch ===
    'schedule-realtime-prefetch-shards': {
        'domain': 'prefetch',
        'data_types': ['price_board', 'realtime_cache'],
        'trigger_type': 'interval',
        'control_mode': 'runtime_enabled',
        'capabilities': ['enable', 'disable'],
        'display_name': 'Realtime prefetch shard scheduler (3s)',
    },
    # === Commercial / tenant lifecycle ===
    'flush-quota-counters': {
        'domain': 'platform',
        'data_types': ['quota'],
        'trigger_type': 'interval',
        'control_mode': 'beat_enabled',
        'capabilities': ['enable', 'disable', 'run_now'],
        'display_name': 'Quota counter flush (60s)',
    },
    'generate-monthly-invoices': {
        'domain': 'platform',
        'data_types': ['invoice'],
        'trigger_type': 'cron',
        'control_mode': 'beat_enabled',
        'capabilities': ['enable', 'disable', 'run_now'],
        'display_name': 'Monthly invoice generator',
    },
    'check-overdue-invoices': {
        'domain': 'platform',
        'data_types': ['invoice'],
        'trigger_type': 'cron',
        'control_mode': 'beat_enabled',
        'capabilities': ['enable', 'disable', 'run_now'],
        'display_name': 'Overdue invoice checker (daily 08:00)',
    },
    'auto-expire-trials': {
        'domain': 'platform',
        'data_types': ['tenant_lifecycle'],
        'trigger_type': 'cron',
        'control_mode': 'beat_enabled',
        'capabilities': ['enable', 'disable', 'run_now'],
        'display_name': 'Trial auto-expiry (daily 01:00)',
    },
    'auto-suspend-quota-overflow': {
        'domain': 'platform',
        'data_types': ['tenant_lifecycle'],
        'trigger_type': 'interval',
        'control_mode': 'beat_enabled',
        'capabilities': ['enable', 'disable', 'run_now'],
        'display_name': 'Quota overflow auto-suspend (1h)',
    },
    'send-trial-expiry-warning': {
        'domain': 'platform',
        'data_types': ['tenant_lifecycle', 'notification'],
        'trigger_type': 'cron',
        'control_mode': 'beat_enabled',
        'capabilities': ['enable', 'disable', 'run_now'],
        'display_name': 'Trial expiry warning (daily 09:00)',
    },
    'auto-deprovision-stale': {
        'domain': 'platform',
        'data_types': ['tenant_lifecycle'],
        'trigger_type': 'cron',
        'control_mode': 'beat_enabled',
        'capabilities': ['enable', 'disable', 'run_now'],
        'display_name': 'Stale tenant auto-deprovision (weekly)',
    },
    # === Ops ===
    'daily-db-backup-2am': {
        'domain': 'platform',
        'data_types': ['backup'],
        'trigger_type': 'cron',
        'control_mode': 'beat_enabled',
        'capabilities': ['enable', 'disable', 'run_now'],
        'display_name': 'Daily DB backup (02:00)',
    },
}

_FRESHNESS_FRESH_SECONDS = 120
_FRESHNESS_WARM_SECONDS = 600


def _freshness_state(lag_seconds: int | None) -> str:
    if lag_seconds is None:
        return 'missing'
    if lag_seconds <= _FRESHNESS_FRESH_SECONDS:
        return 'fresh'
    if lag_seconds <= _FRESHNESS_WARM_SECONDS:
        return 'warm'
    return 'stale'


def _schedule_label(schedule_def: dict) -> str:
    """Trả label đọc được từ schedule definition."""
    sched = schedule_def.get('schedule')
    if sched is None:
        return 'unknown'
    if isinstance(sched, (int, float)):
        return f'every {int(sched)}s'
    # crontab or other object — use repr
    return str(sched)


def _derive_status(
    enabled: bool,
    is_inflight: bool,
    freshness_state: str,
    lag_seconds: int | None,
) -> tuple[str, str | None]:
    """
    Trả (status, status_reason).

    Trạng thái priority:
      running > paused > disabled > degraded > idle > enabled
    """
    if is_inflight:
        return 'running', None
    if not enabled:
        return 'disabled', None
    if freshness_state == 'stale':
        reason = f'lag={lag_seconds}s vượt ngưỡng stale ({_FRESHNESS_WARM_SECONDS}s)'
        return 'degraded', reason
    if freshness_state == 'missing':
        return 'idle', 'Chưa chạy lần nào'
    return 'enabled', None


def build_scheduler_catalog(
    schedule_map: dict[str, Any] | None = None,
    domain_filter: str | None = None,
) -> list[dict[str, Any]]:
    """
    Xây dựng danh sách SchedulerJob thống nhất từ CELERY_BEAT_SCHEDULE + PeriodicTask.

    ServiceRunLog enrichment được bổ sung trong S04 (runtime status aggregator).

    Args:
        schedule_map: Override schedule map (dùng trong tests).  None = dùng settings.
        domain_filter: Nếu set, chỉ trả jobs thuộc domain đó.

    Returns:
        list of SchedulerJob dicts với canonical fields.
    """
    from django_celery_beat.models import PeriodicTask
    from .models import ServiceDefinition, ServiceRunLog

    if schedule_map is None:
        schedule_map = dict(getattr(settings, 'CELERY_BEAT_SCHEDULE', {}))
    else:
        schedule_map = dict(schedule_map)
    now = timezone.now()

    # Build PeriodicTask lookup — indexed by task name (= beat schedule key)
    task_names = list(schedule_map.keys())
    periodic_tasks_by_name: dict[str, Any] = {
        pt.name: pt
        for pt in PeriodicTask.objects.filter(name__in=task_names).only(
            'name', 'task', 'enabled', 'last_run_at', 'total_run_count', 'queue'
        )
    }

    # S04: Build inflight set from ServiceRunLog — service_key → bool
    inflight_service_keys: set[str] = set(
        ServiceRunLog.objects.filter(
            status__in=['queued', 'running'],
        ).values_list('service__service_key', flat=True).distinct()
    )

    catalog: list[dict[str, Any]] = []

    for job_key in sorted(schedule_map.keys()):
        meta = CATALOG_JOB_METADATA.get(job_key, {})
        domain = meta.get('domain', 'platform')

        if domain_filter and domain != domain_filter:
            continue

        schedule_def = dict(schedule_map.get(job_key) or {})
        periodic_task = periodic_tasks_by_name.get(job_key)
        task_path = schedule_def.get('task', '')

        # enabled: truth from PeriodicTask DB; fallback to schedule def 'enabled' key
        if periodic_task is not None:
            enabled = bool(periodic_task.enabled)
        else:
            sched_enabled = schedule_def.get('enabled')
            enabled = sched_enabled if sched_enabled is not None else True

        # last_run_at from PeriodicTask
        last_run_at = None
        if periodic_task is not None:
            last_run_at = getattr(periodic_task, 'last_run_at', None)

        # lag_seconds
        lag_seconds: int | None = None
        if last_run_at is not None:
            try:
                lag_seconds = max(int((now - last_run_at).total_seconds()), 0)
            except Exception:
                pass

        freshness = _freshness_state(lag_seconds)

        # S04-ext: Override last_run_at / freshness từ manual run_now (operator trigger).
        # PeriodicTask.last_run_at chỉ cập nhật khi beat scheduler tự kích hoạt,
        # không cập nhật khi operator bấm "Chạy ngay". Dùng cache để bổ sung.
        try:
            from django.core.cache import cache as _cache
            from django.utils.dateparse import parse_datetime as _parse_dt
            _manual_iso = _cache.get(f'scheduler:manual_run:{job_key}')
            if _manual_iso:
                _manual_run_at = _parse_dt(_manual_iso)
                if _manual_run_at and (last_run_at is None or _manual_run_at > last_run_at):
                    last_run_at = _manual_run_at
                    lag_seconds = max(int((now - last_run_at).total_seconds()), 0)
                    freshness = _freshness_state(lag_seconds)
        except Exception:
            pass

        # S04: is_inflight từ ServiceRunLog (jobs có ServiceDefinition)
        service_key = meta.get('service_key', '')
        is_inflight = service_key in inflight_service_keys if service_key else False

        # S04-ext: Nếu không có ServiceDefinition (vd: backfill jobs), check cache marker
        # được set bởi run_now. TTL = 7200s — tự hết hạn sau 2h hoặc bị xóa khi abort.
        if not is_inflight:
            try:
                from django.core.cache import cache as _cache
                is_inflight = bool(_cache.get(f'scheduler:inflight:{job_key}'))
            except Exception:
                pass

        job_status, status_reason = _derive_status(enabled, is_inflight, freshness, lag_seconds)

        # next_run_at: estimated from last_run_at + interval (best effort for interval jobs)
        next_run_at: str | None = None
        if periodic_task is not None and last_run_at is not None:
            sched_val = schedule_def.get('schedule')
            if isinstance(sched_val, (int, float)) and sched_val > 0:
                try:
                    estimated_next = last_run_at + timedelta(seconds=float(sched_val))
                    next_run_at = estimated_next.isoformat()
                except Exception:
                    pass

        options = dict(schedule_def.get('options') or {})
        default_queue = str(getattr(settings, 'CELERY_TASK_DEFAULT_QUEUE', 'celery'))
        queue = options.get('queue') or (
            str(periodic_task.queue) if periodic_task and periodic_task.queue else default_queue
        )

        catalog.append({
            'job_key': job_key,
            'display_name': meta.get('display_name', job_key),
            'domain': domain,
            'data_types': meta.get('data_types', []),
            'trigger_type': meta.get('trigger_type', 'interval'),
            'control_mode': meta.get('control_mode', 'beat_enabled'),
            'schedule_label': _schedule_label(schedule_def),
            'task_path': task_path,
            'queue': queue,
            'status': job_status,
            'status_reason': status_reason,
            'enabled': enabled,
            'is_inflight': is_inflight,
            'next_run_at': next_run_at,
            'last_run_at': last_run_at.isoformat() if last_run_at else None,
            'lag_seconds': lag_seconds,
            'freshness_state': freshness,
            'total_run_count': int(getattr(periodic_task, 'total_run_count', 0) or 0) if periodic_task else 0,
            'beat_registered': periodic_task is not None,
            'capabilities': list(meta.get('capabilities', [])),
        })

    return catalog


def build_scheduler_health_summary(catalog: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    """
    Trả global health summary từ catalog.

    Args:
        catalog: Nếu None, tự gọi build_scheduler_catalog().
    """
    if catalog is None:
        catalog = build_scheduler_catalog()

    total = len(catalog)
    by_status: dict[str, int] = {}
    by_domain: dict[str, int] = {}
    by_freshness: dict[str, int] = {}
    queue_drift_count = 0
    unregistered_count = 0

    for job in catalog:
        s = job['status']
        by_status[s] = by_status.get(s, 0) + 1
        d = job['domain']
        by_domain[d] = by_domain.get(d, 0) + 1
        f = job['freshness_state']
        by_freshness[f] = by_freshness.get(f, 0) + 1
        if not job['beat_registered']:
            unregistered_count += 1

    enabled_count = by_status.get('enabled', 0) + by_status.get('running', 0)
    degraded_count = by_status.get('degraded', 0) + by_status.get('failed', 0)
    overall_health = 'healthy' if degraded_count == 0 and unregistered_count == 0 else 'degraded'

    return {
        'generated_at': timezone.now().isoformat(),
        'overall_health': overall_health,
        'jobs_total': total,
        'by_status': by_status,
        'by_domain': by_domain,
        'by_freshness': by_freshness,
        'enabled_count': enabled_count,
        'degraded_count': degraded_count,
        'unregistered_count': unregistered_count,
    }
