from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta

from django.core.cache import cache
from django.utils import timezone

from portfolio.global_signal_policy_helpers import (
    coerce_global_signal_retention_policy,
    default_global_signal_retention_policy,
)
from portfolio.models import IntradayTick, MoneyFlowForensicWindow, OrderFlowSignal, SignalServiceRun, WhaleAlertEvent
from portfolio.runtime_policy_helpers import _get_runtime_prefetch_settings


RETENTION_PREVIEW_FRESHNESS_SECONDS = 24 * 60 * 60
SEVERITY_ORDER = {'info': 0, 'warning': 1, 'urgent': 2}


def _normalize_retention_policy(policy: dict | None) -> dict:
    return coerce_global_signal_retention_policy(policy or {}, fallback=default_global_signal_retention_policy())


def _severity_rank(value: str | None) -> int:
    return SEVERITY_ORDER.get(str(value or '').strip().lower(), 0)


def _latest_completed_retention_preview_run() -> SignalServiceRun | None:
    return (
        SignalServiceRun.objects.filter(
            service_domain=SignalServiceRun.ServiceDomain.LIFECYCLE,
            run_type=SignalServiceRun.RunType.RETENTION_PREVIEW,
            status=SignalServiceRun.StatusChoices.COMPLETED,
        )
        .order_by('-finished_at', '-created_at', '-id')
        .first()
    )


def _preview_run_finished_at(run: SignalServiceRun | None):
    if run is None:
        return None
    return run.finished_at or run.created_at


def _normalize_forensic_timestamp(value) -> datetime | None:
    if value in (None, ''):
        return None
    parsed = value
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
        except ValueError:
            return None
    if not isinstance(parsed, datetime):
        return None
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
    return timezone.localtime(parsed)


def _collect_forensic_tick_rows(*, symbol: str, source_timestamp: datetime, before_minutes: int, after_minutes: int) -> list[dict]:
    source_local = _normalize_forensic_timestamp(source_timestamp)
    if source_local is None:
        return []

    window_start = source_local - timedelta(minutes=before_minutes)
    window_end = source_local + timedelta(minutes=after_minutes)
    queryset = IntradayTick.objects.filter(symbol=symbol, trade_date=source_local.date()).order_by('trade_time', 'id')
    if window_start.date() == source_local.date():
        queryset = queryset.filter(trade_time__gte=window_start.time())
    if window_end.date() == source_local.date():
        queryset = queryset.filter(trade_time__lte=window_end.time())

    rows = []
    for tick in queryset[:250]:
        rows.append(
            {
                'trade_date': tick.trade_date.isoformat() if tick.trade_date else None,
                'trade_time': tick.trade_time.isoformat() if tick.trade_time else None,
                'price': float(tick.price or 0),
                'volume': float(tick.volume or 0),
                'side': str(tick.side or '').upper(),
                'value': float(getattr(tick, 'value', 0) or 0),
            }
        )
    return rows


def _cached_heavy_count(cache_key: str, count_fn, ttl_seconds: int = 300) -> int:
    cached_value = cache.get(cache_key)
    if cached_value is not None:
        return int(cached_value)

    value = int(count_fn())
    cache.set(cache_key, value, ttl_seconds)
    return value


def should_materialize_money_flow_forensic_window(severity: str, policy: dict | None = None) -> bool:
    normalized_policy = _normalize_retention_policy(policy or {})
    return _severity_rank(severity) >= _severity_rank(normalized_policy.get('forensic_min_severity'))


