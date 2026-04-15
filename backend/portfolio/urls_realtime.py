from django.urls import path

from . import market_views, views
from .views_realtime_ops import realtime_metrics_ops_api


app_name = "portfolio_realtime"

urlpatterns = [
    path("ticker/<str:symbol>/", market_views.RealtimeTickerView.as_view(), name="realtime-ticker"),
    path("intraday/<str:symbol>/", market_views.IntradayMatchedView.as_view(), name="intraday-matched"),
    path("price-board/<str:symbol>/", market_views.PriceBoardView.as_view(), name="price-board"),
    path("breadth/<str:symbol>/", market_views.SectorBreadthView.as_view(), name="sector-breadth"),
    path("whale-feed/aggregate/", market_views.WhaleFeedAggregateView.as_view(), name="whale-feed-aggregate"),
    path("unified-alerts/", market_views.UnifiedAlertsView.as_view(), name="unified-alerts"),
    path("whale-campaigns/", market_views.WhaleCampaignsView.as_view(), name="whale-campaigns"),
    path("symbol-investigation/<str:symbol>/", views.symbol_investigation_api, name="symbol-investigation"),
    path("whale-symbol-summary/<str:symbol>/", views.whale_symbol_summary_api, name="whale-symbol-summary"),
    path("whale-feed/<str:symbol>/", market_views.WhaleFeedView.as_view(), name="whale-feed"),
    path("rvol/<str:symbol>/", market_views.RVOLView.as_view(), name="rvol"),
    path("depth-chart/<str:symbol>/", market_views.DepthChartView.as_view(), name="depth-chart"),
    path("ops/metrics/", realtime_metrics_ops_api, name="realtime-ops-metrics"),
]
