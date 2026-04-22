import logging
import traceback
from django.utils import timezone
from celery import shared_task

from .models import CrawlJob, CrawlSchedule, CrawlRun, CrawlAuditLog
from .services_service_control import acquire_job_lock, release_job_lock

logger = logging.getLogger(__name__)

# Map service_code -> Celery task function
def _get_mapped_task(service_code: str):
    if service_code == 'stock_profile_sync':
        from .tasks_stock_profile_sync import sync_stock_profiles_from_snapshot
        return sync_stock_profiles_from_snapshot
    elif service_code == 'whale_advisory_auto':
        from .tasks import auto_generate_advisories_for_all_tracked
        return auto_generate_advisories_for_all_tracked
    elif service_code == 'market_snapshot':
        from .tasks import build_realtime_symbol_universe_snapshot
        return build_realtime_symbol_universe_snapshot
    return None


@shared_task(bind=True, max_retries=1)
def run_crawl_job(self, run_id: int):
    """
    Dispatcher task that wraps the execution of actual background tasks
    with Run tracking, locking (anti-overlap), and audit logging.
    """
    try:
        run = CrawlRun.objects.select_related('job').get(id=run_id)
    except CrawlRun.DoesNotExist:
        logger.error(f"CrawlRun {run_id} not found.")
        return

    job = run.job
    
    # State transition queued -> running
    run.status = 'running'
    run.started_at = timezone.now()
    run.save(update_fields=['status', 'started_at'])

    # Anti-overlap lock
    lock = acquire_job_lock(job.id, task_id=str(self.request.id), timeout=5)
    if not lock:
        logger.warning(f"CrawlJob {job.service_code} is already running (Overlap prevented).")
        run.status = 'failed'
        run.log = 'Overlap prevented: Job is already running.'
        run.finished_at = timezone.now()
        run.save(update_fields=['status', 'log', 'finished_at'])
        return

    CrawlAuditLog.objects.create(
        event='run_started',
        payload={'service_code': job.service_code},
        run=run,
        timestamp=timezone.now()
    )

    task_func = _get_mapped_task(job.service_code)
    
    if not task_func:
        error_msg = f"No mapped Celery task found for service_code: {job.service_code}"
        run.status = 'failed'
        run.log = error_msg
        run.finished_at = timezone.now()
        run.save(update_fields=['status', 'log', 'finished_at'])
        
        CrawlAuditLog.objects.create(
            event='run_failed',
            payload={'reason': 'no_mapped_task'},
            run=run,
            timestamp=timezone.now()
        )
        release_job_lock(lock)
        return

    success = False
    log_output = ""
    try:
        # Wrap task execution
        result = task_func()
        success = True
        log_output = f"Task completed successfully. Result: {result}"
    except Exception as e:
        success = False
        log_output = f"Task failed with error: {str(e)}\n{traceback.format_exc()}"
    finally:
        # Finalize run
        run.finished_at = timezone.now()
        run.status = 'success' if success else 'failed'
        run.log = log_output
        run.save(update_fields=['status', 'log', 'finished_at'])
        
        CrawlAuditLog.objects.create(
            event='run_completed' if success else 'run_error',
            payload={'service_code': job.service_code, 'success': success},
            run=run,
            timestamp=timezone.now()
        )
        
        # Free lock
        release_job_lock(lock)

    return success
