from __future__ import annotations

from django.core.cache import cache

from portfolio.observability import end_advisory_phase, start_advisory_phase
from portfolio.tasks_advisory_helpers import (
    _persist_advisory_aggregate_snapshot,
    _resolve_next_refresh_at,
    _token_log_source_for_advisory_source,
)
from portfolio.tasks_whale_bookkeeping import _resolve_generation_refresh_count
from portfolio.tasks_whale_quality import (
    _normalize_generated_advisory_metadata,
    _record_generation_quality_metrics,
    _resolve_generated_advisory_severity,
)
from portfolio.tasks_whale_persistence import (
    _create_advisory_token_log,
    _create_whale_advisory_record,
)


def _execute_whale_generation_persist_phase(
    *,
    symbol: str,
    matched_value_vnd: float,
    side: str,
    threshold: float,
    source: str,
    force_refresh: bool,
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
    use_concise: bool,
    cache_key: str,
    cooldown: int,
    summary_resp: dict,
    deep_resp: dict,
    merged_sources: list[str] | None,
    primary_source: str | None,
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

    return {
        'advisory': advisory,
        'normalized_threshold_source': normalized_threshold_source,
        'normalized_merged_sources': normalized_merged_sources,
        'normalized_primary_source': normalized_primary_source,
    }
