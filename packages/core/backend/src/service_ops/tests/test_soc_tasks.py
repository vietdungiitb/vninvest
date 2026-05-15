from types import SimpleNamespace
from unittest.mock import Mock, patch

import pandas as pd
from django.test import TestCase
from django.utils import timezone

from market_data.models import GlobalSymbolRegistry
from market_data.vnbroker_adapter import (
    fetch_daily_history,
    fetch_price_board_snapshot,
    fetch_realtime_price,
    fetch_listing_symbols,
    fetch_symbol_group_members,
)
from service_ops.matrix_coordinator import MatrixCoordinator, generate_cycle_id
from service_ops.models import ScrapeMatrixCell
from service_ops.models import ServiceConfig, ServiceHealth, ServiceRunLog
from service_ops.registry import SOC_DOMAIN_PRIMARY_SERVICE_KEYS, ensure_service_registry, get_registered_service
from service_ops.tasks import (
    create_signal_job_run_log,
    health_check_all_services,
    run_market_data_queue_tier_scheduler,
    run_scrape_cycle,
    run_signal_session_facts_materialization,
    scrape_cell_task,
    run_signal_unified_alert_materialization,
    run_signal_whale_materialization,
    run_signals_detection_workflow,
)


class ServiceOpsTasksTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        ensure_service_registry()

    def test_health_check_all_services_updates_service_health(self):
        result = health_check_all_services.run()

        self.assertGreater(result['checked_services'], 0)
        self.assertTrue(ServiceHealth.objects.exists())
        self.assertEqual(result['status_breakdown']['healthy'], ServiceHealth.objects.filter(status='healthy').count())

    @patch('service_ops.tasks.materialize_whale_feed_aggregate.run', return_value={'status': 'ok', 'created': 2})
    def test_whale_materialization_task_updates_run_log(self, whale_run):
        run_log = ServiceRunLog.objects.create(
            service=get_registered_service('signal_whale_canonical_pipeline'),
            status='queued',
            input_summary={'trigger': 'test'},
            output_summary={},
        )

        result = run_signal_whale_materialization.run(run_log_id=run_log.id, symbol='VCI')

        run_log.refresh_from_db()
        self.assertEqual(result['status'], 'ok')
        self.assertEqual(run_log.status, 'success')
        self.assertEqual(run_log.output_summary['created'], 2)
        whale_run.assert_called_once_with(symbol='VCI')

    @patch('service_ops.tasks.materialize_unified_alerts.run', return_value={'status': 'ok', 'synced': 5})
    def test_unified_alert_materialization_task_updates_run_log(self, unified_run):
        run_log = ServiceRunLog.objects.create(
            service=get_registered_service('signal_unified_alert_materializer'),
            status='queued',
            input_summary={'trigger': 'test'},
            output_summary={},
        )

        result = run_signal_unified_alert_materialization.run(run_log_id=run_log.id)

        run_log.refresh_from_db()
        self.assertEqual(result['synced'], 5)
        self.assertEqual(run_log.status, 'success')
        unified_run.assert_called_once_with()

    @patch('service_ops.tasks.materialize_session_facts.run', return_value={'status': 'ok', 'upserted': 3, 'requested_symbol': 'VCI'})
    def test_session_facts_materialization_task_updates_run_log(self, session_facts_run):
        run_log = ServiceRunLog.objects.create(
            service=get_registered_service('signal_session_facts_materializer'),
            status='queued',
            input_summary={'trigger': 'test'},
            output_summary={},
        )

        result = run_signal_session_facts_materialization.run(run_log_id=run_log.id, symbol='VCI')

        run_log.refresh_from_db()
        self.assertEqual(result['upserted'], 3)
        self.assertEqual(run_log.status, 'success')
        self.assertEqual(run_log.output_summary['requested_symbol'], 'VCI')
        session_facts_run.assert_called_once_with(symbol='VCI')

    @patch('service_ops.tasks.materialize_unified_alerts.run', return_value={'status': 'ok', 'synced': 4})
    @patch('service_ops.tasks.materialize_session_facts.run', return_value={'status': 'ok', 'upserted': 1, 'requested_symbol': 'VCI'})
    @patch('service_ops.tasks.materialize_whale_feed_aggregate.run', return_value={'status': 'ok', 'created': 1})
    def test_signals_detection_workflow_creates_tracked_child_runs(self, whale_run, session_facts_run, unified_run):
        parent_run_log = create_signal_job_run_log(requested_by='tester', domain='all', symbol='VCI')

        result = run_signals_detection_workflow.run(run_log_id=parent_run_log.id, domain='all', symbol='VCI')

        parent_run_log.refresh_from_db()
        child_runs = ServiceRunLog.objects.exclude(pk=parent_run_log.id).order_by('service__service_key')
        self.assertEqual(parent_run_log.status, 'success')
        self.assertEqual(len(result['scheduled_runs']), 3)
        self.assertEqual(child_runs.count(), 3)
        self.assertTrue(all(run.status == 'success' for run in child_runs))
        self.assertEqual(parent_run_log.output_summary['child_results'][0]['result']['status'], 'ok')
        whale_run.assert_called_once_with(symbol='VCI')
        session_facts_run.assert_called_once_with(symbol='VCI')
        unified_run.assert_called_once_with()

    def test_create_signal_job_run_log_uses_primary_signals_service(self):
        run_log = create_signal_job_run_log(requested_by='soc-admin', domain='whale', symbol='SSI')

        self.assertEqual(run_log.service.service_key, 'signal_whale_detector')
        self.assertEqual(run_log.input_summary['domain'], 'whale')
        self.assertEqual(run_log.input_summary['symbol'], 'SSI')

    @patch('service_ops.tasks.fetch_price_board_snapshot', return_value=[{'symbol': 'VCI'}, {'symbol': 'VNM'}])
    @patch('service_ops.tasks.fetch_symbol_group_members', return_value=['VCI', 'VNM', 'SSI'])
    def test_scrape_cell_task_claims_fetches_and_marks_done(self, group_members, price_board_snapshot):
        coordinator = MatrixCoordinator(generate_cycle_id(), providers=['vci'])
        matrix = coordinator.create_cycle(['vn30'])

        result = scrape_cell_task.run(
            cycle_id=matrix.cycle_id,
            symbol_group_id='vn30',
            provider='vci',
            worker_id='worker-1',
        )

        matrix.refresh_from_db()
        cell = ScrapeMatrixCell.objects.get(matrix=matrix, symbol_group_id='vn30', provider='vci')
        self.assertEqual(result['status'], 'done')
        self.assertEqual(result['symbols_processed'], 2)
        self.assertEqual(cell.status, 'done')
        self.assertEqual(matrix.done_rows, 1)
        group_members.assert_called_once_with('vn30', source='VCI')
        price_board_snapshot.assert_called_once_with(['VCI', 'VNM', 'SSI'], source='VCI')

    @patch('service_ops.tasks.fetch_price_board_snapshot', return_value=[{'symbol': 'VCI'}])
    @patch('service_ops.tasks.fetch_symbol_group_members', return_value=['VCI', 'VNM'])
    def test_scrape_cell_task_uses_provider_specific_snapshot_source(self, group_members, price_board_snapshot):
        coordinator = MatrixCoordinator(generate_cycle_id(), providers=['kbs'])
        matrix = coordinator.create_cycle(['vn30'])

        result = scrape_cell_task.run(
            cycle_id=matrix.cycle_id,
            symbol_group_id='vn30',
            provider='kbs',
            worker_id='worker-kbs',
        )

        self.assertEqual(result['status'], 'done')
        group_members.assert_called_once_with('vn30', source='KBS')
        price_board_snapshot.assert_called_once_with(['VCI', 'VNM'], source='KBS')

    def test_scrape_cell_task_skips_cell_when_row_already_done(self):
        coordinator = MatrixCoordinator(generate_cycle_id(), providers=['vci', 'kbs'])
        matrix = coordinator.create_cycle(['vn30'])
        coordinator.mark_cell_done('vn30', 'vci', symbols_processed=30)

        result = scrape_cell_task.run(
            cycle_id=matrix.cycle_id,
            symbol_group_id='vn30',
            provider='kbs',
            worker_id='worker-2',
        )

        self.assertEqual(result['status'], 'skipped')
        self.assertEqual(result['reason'], 'Row already done or claimed')

    @patch('service_ops.tasks.scrape_cell_task.delay')
    def test_run_scrape_cycle_dispatches_each_group_provider_cell(self, scrape_cell_delay):
        scrape_cell_delay.side_effect = [Mock(id='task-1'), Mock(id='task-2')]

        result = run_scrape_cycle.run(
            cycle_id='cycle_20260514_001',
            symbol_group_ids=['vn30'],
            providers=['vci', 'kbs'],
        )

        self.assertEqual(result['dispatched_cells'], 2)
        self.assertEqual(scrape_cell_delay.call_count, 2)

    @patch('service_ops.tasks.create_global_planner_run')
    def test_market_data_queue_tier_scheduler_dispatches_due_tiers_with_runtime_policy(self, planner_run_mock):
        GlobalSymbolRegistry.objects.bulk_create([
            GlobalSymbolRegistry(
                symbol='FPT',
                is_active=True,
                current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.HOT,
                priority_score=10.0,
                demand_source_count=2,
                freshness_state_summary='fresh',
                coverage_state_summary='ok',
            ),
            GlobalSymbolRegistry(
                symbol='AAA',
                is_active=True,
                current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.COLD,
                priority_score=1.0,
                demand_source_count=0,
                freshness_state_summary='stale',
                coverage_state_summary='missing',
            ),
        ])
        service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix'])
        ServiceConfig.objects.create(
            service=service,
            config_schema_version='1.0',
            config_payload={
                'hot_user_demand': {
                    'poll_interval_seconds': 30,
                    'max_batch_size': 1,
                },
                'recovery_backlog': {
                    'poll_interval_seconds': 60,
                    'max_batch_size': 5,
                },
            },
            applied_by='test',
        )
        planner_run_mock.side_effect = [
            {'run_id': 'md-run-hot', 'service_run_log_id': 11, 'status': 'queued'},
            {'run_id': 'md-run-recovery', 'service_run_log_id': 12, 'status': 'queued'},
        ]

        result = run_market_data_queue_tier_scheduler.run()

        self.assertEqual(result['dispatched_runs'], 2)
        self.assertEqual(planner_run_mock.call_count, 2)
        hot_call = planner_run_mock.call_args_list[0].kwargs
        self.assertEqual(hot_call['symbols'], ['FPT'])
        self.assertEqual(hot_call['planner_queue'], 'realtime_prefetch')
        self.assertEqual(hot_call['trigger'], 'market_data.queue_tier_scheduler')
        self.assertEqual(hot_call['extra_input_summary']['queue_tier'], 'hot_user_demand')
        recovery_call = planner_run_mock.call_args_list[1].kwargs
        self.assertEqual(recovery_call['symbols'], ['AAA'])
        self.assertEqual(recovery_call['planner_queue'], 'manual_on_demand')
        self.assertEqual(recovery_call['datasets'], ['daily_prices', 'price_board_snapshot', 'intraday_ticks', 'intraday_bars'])

    @patch('service_ops.tasks.create_global_planner_run')
    def test_market_data_queue_tier_scheduler_skips_recent_inflight_tier(self, planner_run_mock):
        GlobalSymbolRegistry.objects.create(
            symbol='HPG',
            is_active=True,
            current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.HOT,
            priority_score=8.0,
            demand_source_count=1,
            freshness_state_summary='fresh',
            coverage_state_summary='ok',
        )
        service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix'])
        run_log = ServiceRunLog.objects.create(
            service=service,
            status='running',
            input_summary={
                'trigger': 'market_data.queue_tier_scheduler',
                'queue_tier': 'hot_user_demand',
            },
            output_summary={},
        )
        ServiceRunLog.objects.filter(pk=run_log.id).update(started_at=timezone.now())

        result = run_market_data_queue_tier_scheduler.run()

        self.assertEqual(result['dispatched_runs'], 0)
        self.assertFalse(planner_run_mock.called)
        self.assertTrue(any(item['tier'] == 'hot_user_demand' and item['reason'] == 'inflight' for item in result['skipped_tiers']))


