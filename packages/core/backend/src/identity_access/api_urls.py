"""
SFI-B2: Auth compat routes at /api/auth/* for backward compatibility.

Legacy frontend and external consumers call /api/auth/* endpoints.
These routes redirect to the canonical identity_access views (also at /core/v1/auth/*).
Placed before the proxy catch-all in main urls.py so they are handled natively.
"""

from django.urls import path

from . import views_auth

urlpatterns = [
    path('auth/login', views_auth.login_view, name='api-auth-login'),
    path('auth/login/', views_auth.login_view, name='api-auth-login-slash'),
    path('auth/token', views_auth.login_view, name='api-auth-token'),
    path('auth/token/', views_auth.login_view, name='api-auth-token-slash'),
    path('auth/token/refresh/', views_auth.refresh_token_view, name='api-auth-token-refresh'),
    path('auth/me', views_auth.profile_view, name='api-auth-me'),
    path('auth/me/', views_auth.profile_view, name='api-auth-me-slash'),
    path('auth/profile', views_auth.profile_view, name='api-auth-profile'),
    path('auth/logout', views_auth.logout_view, name='api-auth-logout'),
    path('auth/logout/', views_auth.logout_view, name='api-auth-logout-slash'),
    path('auth/register/', views_auth.register_view, name='api-auth-register'),
    path('auth/verify-email/', views_auth.verify_email_view, name='api-auth-verify-email'),
    path('auth/resend-verification/', views_auth.resend_email_verification_view, name='api-auth-resend-verification'),
    path('auth/password-reset/', views_auth.password_reset_request_view, name='api-auth-password-reset'),
    path('auth/password-reset/confirm/', views_auth.password_reset_confirm_view, name='api-auth-password-reset-confirm'),
]
