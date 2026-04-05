from django.conf import settings
from django.urls import path

from . import market_views, views


def _toggle_market_view(view_name: str):
    legacy_view = getattr(views, view_name).as_view()
    refactored_view = getattr(market_views, view_name).as_view()

    def _view(request, *args, **kwargs):
        selected_view = refactored_view if getattr(settings, 'ENABLE_NEW_MARKET_VIEWS', False) else legacy_view
        return selected_view(request, *args, **kwargs)

    return _view

app_name = "portfolio_realtime"

urlpatterns = [
    path("ticker/<str:symbol>/", _toggle_market_view('RealtimeTickerView'), name="realtime-ticker"),
    path("intraday/<str:symbol>/", _toggle_market_view('IntradayMatchedView'), name="intraday-matched"),
    path("price-board/<str:symbol>/", _toggle_market_view('PriceBoardView'), name="price-board"),
    path("breadth/<str:symbol>/", _toggle_market_view('SectorBreadthView'), name="sector-breadth"),
    path("whale-feed/aggregate/", _toggle_market_view('WhaleFeedAggregateView'), name="whale-feed-aggregate"),
    path("whale-feed/<str:symbol>/", _toggle_market_view('WhaleFeedView'), name="whale-feed"),
    path("rvol/<str:symbol>/", _toggle_market_view('RVOLView'), name="rvol"),
    path("depth-chart/<str:symbol>/", _toggle_market_view('DepthChartView'), name="depth-chart"),
]
