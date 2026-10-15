"""Wave 3 B3.4 fail-before: bo dem audit leftovers + backfill DNSE broker_backed.

Chay TREN VPS STAGING theo runbook STAGING_VPS_RUNBOOK.md §12 (cam local):
  python manage.py test user_workspace.tests.test_subaccount_backfill_contract --noinput

Fail-before: lenh dem `count_subaccount_backfill_gaps` chua ton tai
(ModuleNotFoundError); migration backfill DNSE `broker_backed`
(`0030_backfill_dnse_broker_backed`) chua ton tai (ImportError).
Contract (PLAN_WAVE3_ISOLATION_20261015.md §2 + PLAN_MULTI_BROKER_SYNC
muc 6 cau 4): 2 bo dem doc lap (i) `SubAccount.provider=''` count;
(ii) `SubAccount.broker_config IS NULL` count. Moi field chi AlterField
NOT NULL khi bo dem cua chinh no = 0; con sot thi giu nullable + enforce
o serializer + ticket follow-up. Backfill DNSE: data-migration tao danh muc
`broker_backed` ten "DNSE — <so TK>" cho tieu khoan DNSE chua co binding
(idempotent, khong qua API).
"""
import importlib

from django.contrib.auth.models import User
from django.core.management import call_command
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TestCase
from rest_framework.test import APIClient

from identity_access.models import CoreTenant
from user_workspace.models import (
    Portfolio,
    PortfolioBrokerBinding,
    SubAccount,
    UserBrokerConfig,
)
from user_workspace.tests.envelope import unwrapped_json

BACKFILL_DNSE_MIGRATION = '0030_backfill_dnse_broker_backed'


def _run_dnse_backfill():
    mod = importlib.import_module(
        f'user_workspace.migrations.{BACKFILL_DNSE_MIGRATION}')
    executor = MigrationExecutor(connection)
    state_apps = executor.loader.project_state(
        [('user_workspace', BACKFILL_DNSE_MIGRATION)]).apps
    mod.backfill_dnse_broker_backed(state_apps, None)


def _owner_client(username):
    user = User.objects.create_user(username=username, password='x')
    tenant = CoreTenant.objects.create(
        tenant_code=f't-{username}', display_name=username,
        owner_user=user, status=CoreTenant.StatusChoices.ACTIVE,
    )
    client = APIClient()
    client.force_login(user)
    client.defaults['HTTP_X_TENANT_ID'] = tenant.public_id
    return user, tenant, client


class BackfillCountersTests(TestCase):
    def setUp(self):
        self.user, self.tenant, _ = _owner_client('pcount')
        self.cfg = UserBrokerConfig.objects.create(
            user=self.user, tenant=self.tenant, provider='dnse',
            label='Mac dinh')

    def _sub(self, **kw):
        base = {
            'user': self.user, 'tenant': self.tenant, 'broker': 'DNSE',
            'display_name': 'TK dem', 'account_number': '0001',
        }
        base.update(kw)
        return SubAccount.objects.create(**base)

    def test_counts_distinguish_each_field(self):
        from user_workspace.management.commands.count_subaccount_backfill_gaps import (
            count_backfill_gaps,
        )
        self._sub(provider='', external_id='G1')
        self._sub(provider='', broker_config=self.cfg, external_id='G2')
        self._sub(provider='dnse', external_id='G3')
        gaps = count_backfill_gaps()
        self.assertEqual(gaps['provider_empty'], 2)
        self.assertEqual(gaps['broker_config_null'], 2)

    def test_command_prints_ascii_counts(self):
        import io
        self._sub(provider='', external_id='C1')
        out = io.StringIO()
        call_command('count_subaccount_backfill_gaps', stdout=out)
        text = out.getvalue()
        text.encode('ascii')
        self.assertIn('provider_empty=1', text)
        self.assertIn('broker_config_null=1', text)


class DnseBrokerBackedBackfillTests(TestCase):
    def setUp(self):
        self.user, self.tenant, _ = _owner_client('pbfill')
        self.portfolio = Portfolio.objects.create(
            user=self.user, tenant=self.tenant, name='DM cu')

    def _sub(self, **kw):
        base = {
            'user': self.user, 'tenant': self.tenant,
            'portfolio': self.portfolio, 'broker': 'DNSE',
            'display_name': 'TK DNSE', 'account_number': '070C123456',
            'provider': 'dnse', 'external_id': 'DNSE-1',
        }
        base.update(kw)
        return SubAccount.objects.create(**base)

    def test_backfill_creates_broker_backed_named_portfolio(self):
        sub = self._sub()
        _run_dnse_backfill()
        created = Portfolio.objects.get(
            user=self.user, tenant=self.tenant, name='DNSE — 070C123456')
        self.assertEqual(created.kind, 'broker_backed')
        binding = PortfolioBrokerBinding.objects.get(
            portfolio=created, sub_account=sub)
        self.assertEqual(binding.role, 'primary')
        self.assertEqual(binding.tenant_id, self.tenant.id)

    def test_backfill_is_idempotent_and_skips_bound_and_foreign(self):
        sub = self._sub()
        other = self._sub(
            broker='SSI', display_name='TK SSI', account_number='036C9',
            provider='ssi', external_id='SSI-1')
        bound = self._sub(account_number='070C777', external_id='DNSE-2')
        PortfolioBrokerBinding.objects.create(
            portfolio=self.portfolio, sub_account=bound,
            tenant=self.tenant, role='primary')
        _run_dnse_backfill()
        _run_dnse_backfill()
        self.assertEqual(Portfolio.objects.filter(
            user=self.user, tenant=self.tenant,
            name__startswith='DNSE — ').count(), 1)
        self.assertFalse(PortfolioBrokerBinding.objects.filter(
            sub_account=other).exists())

    def test_backfill_adopts_existing_broker_backed_home(self):
        home = Portfolio.objects.create(
            user=self.user, tenant=self.tenant, name='DM DNSE cu',
            kind='broker_backed')
        sub = self._sub(portfolio=home)
        _run_dnse_backfill()
        self.assertTrue(PortfolioBrokerBinding.objects.filter(
            portfolio=home, sub_account=sub).exists())
        self.assertFalse(Portfolio.objects.filter(
            name__startswith='DNSE — ').exists())


class SubAccountProviderEnforceTests(TestCase):
    def setUp(self):
        self.user, self.tenant, self.client = _owner_client('penf')
        self.portfolio = Portfolio.objects.create(
            user=self.user, tenant=self.tenant, name='DM enforce')

    def test_create_with_explicit_empty_provider_rejected(self):
        resp = self.client.post(
            '/core/v1/portfolio/subaccounts/',
            {'broker': 'DNSE', 'display_name': 'TK rong',
             'account_number': '0001', 'provider': ''},
            format='json')
        self.assertEqual(resp.status_code, 400)

    def test_create_without_provider_keeps_backward_compat(self):
        resp = self.client.post(
            '/core/v1/portfolio/subaccounts/',
            {'broker': 'DNSE', 'display_name': 'TK thua',
             'account_number': '0002'},
            format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(unwrapped_json(resp)['provider'], '')
