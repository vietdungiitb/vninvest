"""
Ops Audit tasks:
1. daily_db_backup — SM-P5.5 daily DB backup (SM-P5.5)
2. aggregate_api_call_rollup — API analytics rollup (Phase 2)
"""
import gzip
import logging
import os
import subprocess
import tempfile
from datetime import datetime, timedelta

import dj_database_url
from celery import shared_task
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

# ─── Existing backup task ───
_MAX_BACKUP_SIZE_BYTES = 2 * 1024 * 1024 * 1024  # 2 GB guard


@shared_task(name='ops_audit.tasks.daily_db_backup', bind=True, max_retries=2, default_retry_delay=300)
def daily_db_backup(self):
    """
    Dumps vninvest_core DB via pg_dump → gzip → optional S3/R2 upload.
    DoD: backup file created; upload attempted if BACKUP_S3_BUCKET set.
    """
    db_url = os.environ.get('CORE_DATABASE_URL', '')
    if not db_url:
        logger.warning('[backup] CORE_DATABASE_URL not set — skipping backup')
        return {'status': 'skipped', 'reason': 'no CORE_DATABASE_URL'}

    try:
        db_config = dj_database_url.parse(db_url)
    except Exception as exc:
        logger.error('[backup] Failed to parse CORE_DATABASE_URL: %s', exc)
        raise self.retry(exc=exc)

    timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
    db_name = db_config.get('NAME', 'vninvest_core')
    backup_filename = f'core_db_{db_name}_{timestamp}.sql.gz'

    pg_env = {**os.environ}
    if db_config.get('PASSWORD'):
        pg_env['PGPASSWORD'] = db_config['PASSWORD']

    pg_dump_cmd = [
        'pg_dump',
        '--no-password',
        '--format=plain',
        '--encoding=UTF8',
        f"--host={db_config.get('HOST', 'localhost')}",
        f"--port={db_config.get('PORT', '5432')}",
        f"--username={db_config.get('USER', 'vninvest')}",
        db_name,
    ]

    with tempfile.TemporaryDirectory() as tmpdir:
        backup_path = os.path.join(tmpdir, f'core_db_{db_name}_{timestamp}.sql.gz')
        try:
            with gzip.open(backup_path, 'wb') as gz_out:
                result = subprocess.run(
                    pg_dump_cmd,
                    env=pg_env,
                    stdout=gz_out,
                    stderr=subprocess.PIPE,
                    timeout=1800,  # 30 min hard cap
                )
            if result.returncode != 0:
                err = result.stderr.decode('utf-8', errors='replace')
                raise RuntimeError(f'pg_dump failed (exit {result.returncode}): {err}')
        except subprocess.TimeoutExpired as exc:
            logger.error('[backup] pg_dump timed out')
            raise self.retry(exc=exc)
        except Exception as exc:
            logger.error('[backup] pg_dump error: %s', exc)
            raise self.retry(exc=exc)

        backup_size = os.path.getsize(backup_path)
        logger.info('[backup] Dump complete: %s (%d bytes)', f'core_db_{db_name}_{timestamp}.sql.gz', backup_size)

        if backup_size > _MAX_BACKUP_SIZE_BYTES:
            logger.warning('[backup] Backup exceeds 2 GB size guard — investigate DB growth')

        s3_bucket = os.environ.get('BACKUP_S3_BUCKET', '')
        if s3_bucket:
            _upload_to_s3(backup_path, f'core_db_{db_name}_{timestamp}.sql.gz', s3_bucket)
        else:
            logger.info('[backup] BACKUP_S3_BUCKET not set — skipping remote upload')

    return {
        'status': 'ok',
        'filename': f'core_db_{db_name}_{timestamp}.sql.gz',
        'size_bytes': backup_size,
        's3_uploaded': bool(s3_bucket),
    }


def _upload_to_s3(local_path: str, remote_key: str, bucket: str) -> None:
    """Upload backup file to S3-compatible storage (supports R2 via BACKUP_S3_ENDPOINT_URL)."""
    try:
        import boto3  # type: ignore
    except ImportError:
        logger.warning('[backup] boto3 not installed — cannot upload to S3/R2')
        return

    import boto3

    endpoint_url = os.environ.get('BACKUP_S3_ENDPOINT_URL') or None
    s3 = boto3.client('s3', endpoint_url=endpoint_url)
    s3.upload_file(local_path, bucket, remote_key)
    logger.info('[backup] Uploaded %s to s3://%s/%s', local_path, bucket, remote_key)


