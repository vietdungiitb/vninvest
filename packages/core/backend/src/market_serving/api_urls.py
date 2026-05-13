from django.urls import path

from . import views
from .legacy_views import (
    RealtimeWhaleFeedAggregateView,
    RealtimeWhaleCampaignsView,
    RealtimeUnifiedAlertsView,
)
# C2: Native views replacing RealtimeLegacyBridgeView for 9 routes
from .native_views import (
    RealtimeTickerView,
    RealtimeTickerListView,
    RealtimeIntradayView,
    RealtimePriceBoardView,
    RealtimeBreadthView,
    RealtimeWhaleFeedView,
    RealtimeSymbolInvestigationView,
    RealtimeRvolView,
    RealtimeDepthChartView,
)

urlpatterns = [
    # Native market-serving routes
    path('market/symbol-snapshot/', views.SymbolSnapshotListView.as_view(), name='api-symbol-snapshot-list'),
    path('market/symbol-snapshot/<str:symbol>/', views.SymbolSnapshotDetailView.as_view(), name='api-symbol-snapshot-detail'),
    path('market/session-facts/', views.SessionFactsListView.as_view(), name='api-session-facts-list'),
    path('market/session-facts/<str:symbol>/cvd/', views.SessionFactsCvdView.as_view(), name='api-session-facts-cvd'),
    path('market/session-facts/<str:symbol>/', views.SessionFactsDetailView.as_view(), name='api-session-facts-detail'),

    # =========================================================================
    # C2: Realtime compat routes — now native (no bridge to backend:8000)
    # =========================================================================
    path('realtime/ticker/<str:symbol>/', RealtimeTickerView.as_view(), name='legacy-realtime-ticker'),
    path('realtime/tickers/', RealtimeTickerListView.as_view(), name='legacy-realtime-tickers'),
    path('realtime/intraday/<str:symbol>/', RealtimeIntradayView.as_view(), name='legacy-realtime-intraday'),
    path('realtime/price-board/<str:symbol>/', RealtimePriceBoardView.as_view(), name='legacy-realtime-price-board'),
    path('realtime/breadth/<str:symbol>/', RealtimeBreadthView.as_view(), name='legacy-realtime-breadth'),
    path('realtime/whale-feed/aggregate/', RealtimeWhaleFeedAggregateView.as_view(), name='legacy-realtime-whale-aggregate'),
    path('realtime/whale-feed/<str:symbol>/', RealtimeWhaleFeedView.as_view(), name='legacy-realtime-whale-feed'),
    path('realtime/whale-campaigns/', RealtimeWhaleCampaignsView.as_view(), name='legacy-realtime-whale-campaigns'),
    path('realtime/unified-alerts/', RealtimeUnifiedAlertsView.as_view(), name='legacy-realtime-unified-alerts'),
    path('realtime/symbol-investigation/<str:symbol>/', RealtimeSymbolInvestigationView.as_view(), name='legacy-realtime-symbol-investigation'),
    path('realtime/rvol/<str:symbol>/', RealtimeRvolView.as_view(), name='legacy-realtime-rvol'),
    path('realtime/depth-chart/<str:symbol>/', RealtimeDepthChartView.as_view(), name='legacy-realtime-depth-chart'),
]
