"""
SFI-B4: Compat URL routes for user_workspace — maps /api/workspace/* to native core-api views.
"""
from django.urls import path

from . import views

urlpatterns = [
    path('workspace/portfolios/', views.PortfolioListCreateView.as_view(), name='compat-portfolio-list'),
    path('workspace/portfolios/<int:portfolio_id>/', views.PortfolioDetailView.as_view(), name='compat-portfolio-detail'),
    path('workspace/portfolios/<int:portfolio_id>/transactions/', views.TransactionListCreateView.as_view(), name='compat-transaction-list'),
    path('workspace/watchlists/', views.WatchlistListCreateView.as_view(), name='compat-watchlist-list'),
    path('workspace/watchlists/<int:watchlist_id>/items/', views.WatchlistItemListCreateView.as_view(), name='compat-watchlist-items'),
    path('workspace/watchlists/<int:watchlist_id>/items/<str:symbol>/', views.WatchlistItemDeleteView.as_view(), name='compat-watchlist-item-delete'),
]
