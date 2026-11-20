"""Task 2 — parse số tiền/tỉ lệ từ tiêu đề sự kiện VCI (fail-before)."""
from decimal import Decimal

from django.test import SimpleTestCase

from market_data.corporate_actions.parser import parse_event_title


class ParseEventTitleTests(SimpleTestCase):
    def test_parse_cash_with_comma_and_dot(self):
        result = parse_event_title('Trả cổ tức bằng tiền mặt - Đợt 1 2024 - 1,500 VND', 'DIV')
        self.assertEqual(result.cash_amount, Decimal('1500'))
        self.assertIsNone(result.stock_ratio_pct)
        self.assertEqual(result.status, 'parsed_from_text')
        self.assertFalse(result.ambiguous_cash_pct)
        self.assertIsInstance(result.cash_amount, Decimal)

    def test_parse_cash_with_dot_thousands(self):
        result = parse_event_title('Trả cổ tức bằng tiền mặt - Đợt 2 2024 - 2.000 VND', 'DIV')
        self.assertEqual(result.cash_amount, Decimal('2000'))

    def test_parse_stock_ratio(self):
        result = parse_event_title('Phát hành cổ phiếu - Cổ phiếu thưởng tỉ lệ 50.0%', 'ISS')
        self.assertEqual(result.stock_ratio_pct, Decimal('50.0'))
        self.assertIsNone(result.cash_amount)
        self.assertEqual(result.status, 'parsed_from_text')

    def test_div_percent_is_ambiguous_not_stock_ratio(self):
        result = parse_event_title('Trả cổ tức bằng tiền mặt - tỉ lệ 20%', 'DIV')
        self.assertIsNone(result.cash_amount)
        self.assertIsNone(result.stock_ratio_pct)
        self.assertTrue(result.ambiguous_cash_pct)
        self.assertEqual(result.status, 'unparsed')

    def test_unparsed_titles(self):
        for title in ('Phát hành cổ phiếu - Phát hành cho CBCNV', 'Phát hành cổ phiếu - Phát hành riêng lẻ'):
            result = parse_event_title(title, 'ISS')
            self.assertIsNone(result.cash_amount)
            self.assertIsNone(result.stock_ratio_pct)
            self.assertEqual(result.status, 'unparsed')
