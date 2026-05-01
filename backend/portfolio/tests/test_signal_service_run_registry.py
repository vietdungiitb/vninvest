from unittest.mock import MagicMock, patch

from django.test import TestCase, override_settings
from django.utils import timezone

from portfolio.models import SignalServiceRun
from portfolio.tasks_maintenance import cleanup_old_signal_service_runs
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

    @override_settings(SIGNAL_SERVICE_RUN_KEEP_DAYS=30)
    def test_cleanup_old_signal_service_runs_deletes_only_old_terminal_runs(self):
        now = timezone.now()
        old_terminal_run_ids = []
        active_run_ids = []

        for status in [
            SignalServiceRun.StatusChoices.COMPLETED,
            SignalServiceRun.StatusChoices.FAILED,
            SignalServiceRun.StatusChoices.PARTIAL,
        ]:
            run = SignalServiceRun.objects.create(
                service_domain=SignalServiceRun.ServiceDomain.WHALE,
                run_type=SignalServiceRun.RunType.SCHEDULED,
                status=status,
            )
            old_terminal_run_ids.append(run.id)

        for status in [
            SignalServiceRun.StatusChoices.QUEUED,
            SignalServiceRun.StatusChoices.RUNNING,
        ]:
            run = SignalServiceRun.objects.create(
                service_domain=SignalServiceRun.ServiceDomain.DARK_FLOW,
                run_type=SignalServiceRun.RunType.MANUAL,
                status=status,
            )
            active_run_ids.append(run.id)

        recent_terminal_run = SignalServiceRun.objects.create(
            service_domain=SignalServiceRun.ServiceDomain.DARK_FLOW,
            run_type=SignalServiceRun.RunType.RETENTION_PREVIEW,
            status=SignalServiceRun.StatusChoices.COMPLETED,
        )

        old_created_at = now - timezone.timedelta(days=45)
        recent_created_at = now - timezone.timedelta(days=7)
        SignalServiceRun.objects.filter(id__in=old_terminal_run_ids + active_run_ids).update(
            created_at=old_created_at,
            updated_at=old_created_at,
        )
        SignalServiceRun.objects.filter(id=recent_terminal_run.id).update(
            created_at=recent_created_at,
            updated_at=recent_created_at,
        )

        result = cleanup_old_signal_service_runs.run()

        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['keep_days'], 30)
        self.assertEqual(result['deleted'], 3)
        remaining = list(SignalServiceRun.objects.order_by('id').values_list('status', flat=True))
        self.assertCountEqual(
            remaining,
            [
                SignalServiceRun.StatusChoices.QUEUED,
                SignalServiceRun.StatusChoices.RUNNING,
                SignalServiceRun.StatusChoices.COMPLETED,
            ],
        )