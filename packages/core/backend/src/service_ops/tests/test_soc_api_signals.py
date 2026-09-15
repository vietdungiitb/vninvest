"""Focused SOC signals API contract tests for bridge-write and runtime summaries."""

from datetime import timedelta
from decimal import Decimal
import json
from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from signal_intelligence.models import OrderFlowEvent, UnifiedAlert
from service_ops.models import OwnershipRecord
from service_ops.registry import ensure_service_registry

User = get_user_model()


def _load_openapi_schema(response):
    try:
        return json.loads(response.content)
    except json.JSONDecodeError:
        import yaml

        return yaml.safe_load(response.content)


class SignalsApiBaseTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        ensure_service_registry()
        cls.user = User.objects.create_user(
            username='soc-signals-admin',
            email='soc-signals-admin@test.local',
            password='pass123',
        )
        cls.user.is_staff = True
        cls.user.is_superuser = True
        cls.user.save(update_fields=['is_staff', 'is_superuser'])

        now = timezone.now()
        session_date = now.date()

        cls.whale_alert = UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.WHALE,
            symbol='VCI',
            severity=UnifiedAlert.SeverityChoices.HIGH,
            title='Whale buy detected',
            body='Large order flow detected',
            value=Decimal('1250000000.00'),
            direction=UnifiedAlert.DirectionChoices.BUY,
            session_date=session_date,
            triggered_at=now - timedelta(minutes=5),
            source_ref='signals-contract-whale',
            metadata={'rule_name': 'whale_flow'},
        )
        cls.dark_alert = UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.DARK_FLOW,
            symbol='SSI',
            severity=UnifiedAlert.SeverityChoices.MEDIUM,
            title='Dark pool trade',
            body='Block trade detected',
            value=Decimal('980000000.00'),
            direction=UnifiedAlert.DirectionChoices.SELL,
            session_date=session_date,
            triggered_at=now - timedelta(minutes=3),
            source_ref='signals-contract-dark',
            metadata={'rule_name': 'dark_pool_ratio'},
        )
        cls.signal_alert = UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.SIGNAL,
            symbol='VNM',
            severity=UnifiedAlert.SeverityChoices.MEDIUM,
            title='Signal alert',
            body='Price change threshold crossed',
            value=Decimal('5.20'),
            direction=UnifiedAlert.DirectionChoices.BUY,
            session_date=session_date,
            triggered_at=now - timedelta(minutes=1),
            source_ref='signals-contract-signal',
            metadata={'rule_name': 'price_change_pct'},
        )

        OrderFlowEvent.objects.create(
            symbol='VCI',
            session_date=session_date,
            signal_type=OrderFlowEvent.SignalTypeChoices.WHALE_BUY,
            side=OrderFlowEvent.SideChoices.BUY,
            strength=0.9,
            whale_intensity=0.95,
            source_ref='signals-event-whale',
            unified_alert=cls.whale_alert,
            triggered_at=now - timedelta(minutes=5),
        )
        OrderFlowEvent.objects.create(
            symbol='SSI',
            session_date=session_date,
            signal_type=OrderFlowEvent.SignalTypeChoices.DARK_FLOW,
            side=OrderFlowEvent.SideChoices.SELL,
            strength=0.7,
            whale_intensity=0.1,
            source_ref='signals-event-dark',
            unified_alert=cls.dark_alert,
            triggered_at=now - timedelta(minutes=3),
        )
        OrderFlowEvent.objects.create(
            symbol='VNM',
            session_date=session_date,
            signal_type=OrderFlowEvent.SignalTypeChoices.OTHER,
            side=OrderFlowEvent.SideChoices.BUY,
            strength=0.6,
            whale_intensity=0.2,
            source_ref='signals-event-signal',
            unified_alert=cls.signal_alert,
            triggered_at=now - timedelta(minutes=1),
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)


