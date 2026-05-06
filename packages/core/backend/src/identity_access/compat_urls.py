from django.urls import path

from vninvest_core import views_health

from . import views_auth

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
    # NOTE: portfolio/portfolios/ intentionally omitted — falls through to legacy_proxy_view
    path('core/v1/health', views_health.health, name='api-core-health'),
    path('core/v1/capability-bootstrap', views_health.capability_bootstrap, name='api-core-capability-bootstrap'),
    path('core/v1/access/capabilities/', views_auth.capabilities_view, name='api-core-capabilities'),
]
