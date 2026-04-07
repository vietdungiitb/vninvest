"""
services.py — Lớp trung gian giữa vnstock và database.

Chứa các hàm:
  - fetch_and_save_daily_prices(): Kéo giá EOD từ vnstock, lưu vào DailyPrice.
  - sync_portfolio_prices(): Lấy toàn bộ mã CK trong một Portfolio rồi sync.
  - get_latest_price(): Trả về giá đóng cửa mới nhất của một mã từ DB.
  - get_price_changes(): Trả về giá + % thay đổi so với phiên trước cho danh sách mã.
"""

import hashlib
import json
import logging
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.contrib.auth.models import User
from django.db.models import ExpressionWrapper, F, FloatField, Sum
from django.db import transaction as db_transaction
from django.utils import timezone

from .mail_service import send_system_email
from .models import (
    DailyPrice,
    IntradayTick,
    MarketGroupSyncLog,
    Portfolio,
    SecuritiesGroup,
    SecuritiesItem,
    StockProfile,
    StockProfileSyncLog,
    Transaction,
    TrackedSymbol,
    WatchlistItem,
    WhaleAdvisory,
    WhaleConfigAuditLog,
    WhaleConfigRollout,
    WhaleConfigVersion,
    WhaleConfigWorkerAck,
)
from .whale_scoring import resolve_whale_score_config

logger = logging.getLogger(__name__)


def _coerce_float(value, default: float | None = None) -> float | None:
    try:
        if value is None or value == '':
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _coerce_int(value, default: int | None = None) -> int | None:
    try:
        if value is None or value == '':
            return default
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _extract_first(payload: dict, keys: list[str], default=None):
    for key in keys:
        if key in payload:
            return payload.get(key)
    return default


def _format_preview_value(value) -> str:
    if isinstance(value, dict):
        return json.dumps(value, sort_keys=True, ensure_ascii=True)
    if isinstance(value, list):
        return json.dumps(value, ensure_ascii=True)
    return str(value)


def _active_whale_config_json() -> dict:
    active = (
        WhaleConfigVersion.objects
        .filter(status=WhaleConfigVersion.StatusChoices.ACTIVE)
        .values_list('config_json', flat=True)
        .first()
    )
    return active if isinstance(active, dict) else {}


def get_active_whale_config_version():
    return (
        WhaleConfigVersion.objects
        .filter(status=WhaleConfigVersion.StatusChoices.ACTIVE)
        .order_by('-activated_at', '-created_at')
        .first()
    )


def _normalize_symbol_list(raw_symbols) -> list[str]:
    if not isinstance(raw_symbols, (list, tuple, set)):
        return []
    return sorted({str(symbol).strip().upper() for symbol in raw_symbols if str(symbol).strip()})


def _stable_symbol_percent(symbol: str) -> int:
    digest = hashlib.md5(symbol.upper().encode('utf-8')).hexdigest()
    return int(digest[:8], 16) % 100


def symbol_matches_canary_scope(symbol: str, canary_scope_json: dict | None) -> bool:
    scope_payload = canary_scope_json if isinstance(canary_scope_json, dict) else {}
    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return False

    explicit_symbols = _normalize_symbol_list(scope_payload.get('symbols'))
    if explicit_symbols and normalized_symbol not in explicit_symbols:
        return False

    exchanges = set()
    if isinstance(scope_payload.get('exchange'), str) and str(scope_payload.get('exchange')).strip():
        exchanges.add(str(scope_payload.get('exchange')).strip().upper())
    exchanges.update(
        str(item).strip().upper()
        for item in (scope_payload.get('exchanges') or [])
        if str(item).strip()
    )
    if exchanges:
        stock_profile = StockProfile.objects.filter(symbol=normalized_symbol).values('exchange').first()
        stock_exchange = str((stock_profile or {}).get('exchange') or '').strip().upper()
        if stock_exchange not in exchanges:
            return False

    group_names = set()
    if isinstance(scope_payload.get('market_group'), str) and str(scope_payload.get('market_group')).strip():
        group_names.add(str(scope_payload.get('market_group')).strip())
    group_names.update(
        str(item).strip()
        for item in (scope_payload.get('group_names') or scope_payload.get('market_groups') or [])
        if str(item).strip()
    )
    if group_names:
        in_group = SecuritiesGroup.objects.filter(name__in=group_names, items__symbol=normalized_symbol).exists()
        if not in_group:
            return False

    percentage = _coerce_int(_extract_first(scope_payload, ['percent', 'percentage', 'rollout_percent']), None)
    if percentage is not None:
        if percentage <= 0:
            return False
        if percentage < 100 and _stable_symbol_percent(normalized_symbol) >= percentage:
            return False

    return True


def get_live_celery_worker_names() -> dict:
    try:
        from celery import current_app

        responses = current_app.control.inspect(timeout=1).ping() or {}
        worker_names = sorted(str(name) for name in responses.keys())
        return {
            'ok': bool(worker_names),
            'workers': worker_names,
            'detail': f'workers={len(worker_names)}',
        }
    except Exception as exc:
        return {
            'ok': False,
            'workers': [],
            'detail': str(exc),
        }


def _normalize_maxrss_to_mb(raw_value) -> float | None:
    numeric_value = _coerce_float(raw_value)
    if numeric_value is None or numeric_value <= 0:
        return None
    if numeric_value >= 16 * 1024 * 1024:
        return round(numeric_value / (1024 * 1024), 2)
    return round(numeric_value / 1024, 2)


def _serialize_whale_config_version(version: WhaleConfigVersion | None) -> dict | None:
    if version is None:
        return None
    return {
        'id': version.id,
        'version_code': version.version_code,
        'status': version.status,
        'created_at': version.created_at.isoformat() if version.created_at else None,
        'approved_at': version.approved_at.isoformat() if version.approved_at else None,
        'activated_at': version.activated_at.isoformat() if version.activated_at else None,
    }


def _serialize_whale_config_rollout(rollout: WhaleConfigRollout | None) -> dict | None:
    if rollout is None:
        return None
    return {
        'rollout_id': rollout.id,
        'version_id': rollout.version_id,
        'version_code': rollout.version.version_code,
        'mode': rollout.mode,
        'status': rollout.status,
        'effective_from': rollout.effective_from.isoformat() if rollout.effective_from else None,
        'started_at': rollout.started_at.isoformat() if rollout.started_at else None,
        'finished_at': rollout.finished_at.isoformat() if rollout.finished_at else None,
        'note': rollout.note,
    }


def get_live_celery_worker_summary(active_rollout: WhaleConfigRollout | None = None) -> dict:
    ack_map = {}
    if active_rollout is not None:
        ack_map = {
            row.worker_name: row
            for row in active_rollout.worker_acks.order_by('worker_name')
        }

    ping_responses = {}
    stats_responses = {}
    detail = ''
    source = 'celery_inspect'
    try:
        from celery import current_app

        inspector = current_app.control.inspect(timeout=1)
        ping_responses = inspector.ping() or {}
        stats_responses = inspector.stats() or {}
        detail = f'workers={len(set(ping_responses.keys()) | set(stats_responses.keys()))}'
    except Exception as exc:
        source = 'ack_records'
        detail = str(exc)

    worker_names = sorted(set(ping_responses.keys()) | set(stats_responses.keys()) | set(ack_map.keys()))
    workers = []
    total_cpu_seconds = 0.0
    total_maxrss_mb = 0.0
    maxrss_samples = 0
    pool_process_count = 0
    acknowledged_count = 0
    pending_ack_count = 0
    stale_ack_count = 0
    reporting_stats_count = 0

    for worker_name in worker_names:
        ack_row = ack_map.get(worker_name)
        stats_payload = stats_responses.get(worker_name) if isinstance(stats_responses, dict) else None
        stats_payload = stats_payload if isinstance(stats_payload, dict) else {}
        rusage = stats_payload.get('rusage') if isinstance(stats_payload.get('rusage'), dict) else {}
        pool_payload = stats_payload.get('pool') if isinstance(stats_payload.get('pool'), dict) else {}
        live = worker_name in ping_responses or worker_name in stats_responses
        maxrss_mb = _normalize_maxrss_to_mb(rusage.get('maxrss'))
        user_cpu_seconds = _coerce_float(rusage.get('utime') or rusage.get('user_time'), 0.0) or 0.0
        system_cpu_seconds = _coerce_float(rusage.get('stime') or rusage.get('system_time'), 0.0) or 0.0
        raw_processes = pool_payload.get('processes')
        processes = [str(item) for item in raw_processes if str(item).strip()] if isinstance(raw_processes, (list, tuple)) else []
        if processes:
            pool_process_count += len(processes)

        stats_available = bool(stats_payload)
        if stats_available:
            reporting_stats_count += 1

        if maxrss_mb is not None:
            total_maxrss_mb += maxrss_mb
            maxrss_samples += 1

        total_cpu_seconds += user_cpu_seconds + system_cpu_seconds

        if ack_row and ack_row.acked and active_rollout and ack_row.worker_version and ack_row.worker_version != active_rollout.version.version_code:
            ack_state = 'stale'
            stale_ack_count += 1
        elif ack_row and ack_row.acked:
            ack_state = 'acked'
            acknowledged_count += 1
        elif ack_row:
            ack_state = 'pending'
            pending_ack_count += 1
        else:
            ack_state = 'untracked'

        workers.append({
            'worker_name': worker_name,
            'live': live,
            'ack_state': ack_state,
            'acked': bool(ack_row.acked) if ack_row else False,
            'acked_at': ack_row.acked_at.isoformat() if ack_row and ack_row.acked_at else None,
            'worker_version': ack_row.worker_version if ack_row else '',
            'stats_available': stats_available,
            'cpu_user_seconds': round(user_cpu_seconds, 2) if stats_available else None,
            'cpu_system_seconds': round(system_cpu_seconds, 2) if stats_available else None,
            'maxrss_mb': maxrss_mb,
            'pool_processes': processes,
            'pool_process_count': len(processes),
            'max_concurrency': _coerce_int(pool_payload.get('max-concurrency') or pool_payload.get('max_concurrency')),
            'details': ack_row.details if ack_row else '',
        })

    return {
        'ok': bool(worker_names),
        'source': source,
        'detail': detail,
        'live_count': sum(1 for worker in workers if worker['live']),
        'reporting_stats_count': reporting_stats_count,
        'ack_expected_count': len(ack_map),
        'acknowledged_count': acknowledged_count,
        'pending_ack_count': pending_ack_count,
        'stale_ack_count': stale_ack_count,
        'pool_process_count': pool_process_count,
        'total_cpu_seconds': round(total_cpu_seconds, 2) if workers else None,
        'total_maxrss_mb': round(total_maxrss_mb, 2) if maxrss_samples else None,
        'avg_maxrss_mb': round(total_maxrss_mb / maxrss_samples, 2) if maxrss_samples else None,
        'workers': workers,
    }


