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

from .views import (analytics, audit, billing, broker, dataops, dataops_stream, matrix, overview,
overview_stream, prefetch, screener, signals, signals_rules, signals_stream, signals_triage, staff, symbol_groups, usage, users, vnbroker)

# Overview endpoints (12)
urlpatterns = [
path('overview/', overview.OverviewSummaryView.as_view(), name='soc_overview_summary'),
path('overview/health-status/', overview.HealthStatusView.as_view(), name='soc_health_status'),
path('overview/stream/', overview_stream.OverviewStreamView.as_view(), name='soc_overview_stream'),
  path('overview/slo-overview/', overview.SloOverviewView.as_view(), name='soc_slo_overview'),
  path('overview/export/audits/', overview.SocExportConfigAuditsView.as_view(), name='soc_export_config_audits'),
  path('overview/export/run-logs/', overview.SocExportRunLogsView.as_view(), name='soc_export_run_logs'),
  path('overview/<str:service_key>/config/', overview.ServiceCurrentConfigView.as_view(), name='soc_service_config'),
  path('overview/<str:service_key>/config/reset/', overview.ServiceCurrentConfigView.as_view(), name='soc_service_config_reset'),
  path('overview/<str:service_key>/health/', overview.ServiceHealthView.as_view(), name='soc_service_health'),
  path('overview/<str:service_key>/audit/', overview.ServiceAuditView.as_view(), name='soc_service_audit'),
  path('overview/<str:service_key>/history/', overview.ServiceConfigHistoryView.as_view(), name='soc_service_history'),
    path('overview/<str:service_key>/', overview.ServiceDetailView.as_view(), name='soc_service_detail'),
    path('overview/<str:service_key>/config-history/', overview.ServiceConfigHistoryView.as_view(), name='soc_config_history'),
    path('overview/<str:service_key>/run-logs/', overview.ServiceRunLogsView.as_view(), name='soc_run_logs'),
    path('overview/<str:service_key>/ownership/', overview.ServiceOwnershipView.as_view(), name='soc_ownership'),

    # Service catalog endpoints (8)
    path('run-logs/', overview.RunLogListView.as_view(), name='soc_run_logs_list'),
    path('change-audit/', overview.ChangeAuditListView.as_view(), name='soc_change_audit_list'),
    path('services/', overview.ServiceListView.as_view(), name='soc_services_list'),
    path('services/<str:service_key>/config/', overview.ServiceCurrentConfigView.as_view(), name='soc_services_config'),
    path('services/<str:service_key>/config/reset/', overview.ServiceCurrentConfigView.as_view(), name='soc_services_config_reset'),
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
    path('vnbroker/provider-health/', vnbroker.VnbrokerProviderHealthView.as_view(), name='soc_vnbroker_provider_health'),
    path('vnbroker/ownership/', vnbroker.VnbrokerOwnershipView.as_view(), name='soc_vnbroker_ownership'),
    path('vnbroker/circuit-breaker-status/', vnbroker.VnbrokerCircuitBreakerView.as_view(), name='soc_vnbroker_cb'),

    # Broker system config domain (B2.3) — registry + system credentials + health
    path('broker/config/', broker.BrokerConfigView.as_view(), name='soc_broker_config'),
    path('broker/config/apply/', broker.BrokerConfigView.as_view(), name='soc_broker_config_apply'),
    path('broker/config/preview/', broker.BrokerConfigPreviewView.as_view(), name='soc_broker_preview'),
    path('broker/audit/', broker.BrokerAuditView.as_view(), name='soc_broker_audit'),
    path('broker/health/', broker.BrokerHealthView.as_view(), name='soc_broker_health'),
    path('broker/credentials/', broker.BrokerCredentialsView.as_view(), name='soc_broker_credentials'),
    path('broker/credentials/<str:provider>/', broker.BrokerCredentialDeleteView.as_view(), name='soc_broker_credential_delete'),
    path('broker/test-connection/', broker.BrokerTestConnectionView.as_view(), name='soc_broker_test'),

    # Operator users domain (A2) — quản trị users toàn hệ thống, staff-only
    path('users/', users.SocUsersView.as_view(), name='soc_users_list'),
    path('users/<int:user_id>/set-active/', users.SocUserSetActiveView.as_view(), name='soc_users_set_active'),
    path('users/<int:user_id>/set-plan/', users.SocUserSetPlanView.as_view(), name='soc_users_set_plan'),

    # Billing fleet domain (R2 refactor) — tổng hợp cross-tenant, staff-only
    path('billing/overview/', billing.BillingOverviewView.as_view(), name='soc_billing_overview'),
    path('billing/invoices/', billing.BillingInvoiceListView.as_view(), name='soc_billing_invoices'),

    # Usage fleet domain (R3 refactor) — tổng hợp cross-tenant, staff-only
    path('usage/overview/', usage.UsageOverviewView.as_view(), name='soc_usage_overview'),
    path('usage/export/', usage.UsageExportView.as_view(), name='soc_usage_export'),

    # Audit events domain (R4 refactor) — viewer cross-tenant, staff-only
    path('audit-events/', audit.AuditEventsView.as_view(), name='soc_audit_events'),

    # Staff-switch domain (R5 refactor) — staff xem hộ tenant, staff-only
    path('staff/switch/', staff.StaffSwitchView.as_view(), name='soc_staff_switch'),

    # Analytics fleet domain (R8) — tăng trưởng/cohort/export/cảnh báo, staff-only
    path('analytics/growth/', analytics.AnalyticsGrowthView.as_view(), name='soc_analytics_growth'),
    path('analytics/cohorts/', analytics.AnalyticsCohortsView.as_view(), name='soc_analytics_cohorts'),
    path('analytics/alerts/', analytics.AnalyticsAlertsView.as_view(), name='soc_analytics_alerts'),

    # Prefetch domain (7)
    path('prefetch/config/', prefetch.PrefetchConfigView.as_view(), name='soc_prefetch_config'),
    path('prefetch/config/apply/', prefetch.PrefetchConfigView.as_view(), name='soc_prefetch_config_apply'),
    path('prefetch/config/preview/', prefetch.PrefetchConfigPreviewView.as_view(), name='soc_prefetch_preview'),
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
    path('signals/feed/export/', signals.SignalsFeedExportView.as_view(), name='soc_signals_feed_export'),
    path('signals/stream/', signals_stream.SignalsStreamView.as_view(), name='soc_signals_stream'),
    path('signals/deliveries/', signals_triage.SignalsDeliveriesView.as_view(), name='soc_signals_deliveries'),
    path('signals/deliveries/mute/', signals_triage.SignalsDeliveryMuteView.as_view(), name='soc_signals_delivery_mute'),
    path('signals/deliveries/<uuid:delivery_id>/seen/', signals_triage.SignalsDeliverySeenView.as_view(), name='soc_signals_delivery_seen'),
    path('signals/deliveries/<uuid:delivery_id>/ack/', signals_triage.SignalsDeliveryAckView.as_view(), name='soc_signals_delivery_ack'),
    path('signals/rules/', signals_rules.SignalsRuleListView.as_view(), name='soc_signals_rules'),
    path('signals/rules/request/', signals_rules.SignalsRuleRequestView.as_view(), name='soc_signals_rule_request'),
    path('signals/rules/feedback/', signals_rules.SignalsRuleFeedbackView.as_view(), name='soc_signals_rule_feedback'),
    path('signals/rules/performance/', signals_rules.SignalsRulePerformanceView.as_view(), name='soc_signals_rule_performance'),

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
    path('dataops/run-logs/purge/', dataops.DataOpsRunLogsPurgeView.as_view(), name='soc_dataops_run_logs_purge'),
    path('dataops/planner/preview/', dataops.DataOpsPlannerPreviewView.as_view(), name='soc_dataops_planner_preview'),
    path('dataops/planner/run/', dataops.DataOpsPlannerRunView.as_view(), name='soc_dataops_planner_run'),
    path('dataops/planner/run/<str:run_id>/abort/', dataops.DataOpsPlannerRunAbortView.as_view(), name='soc_dataops_planner_run_abort'),
    path('dataops/queue-tiers/', dataops.DataOpsQueueTiersView.as_view(), name='soc_dataops_queue_tiers'),
    path('dataops/observability/', dataops.DataOpsObservabilityView.as_view(), name='soc_dataops_observability'),
    path('dataops/runtime-config/', dataops.DataOpsRuntimeConfigView.as_view(), name='soc_dataops_runtime_config'),
path('dataops/runtime-config/preview/', dataops.DataOpsRuntimeConfigPreviewView.as_view(),
         name='soc_dataops_runtime_config_preview'),
    path('dataops/runtime-config/schema/', dataops.DataOpsRuntimeConfigSchemaView.as_view(),
         name='soc_dataops_runtime_config_schema'),
    path('dataops/runtime-config/audit/', dataops.DataOpsRuntimeConfigAuditView.as_view(), name='soc_dataops_runtime_config_audit'),
    path('dataops/stream/', dataops_stream.DataOpsStreamView.as_view(), name='soc_dataops_stream'),
    path('dataops/inventory/', dataops.DataOpsInventoryView.as_view(), name='soc_dataops_inventory'),

    # Backfill Progress API (B03)
    path('dataops/backfill/runs/', dataops.BackfillRunListView.as_view(), name='soc_backfill_run_list'),
    path('dataops/backfill/runs/<str:run_id>/', dataops.BackfillRunDetailView.as_view(), name='soc_backfill_run_detail'),
    path('dataops/backfill/run-now/', dataops.BackfillRunNowView.as_view(), name='soc_backfill_run_now'),

    # Symbol Groups domain (cached predefined from vnbroker + custom CRUD)
    path('symbol-groups/sync/', symbol_groups.SymbolGroupSyncView.as_view(), name='soc_symbol_groups_sync'),
    path('symbol-groups/', symbol_groups.SymbolGroupListView.as_view(), name='soc_symbol_groups_list'),
    path('symbol-groups/<slug:slug>/', symbol_groups.SymbolGroupDetailView.as_view(), name='soc_symbol_groups_detail'),
]
