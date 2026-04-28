from __future__ import annotations

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.utils import timezone

from portfolio.models import TrackedSymbol, UserAlertHistory, WatchlistItem


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


def _broadcast_screener_matched(
    *,
    symbol: str,
    message: str | None = None,
    matched_at=None,
) -> dict:
    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return {'status': 'skipped', 'reason': 'invalid_symbol'}

    alert_message = message or f'Mã {normalized_symbol} vừa khớp bộ lọc screener toàn cục.'
    matched_at = matched_at or timezone.now()
    matched_at_iso = matched_at.isoformat()

    audience_user_ids = {
        int(user_id)
        for user_id in TrackedSymbol.objects.filter(symbol=normalized_symbol, is_active=True).values_list('user_id', flat=True)
        if user_id
    }
    audience_user_ids.update(
        int(user_id)
        for user_id in WatchlistItem.objects.filter(symbol=normalized_symbol).values_list('group__user_id', flat=True)
        if user_id
    )

    if not audience_user_ids:
        return {
            'status': 'ok',
            'symbol': normalized_symbol,
            'audience_count': 0,
            'history_count': 0,
            'broadcast_count': 0,
        }

    channel_layer = get_channel_layer()
    history_count = 0
    broadcast_count = 0

    for user_id in sorted(audience_user_ids):
        history = UserAlertHistory.objects.create(
            user_id=user_id,
            symbol=normalized_symbol,
            alert_type=UserAlertHistory.AlertTypeChoices.SCREENER,
            message=alert_message,
            matched_at=matched_at,
        )
        history_count += 1

        if channel_layer is None:
            continue

        async_to_sync(channel_layer.group_send)(
            f'user_{user_id}_alerts',
            {
                'type': 'screener_matched',
                'payload': {
                    'event_type': 'screener_matched',
                    'symbol': normalized_symbol,
                    'message': alert_message,
                    'matched_at': matched_at_iso,
                    'ts': matched_at_iso,
                    'history_id': history.id,
                    'source': 'global_screener',
                },
            },
        )
        broadcast_count += 1

    return {
        'status': 'ok',
        'symbol': normalized_symbol,
        'audience_count': len(audience_user_ids),
        'history_count': history_count,
        'broadcast_count': broadcast_count,
    }


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
