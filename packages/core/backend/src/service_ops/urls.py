"""
SOC URL routing across 6 domains, including documented spec aliases.

Hierarchy:
  /api/soc/overview/ (summary + compatibility aliases)
  /api/soc/services/ (catalog/detail)
  /api/soc/vnbroker/ (config, apply alias, ownership, provider health)
  /api/soc/prefetch/ (config, apply alias, ownership, runtime status)
  /api/soc/signals/ (read/preview/apply-block + ownership + runtime summaries)
  /api/soc/screener/ (config, apply alias, ownership, runtime status)
  /api/soc/matrix/ (cycles, monitor, providers)
"""
from django.urls import path

from .views import dataops, matrix, overview, prefetch, screener, signals, symbol_groups, vnbroker

# Overview endpoints (10)
urlpatterns = [
  path('overview/', overview.OverviewSummaryView.as_view(), name='soc_overview_summary'),
  path('overview/health-status/', overview.HealthStatusView.as_view(), name='soc_health_status'),
  path('overview/<str:service_key>/config/', overview.ServiceCurrentConfigView.as_view(), name='soc_service_config'),
  path('overview/<str:service_key>/health/', overview.ServiceHealthView.as_view(), name='soc_service_health'),
  path('overview/<str:service_key>/audit/', overview.ServiceAuditView.as_view(), name='soc_service_audit'),
  path('overview/<str:service_key>/history/', overview.ServiceConfigHistoryView.as_view(), name='soc_service_history'),
    path('overview/<str:service_key>/', overview.ServiceDetailView.as_view(), name='soc_service_detail'),
    path('overview/<str:service_key>/config-history/', overview.ServiceConfigHistoryView.as_view(), name='soc_config_history'),
    path('overview/<str:service_key>/run-logs/', overview.ServiceRunLogsView.as_view(), name='soc_run_logs'),
    path('overview/<str:service_key>/ownership/', overview.ServiceOwnershipView.as_view(), name='soc_ownership'),

    # Service catalog endpoints (6)
    path('run-logs/', overview.RunLogListView.as_view(), name='soc_run_logs_list'),
    path('change-audit/', overview.ChangeAuditListView.as_view(), name='soc_change_audit_list'),
    path('services/', overview.ServiceListView.as_view(), name='soc_services_list'),
    path('services/<str:service_key>/config/', overview.ServiceCurrentConfigView.as_view(), name='soc_services_config'),
    path('services/<str:service_key>/health/', overview.ServiceHealthView.as_view(), name='soc_services_health'),
    path('services/<str:service_key>/audit/', overview.ServiceAuditView.as_view(), name='soc_services_audit'),
    path('services/<str:service_key>/history/', overview.ServiceConfigHistoryView.as_view(), name='soc_services_history'),
    path('services/<str:service_key>/health-check/', overview.ServiceHealthCheckTriggerView.as_view(), name='soc_services_health_check'),
    path('services/<str:service_key>/', overview.ServiceDetailView.as_view(), name='soc_services_detail'),

    # VNBroker domain (7)
    path('vnbroker/config/', vnbroker.VnbrokerConfigView.as_view(), name='soc_vnbroker_config'),
    path('vnbroker/config/apply/', vnbroker.VnbrokerConfigView.as_view(), name='soc_vnbroker_config_apply'),
    path('vnbroker/config/preview/', vnbroker.VnbrokerConfigPreviewView.as_view(), name='soc_vnbroker_preview'),
    path('vnbroker/health/', vnbroker.VnbrokerHealthView.as_view(), name='soc_vnbroker_health'),
    path('vnbroker/test-connection/', vnbroker.VnbrokerTestConnectionView.as_view(), name='soc_vnbroker_test'),
    path('vnbroker/providers/', vnbroker.VnbrokerProvidersView.as_view(), name='soc_vnbroker_providers'),
    path('vnbroker/benchmark/', vnbroker.VnbrokerBenchmarkView.as_view(), name='soc_vnbroker_benchmark'),
    path('vnbroker/ownership/', vnbroker.VnbrokerOwnershipView.as_view(), name='soc_vnbroker_ownership'),
    path('vnbroker/circuit-breaker-status/', vnbroker.VnbrokerCircuitBreakerView.as_view(), name='soc_vnbroker_cb'),

    # Prefetch domain (7)
    path('prefetch/config/', prefetch.PrefetchConfigView.as_view(), name='soc_prefetch_config'),
    path('prefetch/config/apply/', prefetch.PrefetchConfigView.as_view(), name='soc_prefetch_config_apply'),
    path('prefetch/config/profiles/', prefetch.PrefetchProfilesView.as_view(), name='soc_prefetch_profiles'),
    path('prefetch/cache-status/', prefetch.PrefetchCacheStatusView.as_view(), name='soc_prefetch_cache'),
    path('prefetch/purge-cache/', prefetch.PrefetchPurgeCacheView.as_view(), name='soc_prefetch_purge'),
    path('prefetch/warm-now/', prefetch.PrefetchWarmNowView.as_view(), name='soc_prefetch_warm_now'),
    path('prefetch/universe-groups/', prefetch.PrefetchUniverseGroupsView.as_view(), name='soc_prefetch_groups'),
    path('prefetch/task-schedule/', prefetch.PrefetchTaskScheduleView.as_view(), name='soc_prefetch_schedule'),
    path('prefetch/ownership/', prefetch.PrefetchOwnershipView.as_view(), name='soc_prefetch_ownership'),

    # Signal Intelligence domain (13)
    path('signals/config/', signals.SignalsConfigView.as_view(), name='soc_signals_config'),
    path('signals/config/apply/', signals.SignalsConfigApplyView.as_view(), name='soc_signals_config_apply'),
    path('signals/config/preview/', signals.SignalsConfigPreviewView.as_view(), name='soc_signals_preview'),
    path('signals/summary/', signals.SignalsSummaryView.as_view(), name='soc_signals_summary'),
    path('signals/ownership/', signals.SignalsOwnershipView.as_view(), name='soc_signals_ownership'),
    path('signals/whale/', signals.SignalsWhaleView.as_view(), name='soc_signals_whale'),
    path('signals/whale/recent/', signals.SignalsWhaleRecentView.as_view(), name='soc_signals_whale_recent'),
    path('signals/whale/test/', signals.SignalsWhaleTestView.as_view(), name='soc_signals_whale_test'),
    path('signals/dark-pool/', signals.SignalsDarkPoolView.as_view(), name='soc_signals_darkpool'),
    path('signals/dark-pool/recent/', signals.SignalsDarkPoolRecentView.as_view(), name='soc_signals_darkpool_recent'),
    path('signals/screener/', signals.SignalsScreenerView.as_view(), name='soc_signals_screener'),
    path('signals/screener/recent/', signals.SignalsScreenerRecentView.as_view(), name='soc_signals_screener_recent'),
    path('signals/retention-policy/', signals.SignalsRetentionPolicyView.as_view(), name='soc_signals_retention'),
    path('signals/retention-policy/preview/', signals.SignalsRetentionPreviewView.as_view(), name='soc_signals_retention_preview'),
    path('signals/materialization/', signals.SignalsMaterializationView.as_view(), name='soc_signals_materialization'),
    path('signals/materialization/preview/', signals.SignalsMaterializationPreviewView.as_view(), name='soc_signals_materialization_preview'),
    path('signals/universe/', signals.SignalsUniverseView.as_view(), name='soc_signals_universe'),
    path('signals/universe/update/', signals.SignalsUniverseUpdateView.as_view(), name='soc_signals_universe_update'),
    path('signals/jobs/run/', signals.SignalsJobRunView.as_view(), name='soc_signals_jobs_run'),
    path('signals/jobs/status/', signals.SignalsJobStatusView.as_view(), name='soc_signals_jobs_status'),
    path('signals/performance-metrics/', signals.SignalsPerformanceMetricsView.as_view(), name='soc_signals_metrics'),

    # Screener domain (9)
    path('screener/config/', screener.ScreenerConfigView.as_view(), name='soc_screener_config'),
    path('screener/config/apply/', screener.ScreenerConfigView.as_view(), name='soc_screener_config_apply'),
    path('screener/rules/', screener.ScreenerRulesView.as_view(), name='soc_screener_rules'),
    path('screener/rules/run/', screener.ScreenerRulesRunView.as_view(), name='soc_screener_rules_run'),
    path('screener/rules/<str:rule_id>/', screener.ScreenerRuleUpdateView.as_view(), name='soc_screener_rule_update'),
    path('screener/rules/<str:rule_id>/delete/', screener.ScreenerRuleDeleteView.as_view(), name='soc_screener_rule_delete'),
    path('screener/results/', screener.ScreenerResultsView.as_view(), name='soc_screener_results'),
    path('screener/alert-history/', screener.ScreenerAlertHistoryView.as_view(), name='soc_screener_alerts'),
    path('screener/manual-scan/', screener.ScreenerManualScanView.as_view(), name='soc_screener_scan'),
    path('screener/ownership/', screener.ScreenerOwnershipView.as_view(), name='soc_screener_ownership'),

    # Matrix domain (7)
    path('matrix/cycles/', matrix.MatrixCycleListView.as_view(), name='soc_matrix_cycle_list'),
    path('matrix/cycles/start/', matrix.MatrixCycleStartView.as_view(), name='soc_matrix_cycle_start'),
    path('matrix/cycles/<str:cycle_id>/', matrix.MatrixCycleDetailView.as_view(), name='soc_matrix_cycle_detail'),
    path('matrix/cycles/<str:cycle_id>/cells/', matrix.MatrixCellListView.as_view(), name='soc_matrix_cell_list'),
    path('matrix/cycles/<str:cycle_id>/abort/', matrix.MatrixCycleAbortView.as_view(), name='soc_matrix_cycle_abort'),
    path('matrix/providers/', matrix.MatrixProvidersView.as_view(), name='soc_matrix_providers'),
    path('matrix/monitor/', matrix.MatrixMonitorView.as_view(), name='soc_matrix_monitor'),

    # Data Ops market-data SSOT domain (6)
    path('dataops/coverage/', dataops.DataOpsCoverageView.as_view(), name='soc_dataops_coverage'),
    path('dataops/registry/summary/', dataops.DataOpsRegistrySummaryView.as_view(), name='soc_dataops_registry_summary'),
    path('dataops/registry/reconcile-preview/', dataops.DataOpsRegistryReconcilePreviewView.as_view(), name='soc_dataops_registry_reconcile_preview'),
    path('dataops/registry/<str:symbol>/', dataops.DataOpsRegistryDetailView.as_view(), name='soc_dataops_registry_detail'),
    path('dataops/run-logs/', dataops.DataOpsRunLogsView.as_view(), name='soc_dataops_run_logs'),
    path('dataops/planner/preview/', dataops.DataOpsPlannerPreviewView.as_view(), name='soc_dataops_planner_preview'),
    path('dataops/planner/run/', dataops.DataOpsPlannerRunView.as_view(), name='soc_dataops_planner_run'),
    path('dataops/planner/run/<str:run_id>/abort/', dataops.DataOpsPlannerRunAbortView.as_view(), name='soc_dataops_planner_run_abort'),
    path('dataops/queue-tiers/', dataops.DataOpsQueueTiersView.as_view(), name='soc_dataops_queue_tiers'),
    path('dataops/runtime-config/', dataops.DataOpsRuntimeConfigView.as_view(), name='soc_dataops_runtime_config'),
    path('dataops/runtime-config/preview/', dataops.DataOpsRuntimeConfigPreviewView.as_view(), name='soc_dataops_runtime_config_preview'),
    path('dataops/runtime-config/audit/', dataops.DataOpsRuntimeConfigAuditView.as_view(), name='soc_dataops_runtime_config_audit'),
    path('dataops/inventory/', dataops.DataOpsInventoryView.as_view(), name='soc_dataops_inventory'),

    # Symbol Groups domain (predefined + custom CRUD)
    path('symbol-groups/', symbol_groups.SymbolGroupListView.as_view(), name='soc_symbol_groups_list'),
    path('symbol-groups/<slug:slug>/', symbol_groups.SymbolGroupDetailView.as_view(), name='soc_symbol_groups_detail'),
]
