"""Tenant lifecycle scheduler and routing coverage for T06."""
import os
import sys

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

from django.test import SimpleTestCase

from vninvest_core import settings
from vninvest_core.queue_policy import SCHEDULER_QUEUE_MAP, TASK_ROUTES


class TenantLifecycleScheduleTests(SimpleTestCase):
    def test_tenant_lifecycle_app_is_registered(self):
        self.assertIn('tenant_lifecycle', settings.INSTALLED_APPS)

    def test_tenant_lifecycle_tasks_route_to_celery_queue(self):
        self.assertEqual(TASK_ROUTES['tenant_lifecycle.tasks.auto_expire_trials']['queue'], 'celery')
        self.assertEqual(TASK_ROUTES['tenant_lifecycle.tasks.auto_suspend_quota_overflow']['queue'], 'celery')
        self.assertEqual(TASK_ROUTES['tenant_lifecycle.tasks.send_trial_expiry_warning']['queue'], 'celery')
        self.assertEqual(TASK_ROUTES['tenant_lifecycle.tasks.auto_deprovision_stale']['queue'], 'celery')

    def test_tenant_lifecycle_periodic_schedules_exist(self):
        self.assertEqual(SCHEDULER_QUEUE_MAP['auto-expire-trials'], 'celery')
        self.assertEqual(SCHEDULER_QUEUE_MAP['auto-suspend-quota-overflow'], 'celery')
        self.assertEqual(SCHEDULER_QUEUE_MAP['send-trial-expiry-warning'], 'celery')
        self.assertEqual(SCHEDULER_QUEUE_MAP['auto-deprovision-stale'], 'celery')

        self.assertIn('auto-expire-trials', settings.CELERY_BEAT_SCHEDULE)
        self.assertIn('auto-suspend-quota-overflow', settings.CELERY_BEAT_SCHEDULE)
        self.assertIn('send-trial-expiry-warning', settings.CELERY_BEAT_SCHEDULE)
        self.assertIn('auto-deprovision-stale', settings.CELERY_BEAT_SCHEDULE)
