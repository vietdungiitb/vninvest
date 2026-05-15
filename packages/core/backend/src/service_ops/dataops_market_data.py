"""Shared helpers for market-data SSOT queue tiers and runtime config."""

from __future__ import annotations

from collections import defaultdict

from django.db.models import Max, Q
from django.utils import timezone

from market_data.models import GlobalSymbolCoverage, GlobalSymbolRegistry

from .domain_configs import MarketDataRuntimeConfig
from .models import ServiceConfig, ServiceDefinition
from .registry import SOC_DOMAIN_PRIMARY_SERVICE_KEYS, get_registered_service


DATAOPS_MARKET_DATA_DOMAIN = 'dataops_market_data'
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
    ),
    'warm_liquid_market': (
        GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
        GlobalSymbolCoverage.DatasetChoices.PRICE_BOARD_SNAPSHOT,
    ),
    'cold_full_market': (
        GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
    ),
    'recovery_backlog': (
        GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
        GlobalSymbolCoverage.DatasetChoices.PRICE_BOARD_SNAPSHOT,
        GlobalSymbolCoverage.DatasetChoices.INTRADAY_TICKS,
        GlobalSymbolCoverage.DatasetChoices.INTRADAY_BARS,
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


def get_market_data_runtime_config() -> tuple[MarketDataRuntimeConfig, object | None]:
    try:
        service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix'])
        current_config = ServiceConfig.objects.filter(service=service, is_current=True).first()
        if current_config and isinstance(current_config.config_payload, dict):
            return MarketDataRuntimeConfig.from_dict(current_config.config_payload), current_config.applied_at
    except (ServiceDefinition.DoesNotExist, ServiceConfig.DoesNotExist):
        pass
    return MarketDataRuntimeConfig(), None


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
    queryset = build_market_data_queue_tier_queryset(tier_name).order_by(
        '-priority_score',
        '-demand_source_count',
        'last_hydrated_at',
        'symbol',
    )
    return list(queryset.values_list('symbol', flat=True)[:batch_limit])


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
            'examples': symbols[:example_limit],
        })

    latest_registry_update = GlobalSymbolRegistry.objects.filter(is_active=True).aggregate(
        latest=Max('updated_at')
    )['latest']
    updated_at = config_updated_at or latest_registry_update or timezone.now()
    return tiers, updated_at