def ensure_rollout_worker_ack_records(
    rollout: WhaleConfigRollout,
    *,
    worker_names: list[str] | None = None,
) -> dict:
    live_workers = worker_names
    detail = ''
    if live_workers is None:
        worker_result = get_live_celery_worker_names()
        live_workers = worker_result['workers']
        detail = worker_result['detail']

    created = 0
    for worker_name in sorted(set(str(name).strip() for name in (live_workers or []) if str(name).strip())):
        _, was_created = WhaleConfigWorkerAck.objects.get_or_create(
            rollout=rollout,
            worker_name=worker_name,
            defaults={
                'worker_version': '',
                'acked': False,
                'details': 'awaiting_ack',
            },
        )
        if was_created:
            created += 1

    return {
        'workers': sorted(set(live_workers or [])),
        'created': created,
        'detail': detail,
    }


def record_whale_config_worker_ack(
    rollout: WhaleConfigRollout,
    *,
    worker_name: str,
    worker_version: str = '',
    acked: bool = True,
    details: str = '',
):
    acked_at = timezone.now() if acked else None
    ack, _ = WhaleConfigWorkerAck.objects.update_or_create(
        rollout=rollout,
        worker_name=worker_name,
        defaults={
            'worker_version': worker_version or '',
            'acked': acked,
            'acked_at': acked_at,
            'details': details or ('acknowledged' if acked else 'awaiting_ack'),
        },
    )
    return ack


def build_rollout_propagation_snapshot(rollout: WhaleConfigRollout) -> dict:
    ack_rows = list(rollout.worker_acks.order_by('worker_name'))
    expected_workers = [row.worker_name for row in ack_rows]
    acked_workers = [row.worker_name for row in ack_rows if row.acked]
    missing_workers = [row.worker_name for row in ack_rows if not row.acked]
    stale_workers = [
        row.worker_name
        for row in ack_rows
        if row.acked and row.worker_version and row.worker_version != rollout.version.version_code
    ]

    expected_count = len(expected_workers)
    acked_count = len(acked_workers)
    healthy = expected_count > 0 and acked_count == expected_count and not stale_workers
    if healthy:
        signal = 'green'
    elif acked_count > 0 and not stale_workers:
        signal = 'amber'
    else:
        signal = 'red'

    summary = f'{acked_count}/{expected_count} worker ACK'
    if stale_workers:
        summary = f'{summary}; stale={len(stale_workers)}'

    return {
        'healthy': healthy,
        'signal': signal,
        'expected_count': expected_count,
        'acked_count': acked_count,
        'missing_count': len(missing_workers),
        'stale_count': len(stale_workers),
        'expected_workers': expected_workers,
        'acked_workers': acked_workers,
        'missing_workers': missing_workers,
        'stale_workers': stale_workers,
        'summary': summary,
    }


def refresh_rollout_propagation_status(rollout: WhaleConfigRollout) -> dict:
    snapshot = build_rollout_propagation_snapshot(rollout)

    if rollout.mode == WhaleConfigRollout.ModeChoices.SCHEDULED and rollout.started_at is None:
        return snapshot

    new_status = rollout.status
    finished_at = rollout.finished_at
    if snapshot['healthy']:
        new_status = WhaleConfigRollout.StatusChoices.COMPLETED
        finished_at = finished_at or timezone.now()
    elif snapshot['expected_count'] == 0:
        new_status = WhaleConfigRollout.StatusChoices.FAILED
        finished_at = timezone.now()
    else:
        new_status = WhaleConfigRollout.StatusChoices.RUNNING
        finished_at = None

    update_fields = []
    if rollout.status != new_status:
        rollout.status = new_status
        update_fields.append('status')
    if rollout.finished_at != finished_at:
        rollout.finished_at = finished_at
        update_fields.append('finished_at')
    if update_fields:
        rollout.save(update_fields=update_fields)

    return snapshot


def initialize_whale_config_rollout(
    version: WhaleConfigVersion,
    *,
    initiated_by=None,
    mode: str = WhaleConfigRollout.ModeChoices.NOW,
    effective_from=None,
    canary_scope_json: dict | None = None,
    note: str = '',
    worker_names: list[str] | None = None,
) -> tuple[WhaleConfigRollout, dict]:
    normalized_mode = str(mode or WhaleConfigRollout.ModeChoices.NOW).strip().lower()
    status = WhaleConfigRollout.StatusChoices.PENDING
    started_at = None
    if normalized_mode in (WhaleConfigRollout.ModeChoices.NOW, WhaleConfigRollout.ModeChoices.CANARY):
        status = WhaleConfigRollout.StatusChoices.RUNNING
        started_at = timezone.now()

    with db_transaction.atomic():
        rollout = WhaleConfigRollout.objects.create(
            version=version,
            mode=normalized_mode,
            status=status,
            initiated_by=initiated_by if getattr(initiated_by, 'pk', None) else None,
            effective_from=effective_from,
            canary_scope_json=canary_scope_json or {},
            note=note or '',
            started_at=started_at,
        )
        ensure_rollout_worker_ack_records(rollout, worker_names=worker_names)
        snapshot = refresh_rollout_propagation_status(rollout)

    return rollout, snapshot


def get_latest_rollout_for_version(version: WhaleConfigVersion):
    return version.rollouts.order_by('-created_at').first()


def get_active_runtime_rollout_for_symbol(symbol: str | None = None):
    now = timezone.now()
    rollout_queryset = (
        WhaleConfigRollout.objects
        .select_related('version')
        .filter(
            status__in=[
                WhaleConfigRollout.StatusChoices.PENDING,
                WhaleConfigRollout.StatusChoices.RUNNING,
                WhaleConfigRollout.StatusChoices.COMPLETED,
            ]
        )
        .exclude(effective_from__gt=now)
        .order_by('-started_at', '-created_at')
    )

    if symbol:
        normalized_symbol = str(symbol).strip().upper()
        for rollout in rollout_queryset.filter(mode=WhaleConfigRollout.ModeChoices.CANARY):
            if symbol_matches_canary_scope(normalized_symbol, rollout.canary_scope_json):
                return rollout

    active_version = get_active_whale_config_version()
    if not active_version:
        return None
    return get_latest_rollout_for_version(active_version)


def build_whale_runtime_score_config(config_json: dict | None) -> dict:
    base_config = resolve_whale_score_config()
    snapshot = normalize_whale_config_payload(config_json)
    weights = snapshot.get('weights') or base_config.get('weights') or {}
    total_weight = sum(max(float(value), 0.0) for value in weights.values())
    if total_weight > 0:
        normalized_weights = {key: max(float(value), 0.0) / total_weight for key, value in weights.items()}
    else:
        normalized_weights = dict(base_config.get('weights') or {})

    score_config = dict(base_config)
    score_config['weights'] = normalized_weights
    if isinstance(config_json, dict):
        score_config['version'] = str(
            config_json.get('version') or config_json.get('weights_version') or base_config.get('version') or 'weights-v1'
        )
    else:
        score_config['version'] = str(base_config.get('version') or 'weights-v1')
    return score_config


def build_whale_runtime_thresholds(snapshot: dict) -> list[float]:
    thresholds = []
    shark_threshold = _coerce_float(snapshot.get('shark_threshold_million'))
    whale_threshold = _coerce_float(snapshot.get('whale_threshold_million'))
    for threshold_million in [shark_threshold, whale_threshold]:
        if threshold_million and threshold_million > 0:
            thresholds.append(float(threshold_million) * 1_000_000)
    return sorted(set(thresholds))


def resolve_whale_runtime_config(
    *,
    symbol: str | None = None,
    worker_name: str | None = None,
    source: str = 'runtime',
) -> dict:
    rollout = get_active_runtime_rollout_for_symbol(symbol)
    version = None
    config_json = {}
    mode = 'default'

    if rollout is not None:
        version = rollout.version
        config_json = rollout.version.config_json if isinstance(rollout.version.config_json, dict) else {}
        mode = rollout.mode
    else:
        active_version = get_active_whale_config_version()
        if active_version is not None:
            version = active_version
            config_json = active_version.config_json if isinstance(active_version.config_json, dict) else {}
            mode = 'active'

    snapshot = normalize_whale_config_payload(config_json)
    thresholds = build_whale_runtime_thresholds(snapshot)
    score_config = build_whale_runtime_score_config(config_json)

    if rollout is not None and worker_name:
        record_whale_config_worker_ack(
            rollout,
            worker_name=worker_name,
            worker_version=version.version_code if version else '',
            acked=True,
            details=f'loaded_via_{source}',
        )
        refresh_rollout_propagation_status(rollout)

    return {
        'rollout': rollout,
        'rollout_id': rollout.id if rollout else None,
        'version': version,
        'version_code': version.version_code if version else 'default-runtime',
        'mode': mode,
        'snapshot': snapshot,
        'thresholds_vnd': thresholds,
        'score_config': score_config,
    }


