from __future__ import annotations

from datetime import datetime, timedelta, timezone as datetime_timezone

from django.core.cache import cache
from django.db import transaction as db_transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from portfolio.global_signal_policy_helpers import (
    build_global_signal_control_center_ownership,
    coerce_global_signal_retention_policy,
    coerce_global_signal_services_config,
    coerce_global_signal_universe_policy,
    get_global_signal_retention_policy,
    get_global_signal_services_config,
    get_global_signal_universe_policy,
    set_global_signal_retention_policy,
    set_global_signal_services_config,
    set_global_signal_universe_policy,
)
from portfolio.models import IntradayTick, OrderFlowSignal, SignalServiceRun, WhaleAlertEvent, WhaleConfigAuditLog, WhaleConfigDraft
from portfolio.serializers import SignalServiceRunSerializer
from portfolio.services_signal_run_registry import create_signal_service_run, finish_signal_service_run
from portfolio.services import (
    build_whale_config_runtime_preview,
    get_active_runtime_rollout_for_symbol,
    get_active_whale_config_version,
    get_latest_whale_config_anomaly_overview,
    get_whale_config_propagation_overview,
)
from portfolio.services_global_signal_universe import GlobalSignalUniverseResolver
from portfolio.services_backfill import intraday_side_backfill_preview
from portfolio.services_global_whale_alerts import GLOBAL_WHALE_LATEST_EVENT_CACHE_PREFIX
from portfolio.tasks import detect_and_store_global_whale_alerts, detect_and_store_order_flow
from portfolio.tasks_maintenance import run_intraday_side_backfill_apply
from portfolio.runtime_policy_helpers import _get_runtime_prefetch_settings
from portfolio.services_money_flow_retention import build_money_flow_retention_preview, build_retention_safety_gate
from portfolio.tasks_order_flow import ORDER_FLOW_LATEST_SIGNAL_CACHE_PREFIX
from portfolio.views_admin_runtime import _is_celery_worker_available

HEAVY_COUNT_CACHE_KEY_PREFIX = 'admin_ops:signals:heavy_count:v1'
HEAVY_COUNT_CACHE_TTL_SECONDS = 600


def _truthy(value) -> bool:
    return str(value or '').strip().lower() in {'1', 'true', 'yes', 'on'}


def _parse_bounded_positive_int(value, default: int, *, minimum: int = 1, maximum: int = 100) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return max(minimum, min(parsed, maximum))


def _build_config_changes(before: dict, after: dict) -> dict:
    changes = {}
    for key, before_value in before.items():
        after_value = after.get(key)
        if before_value != after_value:
            changes[key] = {
                'before': before_value,
                'after': after_value,
            }
    return changes


def _serialize_whale_governance_version(version) -> dict | None:
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


def _serialize_whale_governance_rollout(rollout) -> dict | None:
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


def _serialize_whale_governance_draft(draft) -> dict | None:
    if draft is None:
        return None

    return {
        'draft_id': draft.id,
        'name': draft.name,
        'status': draft.status,
        'created_by_id': draft.created_by_id,
        'created_by_username': draft.created_by.username if draft.created_by_id else None,
        'submitted_at': draft.submitted_at.isoformat() if draft.submitted_at else None,
        'linked_version_id': draft.linked_version_id,
        'linked_version_code': draft.linked_version.version_code if draft.linked_version_id else None,
        'reason': draft.reason,
        'config_json': draft.config_json if isinstance(draft.config_json, dict) else {},
        'created_at': draft.created_at.isoformat() if draft.created_at else None,
        'updated_at': draft.updated_at.isoformat() if draft.updated_at else None,
    }


def _build_whale_governance_snapshot() -> dict:
    active_version = get_active_whale_config_version()
    active_rollout = get_active_runtime_rollout_for_symbol()
    pending_draft = (
        WhaleConfigDraft.objects
        .select_related('created_by', 'linked_version')
        .filter(
            status__in=[
                WhaleConfigDraft.StatusChoices.DRAFT,
                WhaleConfigDraft.StatusChoices.SUBMITTED,
            ]
        )
        .order_by('-submitted_at', '-updated_at', '-created_at')
        .first()
    )

    return {
        'generated_at': timezone.now().isoformat(),
        'active_version': _serialize_whale_governance_version(active_version),
        'active_rollout': _serialize_whale_governance_rollout(active_rollout),
        'pending_draft': _serialize_whale_governance_draft(pending_draft),
        'propagation': get_whale_config_propagation_overview(),
        'anomaly': get_latest_whale_config_anomaly_overview(),
    }


def _serialize_run(run: SignalServiceRun | None) -> dict | None:
    if run is None:
        return None
    return SignalServiceRunSerializer(run).data


def _latest_run(service_domain: str, *, statuses: set[str]) -> SignalServiceRun | None:
    return (
        SignalServiceRun.objects.filter(service_domain=service_domain, status__in=statuses)
        .order_by('-created_at', '-id')
        .first()
    )


def _latest_whale_cache_payload() -> dict | None:
    latest_event = WhaleAlertEvent.objects.order_by('-occurred_at', '-id').first()
    if latest_event is None:
        return None
    return cache.get(f'{GLOBAL_WHALE_LATEST_EVENT_CACHE_PREFIX}:{latest_event.symbol}')


def _latest_dark_flow_cache_payload() -> dict | None:
    latest_signal = OrderFlowSignal.objects.order_by('-created_at', '-id').first()
    if latest_signal is None:
        return None
    return cache.get(f'{ORDER_FLOW_LATEST_SIGNAL_CACHE_PREFIX}:{latest_signal.symbol}')


def _parse_iso_datetime(raw_value) -> datetime | None:
    if not raw_value:
        return None
    try:
        parsed = datetime.fromisoformat(str(raw_value).replace('Z', '+00:00'))
    except (TypeError, ValueError):
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=datetime_timezone.utc)
    return parsed


