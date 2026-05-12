"""
data_ingest Celery tasks.

fetch_and_upsert_price_board: fetches price board data and upserts into market_serving.SymbolSnapshot.
"""
import logging
from datetime import date

from celery import shared_task
from django.utils.timezone import now

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def fetch_and_upsert_price_board(self, job_id: int = None):
    """
    SM-P2.3: Fetch current price board and upsert into SymbolSnapshot.

    Phase 0-2 uses legacy_readonly DB as data source (same as materialize_symbol_snapshot).
    Phase 3+ will switch to direct vnbroker adapter call.

    This task creates an IngestRun record for observability.
    """
    from data_ingest.models import IngestJob, IngestRun
    from market_serving.models import SymbolSnapshot

    job = None
    run = None

    try:
        if job_id:
            try:
                job = IngestJob.objects.get(pk=job_id)
            except IngestJob.DoesNotExist:
                pass

        run = IngestRun.objects.create(
            job=job,
            state=IngestRun.StateChoices.RUNNING,
        ) if job else None

        from market_data.vnbroker_adapter import warm_up_symbols
        from market_data.models import StockProfile

        # SM-P2.3 Native: Fetch price board from vnbroker adapter.
        # We take the top 50 symbols from StockProfile if no specific job/universe is defined.
        symbols = list(StockProfile.objects.filter(status=StockProfile.StatusChoices.ACTIVE).values_list('symbol', flat=True)[:50])

        if not symbols:
            if run:
                run.state = IngestRun.StateChoices.SKIPPED
                run.error_message = 'No active symbols found in StockProfile'
                run.finished_at = now()
                run.save(update_fields=['state', 'error_message', 'finished_at'])
            return {'status': 'skipped', 'reason': 'no_symbols'}

        result = warm_up_symbols(symbols)
        count = result.get('warmed_up_count', 0)

        if run:
            run.state = IngestRun.StateChoices.SUCCESS
            run.rows_upserted = count
            run.finished_at = now()
            run.save(update_fields=['state', 'rows_upserted', 'finished_at'])

        logger.info("fetch_and_upsert_price_board (native): upserted %d rows using %s.", count, result.get('source'))
        return {'status': 'ok', 'upserted': count, 'source': result.get('source')}


    except Exception as exc:
        logger.error("fetch_and_upsert_price_board failed: %s", exc)
        if run:
            run.state = IngestRun.StateChoices.FAILED
            run.error_message = str(exc)[:500]
            run.finished_at = now()
            run.save(update_fields=['state', 'error_message', 'finished_at'])
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=2)
def sync_market_groups(self):
    """
    Native: Đồng bộ danh sách symbol niêm yết từ vnbroker.
    Cập nhật hoặc tạo mới StockProfile.
    """
    from market_data.vnbroker_adapter import fetch_listing_symbols
    from market_data.models import StockProfile
    
    symbols_data = fetch_listing_symbols()
    upserted = 0
    
    for item in symbols_data:
        StockProfile.objects.update_or_create(
            symbol=item['symbol'],
            defaults={
                'exchange': item.get('exchange', 'HOSE'),
                'company_name': item.get('company_name', ''),
                'industry': item.get('industry', ''),
                'status': StockProfile.StatusChoices.ACTIVE,
            }
        )
        upserted += 1
        
    return {'status': 'ok', 'upserted': upserted}
