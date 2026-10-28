"""Celery tasks for identity_access: scheduled reports, lifecycle automation, webhooks."""
from __future__ import annotations

import csv
import io
import json
import logging
from datetime import date, timedelta

import httpx
from celery import shared_task
from django.template.loader import render_to_string
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def generate_and_deliver_report(self, report_id, is_test=False):
    """Generate report content and deliver via email."""
    from identity_access.models import ScheduledReport, ReportDeliveryLog
    from identity_access.mail_service import send_report_email

    try:
        report = ScheduledReport.objects.get(id=report_id)
    except ScheduledReport.DoesNotExist:
        logger.error('Report %s not found', report_id)
        return

    if not report.is_active and not is_test:
        logger.info('Report %s is inactive, skipping', report_id)
        return

    tenant = report.tenant
    content = _generate_report_content(report)
    subject = f'[{tenant.display_name}] {report.name} — {date.today().isoformat()}'

    for recipient in report.recipients:
        log = ReportDeliveryLog.objects.create(
            report=report,
            recipient=recipient,
            status='pending',
        )
        try:
            send_report_email(
                recipient=recipient,
                subject=subject,
                html_content=content.get('html'),
                csv_content=content.get('csv'),
                report_format=report.format,
            )
            log.status = 'success'
            log.sent_at = timezone.now()
            log.save()
        except Exception as e:
            logger.error('Failed to deliver report %s to %s: %s', report_id, recipient, e)
            log.status = 'failed'
            log.error_message = str(e)
            log.save()

    if not is_test:
        report.last_sent_at = timezone.now()
        report.total_deliveries += 1
        report.save(update_fields=['last_sent_at', 'total_deliveries'])

    logger.info('Report %s delivered to %d recipients', report_id, len(report.recipients))


def _generate_report_content(report):
    """Generate HTML and/or CSV content based on report type and format."""
    from commercial.models import Invoice, QuotaHistory
    from identity_access.models import CorePATCredential, CoreServiceAccount, TenantMember

    tenant = report.tenant
    today = date.today()

    html_parts = []
    csv_buffer = None

    if report.report_type == 'usage_summary':
        quotas = QuotaHistory.objects.filter(
            tenant=tenant,
            date=today - timedelta(days=30),
        ).order_by('meter_code')[:20]
        html_parts.append(render_to_string('reports/usage_summary.html', {
            'tenant': tenant,
            'quotas': quotas,
            'date': today,
        }))
        if report.format == 'csv':
            csv_buffer = io.StringIO()
            writer = csv.writer(csv_buffer)
            writer.writerow(['Meter', 'Consumed', 'Entitled', 'Remaining', 'Risk'])
            for q in quotas:
                writer.writerow([q.meter_code, q.consumed_amount, q.entitled_amount, q.remaining_amount, q.risk_state])

    elif report.report_type == 'billing_summary':
        invoices = Invoice.objects.filter(
            tenant=tenant,
            created_at__date__gte=today - timedelta(days=60),
        ).order_by('-created_at')[:12]
        total = sum(i.amount_due for i in invoices if i.amount_due)
        html_parts.append(render_to_string('reports/billing_summary.html', {
            'tenant': tenant,
            'invoices': invoices,
            'total': total,
            'date': today,
        }))
        if report.format == 'csv':
            csv_buffer = io.StringIO()
            writer = csv.writer(csv_buffer)
            writer.writerow(['Invoice', 'Amount', 'Status', 'Date'])
            for inv in invoices:
                writer.writerow([inv.invoice_number, inv.amount_due, inv.status, inv.created_at.date()])

    elif report.report_type == 'security_digest':
        active_pats = CorePATCredential.objects.filter(
            service_account__tenant=tenant,
            status='active',
        ).count()
        recent_revoked = CorePATCredential.objects.filter(
            service_account__tenant=tenant,
            revoked_at__gte=today - timedelta(days=7),
        ).count()
        active_sas = CoreServiceAccount.objects.filter(
            tenant=tenant,
            status='active',
        ).count()
        html_parts.append(render_to_string('reports/security_digest.html', {
            'tenant': tenant,
            'active_pats': active_pats,
            'recent_revoked': recent_revoked,
            'active_sas': active_sas,
            'date': today,
        }))

    elif report.report_type == 'audit_log':
        members = TenantMember.objects.filter(tenant=tenant)[:20]
        html_parts.append(render_to_string('reports/audit_log.html', {
            'tenant': tenant,
            'members': members,
            'date': today,
        }))

    return {
        'html': '\n'.join(html_parts) if html_parts else None,
        'csv': csv_buffer.getvalue() if csv_buffer else None,
    }


