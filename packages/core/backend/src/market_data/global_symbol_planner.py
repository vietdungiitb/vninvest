from __future__ import annotations

from datetime import date
from typing import Any

from service_ops.models import ServiceRunLog
from service_ops.registry import ensure_service_registry, get_registered_service

from .global_symbol_coverage import build_global_planner_preview
from .models import GlobalSymbolCoverage

SUPPORTED_EXECUTION_DATASETS = frozenset({
    GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
    GlobalSymbolCoverage.DatasetChoices.PRICE_BOARD_SNAPSHOT,
    GlobalSymbolCoverage.DatasetChoices.INTRADAY_BARS,
    GlobalSymbolCoverage.DatasetChoices.INTRADAY_TICKS,
})
SUPPORTED_EXECUTION_MODES = frozenset({'async', 'sync'})


def _format_run_id(run_log_id: int) -> str:
    return f'md-run-{run_log_id}'


def _normalize_execution_mode(execution_mode: str | None) -> str:
    normalized_mode = str(execution_mode or '').strip().lower() or 'async'
    if normalized_mode not in SUPPORTED_EXECUTION_MODES:
        raise ValueError(f'Execution mode khong ho tro: {execution_mode}')
    return normalized_mode


def _partition_plan_items(plan_items: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    executable_items = []
    unsupported_items = []
    for item in plan_items:
        dataset = str(item.get('dataset') or '').strip().lower()
        if dataset in SUPPORTED_EXECUTION_DATASETS:
            executable_items.append(item)
            continue
        unsupported_items.append(item)
    return executable_items, unsupported_items


def _build_parent_run_log_input(
    *,
    trigger: str,
    mode: str,
    reason: str,
    force_refresh: bool,
    execution_mode: str,
    reference_trade_date: date,
    preview: dict[str, Any],
    planner_queue: str | None = None,
    extra_input_summary: dict[str, Any] | None = None,
) -> dict[str, Any]:
    payload = {
        'trigger': trigger,
        'mode': mode,
        'reason': reason,
        'force_refresh': bool(force_refresh),
        'execution_mode': execution_mode,
        'reference_trade_date': reference_trade_date.isoformat(),
        'plan_items': list(preview.get('items') or []),
        'skipped': list(preview.get('skipped') or []),
        'plan_summary': dict(preview.get('summary') or {}),
    }
    if planner_queue:
        payload['planner_queue'] = planner_queue
    if isinstance(extra_input_summary, dict):
        payload.update(extra_input_summary)
    return payload


def execute_global_planner_run(service_run_log_id: int) -> dict[str, Any]:
    from data_ingest.tasks import fetch_and_upsert_price_board, ingest_daily_prices, warm_intraday_universe
    from service_ops.tasks import _create_child_run_log

    parent_run_log = ServiceRunLog.objects.select_related('service').get(pk=service_run_log_id)
    input_summary = dict(parent_run_log.input_summary or {})
    plan_items = list(input_summary.get('plan_items') or [])
    skipped_items = list(input_summary.get('skipped') or [])
    executable_items, unsupported_items = _partition_plan_items(plan_items)

    summary = {
        'planned_items': len(plan_items),
        'skipped_items': len(skipped_items),
        'inserted': 0,
        'updated': 0,
        'skipped_existing': 0,
        'failed': 0,
        'repaired_conflicts': 0,
    }
    execution_results = []

    if unsupported_items:
        summary['failed'] += len(unsupported_items)

    daily_price_items = [
        item for item in executable_items
        if str(item.get('dataset') or '').strip().lower() == GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES
    ]
    if daily_price_items:
        child_run_log = _create_child_run_log(
            'vnbroker_history',
            parent_run_log,
            'global_market_data_planner_daily_prices',
        )
        result = ingest_daily_prices.run(
            plan_items=daily_price_items,
            service_run_log_id=child_run_log.id,
        )
        summary['inserted'] += int(result.get('inserted') or 0)
        summary['updated'] += int(result.get('updated') or 0)
        summary['skipped_existing'] += int(result.get('skipped_existing') or 0)
        summary['failed'] += int(result.get('failed_count') or 0)
        summary['repaired_conflicts'] += int(result.get('repaired_conflicts') or 0)
        execution_results.append({
            'dataset': GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
            'service_key': child_run_log.service.service_key,
            'run_log_id': child_run_log.id,
            'summary': {
                'planned_items': int(result.get('planned_items') or len(daily_price_items)),
                'inserted': int(result.get('inserted') or 0),
                'updated': int(result.get('updated') or 0),
                'skipped_existing': int(result.get('skipped_existing') or 0),
                'failed': int(result.get('failed_count') or 0),
                'repaired_conflicts': int(result.get('repaired_conflicts') or 0),
            },
        })

    price_board_items = [
        item for item in executable_items
        if str(item.get('dataset') or '').strip().lower() == GlobalSymbolCoverage.DatasetChoices.PRICE_BOARD_SNAPSHOT
    ]
    if price_board_items:
        from data_ingest.models import IngestJob

        price_board_job, _ = IngestJob.objects.get_or_create(
            name='core-price-board-prefetch',
            defaults={
                'source': IngestJob.SourceChoices.VNBROKER_PRICE_BOARD,
                'status': IngestJob.StatusChoices.ACTIVE,
                'schedule_seconds': 60,
                'config': {},
            },
        )
        if price_board_job.source != IngestJob.SourceChoices.VNBROKER_PRICE_BOARD:
            price_board_job.source = IngestJob.SourceChoices.VNBROKER_PRICE_BOARD
            price_board_job.save(update_fields=['source', 'updated_at'])

        child_run_log = _create_child_run_log(
            'vnbroker_price_board',
            parent_run_log,
            'global_market_data_planner_price_board_snapshot',
        )
        result = fetch_and_upsert_price_board.run(
            job_id=price_board_job.id,
            plan_items=price_board_items,
            service_run_log_id=child_run_log.id,
        )
        summary['inserted'] += int(result.get('inserted') or 0)
        summary['updated'] += int(result.get('updated') or 0)
        summary['skipped_existing'] += int(result.get('skipped_existing') or 0)
        summary['failed'] += int(result.get('failed_count') or 0)
        summary['repaired_conflicts'] += int(result.get('repaired_conflicts') or 0)
        execution_results.append({
            'dataset': GlobalSymbolCoverage.DatasetChoices.PRICE_BOARD_SNAPSHOT,
            'service_key': child_run_log.service.service_key,
            'run_log_id': child_run_log.id,
            'summary': {
                'planned_items': int(result.get('planned_items') or len(price_board_items)),
                'inserted': int(result.get('inserted') or 0),
                'updated': int(result.get('updated') or 0),
                'skipped_existing': int(result.get('skipped_existing') or 0),
                'failed': int(result.get('failed_count') or 0),
                'repaired_conflicts': int(result.get('repaired_conflicts') or 0),
            },
        })

    intraday_items = [
        item for item in executable_items
        if str(item.get('dataset') or '').strip().lower() in {
            GlobalSymbolCoverage.DatasetChoices.INTRADAY_BARS,
            GlobalSymbolCoverage.DatasetChoices.INTRADAY_TICKS,
        }
    ]
    if intraday_items:
        child_run_log = _create_child_run_log(
            'vnbroker_intraday_tape',
            parent_run_log,
            'global_market_data_planner_intraday_hydration',
        )
        result = warm_intraday_universe.run(
            plan_items=intraday_items,
            service_run_log_id=child_run_log.id,
        )
        summary['inserted'] += int(result.get('inserted') or 0)
        summary['updated'] += int(result.get('updated') or 0)
        summary['skipped_existing'] += int(result.get('skipped_existing') or 0)
        summary['failed'] += int(result.get('failed_count') or 0)
        summary['repaired_conflicts'] += int(result.get('repaired_conflicts') or 0)

        requested_intraday_datasets = {
            str(item.get('dataset') or '').strip().lower()
            for item in intraday_items
        }
        if GlobalSymbolCoverage.DatasetChoices.INTRADAY_TICKS in requested_intraday_datasets:
            execution_results.append({
                'dataset': GlobalSymbolCoverage.DatasetChoices.INTRADAY_TICKS,
                'service_key': child_run_log.service.service_key,
                'run_log_id': child_run_log.id,
                'summary': dict(result.get('tick_counts') or {}),
            })
        if GlobalSymbolCoverage.DatasetChoices.INTRADAY_BARS in requested_intraday_datasets:
            execution_results.append({
                'dataset': GlobalSymbolCoverage.DatasetChoices.INTRADAY_BARS,
                'service_key': child_run_log.service.service_key,
                'run_log_id': child_run_log.id,
                'summary': dict(result.get('bar_counts') or {}),
            })

    if not plan_items:
        status = 'skipped'
    elif summary['failed'] > 0 and (summary['inserted'] > 0 or summary['updated'] > 0 or summary['skipped_existing'] > 0):
        status = 'partial'
    elif summary['failed'] > 0:
        status = 'failed'
    else:
        status = 'success'

    return {
        'run_id': _format_run_id(parent_run_log.id),
        'status': status,
        'mode': input_summary.get('mode') or 'missing_only',
        'reason': input_summary.get('reason') or 'operator_manual_run',
        'summary': summary,
        'execution_results': execution_results,
        'unsupported_items': unsupported_items,
    }


def create_global_planner_run(
    *,
    symbols: list[str] | tuple[str, ...] | set[str] | None = None,
    datasets: list[str] | tuple[str, ...] | set[str] | None = None,
    mode: str = 'missing_only',
    force_refresh: bool = False,
    reason: str = 'operator_manual_run',
    execution_mode: str = 'async',
    reference_trade_date: date | None = None,
    trigger: str = 'market_data.global_planner.run',
    planner_queue: str | None = None,
    extra_input_summary: dict[str, Any] | None = None,
) -> dict[str, Any]:
    from data_ingest.tasks import run_global_market_data_planner

    ensure_service_registry()
    normalized_execution_mode = _normalize_execution_mode(execution_mode)
    reference_trade_date = reference_trade_date or date.today()
    preview = build_global_planner_preview(
        symbols=symbols,
        datasets=datasets,
        mode=mode,
        force_refresh=force_refresh,
        reason=reason,
        reference_trade_date=reference_trade_date,
    )
    parent_run_log = ServiceRunLog.objects.create(
        service=get_registered_service('matrix_cycle_coordinator'),
        status='queued',
        input_summary=_build_parent_run_log_input(
            trigger=str(trigger or 'market_data.global_planner.run'),
            mode=str(preview.get('mode') or mode),
            reason=str(reason or 'operator_manual_run'),
            force_refresh=force_refresh,
            execution_mode=normalized_execution_mode,
            reference_trade_date=reference_trade_date,
            preview=preview,
            planner_queue=planner_queue,
            extra_input_summary=extra_input_summary,
        ),
        output_summary={},
    )

    base_response = {
        'run_id': _format_run_id(parent_run_log.id),
        'plan_summary': dict(preview.get('summary') or {}),
        'service_run_log_id': parent_run_log.id,
    }

    if normalized_execution_mode == 'sync':
        result = run_global_market_data_planner.run(service_run_log_id=parent_run_log.id)
        return {
            'queued': False,
            'status': result.get('status') or 'success',
            'summary': dict(result.get('summary') or {}),
            **base_response,
        }

    task_kwargs = {'service_run_log_id': parent_run_log.id}
    if planner_queue:
        task = run_global_market_data_planner.apply_async(kwargs=task_kwargs, queue=planner_queue)
    else:
        task = run_global_market_data_planner.apply_async(kwargs=task_kwargs)
    parent_run_log.celery_task_id = task.id
    parent_run_log.save(update_fields=['celery_task_id'])
    return {
        'queued': True,
        'status': 'queued',
        'celery_task_id': task.id,
        **base_response,
    }