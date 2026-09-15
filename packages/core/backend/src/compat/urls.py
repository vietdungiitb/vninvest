"""
Legacy compatibility URL routes.

These routes are TEMPORARY and will be removed after full migration to /core/v1/.
Each route should have a migration ticket and target date.
"""
from django.urls import path

# Import legacy views that are still actively used
# TODO: Move each to proper domain app and remove from here

urlpatterns = [
    # Example pattern - replace with actual legacy routes that are still needed
    # path('legacy/endpoint/', LegacyView.as_view(), name='legacy-endpoint'),
]

# Migration tracking (W6 — ticket + target date + owner required per route):
# - [DONE 2026-09-15 COMPAT-001] market_serving:legacy_views.RealtimeWhaleFeedAggregateView
#   (route tại market_serving/urls.py:31) -> native_views.RealtimeWhaleFeedAggregateView
#   (name 'market_serving:realtime-whale-feed-aggregate'); FE adapter
#   getWhaleAnalyticsSnapshotEndpoint -> /workspace/whale-analytics/.
# - [DONE 2026-09-15 COMPAT-002] toàn bộ body class unified-alerts / whale-feed-aggregate /
#   whale-campaigns đã relocate vào market_serving/native_views.py; legacy_views.py đã xoá.
#   Không còn legacy import nào trong repo.
# - [DONE] user_workspace:legacy_views.* -> user_workspace native workspace/* (watchlists)
# - [DONE] market_data:legacy_views.* -> market_data native stock_mgmt_native_views
# - [COMPAT-002 | target 2026-11-30 | owner BE] compat app sunset after COMPAT-001.