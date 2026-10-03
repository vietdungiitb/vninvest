"""TEN-06 — cache key phai chua `tenant_id`, va phai fail-closed khi thieu.

Bug goc (verify bang lenh, khong phai doc code):
    user_workspace/services/idempotency.py:52   f'idemp:{scope}:{user_id}:{key}'
    user_workspace/portfolio_analytics_views.py:1952
                                              f"screener:scan:{user_id}:{rule.id}:..."
    user_workspace/portfolio_analytics_views.py:2683
                                              f"screener:sched_alerts:{request.user.id}"
    user_workspace/views_broker.py:169          f'broker:testconn:{user.id}:{normalized}'

Khong key nao co tenant. User thuoc 2 tenant thi:
  - cung mot `Idempotency-Key` o tenant B bi khop / bi 409 nham khi tenant A
    da ghi record => ro `result` cua don hang tenant A;
  - cung rule + cung ngay o tenant B nhan ket qua scan cua tenant A;
  - cung provider o tenant B thay bang bao loi rate-limit cua tenant A.

Moi test duoi day ghi lai MOT lan key CHUA co tenant de chung minh test thuc su
bat duoc loi (negative test), chu khong chi chay xanh.
"""
from __future__ import annotations

import datetime as dt

from django.core.cache import cache
from django.test import SimpleTestCase, TestCase, override_settings

from user_workspace.ledger import services as ledger_services
from user_workspace.portfolio_analytics_views import _scan_cache_key
from user_workspace.services import idempotency


class _Tenant:
    """Duck-type of CoreTenant: the code only reads `.public_id`."""

    def __init__(self, public_id):
        self.public_id = public_id


class _Rule:
    def __init__(self, rule_id, updated_at=None):
        self.id = rule_id
        self.updated_at = updated_at


