from __future__ import annotations

from collections import Counter
from typing import Any

from django.conf import settings
from django.utils import timezone
from django_celery_beat.models import PeriodicTask

FRESHNESS_FRESH_THRESHOLD_SECONDS = 120
FRESHNESS_WARM_THRESHOLD_SECONDS = 600


def _normalize_queue_name(value: Any) -> str:
    return str(value or '').strip() or 'celery'


def _freshness_state(lag_seconds: int | None) -> str:
    if lag_seconds is None:
        return 'missing'
    if lag_seconds <= FRESHNESS_FRESH_THRESHOLD_SECONDS:
        return 'fresh'
    if lag_seconds <= FRESHNESS_WARM_THRESHOLD_SECONDS:
        return 'warm'
    return 'stale'


def _estimated_calls_per_minute(schedule_value: Any) -> float:
    if isinstance(schedule_value, (int, float)):
        seconds = float(schedule_value)
        if seconds > 0:
            return round(60.0 / seconds, 4)
    return 0.0


def build_scheduler_queue_metrics_snapshot(schedule_map: dict[str, Any] | None = None) -> dict[str, Any]:
    schedule_map = dict(schedule_map or getattr(settings, 'CELERY_BEAT_SCHEDULE', {}) or {})
    if not schedule_map:
        return {
            'generated_at': timezone.now().isoformat(),
            'runs_total': 0,
            'enqueued_total': 0,
            'estimated_upstream_calls_per_minute_total': 0.0,
            'queue_drift_count': 0,
            'queue_lag_seconds': {'min': None, 'avg': None, 'max': None},
            'freshness': {'fresh': 0, 'warm': 0, 'stale': 0, 'missing': 0},
            'tasks': [],
        }

    now = timezone.now()
    task_names = sorted(schedule_map.keys())
    tasks_by_name = {
        task.name: task
        for task in PeriodicTask.objects.filter(name__in=task_names)
    }

    task_snapshots: list[dict[str, Any]] = []
    lag_values: list[int] = []
    freshness_counts: Counter[str] = Counter()
    runs_total = 0
    enqueued_total = 0
    estimated_upstream_calls_per_minute_total = 0.0
    queue_drift_count = 0

    default_queue = _normalize_queue_name(getattr(settings, 'CELERY_TASK_DEFAULT_QUEUE', 'celery'))

    for task_name in task_names:
        schedule_definition = dict(schedule_map.get(task_name) or {})
        periodic_task = tasks_by_name.get(task_name)
        options = dict(schedule_definition.get('options') or {})
        expected_queue = _normalize_queue_name(options.get('queue') or default_queue)
        actual_queue = _normalize_queue_name(getattr(periodic_task, 'queue', None)) if periodic_task else ''

        lag_seconds = None
        last_run_at = getattr(periodic_task, 'last_run_at', None)
        if last_run_at is not None:
            try:
                lag_seconds = max(int((now - last_run_at).total_seconds()), 0)
            except Exception:
                lag_seconds = None

        freshness_state = _freshness_state(lag_seconds)
        freshness_counts[freshness_state] += 1
        if lag_seconds is not None:
            lag_values.append(lag_seconds)

        if periodic_task is not None:
            runs_total += int(getattr(periodic_task, 'total_run_count', 0) or 0)
            if bool(getattr(periodic_task, 'enabled', False)):
                enqueued_total += 1

        estimated_upstream_calls_per_minute_total += _estimated_calls_per_minute(schedule_definition.get('schedule'))

        queue_drift = periodic_task is None or actual_queue != expected_queue
        if queue_drift:
            queue_drift_count += 1

        task_snapshots.append(
            {
                'task_name': task_name,
                'expected_queue': expected_queue,
                'queue': actual_queue or None,
                'enabled': bool(getattr(periodic_task, 'enabled', False)) if periodic_task is not None else False,
                'last_run_at': last_run_at.isoformat() if last_run_at else None,
                'lag_seconds': lag_seconds,
                'freshness_state': freshness_state,
                'estimated_upstream_calls_per_minute': _estimated_calls_per_minute(schedule_definition.get('schedule')),
                'total_run_count': int(getattr(periodic_task, 'total_run_count', 0) or 0) if periodic_task else 0,
                'queue_drift': queue_drift,
            }
        )

    return {
        'generated_at': now.isoformat(),
        'runs_total': runs_total,
        'enqueued_total': enqueued_total,
        'estimated_upstream_calls_per_minute_total': round(estimated_upstream_calls_per_minute_total, 4),
        'queue_drift_count': queue_drift_count,
        'queue_lag_seconds': {
            'min': min(lag_values) if lag_values else None,
            'avg': round(sum(lag_values) / len(lag_values), 2) if lag_values else None,
            'max': max(lag_values) if lag_values else None,
        },
        'freshness': {
            'fresh': int(freshness_counts.get('fresh', 0)),
            'warm': int(freshness_counts.get('warm', 0)),
            'stale': int(freshness_counts.get('stale', 0)),
            'missing': int(freshness_counts.get('missing', 0)),
        },
        'tasks': task_snapshots,
    }
