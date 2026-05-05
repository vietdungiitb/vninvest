from django.urls import path

from . import views

urlpatterns = [
    path('market-data/symbols/', views.StockProfileListView.as_view(), name='stock-profile-list'),
    path('market-data/symbols/<str:symbol>/', views.StockProfileDetailView.as_view(), name='stock-profile-detail'),
    path('market-data/daily-prices/<str:symbol>/', views.DailyPriceListView.as_view(), name='daily-price-list'),
]
