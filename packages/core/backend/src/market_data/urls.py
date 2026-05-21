from django.urls import path

from . import views
from .stock_mgmt_native_views import StockManagementTechnicalsView

urlpatterns = [
    path('market-data/symbols/', views.StockProfileListView.as_view(), name='stock-profile-list'),
    path('market-data/symbols/<str:symbol>/', views.StockProfileDetailView.as_view(), name='stock-profile-detail'),
    path('market-data/daily-prices/<str:symbol>/', views.DailyPriceListView.as_view(), name='daily-price-list'),
    path('market-data/intraday-prices/<str:symbol>/', views.IntradayPricesView.as_view(), name='intraday-prices'),
    path('market-data/intraday-tape/<str:symbol>/', views.IntradayTapeView.as_view(), name='intraday-tape'),
    path('market-data/technicals/bulk/', StockManagementTechnicalsView.as_view(), name='market-data-technicals-bulk'),
]
