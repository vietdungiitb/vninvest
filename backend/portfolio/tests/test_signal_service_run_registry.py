from unittest.mock import MagicMock, patch

from django.test import TestCase, override_settings

from portfolio.models import SignalServiceRun
from portfolio.tasks_order_flow import detect_and_store_order_flow
from portfolio.tasks_whale_service import detect_and_store_global_whale_alerts


class SignalServiceRunRegistryTests(TestCase):
    @patch('portfolio.tasks_order_flow.distribute_order_flow_signal')
    @patch('portfolio.tasks_order_flow._persist_order_flow_signal')
    @patch('portfolio.order_flow.detect_dark_flow')
    def test_detect_and_store_order_flow_creates_completed_signal_service_run(self, mock_detect_dark_flow, mock_persist_signal, mock_distribute_task):
        mock_detect_dark_flow.return_value = {
            'signal_type': 'iceberg',
            'strength': 72.0,
            'confidence': 'high',
            'components': {},
            'triggered_at': '2026-04-28T09:15:00+00:00',
        }
        mock_persist_signal.return_value = {
            'persisted': True,
            'created': True,
            'signal_id': 17,
            'strength': 72.0,
            'triggered_at': '2026-04-28T09:15:00+00:00',
        }
        mock_distribute_task.delay = MagicMock()

        result = detect_and_store_order_flow.run(symbol='FPT')

        self.assertIn('run_id', result)
        run = SignalServiceRun.objects.get(id=result['run_id'])
        self.assertEqual(run.service_domain, SignalServiceRun.ServiceDomain.DARK_FLOW)
        self.assertEqual(run.run_type, SignalServiceRun.RunType.MANUAL)
        self.assertEqual(run.status, SignalServiceRun.StatusChoices.COMPLETED)
        self.assertEqual(run.processed_items, 1)
        self.assertEqual(run.stored_items, 1)
        self.assertEqual(run.failed_items, 0)
        mock_distribute_task.delay.assert_called_once_with(signal_id=17, triggered_at='2026-04-28T09:15:00+00:00')

    @patch('portfolio.tasks_whale_service.distribute_whale_alert_event')
    @patch('portfolio.tasks_whale_service.run_global_whale_alert_detection')
    def test_detect_and_store_global_whale_alerts_creates_completed_signal_service_run(self, mock_run_detection, mock_distribute_task):
        mock_run_detection.return_value = {
            'status': 'ok',
            'symbols': 1,
            'processed': 1,
            'created': 1,
            'updated': 0,
            'cached': 1,
            'skipped_locked': 0,
            'errors': 0,
            'created_event_ids': [33],
        }
        mock_distribute_task.delay = MagicMock()

        result = detect_and_store_global_whale_alerts.run(symbol='VCB')

        self.assertIn('run_id', result)
        run = SignalServiceRun.objects.get(id=result['run_id'])
        self.assertEqual(run.service_domain, SignalServiceRun.ServiceDomain.WHALE)
        self.assertEqual(run.run_type, SignalServiceRun.RunType.MANUAL)
        self.assertEqual(run.status, SignalServiceRun.StatusChoices.COMPLETED)
        self.assertEqual(run.processed_items, 1)
        self.assertEqual(run.stored_items, 1)
        self.assertEqual(run.failed_items, 0)
        mock_distribute_task.delay.assert_called_once_with(33)

    @override_settings(ORDER_FLOW_DETECTION_ENABLED=False)
    def test_detect_and_store_order_flow_marks_disabled_run_complete(self):
        result = detect_and_store_order_flow.run(symbol='FPT')

        self.assertEqual(result['status'], 'disabled')
        run = SignalServiceRun.objects.get(id=result['run_id'])
        self.assertEqual(run.service_domain, SignalServiceRun.ServiceDomain.DARK_FLOW)
        self.assertEqual(run.status, SignalServiceRun.StatusChoices.COMPLETED)
        self.assertIn('disabled', run.log.lower())