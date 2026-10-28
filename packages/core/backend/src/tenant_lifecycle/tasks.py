from __future__ import annotations

import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from commercial.models import QuotaRecord
from identity_access.models import CoreTenant
from tenant_lifecycle.models import TenantLifecycleEvent

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# C6 — the ONE authoritative trial policy
# ---------------------------------------------------------------------------
# There used to be two contradictory handlers for the same condition:
#   tenant_lifecycle.tasks.auto_expire_trials   trial_ends_at < now            -> SUSPENDED
#   identity_access.tasks.auto_disable_expired_trials
#                          trial_ends_at <= today-3d                          -> DEPROVISIONED
# The second was never in CELERY_BEAT_SCHEDULE, so in practice only the first ran.
#
# POLICY: an expired trial SUSPENDS. It does not deprovision.
#   - SUSPENDED is reversible: the customer can upgrade and keep working.
#   - The existing, scheduled auto_deprovision_stale (below) is the single
#     escalation path: SUSPENDED for 30 days -> DEPROVISIONED. That way there is
#     one place that decides a tenant is truly gone, and it also runs after the
#     30-day grace the conflicting handler was silently skipping.
# auto_disable_expired_trials has been deleted for that reason.
TRIAL_EXPIRED_TERMINAL_STATUS = CoreTenant.StatusChoices.SUSPENDED

#: Days-before-expiry at which the customer gets a reminder. send_trial_expiry_warning
#: is the only scheduled reminder task (09:00 daily), so it owns all three
#: milestones. identity_access.tasks.check_trial_expirations duplicated this with a
#: different (7, 3, 1) list and was never scheduled; it has been deleted.
TRIAL_EXPIRY_REMINDER_DAYS: tuple[int, ...] = (7, 3, 1)


def _enqueue_trial_warning_email(*, tenant: CoreTenant, days_left: int) -> None:
    """C6: actually enqueue the mail.

    This used to be a bare logger.info, so send_trial_expiry_warning reported
    queued_count=1 for every tenant on the milestone day while NO email was ever
    sent — and because the Redis dedup key was written BEFORE this call, the
    milestone was burned for 8 days on the first run.
    """
    send_trial_expiry_warning_email.delay(tenant.public_id, days_left)
    logger.info(
        'Tenant trial expiry warning queued tenant=%s days_left=%s',
        tenant.public_id,
        days_left,
    )


@shared_task(
    name='tenant_lifecycle.tasks.send_trial_expiry_warning_email',
    bind=True,
    max_retries=3,
    default_retry_delay=120,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def send_trial_expiry_warning_email(self, tenant_public_id: str, days_left: int):
    """Send one tenant their trial-expiry reminder. Retries on transient errors."""
    from identity_access.mail_service import send_system_email

    tenant = CoreTenant.objects.filter(public_id=tenant_public_id).first()
    if tenant is None:
        logger.error('Trial warning email: tenant %s no longer exists', tenant_public_id)
        return {'status': 'skipped', 'reason': 'tenant_missing'}

    owner_email = (getattr(tenant.owner_user, 'email', '') or '').strip()
    if not owner_email:
        logger.warning('Trial warning email: tenant %s owner has no email', tenant_public_id)
        return {'status': 'skipped', 'reason': 'no_owner_email'}

    frontend_url = getattr(settings, 'FRONTEND_URL', '') or ''
    upgrade_url = f'{frontend_url}/settings/billing' if frontend_url else ''

    subject = f"[{tenant.display_name}] Gói dùng thử còn {days_left} ngày"
    text_body = (
        f'Gói dùng thử của {tenant.display_name} còn {days_left} ngày.\n\n'
        f'Nâng cấp gói để không bị tạm ngưng tài khoản: {upgrade_url}'
    )
    html_body = (
        f'<p>Gói dùng thử của <strong>{tenant.display_name}</strong> còn '
        f'<strong>{days_left} ngày</strong>.</p>'
        f'<p>Nâng cấp gói để không bị tạm ngưng tài khoản.</p>'
        + (f'<p><a href="{upgrade_url}">Nâng cấp ngay</a></p>' if upgrade_url else '')
    )

    send_system_email(
        subject=subject,
        message=text_body,
        recipient_list=[owner_email],
        html_message=html_body,
        fail_silently=False,
    )
    logger.info(
        'Trial expiry warning sent tenant=%s days_left=%s', tenant_public_id, days_left
    )
    return {'status': 'sent', 'tenant_id': tenant_public_id, 'days_left': days_left}



@shared_task(name='tenant_lifecycle.tasks.auto_expire_trials', bind=True)
def auto_expire_trials(self):
    """Daily — the ONE authoritative trial-expiry handler.

    An expired trial SUSPENDS (see TRIAL_EXPIRED_TERMINAL_STATUS). Escalation to
    DEPROVISIONED is owned solely by auto_deprovision_stale after 30 days.
    """
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
            new_value={'status': TRIAL_EXPIRED_TERMINAL_STATUS},
        )
        tenant._actor_type = 'system'
        tenant.status = TRIAL_EXPIRED_TERMINAL_STATUS
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
    """Daily — remind tenants whose trial is about to expire.

    C6: the dedup key used to be written BEFORE the enqueue, so a failed enqueue
    burned the milestone for the full 8-day TTL. It is now written only after the
    mail task is actually queued.
    """
    now = timezone.now()
    milestones = TRIAL_EXPIRY_REMINDER_DAYS
    queued = 0

    for tenant in CoreTenant.objects.filter(status=CoreTenant.StatusChoices.TRIAL, trial_ends_at__isnull=False):
        days_left = (tenant.trial_ends_at.date() - now.date()).days
        if days_left not in milestones:
            continue

        dedup_key = f'tenant:trial_warning:{tenant.public_id}:{days_left}'
        if cache.get(dedup_key):
            continue

        try:
            _enqueue_trial_warning_email(tenant=tenant, days_left=days_left)
        except Exception:
            # Do NOT set the key: the milestone must survive a broker outage.
            logger.exception(
                'Failed to enqueue trial warning for tenant %s (%s days left)',
                tenant.public_id,
                days_left,
            )
            continue

        cache.set(dedup_key, '1', timeout=8 * 24 * 3600)
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
