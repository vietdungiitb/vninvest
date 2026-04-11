"""
whale_feed_helpers.py
Extracted helper functions for the Whale Feed / Aggregate Event pipeline.
S23-04 views decomposition — extracted from views.py.
"""
from __future__ import annotations

import base64
import json
import logging
import os
from datetime import date, datetime, time, timedelta

from django.core.cache import cache
from django.utils import timezone

from .adapters.vnstock_adapter import fetch_intraday_dataframe
from .domain_constants import (
    WHALE_AGGREGATE_VNSTOCK_MAX_SYMBOLS_DEFAULT,
    WHALE_CONFIG_VERSION,
    classify_whale_size_class,
    resolve_user_whale_threshold_vnd,
)
from .exceptions import ExternalSystemException
from .models import TrackedSymbol, UserConfig, WatchlistGroup
from .whale_scoring import calculate_display_score, calculate_event_score

logger = logging.getLogger(__name__)

WHALE_AGGREGATE_WINDOW_OPTIONS = {'5m', '15m', '1h', 'session', '5d'}

# ---------------------------------------------------------------------------
# Cache helpers — silent fallback if Redis is unavailable
# ---------------------------------------------------------------------------

def _cache_get(key):
    try:
        return cache.get(key)
    except Exception:
        return None


def _cache_set(key, value, timeout):
    try:
        cache.set(key, value, timeout=timeout)
    except Exception:
        pass


def _is_rate_limited_error(exc: Exception) -> bool:
    message = str(exc or '').lower()
    return (
        '429' in message
        or 'too many requests' in message
        or 'rate limit' in message
        or 'giới hạn api' in message
    )


def _vnstock_rate_limit_cache_key(channel: str = 'intraday') -> str:
    normalized_channel = str(channel or 'default').strip().lower() or 'default'
    return f'vnstock:rate-limit:{normalized_channel}'


def _is_vnstock_rate_limited(channel: str = 'intraday') -> bool:
    return bool(_cache_get(_vnstock_rate_limit_cache_key(channel)))


def _mark_vnstock_rate_limited(channel: str = 'intraday', exc: Exception | None = None) -> None:
    cooldown_seconds = max(int(os.getenv('VNSTOCK_RATE_LIMIT_COOLDOWN_SECONDS', '20')), 5)
    _cache_set(
        _vnstock_rate_limit_cache_key(channel),
        {
            'triggered_at': timezone.now().isoformat(),
            'reason': str(exc or '')[:200],
        },
        timeout=cooldown_seconds,
    )


# ---------------------------------------------------------------------------
# Aggregate / vnstock fallback guards
# ---------------------------------------------------------------------------

def _allow_vnstock_aggregate_fallback(symbols: list[str]) -> bool:
    max_symbols = max(int(os.getenv('WHALE_AGGREGATE_VNSTOCK_MAX_SYMBOLS', str(WHALE_AGGREGATE_VNSTOCK_MAX_SYMBOLS_DEFAULT))), 0)
    if max_symbols == 0:
        return False
    return len(symbols) <= max_symbols


def _resolve_user_whale_threshold_vnd(user, symbol: str | None = None) -> tuple[float, str]:
    config = UserConfig.objects.filter(user=user).values('whale_alert_threshold').first()
    base_threshold_vnd = resolve_user_whale_threshold_vnd((config or {}).get('whale_alert_threshold'))
    if not symbol:
        return base_threshold_vnd, 'user_default'

    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return base_threshold_vnd, 'user_default'

    override = (
        TrackedSymbol.objects
        .filter(user=user, symbol=normalized_symbol)
        .values('whale_alert_threshold_million')
        .first()
    )
    if override and override.get('whale_alert_threshold_million') is not None:
        return resolve_user_whale_threshold_vnd(override.get('whale_alert_threshold_million')), 'symbol_override'
    return base_threshold_vnd, 'user_default'


def _get_user_whale_threshold_vnd(user, symbol: str | None = None) -> float:
    threshold_vnd, _ = _resolve_user_whale_threshold_vnd(user, symbol=symbol)
    return threshold_vnd


