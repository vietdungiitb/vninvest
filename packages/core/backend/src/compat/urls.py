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

# Migration tracking:
# - market_serving:legacy_views.RealtimeWhaleFeedAggregateView -> market_serving native (IN PROGRESS)
# - user_workspace:legacy_views.* -> user_workspace native workspace/* (DONE for watchlists)
# - market_data:legacy_views.* -> market_data native stock_mgmt_native_views (DONE)