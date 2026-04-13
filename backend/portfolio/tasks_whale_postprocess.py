from __future__ import annotations

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

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


def _broadcast_whale_advisory(
    *,
    advisory,
    symbol: str,
    side: str,
    matched_value_vnd: float,
    threshold: float,
    normalized_threshold_source: str,
    user_id: int | None,
) -> None:
    channel_layer = get_channel_layer()
    target_group = f'user_{user_id}_alerts' if user_id is not None else f'whale_{symbol}'
    async_to_sync(channel_layer.group_send)(
        target_group,
        {
            'type': 'whale_advisory',
            'payload': {
                'event_type': 'whale_advisory',
                'symbol': symbol,
                'side': side,
                'matched_value': int(matched_value_vnd),
                'threshold': float(threshold or 0),
                'threshold_source': normalized_threshold_source,
                'ai_summary': advisory.ai_summary,
                'ai_detail': advisory.ai_detail,
                'ai_provider': advisory.ai_provider,
                'ai_model': advisory.ai_model,
                'ts': advisory.created_at.isoformat(),
                'created_at': advisory.created_at.isoformat(),
                'id': advisory.id,
                'snapshot_id': advisory.aggregate_snapshot_id,
            },
        },
    )
