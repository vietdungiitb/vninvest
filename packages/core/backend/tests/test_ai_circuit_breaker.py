"""R2.9 - retry + exponential backoff + circuit breaker o TANG CLIENT.

AC-ID theo `IMPLEMENTATION_PAIN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:992-1002`
(R2.9).

Vong retry cũ nằm ở `orchestrator.call_agent_async`. R2.9 đưa xuống client:
`AiClient.complete()` giữ là **primitive 1 lần**; `complete_resilient()` mới là
vòng retry + breaker + deadline. Nhờ đó 3 sub-agent `asyncio.gather` **dùng chung**
một client nên retry/backoff/breaker **không nhân 3** (AC7).
"""
import asyncio
import os
import sys

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django

django.setup()

import httpx
from django.test import TestCase

from advisory.ai_clients.base import (
    AiClient,
    ProviderCircuitOpenError,
    ProviderHTTPError,
    RetryPolicy,
    parse_retry_after,
)
from advisory.health import CircuitBreaker


class _FakeClient(AiClient):
    """Client gia lap: moi lai goi lai `statuses` tiep theo."""

    provider = 'fake'

    def __init__(self, statuses, **kwargs):
        super().__init__(**kwargs)
        self.statuses = list(statuses)
        self.calls = 0

    async def complete(self, system, user, *, model, temperature, max_tokens,
                       timeout=None, response_format=None):
        self.calls += 1
        status = self.statuses.pop(0) if self.statuses else 200
        if status == 'timeout':
            raise httpx.ReadTimeout('slow')
        if isinstance(status, int) and status >= 400:
            raise ProviderHTTPError(status, body_text='loi', response=None)
        return {'text': 'ok', 'usage': None, 'raw': {}, 'finish_reason': 'stop'}


class _SleepRecorder:
    def __init__(self):
        self.slept = []

    async def __call__(self, seconds):
        self.slept.append(seconds)


class RetryTests(TestCase):
    """AC1-AC3: retry dung loi, khong retry loi xac thuc, backoff tang dan."""

    def setUp(self):
        self.slept = _SleepRecorder()

    def _run(self, client, policy=None, **kwargs):
        policy = policy or RetryPolicy(num_retries=2, backoff_base_ms=100)
        return asyncio.run(client.complete_resilient(
            'sys', 'user', model='m', temperature=0.2, max_tokens=10,
            policy=policy, sleep=self.slept, **kwargs,
        ))

    def test_ac1_429_then_success_costs_three_requests(self):
        client = _FakeClient([429, 429, 200])
        result = self._run(client)
        self.assertEqual(result['text'], 'ok')
        self.assertEqual(client.calls, 3)

    def test_ac1_exhausted_retries_raises_last_error(self):
        client = _FakeClient([429, 429, 429])
        with self.assertRaises(ProviderHTTPError) as ctx:
            self._run(client)
        self.assertEqual(ctx.exception.status_code, 429)
        self.assertEqual(client.calls, 3)

    def test_ac1_num_retries_zero_means_single_request(self):
        client = _FakeClient([429, 200])
        with self.assertRaises(ProviderHTTPError):
            self._run(client, RetryPolicy(num_retries=0, backoff_base_ms=100))
        self.assertEqual(client.calls, 1)

    def test_ac2_401_is_not_retried(self):
        for status in (401, 403, 400):
            with self.subTest(status=status):
                client = _FakeClient([status, 200])
                with self.assertRaises(ProviderHTTPError):
                    self._run(client)
                self.assertEqual(client.calls, 1, '401/403/400 khong retry')

    def test_ac2_5xx_is_retried(self):
        for status in (500, 502, 503, 504):
            with self.subTest(status=status):
                client = _FakeClient([status, 200])
                self.assertEqual(self._run(client)['text'], 'ok')
                self.assertEqual(client.calls, 2)

    def test_ac2_timeout_is_retried(self):
        client = _FakeClient(['timeout', 200])
        self.assertEqual(self._run(client)['text'], 'ok')
        self.assertEqual(client.calls, 2)

    def test_ac3_backoff_grows_exponentially(self):
        client = _FakeClient([500, 500, 200])
        self._run(client, RetryPolicy(num_retries=2, backoff_base_ms=100))
        # 0.1s roi 0.2s
        self.assertEqual(self.slept.slept, [0.1, 0.2])

    def test_ac3_retry_after_header_wins_over_backoff(self):
        class _Resp:
            headers = {'retry-after': '7'}

        class _Client(_FakeClient):
            async def complete(self, *a, **kw):
                self.calls += 1
                raise ProviderHTTPError(429, body_text='x', response=_Resp())

        client = _Client([429])
        with self.assertRaises(ProviderHTTPError):
            self._run(client, RetryPolicy(num_retries=1, backoff_base_ms=100))
        self.assertEqual(self.slept.slept, [7.0])

    def test_parse_retry_after_handles_seconds_and_dates(self):
        self.assertEqual(parse_retry_after({'retry-after': '3'}), 3.0)
        self.assertEqual(parse_retry_after({'Retry-After': '2.5'}), 2.5)
        self.assertIsNone(parse_retry_after({'retry-after': 'banana'}))
        self.assertIsNone(parse_retry_after(None))


