import os

from django.conf import settings


HOLISTIC_GOVERNANCE_DELTA_CACHE_KEY = 'admin_ops:holistic_governance_delta_thresholds'
PREFETCH_RUNTIME_SETTINGS_CACHE_KEY = 'admin_ops:prefetch_runtime_settings'
PREFETCH_TIME_POLICY_CACHE_KEY = 'admin_ops:prefetch_time_policy'


def _default_governance_delta_thresholds():
    warning = max(0.0, float(getattr(settings, 'HOLISTIC_GOVERNANCE_DELTA_WARNING_THRESHOLD', 2.0) or 2.0))
    critical = max(warning, float(getattr(settings, 'HOLISTIC_GOVERNANCE_DELTA_CRITICAL_THRESHOLD', 4.0) or 4.0))
    cooldown = max(0.0, float(getattr(settings, 'HOLISTIC_GOVERNANCE_DELTA_COOLDOWN_THRESHOLD', 2.0) or 2.0))
    return {
        'warning': warning,
        'critical': critical,
        'cooldown': cooldown,
    }


def _coerce_governance_delta_thresholds(raw_payload, fallback=None):
    payload = raw_payload if isinstance(raw_payload, dict) else {}
    base = fallback or _default_governance_delta_thresholds()

    try:
        warning = float(payload.get('warning', base['warning']))
        critical = float(payload.get('critical', base['critical']))
        cooldown = float(payload.get('cooldown', base['cooldown']))
    except (TypeError, ValueError):
        raise ValueError('governance_delta_thresholds phải là số hợp lệ.')

    if warning < 0 or critical < 0 or cooldown < 0:
        raise ValueError('governance_delta_thresholds không được âm.')
    if critical < warning:
        raise ValueError('critical phải lớn hơn hoặc bằng warning.')

    return {
        'warning': warning,
        'critical': critical,
        'cooldown': cooldown,
    }


def _get_runtime_governance_delta_thresholds():
    from django.core.cache import cache

    default_thresholds = _default_governance_delta_thresholds()
    cached = cache.get(HOLISTIC_GOVERNANCE_DELTA_CACHE_KEY)
    if not isinstance(cached, dict):
        return default_thresholds
    try:
        return _coerce_governance_delta_thresholds(cached, fallback=default_thresholds)
    except ValueError:
        return default_thresholds


def _set_runtime_governance_delta_thresholds(raw_payload):
    from django.core.cache import cache

    normalized = _coerce_governance_delta_thresholds(raw_payload, fallback=_default_governance_delta_thresholds())
    cache.set(HOLISTIC_GOVERNANCE_DELTA_CACHE_KEY, normalized, timeout=None)
    setattr(settings, 'HOLISTIC_GOVERNANCE_DELTA_WARNING_THRESHOLD', normalized['warning'])
    setattr(settings, 'HOLISTIC_GOVERNANCE_DELTA_CRITICAL_THRESHOLD', normalized['critical'])
    setattr(settings, 'HOLISTIC_GOVERNANCE_DELTA_COOLDOWN_THRESHOLD', normalized['cooldown'])
    return normalized


def _default_prefetch_runtime_settings():
    def _int_env(name, default, minimum):
        try:
            value = int(os.getenv(name, str(default)))
        except (TypeError, ValueError):
            value = int(default)
        return max(value, minimum)

    retry_base = _int_env('TICKER_PREFETCH_RETRY_BASE_SECONDS', 8, 1)
    return {
        'batch_size': _int_env('TICKER_PREFETCH_BATCH_SIZE', 60, 1),
        'symbol_limit': _int_env('TICKER_PREFETCH_SYMBOL_LIMIT', 240, 0),
        'max_retries': _int_env('TICKER_PREFETCH_MAX_RETRIES', 6, 0),
        'retry_base_seconds': retry_base,
        'retry_max_seconds': max(_int_env('TICKER_PREFETCH_RETRY_MAX_SECONDS', 120, 1), retry_base),
        'rate_limit_cooldown_seconds': _int_env('VNSTOCK_RATE_LIMIT_COOLDOWN_SECONDS', 20, 5),
        'circuit_window_seconds': _int_env('VNSTOCK_CIRCUIT_WINDOW_SECONDS', 300, 30),
        'circuit_breaker_timeout_threshold': _int_env('VNSTOCK_CIRCUIT_BREAKER_TIMEOUT_THRESHOLD', 3, 1),
        'circuit_breaker_cooldown_seconds': _int_env('VNSTOCK_CIRCUIT_BREAKER_COOLDOWN_SECONDS', 1800, 60),
        'include_group_symbols': os.getenv('TICKER_PREFETCH_INCLUDE_GROUP_SYMBOLS', 'False').lower() == 'true',
    }


