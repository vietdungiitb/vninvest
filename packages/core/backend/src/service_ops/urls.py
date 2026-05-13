"""
SOC URL routing — 40 endpoints across 6 domains.

Hierarchy:
  /api/soc/overview/
    - GET / — list services
    - GET /{service_key}/ — detail
    - GET /{service_key}/config-history/ — config history
    - GET /{service_key}/run-logs/ — run logs
    - GET /{service_key}/ownership/ — ownership
    - GET /health-status/ — health summary
"""
from django.urls import path

from .views import overview

# Overview endpoints (6)
urlpatterns = [
    path('overview/', overview.ServiceListView.as_view(), name='soc_service_list'),
    path('overview/<str:service_key>/', overview.ServiceDetailView.as_view(), name='soc_service_detail'),
    path('overview/<str:service_key>/config-history/', overview.ServiceConfigHistoryView.as_view(), name='soc_config_history'),
    path('overview/<str:service_key>/run-logs/', overview.ServiceRunLogsView.as_view(), name='soc_run_logs'),
    path('overview/<str:service_key>/ownership/', overview.ServiceOwnershipView.as_view(), name='soc_ownership'),
    path('overview/health-status/', overview.HealthStatusView.as_view(), name='soc_health_status'),
]

# TODO: Add domain endpoints (vnbroker/prefetch/signals/screener — 33 endpoints)
# TODO: Add matrix endpoints (7 endpoints)
