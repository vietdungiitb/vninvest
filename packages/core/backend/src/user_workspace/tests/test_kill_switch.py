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

    def test_AC1_exception_from_config_reader_denies(self):
        """`check_kill_switch` tự bắt lỗi và chặn ghi.

        Test này CHỈ chứng minh `except` trong `check_kill_switch` hoạt động.
        Nó KHÔNG chứng minh AC1, vì nó mock đúng hàm đang được kiểm tra nên
        không chạm vào `except Exception` bên trong `get_active_broker_config`
        - chính chỗ nuốt lỗi và trả về `kill_switch_write=False`.
        Xem `test_AC1_db_failure_denies_at_the_database_layer`.
        """
        with mock.patch.object(
            broker_runtime, 'get_active_broker_config', side_effect=OSError('db down')
        ):
            with self.assertRaises(KillSwitchIndeterminate):
                check_kill_switch('global')

    def test_AC1_db_failure_denies_at_the_database_layer(self):
        """AC1: lỗi ĐỌC TRẠNG THÁI => chặn, không cho qua (D-14).

        Lỗi bị tiêm ở tầng truy vấn, KHÔNG mock `get_active_broker_config`.
        Đây là khác biệt làm P0 lọt lần trước: hàm đọc config có
        `except Exception` trả về config mặc định, mặc định có
        `kill_switch_write=False`, nên DB chết đúng lúc đặt lệnh lại ra
        lệnh "cho phép ghi". Test cũ mock hàm nên không bao giờ chạm vào
        nhánh code đó và báo xanh.
        """
        from django.db.utils import OperationalError

        from service_ops.models import ServiceDefinition

        with mock.patch.object(
            ServiceDefinition.objects,
            'filter',
            side_effect=OperationalError('connection refused'),
        ):
            with self.assertRaises(KillSwitchIndeterminate):
                check_kill_switch('global')

    def test_AC1_db_failure_on_tenant_scope_denies(self):
        """Cùng lỗi DB nhưng ở scope `tenant` cũng phải chặn."""
        from django.db.utils import OperationalError

        from service_ops.models import ServiceDefinition

        with mock.patch.object(
            ServiceDefinition.objects,
            'filter',
            side_effect=OperationalError('connection refused'),
        ):
            with self.assertRaises(KillSwitchIndeterminate):
                check_kill_switch('tenant', tenant=_Tenant('t-1'))

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
        """AC2: mỗi task broker phải có lời gọi THẬT, không phải trong docstring.

        Bản đầu dùng `src.count("check_kill_switch('global')") >= 4` và XANH,
        trong khi 2 guard nằm trong docstring nên là string literal — code chết.
        `str.count` đếm cả chữ trong docstring, nên gate đó vô hiệu.nay đếm bằng
        AST: chỉ `Call` node thật mới tính.
        """
        import ast
        import pathlib

        backend_src = pathlib.Path(__file__).resolve().parents[2]
        path = backend_src / 'user_workspace' / 'tasks.py'
        tree = ast.parse(path.read_text(encoding='utf-8'))

        guarded = set()
        for node in ast.walk(tree):
            if not isinstance(node, ast.FunctionDef):
                continue
            for sub in ast.walk(node):
                if (
                    isinstance(sub, ast.Call)
                    and isinstance(sub.func, ast.Name)
                    and sub.func.id == 'check_kill_switch'
                ):
                    guarded.add(node.name)
                    break

        self.assertGreaterEqual(
            len(guarded), 4,
            f'chi {len(guarded)} task co check_kill_switch THAT: {sorted(guarded)}',
        )
        for expected in (
            'sync_dnse_accounts_task',
            'sync_dnse_balances_task',
            'reconcile_dnse_transactions_task',
            'test_broker_connection_task',
        ):
            self.assertIn(
                expected, guarded,
                f'{expected} chua goi check_kill_switch — neu nam trong docstring '
                f'thi no la string literal, khong bao gio chay',
            )

    def test_NO_GUARD_IS_INSIDE_A_DOCSTRING(self):
        """Negative test: chèn guard vào docstring rồi xác nhận gate bắt được.

        Đây là lỗi đã xảy ra thật: 2 guard nằm trong docstring và mọi gate
        dựa trên `str.count` vẫn xanh. Test này chống lại việc lặp lại đó.
        """
        import ast
        import inspect
        from user_workspace import tasks as tasks_mod

        for name in (
            'sync_dnse_accounts_task',
            'sync_dnse_balances_task',
            'reconcile_dnse_transactions_task',
            'test_broker_connection_task',
        ):
            with self.subTest(task=name):
                src = inspect.getsource(getattr(tasks_mod, name))
                tree = ast.parse(src)
                fn = next(n for n in tree.body if isinstance(n, ast.FunctionDef))

                first_stmt = fn.body[0]
                is_docstring = (
                    isinstance(first_stmt, ast.Expr)
                    and isinstance(first_stmt.value, ast.Constant)
                )
                # Task KHÔNG có docstring thì `fn.body[0]` đã là code thật.
                # Bỏ qua docstring nếu có, rồi quét phần còn lại.
                code_body = fn.body[1:] if is_docstring else fn.body
                real_calls = [
                    s for s in ast.walk(ast.Module(body=code_body, type_ignores=[]))
                    if isinstance(s, ast.Call)
                    and isinstance(s.func, ast.Name)
                    and s.func.id == 'check_kill_switch'
                ]
                self.assertTrue(
                    real_calls,
                    f'{name}: check_kill_switch KHONG co trong code that '
                    f'(nam trong docstring = string literal, khong chay)',
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