def materialize_money_flow_forensic_window(
    *,
    domain: str,
    source_model: str,
    source_id: str,
    symbol: str,
    severity: str,
    source_timestamp,
    policy: dict | None = None,
    source_payload_json: dict | None = None,
) -> dict:
    normalized_policy = _normalize_retention_policy(policy or {})
    if not should_materialize_money_flow_forensic_window(severity, normalized_policy):
        return {
            'created': False,
            'reason': 'severity_below_threshold',
            'storage_mode': 'physical_carve_out',
            'target_tier': 'L5',
        }

    normalized_timestamp = _normalize_forensic_timestamp(source_timestamp)
    if normalized_timestamp is None:
        return {
            'created': False,
            'reason': 'invalid_source_timestamp',
            'storage_mode': 'physical_carve_out',
            'target_tier': 'L5',
        }

    now_value = timezone.now()
    keep_days = int(normalized_policy.get('forensic_window_keep_days') or 90)
    before_minutes = int(normalized_policy.get('forensic_window_before_minutes') or 60)
    after_minutes = int(normalized_policy.get('forensic_window_after_minutes') or 60)
    window_start = normalized_timestamp - timedelta(minutes=before_minutes)
    window_end = normalized_timestamp + timedelta(minutes=after_minutes)
    expires_at = normalized_timestamp + timedelta(days=keep_days)
    raw_tick_rows = _collect_forensic_tick_rows(
        symbol=symbol,
        source_timestamp=normalized_timestamp,
        before_minutes=before_minutes,
        after_minutes=after_minutes,
    )
    source_payload = dict(source_payload_json or {})
    window_payload = {
        'raw_tick_rows': raw_tick_rows,
        'raw_tick_count': len(raw_tick_rows),
        'window_before_minutes': before_minutes,
        'window_after_minutes': after_minutes,
        'materialized_at': now_value.isoformat(),
        'policy': {
            'keep_days': keep_days,
            'min_severity': normalized_policy.get('forensic_min_severity'),
        },
    }

    window, created = MoneyFlowForensicWindow.objects.update_or_create(
        domain=domain,
        source_model=source_model,
        source_id=str(source_id),
        defaults={
            'symbol': symbol,
            'severity': severity,
            'source_timestamp': normalized_timestamp,
            'window_start': window_start,
            'window_end': window_end,
            'expires_at': expires_at,
            'storage_mode': 'physical_carve_out',
            'target_tier': 'L5',
            'reason': f'{domain}:{severity}',
            'source_payload_json': source_payload,
            'window_payload_json': window_payload,
        },
    )

    return {
        'created': created,
        'window_id': window.id,
        'domain': window.domain,
        'source_model': window.source_model,
        'source_id': window.source_id,
        'symbol': window.symbol,
        'severity': window.severity,
        'raw_tick_count': len(raw_tick_rows),
        'storage_mode': window.storage_mode,
        'target_tier': window.target_tier,
        'expires_at': window.expires_at.isoformat() if window.expires_at else None,
    }


def materialize_money_flow_forensic_window_from_whale_event(event, *, policy: dict | None = None) -> dict:
    source_payload = {
        'event_id': event.event_id,
        'symbol': event.symbol,
        'side': event.side,
        'matched_value_vnd': int(event.matched_value_vnd or 0),
        'threshold_vnd': int(event.threshold_vnd or 0),
        'severity': event.severity,
        'source': event.source,
        'source_layer': event.source_layer,
        'occurred_at': event.occurred_at.isoformat() if event.occurred_at else None,
    }
    return materialize_money_flow_forensic_window(
        domain=MoneyFlowForensicWindow.DomainChoices.WHALE,
        source_model='WhaleAlertEvent',
        source_id=event.event_id,
        symbol=event.symbol,
        severity=event.severity,
        source_timestamp=event.occurred_at,
        policy=policy,
        source_payload_json=source_payload,
    )


def materialize_money_flow_forensic_window_from_order_flow_signal(signal, *, policy: dict | None = None) -> dict:
    source_payload = {
        'event_id': signal.event_id,
        'symbol': signal.symbol,
        'signal_type': signal.signal_type,
        'strength': float(signal.strength or 0),
        'confidence': signal.confidence,
        'tick_rate': float(signal.tick_rate or 0),
        'small_order_ratio': float(signal.small_order_ratio or 0),
        'cvd_at_signal': float(signal.cvd_at_signal or 0),
        'price_at_signal': float(signal.price_at_signal or 0),
        'window_seconds': int(signal.window_seconds or 0),
        'severity': signal.severity,
        'created_at': signal.created_at.isoformat() if signal.created_at else None,
    }
    return materialize_money_flow_forensic_window(
        domain=MoneyFlowForensicWindow.DomainChoices.DARK_FLOW,
        source_model='OrderFlowSignal',
        source_id=signal.event_id or f'order_flow_signal:{signal.id}',
        symbol=signal.symbol,
        severity=signal.severity,
        source_timestamp=signal.created_at,
        policy=policy,
        source_payload_json=source_payload,
    )


