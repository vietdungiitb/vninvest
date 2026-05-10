from __future__ import annotations

from django.utils import timezone

from portfolio.models import SignalServiceRun


def create_signal_service_run(
    *,
    service_domain: str,
    run_type: str,
    params_json: dict | None = None,
    created_by_id: int | None = None,
    task_id: str | None = None,
    status: str = SignalServiceRun.StatusChoices.RUNNING,
) -> SignalServiceRun:
    now = timezone.now()
    return SignalServiceRun.objects.create(
        service_domain=service_domain,
        run_type=run_type,
        status=status,
        params_json=params_json or {},
        created_by_id=created_by_id,
        task_id=str(task_id or ''),
        started_at=now if status == SignalServiceRun.StatusChoices.RUNNING else None,
    )


def start_signal_service_run(run: SignalServiceRun, *, task_id: str | None = None) -> SignalServiceRun:
    run.status = SignalServiceRun.StatusChoices.RUNNING
    run.task_id = str(task_id or run.task_id or '')
    if run.started_at is None:
        run.started_at = timezone.now()
    run.save(update_fields=['status', 'task_id', 'started_at', 'updated_at'])
    return run


def finish_signal_service_run(
    run: SignalServiceRun,
    *,
    status: str,
    processed_items: int = 0,
    stored_items: int = 0,
    failed_items: int = 0,
    progress_pct: float = 100.0,
    log: str = '',
) -> SignalServiceRun:
    run.status = status
    run.processed_items = max(int(processed_items or 0), 0)
    run.stored_items = max(int(stored_items or 0), 0)
    run.failed_items = max(int(failed_items or 0), 0)
    run.progress_pct = max(float(progress_pct or 0.0), 0.0)
    if log:
        run.log = str(log)
    run.finished_at = timezone.now()
    if run.started_at is None:
        run.started_at = run.finished_at
    run.save(
        update_fields=[
            'status', 'processed_items', 'stored_items', 'failed_items',
            'progress_pct', 'log', 'finished_at', 'started_at', 'updated_at',
        ]
    )
    return run


def resolve_signal_run_status(*, errors: int, processed_items: int, stored_items: int) -> str:
    normalized_errors = max(int(errors or 0), 0)
    normalized_processed = max(int(processed_items or 0), 0)
    normalized_stored = max(int(stored_items or 0), 0)

    if normalized_errors > 0 and normalized_processed == 0 and normalized_stored == 0:
        return SignalServiceRun.StatusChoices.FAILED
    if normalized_errors > 0:
        return SignalServiceRun.StatusChoices.PARTIAL
    return SignalServiceRun.StatusChoices.COMPLETED


def resolve_signal_run_type(symbol: str | None = None) -> str:
    return SignalServiceRun.RunType.MANUAL if str(symbol or '').strip() else SignalServiceRun.RunType.SCHEDULED