class DeadlineTests(TestCase):
    """AC6: tong thoi gian <= deadline."""

    def setUp(self):
        self.slept = _SleepRecorder()

    def test_ac6_deadline_stops_retrying(self):
        client = _FakeClient([500] * 10)
        policy = RetryPolicy(num_retries=5, backoff_base_ms=100, deadline_seconds=0.25)
        with self.assertRaises(ProviderHTTPError):
            asyncio.run(client.complete_resilient(
                'sys', 'user', model='m', temperature=0.2, max_tokens=10,
                policy=policy, sleep=self.slept, clock=_FakeClock([0.0, 0.2, 0.9]),
            ))
        self.assertLessEqual(len(self.slept.slept), 2, 'phai dung truoc kich hat deadline')

    def test_ac6_default_deadline_from_settings(self):
        with self.settings(AI_ADVISORY_DEADLINE_SECONDS=77):
            self.assertEqual(RetryPolicy.from_settings().deadline_seconds, 77.0)


class _FakeClock:
    def __init__(self, values):
        self.values = list(values)
        self.index = 0

    def __call__(self):
        value = self.values[min(self.index, len(self.values) - 1)]
        self.index += 1
        return value


class CircuitBreakerTests(TestCase):
    """AC4-AC5: breaker mo sau N loi lien tiep, dong lai sau cooldown."""

    def setUp(self):
        self.now = [0.0]
        self.slept = _SleepRecorder()
        self.breaker = CircuitBreaker(
            failure_threshold=2, cooldown_seconds=30.0, now_fn=lambda: self.now[0],
        )

    def _run(self, client, policy=None):
        policy = policy or RetryPolicy(num_retries=0, backoff_base_ms=10)
        return asyncio.run(client.complete_resilient(
            'sys', 'user', model='m', temperature=0.2, max_tokens=10,
            policy=policy, sleep=self.slept, breaker=self.breaker,
            clock=lambda: self.now[0],
        ))

    def test_ac4_breaker_opens_and_short_circuits(self):
        client = _FakeClient([500, 500, 200])
        for _ in range(2):
            with self.assertRaises(ProviderHTTPError):
                self._run(client)
        self.assertEqual(self.breaker.state(), 'open')
        with self.assertRaises(ProviderCircuitOpenError) as ctx:
            self._run(client)
        self.assertEqual(ctx.exception.error_code, 'provider_circuit_open')
        self.assertEqual(client.calls, 2, 'breaker mo => khong goi provider nua')

    def test_ac5_breaker_closes_after_cooldown(self):
        client = _FakeClient([500, 500, 200])
        for _ in range(2):
            with self.assertRaises(ProviderHTTPError):
                self._run(client)
        self.now[0] = 31.0
        self.assertEqual(self.breaker.state(), 'half_open')
        result = self._run(client)
        self.assertEqual(result['text'], 'ok')
        self.assertEqual(self.breaker.state(), 'closed')

    def test_ac5_half_open_failure_reopens(self):
        client = _FakeClient([500, 500, 500])
        for _ in range(2):
            with self.assertRaises(ProviderHTTPError):
                self._run(client)
        self.now[0] = 31.0
        with self.assertRaises(ProviderHTTPError):
            self._run(client)
        self.assertEqual(self.breaker.state(), 'open')

    def test_success_resets_failure_count(self):
        client = _FakeClient([500, 200, 500])
        with self.assertRaises(ProviderHTTPError):
            self._run(client)
        self.assertEqual(self._run(client)['text'], 'ok')
        self.assertEqual(self.breaker.state(), 'closed')
        with self.assertRaises(ProviderHTTPError):
            self._run(client)
        self.assertEqual(self.breaker.state(), 'closed', 'reset sau 1 lan thanh cong')


