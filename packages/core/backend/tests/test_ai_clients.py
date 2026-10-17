"""R2.2 (plan Rev.2): factory + interface client chuan.

AC1: 3 adapter openai/gemini/local x fixture => text + usage parse dung.
AC2: usage tu prompt/completion_tokens; thieu => usage=None (khong bia 0).
AC3: orchestrator.py khong con `if provider ==`.
AC4: provider chua cau hinh => FactoryError, khong roi OpenAI im lang.
AC5: timeout rieng tung adapter.
AC6: them provider moi = them 1 file + 1 dong registry, khong sua orchestrator.

TDD fail-before: package ai_clients chua ton tai (ImportError) tren code cu.
"""
import asyncio
import os
import sys

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')
os.environ.setdefault('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1')

import django  # noqa: E402

django.setup()

from django.test import SimpleTestCase  # noqa: E402

import httpx  # noqa: E402

from advisory.ai_clients import (  # noqa: E402
    FactoryError,
    get_ai_client,
)


def _fixture(text='Hello', prompt=100, completion=50, finish='stop'):
    body = {
        'choices': [{'message': {'content': text}, 'finish_reason': finish}],
    }
    if prompt is not None:
        body['usage'] = {'prompt_tokens': prompt, 'completion_tokens': completion}
    return body


def _client_for(provider, body, status=200):
    def handler(request):
        return httpx.Response(status, json=body)

    transport = httpx.MockTransport(handler)
    client = get_ai_client(provider, api_key='k', timeout=5.0)
    client._transport = transport
    return client, handler


class FactoryTests(SimpleTestCase):
    def test_ac1_3_adapters_parse_text_and_usage(self):
        for provider in ('openai', 'gemini', 'local'):
            client, _ = _client_for(provider, _fixture(text=f'hi-{provider}'))
            out = asyncio.run(client.complete(
                'sys', 'user', model='m', temperature=0.3, max_tokens=64,
            ))
            self.assertEqual(out['text'], f'hi-{provider}')
            self.assertEqual(out['usage'], {'input': 100, 'output': 50})
            self.assertEqual(out['finish_reason'], 'stop')

    def test_ac2_missing_usage_is_none_not_zero(self):
        client, _ = _client_for('openai', _fixture(prompt=None))
        out = asyncio.run(client.complete(
            'sys', 'user', model='m', temperature=0.3, max_tokens=64,
        ))
        self.assertEqual(out['text'], 'Hello')
        self.assertIsNone(out['usage'])

    def test_ac3_no_provider_branch_in_orchestrator(self):
        import pathlib

        src = pathlib.Path(__file__).resolve().parent.parent.joinpath(
            'src', 'advisory', 'orchestrator.py',
        ).read_text(encoding='utf-8')
        hits = [
            ln for ln in src.splitlines()
            if 'if provider ==' in ln and not ln.strip().startswith('#')
        ]
        self.assertEqual(hits, [])

    def test_ac4_unknown_provider_raises_factory_error(self):
        with self.assertRaises(FactoryError):
            get_ai_client('copilot', api_key='x')
        with self.assertRaises(FactoryError):
            get_ai_client('claude', api_key='x')
        with self.assertRaises(FactoryError):
            get_ai_client('openclaw', api_key='x')

    def test_ac5_per_adapter_timeout(self):
        seen = {}

        def handler(request):
            seen['timeout'] = request.extensions.get('timeout', None)
            return httpx.Response(200, json=_fixture())

        transport = httpx.MockTransport(handler)
        client = get_ai_client('gemini', api_key='k', timeout=7.5)
        client._transport = transport
        asyncio.run(client.complete(
            'sys', 'user', model='m', temperature=0.3, max_tokens=64, timeout=9.5,
        ))
        timeout = seen['timeout']
        self.assertIsNotNone(timeout)
        self.assertAlmostEqual(timeout.get('connect', timeout.get('read', 0)) if isinstance(timeout, dict) else float(timeout), 9.5, places=1)

    def test_ac6_new_provider_without_touching_orchestrator(self):
        import sys as _sys
        import types as _types

        from advisory.ai_clients import _PROVIDERS

        mod = _types.ModuleType('advisory.ai_clients.fake_r22')

        class FakeClient:
            def __init__(self, **kwargs):
                self.kwargs = kwargs

        mod.FakeClient = FakeClient
        _sys.modules['advisory.ai_clients.fake_r22'] = mod
        _PROVIDERS['fake_r22'] = ('advisory.ai_clients.fake_r22', 'FakeClient', {})
        try:
            import pathlib

            client = get_ai_client('fake_r22')
            self.assertIsInstance(client, FakeClient)
            # Orchestrator khong he biet provider nay (0 coupling).
            orch_src = pathlib.Path(__file__).resolve().parent.parent.joinpath(
                'src', 'advisory', 'orchestrator.py',
            ).read_text(encoding='utf-8')
            self.assertNotIn('fake_r22', orch_src)
        finally:
            _PROVIDERS.pop('fake_r22', None)
            _sys.modules.pop('advisory.ai_clients.fake_r22', None)
