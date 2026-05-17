from __future__ import annotations

from kombu import Exchange, Queue


QUEUE_NAMES = (
    'celery',
    'realtime_prefetch',
    'realtime_stream',
    'enrichment_offhours',
    'analytics_heavy',
    'manual_on_demand',
)


QUEUE_DOMAIN_MATRIX = {
    'commercial_lifecycle': {
        'queue': 'celery',
        'task_routes': (
            'commercial.tasks.flush_quota_counters',
            'commercial.tasks.generate_monthly_invoices',
            'commercial.tasks.check_overdue_invoices',
            'commercial.tasks.send_quota_warning',
        ),
        'periodic_tasks': (
            'flush-quota-counters',
            'generate-monthly-invoices',
            'check-overdue-invoices',
        ),
    },
    'tenant_lifecycle': {
        'queue': 'celery',
        'task_routes': (
            'tenant_lifecycle.tasks.auto_expire_trials',
            'tenant_lifecycle.tasks.auto_suspend_quota_overflow',
            'tenant_lifecycle.tasks.send_trial_expiry_warning',
            'tenant_lifecycle.tasks.auto_deprovision_stale',
        ),
        'periodic_tasks': (
            'auto-expire-trials',
            'auto-suspend-quota-overflow',
            'send-trial-expiry-warning',
            'auto-deprovision-stale',
        ),
    },
    'market_serving_realtime': {
        'queue': 'realtime_prefetch',
        'task_routes': (
            'market_serving.materializers.materialize_symbol_snapshot',
            'market_serving.materializers.materialize_session_facts',
            # C1: native ingest task
            'data_ingest.tasks.fetch_and_upsert_price_board',
        ),
        'periodic_tasks': (
            'materialize-symbol-snapshot-60s',
            'materialize-session-facts-5m',
            'materialize-symbol-snapshot-30s',
            'materialize-bucket-facts-5m',
            # C1: native ingest — fetch price board every 60s
            'ingest-price-board-60s',
        ),
    },
    'market_serving_analytics': {
        'queue': 'analytics_heavy',
        'task_routes': (
            'market_serving.materializers.materialize_unified_alerts',
            'signal_intelligence.materializers.materialize_unified_alerts',
            'signal_intelligence.materializers.materialize_whale_feed_aggregate',
        ),
        'periodic_tasks': (
            'materialize-unified-alerts-2m',
            'detect_and_store_global_whale_alerts',
            'detect_order_flow',
        ),
    },
    'realtime_stream_ingest': {
        'queue': 'realtime_stream',
        'task_routes': (),
        'periodic_tasks': (
            'run_stream_consumer_batch',
        ),
    },
    'offhours_enrichment': {
        'queue': 'enrichment_offhours',
        'task_routes': (
            'enrich_*',
            'market_serving.materializers.materialize_pre_open_snapshots',
            # Daily OHLCV backfill after market close
            'data_ingest.tasks.backfill_daily_prices',
        ),
        'periodic_tasks': (
            'enrich_history_bars',
            'enrich_fundamentals',
            'materialize-pre-open-snapshots-20m',
            # Daily price backfill at 17:00 ICT (after HOSE close)
            'daily-backfill-prices-1700',
        ),
    },
    'manual_operations': {
        'queue': 'manual_on_demand',
        'task_routes': (
            'manual_*',
            'signal_intelligence.tasks.run_signal_detection_job',
            'service_ops.run_scrape_cycle',
            'service_ops.scrape_cell_task',
            'service_ops.run_market_data_queue_tier_scheduler',
            'service_ops.cleanup_market_data_parity_snapshots',
            'service_ops.monitor_market_data_parity_retention_health',
        ),
        'periodic_tasks': (
            'manual_refresh_task',
            'market-data-queue-tier-scheduler-30s',
            'market-data-parity-snapshot-retention-cleanup-hourly',
            'market-data-parity-retention-health-monitor-2h',
        ),
    },
}


def build_celery_task_queues() -> tuple[Queue, ...]:
    return tuple(
        Queue(queue_name, Exchange(queue_name), routing_key=queue_name)
        for queue_name in QUEUE_NAMES
    )


def build_task_routes() -> dict[str, dict[str, str]]:
    task_routes: dict[str, dict[str, str]] = {}
    for domain in QUEUE_DOMAIN_MATRIX.values():
        queue_name = str(domain['queue'])
        for route_key in domain['task_routes']:
            task_routes[str(route_key)] = {'queue': queue_name}
    return task_routes


def build_scheduler_queue_map() -> dict[str, str]:
    scheduler_queue_map: dict[str, str] = {}
    for domain in QUEUE_DOMAIN_MATRIX.values():
        queue_name = str(domain['queue'])
        for periodic_task_name in domain['periodic_tasks']:
            scheduler_queue_map[str(periodic_task_name)] = queue_name
    return scheduler_queue_map


CELERY_TASK_QUEUES = build_celery_task_queues()
TASK_ROUTES = build_task_routes()
SCHEDULER_QUEUE_MAP = build_scheduler_queue_map()
