import hashlib

from django.conf import settings
from django.urls import path

from . import market_views, views


def _toggle_market_view(view_name: str):
    legacy_view = getattr(views, view_name).as_view()
    refactored_view = getattr(market_views, view_name).as_view()

    def _resolve_canary_percent() -> int:
        try:
            configured = int(getattr(settings, 'MARKET_VIEWS_CANARY_PERCENT', 100))
        except (TypeError, ValueError):
            configured = 100
        return max(0, min(100, configured))

    def _should_use_refactored_view(request) -> bool:
        if not getattr(settings, 'ENABLE_NEW_MARKET_VIEWS', False):
            return False

        canary_percent = _resolve_canary_percent()
        if canary_percent >= 100:
            return True
        if canary_percent <= 0:
            return False

        if getattr(request, 'user', None) is not None and request.user.is_authenticated:
            seed = f'user:{request.user.id}'
        else:
            remote_addr = request.META.get('REMOTE_ADDR') or 'anonymous'
            seed = f'ip:{remote_addr}'

        bucket = int(hashlib.md5(seed.encode('utf-8')).hexdigest()[:8], 16) % 100
        return bucket < canary_percent

    def _view(request, *args, **kwargs):
        selected_view = refactored_view if _should_use_refactored_view(request) else legacy_view
        return selected_view(request, *args, **kwargs)

    return _view

app_name = "portfolio_realtime"

urlpatterns = [
    path("ticker/<str:symbol>/", _toggle_market_view('RealtimeTickerView'), name="realtime-ticker"),
    path("intraday/<str:symbol>/", _toggle_market_view('IntradayMatchedView'), name="intraday-matched"),
    path("price-board/<str:symbol>/", _toggle_market_view('PriceBoardView'), name="price-board"),
    path("breadth/<str:symbol>/", _toggle_market_view('SectorBreadthView'), name="sector-breadth"),
    path("whale-feed/aggregate/", _toggle_market_view('WhaleFeedAggregateView'), name="whale-feed-aggregate"),
    path("whale-campaigns/", _toggle_market_view('WhaleCampaignsView'), name="whale-campaigns"),
    path("whale-feed/<str:symbol>/", _toggle_market_view('WhaleFeedView'), name="whale-feed"),
    path("rvol/<str:symbol>/", _toggle_market_view('RVOLView'), name="rvol"),
    path("depth-chart/<str:symbol>/", _toggle_market_view('DepthChartView'), name="depth-chart"),
]
