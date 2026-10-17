"""R2.6 - Health check định kỳ + auto-evict + routing có decision log.

AC-ID theo `IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:921-930`.

Rủi ro plan đã nêu: *"auto-evict có thể chạy nhanh lúc provider đang deploy"* ⇒
AC2 yêu cầu **3 lần liên tiếp** + cooldown trước khi tắt, AC3 yêu cầu **2 lần liên
tiếp** trước khi bật lại. Hai ngưỡng khác nhau chống false-positive cả hai chiều.
"""
import os
import sys
from decimal import Decimal

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django

django.setup()

from django.test import TestCase, override_settings

from advisory.models import AIDeployment
from advisory.routing import (
    ERROR_NO_HEALTHY_DEPLOYMENT,
    NoHealthyDeploymentError,
    choose_deployment,
    routing_decision,
)


def _deployment(name, *, provider='openai', model='gpt-4o-mini', weight=100,
                healthy=True, latency_ms=100, cost_per_1k='0.0', enabled=True):
    return AIDeployment.objects.create(
        name=name, owner_scope=AIDeployment.OwnerScopeChoices.SYSTEM,
        provider=provider, model=model, weight=weight, enabled=enabled,
        health_state=(AIDeployment.HealthChoices.HEALTHY if healthy
                      else AIDeployment.HealthChoices.UNHEALTHY),
        latency_ms=latency_ms, cost_per_1k=Decimal(cost_per_1k),
    )


class RoutingStrategyTests(TestCase):
    """AC4: 3 chiến lược × 5 deployment ⇒ kết quả deterministic."""

    def setUp(self):
        self.deployments = [
            _deployment('a', latency_ms=500, cost_per_1k='1.0', weight=100),
            _deployment('b', latency_ms=100, cost_per_1k='2.0', weight=100),
            _deployment('c', latency_ms=300, cost_per_1k='0.5', weight=100),
            _deployment('d', latency_ms=200, cost_per_1k='1.5', weight=100),
            _deployment('e', latency_ms=400, cost_per_1k='0.8', weight=100),
        ]

    def test_ac4_latency_picks_fastest(self):
        self.assertEqual(choose_deployment(self.deployments, strategy='latency').name, 'b')

    def test_ac4_cost_picks_cheapest(self):
        self.assertEqual(choose_deployment(self.deployments, strategy='cost').name, 'c')

    def test_ac4_weighted_is_deterministic_with_fixed_seed(self):
        first = choose_deployment(self.deployments, strategy='weighted', seed=7)
        for _ in range(5):
            self.assertEqual(
                choose_deployment(self.deployments, strategy='weighted', seed=7).name,
                first.name)

    def test_ac4_weighted_differs_from_latency_pick(self):
        chosen = choose_deployment(self.deployments, strategy='weighted', seed=7)
        self.assertIn(chosen.name, {'a', 'b', 'c', 'd', 'e'})

    def test_ac4_tie_break_deterministic_by_name(self):
        tie_a = _deployment('tie-a', latency_ms=100)
        tie_b = _deployment('tie-b', latency_ms=100)
        self.assertEqual(choose_deployment([tie_b, tie_a], strategy='latency').name, 'tie-a')
        self.assertEqual(choose_deployment([tie_a, tie_b], strategy='latency').name, 'tie-a')

    def test_ac4_unhealthy_excluded(self):
        self.deployments[1].health_state = AIDeployment.HealthChoices.UNHEALTHY
        self.deployments[1].save()
        self.assertNotEqual(choose_deployment(self.deployments, strategy='latency').name, 'b')

    def test_ac4_disabled_excluded(self):
        self.deployments[1].enabled = False
        self.deployments[1].save()
        self.assertNotEqual(choose_deployment(self.deployments, strategy='latency').name, 'b')

    def test_ac4_unknown_strategy_raises_not_silent_fallback(self):
        with self.assertRaises(ValueError):
            choose_deployment(self.deployments, strategy='random-unknown')


