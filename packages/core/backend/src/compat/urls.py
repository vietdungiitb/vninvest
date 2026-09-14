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
# - [COMPAT-001 | target 2026-10-15 | owner BE] market_serving:legacy_views.RealtimeWhaleFeedAggregateView
#   (market_serving/legacy_views.py:409, routed at market_serving/urls.py:30)
#   -> market_serving native view alias. Status IN PROGRESS: view already reads
#   core signal tables (WhaleAlertCanonical); left = cutover route name + FE adapter.
# - [DONE] user_workspace:legacy_views.* -> user_workspace native workspace/* (watchlists)
# - [DONE] market_data:legacy_views.* -> market_data native stock_mgmt_native_views
# - [COMPAT-002 | target 2026-11-30 | owner BE] compat app sunset after COMPAT-001.