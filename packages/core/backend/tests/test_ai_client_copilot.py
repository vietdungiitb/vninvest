"""R2.4 - Adapter `copilot`: token exchange + catalog sang + enterprise URL.

AC-ID theo `IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:864-877`
(R2.4). **AC13 (nút UI + hướng dẫn lấy `ghu_`) là FE** — không nằm trong file
này; xem `packages/web/.../ai-cc-copilot-*` khi làm.

Không đụng network thật: `httpx.MockTransport` cho mọi HTTP.
"""
import json
import os
import sys
import threading
import time

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django

django.setup()

import httpx
from django.test import TestCase

from advisory.ai_clients import FactoryError, get_ai_client
from advisory.ai_clients.copilot import CopilotClient, CopilotTokenExchangeError
from advisory.copilot_tokens import CopilotTokenManager

RAW = 'ghu_realtoken123'


class _Clock:
    """Fake clock cho AC3 - không cần ngủ thật."""

    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t

    def advance(self, seconds):
        self.t += seconds


def _exchange_handler(calls, *, status=200, payload=None, base_url='https://api.githubcopilot.com'):
    def handler(request):
        calls.append(request)
        if status != 200:
            return httpx.Response(status, json={'message': 'Not Found'})
        return httpx.Response(200, json=payload if payload is not None else {
            'token': 'tid=session;exp=12345',
            'endpoints': {'api': base_url},
            'expires_in': 1500,
        })

    return handler


def _manager(calls, **kwargs):
    return CopilotTokenManager(
        transport=httpx.MockTransport(_exchange_handler(calls, **kwargs)),
        **kwargs.pop('manager_kwargs', {}),
    )


class CopilotTokenManagerTests(TestCase):
    """AC1-AC4: exchange / cache / refresh sớm / lock chống stampede."""

    def setUp(self):
        # Cache token dung chung cap module (dung production) => xoa moi test.
        CopilotTokenManager.clear_cache()
        self.calls = []
        self.clock = _Clock()
        self.manager = CopilotTokenManager(
            transport=httpx.MockTransport(_exchange_handler(self.calls)),
            now_fn=self.clock,
        )

    def test_ac1_exchange_stores_token_endpoint_expires(self):
        session = self.manager.get_session(RAW)
        self.assertEqual(session.token, 'tid=session;exp=12345')
        self.assertEqual(session.base_url, 'https://api.githubcopilot.com')
        self.assertGreater(session.expires_at, self.clock.t)
        self.assertEqual(len(self.calls), 1)
        request = self.calls[0]
        self.assertEqual(request.headers['authorization'], f'token {RAW}')
        self.assertIn('copilot-integration-id', request.headers)

    def test_ac1_raw_token_never_logged(self):
        session = self.manager.get_session(RAW)
        self.assertNotIn(RAW, repr(session))
        self.assertNotIn(RAW, str(session.__dict__.keys()))

    def test_ac2_two_requests_within_expiry_use_one_exchange(self):
        self.manager.get_session(RAW)
        self.manager.get_session(RAW)
        self.assertEqual(len(self.calls), 1)

    def test_ac2_different_raw_tokens_do_not_share_cache(self):
        self.manager.get_session(RAW)
        self.manager.get_session('ghu_khac')
        self.assertEqual(len(self.calls), 2)

    def test_ac3_refresh_60s_before_expiry(self):
        self.manager.get_session(RAW)          # expires_at = 1000 + 1500 = 2500
        self.clock.advance(1500 - 60 - 1)      # còn 61s
        self.manager.get_session(RAW)
        self.assertEqual(len(self.calls), 1, 'chưa tới mốc refresh')
        self.clock.advance(2)                  # còn 59s
        self.manager.get_session(RAW)
        self.assertEqual(len(self.calls), 2, 'phải refresh sớm 60s')

    def test_ac3_custom_margin(self):
        manager = CopilotTokenManager(
            transport=httpx.MockTransport(_exchange_handler(self.calls)),
            now_fn=self.clock, refresh_margin=300,
        )
        manager.get_session(RAW)
        self.clock.advance(1500 - 301)
        manager.get_session(RAW)
        self.assertEqual(len(self.calls), 1)
        self.clock.advance(2)
        manager.get_session(RAW)
        self.assertEqual(len(self.calls), 2)

    def test_ac4_ten_concurrent_threads_single_exchange(self):
        # Exchange chậm 50ms de cac thread that su tranh nhau.
        def slow_handler(request):
            self.calls.append(request)
            time.sleep(0.05)
            return httpx.Response(200, json={
                'token': 'tid=session;exp=12345',
                'endpoints': {'api': 'https://api.githubcopilot.com'},
                'expires_in': 1500,
            })

        manager = CopilotTokenManager(
            transport=httpx.MockTransport(slow_handler), now_fn=self.clock,
        )
        errors = []
        barrier = threading.Barrier(10)

        def worker():
            barrier.wait()
            try:
                manager.get_session(RAW)
            except Exception as exc:  # pragma: no cover
                errors.append(exc)

        threads = [threading.Thread(target=worker) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=10)
        self.assertEqual(errors, [])
        self.assertEqual(len(self.calls), 1, 'lock chống stampede')

    def test_empty_raw_token_rejected_without_http(self):
        with self.assertRaises(ValueError):
            self.manager.get_session('')
        self.assertEqual(len(self.calls), 0)


