"""Celery application for vninvest_core."""
import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

app = Celery('vninvest_core')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# Queue definitions
app.conf.task_queues = (
    {
        'name': 'celery',
        'routing_key': 'celery',
        'exchange': 'celery',
    },
    {
        'name': 'realtime_prefetch',
        'routing_key': 'realtime_prefetch',
        'exchange': 'realtime_prefetch',
    },
    {
        'name': 'realtime_stream',
        'routing_key': 'realtime_stream',
        'exchange': 'realtime_stream',
    },
    {
        'name': 'enrichment_offhours',
        'routing_key': 'enrichment_offhours',
        'exchange': 'enrichment_offhours',
    },
    {
        'name': 'analytics_heavy',
        'routing_key': 'analytics_heavy',
        'exchange': 'analytics_heavy',
    },
    {
        'name': 'manual_on_demand',
        'routing_key': 'manual_on_demand',
        'exchange': 'manual_on_demand',
    },
)

# Default queue
app.conf.task_default_queue = 'celery'
