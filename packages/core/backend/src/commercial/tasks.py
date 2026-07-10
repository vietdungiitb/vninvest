"""Commercial automation tasks for quota flushing, invoicing, and alert enforcement."""
from __future__ import annotations

import json
import logging
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal

from celery import shared_task
from django.core.cache import cache
from django.utils import timezone

from commercial.models import Invoice, QuotaRecord, Subscription, QuotaHistory, UsageAlertConfig
from identity_access.models import CoreTenant, TenantLifecycleEvent


logger = logging.getLogger(__name__)


FLUSH_QUOTA_THROTTLE_KEY = 'commercial:flush_quota_counters:throttle'
FLUSH_QUOTA_LOCK_KEY = 'commercial:flush_quota_counters:lock'
FLUSH_QUOTA_MIN_INTERVAL_SECONDS = 55
FLUSH_QUOTA_LOCK_SECONDS = 300

# ─── Alert enforcement constants ───
ALERT_COOLDOWN_HOURS = 6
ALERT_COOLDOWN_SECONDS = ALERT_COOLDOWN_HOURS * 3600

# Plan-based entitlement for meters not yet backed by a dedicated QuotaRecord field.
# -1 means unlimited; 0 means the plan does not include this meter.
# free/starter do NOT have ai_regenerate/exports; pro/enterprise have full (unlimited).
METER_ENTITLEMENT_BY_PLAN: dict[str, dict[str, int]] = {
    'ai_regenerate': {
        'free': 0,
        'starter': 0,
        'pro': -1,
        'enterprise': -1,
        'custom': -1,
        'internal': -1,
    },
    'exports': {
        'free': 0,
        'starter': 0,
        'pro': -1,
        'enterprise': -1,
        'custom': -1,
        'internal': -1,
    },
}


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
            # Keep CoreTenant.api_calls_used in sync for tenant-facing serializer exposure.
            if tenant.api_calls_used != used_calls:
                CoreTenant.objects.filter(pk=tenant.pk).update(api_calls_used=used_calls)
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


@shared_task(name='commercial.tasks.snapshot_quota_history', bind=True, max_retries=2, default_retry_delay=300)
def snapshot_quota_history(self, target_date: str | None = None):
    """
    Create daily snapshots of quota usage for historical tracking and charts.
    Runs daily after quota counters are flushed.
    """
    today = date.fromisoformat(target_date) if target_date else timezone.now().date()
    created = 0
    updated = 0

    # Get all tenants with quota records for the current billing period
    period_start, period_end = _current_billing_period(today)
    
    quota_records = QuotaRecord.objects.select_related('tenant').filter(
        period_start=period_start,
        period_end=period_end,
    )

    for quota_record in quota_records:
        tenant = quota_record.tenant

        # Plan-based entitlement for meters not backed by a dedicated QuotaRecord
        # field yet. -1 means unlimited, 0 means the plan does not include the meter.
        # ai_regenerate / exports are not yet tracked via Redis counters, so consumed
        # starts at 0 until later phases wire up the counters.
        plan = str(getattr(tenant, 'plan', '') or '')
        meter_entitlement = METER_ENTITLEMENT_BY_PLAN.copy()
        for _meter in ('ai_regenerate', 'exports'):
            meter_entitlement[_meter] = METER_ENTITLEMENT_BY_PLAN[_meter].get(plan, 0)

        # Create history entries for each meter type. Meter codes MUST match the
        # valid meter list used by the trend/forecast/alert views
        # (api_calls, ai_regenerate, whale_symbols, exports).
        meters = [
            {
                'meter_code': 'api_calls',
                'meter_name': 'API Calls',
                'unit': 'calls',
                'consumed': quota_record.api_calls_used,
                'entitled': quota_record.api_calls_limit,
            },
            {
                'meter_code': 'whale_symbols',
                'meter_name': 'Whale Symbols',
                'unit': 'symbols',
                'consumed': quota_record.symbols_used,
                'entitled': quota_record.symbols_limit,
            },
            {
                'meter_code': 'ai_regenerate',
                'meter_name': 'AI Regenerations',
                'unit': 'regenerations',
                'consumed': 0,
                'entitled': meter_entitlement['ai_regenerate'],
            },
            {
                'meter_code': 'exports',
                'meter_name': 'Exports',
                'unit': 'exports',
                'consumed': 0,
                'entitled': meter_entitlement['exports'],
            },
        ]

        for meter in meters:
            entitled = meter['entitled']
            consumed = meter['consumed']
            remaining = max(0, entitled - consumed) if entitled > 0 else 0
            
            # Determine risk state
            if entitled > 0:
                usage_pct = (consumed / entitled) * 100
                if usage_pct >= 90:
                    risk_state = 'critical'
                elif usage_pct >= 75:
                    risk_state = 'warning'
                else:
                    risk_state = 'normal'
            else:
                risk_state = 'normal'

            history, was_created = QuotaHistory.objects.update_or_create(
                tenant=tenant,
                date=today,
                meter_code=meter['meter_code'],
                defaults={
                    'meter_name': meter['meter_name'],
                    'unit': meter['unit'],
                    'consumed_amount': consumed,
                    'entitled_amount': entitled,
                    'remaining_amount': remaining,
                    'risk_state': risk_state,
                    'hard_stop': False,  # Could be enhanced with plan-specific hard stops
                }
            )
            if was_created:
                created += 1
            else:
                updated += 1

    return {
        'status': 'ok',
        'date': today.isoformat(),
        'created': created,
        'updated': updated,
    }


