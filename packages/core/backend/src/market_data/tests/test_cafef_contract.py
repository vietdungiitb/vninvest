"""C1 contract cho nguồn CafeF (TDD RED trước khi có implementation).

Control biết đáp án: TPB 04/01/2022 lấy từ export XLSX CafeF thật
(xem docs/evidence/widget-news-events/TPB_OLD_BARS_ADJUSTMENT_REVERIFY_20261124.md).
"""
from datetime import date
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.test import SimpleTestCase, TestCase

from market_data.cafef.contract import (
    CAFEF_COLUMNS,
    EXCHANGES,
    normalize_row,
    parse_request_date,
    parse_response_date,
)


TPB_ROW_0401 = {
    'Mã': 'TPB',
    'Ngày': '04/01/2022',
    'Giá đóng cửa': 42.75,
    'Giá điều chỉnh': 17.94,
    'Thay đổi': '+1,65 (+4,01%)',
    'Khối lượng khớp lệnh': 11034900,
    'Giá trị khớp lệnh': 467.26,
    'Khối lượng thỏa thuận': 0,
    'Giá trị thỏa thuận': 0.0,
    'Giá mở cửa': 41.5,
    'Giá cao nhất': 43.25,
    'Giá thấp nhất': 41.3,
}


class CafefContractTests(SimpleTestCase):
    def test_columns_and_exchanges(self):
        self.assertEqual(len(CAFEF_COLUMNS), 12)
        self.assertEqual(CAFEF_COLUMNS[0], 'Mã')
        self.assertEqual(CAFEF_COLUMNS[-1], 'Giá thấp nhất')
        self.assertEqual(EXCHANGES, ('HOSE', 'HNX', 'UPCOM'))

    def test_request_date_is_mm_dd_yyyy(self):
        self.assertEqual(parse_request_date('12/31/2022'), date(2022, 12, 31))
        with self.assertRaises(ValueError):
            parse_request_date('31/12/2022')

    def test_response_date_is_dd_mm_yyyy(self):
        self.assertEqual(parse_response_date('30/12/2022'), date(2022, 12, 30))
        with self.assertRaises(ValueError):
            parse_response_date('12/30/2022')

    def test_golden_normalize_tpb_0401(self):
        row = normalize_row('TPB', TPB_ROW_0401)
        self.assertEqual(row['symbol'], 'TPB')
        self.assertEqual(row['date'], date(2022, 1, 4))
        self.assertEqual(row['close_raw'], Decimal('42750.00'))
        self.assertEqual(row['close_adjusted'], Decimal('17940.00'))
        self.assertEqual(row['open_raw'], Decimal('41500.00'))
        self.assertEqual(row['high_raw'], Decimal('43250.00'))
        self.assertEqual(row['low_raw'], Decimal('41300.00'))
        self.assertEqual(row['volume'], 11034900)
        self.assertEqual(row['value'], 467260000000)
        self.assertEqual(row['source'], 'cafef')
        # 3 cột bị drop
        for key in ('Thay đổi', 'Khối lượng thỏa thuận', 'Giá trị thỏa thuận'):
            self.assertNotIn(key, row)

    def test_golden_swap_guard_tpb_0104(self):
        raw = dict(TPB_ROW_0401)
        raw['Ngày'] = '01/04/2022'
        raw['Giá đóng cửa'] = 41.25
        row = normalize_row('TPB', raw)
        self.assertEqual(row['date'], date(2022, 4, 1))
        self.assertEqual(row['close_raw'], Decimal('41250.00'))


class CafefDailyPriceModelTests(TestCase):
    def test_unique_symbol_date_and_source_default(self):
        from market_data.models import CafefDailyPrice

        payload = dict(
            symbol='TPB',
            date=date(2022, 1, 4),
            close_raw=Decimal('42750.00'),
            close_adjusted=Decimal('17940.00'),
            open_raw=Decimal('41500.00'),
            high_raw=Decimal('43250.00'),
            low_raw=Decimal('41300.00'),
            volume=11034900,
            value=467260000000,
        )
        row = CafefDailyPrice.objects.create(**payload)
        self.assertEqual(row.source, 'cafef')
        self.assertEqual(CafefDailyPrice.objects.count(), 1)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                CafefDailyPrice.objects.create(**payload)
