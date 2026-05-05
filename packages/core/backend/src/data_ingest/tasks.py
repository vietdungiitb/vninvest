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
    Phase 3+ will switch to direct vnstock adapter call.

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

        # Delegate to materializer for now (legacy sync path).
        from market_serving.materializers import _fetch_from_legacy, _get_legacy_db_url

        legacy_url = _get_legacy_db_url()
        if not legacy_url:
            if run:
                run.state = IngestRun.StateChoices.SKIPPED
                run.error_message = 'LEGACY_DATABASE_URL not configured'
                run.finished_at = now()
                run.save(update_fields=['state', 'error_message', 'finished_at'])
            return {'status': 'skipped', 'reason': 'no_legacy_db_url'}

        rows = _fetch_from_legacy(
            """
            SELECT
                tsc.symbol,
                tsc.close_price,
                COALESCE(tsc.volume, 0),
                COALESCE(tsc.change_pct, 0),
                COALESCE(tsc.change_value, 0),
                tsc.session_date,
                tsc.captured_at
            FROM portfolio_tickersessionclose tsc
            WHERE tsc.session_date = (
                SELECT MAX(inner_tsc.session_date)
                FROM portfolio_tickersessionclose inner_tsc
            )
            ORDER BY tsc.symbol
            LIMIT 1000
            """,
        )

        count = 0
        for row in rows:
            symbol, close_price, volume, change_pct, change_value, session_date, captured_at = row
            SymbolSnapshot.objects.update_or_create(
                symbol=symbol,
                session_date=session_date,
                defaults={
                    'price': close_price,
                    'price_change': change_value,
                    'price_change_pct': change_pct,
                    'volume': volume,
                    'fetched_at': captured_at or now(),
                    'stale': False,
                    'source': 'data_ingest',
                    'market_status': 'closed',
                },
            )
            count += 1

        if run:
            run.state = IngestRun.StateChoices.SUCCESS
            run.rows_upserted = count
            run.finished_at = now()
            run.save(update_fields=['state', 'rows_upserted', 'finished_at'])

        logger.info("fetch_and_upsert_price_board: upserted %d rows.", count)
        return {'status': 'ok', 'upserted': count}

    except Exception as exc:
        logger.error("fetch_and_upsert_price_board failed: %s", exc)
        if run:
            run.state = IngestRun.StateChoices.FAILED
            run.error_message = str(exc)[:500]
            run.finished_at = now()
            run.save(update_fields=['state', 'error_message', 'finished_at'])
        raise self.retry(exc=exc)
