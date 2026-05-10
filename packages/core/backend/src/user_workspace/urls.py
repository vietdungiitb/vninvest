from django.urls import path

from . import views, views_dnse

# Import compat views for legacy watchlist/userconfig response shapes.
# These will be migrated to native views in a future slice.
from vninvest_core.utils.legacy_stubs import GenericEmptyListView, GenericEmptyStaffView
from .legacy_views import (
    LegacyWatchlistGroupDetailView,
    LegacyWatchlistGroupListView,
    LegacyWatchlistItemCreateView,
    LegacyWatchlistItemDeleteView,
    PortfolioAnalyticsStubView,
    PortfolioListAnalyticsStubView,
    PortfolioUserConfigView,
    SecuritiesGroupDetailView,
    SecuritiesGroupListCreateView,
    SecuritiesSyncView,
    TrackedSymbolListCreateView,
)

urlpatterns = [
    # Native workspace paths (core/v1/ namespace)
    path('workspace/portfolios/', views.PortfolioListCreateView.as_view(), name='portfolio-list'),
    path('workspace/portfolios/<int:portfolio_id>/', views.PortfolioDetailView.as_view(), name='portfolio-detail'),
    path('workspace/portfolios/<int:portfolio_id>/transactions/', views.TransactionListCreateView.as_view(), name='transaction-list'),
    path('workspace/watchlists/', views.WatchlistListCreateView.as_view(), name='watchlist-list'),
    path('workspace/watchlists/<int:watchlist_id>/items/', views.WatchlistItemListCreateView.as_view(), name='watchlist-items'),
    path('workspace/watchlists/<int:watchlist_id>/items/<str:symbol>/', views.WatchlistItemDeleteView.as_view(), name='watchlist-item-delete'),

    # =========================================================================
    # Legacy frontend path aliases (api/ namespace, mounted via urls.py:28)
    # These preserve frontend contract stability during native-only migration.
    # =========================================================================

    # Portfolio CRUD — same native views, legacy URL path
    path('portfolio/portfolios/', views.PortfolioListCreateView.as_view(), name='legacy-portfolio-list'),
    path('portfolio/portfolios/<int:portfolio_id>/', views.PortfolioDetailView.as_view(), name='legacy-portfolio-detail'),
    path('portfolio/portfolios/<int:portfolio_id>/transactions/', views.TransactionListCreateView.as_view(), name='legacy-portfolio-transactions'),

    # Portfolio analytics — stubs (not yet migrated)
    path('portfolio/portfolios/<int:portfolio_id>/holdings/', PortfolioListAnalyticsStubView.as_view(), name='legacy-portfolio-holdings'),
    path('portfolio/portfolios/<int:portfolio_id>/summary/', PortfolioAnalyticsStubView.as_view(), name='legacy-portfolio-summary'),
    path('portfolio/portfolios/<int:portfolio_id>/chart/', PortfolioAnalyticsStubView.as_view(), name='legacy-portfolio-chart'),
    path('portfolio/portfolios/<int:portfolio_id>/equity-curve/', PortfolioAnalyticsStubView.as_view(), name='legacy-portfolio-equity-curve'),
    path('portfolio/portfolios/<int:portfolio_id>/allocation/', PortfolioAnalyticsStubView.as_view(), name='legacy-portfolio-allocation'),
    path('portfolio/portfolios/<int:portfolio_id>/analytics/', PortfolioAnalyticsStubView.as_view(), name='legacy-portfolio-analytics'),
    path('portfolio/portfolios/<int:portfolio_id>/technicals/', PortfolioListAnalyticsStubView.as_view(), name='legacy-portfolio-technicals'),
    path('portfolio/portfolios/<int:portfolio_id>/sync/', PortfolioAnalyticsStubView.as_view(), name='legacy-portfolio-sync'),

    # SubAccounts — stubs
    path('portfolio/subaccounts/', GenericEmptyListView.as_view(), name='legacy-subaccount-list'),
    path('portfolio/subaccounts/<int:pk>/', GenericEmptyListView.as_view(), name='legacy-subaccount-detail'),
    path('portfolio/subaccounts/<int:pk>/transactions/', GenericEmptyListView.as_view(), name='legacy-subaccount-transactions'),
    path('portfolio/transactions/<int:pk>/', PortfolioAnalyticsStubView.as_view(), name='legacy-transaction-detail'),

    # Watchlist — real data, legacy response shape
    path('portfolio/watchlist/groups/', LegacyWatchlistGroupListView.as_view(), name='legacy-watchlist-group-list'),
    path('portfolio/watchlist/groups/<int:pk>/', LegacyWatchlistGroupDetailView.as_view(), name='legacy-watchlist-group-detail'),
    path('portfolio/watchlist/groups/<int:group_id>/items/', LegacyWatchlistItemCreateView.as_view(), name='legacy-watchlist-item-create'),
    path('portfolio/watchlist/items/<int:pk>/', LegacyWatchlistItemDeleteView.as_view(), name='legacy-watchlist-item-delete'),
    path('portfolio/watchlist/seed/', GenericEmptyStaffView.as_view(), name='legacy-watchlist-seed'),
    path('portfolio/watchlist/sync/', GenericEmptyStaffView.as_view(), name='legacy-watchlist-sync'),

    # Portfolio user config
    path('portfolio/userconfig/', PortfolioUserConfigView.as_view(), name='legacy-portfolio-userconfig'),

    # Portfolio AI advisory & misc — stubs
    path('portfolio/ai-advisory/', GenericEmptyListView.as_view(), name='legacy-ai-advisory-list'),
    path('portfolio/ai-advisory/<str:symbol>/canonical/', PortfolioAnalyticsStubView.as_view(), name='legacy-ai-advisory-canonical'),
    path('portfolio/ai-advisory/<str:symbol>/current/', PortfolioAnalyticsStubView.as_view(), name='legacy-ai-advisory-current'),
    path('portfolio/ai-advisory/<str:symbol>/auto-refresh-info/', PortfolioAnalyticsStubView.as_view(), name='legacy-ai-advisory-auto-refresh'),
    path('portfolio/ai-advisory/<str:symbol>/refresh/', PortfolioAnalyticsStubView.as_view(), name='legacy-ai-advisory-refresh'),
    path('portfolio/ai-advisory-symbol-stats/', GenericEmptyListView.as_view(), name='legacy-ai-advisory-stats'),
    path('portfolio/ai-command-center/', PortfolioAnalyticsStubView.as_view(), name='legacy-ai-cc'),
    path('portfolio/ai-command-center/test-connection/', PortfolioAnalyticsStubView.as_view(), name='legacy-ai-cc-test'),
    path('portfolio/ai-command-center/audit-logs/', GenericEmptyListView.as_view(), name='legacy-ai-cc-audit'),
    path('portfolio/market-discovery-hub/', PortfolioAnalyticsStubView.as_view(), name='legacy-market-discovery'),
    path('portfolio/whale/analytics/<str:symbol>/', PortfolioAnalyticsStubView.as_view(), name='legacy-whale-analytics'),
    path('portfolio/whale/backtest-stats/', PortfolioAnalyticsStubView.as_view(), name='legacy-whale-backtest'),
    path('portfolio/screener/rules/', GenericEmptyListView.as_view(), name='legacy-screener-rules'),
    path('portfolio/screener/rules/<int:pk>/', PortfolioAnalyticsStubView.as_view(), name='legacy-screener-rule-detail'),
    path('portfolio/screener/rules/<int:pk>/run/', PortfolioAnalyticsStubView.as_view(), name='legacy-screener-rule-run'),
    path('portfolio/admin/screener/config/', GenericEmptyStaffView.as_view(), name='legacy-screener-config'),
    path('portfolio/admin/screener/rules/', GenericEmptyStaffView.as_view(), name='legacy-screener-global-rules'),
    path('portfolio/admin/screener/rules/<int:pk>/', GenericEmptyStaffView.as_view(), name='legacy-screener-global-rule-detail'),
    path('portfolio/admin/screener/run-manual/', GenericEmptyStaffView.as_view(), name='legacy-screener-run-manual'),

    # Broker Integration (DNSE) — Native Core Implementation
    path('broker/dnse/config/', views_dnse.dnse_config_api, name='dnse-broker-config'),
    path('broker/dnse/sync-accounts/', views_dnse.dnse_sync_accounts_api, name='dnse-broker-sync-accounts'),
    path('broker/dnse/place-order/', views_dnse.dnse_place_order_api, name='dnse-broker-place-order'),
    path('broker/dnse/token-status/', views_dnse.dnse_token_status_api, name='dnse-broker-token-status'),
]
