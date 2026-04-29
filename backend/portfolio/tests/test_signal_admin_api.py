from datetime import date, datetime, timedelta, timezone as datetime_timezone
from unittest.mock import MagicMock, patch

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from portfolio.global_signal_policy_helpers import get_global_signal_universe_policy
from portfolio.models import IntradayTick, OrderFlowSignal, SignalServiceRun, WhaleAlertEvent
from portfolio.services_global_whale_alerts import GLOBAL_WHALE_LATEST_EVENT_CACHE_PREFIX
from portfolio.tasks_order_flow import ORDER_FLOW_LATEST_SIGNAL_CACHE_PREFIX


class SignalAdminApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.staff = User.objects.create_user(username='signal-admin', password='Test@123456', is_staff=True)
        self.regular = User.objects.create_user(username='signal-user', password='Test@123456', is_staff=False)

    def _auth_staff(self):
        self.client.force_authenticate(user=self.staff)

    def _auth_regular(self):
        self.client.force_authenticate(user=self.regular)

    def test_summary_requires_staff(self):
        self._auth_regular()
        response = self.client.get('/api/admin-ops/signals/summary/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_summary_returns_whale_dark_flow_and_retention_structure(self):
        self._auth_staff()
        now = datetime.now(datetime_timezone.utc)

        WhaleAlertEvent.objects.create(
            event_id='whale:FPT:2026-04-28T09:15:00+00:00:BUY:700000000:redis_stream',
            symbol='FPT',
            side='BUY',
            matched_value_vnd=700_000_000,
            threshold_vnd=500_000_000,
            threshold_policy_version='threshold-v1',
            severity='urgent',
            event_score=8.4,
            confidence='high',
            source='redis_stream',
            source_layer='live',
            trade_date=date.today(),
            occurred_at=now,
            payload_json={'symbol': 'FPT', 'ts': now.isoformat()},
        )
        OrderFlowSignal.objects.create(
            symbol='VCB',
            signal_type=OrderFlowSignal.SignalType.ICEBERG,
            strength=74.0,
            confidence='high',
            tick_rate=3.0,
            small_order_ratio=0.3,
            cvd_at_signal=125.0,
            price_at_signal=100000,
            window_seconds=300,
            components_json={},
            event_id='dark_flow:VCB:2026-04-28T09:16:00+00:00:iceberg',
            severity=OrderFlowSignal.SeverityChoices.WARNING,
            trade_date=date.today(),
        )
        SignalServiceRun.objects.create(
            service_domain=SignalServiceRun.ServiceDomain.WHALE,
            run_type=SignalServiceRun.RunType.SCHEDULED,
            status=SignalServiceRun.StatusChoices.COMPLETED,
            processed_items=1,
            stored_items=1,
            started_at=now - timedelta(minutes=2),
            finished_at=now - timedelta(minutes=1),
        )
        SignalServiceRun.objects.create(
            service_domain=SignalServiceRun.ServiceDomain.DARK_FLOW,
            run_type=SignalServiceRun.RunType.SCHEDULED,
            status=SignalServiceRun.StatusChoices.FAILED,
            failed_items=1,
            started_at=now - timedelta(minutes=4),
            finished_at=now - timedelta(minutes=3),
        )
        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:30:00', '%H:%M:%S').time(),
            price=100000,
            volume=1000,
            side='BUY',
            stream_id='fpt-retention-1',
        )
        cache.set(f'{GLOBAL_WHALE_LATEST_EVENT_CACHE_PREFIX}:FPT', {'cached_at': now.isoformat(), 'ts': now.isoformat()}, timeout=60)
        cache.set(f'{ORDER_FLOW_LATEST_SIGNAL_CACHE_PREFIX}:VCB', {'cached_at': now.isoformat(), 'triggered_at': now.isoformat()}, timeout=60)

        response = self.client.get('/api/admin-ops/signals/summary/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['ok'])
        self.assertEqual(response.data['services']['whale']['recent_event_count_24h'], 1)
        self.assertEqual(response.data['services']['dark_flow']['total_event_count'], 1)
        self.assertIn('counts', response.data['universe'])
        self.assertIn('raw_intraday', response.data['retention'])

    def test_config_preview_normalizes_without_persisting(self):
        self._auth_staff()

        response = self.client.post(
            '/api/admin-ops/signals/config/preview/',
            {
                'services_config': {
                    'dark_flow_service': {
                        'warning_strength': 55,
                        'urgent_strength': 80,
                    },
                },
                'universe_policy': {
                    'admin_symbols': ['fpt'],
                },
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['preview']['services_config']['dark_flow_service']['warning_strength'], 55)
        self.assertEqual(response.data['preview']['universe_policy']['admin_symbols'], ['FPT'])
        self.assertEqual(get_global_signal_universe_policy().get('admin_symbols'), [])

    def test_universe_apply_requires_confirm_and_persists_policy(self):
        self._auth_staff()

        bad_response = self.client.post('/api/admin-ops/signals/universe/apply/', {'policy': {'admin_symbols': ['FPT']}}, format='json')
        self.assertEqual(bad_response.status_code, status.HTTP_400_BAD_REQUEST)

        response = self.client.post(
            '/api/admin-ops/signals/universe/apply/',
            {
                'confirm': True,
                'policy': {'admin_symbols': ['FPT']},
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['policy']['admin_symbols'], ['FPT'])
        self.assertEqual(get_global_signal_universe_policy()['admin_symbols'], ['FPT'])
        self.assertIn('FPT', response.data['preview']['effective_symbols'])

    @patch('portfolio.views_signal_admin.detect_and_store_global_whale_alerts')
    def test_jobs_run_queues_manual_whale_run_and_list_returns_it(self, mock_task):
        self._auth_staff()
        mock_task.apply_async.return_value = type('TaskResult', (), {'id': 'task-whale-1'})()

        run_response = self.client.post(
            '/api/admin-ops/signals/jobs/run/',
            {'service_domain': 'whale', 'symbol': 'FPT'},
            format='json',
        )

        self.assertEqual(run_response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(run_response.data['run']['status'], SignalServiceRun.StatusChoices.QUEUED)
        mock_task.apply_async.assert_called_once()

        list_response = self.client.get('/api/admin-ops/signals/jobs/?service_domain=whale')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data['count'], 1)
        self.assertEqual(list_response.data['results'][0]['task_id'], 'task-whale-1')

    @patch('portfolio.views_signal_admin.detect_and_store_order_flow')
    def test_job_retry_creates_new_queued_run(self, mock_task):
        self._auth_staff()
        source_run = SignalServiceRun.objects.create(
            service_domain=SignalServiceRun.ServiceDomain.DARK_FLOW,
            run_type=SignalServiceRun.RunType.MANUAL,
            status=SignalServiceRun.StatusChoices.FAILED,
            params_json={'symbol': 'VCB'},
        )
        mock_task.apply_async.return_value = type('TaskResult', (), {'id': 'task-dark-2'})()

        response = self.client.post(f'/api/admin-ops/signals/jobs/{source_run.id}/retry/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(SignalServiceRun.objects.count(), 2)
        retry_run = SignalServiceRun.objects.exclude(id=source_run.id).get()
        self.assertEqual(retry_run.status, SignalServiceRun.StatusChoices.QUEUED)
        self.assertEqual(retry_run.task_id, 'task-dark-2')

    def test_recent_events_and_retention_preview_return_expected_shapes(self):
        self._auth_staff()
        now = datetime.now(datetime_timezone.utc)
        WhaleAlertEvent.objects.create(
            event_id='whale:FPT:2026-04-28T09:15:00+00:00:BUY:700000000:redis_stream',
            symbol='FPT',
            side='BUY',
            matched_value_vnd=700_000_000,
            threshold_vnd=500_000_000,
            threshold_policy_version='threshold-v1',
            severity='urgent',
            event_score=8.4,
            confidence='high',
            source='redis_stream',
            source_layer='live',
            trade_date=date.today(),
            occurred_at=now,
            payload_json={'symbol': 'FPT', 'ts': now.isoformat()},
        )
        OrderFlowSignal.objects.create(
            symbol='VCB',
            signal_type=OrderFlowSignal.SignalType.ICEBERG,
            strength=74.0,
            confidence='high',
            tick_rate=3.0,
            small_order_ratio=0.3,
            cvd_at_signal=125.0,
            price_at_signal=100000,
            window_seconds=300,
            components_json={},
            event_id='dark_flow:VCB:2026-04-28T09:16:00+00:00:iceberg',
            severity=OrderFlowSignal.SeverityChoices.WARNING,
            trade_date=date.today(),
        )

        events_response = self.client.get('/api/admin-ops/signals/events/recent/?domain=all&limit=5')
        retention_response = self.client.post('/api/admin-ops/signals/retention/preview/', {}, format='json')

        self.assertEqual(events_response.status_code, status.HTTP_200_OK)
        self.assertEqual(events_response.data['count'], 2)
        self.assertEqual(retention_response.status_code, status.HTTP_200_OK)
        self.assertIn('policy', retention_response.data['preview'])
        self.assertIn('raw_intraday', retention_response.data['preview'])