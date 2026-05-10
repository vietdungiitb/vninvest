from __future__ import annotations

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.utils import timezone

from portfolio.models import TrackedSymbol, UserAlertHistory, WatchlistItem, WhaleAlertEvent


def resolve_signal_audience(symbol: str) -> list[dict]:
    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return []

    audience_by_user_id: dict[int, dict] = {}

    tracked_rows = (
        TrackedSymbol.objects.filter(symbol=normalized_symbol, is_active=True)
        .values('user_id', 'whale_alert_threshold_million')
    )
    for tracked_row in tracked_rows:
        user_id = int(tracked_row.get('user_id') or 0)
        if not user_id:
            continue
        audience_row = audience_by_user_id.setdefault(
            user_id,
            {
                'user_id': user_id,
                'tracked_threshold_million': None,
                'sources': set(),
            },
        )
        audience_row['sources'].add('tracked')
        if tracked_row.get('whale_alert_threshold_million') is not None:
            audience_row['tracked_threshold_million'] = tracked_row.get('whale_alert_threshold_million')

    watchlist_user_ids = WatchlistItem.objects.filter(symbol=normalized_symbol).values_list('group__user_id', flat=True)
    for raw_user_id in watchlist_user_ids:
        user_id = int(raw_user_id or 0)
        if not user_id:
            continue
        audience_row = audience_by_user_id.setdefault(
            user_id,
            {
                'user_id': user_id,
                'tracked_threshold_million': None,
                'sources': set(),
            },
        )
        audience_row['sources'].add('watchlist')

    resolved_rows = []
    for user_id in sorted(audience_by_user_id):
        audience_row = audience_by_user_id[user_id]
        resolved_rows.append(
            {
                'user_id': user_id,
                'tracked_threshold_million': audience_row.get('tracked_threshold_million'),
                'sources': sorted(audience_row.get('sources') or []),
            }
        )

    return resolved_rows


def deliver_dark_flow_signal(
    *,
    symbol: str,
    payload: dict,
    message: str,
    matched_at=None,
    websocket_enabled: bool = True,
    history_enabled: bool = True,
) -> dict:
    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return {
            'status': 'skipped',
            'reason': 'invalid_symbol',
            'audience_rows': [],
            'history_count': 0,
            'symbol_broadcast_count': 0,
            'user_broadcast_count': 0,
        }

    matched_at = matched_at or timezone.now()
    matched_at_iso = matched_at.isoformat()
    base_payload = dict(payload or {})
    base_payload['event_type'] = 'dark_flow_alert'
    base_payload['symbol'] = normalized_symbol
    base_payload.setdefault('ts', matched_at_iso)

    audience_rows = resolve_signal_audience(normalized_symbol)
    channel_layer = get_channel_layer() if websocket_enabled else None
    history_count = 0
    symbol_broadcast_count = 0
    user_broadcast_count = 0

    if channel_layer is not None:
        async_to_sync(channel_layer.group_send)(
            f'whale_{normalized_symbol}',
            {
                'type': 'dark_flow_alert',
                'data': dict(base_payload),
            },
        )
        symbol_broadcast_count += 1

    for audience_row in audience_rows:
        user_id = int(audience_row.get('user_id') or 0)
        if not user_id:
            continue

        history = None
        if history_enabled:
            history = UserAlertHistory.objects.create(
                user_id=user_id,
                symbol=normalized_symbol,
                alert_type=UserAlertHistory.AlertTypeChoices.DARK_MONEY,
                message=message,
                matched_at=matched_at,
            )
            history_count += 1

        if channel_layer is None:
            continue

        user_payload = dict(base_payload)
        user_payload['matched_at'] = matched_at_iso
        user_payload['message'] = message
        user_payload['source'] = 'dark_flow'
        if history is not None:
            user_payload['history_id'] = history.id

        async_to_sync(channel_layer.group_send)(
            f'user_{user_id}_alerts',
            {
                'type': 'dark_flow_alert',
                'payload': user_payload,
            },
        )
        user_broadcast_count += 1

    return {
        'status': 'ok',
        'audience_rows': audience_rows,
        'history_count': history_count,
        'symbol_broadcast_count': symbol_broadcast_count,
        'user_broadcast_count': user_broadcast_count,
    }


def deliver_whale_alert_event(
    *,
    event: WhaleAlertEvent,
    websocket_enabled: bool = True,
    history_enabled: bool = True,
) -> dict:
    normalized_symbol = str(getattr(event, 'symbol', '') or '').strip().upper()
    if not normalized_symbol:
        return {
            'status': 'skipped',
            'reason': 'invalid_symbol',
            'audience_rows': [],
            'history_count': 0,
            'symbol_broadcast_count': 0,
            'user_broadcast_count': 0,
        }

    occurred_at = getattr(event, 'occurred_at', None) or timezone.now()
    occurred_at_iso = occurred_at.isoformat()
    matched_value = float(getattr(event, 'matched_value_vnd', 0) or 0)
    threshold_vnd = float(getattr(event, 'threshold_vnd', 0) or 0)

    base_payload = dict(getattr(event, 'payload_json', {}) or {})
    base_payload.update({
        'event_type': 'whale_alert',
        'event_id': base_payload.get('event_id') or event.event_id,
        'symbol': normalized_symbol,
        'side': str(base_payload.get('side') or event.side or '').strip().lower() or 'unknown',
        'matched_value': float(base_payload.get('matched_value') or matched_value),
        'threshold': float(base_payload.get('threshold') or threshold_vnd),
        'severity': base_payload.get('severity') or event.severity,
        'event_score': base_payload.get('event_score') or event.event_score,
        'source': base_payload.get('source') or event.source,
        'source_layer': base_payload.get('source_layer') or event.source_layer,
        'ts': base_payload.get('ts') or occurred_at_iso,
    })

    history_message = (
        f"Whale {str(base_payload['side']).upper()} {normalized_symbol}: "
        f"{int(round(base_payload['matched_value'])):,} VND"
    )

    audience_rows = resolve_signal_audience(normalized_symbol)
    channel_layer = get_channel_layer() if websocket_enabled else None
    history_count = 0
    symbol_broadcast_count = 0
    user_broadcast_count = 0

    if channel_layer is not None:
        async_to_sync(channel_layer.group_send)(
            f'whale_{normalized_symbol}',
            {
                'type': 'whale_alert',
                'payload': dict(base_payload),
            },
        )
        symbol_broadcast_count += 1

    for audience_row in audience_rows:
        user_id = int(audience_row.get('user_id') or 0)
        if not user_id:
            continue

        history = None
        if history_enabled:
            history = UserAlertHistory.objects.create(
                user_id=user_id,
                symbol=normalized_symbol,
                alert_type=UserAlertHistory.AlertTypeChoices.WHALE,
                message=history_message,
                matched_at=occurred_at,
            )
            history_count += 1

        if channel_layer is None:
            continue

        user_payload = dict(base_payload)
        if history is not None:
            user_payload['history_id'] = history.id

        async_to_sync(channel_layer.group_send)(
            f'user_{user_id}_alerts',
            {
                'type': 'whale_alert',
                'payload': user_payload,
            },
        )
        user_broadcast_count += 1

    return {
        'status': 'ok',
        'audience_rows': audience_rows,
        'history_count': history_count,
        'symbol_broadcast_count': symbol_broadcast_count,
        'user_broadcast_count': user_broadcast_count,
    }
