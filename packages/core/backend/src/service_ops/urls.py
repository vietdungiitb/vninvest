"""
SOC URL routing — 40 endpoints across 6 domains.

Hierarchy:
  /api/soc/overview/ (6 endpoints)
  /api/soc/vnbroker/ (7 endpoints)
  /api/soc/prefetch/ (7 endpoints)
  /api/soc/signals/ (13 endpoints)
  /api/soc/screener/ (7 endpoints)
  /api/soc/matrix/ (7 endpoints)
"""
from django.urls import path

from .views import overview, vnbroker, prefetch, signals, screener

# Overview endpoints (6)
urlpatterns = [
    path('overview/', overview.ServiceListView.as_view(), name='soc_service_list'),
    path('overview/<str:service_key>/', overview.ServiceDetailView.as_view(), name='soc_service_detail'),
    path('overview/<str:service_key>/config-history/', overview.ServiceConfigHistoryView.as_view(), name='soc_config_history'),
    path('overview/<str:service_key>/run-logs/', overview.ServiceRunLogsView.as_view(), name='soc_run_logs'),
    path('overview/<str:service_key>/ownership/', overview.ServiceOwnershipView.as_view(), name='soc_ownership'),
    path('overview/health-status/', overview.HealthStatusView.as_view(), name='soc_health_status'),

    # VNBroker domain (7)
    path('vnbroker/config/', vnbroker.VnbrokerConfigView.as_view(), name='soc_vnbroker_config'),
    path('vnbroker/config/preview/', vnbroker.VnbrokerConfigPreviewView.as_view(), name='soc_vnbroker_preview'),
    path('vnbroker/health/', vnbroker.VnbrokerHealthView.as_view(), name='soc_vnbroker_health'),
    path('vnbroker/test-connection/', vnbroker.VnbrokerTestConnectionView.as_view(), name='soc_vnbroker_test'),
    path('vnbroker/providers/', vnbroker.VnbrokerProvidersView.as_view(), name='soc_vnbroker_providers'),
    path('vnbroker/circuit-breaker-status/', vnbroker.VnbrokerCircuitBreakerView.as_view(), name='soc_vnbroker_cb'),

    # Prefetch domain (7)
    path('prefetch/config/', prefetch.PrefetchConfigView.as_view(), name='soc_prefetch_config'),
    path('prefetch/config/profiles/', prefetch.PrefetchProfilesView.as_view(), name='soc_prefetch_profiles'),
    path('prefetch/cache-status/', prefetch.PrefetchCacheStatusView.as_view(), name='soc_prefetch_cache'),
    path('prefetch/purge-cache/', prefetch.PrefetchPurgeCacheView.as_view(), name='soc_prefetch_purge'),
    path('prefetch/universe-groups/', prefetch.PrefetchUniverseGroupsView.as_view(), name='soc_prefetch_groups'),
    path('prefetch/task-schedule/', prefetch.PrefetchTaskScheduleView.as_view(), name='soc_prefetch_schedule'),

    # Signal Intelligence domain (13)
    path('signals/config/', signals.SignalsConfigView.as_view(), name='soc_signals_config'),
    path('signals/config/preview/', signals.SignalsConfigPreviewView.as_view(), name='soc_signals_preview'),
    path('signals/ownership/', signals.SignalsOwnershipView.as_view(), name='soc_signals_ownership'),
    path('signals/whale/', signals.SignalsWhaleView.as_view(), name='soc_signals_whale'),
    path('signals/whale/recent/', signals.SignalsWhaleRecentView.as_view(), name='soc_signals_whale_recent'),
    path('signals/whale/test/', signals.SignalsWhaleTestView.as_view(), name='soc_signals_whale_test'),
    path('signals/dark-pool/', signals.SignalsDarkPoolView.as_view(), name='soc_signals_darkpool'),
    path('signals/dark-pool/recent/', signals.SignalsDarkPoolRecentView.as_view(), name='soc_signals_darkpool_recent'),
    path('signals/screener/', signals.SignalsScreenerView.as_view(), name='soc_signals_screener'),
    path('signals/screener/recent/', signals.SignalsScreenerRecentView.as_view(), name='soc_signals_screener_recent'),
    path('signals/retention-policy/', signals.SignalsRetentionPolicyView.as_view(), name='soc_signals_retention'),
    path('signals/performance-metrics/', signals.SignalsPerformanceMetricsView.as_view(), name='soc_signals_metrics'),

    # Screener domain (7)
    path('screener/config/', screener.ScreenerConfigView.as_view(), name='soc_screener_config'),
    path('screener/rules/', screener.ScreenerRulesView.as_view(), name='soc_screener_rules'),
    path('screener/results/', screener.ScreenerResultsView.as_view(), name='soc_screener_results'),
    path('screener/alert-history/', screener.ScreenerAlertHistoryView.as_view(), name='soc_screener_alerts'),
    path('screener/manual-scan/', screener.ScreenerManualScanView.as_view(), name='soc_screener_scan'),

    # TODO: Add matrix endpoints (7 endpoints)
]