# ─── Phase 3: Alert Enforcement ─────────────────────────────────────────────

ALERT_COOLDOWN_HOURS = 6


@shared_task(name='commercial.tasks.check_usage_thresholds', bind=True, max_retries=3, default_retry_delay=300)
def check_usage_thresholds(self):
    """
    Check all active UsageAlertConfig against current Redis quota counters.
    
    For each tenant/meter where usage_pct >= threshold:
    - Check cooldown (Redis key `alert_cooldown:{tenant}:{meter_code}:{level}` TTL 6h)
    - If not cooling down: send email + webhook + create TenantLifecycleEvent
    - Set cooldown key
    """
    from identity_access.models import UsageAlertConfig

    now = timezone.now()
    checked = 0
    triggered = 0

    # Get all active alert configs
    configs = UsageAlertConfig.objects.filter(enabled=True).select_related('tenant')
    
    for config in configs:
        tenant = config.tenant
        meter_code = config.meter_code
        plan = str(getattr(tenant, 'plan', '') or '')
        
        # Get current usage from Redis counter
        today = timezone.now().date()
        redis_key = f'quota:{meter_code}:{tenant.public_id}:{today.isoformat()}'
        current_usage = cache.get(redis_key, 0)
        
        if meter_code == 'api_calls':
            # api_calls also tracked on tenant model
            current_usage = getattr(tenant, 'api_calls_used', current_usage)
        
        # Get entitled limit
        if meter_code == 'api_calls':
            entitled = getattr(tenant, 'api_calls_limit', -1)
        elif meter_code == 'whale_symbols':
            from commercial.models import QuotaRecord
            qr = QuotaRecord.objects.filter(tenant=tenant).order_by('-period_start').first()
            entitled = getattr(qr, 'symbols_limit', -1) if qr else -1
        else:
            # ai_regenerate / exports - plan-based
            entitled = METER_ENTITLEMENT_BY_PLAN.get(meter_code, {}).get(plan, 0)
        
        if entitled <= 0 or current_usage <= 0:
            continue
        
        usage_pct = (current_usage / entitled) * 100 if entitled > 0 else 0
        if usage_pct < 1:
            continue
        
        level = None
        if usage_pct >= config.critical_pct:
            level = 'critical'
        elif usage_pct >= config.warning_pct:
            level = 'warning'
        else:
            continue
        
        checked += 1
        
        # Check cooldown
        cooldown_key = f'alert_cooldown:{tenant.public_id}:{meter_code}:{level}'
        if cache.get(cooldown_key):
            continue  # In cooldown, skip
        
        # Send notifications
        _send_quota_alert_email(config, tenant, meter_code, level, current_usage, entitled)
        _dispatch_quota_webhook(tenant, meter_code, level, usage_pct)
        _log_tenant_lifecycle_event(tenant, meter_code, level)
        
        # Set cooldown
        cache.set(cooldown_key, 1, timeout=ALERT_COOLDOWN_HOURS * 3600)
        triggered += 1
    
    return {'status': 'ok', 'checked': checked, 'triggered': triggered}


