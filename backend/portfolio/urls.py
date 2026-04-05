from django.conf import settings
from django.urls import path
from . import trading_views, views


def _toggle_trading_view(view_name: str):
    legacy_view = getattr(views, view_name).as_view()
    refactored_view = getattr(trading_views, view_name).as_view()

    def _view(request, *args, **kwargs):
        selected_view = refactored_view if getattr(settings, 'ENABLE_NEW_TRADING_VIEWS', False) else legacy_view
        return selected_view(request, *args, **kwargs)

    return _view

urlpatterns = [
    # --- Portfolios ---
    path('portfolios/', _toggle_trading_view('PortfolioListCreateView'), name='portfolio-list'),
    path('portfolios/<int:pk>/', _toggle_trading_view('PortfolioDetailView'), name='portfolio-detail'),

    # --- User Config ---
    path('userconfig/', views.UserConfigView.as_view(), name='user-config'),


    # --- SubAccounts ---
    path('subaccounts/', _toggle_trading_view('SubAccountListCreateView'), name='subaccount-list'),
    path('subaccounts/<int:pk>/', _toggle_trading_view('SubAccountDetailView'), name='subaccount-detail'),
    
    # --- Transactions ---
    path('subaccounts/<int:sub_account_id>/transactions/', _toggle_trading_view('TransactionListCreateView'), name='transaction-list'),
    path('transactions/<int:pk>/', _toggle_trading_view('TransactionDetailView'), name='transaction-detail'),


    # --- Analytics ---
    path('portfolios/<int:portfolio_id>/holdings/', views.HoldingsView.as_view(), name='portfolio-holdings'),
    path('portfolios/<int:portfolio_id>/summary/', views.SummaryView.as_view(), name='portfolio-summary'),
    path('portfolios/<int:portfolio_id>/chart/', views.ChartDataView.as_view(), name='portfolio-chart'),
    path('portfolios/<int:portfolio_id>/equity-curve/', views.EquityCurveView.as_view(), name='portfolio-equity-curve'),
    path('portfolios/<int:portfolio_id>/allocation/', views.AllocationView.as_view(), name='portfolio-allocation'),
    path('portfolios/<int:portfolio_id>/analytics/', views.PortfolioAnalyticsView.as_view(), name='portfolio-analytics'),
    path('portfolios/<int:portfolio_id>/sync/', views.SyncPricesView.as_view(), name='portfolio-sync'),

    # --- Watchlist (giữ lại cho tương thích cũ, sẽ chuyển sang stock-management) ---
    path('watchlist/groups/', views.WatchlistGroupListCreateView.as_view(), name='watchlist-group-list'),
    path('watchlist/groups/<int:pk>/', views.WatchlistGroupDetailView.as_view(), name='watchlist-group-detail'),
    path('watchlist/groups/<int:group_id>/items/', views.WatchlistItemCreateView.as_view(), name='watchlist-item-create'),
    path('watchlist/items/<int:pk>/', views.WatchlistItemDeleteView.as_view(), name='watchlist-item-delete'),
    path('watchlist/seed/', views.WatchlistSeedView.as_view(), name='watchlist-seed'),
    path('watchlist/sync/', views.WatchlistSyncView.as_view(), name='watchlist-sync'),

    # --- Screener ---
    path('screener/rules/', views.ScreenerRuleListCreateView.as_view(), name='screener-rule-list'),
    path('screener/rules/<int:rule_id>/', views.ScreenerRuleDetailView.as_view(), name='screener-rule-detail'),
    path('screener/rules/<int:rule_id>/run/', views.ScreenerRuleRunView.as_view(), name='screener-rule-run'),

    # --- Whale Advisory (AI — Pro+) ---
    path('whale-advisory/', views.WhaleAdvisoryListView.as_view(), name='whale-advisory-list'),
    path('whale-advisory/<str:symbol>/refresh/', views.refresh_whale_advisory_api, name='whale-advisory-refresh'),
]