def activate_whale_config_version(
    version: WhaleConfigVersion,
    *,
    initiated_by=None,
    rollout_mode: str = WhaleConfigRollout.ModeChoices.NOW,
    effective_from=None,
    canary_scope_json: dict | None = None,
    note: str = '',
    existing_rollout: WhaleConfigRollout | None = None,
    worker_names: list[str] | None = None,
) -> tuple[WhaleConfigRollout, dict]:
    now = timezone.now()
    version.status = WhaleConfigVersion.StatusChoices.ACTIVE
    if getattr(initiated_by, 'pk', None):
        version.approved_by = initiated_by
    if version.approved_at is None:
        version.approved_at = now
    version.activated_at = now
    version.save(update_fields=['status', 'approved_by', 'approved_at', 'activated_at', 'updated_at'])

    WhaleConfigVersion.objects.exclude(pk=version.pk).filter(
        status=WhaleConfigVersion.StatusChoices.ACTIVE
    ).update(status=WhaleConfigVersion.StatusChoices.ARCHIVED, updated_at=now)

    if existing_rollout is None:
        rollout, snapshot = initialize_whale_config_rollout(
            version,
            initiated_by=initiated_by,
            mode=rollout_mode,
            effective_from=effective_from,
            canary_scope_json=canary_scope_json,
            note=note,
            worker_names=worker_names,
        )
    else:
        rollout = existing_rollout
        update_fields = []
        if rollout.status != WhaleConfigRollout.StatusChoices.RUNNING:
            rollout.status = WhaleConfigRollout.StatusChoices.RUNNING
            update_fields.append('status')
        if rollout.started_at is None:
            rollout.started_at = now
            update_fields.append('started_at')
        if update_fields:
            rollout.save(update_fields=update_fields)
        ensure_rollout_worker_ack_records(rollout, worker_names=worker_names)
        snapshot = refresh_rollout_propagation_status(rollout)

    return rollout, snapshot


def activate_due_scheduled_whale_config_rollouts() -> list[dict]:
    due_rollouts = list(
        WhaleConfigRollout.objects
        .select_related('version')
        .filter(
            mode=WhaleConfigRollout.ModeChoices.SCHEDULED,
            status=WhaleConfigRollout.StatusChoices.PENDING,
            effective_from__isnull=False,
            effective_from__lte=timezone.now(),
        )
        .order_by('effective_from', 'created_at')
    )

    activated = []
    for rollout in due_rollouts:
        activation_rollout, snapshot = activate_whale_config_version(
            rollout.version,
            initiated_by=rollout.initiated_by,
            rollout_mode=WhaleConfigRollout.ModeChoices.SCHEDULED,
            effective_from=rollout.effective_from,
            canary_scope_json=rollout.canary_scope_json,
            note=rollout.note or 'scheduled_activation',
            existing_rollout=rollout,
        )
        activated.append(
            {
                'rollout_id': activation_rollout.id,
                'version_code': activation_rollout.version.version_code,
                'signal': snapshot['signal'],
                'summary': snapshot['summary'],
            }
        )
    return activated


def get_whale_config_propagation_overview() -> dict | None:
    active_rollout = get_active_runtime_rollout_for_symbol()
    if not active_rollout:
        return None

    snapshot = build_rollout_propagation_snapshot(active_rollout)
    return {
        'rollout_id': active_rollout.id,
        'version_code': active_rollout.version.version_code,
        'mode': active_rollout.mode,
        'status': active_rollout.status,
        **snapshot,
    }


def get_whale_advisory_alert_overview(rollout: WhaleConfigRollout | None = None) -> dict:
    observed_at = timezone.now()
    last_10m_start = observed_at - timedelta(minutes=10)
    last_5m_start = observed_at - timedelta(minutes=5)
    advisory_queryset = WhaleAdvisory.objects.filter(created_at__gte=last_10m_start)
    target_symbols = []
    scope = 'global'

    if rollout is not None:
        target_symbols = resolve_rollout_target_symbols(
            rollout,
            limit=int(getattr(settings, 'MISSION_CONTROL_ANOMALY_SYMBOL_SCAN_LIMIT', 200)),
        )
        if target_symbols:
            advisory_queryset = advisory_queryset.filter(symbol__in=target_symbols)
            scope = 'rollout_target'

    last_5m_queryset = advisory_queryset.filter(created_at__gte=last_5m_start)
    latest_advisory = advisory_queryset.order_by('-created_at').values(
        'symbol',
        'side',
        'matched_value',
        'created_at',
    ).first()

    return {
        'scope': scope,
        'observed_at': observed_at.isoformat(),
        'target_symbol_count': len(target_symbols),
        'last_5m_count': last_5m_queryset.count(),
        'last_10m_count': advisory_queryset.count(),
        'unique_symbols_last_5m': last_5m_queryset.values('symbol').distinct().count(),
        'unique_symbols_last_10m': advisory_queryset.values('symbol').distinct().count(),
        'latest_advisory': (
            {
                'symbol': latest_advisory['symbol'],
                'side': latest_advisory['side'],
                'matched_value': float(latest_advisory['matched_value'] or 0.0),
                'created_at': latest_advisory['created_at'].isoformat() if latest_advisory.get('created_at') else None,
            }
            if latest_advisory else None
        ),
    }


def resolve_rollout_target_symbols(rollout: WhaleConfigRollout, *, limit: int | None = None) -> list[str]:
    if rollout.mode == WhaleConfigRollout.ModeChoices.CANARY:
        scope_payload = rollout.canary_scope_json if isinstance(rollout.canary_scope_json, dict) else {}
        explicit_symbols = _normalize_symbol_list(scope_payload.get('symbols'))
        if explicit_symbols:
            symbols = explicit_symbols
        else:
            profiles = StockProfile.objects.all().values_list('symbol', flat=True)
            symbols = [symbol for symbol in profiles if symbol_matches_canary_scope(symbol, scope_payload)]
    else:
        symbols = list(
            StockProfile.objects.order_by('symbol').values_list('symbol', flat=True)
        )

    normalized = _normalize_symbol_list(symbols)
    if limit is not None:
        return normalized[: max(int(limit), 0)]
    return normalized


def build_whale_rollout_anomaly_snapshot(
    rollout: WhaleConfigRollout,
    *,
    now=None,
) -> dict:
    observed_at = now or timezone.now()
    lookback_minutes = max(int(getattr(settings, 'MISSION_CONTROL_ANOMALY_LOOKBACK_MINUTES', 5)), 1)
    baseline_minutes = max(int(getattr(settings, 'MISSION_CONTROL_ANOMALY_BASELINE_MINUTES', 30)), lookback_minutes)
    min_tick_events = max(int(getattr(settings, 'MISSION_CONTROL_ANOMALY_MIN_TICK_EVENTS', 3)), 1)
    min_advisories = max(int(getattr(settings, 'MISSION_CONTROL_ANOMALY_MIN_ADVISORIES', 1)), 1)
    spike_ratio = max(float(getattr(settings, 'MISSION_CONTROL_ANOMALY_SPIKE_RATIO', 3.0)), 1.0)
    absolute_notional_vnd = max(float(getattr(settings, 'MISSION_CONTROL_ANOMALY_ABSOLUTE_NOTIONAL_VND', 5_000_000_000)), 0.0)
    advisory_spike_ratio = max(float(getattr(settings, 'MISSION_CONTROL_ANOMALY_ADVISORY_SPIKE_RATIO', 2.0)), 1.0)

    target_symbols = resolve_rollout_target_symbols(
        rollout,
        limit=int(getattr(settings, 'MISSION_CONTROL_ANOMALY_SYMBOL_SCAN_LIMIT', 200)),
    )
    snapshot = normalize_whale_config_payload(rollout.version.config_json)
    whale_threshold_vnd = float(snapshot['whale_threshold_million']) * 1_000_000
    current_window_start = observed_at - timedelta(minutes=lookback_minutes)
    baseline_window_start = current_window_start - timedelta(minutes=baseline_minutes)

    empty_metrics = {
        'current_tick_count': 0,
        'baseline_tick_count': 0,
        'current_tick_notional': 0.0,
        'baseline_tick_notional': 0.0,
        'current_advisory_count': 0,
        'baseline_advisory_count': 0,
        'current_tick_rate': 0.0,
        'baseline_tick_rate': 0.0,
        'current_advisory_rate': 0.0,
        'baseline_advisory_rate': 0.0,
        'tick_rate_ratio': None,
        'advisory_rate_ratio': None,
        'tick_notional_ratio': None,
    }
    if not target_symbols:
        return {
            'rollout_id': rollout.id,
            'version_code': rollout.version.version_code,
            'mode': rollout.mode,
            'status': rollout.status,
            'observed_at': observed_at.isoformat(),
            'healthy': True,
            'should_auto_revert': False,
            'reason_codes': [],
            'summary': 'No target symbols available for anomaly scan.',
            'target_symbols': [],
            'threshold_vnd': whale_threshold_vnd,
            **empty_metrics,
        }

    tick_queryset = (
        IntradayTick.objects
        .filter(
            symbol__in=target_symbols,
            created_at__gte=baseline_window_start,
            created_at__lte=observed_at,
        )
        .annotate(matched_value=ExpressionWrapper(F('price') * F('volume'), output_field=FloatField()))
        .filter(matched_value__gte=whale_threshold_vnd)
    )
    current_ticks = tick_queryset.filter(created_at__gte=current_window_start)
    baseline_ticks = tick_queryset.filter(created_at__lt=current_window_start)

    current_tick_count = current_ticks.count()
    baseline_tick_count = baseline_ticks.count()
    current_tick_notional = float(current_ticks.aggregate(total=Sum('matched_value')).get('total') or 0.0)
    baseline_tick_notional = float(baseline_ticks.aggregate(total=Sum('matched_value')).get('total') or 0.0)

    advisory_queryset = WhaleAdvisory.objects.filter(
        symbol__in=target_symbols,
        created_at__gte=baseline_window_start,
        created_at__lte=observed_at,
    )
    current_advisory_count = advisory_queryset.filter(created_at__gte=current_window_start).count()
    baseline_advisory_count = advisory_queryset.filter(created_at__lt=current_window_start).count()

    current_tick_rate = current_tick_count / float(lookback_minutes)
    baseline_tick_rate = baseline_tick_count / float(baseline_minutes)
    current_advisory_rate = current_advisory_count / float(lookback_minutes)
    baseline_advisory_rate = baseline_advisory_count / float(baseline_minutes)

    tick_rate_ratio = None if baseline_tick_rate <= 0 else round(current_tick_rate / baseline_tick_rate, 2)
    advisory_rate_ratio = None if baseline_advisory_rate <= 0 else round(current_advisory_rate / baseline_advisory_rate, 2)
    tick_notional_ratio = None if baseline_tick_notional <= 0 else round(current_tick_notional / baseline_tick_notional, 2)

    reason_codes = []
    if current_tick_count >= min_tick_events:
        if baseline_tick_rate <= 0:
            if current_tick_notional >= absolute_notional_vnd:
                reason_codes.append('tick_bootstrap_spike')
        elif current_tick_rate >= baseline_tick_rate * spike_ratio:
            reason_codes.append('tick_rate_spike')

    if current_tick_notional >= absolute_notional_vnd:
        if baseline_tick_notional <= 0 or current_tick_notional >= baseline_tick_notional * spike_ratio:
            reason_codes.append('tick_notional_spike')

    if current_advisory_count >= min_advisories:
        if baseline_advisory_rate <= 0 and current_advisory_count >= max(min_advisories, 2):
            reason_codes.append('advisory_bootstrap_spike')
        elif baseline_advisory_rate > 0 and current_advisory_rate >= baseline_advisory_rate * advisory_spike_ratio:
            reason_codes.append('advisory_rate_spike')

    deduped_reason_codes = sorted(set(reason_codes))
    healthy = not deduped_reason_codes
    return {
        'rollout_id': rollout.id,
        'version_code': rollout.version.version_code,
        'mode': rollout.mode,
        'status': rollout.status,
        'observed_at': observed_at.isoformat(),
        'healthy': healthy,
        'should_auto_revert': bool(deduped_reason_codes),
        'reason_codes': deduped_reason_codes,
        'summary': (
            'Anomaly detected: ' + ', '.join(deduped_reason_codes)
            if deduped_reason_codes else 'No anomaly detected.'
        ),
        'target_symbols': target_symbols,
        'threshold_vnd': whale_threshold_vnd,
        'current_tick_count': current_tick_count,
        'baseline_tick_count': baseline_tick_count,
        'current_tick_notional': round(current_tick_notional, 2),
        'baseline_tick_notional': round(baseline_tick_notional, 2),
        'current_advisory_count': current_advisory_count,
        'baseline_advisory_count': baseline_advisory_count,
        'current_tick_rate': round(current_tick_rate, 3),
        'baseline_tick_rate': round(baseline_tick_rate, 3),
        'current_advisory_rate': round(current_advisory_rate, 3),
        'baseline_advisory_rate': round(baseline_advisory_rate, 3),
        'tick_rate_ratio': tick_rate_ratio,
        'advisory_rate_ratio': advisory_rate_ratio,
        'tick_notional_ratio': tick_notional_ratio,
    }


