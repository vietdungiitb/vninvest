"""Shared helpers for market-data SSOT queue tiers and runtime config."""

from __future__ import annotations

from collections import defaultdict
from datetime import timedelta
import logging

from django.db.models import Count, Exists, Max, OuterRef, Q
from django.utils import timezone

from market_data.global_symbol_registry import build_system_default_source_ref, sync_system_default_symbol_group
from market_data.models import GlobalSymbolCoverage, GlobalSymbolDemandSource, GlobalSymbolRegistry
from market_data.vnbroker_adapter import fetch_listing_symbols, fetch_symbol_group_members

from .domain_configs import MarketDataRuntimeConfig
from .models import ServiceConfig, ServiceDefinition
from .models import ServiceRunLog
from .registry import SOC_DOMAIN_PRIMARY_SERVICE_KEYS, get_registered_service


logger = logging.getLogger(__name__)


DATAOPS_MARKET_DATA_DOMAIN = 'dataops_market_data'
SYSTEM_DEFAULT_BOOTSTRAP_GROUP_IDS = ('vn30', 'vn100')
SYSTEM_DEFAULT_BOOTSTRAP_LISTING_GROUP_ID = 'listed_market'
LISTING_BOOTSTRAP_PROVIDER_SOURCES = ('KBS', 'VCI', 'DNSE')
QUEUE_TIER_ORDER = (
    'hot_user_demand',
    'warm_liquid_market',
    'cold_full_market',
    'recovery_backlog',
)
QUEUE_TIER_EXECUTION_QUEUES = {
    'hot_user_demand': 'realtime_prefetch',
    'warm_liquid_market': 'realtime_prefetch',
    'cold_full_market': 'enrichment_offhours',
    'recovery_backlog': 'manual_on_demand',
}
QUEUE_TIER_DATASETS = {
    'hot_user_demand': (
        GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
        GlobalSymbolCoverage.DatasetChoices.PRICE_BOARD_SNAPSHOT,
        GlobalSymbolCoverage.DatasetChoices.INTRADAY_TICKS,
        GlobalSymbolCoverage.DatasetChoices.INTRADAY_BARS,
        GlobalSymbolCoverage.DatasetChoices.SESSION_FACTS,
    ),
    'warm_liquid_market': (
        GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
        GlobalSymbolCoverage.DatasetChoices.PRICE_BOARD_SNAPSHOT,
        GlobalSymbolCoverage.DatasetChoices.SESSION_FACTS,
    ),
    'cold_full_market': (
        GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
    ),
    'recovery_backlog': (
        GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
        GlobalSymbolCoverage.DatasetChoices.PRICE_BOARD_SNAPSHOT,
        GlobalSymbolCoverage.DatasetChoices.INTRADAY_TICKS,
        GlobalSymbolCoverage.DatasetChoices.INTRADAY_BARS,
        GlobalSymbolCoverage.DatasetChoices.SESSION_FACTS,
    ),
}

PRIORITY_TIER_TO_QUEUE_TIER = {
    GlobalSymbolRegistry.PriorityTierChoices.HOT: 'hot_user_demand',
    GlobalSymbolRegistry.PriorityTierChoices.WARM: 'warm_liquid_market',
    GlobalSymbolRegistry.PriorityTierChoices.COLD: 'cold_full_market',
    GlobalSymbolRegistry.PriorityTierChoices.RECOVERY: 'recovery_backlog',
}

RECOVERY_COVERAGE_STATES = {'missing', 'partial'}
RECOVERY_FRESHNESS_STATES = {'stale', 'missing', 'error'}
PLANNABLE_FRESHNESS_STATES = {
    GlobalSymbolCoverage.FreshnessChoices.ERROR,
    GlobalSymbolCoverage.FreshnessChoices.MISSING,
    GlobalSymbolCoverage.FreshnessChoices.STALE,
    GlobalSymbolCoverage.FreshnessChoices.UNKNOWN,
}
QUEUE_TIER_STARVATION_MULTIPLIER = 3


def get_market_data_runtime_config() -> tuple[MarketDataRuntimeConfig, object | None]:
    try:
        service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix'])
        current_config = ServiceConfig.objects.filter(service=service, is_current=True).first()
        if current_config and isinstance(current_config.config_payload, dict):
            return MarketDataRuntimeConfig.from_dict(current_config.config_payload), current_config.applied_at
    except (ServiceDefinition.DoesNotExist, ServiceConfig.DoesNotExist):
        pass
    return MarketDataRuntimeConfig(), None


