from __future__ import annotations

import logging
import os
import sys

from celery import shared_task
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

# Setup path for packages/core imports
_core_backend_src = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '../../packages/core/backend/src')
)
if os.path.exists(_core_backend_src) and _core_backend_src not in sys.path:
    sys.path.insert(0, _core_backend_src)

# Core models (AUTHORITY)
try:
    from user_workspace.models import WatchlistItem
except (ImportError, RuntimeError):
    class WatchlistItem:
        pass

from portfolio.global_signal_policy_helpers import (
    get_global_signal_retention_policy,
    get_global_signal_services_config,
)
from portfolio.models import TrackedSymbol, UserConfig, WhaleAdvisory
from portfolio.models import SignalServiceRun
from portfolio.services_money_flow_retention import (
    materialize_money_flow_forensic_window_from_order_flow_signal,
    should_materialize_money_flow_forensic_window,
)
from portfolio.services_signal_run_registry import (
    create_signal_service_run,
    finish_signal_service_run,
    resolve_signal_run_status,
    resolve_signal_run_type,
    start_signal_service_run,
)
from portfolio.services_global_signal_universe import GlobalSignalUniverseResolver

logger = logging.getLogger(__name__)

ORDER_FLOW_COOLDOWN_SECONDS = 300
ORDER_FLOW_MAX_SYMBOLS = 30
ORDER_FLOW_LATEST_SIGNAL_CACHE_PREFIX = 'order_flow:latest'
REALTIME_UNIVERSE_SNAPSHOT_CACHE_KEY = 'realtime:universe:snapshot'
DARK_FLOW_DISTRIBUTION_MIN_STRENGTH = 50.0


def _latest_order_flow_signal_cache_key(symbol: str) -> str:
    return f'{ORDER_FLOW_LATEST_SIGNAL_CACHE_PREFIX}:{str(symbol or "").strip().upper()}'


def _resolve_dark_flow_runtime_settings() -> dict:
    config = get_global_signal_services_config()
    dark_flow_config = (config.get('dark_flow_service') or {}) if isinstance(config, dict) else {}
    return {
        'enabled': bool(dark_flow_config.get('enabled', True)),
        'window_seconds': max(int(dark_flow_config.get('window_seconds', 300) or 300), 60),
        'cooldown_seconds': max(int(dark_flow_config.get('cooldown_seconds', ORDER_FLOW_COOLDOWN_SECONDS) or ORDER_FLOW_COOLDOWN_SECONDS), 60),
    }


def _resolve_order_flow_symbols(symbol: str | None = None) -> list[str]:
    if symbol:
        normalized = str(symbol or '').strip().upper()
        return [normalized] if normalized else []

    resolved_symbols: list[str] = []
    seen = set()
    snapshot = cache.get(REALTIME_UNIVERSE_SNAPSHOT_CACHE_KEY)

    def _append(raw_symbol) -> None:
        normalized_symbol = str(raw_symbol or '').strip().upper()
        if not normalized_symbol or normalized_symbol in seen:
            return
        seen.add(normalized_symbol)
        resolved_symbols.append(normalized_symbol)

    if isinstance(snapshot, dict):
        rows = snapshot.get('rows') or []
        if isinstance(rows, list):
            for row in rows:
                if isinstance(row, dict):
                    _append(row.get('symbol'))
        if not resolved_symbols:
            for raw_symbol in snapshot.get('effective_symbols') or []:
                _append(raw_symbol)

    if not resolved_symbols:
        rebuilt_snapshot = GlobalSignalUniverseResolver.build_snapshot()
        for row in rebuilt_snapshot.get('rows') or []:
            if isinstance(row, dict):
                _append(row.get('symbol'))
        if not resolved_symbols:
            for raw_symbol in rebuilt_snapshot.get('effective_symbols') or []:
                _append(raw_symbol)

    return resolved_symbols[:ORDER_FLOW_MAX_SYMBOLS]


def _classify_order_flow_signal_severity(*, strength: float, confidence: str, cvd_change: float) -> str:
    from portfolio.tasks_advisory_helpers import _compute_dark_flow_severity

    return str(
        _compute_dark_flow_severity(
            strength=strength,
            confidence=confidence,
            cvd_change=cvd_change,
        )
    )


