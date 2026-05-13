from django.urls import path

from . import views
from .legacy_views import (
    StockManagementGroupsView,
    StockManagementSeedView,
    StockManagementSyncView,
    TrackedSymbolsView,
    TrackedSymbolDetailView,
    TrackedSymbolBulkThresholdView,
    PriceAlertsView,
    PriceAlertDetailView,
    PriceAlertTriggerView,
)
# C3: Native views replacing StockManagementLegacyBridgeView
from .stock_mgmt_native_views import (
    StockManagementTechnicalsView,
    StockManagementDetailView,
    StockManagementOverviewView,
    StockManagementChartView,
    StockManagementOrderFlowView,
    StockManagementNewsView,
    StockManagementNewsAISummaryView,
    StockManagementAIAdvisorySessionView,
    StockManagementAIAdvisoryObservabilityView,
    StockManagementAIAdvisoryComponentsGenerateView,
    StockManagementAIAdvisoryComponentsDeletedView,
    StockManagementAIAdvisorySummaryRegenerateView,
    StockManagementAIAdvisorySummaryDetailView,
    StockManagementFinancialsView,
    StockManagementAdvisoryCompToggleView,
    StockManagementAdvisoryCompRefreshView,
    StockManagementAdvisoryCompRestoreView,
    StockManagementAdvisoryCompDetailView,
    StockManagementPortfolioNewsDigestView,
    StockManagementGroupDetailView,
    StockManagementGroupItemsView,
    StockManagementItemDetailView,
)

urlpatterns = [
    # Native tracked-symbols (already here)
    path('stock-management/tracked-symbols/', views.TrackedSymbolsView.as_view(), name='tracked-symbols'),

    # =========================================================================
    # Legacy frontend stock-management aliases
    # Groups (seed/sync/groups native stubs; group-detail/items native)
    # =========================================================================
    path('stock-management/groups/', StockManagementGroupsView.as_view(), name='legacy-sm-groups'),
    path('stock-management/groups/<int:group_id>/', StockManagementGroupDetailView.as_view(), name='legacy-sm-group-detail'),
    path('stock-management/groups/<int:group_id>/items/', StockManagementGroupItemsView.as_view(), name='legacy-sm-group-items'),
    path('stock-management/items/<int:item_id>/', StockManagementItemDetailView.as_view(), name='legacy-sm-item-detail'),
    path('stock-management/seed/', StockManagementSeedView.as_view(), name='legacy-sm-seed'),
    path('stock-management/sync/', StockManagementSyncView.as_view(), name='legacy-sm-sync'),
    path('stock-management/tracked-symbols/<int:pk>/', TrackedSymbolDetailView.as_view(), name='legacy-tracked-symbol-detail'),
    path('stock-management/tracked-symbols/bulk-threshold/', TrackedSymbolBulkThresholdView.as_view(), name='legacy-tracked-symbol-bulk'),
    path('stock-management/price-alerts/', PriceAlertsView.as_view(), name='legacy-price-alerts'),
    path('stock-management/price-alerts/<int:pk>/', PriceAlertDetailView.as_view(), name='legacy-price-alert-detail'),
    path('stock-management/price-alerts/<int:pk>/mark-triggered/', PriceAlertTriggerView.as_view(), name='legacy-price-alert-trigger'),

    # =========================================================================
    # C3: Stock data routes — now native (no bridge to backend:8000)
    # =========================================================================
    path('stock-management/technicals/bulk/', StockManagementTechnicalsView.as_view(), name='legacy-technicals-bulk'),
    path('stock-management/stocks/<str:symbol>/overview/', StockManagementOverviewView.as_view(), name='legacy-stock-overview'),
    path('stock-management/stocks/<str:symbol>/chart/', StockManagementChartView.as_view(), name='legacy-stock-chart'),
    path('stock-management/stocks/<str:symbol>/order-flow/', StockManagementOrderFlowView.as_view(), name='legacy-stock-order-flow'),
    path('stock-management/stocks/<str:symbol>/news/ai-summary/', StockManagementNewsAISummaryView.as_view(), name='legacy-stock-news-summary'),
    path('stock-management/stocks/<str:symbol>/news/', StockManagementNewsView.as_view(), name='legacy-stock-news'),
    path('stock-management/stocks/<str:symbol>/ai-advisory-session/', StockManagementAIAdvisorySessionView.as_view(), name='legacy-stock-advisory'),
    path('stock-management/stocks/<str:symbol>/ai-advisory-observability/', StockManagementAIAdvisoryObservabilityView.as_view(), name='legacy-stock-advisory-obs'),
    path('stock-management/stocks/<str:symbol>/ai-advisory-components/generate/', StockManagementAIAdvisoryComponentsGenerateView.as_view(), name='legacy-advisory-components-gen'),
    path('stock-management/stocks/<str:symbol>/ai-advisory-components/deleted/', StockManagementAIAdvisoryComponentsDeletedView.as_view(), name='legacy-advisory-components-del'),
    path('stock-management/stocks/<str:symbol>/ai-advisory-summary/regenerate/', StockManagementAIAdvisorySummaryRegenerateView.as_view(), name='legacy-advisory-summary-regen'),
    path('stock-management/stocks/<str:symbol>/ai-advisory-summary/<str:summary_id>/', StockManagementAIAdvisorySummaryDetailView.as_view(), name='legacy-advisory-summary-del'),
    path('stock-management/stocks/<str:symbol>/financials/', StockManagementFinancialsView.as_view(), name='legacy-stock-financials'),
    path('stock-management/stocks/<str:symbol>/', StockManagementDetailView.as_view(), name='legacy-stock-profile'),
    path('stock-management/ai-advisory-components/<str:pk>/toggle-include/', StockManagementAdvisoryCompToggleView.as_view(), name='legacy-advisory-comp-toggle'),
    path('stock-management/ai-advisory-components/<str:pk>/refresh/', StockManagementAdvisoryCompRefreshView.as_view(), name='legacy-advisory-comp-refresh'),
    path('stock-management/ai-advisory-components/<str:pk>/restore/', StockManagementAdvisoryCompRestoreView.as_view(), name='legacy-advisory-comp-restore'),
    path('stock-management/ai-advisory-components/<str:pk>/', StockManagementAdvisoryCompDetailView.as_view(), name='legacy-advisory-comp-detail'),
    path('stock-management/portfolio/news-digest/', StockManagementPortfolioNewsDigestView.as_view(), name='legacy-portfolio-news-digest'),
]
