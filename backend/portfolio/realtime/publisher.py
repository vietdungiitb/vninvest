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
        channel_layer_mode = os.getenv("REALTIME_CHANNEL_LAYER", "redis").lower()
        if channel_layer_mode == "inmemory":
            self.client = None
        else:
            from portfolio.realtime.redis_pool import get_stream_client
            self.client = get_stream_client()
        self._sequence = defaultdict(int)
        self.channel_layer = get_channel_layer()

    def next_seq(self, channel: str) -> int:
        self._sequence[channel] += 1
        return self._sequence[channel]

    def publish(self, channel: str, payload: dict) -> bool:
        group_ok = False
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

        return group_ok

    @staticmethod
    def _channel_to_group(channel: str) -> str:
        return channel.replace(":", "_")