def _cache_latest_order_flow_signal(signal, *, triggered_at: str, result: dict | None = None) -> None:
    retention_policy = get_global_signal_retention_policy()
    cache_ttl = max(int(retention_policy.get('summary_cache_ttl_seconds', 900) or 900), 60)
    bucket_facts = list((result or {}).get('bucket_facts') or [])
    session_summary = dict((result or {}).get('session_summary') or {})
    anomaly_markers = list((result or {}).get('anomaly_markers') or [])
    materialization = dict((result or {}).get('materialization') or {})
    cached_at = timezone.now().isoformat()
    generated_at = str(materialization.get('generated_at') or (result or {}).get('triggered_at') or triggered_at)
    cache.set(
        _latest_order_flow_signal_cache_key(signal.symbol),
        {
            'id': int(signal.id),
            'event_id': signal.event_id,
            'symbol': signal.symbol,
            'signal_type': signal.signal_type,
            'strength': float(signal.strength or 0),
            'confidence': signal.confidence,
            'tick_rate': float(signal.tick_rate or 0),
            'small_order_ratio': float(signal.small_order_ratio or 0),
            'cvd_at_signal': float(signal.cvd_at_signal or 0),
            'severity': signal.severity,
            'window_seconds': int(signal.window_seconds or 0),
            'components': signal.components_json or {},
            'triggered_at': triggered_at,
            'cached_at': cached_at,
            'bucket_facts': bucket_facts,
            'bucket_fact_count': len(bucket_facts),
            'session_summary': session_summary,
            'session_summary_state': 'complete' if bucket_facts else 'empty',
            'anomaly_markers': anomaly_markers,
            'anomaly_count': len(anomaly_markers),
            'materialization': {
                'source': str(materialization.get('source') or 'dark_flow_detect'),
                'generated_at': generated_at,
                'cached_at': cached_at,
                'freshness_state': str(materialization.get('freshness_state') or ('fresh' if bucket_facts else 'empty')),
                'lag_seconds': float(materialization.get('lag_seconds') or 0.0),
                'bucket_fact_count': len(bucket_facts),
                'anomaly_count': len(anomaly_markers),
                'session_summary_state': 'complete' if bucket_facts else 'empty',
            },
        },
        timeout=cache_ttl,
    )


def _persist_order_flow_signal(*, symbol: str, result: dict, runtime_settings: dict) -> dict:
    from portfolio.models import OrderFlowSignal

    strength = float(result.get('strength', 0) or 0)
    signal_type = str(result.get('signal_type', OrderFlowSignal.SignalType.NONE) or OrderFlowSignal.SignalType.NONE)
    if signal_type == OrderFlowSignal.SignalType.NONE and strength <= 20:
        return {'persisted': False, 'created': False, 'signal_id': None, 'strength': strength}

    components = dict(result.get('components') or {})
    tick_rate_info = components.get('tick_rate', {}) or {}
    size_dist = components.get('size_distribution', {}) or {}
    cvd_change = float((components.get('absorption', {}) or {}).get('cvd_change', 0) or 0)
    triggered_at = str(result.get('triggered_at') or timezone.now().isoformat())
    event_id = f'dark_flow:{symbol}:{triggered_at}:{signal_type}'
    severity = _classify_order_flow_signal_severity(
        strength=strength,
        confidence=str(result.get('confidence', 'low') or 'low'),
        cvd_change=cvd_change,
    )

    signal, created = OrderFlowSignal.objects.update_or_create(
        event_id=event_id,
        defaults={
            'symbol': symbol,
            'signal_type': signal_type,
            'strength': strength,
            'confidence': result.get('confidence', 'low'),
            'tick_rate': tick_rate_info.get('tick_rate_per_min', 0),
            'small_order_ratio': size_dist.get('small_ratio', 0),
            'cvd_at_signal': cvd_change,
            'price_at_signal': 0,
            'window_seconds': int(runtime_settings.get('window_seconds', 300) or 300),
            'components_json': components,
            'severity': severity,
        },
    )
    _cache_latest_order_flow_signal(signal, triggered_at=triggered_at, result=result)
    retention_policy = get_global_signal_retention_policy()
    forensic_window = None
    if should_materialize_money_flow_forensic_window(severity, retention_policy):
        forensic_window = materialize_money_flow_forensic_window_from_order_flow_signal(signal, policy=retention_policy)
    return {
        'persisted': True,
        'created': bool(created),
        'signal_id': int(signal.id),
        'strength': strength,
        'triggered_at': triggered_at,
        'severity': severity,
        'forensic_window_created': bool(forensic_window and forensic_window.get('created')),
        'forensic_window_id': int(forensic_window.get('window_id') or 0) if forensic_window else None,
        'forensic_window_raw_tick_count': int(forensic_window.get('raw_tick_count') or 0) if forensic_window else 0,
    }


