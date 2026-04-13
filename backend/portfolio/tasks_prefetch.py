from __future__ import annotations

import logging
import os
import re

from celery import shared_task
from django.core.cache import cache
from django.utils import timezone

from portfolio.adapters.vnstock_adapter import fetch_price_board_dataframe
from portfolio.models import (
    PriceAlertRule,
    SecuritiesItem,
    TrackedSymbol,
    Transaction,
    WatchlistItem,
)

logger = logging.getLogger(__name__)

TICKER_PREFETCH_META_CACHE_KEY = 'ticker:prefetch:meta'
VNSTOCK_PRICE_BOARD_RATE_LIMIT_CACHE_KEY = 'vnstock:rate-limit:price_board'
PREFETCH_RUNTIME_SETTINGS_CACHE_KEY = 'admin_ops:prefetch_runtime_settings'
PREFETCH_TIME_POLICY_CACHE_KEY = 'admin_ops:prefetch_time_policy'
PREFETCH_METRIC_CACHE_PREFIX = 'ticker:prefetch:metric'
VNSTOCK_TIMEOUT_COUNTER_KEY = 'vnstock:timeout-counter:price_board'
PREFETCH_ENQUEUE_LOCK_KEY = 'ticker:prefetch:enqueue:lock'


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return int(default)


def _prefetch_runtime_defaults() -> dict:
    return {
        'batch_size': max(_int_env('TICKER_PREFETCH_BATCH_SIZE', 60), 1),
        'symbol_limit': max(_int_env('TICKER_PREFETCH_SYMBOL_LIMIT', 240), 0),
        'max_retries': max(_int_env('TICKER_PREFETCH_MAX_RETRIES', 6), 0),
        'retry_base_seconds': max(_int_env('TICKER_PREFETCH_RETRY_BASE_SECONDS', 8), 1),
        'retry_max_seconds': max(_int_env('TICKER_PREFETCH_RETRY_MAX_SECONDS', 120), 1),
        'rate_limit_cooldown_seconds': max(_int_env('VNSTOCK_RATE_LIMIT_COOLDOWN_SECONDS', 20), 5),
        'circuit_window_seconds': max(_int_env('VNSTOCK_CIRCUIT_WINDOW_SECONDS', 300), 30),
        'circuit_breaker_timeout_threshold': max(_int_env('VNSTOCK_CIRCUIT_BREAKER_TIMEOUT_THRESHOLD', 3), 1),
        'circuit_breaker_cooldown_seconds': max(_int_env('VNSTOCK_CIRCUIT_BREAKER_COOLDOWN_SECONDS', 1800), 60),
        'include_group_symbols': os.getenv('TICKER_PREFETCH_INCLUDE_GROUP_SYMBOLS', 'False').lower() == 'true',
    }


def _get_prefetch_runtime_settings() -> dict:
    defaults = _prefetch_runtime_defaults()
    raw = cache.get(PREFETCH_RUNTIME_SETTINGS_CACHE_KEY)
    if not isinstance(raw, dict):
        return defaults

    settings_payload = dict(defaults)
    int_keys = {
        'batch_size': 1,
        'symbol_limit': 0,
        'max_retries': 0,
        'retry_base_seconds': 1,
        'retry_max_seconds': 1,
        'rate_limit_cooldown_seconds': 5,
        'circuit_window_seconds': 30,
        'circuit_breaker_timeout_threshold': 1,
        'circuit_breaker_cooldown_seconds': 60,
    }
    for key, min_value in int_keys.items():
        if key not in raw:
            continue
        try:
            settings_payload[key] = max(int(raw.get(key)), min_value)
        except (TypeError, ValueError):
            continue

    if 'include_group_symbols' in raw:
        settings_payload['include_group_symbols'] = bool(raw.get('include_group_symbols'))

    settings_payload['retry_max_seconds'] = max(
        settings_payload['retry_max_seconds'],
        settings_payload['retry_base_seconds'],
    )
    return settings_payload


