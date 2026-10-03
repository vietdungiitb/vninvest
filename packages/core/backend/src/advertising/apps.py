from django.apps import AppConfig


class AdvertisingConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'advertising'
    verbose_name = 'Advertising'

    def ready(self):
        import advertising.signals  # Connect signals for Redis cache invalidation
