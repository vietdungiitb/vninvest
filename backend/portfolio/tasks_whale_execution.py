from __future__ import annotations

import logging

from django.core.cache import cache

from portfolio.observability import (
    end_advisory_phase,
    end_advisory_session,
    record_advisory_error_recovery,
    start_advisory_phase,
)
from portfolio.tasks_advisory_helpers import (
    _persist_advisory_aggregate_snapshot,
    _resolve_next_refresh_at,
    _token_log_source_for_advisory_source,
)
from portfolio.tasks_whale_bookkeeping import _resolve_generation_refresh_count
from portfolio.tasks_whale_metrics import (
    _build_whale_generation_result,
    _finalize_whale_generation_metrics,
)
from portfolio.tasks_whale_postprocess import (
    _broadcast_whale_advisory,
    _create_advisory_token_log,
    _create_whale_advisory_record,
    _normalize_generated_advisory_metadata,
    _record_generation_quality_metrics,
    _resolve_generated_advisory_severity,
)

logger = logging.getLogger(__name__)


def _execute_whale_generation_postprovider(
    *,
    symbol: str,
    matched_value_vnd: float,
    side: str,
    threshold: float,
    source: str,
    force_refresh: bool,
    user_id: int | None,
    source_key: str,
    advisory_type: str,
    severity_override: str | None,
    threshold_source: str,
    dark_flow_strength: float | None,
    dark_flow_confidence: str | None,
    latest_existing_advisory,
    target_user,
    user_cfg,
    provider: str,
    model: str,
    primary_provider: str,
    primary_model: str,
    ai_source: str,
    output_language: str,
    language_mismatch: bool,
    failover_occurred: bool,
    failover_reason: str,
    failover_chain_attempted: list[str],
    failover_attempt_count: int,
    use_concise: bool,
    cache_key: str,
    cooldown: int,
    summary_resp: dict,
    deep_resp: dict,
    merged_sources: list[str] | None,
    primary_source: str | None,
    task_id: str,
) -> dict:
    refresh_count = _resolve_generation_refresh_count(
        force_refresh=force_refresh,
        latest_existing_advisory=latest_existing_advisory,
    )

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

    _finalize_whale_generation_metrics(
        end_session=end_advisory_session,
        target_user=target_user,
        symbol=symbol,
        advisory=advisory,
        latest_existing_advisory=latest_existing_advisory,
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
        normalized_threshold_source=normalized_threshold_source,
        source_key=source_key,
        normalized_merged_sources=normalized_merged_sources,
        normalized_primary_source=normalized_primary_source,
        use_concise=use_concise,
        task_id=task_id,
    )

    return _build_whale_generation_result(
        advisory=advisory,
        symbol=symbol,
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
        force_refresh=force_refresh,
        user_id=user_id,
        source_key=source_key,
        normalized_threshold_source=normalized_threshold_source,
        normalized_merged_sources=normalized_merged_sources,
        normalized_primary_source=normalized_primary_source,
        use_concise=use_concise,
    )
