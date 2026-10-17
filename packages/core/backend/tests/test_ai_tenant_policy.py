"""R4.1 — policy AI cấp **tenant** (plan `:1168-1189`).

Khi viết slice này, M3 đã đo bằng grep rằng `PortfolioAICommandCenterPolicyView`
(`user_workspace/portfolio_analytics_views.py:1522`) **chỉ** phục vụ cấp **hệ
thống**: staff sửa `system_prompt_template`, và `managed_by_platform` bị **hardcode
`True`** ở cả GET (`:1096`) lẫn PUT. Không tồn tại khái niệm policy cấp tenant, nên
đây là endpoint **mới** chứ không phải "mở rộng payload" như plan viết.

Ba điều chỉnh so với plan, ghi lại để agent sau không "sửa về đúng plan":

1. **Không tạo model hạn mức mới.** `AIBudget` (R2.8, `advisory/models.py:628`)
   đã giữ hạn mức **cấp tenant** (`tenant` FK + `dimension` cost/tokens/requests +
   `limit_value`). Thêm `max_tokens_per_day`/`max_cost_per_day` vào một bảng
   policy mới sẽ tạo **hai nguồn sự thật cho một con số**. `AITenantPolicy` chỉ giữ
   **quyền** (`allow_byok` + allowlist provider/model) + `version`; **số** vẫn nằm
   trong `AIBudget`, và `max_tokens_per_day` ở đây là **trần cho cấu hình của
   user** (user không được tự đặt cao hơn trần của tenant).
2. **AC3 là đổi hành vi thật.** `advisory/views.py:442-472` khi vượt hạn mức trả
   **429** `ai_budget_exhausted`, không phải 422 + danh sách field. `422` kèm
   `field_errors` đã có sẵn ở `vninvest_core/exceptions.py:554`
   (`UnprocessableEntityException`, LED-04 R6) — dùng lại, không phát minh.
3. **AC7 không được hiểu là "user vẫn chạy được AI".** Khi `allow_byok=false`, user
   dùng **khoá hệ thống** qua `AI_FALLBACK_DAILY_QUOTA`; điều cần bảo đảm là
   policy **không chặn** những request không đụng BYOK (giữ nhiệt vụ advisory), chứ
   không phải đảm bảo có provider key (việc đó phụ thuộc Owner).

Quyền ghi policy dùng `settings:write` vì đó là permission mà `SYSTEM_ROLE_PERMISSIONS`
(`identity_access/utils/resolve_tenant.py:27-54`) chỉ cấp cho `admin`/`owner` —
`editor` chỉ có `settings:read`, `viewer` không có. Không tự phát minh capability.
"""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from advisory.tests.envelope import unwrapped
from user_workspace.tests.tenant_test_helpers import grant_tenant

User = get_user_model()

POLICY_URL = '/core/v1/workspace/ai-command-center/tenant-policy/'
CC_URL = '/core/v1/workspace/ai-command-center/'


def _client_for(role, tenant_code):
    user = User.objects.create_user(
        username=f'r41-{tenant_code}-{role}', email=f'{role}@{tenant_code}.example.com',
        password='testpass123',
    )
    grant_tenant(user, role=role, tenant_code=tenant_code)
    client = APIClient()
    client.force_authenticate(user=user)
    return user, client