def _select_market_data_bootstrap_listing_symbols() -> tuple[list[str], list[dict[str, object]]]:
    selected_symbols: list[str] = []
    provider_results: list[dict[str, object]] = []

    for source in LISTING_BOOTSTRAP_PROVIDER_SOURCES:
        rows = fetch_listing_symbols(source=source)
        symbols = sorted({str(row.get('symbol') or '').upper().strip() for row in rows if row.get('symbol')})
        provider_results.append({
            'source': source,
            'symbols': len(symbols),
        })
        if len(symbols) > len(selected_symbols):
            selected_symbols = symbols

    return selected_symbols, provider_results


def ensure_market_data_system_default_baseline() -> dict[str, object]:
    active_symbols = GlobalSymbolRegistry.objects.filter(is_active=True).count()
    baseline_source_ref = build_system_default_source_ref(SYSTEM_DEFAULT_BOOTSTRAP_LISTING_GROUP_ID)
    has_listing_baseline = GlobalSymbolDemandSource.objects.filter(
        source_type=GlobalSymbolDemandSource.SourceTypeChoices.SYSTEM_DEFAULT,
        source_ref=baseline_source_ref,
        is_active=True,
    ).exists()

    if active_symbols > 0 and has_listing_baseline:
        return {
            'bootstrapped': False,
            'active_symbols': active_symbols,
            'groups': [],
            'listing_sources': [],
        }

    groups = []
    if active_symbols <= 0:
        for group_id in SYSTEM_DEFAULT_BOOTSTRAP_GROUP_IDS:
            try:
                symbols = fetch_symbol_group_members(group_id)
                sync_system_default_symbol_group(group_id, symbols)
                groups.append({
                    'group_id': group_id,
                    'symbols': len(symbols),
                })
            except Exception as exc:
                logger.exception('Failed to bootstrap market-data system default group %s', group_id)
                groups.append({
                    'group_id': group_id,
                    'symbols': 0,
                    'error': str(exc),
                })

    listing_symbols, provider_results = _select_market_data_bootstrap_listing_symbols()
    if listing_symbols:
        try:
            sync_system_default_symbol_group(
                SYSTEM_DEFAULT_BOOTSTRAP_LISTING_GROUP_ID,
                listing_symbols,
            )
            groups.append({
                'group_id': SYSTEM_DEFAULT_BOOTSTRAP_LISTING_GROUP_ID,
                'symbols': len(listing_symbols),
            })
        except Exception as exc:
            logger.exception(
                'Failed to bootstrap market-data listing baseline %s',
                SYSTEM_DEFAULT_BOOTSTRAP_LISTING_GROUP_ID,
            )
            groups.append({
                'group_id': SYSTEM_DEFAULT_BOOTSTRAP_LISTING_GROUP_ID,
                'symbols': 0,
                'error': str(exc),
            })

    return {
        'bootstrapped': bool(groups),
        'active_symbols': GlobalSymbolRegistry.objects.filter(is_active=True).count(),
        'groups': groups,
        'listing_sources': provider_results,
    }


def resolve_market_data_queue_tier(registry: GlobalSymbolRegistry) -> str:
    mapped_tier = PRIORITY_TIER_TO_QUEUE_TIER.get(
        registry.current_priority_tier,
        'cold_full_market',
    )
    if mapped_tier == 'cold_full_market' and (
        registry.coverage_state_summary in RECOVERY_COVERAGE_STATES
        or registry.freshness_state_summary in RECOVERY_FRESHNESS_STATES
    ):
        return 'recovery_backlog'
    return mapped_tier


def get_market_data_queue_tier_config(config: MarketDataRuntimeConfig, tier_name: str):
    return getattr(config, tier_name)


def get_market_data_queue_tier_execution_queue(tier_name: str) -> str:
    return QUEUE_TIER_EXECUTION_QUEUES.get(tier_name, 'manual_on_demand')


def get_market_data_queue_tier_datasets(tier_name: str) -> tuple[str, ...]:
    return QUEUE_TIER_DATASETS.get(tier_name, QUEUE_TIER_DATASETS['cold_full_market'])


