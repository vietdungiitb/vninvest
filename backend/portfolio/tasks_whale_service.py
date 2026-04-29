import logging
from celery import shared_task
from .models import SignalServiceRun, WhaleAlertEvent, WhaleServiceJob, TrackedSymbol
from .services_global_signal_distribution import deliver_whale_alert_event
from .services_signal_run_registry import (
    create_signal_service_run,
    finish_signal_service_run,
    resolve_signal_run_status,
    resolve_signal_run_type,
    start_signal_service_run,
)
from .services_global_whale_alerts import run_global_whale_alert_detection
from .whale_service_manager import WhaleJobManager
from .services_whale_compute import WhaleBackfillService
from .tasks_whale_generation import generate_whale_advisory_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, name='portfolio.tasks.detect_and_store_global_whale_alerts', autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 0})
def detect_and_store_global_whale_alerts(self, symbol: str | None = None, run_id: int | None = None) -> dict:
    task_id = getattr(getattr(self, 'request', None), 'id', None)
    if run_id:
        run = start_signal_service_run(SignalServiceRun.objects.get(id=run_id), task_id=task_id)
    else:
        run = create_signal_service_run(
            service_domain=SignalServiceRun.ServiceDomain.WHALE,
            run_type=resolve_signal_run_type(symbol),
            params_json={'symbol': str(symbol).strip().upper()} if str(symbol or '').strip() else {},
            task_id=task_id,
        )

    try:
        result = run_global_whale_alert_detection(symbol=symbol)
        created_event_ids = [int(event_id) for event_id in result.get('created_event_ids') or [] if event_id]
        for event_id in created_event_ids:
            distribute_whale_alert_event.delay(event_id)

        stored_items = int(result.get('created', 0) or 0) + int(result.get('updated', 0) or 0)
        status_value = resolve_signal_run_status(
            errors=int(result.get('errors', 0) or 0),
            processed_items=int(result.get('processed', 0) or 0),
            stored_items=stored_items,
        )
        finish_signal_service_run(
            run,
            status=status_value,
            processed_items=int(result.get('processed', 0) or 0),
            stored_items=stored_items,
            failed_items=int(result.get('errors', 0) or 0),
            progress_pct=100.0,
            log=(
                'whale symbols={symbols} processed={processed} created={created} '
                'updated={updated} cached={cached} skipped_locked={skipped_locked} errors={errors}'
            ).format(**result),
        )
        return {
            **result,
            'distribution_enqueued': len(created_event_ids),
            'run_id': run.id,
        }
    except Exception as exc:
        finish_signal_service_run(
            run,
            status=SignalServiceRun.StatusChoices.FAILED,
            processed_items=0,
            stored_items=0,
            failed_items=1,
            progress_pct=100.0,
            log=f'whale detection exception: {exc}',
        )
        raise


@shared_task(bind=True, name='portfolio.tasks.distribute_whale_alert_event', autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 0})
def distribute_whale_alert_event(self, event_id: int) -> dict:
    del self
    event = WhaleAlertEvent.objects.get(id=event_id)
    result = deliver_whale_alert_event(event=event)
    return {
        **result,
        'event_id': event.event_id,
    }

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
