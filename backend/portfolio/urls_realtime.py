from django.urls import path

from . import views

app_name = "portfolio_realtime"

urlpatterns = [
    path("ticker/<str:symbol>/", views.RealtimeTickerView.as_view(), name="realtime-ticker"),
]
