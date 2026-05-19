"""
data_ingest URLs for core-api.

Registered at: path('core/v1/', include(('data_ingest.urls', 'data_ingest'), namespace='data_ingest'))
"""
from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import IngestJobViewSet, IngestRunViewSet, DataIngestAdminViewSet, SystemBackfillTriggerView, UserBackfillTriggerView

router = DefaultRouter()
router.register(r'data-ingest/jobs', IngestJobViewSet, basename='ingest-job')
router.register(r'data-ingest/runs', IngestRunViewSet, basename='ingest-run')
router.register(r'data-ingest', DataIngestAdminViewSet, basename='data-ingest-admin')

urlpatterns = router.urls + [
    # D03: SOC system backfill trigger
    path('data-ingest/backfill/system/', SystemBackfillTriggerView.as_view(), name='backfill-system'),
    # D04: User self-serve backfill trigger
    path('data-ingest/backfill/user/', UserBackfillTriggerView.as_view(), name='backfill-user'),
]
