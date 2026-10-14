"""Wave 0 B0.4 tests: BrokerSyncRun + BrokerSyncIssue.

Chay TREN VPS STAGING theo runbook §12 (cam local):
  python manage.py test user_workspace.tests.test_sync_run_issue --noinput

Fail-before: truoc B0.4, import BrokerSyncRun nem ImportError.
"""
from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from user_workspace.models import BrokerSyncIssue, BrokerSyncRun
from user_workspace.tests.tenant_test_helpers import grant_tenant


def _make_user(name):
    return User.objects.create_user(username=name, password='x')


class BrokerSyncRunIssueTests(TestCase):
    def setUp(self):
        self.user = _make_user('sync-b04')
        self.tenant = grant_tenant(self.user)

    def _run(self, **kw):
        base = {'user': self.user, 'tenant': self.tenant, 'provider': 'dnse'}
        base.update(kw)
        return BrokerSyncRun.objects.create(**base)

    def test_run_defaults_pending_empty_stats(self):
        run = self._run()
        self.assertEqual(run.status, 'pending')
        self.assertEqual(run.stats, {})
        self.assertEqual(run.error, '')
        self.assertIsNone(run.finished_at)
        self.assertIsNotNone(run.started_at)

    def test_run_status_transitions(self):
        run = self._run(status='running')
        run.status = 'succeeded'
        run.finished_at = timezone.now()
        run.stats = {'accounts': 2, 'positions': 5}
        run.save()
        run.refresh_from_db()
        self.assertEqual(run.status, 'succeeded')
        self.assertEqual(run.stats['positions'], 5)

    def test_run_accepts_all_providers(self):
        for code in ('dnse', 'ssi', 'tcbs'):
            run = self._run(provider=code)
            self.assertEqual(run.provider, code)

    def test_issue_links_run_and_defaults_unresolved(self):
        run = self._run()
        issue = BrokerSyncIssue.objects.create(
            run=run, tenant=self.tenant, severity='warning',
            code='position_drift', payload={'symbol': 'VCB'})
        self.assertEqual(issue.run_id, run.id)
        self.assertFalse(issue.resolved)
        self.assertIsNone(issue.resolved_at)
        self.assertIn(issue, run.issues.all())

    def test_issue_survives_run_delete(self):
        run = self._run()
        issue = BrokerSyncIssue.objects.create(
            run=run, tenant=self.tenant, severity='error',
            code='sync_failed', payload={})
        run.delete()
        issue.refresh_from_db()
        self.assertIsNone(issue.run_id)

    def test_issue_resolve(self):
        issue = BrokerSyncIssue.objects.create(
            run=None, tenant=self.tenant, severity='info',
            code='note', payload={})
        issue.resolved = True
        issue.resolved_at = timezone.now()
        issue.save()
        issue.refresh_from_db()
        self.assertTrue(issue.resolved)
