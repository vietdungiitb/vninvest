"""
Environment Variable Validation for VNInvest Core.

This module validates required environment variables on Django startup.
Fails fast if required vars are missing, preventing silent failures in production.

C4 Fix: Remove hardcoded fallbacks and enforce environment validation.
"""
import os
from django.core.exceptions import ImproperlyConfigured


def get_required_env(key: str, description: str = None) -> str:
    """
    Get required environment variable.
    
    Args:
        key: Environment variable name
        description: User-friendly description of what this var is for
    
    Returns:
        Environment variable value (stripped)
    
    Raises:
        ImproperlyConfigured: If env var is missing or empty
    """
    value = os.environ.get(key, '').strip()
    if not value:
        msg = f"Required environment variable '{key}' is not set"
        if description:
            msg += f" ({description})"
        raise ImproperlyConfigured(msg)
    return value


def get_optional_env(key: str, default: str = '') -> str:
    """
    Get optional environment variable.
    
    Args:
        key: Environment variable name
        default: Default value if not set
    
    Returns:
        Environment variable value or default (stripped)
    """
    value = os.environ.get(key, default)
    return value.strip() if value else default


def validate_production_settings(debug: bool):
    """
    Validate production-required environment variables.
    
    Called only when DEBUG=false (production mode).
    Raises ImproperlyConfigured if validation fails.
    
    Args:
        debug: Django DEBUG setting
    """
    if debug:
        # Development mode - skip strict validation
        return
    
    # Production-required variables
    try:
        get_required_env('DJANGO_SECRET_KEY', 'Django secret key for CSRF/session signing')
        get_required_env('FRONTEND_URL', 'Frontend base URL for password reset and email links')
        get_required_env('CORE_PAT_PEPPER', 'Pepper for secure PAT (Personal Access Token) hashing')
        get_required_env('DJANGO_ALLOWED_HOSTS', 'Comma-separated list of allowed hosts')
    except ImproperlyConfigured as e:
        raise ImproperlyConfigured(f"Production validation failed: {e}") from e


def get_frontend_url(debug: bool) -> str:
    """
    Get validated FRONTEND_URL.
    
    In production (debug=false), this is required.
    In development, defaults to http://localhost:3000 if not set.
    
    Returns:
        Frontend base URL (with trailing slash removed)
    """
    if not debug:
        # Production: must be set
        return get_required_env('FRONTEND_URL', 'Frontend URL for email links').rstrip('/')
    
    # Development: use default if not set
    value = os.environ.get('FRONTEND_URL', '')
    if value:
        return value.strip().rstrip('/')
    return 'http://localhost:3000'
