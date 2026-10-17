"""R2.10 - Danh mục model theo tài khoản + cache TTL theo provider.

AC-ID theo `IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:1018-1027`.

**AC4 (UI nhóm "Đã xác minh"/"Chưa xác minh") là FE** — không nằm trong file này.
**AC9 (nhãn "chỉ dùng qua provider Copilot")** là phần BE của contract nhãn: hàm
`provider_note()` sinh nhãn khi model chỉ tồn tại ở một provider. Xem `test_ai_provider_note`.

Vì sao phải là danh mục **thật** (AC1/AC2): tài liệu GitHub nói rõ danh mục Copilot
gating theo *"subscription, org membership, and feature flags"* theo tài khoản.
Hardcode danh sách ⇒ hiện model user **không có quyền** ⇒ họ chọn xong mới nhận
404/403 — cùng loại lỗi "hiển thị sai rồi mới biết" như `ai_ready` giả.
"""
import os
import sys

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django

django.setup()

from django.test import TestCase

from advisory.catalog import (
    CATALOG_SOURCE_PROVIDER,
    CATALOG_SOURCE_UNAVAILABLE,
    clear_catalog_cache,
    fetch_catalog,
    provider_note,
    ttl_seconds_for,
)

MODELS = [
    {'id': 'gpt-4o-mini', 'name': 'GPT-4o mini', 'context_window': 128000,
     'policy_state': 'enabled'},
    {'id': 'gpt-5', 'name': 'GPT-5', 'policy_state': 'enabled'},
]


class _FakeCatalogClient:
    provider = 'fake'

    def __init__(self, result):
        self.result = result

    async def catalog(self):
        return self.result


class CatalogFetchTests(TestCase):
    """AC1/AC2: trả danh mục thật; rỗng/lỗi ⇒ [] + catalog_source unavailable."""

    def setUp(self):
        clear_catalog_cache()

    def test_ac1_returns_provider_models(self):
        result = fetch_catalog('openai', api_key='sk-test', client=_FakeCatalogClient(MODELS))
        self.assertEqual(result['catalog_source'], CATALOG_SOURCE_PROVIDER)
        self.assertEqual([m['id'] for m in result['models']], ['gpt-4o-mini', 'gpt-5'])

    def test_ac7_context_window_is_kept(self):
        result = fetch_catalog('openai', api_key='sk-test', client=_FakeCatalogClient(MODELS))
        first = result['models'][0]
        self.assertEqual(first['context_window'], 128000)
        self.assertIn('context_window', first)

    def test_ac2_none_result_is_unavailable_not_empty_claim(self):
        result = fetch_catalog('openai', api_key='sk-test', client=_FakeCatalogClient(None))
        self.assertEqual(result['models'], [])
        self.assertEqual(result['catalog_source'], CATALOG_SOURCE_UNAVAILABLE)

    def test_ac2_empty_list_is_unavailable(self):
        result = fetch_catalog('openai', api_key='sk-test', client=_FakeCatalogClient([]))
        self.assertEqual(result['models'], [])
        self.assertEqual(result['catalog_source'], CATALOG_SOURCE_UNAVAILABLE)

    def test_ac2_never_fabricates_a_list(self):
        # Đường thật của endpoint: không có client được inject và không có key
        # ⇒ không có danh mục nào được xác minh ⇒ unavailable.
        result = fetch_catalog('openai', api_key='', client=None)
        self.assertEqual(result['models'], [], 'không có key thì không được bịa danh sách')
        self.assertEqual(result['catalog_source'], CATALOG_SOURCE_UNAVAILABLE)

    def test_ac6_filters_policy_and_picker(self):
        payload = [
            {'id': 'ok-1', 'policy_state': 'enabled'},
            {'id': 'off-1', 'policy_state': 'disabled'},
            {'id': 'hidden-1', 'policy_state': 'enabled', 'model_picker_enabled': False},
        ]
        result = fetch_catalog('copilot', api_key='ghu_x', client=_FakeCatalogClient(payload))
        self.assertEqual([m['id'] for m in result['models']], ['ok-1'])


