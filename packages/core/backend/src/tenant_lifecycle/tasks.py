from __future__ import annotations

import logging
from datetime import timedelta

from celery import shared_task
from django.core.cache import cache
from django.utils import timezone

from commercial.models import QuotaRecord
from identity_access.models import CoreTenant
from tenant_lifecycle.models import TenantLifecycleEvent


logger = logging.getLogger(__name__)


def _enqueue_trial_warning_email(*, tenant: CoreTenant, days_left: int) -> None:
    logger.info(
        'Tenant trial expiry warning queued tenant=%s days_left=%s',
        tenant.public_id,
        days_left,
    )


@shared_task(name='tenant_lifecycle.tasks.auto_expire_trials', bind=True)
def auto_expire_trials(self):
    now = timezone.now()
    tenants = list(
        CoreTenant.objects.filter(
            status=CoreTenant.StatusChoices.TRIAL,
            trial_ends_at__lt=now,
        )
    )

    for tenant in tenants:
        TenantLifecycleEvent.objects.create(
            tenant=tenant,
            event_type=TenantLifecycleEvent.EventType.TRIAL_EXPIRED,
            actor_type='system',
            old_value={'status': tenant.status},
            new_value={'status': CoreTenant.StatusChoices.SUSPENDED},
        )
        tenant._actor_type = 'system'
        tenant.status = CoreTenant.StatusChoices.SUSPENDED
        tenant.suspended_at = now
        tenant.save(update_fields=['status', 'suspended_at', 'updated_at'])

    return {'status': 'ok', 'expired_count': len(tenants)}


@shared_task(name='tenant_lifecycle.tasks.auto_suspend_quota_overflow', bind=True)
def auto_suspend_quota_overflow(self):
    today = timezone.now().date()
    overflows = list(
        QuotaRecord.objects.select_related('tenant').filter(
            period_start__lte=today,
            period_end__gte=today,
            api_calls_limit__gt=-1,
            api_calls_used__gt=0,
        )
    )

    suspended = 0
    for record in overflows:
        if record.api_calls_used <= record.api_calls_limit:
            continue

        tenant = record.tenant
        TenantLifecycleEvent.objects.create(
            tenant=tenant,
            event_type=TenantLifecycleEvent.EventType.QUOTA_EXCEEDED,
            actor_type='system',
            metadata={
                'api_calls_used': record.api_calls_used,
                'api_calls_limit': record.api_calls_limit,
                'period_start': str(record.period_start),
                'period_end': str(record.period_end),
            },
        )
        if tenant.status != CoreTenant.StatusChoices.SUSPENDED:
            tenant._actor_type = 'system'
            tenant.status = CoreTenant.StatusChoices.SUSPENDED
            tenant.suspended_at = timezone.now()
            tenant.save(update_fields=['status', 'suspended_at', 'updated_at'])
            suspended += 1

    return {'status': 'ok', 'suspended_count': suspended}


@shared_task(name='tenant_lifecycle.tasks.send_trial_expiry_warning', bind=True)
def send_trial_expiry_warning(self):
    now = timezone.now()
    milestones = (7, 1)
    queued = 0

    for tenant in CoreTenant.objects.filter(status=CoreTenant.StatusChoices.TRIAL, trial_ends_at__isnull=False):
        days_left = (tenant.trial_ends_at.date() - now.date()).days
        if days_left not in milestones:
            continue

        dedup_key = f'tenant:trial_warning:{tenant.public_id}:{days_left}'
        if not cache.add(dedup_key, '1', timeout=8 * 24 * 3600):
            continue

        _enqueue_trial_warning_email(tenant=tenant, days_left=days_left)
        queued += 1

    return {'status': 'ok', 'queued_count': queued}


@shared_task(name='tenant_lifecycle.tasks.auto_deprovision_stale', bind=True)
def auto_deprovision_stale(self):
    cutoff = timezone.now() - timedelta(days=30)
    tenants = list(
        CoreTenant.objects.filter(
            status=CoreTenant.StatusChoices.SUSPENDED,
            suspended_at__lt=cutoff,
        )
    )

    for tenant in tenants:
        TenantLifecycleEvent.objects.create(
            tenant=tenant,
            event_type=TenantLifecycleEvent.EventType.DEPROVISIONED,
            actor_type='system',
            old_value={'status': tenant.status},
            new_value={'status': CoreTenant.StatusChoices.DEPROVISIONED},
        )
        tenant._actor_type = 'system'
        tenant.status = CoreTenant.StatusChoices.DEPROVISIONED
        tenant.save(update_fields=['status', 'updated_at'])

    return {'status': 'ok', 'deprovisioned_count': len(tenants)}
