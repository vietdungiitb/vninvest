from __future__ import annotations

import logging

from django.conf import settings
from django.core.cache import cache

from portfolio.ai_runtime_config import resolve_ai_runtime_config
from portfolio.models import UserConfig, WhaleAdvisory
from portfolio.tasks_advisory_helpers import (
    _normalize_advisory_source,
    _get_remaining_advisory_budget,
    _get_remaining_auto_refreshes,
    _should_use_concise_advisory,
    _resolve_model_for_budget,
)

logger = logging.getLogger(__name__)


def _prepare_whale_generation_context(
    *,
    symbol: str,
    user_id: int | None,
    source: str,
    force_refresh: bool,
) -> dict:
    cooldown = getattr(settings, 'WHALE_ADVISORY_COOLDOWN_SECONDS', 900)
    cache_key = f'whale_advisory_lock:{user_id}:{symbol}' if user_id is not None else f'whale_advisory_lock:{symbol}'
    source_key = _normalize_advisory_source(source)

    advisory_qs = WhaleAdvisory.objects.filter(symbol=symbol)
    if user_id is not None:
        advisory_qs = advisory_qs.filter(user_id=user_id)
    latest_existing_advisory = advisory_qs.order_by('-created_at').first()

    if not force_refresh and latest_existing_advisory is not None:
        logger.info('Whale advisory already exists — skipping auto generation for %s', symbol)
        return {'skip_response': {'status': 'skipped', 'symbol': symbol, 'reason': 'existing_advisory'}}

    if not force_refresh and cache.get(cache_key):
        logger.info('Whale advisory cooldown active — skipping %s', symbol)
        return {'skip_response': {'status': 'skipped', 'symbol': symbol, 'reason': 'cooldown'}}

    target_user = None
    user_cfg = None
    remaining_budget = None
    if user_id is not None:
        user_cfg = UserConfig.objects.filter(user_id=user_id).select_related('user').first()
        target_user = getattr(user_cfg, 'user', None)

    if user_cfg is not None:
        if source_key == WhaleAdvisory.SourceChoices.WHALE_SIGNAL and not user_cfg.advisory_whale_signal_enabled:
            return {'skip_response': {'status': 'skipped', 'symbol': symbol, 'reason': 'whale_signal_disabled', 'user_id': user_id}}
        if source_key == WhaleAdvisory.SourceChoices.PERIODIC_JOB and not user_cfg.advisory_auto_generation_enabled:
            return {'skip_response': {'status': 'skipped', 'symbol': symbol, 'reason': 'auto_generation_disabled', 'user_id': user_id}}
        if source_key == WhaleAdvisory.SourceChoices.USER_REFRESH and not user_cfg.advisory_manual_refresh_enabled:
            return {'skip_response': {'status': 'skipped', 'symbol': symbol, 'reason': 'manual_refresh_disabled', 'user_id': user_id}}

        generation_lock_key = f'advisory:gen-lock:{user_id}'
        lock_acquired = cache.add(generation_lock_key, 1, timeout=90)
        if not lock_acquired:
            logger.info('Whale advisory generation locked (concurrent task) for user=%s symbol=%s', user_id, symbol)
            return {'skip_response': {'status': 'skipped', 'symbol': symbol, 'reason': 'concurrent_generation_active', 'user_id': user_id}}

        try:
            remaining_budget = _get_remaining_advisory_budget(user_cfg)
            if remaining_budget <= 0:
                logger.info('Whale advisory budget exhausted for user=%s symbol=%s source=%s', user_id, symbol, source_key)
                return {
                    'skip_response': {
                        'status': 'skipped',
                        'symbol': symbol,
                        'reason': 'daily_budget_exceeded',
                        'user_id': user_id,
                        'source': source_key,
                    }
                }
            if source_key == WhaleAdvisory.SourceChoices.PERIODIC_JOB and _get_remaining_auto_refreshes(user_cfg) <= 0:
                logger.info('Whale advisory auto-refresh count exhausted for user=%s symbol=%s', user_id, symbol)
                return {
                    'skip_response': {
                        'status': 'skipped',
                        'symbol': symbol,
                        'reason': 'daily_auto_refresh_limit_exceeded',
                        'user_id': user_id,
                        'source': source_key,
                    }
                }
        finally:
            cache.delete(generation_lock_key)

    runtime_cfg = resolve_ai_runtime_config(user=target_user)
    if not runtime_cfg.get('ready'):
        logger.info(
            'Whale advisory skipped for %s: runtime AI not ready reason=%s user_id=%s',
            symbol,
            runtime_cfg.get('reason'),
            user_id,
        )
        return {
            'skip_response': {
                'status': 'skipped',
                'symbol': symbol,
                'reason': str(runtime_cfg.get('reason') or 'runtime_ai_not_ready'),
                'user_id': user_id,
                'ai_source': runtime_cfg.get('source'),
            }
        }

    provider = str(runtime_cfg.get('provider') or 'openclaw').strip().lower()
    model = str(runtime_cfg.get('model') or '').strip()
    api_key = str(runtime_cfg.pop('api_key', '') or '').strip()
    ai_source = str(runtime_cfg.get('source') or 'unknown')

    if cache.get(f'advisory:provider-ratelimit:{provider}'):
        logger.info(
            'Whale advisory skipped — provider %s still in rate-limit cooldown symbol=%s user_id=%s',
            provider,
            symbol,
            user_id,
        )
        return {
            'skip_response': {
                'status': 'skipped',
                'symbol': symbol,
                'reason': 'provider_rate_limit_cooldown',
                'user_id': user_id,
            }
        }

    output_language = str(getattr(user_cfg, 'language', 'vi') if user_cfg is not None else 'vi').strip().lower()
    if output_language not in {'vi', 'en'}:
        output_language = 'vi'

    total_budget = int(user_cfg.advisory_max_tokens_per_day or 0) if user_cfg is not None else None
    resolved_model = _resolve_model_for_budget(provider, model, remaining_budget, total_budget)
    use_concise = _should_use_concise_advisory(source_key, remaining_budget)

    return {
        'cooldown': cooldown,
        'cache_key': cache_key,
        'source_key': source_key,
        'latest_existing_advisory': latest_existing_advisory,
        'target_user': target_user,
        'user_cfg': user_cfg,
        'remaining_budget': remaining_budget,
        'provider': provider,
        'model': resolved_model,
        'primary_provider': provider,
        'primary_model': resolved_model,
        'api_key': api_key,
        'ai_source': ai_source,
        'output_language': output_language,
        'total_budget': total_budget,
        'use_concise': use_concise,
    }