def _get_user_symbol_threshold_overrides_vnd(user, symbols: list[str] | None = None) -> dict[str, float]:
    queryset = TrackedSymbol.objects.filter(user=user, whale_alert_threshold_million__isnull=False)
    if symbols:
        normalized_symbols = [str(symbol).strip().upper() for symbol in symbols if str(symbol).strip()]
        queryset = queryset.filter(symbol__in=normalized_symbols)

    overrides = {}
    for row in queryset.values('symbol', 'whale_alert_threshold_million'):
        symbol = str(row.get('symbol') or '').strip().upper()
        if not symbol:
            continue
        overrides[symbol] = resolve_user_whale_threshold_vnd(row.get('whale_alert_threshold_million'))
    return overrides


# ---------------------------------------------------------------------------
# Signal normalisation
# ---------------------------------------------------------------------------

def _normalize_signal_side(side_value: str) -> str:
    side_raw = str(side_value or '').strip().lower()
    if side_raw in ('buy', 'bu', 'b'):
        return 'buy'
    if side_raw in ('sell', 'sd', 's'):
        return 'sell'
    return 'neutral'


def _classify_signal_size(matched_value: float) -> str:
    return classify_whale_size_class(matched_value)


# ---------------------------------------------------------------------------
# Cursor encode / decode
# ---------------------------------------------------------------------------

def _encode_whale_feed_cursor(payload: dict) -> str:
    raw = json.dumps(payload, separators=(',', ':')).encode('utf-8')
    return base64.urlsafe_b64encode(raw).decode('ascii')


def _decode_whale_feed_cursor(raw_cursor: str | None) -> dict | None:
    if not raw_cursor:
        return None
    try:
        padded = raw_cursor + '=' * (-len(raw_cursor) % 4)
        decoded = base64.urlsafe_b64decode(padded.encode('ascii')).decode('utf-8')
        payload = json.loads(decoded)
        return payload if isinstance(payload, dict) else None
    except (ValueError, TypeError, json.JSONDecodeError):
        return None


def _parse_aggregate_window(window_raw: str | None) -> str:
    normalized = str(window_raw or 'session').strip().lower() or 'session'
    if normalized not in WHALE_AGGREGATE_WINDOW_OPTIONS:
        raise ValueError('window_invalid')
    return normalized


def _window_start_datetime(window: str, now=None):
    resolved_now = now or timezone.now()
    normalized = str(window or 'session').strip().lower()
    local_now = timezone.localtime(resolved_now)
    market_open_time = time(
        hour=int(os.getenv('WHALE_MARKET_OPEN_HOUR', '9')),
        minute=int(os.getenv('WHALE_MARKET_OPEN_MINUTE', '0')),
    )
    today_session_start = timezone.make_aware(
        datetime.combine(local_now.date(), market_open_time),
        timezone.get_current_timezone(),
    )
    if normalized == 'session':
        return today_session_start
    if normalized == '5m':
        return resolved_now - timedelta(minutes=5)
    if normalized == '15m':
        return resolved_now - timedelta(minutes=15)
    if normalized == '1h':
        return resolved_now - timedelta(hours=1)
    if normalized == '5d':
        anchor_date = local_now.date() - timedelta(days=4)
        return timezone.make_aware(
            datetime.combine(anchor_date, market_open_time),
            timezone.get_current_timezone(),
        )
    return None


def _is_event_timestamp_in_window(ts_value, window: str, now=None) -> bool:
    normalized = str(window or 'session').strip().lower()
    resolved_now = now or timezone.now()

    if not ts_value:
        return False

    try:
        event_dt = datetime.fromisoformat(str(ts_value).replace('Z', '+00:00'))
    except Exception:
        return False
    if timezone.is_naive(event_dt):
        event_dt = timezone.make_aware(event_dt, timezone.get_current_timezone())

    start_dt = _window_start_datetime(normalized, now=resolved_now)
    if start_dt is None:
        return True
    return start_dt <= event_dt <= resolved_now


def _is_tick_row_in_window(row, window: str, now=None) -> bool:
    normalized = str(window or 'session').strip().lower()
    resolved_now = now or timezone.now()

    try:
        row_dt = timezone.make_aware(
            datetime.combine(getattr(row, 'trade_date'), getattr(row, 'trade_time')),
            timezone.get_current_timezone(),
        )
    except Exception:
        return False

    start_dt = _window_start_datetime(normalized, now=resolved_now)
    if start_dt is None:
        return True
    return start_dt <= row_dt <= resolved_now


# ---------------------------------------------------------------------------
# Symbol resolution
# ---------------------------------------------------------------------------

