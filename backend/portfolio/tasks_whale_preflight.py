from __future__ import annotations

import logging

from django.conf import settings

from portfolio.models import UserConfig, WhaleAdvisory
from portfolio.tasks_advisory_helpers import _normalize_advisory_source
from portfolio.tasks_whale_preflight_guards import _check_user_cfg_guards
from portfolio.tasks_whale_preflight_ai import (
    _check_ai_runtime_config,
    _check_provider_rate_limit,
    _extract_ai_config_values,
)
from portfolio.tasks_whale_preflight_cache import _check_preflight_cache_skips
from portfolio.tasks_whale_preflight_language import _resolve_advisory_output_config

logger = logging.getLogger(__name__)


def _unwrap_or_return_skip(check_result):
    if isinstance(check_result, dict) and 'skip_response' in check_result:
        return check_result, None
    return None, check_result


def _build_whale_generation_context_dict(
    *,
    cooldown: int,
    cache_key: str,
    source_key: str,
    latest_existing_advisory,
    target_user,
    user_cfg,
    remaining_budget,
    provider: str,
    resolved_model: str,
    api_key: str,
    ai_source: str,
    output_language: str,
    total_budget,
    use_concise: bool,
) -> dict:
    """
    Assemble whale advisory generation context dictionary.
    
    Consolidates all preflight decisions into a single context dict
    for downstream generation tasks.
    """
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
        'primary_provider': provider,  # Legacy alias for backward compatibility
        'primary_model': resolved_model,  # Legacy alias for backward compatibility
        'api_key': api_key,
        'ai_source': ai_source,
        'output_language': output_language,
        'total_budget': total_budget,
        'use_concise': use_concise,
    }


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

    cache_skip = _check_preflight_cache_skips(
        force_refresh=force_refresh,
        latest_existing_advisory=latest_existing_advisory,
        cache_key=cache_key,
        symbol=symbol,
    )
    if cache_skip is not None:
        return cache_skip

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
    skip_response, ai_payload = _unwrap_or_return_skip(ai_config_result)
    if skip_response is not None:
        return skip_response

    # Extract config from tuple result
    runtime_cfg, _ = ai_payload
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

    return _build_whale_generation_context_dict(
        cooldown=cooldown,
        cache_key=cache_key,
        source_key=source_key,
        latest_existing_advisory=latest_existing_advisory,
        target_user=target_user,
        user_cfg=user_cfg,
        remaining_budget=remaining_budget,
        provider=provider,
        resolved_model=resolved_model,
        api_key=api_key,
        ai_source=ai_source,
        output_language=output_language,
        total_budget=total_budget,
        use_concise=use_concise,
    )
