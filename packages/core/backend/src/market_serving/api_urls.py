from django.urls import path

from . import views
from .legacy_views import (
    RealtimeLegacyBridgeView,
    RealtimeWhaleFeedAggregateView,
    RealtimeWhaleCampaignsView,
    RealtimeUnifiedAlertsView,
)

urlpatterns = [
    # Native market-serving routes
    path('market/symbol-snapshot/', views.SymbolSnapshotListView.as_view(), name='api-symbol-snapshot-list'),
    path('market/symbol-snapshot/<str:symbol>/', views.SymbolSnapshotDetailView.as_view(), name='api-symbol-snapshot-detail'),
    path('market/session-facts/', views.SessionFactsListView.as_view(), name='api-session-facts-list'),
    path('market/session-facts/<str:symbol>/', views.SessionFactsDetailView.as_view(), name='api-session-facts-detail'),

    # =========================================================================
    # Legacy frontend realtime aliases
    # =========================================================================
    path('realtime/ticker/<str:symbol>/', RealtimeLegacyBridgeView.as_view(), name='legacy-realtime-ticker'),
    path('realtime/tickers/', RealtimeLegacyBridgeView.as_view(), name='legacy-realtime-tickers'),
    path('realtime/intraday/<str:symbol>/', RealtimeLegacyBridgeView.as_view(), name='legacy-realtime-intraday'),
    path('realtime/price-board/<str:symbol>/', RealtimeLegacyBridgeView.as_view(), name='legacy-realtime-price-board'),
    path('realtime/breadth/<str:symbol>/', RealtimeLegacyBridgeView.as_view(), name='legacy-realtime-breadth'),
    path('realtime/whale-feed/aggregate/', RealtimeWhaleFeedAggregateView.as_view(), name='legacy-realtime-whale-aggregate'),
    path('realtime/whale-feed/<str:symbol>/', RealtimeLegacyBridgeView.as_view(), name='legacy-realtime-whale-feed'),
    path('realtime/whale-campaigns/', RealtimeWhaleCampaignsView.as_view(), name='legacy-realtime-whale-campaigns'),
    path('realtime/unified-alerts/', RealtimeUnifiedAlertsView.as_view(), name='legacy-realtime-unified-alerts'),
    path('realtime/symbol-investigation/<str:symbol>/', RealtimeLegacyBridgeView.as_view(), name='legacy-realtime-symbol-investigation'),
    path('realtime/rvol/<str:symbol>/', RealtimeLegacyBridgeView.as_view(), name='legacy-realtime-rvol'),
    path('realtime/depth-chart/<str:symbol>/', RealtimeLegacyBridgeView.as_view(), name='legacy-realtime-depth-chart'),
]