def _prefetch_time_policy_defaults() -> dict:
    return {
        'timezone': 'Asia/Ho_Chi_Minh',
        'market': {
            'open_time': '09:00',
            'close_time': '15:00',
            'pre_open_minutes': 30,
            'post_close_minutes': 30,
            'lunch_break': {
                'enabled': True,
                'start': '11:30',
                'end': '13:00',
            },
            'weekend_mode': 'offhours',
        },
        'profiles': {
            'pre_open': {'query_enabled': True, 'interval_seconds': 90, 'batch_size': 10, 'symbol_limit': 20, 'max_retries': 2},
            'market_open': {'query_enabled': True, 'interval_seconds': 35, 'batch_size': 20, 'symbol_limit': 40, 'max_retries': 4},
            'lunch_break': {'query_enabled': True, 'interval_seconds': 180, 'batch_size': 8, 'symbol_limit': 20, 'max_retries': 1},
            'pre_close': {'query_enabled': True, 'interval_seconds': 60, 'batch_size': 12, 'symbol_limit': 30, 'max_retries': 2},
            'post_close': {'query_enabled': True, 'interval_seconds': 180, 'batch_size': 8, 'symbol_limit': 20, 'max_retries': 1},
            'offhours': {'query_enabled': False, 'interval_seconds': 600, 'batch_size': 5, 'symbol_limit': 10, 'max_retries': 0},
        },
        'rate_limit_guard': {
            'jitter_percent': 15.0,
            'cooldown_multiplier_on_429': 2.0,
            'max_interval_seconds': 1800,
        },
    }


def _coerce_prefetch_time_policy(raw_payload, fallback=None) -> dict:
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

    def _to_int(value, default_value, min_value=0):
        try:
            return max(int(value), min_value)
        except (TypeError, ValueError):
            return max(int(default_value), min_value)

    def _to_float(value, default_value):
        try:
            return float(value)
        except (TypeError, ValueError):
            return float(default_value)

    def _to_bool(value, default_value):
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return bool(value)
        if isinstance(value, str):
            lowered = value.strip().lower()
            if lowered in {'true', '1', 'yes', 'on'}:
                return True
            if lowered in {'false', '0', 'no', 'off'}:
                return False
        return bool(default_value)

    def _time_or_default(value, default_value):
        candidate = str(value or '').strip()
        if re.match(r'^\d{2}:\d{2}$', candidate):
            return candidate
        return str(default_value)

    base = fallback or _prefetch_time_policy_defaults()
    payload = raw_payload if isinstance(raw_payload, dict) else {}

    timezone_name = str(payload.get('timezone', base['timezone']) or '').strip() or base['timezone']
    try:
        ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError:
        timezone_name = base['timezone']

    market_raw = payload.get('market') if isinstance(payload.get('market'), dict) else {}
    market_base = base['market']
    lunch_raw = market_raw.get('lunch_break') if isinstance(market_raw.get('lunch_break'), dict) else {}
    lunch_base = market_base['lunch_break']

    market = {
        'open_time': _time_or_default(market_raw.get('open_time'), market_base['open_time']),
        'close_time': _time_or_default(market_raw.get('close_time'), market_base['close_time']),
        'pre_open_minutes': _to_int(market_raw.get('pre_open_minutes'), market_base['pre_open_minutes'], min_value=0),
        'post_close_minutes': _to_int(market_raw.get('post_close_minutes'), market_base['post_close_minutes'], min_value=0),
        'lunch_break': {
            'enabled': _to_bool(lunch_raw.get('enabled'), lunch_base['enabled']),
            'start': _time_or_default(lunch_raw.get('start'), lunch_base['start']),
            'end': _time_or_default(lunch_raw.get('end'), lunch_base['end']),
        },
        'weekend_mode': str(market_raw.get('weekend_mode', market_base.get('weekend_mode', 'offhours')) or 'offhours').strip().lower(),
    }
    if market['weekend_mode'] not in {'offhours'}:
        market['weekend_mode'] = 'offhours'

    profiles_raw = payload.get('profiles') if isinstance(payload.get('profiles'), dict) else {}
    profiles = {}
    for profile_name, profile_base in base['profiles'].items():
        profile_raw = profiles_raw.get(profile_name) if isinstance(profiles_raw.get(profile_name), dict) else {}
        profiles[profile_name] = {
            'query_enabled': _to_bool(profile_raw.get('query_enabled'), profile_base['query_enabled']),
            'interval_seconds': _to_int(profile_raw.get('interval_seconds'), profile_base['interval_seconds'], min_value=5),
            'batch_size': _to_int(profile_raw.get('batch_size'), profile_base['batch_size'], min_value=1),
            'symbol_limit': _to_int(profile_raw.get('symbol_limit'), profile_base['symbol_limit'], min_value=0),
            'max_retries': _to_int(profile_raw.get('max_retries'), profile_base['max_retries'], min_value=0),
        }

    guard_raw = payload.get('rate_limit_guard') if isinstance(payload.get('rate_limit_guard'), dict) else {}
    guard_base = base['rate_limit_guard']
    rate_limit_guard = {
        'jitter_percent': min(max(_to_float(guard_raw.get('jitter_percent'), guard_base['jitter_percent']), 0.0), 50.0),
        'cooldown_multiplier_on_429': max(_to_float(guard_raw.get('cooldown_multiplier_on_429'), guard_base['cooldown_multiplier_on_429']), 1.0),
        'max_interval_seconds': _to_int(guard_raw.get('max_interval_seconds'), guard_base['max_interval_seconds'], min_value=60),
    }

    for profile_payload in profiles.values():
        profile_payload['interval_seconds'] = min(profile_payload['interval_seconds'], rate_limit_guard['max_interval_seconds'])

    return {
        'timezone': timezone_name,
        'market': market,
        'profiles': profiles,
        'rate_limit_guard': rate_limit_guard,
    }