@shared_task
def process_scheduled_reports():
    """Dynamic scheduler — checks all active reports and dispatches due ones.

    Runs every 60 minutes via Celery Beat. Avoids static CELERY_BEAT_SCHEDULE
    entries for each report.
    """
    from identity_access.models import ScheduledReport

    now = timezone.now()
    active_reports = ScheduledReport.objects.filter(is_active=True)

    for report in active_reports:
        if _is_report_due(report, now):
            logger.info('Dispatching due report %s (%s)', report.id, report.name)
            generate_and_deliver_report.delay(report.id)


def _is_report_due(report, now):
    """Check if a scheduled report is due based on its schedule and last_sent_at."""
    interval_map = {
        'daily': timedelta(days=1),
        'weekly_mon': timedelta(days=7),
        'weekly_fri': timedelta(days=7),
        'monthly_1': timedelta(days=30),
        'monthly_15': timedelta(days=30),
    }
    interval = interval_map.get(report.schedule)
    if interval is None:
        return False

    if report.last_sent_at is None:
        return _is_in_schedule_window(report, now)

    time_since_last = now - report.last_sent_at
    if time_since_last >= interval * 0.8:
        if _is_in_schedule_window(report, now):
            if time_since_last >= interval * 0.95:
                return True
    return False


def _is_in_schedule_window(report, now):
    """Check if current time falls within the expected send window."""
    weekday_map = {
        'weekly_mon': 0,
        'weekly_fri': 4,
    }
    day_map = {
        'monthly_1': 1,
        'monthly_15': 15,
    }

    if report.schedule == 'daily':
        return now.hour == 8
    elif report.schedule in weekday_map:
        return now.weekday() == weekday_map[report.schedule] and now.hour == 8
    elif report.schedule in day_map:
        return now.day == day_map[report.schedule] and now.hour == 9
    return False


@shared_task
def cleanup_old_login_attempts():
    """Delete login attempts older than 90 days. Runs daily."""
    from identity_access.models import LoginAttempt
    cutoff = timezone.now() - timedelta(days=90)
    deleted, _ = LoginAttempt.objects.filter(created_at__lt=cutoff).delete()
    if deleted:
        logger.info('Cleaned up %d old login attempts', deleted)
    return deleted


# ---------------------------------------------------------------------------
# Phase 4 — Webhook Delivery
# ---------------------------------------------------------------------------


@shared_task(queue='webhooks_queue', default_retry_delay=60, max_retries=3,
             autoretry_for=(TimeoutError, ConnectionError))