def get_latest_whale_config_anomaly_overview() -> dict | None:
    rollout = (
        WhaleConfigRollout.objects
        .select_related('version')
        .filter(
            status__in=[
                WhaleConfigRollout.StatusChoices.RUNNING,
                WhaleConfigRollout.StatusChoices.COMPLETED,
            ]
        )
        .exclude(status=WhaleConfigRollout.StatusChoices.ROLLED_BACK)
        .order_by('-started_at', '-created_at')
        .first()
    )
    if rollout is None:
        return None
    return build_whale_rollout_anomaly_snapshot(rollout)


def get_whale_config_dashboard_overview() -> dict:
    active_version = get_active_whale_config_version()
    active_rollout = get_active_runtime_rollout_for_symbol()
    pending_rollout = (
        WhaleConfigRollout.objects
        .select_related('version')
        .filter(status=WhaleConfigRollout.StatusChoices.PENDING)
        .order_by('effective_from', 'created_at')
        .first()
    )
    propagation = get_whale_config_propagation_overview()
    anomaly = get_latest_whale_config_anomaly_overview()

    return {
        'generated_at': timezone.now().isoformat(),
        'active_version': _serialize_whale_config_version(active_version),
        'active_rollout': _serialize_whale_config_rollout(active_rollout),
        'pending_rollout': _serialize_whale_config_rollout(pending_rollout),
        'propagation': propagation,
        'anomaly': anomaly,
        'alerts': get_whale_advisory_alert_overview(active_rollout),
        'worker_summary': get_live_celery_worker_summary(active_rollout),
    }


def find_previous_stable_whale_config_version(version: WhaleConfigVersion) -> WhaleConfigVersion | None:
    candidate_statuses = [
        WhaleConfigVersion.StatusChoices.ARCHIVED,
        WhaleConfigVersion.StatusChoices.ROLLED_BACK,
        WhaleConfigVersion.StatusChoices.ACTIVE,
        WhaleConfigVersion.StatusChoices.APPROVED,
    ]
    return (
        WhaleConfigVersion.objects
        .exclude(pk=version.pk)
        .filter(status__in=candidate_statuses)
        .order_by('-activated_at', '-approved_at', '-created_at')
        .first()
    )


def notify_whale_config_auto_revert(
    *,
    rollout: WhaleConfigRollout,
    fallback_version: WhaleConfigVersion | None,
    anomaly_snapshot: dict,
) -> dict:
    recipients = [
        email.strip()
        for email in User.objects.filter(is_active=True, is_staff=True).values_list('email', flat=True)
        if str(email or '').strip()
    ]
    recipients = sorted(set(recipients))
    if not recipients:
        return {'sent': False, 'recipients': [], 'detail': 'no_staff_recipients'}

    fallback_label = fallback_version.version_code if fallback_version else 'none'
    subject = f'[VNInvest] Auto-revert Whale config {rollout.version.version_code}'
    message = (
        'Mission Control da auto-revert rollout do anomaly detection.\n\n'
        f'Rollout ID: {rollout.id}\n'
        f'Version bi revert: {rollout.version.version_code}\n'
        f'Fallback version: {fallback_label}\n'
        f'Mode: {rollout.mode}\n'
        f'Ly do: {", ".join(anomaly_snapshot.get("reason_codes") or []) or "n/a"}\n'
        f'Summary: {anomaly_snapshot.get("summary") or "n/a"}\n'
        f'Observed at: {anomaly_snapshot.get("observed_at") or "n/a"}\n'
    )
    try:
        send_system_email(subject=subject, message=message, recipient_list=recipients, fail_silently=False)
        return {'sent': True, 'recipients': recipients, 'detail': 'email_sent'}
    except Exception as exc:
        logger.warning('Mission Control auto-revert notification failed for rollout=%s: %s', rollout.id, exc)
        return {'sent': False, 'recipients': recipients, 'detail': str(exc)}


def auto_revert_whale_config_rollout(
    rollout: WhaleConfigRollout,
    *,
    initiated_by=None,
    anomaly_snapshot: dict | None = None,
) -> dict:
    if rollout.status == WhaleConfigRollout.StatusChoices.ROLLED_BACK:
        return {
            'status': 'skipped',
            'reason': 'already_rolled_back',
            'rollout_id': rollout.id,
            'version_code': rollout.version.version_code,
        }

    fallback_version = find_previous_stable_whale_config_version(rollout.version)
    if fallback_version is None:
        return {
            'status': 'skipped',
            'reason': 'no_fallback_version',
            'rollout_id': rollout.id,
            'version_code': rollout.version.version_code,
        }

    snapshot = anomaly_snapshot or build_whale_rollout_anomaly_snapshot(rollout)
    actor = initiated_by if getattr(initiated_by, 'pk', None) else rollout.initiated_by
    with db_transaction.atomic():
        rollout.status = WhaleConfigRollout.StatusChoices.ROLLED_BACK
        rollout.finished_at = rollout.finished_at or timezone.now()
        existing_note = (rollout.note or '').strip()
        rollback_note = f'auto_reverted:{fallback_version.version_code}'
        rollout.note = f'{existing_note}\n{rollback_note}'.strip()
        rollout.save(update_fields=['status', 'finished_at', 'note'])

        if rollout.version.status == WhaleConfigVersion.StatusChoices.ACTIVE:
            rollout.version.status = WhaleConfigVersion.StatusChoices.ROLLED_BACK
            rollout.version.save(update_fields=['status', 'updated_at'])

        activation_rollout, propagation = activate_whale_config_version(
            fallback_version,
            initiated_by=actor,
            rollout_mode=WhaleConfigRollout.ModeChoices.NOW,
            note=f'auto_revert_from_rollout#{rollout.id}',
        )
        notification = notify_whale_config_auto_revert(
            rollout=rollout,
            fallback_version=fallback_version,
            anomaly_snapshot=snapshot,
        )
        WhaleConfigAuditLog.objects.create(
            actor=actor if getattr(actor, 'pk', None) else None,
            action='rollback',
            version=rollout.version,
            rollout=rollout,
            reason='auto_revert_from_anomaly_detection',
            before_json={
                'version_status': WhaleConfigVersion.StatusChoices.ACTIVE,
                'rollout_status': WhaleConfigRollout.StatusChoices.RUNNING,
            },
            after_json={
                'version_status': rollout.version.status,
                'rollout_status': rollout.status,
                'fallback_version': fallback_version.version_code,
                'activation_rollout_id': activation_rollout.id,
                'anomaly': snapshot,
                'propagation': propagation,
                'notification': notification,
            },
        )

    return {
        'status': 'ok',
        'rollout_id': rollout.id,
        'version_code': rollout.version.version_code,
        'fallback_version_code': fallback_version.version_code,
        'activation_rollout_id': activation_rollout.id,
        'anomaly': snapshot,
        'propagation': propagation,
        'notification': notification,
    }