class IdempotencyTenantScopingTests(TestCase):
    """Tenant phải là **một phần của ràng buộc DB**, và thiếu tenant thì từ chối.

    Vì sao phải viết lại (sửa hồi quy của `aade0a02`, không phải tuỳ chọn):

    - Lớp là `SimpleTestCase` ⇒ **cấm truy vấn DB**. Nhưng LED-06 chuyển
      idempotency từ cache sang bảng `IdempotencyRecord` có UNIQUE, nên lớp này
      **không hề chạm bảng** mà vẫn được coi là xanh.
    - Test gọi `idempotency._cache_key(...)` — hàm **đã bị xoá** ⇒
      `AttributeError`, chứ không phải kiểm tra cái gì.
    - Test truyền `tenant_id='TEN-A'` — chuỗi tùy ý. API mới **fail-closed**:
      `_resolve_tenant` (`idempotency.py:99-104`) tra `CoreTenant` theo
      `public_id` và **ném** nếu không có. Chuỗi bịa đặt không còn hợp lệ.

    Vì sao lớp này đỏ mà không ai thấy: `manage.py test` không label **không dò
    tới `src/`**. Đã sửa bằng `run_tests.py` (2 760 test thay vì 642).
    """

    def setUp(self):
        cache.clear()
        from django.contrib.auth import get_user_model

        from identity_access.models import CoreTenant

        User = get_user_model()
        # `CoreTenant` có UNIQUE trên `owner_user`
        # (`identity_access_coretenant_owner_user_id_key`) nên mỗi tenant cần
        # một owner riêng — dùng chung owner sẽ vi phạm ràng buộc DB.
        self.owner_a = User.objects.create_user(
            username='idem-owner-a', password='x')
        self.owner_b = User.objects.create_user(
            username='idem-owner-b', password='x')
        self.tenant_a = CoreTenant.objects.create(
            tenant_code='idem-a', display_name='tenant A',
            owner_user=self.owner_a, status=CoreTenant.StatusChoices.ACTIVE)
        self.tenant_b = CoreTenant.objects.create(
            tenant_code='idem-b', display_name='tenant B',
            owner_user=self.owner_b, status=CoreTenant.StatusChoices.ACTIVE)
        self.a = str(self.tenant_a.public_id)
        self.b = str(self.tenant_b.public_id)
        # Actor dùng chung ở cả 2 tenant: đó mới là tình huống nguy hiểm —
        # cùng một user thuộc nhiều tenant, cùng `Idempotency-Key`.
        self.shared_actor = User.objects.create_user(
            username='idem-shared-actor', password='x')
        self.uid = self.shared_actor.pk

    def test_same_key_two_tenants_are_independent(self):
        """AC2: cùng key ở 2 tenant phải độc lập, không replay chéo nhau."""
        a = idempotency.claim(
            user_id=self.uid, scope='dnse_order', key='K',
            fingerprint='fp', tenant_id=self.a,
        )
        self.assertTrue(a.acquired)
        self.assertTrue(
            idempotency.store_result(
                user_id=self.uid, scope='dnse_order', key='K', fingerprint='fp',
                result={'order': 'A-1'}, tenant_id=self.a,
            )
        )

        b = idempotency.claim(
            user_id=self.uid, scope='dnse_order', key='K',
            fingerprint='fp', tenant_id=self.b,
        )
        self.assertFalse(b.replay, 'tenant B đọc replay của tenant A')
        self.assertFalse(b.conflict, 'tenant B bị 409 nhầm do bản ghi của A')
        self.assertTrue(b.acquired)

    def test_different_payload_same_key_same_tenant_conflicts(self):
        """AC2 (SAFE-02): cùng tenant, cùng key, payload khác ⇒ conflict."""
        idempotency.claim(
            user_id=self.uid, scope='dnse_order', key='K',
            fingerprint='fp1', tenant_id=self.a,
        )
        other = idempotency.claim(
            user_id=self.uid, scope='dnse_order', key='K',
            fingerprint='fp2', tenant_id=self.a,
        )
        self.assertTrue(other.conflict)

    def test_replay_within_same_tenant_still_works(self):
        """Bảo vệ hành vi cũ: replay trong CÙNG tenant vẫn trả kết quả cũ."""
        idempotency.claim(
            user_id=self.uid, scope='dnse_order', key='K',
            fingerprint='fp', tenant_id=self.a,
        )
        idempotency.store_result(
            user_id=self.uid, scope='dnse_order', key='K', fingerprint='fp',
            result={'order': 'A-1'}, tenant_id=self.a,
        )
        replay = idempotency.claim(
            user_id=self.uid, scope='dnse_order', key='K',
            fingerprint='fp', tenant_id=self.a,
        )
        self.assertTrue(replay.replay)
        self.assertEqual(replay.result, {'order': 'A-1'})

    def test_missing_tenant_is_refused_not_given_its_own_namespace(self):
        """Đổi hành vi so với bản cũ, và đây là **cố ý**.

        Bản cũ khẳng định: thiếu tenant thì được namespace riêng và vẫn chạy
        được. Đó là **fail-open** — đơn hàng tài chính ghi vào namespace không
        xác định thì không thể truy vết tenant.

        LED-06 đổi sang fail-closed (`idempotency.py:92-96`): thiếu tenant thì
        **từ chối lệnh**. Test viết lại theo hành vi mới, vì hành vi cũ là hành
        vi không an toàn.
        """
        with self.assertRaises(idempotency.IdempotencyTenantUnresolved):
            idempotency.claim(
                user_id=self.uid, scope='dnse_order', key='K',
                fingerprint='fp', tenant_id=None,
            )

    def test_unknown_tenant_id_is_refused(self):
        """Tenant không tồn tại cũng phải từ chối, không tự tạo namespace."""
        with self.assertRaises(idempotency.IdempotencyTenantUnresolved):
            idempotency.claim(
                user_id=self.uid, scope='dnse_order', key='K',
                fingerprint='fp', tenant_id='TEN-KHONG-TON-TAI',
            )

    def test_NEGATIVE_TEST_tenant_isolation_is_enforced_not_implied(self):
        """Negative test: cách ly tenant phải do **DB cưỡng chế**.

        Bản cũ kiểm chuỗi khoá có chứa `'TEN-A'` hay không — chuỗi đó chỉ
        *gợi ý* cách ly, không *cưỡng chế* nó. Bản này kiểm **hành vi**: nếu
        ràng buộc DB bị nới, hai tenant sẽ tranh cùng một dòng và test đỏ.
        """
        from user_workspace.models import IdempotencyRecord

        a = idempotency.claim(
            user_id=self.uid, scope='dnse_order', key='K',
            fingerprint='fp', tenant_id=self.a,
        )
        b = idempotency.claim(
            user_id=self.uid, scope='dnse_order', key='K',
            fingerprint='fp', tenant_id=self.b,
        )
        self.assertTrue(a.acquired)
        self.assertTrue(
            b.acquired,
            'tenant B phải có hàng riêng — nếu bị tranh hàng với A thì khoá '
            'KHÔNG còn tách tenant',
        )

        # `tenant_id` là FK nên `values_list` trả về **int**, không phải str.
        rows = set(IdempotencyRecord.objects.filter(
            actor_id=self.uid, scope='dnse_order', key='K',
        ).values_list('tenant_id', flat=True))
        self.assertEqual(
            rows, {self.tenant_a.pk, self.tenant_b.pk},
            'phải có 2 dòng tách biệt — đây mới là cách ly thật, không phải '
            '"hai lần claim đều acquired"',
        )


