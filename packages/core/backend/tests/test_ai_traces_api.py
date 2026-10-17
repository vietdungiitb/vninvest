"""R3.2 — endpoint đọc `AITrace` (plan `:1065-1083`).

M3 đã đo bằng grep: trước R3.2 **không** có endpoint nào đọc `AITrace` — dữ liệu ghi
một chiều, không ai đọc lại được. File này khóa lại các AC liên quan tới BE:

- AC4 (filter + pagination): `symbol`/`model`/`status`/`step`/khoảng ngày + `limit`/`offset`.
- AC6 (isolation): user A **không** thấy trace của user B — kể cả khi A là staff,
  vì không có AC nào cho phép xem người khác (thiếu quyền thì bỏ, không mở rộng).
- AC3 (không lộ plaintext): payload **không** được chứa prompt/response thô.
"""
import uuid
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from advisory.tests.envelope import unwrapped
from user_workspace.tests.tenant_test_helpers import grant_tenant

User = get_user_model()

TRACES_URL = '/core/v1/workspace/ai-command-center/traces/'


class AITraceApiTestBase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='r32-user', email='r32@example.com', password='testpass123',
        )
        grant_tenant(self.user, role='editor', tenant_code='r32-tenant')
        self.client.force_authenticate(user=self.user)

    def _make_trace(self, *, user=None, step='technical', status_='ok',
                    symbol='VIC', model='gpt-4o-mini', age_days=0):
        from advisory.models import AdvisoryRecord, AITrace

        owner = user or self.user
        rec = AdvisoryRecord.objects.create(
            symbol=symbol, session_date=timezone.now().date(), user=owner,
            ai_model=model,
        )
        trace_id = uuid.uuid4()
        for st in ('technical', 'flow', 'sentiment', 'synthesis'):
            AITrace.objects.create(
                trace_id=trace_id, advisory=rec, user=owner, symbol=symbol,
                session_date=rec.session_date, step=st, provider='openai',
                model=model, prompt_hash='a' * 64, response_hash='b' * 64,
                tokens_in=10, tokens_out=20, latency_ms=100,
                status=status_,
                error_code='provider_http_500' if status_ == 'error' else '',
            )
        if age_days:
            from advisory.models import AITrace as T
            T.objects.filter(trace_id=trace_id).update(
                created_at=timezone.now() - timedelta(days=age_days))
        return trace_id


