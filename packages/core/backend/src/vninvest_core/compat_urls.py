"""
Compatibility URL patterns for legacy frontend API paths.

Maps legacy `/api/<legacy-prefix>/` paths to either existing core domain views
or graceful stub views provided in compat_views.py.

Register LAST under path('api/', ...) in urls.py so native routes take precedence.
"""
from django.urls import path

from user_workspace.views import (
    PortfolioDetailView,
    PortfolioListCreateView,
    TransactionListCreateView,
)
from .compat_views import (
    # admin-ops
    AdminOpsRuntimeKPIView,
    AdminOpsStatsView,
    AdminOpsStubActionView,
    AdminOpsSystemAiSettingsView,
    AdminOpsVnstockBenchmarkView,
    AdminOpsVnstockConfigChangelogView,
    AdminOpsVnstockConfigCurrentView,
    GenericEmptyListView,
    GenericEmptyStaffView,
    # stock-management
    LegacyWatchlistGroupDetailView,
    LegacyWatchlistGroupListView,
    LegacyWatchlistItemCreateView,
    LegacyWatchlistItemDeleteView,
    PortfolioAnalyticsStubView,
    PortfolioUserConfigView,
    PriceAlertDetailView,
    PriceAlertsView,
    StockManagementGroupsView,
    StockManagementStubView,
    TrackedSymbolsView,
)

