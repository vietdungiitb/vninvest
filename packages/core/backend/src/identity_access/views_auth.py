"""
Auth views for packages/core (Facade).
Re-exports views from the modular views/ subdirectory.
"""
# NOTE: facade re-exports — used via `views_auth.X` in urls.py / api_urls.py.
# `__all__` marks them as public API so F401 keeps them. Do NOT strip.

from .views.login import login_view, logout_view, refresh_token_view
from .views.password_change import password_change_view
from .views.password_reset import (
    password_reset_confirm_view,
    password_reset_request_view,
)
from .views.profile import capabilities_view, profile_view, user_config_view
from .views.register import (
    register_view,
    resend_email_verification_view,
    verify_email_view,
)

__all__ = [
    'capabilities_view',
    'login_view',
    'logout_view',
    'password_change_view',
    'password_reset_confirm_view',
    'password_reset_request_view',
    'profile_view',
    'refresh_token_view',
    'register_view',
    'resend_email_verification_view',
    'user_config_view',
    'verify_email_view',
]