class SharedRetryTests(TestCase):
    """AC7: 3 sub-agent song song + retry => KHONG nhan 3 lan."""

    def test_ac7_three_agents_do_not_multiply_requests(self):
        # Provider luon 429. Neu moi agent retry rieng => 3 x 3 = 9 request.
        client = _FakeClient([429] * 30)
        slept = _SleepRecorder()
        policy = RetryPolicy(num_retries=2, backoff_base_ms=1)
        breaker = CircuitBreaker(failure_threshold=3, cooldown_seconds=60.0)

        async def sub_agent(name):
            return await client.complete_resilient(
                f'sys {name}', 'user', model='m', temperature=0.2, max_tokens=10,
                policy=policy, sleep=slept, breaker=breaker,
            )

        async def main():
            return await asyncio.gather(
                sub_agent('technical'), sub_agent('flow'), sub_agent('sentiment'),
                return_exceptions=True,
            )

        results = asyncio.run(main())
        self.assertEqual(len(results), 3)
        self.assertTrue(any(isinstance(r, Exception) for r in results))
        # Khong duoc 9 request: breaker cat ngan + retry khong nhan theo agent.
        self.assertLessEqual(client.calls, 5, f'nhieu request la: {client.calls}')
        self.assertEqual(breaker.state(), 'open')


class RetryAfterResponseTests(TestCase):
    """AC8: copilot 401 -> refresh 1 lan (khong phai retry 3 lan)."""

    def test_ac8_401_exchange_error_is_not_retried(self):
        from advisory.copilot_tokens import CopilotTokenExchangeError

        class _Boom(AiClient):
            provider = 'copilot'

            def __init__(self):
                super().__init__()
                self.calls = 0

            async def complete(self, *a, **kw):
                self.calls += 1
                raise CopilotTokenExchangeError('can ghu_', status=404)

        client = _Boom()
        slept = _SleepRecorder()
        with self.assertRaises(CopilotTokenExchangeError):
            asyncio.run(client.complete_resilient(
                'sys', 'user', model='m', temperature=0.2, max_tokens=10,
                policy=RetryPolicy(num_retries=2, backoff_base_ms=1), sleep=slept,
            ))
        self.assertEqual(client.calls, 1, 'loi token khong duoc retry')
        self.assertEqual(slept.slept, [])


class RetryPolicySourceTests(TestCase):
    """num_retries / backoff_base_ms / cooldown_seconds tu deployment (AIDeployment)."""

    def test_policy_from_deployment_overrides_defaults(self):
        from advisory.models import AIDeployment

        deployment = AIDeployment(
            name='d', owner_scope='system', provider='openai', model='gpt-4o-mini',
            num_retries=5, backoff_base_ms=250, cooldown_seconds=90,
        )
        policy = RetryPolicy.from_deployment(deployment)
        self.assertEqual(policy.num_retries, 5)
        self.assertEqual(policy.backoff_base_ms, 250.0)
        self.assertEqual(policy.cooldown_seconds, 90.0)

    def test_policy_without_deployment_uses_settings(self):
        with self.settings(AI_PROVIDER_NUM_RETRIES=1, AI_PROVIDER_BACKOFF_BASE_MS=10):
            policy = RetryPolicy.from_settings()
        self.assertEqual(policy.num_retries, 1)
        self.assertEqual(policy.backoff_base_ms, 10.0)

    def test_negative_values_are_clamped(self):
        policy = RetryPolicy(num_retries=-5, backoff_base_ms=-10, cooldown_seconds=-1)
        self.assertEqual(policy.num_retries, 0)
        self.assertEqual(policy.backoff_base_ms, 0.0)
        self.assertEqual(policy.cooldown_seconds, 0.0)