urlpatterns = [
    # -------------------------------------------------------------------------
    # Portfolios — real data from user_workspace
    # -------------------------------------------------------------------------
    path('portfolio/portfolios/', PortfolioListCreateView.as_view(), name='compat-portfolio-list'),
    path('portfolio/portfolios/<int:portfolio_id>/', PortfolioDetailView.as_view(), name='compat-portfolio-detail'),
    path('portfolio/portfolios/<int:portfolio_id>/transactions/', TransactionListCreateView.as_view(), name='compat-portfolio-transactions'),

    # Portfolio analytics — not yet migrated, return empty stubs
    path('portfolio/portfolios/<int:portfolio_id>/holdings/', PortfolioAnalyticsStubView.as_view(), name='compat-portfolio-holdings'),
    path('portfolio/portfolios/<int:portfolio_id>/summary/', PortfolioAnalyticsStubView.as_view(), name='compat-portfolio-summary'),
    path('portfolio/portfolios/<int:portfolio_id>/chart/', PortfolioAnalyticsStubView.as_view(), name='compat-portfolio-chart'),
    path('portfolio/portfolios/<int:portfolio_id>/equity-curve/', PortfolioAnalyticsStubView.as_view(), name='compat-portfolio-equity-curve'),
    path('portfolio/portfolios/<int:portfolio_id>/allocation/', PortfolioAnalyticsStubView.as_view(), name='compat-portfolio-allocation'),
    path('portfolio/portfolios/<int:portfolio_id>/analytics/', PortfolioAnalyticsStubView.as_view(), name='compat-portfolio-analytics'),
    path('portfolio/portfolios/<int:portfolio_id>/technicals/', PortfolioAnalyticsStubView.as_view(), name='compat-portfolio-technicals'),
    path('portfolio/portfolios/<int:portfolio_id>/sync/', PortfolioAnalyticsStubView.as_view(), name='compat-portfolio-sync'),

    # SubAccounts — not yet migrated
    path('portfolio/subaccounts/', GenericEmptyListView.as_view(), name='compat-subaccount-list'),
    path('portfolio/subaccounts/<int:pk>/', GenericEmptyListView.as_view(), name='compat-subaccount-detail'),
    path('portfolio/subaccounts/<int:pk>/transactions/', GenericEmptyListView.as_view(), name='compat-subaccount-transactions'),
    path('portfolio/transactions/<int:pk>/', PortfolioAnalyticsStubView.as_view(), name='compat-transaction-detail'),

    # -------------------------------------------------------------------------
    # Watchlist — maps to core user_workspace Watchlist model
    # -------------------------------------------------------------------------
    path('portfolio/watchlist/groups/', LegacyWatchlistGroupListView.as_view(), name='compat-watchlist-group-list'),
    path('portfolio/watchlist/groups/<int:pk>/', LegacyWatchlistGroupDetailView.as_view(), name='compat-watchlist-group-detail'),
    path('portfolio/watchlist/groups/<int:group_id>/items/', LegacyWatchlistItemCreateView.as_view(), name='compat-watchlist-item-create'),
    path('portfolio/watchlist/items/<int:pk>/', LegacyWatchlistItemDeleteView.as_view(), name='compat-watchlist-item-delete'),
    path('portfolio/watchlist/seed/', AdminOpsStubActionView.as_view(), name='compat-watchlist-seed'),
    path('portfolio/watchlist/sync/', AdminOpsStubActionView.as_view(), name='compat-watchlist-sync'),

    # -------------------------------------------------------------------------
    # Portfolio user config
    # -------------------------------------------------------------------------
    path('portfolio/userconfig/', PortfolioUserConfigView.as_view(), name='compat-portfolio-userconfig'),

    # -------------------------------------------------------------------------
    # Portfolio AI advisory & misc — stubs
    # -------------------------------------------------------------------------
    path('portfolio/ai-advisory/', GenericEmptyListView.as_view(), name='compat-ai-advisory-list'),
    path('portfolio/ai-advisory/<str:symbol>/canonical/', PortfolioAnalyticsStubView.as_view(), name='compat-ai-advisory-canonical'),
    path('portfolio/ai-advisory/<str:symbol>/current/', PortfolioAnalyticsStubView.as_view(), name='compat-ai-advisory-current'),
    path('portfolio/ai-advisory/<str:symbol>/auto-refresh-info/', PortfolioAnalyticsStubView.as_view(), name='compat-ai-advisory-auto-refresh'),
    path('portfolio/ai-advisory/<str:symbol>/refresh/', PortfolioAnalyticsStubView.as_view(), name='compat-ai-advisory-refresh'),
    path('portfolio/ai-advisory-symbol-stats/', GenericEmptyListView.as_view(), name='compat-ai-advisory-stats'),
    path('portfolio/ai-command-center/', PortfolioAnalyticsStubView.as_view(), name='compat-ai-cc'),
    path('portfolio/ai-command-center/test-connection/', PortfolioAnalyticsStubView.as_view(), name='compat-ai-cc-test'),
    path('portfolio/ai-command-center/audit-logs/', GenericEmptyListView.as_view(), name='compat-ai-cc-audit'),
    path('portfolio/market-discovery-hub/', PortfolioAnalyticsStubView.as_view(), name='compat-market-discovery'),
    path('portfolio/whale/analytics/<str:symbol>/', PortfolioAnalyticsStubView.as_view(), name='compat-whale-analytics'),
    path('portfolio/whale/backtest-stats/', PortfolioAnalyticsStubView.as_view(), name='compat-whale-backtest'),
    path('portfolio/screener/rules/', GenericEmptyListView.as_view(), name='compat-screener-rules'),
    path('portfolio/screener/rules/<int:pk>/', PortfolioAnalyticsStubView.as_view(), name='compat-screener-rule-detail'),
    path('portfolio/screener/rules/<int:pk>/run/', PortfolioAnalyticsStubView.as_view(), name='compat-screener-rule-run'),
    path('portfolio/admin/screener/config/', GenericEmptyStaffView.as_view(), name='compat-screener-config'),
    path('portfolio/admin/screener/rules/', GenericEmptyStaffView.as_view(), name='compat-screener-global-rules'),
    path('portfolio/admin/screener/rules/<int:pk>/', GenericEmptyStaffView.as_view(), name='compat-screener-global-rule-detail'),
    path('portfolio/admin/screener/run-manual/', GenericEmptyStaffView.as_view(), name='compat-screener-run-manual'),

    # -------------------------------------------------------------------------
    # Stock-management — stubs (legacy SecuritiesGroup, TrackedSymbol, PriceAlert)
    # -------------------------------------------------------------------------
    path('stock-management/groups/', StockManagementGroupsView.as_view(), name='compat-sm-groups'),
    path('stock-management/seed/', AdminOpsStubActionView.as_view(), name='compat-sm-seed'),
    path('stock-management/sync/', AdminOpsStubActionView.as_view(), name='compat-sm-sync'),
    path('stock-management/tracked-symbols/', TrackedSymbolsView.as_view(), name='compat-tracked-symbols'),
    path('stock-management/tracked-symbols/<int:pk>/', StockManagementStubView.as_view(), name='compat-tracked-symbol-detail'),
    path('stock-management/tracked-symbols/bulk-threshold/', StockManagementStubView.as_view(), name='compat-tracked-symbol-bulk'),
    path('stock-management/price-alerts/', PriceAlertsView.as_view(), name='compat-price-alerts'),
    path('stock-management/price-alerts/<int:pk>/', PriceAlertDetailView.as_view(), name='compat-price-alert-detail'),
    path('stock-management/price-alerts/<int:pk>/mark-triggered/', StockManagementStubView.as_view(), name='compat-price-alert-trigger'),
    path('stock-management/technicals/bulk/', StockManagementStubView.as_view(), name='compat-technicals-bulk'),
    path('stock-management/stocks/<str:symbol>/', StockManagementStubView.as_view(), name='compat-stock-profile'),
    path('stock-management/stocks/<str:symbol>/overview/', StockManagementStubView.as_view(), name='compat-stock-overview'),
    path('stock-management/stocks/<str:symbol>/chart/', StockManagementStubView.as_view(), name='compat-stock-chart'),
    path('stock-management/stocks/<str:symbol>/order-flow/', StockManagementStubView.as_view(), name='compat-stock-order-flow'),
    path('stock-management/stocks/<str:symbol>/news/', StockManagementStubView.as_view(), name='compat-stock-news'),
    path('stock-management/stocks/<str:symbol>/news/ai-summary/', StockManagementStubView.as_view(), name='compat-stock-news-summary'),
    path('stock-management/stocks/<str:symbol>/ai-advisory-session/', StockManagementStubView.as_view(), name='compat-stock-advisory'),
    path('stock-management/stocks/<str:symbol>/ai-advisory-observability/', StockManagementStubView.as_view(), name='compat-stock-advisory-obs'),
    path('stock-management/stocks/<str:symbol>/ai-advisory-components/generate/', StockManagementStubView.as_view(), name='compat-advisory-components-gen'),
    path('stock-management/stocks/<str:symbol>/ai-advisory-components/deleted/', StockManagementStubView.as_view(), name='compat-advisory-components-del'),
    path('stock-management/stocks/<str:symbol>/ai-advisory-summary/regenerate/', StockManagementStubView.as_view(), name='compat-advisory-summary-regen'),
    path('stock-management/stocks/<str:symbol>/ai-advisory-summary/<str:summary_id>/', StockManagementStubView.as_view(), name='compat-advisory-summary-del'),
    path('stock-management/stocks/<str:symbol>/financials/', StockManagementStubView.as_view(), name='compat-stock-financials'),
    path('stock-management/ai-advisory-components/<str:pk>/toggle-include/', StockManagementStubView.as_view(), name='compat-advisory-comp-toggle'),
    path('stock-management/ai-advisory-components/<str:pk>/refresh/', StockManagementStubView.as_view(), name='compat-advisory-comp-refresh'),
    path('stock-management/ai-advisory-components/<str:pk>/restore/', StockManagementStubView.as_view(), name='compat-advisory-comp-restore'),
    path('stock-management/ai-advisory-components/<str:pk>/', StockManagementStubView.as_view(), name='compat-advisory-comp-detail'),
    path('stock-management/portfolio/news-digest/', StockManagementStubView.as_view(), name='compat-portfolio-news-digest'),

    # -------------------------------------------------------------------------
    # Realtime — stubs for endpoints not yet in core
    # -------------------------------------------------------------------------
    path('realtime/ticker/<str:symbol>/', StockManagementStubView.as_view(), name='compat-realtime-ticker'),
    path('realtime/tickers/', StockManagementStubView.as_view(), name='compat-realtime-tickers'),
    path('realtime/intraday/<str:symbol>/', StockManagementStubView.as_view(), name='compat-realtime-intraday'),
    path('realtime/price-board/<str:symbol>/', StockManagementStubView.as_view(), name='compat-realtime-price-board'),
    path('realtime/breadth/<str:symbol>/', StockManagementStubView.as_view(), name='compat-realtime-breadth'),
    path('realtime/whale-feed/<str:symbol>/', StockManagementStubView.as_view(), name='compat-realtime-whale-feed'),
    path('realtime/whale-feed/aggregate/', StockManagementStubView.as_view(), name='compat-realtime-whale-aggregate'),
    path('realtime/whale-campaigns/', StockManagementStubView.as_view(), name='compat-realtime-whale-campaigns'),
    path('realtime/unified-alerts/', StockManagementStubView.as_view(), name='compat-realtime-unified-alerts'),
    path('realtime/symbol-investigation/<str:symbol>/', StockManagementStubView.as_view(), name='compat-realtime-symbol-investigation'),
    path('realtime/rvol/<str:symbol>/', StockManagementStubView.as_view(), name='compat-realtime-rvol'),
    path('realtime/depth-chart/<str:symbol>/', StockManagementStubView.as_view(), name='compat-realtime-depth-chart'),

    # -------------------------------------------------------------------------
    # Admin-ops — partial data from core, rest stubbed
    # -------------------------------------------------------------------------
    path('admin-ops/stats/', AdminOpsStatsView.as_view(), name='compat-admin-ops-stats'),
    path('admin-ops/runtime-kpi/', AdminOpsRuntimeKPIView.as_view(), name='compat-admin-ops-kpi'),
    path('admin-ops/system-ai-settings/', AdminOpsSystemAiSettingsView.as_view(), name='compat-admin-ops-ai-settings'),
    path('admin-ops/vnstock-config/current/', AdminOpsVnstockConfigCurrentView.as_view(), name='compat-vnstock-current'),
    path('admin-ops/vnstock-config/update-config/', AdminOpsVnstockConfigCurrentView.as_view(), name='compat-vnstock-update'),
    path('admin-ops/vnstock-config/reset-to-defaults/', AdminOpsStubActionView.as_view(), name='compat-vnstock-reset'),
    path('admin-ops/vnstock-config/changelog/', AdminOpsVnstockConfigChangelogView.as_view(), name='compat-vnstock-changelog'),
    path('admin-ops/vnstock-config/benchmark-price-board/latest/', AdminOpsVnstockBenchmarkView.as_view(), name='compat-vnstock-bench-latest'),
    path('admin-ops/vnstock-config/benchmark-price-board/run/', AdminOpsVnstockBenchmarkView.as_view(), name='compat-vnstock-bench-run'),
    path('admin-ops/prefetch/warm/', AdminOpsStubActionView.as_view(), name='compat-prefetch-warm'),
    path('admin-ops/market-groups/sync/', AdminOpsStubActionView.as_view(), name='compat-market-groups-sync'),
    path('admin-ops/intraday-side-backfill/preview/', AdminOpsStubActionView.as_view(), name='compat-intraday-backfill-preview'),
    path('admin-ops/intraday-side-backfill/apply/', AdminOpsStubActionView.as_view(), name='compat-intraday-backfill-apply'),
    path('admin-ops/intraday-side-backfill/status/<str:task_id>/', AdminOpsStubActionView.as_view(), name='compat-intraday-backfill-status'),
    path('admin-ops/intraday-universe/warm-now/', AdminOpsStubActionView.as_view(), name='compat-intraday-universe-warm'),
    path('admin-ops/signals/summary/', AdminOpsStubActionView.as_view(), name='compat-admin-signals-summary'),
    path('admin-ops/signals/config/', AdminOpsStubActionView.as_view(), name='compat-admin-signals-config'),
    path('admin-ops/signals/config/preview/', AdminOpsStubActionView.as_view(), name='compat-admin-signals-config-preview'),
    path('admin-ops/signals/universe/preview/', AdminOpsStubActionView.as_view(), name='compat-admin-signals-universe-preview'),
    path('admin-ops/signals/universe/apply/', AdminOpsStubActionView.as_view(), name='compat-admin-signals-universe-apply'),
    path('admin-ops/signals/money-flow/materialization/preview/', AdminOpsStubActionView.as_view(), name='compat-admin-signals-mf-preview'),
    path('admin-ops/signals/jobs/', AdminOpsStubActionView.as_view(), name='compat-admin-signals-jobs'),
    path('admin-ops/signals/jobs/run/', AdminOpsStubActionView.as_view(), name='compat-admin-signals-jobs-run'),
    path('admin-ops/signals/jobs/<str:run_id>/retry/', AdminOpsStubActionView.as_view(), name='compat-admin-signals-job-retry'),
    path('admin-ops/signals/events/recent/', AdminOpsStubActionView.as_view(), name='compat-admin-signals-events'),
    path('admin-ops/signals/retention/preview/', AdminOpsStubActionView.as_view(), name='compat-admin-signals-retention'),

    # -------------------------------------------------------------------------
    # Admin-sync stubs
    # -------------------------------------------------------------------------
    path('admin-sync/stockprofile/', AdminOpsStubActionView.as_view(), name='compat-admin-sync-stockprofile'),

    # -------------------------------------------------------------------------
    # AI options
    # -------------------------------------------------------------------------
    path('ai-options/', GenericEmptyListView.as_view(), name='compat-ai-options'),

    # -------------------------------------------------------------------------
    # Public legal pages — might be handled by core already, but stub as safety net
    # -------------------------------------------------------------------------
    path('public/legal-pages/', GenericEmptyListView.as_view(), name='compat-legal-pages'),

    # -------------------------------------------------------------------------
    # Crawl jobs stubs (v1 namespace)
    # -------------------------------------------------------------------------
    path('v1/admin/crawl/jobs/', GenericEmptyStaffView.as_view(), name='compat-crawl-jobs'),
    path('v1/admin/crawl/jobs/<str:pk>/run/', GenericEmptyStaffView.as_view(), name='compat-crawl-jobs-run'),

    # -------------------------------------------------------------------------
    # Health check for realtime
    # -------------------------------------------------------------------------
    path('health/realtime/', AdminOpsStubActionView.as_view(), name='compat-health-realtime'),
]
