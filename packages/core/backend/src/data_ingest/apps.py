"""
data_ingest — Django app for tracking ingest jobs and runs.

Models: IngestJob, IngestRun
"""
from django.apps import AppConfig


class DataIngestConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'data_ingest'
    verbose_name = 'Data Ingest'
