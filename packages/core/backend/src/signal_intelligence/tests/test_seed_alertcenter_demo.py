from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from signal_intelligence.models import UnifiedAlert, WhaleAlertCanonical


class SeedAlertcenterDemoTests(TestCase):
    def test_idempotent_and_counts(self):
        call_command('seed_alertcenter_demo')
        first = UnifiedAlert.objects.filter(source_ref__contains='demo:alert-center').count()
        self.assertEqual(first, 12)
        call_command('seed_alertcenter_demo')
        second = UnifiedAlert.objects.filter(source_ref__contains='demo:alert-center').count()
        self.assertEqual(second, 12)
        # F3: whale alerts carry canonical detail (executed_at source)
        self.assertEqual(WhaleAlertCanonical.objects.filter(
            alert__source_ref__contains='demo:alert-center').count(), 2)
        # families present across 2 sessions
        types = set(UnifiedAlert.objects.filter(
            source_ref__contains='demo:alert-center').values_list('alert_type', flat=True))
        self.assertTrue({'whale', 'dark_flow', 'signal', 'system', 'ai_alert', 'ai_suggest'} <= types)

    def test_scoped_vs_blank_user_summary(self):
        call_command('seed_alertcenter_demo')
        User = get_user_model()
        seed_user = User.objects.get(username='demo_alert_user')
        blank_user = User.objects.get(username='demo_blank_user')
        client = APIClient()
        client.force_authenticate(user=seed_user)
        summary = client.get('/core/v1/signals/alert-center/summary')
        self.assertEqual(summary.status_code, 200)
        self.assertGreater(summary.json()['total'], 0)
        feed = client.get('/core/v1/signals/alert-center/feed')
        self.assertGreater(len(feed.json()['results']), 0)
        client.force_authenticate(user=blank_user)
        blank_summary = client.get('/core/v1/signals/alert-center/summary')
        self.assertEqual(blank_summary.status_code, 200)
        self.assertEqual(blank_summary.json()['total'], 0)

    def test_delete_cleans_up(self):
        call_command('seed_alertcenter_demo')
        call_command('seed_alertcenter_demo', '--delete')
        self.assertEqual(
            UnifiedAlert.objects.filter(source_ref__contains='demo:alert-center').count(), 0)
        User = get_user_model()
        self.assertFalse(User.objects.filter(username__in=('demo_alert_user', 'demo_blank_user')).exists())