def _get_recovery_queryset_filter() -> Q:
    return (
        Q(current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.RECOVERY)
        | (
            Q(current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.COLD)
            & (
                Q(coverage_state_summary__in=RECOVERY_COVERAGE_STATES)
                | Q(freshness_state_summary__in=RECOVERY_FRESHNESS_STATES)
            )
        )
    )


def build_market_data_queue_tier_queryset(tier_name: str):
    base_queryset = GlobalSymbolRegistry.objects.filter(is_active=True)
    recovery_filter = _get_recovery_queryset_filter()

    if tier_name == 'hot_user_demand':
        return base_queryset.filter(current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.HOT)
    if tier_name == 'warm_liquid_market':
        return base_queryset.filter(current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.WARM)
    if tier_name == 'recovery_backlog':
        return base_queryset.filter(recovery_filter)
    return base_queryset.filter(current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.COLD).exclude(recovery_filter)


def select_market_data_queue_tier_symbols(tier_name: str, limit: int) -> list[str]:
    batch_limit = max(int(limit or 0), 0)
    if batch_limit <= 0:
        return []
    tier_datasets = list(get_market_data_queue_tier_datasets(tier_name))
    coverage_rows = GlobalSymbolCoverage.objects.filter(
        registry=OuterRef('pk'),
        dataset__in=tier_datasets,
    )
    queryset = build_market_data_queue_tier_queryset(tier_name).annotate(
        has_plannable_gap=Exists(
            coverage_rows.filter(freshness_state__in=PLANNABLE_FRESHNESS_STATES)
        ),
        has_any_tier_coverage=Exists(coverage_rows),
    ).order_by(
        '-has_plannable_gap',
        'has_any_tier_coverage',
        '-priority_score',
        '-demand_source_count',
        'last_hydrated_at',
        'symbol',
    )
    return list(queryset.values_list('symbol', flat=True)[:batch_limit])


def count_market_data_queue_tier_symbols(tier_name: str) -> int:
    tier_datasets = list(get_market_data_queue_tier_datasets(tier_name))
    coverage_rows = GlobalSymbolCoverage.objects.filter(
        registry=OuterRef('pk'),
        dataset__in=tier_datasets,
    )
    queryset = build_market_data_queue_tier_queryset(tier_name).annotate(
        has_plannable_gap=Exists(
            coverage_rows.filter(freshness_state__in=PLANNABLE_FRESHNESS_STATES)
        ),
        has_any_tier_coverage=Exists(coverage_rows),
    )
    return queryset.count()


def build_market_data_queue_tier_snapshot(example_limit: int = 5) -> tuple[list[dict], object]:
    config, config_updated_at = get_market_data_runtime_config()
    registries = list(GlobalSymbolRegistry.objects.filter(is_active=True).order_by('symbol'))
    grouped_symbols: dict[str, list[str]] = defaultdict(list)
    for registry in registries:
        grouped_symbols[resolve_market_data_queue_tier(registry)].append(registry.symbol)

    tiers = []
    for tier_name in QUEUE_TIER_ORDER:
        tier_config = get_market_data_queue_tier_config(config, tier_name)
        symbols = grouped_symbols.get(tier_name, [])
        tiers.append({
            'tier': tier_name,
            'symbol_count': len(symbols),
            'poll_interval_seconds': tier_config.poll_interval_seconds,
            'max_batch_size': tier_config.max_batch_size,
            'max_dispatch_per_cycle': int(getattr(tier_config, 'max_dispatch_per_cycle', tier_config.max_batch_size) or tier_config.max_batch_size),
            'examples': symbols[:example_limit],
        })

    latest_registry_update = GlobalSymbolRegistry.objects.filter(is_active=True).aggregate(
        latest=Max('updated_at')
    )['latest']
    updated_at = config_updated_at or latest_registry_update or timezone.now()
    return tiers, updated_at


