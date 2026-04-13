from __future__ import annotations

import logging

from django.core.cache import cache

logger = logging.getLogger(__name__)


def _build_skip_response(*, symbol: str, reason: str) -> dict:
    return {'skip_response': {'status': 'skipped', 'symbol': symbol, 'reason': reason}}


def _check_existing_advisory_skip(*, force_refresh: bool, latest_existing_advisory, symbol: str) -> dict | None:
    if force_refresh or latest_existing_advisory is None:
        return None
    logger.info('Whale advisory already exists — skipping auto generation for %s', symbol)
    return _build_skip_response(symbol=symbol, reason='existing_advisory')


def _check_cooldown_skip(*, force_refresh: bool, cache_key: str, symbol: str) -> dict | None:
    if force_refresh or not cache.get(cache_key):
        return None
    logger.info('Whale advisory cooldown active — skipping %s', symbol)
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
