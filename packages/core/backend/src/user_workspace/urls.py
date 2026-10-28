from django.urls import path

from . import views, views_broker, views_dnse, views_retail

# C4: Real portfolio analytics views (replaces stubs)
from .portfolio_analytics_views import (
    PortfolioHoldingsView,
    PortfolioSummaryView,
    PortfolioChartView,
    PortfolioEquityCurveView,
    PortfolioAllocationView,
    PortfolioMetricsView,
    PortfolioAnalyticsView,
    PortfolioTechnicalsView,
    PortfolioAIAdvisoryCanonicalView,
    PortfolioAICommandCenterView,
    PortfolioAICommandCenterPolicyView,
    PortfolioAICommandCenterPromptConfigRollbackView,
    PortfolioAICommandCenterTestView,
    PortfolioAICommandCenterAuditLogView,
    PortfolioAICommandCenterAuditExportView,
    PortfolioAICommandCenterTracesView,
    PortfolioAICommandCenterTenantPolicyView,
    PortfolioAIProviderCatalogView,
    PortfolioUserConfigLegacyView,
    PortfolioMarketDiscoveryHubView,
    PortfolioWhaleAnalyticsView,
    PortfolioScreenerRuleDetailView,
    PortfolioScreenerRuleRunView,
    PortfolioScreenerRuleRunStatusView,
    PortfolioAIAdvisoryListView,
    PortfolioAIAdvisorySymbolStatsView,
    ScreenerTemplatesView,
    ScreenerHistoryListView,
    ScreenerHistoryDetailView,
    ScreenerHistoryBacktestView,
    ScreenerScheduleListCreateView,
    ScreenerScheduleDetailView,
    ScreenerScheduleRunNowView,
    ScreenerScheduleAlertsView,
)

# Screener views
from .views import (
    ScreenerRuleListCreateAPIView,
    ScreenerPublicRuleListAPIView,
    ScreenerRuleForkAPIView,
)

