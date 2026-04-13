from __future__ import annotations

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

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