def _cached_heavy_count(cache_suffix: str, count_fn) -> int:
    cache_key = f'{HEAVY_COUNT_CACHE_KEY_PREFIX}:{cache_suffix}'

    try:
        cached_count = cache.get(cache_key)
    except Exception:
        cached_count = None

    if cached_count is not None:
        try:
            return max(int(cached_count), 0)
        except (TypeError, ValueError):
            pass

    count_value = max(int(count_fn()), 0)
    try:
        cache.set(cache_key, count_value, timeout=HEAVY_COUNT_CACHE_TTL_SECONDS)
    except Exception:
        pass
    return count_value


def _build_summary_domain_payload(service_domain: str) -> dict:
    now = timezone.now()
    window_start = now - timedelta(hours=24)

    if service_domain == SignalServiceRun.ServiceDomain.WHALE:
        latest_event = WhaleAlertEvent.objects.order_by('-occurred_at', '-id').first()
        cache_payload = _latest_whale_cache_payload()
        recent_count = WhaleAlertEvent.objects.filter(occurred_at__gte=window_start).count()
        total_count = _cached_heavy_count('whale_event_total_count', WhaleAlertEvent.objects.count)
        latest_payload = {
            'event_id': latest_event.event_id,
            'symbol': latest_event.symbol,
            'severity': latest_event.severity,
            'occurred_at': latest_event.occurred_at.isoformat() if latest_event and latest_event.occurred_at else None,
        } if latest_event else None
    else:
        latest_event = OrderFlowSignal.objects.order_by('-created_at', '-id').first()
        cache_payload = _latest_dark_flow_cache_payload()
        recent_count = OrderFlowSignal.objects.filter(created_at__gte=window_start).count()
        total_count = _cached_heavy_count('order_flow_signal_total_count', OrderFlowSignal.objects.count)
        latest_payload = {
            'event_id': latest_event.event_id,
            'symbol': latest_event.symbol,
            'severity': latest_event.severity,
            'occurred_at': latest_event.created_at.isoformat() if latest_event and latest_event.created_at else None,
        } if latest_event else None

    materialization = dict((cache_payload or {}).get('materialization') or {})
    session_summary = dict((cache_payload or {}).get('session_summary') or {})
    anomaly_markers = list((cache_payload or {}).get('anomaly_markers') or [])
    cached_at = str((cache_payload or {}).get('cached_at') or materialization.get('cached_at') or '')
    event_ts = str(
        (cache_payload or {}).get('triggered_at')
        or materialization.get('generated_at')
        or session_summary.get('generated_at')
        or (latest_event.created_at.isoformat() if latest_event and latest_event.created_at else '')
    )
    cached_at_dt = _parse_iso_datetime(cached_at)
    event_ts_dt = _parse_iso_datetime(event_ts)
    cache_age_seconds = int((now - cached_at_dt).total_seconds()) if cached_at_dt else None
    lag_seconds = int((now - event_ts_dt).total_seconds()) if event_ts_dt else None
    freshness_state = str(
        materialization.get('freshness_state')
        or ('fresh' if cache_age_seconds is not None and cache_age_seconds <= 60 else 'warm' if cache_age_seconds is not None and cache_age_seconds <= 300 else 'stale')
    )
    pending_run_count = 0
    if service_domain == SignalServiceRun.ServiceDomain.DARK_FLOW:
        pending_run_count = SignalServiceRun.objects.filter(
            service_domain=SignalServiceRun.ServiceDomain.DARK_FLOW,
            status__in={SignalServiceRun.StatusChoices.QUEUED, SignalServiceRun.StatusChoices.RUNNING},
        ).count()

    cached_bucket_facts = list((cache_payload or {}).get('bucket_facts') or [])
    cached_bucket_fact_count = len(cached_bucket_facts)

    normalized_materialization = {
        'source': str(materialization.get('source') or ('dark_flow_detect' if service_domain == SignalServiceRun.ServiceDomain.DARK_FLOW else 'whale_alert_cache')),
        'generated_at': str(materialization.get('generated_at') or event_ts or ''),
        'cached_at': cached_at or None,
        'freshness_state': freshness_state,
        'lag_seconds': float(materialization.get('lag_seconds') or (lag_seconds if lag_seconds is not None else 0.0)),
        'bucket_fact_count': int(materialization.get('bucket_fact_count') or cached_bucket_fact_count),
        'anomaly_count': int(materialization.get('anomaly_count') or len(anomaly_markers)),
        'session_summary_state': str(materialization.get('session_summary_state') or ('complete' if (cache_payload or {}).get('bucket_facts') else 'empty')),
        'read_path': str(materialization.get('read_path') or ('facts_first' if service_domain == SignalServiceRun.ServiceDomain.DARK_FLOW and (cache_payload or {}).get('bucket_facts') else 'raw_fallback')),
    }

    return {
        'last_successful_run': _serialize_run(_latest_run(service_domain, statuses={SignalServiceRun.StatusChoices.COMPLETED, SignalServiceRun.StatusChoices.PARTIAL})),
        'last_failed_run': _serialize_run(_latest_run(service_domain, statuses={SignalServiceRun.StatusChoices.FAILED})),
        'recent_event_count_24h': recent_count,
        'total_event_count': total_count,
        'latest_event': latest_payload,
        'cache_freshness': {
            'cached_at': cached_at or None,
            'event_ts': event_ts or None,
            'age_seconds': cache_age_seconds,
            'lag_seconds': lag_seconds,
            'freshness_state': freshness_state,
        },
        'materialization': normalized_materialization,
        'session_summary': session_summary,
        'anomaly_markers': anomaly_markers,
        'pending_run_count': pending_run_count,
    }


def _build_retention_preview(policy: dict, *, preview_run: SignalServiceRun | None = None) -> dict:
    return build_money_flow_retention_preview(
        policy,
        preview_run=preview_run,
        runtime_settings=_get_runtime_prefetch_settings(),
    )


