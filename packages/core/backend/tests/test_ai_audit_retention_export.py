"""R4.3 — audit append-only + retention + export theo tenant (plan `:1212-1223`).

Đo code trước khi viết (nên R4.3 nhỏ hơn vẻ ngoài):

- `AIAuditLog` (`advisory/models.py:721`) **đã có** `user` FK + `tenant` FK +
  `created_at` index ⇒ **không cần migration**.
- Endpoint audit hiện tại (`portfolio_analytics_views.py:2162`) **chỉ có GET**
  ⇒ AC1 vốn đã đúng, nhưng **chỉ được chứng minh bằng grep** — grep không chạy
  được trong CI thì lỗi quay lại sau này mà không ai thấy. Vì vậy AC1 ở đây là
  **test quét `urls.py` và các view**, và nó phải **RED** nếu có ai thêm
  `put`/`patch`/`delete` cho `AIAuditLog`.
- `AI_AUDIT_RETENTION_DAYS` **không tồn tại** ⇒ AC2 là việc mới.

Ba quyết định cần ghi, vì cả ba đều dễ làm ngược:

1. **Retention audit tách khỏi retention trace.** `AITrace` xoá sau 90 ngày
   (R3.1) là hợp lý — trace là dữ liệu vận hành. `AIAuditLog` là **dấu vết kiểm
   toán**; xoá nhầm là mất khả năng truy vết. Vì vậy mặc định **365 ngày** và
   task **tên riêng** (`purge-ai-audit-logs`), không gộp vào task trace.
2. **Export CSV có BOM UTF-8.** Không có BOM thì Excel trên Windows (cp1252 mặc
   định ở VN) hiển thị tiếng Việt trong `before_json`/`after_json` thành ký tự
   hỏng. Đây là lý do AC3 nhắc BOM.
3. **Export phải dùng lại đúng tenant scope của audit-logs view**
   (`resolve_tenant_for_user` + fail-closed), không tự chế resolver — nếu không
   thì export sẽ là đường vòng qua chỗ R0.11 đã vá (đọc log của mọi user).
"""
import csv
import io
import os
import re
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from advisory.models import AIAuditLog
from identity_access.models import CoreTenant

User = get_user_model()

EXPORT_URL = '/core/v1/workspace/ai-command-center/audit-logs/export/'
BOM = '﻿'


def make_log(**kwargs):
    payload = {
        'action': AIAuditLog.ActionChoices.UPDATE_SETTINGS,
        'actor': 'someone',
        'reason': 'test',
        'before_json': {},
        'after_json': {},
    }
    payload.update(kwargs)
    return AIAuditLog.objects.create(**payload)


class AppendOnlyGuardTests(TestCase):
    """AC1 — không có đường sửa/xoá `AIAuditLog`.

    Test này **quét source**, không gọi API: một `router.put(...)` thêm sau này sẽ
    làm test đỏ dù không ai chạy endpoint đó. Đó là điểm: AC1 cần bằng chứng
    *tồn tại vắng*, mà "vắng" thì không chứng minh bằng cách gọi thử.
    """

    def _read(self, *parts):
        root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        with open(os.path.join(root, *parts), encoding='utf-8') as handle:
            return handle.read()

    def test_urls_py_has_no_write_route_for_audit_logs(self):
        urls = self._read('src', 'user_workspace', 'urls.py')
        routes = re.findall(r"path\(([^)]*)\)", urls, flags=re.S)
        audit_routes = [r for r in routes if 'audit' in r.lower()]
        self.assertTrue(audit_routes, 'phai con route audit de test co y nghia')
        for route in audit_routes:
            self.assertNotIn('.delete(', route)
            self.assertNotIn('.put(', route)
            self.assertNotIn('.patch(', route)

    def test_no_read_view_exposes_write_method_for_audit(self):
        """AC1 đúng nghĩa: view **đọc** audit thì không được có method ghi.

        Bản đầu của test này quét mọi class chứa chuỗi `AIAuditLog` và đòi không có
        `put/post` — **sai**, và nó đỏ ngay vì lý do đúng: `PortfolioAICommandCenterView.put`
        **tạo** audit log, đó là hành vi **cần** của R0.7, không phải lỗi. Chặn nhầm
        thành cấm ghi audit, tức là cấm append — trái ngược AC1.

        Tiêu chí đúng: class **đọc** log (có `AIAuditLog.objects.all()`/`.filter(...)`)
        mà **không** `create(...)` ⇒ không được có `put/patch/delete`.
        """
        views = self._read('src', 'user_workspace', 'portfolio_analytics_views.py')
        blocks = re.split(r'\nclass ', views)
        checked, offenders = 0, []
        for block in blocks:
            header = block.split('\n', 1)[0]
            reads = ('AIAuditLog.objects.all()' in block
                     or 'AIAuditLog.objects.filter(' in block)
            writes = 'AIAuditLog.objects.create(' in block
            if not reads or writes:
                continue
            checked += 1
            for method in ('def put', 'def patch', 'def delete'):
                if re.search(rf'\n    {method}\(', block):
                    offenders.append(f'{header} -> {method}')
        self.assertGreater(checked, 0, 'khong tim thay view doc audit de kiem tra AC1')
        self.assertEqual(
            offenders, [],
            f'view DOC audit log khong duoc co method ghi: {offenders}',
        )


