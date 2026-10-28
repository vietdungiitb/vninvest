"""
Webhook dispatcher — dispatch, HMAC signing, and delivery scheduling.

SSOT for outbound webhook logic. No caller should import httpx or create
HTTP sessions for webhooks — this module owns the HTTP transport.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging

logger = logging.getLogger(__name__)


class WebhookDispatcher:
    HMAC_HEADER = 'X-VNInvest-Signature'

    @staticmethod
    def dispatch(tenant, event_type: str, payload: dict) -> None:
        from .models import TenantWebhookConfig
        configs = TenantWebhookConfig.objects.filter(
            tenant=tenant, is_active=True,
        )
        matched = []
        for config in configs:
            events_list = config.events or []
            if event_type in events_list:
                matched.append(config)

        if not matched:
            logger.debug('No active webhook configs for event %s on tenant %s', event_type, tenant.public_id)
            return

        for config in matched:
            _schedule_delivery(config, event_type, payload)

    @staticmethod
    def sign_payload(secret: str, payload: dict) -> str:
        body = json.dumps(payload, separators=(',', ':'), sort_keys=True)
        return hmac.new(
            secret.encode(), body.encode(), hashlib.sha256
        ).hexdigest()


def _schedule_delivery(config, event_type: str, payload: dict) -> None:
    import uuid

    from .models import WebhookDelivery
    from .tasks import deliver_webhook

    delivery = WebhookDelivery.objects.create(
        config=config,
        event_type=event_type,
        event_id=str(uuid.uuid4()),
        payload=payload,
        status='pending',
    )
    deliver_webhook.delay(delivery.id)
