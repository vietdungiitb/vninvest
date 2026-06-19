"""Celery application for vninvest_core."""
import os

from celery import Celery

from vninvest_core.queue_policy import CELERY_TASK_QUEUES

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

app = Celery('vninvest_core')
app.config_from_object('django.conf:settings', namespace='CELERY')

app.autodiscover_tasks()

app.conf.task_queues = CELERY_TASK_QUEUES

# Default queue
app.conf.task_default_queue = 'celery'
