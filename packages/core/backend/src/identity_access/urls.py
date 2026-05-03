from django.urls import path

from . import views
from . import views_auth

urlpatterns = [
    # Auth endpoints (Gate A2, A3)
    path('auth/login', views_auth.login_view, name='auth-login'),
    path('auth/profile', views_auth.profile_view, name='auth-profile'),
    path('auth/logout', views_auth.logout_view, name='auth-logout'),
    # Tenant & Service Account management
    path('tenant', views.TenantDetailView.as_view(), name='tenant-detail'),
    path('service-accounts', views.ServiceAccountListView.as_view(), name='service-account-list'),
    path('service-accounts/<str:service_account_id>', views.ServiceAccountDetailView.as_view(), name='service-account-detail'),
    path('service-accounts/<str:service_account_id>/pat/issue', views.issue_pat, name='pat-issue'),
    path('pat', views.PATListView.as_view(), name='pat-list'),
]