# ─── Phase 2: API Analytics Rollup ───

# Constants
ROLLUP_QUEUE_KEY = 'rollup_last_id'
ROLLUP_BATCH_SIZE = 50000
ROLLUP_WINDOW_HOURS = 48


def _endpoint_group(path: str) -> str:
    """Map request path to logical endpoint group. Unmatched → 'other'.

    R5.2: `/core/v1/ai/agents/` (route thật, `ai_agents/urls.py:6`) trước đây bị ghi
    nhóm **`ai`** vì prefix tổng quát `'/core/v1/ai/'` đứng trước trong dict; còn
    `'/core/v1/ai-agents/'` là **route không tồn tại** ⇒ nhánh `ai_agents` chưa bao
    giờ chạy. `dict` giữ thứ tự chèn và vòng lặp dùng `startswith` theo thứ tự đó,
    nên cách sửa là đặt prefix **cụ thể hơn lên trước** — không phải đổi chuỗi rồi
    hy vọng thứ tự.
    """
    if not path:
        return 'other'
    prefixes = {
        '/core/v1/partner/': 'partner',
        '/core/v1/identity/': 'identity',
        '/api/core/v1/auth/': 'auth',
        '/core/v1/market-data/': 'market_data',
        # R5.2: phải khai TRƯỚC `'/core/v1/ai/'` — nếu sau, generic nuốt mất.
        '/core/v1/ai/agents/': 'ai_agents',
        '/core/v1/ai/': 'ai',
        '/core/v1/data-ingest/': 'data_ingest',
        '/core/v1/advertising/': 'advertising',
        '/core/v1/widget/': 'widget',
        '/core/v1/stock-management/': 'stock_management',
        '/core/v1/operator/': 'operator',
        '/core/v1/health': 'health',
        '/api/public/': 'public',
    }
    for prefix, group in prefixes.items():
        if path.startswith(prefix):
            return group
    return 'other'


def _status_group(code: int | None) -> str:
    """Map HTTP status code to status group."""
    if code is None:
        return '2xx'
    if code < 400:
        return '2xx'
    if code < 500:
        return '4xx'
    return '5xx'


# AuditEvent stores the real request path/method/status/duration inside the
# `metadata` JSON (written by RequestTraceMiddleware), NOT in the top-level
# resource_type/action/status_code fields (which are always 'HttpRequest' /
# 'access' / NULL for HTTP access events). Extract from metadata with fallback.
def _event_path(e: dict) -> str:
    meta = e.get('metadata') or {}
    return meta.get('path') or e.get('resource_type') or ''


def _event_method(e: dict) -> str:
    meta = e.get('metadata') or {}
    return meta.get('method') or e.get('action') or 'GET'


def _event_status(e: dict):
    meta = e.get('metadata') or {}
    code = meta.get('status_code')
    if code is None:
        code = e.get('status_code')
    try:
        return int(code) if code is not None else None
    except (TypeError, ValueError):
        return None


def _event_duration(e: dict) -> int:
    meta = e.get('metadata') or {}
    dur = meta.get('duration_ms') or 0
    try:
        return int(dur)
    except (TypeError, ValueError):
        return 0


