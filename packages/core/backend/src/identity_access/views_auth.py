"""
Auth views for packages/core (Facade).
Re-exports views from the modular views/ subdirectory.
"""

from .views.login import login_view, refresh_token_view, logout_view
from .views.register import register_view, verify_email_view, resend_email_verification_view
from .views.password_reset import password_reset_request_view, password_reset_confirm_view
from .views.password_change import password_change_view
from .views.profile import profile_view, capabilities_view, user_config_view