def _get_prefetch_time_policy() -> dict:
    defaults = _prefetch_time_policy_defaults()
    raw = cache.get(PREFETCH_TIME_POLICY_CACHE_KEY)
    if not isinstance(raw, dict):
        return defaults
    return _coerce_prefetch_time_policy(raw, fallback=defaults)


def _parse_hhmm_to_minutes(hhmm: str, fallback_minutes: int) -> int:
    candidate = str(hhmm or '').strip()
    if not re.match(r'^\d{2}:\d{2}$', candidate):
        return int(fallback_minutes)
    hh, mm = candidate.split(':', 1)
    try:
        return max(min(int(hh) * 60 + int(mm), 1439), 0)
    except (TypeError, ValueError):
        return int(fallback_minutes)


def _resolve_prefetch_time_profile(now_dt=None, policy=None) -> tuple[str, str]:
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

    normalized_policy = _coerce_prefetch_time_policy(policy, fallback=_prefetch_time_policy_defaults())
    timezone_name = normalized_policy.get('timezone', 'Asia/Ho_Chi_Minh')
    try:
        tz = ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError:
        tz = ZoneInfo('Asia/Ho_Chi_Minh')
    local_now = (now_dt or timezone.now()).astimezone(tz)

    market = normalized_policy['market']
    open_minutes = _parse_hhmm_to_minutes(market.get('open_time'), 9 * 60)
    close_minutes = _parse_hhmm_to_minutes(market.get('close_time'), 15 * 60)
    if open_minutes >= close_minutes:
        open_minutes, close_minutes = 9 * 60, 15 * 60

    now_minutes = local_now.hour * 60 + local_now.minute
    pre_open_minutes = max(int(market.get('pre_open_minutes', 30)), 0)
    post_close_minutes = max(int(market.get('post_close_minutes', 30)), 0)
    pre_close_minutes = max(int(market.get('pre_close_minutes', pre_open_minutes)), 0)

    if local_now.weekday() >= 5 and market.get('weekend_mode') == 'offhours':
        return 'offhours', 'weekend_offhours_mode'

    lunch = market.get('lunch_break') if isinstance(market.get('lunch_break'), dict) else {}
    lunch_enabled = bool(lunch.get('enabled', False))
    lunch_start_minutes = _parse_hhmm_to_minutes(lunch.get('start'), 11 * 60 + 30)
    lunch_end_minutes = _parse_hhmm_to_minutes(lunch.get('end'), 13 * 60)

    pre_open_start = max(open_minutes - pre_open_minutes, 0)
    post_close_end = min(close_minutes + post_close_minutes, 24 * 60)
    pre_close_start = max(close_minutes - pre_close_minutes, open_minutes)

    if pre_open_start <= now_minutes < open_minutes:
        return 'pre_open', 'within_pre_open_window'
    if open_minutes <= now_minutes < close_minutes:
        if lunch_enabled and lunch_start_minutes <= now_minutes < lunch_end_minutes:
            return 'lunch_break', 'within_lunch_break_window'
        if pre_close_start <= now_minutes < close_minutes:
            return 'pre_close', 'within_pre_close_window'
        return 'market_open', 'within_market_open_window'
    if close_minutes <= now_minutes < post_close_end:
        return 'post_close', 'within_post_close_window'
    return 'offhours', 'outside_market_windows'