def monitor_whale_config_rollout_anomalies(*, auto_revert: bool = True) -> list[dict]:
    monitored_rollouts = list(
        WhaleConfigRollout.objects
        .select_related('version', 'initiated_by')
        .filter(status__in=[WhaleConfigRollout.StatusChoices.RUNNING, WhaleConfigRollout.StatusChoices.COMPLETED])
        .exclude(status=WhaleConfigRollout.StatusChoices.ROLLED_BACK)
        .order_by('-started_at', '-created_at')[:10]
    )

    results = []
    for rollout in monitored_rollouts:
        anomaly = build_whale_rollout_anomaly_snapshot(rollout)
        result = {
            'rollout_id': rollout.id,
            'version_code': rollout.version.version_code,
            'mode': rollout.mode,
            'status': rollout.status,
            'anomaly': anomaly,
            'auto_reverted': False,
        }
        if auto_revert and anomaly['should_auto_revert']:
            rollback_result = auto_revert_whale_config_rollout(
                rollout,
                initiated_by=rollout.initiated_by,
                anomaly_snapshot=anomaly,
            )
            result['auto_reverted'] = rollback_result.get('status') == 'ok'
            result['rollback'] = rollback_result
        results.append(result)
    return results


def normalize_whale_config_payload(config_json: dict | None) -> dict:
    payload = dict(config_json or {}) if isinstance(config_json, dict) else {}
    score_config = resolve_whale_score_config()

    default_whale_threshold_m = max(
        int(getattr(settings, 'REALTIME_DEFAULT_WHALE_THRESHOLD', 500_000_000) / 1_000_000),
        1,
    )
    whale_threshold_m = _coerce_float(
        _extract_first(payload, ['whale_threshold_million', 'whale_threshold', 'whale_alert_threshold', 'threshold']),
        float(default_whale_threshold_m),
    )
    shark_threshold_m = _coerce_float(
        _extract_first(payload, ['shark_threshold_million', 'shark_threshold']),
        round(max((whale_threshold_m or default_whale_threshold_m) / 4.0, 1.0), 2),
    )
    cooldown_seconds = _coerce_int(
        _extract_first(payload, ['cooldown_seconds', 'cooldown', 'alert_cooldown_seconds']),
        int(getattr(settings, 'WHALE_ADVISORY_COOLDOWN_SECONDS', 900)),
    )
    rate_limit_per_minute = _coerce_int(
        _extract_first(payload, ['rate_limit_per_minute', 'rate_limit', 'requests_per_minute']),
        60,
    )
    max_symbols = _coerce_int(
        _extract_first(payload, ['max_symbols', 'coverage_limit', 'symbol_limit']),
        50,
    )
    coverage_mode = str(
        _extract_first(payload, ['coverage_mode', 'scope_mode', 'symbol_scope_mode'], 'tracked') or 'tracked'
    ).strip().lower()

    weights = dict((score_config.get('weights') or {}))
    raw_weights = payload.get('weights')
    if isinstance(raw_weights, dict):
        for key, value in raw_weights.items():
            numeric_value = _coerce_float(value)
            if numeric_value is not None:
                weights[key] = round(numeric_value, 6)

    return {
        'whale_threshold_million': round(float(whale_threshold_m or default_whale_threshold_m), 2),
        'shark_threshold_million': round(float(shark_threshold_m or 0), 2),
        'cooldown_seconds': int(cooldown_seconds or 0),
        'coverage_mode': coverage_mode,
        'max_symbols': int(max_symbols or 0),
        'rate_limit_per_minute': int(rate_limit_per_minute or 0),
        'weights': weights,
    }


def build_whale_config_diff_preview(current_config: dict | None, next_config: dict | None) -> list[dict]:
    current_snapshot = normalize_whale_config_payload(current_config)
    next_snapshot = normalize_whale_config_payload(next_config)
    monitored_fields = [
        ('whale_threshold_million', 'Whale threshold (trieu VND)'),
        ('shark_threshold_million', 'Shark threshold (trieu VND)'),
        ('cooldown_seconds', 'Cooldown (giay)'),
        ('coverage_mode', 'Coverage mode'),
        ('max_symbols', 'Max symbols'),
        ('rate_limit_per_minute', 'Rate limit (/phut)'),
        ('weights', 'Weights'),
    ]

    diff_items = []
    for key, label in monitored_fields:
        previous = current_snapshot.get(key)
        current = next_snapshot.get(key)
        if previous == current:
            continue
        diff_items.append(
            {
                'key': key,
                'label': label,
                'old': _format_preview_value(previous),
                'new': _format_preview_value(current),
            }
        )
    return diff_items


def validate_whale_config_guardrails(
    config_json: dict | None,
    *,
    rollout_mode: str = 'draft',
    canary_scope_json: dict | None = None,
    effective_from=None,
) -> dict:
    snapshot = normalize_whale_config_payload(config_json)
    errors = []
    warnings = []

    min_whale_threshold = int(getattr(settings, 'MISSION_CONTROL_MIN_WHALE_THRESHOLD_MILLION', 100))
    min_shark_threshold = int(getattr(settings, 'MISSION_CONTROL_MIN_SHARK_THRESHOLD_MILLION', 25))
    min_cooldown = int(getattr(settings, 'MISSION_CONTROL_MIN_COOLDOWN_SECONDS', 60))
    max_cooldown = int(getattr(settings, 'MISSION_CONTROL_MAX_COOLDOWN_SECONDS', 7200))
    min_rate_limit = int(getattr(settings, 'MISSION_CONTROL_MIN_RATE_LIMIT_PER_MINUTE', 10))
    max_rate_limit = int(getattr(settings, 'MISSION_CONTROL_MAX_RATE_LIMIT_PER_MINUTE', 600))
    max_canary_symbols = int(getattr(settings, 'MISSION_CONTROL_MAX_CANARY_SYMBOLS', 30))
    max_canary_percent = int(getattr(settings, 'MISSION_CONTROL_MAX_CANARY_PERCENT', 50))

    whale_threshold = snapshot['whale_threshold_million']
    shark_threshold = snapshot['shark_threshold_million']
    cooldown_seconds = snapshot['cooldown_seconds']
    rate_limit_per_minute = snapshot['rate_limit_per_minute']

    if whale_threshold < min_whale_threshold:
        errors.append(
            f'Whale threshold phai >= {min_whale_threshold} trieu VND, hien tai la {whale_threshold}.'
        )
    if shark_threshold < min_shark_threshold:
        errors.append(
            f'Shark threshold phai >= {min_shark_threshold} trieu VND, hien tai la {shark_threshold}.'
        )
    if shark_threshold >= whale_threshold:
        errors.append('Shark threshold phai nho hon whale threshold de tranh dao nguoc muc canh bao.')
    if cooldown_seconds < min_cooldown or cooldown_seconds > max_cooldown:
        errors.append(
            f'Cooldown phai nam trong [{min_cooldown}, {max_cooldown}] giay, hien tai la {cooldown_seconds}.'
        )
    if rate_limit_per_minute < min_rate_limit or rate_limit_per_minute > max_rate_limit:
        errors.append(
            f'Rate limit phai nam trong [{min_rate_limit}, {max_rate_limit}] / phut, hien tai la {rate_limit_per_minute}.'
        )

    weights = snapshot.get('weights') or {}
    if not weights:
        errors.append('Weights khong duoc de trong.')
    else:
        total_weight = round(sum(float(value) for value in weights.values()), 6)
        if total_weight <= 0:
            errors.append('Tong weights phai > 0 de scoring hoat dong dung.')
        elif abs(total_weight - 1.0) > 0.05:
            warnings.append(
                f'Tong weights dang la {total_weight}; he thong co the tu normalize khi runtime. Nen dua ve gan 1.0.'
            )

    normalized_mode = str(rollout_mode or 'draft').strip().lower()
    if normalized_mode == 'scheduled' and effective_from is None:
        errors.append('Rollout scheduled bat buoc phai co thoi diem effective_from.')

    if normalized_mode == 'canary':
        scope_payload = canary_scope_json if isinstance(canary_scope_json, dict) else {}
        symbols = scope_payload.get('symbols')
        if isinstance(symbols, list) and len(symbols) > max_canary_symbols:
            errors.append(
                f'Canary scope chi duoc toi da {max_canary_symbols} symbols, hien tai la {len(symbols)}.'
            )
        percentage = _coerce_int(
            _extract_first(scope_payload, ['percent', 'percentage', 'rollout_percent']),
            None,
        )
        if percentage is not None and percentage > max_canary_percent:
            errors.append(
                f'Canary rollout chi duoc toi da {max_canary_percent}%, hien tai la {percentage}%.'
            )

    return {
        'snapshot': snapshot,
        'errors': errors,
        'warnings': warnings,
    }


def _ping_redis_url(redis_url: str) -> tuple[bool, str]:
    try:
        import redis as redis_lib

        client = redis_lib.from_url(redis_url, socket_connect_timeout=1)
        client.ping()
        return True, 'ok'
    except Exception as exc:
        return False, str(exc)


