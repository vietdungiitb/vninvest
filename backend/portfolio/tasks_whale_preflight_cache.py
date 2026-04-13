from __future__ import annotations

import logging

from django.core.cache import cache
from django.utils import timezone

logger = logging.getLogger(__name__)


WHALE_PREFLIGHT_METRIC_PREFIX = 'whale_preflight:metrics'
METRIC_EXISTING_ADVISORY_HIT = 'existing_advisory_hit'
METRIC_EXISTING_ADVISORY_MISS = 'existing_advisory_miss'
METRIC_COOLDOWN_HIT = 'cooldown_hit'
METRIC_COOLDOWN_MISS = 'cooldown_miss'
METRIC_COOLDOWN_BYPASS_FORCE_REFRESH = 'cooldown_bypass_force_refresh'

WHALE_PREFLIGHT_METRIC_NAMES = (
    METRIC_EXISTING_ADVISORY_HIT,
    METRIC_EXISTING_ADVISORY_MISS,
    METRIC_COOLDOWN_HIT,
    METRIC_COOLDOWN_MISS,
    METRIC_COOLDOWN_BYPASS_FORCE_REFRESH,
)


def _metric_cache_key(*, day_key: str, metric: str) -> str:
    return f'{WHALE_PREFLIGHT_METRIC_PREFIX}:{day_key}:{metric}'


def _read_preflight_metrics(*, day_key: str, metric_names: tuple[str, ...] = WHALE_PREFLIGHT_METRIC_NAMES) -> dict:
    metrics: dict[str, int] = {}
    for name in metric_names:
        try:
            metrics[name] = int(cache.get(_metric_cache_key(day_key=day_key, metric=name)) or 0)
        except Exception:
            metrics[name] = 0
    return metrics


def _increment_preflight_counter(metric: str) -> None:
    if metric not in WHALE_PREFLIGHT_METRIC_NAMES:
        logger.warning('Unknown whale preflight metric: %s', metric)
        return

    key = _metric_cache_key(day_key=timezone.localdate().isoformat(), metric=metric)
    try:
        cache.incr(key)
    except ValueError:
        cache.set(key, 1, timeout=90_000)
    except Exception:
        pass


def _build_skip_response(*, symbol: str, reason: str) -> dict:
    return {'skip_response': {'status': 'skipped', 'symbol': symbol, 'reason': reason}}


def _check_existing_advisory_skip(*, force_refresh: bool, latest_existing_advisory, symbol: str) -> dict | None:
    if force_refresh or latest_existing_advisory is None:
        _increment_preflight_counter(METRIC_EXISTING_ADVISORY_MISS)
        return None
    logger.info('Whale advisory already exists — skipping auto generation for %s', symbol)
    _increment_preflight_counter(METRIC_EXISTING_ADVISORY_HIT)
    return _build_skip_response(symbol=symbol, reason='existing_advisory')


def _check_cooldown_skip(*, force_refresh: bool, cache_key: str, symbol: str) -> dict | None:
    if force_refresh:
        _increment_preflight_counter(METRIC_COOLDOWN_BYPASS_FORCE_REFRESH)
        return None

    has_cooldown = bool(cache.get(cache_key))
    if not has_cooldown:
        _increment_preflight_counter(METRIC_COOLDOWN_MISS)
        return None

    logger.info('Whale advisory cooldown active — skipping %s', symbol)
    _increment_preflight_counter(METRIC_COOLDOWN_HIT)
    return _build_skip_response(symbol=symbol, reason='cooldown')


def _check_preflight_cache_skips(
    *,
    force_refresh: bool,
    latest_existing_advisory,
    cache_key: str,
    symbol: str,
) -> dict | None:
    existing_skip = _check_existing_advisory_skip(
        force_refresh=force_refresh,
        latest_existing_advisory=latest_existing_advisory,
        symbol=symbol,
    )
    if existing_skip is not None:
        return existing_skip

    cooldown_skip = _check_cooldown_skip(
        force_refresh=force_refresh,
        cache_key=cache_key,
        symbol=symbol,
    )
    if cooldown_skip is not None:
        return cooldown_skip

    return None
