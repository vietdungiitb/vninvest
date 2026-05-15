"""Celery tasks for SOC health checks and tracked operator-triggered workflows."""

from __future__ import annotations

import logging
from time import perf_counter

from celery import shared_task
from django.utils import timezone

from market_data.global_symbol_planner import create_global_planner_run
from market_data.vnbroker_adapter import fetch_price_board_snapshot, fetch_symbol_group_members
from market_serving.materializers import materialize_session_facts
from signal_intelligence.materializers import materialize_unified_alerts, materialize_whale_feed_aggregate
from signal_intelligence.models import OrderFlowEvent, UnifiedAlert

from .dataops_market_data import (
    QUEUE_TIER_ORDER,
    get_market_data_queue_tier_config,
    get_market_data_queue_tier_datasets,
    get_market_data_queue_tier_execution_queue,
    get_market_data_runtime_config,
    select_market_data_queue_tier_symbols,
)
from .matrix_coordinator import MatrixCoordinator, normalize_provider_list, normalize_symbol_group_ids
from .models import ScrapeMatrix, ServiceConfig, ServiceDefinition, ServiceHealth, ServiceRunLog
from .registry import SOC_DOMAIN_PRIMARY_SERVICE_KEYS, ensure_service_registry, get_registered_service


logger = logging.getLogger(__name__)


def _probe_service_health(service: ServiceDefinition) -> dict:
    started = perf_counter()
    detail = {
        'source': 'service_ops.tasks',
        'domain': service.domain,
        'service_key': service.service_key,
    }

    if service.domain == 'signals':
        detail['active_alerts'] = UnifiedAlert.objects.count()
        detail['order_flow_events'] = OrderFlowEvent.objects.count()
    elif service.domain == 'matrix':
        detail['active_cycles'] = ScrapeMatrix.objects.filter(status='active').count()
    else:
        detail['has_current_config'] = ServiceConfig.objects.filter(service=service, is_current=True).exists()

    return {
        'status': 'healthy',
        'detail': detail,
        'response_ms': round((perf_counter() - started) * 1000.0, 2),
    }


def _mark_run_log_running(run_log: ServiceRunLog, task_id: str | None) -> ServiceRunLog:
    run_log.status = 'running'
    if task_id:
        run_log.celery_task_id = task_id
    run_log.error_detail = ''
    run_log.save(update_fields=['status', 'celery_task_id', 'error_detail'])
    return run_log


def _mark_run_log_finished(
    run_log: ServiceRunLog,
    *,
    status_value: str,
    output_summary: dict | None = None,
    error_detail: str = '',
) -> ServiceRunLog:
    finished_at = timezone.now()
    duration_seconds = None
    if run_log.started_at is not None:
        duration_seconds = max((finished_at - run_log.started_at).total_seconds(), 0.0)

    run_log.status = status_value
    run_log.finished_at = finished_at
    run_log.duration_seconds = duration_seconds
    run_log.output_summary = output_summary or {}
    run_log.error_detail = error_detail
    run_log.save(update_fields=['status', 'finished_at', 'duration_seconds', 'output_summary', 'error_detail'])
    return run_log


def _create_child_run_log(service_key: str, parent_run_log: ServiceRunLog, trigger: str) -> ServiceRunLog:
    service = get_registered_service(service_key)
    return ServiceRunLog.objects.create(
        service=service,
        status='queued',
        input_summary={
            'trigger': trigger,
            'parent_run_log_id': parent_run_log.id,
            'parent_service_key': parent_run_log.service.service_key,
        },
        output_summary={},
    )


def _get_symbols_for_group(symbol_group_id: str, provider: str) -> list[str]:
    group_id = normalize_symbol_group_ids([symbol_group_id])[0]
    source = str(provider or '').strip().upper()
    return fetch_symbol_group_members(group_id, source=source)


def _fetch_symbols_from_provider(symbols: list[str], provider: str) -> dict:
    source = str(provider or '').strip().upper()
    snapshot_rows = fetch_price_board_snapshot(symbols, source=source)
    return {
        'provider': provider,
        'source': source,
        'symbols_requested': len(symbols),
        'rows_fetched': len(snapshot_rows),
        'symbols': [row.get('symbol') for row in snapshot_rows if row.get('symbol')],
    }


