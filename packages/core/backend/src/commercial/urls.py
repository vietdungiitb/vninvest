from django.urls import path

from . import views

urlpatterns = [
    path('billing/subscription', views.SubscriptionDetailView.as_view(), name='subscription-detail'),
    path('billing/quota', views.QuotaListView.as_view(), name='quota-list'),
    path('billing/invoices', views.InvoiceListView.as_view(), name='invoice-list'),
]
