from django.urls import path
from . import views

urlpatterns = [
    # --- Portfolios ---
    path('portfolios/', views.PortfolioListCreateView.as_view(), name='portfolio-list'),
    path('portfolios/<int:pk>/', views.PortfolioDetailView.as_view(), name='portfolio-detail'),

    # --- User Config ---
    path('userconfig/', views.UserConfigView.as_view(), name='user-config'),


    # --- SubAccounts ---
    path('subaccounts/', views.SubAccountListCreateView.as_view(), name='subaccount-list'),
    path('subaccounts/<int:pk>/', views.SubAccountDetailView.as_view(), name='subaccount-detail'),
    
    # --- Transactions ---
    path('subaccounts/<int:sub_account_id>/transactions/', views.TransactionListCreateView.as_view(), name='transaction-list'),
    path('transactions/<int:pk>/', views.TransactionDetailView.as_view(), name='transaction-detail'),


    # --- Analytics ---
    path('portfolios/<int:portfolio_id>/holdings/', views.HoldingsView.as_view(), name='portfolio-holdings'),
    path('portfolios/<int:portfolio_id>/summary/', views.SummaryView.as_view(), name='portfolio-summary'),
    path('portfolios/<int:portfolio_id>/chart/', views.ChartDataView.as_view(), name='portfolio-chart'),
    path('portfolios/<int:portfolio_id>/allocation/', views.AllocationView.as_view(), name='portfolio-allocation'),
    path('portfolios/<int:portfolio_id>/sync/', views.SyncPricesView.as_view(), name='portfolio-sync'),

    # --- Watchlist (giữ lại cho tương thích cũ, sẽ chuyển sang stock-management) ---
    # path('watchlist/groups/', ...)
    # path('watchlist/groups/<int:group_id>/', ...)
    # path('watchlist/groups/<int:group_id>/items/', ...)
    # path('watchlist/items/<int:item_id>/', ...)
    # path('watchlist/seed/', ...)
    # path('watchlist/sync/', ...)

]

