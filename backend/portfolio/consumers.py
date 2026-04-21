from __future__ import annotations

import logging
from dataclasses import dataclass
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.conf import settings
from django.contrib.auth.models import AnonymousUser, User
from django.core.cache import cache
from django.utils import timezone
from rest_framework_simplejwt.tokens import AccessToken

logger = logging.getLogger(__name__)


@dataclass
class WSAuthPrincipal:
    id: int
    username: str
    plan: str = "free"
    is_authenticated: bool = True


class RealtimeConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        try:
            user = await self._authenticate_user()
            if not user or isinstance(user, AnonymousUser):
                logger.warning("WebSocket: Authentication failed - closing connection")
                await self.close(code=4401)
                return

            self.user = user
            self.user_plan = await self._resolve_user_plan_for_connection()
            self.user_plan_resolved_at = timezone.now().isoformat()
            self.symbol_groups: set[str] = set()
            self.user_alert_group = f"user_{self.user.id}_alerts"
            await self.channel_layer.group_add(self.user_alert_group, self.channel_name)
            await self.accept()
            logger.info("WebSocket: User %d connected", self.user.id)
            await self.send_json(
                {
                    "event_type": "connected",
                    "user_id": self.user.id,
                }
            )
        except Exception as e:
            logger.error("WebSocket: Connect error: %s", e)
            await self.close(code=1011)

    async def disconnect(self, code):
        try:
            if hasattr(self, "user_alert_group"):
                await self.channel_layer.group_discard(self.user_alert_group, self.channel_name)
            for group_name in getattr(self, "symbol_groups", set()):
                await self.channel_layer.group_discard(group_name, self.channel_name)
            logger.info("WebSocket: Disconnected with code %s", code)
        except Exception as e:
            logger.warning("WebSocket: Disconnect error: %s", e)

    MAX_SUBSCRIBED_SYMBOLS = 50

    async def receive_json(self, content, **kwargs):
        import re
        action = content.get("action")
        raw_symbols = content.get("symbols", [])
        # Validate symbol format: 1-10 uppercase alphanumeric chars
        symbols = [
            str(s).upper()
            for s in raw_symbols
            if s and re.match(r'^[A-Z0-9]{1,10}$', str(s).upper())
        ]

        if action == "subscribe":
            # Enforce subscription limit
            current_count = len(self.symbol_groups) // 2  # ticker + whale per symbol
            new_count = current_count + len(symbols)
            if new_count > self.MAX_SUBSCRIBED_SYMBOLS:
                await self.send_json({
                    "event_type": "error",
                    "detail": f"Vượt quá giới hạn {self.MAX_SUBSCRIBED_SYMBOLS} symbols. Hiện tại: {current_count}.",
                })
                return
            await self._subscribe_symbols(symbols)
            
            # Phase 4: Handle special groups
            for s in raw_symbols:
                if str(s).lower() == 'market_discovery':
                    await self.channel_layer.group_add('market_discovery', self.channel_name)
                    self.symbol_groups.add('market_discovery')

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

    async def whale_advisory(self, event):
        """
        Push tư vấn AI từ OpenClaw. Filter theo plan:
        - free/basic: bỏ qua (không nhận event này)
        - pro: chỉ nhận ai_summary, loại bỏ ai_detail
        - premium/admin: nhận đầy đủ
        """
        if getattr(settings, "REALTIME_WS_PLAN_CACHE_ENABLED", True):
            plan = str(getattr(self, "user_plan", "free") or "free")
        else:
            plan = await self._get_user_plan()
        if plan not in ('pro', 'premium', 'admin'):
            return
        payload = dict(event['payload'])
        if plan == 'pro':
            payload.pop('ai_detail', None)
        await self.send_json(payload)

    async def dark_flow_alert(self, event):
        payload = dict(event.get('data') or event.get('payload') or {})
        payload['event_type'] = 'dark_flow_alert'
        await self.send_json(payload)

    async def market_discovery_event(self, event):
        """
        Push real-time market discovery anomalies.
        """
        await self.send_json(event['payload'])

    async def news_digest(self, event):
        """
        Sprint35 Layer 3: Push Portfolio Daily News Digest.
        Tất cả plan có watchlist đều nhận (thêm giá trị từ free).
        """
        payload = dict(event.get('payload') or {})
        payload['event_type'] = 'news_digest'
        await self.send_json(payload)

    @database_sync_to_async
    def _get_user_plan(self) -> str:
        user = getattr(self, 'user', None)
        if hasattr(user, 'plan'):
            return str(getattr(user, 'plan', 'free') or 'free')
        if not user or not user.is_authenticated:
            return 'free'
        user_config = getattr(user, 'user_config', None)
        if user_config and user_config.plan:
            return str(user_config.plan).lower()
        if user.is_superuser:
            return 'admin'
        return 'free'

    async def _resolve_user_plan_for_connection(self) -> str:
        if getattr(settings, "REALTIME_WS_PLAN_CACHE_ENABLED", True):
            plan = str(getattr(self.user, "plan", "") or "").strip().lower()
            if plan:
                return plan
        return await self._get_user_plan()

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

            if getattr(settings, "REALTIME_WS_AUTH_CACHE_ENABLED", True):
                cache_key = f"ws_auth:{int(user_id)}"
                snapshot = await self._cache_get(cache_key)
                if not snapshot:
                    snapshot = await self._build_auth_snapshot(int(user_id))
                    if not snapshot:
                        return AnonymousUser()
                    cache_ttl = max(int(getattr(settings, "REALTIME_WS_AUTH_CACHE_TTL_SECONDS", 120)), 1)
                    await self._cache_set(cache_key, snapshot, cache_ttl)
                return WSAuthPrincipal(
                    id=int(snapshot["user_id"]),
                    username=str(snapshot.get("username", "")),
                    plan=str(snapshot.get("plan", "free") or "free").lower(),
                )

            return await self._get_user(user_id)
        except Exception:
            return AnonymousUser()

    @database_sync_to_async
    def _build_auth_snapshot(self, user_id: int):
        try:
            user = User.objects.select_related("user_config").get(pk=user_id)
        except User.DoesNotExist:
            return None

        plan = "free"
        user_config = getattr(user, "user_config", None)
        if user_config and user_config.plan:
            plan = str(user_config.plan).lower()
        elif user.is_superuser:
            plan = "admin"

        return {
            "user_id": user.id,
            "username": user.username,
            "plan": plan,
        }

    @database_sync_to_async
    def _cache_get(self, key: str):
        return cache.get(key)

    @database_sync_to_async
    def _cache_set(self, key: str, value, timeout: int):
        cache.set(key, value, timeout=timeout)

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
