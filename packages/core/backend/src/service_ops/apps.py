from django.apps import AppConfig
from django.db.models.signals import post_migrate


class ServiceOpsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'service_ops'
    verbose_name = 'Service Operations Center'

    def ready(self):
        from .registry import bootstrap_service_registry

        post_migrate.connect(
            bootstrap_service_registry,
            sender=self,
            dispatch_uid='service_ops.bootstrap_service_registry',
        )
