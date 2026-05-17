from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import Mock, patch

import pandas as pd
from django.test import TestCase
from django.utils import timezone

from data_ingest.models import IngestJob, IngestRun
from market_data.models import GlobalSymbolCoverage, GlobalSymbolDemandSource, GlobalSymbolRegistry
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
from service_ops.models import MarketDataParitySnapshot
from service_ops.registry import SOC_DOMAIN_PRIMARY_SERVICE_KEYS, ensure_service_registry, get_registered_service
from service_ops.tasks import (
    cleanup_market_data_parity_snapshots_task,
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

    @patch('service_ops.dataops_market_data.fetch_listing_symbols')
    @patch('service_ops.dataops_market_data.fetch_symbol_group_members')
    @patch('service_ops.tasks.create_global_planner_run')
    def test_market_data_queue_tier_scheduler_bootstraps_system_defaults_when_registry_empty(self, planner_run_mock, fetch_symbol_group_members_mock, fetch_listing_symbols_mock):
        service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix'])
        ServiceConfig.objects.create(
            service=service,
            config_schema_version='1.0',
            config_payload={
                'cold_full_market': {
                    'poll_interval_seconds': 120,
                    'max_batch_size': 3,
                },
            },
            applied_by='test',
        )
        fetch_symbol_group_members_mock.side_effect = [
            ['FPT', 'HPG'],
            ['FPT', 'HPG', 'TPB'],
        ]
        fetch_listing_symbols_mock.side_effect = [
            [
                {'symbol': 'FPT'},
                {'symbol': 'HPG'},
                {'symbol': 'TPB'},
                {'symbol': 'VCB'},
            ],
            [{'symbol': 'FPT'}],
            [{'symbol': 'FPT'}],
        ]
        planner_run_mock.return_value = {
            'run_id': 'md-run-cold',
            'service_run_log_id': 11,
            'status': 'queued',
        }

        result = run_market_data_queue_tier_scheduler.run()

        self.assertTrue(result['bootstrap']['bootstrapped'])
        self.assertEqual(result['bootstrap']['active_symbols'], 4)
        self.assertEqual(GlobalSymbolRegistry.objects.filter(is_active=True).count(), 4)
        self.assertTrue(
            GlobalSymbolDemandSource.objects.filter(
                source_type=GlobalSymbolDemandSource.SourceTypeChoices.SYSTEM_DEFAULT,
                source_ref='system_default:vn30',
                is_active=True,
            ).exists()
        )
        self.assertTrue(
            GlobalSymbolDemandSource.objects.filter(
                source_type=GlobalSymbolDemandSource.SourceTypeChoices.SYSTEM_DEFAULT,
                source_ref='system_default:vn100',
                is_active=True,
            ).exists()
        )
        self.assertTrue(
            GlobalSymbolDemandSource.objects.filter(
                source_type=GlobalSymbolDemandSource.SourceTypeChoices.SYSTEM_DEFAULT,
                source_ref='system_default:listed_market',
                is_active=True,
            ).exists()
        )
        planner_run_mock.assert_called_once()
        warm_call = planner_run_mock.call_args.kwargs
        self.assertEqual(warm_call['symbols'], ['FPT', 'HPG', 'TPB', 'VCB'])
        self.assertEqual(warm_call['datasets'], ['daily_prices', 'price_board_snapshot', 'session_facts'])
        self.assertEqual(warm_call['planner_queue'], 'realtime_prefetch')

    @patch('service_ops.dataops_market_data.fetch_listing_symbols')
    @patch('service_ops.dataops_market_data.fetch_symbol_group_members')
    @patch('service_ops.tasks.create_global_planner_run')
    def test_market_data_queue_tier_scheduler_backfills_listing_baseline_when_registry_non_empty(self, planner_run_mock, fetch_symbol_group_members_mock, fetch_listing_symbols_mock):
        registry, _ = GlobalSymbolDemandSource.objects.get_or_create(
            registry=GlobalSymbolRegistry.objects.create(
                symbol='FPT',
                is_active=True,
                current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.WARM,
                priority_score=0.5,
                demand_source_count=1,
                freshness_state_summary='unknown',
                coverage_state_summary='unknown',
            ),
            source_type=GlobalSymbolDemandSource.SourceTypeChoices.SYSTEM_DEFAULT,
            source_ref='system_default:vn30',
            defaults={'is_active': True, 'weight': 0.5},
        )
        service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix'])
        ServiceConfig.objects.create(
            service=service,
            config_schema_version='1.0',
            config_payload={
                'warm_liquid_market': {
                    'poll_interval_seconds': 120,
                    'max_batch_size': 10,
                },
            },
            applied_by='test',
        )
        fetch_listing_symbols_mock.side_effect = [
            [
                {'symbol': 'FPT'},
                {'symbol': 'HPG'},
                {'symbol': 'TPB'},
                {'symbol': 'VCB'},
            ],
            [{'symbol': 'FPT'}],
            [{'symbol': 'FPT'}],
        ]
        planner_run_mock.return_value = {
            'run_id': 'md-run-warm',
            'service_run_log_id': 21,
            'status': 'queued',
        }

        result = run_market_data_queue_tier_scheduler.run()

        self.assertTrue(result['bootstrap']['bootstrapped'])
        self.assertEqual(result['bootstrap']['active_symbols'], 4)
        self.assertEqual(GlobalSymbolRegistry.objects.filter(is_active=True).count(), 4)
        self.assertTrue(
            GlobalSymbolDemandSource.objects.filter(
                source_type=GlobalSymbolDemandSource.SourceTypeChoices.SYSTEM_DEFAULT,
                source_ref='system_default:listed_market',
                is_active=True,
            ).exists()
        )
        fetch_symbol_group_members_mock.assert_not_called()
        planner_run_mock.assert_called_once()
        warm_call = planner_run_mock.call_args.kwargs
        self.assertEqual(warm_call['symbols'], ['FPT', 'HPG', 'TPB', 'VCB'])
        self.assertEqual(warm_call['planner_queue'], 'realtime_prefetch')

    @patch('service_ops.dataops_market_data.fetch_listing_symbols', return_value=[])
    @patch('service_ops.tasks.create_global_planner_run')
    def test_market_data_queue_tier_scheduler_dispatches_due_tiers_with_runtime_policy(self, planner_run_mock, fetch_listing_symbols_mock):
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
            GlobalSymbolRegistry(
                symbol='HPG',
                is_active=True,
                current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.HOT,
                priority_score=6.0,
                demand_source_count=1,
                freshness_state_summary='stale',
                coverage_state_summary='missing',
            ),
        ])
        hot_fpt = GlobalSymbolRegistry.objects.get(symbol='FPT')
        hot_hpg = GlobalSymbolRegistry.objects.get(symbol='HPG')
        GlobalSymbolCoverage.objects.bulk_create([
            GlobalSymbolCoverage(
                registry=hot_fpt,
                dataset=GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
                freshness_state=GlobalSymbolCoverage.FreshnessChoices.FRESH,
            ),
            GlobalSymbolCoverage(
                registry=hot_fpt,
                dataset=GlobalSymbolCoverage.DatasetChoices.PRICE_BOARD_SNAPSHOT,
                freshness_state=GlobalSymbolCoverage.FreshnessChoices.FRESH,
            ),
            GlobalSymbolCoverage(
                registry=hot_fpt,
                dataset=GlobalSymbolCoverage.DatasetChoices.INTRADAY_TICKS,
                freshness_state=GlobalSymbolCoverage.FreshnessChoices.FRESH,
            ),
            GlobalSymbolCoverage(
                registry=hot_fpt,
                dataset=GlobalSymbolCoverage.DatasetChoices.INTRADAY_BARS,
                freshness_state=GlobalSymbolCoverage.FreshnessChoices.FRESH,
            ),
            GlobalSymbolCoverage(
                registry=hot_hpg,
                dataset=GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
                freshness_state=GlobalSymbolCoverage.FreshnessChoices.MISSING,
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
        self.assertEqual(hot_call['symbols'], ['HPG'])
        self.assertEqual(hot_call['mode'], 'strict_fresh')
        self.assertEqual(hot_call['planner_queue'], 'realtime_prefetch')
        self.assertEqual(hot_call['trigger'], 'market_data.queue_tier_scheduler')
        self.assertEqual(hot_call['extra_input_summary']['planner_mode'], 'strict_fresh')
        self.assertIn('parity_snapshot', hot_call['extra_input_summary'])
        self.assertIn('window_24h', hot_call['extra_input_summary']['parity_snapshot'])
        self.assertEqual(hot_call['extra_input_summary']['queue_tier'], 'hot_user_demand')
        self.assertEqual(MarketDataParitySnapshot.objects.filter(window_hours=24).count(), 1)
        self.assertEqual(MarketDataParitySnapshot.objects.filter(window_hours=72).count(), 1)
        recovery_call = planner_run_mock.call_args_list[1].kwargs
        self.assertEqual(recovery_call['symbols'], ['AAA'])
        self.assertEqual(recovery_call['mode'], 'missing_only')
        self.assertEqual(recovery_call['planner_queue'], 'manual_on_demand')
        self.assertEqual(
            recovery_call['datasets'],
            ['daily_prices', 'price_board_snapshot', 'intraday_ticks', 'intraday_bars', 'session_facts'],
        )

    @patch('service_ops.dataops_market_data.fetch_listing_symbols', return_value=[])
    @patch('service_ops.tasks.create_global_planner_run')
    def test_cleanup_market_data_parity_snapshots_task_applies_retention_policy(self, planner_run_mock, fetch_listing_symbols_mock):
        old_time = timezone.now() - timedelta(days=3)
        matrix_service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix'])
        MarketDataParitySnapshot.objects.bulk_create([
            MarketDataParitySnapshot(
                service=matrix_service,
                scheduler_task_id='legacy-retention-24h',
                window_hours=24,
                strict_fresh_parity=0.5,
                fresh_or_warm_parity=0.7,
                captured_at=old_time,
            ),
            MarketDataParitySnapshot(
                service=matrix_service,
                scheduler_task_id='legacy-retention-72h',
                window_hours=72,
                strict_fresh_parity=0.5,
                fresh_or_warm_parity=0.7,
                captured_at=old_time,
            ),
        ])

        GlobalSymbolRegistry.objects.create(
            symbol='VCB',
            is_active=True,
            current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.WARM,
            priority_score=7.5,
            demand_source_count=1,
            freshness_state_summary='stale',
            coverage_state_summary='partial',
        )
        GlobalSymbolCoverage.objects.create(
            registry=GlobalSymbolRegistry.objects.get(symbol='VCB'),
            dataset=GlobalSymbolCoverage.DatasetChoices.SESSION_FACTS,
            freshness_state=GlobalSymbolCoverage.FreshnessChoices.MISSING,
            next_recommended_action='materialize_session_facts',
        )
        ServiceConfig.objects.create(
            service=matrix_service,
            config_schema_version='1.0',
            config_payload={
                'parity_snapshot_retention_days': 1,
                'warm_liquid_market': {
                    'poll_interval_seconds': 60,
                    'max_batch_size': 5,
                },
            },
            applied_by='test',
        )
        planner_run_mock.return_value = {
            'run_id': 'md-run-warm',
            'service_run_log_id': 77,
            'status': 'queued',
        }

        scheduler_result = run_market_data_queue_tier_scheduler.run()
        result = cleanup_market_data_parity_snapshots_task.run()

        self.assertEqual(scheduler_result['dispatched_runs'], 1)
        self.assertEqual(result['retention_days'], 1)
        self.assertGreaterEqual(result['deleted_rows'], 2)
        self.assertIn('retained_rows', result)
        self.assertIn('total_rows_before', result)
        self.assertFalse(
            MarketDataParitySnapshot.objects.filter(
                scheduler_task_id__in=['legacy-retention-24h', 'legacy-retention-72h']
            ).exists()
        )
        self.assertTrue(
            ServiceRunLog.objects.filter(
                service=matrix_service,
                input_summary__trigger='market_data.parity_snapshot_retention',
                status='success',
            ).exists()
        )

    @patch('service_ops.dataops_market_data.fetch_listing_symbols', return_value=[])
    @patch('service_ops.tasks.create_global_planner_run')
    def test_market_data_queue_tier_scheduler_includes_session_facts_for_warm_tier(self, planner_run_mock, fetch_listing_symbols_mock):
        GlobalSymbolRegistry.objects.create(
            symbol='VCB',
            is_active=True,
            current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.WARM,
            priority_score=7.5,
            demand_source_count=1,
            freshness_state_summary='stale',
            coverage_state_summary='partial',
        )
        GlobalSymbolCoverage.objects.create(
            registry=GlobalSymbolRegistry.objects.get(symbol='VCB'),
            dataset=GlobalSymbolCoverage.DatasetChoices.SESSION_FACTS,
            freshness_state=GlobalSymbolCoverage.FreshnessChoices.MISSING,
            next_recommended_action='materialize_session_facts',
        )
        service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix'])
        ServiceConfig.objects.create(
            service=service,
            config_schema_version='1.0',
            config_payload={
                'warm_liquid_market': {
                    'poll_interval_seconds': 60,
                    'max_batch_size': 5,
                },
            },
            applied_by='test',
        )
        planner_run_mock.return_value = {
            'run_id': 'md-run-warm',
            'service_run_log_id': 21,
            'status': 'queued',
        }

        result = run_market_data_queue_tier_scheduler.run()

        self.assertEqual(result['dispatched_runs'], 1)
        planner_run_mock.assert_called_once()
        warm_call = planner_run_mock.call_args.kwargs
        self.assertEqual(warm_call['symbols'], ['VCB'])
        self.assertEqual(warm_call['mode'], 'strict_fresh')
        self.assertEqual(warm_call['planner_queue'], 'realtime_prefetch')
        self.assertEqual(warm_call['extra_input_summary']['planner_mode'], 'strict_fresh')
        self.assertIn('parity_snapshot', warm_call['extra_input_summary'])
        self.assertIn('window_72h', warm_call['extra_input_summary']['parity_snapshot'])
        self.assertEqual(warm_call['extra_input_summary']['queue_tier'], 'warm_liquid_market')
        self.assertEqual(warm_call['datasets'], ['daily_prices', 'price_board_snapshot', 'session_facts'])

    @patch('service_ops.dataops_market_data.fetch_listing_symbols', return_value=[])
    @patch('service_ops.tasks.create_global_planner_run')
    def test_market_data_queue_tier_scheduler_enforces_max_dispatch_per_cycle_quota(self, planner_run_mock, fetch_listing_symbols_mock):
        GlobalSymbolRegistry.objects.bulk_create([
            GlobalSymbolRegistry(
                symbol='HPG',
                is_active=True,
                current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.HOT,
                priority_score=8.0,
                demand_source_count=2,
                freshness_state_summary='missing',
                coverage_state_summary='missing',
            ),
            GlobalSymbolRegistry(
                symbol='FPT',
                is_active=True,
                current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.HOT,
                priority_score=7.0,
                demand_source_count=1,
                freshness_state_summary='stale',
                coverage_state_summary='partial',
            ),
        ])
        hot_hpg = GlobalSymbolRegistry.objects.get(symbol='HPG')
        hot_fpt = GlobalSymbolRegistry.objects.get(symbol='FPT')
        GlobalSymbolCoverage.objects.bulk_create([
            GlobalSymbolCoverage(
                registry=hot_hpg,
                dataset=GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
                freshness_state=GlobalSymbolCoverage.FreshnessChoices.MISSING,
            ),
            GlobalSymbolCoverage(
                registry=hot_fpt,
                dataset=GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
                freshness_state=GlobalSymbolCoverage.FreshnessChoices.STALE,
            ),
        ])

        service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix'])
        ServiceConfig.objects.create(
            service=service,
            config_schema_version='1.0',
            config_payload={
                'hot_user_demand': {
                    'poll_interval_seconds': 30,
                    'max_batch_size': 5,
                    'max_dispatch_per_cycle': 1,
                },
                'warm_liquid_market': {
                    'poll_interval_seconds': 3600,
                    'max_batch_size': 5,
                },
                'cold_full_market': {
                    'poll_interval_seconds': 3600,
                    'max_batch_size': 5,
                },
                'recovery_backlog': {
                    'poll_interval_seconds': 3600,
                    'max_batch_size': 5,
                },
            },
            applied_by='test',
        )
        planner_run_mock.return_value = {
            'run_id': 'md-run-hot',
            'service_run_log_id': 61,
            'status': 'queued',
        }

        result = run_market_data_queue_tier_scheduler.run()

        planner_run_mock.assert_called_once()
        call_kwargs = planner_run_mock.call_args.kwargs
        self.assertEqual(call_kwargs['symbols'], ['HPG'])
        self.assertEqual(call_kwargs['extra_input_summary']['max_dispatch_per_cycle'], 1)
        self.assertEqual(call_kwargs['extra_input_summary']['eligible_symbols'], 2)
        self.assertEqual(call_kwargs['extra_input_summary']['skipped_by_quota'], 1)
        self.assertEqual(result['skipped_by_quota'], 1)
        self.assertTrue(any(item['tier'] == 'hot_user_demand' and item['reason'] == 'quota' for item in result['skipped_tiers']))

    @patch('service_ops.dataops_market_data.fetch_listing_symbols', return_value=[])
    @patch('service_ops.tasks.create_global_planner_run')
    def test_market_data_queue_tier_scheduler_skips_recent_inflight_tier(self, planner_run_mock, fetch_listing_symbols_mock):
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

    @patch('service_ops.dataops_market_data.fetch_listing_symbols', return_value=[])
    @patch('service_ops.tasks._is_celery_task_live', return_value=False)
    @patch('service_ops.tasks.create_global_planner_run')
    def test_market_data_queue_tier_scheduler_recovers_orphaned_inflight_tier_immediately(self, planner_run_mock, is_task_live_mock, fetch_listing_symbols_mock):
        GlobalSymbolRegistry.objects.create(
            symbol='HPG',
            is_active=True,
            current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.HOT,
            priority_score=8.0,
            demand_source_count=1,
            freshness_state_summary='missing',
            coverage_state_summary='missing',
        )
        service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix'])
        run_log = ServiceRunLog.objects.create(
            service=service,
            status='running',
            celery_task_id='orphan-task-1',
            input_summary={
                'trigger': 'market_data.queue_tier_scheduler',
                'queue_tier': 'hot_user_demand',
            },
            output_summary={},
        )
        ServiceRunLog.objects.filter(pk=run_log.id).update(started_at=timezone.now() - timedelta(seconds=90))
        planner_run_mock.return_value = {
            'run_id': 'md-run-hot',
            'service_run_log_id': 30,
            'status': 'queued',
        }

        result = run_market_data_queue_tier_scheduler.run()

        run_log.refresh_from_db()
        self.assertEqual(result['dispatched_runs'], 1)
        planner_run_mock.assert_called_once()
        is_task_live_mock.assert_called_once_with('orphan-task-1')
        self.assertEqual(run_log.status, 'failed')
        self.assertEqual(run_log.output_summary['recovery_action'], 'queue_tier_missing_worker_task')
        self.assertEqual(run_log.output_summary['queue_tier'], 'hot_user_demand')
        self.assertIn('stored celery_task_id was not present in any live Celery worker', run_log.error_detail)

    @patch('service_ops.dataops_market_data.fetch_listing_symbols', return_value=[])
    @patch('service_ops.tasks._is_celery_task_live', return_value=False)
    @patch('service_ops.tasks.create_global_planner_run')
    def test_market_data_queue_tier_scheduler_keeps_inflight_when_child_run_exists(self, planner_run_mock, is_task_live_mock, fetch_listing_symbols_mock):
        GlobalSymbolRegistry.objects.create(
            symbol='HPG',
            is_active=True,
            current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.HOT,
            priority_score=8.0,
            demand_source_count=1,
            freshness_state_summary='missing',
            coverage_state_summary='missing',
        )
        service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix'])
        parent_run_log = ServiceRunLog.objects.create(
            service=service,
            status='running',
            celery_task_id='orphan-task-2',
            input_summary={
                'trigger': 'market_data.queue_tier_scheduler',
                'queue_tier': 'hot_user_demand',
            },
            output_summary={},
        )
        ServiceRunLog.objects.filter(pk=parent_run_log.id).update(started_at=timezone.now() - timedelta(seconds=90))
        ServiceRunLog.objects.create(
            service=get_registered_service('vnbroker_history'),
            status='running',
            input_summary={
                'trigger': 'global_market_data_planner_daily_prices',
                'parent_run_log_id': parent_run_log.id,
                'parent_service_key': 'matrix_cycle_coordinator',
            },
            output_summary={},
        )

        result = run_market_data_queue_tier_scheduler.run()

        parent_run_log.refresh_from_db()
        self.assertEqual(result['dispatched_runs'], 0)
        self.assertFalse(planner_run_mock.called)
        is_task_live_mock.assert_called_once_with('orphan-task-2')
        self.assertEqual(parent_run_log.status, 'running')
        self.assertTrue(any(item['tier'] == 'hot_user_demand' and item['reason'] == 'inflight' for item in result['skipped_tiers']))

    @patch('service_ops.dataops_market_data.fetch_listing_symbols', return_value=[])
    @patch('service_ops.tasks._is_celery_task_live', return_value=False)
    @patch('service_ops.tasks.create_global_planner_run')
    def test_market_data_queue_tier_scheduler_recovers_stale_child_runs_with_parent(self, planner_run_mock, is_task_live_mock, fetch_listing_symbols_mock):
        GlobalSymbolRegistry.objects.create(
            symbol='HPG',
            is_active=True,
            current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.HOT,
            priority_score=8.0,
            demand_source_count=1,
            freshness_state_summary='missing',
            coverage_state_summary='missing',
        )
        service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix'])
        parent_run_log = ServiceRunLog.objects.create(
            service=service,
            status='running',
            celery_task_id='orphan-task-3',
            input_summary={
                'trigger': 'market_data.queue_tier_scheduler',
                'queue_tier': 'hot_user_demand',
            },
            output_summary={},
        )
        ingest_job = IngestJob.objects.create(
            name='daily-price-ingest',
            source=IngestJob.SourceChoices.VNBROKER_PRICE_BOARD,
            status=IngestJob.StatusChoices.ACTIVE,
            schedule_seconds=86400,
        )
        ingest_run = IngestRun.objects.create(
            job=ingest_job,
            state=IngestRun.StateChoices.RUNNING,
        )
        child_run_log = ServiceRunLog.objects.create(
            service=get_registered_service('vnbroker_history'),
            status='running',
            input_summary={
                'trigger': 'global_market_data_planner_daily_prices',
                'parent_run_log_id': parent_run_log.id,
                'parent_service_key': 'matrix_cycle_coordinator',
            },
            output_summary={'ingest_run_id': ingest_run.id},
        )
        stale_started_at = timezone.now() - timedelta(seconds=1200)
        ServiceRunLog.objects.filter(pk__in=[parent_run_log.id, child_run_log.id]).update(started_at=stale_started_at)
        planner_run_mock.return_value = {
            'run_id': 'md-run-hot',
            'service_run_log_id': 32,
            'status': 'queued',
        }

        result = run_market_data_queue_tier_scheduler.run()

        parent_run_log.refresh_from_db()
        child_run_log.refresh_from_db()
        ingest_run.refresh_from_db()
        self.assertEqual(result['dispatched_runs'], 1)
        planner_run_mock.assert_called_once()
        is_task_live_mock.assert_called_once_with('orphan-task-3')
        self.assertEqual(parent_run_log.status, 'failed')
        self.assertEqual(parent_run_log.output_summary['recovery_action'], 'queue_tier_stale_inflight_recovered')
        self.assertEqual(parent_run_log.output_summary['recovered_child_runs'], 1)
        self.assertEqual(child_run_log.status, 'failed')
        self.assertEqual(child_run_log.output_summary['recovery_action'], 'queue_tier_parent_recovery_cleanup')
        self.assertEqual(child_run_log.output_summary['parent_recovery_action'], 'queue_tier_stale_inflight_recovered')
        self.assertEqual(child_run_log.output_summary['recovered_ingest_run_id'], ingest_run.id)
        self.assertEqual(ingest_run.state, IngestRun.StateChoices.FAILED)
        self.assertIsNotNone(ingest_run.finished_at)
        self.assertIn('planner child run was recovered', ingest_run.error_message)
        self.assertIn('parent queue-tier run was recovered', child_run_log.error_detail)

    @patch('service_ops.dataops_market_data.fetch_listing_symbols', return_value=[])
    @patch('service_ops.tasks.create_global_planner_run')
    def test_market_data_queue_tier_scheduler_recovers_stale_inflight_tier(self, planner_run_mock, fetch_listing_symbols_mock):
        GlobalSymbolRegistry.objects.create(
            symbol='HPG',
            is_active=True,
            current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.HOT,
            priority_score=8.0,
            demand_source_count=1,
            freshness_state_summary='missing',
            coverage_state_summary='missing',
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
        ServiceRunLog.objects.filter(pk=run_log.id).update(started_at=timezone.now() - timedelta(seconds=1200))
        planner_run_mock.return_value = {
            'run_id': 'md-run-hot',
            'service_run_log_id': 31,
            'status': 'queued',
        }

        result = run_market_data_queue_tier_scheduler.run()

        run_log.refresh_from_db()
        self.assertEqual(result['dispatched_runs'], 1)
        planner_run_mock.assert_called_once()
        self.assertEqual(run_log.status, 'failed')
        self.assertEqual(run_log.output_summary['recovery_action'], 'queue_tier_stale_inflight_recovered')
        self.assertEqual(run_log.output_summary['queue_tier'], 'hot_user_demand')
        self.assertIn('Auto-recovered stale queue-tier inflight run', run_log.error_detail)


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