class TenantPolicyContractTests(TestCase):
    def setUp(self):
        self.admin, self.admin_client = _client_for('admin', 'r41-a')
        self.editor, self.editor_client = _client_for('editor', 'r41-a')
        self.other_admin, self.other_client = _client_for('admin', 'r41-b')

    # --- AC1 (phía BE) -------------------------------------------------
    def test_requires_authentication(self):
        anon = APIClient()
        self.assertEqual(
            anon.get(POLICY_URL).status_code, status.HTTP_401_UNAUTHORIZED,
        )

    def test_get_returns_defaults_without_creating_row(self):
        """GET không được ghi DB: policy lấy từ `AIBudget`-less default, `version=0`."""
        response = self.admin_client.get(POLICY_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = unwrapped(response)
        self.assertIs(body['allow_byok'], True)
        self.assertEqual(body['allowed_providers'], [])
        self.assertEqual(body['max_tokens_per_day'], 0)  # 0 = không trần
        self.assertIsNone(body['max_cost_per_day'])
        self.assertEqual(body['version'], 0)
        self.assertIs(body['is_default'], True)

    # --- AC2 (AC quan trọng nhất của R4) --------------------------------
    def test_admin_can_disable_byok(self):
        response = self.admin_client.put(POLICY_URL, {'allow_byok': False}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = unwrapped(response)
        self.assertIs(body['allow_byok'], False)
        self.assertEqual(body['version'], 1)

    def test_user_cannot_save_api_key_when_byok_disabled(self):
        self.admin_client.put(POLICY_URL, {'allow_byok': False}, format='json')
        response = self.editor_client.put(
            CC_URL, {'ai_api_key': 'sk-r41-should-not-be-stored'}, format='json',
        )
        self.assertEqual(
            response.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY,
        )
        self.assertEqual(response.data['code'], 'byok_not_allowed')
        self.assertTrue(response.data['field_errors']['ai_api_key'])
        # AC2 nói rõ: GET phải báo user đang bị nền tảng quản lý.
        #
        # CẢNH BÁO đã mắc: đừng sửa `managed_by_platform` thành
        # `not allow_byok`. R0.9 (F5) dùng cờ đó để nói "system_prompt_template
        # do nền tảng quản lý, user thường không thấy nội dung" — khác hẳn với
        # "user bị cấp BYOK". Đổi nghĩa làm đỏ
        # `test_ai_cc_policy_gating.py:69` + `test_ai_management_center.py:171`,
        # hai test đang ghim hành vi R0.9 có chủ đích. R4.1 vì vậy thêm cờ MỚI
        # `byok_forced` và giữ nguyên cờ cũ.
        body = unwrapped(self.editor_client.get(CC_URL))
        self.assertIs(body['system_policy']['byok_forced'], True)
        self.assertIs(body['system_policy']['allow_byok'], False)
        # Cờ gốc của R0.9 giữ nguyên nghĩa: template do nền tảng quản lý.
        self.assertIs(body['system_policy']['managed_by_platform'], True)

    def test_byok_allowed_by_default_does_not_block_key(self):
        """Tenant mới (chưa có policy) ⇒ `allow_byok=true` ⇒ lưu key phải chạy được.

        Chốt lại hành vi cũ: R4.1 không được âm thầm chặn BYOK cho mọi tenant.
        """
        response = self.editor_client.put(
            CC_URL, {'ai_api_key': 'sk-r41-default-allowed'}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = unwrapped(self.editor_client.get(CC_URL))
        self.assertIs(body['ai_api_key_configured'], True)

    def test_clearing_key_still_allowed_when_byok_disabled(self):
        """`ai_api_key=''` là xoá khoá đã lưu, không phải lưu BYOK ⇒ vẫn phải cho qua."""
        self.editor_client.put(CC_URL, {'ai_api_key': 'sk-r41-first'}, format='json')
        self.admin_client.put(POLICY_URL, {'allow_byok': False}, format='json')
        response = self.editor_client.put(CC_URL, {'ai_api_key': ''}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    # --- AC3: vượt trần ⇒ 422 + liệt kê field --------------------------
    def test_user_setting_above_tenant_ceiling_is_422_with_field(self):
        self.admin_client.put(
            POLICY_URL, {'allow_byok': True, 'max_tokens_per_day': 5000}, format='json',
        )
        response = self.editor_client.put(
            CC_URL, {'advisory_max_tokens_per_day': 9000}, format='json',
        )
        self.assertEqual(
            response.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY,
        )
        self.assertEqual(response.data['code'], 'tenant_policy_exceeded')
        self.assertTrue(response.data['field_errors']['advisory_max_tokens_per_day'])

    def test_user_setting_within_ceiling_is_accepted(self):
        self.admin_client.put(
            POLICY_URL, {'max_tokens_per_day': 5000}, format='json',
        )
        response = self.editor_client.put(
            CC_URL, {'advisory_max_tokens_per_day': 4000}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_no_ceiling_means_no_cap(self):
        """`max_tokens_per_day=0` ⇒ không trần (migration không backfill, AC9 R2.8)."""
        response = self.editor_client.put(
            CC_URL, {'advisory_max_tokens_per_day': 90000}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    # --- AC4: isolation ------------------------------------------------
    def test_other_tenant_admin_cannot_change_this_tenant(self):
        self.admin_client.put(POLICY_URL, {'allow_byok': False}, format='json')
        self.other_client.put(POLICY_URL, {'allow_byok': False}, format='json')
        body = unwrapped(self.admin_client.get(POLICY_URL))
        self.assertEqual(body['tenant_code'], 'r41-a')
        self.assertIs(body['allow_byok'], False)
        from advisory.models import AITenantPolicy
        rows = list(AITenantPolicy.objects.values_list('tenant__tenant_code', flat=True))
        self.assertEqual(sorted(rows), ['r41-a', 'r41-b'])

    def test_non_admin_member_cannot_write_policy(self):
        response = self.editor_client.put(POLICY_URL, {'allow_byok': False}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # --- AC5: staff xem đa tenant, read-only -----------------------------
    def test_staff_can_read_any_tenant_but_not_write(self):
        self.admin_client.put(POLICY_URL, {'allow_byok': False}, format='json')
        staff = User.objects.create_user(
            username='r41-staff', email='r41-staff@example.com', password='testpass123',
            is_staff=True,
        )
        client = APIClient()
        client.force_authenticate(user=staff)
        response = client.get(POLICY_URL, {'tenant': 'r41-a'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIs(unwrapped(response)['allow_byok'], False)
        self.assertEqual(
            client.put(POLICY_URL, {'allow_byok': True}, format='json').status_code,
            status.HTTP_403_FORBIDDEN,
        )

    # --- AC6: version + audit -------------------------------------------
    def test_each_change_bumps_version_and_writes_audit(self):
        from advisory.models import AIAuditLog

        first = unwrapped(self.admin_client.put(POLICY_URL, {'allow_byok': False}, format='json'))
        second = unwrapped(
            self.admin_client.put(POLICY_URL, {'max_tokens_per_day': 1000}, format='json'),
        )
        self.assertEqual((first['version'], second['version']), (1, 2))
        self.assertEqual(
            AIAuditLog.objects.filter(reason__icontains='AI tenant policy').count(), 2,
        )

    def test_no_change_does_not_bump_version(self):
        self.admin_client.put(POLICY_URL, {'allow_byok': False}, format='json')
        again = unwrapped(self.admin_client.put(POLICY_URL, {'allow_byok': False}, format='json'))
        self.assertEqual(again['version'], 1)

    # --- AC7: policy không chặn dịch vụ qua khoá hệ thống ---------------
    def test_byok_disabled_does_not_block_other_settings(self):
        self.admin_client.put(POLICY_URL, {'allow_byok': False}, format='json')
        response = self.editor_client.put(CC_URL, {'temperature': 0.3}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = unwrapped(self.editor_client.get(CC_URL))
        self.assertIn('fallback_quota_max', body)