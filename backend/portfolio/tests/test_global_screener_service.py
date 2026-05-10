from unittest.mock import patch
from datetime import time

from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone

from portfolio.models import GlobalScreenerRule, IntradayTick, OrderFlowSignal, ScreenerScheduleConfig
from portfolio.services_global_screener import GlobalScreenerService
from portfolio.tasks_global_screener import run_global_screener_scheduled_task


class GlobalScreenerServiceTests(TestCase):
    def tearDown(self):
        cache.clear()

    @patch('portfolio.services_global_screener.MarketDataService.get_universe_symbols', return_value=['VCB', 'FPT'])
    @patch('portfolio.services_global_screener.MarketDataService.get_latest_snapshot')
    @patch('portfolio.services_global_screener.MarketDataService.get_historical_indicators')
    def test_precompute_market_snapshot_and_match_active_rules(self, mock_hist, mock_latest, mock_universe):
        today = timezone.localdate()
        mock_latest.return_value = {
            'VCB': {'date': today.isoformat(), 'close_price': 120000, 'volume': 1000, 'open_price': 119000, 'high_price': 121000, 'low_price': 118000},
            'FPT': {'date': today.isoformat(), 'close_price': 90000, 'volume': 1200, 'open_price': 89000, 'high_price': 91000, 'low_price': 88000},
        }
        mock_hist.return_value = {
            'VCB': [
                {'date': (today).isoformat(), 'close_price': 118000, 'volume': 900, 'high_price': 119000, 'low_price': 117000},
                {'date': today.isoformat(), 'close_price': 120000, 'volume': 1000, 'high_price': 121000, 'low_price': 118000},
            ],
            'FPT': [
                {'date': (today).isoformat(), 'close_price': 88000, 'volume': 1100, 'high_price': 89000, 'low_price': 87000},
                {'date': today.isoformat(), 'close_price': 90000, 'volume': 1200, 'high_price': 91000, 'low_price': 88000},
            ],
        }

        IntradayTick.objects.create(
            symbol='VCB',
            trade_date=today,
            trade_time=time(10, 15),
            price=120000,
            volume=10_000,
            side=IntradayTick.Side.BUY,
        )
        IntradayTick.objects.create(
            symbol='VCB',
            trade_date=today,
            trade_time=time(10, 30),
            price=121000,
            volume=2_000,
            side=IntradayTick.Side.SELL,
        )
        OrderFlowSignal.objects.create(
            symbol='VCB',
            signal_type=OrderFlowSignal.SignalType.ABSORPTION,
            strength=83,
            confidence='high',
            tick_rate=4,
            small_order_ratio=0.12,
            cvd_at_signal=1_500_000_000,
            price_at_signal=120000,
            window_seconds=300,
            components_json={'absorption': {'cvd_change': 1_500_000_000}},
            severity=OrderFlowSignal.SeverityChoices.URGENT,
            trade_date=today,
        )

        GlobalScreenerRule.objects.create(
            name='Close > 100k',
            rules_json=[{'field': 'close', 'op': 'gt', 'value': 100000}],
        )
        GlobalScreenerRule.objects.create(
            name='Whale intensity strong',
            rules_json=[{'field': 'whale_intensity', 'op': 'gte', 'value': 80}],
        )

        snapshot = GlobalScreenerService.precompute_market_snapshot()
        matched_symbols = GlobalScreenerService.match_active_rules(snapshot=snapshot)

        vcb_row = next(row for row in snapshot['rows'] if row['symbol'] == 'VCB')

        self.assertEqual(snapshot['symbol_count'], 2)
        self.assertEqual(cache.get(GlobalScreenerService.CACHE_KEY)['symbol_count'], 2)
        self.assertEqual(vcb_row['whale_buy_value'], 1_200_000_000.0)
        self.assertEqual(vcb_row['whale_sell_value'], 242_000_000.0)
        self.assertEqual(vcb_row['whale_trade_count'], 2)
        self.assertEqual(vcb_row['dark_flow_signal_count'], 1)
        self.assertEqual(vcb_row['dark_flow_strength'], 83.0)
        self.assertGreater(vcb_row['whale_intensity'], 0)
        self.assertEqual(vcb_row['flow_snapshot']['dark_flow']['strength'], 83.0)
        self.assertEqual(matched_symbols, ['VCB'])

    def test_scheduled_task_can_be_disabled_by_config(self):
        ScreenerScheduleConfig.objects.create(is_user_custom_screener_enabled=False)

        result = run_global_screener_scheduled_task()

        self.assertEqual(result['status'], 'skipped')
        self.assertEqual(result['matched_symbols'], [])

    @patch('portfolio.tasks_global_screener._broadcast_screener_matched')
    @patch('portfolio.tasks_global_screener.auto_generate_advisories_for_all_tracked.apply_async')
    @patch('portfolio.services_global_screener.GlobalScreenerService.match_active_rules', return_value=['FPT', 'VCB'])
    @patch('portfolio.services_global_screener.GlobalScreenerService.precompute_market_snapshot')
    def test_scheduled_task_broadcasts_each_matched_symbol(self, mock_precompute, mock_match, mock_auto_generate, mock_broadcast):
        mock_precompute.return_value = {
            'generated_at': '2026-04-28T09:00:00+07:00',
            'symbol_count': 2,
            'rows': [],
        }
        mock_broadcast.side_effect = [
            {'status': 'ok', 'symbol': 'FPT', 'audience_count': 2, 'history_count': 2, 'broadcast_count': 2},
            {'status': 'ok', 'symbol': 'VCB', 'audience_count': 1, 'history_count': 1, 'broadcast_count': 1},
        ]

        result = run_global_screener_scheduled_task()

        self.assertEqual(result['matched_symbols'], ['FPT', 'VCB'])
        self.assertEqual(result['screener_audience_count'], 3)
        self.assertEqual(result['screener_history_count'], 3)
        self.assertEqual(result['screener_broadcast_count'], 3)
        self.assertEqual(result['auto_generation_queue_count'], 2)
        self.assertEqual(mock_broadcast.call_count, 2)
        mock_auto_generate.assert_called_once_with(kwargs={'matched_symbols': ['FPT', 'VCB']}, countdown=0)