def _build_market_data_fail_rate_window(*, service: ServiceDefinition, hours: int) -> dict[str, float | int]:
    window_hours = max(int(hours or 0), 1)
    since = timezone.now() - timedelta(hours=window_hours)
    run_logs = ServiceRunLog.objects.filter(
        service=service,
        started_at__gte=since,
    )
    total_runs = run_logs.count()
    failed_runs = run_logs.filter(status='failed').count()
    partial_runs = run_logs.filter(status='partial').count()
    success_runs = run_logs.filter(status='success').count()
    skipped_runs = run_logs.filter(status='skipped').count()
    if total_runs <= 0:
        return {
            'hours': window_hours,
            'total_runs': 0,
            'failed_runs': 0,
            'partial_runs': 0,
            'success_runs': 0,
            'skipped_runs': 0,
            'fail_rate_pct': 0.0,
            'degraded_rate_pct': 0.0,
        }

    return {
        'hours': window_hours,
        'total_runs': total_runs,
        'failed_runs': failed_runs,
        'partial_runs': partial_runs,
        'success_runs': success_runs,
        'skipped_runs': skipped_runs,
        'fail_rate_pct': round((failed_runs / total_runs) * 100.0, 2),
        'degraded_rate_pct': round(((failed_runs + partial_runs) / total_runs) * 100.0, 2),
    }


def _build_daily_parity_gate_direction(delta_pct_points: float) -> str:
    if delta_pct_points > 0:
        return 'up'
    if delta_pct_points < 0:
        return 'down'
    return 'flat'


def _build_daily_parity_gate_window(
    *,
    hours: int,
    sample_size: int = 100,
    end_offset_hours: int = 0,
) -> dict[str, float | int | bool]:
    window_hours = max(int(hours or 0), 1)
    capped_sample_size = max(int(sample_size or 0), 1)
    normalized_end_offset_hours = max(int(end_offset_hours or 0), 0)
    window_end = timezone.now() - timedelta(hours=normalized_end_offset_hours)
    since = window_end - timedelta(hours=window_hours)

    sample_symbols = list(
        GlobalSymbolRegistry.objects.filter(is_active=True)
        .order_by('-priority_score', '-demand_source_count', 'symbol')
        .values_list('symbol', flat=True)[:capped_sample_size]
    )
    if not sample_symbols:
        return {
            'hours': window_hours,
            'sample_size': capped_sample_size,
            'evaluated_symbols': 0,
            'strict_fresh_count': 0,
            'fresh_or_warm_count': 0,
            'strict_fresh_parity': 0.0,
            'fresh_or_warm_parity': 0.0,
            'strict_threshold_pct': 99.0,
            'strict_met': False,
            'relaxed_threshold_pct': 99.0,
            'relaxed_met': False,
            'window_end_offset_hours': normalized_end_offset_hours,
        }

    coverage_rows = GlobalSymbolCoverage.objects.filter(
        registry__symbol__in=sample_symbols,
        dataset=GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
        last_verified_at__gte=since,
    )
    strict_fresh_count = coverage_rows.filter(
        freshness_state=GlobalSymbolCoverage.FreshnessChoices.FRESH,
    ).values('registry_id').distinct().count()
    fresh_or_warm_count = coverage_rows.filter(
        freshness_state__in={
            GlobalSymbolCoverage.FreshnessChoices.FRESH,
            GlobalSymbolCoverage.FreshnessChoices.WARM,
        },
    ).values('registry_id').distinct().count()

    evaluated_symbols = len(sample_symbols)
    strict_fresh_parity = strict_fresh_count / evaluated_symbols
    fresh_or_warm_parity = fresh_or_warm_count / evaluated_symbols

    return {
        'hours': window_hours,
        'sample_size': capped_sample_size,
        'evaluated_symbols': evaluated_symbols,
        'strict_fresh_count': strict_fresh_count,
        'fresh_or_warm_count': fresh_or_warm_count,
        'strict_fresh_parity': round(strict_fresh_parity, 4),
        'fresh_or_warm_parity': round(fresh_or_warm_parity, 4),
        'strict_threshold_pct': 99.0,
        'strict_met': strict_fresh_parity >= 0.99,
        'relaxed_threshold_pct': 99.0,
        'relaxed_met': fresh_or_warm_parity >= 0.99,
        'window_end_offset_hours': normalized_end_offset_hours,
    }


