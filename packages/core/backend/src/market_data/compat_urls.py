"""
SFI-B3: Compat URL routes for market_data — maps /api/market-data/* to native core-api views.
"""
from django.urls import path

from . import views

urlpatterns = [
    path('market-data/symbols/', views.StockProfileListView.as_view(), name='compat-stock-profile-list'),
    path('market-data/symbols/<str:symbol>/', views.StockProfileDetailView.as_view(), name='compat-stock-profile-detail'),
    path('market-data/daily-prices/<str:symbol>/', views.DailyPriceListView.as_view(), name='compat-daily-price-list'),
]
