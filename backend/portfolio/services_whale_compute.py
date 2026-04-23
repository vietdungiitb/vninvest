import logging
from datetime import date, datetime, timedelta
from django.db import transaction
from django.utils import timezone
from .models import IntradayTick, WhaleAdvisory, WhaleServiceJob, TrackedSymbol, UserConfig
from .whale_service_manager import WhaleJobManager
from .services import WhaleSignalEngine

logger = logging.getLogger(__name__)

class WhaleComputeEngine:
    @staticmethod
    def compute_for_symbol_date(symbol, trade_date, threshold_vnd, user=None):
        """
        Scan IntradayTick for a symbol/date and return list of WhaleAdvisory objects.
        This follows the SSOT logic from MarketDataService.get_whale_feed.
        """
        ticks = IntradayTick.objects.filter(
            symbol=symbol,
            trade_date=trade_date
        ).order_by('trade_time', 'id')
        
        if not ticks.exists():
            return [], 'no_data'
            
        advisories = []
        seen_keys = set()
        
        for tick in ticks:
            matched_value = float(tick.price) * float(tick.volume)
            if matched_value >= threshold_vnd:
                # Deduplication key like in MarketDataService
                t_key = (tick.trade_time.isoformat(), float(tick.price), float(tick.volume), tick.side)
                if t_key in seen_keys:
                    continue
                seen_keys.add(t_key)
                
                # Simple intensity calculation
                intensity = WhaleSignalEngine.calculate_whale_intensity(matched_value, threshold_vnd)
                
                advisory = WhaleAdvisory(
                    user=user,
                    symbol=symbol,
                    matched_value=int(matched_value),
                    side=tick.side,
                    threshold=threshold_vnd,
                    whale_intensity=intensity,
                    ai_summary=f"Historical whale signal ({tick.side}) detected at {tick.trade_time}.",
                    ai_detail="Recomputed from historical intraday ticks.",
                    created_at=timezone.make_aware(datetime.combine(trade_date, tick.trade_time)),
                    is_auto_generated=True,
                    source=WhaleAdvisory.SourceChoices.PERIODIC_JOB
                )
                advisories.append(advisory)
                
        status = 'zero_count' if not advisories else 'found'
        return advisories, status

class WhaleBackfillService:
    @classmethod
    def execute_backfill_job(cls, job_id, task_id):
        """
        Chunked execution of a backfill job.
        Params: symbols (list), start_date, end_date, user_id (optional)
        """
        try:
            job = WhaleServiceJob.objects.get(id=job_id)
        except WhaleServiceJob.DoesNotExist:
            return False

        # 1. Start Job
        started, msg = WhaleJobManager.start_job(job.id, task_id)
        if not started:
            logger.warning(f"Job {job_id} could not start: {msg}")
            return False

        params = job.params
        symbols = params.get('symbols', [])
        start_date_str = params.get('start_date')
        end_date_str = params.get('end_date')
        user_id = params.get('user_id')
        
        user = None
        if user_id:
            from django.contrib.auth.models import User
            user = User.objects.filter(id=user_id).first()

        # Parse dates
        try:
            d_start = date.fromisoformat(start_date_str)
            d_end = date.fromisoformat(end_date_str)
        except (ValueError, TypeError):
            WhaleJobManager.finish_job(job.id, task_id, WhaleServiceJob.StatusChoices.FAILED, "Invalid date format")
            return False

        # Generate work items
        work_items = []
        curr = d_start
        while curr <= d_end:
            for sym in symbols:
                work_items.append((sym, curr))
            curr += timedelta(days=1)

        total = len(work_items)
        WhaleJobManager.update_progress(job.id, 0, processed=0, total=total)

        processed_count = 0
        failed_count = 0
        
        # Determine thresholds map if user context provided
        threshold_map = {}
        if user:
            threshold_map = WhaleSignalEngine.get_user_threshold_map(user, symbols)
        else:
            # Fallback to system default 500M
            threshold_map = {s: 500_000_000.0 for s in symbols}

        # 2. Execution loop
        for sym, t_date in work_items:
            # Check for cancellation or heartbeat
            if not WhaleJobManager.heartbeat(job.id, task_id):
                # Lock lost or job cancelled?
                break
                
            try:
                threshold_vnd = threshold_map.get(sym, 500_000_000.0)
                
                with transaction.atomic():
                    # a. Clear existing for this specific scope to avoid duplicates on re-run
                    # Only clear if it was auto-generated for this specific user/date/symbol
                    WhaleAdvisory.objects.filter(
                        symbol=sym,
                        user=user,
                        created_at__date=t_date,
                        is_auto_generated=True
                    ).delete()
                    
                    # b. Compute
                    advisories, status = WhaleComputeEngine.compute_for_symbol_date(sym, t_date, threshold_vnd, user=user)
                    
                    # c. Bulk Create
                    if advisories:
                        WhaleAdvisory.objects.bulk_create(advisories)
                
                processed_count += 1
            except Exception as e:
                logger.exception(f"Error processing {sym} on {t_date}")
                failed_count += 1
                job.log = (job.log + f"\nError {sym} {t_date}: {str(e)}").strip()
                job.save(update_fields=['log'])

            # Update progress every chunk or periodically
            progress = (processed_count + failed_count) / total * 100
            WhaleJobManager.update_progress(job.id, progress, processed=processed_count, failed=failed_count)

        # 3. Finish
        final_status = WhaleServiceJob.StatusChoices.COMPLETED if failed_count == 0 else WhaleServiceJob.StatusChoices.PARTIAL
        if processed_count == 0 and total > 0 and failed_count == 0:
             # Maybe all heartbeat failures?
             final_status = WhaleServiceJob.StatusChoices.FAILED
             
        WhaleJobManager.finish_job(job.id, task_id, final_status, f"Processed {processed_count}/{total} items.")
        return True