def _build_daily_parity_gate_window_with_trend(*, hours: int, sample_size: int = 100) -> dict[str, object]:
    current_window = _build_daily_parity_gate_window(hours=hours, sample_size=sample_size)
    previous_window = _build_daily_parity_gate_window(
        hours=hours,
        sample_size=sample_size,
        end_offset_hours=hours,
    )

    strict_delta_pct_points = round(
        (float(current_window.get('strict_fresh_parity') or 0.0) - float(previous_window.get('strict_fresh_parity') or 0.0)) * 100.0,
        2,
    )
    relaxed_delta_pct_points = round(
        (float(current_window.get('fresh_or_warm_parity') or 0.0) - float(previous_window.get('fresh_or_warm_parity') or 0.0)) * 100.0,
        2,
    )

    current_window['trend'] = {
        'comparison_hours': int(hours),
        'strict_fresh_delta_pct_points': strict_delta_pct_points,
        'strict_fresh_direction': _build_daily_parity_gate_direction(strict_delta_pct_points),
        'fresh_or_warm_delta_pct_points': relaxed_delta_pct_points,
        'fresh_or_warm_direction': _build_daily_parity_gate_direction(relaxed_delta_pct_points),
        'previous_strict_fresh_parity': float(previous_window.get('strict_fresh_parity') or 0.0),
        'previous_fresh_or_warm_parity': float(previous_window.get('fresh_or_warm_parity') or 0.0),
    }
    return current_window


def build_market_data_parity_snapshot(*, sample_size: int = 100) -> dict[str, object]:
    now_value = timezone.now()
    return {
        'captured_at': now_value.isoformat(),
        'window_24h': _build_daily_parity_gate_window_with_trend(hours=24, sample_size=sample_size),
        'window_72h': _build_daily_parity_gate_window_with_trend(hours=72, sample_size=sample_size),
    }


def _build_daily_parity_gate_history(*, hours: int, sample_size: int = 100, points: int = 7) -> list[dict[str, object]]:
    normalized_points = max(int(points or 0), 1)
    history = []
    for index in range(normalized_points):
        end_offset_hours = int(hours) * index
        window_data = _build_daily_parity_gate_window(
            hours=hours,
            sample_size=sample_size,
            end_offset_hours=end_offset_hours,
        )
        history.append({
            'sequence': index,
            'end_offset_hours': end_offset_hours,
            'strict_fresh_parity': float(window_data.get('strict_fresh_parity') or 0.0),
            'fresh_or_warm_parity': float(window_data.get('fresh_or_warm_parity') or 0.0),
            'evaluated_symbols': int(window_data.get('evaluated_symbols') or 0),
        })
    return history


def _build_parity_history_from_scheduler_logs(*, window_key: str, points: int = 7) -> list[dict[str, object]]:
    normalized_points = max(int(points or 0), 1)
    run_logs = ServiceRunLog.objects.filter(
        input_summary__trigger='market_data.queue_tier_scheduler',
    ).order_by('-started_at', '-pk')

    history = []
    seen_scheduler_task_ids: set[str] = set()
    for run_log in run_logs:
        input_summary = dict(run_log.input_summary or {})
        parity_snapshot = dict(input_summary.get('parity_snapshot') or {})
        window_payload = dict(parity_snapshot.get(window_key) or {})
        if not window_payload:
            continue

        scheduler_task_id = str(input_summary.get('scheduler_task_id') or '').strip()
        if scheduler_task_id and scheduler_task_id in seen_scheduler_task_ids:
            continue
        if scheduler_task_id:
            seen_scheduler_task_ids.add(scheduler_task_id)

        history.append({
            'sequence': len(history),
            'captured_at': parity_snapshot.get('captured_at') or (run_log.started_at.isoformat() if run_log.started_at else None),
            'end_offset_hours': int(window_payload.get('window_end_offset_hours') or 0),
            'strict_fresh_parity': float(window_payload.get('strict_fresh_parity') or 0.0),
            'fresh_or_warm_parity': float(window_payload.get('fresh_or_warm_parity') or 0.0),
            'evaluated_symbols': int(window_payload.get('evaluated_symbols') or 0),
        })
        if len(history) >= normalized_points:
            break

    return history


