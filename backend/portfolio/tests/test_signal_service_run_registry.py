from datetime import date, time
from unittest.mock import MagicMock, patch

from django.test import TestCase, override_settings
from django.utils import timezone

from portfolio.global_signal_policy_helpers import get_global_signal_retention_policy
from portfolio.models import IntradayTick, MoneyFlowForensicWindow, OrderFlowSignal, SignalServiceRun, WhaleAlertEvent
from portfolio.services_money_flow_retention import (
    materialize_money_flow_forensic_window_from_order_flow_signal,
    materialize_money_flow_forensic_window_from_whale_event,
)
from portfolio.services_signal_run_registry import create_signal_service_run, finish_signal_service_run
from portfolio.tasks_global_screener import run_global_screener_scheduled_task
from portfolio.tasks_maintenance import cleanup_old_intraday_ticks, cleanup_old_signal_service_runs, run_intraday_side_backfill_apply
from portfolio.tasks_order_flow import detect_and_store_order_flow
from portfolio.tasks_whale_service import detect_and_store_global_whale_alerts


class SignalServiceRunRegistryTests(TestCase):
    @patch('portfolio.tasks_global_screener.auto_generate_advisories_for_all_tracked.apply_async')
    @patch('portfolio.tasks_global_screener._broadcast_screener_matched')
    @patch('portfolio.tasks_global_screener.GlobalScreenerService.match_active_rules')
    @patch('portfolio.tasks_global_screener.GlobalScreenerService.precompute_market_snapshot')
    def test_run_global_screener_scheduled_task_creates_lifecycle_materialization_run(
        self,
        mock_precompute_market_snapshot,
        mock_match_active_rules,
        mock_broadcast_screener_matched,
        mock_apply_async,
    ):
        mock_precompute_market_snapshot.return_value = {
            'generated_at': '2026-04-28T09:00:00+00:00',
            'symbol_count': 1,
        }
        mock_match_active_rules.return_value = ['FPT']
        mock_broadcast_screener_matched.return_value = {
            'history_count': 1,
            'broadcast_count': 1,
            'audience_count': 1,
        }
        mock_apply_async.return_value = MagicMock()

        result = run_global_screener_scheduled_task.run()

        self.assertEqual(result['status'], 'ok')
        run = SignalServiceRun.objects.get(
            service_domain=SignalServiceRun.ServiceDomain.LIFECYCLE,
            run_type=SignalServiceRun.RunType.MATERIALIZATION,
        )
        self.assertEqual(run.status, SignalServiceRun.StatusChoices.COMPLETED)
        self.assertEqual(run.processed_items, 1)
        self.assertEqual(run.stored_items, 1)
        self.assertIn('symbol_count=1', run.log)

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

    def test_materialize_money_flow_forensic_window_from_order_flow_signal_stores_raw_tick_snapshot(self):
        source_timestamp = timezone.localtime(timezone.now()).replace(hour=9, minute=15, second=0, microsecond=0)
        local_timestamp = timezone.localtime(source_timestamp)
        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=local_timestamp.date(),
            trade_time=(local_timestamp - timezone.timedelta(minutes=5)).time(),
            price=10000,
            volume=1000,
            side=IntradayTick.Side.BUY,
        )
        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=local_timestamp.date(),
            trade_time=(local_timestamp + timezone.timedelta(minutes=5)).time(),
            price=10050,
            volume=1200,
            side=IntradayTick.Side.SELL,
        )
        signal = OrderFlowSignal.objects.create(
            symbol='FPT',
            signal_type=OrderFlowSignal.SignalType.ICEBERG,
            strength=88.0,
            confidence='high',
            tick_rate=24,
            small_order_ratio=0.42,
            cvd_at_signal=120.0,
            price_at_signal=10025,
            window_seconds=300,
            components_json={'absorption': {'cvd_change': 120.0}},
            severity=OrderFlowSignal.SeverityChoices.URGENT,
            event_id='dark_flow:FPT:2026-04-28T09:15:00+00:00:iceberg',
        )
        OrderFlowSignal.objects.filter(id=signal.id).update(created_at=source_timestamp)
        signal.refresh_from_db()

        result = materialize_money_flow_forensic_window_from_order_flow_signal(signal, policy=get_global_signal_retention_policy())

        self.assertTrue(result['created'])
        window = MoneyFlowForensicWindow.objects.get(id=result['window_id'])
        self.assertEqual(window.domain, MoneyFlowForensicWindow.DomainChoices.DARK_FLOW)
        self.assertEqual(window.storage_mode, 'physical_carve_out')
        self.assertEqual(window.target_tier, 'L5')
        self.assertGreaterEqual(window.window_payload_json['raw_tick_count'], 1)
        self.assertTrue(window.window_payload_json['raw_tick_rows'])

    def test_materialize_money_flow_forensic_window_from_whale_event_stores_raw_tick_snapshot(self):
        source_timestamp = timezone.localtime(timezone.now()).replace(hour=10, minute=5, second=0, microsecond=0)
        local_timestamp = timezone.localtime(source_timestamp)
        IntradayTick.objects.create(
            symbol='VCB',
            trade_date=local_timestamp.date(),
            trade_time=(local_timestamp - timezone.timedelta(minutes=3)).time(),
            price=22000,
            volume=1500,
            side=IntradayTick.Side.BUY,
        )
        event = WhaleAlertEvent.objects.create(
            event_id='whale:VCB:2026-04-28T10:05:00+00:00',
            symbol='VCB',
            side=WhaleAlertEvent.SideChoices.BUY,
            matched_value_vnd=1_500_000_000,
            threshold_vnd=1_000_000_000,
            severity=WhaleAlertEvent.SeverityChoices.WARNING,
            source='whale_alerts',
            source_layer='primary',
            trade_date=local_timestamp.date(),
            occurred_at=source_timestamp,
            payload_json={'source': 'unit_test'},
        )

        result = materialize_money_flow_forensic_window_from_whale_event(event, policy=get_global_signal_retention_policy())

        self.assertTrue(result['created'])
        window = MoneyFlowForensicWindow.objects.get(id=result['window_id'])
        self.assertEqual(window.domain, MoneyFlowForensicWindow.DomainChoices.WHALE)
        self.assertEqual(window.symbol, 'VCB')
        self.assertEqual(window.storage_mode, 'physical_carve_out')
        self.assertGreaterEqual(window.window_payload_json['raw_tick_count'], 1)

    @override_settings(ORDER_FLOW_DETECTION_ENABLED=False)
    def test_detect_and_store_order_flow_marks_disabled_run_complete(self):
        result = detect_and_store_order_flow.run(symbol='FPT')

        self.assertEqual(result['status'], 'disabled')
        run = SignalServiceRun.objects.get(id=result['run_id'])
        self.assertEqual(run.service_domain, SignalServiceRun.ServiceDomain.DARK_FLOW)
        self.assertEqual(run.status, SignalServiceRun.StatusChoices.COMPLETED)
        self.assertIn('disabled', run.log.lower())

    @patch('portfolio.services_backfill.intraday_side_backfill_apply')
    @patch('portfolio.services_whale_analytics_snapshot.invalidate_whale_analytics_snapshot_cache')
    def test_run_intraday_side_backfill_apply_creates_recompute_run(self, mock_invalidate, mock_apply):
        mock_apply.return_value = {
            'scope_rows': 2,
            'updated': 1,
            'duration_seconds': 0.2,
            'symbols_touched': ['FPT'],
            'transitions': {'UNKNOWN->BUY': 1},
        }
        mock_invalidate.return_value = ['FPT']

        result = run_intraday_side_backfill_apply.run(symbols=['FPT'], start_date='2026-04-28', end_date='2026-04-28')

        self.assertEqual(result['updated'], 1)
        run = SignalServiceRun.objects.get(
            service_domain=SignalServiceRun.ServiceDomain.LIFECYCLE,
            run_type=SignalServiceRun.RunType.RECOMPUTE,
        )
        self.assertEqual(run.status, SignalServiceRun.StatusChoices.COMPLETED)
        self.assertEqual(run.processed_items, 2)
        self.assertEqual(run.stored_items, 1)
        self.assertIn('updated=1', run.log)

    @patch('portfolio.runtime_policy_helpers._get_runtime_prefetch_settings')
    def test_cleanup_old_intraday_ticks_creates_purge_run(self, mock_runtime_settings):
        mock_runtime_settings.return_value = {
            'intraday_tick_auto_cleanup_enabled': True,
            'intraday_tick_keep_days': 30,
        }
        preview_run = create_signal_service_run(
            service_domain=SignalServiceRun.ServiceDomain.LIFECYCLE,
            run_type=SignalServiceRun.RunType.RETENTION_PREVIEW,
            params_json={'retention_policy': get_global_signal_retention_policy()},
        )
        finish_signal_service_run(
            preview_run,
            status=SignalServiceRun.StatusChoices.COMPLETED,
            processed_items=3,
            stored_items=0,
            failed_items=0,
            progress_pct=100.0,
            log='retention preview ready',
        )
        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today() - timezone.timedelta(days=45),
            trade_time=time(9, 30),
            price=10000,
            volume=1000,
            side=IntradayTick.Side.UNKNOWN,
        )
        MoneyFlowForensicWindow.objects.create(
            domain=MoneyFlowForensicWindow.DomainChoices.DARK_FLOW,
            source_model='OrderFlowSignal',
            source_id='dark_flow:FPT:expired',
            symbol='FPT',
            severity=OrderFlowSignal.SeverityChoices.WARNING,
            source_timestamp=timezone.now() - timezone.timedelta(days=120),
            window_start=timezone.now() - timezone.timedelta(days=120),
            window_end=timezone.now() - timezone.timedelta(days=120),
            expires_at=timezone.now() - timezone.timedelta(days=1),
            storage_mode='physical_carve_out',
            target_tier='L5',
            reason='unit_test',
            source_payload_json={},
            window_payload_json={},
        )

        result = cleanup_old_intraday_ticks.run()

        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['deleted'], 1)
        self.assertEqual(result['forensic_windows_deleted'], 1)
        run = SignalServiceRun.objects.get(
            service_domain=SignalServiceRun.ServiceDomain.LIFECYCLE,
            run_type=SignalServiceRun.RunType.PURGE,
        )
        self.assertEqual(run.status, SignalServiceRun.StatusChoices.COMPLETED)
        self.assertIn('deleted=1', run.log)
        self.assertIn('forensic_deleted=1', run.log)

    @patch('portfolio.runtime_policy_helpers._get_runtime_prefetch_settings')
    def test_cleanup_old_intraday_ticks_blocks_without_retention_preview(self, mock_runtime_settings):
        mock_runtime_settings.return_value = {
            'intraday_tick_auto_cleanup_enabled': True,
            'intraday_tick_keep_days': 30,
        }
        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today() - timezone.timedelta(days=45),
            trade_time=time(9, 30),
            price=10000,
            volume=1000,
            side=IntradayTick.Side.UNKNOWN,
        )

        result = cleanup_old_intraday_ticks.run()

        self.assertEqual(result['status'], 'blocked')
        self.assertEqual(result['deleted'], 0)
        self.assertIn('safety_gate', result)
        self.assertIn('preview_missing', result['safety_gate']['blocked_reasons'])
        run = SignalServiceRun.objects.get(
            service_domain=SignalServiceRun.ServiceDomain.LIFECYCLE,
            run_type=SignalServiceRun.RunType.PURGE,
        )
        self.assertEqual(run.status, SignalServiceRun.StatusChoices.PARTIAL)
        self.assertIn('preview_missing', run.log)

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
        purge_run = SignalServiceRun.objects.get(
            service_domain=SignalServiceRun.ServiceDomain.LIFECYCLE,
            run_type=SignalServiceRun.RunType.PURGE,
        )
        self.assertEqual(purge_run.status, SignalServiceRun.StatusChoices.COMPLETED)
        remaining = list(SignalServiceRun.objects.order_by('id').values_list('status', flat=True))
        self.assertCountEqual(
            remaining,
            [
                SignalServiceRun.StatusChoices.QUEUED,
                SignalServiceRun.StatusChoices.RUNNING,
                SignalServiceRun.StatusChoices.COMPLETED,
                SignalServiceRun.StatusChoices.COMPLETED,
            ],
        )
