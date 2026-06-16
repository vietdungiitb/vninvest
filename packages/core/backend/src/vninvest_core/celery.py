"""Celery application for vninvest_core."""
import os

from celery import Celery

from vninvest_core.queue_policy import CELERY_TASK_QUEUES

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

app = Celery('vninvest_core')
app.config_from_object('django.conf:settings', namespace='CELERY')

# Explicitly set result backend if not already set (fixes DisabledBackend issue)
# Defer this to avoid circular import during settings loading
def _set_result_backend():
    from django.conf import settings as django_settings
    if not app.conf.result_backend:
        app.conf.result_backend = django_settings.CELERY_RESULT_BACKEND

# Call after Django is fully loaded
import django
if django.apps.apps.ready:
    _set_result_backend()
else:
    # Register to be called after Django setup
    from django.core.signals import request_started
    request_started.connect(lambda sender, **kwargs: _set_result_backend(), dispatch_uid='set_celery_result_backend')

app.autodiscover_tasks()

app.conf.task_queues = CELERY_TASK_QUEUES

# Default queue
app.conf.task_default_queue = 'celery'