def _build_money_flow_freshness_snapshot(*, retention_policy: dict) -> dict:
    whale_summary = _build_summary_domain_payload(SignalServiceRun.ServiceDomain.WHALE)
    dark_flow_summary = _build_summary_domain_payload(SignalServiceRun.ServiceDomain.DARK_FLOW)
    retention_gate = build_retention_safety_gate(retention_policy)

    whale_freshness = (whale_summary.get('materialization') or {}).get('freshness_state')
    dark_flow_freshness = (dark_flow_summary.get('materialization') or {}).get('freshness_state')
    retention_freshness = retention_gate.get('preview_freshness_state')

    state = 'fresh'
    if retention_gate.get('purge_ready') is not True or whale_freshness != 'fresh' or dark_flow_freshness != 'fresh':
        state = 'mixed'

    return {
        'state': state,
        'whale': {
            'freshness_state': whale_freshness,
            'lag_seconds': (whale_summary.get('materialization') or {}).get('lag_seconds'),
        },
        'dark_flow': {
            'freshness_state': dark_flow_freshness,
            'lag_seconds': (dark_flow_summary.get('materialization') or {}).get('lag_seconds'),
        },
        'retention': {
            'preview_state': 'ready' if retention_gate.get('purge_ready') else 'blocked',
            'freshness_state': retention_freshness,
        },
    }


def _build_effective_value_preview_contract(
    *,
    preview_kind: str,
    current_values: dict,
    proposed_values: dict,
    ownership: dict,
    impacted_counts: dict,
    freshness: dict,
    warnings: list[dict] | None = None,
    confirmed: bool = False,
    preview_state: str = 'ready',
    extra_confirmation_metadata: dict | None = None,
) -> dict:
    diff = _build_config_changes(current_values, proposed_values)
    effective_value_warnings = list(warnings or [])
    for field_name, change in diff.items():
        effective_value_warnings.append(
            {
                'field': field_name,
                'before': change.get('before'),
                'after': change.get('after'),
                'message': f'Giá trị hiệu lực của {field_name} sẽ thay đổi.',
                'severity': 'warning',
            }
        )

    confirmation_metadata = {
        'preview_kind': preview_kind,
        'requires_confirm': True,
        'confirmed': confirmed,
        'preview_state': preview_state,
        'warning_count': len(effective_value_warnings),
    }
    if extra_confirmation_metadata:
        confirmation_metadata.update(extra_confirmation_metadata)

    return {
        'effective_owner': ownership,
        'effective_values': proposed_values,
        'diff': diff,
        'impacted_counts': impacted_counts,
        'freshness': freshness,
        'confirmation_metadata': confirmation_metadata,
        'effective_value_warnings': effective_value_warnings,
    }


def _extract_whale_governance_bridge_config(payload: dict) -> dict:
    if isinstance(payload, dict):
        for key in ('config_json', 'whale_governance', 'whale_config', 'draft', 'config'):
            nested_payload = payload.get(key)
            if isinstance(nested_payload, dict):
                return nested_payload
        return dict(payload)
    return {}


def _build_whale_governance_bridge_preview_contract(*, payload: dict, current_version) -> tuple[dict, dict]:
    proposed_config = _extract_whale_governance_bridge_config(payload)
    current_config = current_version.config_json if current_version and isinstance(current_version.config_json, dict) else {}

    preview = build_whale_config_runtime_preview(
        proposed_config,
        rollout_mode='draft',
        current_config=current_config,
    )
    preview_contract = _build_effective_value_preview_contract(
        preview_kind='whale_governance_bridge',
        current_values=preview['current_snapshot'],
        proposed_values=preview['target_snapshot'],
        ownership=build_global_signal_control_center_ownership(),
        impacted_counts={
            'diff_items': len(preview.get('diff_items') or []),
            'guardrail_errors': len(preview.get('guardrail_errors') or []),
            'blocking_issues': len(preview.get('blocking_issues') or []),
            'dependency_checks': len((preview.get('dependency_summary') or {}).get('checks') or {}),
        },
        freshness={
            'state': 'ready' if not preview.get('blocking_issues') else 'blocked',
            'source': 'whale_governance_bridge_preview',
            'current_version_code': current_version.version_code if current_version else 'default-runtime',
        },
        warnings=list(preview.get('warnings') or []),
        confirmed=False,
        preview_state='ready',
        extra_confirmation_metadata={
            'bridge_semantics': 'pending_draft',
            'approval_required': True,
            'active_version_code': current_version.version_code if current_version else None,
        },
    )
    return preview, preview_contract


def _parse_money_flow_materialization_request(payload: dict) -> dict:
    symbols_raw = payload.get('symbols') or []
    if isinstance(symbols_raw, str):
        symbols_raw = [item.strip() for item in symbols_raw.split(',') if item.strip()]
    symbols = [str(symbol).strip().upper() for symbol in symbols_raw if str(symbol).strip()]

    try:
        threshold = int(payload.get('threshold') or 0)
    except (TypeError, ValueError):
        threshold = 0

    try:
        batch_size = max(100, int(payload.get('batch_size') or 2000))
    except (TypeError, ValueError):
        batch_size = 2000

    try:
        max_preview_rows = max(100, int(payload.get('max_preview_rows') or batch_size))
    except (TypeError, ValueError):
        max_preview_rows = batch_size

    return {
        'symbols': symbols,
        'start_date': str(payload.get('start_date') or '').strip() or None,
        'end_date': str(payload.get('end_date') or '').strip() or None,
        'threshold': threshold,
        'batch_size': batch_size,
        'max_preview_rows': max_preview_rows,
    }


