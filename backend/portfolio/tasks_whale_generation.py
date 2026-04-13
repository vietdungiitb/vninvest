"""Whale Advisory Generation Workers"""

from __future__ import annotations

from datetime import datetime
import os
import random

from celery import shared_task
from django.utils import timezone

from portfolio.models import WhaleAdvisory

from portfolio.observability import (
    end_advisory_phase,
    end_advisory_session,
    record_advisory_error_recovery,
    start_advisory_phase,
    start_advisory_session,
)

from portfolio.tasks_whale_execution import _execute_whale_generation_postprovider
from portfolio.tasks_whale_bookkeeping import (
    _collect_generation_language_metrics,
    _record_generation_token_usage,
)
from portfolio.tasks_news_context import _fetch_news_context_for_advisory
from portfolio.tasks_whale_preflight import _prepare_whale_generation_context
from portfolio.tasks_whale_provider_generation import _run_whale_provider_generation


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=60, retry_kwargs={'max_retries': 2})
def generate_whale_advisory_task(
    self,
    symbol: str,
    matched_value_vnd: float,
    side: str,
    threshold: float = 0,
    force_refresh: bool = False,
    user_id: int | None = None,
    source: str = WhaleAdvisory.SourceChoices.WHALE_SIGNAL,
    merged_sources: list[str] | None = None,
    primary_source: str | None = None,
    advisory_type: str = WhaleAdvisory.AdvisoryTypeChoices.DEFAULT,
    severity_override: str | None = None,
    threshold_source: str = 'user_default',
    dark_flow_strength: float | None = None,
    dark_flow_confidence: str | None = None,
) -> dict:
    """
    Generate whale advisory via AI provider.
    
    Steps:
    1. Check Redis cooldown G�� skip if generated recently
    2. Call AI provider (summary + detail)
    3. Save WhaleAdvisory to DB
    4. Push WebSocket event to user/symbol group
    """
    preflight = _prepare_whale_generation_context(
        symbol=symbol,
        user_id=user_id,
        source=source,
        force_refresh=force_refresh,
    )
    if preflight.get('skip_response') is not None:
        return preflight['skip_response']

    cooldown = preflight['cooldown']
    cache_key = preflight['cache_key']
    source_key = preflight['source_key']
    latest_existing_advisory = preflight['latest_existing_advisory']
    target_user = preflight['target_user']
    user_cfg = preflight['user_cfg']
    remaining_budget = preflight['remaining_budget']
    provider = preflight['provider']
    model = preflight['model']
    primary_provider = preflight['primary_provider']
    primary_model = preflight['primary_model']
    api_key = preflight['api_key']
    ai_source = preflight['ai_source']
    output_language = preflight['output_language']
    _total_budget = preflight['total_budget']
    use_concise = preflight['use_concise']

    news_hint = '' if use_concise else _fetch_news_context_for_advisory(symbol)

    start_advisory_session()
    start_advisory_phase('provider_generation')
    try:
        provider_result = _run_whale_provider_generation(
            symbol=symbol,
            matched_value_vnd=matched_value_vnd,
            side=side,
            target_user=target_user,
            output_language=output_language,
            use_concise=use_concise,
            news_hint=news_hint,
            remaining_budget=remaining_budget,
            total_budget=_total_budget,
            primary_provider=primary_provider,
            primary_model=model,
            api_key=api_key,
        )
    except Exception as exc:
        end_advisory_phase('provider_generation')
        record_advisory_error_recovery(type(exc).__name__, 'provider_generation_failed', success=False)
        end_advisory_session()
        raise

    end_advisory_phase('provider_generation')
    summary_resp = provider_result['summary_resp']
    deep_resp = provider_result['deep_resp']
    provider = provider_result['provider']
    model = provider_result['model']
    primary_model = provider_result['primary_model']
    failover_occurred = provider_result['failover_occurred']
    failover_reason = provider_result['failover_reason']
    failover_chain_attempted = provider_result['failover_chain_attempted']
    failover_attempt_count = provider_result['failover_attempt_count']

    language_mismatch = _collect_generation_language_metrics(
        symbol=symbol,
        provider=provider,
        model=model,
        output_language=output_language,
        summary_resp=summary_resp,
        deep_resp=deep_resp,
    )

    _record_generation_token_usage(
        summary_resp=summary_resp,
        deep_resp=deep_resp,
        use_concise=use_concise,
    )
    return _execute_whale_generation_postprovider(
        symbol=symbol,
        matched_value_vnd=matched_value_vnd,
        side=side,
        threshold=float(threshold or 0),
        source=source,
        force_refresh=force_refresh,
        user_id=user_id,
        source_key=source_key,
        advisory_type=advisory_type,
        severity_override=severity_override,
        threshold_source=threshold_source,
        dark_flow_strength=dark_flow_strength,
        dark_flow_confidence=dark_flow_confidence,
        latest_existing_advisory=latest_existing_advisory,
        target_user=target_user,
        user_cfg=user_cfg,
        provider=provider,
        model=model,
        primary_provider=primary_provider,
        primary_model=primary_model,
        ai_source=ai_source,
        output_language=output_language,
        language_mismatch=language_mismatch,
        failover_occurred=failover_occurred,
        failover_reason=failover_reason,
        failover_chain_attempted=failover_chain_attempted,
        failover_attempt_count=failover_attempt_count,
        use_concise=use_concise,
        cache_key=cache_key,
        cooldown=cooldown,
        summary_resp=summary_resp,
        deep_resp=deep_resp,
        merged_sources=merged_sources,
        primary_source=primary_source,
        task_id=getattr(self.request, 'id', ''),
    )


