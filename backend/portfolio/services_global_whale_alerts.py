from __future__ import annotations

from datetime import date, datetime, timezone as datetime_timezone

import pandas as pd

from django.core.cache import cache

from django.utils import timezone

from portfolio.domain_constants import WHALE_CONFIG_VERSION
from portfolio.global_signal_policy_helpers import get_global_signal_services_config
from portfolio.models import IntradayTick
from portfolio.models import WhaleAlertEvent
from portfolio.observability import record_whale_event_observation
from portfolio.realtime.compute import build_whale_payload, detect_whale_signals
from portfolio.services_global_signal_universe import GlobalSignalUniverseResolver

GLOBAL_WHALE_LATEST_EVENT_CACHE_PREFIX = 'global_signal:whale:latest_by_symbol'
REALTIME_UNIVERSE_SNAPSHOT_CACHE_KEY = 'realtime:universe:snapshot'


def _latest_whale_alert_event_cache_key(symbol: str) -> str:
    return f'{GLOBAL_WHALE_LATEST_EVENT_CACHE_PREFIX}:{str(symbol or "").strip().upper()}'


def _coerce_occurred_at(value) -> datetime:
    if isinstance(value, datetime):
        resolved = value
    elif value:
        resolved = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    else:
        resolved = timezone.now()

    if timezone.is_naive(resolved):
        resolved = timezone.make_aware(resolved, timezone.get_current_timezone())
    return resolved.astimezone(datetime_timezone.utc).replace(microsecond=0)


def build_whale_alert_event_id(
    *,
    symbol: str,
    occurred_at,
    side: str,
    matched_value_vnd: float,
    source_key: str,
) -> str:
    normalized_symbol = str(symbol or '').strip().upper()
    normalized_side = str(side or WhaleAlertEvent.SideChoices.UNKNOWN).strip().upper() or WhaleAlertEvent.SideChoices.UNKNOWN
    normalized_source = str(source_key or 'unknown').strip().lower().replace(' ', '_') or 'unknown'
    normalized_occurred_at = _coerce_occurred_at(occurred_at).isoformat()
    resolved_value = int(round(float(matched_value_vnd or 0)))
    return f'whale:{normalized_symbol}:{normalized_occurred_at}:{normalized_side}:{resolved_value}:{normalized_source}'


def persist_whale_alert_event(
    *,
    event_id: str | None = None,
    symbol: str,
    side: str,
    matched_value_vnd: float,
    threshold_vnd: float,
    severity: str,
    event_score: float,
    confidence: str,
    source: str,
    source_layer: str,
    occurred_at=None,
    trade_date: date | None = None,
    market_wide: bool = False,
    is_market_discovery: bool = False,
    payload_json: dict | None = None,
    threshold_policy_version: str = WHALE_CONFIG_VERSION,
) -> tuple[WhaleAlertEvent, bool]:
    normalized_symbol = str(symbol or '').strip().upper()
    normalized_occured_at = _coerce_occurred_at(occurred_at)
    resolved_trade_date = trade_date or timezone.localdate(normalized_occured_at)
    resolved_event_id = str(event_id or '').strip() or build_whale_alert_event_id(
        symbol=normalized_symbol,
        occurred_at=normalized_occured_at,
        side=side,
        matched_value_vnd=matched_value_vnd,
        source_key=source,
    )

    event, created = WhaleAlertEvent.objects.update_or_create(
        event_id=resolved_event_id,
        defaults={
            'symbol': normalized_symbol,
            'side': str(side or WhaleAlertEvent.SideChoices.UNKNOWN).strip().upper() or WhaleAlertEvent.SideChoices.UNKNOWN,
            'matched_value_vnd': int(round(float(matched_value_vnd or 0))),
            'threshold_vnd': int(round(float(threshold_vnd or 0))),
            'threshold_policy_version': str(threshold_policy_version or WHALE_CONFIG_VERSION),
            'severity': str(severity or WhaleAlertEvent.SeverityChoices.INFO).strip().lower() or WhaleAlertEvent.SeverityChoices.INFO,
            'event_score': float(event_score or 0.0),
            'confidence': str(confidence or 'medium').strip().lower() or 'medium',
            'source': str(source or 'unknown').strip(),
            'source_layer': str(source_layer or 'batch').strip().lower() or 'batch',
            'trade_date': resolved_trade_date,
            'occurred_at': normalized_occured_at,
            'market_wide': bool(market_wide),
            'is_market_discovery': bool(is_market_discovery),
            'payload_json': dict(payload_json or {}),
        },
    )
    return event, created


