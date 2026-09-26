from django.apps import AppConfig


def cors_allow_api_requests(sender, request, **kwargs):
    from django.conf import settings
    if not getattr(settings, 'CORS_API_DYNAMIC_ALLOW', True):
        return False
    if request.path.startswith('/core/v1/') or request.path.startswith('/api/'):
        return True
    return False


class IdentityAccessConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'identity_access'
    verbose_name = 'Identity & Access'

    def ready(self):
        # Registers the production misconfiguration checks from vninvest_core.checks
        # (empty trusted-proxy list -> every request shares one rate-limit bucket,
        # missing Turnstile secret, unreachable onboarding path, unscheduled token
        # pruning). vninvest_core is not an INSTALLED_APPS entry, so its own ready()
        # never runs and cannot host the @register side effect. Imported here for
        # that side effect only; it touches no models.
        from vninvest_core import checks  # noqa: F401

        import sys
        from django.conf import settings
        from django.core.exceptions import ImproperlyConfigured

        # Tránh kiểm tra khi chạy tests hoặc commands đặc biệt
        running_commands = ['migrate', 'makemigrations', 'test', 'collectstatic', 'shell', 'showmigrations']
        is_management_cmd = any(cmd in sys.argv for cmd in running_commands)

        is_prod = not settings.DEBUG
        strict_turnstile = getattr(settings, 'STRICT_TURNSTILE_ENFORCEMENT', is_prod)

        if strict_turnstile and not is_management_cmd:
            secret_key = getattr(settings, 'TURNSTILE_SECRET_KEY', '').strip()
            if not secret_key:
                raise ImproperlyConfigured(
                    "Cấu hình Turnstile bảo mật chống spam bị thiếu! "
                    "Bắt buộc khai báo TURNSTILE_SECRET_KEY trong môi trường production "
                    "hoặc khi STRICT_TURNSTILE_ENFORCEMENT được kích hoạt."
                )

        # CORS dynamic signal handling for API routes
        from corsheaders.signals import check_request_enabled
        check_request_enabled.connect(cors_allow_api_requests)

        # Phase 4 — Register webhook signal handlers
        import identity_access.signals  # noqa: F401



