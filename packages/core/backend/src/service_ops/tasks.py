"""Celery tasks for SOC health checks and tracked operator-triggered workflows."""

from __future__ import annotations

import logging
from datetime import timedelta
from time import perf_counter

from celery import current_app, shared_task
from django.utils import timezone

from market_data.global_symbol_planner import create_global_planner_run
from market_data.vnbroker_adapter import fetch_price_board_snapshot, fetch_symbol_group_members
from market_serving.materializers import materialize_session_facts
from signal_intelligence.materializers import materialize_unified_alerts, materialize_whale_feed_aggregate
from signal_intelligence.models import OrderFlowEvent, UnifiedAlert

from .dataops_market_data import (
    build_market_data_observability_summary,
    cleanup_market_data_parity_snapshots,
    QUEUE_TIER_ORDER,
    build_market_data_parity_snapshot,
    count_market_data_queue_tier_symbols,
    ensure_market_data_system_default_baseline,
    get_market_data_queue_tier_config,
    get_market_data_queue_tier_datasets,
    get_market_data_queue_tier_execution_queue,
    get_market_data_runtime_config,
    persist_market_data_parity_snapshot,
    select_market_data_queue_tier_symbols,
)
from .matrix_coordinator import MatrixCoordinator, normalize_provider_list, normalize_symbol_group_ids
from .models import ScrapeMatrix, ServiceConfig, ServiceDefinition, ServiceHealth, ServiceHealthCheckLog, ServiceRunLog
from signal_intelligence.models import UnifiedAlert
from .registry import SOC_DOMAIN_PRIMARY_SERVICE_KEYS, ensure_service_registry, get_registered_service


logger = logging.getLogger(__name__)

QUEUE_TIER_STALE_INFLIGHT_MULTIPLIER = 6
QUEUE_TIER_STALE_INFLIGHT_MIN_SECONDS = 900
# Increased from 60 → 300s: tasks sitting in a backlogged queue easily exceed 60s before
# being prefetched by a worker. At 60s the recover monitor falsely marked them as orphans,
# creating a cascade of 21k+ zombie tasks. 300s gives enough time for the queue to drain.
QUEUE_TIER_ORPHAN_GRACE_SECONDS = 300
# After an orphan-recovery event, wait at least this many seconds before dispatching again
# to avoid immediately re-queuing into a still-backlogged queue.
QUEUE_TIER_RECOVERY_COOLDOWN_SECONDS = 120
# Maximum number of pending tasks in a target queue before the scheduler skips dispatching
# to that queue. Prevents unbounded queue growth when workers can't keep up.
REALTIME_PREFETCH_MAX_QUEUE_DEPTH = 20
STRICT_FRESH_MODE_QUEUE_TIERS = {
    'hot_user_demand',
    'warm_liquid_market',
}


try:
    from httpx import get as _httpx_get, ConnectError, TimeoutException
except ImportError:
    _httpx_get = None
    ConnectError = ConnectionError
    TimeoutException = TimeoutError


CONSECUTIVE_FAILURE_COUNTER: dict[str, int] = {}
PROBE_TIMEOUT_SECONDS = 8  # fallback; real timeout is settings.SOC_HEALTH_PROBE_TIMEOUT_SECONDS (COC-56)


def _get_service_endpoint(service: ServiceDefinition) -> str | None:
    """Resolve the external endpoint for a service based on its domain/service_key.

    COC-56: reads SOC_HEALTH_ENDPOINTS env JSON (via settings) so operators can
    configure real HTTP probes per domain or per service_key without code change.
    Example: {"vnbroker":"http://vnbroker:8080/health","vnbroker_quote":"http://..."}
    Empty map = no HTTP probe (DB-only, keeps dev/Test green).
    """
    try:
        from django.conf import settings
        raw = getattr(settings, "SOC_HEALTH_ENDPOINTS", {}) or {}
        if isinstance(raw, dict):
            # per service_key wins over per domain
            ep = raw.get(service.service_key) or raw.get(service.domain)
            if ep:
                return str(ep).strip() or None
        # fallback: direct env JSON (when settings not yet loaded in tests)
        import json as _j
        import os as _os
        env_raw = _os.environ.get("SOC_HEALTH_ENDPOINTS", "")
        if env_raw:
            try:
                env_map = _j.loads(env_raw)
                if isinstance(env_map, dict):
                    ep = env_map.get(service.service_key) or env_map.get(service.domain)
                    if ep:
                        return str(ep).strip() or None
            except _j.JSONDecodeError:
                pass
    except Exception:
        pass
    return None