class CopilotClientHeaderTests(TestCase):
    """AC5-AC7: Bearer session + Integration-Id + endpoint từ token response."""

    def setUp(self):
        # Cache token dung chung cap module (dung production) => xoa moi test.
        CopilotTokenManager.clear_cache()
        self.calls = []

    def _client(self, *, exchange_payload=None, exchange_status=200, api_base_override=''):
        exchange = httpx.MockTransport(_exchange_handler(
            self.calls, status=exchange_status, payload=exchange_payload,
        ))

        def chat_handler(request):
            self.calls.append(request)
            return httpx.Response(200, json={
                'choices': [{'message': {'content': 'xin chao'}, 'finish_reason': 'stop'}],
                'usage': {'prompt_tokens': 11, 'completion_tokens': 7},
            })

        client = CopilotClient(
            api_key=RAW,
            transport=httpx.MockTransport(chat_handler),
            token_exchange_transport=exchange,
            api_base_override=api_base_override,
        )
        return client

    def test_ac5_complete_uses_bearer_session_and_integration_id(self):
        import asyncio

        client = self._client()
        result = asyncio.run(client.complete(
            'sys', 'user', model='gpt-4o-mini', temperature=0.2, max_tokens=100,
        ))
        self.assertEqual(result['text'], 'xin chao')
        self.assertEqual(result['usage'], {'input': 11, 'output': 7})
        chat = [r for r in self.calls if r.url.path.endswith('/chat/completions')][0]
        self.assertEqual(chat.headers['authorization'], 'Bearer tid=session;exp=12345')
        self.assertEqual(chat.headers['copilot-integration-id'], 'vscode-chat')
        self.assertEqual(chat.headers['content-type'], 'application/json')
        # KHONG gui raw token len provider khac
        self.assertNotIn(RAW, json.dumps(chat.headers.__dict__, default=str))

    def test_ac6_endpoint_comes_from_token_response(self):
        import asyncio

        client = self._client(exchange_payload={
            'token': 'tid=enterprise;exp=1',
            'endpoints': {'api': 'https://enterprise.copilot.example.com'},
            'expires_in': 1500,
        })
        asyncio.run(client.complete(
            'sys', 'user', model='gpt-4o-mini', temperature=0.2, max_tokens=100,
        ))
        chat = [r for r in self.calls if r.url.path.endswith('/chat/completions')][0]
        self.assertEqual(str(chat.url), 'https://enterprise.copilot.example.com/chat/completions')

    def test_ac7_api_base_override_wins(self):
        import asyncio

        client = self._client(api_base_override='https://proxy.internal/copilot')
        asyncio.run(client.complete(
            'sys', 'user', model='gpt-4o-mini', temperature=0.2, max_tokens=100,
        ))
        chat = [r for r in self.calls if r.url.path.endswith('/chat/completions')][0]
        self.assertTrue(str(chat.url).startswith('https://proxy.internal/copilot'))

    def test_missing_token_response_is_explicit_error(self):
        import asyncio

        client = self._client(exchange_payload={'expires_in': 1500})
        with self.assertRaises(CopilotTokenExchangeError):
            asyncio.run(client.complete(
                'sys', 'user', model='gpt-4o-mini', temperature=0.2, max_tokens=100,
            ))


