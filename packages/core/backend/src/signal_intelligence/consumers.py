"""
SFI-B7: Django Channels WebSocket consumer for real-time market data.

Handles /ws/market/<symbol>/ connection:
- Authenticates via PAT token from query string (?token=<pat>)
- Subscribes to Redis channel group for symbol
- Forwards market data updates to connected clients

Security:
- Token authentication required (unauthenticated connections rejected)
- Symbol is sanitized to uppercase alphanumeric only
- Disconnect handler always cleans up group membership
"""
import json
import logging
import re

from channels.generic.websocket import AsyncWebsocketConsumer

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
        # Clients can send ping; respond with pong.
        if text_data:
            try:
                msg = json.loads(text_data)
                if msg.get('type') == 'ping':
                    await self.send(text_data=json.dumps({'type': 'pong'}))
            except (json.JSONDecodeError, Exception):  # noqa: BLE001
                pass

    async def market_update(self, event):
        """Handle market_update messages from Redis channel layer."""
        await self.send(text_data=json.dumps(event.get('data', {})))
