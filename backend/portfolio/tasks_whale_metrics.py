from __future__ import annotations

from portfolio.tasks_advisory_helpers import _persist_advisory_metrics_audit_log


def _finalize_whale_generation_metrics(
    *,
    end_session,
    target_user,
    symbol: str,
    advisory,
    latest_existing_advisory,
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
    normalized_threshold_source: str,
    source_key: str,
    normalized_merged_sources: list[str],
    normalized_primary_source: str,
    use_concise: bool,
    task_id: str,
) -> None:
    metrics_payload = end_session()
    if not metrics_payload:
        return

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
        task_id=task_id,
    )


def _build_whale_generation_result(
    *,
    advisory,
    symbol: str,
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
    force_refresh: bool,
    user_id: int | None,
    source_key: str,
    normalized_threshold_source: str,
    normalized_merged_sources: list[str],
    normalized_primary_source: str,
    use_concise: bool,
) -> dict:
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
