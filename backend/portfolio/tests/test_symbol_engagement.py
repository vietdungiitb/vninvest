from unittest.mock import MagicMock, patch
from datetime import timedelta

from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone

from portfolio.models import IntradayTick
from portfolio.services_symbol_engagement import activate_symbol_engagement, is_intraday_fresh
from portfolio.tasks_symbol_engagement import warmup_symbol_intraday


class TestSymbolEngagement(TestCase):
    def setUp(self):
        cache.clear()

    @patch('portfolio.market_data_service.market_data_service._get_market_clock_context')
    def test_is_intraday_fresh_market_closed(self, mock_clock):
        # Mock market closed
        mock_clock.return_value = {'profile': 'offhours'}
        assert is_intraday_fresh('VNM') is True

    @patch('portfolio.market_data_service.market_data_service._get_market_clock_context')
    def test_is_intraday_fresh_no_ticks(self, mock_clock):
        # Mock market open
        mock_clock.return_value = {'profile': 'market_open'}
        # No ticks in DB
        assert is_intraday_fresh('VNM') is False

    @patch('portfolio.market_data_service.market_data_service._get_market_clock_context')
    def test_is_intraday_fresh_with_recent_ticks(self, mock_clock):
        mock_clock.return_value = {'profile': 'market_open'}
        now = timezone.localtime(timezone.now())

        # Create 20 ticks within 180s
        ticks = []
        for _ in range(20):
            ticks.append(
                IntradayTick(
                    symbol='VNM',
                    trade_date=now.date(),
                    trade_time=(now - timedelta(seconds=10)).time(),
                    price=100.0,
                    volume=1000,
                    side='BUY',
                )
            )
        IntradayTick.objects.bulk_create(ticks)

        assert is_intraday_fresh('VNM') is True

    @patch('portfolio.tasks_symbol_engagement.warmup_symbol_intraday.apply_async')
    def test_activate_symbol_engagement_guard(self, mock_warmup):
        user_id = 1
        symbol = 'VNM'

        # First call
        activate_symbol_engagement(user_id, symbol, 'test')
        assert mock_warmup.call_count == 1
        assert mock_warmup.call_args.kwargs['queue'] == 'manual_on_demand'

        # Second call within guard window should be ignored
        activate_symbol_engagement(user_id, symbol, 'test')
        assert mock_warmup.call_count == 1

    @patch('portfolio.realtime.collector.collect_intraday_frame')
    @patch('portfolio.services_symbol_engagement.is_intraday_fresh')
    @patch('portfolio.realtime.tick_producer.TickProducer.push_intraday_ticks')
    def test_warmup_task_locking(self, mock_push, mock_fresh, mock_collect):
        mock_fresh.return_value = False
        mock_collect.return_value = MagicMock(empty=False)
        mock_push.return_value = 10

        symbol = 'VNM'

        # Run task
        result = warmup_symbol_intraday(symbol)
        assert result['status'] == 'success'

        # Run again - should skip due to lock
        result2 = warmup_symbol_intraday(symbol)
        assert result2['status'] == 'skipped'
        assert result2['reason'] == 'lock_exists'

    @patch('portfolio.realtime.collector.collect_intraday_frame')
    @patch('portfolio.services_symbol_engagement.is_intraday_fresh')
    def test_warmup_task_direct_db_persist(self, mock_fresh, mock_collect):
        import pandas as pd

        mock_fresh.return_value = False

        # Mock dataframe
        now_ts = timezone.now().strftime('%Y-%m-%dT%H:%M:%SZ')
        df = pd.DataFrame(
            [
                {
                    'ts': now_ts,
                    'price': 100.0,
                    'volume': 500,
                    'side': 'BUY',
                }
            ]
        )
        mock_collect.return_value = df

        symbol = 'VIC'
        warmup_symbol_intraday(symbol)

        # Verify DB record
        assert IntradayTick.objects.filter(symbol=symbol, stream_id='warmup-direct').exists()
