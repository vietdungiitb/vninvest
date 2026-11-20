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

    def test_esop_percent_is_ambiguous_not_stock_ratio(self):
        # C-02: probe FPT 3.7.2 — "Phát hành cho CBCNV tỉ lệ 0.5%/0.2%" là ESOP,
        # không phải cổ phiếu thưởng làm đổi giá niêm yết.
        for percent in ('0.5%', '0.2%'):
            title = f'Phát hành cổ phiếu - Phát hành cho CBCNV tỉ lệ {percent}'
            result = parse_event_title(title, 'ISS')
            self.assertIsNone(result.cash_amount)
            self.assertIsNone(result.stock_ratio_pct)
            self.assertEqual(result.status, 'unparsed')
            self.assertTrue(result.ambiguous_ratio_pct)

    def test_tra_co_tuc_bang_co_phieu_still_parsed(self):
        # VCB 2025-03-12 — cụm "Trả Cổ tức bằng Cổ phiếu" mới là stock ratio.
        result = parse_event_title(
            'Phát hành cổ phiếu - Trả Cổ tức bằng Cổ phiếu tỉ lệ 49.5%', 'ISS'
        )
        self.assertEqual(result.stock_ratio_pct, Decimal('49.5'))
        self.assertEqual(result.status, 'parsed_from_text')
        self.assertFalse(result.ambiguous_ratio_pct)

    def test_div_with_cash_and_percent_never_gets_stock_ratio(self):
        # F-NEW-1: title DIV vừa tiền vừa % — tiền đã rõ, % trên mệnh giá không
        # được gán vào stock_ratio_pct (sẽ cộng nhầm denominator ở engine).
        result = parse_event_title('Trả cổ tức bằng tiền mặt tỉ lệ 20% - 1,500 VND', 'DIV')
        self.assertEqual(result.cash_amount, Decimal('1500'))
        self.assertIsNone(result.stock_ratio_pct)
        self.assertEqual(result.status, 'parsed_from_text')
