from django.urls import include, path

from .views import OperatorHealthView, OperatorOverviewView
from .operator_tenant_views import (
    OperatorTenantDetailView,
    OperatorTenantListView,
    OperatorTenantPATListView,
    OperatorTenantServiceAccountListView,
)

app_name = 'operator'

urlpatterns = [
    path('overview/', OperatorOverviewView.as_view(), name='overview'),
    path('health/', OperatorHealthView.as_view(), name='health'),
    path('scraping/', include(('service_ops.operator_urls', 'operator_scraping'), namespace='scraping')),
    path('soc/', include('service_ops.urls')),
    path('tenants/', OperatorTenantListView.as_view(), name='operator-tenant-list'),
    path('tenants/<str:tenant_id>/', OperatorTenantDetailView.as_view(), name='operator-tenant-detail'),
    path('tenants/<str:tenant_id>/service-accounts/', OperatorTenantServiceAccountListView.as_view(), name='operator-tenant-sa-list'),
    path('tenants/<str:tenant_id>/pats/', OperatorTenantPATListView.as_view(), name='operator-tenant-pat-list'),
]