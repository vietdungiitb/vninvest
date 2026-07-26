"""
Canonical SOC service registry bootstrap.

Maintains the 23-service baseline required by the SOC replacement spec,
creates domain ownership records, and seeds anchor configs for domain APIs.
"""
from django.db import OperationalError, ProgrammingError, transaction

from .domain_configs import (
    PrefetchTimePolicyConfig,
    ScreenerDomainConfig,
    SignalServicesDomainConfig,
    VnbrokerDomainConfig,
)
from .models import OwnershipRecord, ServiceConfig, ServiceDefinition, ServiceHealth
from .ownership import DEFAULT_DOMAIN_OWNERSHIP


CANONICAL_SOC_SERVICES = (
    {
        'service_key': 'vnbroker_quote',
        'name': 'VNBroker Quote Fetcher',
        'domain': 'vnbroker',
        'description': 'Fetches realtime quote data through the canonical vnbroker adapter.',
        'owner_team': 'core',
        'tags': ['market-data', 'realtime', 'ssot'],
    },
    {
        'service_key': 'dnse_intraday_quarterly_backfill',
        'name': 'DNSE Intraday Quarterly Backfill',
        'domain': 'data_ingest',
        'description': 'Orchestrator: cào 90 ngày tape DNSE, dispatch backfill subtasks.',
        'owner_team': 'dataops',
        'tags': ['market-data', 'intraday', 'backfill'],
    },
    {
        'service_key': 'vnbroker_history',
        'name': 'VNBroker Daily History Fetcher',
        'domain': 'vnbroker',
        'description': 'Fetches daily OHLCV history through the canonical vnbroker adapter.',
        'owner_team': 'core',
        'tags': ['market-data', 'ohlcv', 'history'],
    },
    {
        'service_key': 'vnbroker_intraday_tape',
        'name': 'VNBroker Intraday Tape Fetcher',
        'domain': 'vnbroker',
        'description': 'Fetches intraday tape data through the canonical vnbroker adapter.',
        'owner_team': 'core',
        'tags': ['market-data', 'intraday', 'tape'],
    },
    {
        'service_key': 'vnbroker_price_board',
        'name': 'VNBroker Price Board Snapshot',
        'domain': 'vnbroker',
        'description': 'Fetches multi-symbol price board snapshots through the canonical adapter.',
        'owner_team': 'core',
        'tags': ['market-data', 'snapshot', 'board'],
    },
    {
        'service_key': 'vnbroker_listing_symbols',
        'name': 'VNBroker Listing Symbol Sync',
        'domain': 'vnbroker',
        'description': 'Refreshes the canonical listing symbol universe from vnbroker.',
        'owner_team': 'core',
        'tags': ['market-data', 'universe', 'listing'],
    },
    {
        'service_key': 'prefetch_daily',
        'name': 'Daily Prefetch Orchestrator',
        'domain': 'prefetch',
        'description': 'Runs the default daily prefetch schedule for warm-tier data.',
        'owner_team': 'core',
        'tags': ['prefetch', 'scheduler', 'warm-tier'],
    },
    {
        'service_key': 'prefetch_intraday',
        'name': 'Intraday Prefetch Orchestrator',
        'domain': 'prefetch',
        'description': 'Maintains intraday refresh cadence for active trading sessions.',
        'owner_team': 'core',
        'tags': ['prefetch', 'intraday', 'scheduler'],
    },
    {
        'service_key': 'prefetch_symbol_snapshot',
        'name': 'Symbol Snapshot Warm Cache',
        'domain': 'prefetch',
        'description': 'Warms and refreshes the SymbolSnapshot read model cache.',
        'owner_team': 'core',
        'tags': ['prefetch', 'symbol-snapshot', 'cache'],
    },
    {
        'service_key': 'prefetch_session_facts',
        'name': 'Session Facts Warm Cache',
        'domain': 'prefetch',
        'description': 'Warms and refreshes selected-session facts for the primary read path.',
        'owner_team': 'core',
        'tags': ['prefetch', 'session-facts', 'cache'],
    },
    {
        'service_key': 'signal_whale_detector',
        'name': 'Whale Signal Detector',
        'domain': 'signals',
        'description': 'Evaluates whale flow thresholds for canonical signal detection.',
        'owner_team': 'signal_intelligence',
        'tags': ['signals', 'whale', 'detection'],
    },
    {
        'service_key': 'signal_dark_pool_detector',
        'name': 'Dark Pool Signal Detector',
        'domain': 'signals',
        'description': 'Evaluates dark-pool flow thresholds for canonical signal detection.',
        'owner_team': 'signal_intelligence',
        'tags': ['signals', 'dark-pool', 'detection'],
    },
    {
        'service_key': 'signal_screener_detector',
        'name': 'Screener Signal Detector',
        'domain': 'signals',
        'description': 'Promotes screener matches into canonical signal alerts.',
        'owner_team': 'signal_intelligence',
        'tags': ['signals', 'screener', 'detection'],
    },
    {
        'service_key': 'signal_order_flow_aggregator',
        'name': 'Order Flow Aggregator',
        'domain': 'signals',
        'description': 'Aggregates order flow events into signal-ready buckets.',
        'owner_team': 'signal_intelligence',
        'tags': ['signals', 'order-flow', 'aggregation'],
    },
    {
        'service_key': 'signal_whale_canonical_pipeline',
        'name': 'Whale Canonical Pipeline',
        'domain': 'signals',
        'description': 'Maintains canonical whale event rows for downstream read models.',
        'owner_team': 'signal_intelligence',
        'tags': ['signals', 'canonical', 'pipeline'],
    },
    {
        'service_key': 'signal_unified_alert_materializer',
        'name': 'Unified Alert Materializer',
        'domain': 'signals',
        'description': 'Materializes UnifiedAlert rows from canonical signal events.',
        'owner_team': 'signal_intelligence',
        'tags': ['signals', 'unified-alert', 'materializer'],
    },
    {
        'service_key': 'signal_session_facts_materializer',
        'name': 'Session Facts Materializer',
        'domain': 'signals',
        'description': 'Projects canonical signal data into SessionFacts read models.',
        'owner_team': 'signal_intelligence',
        'tags': ['signals', 'session-facts', 'materializer'],
    },
    {
        'service_key': 'signal_retention_guard',
        'name': 'Signal Retention Guard',
        'domain': 'signals',
        'description': 'Applies lifecycle retention policy for signal storage tiers.',
        'owner_team': 'signal_intelligence',
        'tags': ['signals', 'retention', 'lifecycle'],
    },
    {
        'service_key': 'screener_rule_engine',
        'name': 'Global Screener Rule Engine',
        'domain': 'screener',
        'description': 'Evaluates the canonical screener ruleset against active universes.',
        'owner_team': 'core',
        'tags': ['screener', 'rules', 'engine'],
    },
    {
        'service_key': 'screener_scan_dispatcher',
        'name': 'Screener Scan Dispatcher',
        'domain': 'screener',
        'description': 'Dispatches screener scans to worker queues with tenant-safe batching.',
        'owner_team': 'core',
        'tags': ['screener', 'dispatch', 'worker'],
    },
    {
        'service_key': 'screener_result_publisher',
        'name': 'Screener Result Publisher',
        'domain': 'screener',
        'description': 'Publishes validated screener results to downstream consumers.',
        'owner_team': 'core',
        'tags': ['screener', 'publish', 'redis'],
    },
    {
        'service_key': 'screener_alert_history',
        'name': 'Screener Alert History Store',
        'domain': 'screener',
        'description': 'Stores screener alert history for operator review and audit.',
        'owner_team': 'core',
        'tags': ['screener', 'alerts', 'history'],
    },
    {
        'service_key': 'matrix_cycle_coordinator',
        'name': 'Matrix Cycle Coordinator',
        'domain': 'matrix',
        'description': 'Creates and tracks scrape cycles for the symbol universe matrix.',
        'owner_team': 'core',
        'tags': ['matrix', 'cycle', 'coordinator'],
    },
    {
        'service_key': 'matrix_cell_worker_pool',
        'name': 'Matrix Cell Worker Pool',
        'domain': 'matrix',
        'description': 'Claims and executes matrix cell scrape work across providers.',
        'owner_team': 'core',
        'tags': ['matrix', 'workers', 'providers'],
    },
    # B01 — Scheduler run truth hardening for backfill jobs
    {
        'service_key': 'backfill_daily_prices',
        'name': 'Daily Price Backfill Scheduler',
        'domain': 'dataops',
        'description': 'Backfills 365 days of OHLCV for all active global registry symbols after market close.',
        'owner_team': 'core',
        'tags': ['dataops', 'daily-prices', 'backfill', 'scheduler'],
    },
    {
        'service_key': 'deep_history_bootstrap',
        'name': 'Deep History Bootstrap Scheduler',
        'domain': 'dataops',
        'description': 'Backfills 5 years of OHLCV coverage for all active global registry symbols (weekly).',
        'owner_team': 'core',
        'tags': ['dataops', 'daily-prices', 'deep-history', 'scheduler'],
    },
    {
        'service_key': 'pre5y_history_backfill',
        'name': 'Pre-5Y History Backfill Scheduler',
        'domain': 'dataops',
        'description': 'Backfills OHLCV from market inception to the day before the rolling 5-year window.',
        'owner_team': 'core',
        'tags': ['dataops', 'daily-prices', 'historical', 'scheduler'],
    },
)

