"""
data_ingest URLs for core-api.

Registered at: path('core/v1/', include(('data_ingest.urls', 'data_ingest'), namespace='data_ingest'))
"""
from rest_framework.routers import DefaultRouter
from .views import IngestJobViewSet, IngestRunViewSet, DataIngestAdminViewSet

router = DefaultRouter()
router.register(r'data-ingest/jobs', IngestJobViewSet, basename='ingest-job')
router.register(r'data-ingest/runs', IngestRunViewSet, basename='ingest-run')
router.register(r'data-ingest', DataIngestAdminViewSet, basename='data-ingest-admin')

urlpatterns = router.urls
