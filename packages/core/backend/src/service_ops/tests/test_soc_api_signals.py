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

from service_ops.tests.envelope import unwrapped_json

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
        data = unwrapped_json(response)
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
        data = unwrapped_json(response)
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
        data = unwrapped_json(response)
        self.assertEqual(data['active_alerts'], 3)
        self.assertEqual(data['whale_alerts'], 1)
        self.assertEqual(data['dark_flow_alerts'], 1)
        self.assertEqual(data['signal_alerts'], 1)
        self.assertEqual(data['order_flow_events'], 3)
        self.assertEqual(data['detection_rate'], 100.0)
        self.assertIsNotNone(data['last_triggered_at'])

    def test_s6_summary_counts_system_and_ai(self):
        now = timezone.now()
        UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.SYSTEM,
            symbol='CMN',
            severity=UnifiedAlert.SeverityChoices.MEDIUM,
            title='Bang gia cham CMN',
            freshness_state='stale',
            session_date=now.date(),
            triggered_at=now,
            source_ref='signals-s6-system',
        )
        UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.AI_ALERT,
            symbol='VCI',
            severity=UnifiedAlert.SeverityChoices.HIGH,
            title='AI canh bao VCI',
            session_date=now.date(),
            triggered_at=now,
            source_ref='signals-s6-ai',
        )
        data = unwrapped_json(self.client.get('/api/soc/signals/summary/'))
        self.assertEqual(data['system_alerts'], 1)
        self.assertEqual(data['ai_alerts'], 1)
        self.assertEqual(
            data['active_alerts'],
            data['whale_alerts'] + data['dark_flow_alerts'] + data['signal_alerts']
            + data['system_alerts'] + data['ai_alerts'],
        )

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

        self.assertEqual(unwrapped_json(whale_response)['active_monitors'], 1)
        self.assertEqual(unwrapped_json(whale_recent_response)['total_today'], 1)
        self.assertEqual(unwrapped_json(dark_recent_response)['total_today'], 1)
        self.assertEqual(unwrapped_json(screener_response)['rules_seen_session'], 1)
        self.assertEqual(unwrapped_json(screener_recent_response)['total_today'], 1)
        self.assertEqual(unwrapped_json(performance_response)['total_signals_processed'], 3)
        self.assertEqual(unwrapped_json(ownership_response)['mode'], 'bridge-write')

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
        self.assertEqual(unwrapped_json(apply_response)['code'], 'OWNERSHIP_WRITE_DENIED')
        self.assertIn('write_block_reason', unwrapped_json(apply_response))
        self.assertFalse(unwrapped_json(apply_response)['ownership']['can_apply'])
        self.assertEqual(ownership_response.status_code, status.HTTP_200_OK)
        self.assertFalse(unwrapped_json(ownership_response)['can_apply'])

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
        self.assertTrue(unwrapped_json(retention_preview)['valid'])
        self.assertEqual(materialization.status_code, status.HTTP_200_OK)
        self.assertIn('services', unwrapped_json(materialization))
        self.assertIn('execution_plan', unwrapped_json(materialization))
        self.assertEqual(materialization_preview.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped_json(materialization_preview)['symbol'], 'VCI')

        materialization_plan = {
            item['service_key']: item for item in unwrapped_json(materialization)['execution_plan']
        }
        preview_plan = {
            item['service_key']: item for item in unwrapped_json(materialization_preview)['execution_plan']
        }
        self.assertTrue(materialization_plan['signal_session_facts_materializer']['execution_supported'])
        self.assertTrue(materialization_plan['signal_session_facts_materializer']['will_run'])
        self.assertTrue(preview_plan['signal_session_facts_materializer']['execution_supported'])
        self.assertTrue(preview_plan['signal_session_facts_materializer']['will_run'])
        self.assertEqual(preview_plan['signal_session_facts_materializer']['symbol'], 'VCI')

        self.assertEqual(universe.status_code, status.HTTP_200_OK)
        self.assertEqual(universe_update.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(job_run.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(unwrapped_json(job_run)['celery_task_id'], 'signals-task-123')
        self.assertEqual(job_status.status_code, status.HTTP_200_OK)
        self.assertIn(unwrapped_json(job_status)['status'], {'idle', 'queued', 'running', 'success', 'partial', 'failed', 'skipped'})
        self.assertEqual(unwrapped_json(job_status)['celery_task_id'], 'signals-task-123')
        workflow_delay.assert_called_once()


class SignalsP0ContractTestCase(SignalsApiBaseTestCase):
    """P0 Entry 100: recent envelope + sentiment + job status-by-id + domain whitelist."""

    def test_recent_envelope_has_p0_fields(self):
        for path in (
            '/api/soc/signals/whale/recent/',
            '/api/soc/signals/dark-pool/recent/',
            '/api/soc/signals/screener/recent/',
        ):
            response = self.client.get(path)
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            data = unwrapped_json(response)
            self.assertIn('recent', data)
            self.assertIn('total_today', data)
            self.assertGreaterEqual(len(data['recent']), 1)
            item = data['recent'][0]
            for field in ('id', 'symbol', 'severity', 'metadata', 'session_date', 'side', 'timestamp', 'title'):
                self.assertIn(field, item, f'{path} thiếu field {field}')

    def test_summary_and_performance_include_sentiment(self):
        summary = self.client.get('/api/soc/signals/summary/')
        performance = self.client.get('/api/soc/signals/performance-metrics/')
        self.assertEqual(summary.status_code, status.HTTP_200_OK)
        self.assertEqual(performance.status_code, status.HTTP_200_OK)
        for payload in (unwrapped_json(summary), unwrapped_json(performance)):
            self.assertIn('sentiment', payload)
            sentiment = payload['sentiment']
            self.assertEqual(set(sentiment.keys()), {'bullish', 'bearish', 'neutral'})
        # Fixture: VCI buy + VNM buy = 2 bullish, SSI sell = 1 bearish
        self.assertEqual(unwrapped_json(summary)['sentiment'], {'bullish': 2, 'bearish': 1, 'neutral': 0})

    @patch('service_ops.views.signals.run_signals_detection_workflow.delay')
    def test_job_status_respects_run_log_id(self, workflow_delay):
        workflow_delay.return_value = Mock(id='signals-p0-task')
        run_res = self.client.post(
            '/api/soc/signals/jobs/run/', {'domain': 'whale', 'symbol': 'VCI'}, format='json'
        )
        self.assertEqual(run_res.status_code, status.HTTP_202_ACCEPTED)
        run_log_id = unwrapped_json(run_res)['run_log_id']
        status_res = self.client.get(f'/api/soc/signals/jobs/status/?run_log_id={run_log_id}')
        self.assertEqual(status_res.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped_json(status_res)['run_log_id'], run_log_id)
        # run_log_id không hợp lệ → fallback latest, không 500
        fallback_res = self.client.get('/api/soc/signals/jobs/status/?run_log_id=999999')
        self.assertEqual(fallback_res.status_code, status.HTTP_200_OK)

    def test_job_run_rejects_unknown_domain(self):
        response = self.client.post(
            '/api/soc/signals/jobs/run/', {'domain': 'intruder', 'symbol': 'VCI'}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(unwrapped_json(response)['code'], 'INVALID_SIGNAL_DOMAIN')

    @patch('service_ops.views.signals.run_signals_detection_workflow.delay')
    def test_job_run_normalizes_dark_pool_to_dark_flow(self, workflow_delay):
        workflow_delay.return_value = Mock(id='signals-dark-task')
        response = self.client.post(
            '/api/soc/signals/jobs/run/', {'domain': 'dark_pool', 'symbol': 'SSI'}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(unwrapped_json(response)['domain'], 'dark_flow')
        _, kwargs = workflow_delay.call_args
        self.assertEqual(kwargs['domain'], 'dark_flow')

    def test_job_run_rejects_screener_with_manual_scan_hint(self):
        response = self.client.post(
            '/api/soc/signals/jobs/run/', {'domain': 'screener', 'symbol': 'VNM'}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(unwrapped_json(response)['code'], 'SCREENER_USE_MANUAL_SCAN')

    def test_materialization_preview_dark_pool_runs_unified_branch(self):
        response = self.client.post(
            '/api/soc/signals/materialization/preview/',
            {'domain': 'dark_pool', 'symbol': 'SSI'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        plan = {item['service_key']: item for item in unwrapped_json(response)['execution_plan']}
        self.assertTrue(plan['signal_unified_alert_materializer']['will_run'])


class SignalsP1PagingTestCase(SignalsApiBaseTestCase):
    """P1 W1.1: page/page_size + total_filtered + symbol/severity/direction."""

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        now = timezone.now()
        session_date = now.date()
        extra = [
            ('FPT', UnifiedAlert.SeverityChoices.HIGH, UnifiedAlert.DirectionChoices.BUY, 10),
            ('MWG', UnifiedAlert.SeverityChoices.LOW, UnifiedAlert.DirectionChoices.SELL, 12),
            ('VCB', UnifiedAlert.SeverityChoices.MEDIUM, UnifiedAlert.DirectionChoices.NEUTRAL, 14),
            ('HPG', UnifiedAlert.SeverityChoices.HIGH, UnifiedAlert.DirectionChoices.SELL, 16),
        ]
        for symbol, severity, direction, minutes_ago in extra:
            UnifiedAlert.objects.create(
                alert_type=UnifiedAlert.AlertTypeChoices.WHALE,
                symbol=symbol,
                severity=severity,
                title=f'Whale {symbol}',
                body='',
                value=Decimal('100000000.00'),
                direction=direction,
                session_date=session_date,
                triggered_at=now - timedelta(minutes=minutes_ago),
                source_ref=f'signals-paging-{symbol}',
                metadata={},
            )

    def test_default_paging_backward_compat(self):
        data = unwrapped_json(self.client.get('/api/soc/signals/whale/recent/'))
        self.assertEqual(data['page'], 1)
        self.assertEqual(data['page_size'], 20)
        self.assertEqual(data['total_today'], 5)
        self.assertEqual(data['total_filtered'], 5)
        self.assertEqual(len(data['recent']), 5)

    def test_page_two_returns_remaining(self):
        data = unwrapped_json(self.client.get('/api/soc/signals/whale/recent/?page=2&page_size=2'))
        self.assertEqual(data['page'], 2)
        self.assertEqual(len(data['recent']), 2)
        self.assertEqual(data['total_filtered'], 5)
        self.assertEqual(data['total_today'], 5)

    def test_page_size_clamped_to_max(self):
        data = unwrapped_json(self.client.get('/api/soc/signals/whale/recent/?page_size=500'))
        self.assertEqual(data['page_size'], 100)

    def test_symbol_filter(self):
        data = unwrapped_json(self.client.get('/api/soc/signals/whale/recent/?symbol=fpt'))
        self.assertEqual(data['total_filtered'], 1)
        self.assertEqual(data['total_today'], 5)
        self.assertEqual(data['recent'][0]['symbol'], 'FPT')

    def test_severity_and_direction_filters(self):
        high = unwrapped_json(self.client.get('/api/soc/signals/whale/recent/?severity=high'))
        self.assertEqual(high['total_filtered'], 3)
        sell = unwrapped_json(self.client.get('/api/soc/signals/whale/recent/?direction=sell'))
        self.assertEqual(sell['total_filtered'], 2)
        combo = unwrapped_json(self.client.get('/api/soc/signals/whale/recent/?severity=high&direction=sell'))
        self.assertEqual(combo['total_filtered'], 1)
        self.assertEqual(combo['recent'][0]['symbol'], 'HPG')

    def test_invalid_filter_values_ignored(self):
        data = unwrapped_json(self.client.get('/api/soc/signals/whale/recent/?severity=bogus&direction=bogus'))
        self.assertEqual(data['total_filtered'], 5)


class SignalsP2AHonestMetricsTestCase(SignalsApiBaseTestCase):
    """P2a W2.4: số liệu trung thực — null thay vì số giả, last_scan từ run log."""

    def test_accuracy_and_fpr_are_null_until_ack_data_exists(self):
        performance = unwrapped_json(self.client.get('/api/soc/signals/performance-metrics/'))
        self.assertIsNone(performance['whale_detection_accuracy'])
        self.assertIsNone(performance['dark_pool_detection_accuracy'])
        self.assertIsNone(performance['false_positive_rate'])
        summary = unwrapped_json(self.client.get('/api/soc/signals/summary/'))
        self.assertIsNone(summary['false_positive_rate'])
        # số liệu thật vẫn còn
        self.assertEqual(performance['total_signals_processed'], 3)
        self.assertEqual(summary['detection_rate'], 100.0)

    def test_last_scan_at_none_without_run_log(self):
        self.assertIsNone(unwrapped_json(self.client.get('/api/soc/signals/whale/'))['last_scan_at'])
        self.assertIsNone(unwrapped_json(self.client.get('/api/soc/signals/dark-pool/'))['last_scan_at'])

    @patch('service_ops.views.signals.run_signals_detection_workflow.delay')
    def test_last_scan_at_follows_latest_run_log(self, workflow_delay):
        workflow_delay.return_value = Mock(id='signals-honest-task')
        self.client.post('/api/soc/signals/jobs/run/', {'domain': 'whale', 'symbol': 'VCI'}, format='json')
        self.assertIsNotNone(unwrapped_json(self.client.get('/api/soc/signals/whale/'))['last_scan_at'])
        self.assertIsNotNone(unwrapped_json(self.client.get('/api/soc/signals/dark-pool/'))['last_scan_at'])

    def test_dark_pool_drops_fake_min_signal_count(self):
        payload = unwrapped_json(self.client.get('/api/soc/signals/dark-pool/'))
        self.assertNotIn('min_signal_count', payload)
        self.assertIn('threshold_vnd', payload)

    def test_screener_reports_rules_seen_session(self):
        payload = unwrapped_json(self.client.get('/api/soc/signals/screener/'))
        self.assertEqual(payload['rules_seen_session'], 1)
        self.assertNotIn('active_rules', payload)

    def test_whale_test_endpoint_labels_smoke(self):
        payload = unwrapped_json(self.client.post('/api/soc/signals/whale/test/', {'symbol': 'VNM'}, format='json'))
        self.assertTrue(payload['smoke'])
        self.assertIn('note', payload)

    def test_feed_export_returns_columns_rows_and_count(self):
        payload = unwrapped_json(self.client.get('/api/soc/signals/feed/export/'))
        self.assertEqual(
            payload['columns'],
            ['id', 'symbol', 'type', 'severity', 'direction', 'session_date', 'triggered_at', 'value', 'title'],
        )
        self.assertEqual(payload['count'], 3)
        self.assertFalse(payload['truncated'])
        self.assertEqual(len(payload['rows']), 3)
        symbols = {row[1] for row in payload['rows']}
        self.assertEqual(symbols, {'VCI', 'SSI', 'VNM'})

    def test_feed_export_filters_by_type_and_symbol(self):
        whale = unwrapped_json(self.client.get('/api/soc/signals/feed/export/?type=whale'))
        self.assertEqual(whale['count'], 1)
        self.assertEqual(whale['rows'][0][1], 'VCI')
        symbol = unwrapped_json(self.client.get('/api/soc/signals/feed/export/?symbol=ssi'))
        self.assertEqual(symbol['count'], 1)
        self.assertEqual(symbol['rows'][0][1], 'SSI')


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
