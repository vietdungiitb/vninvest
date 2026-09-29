"""SAFE-03 — kill-switch fail-closed, và phải có caller thật.

Bug goc (verify bang lenh, khong phai doc code):
    git grep -n "check_kill_switch" -- packages/core/backend/src ':!*test*'
    => CHI 1 dong, chinh la dong `def`. 0 caller trong production.
    broker_runtime.py:36-38 `except Exception` => default `kill_switch_write=False`
    => DB chet = CHO PHEP ghi (fail-open).

Da sua:
  - `check_kill_switch(scope, tenant, provider)` — 3 scope, fail-closed.
  - `KillSwitchIndeterminate` tach rieng de phan biet "chong tinh trang" voi
    "he thong khong tra loi".
  - Caller o 2 lop: view (`_assert_broker_writes_allowed` trong views_dnse.py,
    3 endpoint) va worker (4 task trong tasks.py).
"""
from __future__ import annotations

from unittest import mock

from django.test import SimpleTestCase, TestCase

from service_ops import broker_runtime
from service_ops.broker_runtime import (
    BrokerWriteDisabled,
    KillSwitchIndeterminate,
    check_kill_switch,
)


class _Cfg:
    def __init__(self, kill_switch_write):
        self.kill_switch_write = kill_switch_write


class _Tenant:
    def __init__(self, public_id):
        self.public_id = public_id


class KillSwitchDefaultAllowTests(SimpleTestCase):
    """Mặc định (switch tắt) thì cho qua."""

    def test_global_off_allows(self):
        with mock.patch.object(broker_runtime, 'get_active_broker_config', return_value=_Cfg(False)):
            check_kill_switch('global')


class KillSwitchGlobalTests(SimpleTestCase):
    def test_global_on_blocks(self):
        with mock.patch.object(broker_runtime, 'get_active_broker_config', return_value=_Cfg(True)):
            with self.assertRaises(BrokerWriteDisabled):
                check_kill_switch('global')

    def test_AC1_db_failure_denies(self):
        """AC1: lỗi đọc trạng thái ⇒ CHẶN, không phải cho qua.

        Đây là hành vi fail-open cũ: `except Exception` rơi về default `False`.
        """
        with mock.patch.object(
            broker_runtime, 'get_active_broker_config', side_effect=OSError('db down')
        ):
            with self.assertRaises(KillSwitchIndeterminate):
                check_kill_switch('global')

    def test_AC1_indeterminate_is_a_write_disabled(self):
        """Client xử lý như nhau; operator thì phân biệt được."""
        self.assertTrue(issubclass(KillSwitchIndeterminate, BrokerWriteDisabled))

    def test_unknown_scope_denies(self):
        """Scope gõ sai không được bị bỏ qua âm thầm."""
        with mock.patch.object(broker_runtime, 'get_active_broker_config', return_value=_Cfg(False)):
            with self.assertRaises(KillSwitchIndeterminate):
                check_kill_switch('typo-scope')


class KillSwitchTenantScopeTests(SimpleTestCase):
    """AC4: tenant A bật, tenant B không."""

    def _patch_tenant(self, mapping):
        return mock.patch.object(
            broker_runtime, '_tenant_kill_switch_enabled', side_effect=lambda t: mapping.get(t, False)
        )

    def test_tenant_on_blocks_only_that_tenant(self):
        with mock.patch.object(broker_runtime, 'get_active_broker_config', return_value=_Cfg(False)):
            with self._patch_tenant({'TEN-A': True, 'TEN-B': False}):
                with self.assertRaises(BrokerWriteDisabled):
                    check_kill_switch('tenant', tenant=_Tenant('TEN-A'))
                # Tenant B vẫn qua được.
                check_kill_switch('tenant', tenant=_Tenant('TEN-B'))

    def test_tenant_read_failure_fails_closed(self):
        """Không đọc được trạng thái tenant ⇒ coi như ĐANG bật.

        Kiểm tra hàm THẬT `_tenant_kill_switch_enabled`, không mock nó ra —
        mock chính nó thì fail-closed nằm trong đó sẽ không bao giờ được test.
        """
        with mock.patch.object(
            broker_runtime, 'get_active_broker_config', return_value=_Cfg(False)
        ):
            with mock.patch(
                'service_ops.models.ServiceConfig.objects.filter',
                side_effect=OSError('db down'),
            ):
                self.assertTrue(
                    broker_runtime._tenant_kill_switch_enabled('TEN-A'),
                    'lỗi đọc phải trả True (fail-closed), không phải False',
                )
            with mock.patch(
                'service_ops.models.ServiceDefinition.objects.filter',
                side_effect=OSError('db down'),
            ):
                with self.assertRaises(BrokerWriteDisabled):
                    check_kill_switch('tenant', tenant=_Tenant('TEN-A'))


class KillSwitchProviderScopeTests(SimpleTestCase):
    def test_provider_scope_blocks_only_that_provider(self):
        with mock.patch.object(broker_runtime, 'get_active_broker_config', return_value=_Cfg(False)):
            with mock.patch.object(
                broker_runtime,
                '_provider_kill_switch_enabled',
                side_effect=lambda p: {'dnse': True}.get(p, False),
            ):
                with self.assertRaises(BrokerWriteDisabled):
                    check_kill_switch('provider', provider='dnse')
                check_kill_switch('provider', provider='ssi')


class KillSwitchHasCallersTests(SimpleTestCase):
    """AC2: mỗi lớp phải có caller. Đo bằng cách ĐỌC file, không tin báo cáo."""

    def _read(self, rel):
        import pathlib

        here = pathlib.Path(__file__).resolve()
        backend_src = here.parents[2]
        return (backend_src / rel).read_text(encoding='utf-8')

    def test_view_layer_has_callers(self):
        src = self._read('user_workspace/views_dnse.py')
        self.assertIn('check_kill_switch', src, 'view layer chưa có caller nào')
        # Cả 3 endpoint tài chính phải qua gate.
        for fn in (
            '_assert_broker_writes_allowed(request, \'dnse\', action=\'place_order\')',
            '_assert_broker_writes_allowed(request, \'dnse\', action=\'send_email_otp\')',
            '_assert_broker_writes_allowed(request, \'dnse\', action=\'create_trading_token\')',
        ):
            self.assertIn(fn, src, f'thieu gate cho {fn}')

    def test_worker_layer_has_callers(self):
        src = self._read('user_workspace/tasks.py')
        self.assertGreaterEqual(
            src.count("check_kill_switch('global')"), 4,
            'worker layer phai co it nhat 4 task duoc chan',
        )

    def test_AC3_global_on_blocks_every_endpoint(self):
        """AC3: bật switch toàn cục ⇒ mọi order bị chặn, kể cả 3 endpoint."""
        from user_workspace import views_dnse

        with mock.patch.object(
            broker_runtime, 'get_active_broker_config', return_value=_Cfg(True)
        ):
            for action in ('place_order', 'send_email_otp', 'create_trading_token'):
                request = mock.Mock(tenant=_Tenant('TEN-A'), user=mock.Mock(id=1))
                with self.subTest(action=action):
                    from vninvest_core.exceptions import ServiceUnavailableException

                    with self.assertRaises(ServiceUnavailableException):
                        views_dnse._assert_broker_writes_allowed(
                            request, 'dnse', action=action
                        )
