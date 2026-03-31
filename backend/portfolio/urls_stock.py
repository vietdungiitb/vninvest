from django.urls import path
from . import views

app_name = "portfolio_stock"

urlpatterns = [
    # Quản lý mã chứng khoán
    path("stocks/", views.StockProfileListView.as_view(), name="stock-list"),
    path("stocks/<str:symbol>/", views.StockProfileDetailView.as_view(), name="stock-detail"),
    path("stocks/sync/", views.sync_stockprofile_api, name="stock-sync"),

    # Quản lý nhóm chứng khoán
    path("groups/", views.SecuritiesGroupListView.as_view(), name="group-list"),
    path("groups/<int:pk>/", views.SecuritiesGroupDetailView.as_view(), name="group-detail"),
    path("groups/<int:pk>/items/", views.SecuritiesItemListView.as_view(), name="group-items"),
]
