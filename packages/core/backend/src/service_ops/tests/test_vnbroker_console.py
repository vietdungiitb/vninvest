"""
VNBroker console — contract BE cho tab SOC VNBroker.

Kiểm chứng các lỗi P0 đã sửa ở BE (audit `docs/AUDIT_VNBROKER_CONSOLE_20261019.md`
§D1, ledger Entry 384):

- **F-04** — `circuit-breaker-status` KHÔNG còn trả `closed` / `failures: 0` cứng.
- **F-07** — `test-connection` gọi provider THẬT (không trả `latency_ms: 45` cứng).
- **F-05 / F-11** — có endpoint health **PER PROVIDER** với số đo thật.
- **F-26** — config SOC (`preferred_provider`, `circuit_breaker_*`) **CÓ hiệu lực
  runtime** (trước đây `VnbrokerDomainConfig` không có consumer nào).

Mọi assertion so với **giá trị thật** trong DB, không chỉ "không raise" (L-V04).
"""

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from market_data.models import VnbrokerProviderHealth
from market_data.vnbroker_adapter import _normalize_supported_source
from market_data.vnbroker_provider_health import (
    get_circuit_snapshot,
    get_soc_vnbroker_config,
    is_circuit_open,
    list_provider_health,
    record_provider_failure,
    record_provider_success,
)
from service_ops.models import ServiceConfig, ServiceDefinition
from service_ops.registry import ensure_service_registry
from service_ops.tests.envelope import unwrapped_json

User = get_user_model()


def _apply_config(payload):
    """Ghi 1 config SOC cho domain vnbroker (mô phỏng operator bấm 'Áp dụng')."""
    service = ServiceDefinition.objects.get(service_key='vnbroker_quote')
    return ServiceConfig.objects.create(
        service=service,
        config_schema_version='1.0',
        config_payload=payload,
        applied_by='tester',
        is_current=True,
    )


class VnbrokerProviderHealthRuntimeTest(TestCase):
    """Tầng đo runtime + circuit breaker (không qua HTTP)."""

    def setUp(self):
        ensure_service_registry()
        VnbrokerProviderHealth.objects.all().delete()
        _apply_config({
            'timeout': {'connect': 10, 'read': 30, 'write': 10, 'pool': 5},
            'max_retries': 3,
            'retry_delay_seconds': 2,
            'preferred_provider': 'kbs',
            'fallback_providers': ['vci'],
            'enabled': True,
            'circuit_breaker_threshold': 3,
            'circuit_breaker_window_seconds': 60,
            'circuit_breaker_cooldown_seconds': 300,
            'requests_per_minute': 60,
            'burst_limit': 10,
        })

    def test_config_bridge_reads_applied_soc_config(self):
        """F-26: config SOC đọc được từ runtime, không phải mặc định."""
        config = get_soc_vnbroker_config()
        self.assertEqual(config['preferred_provider'], 'kbs')
        self.assertEqual(config['circuit_breaker_threshold'], 3)
        self.assertEqual(config['fallback_providers'], ['vci'])

    def test_preferred_provider_from_soc_config_drives_source_resolution(self):
        """F-26: `preferred_provider` mà operator sửa CÓ quyết định provider được gọi."""
        self.assertEqual(_normalize_supported_source(None), 'KBS')

    def test_success_records_real_latency_and_rate(self):
        record_provider_success('vci', 120.5)
        row = VnbrokerProviderHealth.objects.get(provider='vci')
        self.assertEqual(row.total_requests, 1)
        self.assertEqual(row.failed_requests, 0)
        self.assertEqual(row.consecutive_failures, 0)
        self.assertAlmostEqual(row.latency_ms, 120.5, places=2)
        self.assertEqual(row.status, 'healthy')
        self.assertEqual(row.circuit_state, 'closed')
        self.assertIsNotNone(row.last_success_at)

    def test_failure_below_threshold_keeps_circuit_closed(self):
        record_provider_failure('vci', 'boom 1')
        record_provider_failure('vci', 'boom 2')
        row = VnbrokerProviderHealth.objects.get(provider='vci')
        self.assertEqual(row.consecutive_failures, 2)
        self.assertEqual(row.circuit_state, 'closed')
        self.assertEqual(row.status, 'degraded')
        self.assertFalse(is_circuit_open('vci'))

    def test_failure_at_threshold_opens_circuit(self):
        """F-04: mạch MỞ thật khi đạt ngưỡng — không phải luôn 'closed'."""
        for _ in range(3):
            record_provider_failure('vci', 'boom')
        row = VnbrokerProviderHealth.objects.get(provider='vci')
        self.assertEqual(row.circuit_state, 'open')
        self.assertEqual(row.status, 'unhealthy')
        self.assertIsNotNone(row.circuit_opened_at)
        self.assertTrue(is_circuit_open('vci'))

    def test_circuit_half_opens_after_cooldown(self):
        for _ in range(3):
            record_provider_failure('vci', 'boom')
        row = VnbrokerProviderHealth.objects.get(provider='vci')
        row.circuit_opened_at = timezone.now() - timezone.timedelta(seconds=400)
        row.save(update_fields=['circuit_opened_at'])

        self.assertFalse(is_circuit_open('vci'))
        row.refresh_from_db()
        self.assertEqual(row.circuit_state, 'half_open')

    def test_circuit_snapshot_reflects_runtime_state(self):
        for _ in range(3):
            record_provider_failure('kbs', 'boom')
        snapshot = get_circuit_snapshot()
        self.assertEqual(snapshot['source'], 'runtime')
        self.assertEqual(snapshot['circuit_breaker']['status'], 'open')
        self.assertEqual(snapshot['circuit_breaker']['failures'], 3)
        self.assertEqual(snapshot['circuit_breaker']['threshold'], 3)
        self.assertEqual(snapshot['per_provider']['kbs']['status'], 'open')
        self.assertIn('kbs', snapshot['open_providers'])


