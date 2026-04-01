from __future__ import annotations

from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth.models import AnonymousUser, User
from rest_framework_simplejwt.tokens import AccessToken


class RealtimeConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = await self._authenticate_user()
        if not user or isinstance(user, AnonymousUser):
            await self.close(code=4401)
            return

        self.user = user
        self.symbol_groups: set[str] = set()
        self.user_alert_group = f"user_{self.user.id}_alerts"
        await self.channel_layer.group_add(self.user_alert_group, self.channel_name)
        await self.accept()
        await self.send_json(
            {
                "event_type": "connected",
                "user_id": self.user.id,
            }
        )

    async def disconnect(self, code):
        if hasattr(self, "user_alert_group"):
            await self.channel_layer.group_discard(self.user_alert_group, self.channel_name)
        for group_name in getattr(self, "symbol_groups", set()):
            await self.channel_layer.group_discard(group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        action = content.get("action")
        symbols = [str(symbol).upper() for symbol in content.get("symbols", []) if symbol]

        if action == "subscribe":
            await self._subscribe_symbols(symbols)
            await self.send_json({"event_type": "subscribed", "symbols": symbols})
            return

        if action == "unsubscribe":
            await self._unsubscribe_symbols(symbols)
            await self.send_json({"event_type": "unsubscribed", "symbols": symbols})
            return

        await self.send_json({"event_type": "error", "detail": "Unsupported action"})

    async def ticker_update(self, event):
        await self.send_json(event["payload"])

    async def whale_alert(self, event):
        await self.send_json(event["payload"])

    async def heartbeat(self, event):
        await self.send_json(event["payload"])

    async def _subscribe_symbols(self, symbols: list[str]):
        for symbol in symbols:
            ticker_group = f"ticker_{symbol}"
            whale_group = f"whale_{symbol}"
            await self.channel_layer.group_add(ticker_group, self.channel_name)
            await self.channel_layer.group_add(whale_group, self.channel_name)
            self.symbol_groups.add(ticker_group)
            self.symbol_groups.add(whale_group)

    async def _unsubscribe_symbols(self, symbols: list[str]):
        for symbol in symbols:
            ticker_group = f"ticker_{symbol}"
            whale_group = f"whale_{symbol}"
            await self.channel_layer.group_discard(ticker_group, self.channel_name)
            await self.channel_layer.group_discard(whale_group, self.channel_name)
            self.symbol_groups.discard(ticker_group)
            self.symbol_groups.discard(whale_group)

    async def _authenticate_user(self):
        token = self._get_query_token()
        if not token:
            return AnonymousUser()
        try:
            access_token = AccessToken(token)
            user_id = access_token.get("user_id")
            if not user_id:
                return AnonymousUser()
            return await self._get_user(user_id)
        except Exception:
            return AnonymousUser()

    def _get_query_token(self) -> str | None:
        query_string = self.scope.get("query_string", b"").decode()
        query_params = parse_qs(query_string)
        token = query_params.get("token", [None])[0]
        return token

    @database_sync_to_async
    def _get_user(self, user_id: int):
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return AnonymousUser()
