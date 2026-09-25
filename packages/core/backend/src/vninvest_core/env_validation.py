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


def _env_bool(mapping, key: str, default: bool) -> bool:
    return str(mapping.get(key, str(default))).strip().lower() in ('1', 'true', 'yes')


def prod_cookie_security_settings(env=None) -> dict:
    """BL-02: session/cookie/transport security — secure-by-default in prod.

    Missing vars fall back to secure defaults (no silent insecure boot);
    explicitly insecure values raise ImproperlyConfigured (fail-closed).

    Args:
        env: mapping to read (defaults to os.environ). Dict accepted for tests.

    Returns:
        Dict of Django settings to apply.
    """
    e = env if env is not None else os.environ
    flags = {
        'SESSION_COOKIE_SECURE': _env_bool(e, 'DJANGO_SESSION_COOKIE_SECURE', True),
        'CSRF_COOKIE_SECURE': _env_bool(e, 'DJANGO_CSRF_COOKIE_SECURE', True),
        'SECURE_SSL_REDIRECT': _env_bool(e, 'DJANGO_SECURE_SSL_REDIRECT', True),
    }
    for name, val in flags.items():
        if not val:
            raise ImproperlyConfigured(
                f"{name} must be true in production (explicit insecure override rejected)."
            )
    try:
        age = int(str(e.get('DJANGO_SESSION_COOKIE_AGE', '28800') or '28800'))
        hsts = int(str(e.get('DJANGO_SECURE_HSTS_SECONDS', '31536000') or '31536000'))
    except (TypeError, ValueError) as exc:
        raise ImproperlyConfigured(f"Invalid numeric security setting: {exc}") from exc
    samesite = str(e.get('DJANGO_SESSION_COOKIE_SAMESITE', 'Lax') or 'Lax')
    if samesite not in ('Lax', 'Strict', 'None'):
        raise ImproperlyConfigured("DJANGO_SESSION_COOKIE_SAMESITE must be Lax/Strict/None.")
    return {
        **flags,
        'SESSION_COOKIE_AGE': age,
        'SESSION_COOKIE_HTTPONLY': True,
        'SESSION_COOKIE_SAMESITE': samesite,
        'SECURE_HSTS_SECONDS': hsts,
        'SECURE_HSTS_INCLUDE_SUBDOMAINS': True,
        'SECURE_HSTS_PRELOAD': False,  # opt-in only (hard to undo once preloaded)
    }


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