def check_whale_config_dependencies(*, rollout_mode: str = 'now') -> dict:
    checks = {}
    warnings = []
    blocking_issues = []
    should_block_dependencies = str(rollout_mode or 'now').strip().lower() == 'now'
    realtime_enabled = bool(getattr(settings, 'REALTIME_ENABLED', False))

    try:
        import vnstock  # noqa: F401

        checks['data_provider'] = {'ok': True, 'detail': 'vnstock import ok'}
    except Exception as exc:
        checks['data_provider'] = {'ok': False, 'detail': str(exc)}

    realtime_redis_ok, realtime_redis_detail = _ping_redis_url(
        getattr(settings, 'REALTIME_REDIS_URL', 'redis://localhost:6379/0')
    )
    stream_redis_ok, stream_redis_detail = _ping_redis_url(
        getattr(settings, 'STREAM_REDIS_URL', 'redis://localhost:6379/1')
    )
    checks['redis'] = {
        'ok': realtime_redis_ok and stream_redis_ok,
        'detail': f'realtime={realtime_redis_detail}; stream={stream_redis_detail}',
    }

    try:
        from channels.layers import get_channel_layer

        channel_layer = get_channel_layer()
        channel_backend = getattr(settings, 'REALTIME_CHANNEL_LAYER', 'redis')
        checks['channel_layer'] = {
            'ok': channel_layer is not None,
            'detail': f'backend={channel_backend}',
        }
    except Exception as exc:
        checks['channel_layer'] = {'ok': False, 'detail': str(exc)}

    try:
        from celery import current_app

        responses = current_app.control.inspect(timeout=1).ping() or {}
        checks['workers'] = {
            'ok': bool(responses),
            'detail': f'workers={len(responses)}',
        }
    except Exception as exc:
        checks['workers'] = {'ok': False, 'detail': str(exc)}

    for key, label in [
        ('data_provider', 'Data provider'),
        ('redis', 'Redis'),
        ('channel_layer', 'Channel layer'),
        ('workers', 'Celery workers'),
    ]:
        if checks[key]['ok']:
            continue
        issue = f'{label} degraded: {checks[key]["detail"]}'
        if should_block_dependencies and (realtime_enabled or key == 'data_provider'):
            blocking_issues.append(issue)
        else:
            warnings.append(issue)

    summary = '; '.join(
        f'{key}={"ok" if value["ok"] else "degraded"}'
        for key, value in checks.items()
    )
    return {
        'healthy': not blocking_issues,
        'checks': checks,
        'warnings': warnings,
        'blocking_issues': blocking_issues,
        'summary': summary,
    }


def build_whale_config_runtime_preview(
    config_json: dict | None,
    *,
    rollout_mode: str = 'draft',
    current_config: dict | None = None,
    canary_scope_json: dict | None = None,
    effective_from=None,
) -> dict:
    baseline_config = current_config if isinstance(current_config, dict) else _active_whale_config_json()
    diff_items = build_whale_config_diff_preview(baseline_config, config_json)
    guardrail_result = validate_whale_config_guardrails(
        config_json,
        rollout_mode=rollout_mode,
        canary_scope_json=canary_scope_json,
        effective_from=effective_from,
    )
    dependency_result = check_whale_config_dependencies(rollout_mode=rollout_mode)
    return {
        'current_snapshot': normalize_whale_config_payload(baseline_config),
        'target_snapshot': guardrail_result['snapshot'],
        'diff_items': diff_items,
        'diff_lines': [
            f"{item['label']}: {item['old']} -> {item['new']}"
            for item in diff_items
        ],
        'guardrail_errors': guardrail_result['errors'],
        'warnings': [*guardrail_result['warnings'], *dependency_result['warnings']],
        'blocking_issues': [*guardrail_result['errors'], *dependency_result['blocking_issues']],
        'dependency_summary': dependency_result,
    }


# ---------------------------------------------------------------------------
# Hàm nội bộ: ánh xạ DataFrame của vnstock sang dict chuẩn hoá
# ---------------------------------------------------------------------------

def _normalise_ohlcv(row) -> dict | None:
    """
    Chuyển một row DataFrame (vnstock3) thành dict chuẩn.
    vnstock3 trả về các cột: time, open, high, low, close, volume
    Trả về None nếu dữ liệu không hợp lệ.
    """
    try:
        close = Decimal(str(row['close']))
        if close <= 0:
            return None
        return {
            'open_price':  _to_decimal(row.get('open')),
            'high_price':  _to_decimal(row.get('high')),
            'low_price':   _to_decimal(row.get('low')),
            'close_price': close,
            'volume':      _to_int(row.get('volume')),
        }
    except (KeyError, InvalidOperation, TypeError):
        return None


def _to_decimal(value) -> Decimal | None:
    try:
        return Decimal(str(value)) if value is not None else None
    except InvalidOperation:
        return None


def _to_int(value) -> int | None:
    try:
        return int(value) if value is not None else None
    except (ValueError, TypeError):
        return None


# ---------------------------------------------------------------------------
# Hàm công khai chính
# ---------------------------------------------------------------------------

def fetch_and_save_daily_prices(
    symbol: str,
    start_date: date | None = None,
    end_date: date | None = None,
) -> dict:
    """
    Kéo giá lịch sử (OHLCV) của `symbol` từ vnstock3 và lưu vào DailyPrice.

    Tham số:
        symbol     — Mã chứng khoán (VD: 'VNM', 'VIC').
        start_date — Ngày bắt đầu (mặc định: 30 ngày trước).
        end_date   — Ngày kết thúc (mặc định: hôm nay).

    Trả về dict:
        { 'symbol': str, 'created': int, 'updated': int, 'errors': int }
    """
    today = date.today()
    if end_date is None:
        end_date = today
    if start_date is None:
        start_date = today - timedelta(days=30)

    symbol = symbol.upper().strip()
    result = {'symbol': symbol, 'created': 0, 'updated': 0, 'errors': 0}

    # --- Gọi vnstock (>=3.5.0) với source KBS ---
    try:
        from vnstock import Vnstock  # import trễ để tránh lỗi nếu chưa cài

        stock = Vnstock().stock(symbol=symbol, source='KBS')
        df = stock.quote.history(
            start=start_date.strftime('%Y-%m-%d'),
            end=end_date.strftime('%Y-%m-%d'),
            interval='1D',
        )
    except ImportError:
        logger.error('vnstock chưa được cài đặt. Chạy: pip install vnstock -U')
        result['errors'] += 1
        return result
    except (Exception, SystemExit) as exc:
        logger.error('vnstock lỗi khi lấy dữ liệu %s: %s', symbol, exc)
        result['errors'] += 1
        return result

    if df is None or df.empty:
        logger.warning('vnstock3 không trả về dữ liệu cho %s (%s → %s)', symbol, start_date, end_date)
        return result

    # --- Lưu từng dòng vào DailyPrice (update_or_create để idempotent) ---
    with db_transaction.atomic():
        for _, row in df.iterrows():
            try:
                # vnstock3 dùng cột 'time' kiểu Timestamp
                price_date = row['time'].date() if hasattr(row['time'], 'date') else date.fromisoformat(str(row['time']))
            except Exception:
                result['errors'] += 1
                continue

            data = _normalise_ohlcv(row)
            if data is None:
                result['errors'] += 1
                continue

            try:
                _, created = DailyPrice.objects.update_or_create(
                    symbol=symbol,
                    date=price_date,
                    defaults=data,
                )
            except Exception as db_exc:
                logger.warning('DB error khi lưu %s / %s: %s', symbol, price_date, db_exc)
                result['errors'] += 1
                continue

            if created:
                result['created'] += 1
            else:
                result['updated'] += 1

    logger.info(
        'Sync %s: tạo mới=%d, cập nhật=%d, lỗi=%d',
        symbol, result['created'], result['updated'], result['errors'],
    )
    return result


def sync_portfolio_prices(portfolio_id: int, days: int = 30) -> list[dict]:
    """
    Lấy toàn bộ mã CK đang có trong portfolio và gọi fetch_and_save_daily_prices
    cho từng mã.

    Trả về danh sách kết quả (list of dict) của từng mã.
    """
    try:
        portfolio = Portfolio.objects.get(pk=portfolio_id)
    except Portfolio.DoesNotExist:
        logger.error('Portfolio id=%d không tồn tại', portfolio_id)
        return []

    symbols = (
        Transaction.objects
        .filter(sub_account__portfolio=portfolio)
        .values_list('symbol', flat=True)
        .distinct()
    )

    start_date = date.today() - timedelta(days=days)
    results = []
    for symbol in symbols:
        res = fetch_and_save_daily_prices(symbol, start_date=start_date)
        results.append(res)

    return results


def get_latest_price(symbol: str) -> Decimal | None:
    """
    Trả về giá đóng cửa mới nhất của `symbol` từ bảng DailyPrice.
    Trả về None nếu chưa có dữ liệu.
    """
    record = (
        DailyPrice.objects
        .filter(symbol=symbol.upper())
        .order_by('-date')
        .values('close_price')
        .first()
    )
    return record['close_price'] if record else None


def get_price_series(symbol: str, start_date: date, end_date: date) -> list[dict]:
    """
    Trả về chuỗi giá đóng cửa của `symbol` trong khoảng thời gian,
    dạng [{'date': '2024-01-02', 'close': 12345.00}, ...].
    Dùng cho biểu đồ Line Chart ở Bước 5.
    """
    qs = (
        DailyPrice.objects
        .filter(symbol=symbol.upper(), date__range=(start_date, end_date))
        .order_by('date')
        .values('date', 'close_price')
    )
    return [
        {'date': str(r['date']), 'close': float(r['close_price'])}
        for r in qs
    ]


def get_price_changes(symbols: list) -> dict:
    """
    Lấy giá đóng cửa hiện tại và phiên trước của từng mã, tính % thay đổi.

    Trả về dict:
        { 'VNM': { current_price, prev_price, change_value, change_pct, last_date } }
    """
    if not symbols:
        return {}

    result = {}
    upper_symbols = [s.upper() for s in symbols]

    for symbol in upper_symbols:
        prices = list(
            DailyPrice.objects
            .filter(symbol=symbol)
            .order_by('-date')
            .values('close_price', 'date')[:2]
        )
        if not prices:
            result[symbol] = {
                'current_price': None, 'prev_price': None,
                'change_value': None, 'change_pct': None, 'last_date': None,
            }
            continue

        current = float(prices[0]['close_price'])
        entry = {
            'current_price': current,
            'last_date': str(prices[0]['date']),
            'prev_price': None,
            'change_value': None,
            'change_pct': None,
        }
        if len(prices) >= 2:
            prev = float(prices[1]['close_price'])
            entry['prev_price'] = prev
            entry['change_value'] = round(current - prev, 2)
            entry['change_pct'] = round((current - prev) / prev * 100, 2) if prev > 0 else 0.0

        result[symbol] = entry

    return result


