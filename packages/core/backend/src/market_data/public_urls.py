from django.urls import path

from . import views
from .legacy_views import (
    StockManagementGroupsView,
    StockManagementSeedView,
    StockManagementSyncView,
    StockManagementLegacyBridgeView,
    TrackedSymbolsView,
    TrackedSymbolDetailView,
    TrackedSymbolBulkThresholdView,
    PriceAlertsView,
    PriceAlertDetailView,
    PriceAlertTriggerView,
)

urlpatterns = [
    # Native tracked-symbols (already here)
    path('stock-management/tracked-symbols/', views.TrackedSymbolsView.as_view(), name='tracked-symbols'),

    # =========================================================================
    # Legacy frontend stock-management aliases
    # =========================================================================
    path('stock-management/groups/', StockManagementGroupsView.as_view(), name='legacy-sm-groups'),
    path('stock-management/groups/<int:group_id>/', StockManagementLegacyBridgeView.as_view(), name='legacy-sm-group-detail'),
    path('stock-management/groups/<int:group_id>/items/', StockManagementLegacyBridgeView.as_view(), name='legacy-sm-group-items'),
    path('stock-management/items/<int:item_id>/', StockManagementLegacyBridgeView.as_view(), name='legacy-sm-item-detail'),
    path('stock-management/seed/', StockManagementSeedView.as_view(), name='legacy-sm-seed'),
    path('stock-management/sync/', StockManagementSyncView.as_view(), name='legacy-sm-sync'),
    path('stock-management/tracked-symbols/<int:pk>/', TrackedSymbolDetailView.as_view(), name='legacy-tracked-symbol-detail'),
    path('stock-management/tracked-symbols/bulk-threshold/', TrackedSymbolBulkThresholdView.as_view(), name='legacy-tracked-symbol-bulk'),
    path('stock-management/price-alerts/', PriceAlertsView.as_view(), name='legacy-price-alerts'),
    path('stock-management/price-alerts/<int:pk>/', PriceAlertDetailView.as_view(), name='legacy-price-alert-detail'),
    path('stock-management/price-alerts/<int:pk>/mark-triggered/', PriceAlertTriggerView.as_view(), name='legacy-price-alert-trigger'),
    path('stock-management/technicals/bulk/', StockManagementLegacyBridgeView.as_view(), name='legacy-technicals-bulk'),
    path('stock-management/stocks/<str:symbol>/', StockManagementLegacyBridgeView.as_view(), name='legacy-stock-profile'),
    path('stock-management/stocks/<str:symbol>/overview/', StockManagementLegacyBridgeView.as_view(), name='legacy-stock-overview'),
    path('stock-management/stocks/<str:symbol>/chart/', StockManagementLegacyBridgeView.as_view(), name='legacy-stock-chart'),
    path('stock-management/stocks/<str:symbol>/order-flow/', StockManagementLegacyBridgeView.as_view(), name='legacy-stock-order-flow'),
    path('stock-management/stocks/<str:symbol>/news/', StockManagementLegacyBridgeView.as_view(), name='legacy-stock-news'),
    path('stock-management/stocks/<str:symbol>/news/ai-summary/', StockManagementLegacyBridgeView.as_view(), name='legacy-stock-news-summary'),
    path('stock-management/stocks/<str:symbol>/ai-advisory-session/', StockManagementLegacyBridgeView.as_view(), name='legacy-stock-advisory'),
    path('stock-management/stocks/<str:symbol>/ai-advisory-observability/', StockManagementLegacyBridgeView.as_view(), name='legacy-stock-advisory-obs'),
    path('stock-management/stocks/<str:symbol>/ai-advisory-components/generate/', StockManagementLegacyBridgeView.as_view(), name='legacy-advisory-components-gen'),
    path('stock-management/stocks/<str:symbol>/ai-advisory-components/deleted/', StockManagementLegacyBridgeView.as_view(), name='legacy-advisory-components-del'),
    path('stock-management/stocks/<str:symbol>/ai-advisory-summary/regenerate/', StockManagementLegacyBridgeView.as_view(), name='legacy-advisory-summary-regen'),
    path('stock-management/stocks/<str:symbol>/ai-advisory-summary/<str:summary_id>/', StockManagementLegacyBridgeView.as_view(), name='legacy-advisory-summary-del'),
    path('stock-management/stocks/<str:symbol>/financials/', StockManagementLegacyBridgeView.as_view(), name='legacy-stock-financials'),
    path('stock-management/ai-advisory-components/<str:pk>/toggle-include/', StockManagementLegacyBridgeView.as_view(), name='legacy-advisory-comp-toggle'),
    path('stock-management/ai-advisory-components/<str:pk>/refresh/', StockManagementLegacyBridgeView.as_view(), name='legacy-advisory-comp-refresh'),
    path('stock-management/ai-advisory-components/<str:pk>/restore/', StockManagementLegacyBridgeView.as_view(), name='legacy-advisory-comp-restore'),
    path('stock-management/ai-advisory-components/<str:pk>/', StockManagementLegacyBridgeView.as_view(), name='legacy-advisory-comp-detail'),
    path('stock-management/portfolio/news-digest/', StockManagementLegacyBridgeView.as_view(), name='legacy-portfolio-news-digest'),
]