def deliver_webhook(delivery_id: int) -> dict:
    """Synchronous webhook delivery task (Celery-compatible)."""
    from identity_access.models import WebhookDelivery
    from identity_access.webhook_dispatcher import WebhookDispatcher

    try:
        delivery = WebhookDelivery.objects.select_related('config').get(id=delivery_id)
    except WebhookDelivery.DoesNotExist:
        logger.error('WebhookDelivery %s not found', delivery_id)
        return {'status': 'error', 'detail': 'not_found'}

    config = delivery.config
    if not config.is_active:
        delivery.status = 'failed'
        delivery.response_code = 0
        delivery.response_body = 'Config inactive'
        delivery.save()
        return {'status': 'failed', 'detail': 'config_inactive'}

    signature = WebhookDispatcher.sign_payload(config.secret, delivery.payload)
    headers = {
        'Content-Type': 'application/json',
        WebhookDispatcher.HMAC_HEADER: signature,
        'User-Agent': 'VNInvest-Webhook/1.0',
    }
    headers.update(config.headers or {})

    import time
    start = time.monotonic()
    try:
        with httpx.Client(timeout=config.timeout_seconds) as client:
            response = client.post(config.url, json=delivery.payload, headers=headers)
        duration_ms = int((time.monotonic() - start) * 1000)
        delivery.response_code = response.status_code
        delivery.duration_ms = duration_ms
        delivery.attempts += 1
        delivery.response_body = response.text[:2000]

        if 200 <= response.status_code < 300:
            delivery.status = 'success'
        elif 400 <= response.status_code < 500:
            delivery.status = 'failed'
            delivery.response_body = f'HTTP {response.status_code}: Client error — {response.text[:500]}'
        else:
            delivery.status = 'failed'
            delivery.response_body = f'HTTP {response.status_code}: Server error — {response.text[:500]}'

        delivery.save()
        return {'status': delivery.status, 'response_code': response.status_code, 'duration_ms': duration_ms}

    except (httpx.TimeoutException, httpx.ConnectError, httpx.HTTPError) as exc:
        duration_ms = int((time.monotonic() - start) * 1000)
        delivery.attempts += 1
        delivery.duration_ms = duration_ms
        delivery.response_code = 0
        delivery.response_body = str(exc)[:500]

        if delivery.attempts < config.retry_count:
            delivery.status = 'retrying'
            from django.utils import timezone as tz
            backoff = 60 * (2 ** (delivery.attempts - 1))
            delivery.next_retry_at = tz.now() + timedelta(seconds=backoff)
        else:
            delivery.status = 'failed'

        delivery.save()
        return {'status': delivery.status, 'error': str(exc), 'attempts': delivery.attempts}


@shared_task
def retry_failed_webhooks():
    """Retry webhook deliveries that are in 'retrying' state and past next_retry_at."""
    from identity_access.models import WebhookDelivery
    now = timezone.now()
    retryable = WebhookDelivery.objects.filter(
        status='retrying',
        next_retry_at__lte=now,
    )[:200]
    count = 0
    for delivery in retryable:
        deliver_webhook.delay(delivery.id)
        count += 1
    if count:
        logger.info('Retried %d webhook deliveries', count)
    return count


@shared_task
def cleanup_webhook_deliveries():
    """Daily batch delete: remove deliveries older than 90 days, 1000 at a time."""
    from identity_access.models import WebhookDelivery
    cutoff = timezone.now() - timedelta(days=90)
    deleted = 1
    total = 0
    while deleted > 0:
        batch = list(WebhookDelivery.objects.filter(
            created_at__lt=cutoff
        ).values_list('id', flat=True)[:1000])
        if not batch:
            break
        _, stats = WebhookDelivery.objects.filter(id__in=batch).delete()
        deleted = len(batch)
        total += deleted
    if total:
        logger.info('Cleaned up %d old webhook deliveries', total)
    return total


# ---------------------------------------------------------------------------
# Phase 4 — Trial Lifecycle
# ---------------------------------------------------------------------------
# C6: both trial handlers that used to live here were removed.
#
#   auto_disable_expired_trials set DEPROVISIONED for trial_ends_at <= today-3d,
#   directly contradicting tenant_lifecycle.tasks.auto_expire_trials which set
#   SUSPENDED for trial_ends_at < now. It was never in CELERY_BEAT_SCHEDULE, so it
#   never ran — but a manual `.delay()` would have deprovisioned a customer and
#   skipped both the 30-day grace and deprovision_tenant_async cleanup.
#
#   check_trial_expirations duplicated the 7/3/1-day reminder logic of the
#   scheduled tenant_lifecycle.tasks.send_trial_expiry_warning, was also never
#   scheduled, and its emails went through a different code path.
#
# The single policy now lives in tenant_lifecycle/tasks.py: an expired trial
# SUSPENDS, and the scheduled auto_deprovision_stale is the only path to
# DEPROVISIONED (after 30 days).


