"""Celery application for vninvest_core."""
import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

app = Celery('vninvest_core')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

app.conf.beat_schedule = {
    'materialize-symbol-snapshots': {
        'task': 'market_serving.materializers.materialize_symbol_snapshot',
        'schedule': 60.0,  # every 60 seconds
    },
    'materialize-session-facts': {
        'task': 'market_serving.materializers.materialize_session_facts',
        'schedule': crontab(minute='*/5'),
    },
    'materialize-unified-alerts': {
        # UnifiedAlert and WhaleAlertCanonical are currently materialized together
        # from the market_serving owner task. Keep Celery's runtime schedule aligned
        # with settings.CELERY_BEAT_SCHEDULE so dev/prod do not diverge.
        'task': 'market_serving.materializers.materialize_unified_alerts',
        'schedule': 300.0,
    },
}
