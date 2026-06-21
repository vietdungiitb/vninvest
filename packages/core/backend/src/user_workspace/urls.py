from django.urls import path

from . import views, views_dnse

# C4: Real portfolio analytics views (replaces stubs)
from .portfolio_analytics_views import (
    PortfolioHoldingsView,
    PortfolioSummaryView,
    PortfolioChartView,
    PortfolioEquityCurveView,
    PortfolioAllocationView,
    PortfolioAnalyticsView,
    PortfolioSyncView,
    PortfolioTechnicalsView,
    PortfolioAIAdvisoryCanonicalView,
    PortfolioAIAdvisoryCurrentView,
    PortfolioAIAdvisoryAutoRefreshInfoView,
    PortfolioAIAdvisoryRefreshView,
    PortfolioAICommandCenterView,
    PortfolioAICommandCenterTestView,
    PortfolioMarketDiscoveryHubView,
    PortfolioWhaleAnalyticsView,
    PortfolioWhaleBacktestStatsView,
    PortfolioScreenerRuleDetailView,
    PortfolioScreenerRuleRunView,
    PortfolioAIAdvisoryListView,
    PortfolioAIAdvisorySymbolStatsView,
)

urlpatterns = [
    # Native workspace paths (core/v1/ namespace)
    path('workspace/portfolios/', views.PortfolioListCreateView.as_view(), name='portfolio-list'),
    path('workspace/portfolios/<int:portfolio_id>/', views.PortfolioDetailView.as_view(), name='portfolio-detail'),
    path('workspace/portfolios/<int:portfolio_id>/transactions/', views.TransactionListCreateView.as_view(), name='transaction-list'),
    path('workspace/portfolios/<int:portfolio_id>/holdings/', PortfolioHoldingsView.as_view(), name='portfolio-holdings'),
    path('workspace/portfolios/<int:portfolio_id>/summary/', PortfolioSummaryView.as_view(), name='portfolio-summary'),
    path('workspace/portfolios/<int:portfolio_id>/analytics/', PortfolioAnalyticsView.as_view(), name='portfolio-analytics'),
    path('workspace/portfolios/<int:portfolio_id>/technicals/', PortfolioTechnicalsView.as_view(), name='portfolio-technicals'),
    path('workspace/transactions/<int:transaction_id>/', views.TransactionDetailView.as_view(), name='transaction-detail'),
    path('workspace/watchlists/', views.WatchlistListCreateView.as_view(), name='watchlist-list'),
    path('workspace/watchlists/<int:watchlist_id>/', views.WatchlistDetailView.as_view(), name='watchlist-detail'),
    path('workspace/watchlists/<int:watchlist_id>/items/', views.WatchlistItemListCreateView.as_view(), name='watchlist-items'),
    path('workspace/watchlists/<int:watchlist_id>/items/<str:symbol>/', views.WatchlistItemDeleteView.as_view(), name='watchlist-item-delete'),
    path('workspace/whale-analytics/<str:symbol>/', PortfolioWhaleAnalyticsView.as_view(), name='workspace-whale-analytics'),
    path('workspace/ai-command-center/', PortfolioAICommandCenterView.as_view(), name='workspace-ai-cc-direct'),
    path('workspace/ai-command-center/test-connection/', PortfolioAICommandCenterTestView.as_view(), name='workspace-ai-cc-test'),

    # Legacy compat: portfolio ai-advisory routes (proxy for legacy frontend client.js calls)
    path('portfolio/ai-advisory/', PortfolioAIAdvisoryListView.as_view(), name='portfolio-ai-advisory-list'),
    path('portfolio/ai-advisory-symbol-stats/', PortfolioAIAdvisorySymbolStatsView.as_view(), name='portfolio-ai-advisory-symbol-stats'),

    # Sub-accounts native routes (migrated to native workspace core/v1/)
    path('portfolio/subaccounts/', views.SubAccountListCreateAPIView.as_view(), name='subaccount-list-create'),
    path('portfolio/subaccounts/<int:pk>/', views.SubAccountDetailAPIView.as_view(), name='subaccount-detail'),
    path('portfolio/subaccounts/<int:pk>/transactions/', views.SubAccountTransactionsAPIView.as_view(), name='subaccount-transactions'),

    # Broker Integration (DNSE) — Native Core Implementation
    path('broker/dnse/config/', views_dnse.dnse_config_api, name='dnse-broker-config'),
    path('broker/dnse/sync-accounts/', views_dnse.dnse_sync_accounts_api, name='dnse-broker-sync-accounts'),
    path('broker/dnse/sync-balances/', views_dnse.dnse_sync_balances_api, name='dnse-broker-sync-balances'),
    path('broker/dnse/reconcile-transactions/', views_dnse.dnse_reconcile_transactions_api, name='dnse-broker-reconcile-transactions'),
    path('broker/dnse/send-email-otp/', views_dnse.dnse_send_email_otp_api, name='dnse-broker-send-email-otp'),
    path('broker/dnse/create-trading-token/', views_dnse.dnse_create_trading_token_api, name='dnse-broker-create-trading-token'),
    path('broker/dnse/place-order/', views_dnse.dnse_place_order_api, name='dnse-broker-place-order'),
    path('broker/dnse/token-status/', views_dnse.dnse_token_status_api, name='dnse-broker-token-status'),
]
