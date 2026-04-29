from __future__ import annotations

import json
import logging

from django.conf import settings

from .system_settings import get_setting, set_setting


logger = logging.getLogger(__name__)

GLOBAL_SIGNAL_SERVICES_CONFIG_KEY = 'global_signal_services_config'
GLOBAL_SIGNAL_UNIVERSE_POLICY_KEY = 'global_signal_universe_policy'
GLOBAL_SIGNAL_RETENTION_POLICY_KEY = 'global_signal_retention_policy'


def _coerce_bool(value, default: bool) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {'1', 'true', 'yes', 'on'}:
            return True
        if normalized in {'0', 'false', 'no', 'off'}:
            return False
    if value is None:
        return bool(default)
    return bool(value)


def _coerce_int(value, *, field_name: str, default: int, minimum: int = 0) -> int:
    try:
        parsed = int(default if value is None else value)
    except (TypeError, ValueError):
        raise ValueError(f'{field_name} phải là số nguyên hợp lệ.')
    return max(parsed, minimum)


def _coerce_symbol_list(value, *, field_name: str) -> list[str]:
    if value in (None, ''):
        return []
    if not isinstance(value, (list, tuple)):
        raise ValueError(f'{field_name} phải là danh sách mã hợp lệ.')

    normalized = []
    seen = set()
    for raw_symbol in value:
        symbol = str(raw_symbol or '').strip().upper()
        if not symbol:
            continue
        if symbol in seen:
            continue
        seen.add(symbol)
        normalized.append(symbol)
    return normalized


def _coerce_positive_id_list(value, *, field_name: str) -> list[int]:
    if value in (None, ''):
        return []
    if not isinstance(value, (list, tuple)):
        raise ValueError(f'{field_name} phải là danh sách số nguyên hợp lệ.')

    normalized = []
    for raw_value in value:
        try:
            parsed = int(raw_value)
        except (TypeError, ValueError):
            raise ValueError(f'{field_name} phải là danh sách số nguyên hợp lệ.')
        if parsed < 1:
            raise ValueError(f'{field_name} phải chứa id >= 1.')
        if parsed not in normalized:
            normalized.append(parsed)
    return normalized


def default_global_signal_services_config() -> dict:
    return {
        'enabled': True,
        'whale_service': {
            'enabled': True,
            'default_threshold_vnd': 500_000_000,
            'market_top_tier_multiplier': 5,
            'cooldown_seconds': 120,
            'manual_run_limit': 200,
        },
        'dark_flow_service': {
            'enabled': True,
            'window_seconds': 300,
            'warning_strength': 40,
            'urgent_strength': 70,
            'cooldown_seconds': 300,
        },
        'distribution': {
            'websocket_enabled': True,
            'history_enabled': True,
            'fanout_batch_size': 200,
        },
    }


def default_global_signal_universe_policy() -> dict:
    return {
        'include_tracked_symbols': True,
        'include_watchlist_symbols': True,
        'include_alert_symbols': True,
        'include_portfolio_symbols': True,
        'include_group_symbols': False,
        'selected_group_ids': [],
        'admin_symbols': [],
        'force_selected_groups_to_warm_tier': True,
    }


def default_global_signal_retention_policy() -> dict:
    return {
        'raw_intraday_keep_days': max(int(getattr(settings, 'INTRADAY_TICK_KEEP_DAYS', 7) or 7), 1),
        'whale_event_keep_days': 90,
        'dark_flow_keep_days': 90,
        'summary_cache_ttl_seconds': 900,
        'require_preview_before_purge': True,
    }