class CatalogCacheTests(TestCase):
    """AC3: TTL copilot 25 phút, provider khác 24h."""

    def setUp(self):
        clear_catalog_cache()

    def test_ac3_ttl_per_provider(self):
        self.assertEqual(ttl_seconds_for('copilot'), 1500)
        self.assertEqual(ttl_seconds_for('openai'), 86400)
        self.assertEqual(ttl_seconds_for('gemini'), 86400)

    def test_ac3_second_call_within_ttl_hits_cache(self):
        calls = {'n': 0}

        class _Counting:
            provider = 'fake'

            async def catalog(self):
                calls['n'] += 1
                return MODELS

        fetch_catalog('openai', api_key='sk-1', client=_Counting())
        fetch_catalog('openai', api_key='sk-1', client=_Counting())
        self.assertEqual(calls['n'], 1, 'trong TTL thì chỉ gọi provider 1 lần')

    def test_ac3_cache_expires_after_ttl(self):
        calls = {'n': 0}

        class _Counting:
            provider = 'fake'

            async def catalog(self):
                calls['n'] += 1
                return MODELS

        fetch_catalog('openai', api_key='sk-1', client=_Counting())
        _expire_catalog_cache('openai', 'sk-1')
        fetch_catalog('openai', api_key='sk-1', client=_Counting())
        self.assertEqual(calls['n'], 2, 'hết TTL thì phải gọi lại provider')

    def test_ac3_different_credential_is_different_cache_entry(self):
        calls = {'n': 0}

        class _Counting:
            provider = 'fake'

            async def catalog(self):
                calls['n'] += 1
                return MODELS

        fetch_catalog('openai', api_key='sk-1', client=_Counting())
        fetch_catalog('openai', api_key='sk-2', client=_Counting())
        self.assertEqual(calls['n'], 2, 'cache gắn với credential, không dùng chung')

    def test_ac3_cache_key_never_contains_the_key_itself(self):
        client = _FakeCatalogClient(MODELS)
        fetch_catalog('openai', api_key='sk-super-secret', client=client)
        from advisory.catalog import _CATALOG_CACHE

        stored = ' '.join(str(k) for k in _CATALOG_CACHE)
        self.assertNotIn('sk-super-secret', stored)


class CatalogEndpointTests(TestCase):
    """AC1/AC2 qua HTTP thật."""

    def setUp(self):
        from django.contrib.auth.models import User
        from rest_framework.test import APIClient

        clear_catalog_cache()
        self.user = User.objects.create_user(username='cat-user', password='p')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _url(self, provider='openai', with_key=True):
        suffix = '?ai_api_key=sk-test' if with_key else ''
        return (
            f'/core/v1/workspace/ai-command-center/providers/{provider}/models/{suffix}'
        )

    def test_ac1_endpoint_returns_catalog(self):
        with _patched_client(_FakeCatalogClient(MODELS)):
            response = self.client.get(self._url())
        self.assertEqual(response.status_code, 200)
        body = _unwrap(response)
        self.assertEqual(body['catalog_source'], CATALOG_SOURCE_PROVIDER)
        self.assertEqual(len(body['models']), 2)

    def test_ac2_endpoint_unavailable_shape(self):
        with _patched_client(_FakeCatalogClient(None)):
            response = self.client.get(self._url())
        body = _unwrap(response)
        self.assertEqual(body['models'], [])
        self.assertEqual(body['catalog_source'], CATALOG_SOURCE_UNAVAILABLE)

    def test_ac2_no_credential_returns_unavailable_not_500(self):
        response = self.client.get(self._url(with_key=False))
        self.assertEqual(response.status_code, 200)
        body = _unwrap(response)
        self.assertEqual(body['models'], [])
        self.assertEqual(body['catalog_source'], CATALOG_SOURCE_UNAVAILABLE)

    def test_unknown_provider_does_not_crash(self):
        response = self.client.get(self._url('khong-ton-tai'))
        self.assertEqual(response.status_code, 200)
        body = _unwrap(response)
        self.assertEqual(body['models'], [])
        self.assertEqual(body['catalog_source'], CATALOG_SOURCE_UNAVAILABLE)

    def test_endpoint_never_echoes_the_api_key(self):
        with _patched_client(_FakeCatalogClient(MODELS)):
            response = self.client.get(self._url())
        self.assertNotIn('sk-test', str(response.data))


class ProviderNoteTests(TestCase):
    """AC9 (phan BE): nhan "chi dung qua provider" khi model chi co o mot provider."""

    def test_ac9_note_when_model_only_in_copilot(self):
        note = provider_note('gemini-3.8-flash', ['copilot'])
        self.assertIn('Copilot', note)

    def test_ac9_no_note_when_present_everywhere(self):
        self.assertEqual(provider_note('gpt-4o-mini', ['openai', 'copilot']), '')

    def test_ac9_no_note_for_empty_list(self):
        self.assertEqual(provider_note('gemini-3.8-flash', []), '')


def _unwrap(response):
    from advisory.tests.envelope import unwrapped

    return unwrapped(response)


def _patched_client(client):
    """Patch `get_ai_client` tai noi DUNG: catalog.py goi no qua import lai."""
    from unittest import mock

    return mock.patch(
        'advisory.ai_clients.get_ai_client', return_value=client, create=True,
    )


def _expire_catalog_cache(provider, api_key):
    from advisory.catalog import _cache_key, _CATALOG_CACHE

    _CATALOG_CACHE.pop(_cache_key(provider, api_key), None)