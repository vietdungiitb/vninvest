from __future__ import annotations

import logging

from django.conf import settings
from django.core.cache import cache

from portfolio.models import UserConfig, WhaleAdvisory
from portfolio.tasks_advisory_helpers import _normalize_advisory_source
from portfolio.tasks_whale_preflight_guards import _check_user_cfg_guards
from portfolio.tasks_whale_preflight_ai import (
    _check_ai_runtime_config,
    _check_provider_rate_limit,
    _extract_ai_config_values,
)
from portfolio.tasks_whale_preflight_language import _resolve_advisory_output_config

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

    ai_config_result = _check_ai_runtime_config(target_user=target_user, symbol=symbol, user_id=user_id)
    
    # Handle skip response (AI not ready)
    if isinstance(ai_config_result, dict) and 'skip_response' in ai_config_result:
        return ai_config_result
    
    # Extract config from tuple result
    runtime_cfg, _ = ai_config_result
    provider, model, api_key = _extract_ai_config_values(runtime_cfg)
    ai_source = str(runtime_cfg.get('source') or 'unknown')

    provider_check = _check_provider_rate_limit(provider=provider, symbol=symbol, user_id=user_id)
    if provider_check is not None:
        return provider_check

    total_budget = int(user_cfg.advisory_max_tokens_per_day or 0) if user_cfg is not None else None
    output_cfg = _resolve_advisory_output_config(
        user_cfg=user_cfg,
        provider=provider,
        model=model,
        source_key=source_key,
        remaining_budget=remaining_budget,
        total_budget=total_budget,
    )
    output_language = output_cfg['output_language']
    resolved_model = output_cfg['resolved_model']
    use_concise = output_cfg['use_concise']

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