class ScreenerScanCacheTenantTests(SimpleTestCase):
    """TEN-06: scan cache key phai tach 2 tenant."""

    def setUp(self):
        cache.clear()

    def test_two_tenants_two_keys(self):
        """AC1: cung user + cung rule + cung ngay, 2 tenant => 2 key khac nhau."""
        rule = _Rule(rule_id=42, updated_at=dt.datetime(2026, 9, 29, tzinfo=dt.timezone.utc))
        day = dt.date(2026, 9, 29)
        key_a = _scan_cache_key(7, rule, day, False, tenant_id='TEN-A')
        key_b = _scan_cache_key(7, rule, day, False, tenant_id='TEN-B')
        self.assertNotEqual(key_a, key_b, '2 tenant phai ra 2 cache key khac nhau')
        self.assertIn('TEN-A', key_a)
        self.assertIn('TEN-B', key_b)

    def test_tenant_b_cannot_read_tenant_a_cached_scan(self):
        """AC2: cache đầy của A thì B vẫn phải tính lại, không đọc trong A."""
        rule = _Rule(rule_id=42, updated_at=dt.datetime(2026, 9, 29, tzinfo=dt.timezone.utc))
        day = dt.date(2026, 9, 29)
        key_a = _scan_cache_key(7, rule, day, False, tenant_id='TEN-A')
        cache.set(key_a, ['symbol-A'], 60)
        key_b = _scan_cache_key(7, rule, day, False, tenant_id='TEN-B')
        self.assertIsNone(cache.get(key_b), 'tenant B doc duoc ket qua scan cua tenant A')

    def test_view_and_task_build_the_identical_key(self):
        """D-14: đường ĐỌC (view) và đường GHI (task) phải tạo CÙNG một key.

        Đây là lỗi im lặng nguy hiểm: nếu hai bên lệch key, task vẫn "ghi cache
        thành công" nhưng không ai đọc được ⇒ mỗi lần scan đều chạy lại từ
        đầu, và test `test_screener_async_run` đỏ `202 != 200`.

        Bug này ĐÃ xảy ra: view lấy `request.tenant` còn task lấy `rule.tenant`.
        Test này khẳng định cả hai phải lấy tenant từ `rule.tenant`.
        """
        import ast
        import pathlib

        backend_src = pathlib.Path(__file__).resolve().parents[2]
        views_src = (backend_src / 'user_workspace/portfolio_analytics_views.py').read_text(
            encoding='utf-8'
        )
        tasks_src = (backend_src / 'user_workspace/screener_tasks.py').read_text(
            encoding='utf-8'
        )

        # Cả hai file phải gọi `_scan_cache_key` với `tenant_id=` — không được
        # để mặc định None ở một bên.
        self.assertIn('tenant_id=_scan_tenant_id', views_src,
                      'view phai truyen tenant_id cho _scan_cache_key')
        self.assertIn('tenant_id=_key_tenant_id', tasks_src,
                      'task phai truyen tenant_id cho _scan_cache_key')

        # Cả hai phải lấy tenant từ RULE, KHÔNG từ `request.tenant`.
        # Code thật viết `getattr(<biến rule>, "tenant", None)` — "tenant" là
        # CHUỖI, không phải `ast.Attribute.attr`, nên phải dò `getattr` chứ không
        # dò attribute node (dò attribute sẽ luôn ra 0 và gate im lặng xanh).
        import re as _re

        rule_tenant_re = _re.compile(
            r'getattr\(\s*\w*rule\w*\s*,\s*[\'"]tenant[\'"]', _re.IGNORECASE)
        request_tenant_re = _re.compile(
            r'getattr\(\s*request\s*,\s*[\'"]tenant[\'"]', _re.IGNORECASE)

        for name, src, scan_marker in (
            ('view', views_src, 'scan_cache_key = _scan_cache_key('),
            ('task', tasks_src, 'scan_key = _scan_cache_key('),
        ):
            with self.subTest(side=name):
                # Chỉ xét VÙNG quanh lời GỌI `_scan_cache_key` (không phải
                # định nghĩa hàm) — file khác có thể đọc `request.tenant` chỗ
                # khác, và với `sched_alerts` đó là hành vi ĐÚNG.
                self.assertIn(
                    scan_marker, src,
                    f'{name}: khong tim thay loi goi _scan_cache_key de kiem tra')
                idx = src.index(scan_marker)
                window = src[max(0, idx - 500): idx + 300]
                self.assertRegex(
                    window, rule_tenant_re,
                    f'{name}: scan cache key phai lay tenant tu bien ...rule...')
                self.assertNotRegex(
                    window, request_tenant_re,
                    f'{name}: scan cache key KHONG duoc lay tenant tu request.tenant — '
                    f'task chi co rule_id nen hai ben se lech key')


class LedgerCacheFailsClosedTests(TestCase):
    """TEN-06: `get_cached_ledger` fail-closed khi thieu tenant."""

    def test_missing_tenant_raises_instead_of_sharing_namespace(self):
        with self.assertRaises(ValueError) as ctx:
            ledger_services.get_cached_ledger(portfolio_id=1, tenant=None, use_cache=True)
        self.assertIn('tenant', str(ctx.exception).lower())