REQUIRED_SERVICE_KEYS = frozenset(service['service_key'] for service in CANONICAL_SOC_SERVICES)

SOC_DOMAIN_PRIMARY_SERVICE_KEYS = {
    'vnbroker': 'vnbroker_quote',
    'prefetch': 'prefetch_daily',
    'dataops': 'backfill_daily_prices',
    'signals': 'signal_whale_detector',
    'screener': 'screener_rule_engine',
    'matrix': 'matrix_cycle_coordinator',
}

SERVICE_KEY_ALIASES = {
    'vnbroker_quote': ('vnbroker_adapter', 'vnbroker'),
    'prefetch_daily': ('prefetch_policy', 'prefetch'),
    'signal_whale_detector': ('signal_detection', 'signals'),
    'screener_rule_engine': ('global_screener', 'screener'),
}

DEFAULT_SERVICE_HEALTH = {
    'status': 'unknown',
    'detail': {
        'source': 'service_ops.registry',
        'note': 'Bootstrap baseline. Live probes have not reported yet.',
    },
}


def get_service_lookup_keys(service_key: str) -> tuple[str, ...]:
    return (service_key, *SERVICE_KEY_ALIASES.get(service_key, ()))


def get_registered_service(service_key: str) -> ServiceDefinition:
    for lookup_key in get_service_lookup_keys(service_key):
        service = ServiceDefinition.objects.filter(service_key=lookup_key).first()
        if service is not None:
            return service
    raise ServiceDefinition.DoesNotExist(service_key)