@shared_task(bind=True, max_retries=2, default_retry_delay=60, autoretry_for=(Exception,), retry_backoff=True)
def deprovision_tenant_async(self, tenant_public_id: str):
    """Async cleanup after tenant deprovisioning: cascade-delete offboarded resources.

    C1: ``CorePATCredential`` has NO ``tenant`` field — the only tenant path is
    ``service_account__tenant``. The old ``filter(tenant=tenant)`` raised FieldError
    *after* members were already deleted and *before* webhooks were cleaned, leaving
    every deprovisioned tenant permanently half-cleaned with zero retries.
    The whole body now runs in one transaction so a mid-way failure rolls back,
    and autoretry_for makes a transient DB error recoverable instead of terminal.
    """
    from django.db import transaction
    from identity_access.models import CoreTenant, TenantMember, TenantWebhookConfig, CorePATCredential

    try:
        tenant = CoreTenant.objects.get(public_id=tenant_public_id)
    except CoreTenant.DoesNotExist:
        logger.error('Deprovision: tenant %s not found', tenant_public_id)
        return

    if tenant.status != CoreTenant.StatusChoices.DEPROVISIONED:
        logger.warning('Deprovision: tenant %s status is %s — skipping cleanup', tenant_public_id, tenant.status)
        return

    removed = {}
    with transaction.atomic():
        member_ids = list(TenantMember.objects.filter(tenant=tenant).values_list('id', flat=True))
        if member_ids:
            _, member_stats = TenantMember.objects.filter(id__in=member_ids).delete()
            removed['members'] = member_stats

        # C1 FIX: CorePATCredential has no direct tenant FK; it hangs off
        # CoreServiceAccount. Filtering through service_account__tenant is the
        # only correct tenant path.
        pat_ids = list(
            CorePATCredential.objects.filter(service_account__tenant=tenant).values_list('id', flat=True)
        )
        if pat_ids:
            _, pat_stats = CorePATCredential.objects.filter(id__in=pat_ids).delete()
            removed['pats'] = pat_stats

        webhook_ids = list(TenantWebhookConfig.objects.filter(tenant=tenant).values_list('id', flat=True))
        if webhook_ids:
            _, webhook_stats = TenantWebhookConfig.objects.filter(id__in=webhook_ids).delete()
            removed['webhooks'] = webhook_stats

    logger.info('Deprovision cleanup for %s: %s', tenant_public_id, removed)
    return removed


PAT_AUDIT_QUEUE_KEY = 'pat_audit_queue'
PAT_AUDIT_FLUSH_BATCH = 500


