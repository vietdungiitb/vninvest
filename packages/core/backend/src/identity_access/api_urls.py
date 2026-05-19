from django.urls import include, path

from vninvest_core import views_health
from vninvest_core.utils.legacy_stubs import GenericEmptyListView, GenericEmptyStaffView

from . import views_auth
from . import onboarding_views
from . import tenant_member_views
from .dnse_credential_views import DNSECredentialView

urlpatterns = [
    # SFI-B2 native PAT login — used by both legacy frontend (compat) and new clients.
    # Returns {access, refresh, token} where access=refresh=PAT token.
    path('auth/login/', views_auth.login_view, name='api-auth-login'),
    path('auth/login', views_auth.login_view, name='api-auth-login-noslash'),
    path('auth/token/', views_auth.login_view, name='api-auth-token'),
    path('auth/token/refresh/', views_auth.refresh_token_view, name='api-auth-token-refresh'),
    path('auth/me/', views_auth.profile_view, name='api-auth-me'),
    path('auth/profile/', views_auth.profile_view, name='api-auth-profile'),
    path('auth/logout/', views_auth.logout_view, name='api-auth-logout'),
    # SFI-B2.5: Native auth endpoints (new functionality only)
    path('auth/register/', views_auth.register_view, name='api-auth-register'),
    path('auth/verify-email/', views_auth.verify_email_view, name='api-auth-verify-email'),
    path('auth/password-reset/', views_auth.password_reset_request_view, name='api-auth-password-reset'),
    path('auth/password-reset/confirm/', views_auth.password_reset_confirm_view, name='api-auth-password-reset-confirm'),
    path('portfolio/userconfig/', views_auth.user_config_view, name='api-portfolio-userconfig'),
    path('core/v1/health', views_health.health, name='api-core-health'),
    path('core/v1/capability-bootstrap', views_health.capability_bootstrap, name='api-core-capability-bootstrap'),
    path('core/v1/access/capabilities/', views_auth.capabilities_view, name='api-core-capabilities'),
    # Onboarding endpoints (T08)
    path('core/v1/onboarding/register', onboarding_views.register_tenant_view, name='api-onboarding-register'),
    path('core/v1/onboarding/register/', onboarding_views.register_tenant_view, name='api-onboarding-register-slash'),
    # Tenant member & invite endpoints (T09) — specific routes FIRST
    path('core/v1/tenant-members/invites/<str:token>/accept/', tenant_member_views.TenantInviteAcceptView.as_view(), name='api-tenant-invites-accept'),
    path('core/v1/tenant-members/invites/', tenant_member_views.TenantInvitesCombinedView.as_view(), name='api-tenant-invites'),
    path('core/v1/tenant-members/<str:member_id>/', tenant_member_views.TenantMemberRemoveView.as_view(), name='api-tenant-members-remove'),
    path('core/v1/tenant-members/', tenant_member_views.TenantMemberListView.as_view(), name='api-tenant-members-list'),
    # Partner / tenant-admin native mount — frontend calls /api/core/v1/partner/*
    path('core/v1/', include(('identity_access.partner_urls', 'identity_access_partner_api'), namespace='identity_access_partner_api')),
    # D02: DNSE credential management
    path('core/v1/dnse-credential/', DNSECredentialView.as_view(), name='api-dnse-credential'),

    # =========================================================================
    # Misc legacy stubs (migrated from compat_urls.py)
    # =========================================================================
    path('admin-sync/stockprofile/', GenericEmptyStaffView.as_view(), name='legacy-admin-sync-stockprofile'),
    path('ai-options/', GenericEmptyListView.as_view(), name='legacy-ai-options'),
    path('v1/admin/crawl/jobs/', GenericEmptyStaffView.as_view(), name='legacy-crawl-jobs'),
    path('v1/admin/crawl/jobs/<str:pk>/run/', GenericEmptyStaffView.as_view(), name='legacy-crawl-jobs-run'),
    path('health/realtime/', GenericEmptyStaffView.as_view(), name='legacy-health-realtime'),
]
