from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase
from django.utils.dateparse import parse_datetime

from data_ingest.models import IngestRun
from data_ingest.tasks import backfill_daily_prices, fetch_and_upsert_price_board, ingest_daily_prices, warm_intraday_universe
from data_ingest.tasks import _fetch_and_upsert_bucket
from market_data.models import DailyPrice, IntradayBar, IntradayTick, StockProfile
from service_ops.models import ServiceRunLog
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

        fetch_daily_history_mock.assert_called_once_with('ACB', days=3, source='VCI')
        self.assertEqual(result['planned_items'], 1)
        self.assertEqual(result['inserted'], 1)
        self.assertEqual(result['updated'], 1)
        self.assertEqual(result['skipped_existing'], 1)
        self.assertEqual(result['failed_count'], 0)

        updated_row = DailyPrice.objects.get(symbol='ACB', date=date(2026, 5, 15))
        inserted_row = DailyPrice.objects.get(symbol='ACB', date=date(2026, 5, 16))
        self.assertEqual(str(updated_row.close), '12.60')
        self.assertEqual(str(inserted_row.close), '12.70')

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
        backfill_run_mock.return_value = {
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
        service_run_log = ServiceRunLog.objects.create(
            service=get_registered_service('vnbroker_history'),
            status='queued',
            input_summary={'trigger': 'test'},
            output_summary={},
        )

        result = ingest_daily_prices.run(days=2, symbols=['ACB'], service_run_log_id=service_run_log.id)

        service_run_log.refresh_from_db()
        self.assertEqual(result['upserted'], 4)
        self.assertEqual(service_run_log.status, 'success')
        self.assertEqual(service_run_log.output_summary['upserted'], 4)
        self.assertEqual(service_run_log.output_summary['inserted'], 3)
        self.assertEqual(service_run_log.output_summary['updated'], 1)
        self.assertEqual(service_run_log.output_summary['skipped_existing'], 2)
        self.assertEqual(service_run_log.output_summary['providers'], ['VCI', 'KBS'])

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
        StockProfile.objects.create(symbol='ACB', status=StockProfile.StatusChoices.ACTIVE)
        service_run_log = ServiceRunLog.objects.create(
            service=get_registered_service('vnbroker_price_board'),
            status='queued',
            input_summary={'trigger': 'test'},
            output_summary={},
        )

        result = fetch_and_upsert_price_board.run(service_run_log_id=service_run_log.id)

        service_run_log.refresh_from_db()
        self.assertEqual(result['upserted'], 2)
        self.assertEqual(service_run_log.status, 'success')
        self.assertEqual(service_run_log.output_summary['upserted'], 2)
        self.assertEqual(service_run_log.output_summary['inserted'], 1)
        self.assertEqual(service_run_log.output_summary['updated'], 1)
        self.assertEqual(service_run_log.output_summary['source'], 'KBS')

    @patch('market_serving.vnbroker_materializer.materialize_symbol_snapshot_from_vnbroker')
    def test_fetch_and_upsert_price_board_consumes_plan_items(self, materialize_mock):
        materialize_mock.return_value = {
            'upserted': 1,
            'inserted': 0,
            'updated': 1,
            'skipped_existing': 1,
            'failed': [],
            'failed_count': 0,
            'source': 'vnbroker_native',
        }
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
        self.assertEqual(service_run_log.output_summary['planned_items'], 3)
        self.assertEqual(service_run_log.output_summary['symbols_count'], 2)
        self.assertEqual(service_run_log.output_summary['skipped_existing'], 1)

    @patch('data_ingest.tasks.fetch_intraday_tape')
    def test_warm_intraday_universe_consumes_plan_items_and_persists_rows(self, fetch_intraday_tape_mock):
        first_trade_ts = parse_datetime('2026-05-15T09:15:00+07:00')
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
                            'timestamp': '2026-05-15T09:15:00+07:00',
                            'price': 10.0,
                            'volume': 100,
                            'side': 'buy',
                            'match_type': 'NormalMatch',
                        },
                        {
                            'timestamp': '2026-05-15T09:16:00+07:00',
                            'price': 10.5,
                            'volume': 120,
                            'side': 'sell',
                            'match_type': 'NormalMatch',
                        },
                    ],
                    'source': 'VCI',
                    'stale': False,
                    'fetched_at': '2026-05-15T09:16:01+07:00',
                }
            return {
                'symbol': symbol,
                'trades': [],
                'source': 'VCI',
                'stale': False,
                'fetched_at': '2026-05-15T09:16:01+07:00',
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
        self.assertEqual(result['bar_counts']['inserted'], 7)
        self.assertEqual(IntradayTick.objects.filter(symbol='ACB').count(), 2)
        self.assertEqual(IntradayBar.objects.filter(symbol='ACB').count(), 7)

        one_hour_bar = IntradayBar.objects.get(symbol='ACB', timeframe='1H')
        self.assertEqual(str(one_hour_bar.open), '10.00')
        self.assertEqual(str(one_hour_bar.close), '10.50')
        self.assertEqual(one_hour_bar.volume, 220)

        service_run_log.refresh_from_db()
        self.assertEqual(service_run_log.status, 'success')
        self.assertEqual(service_run_log.output_summary['symbols_count'], 2)
        self.assertEqual(service_run_log.output_summary['inserted'], 8)
        self.assertEqual(service_run_log.output_summary['skipped_existing'], 1)
        self.assertEqual(service_run_log.output_summary['tick_counts']['inserted'], 1)
        self.assertEqual(service_run_log.output_summary['bar_counts']['inserted'], 7)
