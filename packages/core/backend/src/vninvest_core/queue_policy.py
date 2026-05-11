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
    'market_serving_realtime': {
        'queue': 'realtime_prefetch',
        'task_routes': (
            'market_serving.materializers.materialize_symbol_snapshot',
            'market_serving.materializers.materialize_session_facts',
        ),
        'periodic_tasks': (
            'materialize-symbol-snapshot-60s',
            'materialize-session-facts-5m',
            'materialize-symbol-snapshot-30s',
            'materialize-bucket-facts-5m',
        ),
    },
    'market_serving_analytics': {
        'queue': 'analytics_heavy',
        'task_routes': (
            'market_serving.materializers.materialize_unified_alerts',
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
        ),
        'periodic_tasks': (
            'enrich_history_bars',
            'enrich_fundamentals',
        ),
    },
    'manual_operations': {
        'queue': 'manual_on_demand',
        'task_routes': (
            'manual_*',
        ),
        'periodic_tasks': (
            'manual_refresh_task',
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