@shared_task(name='ops_audit.tasks.aggregate_api_call_rollup', bind=True, max_retries=3, default_retry_delay=120)
def aggregate_api_call_rollup(self):
    """
    Aggregate AuditEvent → ApiCallRollup (hourly granularity).

    Algorithm (idempotent, crash-safe):
    1. Read watermark `rollup_last_id` (last processed AuditEvent.id).
    2. Fetch next BATCH_SIZE events ordered by id.
    3. Group events by (tenant_id, date, hour) windows.
    4. For each window: DELETE existing rollup rows, re-aggregate ALL events
       in that window from AuditEvent, then INSERT fresh.
    5. Advance watermark atomically with the inserts (single transaction).
    6. Periodic drift check: log unknown endpoints falling into 'other'.
    """
    from ops_audit.models import ApiCallRollup, AuditEvent

    last_id = cache.get(ROLLUP_QUEUE_KEY, 0)
    since = timezone.now() - timedelta(hours=ROLLUP_WINDOW_HOURS)

    # Bound the scan to recent events + batch limit. Include `metadata` JSON so
    # we read the real path/method/status/duration (top-level fields are empty
    # for HTTP access events). Keep top-level fields as fallback.
    events_qs = AuditEvent.objects.filter(
        id__gt=last_id,
        occurred_at__gte=since,
    ).order_by('id')

    batch = list(events_qs.values(
        'id', 'tenant_id', 'ip_address', 'metadata', 'occurred_at',
        'resource_type', 'action',
    )[:ROLLUP_BATCH_SIZE])
    if not batch:
        return {'status': 'ok', 'processed': 0, 'watermark': last_id}

    max_id = max(e['id'] for e in batch)

    # Collect distinct (tenant_id, date, hour) windows touched by this batch
    windows = set()
    for e in batch:
        occ = e['occurred_at']
        if isinstance(occ, str):
            occ = datetime.fromisoformat(occ.replace('Z', '+00:00'))
        date = occ.date()
        hour = occ.hour
        windows.add((e['tenant_id'], date, hour))

    # Drift check: log if 'other' endpoint group is growing
    _drift_check(batch)

    try:
        with transaction.atomic():
            # For each window, recompute from scratch
            for tenant_id, date, hour in windows:
                occ_start = timezone.make_aware(datetime.combine(date, datetime.min.time().replace(hour=hour)))
                occ_end = occ_start + timedelta(hours=1)

                # Delete old rollup rows for this window
                ApiCallRollup.objects.filter(
                    tenant_id=tenant_id,
                    date=date,
                    hour=hour,
                ).delete()

                # Re-aggregate ALL events in this window (not just batch)
                window_events = AuditEvent.objects.filter(
                    tenant_id=tenant_id,
                    occurred_at__gte=occ_start,
                    occurred_at__lt=occ_end,
                ).values('ip_address', 'metadata', 'resource_type', 'action')

                agg = {}
                for ev in window_events:
                    ip = ev['ip_address'] or ''
                    endpoint = _event_path(ev)
                    code = _event_status(ev)
                    dur = _event_duration(ev)

                    ep_group = _endpoint_group(endpoint)
                    st_group = _status_group(code)
                    key = (ip, ep_group, st_group)

                    if key not in agg:
                        agg[key] = {'calls': 0, 'errors': 0, 'duration': 0}
                    agg[key]['calls'] += 1
                    if code and code >= 400:
                        agg[key]['errors'] += 1
                    agg[key]['duration'] += dur

                # Bulk insert fresh rollup rows
                rollup_objects = [
                    ApiCallRollup(
                        tenant_id=tenant_id,
                        date=date,
                        hour=hour,
                        ip_address=ip,
                        endpoint_group=ep,
                        status_group=st,
                        call_count=data['calls'],
                        error_count=data['errors'],
                        total_duration_ms=data['duration'],
                    )
                    for (ip, ep, st), data in agg.items()
                ]
                if rollup_objects:
                    ApiCallRollup.objects.bulk_create(rollup_objects, batch_size=1000)

            # Advance watermark
            cache.set(ROLLUP_QUEUE_KEY, max_id)

    except Exception as exc:
        logger.error('aggregate_api_call_rollup failed: %s', exc, exc_info=True)
        raise self.retry(exc=exc)

    return {'status': 'ok', 'processed': len(batch), 'watermark': max_id, 'windows': len(windows)}


def _drift_check(batch):
    """Log unknown endpoints hitting 'other' group; alert if ratio > 20%."""
    total = len(batch)
    if total == 0:
        return
    other_count = sum(1 for e in batch if _endpoint_group(_event_path(e)) == 'other')
    if other_count == 0:
        return
    pct = (other_count / total) * 100
    logger.warning('Rollup drift: %d/%d (%.1f%%) events in "other" endpoint group',
                   other_count, total, pct)
    # In future: push metric `rollup_endpoint_other_pct` to Prometheus/Datadog