from django.urls import path

from . import views

urlpatterns = [
    path('tenant', views.TenantDetailView.as_view(), name='tenant-detail'),
    path('service-accounts', views.ServiceAccountListView.as_view(), name='service-account-list'),
    path('service-accounts/<str:service_account_id>', views.ServiceAccountDetailView.as_view(), name='service-account-detail'),
    path('service-accounts/<str:service_account_id>/pat/issue', views.issue_pat, name='pat-issue'),
    path('pat', views.PATListView.as_view(), name='pat-list'),
]