@shared_task(bind=True, name='portfolio.tasks.distribute_order_flow_signal', autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 0})
def distribute_order_flow_signal(self, signal_id: int, triggered_at: str | None = None) -> dict:
    del self
    from portfolio.models import OrderFlowSignal
    from portfolio.services_global_signal_distribution import deliver_dark_flow_signal

    try:
        signal = OrderFlowSignal.objects.get(id=signal_id)
    except OrderFlowSignal.DoesNotExist:
        return {'status': 'missing', 'signal_id': int(signal_id or 0)}

    strength = float(signal.strength or 0)
    if strength <= DARK_FLOW_DISTRIBUTION_MIN_STRENGTH:
        return {'status': 'skipped', 'reason': 'below_distribution_threshold', 'signal_id': signal.id}

    services_config = get_global_signal_services_config()
    distribution_config = (services_config.get('distribution') or {}) if isinstance(services_config, dict) else {}
    websocket_enabled = bool(distribution_config.get('websocket_enabled', True))
    history_enabled = bool(distribution_config.get('history_enabled', True))

    signal_type = str(signal.signal_type or OrderFlowSignal.SignalType.NONE)
    components = signal.components_json or {}
    tick_rate_info = components.get('tick_rate', {}) or {}
    size_dist = components.get('size_distribution', {}) or {}
    iceberg = components.get('iceberg', {}) or {}
    cvd_change = float(signal.cvd_at_signal or 0)
    event_timestamp = str(triggered_at or signal.created_at.isoformat())

    if iceberg.get('level'):
        description = (
            f"Phát hiện {iceberg.get('repeat_count', 0)} lệnh lặp tại "
            f"{iceberg.get('level', 0):,.0f} VND"
        )
    else:
        description = f'Tín hiệu {signal_type} strength={strength:.0f}'

    advisory_events = 0

    delivery_result = {
        'status': 'ok',
        'audience_rows': [],
        'history_count': 0,
        'symbol_broadcast_count': 0,
        'user_broadcast_count': 0,
    }
    try:
        delivery_result = deliver_dark_flow_signal(
            symbol=signal.symbol,
            payload={
                'contract_version': '1.0',
                'symbol': signal.symbol,
                'signal_type': signal_type,
                'strength': strength,
                'confidence': signal.confidence,
                'tick_rate': tick_rate_info.get('tick_rate_per_min', 0),
                'small_order_ratio': size_dist.get('small_ratio', 0),
                'cvd_at_signal': cvd_change,
                'description': description,
                'event_id': signal.event_id,
                'ts': event_timestamp,
                'severity': signal.severity,
            },
            message=f'Dòng tiền tối {signal.symbol}: {description}.',
            matched_at=signal.created_at,
            websocket_enabled=websocket_enabled,
            history_enabled=history_enabled,
        )
    except Exception as exc:
        logger.warning('dark_flow delivery failed for %s: %s', signal.symbol, exc)

    try:
        from portfolio import tasks as tasks_facade

        for audience_row in delivery_result.get('audience_rows') or []:
            user_id = int(audience_row.get('user_id') or 0)
            if not user_id:
                continue
            user_cfg = UserConfig.objects.filter(user_id=user_id).first()
            if user_cfg is None:
                continue
            if not bool(user_cfg.advisory_whale_signal_enabled):
                continue
            threshold_vnd = tasks_facade._resolve_advisory_threshold_vnd(
                user_cfg,
                tracked_threshold_million=audience_row.get('tracked_threshold_million'),
            )
            threshold_source = 'symbol_override' if audience_row.get('tracked_threshold_million') is not None else 'user_default'
            tasks_facade._accumulate_user_advisory_event(
                user_id=user_id,
                symbol=signal.symbol,
                source='dark_flow',
                payload={
                    'strength': strength,
                    'signal_type': signal_type,
                    'cvd_change': cvd_change,
                    'confidence': signal.confidence,
                    'matched_value_vnd': threshold_vnd,
                },
                threshold_vnd=threshold_vnd,
                threshold_source=threshold_source,
            )
            advisory_events += 1
    except Exception as exc:
        logger.warning('dark_flow advisory distribution failed for %s: %s', signal.symbol, exc)

    return {
        'status': 'ok',
        'signal_id': signal.id,
        'symbol': signal.symbol,
        'audience_count': len(delivery_result.get('audience_rows') or []),
        'websocket_pushes': int(delivery_result.get('symbol_broadcast_count', 0)) + int(delivery_result.get('user_broadcast_count', 0)),
        'user_history_count': int(delivery_result.get('history_count', 0)),
        'advisory_events': advisory_events,
    }