def _resolve_effective_prefetch_settings(runtime_settings=None, policy=None, now_dt=None) -> tuple[dict, dict]:
    base_runtime = dict(runtime_settings or _get_prefetch_runtime_settings())
    normalized_policy = _coerce_prefetch_time_policy(policy, fallback=_prefetch_time_policy_defaults())
    profile_name, reason = _resolve_prefetch_time_profile(now_dt=now_dt, policy=normalized_policy)
    profile_payload = normalized_policy.get('profiles', {}).get(profile_name, {})

    effective_settings = dict(base_runtime)
    for field in ('batch_size', 'symbol_limit', 'max_retries'):
        if field in profile_payload:
            try:
                effective_settings[field] = max(int(profile_payload.get(field)), 0 if field != 'batch_size' else 1)
            except (TypeError, ValueError):
                continue

    policy_meta = {
        'timezone': normalized_policy.get('timezone'),
        'profile': profile_name,
        'reason': reason,
        'query_enabled': bool(profile_payload.get('query_enabled', True)),
        'effective_interval_seconds': int(profile_payload.get('interval_seconds', 0) or 0),
    }
    return effective_settings, policy_meta


def _distinct_symbols(queryset) -> list[str]:
    return sorted({
        str(symbol).strip().upper()
        for symbol in queryset
        if symbol and str(symbol).strip()
    })


def _collect_prefetch_symbols(runtime_settings: dict | None = None) -> tuple[list[str], dict]:
    runtime_settings = runtime_settings or _get_prefetch_runtime_settings()
    include_group_symbols = bool(runtime_settings.get('include_group_symbols', False))
    symbol_limit = max(int(runtime_settings.get('symbol_limit', 240)), 0)

    source_lists = {
        'tracked_symbols': _distinct_symbols(TrackedSymbol.objects.values_list('symbol', flat=True).distinct()),
        'watchlist_items': _distinct_symbols(WatchlistItem.objects.values_list('symbol', flat=True).distinct()),
        'price_alerts': _distinct_symbols(PriceAlertRule.objects.values_list('symbol', flat=True).distinct()),
        'portfolio_transactions': _distinct_symbols(Transaction.objects.values_list('symbol', flat=True).distinct()),
    }
    if include_group_symbols:
        source_lists['market_group_items'] = _distinct_symbols(
            SecuritiesItem.objects.values_list('symbol', flat=True).distinct()
        )

    merged_symbols = []
    seen = set()
    for _, symbols in source_lists.items():
        for symbol in symbols:
            if symbol in seen:
                continue
            seen.add(symbol)
            merged_symbols.append(symbol)

    if symbol_limit:
        merged_symbols = merged_symbols[:symbol_limit]

    source_counts = {name: len(symbols) for name, symbols in source_lists.items()}
    return merged_symbols, source_counts


def _store_prefetch_meta(payload: dict, timeout: int = 600) -> None:
    try:
        cache.set(TICKER_PREFETCH_META_CACHE_KEY, payload, timeout=timeout)
    except Exception:
        pass


def _metric_cache_key(name: str, suffix: str | None = None) -> str:
    if suffix:
        return f'{PREFETCH_METRIC_CACHE_PREFIX}:{name}:{suffix}'
    return f'{PREFETCH_METRIC_CACHE_PREFIX}:{name}'