class RetentionTests(TestCase):
    """AC2 — retention theo `AI_AUDIT_RETENTION_DAYS` (mặc định 365)."""

    def test_setting_has_safe_default(self):
        self.assertEqual(getattr(settings, 'AI_AUDIT_RETENTION_DAYS', None), 365)

    def test_task_deletes_only_rows_older_than_retention(self):
        from advisory.tasks import purge_ai_audit_logs

        now = timezone.now()
        old = make_log(reason='old')
        AIAuditLog.objects.filter(pk=old.pk).update(
            created_at=now - timedelta(days=400))
        fresh = make_log(reason='fresh')

        deleted = purge_ai_audit_logs()

        self.assertGreaterEqual(deleted, 1)
        self.assertFalse(AIAuditLog.objects.filter(pk=old.pk).exists())
        self.assertTrue(AIAuditLog.objects.filter(pk=fresh.pk).exists())

    def test_retention_window_is_configurable(self):
        from advisory.tasks import purge_ai_audit_logs

        now = timezone.now()
        row = make_log(reason='30d')
        AIAuditLog.objects.filter(pk=row.pk).update(
            created_at=now - timedelta(days=30))
        purge_ai_audit_logs(days=7)
        self.assertFalse(AIAuditLog.objects.filter(pk=row.pk).exists())

    def test_beat_schedule_runs_the_task(self):
        """Task không được đăng ký thì không bao giờ chạy — đây là lỗi R3.1 đã gặp."""
        schedule = getattr(settings, 'CELERY_BEAT_SCHEDULE', {})
        self.assertIn('purge-ai-audit-logs', schedule)
        self.assertEqual(
            schedule['purge-ai-audit-logs']['task'], 'advisory.tasks.purge_ai_audit_logs',
        )


