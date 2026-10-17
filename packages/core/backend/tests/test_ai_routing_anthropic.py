"""R2.3 - Adapter `anthropic` (native `/v1/messages`, KHÔNG phải OpenAI-compatible).

AC-ID theo `IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:839-847`.

Lý do AC1 nói **RED trước fix**: trước R2.3, `claude` rơi vào nhánh `else` của
`_resolve_chat_endpoint` ⇒ gửi tới `api.openai.com` kèm `Authorization: Bearer` ⇒
401, và user thấy thông điệp sai. Đó chính là F-06.

Dùng `httpx` thuần, **không** thêm SDK `anthropic` (đã phản biện trong plan: repo
dùng httpx cho mọi provider, thêm SDK cho 1 provider là nợ phụ thuộc vô ích).
"""
import asyncio
import json
import os
import sys

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django

django.setup()

import httpx
from django.test import TestCase, override_settings

from advisory.ai_clients import FactoryError, get_ai_client
from advisory.ai_clients.anthropic import (
    ANTHROPIC_BASE_URL,
    ANTHROPIC_VERSION,
    AnthropicClient,
    AnthropicDisabledError,
)

KEY = 'sk-ant-test'


def _client(handler, **kwargs):
    return AnthropicClient(api_key=KEY, transport=httpx.MockTransport(handler), **kwargs)


def _ok_handler(calls, *, status=200, usage=None, text='xin chao'):
    def handler(request):
        calls.append(request)
        body = {
            'id': 'msg_1',
            'type': 'message',
            'content': [{'type': 'text', 'text': text}],
            'stop_reason': 'end_turn',
            'usage': usage if usage is not None else {
                'input_tokens': 31, 'output_tokens': 12,
            },
        }
        return httpx.Response(status, json=body)

    return handler


class AnthropicHeaderTests(TestCase):
    """AC1/AC3: header đúng chuẩn Anthropic, URL đúng, KHÔNG Authorization."""

    def setUp(self):
        self.calls = []

    def test_ac1_uses_x_api_key_and_version_no_authorization(self):
        client = _client(_ok_handler(self.calls))
        asyncio.run(client.complete(
            'sys', 'user', model='claude-sonnet-4', temperature=0.2, max_tokens=64,
        ))
        headers = {k.lower(): v for k, v in self.calls[0].headers.items()}
        self.assertEqual(headers['x-api-key'], KEY)
        self.assertEqual(headers['anthropic-version'], ANTHROPIC_VERSION)
        self.assertNotIn('authorization', headers)

    def test_ac3_endpoint_is_v1_messages(self):
        client = _client(_ok_handler(self.calls))
        asyncio.run(client.complete(
            'sys', 'user', model='claude-sonnet-4', temperature=0.2, max_tokens=64,
        ))
        self.assertEqual(str(self.calls[0].url), f'{ANTHROPIC_BASE_URL}/v1/messages')

    def test_payload_shape(self):
        client = _client(_ok_handler(self.calls))
        asyncio.run(client.complete(
            'sys prompt', 'user prompt', model='claude-sonnet-4',
            temperature=0.2, max_tokens=64,
        ))
        payload = json.loads(self.calls[0].content)
        self.assertEqual(payload['model'], 'claude-sonnet-4')
        self.assertEqual(payload['max_tokens'], 64)
        self.assertEqual(payload['system'], 'sys prompt')
        self.assertEqual(payload['messages'], [{'role': 'user', 'content': 'user prompt'}])


class AnthropicUsageTests(TestCase):
    """AC2: usage đọc từ `input_tokens`/`output_tokens` (KHÔNG phải OpenAI shape)."""

    def setUp(self):
        self.calls = []

    def test_ac2_parses_input_output_tokens(self):
        client = _client(_ok_handler(self.calls, usage={
            'input_tokens': 120, 'output_tokens': 45,
        }))
        result = asyncio.run(client.complete(
            'sys', 'user', model='claude-sonnet-4', temperature=0.2, max_tokens=64,
        ))
        self.assertEqual(result['usage'], {'input': 120, 'output': 45})
        self.assertEqual(result['text'], 'xin chao')
        self.assertEqual(result['finish_reason'], 'end_turn')

    def test_ac2_missing_usage_is_none_not_zero(self):
        client = _client(_ok_handler(self.calls, usage={}))
        result = asyncio.run(client.complete(
            'sys', 'user', model='claude-sonnet-4', temperature=0.2, max_tokens=64,
        ))
        self.assertIsNone(result['usage'], 'không có usage thì None, không bịa 0')

    def test_concatenates_multiple_text_blocks(self):
        def handler(request):
            self.calls.append(request)
            return httpx.Response(200, json={
                'content': [
                    {'type': 'text', 'text': 'A'},
                    {'type': 'thinking', 'thinking': 'bo qua'},
                    {'type': 'text', 'text': 'B'},
                ],
                'usage': {'input_tokens': 1, 'output_tokens': 2},
            })

        client = _client(handler)
        result = asyncio.run(client.complete(
            'sys', 'user', model='claude-sonnet-4', temperature=0.2, max_tokens=64,
        ))
        self.assertEqual(result['text'], 'AB')