def _increment_prefetch_metric(name: str, *, suffix: str | None = None, amount: int = 1, timeout: int = 60 * 60 * 24) -> int:
    key = _metric_cache_key(name, suffix=suffix)
    try:
        if cache.add(key, int(amount), timeout=timeout):
            return int(amount)
        value = cache.incr(key, amount)
        cache.touch(key, timeout=timeout)
        return int(value)
    except Exception:
        try:
            current = int(cache.get(key) or 0)
            current += int(amount)
            cache.set(key, current, timeout=timeout)
            return current
        except Exception:
            return 0


def _is_rate_limited_error(exc: Exception) -> bool:
    message = str(exc or '').lower()
    return (
        '429' in message
        or 'too many requests' in message
        or 'rate limit' in message
        or 'gioi han api' in message
        or 'giới hạn api' in message
    )


def _row_get_value(row, key_options: list):
    for key in key_options:
        try:
            value = row.get(key)
        except Exception:
            value = None
        if value is None:
            continue
        try:
            if pd.isna(value):
                continue
        except Exception:
            pass
        return value
    return None


def _extract_row_symbol(row):
    raw = _row_get_value(
        row,
        [
            ('listing', 'symbol'),
            ('symbol', ''),
            ('symbol', 'symbol'),
            'symbol',
            'listing_symbol',
            'ticker',
        ],
    )
    value = str(raw or '').strip().upper()
    return value or None


def _extract_row_ref_price(row):
    return _row_get_value(
        row,
        [
            ('listing', 'ref_price'),
            ('match', 'reference_price'),
            'ref_price',
            'reference_price',
        ],
    )


def _extract_row_match_price(row):
    return _row_get_value(
        row,
        [
            ('match', 'match_price'),
            'match_price',
            'price',
            'last_price',
        ],
    )


def _extract_row_open_price(row):
    return _row_get_value(row, [('match', 'open_price'), 'open_price'])


def _extract_row_highest(row):
    return _row_get_value(row, [('match', 'highest'), 'highest', 'high'])


def _extract_row_lowest(row):
    return _row_get_value(row, [('match', 'lowest'), 'lowest', 'low'])


def _extract_row_volume(row):
    return _row_get_value(
        row,
        [
            ('match', 'accumulated_volume'),
            'accumulated_volume',
            'match_volume',
            'volume',
        ],
    )


def _prefetch_retry_countdown(retries: int) -> int:
    runtime_settings = _get_prefetch_runtime_settings()
    base = max(int(runtime_settings.get('retry_base_seconds', 8)), 1)
    max_seconds = max(int(runtime_settings.get('retry_max_seconds', 120)), base)
    return min(max_seconds, base * (2 ** max(retries, 0)))


def _prefetch_retry_countdown_with_policy(retries: int, runtime_settings: dict | None = None, policy_guard: dict | None = None) -> tuple[int, float]:
    settings_payload = runtime_settings or _get_prefetch_runtime_settings()
    base = max(int(settings_payload.get('retry_base_seconds', 8)), 1)
    max_seconds = max(int(settings_payload.get('retry_max_seconds', 120)), base)
    base_countdown = min(max_seconds, base * (2 ** max(retries, 0)))

    guard = policy_guard if isinstance(policy_guard, dict) else {}
    multiplier = float(guard.get('cooldown_multiplier_on_429', 1.0) or 1.0)
    if multiplier < 1.0:
        multiplier = 1.0
    max_interval = max(int(guard.get('max_interval_seconds', max_seconds) or max_seconds), 1)
    adjusted = int(base_countdown * multiplier)
    adjusted = min(max_interval, max(adjusted, 1))
    return adjusted, multiplier


def _mark_price_board_rate_limited(exc: Exception) -> None:
    runtime_settings = _get_prefetch_runtime_settings()
    cooldown_seconds = max(int(runtime_settings.get('rate_limit_cooldown_seconds', 20)), 5)
    try:
        cache.set(
            VNSTOCK_PRICE_BOARD_RATE_LIMIT_CACHE_KEY,
            {
                'triggered_at': timezone.now().isoformat(),
                'reason': str(exc or '')[:200],
            },
            timeout=cooldown_seconds,
        )
    except Exception:
        pass