@shared_task(bind=True, name='service_ops.health_check_all_services')
def health_check_all_services(self):
    ensure_service_registry()

    checked = 0
    status_breakdown = {
        'healthy': 0,
        'degraded': 0,
        'unhealthy': 0,
        'unknown': 0,
        'maintenance': 0,
    }

    for service in ServiceDefinition.objects.filter(is_active=True).order_by('service_key'):
        existing_health = ServiceHealth.objects.filter(service=service).first()
        try:
            probe_result = _probe_service_health(service)
            status_value = probe_result.get('status', 'unknown')
            consecutive_failures = 0 if status_value == 'healthy' else ((existing_health.consecutive_failures if existing_health else 0) + 1)
            last_success_at = timezone.now() if status_value == 'healthy' else (existing_health.last_success_at if existing_health else None)
            ServiceHealth.objects.update_or_create(
                service=service,
                defaults={
                    'status': status_value,
                    'last_success_at': last_success_at,
                    'consecutive_failures': consecutive_failures,
                    'avg_response_ms': probe_result.get('response_ms'),
                    'detail': probe_result.get('detail', {}),
                },
            )
            status_breakdown[status_value] = status_breakdown.get(status_value, 0) + 1
        except Exception as exc:
            logger.exception('health_check_all_services: probe failed for %s', service.service_key)
            failures = (existing_health.consecutive_failures if existing_health else 0) + 1
            ServiceHealth.objects.update_or_create(
                service=service,
                defaults={
                    'status': 'unhealthy',
                    'last_success_at': existing_health.last_success_at if existing_health else None,
                    'consecutive_failures': failures,
                    'avg_response_ms': None,
                    'detail': {
                        'source': 'service_ops.tasks',
                        'service_key': service.service_key,
                        'error': str(exc),
                    },
                },
            )
            status_breakdown['unhealthy'] += 1
        checked += 1

    return {
        'checked_services': checked,
        'status_breakdown': status_breakdown,
        'task_id': getattr(self.request, 'id', ''),
    }


@shared_task(bind=True, name='service_ops.run_scrape_cycle', queue='manual_on_demand')
def run_scrape_cycle(self, cycle_id: str, symbol_group_ids: list[str], providers: list[str]):
    group_ids = normalize_symbol_group_ids(symbol_group_ids)
    normalized_providers = normalize_provider_list(providers)
    dispatched = []

    for group_id in group_ids:
        for provider in normalized_providers:
            task_result = scrape_cell_task.delay(
                cycle_id=cycle_id,
                symbol_group_id=group_id,
                provider=provider,
                worker_id=getattr(self.request, 'id', '') or f'matrix-dispatch-{cycle_id}',
            )
            dispatched.append({
                'symbol_group_id': group_id,
                'provider': provider,
                'task_id': task_result.id,
            })

    return {
        'cycle_id': cycle_id,
        'dispatched_cells': len(dispatched),
        'dispatches': dispatched,
    }


@shared_task(bind=True, name='service_ops.scrape_cell_task', max_retries=2, default_retry_delay=30, queue='manual_on_demand')
def scrape_cell_task(self, cycle_id: str, symbol_group_id: str, provider: str, worker_id: str):
    coordinator = MatrixCoordinator(cycle_id=cycle_id, providers=[provider])
    if not coordinator.try_claim_cell(symbol_group_id, provider, worker_id):
        return {
            'status': 'skipped',
            'reason': 'Row already done or claimed',
            'cycle_id': cycle_id,
            'symbol_group_id': symbol_group_id,
            'provider': provider,
        }

    try:
        coordinator.mark_cell_working(symbol_group_id, provider, worker_id)
        symbols = _get_symbols_for_group(symbol_group_id, provider)
        fetch_result = _fetch_symbols_from_provider(symbols, provider)
        coordinator.mark_cell_done(
            symbol_group_id,
            provider,
            symbols_processed=fetch_result['rows_fetched'],
        )
        return {
            'status': 'done',
            'cycle_id': cycle_id,
            'symbol_group_id': symbol_group_id,
            'provider': provider,
            'symbols_requested': fetch_result['symbols_requested'],
            'symbols_processed': fetch_result['rows_fetched'],
        }
    except Exception as exc:
        logger.exception(
            'scrape_cell_task failed for cycle=%s group=%s provider=%s',
            cycle_id,
            symbol_group_id,
            provider,
        )
        coordinator.mark_cell_failed(symbol_group_id, provider, str(exc))
        raise self.retry(exc=exc)