def _resolve_whale_feed_symbols(request) -> tuple[list[str], str, list[int], str]:
    scope_raw = str(request.query_params.get('scope', '') or '').strip().lower()
    explicit_symbols = request.query_params.get('symbols', '')
    watchlist_group_ids_raw = request.query_params.get('watchlist_group_ids', '')

    def _parse_watchlist_group_ids(raw_value: str) -> list[int]:
        parsed_ids = []
        for chunk in str(raw_value or '').split(','):
            chunk = str(chunk).strip()
            if not chunk:
                continue
            try:
                parsed_ids.append(int(chunk))
            except (TypeError, ValueError):
                continue
        return sorted(set(parsed_ids))

    if scope_raw in ('custom', 'symbols'):
        symbols = sorted({
            str(symbol).strip().upper()
            for symbol in explicit_symbols.split(',')
            if str(symbol).strip()
        })
        return symbols, 'custom', [], 'query_scope'

    if scope_raw == 'watchlist':
        group_ids = _parse_watchlist_group_ids(watchlist_group_ids_raw)
        groups = WatchlistGroup.objects.filter(user=request.user, id__in=group_ids).prefetch_related('items')
        symbols = sorted({item.symbol.upper() for group in groups for item in group.items.all()})
        return symbols, 'watchlist', group_ids, 'query_scope'

    if scope_raw == 'tracked':
        tracked_symbols = list(
            TrackedSymbol.objects.filter(user=request.user)
            .order_by('-added_at')
            .values_list('symbol', flat=True)
        )
        symbols = sorted({str(symbol).strip().upper() for symbol in tracked_symbols if str(symbol).strip()})
        return symbols, 'tracked', [], 'query_scope'

    if explicit_symbols:
        symbols = sorted({
            str(symbol).strip().upper()
            for symbol in explicit_symbols.split(',')
            if str(symbol).strip()
        })
        return symbols, 'custom', [], 'symbols_param'

    if watchlist_group_ids_raw:
        group_ids = _parse_watchlist_group_ids(watchlist_group_ids_raw)
        groups = WatchlistGroup.objects.filter(user=request.user, id__in=group_ids).prefetch_related('items')
        symbols = sorted({item.symbol.upper() for group in groups for item in group.items.all()})
        return symbols, 'watchlist', group_ids, 'watchlist_param'

    tracked_symbols = list(
        TrackedSymbol.objects.filter(user=request.user)
        .order_by('-added_at')
        .values_list('symbol', flat=True)
    )
    symbols = sorted({str(symbol).strip().upper() for symbol in tracked_symbols if str(symbol).strip()})
    return symbols, 'tracked', [], 'default_tracked'


# ---------------------------------------------------------------------------
# Tick / event payload builders
# ---------------------------------------------------------------------------

def _build_tick_timestamp(row) -> str:
    try:
        dt = timezone.make_aware(
            datetime.combine(row.trade_date, row.trade_time),
            timezone.get_current_timezone(),
        )
        return dt.isoformat()
    except Exception:
        return row.created_at.isoformat() if getattr(row, 'created_at', None) else timezone.now().isoformat()


def _build_aggregate_event_payload(
    row,
    threshold_vnd: float,
    threshold_source: str = 'user_default',
    score_config: dict | None = None,
    now=None,
) -> dict:
    matched_value = float(getattr(row, 'matched_value', 0) or 0)
    occurred_at = _build_tick_timestamp(row)
    score_result = calculate_event_score(
        trade={
            'matched_value': matched_value,
            'threshold': threshold_vnd,
            'side': getattr(row, 'side', ''),
        },
        context={
            'threshold_vnd': threshold_vnd,
            'side': getattr(row, 'side', ''),
        },
        config=score_config,
    )
    display_result = calculate_display_score(
        event_score=score_result['event_score'],
        occurred_at=occurred_at,
        now=now,
        config=score_config,
    )
    return {
        'id': row.id,
        'event_id': f'tick:{row.id}',
        'contract_version': '1.0',
        'config_version': WHALE_CONFIG_VERSION,
        'weights_version': score_result['weights_version'],
        'symbol': row.symbol.upper(),
        'side': _normalize_signal_side(getattr(row, 'side', '')),
        'matched_value': round(matched_value, 2),
        'volume': int(getattr(row, 'volume', 0) or 0),
        'threshold': threshold_vnd,
        'threshold_source': str(threshold_source or 'user_default'),
        'size_class': _classify_signal_size(matched_value),
        'ts': occurred_at,
        'alert_at': occurred_at,
        'alert_first_seen_at': occurred_at,
        'source': 'intraday_tick_db',
        'event_score': score_result['event_score'],
        'display_score': display_result['display_score'],
        'severity': display_result['severity'],
        'score_breakdown': score_result['score_breakdown'],
        'normalized_features': score_result['normalized_features'],
        'raw_features': score_result['raw_features'],
        'score_decay': {
            'age_seconds': display_result['age_seconds'],
            'decay_factor': display_result['decay_factor'],
        },
        'alert_age_seconds': display_result['age_seconds'],
    }