def _record_vnstock_timeout(exc: Exception) -> bool:
    if not isinstance(exc, (TimeoutError, ConnectionError, OSError)):
        return False
    try:
        runtime_settings = _get_prefetch_runtime_settings()
        _counter_window = int(runtime_settings.get('circuit_window_seconds', 300))
        _threshold = int(runtime_settings.get('circuit_breaker_timeout_threshold', 3))
        _circuit_cooldown = int(runtime_settings.get('circuit_breaker_cooldown_seconds', 1800))

        current = cache.get(VNSTOCK_TIMEOUT_COUNTER_KEY) or 0
        new_count = current + 1
        cache.set(VNSTOCK_TIMEOUT_COUNTER_KEY, new_count, timeout=_counter_window)

        if new_count >= _threshold:
            logger.warning(
                'vnstock circuit breaker triggered after %d consecutive timeouts - pausing %ds',
                new_count,
                _circuit_cooldown,
            )
            cache.set(
                VNSTOCK_PRICE_BOARD_RATE_LIMIT_CACHE_KEY,
                {
                    'triggered_at': timezone.now().isoformat(),
                    'reason': f'circuit_breaker_timeout_threshold_exceeded count={new_count}',
                },
                timeout=_circuit_cooldown,
            )
            cache.delete(VNSTOCK_TIMEOUT_COUNTER_KEY)
            return True
    except Exception:
        pass
    return False


