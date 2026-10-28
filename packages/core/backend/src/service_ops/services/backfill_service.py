import logging

from django.utils import timezone

from data_ingest.tasks import backfill_daily_prices

logger = logging.getLogger(__name__)


class BackfillService:
    @staticmethod
    def serialize_run(run) -> dict:
        return {
            'run_id': run.run_id,
            'job_key': run.job_key,
            'mode': run.mode,
            'trigger': run.trigger,
            'status': run.status,
            'requested_days': run.requested_days,
            'planned_symbols_count': run.planned_symbols_count,
            'completed_symbols_count': run.completed_symbols_count,
            'failed_symbols_count': run.failed_symbols_count,
            'inserted_rows': run.inserted_rows,
            'updated_rows': run.updated_rows,
            'skipped_existing_rows': run.skipped_existing_rows,
            'progress_pct': run.progress_pct,
            'started_at': run.started_at.isoformat() if run.started_at else None,
            'finished_at': run.finished_at.isoformat() if run.finished_at else None,
            'duration_seconds': run.duration_seconds,
            'eta_seconds': run.eta_seconds,
            'error_summary': run.error_summary,
            'summary': run.summary,
        }

    @staticmethod
    def serialize_batch(batch) -> dict:
        return {
            'provider': batch.provider,
            'batch_index': batch.batch_index,
            'state': batch.state,
            'symbols_count': batch.symbols_count,
            'completed_symbols_count': batch.completed_symbols_count,
            'inserted_rows': batch.inserted_rows,
            'updated_rows': batch.updated_rows,
            'skipped_existing_rows': batch.skipped_existing_rows,
            'failed_symbols_count': batch.failed_symbols_count,
            'failed_symbols': batch.failed_symbols[:20],
            'latency_p50_ms': batch.latency_p50_ms,
            'latency_p95_ms': batch.latency_p95_ms,
            'started_at': batch.started_at.isoformat() if batch.started_at else None,
            'finished_at': batch.finished_at.isoformat() if batch.finished_at else None,
        }

    @staticmethod
    def trigger_backfill(mode: str, symbols: list = None, days: int = 30) -> dict:
        task_result = backfill_daily_prices.apply_async(
            kwargs={
                'symbols': symbols,
                'days': days,
                'mode': mode,
                'trigger': 'operator_run_now',
            },
        )
        return {
            'status': 'queued',
            'task_id': task_result.id,
            'mode': mode,
            'symbols': symbols,
            'days': days,
            'queued_at': timezone.now().isoformat(),
        }
