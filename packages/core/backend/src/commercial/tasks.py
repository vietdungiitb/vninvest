"""Commercial automation tasks for quota flushing and invoicing."""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from decimal import Decimal

from celery import shared_task
from django.core.cache import cache
from django.utils import timezone

from commercial.models import Invoice, QuotaRecord, Subscription
from identity_access.models import CoreTenant


logger = logging.getLogger(__name__)


FLUSH_QUOTA_THROTTLE_KEY = 'commercial:flush_quota_counters:throttle'
FLUSH_QUOTA_LOCK_KEY = 'commercial:flush_quota_counters:lock'
FLUSH_QUOTA_MIN_INTERVAL_SECONDS = 55
FLUSH_QUOTA_LOCK_SECONDS = 300


def _iter_quota_counter_keys(day: date):
    client = getattr(cache, '_cache', None)
    if client is None or not hasattr(client, 'scan_iter'):
        return []
    pattern = f'*quota:api_calls:*:{day.isoformat()}'
    return client.scan_iter(match=pattern)


def _normalize_cache_key(raw_key) -> str:
    if isinstance(raw_key, bytes):
        return raw_key.decode('utf-8')
    return str(raw_key)


def _extract_tenant_id_from_key(raw_key: str) -> str | None:
    parts = str(raw_key).split(':')
    if len(parts) < 4:
        return None
    return parts[-2]


def _cache_get_int(raw_key) -> int:
    value = cache.get(_normalize_cache_key(raw_key), 0)
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _current_billing_period(today: date) -> tuple[date, date]:
    period_start = today.replace(day=1)
    next_month_anchor = (period_start + timedelta(days=32)).replace(day=1)
    period_end = next_month_anchor - timedelta(days=1)
    return period_start, period_end


def _invoice_number_for(tenant: CoreTenant, period_start: date) -> str:
    sequence = Invoice.objects.filter(period_start=period_start).count() + 1
    tenant_code = str(tenant.tenant_code or tenant.public_id).upper().replace(' ', '-')
    return f'INV-{period_start.strftime("%Y%m")}-{tenant_code}-{sequence:04d}'


def _subscription_amount_due(subscription: Subscription) -> Decimal:
    plan_amounts = {
        CoreTenant.PlanChoices.FREE: Decimal('0.00'),
        CoreTenant.PlanChoices.STARTER: Decimal('490000.00'),
        CoreTenant.PlanChoices.PRO: Decimal('990000.00'),
        CoreTenant.PlanChoices.ENTERPRISE: Decimal('2990000.00'),
        CoreTenant.PlanChoices.CUSTOM: Decimal('0.00'),
        CoreTenant.PlanChoices.INTERNAL: Decimal('0.00'),
    }
    return plan_amounts.get(subscription.plan, Decimal('0.00'))


@shared_task(name='commercial.tasks.flush_quota_counters', bind=True, max_retries=3, default_retry_delay=60)
def flush_quota_counters(self, target_date: str | None = None):
    """Flush Redis-backed daily quota counters into QuotaRecord rows."""
    request_id = str(getattr(self.request, 'id', '') or 'manual')
    if not cache.add(FLUSH_QUOTA_THROTTLE_KEY, request_id, timeout=FLUSH_QUOTA_MIN_INTERVAL_SECONDS):
        return {
            'status': 'skipped',
            'reason': 'throttled',
            'processed': 0,
        }
    if not cache.add(FLUSH_QUOTA_LOCK_KEY, request_id, timeout=FLUSH_QUOTA_LOCK_SECONDS):
        return {
            'status': 'skipped',
            'reason': 'inflight',
            'processed': 0,
        }

    today = date.fromisoformat(target_date) if target_date else timezone.now().date()
    period_start, period_end = _current_billing_period(today)
    processed = 0
    try:
        for raw_key in _iter_quota_counter_keys(today):
            tenant_public_id = _extract_tenant_id_from_key(_normalize_cache_key(raw_key))
            if not tenant_public_id:
                continue

            try:
                tenant = CoreTenant.objects.get(public_id=tenant_public_id)
            except CoreTenant.DoesNotExist:
                logger.warning('flush_quota_counters: tenant %s missing for quota key.', tenant_public_id)
                continue

            used_calls = _cache_get_int(raw_key)
            quota_record, _ = QuotaRecord.objects.get_or_create(
                tenant=tenant,
                period_start=period_start,
                period_end=period_end,
                defaults={'api_calls_used': 0},
            )
            if quota_record.api_calls_used != used_calls:
                quota_record.api_calls_used = used_calls
                quota_record.save(update_fields=['api_calls_used', 'updated_at'])
            processed += 1

        return {
            'status': 'ok',
            'date': today.isoformat(),
            'processed': processed,
        }
    finally:
        cache.delete(FLUSH_QUOTA_LOCK_KEY)


@shared_task(name='commercial.tasks.generate_monthly_invoices', bind=True, max_retries=2, default_retry_delay=300)
def generate_monthly_invoices(self, today_iso: str | None = None):
    """Generate monthly invoices for active or past-due subscriptions."""
    today = date.fromisoformat(today_iso) if today_iso else timezone.now().date()
    period_start, period_end = _current_billing_period(today)
    due_date = today + timedelta(days=7)
    created = 0

    subscriptions = Subscription.objects.select_related('tenant').filter(
        status__in=(Subscription.StatusChoices.ACTIVE, Subscription.StatusChoices.PAST_DUE),
    )
    for subscription in subscriptions:
        invoice_number = _invoice_number_for(subscription.tenant, period_start)
        _, was_created = Invoice.objects.get_or_create(
            tenant=subscription.tenant,
            period_start=period_start,
            period_end=period_end,
            defaults={
                'invoice_number': invoice_number,
                'status': Invoice.StatusChoices.OPEN,
                'amount_due': _subscription_amount_due(subscription),
                'currency': 'VND',
                'due_date': due_date,
            },
        )
        if was_created:
            created += 1

    return {
        'status': 'ok',
        'period_start': period_start.isoformat(),
        'period_end': period_end.isoformat(),
        'created': created,
    }


