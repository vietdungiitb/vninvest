"""Wave 1 B1.5 tests: drift broker vs ledger -> BrokerSyncIssue.

Chay TREN VPS STAGING theo runbook §12 (cam local):
  python manage.py test user_workspace.tests.test_broker_drift --noinput

Fail-before: truoc B1.5, import detect_position_drift nem ImportError.
Ham thuan khong DB; ham persist can fixtures.
"""
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import SimpleTestCase, TestCase

from user_workspace.broker.adapters import BrokerPosition
from user_workspace.models import BrokerSyncIssue, Portfolio, SubAccount
from user_workspace.tests.tenant_test_helpers import grant_tenant


def _make_user(name):
    return User.objects.create_user(username=name, password='x')


class DetectDriftPureTests(SimpleTestCase):
    def _call(self, ledger, broker):
        from user_workspace.broker.drift import detect_position_drift
        return detect_position_drift(ledger, broker)

    def test_no_drift_equal(self):
        out = self._call(
            {'VCB': {'quantity': Decimal('10'), 'avg_cost': Decimal('90')}},
            [BrokerPosition(symbol='VCB', quantity=10.0, avg_price=90.0)])
        self.assertEqual(out, [])

    def test_quantity_mismatch(self):
        out = self._call(
            {'VCB': {'quantity': Decimal('10'), 'avg_cost': Decimal('90')}},
            [BrokerPosition(symbol='VCB', quantity=7.0, avg_price=90.0)])
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]['code'], 'position_drift')
        self.assertEqual(out[0]['symbol'], 'VCB')

    def test_missing_each_side(self):
        out = self._call(
            {'VCB': {'quantity': Decimal('10'), 'avg_cost': Decimal('90')}},
            [BrokerPosition(symbol='HPG', quantity=5.0)])
        codes = sorted(d['code'] for d in out)
        self.assertEqual(codes, ['position_missing_broker', 'position_missing_ledger'])

    def test_case_insensitive_symbol(self):
        out = self._call(
            {'vcb': {'quantity': Decimal('10'), 'avg_cost': Decimal('90')}},
            [BrokerPosition(symbol='VCB', quantity=10.0)])
        self.assertEqual(out, [])


class ReportDriftTests(TestCase):
    def setUp(self):
        self.user = _make_user('drift-b15')
        self.tenant = grant_tenant(self.user)
        self.portfolio = Portfolio.objects.create(
            user=self.user, tenant=self.tenant, name='DM')
        self.sub = SubAccount.objects.create(
            user=self.user, tenant=self.tenant, portfolio=self.portfolio,
            broker='DNSE', display_name='TK', account_number='0001',
            provider='dnse', external_id='E1')

    def test_report_persists_issues(self):
        from user_workspace.broker import drift as drift_mod
        from user_workspace.broker.sync_service import BrokerSyncService
        from user_workspace.broker.adapters import BrokerAdapter

        class Stub(BrokerAdapter):
            provider_id = 'stub'

            def is_available(self):
                return True

            def list_accounts(self):
                return []

            def get_balance(self, account_no):
                from user_workspace.broker.adapters import BrokerBalance
                return BrokerBalance()

            def get_positions(self, account_no):
                return [BrokerPosition(symbol='VCB', quantity=7.0)]

            def get_orders(self, account_no):
                return []

        service = BrokerSyncService(Stub())
        created = drift_mod.report_drift_issues(
            self.portfolio, self.tenant, service, self.sub,
            ledger_holdings={'VCB': {'quantity': Decimal('10'),
                                     'avg_cost': Decimal('90')}},
            run=None)
        self.assertEqual(len(created), 1)
        self.assertEqual(BrokerSyncIssue.objects.count(), 1)
        issue = BrokerSyncIssue.objects.get()
        self.assertEqual(issue.code, 'position_drift')
        self.assertEqual(issue.severity, 'warning')
        self.assertFalse(issue.resolved)

    def test_report_no_drift_no_rows(self):
        from user_workspace.broker import drift as drift_mod
        from user_workspace.broker.sync_service import BrokerSyncService
        from user_workspace.broker.adapters import BrokerAdapter

        class Stub(BrokerAdapter):
            provider_id = 'stub'

            def is_available(self):
                return True

            def list_accounts(self):
                return []

            def get_balance(self, account_no):
                from user_workspace.broker.adapters import BrokerBalance
                return BrokerBalance()

            def get_positions(self, account_no):
                return [BrokerPosition(symbol='VCB', quantity=10.0)]

            def get_orders(self, account_no):
                return []

        service = BrokerSyncService(Stub())
        created = drift_mod.report_drift_issues(
            self.portfolio, self.tenant, service, self.sub,
            ledger_holdings={'VCB': {'quantity': Decimal('10'),
                                     'avg_cost': Decimal('90')}},
            run=None)
        self.assertEqual(created, [])
        self.assertEqual(BrokerSyncIssue.objects.count(), 0)
