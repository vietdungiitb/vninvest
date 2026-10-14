"""Wave 0 B0.1 tests: SubAccount provider + broker_config FK + backfill.

Chay TREN VPS STAGING theo runbook §12 (cam local):
  python manage.py test user_workspace.tests.test_subaccount_provider_binding --noinput

Fail-before: truoc B0.1, `SubAccount(provider=...)` / `broker_config=...` nem
TypeError (field chua ton tai); test migration ImportError (module chua co).
"""
import importlib

from django.contrib.auth.models import User
from django.db import IntegrityError, connection, transaction
from django.db.migrations.executor import MigrationExecutor
from django.test import TestCase

from user_workspace.models import SubAccount, UserBrokerConfig
from user_workspace.tests.tenant_test_helpers import grant_tenant


BACKFILL_MIGRATION = '0025_auto_20261014_1713'


def _run_backfill():
    """Goi forwards cua migration B0.1 (0025) — ghim ten, KHONG do leaf.

    Ly do (B0.2 phat hien): do leaf (`leaf_nodes`) tra migration MOI NHAT;
    slice sau them 0026 lam 3 test backfill vo `AttributeError`. Ghim ten +
    project_state tai 0025 thi mien nhiem voi leaf tuong lai.
    """
    mod = importlib.import_module(
        f'user_workspace.migrations.{BACKFILL_MIGRATION}')
    executor = MigrationExecutor(connection)
    state_apps = executor.loader.project_state(
        [('user_workspace', BACKFILL_MIGRATION)]).apps
    mod.backfill_subaccount_provider(state_apps, None)


def _make_user(name):
    return User.objects.create_user(username=name, password='x')


class SubAccountProviderBindingTests(TestCase):
    def setUp(self):
        self.user = _make_user('sacc-b01')
        self.tenant = grant_tenant(self.user)

    def _sub(self, **kw):
        base = {
            'user': self.user,
            'tenant': self.tenant,
            'broker': 'DNSE',
            'display_name': 'TK test',
            'account_number': '0001',
        }
        base.update(kw)
        return SubAccount.objects.create(**base)

    def test_provider_field_accepts_dnse_ssi_tcbs(self):
        for code in ('dnse', 'ssi', 'tcbs'):
            sub = self._sub(provider=code, external_id=f'ext-{code}')
            self.assertEqual(sub.provider, code)

    def test_broker_config_fk_link(self):
        cfg = UserBrokerConfig.objects.create(
            user=self.user, tenant=self.tenant, provider='dnse', label='Mac dinh')
        sub = self._sub(provider='dnse', broker_config=cfg, external_id='X1')
        self.assertEqual(sub.broker_config_id, cfg.id)
        self.assertIn(sub, cfg.sub_accounts.all())

    def test_unique_partial_tenant_config_external(self):
        cfg = UserBrokerConfig.objects.create(
            user=self.user, tenant=self.tenant, provider='dnse', label='Mac dinh')
        self._sub(provider='dnse', broker_config=cfg, external_id='DUP1')
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                self._sub(provider='dnse', broker_config=cfg, external_id='DUP1')

    def test_null_config_rows_do_not_collide(self):
        # Partial constraint: broker_config NULL + external_id rong khong chan nhau.
        self._sub(provider='', external_id='')
        self._sub(provider='', external_id='')
        self.assertEqual(SubAccount.objects.filter(external_id='').count(), 2)

    def test_backfill_provider_from_broker_source(self):
        sub = self._sub(provider='', broker_source='DNSE', external_id='BF1')
        _run_backfill()
        sub.refresh_from_db()
        self.assertEqual(sub.provider, 'dnse')

    def test_backfill_links_config_on_unique_match_else_null(self):
        cfg = UserBrokerConfig.objects.create(
            user=self.user, tenant=self.tenant, provider='dnse', label='Mac dinh')
        linked = self._sub(provider='', broker_source='DNSE', external_id='L1')
        orphan = self._sub(provider='', broker_source='SSI', external_id='O1')
        _run_backfill()
        linked.refresh_from_db()
        orphan.refresh_from_db()
        self.assertEqual(linked.broker_config_id, cfg.id)
        self.assertIsNone(orphan.broker_config_id)
        self.assertEqual(orphan.provider, 'ssi')

    def test_backfill_is_idempotent(self):
        self._sub(provider='', broker_source='TCB', external_id='IDEM1')
        _run_backfill()
        _run_backfill()
        row = SubAccount.objects.get(external_id='IDEM1')
        self.assertEqual(row.provider, 'tcbs')