@shared_task(name='commercial.tasks.check_overdue_invoices', bind=True, max_retries=2, default_retry_delay=300)
def check_overdue_invoices(self, today_iso: str | None = None):
    """Mark overdue invoices as past due and suspend the owning tenants."""
    today = date.fromisoformat(today_iso) if today_iso else timezone.now().date()
    cutoff = today - timedelta(days=7)
    updated = 0
    suspended = 0

    overdue_invoices = Invoice.objects.select_related('tenant').filter(
        status=Invoice.StatusChoices.OPEN,
        due_date__lt=cutoff,
    )
    for invoice in overdue_invoices:
        invoice.status = Invoice.StatusChoices.PAST_DUE
        invoice.save(update_fields=['status', 'updated_at'])
        updated += 1

        tenant = invoice.tenant
        if tenant.status != CoreTenant.StatusChoices.SUSPENDED:
            tenant.status = CoreTenant.StatusChoices.SUSPENDED
            tenant.suspended_at = timezone.now()
            tenant.save(update_fields=['status', 'suspended_at', 'updated_at'])
            suspended += 1

        subscription = getattr(tenant, 'subscription', None)
        if subscription is not None and subscription.status != Subscription.StatusChoices.PAST_DUE:
            subscription.status = Subscription.StatusChoices.PAST_DUE
            subscription.save(update_fields=['status', 'updated_at'])

    return {
        'status': 'ok',
        'updated_invoices': updated,
        'suspended_tenants': suspended,
        'cutoff': cutoff.isoformat(),
    }


@shared_task(name='commercial.tasks.send_quota_warning', bind=True, max_retries=3, default_retry_delay=300)
def send_quota_warning(self, tenant_id: str, percent: int):
    """Deduplicated quota warning stub for future outbound email integration."""
    dedup_date = timezone.now().date().isoformat()
    dedup_key = f'quota:warning_sent:{tenant_id}:{dedup_date}:{percent}'
    if not cache.add(dedup_key, 1, timeout=25 * 3600):
        return {'status': 'skipped', 'reason': 'duplicate_warning'}

    return {
        'status': 'queued',
        'tenant_id': tenant_id,
        'percent': int(percent),
    }


@shared_task(name='commercial.tasks.manage_subscriptions_lifecycle', bind=True, max_retries=2, default_retry_delay=300)
def manage_subscriptions_lifecycle(self, today_iso: str | None = None):
    """
    Manages automatic subscription lifecycle: dunning, renewals, and plan downgrades.
    Runs hourly in production.
    """
    today = date.fromisoformat(today_iso) if today_iso else timezone.now().date()
    downgraded = 0
    renewed = 0

    # 1. Downgrade expired subscriptions where cancel_at_period_end is True
    expired_cancelled_subs = Subscription.objects.select_related('tenant').filter(
        current_period_end__lt=today,
        cancel_at_period_end=True,
        status=Subscription.StatusChoices.ACTIVE
    )
    for sub in expired_cancelled_subs:
        tenant = sub.tenant
        # Downgrade plan in tenant and subscription
        sub.plan = CoreTenant.PlanChoices.FREE
        sub.cancel_at_period_end = False
        sub.current_period_start = today
        sub.current_period_end = today + timedelta(days=365)  # Extended free period
        sub.status = Subscription.StatusChoices.ACTIVE
        sub.save(update_fields=['plan', 'cancel_at_period_end', 'current_period_start', 'current_period_end', 'status', 'updated_at'])

        tenant.plan = CoreTenant.PlanChoices.FREE
        tenant.status = CoreTenant.StatusChoices.ACTIVE
        tenant.save(update_fields=['plan', 'status', 'updated_at'])
        downgraded += 1

    # 2. Process Auto-renewal / Dunning invoices creation for expired subscriptions without cancel_at_period_end
    expired_active_subs = Subscription.objects.select_related('tenant').filter(
        current_period_end__lt=today,
        cancel_at_period_end=False,
        status=Subscription.StatusChoices.ACTIVE
    )
    for sub in expired_active_subs:
        tenant = sub.tenant
        amount_due = _subscription_amount_due(sub)

        # Check if there is already an open/paid invoice for the next period
        next_start = sub.current_period_end + timedelta(days=1)
        next_end = next_start + timedelta(days=30)

        invoice_exists = Invoice.objects.filter(
            tenant=tenant,
            period_start=next_start,
        ).exists()

        if not invoice_exists:
            # Generate invoice for next billing period
            invoice_number = f"INV-{next_start.strftime('%Y%m')}-{str(tenant.tenant_code).upper()}-{uuid.uuid4().hex[:4].upper()}"
            Invoice.objects.create(
                tenant=tenant,
                invoice_number=invoice_number,
                status=Invoice.StatusChoices.OPEN,
                amount_due=amount_due,
                currency='VND',
                period_start=next_start,
                period_end=next_end,
                due_date=today + timedelta(days=7)
            )
            renewed += 1

    return {
        'status': 'ok',
        'downgraded_subscriptions': downgraded,
        'new_renewal_invoices': renewed,
        'checked_at': today.isoformat()
    }