def _build_money_flow_materialization_preview_contract(*, request_payload: dict, preview_result: dict) -> dict:
    ownership = build_global_signal_control_center_ownership()
    effective_values = dict(request_payload)
    current_values = {
        'symbols': [],
        'start_date': None,
        'end_date': None,
        'threshold': 0,
        'batch_size': 2000,
        'max_preview_rows': 2000,
    }
    freshness = {
        'state': 'recompute pending' if int(preview_result.get('changed_rows') or 0) > 0 else 'fresh',
        'source': 'intraday_side_backfill_preview',
        'preview_rows_scanned': int(preview_result.get('preview_rows_scanned') or 0),
    }
    impacted_counts = {
        'scope_rows': int(preview_result.get('scope_rows') or 0),
        'changed_rows': int(preview_result.get('changed_rows') or 0),
        'sample_rows': len(preview_result.get('sample_rows') or []),
        'transitions': len(preview_result.get('transitions') or {}),
    }
    warnings = list((ownership.get('deprecation_notes') or []))
    if impacted_counts['changed_rows'] > 0:
        warnings.append(
            {
                'field': 'materialization',
                'before': None,
                'after': 'recompute_pending',
                'message': 'Backfill sẽ cập nhật dữ liệu materialization và invalidate cache liên quan.',
                'severity': 'warning',
            }
        )

    return {
        'preview': preview_result,
        **_build_effective_value_preview_contract(
            preview_kind='materialization',
            current_values=current_values,
            proposed_values=effective_values,
            ownership=ownership,
            impacted_counts=impacted_counts,
            freshness=freshness,
            warnings=warnings,
        ),
    }


def _normalize_recent_events(domain: str, symbol: str | None, limit: int, *, offset: int = 0) -> tuple[list[dict], int]:
    normalized_symbol = str(symbol or '').strip().upper()
    fetch_limit = max(limit + max(offset, 0), limit)
    events = []
    total_count = 0

    if domain in {'all', 'whale'}:
        whale_qs = WhaleAlertEvent.objects.order_by('-occurred_at', '-id')
        if normalized_symbol:
            whale_qs = whale_qs.filter(symbol=normalized_symbol)
        total_count += whale_qs.count()
        for event in whale_qs[:fetch_limit]:
            events.append(
                {
                    'domain': 'whale',
                    'event_id': event.event_id,
                    'symbol': event.symbol,
                    'severity': event.severity,
                    'ts': event.occurred_at.isoformat() if event.occurred_at else None,
                    'summary_value': float(event.matched_value_vnd or 0),
                    'source': event.source,
                }
            )

    if domain in {'all', 'dark_flow'}:
        dark_flow_qs = OrderFlowSignal.objects.order_by('-created_at', '-id')
        if normalized_symbol:
            dark_flow_qs = dark_flow_qs.filter(symbol=normalized_symbol)
        total_count += dark_flow_qs.count()
        for signal in dark_flow_qs[:fetch_limit]:
            events.append(
                {
                    'domain': 'dark_flow',
                    'event_id': signal.event_id,
                    'symbol': signal.symbol,
                    'severity': signal.severity,
                    'ts': signal.created_at.isoformat() if signal.created_at else None,
                    'summary_value': float(signal.strength or 0),
                    'source': signal.signal_type,
                }
            )

    events.sort(key=lambda item: str(item.get('ts') or ''), reverse=True)
    return events[offset:offset + limit], total_count