class CopilotTrapTests(TestCase):
    """AC8: PAT -> 404 phai ra loi rieng, KHONG bao loi 401 chung."""

    def setUp(self):
        # Cache token dung chung cap module (dung production) => xoa moi test.
        CopilotTokenManager.clear_cache()
        self.calls = []

    def _client(self):
        exchange = httpx.MockTransport(_exchange_handler(self.calls, status=404))

        def chat_handler(request):  # pragma: no cover - khong duoc goi
            self.calls.append(request)
            return httpx.Response(200, json={'choices': []})

        return CopilotClient(
            api_key=RAW,
            transport=httpx.MockTransport(chat_handler),
            token_exchange_transport=exchange,
        )

    def test_ac8_404_maps_to_copilot_token_exchange_failed(self):
        import asyncio

        with self.assertRaises(CopilotTokenExchangeError) as ctx:
            asyncio.run(self._client().complete(
                'sys', 'user', model='gpt-4o-mini', temperature=0.2, max_tokens=100,
            ))
        error = ctx.exception
        self.assertEqual(error.error_code, 'copilot_token_exchange_failed')
        self.assertIn('ghu_', error.user_message)
        self.assertNotIn('API key không hợp lệ', error.user_message)

    def test_ac8_401_also_uses_copilot_specific_code(self):
        import asyncio

        exchange = httpx.MockTransport(_exchange_handler(self.calls, status=401))
        client = CopilotClient(
            api_key=RAW, transport=httpx.MockTransport(_exchange_handler(self.calls, status=200)),
            token_exchange_transport=exchange,
        )
        with self.assertRaises(CopilotTokenExchangeError) as ctx:
            asyncio.run(client.complete(
                'sys', 'user', model='gpt-4o-mini', temperature=0.2, max_tokens=100,
            ))
        self.assertEqual(ctx.exception.error_code, 'copilot_token_exchange_failed')


class CopilotCatalogTests(TestCase):
    """AC9-AC11: catalog that theo tai khoan + fallback raw token."""

    def setUp(self):
        # Cache token dung chung cap module (dung production) => xoa moi test.
        CopilotTokenManager.clear_cache()
        self.calls = []

    def test_ac9_catalog_returns_enabled_models(self):
        import asyncio

        def models_handler(request):
            self.calls.append(request)
            return httpx.Response(200, json={
                'data': [
                    {'id': 'gpt-4o-mini', 'name': 'GPT-4o mini',
                     'policy': {'state': 'enabled'}, 'model_picker_enabled': True},
                    {'id': 'gpt-5', 'name': 'GPT-5',
                     'policy': {'state': 'enabled'}, 'model_picker_enabled': True},
                    {'id': 'claude-sonnet-5', 'name': 'Claude Sonnet 5',
                     'policy': {'state': 'disabled'}, 'model_picker_enabled': False},
                    {'id': 'gemini-3.8-flash', 'name': 'Gemini 3.8 Flash',
                     'policy': {'state': 'enabled'}, 'model_picker_enabled': False},
                ],
            })

        exchange = httpx.MockTransport(_exchange_handler(self.calls))
        client = CopilotClient(
            api_key=RAW, transport=httpx.MockTransport(models_handler),
            token_exchange_transport=exchange,
        )
        catalog = asyncio.run(client.catalog())
        self.assertEqual([m['id'] for m in catalog], ['gpt-4o-mini', 'gpt-5'])
        models_call = [r for r in self.calls if r.url.path.endswith('/models')][0]
        self.assertEqual(models_call.headers['authorization'], 'Bearer tid=session;exp=12345')

    def test_ac10_empty_catalog_returns_empty_not_fabricated(self):
        import asyncio

        def models_handler(request):
            self.calls.append(request)
            return httpx.Response(200, json={'data': []})

        client = CopilotClient(
            api_key=RAW, transport=httpx.MockTransport(models_handler),
            token_exchange_transport=httpx.MockTransport(_exchange_handler(self.calls)),
        )
        self.assertEqual(asyncio.run(client.catalog()), [])

    def test_ac10_http_error_returns_empty_not_raises(self):
        import asyncio

        def models_handler(request):
            self.calls.append(request)
            return httpx.Response(500, text='boom')

        client = CopilotClient(
            api_key=RAW, transport=httpx.MockTransport(models_handler),
            token_exchange_transport=httpx.MockTransport(_exchange_handler(self.calls)),
        )
        self.assertEqual(asyncio.run(client.catalog()), [])

    def test_ac11_raw_token_fallback_for_catalog_when_exchange_fails(self):
        import asyncio

        def models_handler(request):
            self.calls.append(request)
            # GitHub Models chap nhan PAT truc tiep.
            if request.headers.get('authorization') == f'token {RAW}':
                return httpx.Response(200, json={'data': [
                    {'id': 'gpt-4o-mini', 'policy': {'state': 'enabled'},
                     'model_picker_enabled': True},
                ]})
            return httpx.Response(401, text='nope')

        exchange = httpx.MockTransport(_exchange_handler(self.calls, status=404))
        client = CopilotClient(
            api_key=RAW, transport=httpx.MockTransport(models_handler),
            token_exchange_transport=exchange, allow_raw_token_catalog_fallback=True,
        )
        catalog = asyncio.run(client.catalog())
        self.assertEqual([m['id'] for m in catalog], ['gpt-4o-mini'])

    def test_ac11_fallback_off_returns_empty(self):
        import asyncio

        def models_handler(request):  # pragma: no cover
            self.calls.append(request)
            return httpx.Response(200, json={'data': []})

        exchange = httpx.MockTransport(_exchange_handler(self.calls, status=404))
        client = CopilotClient(
            api_key=RAW, transport=httpx.MockTransport(models_handler),
            token_exchange_transport=exchange,
        )
        self.assertEqual(asyncio.run(client.catalog()), [])