@shared_task(bind=True)
def prefetch_ticker_price_board(self) -> dict:
    runtime_settings = _get_prefetch_runtime_settings()
    time_policy = _get_prefetch_time_policy()
    effective_settings, policy_meta = _resolve_effective_prefetch_settings(
        runtime_settings=runtime_settings,
        policy=time_policy,
    )
    _increment_prefetch_metric('profile_hits_total', suffix=str(policy_meta.get('profile') or 'unknown').lower())
    batch_size = max(int(effective_settings.get('batch_size', 60)), 1)
    symbols, source_counts = _collect_prefetch_symbols(runtime_settings=effective_settings)
    if not policy_meta.get('query_enabled', True):
        skip_total = _increment_prefetch_metric('skip_total', suffix='policy_disabled')
        payload = {
            'status': 'throttled_by_policy',
            'reason': policy_meta.get('reason', 'policy_query_disabled'),
            'policy': policy_meta,
            'metrics': {
                'skip_total': skip_total,
            },
            'symbols': len(symbols),
            'cached': 0,
            'source_counts': source_counts,
            'generated_at': timezone.now().isoformat(),
            'batch_size': batch_size,
            'batches': 0,
            'sample_symbols': symbols[:10],
        }
        _store_prefetch_meta(payload)
        return payload

    if not symbols:
        payload = {
            'status': 'ok',
            'policy': policy_meta,
            'symbols': 0,
            'cached': 0,
            'source_counts': source_counts,
            'generated_at': timezone.now().isoformat(),
            'batch_size': batch_size,
            'batches': 0,
            'sample_symbols': [],
        }
        _store_prefetch_meta(payload)
        return payload

    def _f(val):
        try:
            v = float(val)
            return v if v == v and v != 0 else None
        except (TypeError, ValueError):
            return None

    def _i(val):
        try:
            v = float(val)
            return int(v) if v == v else None
        except (TypeError, ValueError):
            return None

    now_iso = timezone.now().isoformat()
    cached_count = 0
    processed_batches = 0
    max_retries = max(int(effective_settings.get('max_retries', 6)), 0)
    if cache.get(VNSTOCK_PRICE_BOARD_RATE_LIMIT_CACHE_KEY):
        payload = {
            'status': 'backoff',
            'reason': 'price_board rate limit cooldown active',
            'policy': policy_meta,
            'symbols': len(symbols),
            'cached': 0,
            'source_counts': source_counts,
            'generated_at': timezone.now().isoformat(),
            'batch_size': batch_size,
            'batches': 0,
            'sample_symbols': symbols[:10],
        }
        _store_prefetch_meta(payload)
        return payload
    try:
        for start in range(0, len(symbols), batch_size):
            batch_symbols = symbols[start:start + batch_size]
            # Preserve compatibility with tests that patch portfolio.tasks.fetch_price_board_dataframe.
            from portfolio import tasks as tasks_facade

            fetch_fn = getattr(tasks_facade, 'fetch_price_board_dataframe', fetch_price_board_dataframe)
            df = fetch_fn(batch_symbols, anchor_symbol=batch_symbols[0])
            processed_batches += 1

            if df is None or df.empty:
                continue

            for _, row in df.iterrows():
                try:
                    sym = _extract_row_symbol(row)
                    if not sym:
                        continue
                    match_price = _f(_extract_row_match_price(row))
                    ref_price = (
                        _f(_extract_row_ref_price(row))
                    )
                    highest = _f(_extract_row_highest(row))
                    lowest = _f(_extract_row_lowest(row))
                    open_price = _f(_extract_row_open_price(row))
                    accum_vol = _i(_extract_row_volume(row))
                    change_value = round(match_price - ref_price, 2) if match_price and ref_price else None
                    change_pct = (
                        round((match_price - ref_price) / ref_price * 100, 2)
                        if match_price and ref_price
                        else None
                    )
                    data = {
                        'symbol': sym,
                        'current_price': match_price,
                        'prev_price': ref_price,
                        'change_value': change_value,
                        'change_pct': change_pct,
                        'high_price': highest,
                        'low_price': lowest,
                        'open_price': open_price,
                        'volume': accum_vol,
                        'last_date': now_iso,
                        'freshness_seconds': 0,
                        'stale': False,
                        'source': 'prefetch',
                    }
                    cache.set(f'ticker:{sym}', data, timeout=60)
                    cached_count += 1
                except Exception as exc:
                    logger.warning('prefetch_ticker_price_board parse error row: %s', exc)
    except (Exception, SystemExit) as exc:
        logger.warning('prefetch_ticker_price_board vnstock error: %s', exc)
        _record_vnstock_timeout(exc)
        if _is_rate_limited_error(exc):
            _mark_price_board_rate_limited(exc)
            policy_guard = time_policy.get('rate_limit_guard', {}) if isinstance(time_policy, dict) else {}
            countdown, multiplier_applied = _prefetch_retry_countdown_with_policy(
                getattr(self.request, 'retries', 0),
                runtime_settings=effective_settings,
                policy_guard=policy_guard,
            )
            multiplier_total = _increment_prefetch_metric('429_multiplier_total')
            payload = {
                'status': 'retrying',
                'reason': str(exc),
                'policy': policy_meta,
                'policy_cooldown_multiplier_applied': multiplier_applied,
                'policy_effective_retry_after_seconds': countdown,
                'metrics': {
                    '429_multiplier_total': multiplier_total,
                },
                'symbols': len(symbols),
                'cached': cached_count,
                'source_counts': source_counts,
                'generated_at': timezone.now().isoformat(),
                'batch_size': batch_size,
                'batches': processed_batches,
                'sample_symbols': symbols[:10],
                'retry_after_seconds': countdown,
                'retry_count': getattr(self.request, 'retries', 0) + 1,
                'max_retries': max_retries,
            }
            _store_prefetch_meta(payload)
            raise self.retry(exc=exc, countdown=countdown, max_retries=max_retries)

        payload = {
            'status': 'error',
            'reason': str(exc),
            'policy': policy_meta,
            'symbols': len(symbols),
            'cached': cached_count,
            'source_counts': source_counts,
            'generated_at': timezone.now().isoformat(),
            'batch_size': batch_size,
            'batches': processed_batches,
            'sample_symbols': symbols[:10],
        }
        _store_prefetch_meta(payload)
        return payload

    status = 'ok'
    reason = None
    if len(symbols) > 0 and processed_batches > 0 and cached_count == 0:
        status = 'parse_zero_cached'
        reason = 'no_rows_parsed_from_provider_payload'

    payload = {
        'status': status,
        'policy': policy_meta,
        'symbols': len(symbols),
        'cached': cached_count,
        'source_counts': source_counts,
        'generated_at': now_iso,
        'batch_size': batch_size,
        'batches': processed_batches,
        'sample_symbols': symbols[:10],
        'retry_count': getattr(self.request, 'retries', 0),
    }
    if reason:
        payload['reason'] = reason
    _store_prefetch_meta(payload)
    logger.info(
        'prefetch_ticker_price_board: symbols=%d cached=%d batches=%d status=%s',
        len(symbols),
        cached_count,
        processed_batches,
        status,
    )
    return payload
