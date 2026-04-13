from __future__ import annotations

import logging

from django.core.cache import cache
from django.utils import timezone

logger = logging.getLogger(__name__)


def _increment_preflight_counter(metric: str) -> None:
    key = f'whale_preflight:metrics:{timezone.localdate().isoformat()}:{metric}'
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
        _increment_preflight_counter('existing_advisory_miss')
        return None
    logger.info('Whale advisory already exists — skipping auto generation for %s', symbol)
    _increment_preflight_counter('existing_advisory_hit')
    return _build_skip_response(symbol=symbol, reason='existing_advisory')


def _check_cooldown_skip(*, force_refresh: bool, cache_key: str, symbol: str) -> dict | None:
    if force_refresh:
        _increment_preflight_counter('cooldown_bypass_force_refresh')
        return None

    has_cooldown = bool(cache.get(cache_key))
    if not has_cooldown:
        _increment_preflight_counter('cooldown_miss')
        return None

    logger.info('Whale advisory cooldown active — skipping %s', symbol)
    _increment_preflight_counter('cooldown_hit')
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
