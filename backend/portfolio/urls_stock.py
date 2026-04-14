import hashlib

from django.conf import settings
from django.urls import path

from . import market_views, views


def _toggle_market_view(view_name: str):
    legacy_view = getattr(views, view_name).as_view()
    refactored_view = getattr(market_views, view_name).as_view()

    def _resolve_canary_percent() -> int:
        try:
            configured = int(getattr(settings, 'MARKET_VIEWS_CANARY_PERCENT', 100))
        except (TypeError, ValueError):
            configured = 100
        return max(0, min(100, configured))

    def _should_use_refactored_view(request) -> bool:
        if not getattr(settings, 'ENABLE_NEW_MARKET_VIEWS', False):
            return False

        canary_percent = _resolve_canary_percent()
        if canary_percent >= 100:
            return True
        if canary_percent <= 0:
            return False

        if getattr(request, 'user', None) is not None and request.user.is_authenticated:
            seed = f'user:{request.user.id}'
        else:
            remote_addr = request.META.get('REMOTE_ADDR') or 'anonymous'
            seed = f'ip:{remote_addr}'

        bucket = int(hashlib.md5(seed.encode('utf-8')).hexdigest()[:8], 16) % 100
        return bucket < canary_percent

    def _view(request, *args, **kwargs):
        selected_view = refactored_view if _should_use_refactored_view(request) else legacy_view
        return selected_view(request, *args, **kwargs)

    return _view

app_name = "portfolio_stock"

urlpatterns = [
    # Quản lý mã chứng khoán
    path("stocks/", views.StockProfileListView.as_view(), name="stock-list"),
        # Sprint35 Layer 3: Portfolio Daily News Digest
        path("portfolio/news-digest/", views.portfolio_news_digest_api, name="portfolio-news-digest"),
    path("stocks/<str:symbol>/overview/", _toggle_market_view('StockWorkspaceOverviewView'), name="stock-workspace-overview"),
    path("stocks/<str:symbol>/chart/", _toggle_market_view('StockWorkspaceChartView'), name="stock-workspace-chart"),
    path("stocks/<str:symbol>/financials/", _toggle_market_view('FinancialMetricsView'), name="stock-financials"),
    path("stocks/<str:symbol>/news/", views.stock_news_api, name="stock-news"),
    path("stocks/<str:symbol>/news/ai-summary/", views.stock_news_ai_summary_api, name="stock-news-ai-summary"),
    path("stocks/<str:symbol>/dark-money-history/", views.dark_money_history_api, name="stock-dark-money-history"),
    path("stocks/<str:symbol>/order-flow/", views.stock_order_flow_api, name="stock-order-flow"),
    path("stocks/<str:symbol>/ai-advisory-session/", views.stock_ai_advisory_session_api, name="stock-ai-advisory-session"),
    path("stocks/<str:symbol>/ai-advisory-trace/", views.stock_ai_advisory_trace_api, name="stock-ai-advisory-trace"),
    path("stocks/<str:symbol>/ai-advisory-traces/", views.stock_ai_advisory_trace_list_api, name="stock-ai-advisory-trace-list"),
    path("stocks/<str:symbol>/ai-advisory-trace-export/", views.stock_ai_advisory_trace_export_api, name="stock-ai-advisory-trace-export"),
    path("stocks/<str:symbol>/ai-advisory-observability/", views.stock_ai_advisory_observability_api, name="stock-ai-advisory-observability"),
    path("stocks/<str:symbol>/ai-advisory-components/generate/", views.stock_ai_advisory_components_generate_api, name="stock-ai-advisory-components-generate"),
    path("stocks/<str:symbol>/ai-advisory-components/deleted/", views.stock_ai_advisory_component_clear_deleted_api, name="stock-ai-advisory-components-clear-deleted"),
    path("ai-advisory-components/<int:component_id>/toggle-include/", views.stock_ai_advisory_component_toggle_include_api, name="stock-ai-advisory-component-toggle-include"),
    path("ai-advisory-components/<int:component_id>/refresh/", views.stock_ai_advisory_component_refresh_api, name="stock-ai-advisory-component-refresh"),
    path("ai-advisory-components/<int:component_id>/restore/", views.stock_ai_advisory_component_restore_api, name="stock-ai-advisory-component-restore"),
    path("ai-advisory-components/<int:component_id>/", views.stock_ai_advisory_component_delete_api, name="stock-ai-advisory-component-delete"),
    path("stocks/<str:symbol>/ai-advisory-summary/regenerate/", views.stock_ai_advisory_summary_regenerate_api, name="stock-ai-advisory-summary-regenerate"),
    path("stocks/<str:symbol>/ai-advisory-summary/<int:summary_id>/", views.stock_ai_advisory_summary_delete_api, name="stock-ai-advisory-summary-delete"),
    path("stocks/<str:symbol>/", views.StockProfileDetailView.as_view(), name="stock-detail"),

    # Quản lý nhóm chứng khoán
    path("groups/", views.SecuritiesGroupListCreateView.as_view(), name="group-list"),
    path("groups/<int:group_id>/", views.SecuritiesGroupDetailView.as_view(), name="group-detail"),
    path("groups/<int:group_id>/items/", views.SecuritiesItemCreateView.as_view(), name="group-items-create"),
    path("items/<int:item_id>/", views.SecuritiesItemDeleteView.as_view(), name="group-item-delete"),
    path("seed/", views.SecuritiesSeedView.as_view(), name="group-seed"),
    path("sync/", views.SecuritiesSyncView.as_view(), name="group-sync"),

    # Mã theo dõi cá nhân
    path("tracked-symbols/", views.TrackedSymbolListCreateView.as_view(), name="tracked-symbol-list"),
    path("tracked-symbols/bulk-threshold/", views.TrackedSymbolBulkThresholdView.as_view(), name="tracked-symbol-bulk-threshold"),
    path("tracked-symbols/<int:ts_id>/", views.TrackedSymbolDeleteView.as_view(), name="tracked-symbol-delete"),

    # Cảnh báo giá cá nhân
    path("price-alerts/", views.PriceAlertRuleListCreateView.as_view(), name="price-alert-list"),
    path("price-alerts/<int:rule_id>/", views.PriceAlertRuleDetailView.as_view(), name="price-alert-detail"),
    path("price-alerts/<int:rule_id>/mark-triggered/", views.PriceAlertRuleTriggerView.as_view(), name="price-alert-trigger"),
]
