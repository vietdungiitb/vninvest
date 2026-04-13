from __future__ import annotations

import logging

from django.core.cache import cache

from portfolio.models import WhaleAdvisory
from portfolio.tasks_advisory_helpers import (
    _get_remaining_advisory_budget,
    _get_remaining_auto_refreshes,
)

logger = logging.getLogger(__name__)


def _check_user_cfg_guards(
    *,
    user_cfg,
    source_key: str,
    symbol: str,
    user_id: int,
) -> tuple[dict | None, int | None]:
    """Check source-flag, concurrency-lock, and budget guards for a given user config.

    Returns:
        (skip_response_dict, None)  – if any guard rejects the request.
        (None, remaining_budget)    – if all guards pass and generation may proceed.
    """
    if source_key == WhaleAdvisory.SourceChoices.WHALE_SIGNAL and not user_cfg.advisory_whale_signal_enabled:
        return (
            {'skip_response': {'status': 'skipped', 'symbol': symbol, 'reason': 'whale_signal_disabled', 'user_id': user_id}},
            None,
        )
    if source_key == WhaleAdvisory.SourceChoices.PERIODIC_JOB and not user_cfg.advisory_auto_generation_enabled:
        return (
            {'skip_response': {'status': 'skipped', 'symbol': symbol, 'reason': 'auto_generation_disabled', 'user_id': user_id}},
            None,
        )
    if source_key == WhaleAdvisory.SourceChoices.USER_REFRESH and not user_cfg.advisory_manual_refresh_enabled:
        return (
            {'skip_response': {'status': 'skipped', 'symbol': symbol, 'reason': 'manual_refresh_disabled', 'user_id': user_id}},
            None,
        )

    generation_lock_key = f'advisory:gen-lock:{user_id}'
    lock_acquired = cache.add(generation_lock_key, 1, timeout=90)
    if not lock_acquired:
        logger.info('Whale advisory generation locked (concurrent task) for user=%s symbol=%s', user_id, symbol)
        return (
            {'skip_response': {'status': 'skipped', 'symbol': symbol, 'reason': 'concurrent_generation_active', 'user_id': user_id}},
            None,
        )

    try:
        remaining_budget = _get_remaining_advisory_budget(user_cfg)
        if remaining_budget <= 0:
            logger.info('Whale advisory budget exhausted for user=%s symbol=%s source=%s', user_id, symbol, source_key)
            return (
                {
                    'skip_response': {
                        'status': 'skipped',
                        'symbol': symbol,
                        'reason': 'daily_budget_exceeded',
                        'user_id': user_id,
                        'source': source_key,
                    }
                },
                None,
            )
        if source_key == WhaleAdvisory.SourceChoices.PERIODIC_JOB and _get_remaining_auto_refreshes(user_cfg) <= 0:
            logger.info('Whale advisory auto-refresh count exhausted for user=%s symbol=%s', user_id, symbol)
            return (
                {
                    'skip_response': {
                        'status': 'skipped',
                        'symbol': symbol,
                        'reason': 'daily_auto_refresh_limit_exceeded',
                        'user_id': user_id,
                        'source': source_key,
                    }
                },
                None,
            )
    finally:
        cache.delete(generation_lock_key)

    return (None, remaining_budget)
