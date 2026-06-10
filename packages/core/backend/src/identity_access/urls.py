from django.urls import path

from . import views_tenant as views
from . import views_auth
from . import onboarding_views
from . import views_operator

urlpatterns = [
    # Auth endpoints (Gate A2, A3)
    path('auth/login', views_auth.login_view, name='auth-login'),
    path('auth/profile', views_auth.profile_view, name='auth-profile'),
    # alias /core/v1/auth/me → profile (used by packages/web coreAdapter)
    path('auth/me', views_auth.profile_view, name='auth-me'),
    path('auth/me/', views_auth.profile_view, name='auth-me-slash'),
    path('auth/logout', views_auth.logout_view, name='auth-logout'),
    # Capability bootstrap (used by packages/web coreAdapter at /core/v1/access/capabilities)
    path('access/capabilities', views_auth.capabilities_view, name='access-capabilities'),
    path('access/capabilities/', views_auth.capabilities_view, name='access-capabilities-slash'),
    # Onboarding endpoints (T08)
    path('onboarding/register', onboarding_views.register_tenant_view, name='onboarding-register'),
    path('onboarding/register/', onboarding_views.register_tenant_view, name='onboarding-register-slash'),
    # Tenant & Service Account management
    path('tenant', views.TenantDetailView.as_view(), name='tenant-detail'),
    path('service-accounts', views.ServiceAccountListView.as_view(), name='service-account-list'),
    path('service-accounts/<str:service_account_id>', views.ServiceAccountDetailView.as_view(), name='service-account-detail'),
    path('service-accounts/<str:service_account_id>/pat/issue', views.issue_pat, name='pat-issue'),
    path('pat', views.PATListView.as_view(), name='pat-list'),
    # User profile (SM-P4.1)
    path('identity/profile/', views.UserProfileView.as_view(), name='user-profile'),

    # Operator Mail Configs
    path('operator/mail-configs/', views_operator.OperatorMailConfigListView.as_view(), name='operator-mail-config-list'),
    path('operator/mail-configs/test/', views_operator.OperatorMailConfigTestView.as_view(), name='operator-mail-config-test'),
    path('operator/mail-configs/<int:pk>/', views_operator.OperatorMailConfigDetailView.as_view(), name='operator-mail-config-detail'),
    path('operator/mail-configs/<int:pk>/activate/', views_operator.OperatorMailConfigActivateView.as_view(), name='operator-mail-config-activate'),
]
