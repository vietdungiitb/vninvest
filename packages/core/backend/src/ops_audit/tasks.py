"""
SM-P5.5: Automated daily database backup task.

Runs at 02:00 AM (Asia/Ho_Chi_Minh). Dumps core DB, optionally uploads to S3/R2.
Configure via env vars:
  BACKUP_S3_BUCKET — S3/R2 bucket name (optional; skips upload if not set)
  BACKUP_S3_ENDPOINT_URL — custom endpoint for R2 (optional)
  AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY — credentials for S3/R2
  CORE_DATABASE_URL — used to extract pg connection params
"""
import gzip
import logging
import os
import subprocess
import tempfile
from datetime import datetime

from celery import shared_task
import dj_database_url

logger = logging.getLogger(__name__)

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
        backup_path = os.path.join(tmpdir, backup_filename)
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
        logger.info('[backup] Dump complete: %s (%d bytes)', backup_filename, backup_size)

        if backup_size > _MAX_BACKUP_SIZE_BYTES:
            logger.warning('[backup] Backup exceeds 2 GB size guard — investigate DB growth')

        s3_bucket = os.environ.get('BACKUP_S3_BUCKET', '')
        if s3_bucket:
            _upload_to_s3(backup_path, backup_filename, s3_bucket)
        else:
            logger.info('[backup] BACKUP_S3_BUCKET not set — skipping remote upload')

    return {
        'status': 'ok',
        'filename': backup_filename,
        'size_bytes': backup_size,
        's3_uploaded': bool(s3_bucket),
    }


def _upload_to_s3(local_path: str, remote_key: str, bucket: str) -> None:
    """Upload backup file to S3-compatible storage (supports R2 via BACKUP_S3_ENDPOINT_URL)."""
    try:
        import boto3  # type: ignore  # noqa: F401
    except ImportError:
        logger.warning('[backup] boto3 not installed — cannot upload to S3/R2')
        return

    import boto3

    endpoint_url = os.environ.get('BACKUP_S3_ENDPOINT_URL') or None
    s3 = boto3.client('s3', endpoint_url=endpoint_url)
    try:
        s3.upload_file(local_path, bucket, remote_key)
        logger.info('[backup] Uploaded to s3://%s/%s', bucket, remote_key)
    except Exception as exc:
        logger.error('[backup] S3 upload failed: %s', exc)
        # Non-fatal: backup succeeded locally; raise to trigger retry
        raise