def sync_watchlist_prices(user_id: int, days: int = 5) -> list[dict]:
    """
    Kéo giá EOD mới nhất cho tất cả mã CK user đang quan tâm trong market groups,
    tracked symbols và danh sách theo dõi cá nhân.
    Mặc định sync 5 ngày để cập nhật giá nhanh.
    """
    group_symbols = list(
        SecuritiesGroup.objects
        .values_list('items__symbol', flat=True)
        .distinct()
    )
    tracked_symbols = list(
        TrackedSymbol.objects
        .filter(user_id=user_id)
        .values_list('symbol', flat=True)
        .distinct()
    )
    watchlist_symbols = list(
        WatchlistItem.objects
        .filter(group__user_id=user_id)
        .values_list('symbol', flat=True)
        .distinct()
    )
    symbols = sorted({symbol for symbol in [*group_symbols, *tracked_symbols, *watchlist_symbols] if symbol})

    start_date = date.today() - timedelta(days=days)
    results = []
    for symbol in symbols:
        res = fetch_and_save_daily_prices(symbol, start_date=start_date)
        results.append(res)
    return results


# ---------------------------------------------------------------------------
# Bảng màu cho các nhóm ngành (25 màu cho 25 industry sections)
# ---------------------------------------------------------------------------
_SECTOR_COLORS = [
    '#3b82f6', '#f59e0b', '#ef4444', '#22c55e', '#8b5cf6',
    '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#06b6d4',
    '#84cc16', '#a855f7', '#f43f5e', '#10b981', '#eab308',
    '#0ea5e9', '#d946ef', '#fb923c', '#4ade80', '#38bdf8',
    '#c084fc', '#fb7185', '#34d399', '#fbbf24', '#818cf8',
]

# Màu cố định cho nhóm vốn hóa
_CAP_GROUP_DEFS = [
    ('VN30',  'VN30 — Top 30 vốn hóa lớn HOSE',   '#6366f1'),
    ('VN100', 'VN100 — Top 100 cổ phiếu HOSE',     '#3b82f6'),
    ('HNX30', 'HNX30 — Top 30 cổ phiếu HNX',       '#f59e0b'),
]

_MANUAL_MARKET_GROUPS = [
    {'name': 'Ngân hàng', 'group_type': 'SECTOR', 'color': '#3b82f6', 'order': 1,
     'description': 'Nhóm ngân hàng',
     'symbols': ['ACB', 'BID', 'CTG', 'EIB', 'HDB', 'LPB', 'MBB', 'MSB', 'OCB', 'SHB', 'SSB', 'STB', 'TCB', 'TPB', 'VCB', 'VIB', 'VPB']},
    {'name': 'Bất động sản', 'group_type': 'SECTOR', 'color': '#f59e0b', 'order': 2,
     'description': 'Nhóm bất động sản',
     'symbols': ['BCM', 'CEO', 'DIG', 'DXG', 'KBC', 'KDH', 'NLG', 'NVL', 'PDR', 'SJS', 'TDH', 'VHM', 'VIC', 'VRE']},
    {'name': 'Thép & Vật liệu', 'group_type': 'SECTOR', 'color': '#ef4444', 'order': 3,
     'description': 'Nhóm thép và vật liệu xây dựng',
     'symbols': ['BMP', 'HPG', 'HSG', 'NKG', 'TLH', 'VGC', 'VIS']},
    {'name': 'Dầu khí', 'group_type': 'SECTOR', 'color': '#8b5cf6', 'order': 4,
     'description': 'Nhóm dầu khí và năng lượng',
     'symbols': ['GAS', 'OIL', 'PLX', 'PVD', 'PVS', 'PVT']},
    {'name': 'Công nghệ', 'group_type': 'SECTOR', 'color': '#22c55e', 'order': 5,
     'description': 'Nhóm công nghệ và viễn thông',
     'symbols': ['CMG', 'ELC', 'FPT', 'SAM', 'VGI']},
    {'name': 'Bán lẻ & Tiêu dùng', 'group_type': 'SECTOR', 'color': '#ec4899', 'order': 6,
     'description': 'Nhóm bán lẻ và hàng tiêu dùng',
     'symbols': ['MSN', 'MWG', 'PNJ', 'SAB', 'VNM']},
    {'name': 'VN30', 'group_type': 'MARKET_CAP', 'color': '#6366f1', 'order': 7,
     'description': 'Top 30 cổ phiếu vốn hóa lớn nhất HOSE',
     'symbols': ['ACB', 'BID', 'CTG', 'DGC', 'FPT', 'GAS', 'GVR', 'HDB', 'HPG', 'LPB', 'MBB', 'MSN',
                 'MWG', 'PLX', 'SAB', 'SHB', 'SSB', 'SSI', 'STB', 'TCB', 'TPB', 'VCB', 'VHM', 'VIB',
                 'VIC', 'VJC', 'VNM', 'VPB', 'VPL', 'VRE']},
]


def fetch_market_sectors_and_groups() -> dict:
    """
    Tự động lấy toàn bộ nhóm ngành và nhóm vốn hóa từ vnstock (VCI source).

    Trả về dict:
        {
          'sectors':    [{ name, industry_code, group_type, description, color, symbols }],
          'cap_groups': [{ name, group_type, description, color, symbols }],
          'error': None | str,
        }

    Cách dùng:
        data = fetch_market_sectors_and_groups()
        for sector in data['sectors']:
            print(sector['name'], len(sector['symbols']))
    """
    try:
        from vnstock import Vnstock
        stock = Vnstock().stock(symbol='ACB', source='VCI')

        # --- 1. Lấy 25 nhóm ngành ICB ---
        df = stock.listing.symbols_by_industries()
        # df columns: symbol, industry_code, industry_name

        sectors = []
        for i, ((code, name), group) in enumerate(
            df.groupby(['industry_code', 'industry_name'])
        ):
            color = _SECTOR_COLORS[i % len(_SECTOR_COLORS)]
            sectors.append({
                'industry_code': int(code),
                'name': name.strip(),
                'group_type': 'SECTOR',
                'description': f'Nhóm cổ phiếu ngành {name.strip()}',
                'color': color,
                'symbols': sorted(group['symbol'].str.upper().tolist()),
            })
        sectors.sort(key=lambda x: x['industry_code'])

        # --- 2. Lấy các nhóm vốn hóa ---
        cap_groups = []
        for group_code, description, color in _CAP_GROUP_DEFS:
            try:
                series = stock.listing.symbols_by_group(group_code)
                cap_groups.append({
                    'name': group_code,
                    'group_type': 'MARKET_CAP',
                    'description': description,
                    'color': color,
                    'symbols': sorted(series.str.upper().tolist()),
                })
            except (Exception, SystemExit) as exc:
                logger.warning('symbols_by_group(%s) lỗi: %s', group_code, exc)

        return {'sectors': sectors, 'cap_groups': cap_groups, 'error': None}

    except (Exception, SystemExit) as exc:
        logger.error('fetch_market_sectors_and_groups thất bại: %s', exc)
        return {'sectors': [], 'cap_groups': [], 'error': str(exc)}


def get_manual_market_group_payload() -> list[dict]:
    return [dict(group) for group in _MANUAL_MARKET_GROUPS]


def build_market_group_payload(mode: str = 'all') -> dict:
    normalized_mode = mode if mode in {'all', 'sectors', 'caps', 'manual'} else 'all'
    if normalized_mode == 'manual':
        return {
            'groups': get_manual_market_group_payload(),
            'source': 'manual',
            'warning': None,
            'mode': normalized_mode,
        }

    data = fetch_market_sectors_and_groups()
    if data['error']:
        return {
            'groups': get_manual_market_group_payload(),
            'source': 'manual',
            'warning': f'vnstock lỗi: {data["error"]}. Dùng danh sách mặc định.',
            'mode': normalized_mode,
        }

    groups = []
    if normalized_mode in ('all', 'sectors'):
        for index, sector in enumerate(data['sectors']):
            groups.append({
                'name': sector['name'],
                'group_type': 'SECTOR',
                'description': sector['description'],
                'color': sector['color'],
                'order': index + 1,
                'symbols': sector['symbols'],
            })

    if normalized_mode in ('all', 'caps'):
        offset = len(groups)
        for index, cap in enumerate(data['cap_groups']):
            groups.append({
                'name': cap['name'],
                'group_type': 'MARKET_CAP',
                'description': cap['description'],
                'color': cap['color'],
                'order': offset + index + 1,
                'symbols': cap['symbols'],
            })

    return {
        'groups': groups,
        'source': 'vnstock',
        'warning': None,
        'mode': normalized_mode,
    }