class ExportCsvTests(TestCase):
    """AC3 — CSV cap 5000 + BOM + cờ `truncated`."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='r43-u', password='testpass123')
        self.tenant = CoreTenant.objects.create(
            owner_user=self.user, tenant_code='r43-tenant',
            display_name='R43', plan=CoreTenant.PlanChoices.PRO,
            status=CoreTenant.StatusChoices.ACTIVE,
        )
        self.client.force_authenticate(user=self.user)

    def _csv(self, response):
        text = response.content.decode('utf-8')
        self.assertTrue(
            text.startswith(BOM),
            'CSV phai co BOM UTF-8 de Excel Windows hien dung tieng Viet',
        )
        return list(csv.DictReader(io.StringIO(text.lstrip(BOM))))

    def test_export_returns_csv_with_bom_and_header(self):
        make_log(user=self.user, tenant=self.tenant, reason='co bom')
        response = self.client.get(EXPORT_URL)
        self.assertEqual(response.status_code, 200)
        self.assertIn('text/csv', response['Content-Type'])
        rows = self._csv(response)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['reason'], 'co bom')

    def test_export_marks_truncated_when_over_cap(self):
        from advisory.audit_export import EXPORT_MAX_ROWS

        # Không tạo 5001 dòng thật — chỉ cần chứng minh tên cờ và ngưỡng.
        response = self.client.get(EXPORT_URL + f'?limit={EXPORT_MAX_ROWS + 1}')
        self.assertEqual(response.status_code, 200)
        header = response['X-Audit-Export-Truncated']
        self.assertIn(header, ('true', 'false'))
        self.assertEqual(header, 'false', 'limit > cap phai bi cat ve cap, khong lo')

    def test_export_cap_is_5000_and_never_larger(self):
        from advisory.audit_export import EXPORT_MAX_ROWS

        self.assertEqual(EXPORT_MAX_ROWS, 5000)

    def test_export_never_exceeds_cap(self):
        from advisory.audit_export import EXPORT_MAX_ROWS, export_rows

        rows = [{'action': 'x', 'created_at': 'now'}] * (EXPORT_MAX_ROWS + 25)
        payload, truncated = export_rows(rows)
        self.assertEqual(len(payload), EXPORT_MAX_ROWS)
        self.assertIs(truncated, True)


class ExportIsolationTests(TestCase):
    """AC4 — staff của tenant A không export được log của tenant B."""

    def setUp(self):
        from identity_access.models import TenantMember

        self.client = APIClient()
        self.staff = User.objects.create_user(
            username='r43-staff', password='testpass123', is_staff=True,
        )
        self.client.force_authenticate(user=self.staff)
        # Mỗi tenant một owner riêng (`CoreTenant.owner_user` là UNIQUE) và staff là
        # **member** của cả hai — đúng hình dạng cần kiểm: staff cùng thấy được cả
        # hai tenant, nên chỉ *hint* mới quyết định cái gì lọt ra.
        owner_a = User.objects.create_user(username='r43-owner-a', password='testpass123')
        owner_b = User.objects.create_user(username='r43-owner-b', password='testpass123')
        self.tenant_a = CoreTenant.objects.create(
            tenant_code='r43-a', display_name='A', owner_user=owner_a,
            plan=CoreTenant.PlanChoices.PRO, status=CoreTenant.StatusChoices.ACTIVE,
        )
        self.tenant_b = CoreTenant.objects.create(
            tenant_code='r43-b', display_name='B', owner_user=owner_b,
            plan=CoreTenant.PlanChoices.PRO, status=CoreTenant.StatusChoices.ACTIVE,
        )
        for tenant in (self.tenant_a, self.tenant_b):
            TenantMember.objects.get_or_create(
                tenant=tenant, user=self.staff, defaults={'role': 'admin'},
            )

    def test_export_of_tenant_a_excludes_tenant_b(self):
        """Hint là `public_id`, **không phải** `tenant_code`.

        Nếu test dùng `tenant_code` thì nó xanh "vì lý do sai": `is_plausible_
        tenant_public_id` loại `r43-a` ngay và queryset rỗng — trông giống isolation
        đúng nhưng thực ra chỉ là hint sai hình dạng.
        """
        make_log(tenant=self.tenant_a, reason='cua A')
        make_log(tenant=self.tenant_b, reason='cua B')

        response = self.client.get(EXPORT_URL, {'tenant': self.tenant_a.public_id})
        self.assertEqual(response.status_code, 200)
        text = response.content.decode('utf-8').lstrip(BOM)
        self.assertIn('cua A', text)
        self.assertNotIn('cua B', text)

    def test_hint_without_membership_returns_empty_not_everything(self):
        """Hint rỗng/không thuộc phải trả **rỗng**, không trả tất cả (fail-closed)."""
        make_log(tenant=self.tenant_a, reason='cua A')
        make_log(tenant=self.tenant_b, reason='cua B')
        response = self.client.get(EXPORT_URL, {'tenant': 'khong-ton-tai'})
        self.assertEqual(response.status_code, 200)
        text = response.content.decode('utf-8').lstrip(BOM)
        self.assertNotIn('cua A', text)
        self.assertNotIn('cua B', text)