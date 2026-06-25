from django.urls import include, path

from . import views_tenant as views
from . import views_auth
from . import onboarding_views
from . import views_operator
from . import tenant_member_views
from .dnse_credential_views import DNSECredentialView
from .views.sso import SSOLoginInitiateView, SSOCallbackView

urlpatterns = [
    # Auth endpoints (Gate A2, A3)
    path('auth/login', views_auth.login_view, name='auth-login'),
    path('auth/login/', views_auth.login_view, name='auth-login-slash'),
    path('auth/token', views_auth.login_view, name='auth-token-no-slash'),
    path('auth/token/', views_auth.login_view, name='auth-token'),
    path('auth/profile', views_auth.profile_view, name='auth-profile'),
    # alias /core/v1/auth/me → profile (used by packages/web coreAdapter)
    path('auth/me', views_auth.profile_view, name='auth-me'),
    path('auth/me/', views_auth.profile_view, name='auth-me-slash'),
    path('auth/logout', views_auth.logout_view, name='auth-logout'),
    path('auth/logout/', views_auth.logout_view, name='auth-logout-slash'),
    # Capability bootstrap (used by packages/web coreAdapter at /core/v1/access/capabilities)
    path('access/capabilities', views_auth.capabilities_view, name='access-capabilities'),
    path('access/capabilities/', views_auth.capabilities_view, name='access-capabilities-slash'),
    # Onboarding endpoints (T08)
    path('onboarding/register', onboarding_views.register_tenant_view, name='onboarding-register'),
    path('onboarding/register/', onboarding_views.register_tenant_view, name='onboarding-register-slash'),
    # Tenant & Service Account management
    path('tenant', views.TenantDetailView.as_view(), name='tenant-detail'),
    path('tenant/lifecycle/', views.TenantLifecycleView.as_view(), name='tenant-lifecycle-slash'),
    path('tenant/lifecycle', views.TenantLifecycleView.as_view(), name='tenant-lifecycle'),
    path('service-accounts', views.ServiceAccountListView.as_view(), name='service-account-list'),
    path('service-accounts/<str:service_account_id>', views.ServiceAccountDetailView.as_view(), name='service-account-detail'),
    path('service-accounts/<str:service_account_id>/pat/issue', views.issue_pat, name='pat-issue'),
    path('pat', views.PATListView.as_view(), name='pat-list'),
    # User profile (SM-P4.1)
    path('identity/profile/', views.UserProfileView.as_view(), name='user-profile'),

    # Operator Mail Configs (plural - canonical)
    path('operator/mail-configs/', views_operator.OperatorMailConfigListView.as_view(), name='operator-mail-config-list'),
    path('operator/mail-configs/test/', views_operator.OperatorMailConfigTestView.as_view(), name='operator-mail-config-test'),
    path('operator/mail-configs/<int:pk>/', views_operator.OperatorMailConfigDetailView.as_view(), name='operator-mail-config-detail'),
    path('operator/mail-configs/<int:pk>/activate/', views_operator.OperatorMailConfigActivateView.as_view(), name='operator-mail-config-activate'),

    # =========================================================================
    # Merged from deleted api_urls.py (Phase 0 - DJANGO_API_ROUTING_CLEANUP)
    # =========================================================================

    # Auth register/verify-email/resend/password-reset (from views_auth)
    path('auth/register/', views_auth.register_view, name='auth-register'),
    path('auth/verify-email/', views_auth.verify_email_view, name='auth-verify-email'),
    path('auth/resend-verification/', views_auth.resend_email_verification_view, name='auth-resend-verification'),
    path('auth/password-reset/', views_auth.password_reset_request_view, name='auth-password-reset'),
    path('auth/password-reset/confirm/', views_auth.password_reset_confirm_view, name='auth-password-reset-confirm'),
    path('auth/token/refresh/', views_auth.refresh_token_view, name='auth-token-refresh'),

    # SSO endpoints
    path('auth/sso/login/', SSOLoginInitiateView.as_view(), name='auth-sso-login'),
    path('auth/sso/login', SSOLoginInitiateView.as_view(), name='auth-sso-login-noslash'),
    path('auth/sso/callback/', SSOCallbackView.as_view(), name='auth-sso-callback'),
    path('auth/sso/callback', SSOCallbackView.as_view(), name='auth-sso-callback-noslash'),

    # DNSE Credential management (D02)
    path('dnse-credential/', DNSECredentialView.as_view(), name='dnse-credential'),

    # Tenant member & invite endpoints (T09) — specific routes FIRST
    path('tenant-members/invites/<str:token>/accept/', tenant_member_views.TenantInviteAcceptView.as_view(), name='tenant-invites-accept'),
    path('tenant-members/invites/<str:invite_id>/cancel/', tenant_member_views.TenantInviteCancelView.as_view(), name='tenant-invites-cancel'),
    path('tenant-members/invites/', tenant_member_views.TenantInvitesCombinedView.as_view(), name='tenant-invites'),
    path('tenant-members/<str:member_id>/', tenant_member_views.TenantMemberRemoveView.as_view(), name='tenant-members-remove'),
    path('tenant-members/', tenant_member_views.TenantMemberListView.as_view(), name='tenant-members-list'),

    # Partner / tenant-admin native mount — frontend calls /core/v1/partner/*
    path('partner/', include(('identity_access.partner_urls', 'identity_access_partner'), namespace='identity_access_partner')),

    # Operator Dynamic Mail Configurations (singular - backward compat per INV-06)
    path('operator/mail-config/', views_operator.OperatorMailConfigListView.as_view(), name='operator-mail-config-list-singular'),
    path('operator/mail-config/<int:pk>/', views_operator.OperatorMailConfigDetailView.as_view(), name='operator-mail-config-detail-singular'),
    path('operator/mail-config/<int:pk>/activate/', views_operator.OperatorMailConfigActivateView.as_view(), name='operator-mail-config-activate-singular'),
    path('operator/mail-config/test/', views_operator.OperatorMailConfigTestView.as_view(), name='operator-mail-config-test-singular'),

    # Ops Audit endpoints (includes partner audit logs)
    path('', include('ops_audit.urls')),
]
