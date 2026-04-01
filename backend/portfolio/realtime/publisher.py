from __future__ import annotations

import json
import logging
import os
from collections import defaultdict

import redis
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings

logger = logging.getLogger(__name__)


class RealtimePublisher:
    def __init__(self) -> None:
        redis_url = os.getenv("REALTIME_REDIS_URL", getattr(settings, "CELERY_BROKER_URL", "redis://localhost:6379/0"))
        channel_layer_mode = os.getenv("REALTIME_CHANNEL_LAYER", "redis").lower()
        self.client = None if channel_layer_mode == "inmemory" else redis.Redis.from_url(redis_url, decode_responses=True)
        self._sequence = defaultdict(int)
        self.channel_layer = get_channel_layer()

    def next_seq(self, channel: str) -> int:
        self._sequence[channel] += 1
        return self._sequence[channel]

    def publish(self, channel: str, payload: dict) -> bool:
        redis_ok = False
        group_ok = False
        if self.client is not None:
            try:
                message = json.dumps(payload, ensure_ascii=False)
                self.client.publish(channel, message)
                redis_ok = True
            except Exception as exc:
                logger.warning("Publish failed on %s: %s", channel, exc)

        if self.channel_layer is not None:
            try:
                async_to_sync(self.channel_layer.group_send)(
                    self._channel_to_group(channel),
                    {
                        "type": payload.get("event_type", "heartbeat"),
                        "payload": payload,
                    },
                )
                group_ok = True
            except Exception as exc:
                logger.warning("Channel layer fanout failed on %s: %s", channel, exc)

        return redis_ok or group_ok

    @staticmethod
    def _channel_to_group(channel: str) -> str:
        return channel.replace(":", "_")
