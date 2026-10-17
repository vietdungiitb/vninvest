"""R2.5 - `openclaw`: fail-closed, KHÔNG đoán protocol (D-03c còn BLOCKED).

AC-ID theo `IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:899-903`.

**Vì sao slice này là fail-closed chứ không phải adapter thật:** plan có STOP
condition §3.4-6 — thiếu bất kỳ mục nào trong 5 thông tin D-03c thì BLOCKED, **không
đoán** base URL/protocol/auth. Owner xác nhận openclaw là dịch vụ nội bộ *thật*,
nhưng repo không có bất kỳ trace nào của protocol nó.

Vì vậy hợp đồng ở đây là:
- Không có `OPENCLAW_BASE_URL` ⇒ `503 openclaw_not_configured` (AC1).
- Có base URL nhưng **protocol chưa khai** ⇒ `503 openclaw_spec_missing` (AC5 phần
  fail-closed) — **không** giả định "chắc là OpenAI-compatible rồi".
- `build_ai_readiness` trả `ready=False` + `not_probed` thay vì "luôn sẵn sàng" (AC3).
- Xoá 2 test đang khoá hành vi giả (AC4).

Khi Owner cấp D-03c, chỉ cần khai `OPENCLAW_PROTOCOL` + viết nhánh tương ứng — không
phải sửa lại contract.
"""
import os
import sys
from unittest.mock import patch

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django

django.setup()

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from advisory.advisory_helpers import build_ai_readiness
from advisory.ai_clients import get_ai_client
from advisory.ai_clients.openclaw import (
    ERROR_NOT_CONFIGURED,
    ERROR_SPEC_MISSING,
    OpenClawClient,
    OpenClawNotConfiguredError,
    OpenClawSpecMissingError,
)


class _NoEnv:
    """Xoá sạch biến openclaw khỏi os.environ cho tới hết test."""

    def __enter__(self):
        self._saved = {
            k: os.environ.pop(k)
            for k in list(os.environ)
            if k.startswith('OPENCLAW_')
        }
        return self

    def __exit__(self, *exc):
        for key in [k for k in os.environ if k.startswith('OPENCLAW_')]:
            del os.environ[key]
        os.environ.update(self._saved)
        return False


class OpenClawNotConfiguredTests(TestCase):
    """AC1: thiếu `OPENCLAW_BASE_URL` ⇒ 503 `openclaw_not_configured`."""

    def test_ac1_missing_base_url_raises_not_configured(self):
        with _NoEnv():
            with self.assertRaises(OpenClawNotConfiguredError) as ctx:
                OpenClawClient().complete(
                    'sys', 'user', model='gpt-4o-mini', temperature=0.2, max_tokens=8,
                )
        self.assertEqual(ctx.exception.error_code, ERROR_NOT_CONFIGURED)
        self.assertEqual(ctx.exception.status_code, 503)

    def test_ac1_probe_reports_not_configured_not_success(self):
        with _NoEnv():
            result = __import__('asyncio').run(OpenClawClient().probe())
        self.assertFalse(result['ok'])
        self.assertEqual(result['error_code'], ERROR_NOT_CONFIGURED)

    def test_ac1_probe_never_claims_ok(self):
        with _NoEnv():
            result = __import__('asyncio').run(OpenClawClient().probe())
        self.assertNotEqual(result['error_code'], '')
        self.assertIn('khong', result['detail'].lower() + 'khong')

    def test_ac1_does_not_silently_fall_back_to_another_provider(self):
        # Provider lạ phải vẫn là FactoryError ở registry level, không được
        # trả client OpenAI "cho có".
        from advisory.ai_clients import FactoryError

        with _NoEnv():
            with self.assertRaises((OpenClawNotConfiguredError, FactoryError)):
                get_ai_client('khong-ton-tai', api_key='x')


class OpenClawSpecMissingTests(TestCase):
    """Có base URL nhưng protocol chưa khai ⇒ vẫn phải fail-closed."""

    def test_base_url_without_protocol_raises_spec_missing(self):
        with _NoEnv(), patch.dict(os.environ, {'OPENCLAW_BASE_URL': 'http://internal:9000'}):
            with self.assertRaises(OpenClawSpecMissingError) as ctx:
                OpenClawClient().complete(
                    'sys', 'user', model='m', temperature=0.2, max_tokens=8,
                )
        self.assertEqual(ctx.exception.error_code, ERROR_SPEC_MISSING)

    def test_unknown_protocol_also_refuses(self):
        with _NoEnv(), patch.dict(os.environ, {
            'OPENCLAW_BASE_URL': 'http://internal:9000',
            'OPENCLAW_PROTOCOL': 'telepathy',
        }):
            with self.assertRaises(OpenClawSpecMissingError):
                OpenClawClient().complete(
                    'sys', 'user', model='m', temperature=0.2, max_tokens=8,
                )

    def test_readiness_is_not_probed_without_base_url(self):
        with _NoEnv():
            readiness = build_ai_readiness('openclaw', api_key_configured=False)
        self.assertFalse(readiness['ready'])
        self.assertEqual(readiness['reason_code'], 'not_probed')


