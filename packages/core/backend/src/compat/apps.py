from django.apps import AppConfig


class CompatConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'compat'
    label = 'compat'
    verbose_name = 'Legacy Compatibility Shim'

    def ready(self):
        # Import signals if any
        pass