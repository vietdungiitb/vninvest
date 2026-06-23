"""
SFI-B7: Django Channels WebSocket consumer for real-time market data.

Consumers:
  - MarketTickerConsumer: single-symbol consumer at /ws/market/<symbol>/
  - RealtimeConsumer: multiplexed consumer at /ws/realtime/ with subscribe/unsubscribe

Security:
- Token authentication required (unauthenticated connections rejected)
- Symbol is sanitized to uppercase alphanumeric only
- Disconnect handler always cleans up group membership
"""
import json
import logging
import re

from channels.generic.websocket import AsyncWebsocketConsumer
from django.utils.timezone import now

logger = logging.getLogger(__name__)

_SYMBOL_RE = re.compile(r'^[A-Z0-9]{1,20}$')


def _sanitize_symbol(raw: str) -> str | None:
    """Return uppercase sanitized symbol or None if invalid."""
    sanitized = re.sub(r'[^A-Za-z0-9]', '', str(raw or '')).upper()
    if _SYMBOL_RE.match(sanitized):
        return sanitized
    return None


async def _authenticate_token(token: str):
    """
    Validate PAT token and return user or None.
    Uses sync_to_async wrapper to call sync Django ORM.
    """
    from asgiref.sync import sync_to_async
    from identity_access.models import CorePATCredential

    @sync_to_async
    def _resolve():
        cred = CorePATCredential.resolve_from_raw_secret(token)
        if cred and cred.effective_status == CorePATCredential.StatusChoices.ACTIVE:
            return cred.service_account.tenant.owner_user
        return None

    return await _resolve()


class MarketTickerConsumer(AsyncWebsocketConsumer):
    """
    SFI-B7: WebSocket consumer for real-time market ticker data.

    URL pattern: ws://<host>/ws/market/<symbol>/
    Query string: ?token=<raw_pat>

    Deprecated: Will be removed in B8 decommission. Use RealtimeConsumer instead.
    """

    async def connect(self):
        symbol_raw = self.scope['url_route']['kwargs'].get('symbol', '')
        self.symbol = _sanitize_symbol(symbol_raw)

        if not self.symbol:
            logger.warning('[WS] Invalid symbol from %s', self.scope.get('client'))
            await self.close(code=4400)
            return

        # Authenticate via query string token
        query_string = self.scope.get('query_string', b'').decode()
        token = ''
        for part in query_string.split('&'):
            if part.startswith('token='):
                token = part[6:]
                break

        user = await _authenticate_token(token)
        if user is None:
            logger.warning('[WS] Unauthenticated WS for %s', self.symbol)
            await self.close(code=4401)
            return

        self.user = user
        self.group_name = f'market_{self.symbol}'

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        logger.info('[WS] Connected: %s (user=%s)', self.symbol, user.username)

    async def disconnect(self, close_code):
        group_name = getattr(self, 'group_name', None)
        if group_name:
            await self.channel_layer.group_discard(group_name, self.channel_name)
        logger.info('[WS] Disconnected: symbol=%s code=%s', getattr(self, 'symbol', '?'), close_code)

    async def receive(self, text_data=None, bytes_data=None):
        """
        Handle incoming WebSocket messages.
        
        Supports ping/pong heartbeat messages.
        Checks both 'type' (legacy) and 'event_type' (standard) fields.
        """
        if not text_data:
            return
        
        try:
            msg = json.loads(text_data)
            msg_type = msg.get('type') or msg.get('event_type')
            
            if msg_type == 'ping':
                await self.send(text_data=json.dumps({'type': 'pong', 'event_type': 'heartbeat', 'ts': now().isoformat()}))
            else:
                logger.debug('[WS] Unknown message type from %s: %s', self.user.username if hasattr(self, 'user') else '?', msg_type)
        except json.JSONDecodeError as exc:
            logger.warning('[WS] Invalid JSON from %s: %s', self.user.username if hasattr(self, 'user') else '?', exc)
        except Exception as exc:  # noqa: BLE001
            logger.error('[WS] Unexpected error in receive for %s: %s', self.user.username if hasattr(self, 'user') else '?', exc)

    async def market_update(self, event):
        """Handle market_update messages from Redis channel layer."""
        await self.send(text_data=json.dumps(event.get('data', {})))


