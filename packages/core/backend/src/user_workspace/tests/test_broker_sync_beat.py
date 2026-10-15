"""Wave 1 B1.4 tests: sync guard + beat schedule + fan-out task.

Chay TREN VPS STAGING theo runbook §12 (cam local):
  python manage.py test user_workspace.tests.test_broker_sync_beat --noinput

Fail-before: truoc B1.4, import sync_guard nem ImportError; beat key
thieu; fan-out task chua ton tai.
Khong I/O that: service/credential stub, kill-switch mock, khong mang.
"""
from datetime import datetime
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.contrib.auth.models import User
from django.test import SimpleTestCase, TestCase

from user_workspace.broker.adapters import (
    BrokerBalance,
    BrokerPosition,
)


def _make_user(name):
    return User.objects.create_user(username=name, password='x')


class SyncGuardTests(SimpleTestCase):
    def test_quiet_hours_blocks(self):
        from user_workspace.broker import sync_guard
        from user_workspace.broker.sync_guard import BrokerSyncBlockedError
        # 00:30 gio VN — trong quiet-hours mac dinh (can cu broker_runtime).
        with patch(
            'user_workspace.broker.sync_guard._in_quiet_hours',
            return_value=True,
        ), patch(
            'user_workspace.broker.sync_guard._check_kill_switch',
        ):
            with self.assertRaises(BrokerSyncBlockedError) as ctx:
                sync_guard.assert_sync_allowed()
        self.assertEqual(ctx.exception.code, 'broker_quiet_hours')

    def test_kill_switch_blocks(self):
        from user_workspace.broker import sync_guard
        from service_ops.broker_runtime import BrokerWriteDisabled
        from user_workspace.broker.sync_guard import BrokerSyncBlockedError
        with patch(
            'user_workspace.broker.sync_guard._check_kill_switch',
            side_effect=BrokerWriteDisabled('tat'),
        ), patch(
            'user_workspace.broker.sync_guard._in_quiet_hours',
            return_value=False,
        ):
            with self.assertRaises(BrokerSyncBlockedError) as ctx:
                sync_guard.assert_sync_allowed()
        self.assertEqual(ctx.exception.code, 'broker_writes_disabled')

    def test_allowed_when_clear(self):
        from user_workspace.broker import sync_guard
        with patch(
            'user_workspace.broker.sync_guard._check_kill_switch',
        ) as kill, patch(
            'user_workspace.broker.sync_guard._in_quiet_hours',
            return_value=False,
        ):
            sync_guard.assert_sync_allowed(provider='dnse')
        kill.assert_called()

    def test_quiet_hours_boundaries_vn_time(self):
        from service_ops.broker_runtime import in_quiet_hours
        vn = ZoneInfo('Asia/Ho_Chi_Minh')
        # Ngoai gio: 10:00 VN => khong quiet (can cu cau hinh mac dinh).
        self.assertFalse(in_quiet_hours(
            now=datetime(2026, 10, 15, 10, 0, tzinfo=vn)))


class BeatScheduleTests(SimpleTestCase):
    def test_broker_sync_positions_scheduled(self):
        from django.conf import settings
        entry = settings.CELERY_BEAT_SCHEDULE.get('broker-sync-positions-30m')
        self.assertIsNotNone(entry)
        self.assertEqual(
            entry['task'], 'user_workspace.sync_all_broker_positions_task')
        self.assertEqual(entry['schedule'], 1800.0)


class SyncAllPositionsTaskTests(TestCase):
    def setUp(self):
        from user_workspace.tests.tenant_test_helpers import grant_tenant
        self.user = _make_user('beat-b14')
        self.tenant = grant_tenant(self.user)

    def _config_with_sub(self, provider='dnse', with_tenant=True):
        from user_workspace.models import Portfolio, SubAccount, UserBrokerConfig
        cfg = UserBrokerConfig.objects.create(
            user=self.user,
            tenant=self.tenant if with_tenant else None,
            provider=provider, label='Mac dinh')
        cfg.set_secrets({'client_id': 'C', 'client_secret': 'S'})
        cfg.save(update_fields=['secrets_cipher'])
        portfolio = Portfolio.objects.create(
            user=self.user, tenant=self.tenant, name='DM',
            kind='broker_backed')
        sub = SubAccount.objects.create(
            user=self.user, tenant=self.tenant, portfolio=portfolio,
            broker='DNSE', display_name='TK', account_number='0001',
            provider=provider, external_id='E1', broker_config=cfg)
        return cfg, sub

    def _fake_service(self):
        from user_workspace.broker.adapters import BrokerAdapter
        from user_workspace.broker.sync_service import BrokerSyncService

        class Stub(BrokerAdapter):
            provider_id = 'stub'

            def is_available(self):
                return True

            def list_accounts(self):
                return []

            def get_balance(self, account_no):
                return BrokerBalance(cash=10.0, net_equity=110.0)

            def get_positions(self, account_no):
                return [BrokerPosition(symbol='VCB', quantity=1.0)]

            def get_orders(self, account_no):
                return []

        return BrokerSyncService(Stub())

    def test_fanout_writes_run_and_snapshots(self):
        from user_workspace import tasks as ws_tasks
        from user_workspace.models import BrokerSyncRun, PositionSnapshot
        self._config_with_sub()
        with patch.object(
            ws_tasks.BrokerSyncService, 'for_config',
            return_value=self._fake_service(),
        ):
            result = ws_tasks.sync_all_broker_positions_task.run()
        self.assertTrue(result['ok'])
        self.assertEqual(result['triggered_count'], 1)
        self.assertEqual(BrokerSyncRun.objects.filter(
            status='succeeded').count(), 1)
        self.assertTrue(PositionSnapshot.objects.filter(symbol='VCB').exists())

    def test_fanout_skips_quiet_hours(self):
        from user_workspace import tasks as ws_tasks
        self._config_with_sub()
        with patch(
            'user_workspace.tasks._beat_in_quiet_hours', return_value=True,
        ):
            result = ws_tasks.sync_all_broker_positions_task.run()
        self.assertTrue(result['ok'])
        self.assertEqual(result.get('skipped'), 'quiet_hours')

    def test_fanout_kill_switch_fail_closed(self):
        from service_ops.broker_runtime import BrokerWriteDisabled
        from user_workspace import tasks as ws_tasks
        self._config_with_sub()
        with patch(
            'user_workspace.tasks._beat_check_kill_switch',
            side_effect=BrokerWriteDisabled('tat'),
        ):
            result = ws_tasks.sync_all_broker_positions_task.run()
        self.assertFalse(result['ok'])
        self.assertEqual(result['error'], 'broker_writes_disabled')

    def test_fanout_skips_tenantless_config(self):
        from user_workspace import tasks as ws_tasks
        from user_workspace.models import BrokerSyncRun
        self._config_with_sub(with_tenant=False)
        with patch.object(
            ws_tasks.BrokerSyncService, 'for_config',
            return_value=self._fake_service(),
        ):
            result = ws_tasks.sync_all_broker_positions_task.run()
        self.assertTrue(result['ok'])
        self.assertEqual(result['triggered_count'], 0)
        self.assertEqual(BrokerSyncRun.objects.count(), 0)
