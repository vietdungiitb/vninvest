from django.urls import path
from . import views

app_name = "portfolio_stock"

urlpatterns = [
    # Quản lý mã chứng khoán
    path("stocks/", views.StockProfileListView.as_view(), name="stock-list"),
    path("stocks/<str:symbol>/overview/", views.StockWorkspaceOverviewView.as_view(), name="stock-workspace-overview"),
    path("stocks/<str:symbol>/chart/", views.StockWorkspaceChartView.as_view(), name="stock-workspace-chart"),
    path("stocks/<str:symbol>/financials/", views.FinancialMetricsView.as_view(), name="stock-financials"),
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
    path("tracked-symbols/<int:ts_id>/", views.TrackedSymbolDeleteView.as_view(), name="tracked-symbol-delete"),

    # Cảnh báo giá cá nhân
    path("price-alerts/", views.PriceAlertRuleListCreateView.as_view(), name="price-alert-list"),
    path("price-alerts/<int:rule_id>/", views.PriceAlertRuleDetailView.as_view(), name="price-alert-detail"),
    path("price-alerts/<int:rule_id>/mark-triggered/", views.PriceAlertRuleTriggerView.as_view(), name="price-alert-trigger"),
]
