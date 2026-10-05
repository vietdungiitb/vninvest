from datetime import date, timedelta
from datetime import datetime
from datetime import timezone as dt_timezone
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from data_ingest.models import IngestJob, IngestRun
from data_ingest.tasks import backfill_daily_prices, backfill_pre5y_to_market_inception, fetch_and_upsert_price_board, ingest_daily_prices, warm_intraday_universe
from data_ingest.tasks import _fetch_and_upsert_bucket
from market_data.models import DailyPrice, GlobalSymbolCoverage, GlobalSymbolRegistry, IntradayBar, IntradayTick
from market_serving.models import SymbolSnapshot
from service_ops.models import BackfillExecutionRun, ServiceRunLog
from service_ops.registry import ensure_service_registry, get_registered_service


class DataIngestBackfillTaskTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        ensure_service_registry()

    @patch('data_ingest.tasks.fetch_daily_history')
    def test_fetch_and_upsert_bucket_uses_adapter_ssot(self, fetch_daily_history_mock):
        fetch_daily_history_mock.return_value = [
            {
                'symbol': 'ACB',
                'date': date(2026, 5, 14),
                'open': 12.0,
                'high': 12.4,
                'low': 11.8,
                'close': 12.3,
                'volume': 4567,
                'source': 'KBS',
            }
        ]

        result = _fetch_and_upsert_bucket(['ACB'], 'kbs', days=5, inter_symbol_delay=0)

        fetch_daily_history_mock.assert_called_once_with('ACB', days=5, source='KBS')
        self.assertEqual(result['upserted'], 1)
        self.assertEqual(result['failed'], [])

        row = DailyPrice.objects.get(symbol='ACB', date=date(2026, 5, 14))
        self.assertEqual(str(row.close), '12.30')
        self.assertEqual(row.source, 'vnbroker_kbs')
        self.assertEqual(result['total_retries_used'], 0)
        self.assertIn('provider_latency_p50_ms', result)
        self.assertIn('provider_latency_p95_ms', result)

    @patch('data_ingest.tasks.fetch_daily_history')
    def test_fetch_and_upsert_bucket_retries_with_bounded_attempts(self, fetch_daily_history_mock):
        fetch_daily_history_mock.side_effect = [
            RuntimeError('temporary upstream failure'),
            [
                {
                    'symbol': 'ACB',
                    'date': date(2026, 5, 14),
                    'open': 12.0,
                    'high': 12.4,
                    'low': 11.8,
                    'close': 12.3,
                    'volume': 4567,
                    'source': 'KBS',
                }
            ],
        ]

        result = _fetch_and_upsert_bucket(['ACB'], 'kbs', days=5, inter_symbol_delay=0)

        self.assertEqual(fetch_daily_history_mock.call_count, 2)
        self.assertEqual(result['upserted'], 1)
        self.assertEqual(result['failed_count'], 0)
        self.assertEqual(result['total_retries_used'], 1)

    @patch('data_ingest.tasks.fetch_daily_history')
    def test_backfill_daily_prices_consumes_plan_items_with_detailed_counts(self, fetch_daily_history_mock):
        DailyPrice.objects.create(
            symbol='ACB',
            date=date(2026, 5, 14),
            open=12.0,
            high=12.4,
            low=11.8,
            close=12.3,
            volume=4567,
            source='vnbroker_vci',
        )
        DailyPrice.objects.create(
            symbol='ACB',
            date=date(2026, 5, 15),
            open=12.2,
            high=12.5,
            low=12.0,
            close=12.4,
            volume=4000,
            source='vnbroker_vci',
        )
        fetch_daily_history_mock.return_value = [
            {
                'symbol': 'ACB',
                'date': date(2026, 5, 14),
                'open': 12.0,
                'high': 12.4,
                'low': 11.8,
                'close': 12.3,
                'volume': 4567,
                'source': 'VCI',
            },
            {
                'symbol': 'ACB',
                'date': date(2026, 5, 15),
                'open': 12.2,
                'high': 12.7,
                'low': 12.0,
                'close': 12.6,
                'volume': 4800,
                'source': 'VCI',
            },
            {
                'symbol': 'ACB',
                'date': date(2026, 5, 16),
                'open': 12.6,
                'high': 12.8,
                'low': 12.4,
                'close': 12.7,
                'volume': 5000,
                'source': 'VCI',
            },
        ]

        result = backfill_daily_prices.run(
            plan_items=[
                {
                    'symbol': 'ACB',
                    'dataset': 'daily_prices',
                    'requested_window': {'start_date': '2026-05-14', 'end_date': '2026-05-16'},
                }
            ],
            max_workers=1,
        )

        fetch_daily_history_mock.assert_called_once_with(
            'ACB',
            days=3,
            source='VCI',
            start_date=date(2026, 5, 14),
            end_date=date(2026, 5, 16),
        )
        self.assertEqual(result['planned_items'], 1)
        self.assertEqual(result['inserted'], 1)
        self.assertEqual(result['updated'], 1)
        self.assertEqual(result['skipped_existing'], 1)
        self.assertEqual(result['failed_count'], 0)
        self.assertIn('per_provider', result)
        self.assertIn('VCI', result['per_provider'])
        self.assertIn('KBS', result['per_provider'])

        updated_row = DailyPrice.objects.get(symbol='ACB', date=date(2026, 5, 15))
        inserted_row = DailyPrice.objects.get(symbol='ACB', date=date(2026, 5, 16))
        self.assertEqual(str(updated_row.close), '12.60')
        self.assertEqual(str(inserted_row.close), '12.70')

    @patch('data_ingest.tasks.backfill_daily_prices.run')
    @patch('data_ingest.tasks.now')
    def test_backfill_pre5y_to_market_inception_dispatches_pre5y_window_plan(
        self,
        now_mock,
        backfill_daily_prices_run_mock,
    ):
        now_mock.return_value = datetime(2026, 5, 21, tzinfo=dt_timezone.utc)
        GlobalSymbolRegistry.objects.create(symbol='ACB', is_active=True)
        GlobalSymbolRegistry.objects.create(symbol='FPT', is_active=True)
        backfill_daily_prices_run_mock.return_value = {
            'status': 'ok',
            'planned_items': 2,
            'upserted': 10,
            'failed': [],
            'failed_count': 0,
        }

        from unittest.mock import PropertyMock
        with patch('celery.app.task.Task.request', new_callable=PropertyMock) as mock_request:
            mock_request.return_value.id = 'test-pre5y-task-id'
            result = backfill_pre5y_to_market_inception.run(
                market_inception_date='2000-07-28',
                recent_years=5,
                _scheduler_job_key='pre5y-history-backfill-weekly',
            )

        called_kwargs = backfill_daily_prices_run_mock.call_args.kwargs
        self.assertEqual(called_kwargs['mode'], 'historical_inception_backfill')
        self.assertEqual(called_kwargs['trigger'], 'beat_schedule')
        self.assertEqual(called_kwargs['_scheduler_job_key'], 'pre5y-history-backfill-weekly')
        self.assertEqual(called_kwargs['symbols'], ['ACB', 'FPT'])
        self.assertEqual(called_kwargs['celery_task_id'], 'test-pre5y-task-id')
        self.assertEqual(len(called_kwargs['plan_items']), 2)
        self.assertEqual(
            called_kwargs['plan_items'][0]['requested_window'],
            {'start_date': '2000-07-28', 'end_date': '2021-05-21'},
        )
        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['market_inception_date'], '2000-07-28')
        self.assertEqual(result['pre5y_end_date'], '2021-05-21')
        self.assertEqual(result['recent_years'], 5)

    @patch('data_ingest.tasks.fetch_daily_history')
    def test_backfill_daily_prices_defaults_to_global_symbol_registry_when_symbols_missing(self, fetch_daily_history_mock):
        GlobalSymbolRegistry.objects.create(symbol='ACB', is_active=True)
        GlobalSymbolRegistry.objects.create(symbol='FPT', is_active=True)

        def _fetch_side_effect(symbol, days=365, source='VCI'):
            return [
                {
                    'symbol': symbol,
                    'date': date(2026, 5, 16),
                    'open': 12.0 if symbol == 'ACB' else 110.0,
                    'high': 12.4 if symbol == 'ACB' else 111.0,
                    'low': 11.8 if symbol == 'ACB' else 109.5,
                    'close': 12.3 if symbol == 'ACB' else 110.5,
                    'volume': 4567 if symbol == 'ACB' else 9876,
                    'source': source,
                }
            ]

        fetch_daily_history_mock.side_effect = _fetch_side_effect

        result = backfill_daily_prices.run(days=2, max_workers=1)

        self.assertEqual(result['planned_items'], 2)
        self.assertEqual(result['upserted'], 2)
        self.assertEqual(result['failed_count'], 0)
        self.assertEqual(fetch_daily_history_mock.call_count, 2)
        self.assertCountEqual([call.args[0] for call in fetch_daily_history_mock.call_args_list], ['ACB', 'FPT'])
        self.assertTrue(DailyPrice.objects.filter(symbol='ACB', date=date(2026, 5, 16)).exists())
        self.assertTrue(DailyPrice.objects.filter(symbol='FPT', date=date(2026, 5, 16)).exists())

    @patch('data_ingest.tasks.fetch_daily_history')
    def test_backfill_daily_prices_auto_closes_stale_running_records_before_new_run(self, fetch_daily_history_mock):
        stale_started_at = timezone.now() - timedelta(hours=4)
        service = get_registered_service('backfill_daily_prices')
        stale_run_log = ServiceRunLog.objects.create(
            service=service,
            status='running',
            input_summary={'triggered_by': 'test_stale'},
            output_summary={},
        )
        ServiceRunLog.objects.filter(pk=stale_run_log.pk).update(started_at=stale_started_at)

        stale_exec_run = BackfillExecutionRun.objects.create(
            run_id='backfill-stale-test-1',
            job_key='daily-backfill-prices-1700',
            mode='daily_delta',
            trigger='beat_schedule',
            status='running',
            requested_days=2,
            planned_symbols_count=1,
            started_at=stale_started_at,
        )

        fetch_daily_history_mock.return_value = [
            {
                'symbol': 'ACB',
                'date': date(2026, 5, 16),
                'open': 12.0,
                'high': 12.4,
                'low': 11.8,
                'close': 12.3,
                'volume': 4567,
                'source': 'VCI',
            }
        ]

        result = backfill_daily_prices.run(
            days=2,
            plan_items=[{'symbol': 'ACB', 'dataset': 'daily_prices'}],
            max_workers=1,
            _scheduler_job_key='daily-backfill-prices-1700',
        )

        stale_run_log.refresh_from_db()
        stale_exec_run.refresh_from_db()
        self.assertEqual(result['status'], 'ok')
        self.assertEqual(stale_run_log.status, 'failed')
        self.assertIsNotNone(stale_run_log.finished_at)
        self.assertIn('Auto-closed stale run log', stale_run_log.error_detail)
        self.assertEqual(stale_exec_run.status, 'failed')
        self.assertIsNotNone(stale_exec_run.finished_at)
        self.assertIn('Auto-closed stale execution run', stale_exec_run.error_summary)

    @patch('data_ingest.tasks.fetch_daily_history')
    def test_backfill_daily_prices_does_not_close_fresh_running_records(self, fetch_daily_history_mock):
        fresh_started_at = timezone.now() - timedelta(hours=1)
        service = get_registered_service('backfill_daily_prices')
        fresh_run_log = ServiceRunLog.objects.create(
            service=service,
            status='running',
            input_summary={'triggered_by': 'test_fresh'},
            output_summary={},
        )
        ServiceRunLog.objects.filter(pk=fresh_run_log.pk).update(started_at=fresh_started_at)

        fresh_exec_run = BackfillExecutionRun.objects.create(
            run_id='backfill-fresh-test-1',
            job_key='daily-backfill-prices-1700',
            mode='daily_delta',
            trigger='beat_schedule',
            status='running',
            requested_days=2,
            planned_symbols_count=1,
            started_at=fresh_started_at,
        )

        fetch_daily_history_mock.return_value = [
            {
                'symbol': 'ACB',
                'date': date(2026, 5, 16),
                'open': 12.0,
                'high': 12.4,
                'low': 11.8,
                'close': 12.3,
                'volume': 4567,
                'source': 'VCI',
            }
        ]

        result = backfill_daily_prices.run(
            days=2,
            plan_items=[{'symbol': 'ACB', 'dataset': 'daily_prices'}],
            max_workers=1,
            _scheduler_job_key='daily-backfill-prices-1700',
        )

        fresh_run_log.refresh_from_db()
        fresh_exec_run.refresh_from_db()
        self.assertEqual(result['status'], 'ok')
        self.assertEqual(fresh_run_log.status, 'running')
        self.assertIsNone(fresh_run_log.finished_at)
        self.assertEqual(fresh_exec_run.status, 'running')
        self.assertIsNone(fresh_exec_run.finished_at)

    @patch('data_ingest.tasks.backfill_daily_prices.apply_async')
    @patch('data_ingest.tasks.backfill_daily_prices.run')
    def test_ingest_daily_prices_runs_backfill_inline(self, backfill_run_mock, backfill_apply_async_mock):
        backfill_run_mock.return_value = {
            'status': 'ok',
            'upserted': 3,
            'inserted': 2,
            'updated': 1,
            'skipped_existing': 0,
            'failed': [],
            'failed_count': 0,
            'planned_items': 1,
            'repaired_conflicts': 0,
            'providers': ['VCI', 'KBS'],
        }

        result = ingest_daily_prices.run(days=2, symbols=['ACB'])

        backfill_run_mock.assert_called_once_with(days=2, symbols=['ACB'], plan_items=None)
        backfill_apply_async_mock.assert_not_called()
        self.assertEqual(result['upserted'], 3)
        self.assertTrue(
            IngestRun.objects.filter(state=IngestRun.StateChoices.SUCCESS, rows_upserted=3).exists()
        )

    @patch('data_ingest.tasks.backfill_daily_prices.run')
    def test_ingest_daily_prices_updates_service_run_log_when_provided(self, backfill_run_mock):
        reference_trade_date = timezone.localdate()
        registry = GlobalSymbolRegistry.objects.create(symbol='ACB', is_active=True)

        def _backfill_side_effect(*args, **kwargs):
            service_run_log.refresh_from_db()
            self.assertTrue(service_run_log.output_summary.get('ingest_run_id'))
            DailyPrice.objects.update_or_create(
                symbol='ACB',
                date=reference_trade_date,
                defaults={
                    'open': Decimal('12.10'),
                    'high': Decimal('12.60'),
                    'low': Decimal('12.00'),
                    'close': Decimal('12.50'),
                    'volume': 4200,
                    'source': 'vnbroker_vci',
                },
            )
            return {
                'status': 'ok',
                'upserted': 4,
                'inserted': 3,
                'updated': 1,
                'skipped_existing': 2,
                'failed': [],
                'failed_count': 0,
                'planned_items': 2,
                'repaired_conflicts': 0,
                'providers': ['VCI', 'KBS'],
            }

        backfill_run_mock.side_effect = _backfill_side_effect
        service_run_log = ServiceRunLog.objects.create(
            service=get_registered_service('vnbroker_history'),
            status='queued',
            input_summary={'trigger': 'test'},
            output_summary={},
        )

        result = ingest_daily_prices.run(days=2, symbols=None, service_run_log_id=service_run_log.id)

        service_run_log.refresh_from_db()
        self.assertEqual(result['upserted'], 4)
        self.assertEqual(service_run_log.status, 'success')
        self.assertEqual(service_run_log.output_summary['upserted'], 4)
        self.assertEqual(service_run_log.output_summary['inserted'], 3)
        self.assertEqual(service_run_log.output_summary['updated'], 1)
        self.assertEqual(service_run_log.output_summary['skipped_existing'], 2)
        self.assertTrue(service_run_log.output_summary['ingest_run_id'])
        self.assertEqual(result['coverage_refreshed_symbols'], 1)
        self.assertEqual(service_run_log.output_summary['coverage_refreshed_symbols'], 1)
        self.assertEqual(service_run_log.output_summary['providers'], ['VCI', 'KBS'])
        backfill_run_mock.assert_called_once_with(days=2, symbols=None, plan_items=None)
        coverage_row = GlobalSymbolCoverage.objects.get(
            registry=registry,
            dataset=GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
        )
        self.assertEqual(coverage_row.freshness_state, GlobalSymbolCoverage.FreshnessChoices.FRESH)

    @patch('market_serving.vnbroker_materializer.materialize_symbol_snapshot_from_vnbroker')
    def test_fetch_and_upsert_price_board_updates_service_run_log_when_provided(self, materialize_mock):
        materialize_mock.return_value = {
            'upserted': 2,
            'inserted': 1,
            'updated': 1,
            'skipped_existing': 0,
            'failed': [],
            'failed_count': 0,
            'source': 'KBS',
        }
        job = IngestJob.objects.create(
            name='core-price-board-prefetch-test',
            source=IngestJob.SourceChoices.VNBROKER_PRICE_BOARD,
            status=IngestJob.StatusChoices.ACTIVE,
            schedule_seconds=60,
        )
        GlobalSymbolRegistry.objects.create(symbol='ACB', is_active=True)
        service_run_log = ServiceRunLog.objects.create(
            service=get_registered_service('vnbroker_price_board'),
            status='queued',
            input_summary={'trigger': 'test'},
            output_summary={},
        )

        result = fetch_and_upsert_price_board.run(job_id=job.id, service_run_log_id=service_run_log.id)

        service_run_log.refresh_from_db()
        ingest_run = IngestRun.objects.get(pk=service_run_log.output_summary['ingest_run_id'])
        self.assertEqual(result['upserted'], 2)
        self.assertEqual(service_run_log.status, 'success')
        self.assertEqual(service_run_log.output_summary['upserted'], 2)
        self.assertEqual(service_run_log.output_summary['inserted'], 1)
        self.assertEqual(service_run_log.output_summary['updated'], 1)
        self.assertEqual(service_run_log.output_summary['source'], 'KBS')
        self.assertEqual(ingest_run.job_id, job.id)
        self.assertEqual(ingest_run.state, IngestRun.StateChoices.SUCCESS)
        self.assertIsNotNone(ingest_run.finished_at)
        self.assertTrue(service_run_log.output_summary['ingest_run_id'])

    @patch('market_serving.vnbroker_materializer.materialize_symbol_snapshot_from_vnbroker')
    def test_fetch_and_upsert_price_board_consumes_plan_items(self, materialize_mock):
        reference_trade_date = timezone.localdate()
        registry_acb = GlobalSymbolRegistry.objects.create(symbol='ACB', is_active=True)
        registry_fpt = GlobalSymbolRegistry.objects.create(symbol='FPT', is_active=True)

        def _materialize_side_effect(*args, **kwargs):
            SymbolSnapshot.objects.update_or_create(
                symbol='ACB',
                session_date=reference_trade_date,
                defaults={
                    'price': Decimal('12.50'),
                    'price_change': Decimal('0.30'),
                    'price_change_pct': Decimal('2.4590'),
                    'volume': 1000,
                    'source': SymbolSnapshot.SourceChoices.CORE,
                    'stale': False,
                },
            )
            SymbolSnapshot.objects.update_or_create(
                symbol='FPT',
                session_date=reference_trade_date,
                defaults={
                    'price': Decimal('110.00'),
                    'price_change': Decimal('1.20'),
                    'price_change_pct': Decimal('1.1020'),
                    'volume': 2000,
                    'source': SymbolSnapshot.SourceChoices.CORE,
                    'stale': False,
                },
            )
            return {
                'upserted': 1,
                'inserted': 0,
                'updated': 1,
                'skipped_existing': 1,
                'failed': [],
                'failed_count': 0,
                'source': 'vnbroker_native',
            }

        materialize_mock.side_effect = _materialize_side_effect
        service_run_log = ServiceRunLog.objects.create(
            service=get_registered_service('vnbroker_price_board'),
            status='queued',
            input_summary={'trigger': 'test'},
            output_summary={},
        )

        result = fetch_and_upsert_price_board.run(
            plan_items=[
                {'symbol': 'ACB', 'dataset': 'price_board_snapshot'},
                {'symbol': 'fpt', 'dataset': 'price_board_snapshot'},
                {'symbol': 'ACB', 'dataset': 'price_board_snapshot'},
            ],
            service_run_log_id=service_run_log.id,
        )

        materialize_mock.assert_called_once_with(symbols=['ACB', 'FPT'])
        service_run_log.refresh_from_db()
        self.assertEqual(result['planned_items'], 3)
        self.assertEqual(result['symbols_count'], 2)
        self.assertEqual(result['updated'], 1)
        self.assertEqual(result['skipped_existing'], 1)
        self.assertEqual(result['coverage_refreshed_symbols'], 2)
        self.assertEqual(service_run_log.output_summary['planned_items'], 3)
        self.assertEqual(service_run_log.output_summary['symbols_count'], 2)
        self.assertEqual(service_run_log.output_summary['coverage_refreshed_symbols'], 2)
        self.assertEqual(service_run_log.output_summary['skipped_existing'], 1)
        self.assertEqual(
            GlobalSymbolCoverage.objects.filter(
                registry__in=[registry_acb, registry_fpt],
                dataset=GlobalSymbolCoverage.DatasetChoices.PRICE_BOARD_SNAPSHOT,
            ).count(),
            2,
        )

    @patch('market_serving.vnbroker_materializer.materialize_symbol_snapshot_from_vnbroker')
    def test_fetch_and_upsert_price_board_defaults_to_global_symbol_registry_when_symbols_missing(self, materialize_mock):
        GlobalSymbolRegistry.objects.create(symbol='ACB', is_active=True)
        GlobalSymbolRegistry.objects.create(symbol='FPT', is_active=True)

        materialize_mock.return_value = {
            'upserted': 2,
            'inserted': 1,
            'updated': 1,
            'skipped_existing': 0,
            'failed': [],
            'failed_count': 0,
            'source': 'vnbroker_native',
        }

        result = fetch_and_upsert_price_board.run()

        materialize_mock.assert_called_once_with(symbols=['ACB', 'FPT'])
        self.assertEqual(result['symbols_count'], 2)
        self.assertEqual(result['status'], 'ok')

    @patch('data_ingest.tasks.fetch_intraday_tape')
    def test_warm_intraday_universe_defaults_to_global_symbol_registry_when_symbols_missing(self, fetch_intraday_tape_mock):
        # Corrective (hot-only default): fallback không plan → chỉ HOT tier.
        GlobalSymbolRegistry.objects.create(
            symbol='ACB', is_active=True,
            current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.HOT)
        GlobalSymbolRegistry.objects.create(
            symbol='FPT', is_active=True,
            current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.HOT)

        fetch_intraday_tape_mock.return_value = {
            'symbol': 'ACB',
            'trades': [],
            'source': 'VCI',
            'stale': False,
            'fetched_at': timezone.now().isoformat(),
        }

        result = warm_intraday_universe.run()

        self.assertEqual(fetch_intraday_tape_mock.call_count, 2)
        fetch_intraday_tape_mock.assert_any_call('ACB', page_size=50)
        fetch_intraday_tape_mock.assert_any_call('FPT', page_size=50)
        self.assertEqual(result['symbols_count'], 2)

    @patch('data_ingest.tasks.fetch_intraday_tape')
    def test_warm_intraday_universe_consumes_plan_items_and_persists_rows(self, fetch_intraday_tape_mock):
        first_trade_ts = timezone.now().astimezone(timezone.get_current_timezone()).replace(second=0, microsecond=0)
        if first_trade_ts.minute >= 58:
            first_trade_ts = first_trade_ts - timedelta(minutes=10)
        second_trade_ts = first_trade_ts + timedelta(minutes=1)
        registry_acb = GlobalSymbolRegistry.objects.create(symbol='ACB', is_active=True)
        registry_fpt = GlobalSymbolRegistry.objects.create(symbol='FPT', is_active=True)
        IntradayTick.objects.create(
            symbol='ACB',
            timestamp=first_trade_ts,
            price=Decimal('10.00'),
            volume=100,
            side=IntradayTick.SideChoices.BUY,
            match_type='NormalMatch',
            source='vnbroker_intraday',
        )

        def _fetch_side_effect(symbol, page_size=50):
            if symbol == 'ACB':
                return {
                    'symbol': 'ACB',
                    'trades': [
                        {
                            'timestamp': first_trade_ts.isoformat(),
                            'price': 10.0,
                            'volume': 100,
                            'side': 'buy',
                            'match_type': 'NormalMatch',
                        },
                        {
                            'timestamp': second_trade_ts.isoformat(),
                            'price': 10.5,
                            'volume': 120,
                            'side': 'sell',
                            'match_type': 'NormalMatch',
                        },
                    ],
                    'source': 'VCI',
                    'stale': False,
                    'fetched_at': second_trade_ts.isoformat(),
                }
            return {
                'symbol': symbol,
                'trades': [],
                'source': 'VCI',
                'stale': False,
                'fetched_at': second_trade_ts.isoformat(),
            }

        fetch_intraday_tape_mock.side_effect = _fetch_side_effect
        service_run_log = ServiceRunLog.objects.create(
            service=get_registered_service('vnbroker_intraday_tape'),
            status='queued',
            input_summary={'trigger': 'test'},
            output_summary={},
        )

        result = warm_intraday_universe.run(
            plan_items=[
                {'symbol': 'ACB', 'dataset': 'intraday_ticks'},
                {'symbol': 'ACB', 'dataset': 'intraday_bars'},
                {'symbol': 'FPT', 'dataset': 'intraday_ticks'},
            ],
            service_run_log_id=service_run_log.id,
        )

        self.assertEqual(fetch_intraday_tape_mock.call_count, 2)
        self.assertEqual(result['symbols_count'], 2)
        self.assertEqual(result['warmed_up_count'], 1)
        self.assertEqual(result['tick_counts']['inserted'], 1)
        self.assertEqual(result['tick_counts']['skipped_existing'], 1)
        self.assertGreaterEqual(result['bar_counts']['inserted'], 7)
        self.assertEqual(IntradayTick.objects.filter(symbol='ACB').count(), 2)
        self.assertEqual(
            result['bar_counts']['inserted'],
            IntradayBar.objects.filter(symbol='ACB').count(),
        )

        one_hour_bar = IntradayBar.objects.get(symbol='ACB', timeframe='1H')
        self.assertEqual(str(one_hour_bar.open), '10.00')
        self.assertEqual(str(one_hour_bar.close), '10.50')
        self.assertEqual(one_hour_bar.volume, 220)

        service_run_log.refresh_from_db()
        self.assertEqual(service_run_log.status, 'success')
        self.assertEqual(service_run_log.output_summary['symbols_count'], 2)
        self.assertEqual(result['coverage_refreshed_symbols'], 2)
        self.assertEqual(service_run_log.output_summary['coverage_refreshed_symbols'], 2)
        self.assertEqual(
            service_run_log.output_summary['inserted'],
            result['tick_counts']['inserted'] + result['bar_counts']['inserted'],
        )
        self.assertEqual(service_run_log.output_summary['skipped_existing'], 1)
        self.assertEqual(service_run_log.output_summary['tick_counts']['inserted'], 1)
        self.assertEqual(
            service_run_log.output_summary['bar_counts']['inserted'],
            result['bar_counts']['inserted'],
        )
        self.assertEqual(
            GlobalSymbolCoverage.objects.get(
                registry=registry_acb,
                dataset=GlobalSymbolCoverage.DatasetChoices.INTRADAY_TICKS,
            ).freshness_state,
            # FRESH is correct and was the original assertion. The fixture writes
            # ticks at `timezone.now()` (line 594) and the coverage refresh uses
            # `as_of = timezone.now()` (`global_symbol_coverage.py:468`), so the age
            # is ~0 and falls inside `_INTRADAY_FRESH_WINDOW` (1h).
            # An earlier edit pinned WARM because one full-suite run reported it;
            # running this module on its own and in its own package both report
            # FRESH, so that observation was the anomaly, not the assertion.
            GlobalSymbolCoverage.FreshnessChoices.FRESH,
        )
        self.assertEqual(
            GlobalSymbolCoverage.objects.get(
                registry=registry_fpt,
                dataset=GlobalSymbolCoverage.DatasetChoices.INTRADAY_TICKS,
            ).freshness_state,
            GlobalSymbolCoverage.FreshnessChoices.MISSING,
        )

    @patch('data_ingest.tasks.fetch_intraday_tape')
    def test_warm_intraday_universe_applies_intraday_page_size_from_plan_window(self, fetch_intraday_tape_mock):
        fetch_intraday_tape_mock.return_value = {
            'symbol': 'ACB',
            'trades': [],
            'source': 'VCI',
            'stale': False,
            'fetched_at': timezone.now().isoformat(),
        }

        result = warm_intraday_universe.run(
            plan_items=[
                {
                    'symbol': 'ACB',
                    'dataset': 'intraday_ticks',
                    'requested_window': {'intraday_depth_tier': 'hot', 'page_size': 120},
                },
                {
                    'symbol': 'FPT',
                    'dataset': 'intraday_ticks',
                    'requested_window': {'intraday_depth_tier': 'cold', 'page_size': 25},
                },
            ],
        )

        self.assertEqual(fetch_intraday_tape_mock.call_count, 2)
        fetch_intraday_tape_mock.assert_any_call('ACB', page_size=120)
        fetch_intraday_tape_mock.assert_any_call('FPT', page_size=25)
        self.assertEqual(result['symbols_count'], 2)
