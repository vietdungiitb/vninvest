"""Whale Advisory Generation Workers"""

from __future__ import annotations

from datetime import datetime
import logging
import os
import random

from celery import shared_task
from django.core.cache import cache
from django.utils import timezone

from portfolio.models import WhaleAdvisory

from portfolio.observability import (
    end_advisory_phase,
    end_advisory_session,
    record_advisory_error_recovery,
    record_advisory_token_usage,
    start_advisory_phase,
    start_advisory_session,
)

from portfolio.tasks_advisory_helpers import (
    _token_log_source_for_advisory_source,
    _persist_advisory_metrics_audit_log,
    _persist_advisory_aggregate_snapshot,
    _resolve_next_refresh_at,
    _increment_daily_counter,
    _is_language_mismatch,
)
from portfolio.tasks_news_context import _fetch_news_context_for_advisory
from portfolio.tasks_whale_preflight import _prepare_whale_generation_context
from portfolio.tasks_whale_provider_generation import _run_whale_provider_generation
from portfolio.tasks_whale_postprocess import (
    _resolve_generated_advisory_severity,
    _normalize_generated_advisory_metadata,
    _record_generation_quality_metrics,
    _create_whale_advisory_record,
    _create_advisory_token_log,
    _broadcast_whale_advisory,
)

