"""
data_ingest URLs for core-api.

Registered at: path('core/v1/', include(('data_ingest.urls', 'data_ingest'), namespace='data_ingest'))
"""
from django.urls import path

from .views import (
    DataIngestAdminViewSet,
    IngestJobViewSet,
    IngestRunViewSet,
    SystemBackfillTriggerView,
    UserBackfillTriggerView,
)

# IngestJobViewSet - read-only
ingest_job_list = IngestJobViewSet.as_view({'get': 'list'})
ingest_job_detail = IngestJobViewSet.as_view({'get': 'retrieve'})

# IngestRunViewSet - read-only
ingest_run_list = IngestRunViewSet.as_view({'get': 'list'})
ingest_run_detail = IngestRunViewSet.as_view({'get': 'retrieve'})

# DataIngestAdminViewSet - admin actions
data_ingest_trigger_daily_prices = DataIngestAdminViewSet.as_view({'post': 'trigger_daily_prices'})
data_ingest_trigger_price_board = DataIngestAdminViewSet.as_view({'post': 'trigger_price_board'})
data_ingest_task_status = DataIngestAdminViewSet.as_view({'get': 'task_status'})

urlpatterns = [
    # IngestJobViewSet
    path('data-ingest/jobs/', ingest_job_list, name='ingest-job-list'),
    path('data-ingest/jobs/<str:pk>/', ingest_job_detail, name='ingest-job-detail'),
    
    # IngestRunViewSet
    path('data-ingest/runs/', ingest_run_list, name='ingest-run-list'),
    path('data-ingest/runs/<str:pk>/', ingest_run_detail, name='ingest-run-detail'),
    
    # DataIngestAdminViewSet actions
    path('data-ingest/trigger/daily-prices/', data_ingest_trigger_daily_prices, name='data-ingest-admin-trigger_daily_prices'),
    path('data-ingest/trigger/price-board/', data_ingest_trigger_price_board, name='data-ingest-admin-trigger_price_board'),
    path('data-ingest/task-status/<str:task_id>/', data_ingest_task_status, name='data-ingest-admin-task_status'),
    
    # D03: SOC system backfill trigger
    path('data-ingest/backfill/system/', SystemBackfillTriggerView.as_view(), name='backfill-system'),
    # D04: User self-serve backfill trigger
    path('data-ingest/backfill/user/', UserBackfillTriggerView.as_view(), name='backfill-user'),
]