def _coerce_prefetch_runtime_settings(raw_payload, fallback=None):
    payload = raw_payload if isinstance(raw_payload, dict) else {}
    base = fallback or _default_prefetch_runtime_settings()

    int_fields = {
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

    normalized = {}
    for field, minimum in int_fields.items():
        try:
            value = int(payload.get(field, base[field]))
        except (TypeError, ValueError):
            raise ValueError(f'{field} phải là số nguyên hợp lệ.')
        normalized[field] = max(value, minimum)

    normalized['retry_max_seconds'] = max(normalized['retry_max_seconds'], normalized['retry_base_seconds'])
    normalized['include_group_symbols'] = bool(payload.get('include_group_symbols', base['include_group_symbols']))
    return normalized


def _get_runtime_prefetch_settings():
    from django.core.cache import cache

    default_settings = _default_prefetch_runtime_settings()
    cached = cache.get(PREFETCH_RUNTIME_SETTINGS_CACHE_KEY)
    if not isinstance(cached, dict):
        return default_settings
    try:
        return _coerce_prefetch_runtime_settings(cached, fallback=default_settings)
    except ValueError:
        return default_settings


def _set_runtime_prefetch_settings(raw_payload):
    from django.core.cache import cache

    normalized = _coerce_prefetch_runtime_settings(raw_payload, fallback=_default_prefetch_runtime_settings())
    cache.set(PREFETCH_RUNTIME_SETTINGS_CACHE_KEY, normalized, timeout=None)
    return normalized


def _default_prefetch_time_policy():
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
            'pre_open': {
                'query_enabled': True,
                'interval_seconds': 90,
                'batch_size': 10,
                'symbol_limit': 20,
                'max_retries': 2,
            },
            'market_open': {
                'query_enabled': True,
                'interval_seconds': 35,
                'batch_size': 20,
                'symbol_limit': 40,
                'max_retries': 4,
            },
            'lunch_break': {
                'query_enabled': True,
                'interval_seconds': 180,
                'batch_size': 8,
                'symbol_limit': 20,
                'max_retries': 1,
            },
            'pre_close': {
                'query_enabled': True,
                'interval_seconds': 60,
                'batch_size': 12,
                'symbol_limit': 30,
                'max_retries': 2,
            },
            'post_close': {
                'query_enabled': True,
                'interval_seconds': 180,
                'batch_size': 8,
                'symbol_limit': 20,
                'max_retries': 1,
            },
            'offhours': {
                'query_enabled': False,
                'interval_seconds': 600,
                'batch_size': 5,
                'symbol_limit': 10,
                'max_retries': 0,
            },
        },
        'rate_limit_guard': {
            'jitter_percent': 15.0,
            'cooldown_multiplier_on_429': 2.0,
            'max_interval_seconds': 1800,
        },
    }


def _prefetch_time_policy_rulebook():
    return {
        'timezone_required': True,
        'time_format': 'HH:MM',
        'market': {
            'pre_open_minutes_min': 0,
            'post_close_minutes_min': 0,
            'weekend_mode_allowed': ['offhours'],
        },
        'profiles': {
            'required_profiles': ['pre_open', 'market_open', 'lunch_break', 'pre_close', 'post_close', 'offhours'],
            'interval_seconds_min': 5,
            'batch_size_min': 1,
            'symbol_limit_min': 0,
            'max_retries_min': 0,
        },
        'rate_limit_guard': {
            'jitter_percent_min': 0,
            'jitter_percent_max': 50,
            'cooldown_multiplier_on_429_min': 1,
            'max_interval_seconds_min': 60,
        },
    }