def purge_expired_money_flow_forensic_windows(*, now=None) -> dict:
    now_value = now or timezone.now()
    queryset = MoneyFlowForensicWindow.objects.filter(expires_at__lt=now_value).order_by('expires_at', 'id')
    total_deleted = 0
    chunk_size = 5000

    while True:
        ids = list(queryset.values_list('id', flat=True)[:chunk_size])
        if not ids:
            break
        deleted, _ = MoneyFlowForensicWindow.objects.filter(id__in=ids).delete()
        total_deleted += deleted

    return {
        'deleted': total_deleted,
        'cutoff': now_value.isoformat(),
    }


def build_retention_safety_gate(policy: dict, *, preview_run: SignalServiceRun | None = None, now=None) -> dict:
    normalized_policy = _normalize_retention_policy(policy)
    now_value = now or timezone.now()
    effective_run = preview_run or _latest_completed_retention_preview_run()
    preview_finished_at = _preview_run_finished_at(effective_run)
    preview_age_seconds = None
    preview_freshness_state = 'missing'
    preview_matches_policy = False
    blocked_reasons: list[str] = []

    if effective_run is not None and preview_finished_at is not None:
        preview_age_seconds = max(int((now_value - preview_finished_at).total_seconds()), 0)
        preview_freshness_state = 'fresh' if preview_age_seconds <= RETENTION_PREVIEW_FRESHNESS_SECONDS else 'stale'
        preview_matches_policy = _normalize_retention_policy((effective_run.params_json or {}).get('retention_policy') or {}) == normalized_policy

    preview_required = bool(normalized_policy.get('require_preview_before_purge', True))
    if preview_required:
        if effective_run is None:
            blocked_reasons.append('preview_missing')
        elif not preview_matches_policy:
            blocked_reasons.append('preview_policy_mismatch')
        elif preview_freshness_state != 'fresh':
            blocked_reasons.append('preview_stale')

    return {
        'preview_required': preview_required,
        'preview_run_id': effective_run.id if effective_run is not None else None,
        'preview_run_status': effective_run.status if effective_run is not None else None,
        'preview_run_finished_at': preview_finished_at.isoformat() if preview_finished_at is not None else None,
        'preview_age_seconds': preview_age_seconds,
        'preview_freshness_state': preview_freshness_state,
        'preview_matches_policy': preview_matches_policy,
        'purge_ready': not blocked_reasons,
        'blocked_reasons': blocked_reasons,
        'bounded_override': {
            'available': bool(blocked_reasons),
            'reason': blocked_reasons[0] if blocked_reasons else None,
            'requires_human_ack': bool(blocked_reasons),
        },
    }


