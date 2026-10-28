from __future__ import annotations

from kombu import Exchange, Queue

QUEUE_NAMES = (
    'celery',
    'realtime_prefetch',
    # Slice D (QueueRecovery): scheduler heartbeat 3s ra queue riêng để không bao giờ
    # chôn materialize/ingest (77k backlog 2026-09-21). Worker riêng, nhẹ.
    'realtime_scheduler',
    'realtime_stream',
    'enrichment_offhours',
    # Slice E (QueueRecovery, PA1): daily-backfill EOD 17:05 ra worker riêng để marathon
    # cuối tuần (deep-history 8h / pre5y 12h) không bao giờ chặn PENDING.
    'enrichment_eod',
    'analytics_heavy',
    'manual_on_demand',
    # W2: dedicated queue for screener scans — previously shared manual_on_demand
    # where backfill floods (LLEN=7672) starved screener jobs (Entry 81 residual).
    'screener',
)


QUEUE_DOMAIN_MATRIX = {
    'commercial_lifecycle': {
        'queue': 'celery',
        'task_routes': (
            'commercial.tasks.flush_quota_counters',
            'commercial.tasks.generate_monthly_invoices',
            'commercial.tasks.check_overdue_invoices',
            'commercial.tasks.send_quota_warning',
            'commercial.tasks.snapshot_quota_history',
            'commercial.tasks.check_usage_thresholds',
            'commercial.tasks.manage_subscriptions_lifecycle',
            'identity_access.tasks.flush_pat_audit_log',
            'identity_access.tasks.cross_ref_pat_audit_events',
            'identity_access.email_tasks.prune_email_verification_tokens',
            'ops_audit.tasks.aggregate_api_call_rollup',
            # R2.6: probe sức khoẻ deployment + auto-evict / khôi phục.
            'advisory.tasks.probe_deployments_health',
            # R3.1 AC6: retention AITrace (>90 ngày).
            'advisory.tasks.purge_ai_traces',
        ),
        'periodic_tasks': (
            'flush-quota-counters',
            'generate-monthly-invoices',
            'check-overdue-invoices',
            'snapshot-quota-history',
            'check-usage-thresholds',
            'manage-subscriptions-lifecycle-hourly',
            # R2.6 - 5 phút: đủ nhanh để phát hiện provider chết, đủ chậm để
            # không probe lãng phí (AC2 cần 3 lần liên tiếp mới tắt).
            'probe-ai-deployments-health',
            # R3.1 AC6: 24h — retention 90 ngày không cần chính xác từng giờ.
            'purge-ai-traces',
            'prune-email-verification-tokens-hourly',
            'flush-pat-audit-log',
            'cross-ref-pat-audit-events',
            'aggregate-api-call-rollup',
        ),
    },
    'tenant_lifecycle': {
        'queue': 'celery',
        'task_routes': (
            'tenant_lifecycle.tasks.auto_expire_trials',
            'tenant_lifecycle.tasks.auto_suspend_quota_overflow',
            'tenant_lifecycle.tasks.send_trial_expiry_warning',
            'tenant_lifecycle.tasks.auto_deprovision_stale',
            'tenant_lifecycle.tasks.send_trial_expiry_warning_email',
            'data_ingest.tasks.process_outbox_events',
        ),
        'periodic_tasks': (
            'auto-expire-trials',
            'auto-suspend-quota-overflow',
            'send-trial-expiry-warning',
            'auto-deprovision-stale',
            'process-outbox-events-30s',
        ),
    },
    # Slice D (QueueRecovery): tách heartbeat scheduler khỏi materialize/ingest.
    'market_serving_scheduler': {
        'queue': 'realtime_scheduler',
        'task_routes': (
            'market_serving.realtime_prefetch.schedule_realtime_prefetch_shards',
        ),
        'periodic_tasks': (
            'schedule-realtime-prefetch-shards',
        ),
    },
    # Corrective live-measured v4: price-board + snapshot là batch PROVIDER-BOUND chậm
    # (đo live 150-340s/run) — để trên realtime_prefetch chúng chiếm slot của shard nhanh
    # (8-17s). Chuyển sang manual_on_demand (worker rảnh, LLEN=0 thường trực).
    # Session-facts (vài giây) + warm chunk (bounded) + shard ở lại fast lane.
    'market_serving_realtime': {
        'queue': 'realtime_prefetch',
        'task_routes': (
            'market_serving.materializers.materialize_session_facts',
            # C2: native intraday tick hydration — same SSOT universe, persists to IntradayTick
            'data_ingest.tasks.warm_intraday_universe',
        ),
        'periodic_tasks': (
            'materialize-session-facts-5m',
            'materialize-symbol-snapshot-30s',
            'materialize-bucket-facts-5m',
            # C2: native intraday hydrate — today's ticks every 5 minutes
            'warm-intraday-realtime-5m',
        ),
    },
    'market_serving_analytics': {
        'queue': 'analytics_heavy',
        'task_routes': (
            'market_serving.materializers.materialize_unified_alerts',
            'signal_intelligence.materializers.materialize_unified_alerts',
            'signal_intelligence.materializers.materialize_whale_feed_aggregate',
            'signal_intelligence.materializers.materialize_ai_signal_alerts',
        ),
        'periodic_tasks': (
            'materialize-unified-alerts-2m',
            'detect_and_store_global_whale_alerts',
            'detect_order_flow',
            'materialize-ai-signal-alerts-5m',
        ),
    },
    'realtime_stream_ingest': {
        'queue': 'realtime_stream',
        'task_routes': (),
        'periodic_tasks': (
            'run_stream_consumer_batch',
        ),
    },
    # Slice E (QueueRecovery, PA1): daily-backfill EOD tách khỏi marathon cuối tuần.
    # Meta-audit fix (Entry 141B): worker này RẢNH ~23h/ngày nên kiêm slow-batch lane —
    # price-board + snapshot là batch provider-bound chậm (đo live 150-340s/run); để trên
    # manual_on_demand chúng đẩy depth > 20 → backpressure guard skip tier recovery_backlog
    # vĩnh viễn (test_soc_tasks 1 fail live). enrichment_eod không tier nào map làm skip-guard.
    'offhours_eod': {
        'queue': 'enrichment_eod',
        'task_routes': (
            # Daily OHLCV backfill after market close — worker riêng, không chia slot marathon
            'data_ingest.tasks.backfill_daily_prices',
            # Slow-batch lane: provider-bound chậm, cách ly khỏi fast lane lẫn manual lane.
            'market_serving.materializers.materialize_symbol_snapshot',
            'data_ingest.tasks.fetch_and_upsert_price_board',
        ),
        'periodic_tasks': (
            'daily-backfill-prices-1700',
            'materialize-symbol-snapshot-60s',
            'ingest-price-board-60s',
        ),
    },
    'offhours_enrichment': {
        'queue': 'enrichment_offhours',
        'task_routes': (
            'enrich_*',
            'market_serving.materializers.materialize_pre_open_snapshots',
            # Pre-5-year historical OHLCV backfill to market inception
            'data_ingest.tasks.backfill_pre5y_to_market_inception',
        ),
        'periodic_tasks': (
            'enrich_history_bars',
            'materialize-pre-open-snapshots-20m',
            # Slice E: daily-backfill-prices-1700 đã chuyển sang domain offhours_eod (trên) —
            # cấm để lại ở đây (build_scheduler_queue_map: domain sau ghi đè domain trước).
            # Deep history bootstrap: Sun 03:00 ICT (5 years) — gap-fill for all active symbols
            'deep-history-bootstrap-weekly',
            # Pre-5-year historical backfill — complements deep-history 5-year job
            'pre5y-history-backfill-weekly',
            # DNSE intraday tape 90-ngày — Sun 01:00 ICT orchestrator
            'dnse-quarterly-backfill-intraday',
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
            'service_ops.reconcile_stale_running_service_run_logs',
            # Meta-audit fix: batch chậm đã chuyển sang offhours_eod — cấm để lại ở đây
            # (manual depth > 20 kích backpressure guard, skip tier recovery_backlog vĩnh viễn).
        ),
        'periodic_tasks': (
            'manual_refresh_task',
            'market-data-queue-tier-scheduler-30s',
            'market-data-parity-snapshot-retention-cleanup-hourly',
            'market-data-parity-retention-health-monitor-2h',
            'reconcile-stale-running-service-run-logs-5m',
        ),
    },
    # W2: screener scans on their own queue (P3, allowed post-P2).
    # Beat 'screener-scheduled-run-5m' resolves via SCHEDULER_QUEUE_MAP → 'screener'.
    'screener_scans': {
        'queue': 'screener',
        'task_routes': (
            'user_workspace.screener_tasks.run_screener_scan_task',
            'user_workspace.screener_tasks.screener_scheduled_run',
        ),
        'periodic_tasks': (
            'screener-scheduled-run-5m',
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
