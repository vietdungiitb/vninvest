from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings

from portfolio.models import SeedExecutionLog


class SeedEnvironmentStandardizationTests(TestCase):
    @override_settings(DEBUG=False)
    def test_seed_demo_data_blocked_on_production_without_override(self):
        with patch.dict('os.environ', {'ALLOW_DEMO_SEED': 'false'}, clear=False):
            with self.assertRaises(CommandError):
                call_command('seed_demo_data')

    @override_settings(DEBUG=False)
    def test_seed_environment_demo_profile_blocked_on_production_without_override(self):
        with patch.dict('os.environ', {'ALLOW_DEMO_SEED': 'false'}, clear=False):
            with self.assertRaises(CommandError):
                call_command('seed_environment', '--profile', 'demo-smoke', '--dry-run')

    @override_settings(DEBUG=False)
    def test_seed_environment_demo_profile_dry_run_allowed_with_env_flag(self):
        out = StringIO()
        with patch.dict('os.environ', {'ALLOW_DEMO_SEED': 'true'}, clear=False):
            call_command('seed_environment', '--profile', 'demo-smoke', '--dry-run', stdout=out)

        self.assertIn('Dry-run complete.', out.getvalue())
        log = SeedExecutionLog.objects.latest('id')
        self.assertEqual(log.seed_profile, 'demo-smoke')
        self.assertEqual(log.status, SeedExecutionLog.StatusChoices.DRY_RUN)

    def test_seed_environment_reference_profile_dry_run_logs_execution(self):
        out = StringIO()
        call_command('seed_environment', '--profile', 'reference', '--dry-run', stdout=out)

        self.assertIn('seed_securities_groups', out.getvalue())
        log = SeedExecutionLog.objects.latest('id')
        self.assertEqual(log.seed_profile, 'reference')
        self.assertEqual(log.status, SeedExecutionLog.StatusChoices.DRY_RUN)
