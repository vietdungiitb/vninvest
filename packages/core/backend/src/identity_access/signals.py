"""
Signal-based webhook dispatch for identity_access models.

Each signal handler fires a WebhookDispatcher.dispatch() call with the
appropriate event_type and a structured payload.
"""
from __future__ import annotations

import logging

from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver
from django.utils import timezone

from .models import CorePATCredential, CoreTenant, TenantMember
from .webhook_dispatcher import WebhookDispatcher

logger = logging.getLogger(__name__)


def _build_member_payload(instance, event: str) -> dict:
    return {
        'event': event,
        'user_id': instance.user_id,
        'email': instance.user.email,
        'role': instance.role,
        'occurred_at': timezone.now().isoformat(),
    }


@receiver(post_save, sender=TenantMember)
def on_member_post_save(sender, instance, created, **kwargs):
    event = 'member.joined' if created else 'member.updated'
    try:
        WebhookDispatcher.dispatch(instance.tenant, event, _build_member_payload(instance, event))
    except Exception as exc:
        logger.warning('Webhook dispatch failed for %s: %s', event, exc)


@receiver(pre_delete, sender=TenantMember)
def on_member_pre_delete(sender, instance, **kwargs):
    event = 'member.removed'
    try:
        WebhookDispatcher.dispatch(instance.tenant, event, _build_member_payload(instance, event))
    except Exception as exc:
        logger.warning('Webhook dispatch failed for %s: %s', event, exc)


@receiver(post_save, sender=CorePATCredential)
def on_pat_post_save(sender, instance, created, **kwargs):
    event = 'pat.created' if created else 'pat.updated'
    if instance.status == instance.StatusChoices.REVOKED:
        event = 'pat.revoked'
    try:
        WebhookDispatcher.dispatch(instance.service_account.tenant, event, {
            'event': event,
            'pat_id': instance.public_id,
            'label': instance.label,
            'status': instance.status,
            'occurred_at': timezone.now().isoformat(),
        })
    except Exception as exc:
        logger.warning('Webhook dispatch failed for %s: %s', event, exc)


@receiver(post_save, sender=CoreTenant)
def on_tenant_post_save(sender, instance, created, **kwargs):
    if not created and instance.status == CoreTenant.StatusChoices.DEPROVISIONED:
        event = 'tenant.deprovisioned'
        try:
            WebhookDispatcher.dispatch(instance, event, {
                'event': event,
                'tenant_id': instance.public_id,
                'tenant_code': instance.tenant_code,
                'status': instance.status,
                'occurred_at': timezone.now().isoformat(),
            })
        except Exception as exc:
            logger.warning('Webhook dispatch failed for %s: %s', event, exc)
