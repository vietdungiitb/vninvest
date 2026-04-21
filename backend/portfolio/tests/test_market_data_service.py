import logging
from datetime import date, timedelta
from decimal import Decimal
from django.test import TestCase
from portfolio.models import DailyPrice
from portfolio.market_data_service import MarketDataService

class MarketDataServiceParityTest(TestCase):
    """Parity tests: service output == kết quả query cũ."""

    FIXTURE_SYMBOLS = ['VNM', 'VCB', 'FPT']

    def setUp(self):
        # Tạo DailyPrice fixtures cố định cho bộ test
        for sym in self.FIXTURE_SYMBOLS:
            for i in range(30):
                DailyPrice.objects.create(
                    symbol=sym,
                    date=date(2026, 3, 1) + timedelta(days=i),
                    close_price=Decimal(str(80000 + i * 100)),
                    open_price=Decimal(str(79000 + i * 100)),
                    high_price=Decimal(str(81000 + i * 100)),
                    low_price=Decimal(str(78000 + i * 100)),
                    volume=1000000 + i * 1000,
                )

    def test_get_latest_snapshot_parity(self):
        """get_latest_snapshot kết quả phải khớp query cũ."""
        old_result = {}
        for sym in self.FIXTURE_SYMBOLS:
            dp = DailyPrice.objects.filter(symbol=sym).order_by('-date').first()
            old_result[sym] = float(dp.close_price)

        new_result = MarketDataService.get_latest_snapshot(self.FIXTURE_SYMBOLS)
        for sym in self.FIXTURE_SYMBOLS:
            self.assertEqual(new_result[sym]['close_price'], old_result[sym])
            self.assertEqual(new_result[sym]['date'], date(2026, 3, 30))

    def test_get_latest_snapshot_empty(self):
        result = MarketDataService.get_latest_snapshot([])
        self.assertEqual(result, {})

    def test_get_latest_snapshot_missing_symbol(self):
        result = MarketDataService.get_latest_snapshot(['NOTEXIST'])
        self.assertNotIn('NOTEXIST', result)

    def test_get_historical_indicators_count(self):
        """Số rows trả về không vượt lookback_days."""
        result = MarketDataService.get_historical_indicators(
            ['VNM'], lookback_days=10
        )
        self.assertLessEqual(len(result['VNM']), 10)
        self.assertEqual(len(result['VNM']), 10)

    def test_get_historical_indicators_sorted_asc(self):
        """Rows được sorted date ASC."""
        result = MarketDataService.get_historical_indicators(
            ['VNM'], lookback_days=30
        )
        dates = [row['date'] for row in result['VNM']]
        self.assertEqual(dates, sorted(dates))

    def test_local_context_cache(self):
        """Local cache được populated sau lần gọi đầu."""
        ctx = {}
        # Lần 1: Cache miss, fetch DB
        MarketDataService.get_latest_snapshot(['VNM'], _local_cache=ctx)
        self.assertIn('latest:VNM', ctx)
        
        # Lần 2: Cache hit
        # Giả lập thay đổi data trong cache
        ctx['latest:VNM']['close_price'] = 999999
        res2 = MarketDataService.get_latest_snapshot(['VNM'], _local_cache=ctx)
        self.assertEqual(res2['VNM']['close_price'], 999999)

    def test_get_ohlcv_batch(self):
        """Kiểm tra fetch batch theo range."""
        start = date(2026, 3, 5)
        end = date(2026, 3, 10)
        result = MarketDataService.get_ohlcv_batch(self.FIXTURE_SYMBOLS, start, end)
        
        for sym in self.FIXTURE_SYMBOLS:
            self.assertEqual(len(result[sym]), 6) # 5,6,7,8,9,10
            self.assertEqual(result[sym][0]['date'], start)
            self.assertEqual(result[sym][-1]['date'], end)