def _build_aggregate_event_payload_from_record(
    record: dict,
    threshold_vnd: float,
    threshold_source: str = 'user_default',
    score_config: dict | None = None,
    now=None,
) -> dict:
    matched_value = float(record.get('matched_value') or 0.0)
    occurred_at = str(record.get('ts') or timezone.now().isoformat())
    side = _normalize_signal_side(record.get('side'))
    symbol = str(record.get('symbol') or '').strip().upper()
    source = str(record.get('source') or 'intraday_tick_db').strip() or 'intraday_tick_db'

    score_result = calculate_event_score(
        trade={
            'matched_value': matched_value,
            'threshold': threshold_vnd,
            'side': side,
        },
        context={
            'threshold_vnd': threshold_vnd,
            'side': side,
        },
        config=score_config,
    )
    display_result = calculate_display_score(
        event_score=score_result['event_score'],
        occurred_at=occurred_at,
        now=now,
        config=score_config,
    )

    return {
        'id': record.get('id'),
        'event_id': record.get('event_id') or f"{source}:{symbol}:{record.get('id') or occurred_at}",
        'contract_version': '1.0',
        'config_version': WHALE_CONFIG_VERSION,
        'weights_version': score_result['weights_version'],
        'symbol': symbol,
        'side': side,
        'matched_value': round(matched_value, 2),
        'volume': int(record.get('volume') or 0),
        'threshold': threshold_vnd,
        'threshold_source': str(threshold_source or 'user_default'),
        'size_class': record.get('size_class') or _classify_signal_size(matched_value),
        'ts': occurred_at,
        'alert_at': occurred_at,
        'alert_first_seen_at': occurred_at,
        'source': source,
        'event_score': score_result['event_score'],
        'display_score': display_result['display_score'],
        'severity': display_result['severity'],
        'score_breakdown': score_result['score_breakdown'],
        'normalized_features': score_result['normalized_features'],
        'raw_features': score_result['raw_features'],
        'score_decay': {
            'age_seconds': display_result['age_seconds'],
            'decay_factor': display_result['decay_factor'],
        },
        'alert_age_seconds': display_result['age_seconds'],
    }


# ---------------------------------------------------------------------------
# Cursor parsers
# ---------------------------------------------------------------------------

def _parse_cursor_datetime(cursor_payload: dict) -> tuple[date, time, int] | None:
    if not isinstance(cursor_payload, dict):
        return None
    expected_keys = {'sort', 'trade_date', 'trade_time', 'id'}
    payload_keys = set(cursor_payload.keys())
    if payload_keys not in (expected_keys, expected_keys | {'window'}):
        return None
    try:
        trade_date = date.fromisoformat(str(cursor_payload['trade_date']))
        trade_time = time.fromisoformat(str(cursor_payload['trade_time']))
        row_id = int(cursor_payload['id'])
    except (KeyError, TypeError, ValueError):
        return None
    return trade_date, trade_time, row_id


def _parse_cursor_matched_value(cursor_payload: dict) -> tuple[float, int] | None:
    if not isinstance(cursor_payload, dict):
        return None
    expected_keys = {'sort', 'matched_value', 'id'}
    payload_keys = set(cursor_payload.keys())
    if payload_keys not in (expected_keys, expected_keys | {'window'}):
        return None
    try:
        matched_value = float(cursor_payload['matched_value'])
        row_id = int(cursor_payload['id'])
    except (KeyError, TypeError, ValueError):
        return None
    return matched_value, row_id


# ---------------------------------------------------------------------------
# Aggregate event record normalisation
# ---------------------------------------------------------------------------