@shared_task(bind=True, name='service_ops.run_signal_whale_materialization')
def run_signal_whale_materialization(self, run_log_id: int, symbol: str | None = None):
    run_log = ServiceRunLog.objects.select_related('service').get(pk=run_log_id)
    _mark_run_log_running(run_log, getattr(self.request, 'id', ''))
    try:
        result = materialize_whale_feed_aggregate.run(symbol=symbol)
        _mark_run_log_finished(run_log, status_value='success', output_summary=result)
        return result
    except Exception as exc:
        logger.exception('run_signal_whale_materialization failed for run_log_id=%s', run_log_id)
        _mark_run_log_finished(run_log, status_value='failed', error_detail=str(exc))
        raise


@shared_task(bind=True, name='service_ops.run_signal_unified_alert_materialization')
def run_signal_unified_alert_materialization(self, run_log_id: int):
    run_log = ServiceRunLog.objects.select_related('service').get(pk=run_log_id)
    _mark_run_log_running(run_log, getattr(self.request, 'id', ''))
    try:
        result = materialize_unified_alerts.run()
        _mark_run_log_finished(run_log, status_value='success', output_summary=result)
        return result
    except Exception as exc:
        logger.exception('run_signal_unified_alert_materialization failed for run_log_id=%s', run_log_id)
        _mark_run_log_finished(run_log, status_value='failed', error_detail=str(exc))
        raise


@shared_task(bind=True, name='service_ops.run_signal_session_facts_materialization')
def run_signal_session_facts_materialization(self, run_log_id: int, symbol: str | None = None):
    run_log = ServiceRunLog.objects.select_related('service').get(pk=run_log_id)
    _mark_run_log_running(run_log, getattr(self.request, 'id', ''))
    try:
        result = materialize_session_facts.run(symbol=symbol)
        _mark_run_log_finished(run_log, status_value='success', output_summary=result)
        return result
    except Exception as exc:
        logger.exception('run_signal_session_facts_materialization failed for run_log_id=%s', run_log_id)
        _mark_run_log_finished(run_log, status_value='failed', error_detail=str(exc))
        raise


@shared_task(bind=True, name='service_ops.run_signals_detection_workflow')
def run_signals_detection_workflow(self, run_log_id: int, domain: str = 'all', symbol: str | None = None):
    parent_run_log = ServiceRunLog.objects.select_related('service').get(pk=run_log_id)
    _mark_run_log_running(parent_run_log, getattr(self.request, 'id', ''))

    scheduled_runs = []
    child_results = []

    try:
        if domain in {'all', 'whale'}:
            whale_run_log = _create_child_run_log('signal_whale_canonical_pipeline', parent_run_log, 'signals_materialization_whale')
            scheduled_runs.append({
                'service_key': whale_run_log.service.service_key,
                'run_log_id': whale_run_log.id,
            })
            child_results.append({
                'service_key': whale_run_log.service.service_key,
                'result': run_signal_whale_materialization.run(run_log_id=whale_run_log.id, symbol=symbol),
            })

        if domain in {'all', 'whale', 'session_facts'}:
            session_facts_run_log = _create_child_run_log('signal_session_facts_materializer', parent_run_log, 'signals_materialization_session_facts')
            scheduled_runs.append({
                'service_key': session_facts_run_log.service.service_key,
                'run_log_id': session_facts_run_log.id,
            })
            child_results.append({
                'service_key': session_facts_run_log.service.service_key,
                'result': run_signal_session_facts_materialization.run(run_log_id=session_facts_run_log.id, symbol=symbol),
            })

        if domain in {'all', 'dark_flow'}:
            unified_run_log = _create_child_run_log('signal_unified_alert_materializer', parent_run_log, 'signals_materialization_unified_alerts')
            scheduled_runs.append({
                'service_key': unified_run_log.service.service_key,
                'run_log_id': unified_run_log.id,
            })
            child_results.append({
                'service_key': unified_run_log.service.service_key,
                'result': run_signal_unified_alert_materialization.run(run_log_id=unified_run_log.id),
            })

        workflow_summary = {
            'domain': domain,
            'symbol': symbol,
            'scheduled_runs': scheduled_runs,
            'child_results': child_results,
        }
        _mark_run_log_finished(parent_run_log, status_value='success', output_summary=workflow_summary)
        return workflow_summary
    except Exception as exc:
        logger.exception('run_signals_detection_workflow failed for run_log_id=%s', run_log_id)
        _mark_run_log_finished(parent_run_log, status_value='failed', error_detail=str(exc), output_summary={
            'domain': domain,
            'symbol': symbol,
            'scheduled_runs': scheduled_runs,
        })
        raise