def _probe_service_health(service: ServiceDefinition) -> dict:
    started = perf_counter()
    detail = {
        'source': 'service_ops.tasks',
        'domain': service.domain,
        'service_key': service.service_key,
    }

    degraded_reasons: list[str] = []

    if service.domain == 'signals':
        detail['active_alerts'] = UnifiedAlert.objects.count()
        detail['order_flow_events'] = OrderFlowEvent.objects.count()
    elif service.domain == 'matrix':
        detail['active_cycles'] = ScrapeMatrix.objects.filter(status='active').count()
    else:
        detail['has_current_config'] = ServiceConfig.objects.filter(service=service, is_current=True).exists()

    endpoint = _get_service_endpoint(service)
    if endpoint:
        try:
            # COC-56: timeout via settings, fallback to PROBE_TIMEOUT_SECONDS
            try:
                from django.conf import settings as _probe_settings
                _timeout = int(getattr(_probe_settings, "SOC_HEALTH_PROBE_TIMEOUT_SECONDS", PROBE_TIMEOUT_SECONDS) or PROBE_TIMEOUT_SECONDS)
            except Exception:
                _timeout = PROBE_TIMEOUT_SECONDS
            if _httpx_get is not None:
                resp = _httpx_get(endpoint, timeout=_timeout)
                detail['endpoint_status'] = resp.status_code
                if resp.status_code >= 500:
                    degraded_reasons.append(f'endpoint returned {resp.status_code}')
            else:
                detail['endpoint_status'] = 'skipped-no-httpx'
        except (ConnectError, TimeoutException):
            detail['endpoint_status'] = 'unreachable'
            degraded_reasons.append('endpoint unreachable')
        except Exception as exc:
            detail['endpoint_status'] = f'error: {exc}'
            degraded_reasons.append(f'endpoint probe error: {exc}')

    detail['degraded_reasons'] = degraded_reasons

    service_key = service.service_key
    if degraded_reasons:
        CONSECUTIVE_FAILURE_COUNTER[service_key] = CONSECUTIVE_FAILURE_COUNTER.get(service_key, 0) + 1
    else:
        CONSECUTIVE_FAILURE_COUNTER.pop(service_key, None)

    consecutive = CONSECUTIVE_FAILURE_COUNTER.get(service_key, 0)
    detail['consecutive_failures'] = consecutive

    if consecutive >= 3:
        status = 'unhealthy'
    elif consecutive >= 1:
        status = 'degraded'
    else:
        status = 'healthy'

    return {
        'status': status,
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


def _build_service_runtime_guardrails() -> tuple[dict[str, int], dict[str, set[str]]]:
    """Build service max runtime thresholds and related scheduler job mappings."""
    from service_ops.scheduler_catalog import CATALOG_JOB_METADATA

    service_to_max_expected_seconds: dict[str, int] = {}
    service_to_job_keys: dict[str, set[str]] = {}

    for job_key, meta in CATALOG_JOB_METADATA.items():
        service_key = str(meta.get('service_key') or '').strip()
        if not service_key:
            continue

        service_to_job_keys.setdefault(service_key, set()).add(job_key)

        raw_max_expected = meta.get('max_expected_run_seconds')
        if raw_max_expected is None:
            continue
        try:
            max_expected_seconds = int(raw_max_expected)
        except (TypeError, ValueError):
            continue
        if max_expected_seconds <= 0:
            continue

        service_to_max_expected_seconds[service_key] = max(
            service_to_max_expected_seconds.get(service_key, 0),
            max_expected_seconds,
        )

    return service_to_max_expected_seconds, service_to_job_keys


@shared_task(bind=True, name='service_ops.reconcile_stale_running_service_run_logs', queue='manual_on_demand')
def reconcile_stale_running_service_run_logs(self, stale_grace_seconds: int = 900):
    """Close stale/orphan running ServiceRunLog entries to prevent status drift."""
    from django.core.cache import cache

    now = timezone.now()
    grace_seconds = max(int(stale_grace_seconds or 0), 60)
    fallback_expected_seconds = 3600
    service_to_max_expected, service_to_job_keys = _build_service_runtime_guardrails()

    examined = 0
    recovered = 0
    recovered_to_success = 0
    recovered_to_failed = 0
    skipped_live = 0

    running_logs = ServiceRunLog.objects.select_related('service').filter(status__in=['queued', 'running'])
    for run_log in running_logs.iterator():
        examined += 1

        service_key = str(getattr(run_log.service, 'service_key', '') or '').strip()
        max_expected_seconds = service_to_max_expected.get(service_key, fallback_expected_seconds)
        started_at = run_log.started_at
        elapsed_seconds = float((now - started_at).total_seconds()) if started_at else float(max_expected_seconds + grace_seconds + 1)
        stale_threshold_seconds = float(max_expected_seconds + grace_seconds)
        if elapsed_seconds < stale_threshold_seconds:
            continue

        celery_task_id = str(run_log.celery_task_id or '').strip()
        task_state = 'UNKNOWN'
        is_live_task: bool | None = None

        if celery_task_id:
            try:
                task_state = str(current_app.AsyncResult(celery_task_id).state or 'UNKNOWN').upper()
            except Exception as exc:
                task_state = f'ERROR:{exc.__class__.__name__}'
            is_live_task = _is_celery_task_live(celery_task_id)

        if is_live_task is True:
            skipped_live += 1
            continue

        next_status = 'failed'
        if task_state == 'SUCCESS':
            next_status = 'success'

        output_summary = dict(run_log.output_summary or {})
        output_summary.update({
            'recovery_action': 'reconcile_stale_running_run_log',
            'recovered_at': now.isoformat(),
            'elapsed_seconds': round(elapsed_seconds, 2),
            'stale_threshold_seconds': round(stale_threshold_seconds, 2),
            'task_state': task_state,
            'service_key': service_key,
        })

        existing_error = str(run_log.error_detail or '').strip()
        recovery_error = (
            f'Auto-recovered stale running log; task_state={task_state}; '
            f'elapsed_seconds={round(elapsed_seconds, 2)}; '
            f'stale_threshold_seconds={round(stale_threshold_seconds, 2)}'
        )

        run_log.status = next_status
        run_log.finished_at = now
        run_log.duration_seconds = max(int(round(elapsed_seconds)), 0)
        run_log.output_summary = output_summary
        run_log.error_detail = f'{existing_error}\n{recovery_error}'.strip() if existing_error else recovery_error
        run_log.save(update_fields=['status', 'finished_at', 'duration_seconds', 'output_summary', 'error_detail'])

        for job_key in service_to_job_keys.get(service_key, set()):
            cache.delete(f'scheduler:inflight:{job_key}')

        recovered += 1
        if next_status == 'success':
            recovered_to_success += 1
        else:
            recovered_to_failed += 1

    logger.info(
        'reconcile_stale_running_service_run_logs completed examined=%s recovered=%s success=%s failed=%s skipped_live=%s',
        examined,
        recovered,
        recovered_to_success,
        recovered_to_failed,
        skipped_live,
    )
    return {
        'examined': examined,
        'recovered': recovered,
        'recovered_to_success': recovered_to_success,
        'recovered_to_failed': recovered_to_failed,
        'skipped_live': skipped_live,
        'stale_grace_seconds': grace_seconds,
    }


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


def _compute_service_slo(service: ServiceDefinition, current_status: str) -> dict:
    """Compute SLO/SLI window stats from ServiceHealthCheckLog history.

    Returns:
        {
            'slo_target': float,              # default 0.999 (99.9%)
            'uptime_30d': float | None,       # success ratio over last 30 days
            'burn_rate_1h': float | None,     # failures per hour vs allowed budget per hour
            'error_budget_remaining': float | None,  # 1 - (failures / allowed)
        }
    """
    try:
        from django.conf import settings as _settings
        slo_target = float(getattr(_settings, 'SOC_SLO_TARGET', 0.999) or 0.999)
    except Exception:
        slo_target = 0.999

    now = timezone.now()
    window_days = 30
    cutoff = now - timedelta(days=window_days)

    # 30-day window
    uptime_30d = None
    logs_30d = (ServiceHealthCheckLog.objects
                .filter(service=service, checked_at__gte=cutoff)
                .order_by('checked_at'))
    total_30d = logs_30d.count()
    if total_30d:
        ok_30d = logs_30d.exclude(status__in=['healthy', 'degraded']).count()
        healthy_count = logs_30d.filter(status='healthy').count()
        # degraded counts toward SLI success (service responsive); healthy strictly
        success_30d = healthy_count
        total_probing = total_30d - logs_30d.filter(status='maintenance').count()
        if total_probing:
            uptime_30d = round(success_30d / total_probing, 6)

    # 1-hour burn rate: budget consumed by failures in last hour vs allowed per hour
    burn_rate_1h = None
    error_budget_remaining = None
    hour_cutoff = now - timedelta(hours=1)
    logs_1h = (ServiceHealthCheckLog.objects
               .filter(service=service, checked_at__gte=hour_cutoff)
               .exclude(status__in=['maintenance', 'unknown']))
    total_1h = logs_1h.count()
    if total_1h:
        failed_1h = logs_1h.exclude(status='healthy').count()
        allowed_failures_per_hour = max(1 - slo_target, 1e-9)
        # normalize by observed sample rate so sparse checks don't inflate
        observed_per_hour = logs_30d.count() / max(window_days * 24, 1.0) if logs_30d.count() else 1.0
        sample_rate = max(observed_per_hour, 1.0)
        expected_failures_per_hour = allowed_failures_per_hour * sample_rate
        burn_rate_1h = round(failed_1h / max(expected_failures_per_hour, 1e-9), 6)
        error_budget_remaining = round(1.0 - (failed_1h / max(total_1h, 1)), 6)

    return {
        'slo_target': slo_target,
        'uptime_30d': uptime_30d,
        'burn_rate_1h': burn_rate_1h,
        'error_budget_remaining': error_budget_remaining,
    }


def _upsert_service_health_alert(service_key: str, old_status: str, new_status: str, health_data: dict) -> dict:
    """Create a UnifiedAlert on status degradation; dedup via source_ref + SOC_ALERT_COOLDOWN_HOURS."""
    from django.conf import settings as _settings

    now_value = timezone.now()
    cooldown_hours = int(getattr(_settings, 'SOC_ALERT_COOLDOWN_HOURS', 4) or 4)
    source_ref = f"service_health:{service_key}:{now_value.date().isoformat()}"

    is_degraded = new_status in ('unhealthy', 'degraded') and old_status == 'healthy'
    is_recovery = old_status in ('unhealthy', 'degraded') and new_status == 'healthy'

    if is_recovery:
        UnifiedAlert.objects.filter(source_ref=source_ref, alert_type=UnifiedAlert.AlertTypeChoices.SYSTEM).delete()
        return {'alert_emitted': False, 'alert_source_ref': source_ref, 'reason': 'recovery'}

    if not is_degraded:
        return {'alert_emitted': False, 'alert_source_ref': source_ref, 'reason': 'no_transition'}

    existing = UnifiedAlert.objects.filter(
        source_ref=source_ref,
        alert_type=UnifiedAlert.AlertTypeChoices.SYSTEM,
        triggered_at__gte=now_value - timedelta(hours=cooldown_hours),
    ).first()
    if existing:
        return {'alert_emitted': False, 'alert_source_ref': source_ref, 'reason': 'cooldown'}

    severity = UnifiedAlert.SeverityChoices.HIGH if new_status == 'unhealthy' else UnifiedAlert.SeverityChoices.MEDIUM
    confidence = 0.95 if new_status == 'unhealthy' else 0.85
    body = f"Dịch vụ {service_key} chuyển từ '{old_status}' sang '{new_status}'."

    alert = UnifiedAlert.objects.create(
        alert_type=UnifiedAlert.AlertTypeChoices.SYSTEM,
        symbol=service_key,
        severity=severity,
        confidence=confidence,
        freshness_state='stale',
        title=f"Dịch vụ {service_key} suy giảm sức khỏe",
        body=body,
        value=None,
        direction=UnifiedAlert.DirectionChoices.NEUTRAL,
        session_date=now_value.date(),
        triggered_at=now_value,
        source_ref=source_ref,
        metadata={
            'source': 'service_ops.health_check_all_services',
            'old_status': old_status,
            'new_status': new_status,
            'avg_response_ms': health_data.get('avg_response_ms'),
        },
        evidence=health_data,
    )
    return {'alert_emitted': True, 'alert_source_ref': source_ref, 'alert_id': str(alert.alert_id)}


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
        old_status = existing_health.status if existing_health else 'unknown'
        try:
            probe_result = _probe_service_health(service)
            status_value = probe_result.get('status', 'unknown')
            consecutive_failures = 0 if status_value == 'healthy' else ((existing_health.consecutive_failures if existing_health else 0) + 1)
            last_success_at = timezone.now() if status_value == 'healthy' else (existing_health.last_success_at if existing_health else None)
            ServiceHealthCheckLog.objects.create(
                service=service,
                status=status_value,
                response_ms=probe_result.get('response_ms'),
            )
            slo = _compute_service_slo(service, status_value)
            alert_result = _upsert_service_health_alert(
                service.service_key, old_status, status_value,
                {'avg_response_ms': probe_result.get('response_ms'), 'probe_detail': probe_result.get('detail', {})},
            )
            detail_payload = dict(probe_result.get('detail', {}))
            if alert_result.get('alert_id'):
                detail_payload['last_alert'] = {
                    'id': alert_result['alert_id'],
                    'source_ref': alert_result.get('alert_source_ref', ''),
                    'old_status': old_status,
                    'new_status': status_value,
                    'triggered_at': timezone.now().isoformat(),
                }
            ServiceHealth.objects.update_or_create(
                service=service,
                defaults={
                    'status': status_value,
                    'last_success_at': last_success_at,
                    'consecutive_failures': consecutive_failures,
                    'avg_response_ms': probe_result.get('response_ms'),
                    'detail': detail_payload,
                    'slo_target': slo.get('slo_target'),
                    'uptime_30d': slo.get('uptime_30d'),
                    'burn_rate_1h': slo.get('burn_rate_1h'),
                    'error_budget_remaining': slo.get('error_budget_remaining'),
                },
            )
            status_breakdown[status_value] = status_breakdown.get(status_value, 0) + 1
        except Exception as exc:
            logger.exception('health_check_all_services: probe failed for %s', service.service_key)
            failures = (existing_health.consecutive_failures if existing_health else 0) + 1
            ServiceHealthCheckLog.objects.create(
                service=service,
                status='unhealthy',
                response_ms=None,
            )
            slo = _compute_service_slo(service, 'unhealthy')
            alert_result = _upsert_service_health_alert(
                service.service_key, old_status, 'unhealthy',
                {'avg_response_ms': None, 'probe_error': str(exc)},
            )
            detail_payload = {
                'source': 'service_ops.tasks',
                'service_key': service.service_key,
                'error': str(exc),
            }
            if alert_result.get('alert_id'):
                detail_payload['last_alert'] = {
                    'id': alert_result['alert_id'],
                    'source_ref': alert_result.get('alert_source_ref', ''),
                    'old_status': old_status,
                    'new_status': 'unhealthy',
                    'triggered_at': timezone.now().isoformat(),
                }
            ServiceHealth.objects.update_or_create(
                service=service,
                defaults={
                    'status': 'unhealthy',
                    'last_success_at': existing_health.last_success_at if existing_health else None,
                    'consecutive_failures': failures,
                    'avg_response_ms': None,
                    'detail': detail_payload,
                    'slo_target': slo.get('slo_target'),
                    'uptime_30d': slo.get('uptime_30d'),
                    'burn_rate_1h': slo.get('burn_rate_1h'),
                    'error_budget_remaining': slo.get('error_budget_remaining'),
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


def _get_queue_tier_stale_timeout_seconds(poll_interval_seconds: int) -> int:
    poll_seconds = max(int(poll_interval_seconds or 0), 0)
    return max(
        poll_seconds * QUEUE_TIER_STALE_INFLIGHT_MULTIPLIER,
        QUEUE_TIER_STALE_INFLIGHT_MIN_SECONDS,
    )


def _task_in_redis_queue(task_id: str, queue_names: tuple[str, ...]) -> bool:
    """Scan named Redis queues for a pending task by id.

    Celery inspect only sees tasks that have already been prefetched by a worker
    (active / reserved / scheduled). Tasks sitting in the Redis list waiting to be
    fetched are invisible to inspect. This function fills that gap by scanning the
    raw queue lists for the task UUID string.

    Only safe when queue depths are bounded by the backpressure guard
    (REALTIME_PREFETCH_MAX_QUEUE_DEPTH).
    """
    try:
        import redis as redis_module
        from django.conf import settings

        broker_url = getattr(settings, 'CELERY_BROKER_URL', None) or getattr(settings, 'REDIS_URL', None)
        if not broker_url:
            return False

        client = redis_module.from_url(broker_url)
        task_id_bytes = task_id.encode('ascii', errors='replace')
        for queue_name in queue_names:
            depth = client.llen(queue_name)
            if not depth:
                continue
            messages = client.lrange(queue_name, 0, depth - 1)
            for msg in messages:
                if task_id_bytes in msg:
                    return True
        return False
    except Exception as exc:
        logger.debug('_task_in_redis_queue scan failed for task_id=%s: %s', task_id, exc)
        return False


def _get_redis_queue_depth(queue_name: str) -> int:
    """Return the current number of pending tasks in a Redis Celery queue list."""
    try:
        import redis as redis_module
        from django.conf import settings

        broker_url = getattr(settings, 'CELERY_BROKER_URL', None) or getattr(settings, 'REDIS_URL', None)
        if not broker_url:
            return 0
        # Slice G: timeout ngắn — helper này chạy trong loop scheduler 30s và request
        # observability; Redis ốm không được treo caller hàng chục giây.
        client = redis_module.from_url(
            broker_url, socket_connect_timeout=2, socket_timeout=2)
        return int(client.llen(queue_name) or 0)
    except Exception as exc:
        logger.debug('_get_redis_queue_depth failed for queue=%s: %s', queue_name, exc)
        return 0


def _is_celery_task_live(task_id: str | None) -> bool | None:
    normalized_task_id = str(task_id or '').strip()
    if not normalized_task_id:
        return None

    try:
        from vninvest_core.celery import app as celery_app

        inspect = celery_app.control.inspect(timeout=1.5)
        task_payloads = [inspect.active() or {}, inspect.reserved() or {}, inspect.scheduled() or {}]
        live_task_ids: set[str] = set()

        for payload in task_payloads:
            for worker_tasks in payload.values():
                for task_meta in worker_tasks or []:
                    if not isinstance(task_meta, dict):
                        continue
                    task_value = task_meta.get('id')
                    if not task_value and isinstance(task_meta.get('request'), dict):
                        task_value = task_meta['request'].get('id')
                    if task_value:
                        live_task_ids.add(str(task_value).strip())

        if normalized_task_id in live_task_ids:
            return True

        # Inspect only sees prefetched tasks. If the task is still sitting in the Redis
        # queue waiting to be fetched, it is invisible to inspect but it is alive.
        # Check the raw Redis queue lists before concluding the task is an orphan.
        if _task_in_redis_queue(normalized_task_id, (
            'realtime_prefetch',
            # Slice D (QueueRecovery): queue mới phải có mặt ở đây, nếu không task
            # ở queue mới bị coi là orphan (false-negative). Giữ đồng bộ với QUEUE_NAMES.
            'realtime_scheduler',
            'manual_on_demand',
            'enrichment_offhours',
            # Slice E (QueueRecovery): queue EOD riêng.
            'enrichment_eod',
            'analytics_heavy',
            'celery',
        )):
            return True

        return False
    except Exception as exc:
        logger.debug(
            'queue_tier_scheduler celery inspect failed while checking task_id=%s: %s',
            normalized_task_id,
            exc,
        )
        return None


def _has_inflight_child_run(parent_run_log_id: int) -> bool:
    return ServiceRunLog.objects.filter(
        input_summary__parent_run_log_id=parent_run_log_id,
        status__in={'queued', 'running'},
    ).exists()


def _recover_inflight_child_runs(
    parent_run_log: ServiceRunLog,
    *,
    tier_name: str,
    parent_recovery_action: str,
    elapsed_seconds: float,
    stale_after_seconds: int,
) -> int:
    recovered = 0
    child_run_logs = ServiceRunLog.objects.filter(
        input_summary__parent_run_log_id=parent_run_log.id,
        status__in={'queued', 'running'},
    )
    for child_run_log in child_run_logs:
        recovered_ingest_run_id = _recover_linked_ingest_run(
            child_run_log,
            tier_name=tier_name,
            parent_recovery_action=parent_recovery_action,
        )
        output_summary = dict(child_run_log.output_summary or {})
        output_summary.update({
            'recovery_action': 'queue_tier_parent_recovery_cleanup',
            'parent_run_log_id': parent_run_log.id,
            'parent_recovery_action': parent_recovery_action,
            'queue_tier': tier_name,
            'elapsed_seconds': round(elapsed_seconds, 2),
            'stale_after_seconds': stale_after_seconds,
        })
        if recovered_ingest_run_id is not None:
            output_summary['recovered_ingest_run_id'] = recovered_ingest_run_id
        _mark_run_log_finished(
            child_run_log,
            status_value='failed',
            output_summary=output_summary,
            error_detail=(
                'Auto-recovered inline planner child run because its parent queue-tier run '
                f'was recovered for {tier_name} with action={parent_recovery_action}.'
            ),
        )
        recovered += 1
    return recovered


def _recover_linked_ingest_run(
    child_run_log: ServiceRunLog,
    *,
    tier_name: str,
    parent_recovery_action: str,
) -> int | None:
    ingest_run_id = dict(child_run_log.output_summary or {}).get('ingest_run_id')
    if not ingest_run_id:
        return None

    from data_ingest.models import IngestRun

    ingest_run = IngestRun.objects.filter(pk=ingest_run_id).first()
    if ingest_run is None or ingest_run.state != IngestRun.StateChoices.RUNNING:
        return None

    ingest_run.state = IngestRun.StateChoices.FAILED
    ingest_run.error_message = (
        'Auto-recovered linked ingest run because its planner child run '
        f'was recovered with action={parent_recovery_action} for {tier_name}.'
    )[:500]
    ingest_run.finished_at = timezone.now()
    ingest_run.save(update_fields=['state', 'error_message', 'finished_at'])
    return ingest_run.id


def _recover_stale_queue_tier_run(latest_run: ServiceRunLog, tier_name: str, poll_interval_seconds: int) -> bool:
    if latest_run.status not in {'queued', 'running'} or latest_run.started_at is None:
        return False

    elapsed_seconds = max((timezone.now() - latest_run.started_at).total_seconds(), 0.0)
    stale_after_seconds = _get_queue_tier_stale_timeout_seconds(poll_interval_seconds)
    task_is_live = _is_celery_task_live(latest_run.celery_task_id)
    if task_is_live is True:
        return False

    has_inflight_child_run = _has_inflight_child_run(latest_run.id)
    recovery_action = ''
    error_detail = ''
    if (
        task_is_live is False
        and elapsed_seconds >= QUEUE_TIER_ORPHAN_GRACE_SECONDS
        and not has_inflight_child_run
    ):
        recovery_action = 'queue_tier_missing_worker_task'
        error_detail = (
            'Auto-recovered queue-tier inflight run because its stored celery_task_id '
            f'was not present in any live Celery worker for {tier_name} '
            f'(task_id={latest_run.celery_task_id}).'
        )
    else:
        if elapsed_seconds < stale_after_seconds:
            return False
        recovery_action = 'queue_tier_stale_inflight_recovered'
        error_detail = (
            'Auto-recovered stale queue-tier inflight run after exceeding the scheduler stale timeout '
            f'for {tier_name} (elapsed={elapsed_seconds:.2f}s, stale_after={stale_after_seconds}s).'
        )

    recovered_child_runs = _recover_inflight_child_runs(
        latest_run,
        tier_name=tier_name,
        parent_recovery_action=recovery_action,
        elapsed_seconds=elapsed_seconds,
        stale_after_seconds=stale_after_seconds,
    )

    output_summary = dict(latest_run.output_summary or {})
    output_summary.update({
        'recovery_action': recovery_action,
        'queue_tier': tier_name,
        'elapsed_seconds': round(elapsed_seconds, 2),
        'stale_after_seconds': stale_after_seconds,
        'has_inflight_child_run': has_inflight_child_run,
        'recovered_child_runs': recovered_child_runs,
    })
    _mark_run_log_finished(
        latest_run,
        status_value='failed',
        output_summary=output_summary,
        error_detail=error_detail,
    )
    logger.warning(
        'queue_tier_scheduler recovered inflight run_log_id=%s tier=%s action=%s elapsed=%.2fs stale_after=%ss',
        latest_run.id,
        tier_name,
        recovery_action,
        elapsed_seconds,
        stale_after_seconds,
    )
    return True


def _queue_tier_due(service: ServiceDefinition, tier_name: str, poll_interval_seconds: int) -> tuple[bool, str | None]:
    latest_run = _get_latest_queue_tier_run(service, tier_name)
    if latest_run is None:
        return True, None
    if latest_run.status in {'queued', 'running'}:
        if _recover_stale_queue_tier_run(latest_run, tier_name, poll_interval_seconds):
            # Do NOT dispatch immediately after a recovery — wait for the next beat cycle.
            # Dispatching right away risks sending another task into a still-backlogged queue.
            return False, 'post_recovery_cooldown'
        return False, 'inflight'
    # Apply an extra cooldown window when the last run was recovered as a missing-worker orphan.
    # This prevents the scheduler from hammering the queue right after clearing an orphan.
    recovery_action = dict(latest_run.output_summary or {}).get('recovery_action', '')
    if recovery_action == 'queue_tier_missing_worker_task':
        finished_at = latest_run.finished_at or latest_run.started_at
        if finished_at is not None:
            elapsed_since_recovery = max((timezone.now() - finished_at).total_seconds(), 0.0)
            if elapsed_since_recovery < QUEUE_TIER_RECOVERY_COOLDOWN_SECONDS:
                return False, 'recovery_cooldown'
    elapsed_seconds = max((timezone.now() - latest_run.started_at).total_seconds(), 0.0)
    if elapsed_seconds < max(int(poll_interval_seconds or 0), 0):
        return False, 'cooldown'
    return True, None


@shared_task(bind=True, name='service_ops.run_market_data_queue_tier_scheduler', queue='manual_on_demand')
def run_market_data_queue_tier_scheduler(self):
    ensure_service_registry()
    matrix_service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix'])
    bootstrap = ensure_market_data_system_default_baseline()
    runtime_config, _ = get_market_data_runtime_config()
    parity_snapshot = build_market_data_parity_snapshot(sample_size=100)
    persist_market_data_parity_snapshot(
        service=matrix_service,
        scheduler_task_id=getattr(self.request, 'id', ''),
        parity_snapshot=parity_snapshot,
    )

    dispatches = []
    skipped_tiers = []
    skipped_by_quota_total = 0

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
                'max_dispatch_per_cycle': int(
                    getattr(tier_config, 'max_dispatch_per_cycle', tier_config.max_batch_size)
                    or tier_config.max_batch_size
                ),
                'skipped_by_quota': 0,
            })
            continue

        dispatch_quota = max(
            1,
            min(
                int(getattr(tier_config, 'max_dispatch_per_cycle', tier_config.max_batch_size) or tier_config.max_batch_size),
                int(tier_config.max_batch_size or 1),
            ),
        )
        eligible_symbols = count_market_data_queue_tier_symbols(tier_name)
        symbols = select_market_data_queue_tier_symbols(tier_name, dispatch_quota)
        skipped_by_quota = max(eligible_symbols - len(symbols), 0)
        skipped_by_quota_total += skipped_by_quota

        if not symbols:
            skipped_tiers.append({
                'tier': tier_name,
                'reason': 'no_symbols',
                'poll_interval_seconds': tier_config.poll_interval_seconds,
                'max_batch_size': tier_config.max_batch_size,
                'max_dispatch_per_cycle': dispatch_quota,
                'skipped_by_quota': 0,
            })
            continue

        # Backpressure guard: skip dispatch if the target queue is already backlogged.
        # An unbounded queue causes tasks to sit for minutes/hours before execution,
        # which triggers orphan-recovery and creates a vicious cycle of failed runs.
        planner_queue_name = get_market_data_queue_tier_execution_queue(tier_name)
        queue_depth = _get_redis_queue_depth(planner_queue_name)
        if queue_depth > REALTIME_PREFETCH_MAX_QUEUE_DEPTH:
            logger.warning(
                'queue_tier_scheduler: skipping dispatch for tier=%s — queue=%s depth=%d > max=%d',
                tier_name,
                planner_queue_name,
                queue_depth,
                REALTIME_PREFETCH_MAX_QUEUE_DEPTH,
            )
            skipped_tiers.append({
                'tier': tier_name,
                'reason': 'queue_backpressure',
                'planner_queue': planner_queue_name,
                'queue_depth': queue_depth,
                'max_queue_depth': REALTIME_PREFETCH_MAX_QUEUE_DEPTH,
                'poll_interval_seconds': tier_config.poll_interval_seconds,
                'max_batch_size': tier_config.max_batch_size,
                'max_dispatch_per_cycle': dispatch_quota,
                'skipped_by_quota': 0,
            })
            continue

        if skipped_by_quota > 0:
            skipped_tiers.append({
                'tier': tier_name,
                'reason': 'quota',
                'poll_interval_seconds': tier_config.poll_interval_seconds,
                'max_batch_size': tier_config.max_batch_size,
                'max_dispatch_per_cycle': dispatch_quota,
                'eligible_symbols': eligible_symbols,
                'dispatched_symbols': len(symbols),
                'skipped_by_quota': skipped_by_quota,
            })

        datasets = list(get_market_data_queue_tier_datasets(tier_name))
        planner_queue = get_market_data_queue_tier_execution_queue(tier_name)
        planner_mode = 'strict_fresh' if tier_name in STRICT_FRESH_MODE_QUEUE_TIERS else 'missing_only'
        planner_result = create_global_planner_run(
            symbols=symbols,
            datasets=datasets,
            mode=planner_mode,
            force_refresh=False,
            reason=f'queue_tier_scheduler:{tier_name}',
            execution_mode='async',
            trigger='market_data.queue_tier_scheduler',
            planner_queue=planner_queue,
            extra_input_summary={
                'queue_tier': tier_name,
                'scheduler_task_id': getattr(self.request, 'id', ''),
                'scheduler_task_name': 'service_ops.run_market_data_queue_tier_scheduler',
                'parity_snapshot': parity_snapshot,
                'poll_interval_seconds': tier_config.poll_interval_seconds,
                'max_batch_size': tier_config.max_batch_size,
                'max_dispatch_per_cycle': dispatch_quota,
                'planner_mode': planner_mode,
                'eligible_symbols': eligible_symbols,
                'skipped_by_quota': skipped_by_quota,
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
            'mode': planner_mode,
            'max_dispatch_per_cycle': dispatch_quota,
            'eligible_symbols': eligible_symbols,
            'skipped_by_quota': skipped_by_quota,
        })

    return {
        'bootstrap': bootstrap,
        'evaluated_tiers': len(QUEUE_TIER_ORDER),
        'dispatched_runs': len(dispatches),
        'dispatches': dispatches,
        'skipped_tiers': skipped_tiers,
        'skipped_by_quota': skipped_by_quota_total,
        'scheduler_task_id': getattr(self.request, 'id', ''),
    }


@shared_task(bind=True, name='service_ops.cleanup_market_data_parity_snapshots', queue='manual_on_demand')
def cleanup_market_data_parity_snapshots_task(self):
    ensure_service_registry()
    matrix_service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix'])
    runtime_config, _ = get_market_data_runtime_config()
    task_id = getattr(self.request, 'id', '')

    run_log = ServiceRunLog.objects.create(
        service=matrix_service,
        status='queued',
        input_summary={
            'trigger': 'market_data.parity_snapshot_retention',
            'scheduler_task_id': task_id,
            'retention_days': runtime_config.parity_snapshot_retention_days,
        },
        output_summary={},
    )

    _mark_run_log_running(run_log, task_id)
    try:
        retention_summary = cleanup_market_data_parity_snapshots(
            retention_days=runtime_config.parity_snapshot_retention_days,
        )
        output_summary = {
            **retention_summary,
            'run_log_id': run_log.id,
            'task_name': 'service_ops.cleanup_market_data_parity_snapshots',
        }
        _mark_run_log_finished(
            run_log,
            status_value='success',
            output_summary=output_summary,
        )
        return output_summary
    except Exception as exc:
        logger.exception('cleanup_market_data_parity_snapshots_task failed')
        _mark_run_log_finished(
            run_log,
            status_value='failed',
            error_detail=str(exc),
            output_summary={
                'run_log_id': run_log.id,
                'task_name': 'service_ops.cleanup_market_data_parity_snapshots',
                'retention_days': runtime_config.parity_snapshot_retention_days,
            },
        )
        raise


# ---------------------------------------------------------------------------
# P19 — Retention health anomaly monitor
# ---------------------------------------------------------------------------

def _upsert_retention_health_alert(retention_health: dict) -> dict:
    """Upsert a SYSTEM UnifiedAlert when retention cadence exceeds the staleness threshold."""
    trend = dict(retention_health.get('trend') or {})
    within_staleness_threshold = bool(trend.get('within_staleness_threshold'))
    if within_staleness_threshold:
        return {'alert_emitted': False, 'alert_source_ref': '', 'alert_id': ''}

    now_value = timezone.now()
    symbol = 'VCI'
    source_ref = f"retention_health:{symbol}:{now_value.date().isoformat()}"
    latest_run_age_hours = float(trend.get('latest_run_age_hours') or 0.0)
    threshold_hours = float(trend.get('staleness_threshold_hours') or 0.0)
    severity = (
        UnifiedAlert.SeverityChoices.HIGH
        if latest_run_age_hours >= threshold_hours * 2
        else UnifiedAlert.SeverityChoices.MEDIUM
    )
    confidence = 0.95 if severity == UnifiedAlert.SeverityChoices.HIGH else 0.85
    body = (
        f"Không có lần chạy retention trong {latest_run_age_hours:.2f} giờ, "
        f"vượt ngưỡng {threshold_hours:.2f} giờ."
    )
    alert, _ = UnifiedAlert.objects.update_or_create(
        source_ref=source_ref,
        defaults={
            'alert_type': UnifiedAlert.AlertTypeChoices.SYSTEM,
            'symbol': symbol,
            'severity': severity,
            'confidence': confidence,
            'freshness_state': 'stale',
            'title': 'Retention parity snapshot bị chậm',
            'body': body,
            'value': None,
            'direction': UnifiedAlert.DirectionChoices.NEUTRAL,
            'session_date': now_value.date(),
            'triggered_at': now_value,
            'metadata': {
                'source': 'service_ops.retention_monitor',
                'retention_days': int(retention_health.get('retention_days') or 0),
                'trend': trend,
            },
            'evidence': {
                'source': 'service_ops.retention_monitor',
                'latest_run': retention_health.get('latest_run') or {},
                'history_size': len(retention_health.get('history') or []),
            },
        },
    )
    return {
        'alert_emitted': True,
        'alert_source_ref': source_ref,
        'alert_id': str(alert.alert_id),
    }


@shared_task(name='service_ops.reconcile_beat_schedule_ssot', queue='manual_on_demand', acks_late=True, max_retries=0)
def reconcile_beat_schedule_ssot():
    """
    Beat self-heal: reconcile PeriodicTask with CELERY_BEAT_SCHEDULE every 5m.
    Calls shared logic from beat_reconcile.py (same as repair_beat_schedule command).
    """
    import logging
    from service_ops.beat_reconcile import reconcile_beat_schedule
    logger = logging.getLogger(__name__)
    result = reconcile_beat_schedule(dry_run=False)
    if result["re_enabled"] or result["created"] or result["queue_fixed"]:
        logger.warning("[reconcile_beat_schedule_ssot] Fixed %s", result)
    return result


@shared_task(bind=True, name='service_ops.monitor_market_data_parity_retention_health', queue='manual_on_demand')
def monitor_market_data_parity_retention_health_task(self):
    ensure_service_registry()
    matrix_service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix'])
    task_id = getattr(self.request, 'id', '')

    observability_summary = build_market_data_observability_summary()
    retention_health = dict(observability_summary.get('retention_health') or {})
    alert_result = _upsert_retention_health_alert(retention_health)

    run_log = ServiceRunLog.objects.create(
        service=matrix_service,
        status='queued',
        input_summary={
            'trigger': 'market_data.parity_snapshot_retention_monitor',
            'scheduler_task_id': task_id,
        },
        output_summary={},
    )
    _mark_run_log_running(run_log, task_id)
    output_summary = {
        'retention_health': retention_health,
        'alert_result': alert_result,
        'run_log_id': run_log.id,
        'task_name': 'service_ops.monitor_market_data_parity_retention_health',
    }
    _mark_run_log_finished(run_log, status_value='success', output_summary=output_summary)
    return output_summary


@shared_task(name="service_ops.test_system_broker_connection_task", bind=True, max_retries=0)
def test_system_broker_connection_task(self, provider: str):
    """B2.3: test-connection system credential read-only trong worker.

    Cập nhật SystemBrokerCredential.last_check {ok, latency_ms, at, error} (không secret)
    + is_verified/last_verified_at khi ok. ssi/tcbs → not_supported_yet (Đợt 3).
    """
    from time import perf_counter

    from identity_access.models import SystemBrokerCredential
    from user_workspace.broker import dnse as dnse_schema

    provider = str(provider or '').strip().lower()
    cred = SystemBrokerCredential.objects.filter(provider=provider).first()
    if cred is None:
        return {'ok': False, 'error': 'credential_not_configured'}
    if provider != 'dnse':
        return {'ok': False, 'error': 'not_supported_yet'}

    started = perf_counter()
    result = dnse_schema.test_connection(cred.get_secrets())
    latency_ms = round((perf_counter() - started) * 1000, 1)
    check = {
        'ok': bool(result.get('ok')),
        'latency_ms': latency_ms,
        'at': timezone.now().isoformat(),
        'error': str(result.get('error', ''))[:300],
    }
    cred.last_check = check
    if check['ok']:
        cred.is_verified = True
        cred.last_verified_at = timezone.now()
    else:
        cred.is_verified = False
    cred.save(update_fields=['last_check', 'is_verified', 'last_verified_at', 'updated_at'])
    return {**result, 'latency_ms': latency_ms}