def _normalize_aggregate_event_records(records: list[dict], *, sort: str, cursor_payload: dict | None = None) -> tuple[list[dict], bool]:
    normalized = []
    for index, record in enumerate(records, start=1):
        symbol = str(record.get('symbol') or '').strip().upper()
        if not symbol:
            continue
        ts_value = str(record.get('ts') or '').strip()
        try:
            parsed_dt = datetime.fromisoformat(ts_value.replace('Z', '+00:00'))
        except Exception:
            continue
        matched_value = float(record.get('matched_value') or 0.0)
        row_id = int(record.get('id') or index)
        normalized.append({
            **record,
            'symbol': symbol,
            'matched_value': matched_value,
            'ts': parsed_dt.isoformat(),
            'id': row_id,
            '_sort_dt': parsed_dt,
            '_sort_id': row_id,
        })

    if sort == 'matched_value':
        if cursor_payload is not None:
            parsed_cursor = _parse_cursor_matched_value(cursor_payload)
            if parsed_cursor is None:
                return [], False
            cursor_value, cursor_id = parsed_cursor
            normalized = [
                record for record in normalized
                if record['matched_value'] < cursor_value or (record['matched_value'] == cursor_value and record['_sort_id'] < cursor_id)
            ]
        normalized.sort(key=lambda record: (-record['matched_value'], -record['_sort_id']))
    else:
        if cursor_payload is not None:
            parsed_cursor = _parse_cursor_datetime(cursor_payload)
            if parsed_cursor is None:
                return [], False
            cursor_date, cursor_time, cursor_id = parsed_cursor
            normalized = [
                record for record in normalized
                if (
                    record['_sort_dt'].date() < cursor_date
                    or (record['_sort_dt'].date() == cursor_date and record['_sort_dt'].time() < cursor_time)
                    or (
                        record['_sort_dt'].date() == cursor_date
                        and record['_sort_dt'].time() == cursor_time
                        and record['_sort_id'] < cursor_id
                    )
                )
            ]
        normalized.sort(key=lambda record: (record['_sort_dt'], record['_sort_id']), reverse=True)

    return normalized, True


# ---------------------------------------------------------------------------
# Stream / vnstock aggregate record builders
# ---------------------------------------------------------------------------

def _build_stream_aggregate_records(symbols: list[str], threshold_vnd: float) -> list[dict]:
    try:
        from portfolio.realtime.stream_reader import StreamReader
        reader = StreamReader()
    except Exception as exc:
        logger.debug('Aggregate whale stream reader unavailable: %s', exc)
        return []

    records = []
    synthetic_id = 1
    for symbol in symbols:
        try:
            stream_ticks = reader.get_intraday_ticks(symbol, count=150)
        except Exception as exc:
            logger.debug('Aggregate whale stream read failed for %s: %s', symbol, exc)
            continue

        for tick in stream_ticks:
            try:
                price = float(tick.get('price') or 0)
                volume = float(tick.get('volume') or 0)
            except (TypeError, ValueError):
                continue
            matched_value = price * volume
            if matched_value < threshold_vnd:
                continue
            ts_raw = tick.get('ts') or tick.get('time') or tick.get('tradingDate') or timezone.now().isoformat()
            try:
                ts_value = datetime.fromisoformat(str(ts_raw).replace('Z', '+00:00')).isoformat()
            except Exception:
                ts_value = timezone.now().isoformat()
            side = tick.get('side') or tick.get('match_type') or tick.get('matchType') or 'UNKNOWN'
            records.append({
                'id': synthetic_id,
                'event_id': f'stream:{symbol}:{synthetic_id}',
                'symbol': symbol,
                'side': side,
                'matched_value': matched_value,
                'volume': int(volume),
                'ts': ts_value,
                'size_class': _classify_signal_size(matched_value),
                'source': 'redis_stream',
            })
            synthetic_id += 1
    return records