class RoutingDecisionTests(TestCase):
    """AC5: mỗi request ghi {strategy, candidates, chosen, reason}."""

    def setUp(self):
        self.deployments = [
            _deployment('a', latency_ms=500, cost_per_1k='1.0'),
            _deployment('b', latency_ms=100, cost_per_1k='2.0'),
        ]

    def test_ac5_decision_payload_shape(self):
        decision = routing_decision(self.deployments, strategy='latency')
        # Khoa bat buoc phai co; `chosen_deployment_id` la bonus cho trace.
        self.assertTrue({'strategy', 'candidates', 'chosen', 'reason'} <= set(decision))
        self.assertEqual(decision['strategy'], 'latency')
        self.assertEqual(decision['chosen'], 'b')
        self.assertEqual(len(decision['candidates']), 2)
        self.assertIn('latency', decision['reason'])
        self.assertEqual(decision['chosen_deployment_id'], self.deployments[1].pk)

    def test_ac5_candidates_carry_decision_fields(self):
        decision = routing_decision(self.deployments, strategy='cost')
        keys = set(decision['candidates'][0])
        self.assertTrue({'name', 'provider', 'model', 'latency_ms',
                         'cost_per_1k', 'weight'} <= keys)


class NoHealthyDeploymentTests(TestCase):
    """AC6: không deployment healthy ⇒ 503 no_healthy_deployment."""

    def test_ac6_all_unhealthy_raises_with_error_code(self):
        deps = [_deployment('a', healthy=False), _deployment('b', healthy=False)]
        with self.assertRaises(NoHealthyDeploymentError) as ctx:
            routing_decision(deps, strategy='latency')
        self.assertEqual(ctx.exception.error_code, ERROR_NO_HEALTHY_DEPLOYMENT)

    def test_ac6_empty_list_raises(self):
        with self.assertRaises(NoHealthyDeploymentError):
            routing_decision([], strategy='latency')


class RoutingDisabledTests(TestCase):
    """AC7: AI_ROUTING_DISABLED tắt toàn bộ về hành vi 1 deployment."""

    @override_settings(AI_ROUTING_DISABLED=True)
    def test_ac7_disabled_returns_single_deployment(self):
        decision = routing_decision(
            [_deployment('only-one', latency_ms=9999)], strategy='latency')
        self.assertEqual(decision['chosen'], 'only-one')
        self.assertEqual(decision['strategy'], 'disabled')

    @override_settings(AI_ROUTING_DISABLED=True)
    def test_ac7_disabled_skips_health_filter(self):
        decision = routing_decision(
            [_deployment('sick', healthy=False)], strategy='latency')
        self.assertEqual(decision['chosen'], 'sick')

    @override_settings(AI_ROUTING_DISABLED=False)
    def test_ac7_enabled_filters_unhealthy(self):
        with self.assertRaises(NoHealthyDeploymentError):
            routing_decision([_deployment('sick', healthy=False)], strategy='latency')