urlpatterns = [
    # Native workspace paths (core/v1/ namespace)
    path('workspace/portfolios/', views.PortfolioListCreateView.as_view(), name='portfolio-list'),
    path('workspace/portfolios/<int:portfolio_id>/', views.PortfolioDetailView.as_view(), name='portfolio-detail'),
    path('workspace/portfolios/<int:portfolio_id>/transactions/', views.TransactionListCreateView.as_view(), name='transaction-list'),
    path('workspace/portfolios/<int:portfolio_id>/holdings/', PortfolioHoldingsView.as_view(), name='portfolio-holdings'),
    path('workspace/portfolios/<int:portfolio_id>/summary/', PortfolioSummaryView.as_view(), name='portfolio-summary'),
    path('workspace/portfolios/<int:portfolio_id>/analytics/', PortfolioAnalyticsView.as_view(), name='portfolio-analytics'),
    # FE portfolio workspace (S-00a): 3 view da ton tai va da duoc import tu truoc nhung
    # CHUA co path() nao tro toi chung - xem docs/KE_HOACH_THIET_KE_FRONTEND_PORTFOLIO_20261007.md S-00a.
    # `PortfolioChartView` la ALIAS: no goi thang `PortfolioEquityCurveView().get(...)`
    # (portfolio_analytics_views.py:339-342) nen tra DUNG NOI DUNG voi `equity-curve`.
    # Giu lai de khong pha contract cho client cu, khong dung de so sanh 2 lan.
    path('workspace/portfolios/<int:portfolio_id>/equity-curve/', PortfolioEquityCurveView.as_view(), name='portfolio-equity-curve'),
    path('workspace/portfolios/<int:portfolio_id>/allocation/', PortfolioAllocationView.as_view(), name='portfolio-allocation'),
    path('workspace/portfolios/<int:portfolio_id>/chart/', PortfolioChartView.as_view(), name='portfolio-chart'),
    # S-00b: 4 ham analytics (performance/risk_metrics/benchmark_metrics/freshness)
    # da co san trong `ledger/analytics.py` nhung 0 caller - code chet. Route nay
    # la noi gọi DAU TIEN cua chung. Chi bao 4 nhom metric co that; KHONG khai
    # sharpe/sortino/correlation vi backend khong tinh (grep -c = 2 comment, 0, 0).
    path('workspace/portfolios/<int:portfolio_id>/metrics/', PortfolioMetricsView.as_view(), name='portfolio-metrics'),
    path('workspace/portfolios/<int:portfolio_id>/technicals/', PortfolioTechnicalsView.as_view(), name='portfolio-technicals'),
    path('workspace/transactions/<int:transaction_id>/', views.TransactionDetailView.as_view(), name='transaction-detail'),
    path('workspace/watchlists/', views.WatchlistListCreateView.as_view(), name='watchlist-list'),
    path('workspace/watchlists/<int:watchlist_id>/', views.WatchlistDetailView.as_view(), name='watchlist-detail'),
    path('workspace/watchlists/<int:watchlist_id>/items/', views.WatchlistItemListCreateView.as_view(), name='watchlist-items'),
    path('workspace/watchlists/<int:watchlist_id>/items/<str:symbol>/', views.WatchlistItemDeleteView.as_view(), name='watchlist-item-delete'),
    path('workspace/whale-analytics/<str:symbol>/', PortfolioWhaleAnalyticsView.as_view(), name='workspace-whale-analytics'),
    path('workspace/ai-command-center/', PortfolioAICommandCenterView.as_view(), name='workspace-ai-cc-direct'),
    path('workspace/ai-command-center/policy/', PortfolioAICommandCenterPolicyView.as_view(), name='workspace-ai-cc-policy'),
    path('workspace/ai-command-center/test-connection/', PortfolioAICommandCenterTestView.as_view(), name='workspace-ai-cc-test'),
    path('workspace/ai-command-center/prompt-config/rollback/', PortfolioAICommandCenterPromptConfigRollbackView.as_view(), name='workspace-ai-cc-prompt-rollback'),
    path('workspace/ai-command-center/audit-logs/', PortfolioAICommandCenterAuditLogView.as_view(), name='workspace-ai-cc-audit-logs'),
    # R4.3: export CSV audit log (append-only ⇒ chỉ GET, không có route put/delete).
    path(
        'workspace/ai-command-center/audit-logs/export/',
        PortfolioAICommandCenterAuditExportView.as_view(),
        name='workspace-ai-cc-audit-export',
    ),
    # R3.2: đọc trace của chính người gọi (trang "Traces").
    path('workspace/ai-command-center/traces/', PortfolioAICommandCenterTracesView.as_view(), name='workspace-ai-cc-traces'),
    # R4.1: policy AI cấp tenant (admin tenant ghi; staff chỉ đọc đa tenant).
    path(
        'workspace/ai-command-center/tenant-policy/',
        PortfolioAICommandCenterTenantPolicyView.as_view(),
        name='workspace-ai-cc-tenant-policy',
    ),
    # R2.10: danh muc model THAT theo tai khoan (khong hardcode).
    path(
        'workspace/ai-command-center/providers/<str:provider>/models/',
        PortfolioAIProviderCatalogView.as_view(),
        name='workspace-ai-cc-provider-models',
    ),
    path('workspace/userconfig/', PortfolioUserConfigLegacyView.as_view(), name='workspace-userconfig'),

    # Legacy compat: portfolio ai-advisory routes (proxy for legacy frontend client.js calls)
    path('portfolio/ai-advisory/', PortfolioAIAdvisoryListView.as_view(), name='portfolio-ai-advisory-list'),
    path('portfolio/ai-advisory-symbol-stats/', PortfolioAIAdvisorySymbolStatsView.as_view(), name='portfolio-ai-advisory-symbol-stats'),
    path('portfolio/ai-advisory/<str:symbol>/canonical/', PortfolioAIAdvisoryCanonicalView.as_view(), name='portfolio-ai-advisory-canonical'),
    # View da ton tai (PortfolioMarketDiscoveryHubView) nhung CHUA duoc route, nen
    # `getMarketDiscoveryHub` cua frontend luon 404 o discovery mode. Route stub
    # tra payload co khuon de FE fail-soft thay vi nem loi.
    path('portfolio/market-discovery-hub/', PortfolioMarketDiscoveryHubView.as_view(), name='portfolio-market-discovery-hub'),

    # Sub-accounts native routes (migrated to native workspace core/v1/)
    path('portfolio/subaccounts/', views.SubAccountListCreateAPIView.as_view(), name='subaccount-list-create'),
    path('portfolio/subaccounts/<int:pk>/', views.SubAccountDetailAPIView.as_view(), name='subaccount-detail'),
    path('portfolio/subaccounts/<int:pk>/transactions/', views.SubAccountTransactionsAPIView.as_view(), name='subaccount-transactions'),

    # Broker config đa-nhà (B1.2, B0.6) — đặt TRƯỚC legacy DNSE để `broker/dnse/config/`
    # do view mới phục vụ (store UserBrokerConfig). B0.6: config mo ca 3 lane;
    # muc do ho tro that o `broker/capabilities/` (matrix versioned).
    path('broker/providers/', views_broker.broker_providers_api, name='broker-providers'),
    path('broker/capabilities/', views_broker.broker_capabilities_api, name='broker-capabilities'),
    path('broker/config-schema/<str:provider>/', views_broker.broker_config_schema_api, name='broker-config-schema'),
    path('broker/<str:provider>/config/', views_broker.broker_config_api, name='broker-config'),
    path('broker/<str:provider>/test-connection/', views_broker.broker_test_connection_api, name='broker-test-connection'),
    path('broker/<str:provider>/status/', views_broker.broker_config_api, name='broker-status'),
    path('broker/jobs/<str:job_id>/', views_broker.broker_job_status_api, name='broker-job-status'),

    # B1.6: doc broker hub read-only + gop danh muc (QĐ-C).
    path('broker/accounts/', views_broker.broker_accounts_api, name='broker-accounts'),
    path('broker/accounts/<int:account_id>/', views_broker.broker_account_detail_api, name='broker-account-detail'),
    path('broker/accounts/<int:account_id>/positions/', views_broker.broker_account_positions_api, name='broker-account-positions'),
    path('broker/accounts/<int:account_id>/balance/', views_broker.broker_account_balance_api, name='broker-account-balance'),
    path('broker/accounts/<int:account_id>/orders/', views_broker.broker_account_orders_api, name='broker-account-orders'),
    path('broker/accounts/<int:account_id>/sync/', views_broker.broker_account_sync_api, name='broker-account-sync'),
    path('broker/sync-runs/', views_broker.broker_sync_runs_api, name='broker-sync-runs'),
    path('broker/sync-issues/', views_broker.broker_sync_issues_api, name='broker-sync-issues'),
    path('workspace/portfolios/<int:portfolio_id>/broker-bindings/', views_broker.portfolio_broker_bindings_api, name='portfolio-broker-bindings'),

    # Broker Integration (DNSE) — Native Core Implementation (legacy, giữ 7 routes còn lại;
    # riêng config đã chuyển sang view mới ở trên — xóa route cũ để khỏi shadow)
    path('broker/dnse/sync-accounts/', views_dnse.dnse_sync_accounts_api, name='dnse-broker-sync-accounts'),
    path('broker/dnse/sync-balances/', views_dnse.dnse_sync_balances_api, name='dnse-broker-sync-balances'),
    path('broker/dnse/reconcile-transactions/', views_dnse.dnse_reconcile_transactions_api, name='dnse-broker-reconcile-transactions'),
    path('broker/dnse/send-email-otp/', views_dnse.dnse_send_email_otp_api, name='dnse-broker-send-email-otp'),
    path('broker/dnse/create-trading-token/', views_dnse.dnse_create_trading_token_api, name='dnse-broker-create-trading-token'),
    path('broker/dnse/place-order/', views_dnse.dnse_place_order_api, name='dnse-broker-place-order'),
    path('broker/dnse/token-status/', views_dnse.dnse_token_status_api, name='dnse-broker-token-status'),

    # Retail reference D1 (v34 upgrade) — vàng SJC/BTMC + tỷ giá VCB, không credential
    path('broker/retail/gold/', views_retail.retail_gold_api, name='broker-retail-gold'),
    path('broker/retail/exchange-rate/', views_retail.retail_exchange_rate_api, name='broker-retail-fx'),
]