logger = logging.getLogger(__name__)


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
    1. Check Redis cooldown — skip if generated recently
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

    today_iso = timezone.localdate().isoformat()
    _increment_daily_counter(f'advisory:language-check-count:{output_language}:{today_iso}')
    summary_language_mismatch = _is_language_mismatch(summary_resp.get('text', ''), output_language)
    detail_language_mismatch = _is_language_mismatch(deep_resp.get('text', ''), output_language)
    language_mismatch = bool(summary_language_mismatch or detail_language_mismatch)
    if language_mismatch:
        _increment_daily_counter(f'advisory:language-mismatch-count:{output_language}:{today_iso}')
        logger.warning(
            'Advisory language mismatch detected symbol=%s expected=%s provider=%s model=%s',
            symbol,
            output_language,
            provider,
            model,
        )

    record_advisory_token_usage(
        int(summary_resp.get('prompt_tokens', 0) or 0) + int(summary_resp.get('completion_tokens', 0) or 0),
        source='summary_generation' if not use_concise else 'concise_generation',
    )
    if not use_concise:
        record_advisory_token_usage(
            int(deep_resp.get('prompt_tokens', 0) or 0) + int(deep_resp.get('completion_tokens', 0) or 0),
            source='detail_generation',
        )

    refresh_count = (latest_existing_advisory.refresh_count + 1) if (force_refresh and latest_existing_advisory is not None) else 0
    
    resolved_severity = _resolve_generated_advisory_severity(
        severity_override=severity_override,
        source=source,
        dark_flow_strength=dark_flow_strength,
        dark_flow_confidence=dark_flow_confidence,
        matched_value_vnd=matched_value_vnd,
        threshold=float(threshold or 0),
    )

    metadata = _normalize_generated_advisory_metadata(
        advisory_type=advisory_type,
        merged_sources=merged_sources,
        primary_source=primary_source,
        threshold_source=threshold_source,
    )
    advisory_type_key = metadata['advisory_type_key']
    normalized_merged_sources = metadata['normalized_merged_sources']
    normalized_primary_source = metadata['normalized_primary_source']
    normalized_threshold_source = metadata['normalized_threshold_source']

    _record_generation_quality_metrics(
        source_key=source_key,
        matched_value_vnd=matched_value_vnd,
        threshold=float(threshold or 0),
        dark_flow_strength=dark_flow_strength,
        normalized_merged_sources=normalized_merged_sources,
        resolved_severity=resolved_severity,
        use_concise=use_concise,
    )

    aggregate_snapshot = _persist_advisory_aggregate_snapshot(
        user=target_user,
        symbol=symbol,
        matched_value_vnd=matched_value_vnd,
        threshold=float(threshold or 0),
        side=side,
        source=source_key,
        severity=resolved_severity,
        merged_sources=normalized_merged_sources,
        primary_source=normalized_primary_source,
        dark_flow_strength=dark_flow_strength,
        dark_flow_confidence=dark_flow_confidence,
        use_concise=use_concise,
    )

    start_advisory_phase('persist_advisory')
    advisory = _create_whale_advisory_record(
        target_user=target_user,
        symbol=symbol,
        matched_value_vnd=matched_value_vnd,
        side=side,
        threshold=float(threshold or 0),
        summary_resp=summary_resp,
        deep_resp=deep_resp,
        provider=provider,
        model=model,
        next_refresh_at=_resolve_next_refresh_at(user_cfg),
        refresh_count=refresh_count,
        source_key=source_key,
        aggregate_snapshot=aggregate_snapshot,
        normalized_merged_sources=normalized_merged_sources,
        normalized_primary_source=normalized_primary_source,
        advisory_type_key=advisory_type_key,
        resolved_severity=resolved_severity,
    )

    _create_advisory_token_log(
        target_user=target_user,
        advisory=advisory,
        source=source_key,
        symbol=symbol,
        token_log_source_for_source=_token_log_source_for_advisory_source,
    )
    end_advisory_phase('persist_advisory')

    if not force_refresh:
        cache.set(cache_key, True, timeout=cooldown)

    try:
        start_advisory_phase('broadcast')
        _broadcast_whale_advisory(
            advisory=advisory,
            symbol=symbol,
            side=side,
            matched_value_vnd=matched_value_vnd,
            threshold=float(threshold or 0),
            normalized_threshold_source=normalized_threshold_source,
            user_id=user_id,
        )
        end_advisory_phase('broadcast')
    except Exception as exc:
        end_advisory_phase('broadcast')
        record_advisory_error_recovery(type(exc).__name__, 'broadcast_failed', success=False)
        logger.warning('WebSocket push failed for whale_advisory %s: %s', symbol, exc)

    metrics_payload = end_advisory_session()
    if metrics_payload:
        metrics_payload.update(
            {
                'advisory_id': advisory.id,
                'ai_provider': provider,
                'ai_model': model,
                'ai_provider_primary': primary_provider,
                'ai_model_primary': primary_model,
                'ai_source': ai_source,
                'output_language': output_language,
                'language_mismatch': language_mismatch,
                'failover_occurred': failover_occurred,
                'failover_reason': failover_reason,
                'failover_chain_attempted': failover_chain_attempted,
                'failover_attempt_count': failover_attempt_count,
                'threshold_source': normalized_threshold_source,
                'source': source_key,
                'merged_sources': normalized_merged_sources,
                'primary_source': normalized_primary_source,
                'used_concise': use_concise,
                'snapshot_id': advisory.aggregate_snapshot_id,
            }
        )
        _persist_advisory_metrics_audit_log(
            user=target_user,
            symbol=symbol,
            advisory=advisory,
            latest_existing_advisory=latest_existing_advisory,
            source=source_key,
            threshold_source=normalized_threshold_source,
            merged_sources=normalized_merged_sources,
            primary_source=normalized_primary_source,
            metrics=metrics_payload,
            task_id=getattr(self.request, 'id', ''),
        )

    logger.info('WhaleAdvisory created: id=%d symbol=%s side=%s', advisory.id, symbol, side)
    return {
        'status': 'ok',
        'advisory_id': advisory.id,
        'symbol': symbol,
        'ai_provider': provider,
        'ai_model': model,
        'ai_provider_primary': primary_provider,
        'ai_model_primary': primary_model,
        'ai_source': ai_source,
        'output_language': output_language,
        'language_mismatch': language_mismatch,
        'failover_occurred': failover_occurred,
        'failover_reason': failover_reason,
        'failover_chain_attempted': failover_chain_attempted,
        'failover_attempt_count': failover_attempt_count,
        'force_refresh': bool(force_refresh),
        'user_id': user_id,
        'source': source_key,
        'threshold_source': normalized_threshold_source,
        'merged_sources': normalized_merged_sources,
        'primary_source': normalized_primary_source,
        'used_concise': use_concise,
        'snapshot_id': advisory.aggregate_snapshot_id,
    }


