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
                # Phase 4 Discovery Fields
                'is_discovery': getattr(advisory, 'is_discovery', False),
                'discovery_bucket': getattr(advisory, 'discovery_bucket', 'standard'),
                'whale_intensity': getattr(advisory, 'whale_intensity', 0),
            },
        },
    )


def _broadcast_market_discovery_event(
    *,
    advisory,
    symbol: str,
    side: str,
    whale_intensity: int,
    discovery_bucket: str,
) -> None:
    """
    Broadcast to a global discovery group. 
    Dashboard listens to this to show real-time market-wide anomalies.
    """
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        'market_discovery',
        {
            'type': 'market_discovery_event',
            'payload': {
                'event_type': 'market_discovery_event',
                'id': advisory.id,
                'symbol': symbol,
                'side': side,
                'whale_intensity': whale_intensity,
                'discovery_bucket': discovery_bucket,
                'ai_summary': advisory.ai_summary,
                'ts': advisory.created_at.isoformat(),
            },
        },
    )