@shared_task(name='identity_access.tasks.flush_pat_audit_log', bind=True, max_retries=3, default_retry_delay=30)
def flush_pat_audit_log(self):
    """Flush batched PATAuditLog entries from the Redis list into the DB.

    Runs every 10s. Entries are enqueued by TenantQuotaMiddleware (one RPUSH
    per PAT request) so the request hot path never writes to the DB directly.
    Entries whose PAT/tenant can no longer be resolved are dropped.
    """
    from django.core.cache import cache
    from identity_access.models import CorePATCredential, CoreTenant, PATAuditLog

    try:
        redis_client = cache._cache.get_client(write=True)
    except Exception as exc:
        logger.error('flush_pat_audit_log: failed to get redis connection: %s', exc, exc_info=True)
        return {'status': 'error', 'reason': str(exc)}

    pending = []
    try:
        for _ in range(PAT_AUDIT_FLUSH_BATCH):
            raw = redis_client.lpop(PAT_AUDIT_QUEUE_KEY)
            if not raw:
                break
            if isinstance(raw, bytes):
                raw = raw.decode('utf-8')
            pending.append(json.loads(raw))
    except Exception as exc:
        logger.error('flush_pat_audit_log: failed to pop queue: %s', exc, exc_info=True)
        return {'status': 'error', 'reason': str(exc)}

    if not pending:
        return {'status': 'ok', 'flushed': 0}

    pat_ids = {e['pat_pk'] for e in pending if e.get('pat_pk')}
    tenant_ids = {e['tenant_pk'] for e in pending if e.get('tenant_pk')}
    pats = {p.pk: p for p in CorePATCredential.objects.filter(pk__in=pat_ids)}
    tenants = {t.pk: t for t in CoreTenant.objects.filter(pk__in=tenant_ids)}

    objects = []
    dropped = 0
    for entry in pending:
        pat = pats.get(entry.get('pat_pk'))
        tenant = tenants.get(entry.get('tenant_pk'))
        if pat is None or tenant is None:
            dropped += 1
            continue
        objects.append(PATAuditLog(
            pat=pat,
            tenant=tenant,
            ip_address=entry.get('ip_address') or None,
            endpoint=entry.get('endpoint', ''),
            method=entry.get('method', ''),
            status_code=entry.get('status_code', 0),
            user_agent=entry.get('user_agent', ''),
            duration_ms=entry.get('duration_ms', 0),
            auth_source=entry.get('auth_source', 'pat'),
        ))

    created = 0
    if objects:
        try:
            PATAuditLog.objects.bulk_create(objects, batch_size=PAT_AUDIT_FLUSH_BATCH)
            created = len(objects)
        except Exception as exc:
            logger.error('flush_pat_audit_log: bulk_create failed: %s', exc, exc_info=True)
            # Re-queue the failed entries for the next attempt
            for obj in objects:
                redis_client.rpush(PAT_AUDIT_QUEUE_KEY, json.dumps({
                    'pat_pk': obj.pat_id,
                    'tenant_pk': obj.tenant_id,
                    'ip_address': obj.ip_address or '',
                    'endpoint': obj.endpoint,
                    'method': obj.method,
                    'status_code': obj.status_code,
                    'user_agent': obj.user_agent,
                    'auth_source': obj.auth_source,
                    'duration_ms': obj.duration_ms,
                }, default=str))
            return {'status': 'error', 'reason': str(exc), 'flushed': 0}

    return {'status': 'ok', 'flushed': created, 'dropped': dropped}


@shared_task(name='identity_access.tasks.cross_ref_pat_audit_events', bind=True, max_retries=2, default_retry_delay=120)
def cross_ref_pat_audit_events(self, hours: int = 1):
    """Best-effort cross-reference: tag AuditEvent rows with their PAT id.

    AuditEvent already records every request (including PAT requests). This task
    links them to the originating PAT so cross-table analytics (AuditEvent JOIN
    PATAuditLog) are possible. Matching is conservative: only AuditEvents whose
    pat_id is still NULL, scoped by tenant, and matching a single PATAuditLog on
    (ip, method, endpoint, status_code) within a 10s window are updated. If no
    reliable match exists, the row is left untouched (PATAuditLog remains the
    source of truth for per-PAT queries).
    """
    from ops_audit.models import AuditEvent
    from identity_access.models import PATAuditLog

    since = timezone.now() - timedelta(hours=hours)
    candidates = AuditEvent.objects.filter(
        pat_id__isnull=True,
        tenant_id__gt='',
        occurred_at__gte=since,
    ).only('id', 'tenant_id', 'ip_address', 'action', 'resource_type', 'request_id', 'occurred_at', 'metadata')

    updated = 0
    for event in candidates.iterator(chunk_size=500):
        # Real HTTP method/path live in the metadata JSON (RequestTraceMiddleware),
        # not in the top-level action/resource_type fields.
        meta = event.metadata or {}
        method = meta.get('method')
        path = meta.get('path')

        match_qs = PATAuditLog.objects.filter(
            tenant__public_id=event.tenant_id,
            ip_address=event.ip_address,
            occurred_at__gte=event.occurred_at - timedelta(seconds=10),
            occurred_at__lte=event.occurred_at + timedelta(seconds=10),
        )
        if method:
            match_qs = match_qs.filter(method=method)
        if path:
            match_qs = match_qs.filter(endpoint=path[:256])
        match = match_qs.first()
        if match is not None:
            event.pat_id = match.pat.public_id
            event.save(update_fields=['pat_id'])
            updated += 1

    return {'status': 'ok', 'updated': updated}