# Screener endpoints
urlpatterns += [
    path('screener/rules/', ScreenerRuleListCreateAPIView.as_view(), name='screener-rules-list'),
    # W8 preset cộng đồng (static route trước <int:pk> để rõ ràng).
    path('screener/rules/public/', ScreenerPublicRuleListAPIView.as_view(), name='screener-rules-public'),
    path('screener/rules/<int:pk>/fork/', ScreenerRuleForkAPIView.as_view(), name='screener-rule-fork'),
    path('screener/rules/<int:pk>/', PortfolioScreenerRuleDetailView.as_view(), name='screener-rule-detail'),
    path('screener/rules/<int:pk>/run/', PortfolioScreenerRuleRunView.as_view(), name='screener-rule-run'),
    path('screener/rules/<int:pk>/run/status/', PortfolioScreenerRuleRunStatusView.as_view(), name='screener-rule-run-status'),
    path('screener/templates/', ScreenerTemplatesView.as_view(), name='screener-templates'),
    path('screener/history/', ScreenerHistoryListView.as_view(), name='screener-history-list'),
    path('screener/history/<int:pk>/', ScreenerHistoryDetailView.as_view(), name='screener-history-detail'),
    path('screener/history/<int:pk>/backtest/', ScreenerHistoryBacktestView.as_view(), name='screener-history-backtest'),
    path('screener/schedules/', ScreenerScheduleListCreateView.as_view(), name='screener-schedule-list'),
    path('screener/schedules/alerts/', ScreenerScheduleAlertsView.as_view(), name='screener-schedule-alerts'),
    path('screener/schedules/<int:pk>/', ScreenerScheduleDetailView.as_view(), name='screener-schedule-detail'),
    path('screener/schedules/<int:pk>/run-now/', ScreenerScheduleRunNowView.as_view(), name='screener-schedule-run-now'),
]