def _resolve_global_whale_runtime_settings() -> dict:
    config = get_global_signal_services_config()
    whale_config = (config.get('whale_service') or {}) if isinstance(config, dict) else {}
    return {
        'enabled': bool((config or {}).get('enabled', True)) and bool(whale_config.get('enabled', True)),
        'default_threshold_vnd': max(int(whale_config.get('default_threshold_vnd', 500_000_000) or 500_000_000), 1),
        'cooldown_seconds': max(int(whale_config.get('cooldown_seconds', 120) or 120), 60),
        'manual_run_limit': max(int(whale_config.get('manual_run_limit', 200) or 200), 1),
    }


def _resolve_global_whale_symbols(symbol: str | None = None, *, limit: int) -> list[str]:
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
        for row in snapshot.get('rows') or []:
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

    return resolved_symbols[:limit]


def _confidence_from_payload(payload: dict) -> str:
    event_score = float(payload.get('event_score') or 0.0)
    if event_score >= 8.0:
        return 'high'
    if event_score >= 5.0:
        return 'medium'
    return 'low'


def _normalize_candidate_frame(rows: list[dict]) -> pd.DataFrame:
    return pd.DataFrame.from_records(rows or [])


def _build_stream_frame(symbol: str):
    from portfolio.adapters.vnbroker_adapter import read_stream_intraday_ticks
    from portfolio.market_data_service import market_data_service

    stream_ticks = read_stream_intraday_ticks(symbol, count=500)
    rows = []
    for tick in stream_ticks or []:
        raw_price = market_data_service._normalize_intraday_price_vnd(
            tick.get('price') or 0,
            source_unit=tick.get('price_unit'),
        )
        if raw_price is None:
            continue
        try:
            raw_volume = float(tick.get('volume') or 0)
        except (TypeError, ValueError):
            continue
        if raw_volume <= 0:
            continue
        rows.append(
            {
                'price': raw_price,
                'volume': raw_volume,
                'side': tick.get('side') or tick.get('match_type') or 'UNKNOWN',
                'ts': tick.get('ts'),
            }
        )
    return _normalize_candidate_frame(rows)


def _build_intraday_db_frame(symbol: str):
    from portfolio.market_data_service import market_data_service

    db_rows = list(
        IntradayTick.objects.filter(symbol=symbol, trade_date=timezone.localdate())
        .order_by('-trade_time', '-id')
        .values('trade_date', 'trade_time', 'price', 'volume', 'match_type', 'side')
    )
    rows = []
    for row in db_rows:
        raw_price = market_data_service._normalize_intraday_price_vnd(row.get('price') or 0)
        if raw_price is None:
            continue
        try:
            raw_volume = float(row.get('volume') or 0)
        except (TypeError, ValueError):
            continue
        if raw_volume <= 0:
            continue
        occurred_at = market_data_service._to_intraday_event_iso(row.get('trade_time'), fallback_date=row.get('trade_date'))
        rows.append(
            {
                'price': raw_price,
                'volume': raw_volume,
                'side': row.get('side') or row.get('match_type') or 'UNKNOWN',
                'ts': occurred_at,
            }
        )
    return _normalize_candidate_frame(rows)


def _build_vnbroker_frame(symbol: str):
    from portfolio.adapters.vnbroker_adapter import fetch_intraday_dataframe
    from portfolio.market_data_service import market_data_service

    frame = fetch_intraday_dataframe(symbol, 500)
    if frame is None or frame.empty:
        return pd.DataFrame()

    rows = []
    source_unit = None
    if getattr(frame, 'attrs', None):
        source_unit = frame.attrs.get('price_unit_canonical')

    for _, row in frame.iterrows():
        raw_price = market_data_service._normalize_intraday_price_vnd(
            row.get('price') or row.get('close') or 0,
            source_unit=row.get('price_unit') or source_unit,
        )
        if raw_price is None:
            continue
        try:
            raw_volume = float(row.get('volume') or row.get('vol') or row.get('matchVolume') or 0)
        except (TypeError, ValueError):
            continue
        if raw_volume <= 0:
            continue
        occurred_at = market_data_service._to_intraday_event_iso(
            row.get('time') or row.get('tradingDate'),
            fallback_date=timezone.localdate(),
        )
        rows.append(
            {
                'price': raw_price,
                'volume': raw_volume,
                'side': row.get('side') or row.get('match_type') or row.get('matchType') or 'UNKNOWN',
                'ts': occurred_at,
            }
        )
    return _normalize_candidate_frame(rows)


