import logging
from celery import shared_task
from .models import WhaleServiceJob, TrackedSymbol
from .whale_service_manager import WhaleJobManager
from .services_whale_compute import WhaleBackfillService
from .tasks_whale_generation import generate_whale_advisory_task

logger = logging.getLogger(__name__)

@shared_task(bind=True, name='portfolio.tasks.whale_service_job_task')
def whale_service_job_task(self, job_id):
    """
    Main orchestration task for Whale Service Jobs.
    Dispatches to specific logic based on service_type.
    """
    try:
        job = WhaleServiceJob.objects.get(id=job_id)
    except WhaleServiceJob.DoesNotExist:
        logger.error(f"WhaleServiceJob {job_id} not found.")
        return

    task_id = self.request.id
    
    if job.service_type == WhaleServiceJob.ServiceType.BACKFILL:
        return WhaleBackfillService.execute_backfill_job(job_id, task_id)
        
    elif job.service_type == WhaleServiceJob.ServiceType.USER_REFRESH:
        # Start job
        started, msg = WhaleJobManager.start_job(job.id, task_id)
        if not started:
            WhaleJobManager.mark_job_skipped_duplicate(job.id, f"Skipped USER_REFRESH: {msg}")
            return False
            
        params = job.params
        symbol = params.get('symbol')
        user_id = params.get('user_id')
        
        # Call the existing generation task
        # We wrap it to track completion
        try:
            generate_whale_advisory_task(
                symbol=symbol,
                matched_value_vnd=0,  # 0 means scan all for today
                side='UNKNOWN',
                user_id=user_id,
                force_refresh=True,
                source='manual_refresh'
            )
            WhaleJobManager.finish_job(job.id, task_id, WhaleServiceJob.StatusChoices.COMPLETED, "Refresh completed.")
        except Exception as e:
            WhaleJobManager.finish_job(job.id, task_id, WhaleServiceJob.StatusChoices.FAILED, str(e))
        return True

    elif job.service_type == WhaleServiceJob.ServiceType.GLOBAL_RECOMPUTE:
        # Start job
        started, msg = WhaleJobManager.start_job(job.id, task_id)
        if not started:
            WhaleJobManager.mark_job_skipped_duplicate(job.id, f"Skipped GLOBAL_RECOMPUTE: {msg}")
            return False
            
        symbols = job.params.get('symbols', [])
        if not symbols:
            # Recompute for all active tracked symbols
            symbols = list(TrackedSymbol.objects.filter(is_active=True).values_list('symbol', flat=True).distinct())
            
        total = len(symbols)
        WhaleJobManager.update_progress(job.id, 0, processed=0, total=total)
        
        processed = 0
        failed = 0
        for sym in symbols:
            if not WhaleJobManager.heartbeat(job.id, task_id):
                break
            try:
                generate_whale_advisory_task(
                    symbol=sym,
                    matched_value_vnd=0,
                    side='UNKNOWN',
                    force_refresh=True,
                    source='auto_generation'
                )
                processed += 1
            except Exception as e:
                failed += 1
                job.log = (job.log + f"\nError {sym}: {str(e)}").strip()
                job.save(update_fields=['log'])
            
            WhaleJobManager.update_progress(job.id, (processed+failed)/total*100, processed=processed, failed=failed)
            
        status = WhaleServiceJob.StatusChoices.COMPLETED if failed == 0 else WhaleServiceJob.StatusChoices.PARTIAL
        WhaleJobManager.finish_job(job.id, task_id, status, f"Recomputed {processed}/{total} symbols.")
        return True

    return False