def apply_market_group_payload(groups: list[dict], clear_existing: bool = False) -> dict:
    created_groups = []
    updated_groups = []
    added_symbols = 0
    deleted_groups = 0

    if clear_existing:
        deleted_groups = SecuritiesGroup.objects.count()
        SecuritiesGroup.objects.all().delete()

    for group_data in groups:
        symbols = [symbol.upper().strip() for symbol in group_data.get('symbols', []) if symbol]
        group, created = SecuritiesGroup.objects.get_or_create(
            name=group_data['name'],
            group_type=group_data['group_type'],
            defaults={
                'description': group_data.get('description', ''),
                'color': group_data.get('color', '#22c55e'),
                'order': group_data.get('order', 0),
            },
        )

        metadata_updates = []
        for field_name, field_value in {
            'description': group_data.get('description', ''),
            'color': group_data.get('color', '#22c55e'),
            'order': group_data.get('order', 0),
        }.items():
            if getattr(group, field_name) != field_value:
                setattr(group, field_name, field_value)
                metadata_updates.append(field_name)
        if metadata_updates:
            group.save(update_fields=metadata_updates)

        existing_items = {
            item.symbol: item
            for item in group.items.all()
        }
        group_added_symbols = 0
        reordered_symbols = 0

        for index, symbol in enumerate(symbols):
            existing_item = existing_items.get(symbol)
            if existing_item:
                if existing_item.order != index:
                    existing_item.order = index
                    existing_item.save(update_fields=['order'])
                    reordered_symbols += 1
                continue

            SecuritiesItem.objects.create(group=group, symbol=symbol, order=index)
            group_added_symbols += 1

        removed_symbols = group.items.exclude(symbol__in=symbols)
        removed_symbols_count = removed_symbols.count()
        if removed_symbols_count:
            removed_symbols.delete()

        added_symbols += group_added_symbols
        if created:
            created_groups.append({'group': group.name, 'symbols': len(symbols)})
        elif metadata_updates or group_added_symbols or removed_symbols_count or reordered_symbols:
            updated_groups.append(
                {
                    'group': group.name,
                    'new_symbols': group_added_symbols,
                    'removed_symbols': removed_symbols_count,
                }
            )

    message_parts = []
    if deleted_groups:
        message_parts.append(f'da xoa {deleted_groups} nhom cu')
    if created_groups:
        message_parts.append(f'tao moi {len(created_groups)} nhom')
    if updated_groups:
        message_parts.append(f'cap nhat {len(updated_groups)} nhom')
    if not message_parts:
        message_parts.append('khong co thay doi')

    return {
        'created': created_groups,
        'updated': updated_groups,
        'deleted_groups': deleted_groups,
        'total_groups': len(groups),
        'created_groups_count': len(created_groups),
        'updated_groups_count': len(updated_groups),
        'added_symbols_count': added_symbols,
        'message': ', '.join(message_parts) + '.',
    }


def sync_market_groups(
    requested_by: User | None = None,
    mode: str = 'all',
    clear_existing: bool = False,
    payload: dict | None = None,
    scope: str = MarketGroupSyncLog.ScopeChoices.GLOBAL,
    target_user: User | None = None,
    total_users: int = 0,
) -> dict:
    resolved_payload = payload or build_market_group_payload(mode)
    log = MarketGroupSyncLog.objects.create(
        scope=scope,
        target_user=target_user,
        requested_by=requested_by,
        mode=resolved_payload['mode'],
        clear_existing=clear_existing,
        source=resolved_payload['source'],
        total_users=total_users,
        total_groups=len(resolved_payload['groups']),
    )

    try:
        result = apply_market_group_payload(resolved_payload['groups'], clear_existing=clear_existing)
        message = result['message']
        if resolved_payload['warning']:
            message = f'{message} {resolved_payload["warning"]}'
        log.success = True
        log.created_groups = result['created_groups_count']
        log.updated_groups = result['updated_groups_count']
        log.added_symbols = result['added_symbols_count']
        log.message = message
        log.finished_at = timezone.now()
        log.save(update_fields=['success', 'created_groups', 'updated_groups', 'added_symbols', 'message', 'finished_at'])
        return {
            **result,
            'success': True,
            'warning': resolved_payload['warning'],
            'source': resolved_payload['source'],
            'log': log,
        }
    except Exception as exc:
        logger.exception('sync_market_groups thất bại')
        log.success = False
        log.error = str(exc)
        log.message = 'Đồng bộ nhóm thị trường thất bại.'
        log.finished_at = timezone.now()
        log.save(update_fields=['success', 'error', 'message', 'finished_at'])
        return {
            'success': False,
            'warning': resolved_payload['warning'],
            'source': resolved_payload['source'],
            'error': str(exc),
            'message': 'Đồng bộ nhóm thị trường thất bại.',
            'log': log,
        }


def sync_market_groups_for_user(
    user: User,
    requested_by: User | None = None,
    mode: str = 'all',
    clear_existing: bool = False,
    payload: dict | None = None,
) -> dict:
    return sync_market_groups(
        requested_by=requested_by,
        mode=mode,
        clear_existing=clear_existing,
        payload=payload,
        scope=MarketGroupSyncLog.ScopeChoices.USER,
        target_user=user,
        total_users=1,
    )


def sync_market_groups_for_users(
    users,
    requested_by: User | None = None,
    mode: str = 'all',
    clear_existing: bool = False,
) -> dict:
    user_list = list(users)
    return sync_market_groups(
        requested_by=requested_by,
        mode=mode,
        clear_existing=clear_existing,
        total_users=len(user_list),
        scope=MarketGroupSyncLog.ScopeChoices.GLOBAL,
    )


def _fetch_exchange_lookup(timeout: int = 20) -> dict:
    """Lấy company_name và exchange cho toàn bộ mã từ vnstock symbols_by_exchange().
    Chạy trong thread daemon với timeout để tránh crash Django do vnstock gọi sys.exit().
    Trả về dict: symbol → {'company_name': str, 'exchange': str}
    """
    import threading

    result: dict = {}
    exc_holder: list = []

    def _worker():
        try:
            from vnstock import Vnstock
            stock = Vnstock().stock(symbol='ACB', source='VCI')
            df = stock.listing.symbols_by_exchange()
            result.update({
                row['symbol'].upper().strip(): {
                    'company_name': row.get('organ_name', '') or '',
                    'exchange': row.get('exchange', '') or '',
                }
                for _, row in df.iterrows()
            })
        except BaseException as exc:  # bắt cả SystemExit từ vnstock
            exc_holder.append(exc)

    t = threading.Thread(target=_worker, daemon=True)
    t.start()
    t.join(timeout=timeout)

    if t.is_alive():
        logger.warning('_fetch_exchange_lookup timeout sau %ss — bỏ qua', timeout)
    elif exc_holder:
        logger.warning('_fetch_exchange_lookup thất bại: %s', exc_holder[0])

    return result


def build_stock_profile_payload(mode: str = 'all') -> dict:
    resolved_payload = build_market_group_payload(mode)

    # Lấy company_name + exchange từ vnstock listing (một lần duy nhất)
    exchange_lookup = _fetch_exchange_lookup()

    symbol_map = {}
    for group in resolved_payload['groups']:
        industry = group['name'] if group.get('group_type') == 'SECTOR' else ''
        for symbol in group.get('symbols', []):
            normalized_symbol = symbol.upper().strip()
            current = symbol_map.get(normalized_symbol, {
                'symbol': normalized_symbol,
                'industry': '',
                'exchange': '',
                'company_name': '',
            })
            if industry and not current['industry']:
                current['industry'] = industry
            # Bổ sung company_name và exchange nếu còn trống
            lookup = exchange_lookup.get(normalized_symbol, {})
            if not current['company_name'] and lookup.get('company_name'):
                current['company_name'] = lookup['company_name']
            if not current['exchange'] and lookup.get('exchange'):
                current['exchange'] = lookup['exchange']
            symbol_map[normalized_symbol] = current

    # Thêm các mã có trong exchange_lookup nhưng chưa có trong symbol_map
    # (tức là các mã không thuộc nhóm ngành nào, nhưng vẫn là cổ phiếu thật)
    for symbol, info in exchange_lookup.items():
        if symbol not in symbol_map:
            symbol_map[symbol] = {
                'symbol': symbol,
                'industry': '',
                'company_name': info['company_name'],
                'exchange': info['exchange'],
            }

    warning = resolved_payload['warning']
    if not exchange_lookup:
        note = 'Không lấy được company_name/exchange từ vnstock.'
        warning = f'{warning} {note}'.strip() if warning else note

    return {
        'symbols': list(symbol_map.values()),
        'source': resolved_payload['source'],
        'warning': warning,
        'mode': resolved_payload['mode'],
    }


def sync_stock_profiles(requested_by: User | None = None, mode: str = 'all') -> dict:
    payload = build_stock_profile_payload(mode)
    log = StockProfileSyncLog.objects.create(
        requested_by=requested_by,
        mode=payload['mode'],
        source=payload['source'],
        total_symbols=len(payload['symbols']),
    )

    created_symbols = 0
    updated_symbols = 0
    try:
        with db_transaction.atomic():
            for row in payload['symbols']:
                _, created = StockProfile.objects.update_or_create(
                    symbol=row['symbol'],
                    defaults={
                        'industry': row.get('industry', ''),
                        'exchange': row.get('exchange', ''),
                        'company_name': row.get('company_name', ''),
                        'is_active': True,
                    },
                )
                if created:
                    created_symbols += 1
                else:
                    updated_symbols += 1

        message = f'Da dong bo {len(payload["symbols"])} ma chung khoan (tao moi: {created_symbols}, cap nhat: {updated_symbols}).'
        if payload['warning']:
            message = f'{message} {payload["warning"]}'
        log.success = True
        log.created_symbols = created_symbols
        log.updated_symbols = updated_symbols
        log.message = message
        log.finished_at = timezone.now()
        log.save(update_fields=['success', 'created_symbols', 'updated_symbols', 'message', 'finished_at'])
        return {
            'success': True,
            'message': message,
            'warning': payload['warning'],
            'source': payload['source'],
            'total_symbols': len(payload['symbols']),
            'created_symbols': created_symbols,
            'updated_symbols': updated_symbols,
            'log': log,
        }
    except Exception as exc:
        logger.exception('sync_stock_profiles thất bại')
        log.success = False
        log.error = str(exc)
        log.message = 'Đồng bộ hồ sơ mã chứng khoán thất bại.'
        log.finished_at = timezone.now()
        log.save(update_fields=['success', 'error', 'message', 'finished_at'])
        return {
            'success': False,
            'message': 'Đồng bộ hồ sơ mã chứng khoán thất bại.',
            'warning': payload['warning'],
            'source': payload['source'],
            'error': str(exc),
            'log': log,
        }