def _build_default_config_payloads() -> dict[str, dict]:
    return {
        SOC_DOMAIN_PRIMARY_SERVICE_KEYS['vnbroker']: VnbrokerDomainConfig().to_dict(),
        SOC_DOMAIN_PRIMARY_SERVICE_KEYS['prefetch']: PrefetchTimePolicyConfig().to_dict(),
        SOC_DOMAIN_PRIMARY_SERVICE_KEYS['signals']: SignalServicesDomainConfig().to_dict(),
        SOC_DOMAIN_PRIMARY_SERVICE_KEYS['screener']: ScreenerDomainConfig().to_dict(),
    }


def _sync_ownership_records() -> int:
    created_count = 0
    for domain, record in DEFAULT_DOMAIN_OWNERSHIP.items():
        defaults = {
            'owner_team': record.get('owner_team', 'core'),
            'write_mode': record.get('mode', 'read-only'),
            'write_surface': record.get('write_surface', ''),
            'locked_fields': record.get('locked_fields', []),
            'compatibility_domains': record.get('compatibility_domains', []),
            'deprecation_notes': record.get('write_block_message', ''),
        }
        ownership, created = OwnershipRecord.objects.get_or_create(
            domain=domain,
            defaults=defaults,
        )
        if created:
            created_count += 1
            continue

        update_fields = []
        for field_name, value in defaults.items():
            if getattr(ownership, field_name) != value:
                setattr(ownership, field_name, value)
                update_fields.append(field_name)
        if update_fields:
            ownership.save(update_fields=update_fields + ['updated_at'])
    return created_count


