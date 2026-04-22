from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views_crawl import (
    CrawlJobViewSet,
    CrawlScheduleViewSet,
    CrawlRunViewSet,
    CrawlAuditLogViewSet,
)

app_name = 'portfolio_crawl'

router = DefaultRouter()
router.register(r'jobs', CrawlJobViewSet, basename='crawl-job')
router.register(r'schedules', CrawlScheduleViewSet, basename='crawl-schedule')
router.register(r'runs', CrawlRunViewSet, basename='crawl-run')
router.register(r'audit-logs', CrawlAuditLogViewSet, basename='crawl-audit-log')

urlpatterns = [
    path('', include(router.urls)),
]
