"""
SFI-B7: WebSocket broadcast helpers for real-time market data and alerts.

Architecture:
  - serialize_*() functions build WEBSOCKET_EVENT_CONTRACT.md-compliant payloads
  - broadcast_*() functions publish to Redis channel layer groups via async_to_sync
  - Seq numbers use Redis INCR counters (key: ws:seq:{symbol}, 24h TTL)

Isolation rules:
  - No imports from backend.portfolio or backend.*
  - No direct vnbroker imports (use market_data.vnbroker_adapter only)
  - Never log request/response body — only event type + symbol
"""
import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core.cache import cache
from django.utils.timezone import now

logger = logging.getLogger(__name__)

_CONTRACT_VERSION = '1.0'
_SOURCE_GATEWAY = 'channels-gateway'
_SEQ_CACHE_PREFIX = 'ws:seq'
_SEQ_CACHE_TTL = 86400  # 24h


def _next_seq(symbol: str) -> int:
    """Atomically increment seq counter for symbol."""
    key = f'{_SEQ_CACHE_PREFIX}:{symbol}'
    try:
        seq = cache.incr(key)
    except ValueError:
        cache.set(key, 1, timeout=_SEQ_CACHE_TTL)
        seq = 1
    return seq


def _envelope(event_type: str, symbol: str, data: dict | None = None) -> dict:
    """Build standard event envelope per WEBSOCKET_EVENT_CONTRACT.md §2."""
    payload = {
        'contract_version': _CONTRACT_VERSION,
        'event_type': event_type,
        'symbol': symbol,
        'ts': now().isoformat(),
        'seq': _next_seq(symbol),
        'source': _SOURCE_GATEWAY,
    }
    if data is not None:
        payload['data'] = data
    return payload


def serialize_unified_alert(alert) -> dict:
    """Serialize UnifiedAlert to WS-compliant payload."""
    from signal_intelligence.models import UnifiedAlert

    alert_type = str(alert.alert_type or '')
    if alert_type == UnifiedAlert.AlertTypeChoices.WHALE:
        event_type = 'whale_alert'
    elif alert_type == UnifiedAlert.AlertTypeChoices.DARK_FLOW:
        event_type = 'dark_flow_alert'
    else:
        event_type = 'system_alert'

    metadata = alert.metadata or {}
    evidence = alert.evidence or {}

    matched_value = None
    if alert.value is not None:
        try:
            matched_value = int(alert.value)
        except (TypeError, ValueError):
            matched_value = None

    data = {
        'severity': str(alert.severity or ''),
        'confidence': float(alert.confidence or 0),
        'direction': str(alert.direction or ''),
        'title': alert.title or '',
        'body': alert.body or '',
        'triggered_at': alert.triggered_at.isoformat() if alert.triggered_at else None,
    }

    if event_type == 'whale_alert':
        data.update({
            'matched_value': matched_value,
            'side': str(alert.direction or ''),
            'event_score': float(evidence.get('whale_intensity', 0) or 0) * 100,
            'display_score': float(evidence.get('whale_intensity', 0) or 0) * 100,
            'size_class': 'whale',
            'weights_version': 'weights-v1',
        })
    elif event_type == 'dark_flow_alert':
        data.update({
            'signal_type': metadata.get('signal_type', ''),
            'strength': float(evidence.get('whale_intensity', 0) or 0) * 100,
            'confidence_level': str(alert.confidence or 'medium'),
            'tick_rate': metadata.get('tick_rate', 0),
            'small_order_ratio': metadata.get('small_order_ratio', 0),
            'cvd_at_signal': metadata.get('cvd_at_signal', 0),
            'description': alert.body or '',
        })

    envelope = _envelope(event_type, alert.symbol, data=data)
    envelope['event_id'] = str(alert.alert_id)
    envelope['config_version'] = 'threshold-v1'
    return envelope


def broadcast_unified_alert(alert) -> None:
    """Publish alert to market_{symbol} group and market_discovery group."""
    payload = serialize_unified_alert(alert)
    symbol = alert.symbol
    channel_layer = get_channel_layer()
    if channel_layer is None:
        logger.warning('broadcast_unified_alert: channel_layer unavailable, skipping %s/%s', symbol, alert.alert_id)
        return

    symbol_group = f'market_{symbol}'
    discovery_group = 'market_discovery'
    event_data = {'type': 'market_update', 'data': payload}

    try:
        async_to_sync(channel_layer.group_send)(symbol_group, event_data)
        async_to_sync(channel_layer.group_send)(discovery_group, event_data)
        logger.debug('broadcast_unified_alert: sent %s/%s to %s and %s', symbol, alert.alert_id, symbol_group, discovery_group)
    except Exception as exc:
        logger.error('broadcast_unified_alert: failed for %s/%s: %s', symbol, alert.alert_id, exc)


def broadcast_ticker_update(symbol: str, ticker_data: dict) -> None:
    """Publish ticker_update event to market_{symbol} group."""
    channel_layer = get_channel_layer()
    if channel_layer is None:
        logger.warning('broadcast_ticker_update: channel_layer unavailable, skipping %s', symbol)
        return

    payload = _envelope('ticker_update', symbol, data=ticker_data)
    symbol_group = f'market_{symbol}'
    event_data = {'type': 'market_update', 'data': payload}

    try:
        async_to_sync(channel_layer.group_send)(symbol_group, event_data)
    except Exception as exc:
        logger.error('broadcast_ticker_update: failed for %s: %s', symbol, exc)