def sync_service_registry() -> dict[str, int]:
    created_services = 0
    updated_services = 0
    created_health = 0
    created_configs = 0

    with transaction.atomic():
        services_by_key = {}
        for service_data in CANONICAL_SOC_SERVICES:
            service, created = ServiceDefinition.objects.get_or_create(
                service_key=service_data['service_key'],
                defaults={
                    **service_data,
                    'is_active': True,
                    'is_deprecated': False,
                    'deprecation_note': '',
                },
            )
            services_by_key[service.service_key] = service
            if created:
                created_services += 1
            else:
                update_fields = []
                for field_name in (
                    'name',
                    'domain',
                    'description',
                    'owner_team',
                    'tags',
                    'is_active',
                    'is_deprecated',
                    'deprecation_note',
                ):
                    target_value = service_data.get(field_name)
                    if field_name in ('is_active', 'is_deprecated', 'deprecation_note'):
                        target_value = {
                            'is_active': True,
                            'is_deprecated': False,
                            'deprecation_note': '',
                        }[field_name]
                    if getattr(service, field_name) != target_value:
                        setattr(service, field_name, target_value)
                        update_fields.append(field_name)
                if update_fields:
                    service.save(update_fields=update_fields + ['updated_at'])
                    updated_services += 1

            _, health_created = ServiceHealth.objects.get_or_create(
                service=service,
                defaults={
                    'status': DEFAULT_SERVICE_HEALTH['status'],
                    'detail': {
                        **DEFAULT_SERVICE_HEALTH['detail'],
                        'service_key': service.service_key,
                    },
                },
            )
            if health_created:
                created_health += 1

        for service_key, config_payload in _build_default_config_payloads().items():
            lookup_keys = get_service_lookup_keys(service_key)
            has_current_config = ServiceConfig.objects.filter(
                service__service_key__in=lookup_keys,
                is_current=True,
            ).exists()
            if has_current_config:
                continue

            ServiceConfig.objects.create(
                service=services_by_key[service_key],
                config_schema_version='1.0',
                config_payload=config_payload,
                applied_by='system',
                change_reason='Bootstrap default config',
            )
            created_configs += 1

        created_ownership = _sync_ownership_records()

    return {
        'created_services': created_services,
        'updated_services': updated_services,
        'created_health': created_health,
        'created_configs': created_configs,
        'created_ownership': created_ownership,
    }


def ensure_service_registry() -> bool:
    try:
        existing_keys = set(ServiceDefinition.objects.values_list('service_key', flat=True))
        missing_service_keys = REQUIRED_SERVICE_KEYS.difference(existing_keys)
        missing_domains = set(DEFAULT_DOMAIN_OWNERSHIP).difference(
            OwnershipRecord.objects.values_list('domain', flat=True)
        )
        if not missing_service_keys and not missing_domains:
            return False
        sync_service_registry()
        return True
    except (OperationalError, ProgrammingError):
        return False


def bootstrap_service_registry(sender, **kwargs):
    sync_service_registry()