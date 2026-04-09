from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from portfolio.models import SystemAISettings, SystemAISettingsAuditLog


User = get_user_model()


class PruneSystemAIAuditLogsCommandTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='prune-audit-user',
            email='prune-audit-user@example.com',
            password='Test@123456',
        )
        self.settings_obj = SystemAISettings.objects.create(name='default', is_active=True)

    def _create_log_with_age_days(self, age_days: int, reason: str) -> SystemAISettingsAuditLog:
        log = SystemAISettingsAuditLog.objects.create(
            settings=self.settings_obj,
            actor=self.user,
            action='update_settings',
            reason=reason,
        )
        log.created_at = timezone.now() - timezone.timedelta(days=age_days)
        log.save(update_fields=['created_at'])
        return log

    def test_dry_run_does_not_delete_rows(self):
        self._create_log_with_age_days(300, 'old-log')
        self._create_log_with_age_days(10, 'new-log')

        out = StringIO()
        call_command('prune_system_ai_audit_logs', '--days', '180', '--dry-run', stdout=out)

        self.assertIn('[DRY-RUN]', out.getvalue())
        self.assertEqual(SystemAISettingsAuditLog.objects.count(), 2)

    def test_prune_deletes_only_rows_older_than_cutoff(self):
        old_log = self._create_log_with_age_days(300, 'old-log')
        new_log = self._create_log_with_age_days(10, 'new-log')

        out = StringIO()
        call_command('prune_system_ai_audit_logs', '--days', '180', stdout=out)

        self.assertIn('completed', out.getvalue())
        remaining_ids = set(SystemAISettingsAuditLog.objects.values_list('id', flat=True))
        self.assertNotIn(old_log.id, remaining_ids)
        self.assertIn(new_log.id, remaining_ids)