class HealthCheckTaskTests(TestCase):
    """AC1/AC2/AC3: probe, evict sau 3 lần liên tiếp, bật lại sau 2 lần."""

    def setUp(self):
        self.dep = _deployment('primary')

    def _probe_results(self, outcomes):
        """Chạy task với probe trả về đúng dãy kết quả đã định nghĩa."""
        from advisory import tasks

        calls = {'n': 0}

        class _Client:
            provider = 'openai'

            async def probe(self):
                index = min(calls['n'], len(outcomes) - 1)
                calls['n'] += 1
                result = outcomes[index]
                return {
                    'ok': result,
                    'latency_ms': 42,
                    'error_code': '' if result else 'provider_error',
                    'detail': '' if result else 'probe failed',
                }

        original = tasks.get_ai_client
        tasks.get_ai_client = lambda *a, **kw: _Client()
        try:
            tasks.probe_deployments_health()
        finally:
            tasks.get_ai_client = original
        self.dep.refresh_from_db()
        return calls['n']

    def test_ac1_task_probes_enabled_deployments(self):
        from advisory.models import AIHealthCheck

        _deployment('disabled-one', enabled=False)
        self._probe_results([True])
        self.assertEqual(AIHealthCheck.objects.count(), 1)
        self.assertEqual(AIHealthCheck.objects.first().deployment, self.dep)
        self.assertEqual(self.dep.health_state, AIDeployment.HealthChoices.HEALTHY)

    def test_ac2_unhealthy_three_times_then_evict(self):
        from advisory.models import AIAuditLog

        self._probe_results([False])
        self.assertTrue(self.dep.enabled, 'lần 1 chưa tắt')
        self._probe_results([False])
        self.assertTrue(self.dep.enabled, 'lần 2 chưa tắt')
        self._probe_results([False])
        self.assertFalse(self.dep.enabled, 'lần 3 liên tiếp ⇒ tắt')
        self.assertTrue(
            AIAuditLog.objects.filter(action__icontains='evict').exists(),
            'phải có audit log khi evict')

    def test_ac3_healthy_two_times_then_reenable(self):
        self._probe_results([False])
        self._probe_results([False])
        self._probe_results([False])
        self.assertFalse(self.dep.enabled)
        self._probe_results([True])
        self.assertFalse(self.dep.enabled, 'lần 1 khôi phục chưa đủ')
        self._probe_results([True])
        self.assertTrue(self.dep.enabled, '2 lần liên tiếp ⇒ bật lại')

    def test_ac3_non_consecutive_successes_do_not_reenable(self):
        self._probe_results([False])
        self._probe_results([False])
        self._probe_results([False])
        self._probe_results([True])
        self._probe_results([False])
        self._probe_results([True])
        self.assertFalse(self.dep.enabled, 'phải liên tiếp, không cộng dồn')

    def test_ac8_probe_reuses_copilot_token_cache(self):
        from advisory import tasks
        from advisory.ai_clients.copilot import CopilotClient
        from advisory.copilot_tokens import CopilotTokenManager

        # Chỉ giữ deployment copilot để task không đụng mạng thật.
        AIDeployment.objects.exclude(provider='copilot').delete()
        CopilotTokenManager.clear_cache()
        _deployment('copilot-one', provider='copilot', model='gpt-5')
        import httpx

        exchanges = []

        def exchange_handler(request):
            exchanges.append(request)
            return httpx.Response(200, json={
                'token': 'tid=shared;exp=1',
                'endpoints': {'api': 'https://api.githubcopilot.com'},
                'expires_in': 1500,
            })

        def models_handler(request):
            return httpx.Response(200, json={'data': [
                {'id': 'gpt-5', 'policy': {'state': 'enabled'},
                 'model_picker_enabled': True},
            ]})

        original_factory = tasks.get_ai_client

        def fake_factory(provider, **kwargs):
            return CopilotClient(
                api_key='ghu_shared_token',
                token_exchange_transport=httpx.MockTransport(exchange_handler),
                transport=httpx.MockTransport(models_handler),
            )

        tasks.get_ai_client = fake_factory
        try:
            tasks.probe_deployments_health()
            tasks.probe_deployments_health()
            tasks.probe_deployments_health()
        finally:
            tasks.get_ai_client = original_factory
        self.assertEqual(len(exchanges), 1,
                         '3 lần probe phải dùng chung 1 session token')

    def test_ac2_evicted_deployment_still_probed_for_recovery(self):
        # Không có `auto_evicted` thì deployment đã tắt không bao giờ được probe
        # lại => mất dịch vụ vĩnh viễn sau một sự cố nhất thời.
        from advisory import tasks

        self._probe_results([False])
        self._probe_results([False])
        self._probe_results([False])
        self.assertTrue(self.dep.auto_evicted, 'phải đánh dấu auto-evict')
        self.assertEqual(tasks.probe_deployments_health()['probed'], 1,
                         'vẫn phải probe deployment đã evict để tìm hồi phục')

    def test_ac2_manually_disabled_deployment_is_not_probed(self):
        from advisory import tasks

        self.dep.enabled = False
        self.dep.save(update_fields=['enabled'])
        self.assertEqual(tasks.probe_deployments_health()['probed'], 0,
                         'quản trị tắt tay thì task health không đụng tới')