class VnbrokerConsoleApiTestCase(TestCase):
    """Contract HTTP của 3 endpoint console VNBroker."""

    @classmethod
    def setUpTestData(cls):
        ensure_service_registry()
        cls.user = User.objects.create_user(
            username='vnbroker-console-admin',
            email='vnbroker-console-admin@test.local',
            password='pass123',
        )
        cls.user.is_staff = True
        cls.user.is_superuser = True
        cls.user.save(update_fields=['is_staff', 'is_superuser'])

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        VnbrokerProviderHealth.objects.all().delete()
        _apply_config({
            'timeout': {'connect': 10, 'read': 30, 'write': 10, 'pool': 5},
            'max_retries': 3,
            'retry_delay_seconds': 2,
            'preferred_provider': 'vci',
            'fallback_providers': ['kbs'],
            'enabled': True,
            'circuit_breaker_threshold': 2,
            'circuit_breaker_window_seconds': 60,
            'circuit_breaker_cooldown_seconds': 300,
            'requests_per_minute': 60,
            'burst_limit': 10,
        })

    def test_circuit_breaker_endpoint_reports_open_state(self):
        """F-04: endpoint trả state thật, không phải `closed` cứng."""
        for _ in range(2):
            record_provider_failure('vci', 'boom')

        response = self.client.get('/api/soc/vnbroker/circuit-breaker-status/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = unwrapped_json(response)
        self.assertEqual(payload['source'], 'runtime')
        self.assertEqual(payload['circuit_breaker']['status'], 'open')
        self.assertEqual(payload['circuit_breaker']['failures'], 2)
        self.assertEqual(payload['circuit_breaker']['threshold'], 2)
        self.assertEqual(payload['per_provider']['vci']['status'], 'open')

    def test_provider_health_endpoint_reports_real_metrics(self):
        """F-05/F-11: số đo per-provider thật, không phải số bịa."""
        record_provider_success('vci', 120.5)
        record_provider_failure('vci', 'boom')

        response = self.client.get('/api/soc/vnbroker/provider-health/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = unwrapped_json(response)
        self.assertEqual(payload['source'], 'runtime')
        self.assertEqual(len(payload['providers']), 1)
        row = payload['providers'][0]
        self.assertEqual(row['provider'], 'vci')
        self.assertEqual(row['total_requests'], 2)
        self.assertEqual(row['failed_requests'], 1)
        self.assertAlmostEqual(row['success_rate'], 50.0, places=1)
        self.assertAlmostEqual(row['error_rate'], 50.0, places=1)
        self.assertAlmostEqual(row['latency_ms'], 120.5, places=2)

    def test_provider_health_endpoint_empty_when_no_runtime_data(self):
        """Chưa có lần gọi provider nào ⇒ nói rõ là unavailable, KHÔNG bịa số."""
        response = self.client.get('/api/soc/vnbroker/provider-health/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = unwrapped_json(response)
        self.assertEqual(payload['source'], 'unavailable')
        self.assertEqual(payload['providers'], [])

    def test_test_connection_uses_real_probe_result(self):
        """F-07: độ trễ trả về là độ trễ đo được, không phải hằng số 45."""
        with patch(
            'service_ops.views.vnbroker.probe_provider',
            return_value={'provider': 'vci', 'status': 'ok', 'latency_ms': 321, 'error': ''},
        ):
            response = self.client.post(
                '/api/soc/vnbroker/test-connection/', {'provider': 'vci'}, format='json'
            )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = unwrapped_json(response)
        self.assertEqual(payload['status'], 'ok')
        self.assertEqual(payload['latency_ms'], 321)

    def test_test_connection_surfaces_provider_error(self):
        """Provider chết ⇒ phải báo lỗi, không trả 'ok' giả."""
        with patch(
            'service_ops.views.vnbroker.probe_provider',
            return_value={
                'provider': 'vci',
                'status': 'error',
                'latency_ms': 1200,
                'error': 'connection refused',
            },
        ):
            response = self.client.post(
                '/api/soc/vnbroker/test-connection/', {'provider': 'vci'}, format='json'
            )
        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)

    def test_test_connection_rejects_unsupported_provider(self):
        response = self.client.post(
            '/api/soc/vnbroker/test-connection/', {'provider': 'smsc'}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_probe_provider_records_health_row(self):
        """Probe thật (giả lập network) phải để lại dấu vết trong health row."""
        from market_data import vnbroker_adapter

        class _FakeQuote:
            def __init__(self, symbol=None, **kwargs):
                self.symbol = symbol

            def history(self, **kwargs):
                import pandas as pd

                return pd.DataFrame(
                    [{'time': '2026-10-19', 'open': 1, 'high': 2, 'low': 0.5, 'close': 1.5, 'volume': 10}]
                )

        with patch.object(vnbroker_adapter, '_load_quote_class', return_value=_FakeQuote):
            from market_data.vnbroker_provider_health import probe_provider

            result = probe_provider('vci')

        self.assertEqual(result['status'], 'ok')
        self.assertGreater(result['latency_ms'], 0)
        row = VnbrokerProviderHealth.objects.get(provider='vci')
        self.assertEqual(row.total_requests, 1)
        self.assertEqual(row.failed_requests, 0)
        self.assertEqual(list_provider_health()[0].provider, 'vci')
