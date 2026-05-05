from django.apps import AppConfig


class DataIngestConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'data_ingest'
    verbose_name = 'Data Ingest'

    def ready(self):
        pass  # register signals here if needed
