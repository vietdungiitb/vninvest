from django.urls import path

from . import views
from .native_views import (
    RealtimeBreadthView,
    RealtimeDepthChartView,
    RealtimeIntradayView,
    RealtimePriceBoardView,
    RealtimeRvolView,
    RealtimeSymbolInvestigationView,
    RealtimeTickerListView,
    RealtimeTickerView,
    RealtimeWhaleFeedAggregateView,
    RealtimeWhaleFeedView,
)

urlpatterns = [
    path('symbol-snapshot/', views.SymbolSnapshotListView.as_view(), name='symbol-snapshot-list'),
    path('symbol-snapshot/<str:symbol>/', views.SymbolSnapshotDetailView.as_view(), name='symbol-snapshot-detail'),
    path('session-facts/', views.SessionFactsListView.as_view(), name='session-facts-list'),
    path('session-facts/<str:symbol>/cvd/', views.SessionFactsCvdView.as_view(), name='session-facts-cvd'),
    path('session-facts/<str:symbol>/', views.SessionFactsDetailView.as_view(), name='session-facts-detail'),
    # Native realtime paths under core/v1/
    path('realtime/ticker/<str:symbol>/', RealtimeTickerView.as_view(), name='realtime-ticker'),
    path('realtime/tickers/', RealtimeTickerListView.as_view(), name='realtime-tickers'),
    path('realtime/intraday/<str:symbol>/', RealtimeIntradayView.as_view(), name='realtime-intraday'),
    path('realtime/price-board/<str:symbol>/', RealtimePriceBoardView.as_view(), name='realtime-price-board'),
    path('realtime/breadth/<str:symbol>/', RealtimeBreadthView.as_view(), name='realtime-breadth'),
    path('realtime/whale-feed/<str:symbol>/', RealtimeWhaleFeedView.as_view(), name='realtime-whale-feed'),
    # COMPAT-001/002: whale-feed-aggregate (native_views, contract từ core signal tables)
    path('realtime/whale-feed-aggregate/<str:symbol>/', RealtimeWhaleFeedAggregateView.as_view(), name='realtime-whale-feed-aggregate'),
    path('realtime/symbol-investigation/<str:symbol>/', RealtimeSymbolInvestigationView.as_view(), name='realtime-symbol-investigation'),
    path('realtime/rvol/<str:symbol>/', RealtimeRvolView.as_view(), name='realtime-rvol'),
    path('realtime/depth-chart/<str:symbol>/', RealtimeDepthChartView.as_view(), name='realtime-depth-chart'),
]