@shared_task(bind=True, name='portfolio.tasks.detect_and_store_order_flow', autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 0})
def detect_and_store_order_flow(self, symbol: str | None = None, run_id: int | None = None) -> dict:
    """Run global dark-flow detection for effective-universe symbols and persist canonical signals."""
    task_id = getattr(getattr(self, 'request', None), 'id', None)
    if run_id:
        run = start_signal_service_run(SignalServiceRun.objects.get(id=run_id), task_id=task_id)
    else:
        run = create_signal_service_run(
            service_domain=SignalServiceRun.ServiceDomain.DARK_FLOW,
            run_type=resolve_signal_run_type(symbol),
            params_json={'symbol': str(symbol).strip().upper()} if str(symbol or '').strip() else {},
            task_id=task_id,
        )

    runtime_settings = _resolve_dark_flow_runtime_settings()
    if not getattr(settings, 'ORDER_FLOW_DETECTION_ENABLED', True) or not runtime_settings.get('enabled', True):
        finish_signal_service_run(
            run,
            status=SignalServiceRun.StatusChoices.COMPLETED,
            processed_items=0,
            stored_items=0,
            failed_items=0,
            progress_pct=100.0,
            log='Dark-flow detection disabled by runtime settings.',
        )
        return {'status': 'disabled', 'run_id': run.id}

    from portfolio.order_flow import detect_dark_flow

    symbols = _resolve_order_flow_symbols(symbol)

    processed = 0
    stored = 0
    distribution_queued = 0
    errors = 0

    try:
        for sym in symbols:
            lock_key = f'order_flow_lock:{sym}'
            if cache.get(lock_key):
                continue

            try:
                result = detect_dark_flow(
                    sym,
                    window_minutes=max(int(runtime_settings.get('window_seconds', 300) or 300) // 60, 1),
                )
            except Exception as exc:
                logger.warning('detect_dark_flow error for %s: %s', sym, exc)
                errors += 1
                continue

            processed += 1
            persisted = _persist_order_flow_signal(symbol=sym, result=result, runtime_settings=runtime_settings)
            if not persisted.get('persisted'):
                continue

            cache.set(lock_key, True, timeout=int(runtime_settings.get('cooldown_seconds', ORDER_FLOW_COOLDOWN_SECONDS) or ORDER_FLOW_COOLDOWN_SECONDS))
            if persisted.get('created'):
                stored += 1

            if persisted.get('created') and float(persisted.get('strength', 0) or 0) > DARK_FLOW_DISTRIBUTION_MIN_STRENGTH:
                try:
                    distribute_order_flow_signal.delay(
                        signal_id=int(persisted.get('signal_id') or 0),
                        triggered_at=str(persisted.get('triggered_at') or ''),
                    )
                    distribution_queued += 1
                except Exception as exc:
                    logger.warning('dark_flow distribution enqueue failed for %s: %s', sym, exc)

        logger.info(
            'detect_and_store_order_flow: symbols=%d processed=%d stored=%d distribution_queued=%d errors=%d',
            len(symbols), processed, stored, distribution_queued, errors,
        )
        status_value = resolve_signal_run_status(errors=errors, processed_items=processed, stored_items=stored)
        finish_signal_service_run(
            run,
            status=status_value,
            processed_items=processed,
            stored_items=stored,
            failed_items=errors,
            progress_pct=100.0,
            log=f'order_flow symbols={len(symbols)} processed={processed} stored={stored} queued={distribution_queued} errors={errors}',
        )
        return {
            'status': 'ok',
            'symbols': len(symbols),
            'processed': processed,
            'stored': stored,
            'alerted': distribution_queued,
            'distribution_queued': distribution_queued,
            'errors': errors,
            'run_id': run.id,
        }
    except Exception as exc:
        finish_signal_service_run(
            run,
            status=SignalServiceRun.StatusChoices.FAILED,
            processed_items=processed,
            stored_items=stored,
            failed_items=max(errors, 1),
            progress_pct=100.0,
            log=f'order_flow exception: {exc}',
        )
        raise


@shared_task(bind=True, name='portfolio.tasks.detect_whale_reversal', autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 0})
def detect_whale_reversal(self, symbol: str | None = None) -> dict:
    """Detect reversal signals and queue reversal advisories for tracked users."""
    if not getattr(settings, 'REVERSAL_DETECTION_ENABLED', True):
        return {'status': 'disabled'}

    if symbol:
        symbols = [str(symbol).strip().upper()]
    else:
        tracked = list(TrackedSymbol.objects.values_list('symbol', flat=True).distinct())
        watchlisted = list(WatchlistItem.objects.values_list('symbol', flat=True).distinct())
        symbols = sorted({str(s).strip().upper() for s in tracked + watchlisted if s})[:ORDER_FLOW_MAX_SYMBOLS]

    queued = 0
    processed = 0
    skipped_locked = 0

    from portfolio import tasks as tasks_facade

    for sym in symbols:
        lock_key = f'reversal_alert_lock:{sym}'
        lock_seconds = max(int(os.getenv('REVERSAL_COOLDOWN_SECONDS', '300')), 60)
        if not cache.add(lock_key, timezone.now().isoformat(), timeout=lock_seconds):
            skipped_locked += 1
            continue

        signal = tasks_facade._detect_reversal_signal(sym)
        if not signal:
            continue

        processed += 1
        tracked_user_ids = list(
            TrackedSymbol.objects.filter(symbol=sym).values_list('user_id', flat=True).distinct()
        )
        if not tracked_user_ids:
            continue

        for user_id in tracked_user_ids:
            user_cfg = UserConfig.objects.filter(user_id=user_id).first()
            if user_cfg is None:
                continue
            if not bool(user_cfg.advisory_whale_signal_enabled):
                continue

            threshold_vnd = float(user_cfg.whale_alert_threshold or 500) * 1_000_000
            tasks_facade.generate_whale_advisory_task.apply_async(
                kwargs={
                    'symbol': sym,
                    'matched_value_vnd': signal['sell_value_vnd'],
                    'side': 'SELL',
                    'threshold': threshold_vnd,
                    'force_refresh': True,
                    'user_id': user_id,
                    'source': WhaleAdvisory.SourceChoices.WHALE_SIGNAL,
                    'advisory_type': WhaleAdvisory.AdvisoryTypeChoices.REVERSAL,
                    'severity_override': WhaleAdvisory.SeverityChoices.URGENT,
                },
                countdown=1,
            )
            queued += 1

    return {
        'status': 'ok',
        'symbols': len(symbols),
        'processed': processed,
        'queued': queued,
        'skipped_locked': skipped_locked,
    }