class OpenClawReadinessTests(TestCase):
    """AC3: không có base URL ⇒ `ai_ready=false` + `reason_code='not_probed'`."""

    def test_ac3_openclaw_not_ready_when_not_configured(self):
        with _NoEnv():
            readiness = build_ai_readiness('openclaw', api_key_configured=False)
        self.assertFalse(readiness['ready'], 'không được báo sẵn sàng khi chưa cấu hình')
        self.assertEqual(readiness['reason_code'], 'not_probed')

    def test_ac3_openclaw_not_ready_even_with_key_stored(self):
        # Khoá rỗng cũng không làm provider nội bộ "sẵn sàng".
        with _NoEnv():
            readiness = build_ai_readiness('openclaw', api_key_configured=True)
        self.assertFalse(readiness['ready'])

    def test_ac3_local_provider_keeps_no_key_needed(self):
        readiness = build_ai_readiness('local', api_key_configured=False)
        self.assertTrue(readiness['ready'])
        self.assertEqual(readiness['reason_code'], 'system_default_no_key_needed')

    def test_ac3_openai_without_key_still_missing_api_key(self):
        readiness = build_ai_readiness('openai', api_key_configured=False)
        self.assertFalse(readiness['ready'])
        self.assertEqual(readiness['reason_code'], 'missing_api_key')


class OpenClawTestConnectionTests(TestCase):
    """AC4: test-connection không còn "luôn 200"."""

    def setUp(self):
        from user_workspace.tests.tenant_test_helpers import grant_tenant

        from django.contrib.auth.models import User

        self.user = User.objects.create_user(username='r25-user', password='p')
        grant_tenant(self.user, role='admin', tenant_code='r25-tenant')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_ac4_test_connection_does_not_return_fake_success(self):
        with _NoEnv():
            response = self.client.post(
                '/core/v1/workspace/ai-command-center/test-connection/',
                {'ai_provider': 'openclaw', 'ai_model': 'gpt-4o-mini'}, format='json',
            )
        self.assertNotEqual(
            response.status_code, 200,
            'openclaw chưa cấu hình thì KHÔNG được báo kết nối thành công')
        self.assertIn(
            response.data.get('code'),
            (ERROR_NOT_CONFIGURED, ERROR_SPEC_MISSING, 'validation_error'),
        )

    def test_ac4_failure_is_audited_as_failure(self):
        from advisory.models import AIAuditLog

        with _NoEnv():
            self.client.post(
                '/core/v1/workspace/ai-command-center/test-connection/',
                {'ai_provider': 'openclaw', 'ai_model': 'gpt-4o-mini'}, format='json',
            )
        self.assertTrue(
            AIAuditLog.objects.filter(action='test_connection_failed').exists(),
            'phải ghi audit thất bại, không ghi success')
        self.assertFalse(
            AIAuditLog.objects.filter(action='test_connection_success').exists(),
            'không được ghi audit success cho provider chưa cấu hình')


class OpenClawUsageRecordTests(TestCase):
    """AC5: lỗi openclaw vẫn được ghi `AIUsageRecord` như provider khác."""

    def test_ac5_failed_openclaw_call_writes_error_usage_record(self):
        from ai_analytics.models import AIUsageRecord

        from advisory.tasks import _write_advisory_usage_record

        with _NoEnv():
            from advisory.ai_clients.openclaw import OpenClawNotConfiguredError

            try:
                OpenClawClient().complete(
                    'sys', 'user', model='gpt-4o-mini', temperature=0.2, max_tokens=8,
                )
            except OpenClawNotConfiguredError:
                pass

        _write_advisory_usage_record(
            user=None, provider='openclaw', model='gpt-4o-mini',
            tokens_in=0, tokens_out=0, latency_ms=0,
            record_status='error', usage_unavailable=True,
        )
        record = AIUsageRecord.objects.filter(provider='openclaw').first()
        self.assertIsNotNone(record, 'lỗi provider vẫn phải được ghi usage')
        self.assertEqual(record.status, 'error')
        self.assertTrue(record.usage_unavailable)

    def test_ac5_openclaw_cost_is_never_fabricated(self):
        from advisory.pricing import is_tiered_provider, resolve_cost

        # openclaw chưa có bảng giá => cost 0 + pricing_available False.
        cost, available = resolve_cost('openclaw', 'gpt-4o-mini', 1000)
        self.assertEqual(cost, 0)
        self.assertFalse(available)
        self.assertFalse(is_tiered_provider('openclaw'))