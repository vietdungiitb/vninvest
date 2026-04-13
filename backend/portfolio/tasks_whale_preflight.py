from __future__ import annotations

import logging

from django.conf import settings
from django.core.cache import cache

from portfolio.ai_runtime_config import resolve_ai_runtime_config
from portfolio.models import UserConfig, WhaleAdvisory
from portfolio.tasks_advisory_helpers import (
    _normalize_advisory_source,
    _should_use_concise_advisory,
    _resolve_model_for_budget,
)
from portfolio.tasks_whale_preflight_guards import _check_user_cfg_guards

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
        _guard_skip, remaining_budget = _check_user_cfg_guards(
            user_cfg=user_cfg,
            source_key=source_key,
            symbol=symbol,
            user_id=user_id,
        )
        if _guard_skip is not None:
            return _guard_skip

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