def _build_vnstock_aggregate_records(symbols: list[str], threshold_vnd: float) -> list[dict]:
    records = []
    synthetic_id = 1
    if not _allow_vnstock_aggregate_fallback(symbols):
        logger.info('Skip vnstock aggregate fallback for %s symbols to reduce rate-limit pressure.', len(symbols))
        return []
    if _is_vnstock_rate_limited('intraday'):
        return []
    for symbol in symbols:
        try:
            df = fetch_intraday_dataframe(symbol=symbol, page_size=150)
        except ExternalSystemException as exc:
            if exc.code == 'vnstock_rate_limited':
                _mark_vnstock_rate_limited('intraday', exc)
                logger.info('Aggregate whale vnstock rate-limited for %s; activate cooldown.', symbol)
                break
            if exc.code == 'vnstock_missing':
                logger.debug('Aggregate whale vnstock import failed: %s', exc)
                break
            logger.debug('Aggregate whale vnstock fallback failed for %s: %s', symbol, exc)
            continue

        if df is None or df.empty:
            continue

        for _, row in df.iterrows():
            try:
                price = float(row.get('price') or row.get('close') or 0)
                volume = float(row.get('volume') or row.get('vol') or row.get('matchVolume') or 0)
            except (TypeError, ValueError):
                continue
            matched_value = price * volume
            if matched_value < threshold_vnd:
                continue
            raw_time = row.get('time') or row.get('tradingDate') or ''
            try:
                ts_value = datetime.fromisoformat(str(raw_time).replace('Z', '+00:00')).isoformat()
            except Exception:
                try:
                    ts_value = timezone.make_aware(
                        datetime.combine(date.today(), datetime.strptime(str(raw_time)[:8], '%H:%M:%S').time()),
                        timezone.get_current_timezone(),
                    ).isoformat()
                except Exception:
                    ts_value = timezone.now().isoformat()
            side = row.get('side') or row.get('match_type') or row.get('matchType') or 'UNKNOWN'
            records.append({
                'id': synthetic_id,
                'event_id': f'vnstock:{symbol}:{synthetic_id}',
                'symbol': symbol,
                'side': side,
                'matched_value': matched_value,
                'volume': int(volume),
                'ts': ts_value,
                'size_class': _classify_signal_size(matched_value),
                'source': 'vnstock',
            })
            synthetic_id += 1
    return records


# ---------------------------------------------------------------------------
# Whale order payload builder
# ---------------------------------------------------------------------------

def _build_whale_order_payload(
    *,
    raw_time,
    raw_price: float,
    raw_vol: float,
    matched_value: float,
    side: str,
    size_class: str,
    threshold_vnd: float,
    threshold_source: str = 'user_default',
    score_config: dict | None = None,
    now=None,
) -> dict:
    try:
        occurred_at = timezone.make_aware(
            datetime.fromisoformat(str(raw_time).replace('Z', '+00:00')),
            timezone.get_current_timezone(),
        ).isoformat()
    except Exception:
        try:
            occurred_at = timezone.make_aware(
                datetime.combine(date.today(), datetime.strptime(str(raw_time)[:8], '%H:%M:%S').time()),
                timezone.get_current_timezone(),
            ).isoformat()
        except Exception:
            occurred_at = timezone.now().isoformat()

    score_result = calculate_event_score(
        trade={
            'matched_value': matched_value,
            'threshold': threshold_vnd,
            'side': side,
        },
        context={
            'threshold_vnd': threshold_vnd,
            'side': side,
        },
        config=score_config,
    )
    display_result = calculate_display_score(
        event_score=score_result['event_score'],
        occurred_at=occurred_at,
        now=now,
        config=score_config,
    )

    try:
        time_str = datetime.fromisoformat(occurred_at.replace('Z', '+00:00')).strftime('%H:%M:%S')
    except Exception:
        time_str = str(raw_time)[:8]

    return {
        'time': time_str,
        'ts': occurred_at,
        'price': raw_price,
        'volume': int(raw_vol),
        'matched_value': matched_value,
        'side': side,
        'size_class': size_class,
        'threshold': threshold_vnd,
        'threshold_source': str(threshold_source or 'user_default'),
        'event_score': score_result['event_score'],
        'display_score': display_result['display_score'],
        'severity': display_result['severity'],
        'score_breakdown': score_result['score_breakdown'],
        'normalized_features': score_result['normalized_features'],
        'raw_features': score_result['raw_features'],
        'score_decay': {
            'age_seconds': display_result['age_seconds'],
            'decay_factor': display_result['decay_factor'],
        },
        'weights_version': score_result['weights_version'],
    }


# ---------------------------------------------------------------------------
# Threshold hit check
# ---------------------------------------------------------------------------

def _dataframe_has_threshold_hits(df, threshold_vnd: float) -> bool:
    if df is None or getattr(df, 'empty', True):
        return False

    for _, row in df.iterrows():
        try:
            raw_price = float(row.get('price') or row.get('close') or 0)
            raw_vol = float(row.get('volume') or row.get('vol') or row.get('matchVolume') or 0)
        except (ValueError, TypeError):
            continue
        if raw_price * raw_vol >= threshold_vnd:
            return True
    return False