def build_selective_forensic_window_preview(policy: dict, *, now=None) -> dict:
    normalized_policy = _normalize_retention_policy(policy)
    now_value = now or timezone.now()
    keep_days = int(normalized_policy.get('forensic_window_keep_days') or 90)
    before_minutes = int(normalized_policy.get('forensic_window_before_minutes') or 60)
    after_minutes = int(normalized_policy.get('forensic_window_after_minutes') or 60)
    max_windows_per_symbol = max(int(normalized_policy.get('forensic_max_windows_per_symbol') or 3), 1)
    min_severity_rank = _severity_rank(normalized_policy.get('forensic_min_severity'))
    eligible_severities = [severity for severity in ('info', 'warning', 'urgent') if _severity_rank(severity) >= min_severity_rank]

    candidate_windows: list[dict] = []
    selected_counts = defaultdict(int)

    whale_events = (
        WhaleAlertEvent.objects.filter(severity__in=eligible_severities)
        .order_by('-occurred_at', '-id')
        .only('event_id', 'symbol', 'severity', 'occurred_at')[:25]
    )
    dark_flow_signals = (
        OrderFlowSignal.objects.filter(severity__in=eligible_severities)
        .order_by('-created_at', '-id')
        .only('event_id', 'symbol', 'severity', 'created_at')[:25]
    )

    def _append_candidate(domain: str, symbol: str, severity: str, source_id: str, source_ts, source_model: str):
        if _severity_rank(severity) < min_severity_rank:
            return
        if selected_counts[symbol] >= max_windows_per_symbol:
            return

        candidate_windows.append({
            'domain': domain,
            'symbol': symbol,
            'severity': severity,
            'source_id': source_id,
            'source_model': source_model,
            'source_timestamp': source_ts.isoformat() if source_ts else None,
            'window_start': (source_ts - timedelta(minutes=before_minutes)).isoformat() if source_ts else None,
            'window_end': (source_ts + timedelta(minutes=after_minutes)).isoformat() if source_ts else None,
            'expires_at': (now_value + timedelta(days=keep_days)).isoformat(),
            'storage_mode': 'physical_carve_out',
            'target_tier': 'L5',
            'reason': f'{domain}:{severity}',
        })
        selected_counts[symbol] += 1

    for event in whale_events:
        _append_candidate(
            'whale',
            event.symbol,
            event.severity,
            event.event_id,
            event.occurred_at,
            'WhaleAlertEvent',
        )

    for signal in dark_flow_signals:
        _append_candidate(
            'dark_flow',
            signal.symbol,
            signal.severity,
            signal.event_id,
            signal.created_at,
            'OrderFlowSignal',
        )

    candidate_windows.sort(key=lambda item: str(item.get('source_timestamp') or ''), reverse=True)

    return {
        'enabled': True,
        'storage_mode': 'physical_carve_out',
        'min_severity': normalized_policy.get('forensic_min_severity'),
        'keep_days': keep_days,
        'window_before_minutes': before_minutes,
        'window_after_minutes': after_minutes,
        'max_windows_per_symbol': max_windows_per_symbol,
        'candidate_count': len(candidate_windows),
        'symbol_count': len(selected_counts),
        'candidate_windows': candidate_windows,
    }


def build_money_flow_retention_preview(
    policy: dict,
    *,
    preview_run: SignalServiceRun | None = None,
    now=None,
    runtime_settings: dict | None = None,
) -> dict:
    normalized_policy = _normalize_retention_policy(policy)
    effective_runtime_settings = runtime_settings or _get_runtime_prefetch_settings()
    now_value = now or timezone.now()
    raw_keep_days = max(int(effective_runtime_settings.get('intraday_tick_keep_days', 7) or 7), 1)
    raw_cutoff = (now_value - timedelta(days=raw_keep_days)).isoformat()
    whale_cutoff = (now_value - timedelta(days=int(normalized_policy.get('whale_event_keep_days', 90) or 90))).isoformat()
    dark_flow_cutoff = (now_value - timedelta(days=int(normalized_policy.get('dark_flow_keep_days', 90) or 90))).isoformat()

    raw_earliest_trade_date = IntradayTick.objects.order_by('trade_date', 'trade_time').values_list('trade_date', flat=True).first()
    whale_earliest_occurred_at = WhaleAlertEvent.objects.order_by('occurred_at', 'id').values_list('occurred_at', flat=True).first()
    dark_flow_earliest_created_at = OrderFlowSignal.objects.order_by('created_at', 'id').values_list('created_at', flat=True).first()

    return {
        'policy': normalized_policy,
        'raw_intraday': {
            'rows_total': _cached_heavy_count('money_flow_retention_raw_intraday_total_count', IntradayTick.objects.count),
            'earliest_trade_date': raw_earliest_trade_date,
            'keep_days': raw_keep_days,
            'purge_before': raw_cutoff,
        },
        'whale_events': {
            'rows_total': _cached_heavy_count('money_flow_retention_whale_event_total_count', WhaleAlertEvent.objects.count),
            'earliest_occurred_at': whale_earliest_occurred_at,
            'purge_before': whale_cutoff,
        },
        'dark_flow_events': {
            'rows_total': _cached_heavy_count('money_flow_retention_dark_flow_total_count', OrderFlowSignal.objects.count),
            'earliest_created_at': dark_flow_earliest_created_at,
            'purge_before': dark_flow_cutoff,
        },
        'safety_gate': build_retention_safety_gate(normalized_policy, preview_run=preview_run, now=now_value),
        'forensic_policy': build_selective_forensic_window_preview(normalized_policy, now=now_value),
    }


def can_run_money_flow_retention_purge(policy: dict, *, preview_run: SignalServiceRun | None = None, now=None) -> dict:
    return build_retention_safety_gate(policy, preview_run=preview_run, now=now)