def _send_quota_alert_email(config, tenant: CoreTenant, meter_code: str, level: str, current_usage: int, limit: int):
    """Send quota alert email to configured recipient."""
    from django.core.mail import send_mail
    from django.conf import settings
    
    # notify_email is a boolean flag (not an email address); when enabled we
    # notify the tenant owner. Skip entirely when disabled.
    if not config.notify_email:
        return
    owner = getattr(tenant, 'owner_user', None)
    recipient = getattr(owner, 'email', None) if owner else None
    if not recipient:
        logger.warning('check_usage_thresholds: no owner email for tenant %s — skipping email', tenant.public_id)
        return
    
    meter_names = {
        'api_calls': 'API Calls',
        'whale_symbols': 'Whale Symbols',
        'ai_regenerate': 'AI Regenerations',
        'exports': 'Exports',
    }
    meter_name = meter_names.get(meter_code, meter_code)
    pct = (current_usage / limit * 100) if limit > 0 else 0
    level_label = 'CẢNH BÁO NGHIÊM TRỌNG' if level == 'critical' else 'CẢNH BÁO'
    
    subject = f'[{level_label}] {tenant.display_name}: {meter_name} đạt {pct:.1f}%'
    message = (
        f'Tenant: {tenant.display_name} ({tenant.public_id})\n'
        f'Chỉ số: {meter_name}\n'
        f'Đã sử dụng: {current_usage:,} / {limit:,} ({pct:.1f}%)\n'
        f'Mức độ: {level}\n'
        f'Thời gian: {timezone.now().strftime("%Y-%m-%d %H:%M:%S")}\n\n'
        f'Vui lòng xem xét nâng cấp gói hoặc tối ưu hóa sử dụng.'
    )
    
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient],
            fail_silently=False,
        )
    except Exception as exc:
        logging.getLogger(__name__).error('Failed to send quota alert email: %s', exc)


def _dispatch_quota_webhook(tenant: CoreTenant, meter_code: str, level: str, usage_pct: float):
    """Dispatch webhook notification for quota threshold breach."""
    from identity_access.signals import dispatch_webhook
    
    event_type = 'quota_warning' if level == 'warning' else 'quota_exceeded'
    payload = {
        'tenant_id': tenant.public_id,
        'tenant_name': tenant.display_name,
        'meter_code': meter_code,
        'level': level,
        'usage_percent': round(usage_pct, 2),
        'timestamp': timezone.now().isoformat(),
    }
    try:
        dispatch_webhook(tenant, event_type, payload)
    except Exception as exc:
        logging.getLogger(__name__).error('Webhook dispatch failed: %s', exc)


def _log_tenant_lifecycle_event(tenant: CoreTenant, meter_code: str, level: str):
    """Create TenantLifecycleEvent for audit trail."""
    event_type = 'quota_warning' if level == 'warning' else 'quota_exceeded'
    try:
        TenantLifecycleEvent.objects.create(
            tenant=tenant,
            event_type=event_type,
            actor_type='system',
            metadata={'meter_code': meter_code, 'level': level},
        )
    except Exception as exc:
        logging.getLogger(__name__).error('Failed to create TenantLifecycleEvent: %s', exc)
    except Exception as exc:
        logging.getLogger(__name__).error('Failed to create TenantLifecycleEvent: %s', exc)
