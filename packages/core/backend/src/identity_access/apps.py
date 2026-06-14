from django.apps import AppConfig


class IdentityAccessConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'identity_access'
    verbose_name = 'Identity & Access'

    def ready(self):
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

        def cors_allow_api_requests(sender, request, **kwargs):
            if not getattr(settings, 'CORS_API_DYNAMIC_ALLOW', True):
                return False
            if request.path.startswith('/core/v1/') or request.path.startswith('/api/'):
                return True
            return False

        check_request_enabled.connect(cors_allow_api_requests)