@api_view(['GET'])
@permission_classes([IsAdminUser])
def signal_admin_summary_api(request):
    services_config = get_global_signal_services_config()
    universe_snapshot = GlobalSignalUniverseResolver.build_snapshot()
    retention_policy = get_global_signal_retention_policy()
    ownership = build_global_signal_control_center_ownership()
    retention_preview = _build_retention_preview(retention_policy)
    whale_summary = _build_summary_domain_payload(SignalServiceRun.ServiceDomain.WHALE)
    dark_flow_summary = _build_summary_domain_payload(SignalServiceRun.ServiceDomain.DARK_FLOW)

    lifecycle = {
        'tiers': {
            'raw_intraday': {
                'owner': (ownership.get('compatibility') or {}).get('raw_intraday_keep_days', {}).get('owner'),
                'status': (ownership.get('compatibility') or {}).get('raw_intraday_keep_days', {}).get('status'),
                'rows_total': (retention_preview.get('raw_intraday') or {}).get('rows_total'),
                'keep_days': (retention_preview.get('raw_intraday') or {}).get('keep_days'),
                'purge_before': (retention_preview.get('raw_intraday') or {}).get('purge_before'),
            },
            'whale_events': {
                'owner': (ownership.get('domains') or {}).get('retention_policy', {}).get('owner'),
                'rows_total': (retention_preview.get('whale_events') or {}).get('rows_total'),
                'keep_days': (retention_preview.get('policy') or {}).get('whale_event_keep_days'),
                'purge_before': (retention_preview.get('whale_events') or {}).get('purge_before'),
            },
            'dark_flow_events': {
                'owner': (ownership.get('domains') or {}).get('retention_policy', {}).get('owner'),
                'rows_total': (retention_preview.get('dark_flow_events') or {}).get('rows_total'),
                'keep_days': (retention_preview.get('policy') or {}).get('dark_flow_keep_days'),
                'purge_before': (retention_preview.get('dark_flow_events') or {}).get('purge_before'),
            },
            'forensic_windows': {
                'owner': (ownership.get('domains') or {}).get('retention_policy', {}).get('owner'),
                'storage_mode': (retention_preview.get('forensic_policy') or {}).get('storage_mode'),
                'candidate_count': (retention_preview.get('forensic_policy') or {}).get('candidate_count'),
                'min_severity': (retention_preview.get('forensic_policy') or {}).get('min_severity'),
            },
        },
        'materialization_lag': {
            'whale': {
                'freshness_state': (whale_summary.get('materialization') or {}).get('freshness_state'),
                'lag_seconds': (whale_summary.get('materialization') or {}).get('lag_seconds'),
                'session_summary_state': (whale_summary.get('materialization') or {}).get('session_summary_state'),
            },
            'dark_flow': {
                'freshness_state': (dark_flow_summary.get('materialization') or {}).get('freshness_state'),
                'lag_seconds': (dark_flow_summary.get('materialization') or {}).get('lag_seconds'),
                'session_summary_state': (dark_flow_summary.get('materialization') or {}).get('session_summary_state'),
            },
        },
        'anomaly_backlog': {
            'whale': len(whale_summary.get('anomaly_markers') or []),
            'dark_flow': len(dark_flow_summary.get('anomaly_markers') or []),
            'total': len(whale_summary.get('anomaly_markers') or []) + len(dark_flow_summary.get('anomaly_markers') or []),
        },
        'effective_owner_matrix': ownership,
        'deprecation_warnings': list(ownership.get('deprecation_notes') or []),
        'risky_duplicate_fields': list((ownership.get('compatibility') or {}).keys()),
    }

    return Response(
        {
            'ok': True,
            'sampled_at': timezone.now().isoformat(),
            'services': {
                'enabled': bool(services_config.get('enabled', True)),
                'whale': {
                    'enabled': bool((services_config.get('whale_service') or {}).get('enabled', True)),
                    **whale_summary,
                },
                'dark_flow': {
                    'enabled': bool((services_config.get('dark_flow_service') or {}).get('enabled', True)),
                    **dark_flow_summary,
                },
            },
            'distribution': services_config.get('distribution') or {},
            'universe': {
                'generated_at': universe_snapshot.get('generated_at'),
                'counts': universe_snapshot.get('counts') or {},
                'sources': universe_snapshot.get('sources') or {},
            },
            'retention': retention_preview,
            'ownership': ownership,
            'lifecycle': lifecycle,
            'whale_governance': _build_whale_governance_snapshot(),
            'celery': {
                'alive': _is_celery_worker_available(),
            },
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET', 'PUT'])
@permission_classes([IsAdminUser])
def signal_admin_config_api(request):
    if request.method == 'GET':
        return Response(
            {
                'ok': True,
                'services_config': get_global_signal_services_config(),
                'universe_policy': get_global_signal_universe_policy(),
                'retention_policy': get_global_signal_retention_policy(),
                'ownership': build_global_signal_control_center_ownership(),
            },
            status=status.HTTP_200_OK,
        )

    current_services = get_global_signal_services_config()
    current_universe = get_global_signal_universe_policy()
    current_retention = get_global_signal_retention_policy()

    services_payload = request.data.get('services_config', current_services)
    universe_payload = request.data.get('universe_policy', current_universe)
    retention_payload = request.data.get('retention_policy', current_retention)

    normalized_services = coerce_global_signal_services_config(services_payload, fallback=current_services)
    normalized_universe = coerce_global_signal_universe_policy(universe_payload, fallback=current_universe)
    normalized_retention = coerce_global_signal_retention_policy(retention_payload, fallback=current_retention)

    set_global_signal_services_config(normalized_services)
    set_global_signal_universe_policy(normalized_universe)
    set_global_signal_retention_policy(normalized_retention)

    freshness = _build_money_flow_freshness_snapshot(retention_policy=normalized_retention)
    preview_contract = _build_effective_value_preview_contract(
        preview_kind='config',
        current_values={
            'services_config': current_services,
            'universe_policy': current_universe,
            'retention_policy': current_retention,
        },
        proposed_values={
            'services_config': normalized_services,
            'universe_policy': normalized_universe,
            'retention_policy': normalized_retention,
        },
        ownership=build_global_signal_control_center_ownership(),
        impacted_counts={
            'services_config': len(_build_config_changes(current_services, normalized_services)),
            'universe_policy': len(_build_config_changes(current_universe, normalized_universe)),
            'retention_policy': len(_build_config_changes(current_retention, normalized_retention)),
        },
        freshness=freshness,
        warnings=list((build_global_signal_control_center_ownership().get('deprecation_notes') or [])),
        confirmed=True,
        preview_state='applied',
    )

    return Response(
        {
            'ok': True,
            'services_config': normalized_services,
            'universe_policy': normalized_universe,
            'retention_policy': normalized_retention,
            'ownership': build_global_signal_control_center_ownership(),
            'confirmation_metadata': preview_contract['confirmation_metadata'],
            'effective_owner': preview_contract['effective_owner'],
            'effective_values': preview_contract['effective_values'],
            'diff': preview_contract['diff'],
            'impacted_counts': preview_contract['impacted_counts'],
            'freshness': preview_contract['freshness'],
            'effective_value_warnings': preview_contract['effective_value_warnings'],
            'changes': {
                'services_config': _build_config_changes(current_services, normalized_services),
                'universe_policy': _build_config_changes(current_universe, normalized_universe),
                'retention_policy': _build_config_changes(current_retention, normalized_retention),
            },
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAdminUser])
def signal_admin_config_preview_api(request):
    current_services = get_global_signal_services_config()
    current_universe = get_global_signal_universe_policy()
    current_retention = get_global_signal_retention_policy()

    normalized_services = coerce_global_signal_services_config(request.data.get('services_config', current_services), fallback=current_services)
    normalized_universe = coerce_global_signal_universe_policy(request.data.get('universe_policy', current_universe), fallback=current_universe)
    normalized_retention = coerce_global_signal_retention_policy(request.data.get('retention_policy', current_retention), fallback=current_retention)
    ownership = build_global_signal_control_center_ownership()
    freshness = _build_money_flow_freshness_snapshot(retention_policy=normalized_retention)
    preview_contract = _build_effective_value_preview_contract(
        preview_kind='config_preview',
        current_values={
            'services_config': current_services,
            'universe_policy': current_universe,
            'retention_policy': current_retention,
        },
        proposed_values={
            'services_config': normalized_services,
            'universe_policy': normalized_universe,
            'retention_policy': normalized_retention,
        },
        ownership=ownership,
        impacted_counts={
            'services_config': len(_build_config_changes(current_services, normalized_services)),
            'universe_policy': len(_build_config_changes(current_universe, normalized_universe)),
            'retention_policy': len(_build_config_changes(current_retention, normalized_retention)),
        },
        freshness=freshness,
        warnings=list((ownership.get('deprecation_notes') or [])),
        preview_state='ready',
    )

    return Response(
        {
            'ok': True,
            'preview': {
                'services_config': normalized_services,
                'universe_policy': normalized_universe,
                'retention_policy': normalized_retention,
            },
            'ownership': ownership,
            'effective_owner': preview_contract['effective_owner'],
            'effective_values': preview_contract['effective_values'],
            'diff': preview_contract['diff'],
            'impacted_counts': preview_contract['impacted_counts'],
            'freshness': preview_contract['freshness'],
            'confirmation_metadata': preview_contract['confirmation_metadata'],
            'effective_value_warnings': preview_contract['effective_value_warnings'],
            'changes': {
                'services_config': _build_config_changes(current_services, normalized_services),
                'universe_policy': _build_config_changes(current_universe, normalized_universe),
                'retention_policy': _build_config_changes(current_retention, normalized_retention),
            },
            'universe_preview': GlobalSignalUniverseResolver.build_snapshot(config=normalized_universe),
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAdminUser])
def signal_admin_universe_preview_api(request):
    normalized_policy = coerce_global_signal_universe_policy(request.data or {}, fallback=get_global_signal_universe_policy())
    snapshot = GlobalSignalUniverseResolver.build_snapshot(config=normalized_policy)
    return Response(
        {
            'ok': True,
            'policy': normalized_policy,
            'preview': snapshot,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAdminUser])
def signal_admin_universe_apply_api(request):
    if not _truthy(request.data.get('confirm')):
        return Response(
            {'ok': False, 'message': 'Phải truyền confirm=true trước khi apply universe policy.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    normalized_policy = coerce_global_signal_universe_policy(request.data.get('policy') or request.data or {}, fallback=get_global_signal_universe_policy())
    applied = set_global_signal_universe_policy(normalized_policy)
    snapshot = GlobalSignalUniverseResolver.build_snapshot(config=applied)
    return Response(
        {
            'ok': True,
            'policy': applied,
            'preview': snapshot,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAdminUser])
def signal_admin_whale_governance_bridge_preview_api(request):
    current_version = get_active_whale_config_version()
    preview, preview_contract = _build_whale_governance_bridge_preview_contract(
        payload=request.data or {},
        current_version=current_version,
    )
    bridge_state = 'blocked' if preview.get('blocking_issues') else 'ready'
    if bridge_state != preview_contract['confirmation_metadata'].get('preview_state'):
        preview_contract['confirmation_metadata']['preview_state'] = bridge_state

    return Response(
        {
            'ok': True,
            'status': bridge_state,
            'bridge_state': bridge_state,
            'approval_required': True,
            'whale_governance': _build_whale_governance_snapshot(),
            'preview': preview,
            **preview_contract,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAdminUser])
def signal_admin_whale_governance_bridge_apply_api(request):
    if not _truthy(request.data.get('confirm')):
        return Response(
            {
                'ok': False,
                'message': 'Phải truyền confirm=true trước khi submit whale governance bridge.',
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    current_version = get_active_whale_config_version()
    preview, preview_contract = _build_whale_governance_bridge_preview_contract(
        payload=request.data or {},
        current_version=current_version,
    )
    if preview.get('blocking_issues'):
        preview_contract['confirmation_metadata']['preview_state'] = 'blocked'
        return Response(
            {
                'ok': False,
                'status': 'blocked',
                'bridge_state': 'blocked',
                'approval_required': True,
                'message': 'Bridge bị chặn bởi integrity checks.',
                'whale_governance': _build_whale_governance_snapshot(),
                'preview': preview,
                **preview_contract,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    draft_name = str(request.data.get('name') or request.data.get('draft_name') or '').strip()
    if not draft_name:
        draft_name = f"Cầu nối Whale Governance {timezone.now().strftime('%Y-%m-%d %H:%M')}"
    reason = str(request.data.get('reason') or request.data.get('note') or '').strip() or 'bridge_submit_from_admin_ops'
    ticket_ref = str(request.data.get('ticket_ref') or '').strip()
    now = timezone.now()

    with db_transaction.atomic():
        draft = WhaleConfigDraft.objects.create(
            name=draft_name,
            config_json=preview['target_snapshot'],
            status=WhaleConfigDraft.StatusChoices.DRAFT,
            created_by=request.user,
            linked_version=current_version,
            reason=reason,
        )
        WhaleConfigAuditLog.objects.create(
            actor=request.user,
            action='create_draft',
            draft=draft,
            version=current_version,
            reason='whale_governance_bridge_create',
            before_json={},
            after_json={
                'draft_id': draft.id,
                'name': draft.name,
                'status': draft.status,
                'linked_version_code': current_version.version_code if current_version else None,
                'config_json': draft.config_json,
            },
            ticket_ref=ticket_ref,
        )

        draft.status = WhaleConfigDraft.StatusChoices.SUBMITTED
        draft.submitted_at = now
        draft.save(update_fields=['status', 'submitted_at', 'updated_at'])

        WhaleConfigAuditLog.objects.create(
            actor=request.user,
            action='submit_draft',
            draft=draft,
            version=current_version,
            reason=reason,
            before_json={
                'status': WhaleConfigDraft.StatusChoices.DRAFT,
                'name': draft.name,
            },
            after_json={
                'draft_id': draft.id,
                'name': draft.name,
                'status': draft.status,
                'submitted_at': draft.submitted_at.isoformat() if draft.submitted_at else None,
                'linked_version_code': current_version.version_code if current_version else None,
                'diff_preview': preview.get('diff_items') or [],
                'dependency_summary': preview.get('dependency_summary') or {},
            },
            ticket_ref=ticket_ref,
        )

    whale_governance = _build_whale_governance_snapshot()
    draft_payload = _serialize_whale_governance_draft(draft)
    confirmation_metadata = dict(preview_contract.get('confirmation_metadata') or {})
    confirmation_metadata.update(
        {
            'confirmed': True,
            'preview_state': 'submitted',
            'draft_id': draft.id,
            'draft_status': draft.status,
            'pending_draft_id': draft.id,
        }
    )
    preview_contract['confirmation_metadata'] = confirmation_metadata

    return Response(
        {
            'ok': True,
            'status': 'submitted',
            'bridge_state': 'pending_approval',
            'approval_required': True,
            'message': 'Whale governance draft đã được gửi vào mission-control và đang chờ phê duyệt.',
            'whale_governance': whale_governance,
            'draft': draft_payload,
            'pending_draft': draft_payload,
            'preview': preview,
            **preview_contract,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(['GET'])
@permission_classes([IsAdminUser])
def signal_admin_jobs_api(request):
    page = _parse_bounded_positive_int(request.query_params.get('page'), 1, maximum=100000)
    page_size = _parse_bounded_positive_int(
        request.query_params.get('page_size', request.query_params.get('limit')),
        20,
    )
    service_domain = str(request.query_params.get('service_domain') or '').strip().lower()
    queryset = SignalServiceRun.objects.all().order_by('-created_at', '-id')
    if service_domain in {
        SignalServiceRun.ServiceDomain.WHALE,
        SignalServiceRun.ServiceDomain.DARK_FLOW,
        SignalServiceRun.ServiceDomain.LIFECYCLE,
    }:
        queryset = queryset.filter(service_domain=service_domain)

    total_count = queryset.count()
    offset = (page - 1) * page_size
    rows = list(queryset[offset:offset + page_size])
    return Response(
        {
            'ok': True,
            'count': total_count,
            'page': page,
            'page_size': page_size,
            'results': SignalServiceRunSerializer(rows, many=True).data,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAdminUser])
def signal_admin_jobs_run_api(request):
    service_domain = str(request.data.get('service_domain') or '').strip().lower()
    if service_domain not in {SignalServiceRun.ServiceDomain.WHALE, SignalServiceRun.ServiceDomain.DARK_FLOW}:
        return Response({'ok': False, 'message': 'service_domain chỉ hỗ trợ whale hoặc dark_flow.'}, status=status.HTTP_400_BAD_REQUEST)

    symbol = str(request.data.get('symbol') or '').strip().upper() or None
    run = SignalServiceRun.objects.create(
        service_domain=service_domain,
        run_type=SignalServiceRun.RunType.MANUAL,
        status=SignalServiceRun.StatusChoices.QUEUED,
        params_json={'symbol': symbol} if symbol else {},
        created_by=request.user if request.user.is_authenticated else None,
    )

    if service_domain == SignalServiceRun.ServiceDomain.WHALE:
        task = detect_and_store_global_whale_alerts.apply_async(kwargs={'symbol': symbol, 'run_id': run.id})
    else:
        task = detect_and_store_order_flow.apply_async(kwargs={'symbol': symbol, 'run_id': run.id})

    run.task_id = str(getattr(task, 'id', '') or '')
    run.save(update_fields=['task_id', 'updated_at'])

    return Response(
        {
            'ok': True,
            'run': SignalServiceRunSerializer(run).data,
        },
        status=status.HTTP_202_ACCEPTED,
    )


@api_view(['POST'])
@permission_classes([IsAdminUser])
def signal_admin_job_retry_api(request, run_id: int):
    try:
        source_run = SignalServiceRun.objects.get(id=run_id)
    except SignalServiceRun.DoesNotExist:
        return Response({'ok': False, 'message': 'Không tìm thấy signal run.'}, status=status.HTTP_404_NOT_FOUND)

    if source_run.status in {SignalServiceRun.StatusChoices.QUEUED, SignalServiceRun.StatusChoices.RUNNING}:
        return Response({'ok': False, 'message': 'Run đang chờ hoặc đang chạy, chưa thể retry.'}, status=status.HTTP_400_BAD_REQUEST)

    if source_run.service_domain not in {SignalServiceRun.ServiceDomain.WHALE, SignalServiceRun.ServiceDomain.DARK_FLOW}:
        return Response({'ok': False, 'message': 'Chỉ có thể retry whale hoặc dark_flow run.'}, status=status.HTTP_400_BAD_REQUEST)

    retry_run = SignalServiceRun.objects.create(
        service_domain=source_run.service_domain,
        run_type=SignalServiceRun.RunType.MANUAL,
        status=SignalServiceRun.StatusChoices.QUEUED,
        params_json=source_run.params_json or {},
        created_by=request.user if request.user.is_authenticated else None,
    )
    symbol = (retry_run.params_json or {}).get('symbol')

    if retry_run.service_domain == SignalServiceRun.ServiceDomain.WHALE:
        task = detect_and_store_global_whale_alerts.apply_async(kwargs={'symbol': symbol, 'run_id': retry_run.id})
    else:
        task = detect_and_store_order_flow.apply_async(kwargs={'symbol': symbol, 'run_id': retry_run.id})

    retry_run.task_id = str(getattr(task, 'id', '') or '')
    retry_run.save(update_fields=['task_id', 'updated_at'])

    return Response(
        {
            'ok': True,
            'run': SignalServiceRunSerializer(retry_run).data,
        },
        status=status.HTTP_202_ACCEPTED,
    )


@api_view(['GET'])
@permission_classes([IsAdminUser])
def signal_admin_recent_events_api(request):
    domain = str(request.query_params.get('domain') or 'all').strip().lower()
    if domain not in {'all', 'whale', 'dark_flow'}:
        return Response({'ok': False, 'message': 'domain chỉ hỗ trợ all, whale, dark_flow.'}, status=status.HTTP_400_BAD_REQUEST)

    symbol = request.query_params.get('symbol')
    page = _parse_bounded_positive_int(request.query_params.get('page'), 1, maximum=100000)
    page_size = _parse_bounded_positive_int(
        request.query_params.get('page_size', request.query_params.get('limit')),
        20,
    )
    offset = (page - 1) * page_size
    results, total_count = _normalize_recent_events(domain, symbol, page_size, offset=offset)
    return Response(
        {
            'ok': True,
            'count': total_count,
            'page': page,
            'page_size': page_size,
            'results': results,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAdminUser])
def signal_admin_retention_preview_api(request):
    payload = request.data.get('retention_policy', request.data or {})
    normalized_policy = coerce_global_signal_retention_policy(payload, fallback=get_global_signal_retention_policy())
    run = create_signal_service_run(
        service_domain=SignalServiceRun.ServiceDomain.LIFECYCLE,
        run_type=SignalServiceRun.RunType.RETENTION_PREVIEW,
        params_json={'retention_policy': normalized_policy},
        created_by_id=request.user.id if request.user.is_authenticated else None,
        status=SignalServiceRun.StatusChoices.RUNNING,
    )

    try:
        preview = _build_retention_preview(normalized_policy)
    except Exception as exc:
        finish_signal_service_run(
            run,
            status=SignalServiceRun.StatusChoices.FAILED,
            processed_items=0,
            stored_items=0,
            failed_items=1,
            progress_pct=100.0,
            log=f'retention preview exception: {exc}',
        )
        raise

    finish_signal_service_run(
        run,
        status=SignalServiceRun.StatusChoices.COMPLETED,
        processed_items=3,
        stored_items=0,
        failed_items=0,
        progress_pct=100.0,
        log=(
            'retention preview raw_keep_days={raw_keep_days} whale_keep_days={whale_keep_days} '
            'dark_flow_keep_days={dark_flow_keep_days}'
        ).format(
            raw_keep_days=preview.get('raw_intraday', {}).get('keep_days'),
            whale_keep_days=normalized_policy.get('whale_event_keep_days'),
            dark_flow_keep_days=normalized_policy.get('dark_flow_keep_days'),
        ),
    )
    preview['safety_gate'] = build_retention_safety_gate(normalized_policy, preview_run=run)
    preview['preview_state'] = 'ready' if preview['safety_gate'].get('purge_ready') else 'blocked'
    ownership = build_global_signal_control_center_ownership()
    preview_contract = _build_effective_value_preview_contract(
        preview_kind='retention_preview',
        current_values=get_global_signal_retention_policy(),
        proposed_values=normalized_policy,
        ownership=ownership,
        impacted_counts={
            'raw_intraday_rows_total': int((preview.get('raw_intraday') or {}).get('rows_total') or 0),
            'whale_event_rows_total': int((preview.get('whale_events') or {}).get('rows_total') or 0),
            'dark_flow_rows_total': int((preview.get('dark_flow_events') or {}).get('rows_total') or 0),
            'forensic_candidate_count': int((preview.get('forensic_policy') or {}).get('candidate_count') or 0),
        },
        freshness={
            'state': preview['preview_state'],
            'source': 'money_flow_retention_preview',
            'preview_freshness_state': preview['safety_gate'].get('preview_freshness_state'),
        },
        warnings=list((ownership.get('deprecation_notes') or [])),
        preview_state=preview['preview_state'],
    )
    return Response(
        {
            'ok': True,
            'preview': preview,
            'effective_owner': preview_contract['effective_owner'],
            'effective_values': preview_contract['effective_values'],
            'diff': preview_contract['diff'],
            'impacted_counts': preview_contract['impacted_counts'],
            'freshness': preview_contract['freshness'],
            'confirmation_metadata': preview_contract['confirmation_metadata'],
            'effective_value_warnings': preview_contract['effective_value_warnings'],
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAdminUser])
def signal_admin_money_flow_materialization_preview_api(request):
    request_payload = _parse_money_flow_materialization_request(request.data or {})
    try:
        preview_result = intraday_side_backfill_preview(
            symbols=request_payload['symbols'],
            start_date=request_payload['start_date'],
            end_date=request_payload['end_date'],
            threshold=request_payload['threshold'],
            batch_size=request_payload['batch_size'],
            max_preview_rows=request_payload['max_preview_rows'],
        )
    except Exception as exc:
        return Response({'ok': False, 'message': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    preview_contract = _build_money_flow_materialization_preview_contract(
        request_payload=request_payload,
        preview_result=preview_result,
    )
    return Response(
        {
            'ok': True,
            **preview_contract,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAdminUser])
def signal_admin_money_flow_materialization_run_api(request):
    if not _truthy(request.data.get('confirm')):
        return Response(
            {'ok': False, 'message': 'Phải truyền confirm=true trước khi chạy materialization.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    request_payload = _parse_money_flow_materialization_request(request.data or {})
    try:
        preview_result = intraday_side_backfill_preview(
            symbols=request_payload['symbols'],
            start_date=request_payload['start_date'],
            end_date=request_payload['end_date'],
            threshold=request_payload['threshold'],
            batch_size=request_payload['batch_size'],
            max_preview_rows=request_payload['max_preview_rows'],
        )
    except Exception as exc:
        return Response({'ok': False, 'message': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    preview_contract = _build_money_flow_materialization_preview_contract(
        request_payload=request_payload,
        preview_result=preview_result,
    )

    if not _is_celery_worker_available():
        return Response(
            {
                'ok': False,
                'status': 'worker_unavailable',
                'message': 'Celery worker đang offline. Không thể chạy materialization nền lúc này.',
                **preview_contract,
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    task = run_intraday_side_backfill_apply.apply_async(
        kwargs={
            'symbols': request_payload['symbols'],
            'start_date': request_payload['start_date'],
            'end_date': request_payload['end_date'],
            'threshold': request_payload['threshold'],
            'batch_size': request_payload['batch_size'],
        }
    )

    confirmation_metadata = dict(preview_contract.get('confirmation_metadata') or {})
    confirmation_metadata.update(
        {
            'confirmed': True,
            'queued': True,
            'task_id': str(getattr(task, 'id', '') or ''),
            'task_name': 'portfolio.tasks.run_intraday_side_backfill_apply',
        }
    )

    return Response(
        {
            'ok': True,
            'status': 'queued',
            'task_id': str(getattr(task, 'id', '') or ''),
            'confirmation_metadata': confirmation_metadata,
            'effective_owner': preview_contract.get('effective_owner'),
            'effective_values': preview_contract.get('effective_values'),
            'diff': preview_contract.get('diff'),
            'impacted_counts': preview_contract.get('impacted_counts'),
            'freshness': preview_contract.get('freshness'),
            'effective_value_warnings': preview_contract.get('effective_value_warnings'),
            'preview': preview_contract.get('preview'),
        },
        status=status.HTTP_202_ACCEPTED,
    )