def build_market_data_observability_summary() -> dict[str, object]:
    config, _ = get_market_data_runtime_config()
    matrix_service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix'])
    now_value = timezone.now()

    backlog_by_dataset_rows = list(
        GlobalSymbolCoverage.objects.filter(
            registry__is_active=True,
            freshness_state__in=PLANNABLE_FRESHNESS_STATES,
        )
        .values('dataset')
        .annotate(backlog_count=Count('id'))
        .order_by('dataset')
    )
    backlog_by_dataset = [
        {
            'dataset': row['dataset'],
            'backlog_count': int(row['backlog_count'] or 0),
        }
        for row in backlog_by_dataset_rows
    ]

    backlog_by_tier = []
    starvation_indicators = []
    for tier_name in QUEUE_TIER_ORDER:
        tier_config = get_market_data_queue_tier_config(config, tier_name)
        tier_queryset = build_market_data_queue_tier_queryset(tier_name)
        tier_datasets = list(get_market_data_queue_tier_datasets(tier_name))

        plannable_coverage_rows = GlobalSymbolCoverage.objects.filter(
            registry__in=tier_queryset.values('pk'),
            dataset__in=tier_datasets,
            freshness_state__in=PLANNABLE_FRESHNESS_STATES,
        )
        backlog_symbols_count = plannable_coverage_rows.values('registry_id').distinct().count()
        backlog_rows_by_dataset = list(
            plannable_coverage_rows.values('dataset')
            .annotate(backlog_count=Count('id'))
            .order_by('dataset')
        )

        backlog_by_tier.append({
            'tier': tier_name,
            'symbol_count': tier_queryset.count(),
            'backlog_symbols': backlog_symbols_count,
            'datasets': [
                {
                    'dataset': row['dataset'],
                    'backlog_count': int(row['backlog_count'] or 0),
                }
                for row in backlog_rows_by_dataset
            ],
        })

        latest_progress_run = ServiceRunLog.objects.filter(
            service=matrix_service,
            input_summary__trigger='market_data.queue_tier_scheduler',
            input_summary__queue_tier=tier_name,
            status__in={'success', 'partial'},
        ).order_by('-started_at', '-pk').first()

        seconds_since_last_progress = None
        if latest_progress_run is not None and latest_progress_run.started_at is not None:
            seconds_since_last_progress = max(
                int((now_value - latest_progress_run.started_at).total_seconds()),
                0,
            )

        starvation_threshold_seconds = max(
            int(tier_config.poll_interval_seconds or 0) * QUEUE_TIER_STARVATION_MULTIPLIER,
            int(tier_config.poll_interval_seconds or 0),
        )
        is_starved = seconds_since_last_progress is None or seconds_since_last_progress > starvation_threshold_seconds
        starvation_indicators.append({
            'tier': tier_name,
            'is_starved': bool(is_starved),
            'poll_interval_seconds': int(tier_config.poll_interval_seconds or 0),
            'threshold_seconds': int(starvation_threshold_seconds),
            'seconds_since_last_progress': seconds_since_last_progress,
            'latest_progress_started_at': (
                latest_progress_run.started_at.isoformat()
                if latest_progress_run is not None and latest_progress_run.started_at is not None
                else None
            ),
        })

    fail_rates = {
        'window_1h': _build_market_data_fail_rate_window(service=matrix_service, hours=1),
        'window_24h': _build_market_data_fail_rate_window(service=matrix_service, hours=24),
    }
    parity_snapshot = build_market_data_parity_snapshot(sample_size=100)
    parity_gates = {
        'window_24h': dict(parity_snapshot.get('window_24h') or {}),
        'window_72h': dict(parity_snapshot.get('window_72h') or {}),
    }
    persisted_history_24h = _build_parity_history_from_scheduler_logs(window_key='window_24h', points=7)
    persisted_history_72h = _build_parity_history_from_scheduler_logs(window_key='window_72h', points=7)
    parity_history = {
        'window_24h': persisted_history_24h or _build_daily_parity_gate_history(hours=24, sample_size=100, points=7),
        'window_72h': persisted_history_72h or _build_daily_parity_gate_history(hours=72, sample_size=100, points=7),
    }

    return {
        'backlog': {
            'by_dataset': backlog_by_dataset,
            'by_tier': backlog_by_tier,
        },
        'fail_rates': fail_rates,
        'parity_gates': parity_gates,
        'parity_history': parity_history,
        'starvation': starvation_indicators,
        'updated_at': now_value.isoformat(),
    }