def coerce_global_signal_services_config(raw_payload, fallback=None) -> dict:
    payload = raw_payload if isinstance(raw_payload, dict) else {}
    base = fallback or default_global_signal_services_config()

    whale_payload = payload.get('whale_service') if isinstance(payload.get('whale_service'), dict) else {}
    dark_flow_payload = payload.get('dark_flow_service') if isinstance(payload.get('dark_flow_service'), dict) else {}
    distribution_payload = payload.get('distribution') if isinstance(payload.get('distribution'), dict) else {}

    normalized = {
        'enabled': _coerce_bool(payload.get('enabled'), base['enabled']),
        'whale_service': {
            'enabled': _coerce_bool(whale_payload.get('enabled'), base['whale_service']['enabled']),
            'default_threshold_vnd': _coerce_int(
                whale_payload.get('default_threshold_vnd'),
                field_name='whale_service.default_threshold_vnd',
                default=base['whale_service']['default_threshold_vnd'],
                minimum=1,
            ),
            'market_top_tier_multiplier': _coerce_int(
                whale_payload.get('market_top_tier_multiplier'),
                field_name='whale_service.market_top_tier_multiplier',
                default=base['whale_service']['market_top_tier_multiplier'],
                minimum=1,
            ),
            'cooldown_seconds': _coerce_int(
                whale_payload.get('cooldown_seconds'),
                field_name='whale_service.cooldown_seconds',
                default=base['whale_service']['cooldown_seconds'],
                minimum=0,
            ),
            'manual_run_limit': _coerce_int(
                whale_payload.get('manual_run_limit'),
                field_name='whale_service.manual_run_limit',
                default=base['whale_service']['manual_run_limit'],
                minimum=1,
            ),
        },
        'dark_flow_service': {
            'enabled': _coerce_bool(dark_flow_payload.get('enabled'), base['dark_flow_service']['enabled']),
            'window_seconds': _coerce_int(
                dark_flow_payload.get('window_seconds'),
                field_name='dark_flow_service.window_seconds',
                default=base['dark_flow_service']['window_seconds'],
                minimum=1,
            ),
            'warning_strength': _coerce_int(
                dark_flow_payload.get('warning_strength'),
                field_name='dark_flow_service.warning_strength',
                default=base['dark_flow_service']['warning_strength'],
                minimum=0,
            ),
            'urgent_strength': _coerce_int(
                dark_flow_payload.get('urgent_strength'),
                field_name='dark_flow_service.urgent_strength',
                default=base['dark_flow_service']['urgent_strength'],
                minimum=0,
            ),
            'cooldown_seconds': _coerce_int(
                dark_flow_payload.get('cooldown_seconds'),
                field_name='dark_flow_service.cooldown_seconds',
                default=base['dark_flow_service']['cooldown_seconds'],
                minimum=0,
            ),
        },
        'distribution': {
            'websocket_enabled': _coerce_bool(distribution_payload.get('websocket_enabled'), base['distribution']['websocket_enabled']),
            'history_enabled': _coerce_bool(distribution_payload.get('history_enabled'), base['distribution']['history_enabled']),
            'fanout_batch_size': _coerce_int(
                distribution_payload.get('fanout_batch_size'),
                field_name='distribution.fanout_batch_size',
                default=base['distribution']['fanout_batch_size'],
                minimum=1,
            ),
        },
    }

    if normalized['dark_flow_service']['urgent_strength'] < normalized['dark_flow_service']['warning_strength']:
        raise ValueError('dark_flow_service.urgent_strength phải lớn hơn hoặc bằng warning_strength.')

    return normalized


def coerce_global_signal_universe_policy(raw_payload, fallback=None) -> dict:
    payload = raw_payload if isinstance(raw_payload, dict) else {}
    base = fallback or default_global_signal_universe_policy()

    return {
        'include_tracked_symbols': _coerce_bool(payload.get('include_tracked_symbols'), base['include_tracked_symbols']),
        'include_watchlist_symbols': _coerce_bool(payload.get('include_watchlist_symbols'), base['include_watchlist_symbols']),
        'include_alert_symbols': _coerce_bool(payload.get('include_alert_symbols'), base['include_alert_symbols']),
        'include_portfolio_symbols': _coerce_bool(payload.get('include_portfolio_symbols'), base['include_portfolio_symbols']),
        'include_group_symbols': _coerce_bool(payload.get('include_group_symbols'), base['include_group_symbols']),
        'selected_group_ids': _coerce_positive_id_list(
            payload.get('selected_group_ids', base['selected_group_ids']),
            field_name='selected_group_ids',
        ),
        'admin_symbols': _coerce_symbol_list(
            payload.get('admin_symbols', base['admin_symbols']),
            field_name='admin_symbols',
        ),
        'force_selected_groups_to_warm_tier': _coerce_bool(
            payload.get('force_selected_groups_to_warm_tier'),
            base['force_selected_groups_to_warm_tier'],
        ),
    }


def coerce_global_signal_retention_policy(raw_payload, fallback=None) -> dict:
    payload = raw_payload if isinstance(raw_payload, dict) else {}
    base = fallback or default_global_signal_retention_policy()

    return {
        'raw_intraday_keep_days': _coerce_int(
            payload.get('raw_intraday_keep_days'),
            field_name='raw_intraday_keep_days',
            default=base['raw_intraday_keep_days'],
            minimum=1,
        ),
        'whale_event_keep_days': _coerce_int(
            payload.get('whale_event_keep_days'),
            field_name='whale_event_keep_days',
            default=base['whale_event_keep_days'],
            minimum=1,
        ),
        'dark_flow_keep_days': _coerce_int(
            payload.get('dark_flow_keep_days'),
            field_name='dark_flow_keep_days',
            default=base['dark_flow_keep_days'],
            minimum=1,
        ),
        'summary_cache_ttl_seconds': _coerce_int(
            payload.get('summary_cache_ttl_seconds'),
            field_name='summary_cache_ttl_seconds',
            default=base['summary_cache_ttl_seconds'],
            minimum=60,
        ),
        'require_preview_before_purge': _coerce_bool(
            payload.get('require_preview_before_purge'),
            base['require_preview_before_purge'],
        ),
    }


