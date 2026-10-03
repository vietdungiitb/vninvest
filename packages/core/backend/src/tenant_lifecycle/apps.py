from django.apps import AppConfig


class TenantLifecycleConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'tenant_lifecycle'
    verbose_name = 'Tenant Lifecycle'

    def ready(self):
        import tenant_lifecycle.signals  # noqa: F401