class TracesListContractTests(AITraceApiTestBase):
    def test_requires_authentication(self):
        anon = APIClient()
        self.assertEqual(anon.get(TRACES_URL).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_returns_paginated_envelope(self):
        self._make_trace()
        response = self.client.get(TRACES_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = unwrapped(response)
        for key in ('results', 'total', 'limit', 'offset'):
            self.assertIn(key, body)
        self.assertEqual(body['total'], 4)
        self.assertEqual(body['limit'], 10)

    def test_empty_state_is_empty_list_not_error(self):
        """AC5 phía BE: không có trace ⇒ `results=[]`, `total=0`, HTTP 200."""
        response = self.client.get(TRACES_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = unwrapped(response)
        self.assertEqual(body['results'], [])
        self.assertEqual(body['total'], 0)

    def test_row_exposes_step_latency_and_hashes_but_no_plaintext(self):
        """AC2 (latency từng bước) + AC3 (metadata, không plaintext)."""
        self._make_trace()
        row = unwrapped(self.client.get(TRACES_URL))['results'][0]
        for key in ('trace_id', 'step', 'latency_ms', 'prompt_hash',
                    'response_hash', 'provider', 'model', 'status',
                    'tokens_in', 'tokens_out', 'created_at'):
            self.assertIn(key, row)
        # Không field nào chứa nội dung thô.
        self.assertNotIn('prompt', row)
        self.assertNotIn('response', row)
        self.assertNotIn('raw', row)


class TracesFilterTests(AITraceApiTestBase):
    def test_filter_by_symbol(self):
        self._make_trace(symbol='VIC')
        self._make_trace(symbol='HAG')
        body = unwrapped(self.client.get(f'{TRACES_URL}?symbol=VIC'))
        self.assertEqual(body['total'], 4)
        self.assertTrue(all(r['symbol'] == 'VIC' for r in body['results']))

    def test_filter_by_status(self):
        self._make_trace(status_='ok')
        self._make_trace(status_='error')
        body = unwrapped(self.client.get(f'{TRACES_URL}?status=error'))
        self.assertEqual(body['total'], 4)
        self.assertTrue(all(r['status'] == 'error' for r in body['results']))
        self.assertTrue(
            all(r['error_code'] == 'provider_http_500' for r in body['results']))

    def test_filter_by_model(self):
        self._make_trace(model='gpt-4o-mini')
        self._make_trace(model='gemini-3.8-flash')
        body = unwrapped(self.client.get(f'{TRACES_URL}?model=gemini-3.8-flash'))
        self.assertEqual(body['total'], 4)

    def test_filter_by_step_and_date_range(self):
        self._make_trace(age_days=30)
        self._make_trace()
        body = unwrapped(self.client.get(f'{TRACES_URL}?step=technical'))
        self.assertEqual(body['total'], 2)
        cutoff = (timezone.now() - timedelta(days=10)).date().isoformat()
        body = unwrapped(self.client.get(f'{TRACES_URL}?date_from={cutoff}'))
        self.assertEqual(body['total'], 4)

    def test_pagination_limit_capped_and_offset(self):
        self._make_trace()
        self._make_trace()
        body = unwrapped(self.client.get(f'{TRACES_URL}?limit=3&offset=3'))
        self.assertEqual(body['limit'], 3)
        self.assertEqual(body['offset'], 3)
        self.assertEqual(len(body['results']), 3)
        self.assertEqual(body['total'], 8)

    def test_limit_over_100_is_capped(self):
        self._make_trace()
        body = unwrapped(self.client.get(f'{TRACES_URL}?limit=9999'))
        self.assertLessEqual(body['limit'], 100)

    def test_garbage_pagination_falls_back_instead_of_500(self):
        self._make_trace()
        response = self.client.get(f'{TRACES_URL}?limit=abc&offset=-5')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = unwrapped(response)
        self.assertEqual(body['limit'], 10)
        self.assertEqual(body['offset'], 0)


class TracesIsolationTests(AITraceApiTestBase):
    """AC6: user A không thấy trace của user B."""

    def test_other_users_traces_are_invisible(self):
        other = User.objects.create_user(
            username='r32-other', email='r32-other@example.com', password='x')
        self._make_trace(user=other)
        body = unwrapped(self.client.get(TRACES_URL))
        self.assertEqual(body['total'], 0)

    def test_staff_also_only_sees_own_traces(self):
        """Không có AC nào cho phép xem người khác ⇒ staff cũng chỉ thấy của mình.

        Thiếu quyền thì bỏ; không mở rộng phạm vi để "cho tiện".
        """
        staff = User.objects.create_user(
            username='r32-staff', email='r32-staff@example.com',
            password='x', is_staff=True)
        self._make_trace(user=staff)
        self.client.force_authenticate(user=staff)
        body = unwrapped(self.client.get(TRACES_URL))
        self.assertEqual(body['total'], 4)

    def test_owner_sees_own_traces(self):
        self._make_trace()
        self.assertEqual(unwrapped(self.client.get(TRACES_URL))['total'], 4)


class TracesUrlTests(TestCase):
    def test_url_is_named(self):
        """Route phải có tên để `reverse()` dùng được — đừng chỉ hardcode chuỗi.

        `user_workspace.urls` được include với `namespace='user_workspace'`
        (`vninvest_core/urls.py:66`) nên tên phải kèm namespace.
        """
        url = reverse('user_workspace:workspace-ai-cc-traces')
        self.assertTrue(
            url.endswith('workspace/ai-command-center/traces/'), url)