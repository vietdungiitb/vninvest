"""Whale Advisory Generation Workers"""

from __future__ import annotations

from datetime import datetime
import logging
import os
import random

from celery import shared_task
from django.conf import settings
from django.core.cache import cache
from django.db.models import Sum
from django.utils import timezone

from portfolio.ai_options import get_advisory_provider_failover_chain, get_default_model
from portfolio.ai_runtime_config import resolve_ai_runtime_config
from portfolio.ai_service import _resolve_provider_api_key, generate_advisory_concise, generate_whale_text

from portfolio.models import UserConfig, WhaleAdvisory

from portfolio.observability import (
    end_advisory_phase,
    end_advisory_session,
    record_advisory_error_recovery,
    record_advisory_token_usage,
    start_advisory_phase,
    start_advisory_session,
)

from portfolio.tasks_advisory_helpers import (
    _normalize_advisory_source,
    _token_log_source_for_advisory_source,
    _persist_advisory_metrics_audit_log,
    _persist_advisory_aggregate_snapshot,
    _get_remaining_advisory_budget,
    _get_remaining_auto_refreshes,
    _resolve_next_refresh_at,
    _resolve_advisory_threshold_vnd,
    _should_use_concise_advisory,
    _resolve_model_for_budget,
    _increment_daily_counter,
    _classify_provider_failure,
    _is_failover_eligible_failure,
    _mark_provider_ratelimit,
    _record_provider_attempt,
    _record_failover_event,
    _is_language_mismatch,
)
from portfolio.tasks_news_context import _fetch_news_context_for_advisory
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
    cooldown = getattr(settings, 'WHALE_ADVISORY_COOLDOWN_SECONDS', 900)
    cache_key = f'whale_advisory_lock:{user_id}:{symbol}' if user_id is not None else f'whale_advisory_lock:{symbol}'
    source_key = _normalize_advisory_source(source)

    advisory_qs = WhaleAdvisory.objects.filter(symbol=symbol)
    if user_id is not None:
        advisory_qs = advisory_qs.filter(user_id=user_id)
    latest_existing_advisory = advisory_qs.order_by('-created_at').first()

    if not force_refresh and latest_existing_advisory is not None:
        logger.info('Whale advisory already exists — skipping auto generation for %s', symbol)
        return {'status': 'skipped', 'symbol': symbol, 'reason': 'existing_advisory'}

    if not force_refresh and cache.get(cache_key):
        logger.info('Whale advisory cooldown active — skipping %s', symbol)
        return {'status': 'skipped', 'symbol': symbol, 'reason': 'cooldown'}

    target_user = None
    user_cfg = None
    remaining_budget = None
    if user_id is not None:
        user_cfg = UserConfig.objects.filter(user_id=user_id).select_related('user').first()
        target_user = getattr(user_cfg, 'user', None)

    if user_cfg is not None:
        if source_key == WhaleAdvisory.SourceChoices.WHALE_SIGNAL and not user_cfg.advisory_whale_signal_enabled:
            return {'status': 'skipped', 'symbol': symbol, 'reason': 'whale_signal_disabled', 'user_id': user_id}
        if source_key == WhaleAdvisory.SourceChoices.PERIODIC_JOB and not user_cfg.advisory_auto_generation_enabled:
            return {'status': 'skipped', 'symbol': symbol, 'reason': 'auto_generation_disabled', 'user_id': user_id}
        if source_key == WhaleAdvisory.SourceChoices.USER_REFRESH and not user_cfg.advisory_manual_refresh_enabled:
            return {'status': 'skipped', 'symbol': symbol, 'reason': 'manual_refresh_disabled', 'user_id': user_id}

        _gen_lock_key = f'advisory:gen-lock:{user_id}'
        _lock_acquired = cache.add(_gen_lock_key, 1, timeout=90)
        if not _lock_acquired:
            logger.info('Whale advisory generation locked (concurrent task) for user=%s symbol=%s', user_id, symbol)
            return {'status': 'skipped', 'symbol': symbol, 'reason': 'concurrent_generation_active', 'user_id': user_id}

        try:
            remaining_budget = _get_remaining_advisory_budget(user_cfg)
            if remaining_budget <= 0:
                logger.info('Whale advisory budget exhausted for user=%s symbol=%s source=%s', user_id, symbol, source_key)
                return {
                    'status': 'skipped',
                    'symbol': symbol,
                    'reason': 'daily_budget_exceeded',
                    'user_id': user_id,
                    'source': source_key,
                }
            if source_key == WhaleAdvisory.SourceChoices.PERIODIC_JOB and _get_remaining_auto_refreshes(user_cfg) <= 0:
                logger.info('Whale advisory auto-refresh count exhausted for user=%s symbol=%s', user_id, symbol)
                return {
                    'status': 'skipped',
                    'symbol': symbol,
                    'reason': 'daily_auto_refresh_limit_exceeded',
                    'user_id': user_id,
                    'source': source_key,
                }
        finally:
            cache.delete(_gen_lock_key)

    runtime_cfg = resolve_ai_runtime_config(user=target_user)
    if not runtime_cfg.get('ready'):
        logger.info(
            'Whale advisory skipped for %s: runtime AI not ready reason=%s user_id=%s',
            symbol,
            runtime_cfg.get('reason'),
            user_id,
        )
        return {
            'status': 'skipped',
            'symbol': symbol,
            'reason': str(runtime_cfg.get('reason') or 'runtime_ai_not_ready'),
            'user_id': user_id,
            'ai_source': runtime_cfg.get('source'),
        }

    provider = str(runtime_cfg.get('provider') or 'openclaw').strip().lower()
    model = str(runtime_cfg.get('model') or '').strip()
    primary_provider = provider
    primary_model = model
    api_key = str(runtime_cfg.pop('api_key', '') or '').strip()
    ai_source = str(runtime_cfg.get('source') or 'unknown')

    if cache.get(f'advisory:provider-ratelimit:{provider}'):
        logger.info(
            'Whale advisory skipped — provider %s still in rate-limit cooldown symbol=%s user_id=%s',
            provider,
            symbol,
            user_id,
        )
        return {'status': 'skipped', 'symbol': symbol, 'reason': 'provider_rate_limit_cooldown', 'user_id': user_id}

    use_concise = _should_use_concise_advisory(source_key, remaining_budget)
    output_language = str(getattr(user_cfg, 'language', 'vi') if user_cfg is not None else 'vi').strip().lower()
    if output_language not in {'vi', 'en'}:
        output_language = 'vi'

    _total_budget = int(user_cfg.advisory_max_tokens_per_day or 0) if user_cfg is not None else None
    model = _resolve_model_for_budget(provider, model, remaining_budget, _total_budget)
    primary_model = model

    failover_chain = get_advisory_provider_failover_chain().get(primary_provider, [])
    providers_to_try = [primary_provider] + [p for p in failover_chain if p != primary_provider]
    failover_occurred = False
    failover_reason = ''
    failover_chain_attempted: list[str] = []
    failover_attempt_count = 0

    news_hint = '' if use_concise else _fetch_news_context_for_advisory(symbol)

    start_advisory_session()
    start_advisory_phase('provider_generation')
    summary_resp = None
    deep_resp = None
    last_exc: Exception | None = None

    for idx, attempt_provider in enumerate(providers_to_try):
        failover_chain_attempted.append(attempt_provider)
        attempt_model = model if attempt_provider == primary_provider else get_default_model(attempt_provider)
        attempt_model = _resolve_model_for_budget(attempt_provider, attempt_model, remaining_budget, _total_budget)
        attempt_api_key = api_key if attempt_provider == primary_provider else _resolve_provider_api_key(attempt_provider, '')

        if not attempt_api_key:
            _record_provider_attempt(attempt_provider, success=False, failure_type='missing_api_key')
            if idx + 1 < len(providers_to_try):
                failover_attempt_count += 1
                _record_failover_event(attempt_provider, providers_to_try[idx + 1], 'missing_api_key', success=False)
            continue

        try:
            if use_concise:
                summary_resp = generate_advisory_concise(
                    provider=attempt_provider,
                    model=attempt_model,
                    api_key=attempt_api_key,
                    symbol=symbol,
                    matched_value_vnd=matched_value_vnd,
                    side=side,
                    user=target_user,
                    output_language=output_language,
                )
                deep_resp = {'text': '', 'prompt_tokens': 0, 'completion_tokens': 0}
            else:
                summary_resp = generate_whale_text(
                    provider=attempt_provider,
                    model=attempt_model,
                    api_key=attempt_api_key,
                    symbol=symbol,
                    matched_value_vnd=matched_value_vnd,
                    side=side,
                    deep=False,
                    user=target_user,
                    output_language=output_language,
                    news_hint=news_hint,
                )
                deep_resp = generate_whale_text(
                    provider=attempt_provider,
                    model=attempt_model,
                    api_key=attempt_api_key,
                    symbol=symbol,
                    matched_value_vnd=matched_value_vnd,
                    side=side,
                    deep=True,
                    user=target_user,
                    output_language=output_language,
                    news_hint=news_hint,
                )

            _record_provider_attempt(attempt_provider, success=True)
            if attempt_provider != primary_provider:
                failover_occurred = True
                _record_failover_event(primary_provider, attempt_provider, failover_reason or 'unknown', success=True)
            provider = attempt_provider
            model = attempt_model
            break
        except Exception as exc:
            failure_type = _classify_provider_failure(exc)
            last_exc = exc
            _record_provider_attempt(attempt_provider, success=False, failure_type=failure_type)

            if failure_type == 'rate_limited':
                _mark_provider_ratelimit(attempt_provider)

            can_failover = _is_failover_eligible_failure(failure_type)
            has_next_provider = idx + 1 < len(providers_to_try)

            if can_failover and has_next_provider:
                failover_attempt_count += 1
                if not failover_reason:
                    failover_reason = failure_type
                next_provider = providers_to_try[idx + 1]
                _record_failover_event(attempt_provider, next_provider, failure_type, success=False)
                logger.warning(
                    'Advisory provider failover: %s/%s failed (%s) symbol=%s -> next=%s',
                    attempt_provider,
                    attempt_model,
                    failure_type,
                    symbol,
                    next_provider,
                )
                continue

            logger.error(
                'AI provider error for %s via %s/%s (%s): %s',
                symbol,
                attempt_provider,
                attempt_model,
                failure_type,
                exc,
            )
            break

    end_advisory_phase('provider_generation')
    if summary_resp is None or deep_resp is None:
        record_advisory_error_recovery(type(last_exc).__name__ if last_exc else 'RuntimeError', 'provider_generation_failed', success=False)
        end_advisory_session()
        raise (last_exc or RuntimeError('All advisory providers failed'))

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


