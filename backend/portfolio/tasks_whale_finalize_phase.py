from __future__ import annotations

import logging

from portfolio.observability import (
    end_advisory_phase,
    end_advisory_session,
    record_advisory_error_recovery,
    start_advisory_phase,
)
from portfolio.tasks_whale_metrics import (
    _build_whale_generation_result,
    _finalize_whale_generation_metrics,
)
from portfolio.tasks_whale_postprocess import _broadcast_whale_advisory

logger = logging.getLogger(__name__)


def _execute_whale_generation_finalize_phase(
    *,
    symbol: str,
    side: str,
    matched_value_vnd: float,
    threshold: float,
    user_id: int | None,
    source_key: str,
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
    latest_existing_advisory,
    target_user,
    use_concise: bool,
    task_id: str,
    advisory,
    normalized_threshold_source: str,
    normalized_merged_sources: list[str],
    normalized_primary_source: str,
) -> dict:
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