class SignalsApiContractTestCase(SignalsApiBaseTestCase):
    def test_get_signal_config_returns_bridge_write_metadata(self):
        response = self.client.get('/api/soc/signals/config/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['write_mode'], 'bridge-write')
        self.assertFalse(data['can_apply'])
        self.assertEqual(data['ownership']['mode'], 'bridge-write')
        self.assertIn('config_payload', data)

    def test_preview_returns_validation_envelope_without_apply_permission(self):
        response = self.client.post(
            '/api/soc/signals/config/preview/',
            {
                'config_payload': {
                    'whale_threshold_vnd': 600000000,
                    'dark_pool_threshold_vnd': 1200000000,
                    'detection_task_interval_seconds': 60,
                },
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertTrue(data['valid'])
        self.assertFalse(data['can_apply'])

    def test_signals_routes_appear_in_openapi_schema(self):
        response = self.client.get('/core/v1/schema/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        schema = _load_openapi_schema(response)

        config_path = schema['paths']['/api/soc/signals/config/']
        preview_path = schema['paths']['/api/soc/signals/config/preview/']
        apply_path = schema['paths']['/api/soc/signals/config/apply/']
        summary_path = schema['paths']['/api/soc/signals/summary/']
        whale_recent_path = schema['paths']['/api/soc/signals/whale/recent/']
        retention_preview_path = schema['paths']['/api/soc/signals/retention-policy/preview/']
        materialization_path = schema['paths']['/api/soc/signals/materialization/']
        universe_update_path = schema['paths']['/api/soc/signals/universe/update/']
        job_run_path = schema['paths']['/api/soc/signals/jobs/run/']
        performance_path = schema['paths']['/api/soc/signals/performance-metrics/']

        self.assertEqual(config_path['get']['summary'], 'Lấy runtime config Signals')
        self.assertEqual(preview_path['post']['summary'], 'Preview runtime config Signals')
        self.assertIn('requestBody', preview_path['post'])
        self.assertEqual(apply_path['post']['summary'], 'Apply runtime config Signals')
        self.assertIn('requestBody', apply_path['post'])
        self.assertEqual(summary_path['get']['summary'], 'Lấy summary Signals')
        self.assertEqual(whale_recent_path['get']['summary'], 'Lấy recent whale alerts Signals')
        self.assertEqual(retention_preview_path['post']['summary'], 'Preview retention policy Signals')
        self.assertIn('requestBody', retention_preview_path['post'])
        self.assertEqual(materialization_path['get']['summary'], 'Lấy materialization status Signals')
        self.assertEqual(universe_update_path['post']['summary'], 'Cập nhật universe Signals')
        self.assertIn('requestBody', universe_update_path['post'])
        self.assertEqual(job_run_path['post']['summary'], 'Queue detection job Signals')
        self.assertIn('requestBody', job_run_path['post'])
        self.assertEqual(performance_path['get']['summary'], 'Lấy performance metrics Signals')
        self.assertEqual(config_path['get']['security'], [{'CorePATBearer': []}, {'cookieAuth': []}])

    def test_summary_aggregates_alerts_and_events_from_current_session(self):
        response = self.client.get('/api/soc/signals/summary/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['active_alerts'], 3)
        self.assertEqual(data['whale_alerts'], 1)
        self.assertEqual(data['dark_flow_alerts'], 1)
        self.assertEqual(data['signal_alerts'], 1)
        self.assertEqual(data['order_flow_events'], 3)
        self.assertEqual(data['detection_rate'], 100.0)
        self.assertIsNotNone(data['last_triggered_at'])

    def test_runtime_read_endpoints_return_current_payloads(self):
        whale_response = self.client.get('/api/soc/signals/whale/')
        whale_recent_response = self.client.get('/api/soc/signals/whale/recent/')
        dark_response = self.client.get('/api/soc/signals/dark-pool/')
        dark_recent_response = self.client.get('/api/soc/signals/dark-pool/recent/')
        screener_response = self.client.get('/api/soc/signals/screener/')
        screener_recent_response = self.client.get('/api/soc/signals/screener/recent/')
        retention_response = self.client.get('/api/soc/signals/retention-policy/')
        performance_response = self.client.get('/api/soc/signals/performance-metrics/')
        ownership_response = self.client.get('/api/soc/signals/ownership/')

        self.assertEqual(whale_response.status_code, status.HTTP_200_OK)
        self.assertEqual(whale_recent_response.status_code, status.HTTP_200_OK)
        self.assertEqual(dark_response.status_code, status.HTTP_200_OK)
        self.assertEqual(dark_recent_response.status_code, status.HTTP_200_OK)
        self.assertEqual(screener_response.status_code, status.HTTP_200_OK)
        self.assertEqual(screener_recent_response.status_code, status.HTTP_200_OK)
        self.assertEqual(retention_response.status_code, status.HTTP_200_OK)
        self.assertEqual(performance_response.status_code, status.HTTP_200_OK)
        self.assertEqual(ownership_response.status_code, status.HTTP_200_OK)

        self.assertEqual(whale_response.json()['active_monitors'], 1)
        self.assertEqual(whale_recent_response.json()['total_today'], 1)
        self.assertEqual(dark_recent_response.json()['total_today'], 1)
        self.assertEqual(screener_response.json()['active_rules'], 1)
        self.assertEqual(screener_recent_response.json()['total_today'], 1)
        self.assertEqual(performance_response.json()['total_signals_processed'], 3)
        self.assertEqual(ownership_response.json()['mode'], 'bridge-write')

    def test_direct_apply_methods_on_config_route_are_blocked(self):
        post_response = self.client.post('/api/soc/signals/config/', {}, format='json')
        patch_response = self.client.patch('/api/soc/signals/config/', {}, format='json')
        delete_response = self.client.delete('/api/soc/signals/config/')

        self.assertEqual(post_response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(patch_response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(delete_response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_apply_alias_remains_blocked_for_bridge_write_even_with_db_override(self):
        OwnershipRecord.objects.update_or_create(
            domain='signals',
            defaults={
                'owner_team': 'signal_intelligence',
                'write_mode': 'bridge-write',
                'write_surface': 'signal_intelligence',
                'locked_fields': ['whale_threshold_vnd'],
                'compatibility_domains': ['admin_ops'],
            },
        )

        apply_response = self.client.post(
            '/api/soc/signals/config/apply/',
            {'config_payload': {'whale_threshold_vnd': 700000000}},
            format='json',
        )
        ownership_response = self.client.get('/api/soc/signals/ownership/')

        self.assertEqual(apply_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(apply_response.json()['code'], 'OWNERSHIP_WRITE_DENIED')
        self.assertIn('write_block_reason', apply_response.json())
        self.assertFalse(apply_response.json()['ownership']['can_apply'])
        self.assertEqual(ownership_response.status_code, status.HTTP_200_OK)
        self.assertFalse(ownership_response.json()['can_apply'])

    @patch('service_ops.views.signals.run_signals_detection_workflow.delay')
    def test_retention_materialization_universe_and_job_routes_return_contract(self, workflow_delay):
        workflow_delay.return_value = Mock(id='signals-task-123')

        retention_preview = self.client.post(
            '/api/soc/signals/retention-policy/preview/',
            {'config_payload': {'intraday_tick_retention_days': 7}},
            format='json',
        )
        materialization = self.client.get('/api/soc/signals/materialization/')
        materialization_preview = self.client.post(
            '/api/soc/signals/materialization/preview/',
            {'domain': 'whale', 'symbol': 'vci'},
            format='json',
        )
        universe = self.client.get('/api/soc/signals/universe/')
        universe_update = self.client.post(
            '/api/soc/signals/universe/update/',
            {'universe_group_ids': ['vn30']},
            format='json',
        )
        job_run = self.client.post('/api/soc/signals/jobs/run/', {'domain': 'whale', 'symbol': 'vci'}, format='json')
        job_status = self.client.get('/api/soc/signals/jobs/status/')

        self.assertEqual(retention_preview.status_code, status.HTTP_200_OK)
        self.assertTrue(retention_preview.json()['valid'])
        self.assertEqual(materialization.status_code, status.HTTP_200_OK)
        self.assertIn('services', materialization.json())
        self.assertIn('execution_plan', materialization.json())
        self.assertEqual(materialization_preview.status_code, status.HTTP_200_OK)
        self.assertEqual(materialization_preview.json()['symbol'], 'VCI')

        materialization_plan = {
            item['service_key']: item for item in materialization.json()['execution_plan']
        }
        preview_plan = {
            item['service_key']: item for item in materialization_preview.json()['execution_plan']
        }
        self.assertTrue(materialization_plan['signal_session_facts_materializer']['execution_supported'])
        self.assertTrue(materialization_plan['signal_session_facts_materializer']['will_run'])
        self.assertTrue(preview_plan['signal_session_facts_materializer']['execution_supported'])
        self.assertTrue(preview_plan['signal_session_facts_materializer']['will_run'])
        self.assertEqual(preview_plan['signal_session_facts_materializer']['symbol'], 'VCI')

        self.assertEqual(universe.status_code, status.HTTP_200_OK)
        self.assertEqual(universe_update.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(job_run.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(job_run.json()['celery_task_id'], 'signals-task-123')
        self.assertEqual(job_status.status_code, status.HTTP_200_OK)
        self.assertIn(job_status.json()['status'], {'idle', 'queued', 'running', 'success', 'partial', 'failed', 'skipped'})
        self.assertEqual(job_status.json()['celery_task_id'], 'signals-task-123')
        workflow_delay.assert_called_once()


class SignalsAuthenticationTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_unauthenticated_requests_return_401(self):
        get_response = self.client.get('/api/soc/signals/config/')
        preview_response = self.client.post('/api/soc/signals/config/preview/', {}, format='json')

        self.assertEqual(get_response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(preview_response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_non_admin_user_is_forbidden(self):
        user = User.objects.create_user(
            username='soc-signals-reader',
            email='soc-signals-reader@test.local',
            password='pass123',
        )
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.get('/api/soc/signals/config/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
