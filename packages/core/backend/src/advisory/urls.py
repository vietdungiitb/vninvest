from django.urls import path

from . import views

urlpatterns = [
    path('advisory/latest/<str:symbol>/', views.AdvisoryLatestView.as_view(), name='advisory-latest'),
    path('advisory/refresh/<str:symbol>/', views.AdvisoryRefreshView.as_view(), name='advisory-refresh'),
    path('advisory/status/<uuid:advisory_id>/', views.AdvisoryStatusView.as_view(), name='advisory-status'),
    path('advisory/refresh-info/<str:symbol>/', views.AdvisoryRefreshInfoView.as_view(), name='advisory-refresh-info'),
    path('advisory/history/<str:symbol>/', views.AdvisoryHistoryView.as_view(), name='advisory-history'),
    path('advisory/backtest/<str:symbol>/', views.AdvisoryBacktestView.as_view(), name='advisory-backtest'),
]
