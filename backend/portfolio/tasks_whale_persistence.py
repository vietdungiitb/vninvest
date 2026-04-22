from __future__ import annotations

from portfolio.models import AdvisoryTokenLog, WhaleAdvisory


def _create_whale_advisory_record(
    *,
    target_user,
    symbol: str,
    matched_value_vnd: float,
    side: str,
    threshold: float,
    summary_resp: dict,
    deep_resp: dict,
    provider: str,
    model: str,
    next_refresh_at,
    refresh_count: int,
    source_key: str,
    aggregate_snapshot,
    normalized_merged_sources: list[str],
    normalized_primary_source: str,
    advisory_type_key: str,
    resolved_severity: str,
    # Phase 2 Discovery Fields
    is_discovery: bool = False,
    discovery_bucket: str = 'standard',
    whale_intensity: int = 0,
    threshold_source: str = 'user_default',
):
    return WhaleAdvisory.objects.create(
        user=target_user,
        symbol=symbol,
        matched_value=int(matched_value_vnd),
        side=side,
        threshold=float(threshold or 0),
        ai_summary=summary_resp['text'],
        ai_detail=deep_resp['text'],
        ai_provider=provider,
        ai_model=model,
        prompt_tokens=summary_resp['prompt_tokens'] + deep_resp['prompt_tokens'],
        completion_tokens=summary_resp['completion_tokens'] + deep_resp['completion_tokens'],
        next_refresh_at=next_refresh_at,
        refresh_count=refresh_count,
        is_auto_generated=source_key == WhaleAdvisory.SourceChoices.PERIODIC_JOB,
        aggregate_snapshot=aggregate_snapshot,
        source=source_key,
        merged_sources=normalized_merged_sources,
        primary_source=normalized_primary_source,
        advisory_type=advisory_type_key,
        severity=resolved_severity,
        # Phase 2 Fields
        is_discovery=is_discovery,
        discovery_bucket=discovery_bucket,
        whale_intensity=whale_intensity,
        threshold_source=threshold_source,
    )


def _create_advisory_token_log(*, target_user, advisory, source: str, symbol: str, token_log_source_for_source) -> None:
    if target_user is None:
        return
    AdvisoryTokenLog.objects.create(
        user=target_user,
        advisory=advisory,
        tokens_used=advisory.prompt_tokens + advisory.completion_tokens,
        source=token_log_source_for_source(source),
        symbol=symbol,
    )