class CopilotTokenExpiryRetryTests(TestCase):
    """AC12: token het han giua chung -> 1 lan retry voi token moi, khong retry lap."""

    def test_ac12_single_401_refreshes_once_then_retries(self):
        import asyncio

        exchanges = []
        chats = []

        def exchange_handler(request):
            exchanges.append(request)
            return httpx.Response(200, json={
                'token': f'tid=session{len(exchanges)};exp=1',
                'endpoints': {'api': 'https://api.githubcopilot.com'},
                'expires_in': 1500,
            })

        def chat_handler(request):
            chats.append(request)
            # Session token dau tien (session1) bi 401, session2 ok.
            if request.headers.get('authorization', '').endswith('session1;exp=1'):
                return httpx.Response(401, text='token expired')
            return httpx.Response(200, json={
                'choices': [{'message': {'content': 'ok'}, 'finish_reason': 'stop'}],
                'usage': {'prompt_tokens': 3, 'completion_tokens': 2},
            })

        clock = _Clock()
        manager = CopilotTokenManager(
            transport=httpx.MockTransport(exchange_handler), now_fn=clock,
        )
        client = CopilotClient(
            api_key=RAW, transport=httpx.MockTransport(chat_handler),
            token_manager=manager,
        )
        result = asyncio.run(client.complete(
            'sys', 'user', model='gpt-4o-mini', temperature=0.2, max_tokens=50,
        ))
        self.assertEqual(result['text'], 'ok')
        self.assertEqual(len(chats), 2, 'chi 1 lan retry')
        self.assertEqual(len(exchanges), 2, 'lay session token moi 1 lan')

    def test_ac12_second_401_fails_fast_without_third_attempt(self):
        import asyncio

        chats = []

        def exchange_handler(request):
            return httpx.Response(200, json={
                'token': 'tid=session;exp=1',
                'endpoints': {'api': 'https://api.githubcopilot.com'},
                'expires_in': 1500,
            })

        def chat_handler(request):
            chats.append(request)
            return httpx.Response(401, text='nope')

        client = CopilotClient(
            api_key=RAW, transport=httpx.MockTransport(chat_handler),
            token_manager=CopilotTokenManager(
                transport=httpx.MockTransport(exchange_handler), now_fn=_Clock(),
            ),
        )
        with self.assertRaises(httpx.HTTPStatusError):
            asyncio.run(client.complete(
                'sys', 'user', model='gpt-4o-mini', temperature=0.2, max_tokens=50,
            ))
        self.assertEqual(len(chats), 2, 'khong retry lap lan 3')


class CopilotRegistrationTests(TestCase):
    """AC14: copilot trong ProviderChoices + registry + factory."""

    def setUp(self):
        CopilotTokenManager.clear_cache()

    def test_ac14_provider_choices_has_copilot(self):
        from advisory.models import UserAICredential

        self.assertIn('copilot', UserAICredential.ProviderChoices.values)

    def test_ac14_model_choices_accepts_copilot_models(self):
        from advisory.model_choices import validate_model_for_provider

        # Copilot la gateway nhieu nha cung cap => khong ep prefix.
        for model in ('gpt-5', 'claude-sonnet-5', 'gemini-3.8-flash'):
            ok, reason = validate_model_for_provider('copilot', model)
            self.assertTrue(ok, f'{model}: {reason}')

    def test_ac14_factory_builds_copilot_client(self):
        client = get_ai_client('copilot', api_key=RAW, ai_model='gpt-4o-mini')
        self.assertIsInstance(client, CopilotClient)

    def test_copilot_is_freedom_not_in_freeproviders(self):
        from advisory.model_choices import FREEFORM_PROVIDERS

        self.assertIn('copilot', FREEFORM_PROVIDERS)