class VnbrokerAdapterTaskBridgeTestCase(TestCase):
    @patch('market_data.vnbroker_adapter.import_module')
    def test_fetch_realtime_price_uses_requested_source_quote_class(self, import_module_mock):
        quote_client = Mock()
        quote_client.history.return_value = pd.DataFrame([
            {'close': 12.3, 'open': 12.0, 'high': 12.5, 'low': 11.9, 'volume': 4567}
        ])
        quote_class = Mock(return_value=quote_client)
        import_module_mock.return_value = SimpleNamespace(Quote=quote_class)

        result = fetch_realtime_price('acb', source='KBS')

        import_module_mock.assert_called_once_with('vnbroker.explorer.kbs.quote')
        quote_class.assert_called_once_with(symbol='ACB')
        quote_client.history.assert_called_once()
        self.assertEqual(result['symbol'], 'ACB')
        self.assertEqual(result['source'], 'KBS')

    @patch('market_data.vnbroker_adapter.fetch_realtime_price')
    @patch('market_data.vnbroker_adapter.import_module')
    def test_fetch_price_board_snapshot_passes_explicit_source(self, import_module_mock, fetch_realtime_price_mock):
        import_module_mock.return_value = SimpleNamespace(Quote=Mock())
        fetch_realtime_price_mock.return_value = {
            'symbol': 'ACB',
            'close': 12.3,
            'volume': 4567,
            'fetched_at': '2026-05-14T00:00:00+00:00',
            'source': 'KBS',
        }

        result = fetch_price_board_snapshot(['ACB'], source='KBS')

        import_module_mock.assert_called_once_with('vnbroker.explorer.kbs.quote')
        fetch_realtime_price_mock.assert_called_once_with('ACB', source='KBS')
        self.assertEqual(result[0]['source'], 'KBS')

    @patch('market_data.vnbroker_adapter._load_listing_adapter_class')
    def test_fetch_listing_symbols_uses_requested_source_listing_adapter(self, load_listing_adapter_class_mock):
        listing_client = Mock()
        listing_client.all_symbols.return_value = pd.DataFrame([
            {'symbol': 'acb', 'organ_name': 'Ngân hàng ACB'},
            {'symbol': 'vnm', 'organ_name': 'Vinamilk'},
        ])
        listing_class = Mock(return_value=listing_client)
        load_listing_adapter_class_mock.return_value = listing_class

        result = fetch_listing_symbols(source='KBS')

        listing_class.assert_called_once_with(source='KBS')
        listing_client.all_symbols.assert_called_once_with()
        self.assertEqual(result[0]['symbol'], 'ACB')
        self.assertEqual(result[0]['company_name'], 'Ngân hàng ACB')
        self.assertEqual(result[0]['source'], 'KBS')

    @patch('market_data.vnbroker_adapter._load_listing_adapter_class')
    def test_fetch_symbol_group_members_uses_requested_source_group(self, load_listing_adapter_class_mock):
        listing_client = Mock()
        listing_client.symbols_by_group.return_value = pd.Series(['acb', 'bid'])
        listing_class = Mock(return_value=listing_client)
        load_listing_adapter_class_mock.return_value = listing_class

        result = fetch_symbol_group_members('vn30', source='KBS')

        listing_class.assert_called_once_with(source='KBS')
        listing_client.symbols_by_group.assert_called_once_with(group='VN30')
        self.assertEqual(result, ['ACB', 'BID'])

    @patch('market_data.vnbroker_adapter.import_module')
    def test_fetch_daily_history_uses_requested_source_quote_class(self, import_module_mock):
        quote_client = Mock()
        quote_client.history.return_value = pd.DataFrame([
            {'time': '2026-05-14', 'open': 12.0, 'high': 12.5, 'low': 11.8, 'close': 12.3, 'volume': 4567}
        ])
        quote_class = Mock(return_value=quote_client)
        import_module_mock.return_value = SimpleNamespace(Quote=quote_class)

        result = fetch_daily_history('acb', days=5, source='KBS')

        import_module_mock.assert_called_once_with('vnbroker.explorer.kbs.quote')
        quote_class.assert_called_once_with(symbol='ACB')
        quote_client.history.assert_called_once()
        self.assertEqual(result[0]['symbol'], 'ACB')
        self.assertEqual(result[0]['source'], 'KBS')