def _build_whale_payloads_for_symbol(symbol: str, *, threshold_vnd: float) -> tuple[list[dict], str]:
    candidate_frames = [
        ('redis_stream', _build_stream_frame(symbol)),
        ('intraday_tick_db', _build_intraday_db_frame(symbol)),
        ('vnbroker', _build_vnbroker_frame(symbol)),
    ]

    for source, frame in candidate_frames:
        if frame is None or frame.empty:
            continue
        signals = detect_whale_signals(symbol=symbol, trades_df=frame, thresholds=[threshold_vnd])
        if not signals:
            continue
        payloads = [
            build_whale_payload(
                signal=signal,
                seq=index,
                source=source,
                threshold_source='discovery_global',
            )
            for index, signal in enumerate(signals, start=1)
        ]
        return payloads, source

    return [], 'none'


def _cache_latest_whale_alert_event(event: WhaleAlertEvent) -> None:
    cache.set(
        _latest_whale_alert_event_cache_key(event.symbol),
        {
            'event_id': event.event_id,
            'symbol': event.symbol,
            'side': event.side,
            'matched_value_vnd': int(event.matched_value_vnd or 0),
            'threshold_vnd': int(event.threshold_vnd or 0),
            'severity': event.severity,
            'event_score': float(event.event_score or 0.0),
            'source': event.source,
            'source_layer': event.source_layer,
            'trade_date': event.trade_date.isoformat(),
            'occurred_at': event.occurred_at.isoformat(),
        },
        timeout=900,
    )


def run_global_whale_alert_detection(symbol: str | None = None) -> dict:
    runtime_settings = _resolve_global_whale_runtime_settings()
    if not runtime_settings.get('enabled', True):
        return {'status': 'disabled'}

    threshold_vnd = float(runtime_settings['default_threshold_vnd'])
    cooldown_seconds = int(runtime_settings['cooldown_seconds'])
    symbols = _resolve_global_whale_symbols(symbol, limit=int(runtime_settings['manual_run_limit']))

    processed = 0
    created_count = 0
    updated_count = 0
    cached_count = 0
    skipped_locked = 0
    errors = 0
    created_event_ids: list[int] = []

    for normalized_symbol in symbols:
        lock_key = f'global_whale_alert_lock:{normalized_symbol}'
        if cache.get(lock_key):
            skipped_locked += 1
            continue

        try:
            payloads, source = _build_whale_payloads_for_symbol(normalized_symbol, threshold_vnd=threshold_vnd)
        except Exception:
            errors += 1
            continue

        if not payloads:
            continue

        processed += 1
        for payload in payloads:
            event, created = persist_whale_alert_event(
                event_id=payload.get('event_id'),
                symbol=payload.get('symbol') or normalized_symbol,
                side=str(payload.get('side') or WhaleAlertEvent.SideChoices.UNKNOWN).upper(),
                matched_value_vnd=float(payload.get('matched_value') or 0),
                threshold_vnd=float(payload.get('threshold') or threshold_vnd),
                severity=payload.get('severity') or WhaleAlertEvent.SeverityChoices.INFO,
                event_score=float(payload.get('event_score') or 0.0),
                confidence=_confidence_from_payload(payload),
                source=payload.get('source') or source,
                source_layer=payload.get('source_layer') or 'live',
                occurred_at=payload.get('ts'),
                trade_date=timezone.localdate(_coerce_occurred_at(payload.get('ts'))),
                market_wide=False,
                is_market_discovery=bool(payload.get('market_wide') or False),
                payload_json=payload,
                threshold_policy_version=payload.get('config_version') or WHALE_CONFIG_VERSION,
            )
            if created:
                created_count += 1
                created_event_ids.append(event.id)
            else:
                updated_count += 1
            _cache_latest_whale_alert_event(event)
            cached_count += 1
            record_whale_event_observation(
                source=str(payload.get('source') or source or 'unknown'),
                ts=payload.get('ts'),
                recovered=bool(payload.get('recovered')),
            )

        cache.set(lock_key, timezone.now().isoformat(), timeout=cooldown_seconds)

    return {
        'status': 'ok',
        'symbols': len(symbols),
        'processed': processed,
        'created': created_count,
        'updated': updated_count,
        'cached': cached_count,
        'skipped_locked': skipped_locked,
        'errors': errors,
        'created_event_ids': created_event_ids,
    }
