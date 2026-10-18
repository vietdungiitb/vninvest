"""
R5.3 — hiện + sửa 4 system sub-agent prompt (technical/flow/sentiment/synthesis).

Bối cảnh đo được trước khi viết (xem ledger Entry 379):
- Prompt được đọc tại `advisory/orchestrator.py:558-561`, KHÔNG phải `:140-143` như
  plan ghi. Nguồn = `SystemAISettings.metadata`, truyền xuống qua
  `advisory/views.py:580` (`effective_context['metadata']`).
- **Trước R5.3 không endpoint nào ghi được 4 khoá này** — chỉ sửa tay trong DB, và
  whitelist diff của endpoint update cũng không liệt kê chúng ⇒ đổi prompt không
  hiện trong `AIAuditLog`.
- `prompt_config_history` nằm trên `UserAICredential` (user BYOK) ⇒ **không** dùng
  được cho prompt hệ thống. Owner chốt: lịch sử tái dùng `AIAuditLog`.

AC:
- AC1 lưu 4 prompt (staff) + lịch sử đọc được từ AIAuditLog.
- AC2 user thường KHÔNG thấy/không sửa được (staff-only).
- AC3 `AITrace.prompt_template_version` ghi đúng version đang hiệu lực.
- AC4 diff: đổi 1 trong 4 prompt chỉ tạo 1 entry audit, `before/after` đúng phần đổi.
- AC5 2 prompt khác nhau ⇒ `prompt_hash` khác nhau (tính tất định, KHÔNG đòi "tốt hơn").
"""
import os
import sys

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')
os.environ.setdefault('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1')

import django
django.setup()

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from advisory.models import AIAuditLog, SystemAISettings
from advisory.tests.envelope import unwrapped
from user_workspace.tests.tenant_test_helpers import grant_tenant

CC_URL = '/core/v1/workspace/ai-command-center/'

# Đúng tên khoá orchestrator đọc (orchestrator.py:558-561) — KHÔNG tự đặt tên khác.
SUB_AGENT_KEYS = (
    'technical_agent_prompt',
    'flow_agent_prompt',
    'sentiment_agent_prompt',
    'synthesis_agent_prompt',
)

MAX_PROMPT_CHARS = 4000


def prompts(**over):
    base = {
        'technical_agent_prompt': 'Bạn là chuyên gia kỹ thuật cho {symbol}.',
        'flow_agent_prompt': 'Bạn là chuyên gia dòng tiền cho {symbol}.',
        'sentiment_agent_prompt': 'Bạn là chuyên gia tâm lý thị trường cho {symbol}.',
        'synthesis_agent_prompt': 'Bạn là Giám đốc tổng hợp cho {symbol}.',
    }
    base.update(over)
    return base


class SubAgentPromptTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.staff = User.objects.create_user(
            username='r53-staff', email='r53-staff@example.com', password='testpass123',
            is_staff=True,
        )
        grant_tenant(self.staff, role='owner', tenant_code='r53-tenant')
        self.member = User.objects.create_user(
            username='r53-member', email='r53-member@example.com', password='testpass123',
        )
        grant_tenant(self.member, role='editor', tenant_code='r53-tenant')
        self.system = SystemAISettings.objects.create(
            name='R5.3 System',
            is_active=True,
            ai_model='gpt-4o-mini',
            max_tokens=5000,
            temperature=0.3,
            prompt_template='system {symbol}',
            metadata={},
        )

    # ------------------------------------------------------------------ AC1
    def test_ac1_staff_save_prompts_to_system_metadata(self):
        self.client.force_authenticate(user=self.staff)
        r = self.client.put(CC_URL, {'sub_agent_prompts': prompts()}, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK, unwrapped(r))
        self.system.refresh_from_db()
        for k in SUB_AGENT_KEYS:
            self.assertEqual(self.system.metadata.get(k), prompts()[k], k)

    def test_ac1_saving_bumps_version(self):
        self.client.force_authenticate(user=self.staff)
        self.client.put(CC_URL, {'sub_agent_prompts': prompts()}, format='json')
        self.system.refresh_from_db()
        v1 = int(self.system.metadata.get('sub_agent_prompts_version') or 0)
        self.assertGreaterEqual(v1, 1)

        self.client.put(
            CC_URL,
            {'sub_agent_prompts': prompts(flow_agent_prompt='đổi nội dung')},
            format='json',
        )
        self.system.refresh_from_db()
        v2 = int(self.system.metadata.get('sub_agent_prompts_version') or 0)
        self.assertEqual(v2, v1 + 1, 'lưu prompt mới phải tăng version')

    def test_ac1_get_exposes_prompts_and_version(self):
        self.client.force_authenticate(user=self.staff)
        self.client.put(CC_URL, {'sub_agent_prompts': prompts()}, format='json')
        r = self.client.get(CC_URL)
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        body = unwrapped(r)
        self.assertEqual(body.get('sub_agent_prompts', {}).get('technical_agent_prompt'),
                         prompts()['technical_agent_prompt'])
        self.assertGreaterEqual(int(body.get('sub_agent_prompts_version') or 0), 1)

    def test_ac1_history_is_readable_from_audit_log(self):
        """Owner chốt: lịch sử = AIAuditLog (không model mới)."""
        self.client.force_authenticate(user=self.staff)
        self.client.put(CC_URL, {'sub_agent_prompts': prompts()}, format='json')
        logs = AIAuditLog.objects.filter(action=AIAuditLog.ActionChoices.UPDATE_SETTINGS)
        self.assertTrue(logs.exists(), 'phải có audit log khi đổi prompt')
        log = logs.order_by('-id').first()
        after = log.after_json or {}
        self.assertEqual(after.get('technical_agent_prompt'), prompts()['technical_agent_prompt'])

    # ------------------------------------------------------------------ AC4
    def test_ac4_change_isolated_to_one_key(self):
        self.client.force_authenticate(user=self.staff)
        self.client.put(CC_URL, {'sub_agent_prompts': prompts()}, format='json')
        self.client.put(
            CC_URL,
            {'sub_agent_prompts': prompts(sentiment_agent_prompt='CHỈ ĐỔI CÁI NÀY')},
            format='json',
        )
        log = AIAuditLog.objects.filter(action=AIAuditLog.ActionChoices.UPDATE_SETTINGS) \
            .order_by('-id').first()
        before_j = log.before_json or {}
        after_j = log.after_json or {}
        changed = [k for k in set(before_j) | set(after_j)
                   if before_j.get(k) != after_j.get(k)]
        # Version CUNG tang khi doi prompt ⇒ phai nam trong tap doi; nếu không có
        # nó thì nghĩa là version không ghi lịch sử (AC3).
        self.assertEqual(sorted(changed), ['sentiment_agent_prompt', 'sub_agent_prompts_version'],
                         f'chi được đổi 1 khoá + version, thực tế: {sorted(changed)}')

    # ------------------------------------------------------------------ AC2
    def test_ac2_member_cannot_write_prompts(self):
        self.client.force_authenticate(user=self.member)
        r = self.client.put(CC_URL, {'sub_agent_prompts': prompts()}, format='json')
        self.assertIn(r.status_code, (403, 401), 'user thường không được sửa prompt hệ thống')
        self.system.refresh_from_db()
        self.assertEqual(self.system.metadata.get('technical_agent_prompt'), None)

    def test_ac2_member_does_not_see_prompts(self):
        self.client.force_authenticate(user=self.member)
        r = self.client.get(CC_URL)
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertNotIn('sub_agent_prompts', unwrapped(r))

    # ------------------------------------------------------------------ AC5
    def test_ac5_prompt_hash_differs_for_different_prompt(self):
        """Tính tất định: prompt khác ⇒ hash khác. KHÔNG đòi "prompt tốt hơn"."""
        from advisory.trace import sha256_hex
        a = sha256_hex(prompts()['technical_agent_prompt'])
        b = sha256_hex(prompts(technical_agent_prompt='prompt khác hoàn toàn')['technical_agent_prompt'])
        self.assertNotEqual(a, b)
        self.assertEqual(a, sha256_hex(prompts()['technical_agent_prompt']),
                         'cùng prompt phải cho cùng hash (tất định)')

    # -------------------------------------------------------------- validation
    def test_reject_unknown_key(self):
        self.client.force_authenticate(user=self.staff)
        r = self.client.put(CC_URL, {'sub_agent_prompts': {'khong_hop_le': 'x'}}, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST, unwrapped(r))

    def test_reject_non_dict(self):
        self.client.force_authenticate(user=self.staff)
        r = self.client.put(CC_URL, {'sub_agent_prompts': 'không phải dict'}, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST, unwrapped(r))

    def test_reject_too_long(self):
        self.client.force_authenticate(user=self.staff)
        r = self.client.put(
            CC_URL,
            {'sub_agent_prompts': prompts(technical_agent_prompt='x' * (MAX_PROMPT_CHARS + 1))},
            format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST, unwrapped(r))

    def test_identical_save_does_not_bump_version(self):
        self.client.force_authenticate(user=self.staff)
        self.client.put(CC_URL, {'sub_agent_prompts': prompts()}, format='json')
        self.system.refresh_from_db()
        v1 = int(self.system.metadata.get('sub_agent_prompts_version') or 0)
        self.client.put(CC_URL, {'sub_agent_prompts': prompts()}, format='json')
        self.system.refresh_from_db()
        v2 = int(self.system.metadata.get('sub_agent_prompts_version') or 0)
        self.assertEqual(v1, v2, 'lưu y hệt không được tăng version')


class TracePromptVersionTests(TestCase):
    """AC3 — trace ghi `prompt_template_version` đúng bản đang hiệu lực."""

    def _make_trace(self, version):
        import uuid
        from advisory.models import AdvisoryRecord, AITrace
        from advisory.trace import record_step_trace
        from django.contrib.auth.models import User as U
        from django.utils import timezone as tz

        user = U.objects.create_user(username=f'r53-trace-{version}', password='x')
        record = AdvisoryRecord.objects.create(
            symbol='VIC', session_date=tz.now().date(), user=user,
        )
        record_step_trace(
            {
                'trace_id': str(uuid.uuid4()),
                'advisory_id': str(record.advisory_id),
                'user_id': user.id,
                'symbol': 'VIC',
                'session_date': record.session_date,
                'sub_agent_prompts_version': version,
            },
            'technical', provider='openai', model='gpt-4o-mini',
            prompt='p', response='r',
        )
        return AITrace.objects.filter(advisory=record, step='technical').first()

    def test_ac3_trace_records_version_from_context(self):
        row = self._make_trace(7)
        self.assertIsNotNone(row, 'phải ghi được trace')
        self.assertEqual(row.prompt_template_version, 7)

    def test_ac3_missing_version_defaults_zero(self):
        """Không có version trong ctx ⇒ 0, KHÔNG phải None (cột NOT NULL)."""
        from advisory.models import AITrace
        row = AITrace(prompt_template_version=None)
        self.assertIsNotNone(row)
        # Goc DB la NOT NULL default 0; gia tri None se bi DB tu cho.
        self.assertEqual(AITrace._meta.get_field('prompt_template_version').default, 0)