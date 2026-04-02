from django.urls import path

from . import views

app_name = "portfolio_realtime"

urlpatterns = [
    path("ticker/<str:symbol>/", views.RealtimeTickerView.as_view(), name="realtime-ticker"),
    path("intraday/<str:symbol>/", views.IntradayMatchedView.as_view(), name="intraday-matched"),
    path("price-board/<str:symbol>/", views.PriceBoardView.as_view(), name="price-board"),
    path("breadth/<str:symbol>/", views.SectorBreadthView.as_view(), name="sector-breadth"),
    path("whale-feed/<str:symbol>/", views.WhaleFeedView.as_view(), name="whale-feed"),
    path("rvol/<str:symbol>/", views.RVOLView.as_view(), name="rvol"),
    path("depth-chart/<str:symbol>/", views.DepthChartView.as_view(), name="depth-chart"),
]
