from datetime import date
from unittest.mock import Mock, patch

from django.test import TestCase

from data_ingest.models import IngestRun
from market_data.global_symbol_planner import create_global_planner_run
from market_data.models import GlobalSymbolCoverage, GlobalSymbolDemandSource, GlobalSymbolRegistry, IntradayBar, IntradayTick
from service_ops.models import ServiceRunLog
from service_ops.registry import ensure_service_registry


class GlobalSymbolPlannerRunTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        ensure_service_registry()

    def _create_registry_with_daily_gap(self, symbol: str, freshness_state: str = 'missing') -> GlobalSymbolRegistry:
        registry = GlobalSymbolRegistry.objects.create(symbol=symbol, is_active=True)
        GlobalSymbolDemandSource.objects.create(
            registry=registry,
            source_type=GlobalSymbolDemandSource.SourceTypeChoices.WATCHLIST,
            source_ref=f'watchlist:{symbol.lower()}',
            is_active=True,
        )
        GlobalSymbolCoverage.objects.create(
            registry=registry,
            dataset=GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
            freshness_state=freshness_state,
            missing_ranges=[{'start': '2026-05-14', 'end': '2026-05-15'}],
            next_recommended_action='hydrate_daily_prices',
        )
        return registry

    def _create_snapshot_gap(self, registry: GlobalSymbolRegistry, freshness_state: str = 'missing') -> None:
        GlobalSymbolCoverage.objects.create(
            registry=registry,
            dataset=GlobalSymbolCoverage.DatasetChoices.PRICE_BOARD_SNAPSHOT,
            freshness_state=freshness_state,
            missing_ranges=[{'start': '2026-05-15', 'end': '2026-05-15'}],
            next_recommended_action='hydrate_price_board_snapshot',
        )

    def _create_intraday_gaps(self, registry: GlobalSymbolRegistry) -> None:
        GlobalSymbolCoverage.objects.create(
            registry=registry,
            dataset=GlobalSymbolCoverage.DatasetChoices.INTRADAY_TICKS,
            freshness_state='missing',
            missing_ranges=[{'start': '2026-05-15', 'end': '2026-05-15'}],
            next_recommended_action='hydrate_intraday_ticks',
        )
        GlobalSymbolCoverage.objects.create(
            registry=registry,
            dataset=GlobalSymbolCoverage.DatasetChoices.INTRADAY_BARS,
            freshness_state='missing',
            missing_ranges=[{'start': '2026-05-15', 'end': '2026-05-15'}],
            next_recommended_action='hydrate_intraday_bars',
        )

    def _create_session_facts_gap(self, registry: GlobalSymbolRegistry, freshness_state: str = 'missing') -> None:
        GlobalSymbolCoverage.objects.create(
            registry=registry,
            dataset=GlobalSymbolCoverage.DatasetChoices.SESSION_FACTS,
            freshness_state=freshness_state,
            missing_ranges=[{'start': '2026-05-15', 'end': '2026-05-15'}],
            next_recommended_action='materialize_session_facts',
        )

    @patch('data_ingest.tasks.run_global_market_data_planner.apply_async', return_value=Mock(id='planner-task-1'))
    def test_create_global_planner_run_queues_async_run_log(self, planner_task_mock):
        self._create_registry_with_daily_gap('HPG')

        result = create_global_planner_run(
            symbols=['HPG'],
            datasets=['daily_prices'],
            execution_mode='async',
            reference_trade_date=date(2026, 5, 15),
        )

        self.assertTrue(result['queued'])
        self.assertEqual(result['status'], 'queued')
        self.assertEqual(result['celery_task_id'], 'planner-task-1')
        run_log = ServiceRunLog.objects.get(pk=result['service_run_log_id'])
        self.assertEqual(run_log.service.service_key, 'matrix_cycle_coordinator')
        self.assertEqual(run_log.status, 'queued')
        self.assertEqual(run_log.input_summary['mode'], 'missing_only')
        self.assertEqual(len(run_log.input_summary['plan_items']), 1)
        planner_task_mock.assert_called_once_with(kwargs={'service_run_log_id': run_log.id})

    @patch('data_ingest.tasks.run_global_market_data_planner.apply_async', return_value=Mock(id='planner-task-hot'))
    def test_create_global_planner_run_carries_scheduler_context_and_queue(self, planner_task_mock):
        self._create_registry_with_daily_gap('SSI')

        result = create_global_planner_run(
            symbols=['SSI'],
            datasets=['daily_prices'],
            execution_mode='async',
            trigger='market_data.queue_tier_scheduler',
            planner_queue='realtime_prefetch',
            extra_input_summary={
                'queue_tier': 'hot_user_demand',
                'poll_interval_seconds': 30,
            },
            reference_trade_date=date(2026, 5, 15),
        )

        run_log = ServiceRunLog.objects.get(pk=result['service_run_log_id'])

        self.assertEqual(run_log.input_summary['trigger'], 'market_data.queue_tier_scheduler')
        self.assertEqual(run_log.input_summary['queue_tier'], 'hot_user_demand')
        self.assertEqual(run_log.input_summary['planner_queue'], 'realtime_prefetch')
        planner_task_mock.assert_called_once_with(
            kwargs={'service_run_log_id': run_log.id},
            queue='realtime_prefetch',
        )

    @patch('data_ingest.tasks.backfill_daily_prices.run')
    def test_create_global_planner_run_executes_sync_and_updates_audit(self, backfill_daily_prices_run_mock):
        self._create_registry_with_daily_gap('FPT', freshness_state='stale')
        backfill_daily_prices_run_mock.return_value = {
            'status': 'ok',
            'planned_items': 1,
            'inserted': 2,
            'updated': 1,
            'skipped_existing': 0,
            'upserted': 3,
            'failed': [],
            'failed_count': 0,
            'repaired_conflicts': 0,
            'providers': ['VCI', 'KBS'],
        }

        result = create_global_planner_run(
            symbols=['FPT'],
            datasets=['daily_prices'],
            execution_mode='sync',
            reason='operator_manual_run',
            reference_trade_date=date(2026, 5, 15),
        )

        self.assertFalse(result['queued'])
        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['summary']['inserted'], 2)
        self.assertEqual(result['summary']['updated'], 1)

        parent_run_log = ServiceRunLog.objects.get(pk=result['service_run_log_id'])
        child_run_log = ServiceRunLog.objects.exclude(pk=parent_run_log.id).get()
        self.assertEqual(parent_run_log.status, 'success')
        self.assertEqual(parent_run_log.output_summary['summary']['inserted'], 2)
        self.assertEqual(child_run_log.service.service_key, 'vnbroker_history')
        self.assertEqual(child_run_log.status, 'success')
        backfill_daily_prices_run_mock.assert_called_once()

    @patch('market_serving.vnbroker_materializer.materialize_symbol_snapshot_from_vnbroker')
    def test_create_global_planner_run_executes_price_board_snapshot_sync(self, materialize_mock):
        registry = self._create_registry_with_daily_gap('MWG')
        GlobalSymbolCoverage.objects.filter(
            registry=registry,
            dataset=GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
        ).delete()
        self._create_snapshot_gap(registry, freshness_state='missing')
        materialize_mock.return_value = {
            'status': 'ok',
            'upserted': 1,
            'inserted': 1,
            'updated': 0,
            'skipped_existing': 0,
            'failed': [],
            'failed_count': 0,
            'source': 'vnbroker_native',
        }

        result = create_global_planner_run(
            symbols=['MWG'],
            datasets=['price_board_snapshot'],
            execution_mode='sync',
            reason='operator_manual_run',
            reference_trade_date=date(2026, 5, 15),
        )

        self.assertFalse(result['queued'])
        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['summary']['inserted'], 1)

        parent_run_log = ServiceRunLog.objects.get(pk=result['service_run_log_id'])
        child_run_log = ServiceRunLog.objects.exclude(pk=parent_run_log.id).get()
        self.assertEqual(parent_run_log.status, 'success')
        self.assertEqual(child_run_log.service.service_key, 'vnbroker_price_board')
        self.assertEqual(child_run_log.status, 'success')
        self.assertTrue(child_run_log.output_summary['ingest_run_id'])
        ingest_run = IngestRun.objects.get(pk=child_run_log.output_summary['ingest_run_id'])
        self.assertEqual(ingest_run.job.name, 'core-price-board-prefetch')
        self.assertEqual(ingest_run.state, IngestRun.StateChoices.SUCCESS)
        materialize_mock.assert_called_once_with(symbols=['MWG'])

    @patch('data_ingest.tasks.fetch_intraday_tape')
    def test_create_global_planner_run_executes_intraday_sync(self, fetch_intraday_tape_mock):
        registry = GlobalSymbolRegistry.objects.create(symbol='SSI', is_active=True)
        GlobalSymbolDemandSource.objects.create(
            registry=registry,
            source_type=GlobalSymbolDemandSource.SourceTypeChoices.WATCHLIST,
            source_ref='watchlist:ssi',
            is_active=True,
        )
        self._create_intraday_gaps(registry)
        fetch_intraday_tape_mock.return_value = {
            'symbol': 'SSI',
            'trades': [
                {
                    'timestamp': '2026-05-15T09:15:00+07:00',
                    'price': 25.0,
                    'volume': 100,
                    'side': 'buy',
                    'match_type': 'NormalMatch',
                },
                {
                    'timestamp': '2026-05-15T09:16:00+07:00',
                    'price': 25.3,
                    'volume': 150,
                    'side': 'sell',
                    'match_type': 'NormalMatch',
                },
            ],
            'source': 'VCI',
            'stale': False,
            'fetched_at': '2026-05-15T09:16:01+07:00',
        }

        result = create_global_planner_run(
            symbols=['SSI'],
            datasets=['intraday_ticks', 'intraday_bars'],
            execution_mode='sync',
            reason='operator_manual_run',
            reference_trade_date=date(2026, 5, 15),
        )

        self.assertFalse(result['queued'])
        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['summary']['inserted'], 9)
        self.assertTrue(IntradayTick.objects.filter(symbol='SSI').exists())
        self.assertTrue(IntradayBar.objects.filter(symbol='SSI', timeframe='1H').exists())

        parent_run_log = ServiceRunLog.objects.get(pk=result['service_run_log_id'])
        child_run_log = ServiceRunLog.objects.exclude(pk=parent_run_log.id).get()
        self.assertEqual(parent_run_log.status, 'success')
        self.assertEqual(child_run_log.service.service_key, 'vnbroker_intraday_tape')
        self.assertEqual(child_run_log.status, 'success')
        self.assertEqual(child_run_log.output_summary['tick_counts']['inserted'], 2)
        self.assertEqual(child_run_log.output_summary['bar_counts']['inserted'], 7)

    @patch('data_ingest.tasks.warm_intraday_universe.run')
    def test_create_global_planner_run_applies_queue_tier_intraday_depth_policy(self, warm_intraday_run_mock):
        registry = GlobalSymbolRegistry.objects.create(symbol='SSI', is_active=True)
        GlobalSymbolDemandSource.objects.create(
            registry=registry,
            source_type=GlobalSymbolDemandSource.SourceTypeChoices.WATCHLIST,
            source_ref='watchlist:ssi',
            is_active=True,
        )
        self._create_intraday_gaps(registry)
        warm_intraday_run_mock.return_value = {
            'status': 'ok',
            'symbols_count': 1,
            'warmed_up_count': 1,
            'inserted': 0,
            'updated': 0,
            'skipped_existing': 0,
            'failed': [],
            'failed_count': 0,
            'repaired_conflicts': 0,
            'tick_counts': {'inserted': 0, 'updated': 0, 'skipped_existing': 0, 'failed': 0, 'planned_items': 1, 'repaired_conflicts': 0},
            'bar_counts': {'inserted': 0, 'updated': 0, 'skipped_existing': 0, 'failed': 0, 'planned_items': 1, 'repaired_conflicts': 0},
        }

        result = create_global_planner_run(
            symbols=['SSI'],
            datasets=['intraday_ticks'],
            execution_mode='sync',
            trigger='market_data.queue_tier_scheduler',
            extra_input_summary={'queue_tier': 'cold_full_market'},
            reference_trade_date=date(2026, 5, 15),
        )

        self.assertFalse(result['queued'])
        warm_intraday_run_mock.assert_called_once()
        intraday_items = warm_intraday_run_mock.call_args.kwargs['plan_items']
        self.assertEqual(len(intraday_items), 1)
        self.assertEqual(intraday_items[0]['requested_window']['intraday_depth_tier'], 'cold')
        self.assertEqual(intraday_items[0]['requested_window']['page_size'], 25)

    @patch('service_ops.tasks.run_signal_session_facts_materialization.run')
    def test_create_global_planner_run_executes_session_facts_sync(self, session_facts_run_mock):
        registry = GlobalSymbolRegistry.objects.create(symbol='VNM', is_active=True)
        GlobalSymbolDemandSource.objects.create(
            registry=registry,
            source_type=GlobalSymbolDemandSource.SourceTypeChoices.WATCHLIST,
            source_ref='watchlist:vnm',
            is_active=True,
        )
        self._create_session_facts_gap(registry, freshness_state='missing')
        session_facts_run_mock.return_value = {
            'status': 'ok',
            'session_date': '2026-05-15',
            'requested_symbol': 'VNM',
            'symbols_total': 1,
            'upserted': 1,
            'skipped': 0,
            'errors': 0,
        }

        result = create_global_planner_run(
            symbols=['VNM'],
            datasets=['session_facts'],
            execution_mode='sync',
            reason='operator_manual_run',
            reference_trade_date=date(2026, 5, 15),
        )

        self.assertFalse(result['queued'])
        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['summary']['updated'], 1)
        self.assertEqual(result['summary']['failed'], 0)

        parent_run_log = ServiceRunLog.objects.get(pk=result['service_run_log_id'])
        child_run_log = ServiceRunLog.objects.exclude(pk=parent_run_log.id).get()
        self.assertEqual(parent_run_log.status, 'success')
        self.assertEqual(child_run_log.service.service_key, 'signal_session_facts_materializer')
        self.assertEqual(child_run_log.status, 'queued')
        session_facts_run_mock.assert_called_once_with(run_log_id=child_run_log.id, symbol='VNM')