def create_signal_job_run_log(requested_by: str = 'api', domain: str = 'all', symbol: str | None = None) -> ServiceRunLog:
    service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['signals'])
    return ServiceRunLog.objects.create(
        service=service,
        status='queued',
        input_summary={
            'trigger': 'manual_signal_job_run',
            'requested_by': requested_by,
            'domain': domain,
            'symbol': symbol,
        },
        output_summary={},
    )


def _get_latest_queue_tier_run(service: ServiceDefinition, tier_name: str) -> ServiceRunLog | None:
    return ServiceRunLog.objects.filter(
        service=service,
        input_summary__trigger='market_data.queue_tier_scheduler',
        input_summary__queue_tier=tier_name,
    ).order_by('-started_at').first()


def _queue_tier_due(service: ServiceDefinition, tier_name: str, poll_interval_seconds: int) -> tuple[bool, str | None]:
    latest_run = _get_latest_queue_tier_run(service, tier_name)
    if latest_run is None:
        return True, None
    if latest_run.status in {'queued', 'running'}:
        return False, 'inflight'
    elapsed_seconds = max((timezone.now() - latest_run.started_at).total_seconds(), 0.0)
    if elapsed_seconds < max(int(poll_interval_seconds or 0), 0):
        return False, 'cooldown'
    return True, None


@shared_task(bind=True, name='service_ops.run_market_data_queue_tier_scheduler', queue='manual_on_demand')
def run_market_data_queue_tier_scheduler(self):
    ensure_service_registry()
    matrix_service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix'])
    runtime_config, _ = get_market_data_runtime_config()

    dispatches = []
    skipped_tiers = []

    for tier_name in QUEUE_TIER_ORDER:
        tier_config = get_market_data_queue_tier_config(runtime_config, tier_name)
        due, skip_reason = _queue_tier_due(
            matrix_service,
            tier_name,
            tier_config.poll_interval_seconds,
        )
        if not due:
            skipped_tiers.append({
                'tier': tier_name,
                'reason': skip_reason,
                'poll_interval_seconds': tier_config.poll_interval_seconds,
                'max_batch_size': tier_config.max_batch_size,
            })
            continue

        symbols = select_market_data_queue_tier_symbols(tier_name, tier_config.max_batch_size)
        if not symbols:
            skipped_tiers.append({
                'tier': tier_name,
                'reason': 'no_symbols',
                'poll_interval_seconds': tier_config.poll_interval_seconds,
                'max_batch_size': tier_config.max_batch_size,
            })
            continue

        datasets = list(get_market_data_queue_tier_datasets(tier_name))
        planner_queue = get_market_data_queue_tier_execution_queue(tier_name)
        planner_result = create_global_planner_run(
            symbols=symbols,
            datasets=datasets,
            mode='missing_only',
            force_refresh=False,
            reason=f'queue_tier_scheduler:{tier_name}',
            execution_mode='async',
            trigger='market_data.queue_tier_scheduler',
            planner_queue=planner_queue,
            extra_input_summary={
                'queue_tier': tier_name,
                'scheduler_task_id': getattr(self.request, 'id', ''),
                'scheduler_task_name': 'service_ops.run_market_data_queue_tier_scheduler',
                'poll_interval_seconds': tier_config.poll_interval_seconds,
                'max_batch_size': tier_config.max_batch_size,
            },
        )
        dispatches.append({
            'tier': tier_name,
            'symbols': symbols,
            'datasets': datasets,
            'planner_queue': planner_queue,
            'run_id': planner_result.get('run_id'),
            'service_run_log_id': planner_result.get('service_run_log_id'),
            'status': planner_result.get('status'),
        })

    return {
        'evaluated_tiers': len(QUEUE_TIER_ORDER),
        'dispatched_runs': len(dispatches),
        'dispatches': dispatches,
        'skipped_tiers': skipped_tiers,
        'scheduler_task_id': getattr(self.request, 'id', ''),
    }