class RealtimeConsumer(AsyncWebsocketConsumer):
    """
    SFI-B7: Multiplexed WebSocket consumer supporting subscribe/unsubscribe.

    URL pattern: ws://<host>/ws/realtime/?token=<raw_pat>

    Protocol:
      subscribe:   { "action": "subscribe",   "symbols": ["FPT", "SSI", "market_discovery"] }
      unsubscribe: { "action": "unsubscribe", "symbols": ["FPT"] }
      ping:        { "event_type": "ping" }
      heartbeat:   { "event_type": "heartbeat", "ts": "..." }  (server → client)
      ack:         { "event_type": "subscribed", "symbols": [...] }
      data:        { "event_type": "ticker_update", ... }  (server → client, via market_update handler)

    Group naming: market_{symbol} for symbol channels, market_discovery for global feed.
    """

    async def connect(self):
        query_string = self.scope.get('query_string', b'').decode()
        token = ''
        for part in query_string.split('&'):
            if part.startswith('token='):
                token = part[6:]
                break

        user = await _authenticate_token(token)
        if user is None:
            logger.warning('[WS:Realtime] Unauthenticated connection attempt')
            await self.close(code=4401)
            return

        self.user = user
        self.subscribed_groups: set[str] = set()
        await self.accept()
        logger.info('[WS:Realtime] Connected: user=%s', user.username)

    async def disconnect(self, close_code):
        for group in list(self.subscribed_groups):
            try:
                await self.channel_layer.group_discard(group, self.channel_name)
            except Exception as exc:
                logger.warning('[WS:Realtime] Error leaving group %s: %s', group, exc)
        self.subscribed_groups.clear()
        logger.info('[WS:Realtime] Disconnected: user=%s code=%s', getattr(self, 'user', None), close_code)

    async def receive(self, text_data=None, bytes_data=None):
        if not text_data:
            return

        try:
            msg = json.loads(text_data)
        except json.JSONDecodeError as exc:
            logger.warning('[WS:Realtime] Invalid JSON: %s', exc)
            return

        event_type = msg.get('event_type')
        action = msg.get('action')

        # Ping
        if event_type == 'ping':
            await self.send(text_data=json.dumps({
                'event_type': 'heartbeat',
                'ts': now().isoformat(),
            }))
            return

        # Subscribe
        if action == 'subscribe':
            raw_symbols = msg.get('symbols', [])
            if not isinstance(raw_symbols, list) or not raw_symbols:
                await self.send(text_data=json.dumps({
                    'event_type': 'error',
                    'message': 'subscribe requires non-empty symbols array',
                }))
                return

            valid_symbols = []
            for raw in raw_symbols:
                sanitized = _sanitize_symbol(raw) if raw != 'market_discovery' else 'market_discovery'
                if sanitized:
                    valid_symbols.append(sanitized)

            for sym in valid_symbols:
                group = 'market_discovery' if sym == 'market_discovery' else f'market_{sym}'
                if group not in self.subscribed_groups:
                    await self.channel_layer.group_add(group, self.channel_name)
                    self.subscribed_groups.add(group)

            await self.send(text_data=json.dumps({
                'event_type': 'subscribed',
                'symbols': valid_symbols,
            }))
            logger.info('[WS:Realtime] Subscribed: user=%s symbols=%s', self.user.username, valid_symbols)
            return

        # Unsubscribe
        if action == 'unsubscribe':
            raw_symbols = msg.get('symbols', [])
            if not isinstance(raw_symbols, list):
                return

            valid_symbols = []
            for raw in raw_symbols:
                sanitized = _sanitize_symbol(raw) if raw != 'market_discovery' else 'market_discovery'
                if sanitized:
                    valid_symbols.append(sanitized)

            for sym in valid_symbols:
                group = 'market_discovery' if sym == 'market_discovery' else f'market_{sym}'
                if group in self.subscribed_groups:
                    await self.channel_layer.group_discard(group, self.channel_name)
                    self.subscribed_groups.discard(group)

            await self.send(text_data=json.dumps({
                'event_type': 'unsubscribed',
                'symbols': valid_symbols,
            }))
            logger.info('[WS:Realtime] Unsubscribed: user=%s symbols=%s', self.user.username, valid_symbols)
            return

        logger.debug('[WS:Realtime] Unknown message from %s: action=%s event_type=%s',
                      self.user.username, action, event_type)

    async def market_update(self, event):
        """Handle market_update messages from Redis channel layer."""
        await self.send(text_data=json.dumps(event.get('data', {})))