def _read_json_setting(key: str):
    raw_value = str(get_setting(key, '') or '').strip()
    if not raw_value:
        return None
    try:
        return json.loads(raw_value)
    except (TypeError, ValueError, json.JSONDecodeError):
        logger.warning('Invalid %s payload; falling back to defaults', key)
        return None


def _write_json_setting(key: str, payload: dict, *, description: str) -> dict:
    serialized = json.dumps(payload, ensure_ascii=True, separators=(',', ':'))
    set_setting(key, serialized, description=description)
    return payload


def invalidate_global_signal_universe_cache() -> list[str]:
    from django.core.cache import cache

    deleted_keys: list[str] = []

    try:
        from .tasks_prefetch import (
            REALTIME_SHARD_CACHE_PREFIX,
            REALTIME_SHARD_LAST_ENQUEUE_PREFIX,
            REALTIME_UNIVERSE_SNAPSHOT_CACHE_KEY,
            REALTIME_UNIVERSE_TIER_CACHE_PREFIX,
            _resolve_prefetch_topology,
        )
    except Exception:
        REALTIME_UNIVERSE_SNAPSHOT_CACHE_KEY = 'realtime:universe:snapshot'
        REALTIME_UNIVERSE_TIER_CACHE_PREFIX = 'realtime:universe'
        REALTIME_SHARD_CACHE_PREFIX = 'realtime:shard'
        REALTIME_SHARD_LAST_ENQUEUE_PREFIX = 'realtime:shard:last_enqueue'

        def _resolve_prefetch_topology():
            return {}

    snapshot = cache.get(REALTIME_UNIVERSE_SNAPSHOT_CACHE_KEY)
    snapshot_topology = (snapshot or {}).get('topology') if isinstance(snapshot, dict) else {}
    runtime_topology = _resolve_prefetch_topology() or {}

    def _delete(cache_key: str) -> None:
        try:
            cache.delete(cache_key)
            deleted_keys.append(cache_key)
        except Exception:
            logger.warning('Failed to invalidate cache key %s', cache_key, exc_info=True)

    _delete(REALTIME_UNIVERSE_SNAPSHOT_CACHE_KEY)

    for tier in ('hot', 'warm', 'cold'):
        _delete(f'{REALTIME_UNIVERSE_TIER_CACHE_PREFIX}:{tier}')

        snapshot_shards = int(snapshot_topology.get(f'{tier}_shards', 0) or 0)
        runtime_shards = int(runtime_topology.get(f'{tier}_shards', 0) or 0)
        shard_count = max(snapshot_shards, runtime_shards, 0)

        for shard_id in range(shard_count):
            _delete(f'{REALTIME_SHARD_CACHE_PREFIX}:{tier}:{shard_id}')
            _delete(f'{REALTIME_SHARD_LAST_ENQUEUE_PREFIX}:{tier}:{shard_id}')

    return deleted_keys


def get_global_signal_services_config() -> dict:
    defaults = default_global_signal_services_config()
    payload = _read_json_setting(GLOBAL_SIGNAL_SERVICES_CONFIG_KEY)
    try:
        return coerce_global_signal_services_config(payload, fallback=defaults)
    except ValueError:
        return defaults


def set_global_signal_services_config(raw_payload) -> dict:
    normalized = coerce_global_signal_services_config(raw_payload, fallback=default_global_signal_services_config())
    return _write_json_setting(
        GLOBAL_SIGNAL_SERVICES_CONFIG_KEY,
        normalized,
        description='Cấu hình runtime toàn cục cho whale service, dark-flow service và distribution.',
    )


def get_global_signal_universe_policy() -> dict:
    defaults = default_global_signal_universe_policy()
    payload = _read_json_setting(GLOBAL_SIGNAL_UNIVERSE_POLICY_KEY)
    try:
        return coerce_global_signal_universe_policy(payload, fallback=defaults)
    except ValueError:
        return defaults


def set_global_signal_universe_policy(raw_payload) -> dict:
    normalized = coerce_global_signal_universe_policy(raw_payload, fallback=default_global_signal_universe_policy())
    _write_json_setting(
        GLOBAL_SIGNAL_UNIVERSE_POLICY_KEY,
        normalized,
        description='Policy xác định effective universe toàn cục cho các signal services.',
    )
    invalidate_global_signal_universe_cache()
    return normalized


def get_global_signal_retention_policy() -> dict:
    defaults = default_global_signal_retention_policy()
    payload = _read_json_setting(GLOBAL_SIGNAL_RETENTION_POLICY_KEY)
    try:
        return coerce_global_signal_retention_policy(payload, fallback=defaults)
    except ValueError:
        return defaults


def set_global_signal_retention_policy(raw_payload) -> dict:
    normalized = coerce_global_signal_retention_policy(raw_payload, fallback=default_global_signal_retention_policy())
    return _write_json_setting(
        GLOBAL_SIGNAL_RETENTION_POLICY_KEY,
        normalized,
        description='Policy retention cho raw intraday, canonical signal events và summary caches.',
    )