def _coerce_prefetch_time_policy(raw_payload, fallback=None):
    from datetime import datetime
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

    def _to_int(value, field, minimum=0):
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            raise ValueError(f'{field} phải là số nguyên hợp lệ.')
        if parsed < minimum:
            raise ValueError(f'{field} phải lớn hơn hoặc bằng {minimum}.')
        return parsed

    def _to_float(value, field):
        try:
            return float(value)
        except (TypeError, ValueError):
            raise ValueError(f'{field} phải là số hợp lệ.')

    def _to_bool(value, field):
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
        raise ValueError(f'{field} phải là boolean hợp lệ.')

    def _to_hhmm(value, field):
        candidate = str(value or '').strip()
        try:
            datetime.strptime(candidate, '%H:%M')
        except ValueError:
            raise ValueError(f'{field} phải theo định dạng HH:MM.')
        return candidate

    def _to_minutes(hhmm):
        hh, mm = hhmm.split(':')
        return int(hh) * 60 + int(mm)

    payload = raw_payload if isinstance(raw_payload, dict) else {}
    base = fallback or _default_prefetch_time_policy()

    timezone_name = str(payload.get('timezone', base['timezone']) or '').strip()
    if not timezone_name:
        raise ValueError('prefetch_time_policy.timezone là bắt buộc.')
    try:
        ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError:
        raise ValueError('prefetch_time_policy.timezone không hợp lệ.')

    market_payload = payload.get('market', {})
    if market_payload is None:
        market_payload = {}
    if not isinstance(market_payload, dict):
        raise ValueError('prefetch_time_policy.market phải là object hợp lệ.')

    market_base = base['market']
    open_time = _to_hhmm(market_payload.get('open_time', market_base['open_time']), 'prefetch_time_policy.market.open_time')
    close_time = _to_hhmm(market_payload.get('close_time', market_base['close_time']), 'prefetch_time_policy.market.close_time')
    if _to_minutes(open_time) >= _to_minutes(close_time):
        raise ValueError('prefetch_time_policy.market.open_time phải nhỏ hơn close_time.')

    pre_open_minutes = _to_int(
        market_payload.get('pre_open_minutes', market_base['pre_open_minutes']),
        'prefetch_time_policy.market.pre_open_minutes',
        minimum=0,
    )
    post_close_minutes = _to_int(
        market_payload.get('post_close_minutes', market_base['post_close_minutes']),
        'prefetch_time_policy.market.post_close_minutes',
        minimum=0,
    )

    lunch_payload = market_payload.get('lunch_break', {})
    if lunch_payload is None:
        lunch_payload = {}
    if not isinstance(lunch_payload, dict):
        raise ValueError('prefetch_time_policy.market.lunch_break phải là object hợp lệ.')

    lunch_base = market_base['lunch_break']
    lunch_enabled = _to_bool(
        lunch_payload.get('enabled', lunch_base['enabled']),
        'prefetch_time_policy.market.lunch_break.enabled',
    )
    lunch_start = _to_hhmm(
        lunch_payload.get('start', lunch_base['start']),
        'prefetch_time_policy.market.lunch_break.start',
    )
    lunch_end = _to_hhmm(
        lunch_payload.get('end', lunch_base['end']),
        'prefetch_time_policy.market.lunch_break.end',
    )
    if lunch_enabled and _to_minutes(lunch_start) >= _to_minutes(lunch_end):
        raise ValueError('prefetch_time_policy.market.lunch_break.start phải nhỏ hơn end.')

    weekend_mode = str(market_payload.get('weekend_mode', market_base.get('weekend_mode', 'offhours')) or '').strip().lower()
    if weekend_mode not in {'offhours'}:
        raise ValueError('prefetch_time_policy.market.weekend_mode không hợp lệ.')

    profiles_payload = payload.get('profiles', {})
    if profiles_payload is None:
        profiles_payload = {}
    if not isinstance(profiles_payload, dict):
        raise ValueError('prefetch_time_policy.profiles phải là object hợp lệ.')

    normalized_profiles = {}
    for profile_name, profile_base in base['profiles'].items():
        profile_payload = profiles_payload.get(profile_name, {})
        if profile_payload is None:
            profile_payload = {}
        if not isinstance(profile_payload, dict):
            raise ValueError(f'prefetch_time_policy.profiles.{profile_name} phải là object hợp lệ.')

        query_enabled = _to_bool(
            profile_payload.get('query_enabled', profile_base['query_enabled']),
            f'prefetch_time_policy.profiles.{profile_name}.query_enabled',
        )
        interval_seconds = _to_int(
            profile_payload.get('interval_seconds', profile_base['interval_seconds']),
            f'prefetch_time_policy.profiles.{profile_name}.interval_seconds',
            minimum=5,
        )
        batch_size = _to_int(
            profile_payload.get('batch_size', profile_base['batch_size']),
            f'prefetch_time_policy.profiles.{profile_name}.batch_size',
            minimum=1,
        )
        symbol_limit = _to_int(
            profile_payload.get('symbol_limit', profile_base['symbol_limit']),
            f'prefetch_time_policy.profiles.{profile_name}.symbol_limit',
            minimum=0,
        )
        max_retries = _to_int(
            profile_payload.get('max_retries', profile_base['max_retries']),
            f'prefetch_time_policy.profiles.{profile_name}.max_retries',
            minimum=0,
        )

        normalized_profiles[profile_name] = {
            'query_enabled': query_enabled,
            'interval_seconds': interval_seconds,
            'batch_size': batch_size,
            'symbol_limit': symbol_limit,
            'max_retries': max_retries,
        }

    guard_payload = payload.get('rate_limit_guard', {})
    if guard_payload is None:
        guard_payload = {}
    if not isinstance(guard_payload, dict):
        raise ValueError('prefetch_time_policy.rate_limit_guard phải là object hợp lệ.')
    guard_base = base['rate_limit_guard']

    jitter_percent = _to_float(
        guard_payload.get('jitter_percent', guard_base['jitter_percent']),
        'prefetch_time_policy.rate_limit_guard.jitter_percent',
    )
    if jitter_percent < 0 or jitter_percent > 50:
        raise ValueError('prefetch_time_policy.rate_limit_guard.jitter_percent phải trong khoảng [0, 50].')

    cooldown_multiplier_on_429 = _to_float(
        guard_payload.get('cooldown_multiplier_on_429', guard_base['cooldown_multiplier_on_429']),
        'prefetch_time_policy.rate_limit_guard.cooldown_multiplier_on_429',
    )
    if cooldown_multiplier_on_429 < 1:
        raise ValueError('prefetch_time_policy.rate_limit_guard.cooldown_multiplier_on_429 phải >= 1.')

    max_interval_seconds = _to_int(
        guard_payload.get('max_interval_seconds', guard_base['max_interval_seconds']),
        'prefetch_time_policy.rate_limit_guard.max_interval_seconds',
        minimum=60,
    )

    for profile_name, profile_payload in normalized_profiles.items():
        if profile_payload['interval_seconds'] > max_interval_seconds:
            raise ValueError(
                f'prefetch_time_policy.profiles.{profile_name}.interval_seconds không được lớn hơn '
                'prefetch_time_policy.rate_limit_guard.max_interval_seconds.'
            )

    return {
        'timezone': timezone_name,
        'market': {
            'open_time': open_time,
            'close_time': close_time,
            'pre_open_minutes': pre_open_minutes,
            'post_close_minutes': post_close_minutes,
            'lunch_break': {
                'enabled': lunch_enabled,
                'start': lunch_start,
                'end': lunch_end,
            },
            'weekend_mode': weekend_mode,
        },
        'profiles': normalized_profiles,
        'rate_limit_guard': {
            'jitter_percent': jitter_percent,
            'cooldown_multiplier_on_429': cooldown_multiplier_on_429,
            'max_interval_seconds': max_interval_seconds,
        },
    }


def _get_runtime_prefetch_time_policy():
    from django.core.cache import cache

    default_policy = _default_prefetch_time_policy()
    cached = cache.get(PREFETCH_TIME_POLICY_CACHE_KEY)
    if not isinstance(cached, dict):
        return default_policy
    try:
        return _coerce_prefetch_time_policy(cached, fallback=default_policy)
    except ValueError:
        return default_policy


def _set_runtime_prefetch_time_policy(raw_payload):
    from django.core.cache import cache

    normalized = _coerce_prefetch_time_policy(raw_payload, fallback=_default_prefetch_time_policy())
    cache.set(PREFETCH_TIME_POLICY_CACHE_KEY, normalized, timeout=None)
    return normalized
