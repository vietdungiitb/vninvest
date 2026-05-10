from io import StringIO

from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase

from portfolio.models import IntradayTick, SystemAISettings, UserConfig, WhaleAdvisory


class SeedDemoDataWhaleFrontendTests(TestCase):
    def test_seed_demo_data_populates_testuser_whale_frontend_data(self):
        stdout = StringIO()

        call_command('seed_demo_data', '--reset', '--allow-production', stdout=stdout)

        testuser = User.objects.get(username='testuser')
        user_config = UserConfig.objects.get(user=testuser)

        self.assertEqual(user_config.plan, UserConfig.PlanChoices.PREMIUM)
        self.assertTrue(user_config.email_verified)
        system_ai = SystemAISettings.get_active()
        self.assertIsNotNone(system_ai)
        self.assertTrue(system_ai.is_active)
        self.assertGreaterEqual(WhaleAdvisory.objects.filter(ai_provider='seed_demo_data').count(), 12)
        self.assertGreaterEqual(WhaleAdvisory.objects.filter(user=testuser, ai_provider='seed_demo_data').count(), 12)
        self.assertGreaterEqual(IntradayTick.objects.filter(stream_id__startswith='seed-demo-testuser-').count(), 28)