class AnthropicAuthErrorTests(TestCase):
    """AC4: 401/403 => provider_auth_failed (KHÔNG phải 404 như khi model lỗi)."""

    def setUp(self):
        self.calls = []

    def test_ac4_401_maps_to_provider_auth_failed(self):
        def handler(request):
            self.calls.append(request)
            return httpx.Response(401, json={'error': {'type': 'authentication_error'}})

        client = _client(handler)
        result = asyncio.run(client.probe())
        self.assertFalse(result['ok'])
        self.assertEqual(result['error_code'], 'provider_auth_failed')

    def test_ac4_403_also_auth_failed(self):
        def handler(request):
            return httpx.Response(403, json={'error': {'type': 'permission_error'}})

        result = asyncio.run(_client(handler).probe())
        self.assertEqual(result['error_code'], 'provider_auth_failed')

    def test_ac4_complete_raises_with_auth_code(self):
        from advisory.ai_clients.base import ProviderHTTPError

        def handler(request):
            return httpx.Response(401, text='invalid x-api-key')

        with self.assertRaises(ProviderHTTPError) as ctx:
            asyncio.run(_client(handler).complete(
                'sys', 'user', model='claude-sonnet-4', temperature=0.2, max_tokens=8,
            ))
        self.assertEqual(ctx.exception.status_code, 401)

    def test_model_not_found_keeps_distinct_code(self):
        def handler(request):
            return httpx.Response(404, json={'error': {'type': 'not_found_error'}})

        result = asyncio.run(_client(handler).probe())
        self.assertEqual(result['error_code'], 'provider_model_not_found')


class AnthropicModelChoiceTests(TestCase):
    """AC5: `claude` + model `gpt-*` => 400 `provider_model_mismatch`."""

    def test_ac5_claude_rejects_openai_model(self):
        from advisory.model_choices import validate_model_for_provider

        ok, _ = validate_model_for_provider('claude', 'gpt-4o-mini')
        self.assertFalse(ok)
        ok, _ = validate_model_for_provider('claude', 'claude-sonnet-4')
        self.assertTrue(ok)

    def test_ac5_api_returns_400_provider_model_mismatch(self):
        from django.contrib.auth.models import User
        from rest_framework.test import APIClient

        user = User.objects.create_user(username='r23-user', password='p')
        client = APIClient()
        client.force_authenticate(user=user)
        response = client.put(
            '/core/v1/workspace/ai-command-center/',
            {'ai_provider': 'claude', 'ai_model': 'gpt-4o-mini'}, format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data.get('error_code'), 'provider_model_mismatch')


class AnthropicProbeTests(TestCase):
    """AC6: probe() tối thiểu 1 request, trả latency."""

    def setUp(self):
        self.calls = []

    def test_ac6_probe_hits_endpoint_and_reports_latency(self):
        client = _client(_ok_handler(self.calls))
        result = asyncio.run(client.probe())
        self.assertTrue(result['ok'])
        self.assertGreaterEqual(len(self.calls), 1)
        self.assertIsInstance(result['latency_ms'], int)


class AnthropicDisabledTests(TestCase):
    """AC7: `AI_ENABLE_ANTHROPIC=false` => fail-closed, KHÔNG gọi nhầm chỗ khác."""

    @override_settings(AI_ENABLE_ANTHROPIC=False)
    def test_ac7_disabled_client_raises_loud(self):
        client = _client(_ok_handler([]))
        with self.assertRaises(AnthropicDisabledError):
            asyncio.run(client.complete(
                'sys', 'user', model='claude-sonnet-4', temperature=0.2, max_tokens=8,
            ))

    @override_settings(AI_ENABLE_ANTHROPIC=False)
    def test_ac7_disabled_probe_reports_disabled_not_success(self):
        result = asyncio.run(_client(_ok_handler([])).probe())
        self.assertFalse(result['ok'])
        self.assertEqual(result['error_code'], 'provider_disabled')

    @override_settings(AI_ENABLE_ANTHROPIC=False)
    def test_ac7_disabled_never_calls_network(self):
        calls = []
        client = _client(_ok_handler(calls))
        try:
            asyncio.run(client.complete(
                'sys', 'user', model='claude-sonnet-4', temperature=0.2, max_tokens=8,
            ))
        except AnthropicDisabledError:
            pass
        self.assertEqual(calls, [], 'tắt thì không được gọi mạng')

    @override_settings(AI_ENABLE_ANTHROPIC=True)
    def test_ac7_enabled_works(self):
        calls = []
        client = _client(_ok_handler(calls))
        result = asyncio.run(client.complete(
            'sys', 'user', model='claude-sonnet-4', temperature=0.2, max_tokens=8,
        ))
        self.assertEqual(result['text'], 'xin chao')

    @override_settings()
    def test_default_is_disabled(self):
        # Không khai AI_ENABLE_ANTHROPIC trong settings => fail-closed.
        import inspect

        from vninvest_core import settings as core_settings

        self.assertFalse(
            getattr(core_settings, 'AI_ENABLE_ANTHROPIC', False),
            'mac dinh phai la TAT (fail-closed)')
        del inspect


class AnthropicFactoryTests(TestCase):
    """Registry + factory."""

    def test_factory_builds_anthropic_client(self):
        client = get_ai_client('claude', api_key=KEY, ai_model='claude-sonnet-4')
        self.assertIsInstance(client, AnthropicClient)

    def test_claude_no_longer_routes_to_openai(self):
        # AC1 RED-before-fix: client phải tự trỏ api.anthropic.com, không phải OpenAI.
        client = get_ai_client('claude', api_key=KEY, ai_model='claude-sonnet-4')
        self.assertIn('api.anthropic.com', ANTHROPIC_BASE_URL)
        self.assertNotIn('openai', ANTHROPIC_BASE_URL)

    def test_unknown_provider_still_raises(self):
        with self.assertRaises(FactoryError):
            get_ai_client('khong-ton-tai', api_key='x')