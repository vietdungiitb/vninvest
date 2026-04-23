from django.conf import settings
from django.urls import path, include
from django.views.decorators.csrf import csrf_exempt
from rest_framework.routers import DefaultRouter
from . import trading_views, views
from .views_whale_orders import whale_orders_by_symbol_api
from .views_stock_order_flow import market_discovery_hub_api
from .opencore_api import (
    DPILicenseViewSet, DPIUsageViewSet, DPIPremiumIndicatorsViewSet,
    DPIBillingViewSet
)
from .views_whale_orchestration import (
    whale_service_trigger_api,
    whale_service_jobs_list_api,
    whale_service_job_status_api,
    whale_service_job_retry_api,
)


def _toggle_trading_view(view_name: str):
    legacy_view = getattr(views, view_name).as_view()
    refactored_view = getattr(trading_views, view_name).as_view()

    def _view(request, *args, **kwargs):
        selected_view = refactored_view if getattr(settings, 'ENABLE_NEW_TRADING_VIEWS', False) else legacy_view
        return selected_view(request, *args, **kwargs)

    # Keep CSRF exemption on wrapped API views; otherwise POST/PUT/PATCH/DELETE may return 403.
    return csrf_exempt(_view)

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
    path('portfolios/<int:portfolio_id>/technicals/', views.PortfolioTechnicalView.as_view(), name='portfolio-technicals'),
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
    path('whale-advisory/<str:symbol>/auto-refresh-info/', views.whale_advisory_auto_refresh_info_api, name='whale-advisory-auto-refresh-info'),
    path('whale-advisory/<str:symbol>/canonical/', views.ai_advisory_canonical_symbol_api, name='whale-advisory-canonical-symbol'),
    path('whale-advisory/<str:symbol>/refresh/', views.refresh_whale_advisory_api, name='whale-advisory-refresh'),
    path('whale-advisory/<str:symbol>/current/', views.delete_current_whale_advisory_api, name='whale-advisory-current-delete'),
    path('whale-advisory-symbol-stats/', views.whale_advisory_symbol_stats_api, name='whale-advisory-symbol-stats'),

    # --- AI Advisory aliases (new naming, backward compatible) ---
    path('ai-advisory/', views.WhaleAdvisoryListView.as_view(), name='ai-advisory-list'),
    path('ai-advisory/<str:symbol>/auto-refresh-info/', views.whale_advisory_auto_refresh_info_api, name='ai-advisory-auto-refresh-info'),
    path('ai-advisory/<str:symbol>/canonical/', views.ai_advisory_canonical_symbol_api, name='ai-advisory-canonical-symbol'),
    path('ai-advisory/<str:symbol>/refresh/', views.refresh_whale_advisory_api, name='ai-advisory-refresh'),
    path('ai-advisory/<str:symbol>/current/', views.delete_current_whale_advisory_api, name='ai-advisory-current-delete'),
    path('ai-advisory-symbol-stats/', views.whale_advisory_symbol_stats_api, name='ai-advisory-symbol-stats'),
]

# ============================================================================
# OpenCore API Router
# ============================================================================
opencore_router = DefaultRouter()
opencore_router.register(r'license', DPILicenseViewSet, basename='dpi-license')
opencore_router.register(r'usage', DPIUsageViewSet, basename='dpi-usage')
opencore_router.register(r'indicators', DPIPremiumIndicatorsViewSet, basename='dpi-indicators')
opencore_router.register(r'billing', DPIBillingViewSet, basename='dpi-billing')

urlpatterns += [
    path('opencore/', include(opencore_router.urls), name='opencore-api'),

    # ── PR-3: Sentiment API ──────────────────────────────────────────────────
    path('stock/<str:symbol>/sentiment/', views.sentiment_detail_api, name='stock-sentiment-detail'),

    # ── PR-4: Notifications / Telegram ──────────────────────────────────────
    path('notifications/telegram/link/', views.telegram_generate_link, name='telegram-generate-link'),
    path('notifications/telegram/unlink/', views.telegram_unlink, name='telegram-unlink'),
    path('notifications/telegram/webhook/', views.telegram_webhook, name='telegram-webhook'),
    path('notifications/telegram/status/', views.telegram_status, name='telegram-status'),
    path('notifications/telegram/settings/', views.telegram_settings_update, name='telegram-settings-update'),
    path('notifications/preferred-symbols/', views.preferred_symbols_list, name='preferred-symbols-list'),
    path('notifications/preferred-symbols/<str:symbol>/', views.preferred_symbols_delete, name='preferred-symbols-delete'),

    # ── PR-5: Backtest Stats API ─────────────────────────────────────────────
    path('whale/backtest-stats/', views.backtest_stats_api, name='whale-backtest-stats'),

    # ── Whale Bubble Chart Orders API (Pro+) ─────────────────────────────────
    path('market-discovery-hub/', market_discovery_hub_api, name='market-discovery-hub'),
    path('whale/orders/<str:symbol>/', whale_orders_by_symbol_api, name='whale-orders-by-symbol'),

    # ── Whale Service Orchestration (Phase 4) ────────────────────────────────
    path('whale-service/trigger/', whale_service_trigger_api, name='whale-service-trigger'),
    path('whale-service/jobs/', whale_service_jobs_list_api, name='whale-service-jobs-list'),
    path('whale-service/jobs/<int:job_id>/', whale_service_job_status_api, name='whale-service-job-status'),
    path('whale-service/jobs/<int:job_id>/retry/', whale_service_job_retry_api, name='whale-service-job-retry'),
]
