"""
LED-04 — validator tài chính.

AC1..AC5 của slice:
  AC1 quantity = 150 cho VNM (VN spot) ⇒ lỗi
  AC2 price = 0 cho BUY ⇒ lỗi
  AC3 SELL 2000 khi chỉ giữ 1000 ⇒ **không clamp**, có `warnings[]` +
       `reconciliation_required=True`
  AC4 fee âm ⇒ lỗi
  AC5 mọi lỗi có `field` cụ thể

PB2 hỏi "còn chỗ nào gọi `min()` để clamp không" — xem
`ClampFreeTests.test_holdings_has_no_silent_clamp`: câu trả lời là `holdings.py`
**vẫn còn** `min()` (dòng 215), dùng để giới hạn phần bán được chứ không để
bóp méo con số. Test ghim hành vi đó lại để không ai đổi nhầm.
"""
from __future__ import annotations

import inspect
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.test import SimpleTestCase

from user_workspace.ledger.holdings import compute_ledger
from user_workspace.ledger.validators import (
    VN_SPOT_LOT_SIZE,
    as_drf_validation_error,
    rules_for_market,
    validate_entry,
)


class _Tx:
    def __init__(self, **kwargs):
        self.id = kwargs.get('id', 1)
        self.symbol = kwargs.get('symbol', 'VNM')
        self.transaction_type = kwargs.get('transaction_type', 'BUY')
        self.date = kwargs.get('date')
        self.price = kwargs.get('price', Decimal('0'))
        self.quantity = kwargs.get('quantity', 0)
        self.fee = kwargs.get('fee', Decimal('0'))
        self.tax = kwargs.get('tax', Decimal('0'))
        self.external_id = kwargs.get('external_id', '')


def _codes(result):
    return {e['code'] for e in result['errors']}


def _warning_codes(result):
    return {w['code'] for w in result['warnings']}


class LotSizeTests(SimpleTestCase):
    def test_ac1_odd_lot_on_vn_spot_is_rejected(self):
        result = validate_entry(
            entry_type='BUY', symbol='VNM', quantity=150,
            price=Decimal('70000'), market='VN_SPOT',
        )
        self.assertIn('lot_size_violation', _codes(result))
        self.assertFalse(result['ok'])

    def test_round_lot_is_accepted(self):
        result = validate_entry(
            entry_type='BUY', symbol='VNM', quantity=200,
            price=Decimal('70000'), market='VN_SPOT',
        )
        self.assertTrue(result['ok'])

    def test_lot_size_is_one_hundred(self):
        """Khớp `VN_SPOT_RULES.lotSize` của widget — đổi hằng số ở 1 chỗ."""
        self.assertEqual(VN_SPOT_LOT_SIZE, 100)

    def test_foreign_market_allows_odd_lot(self):
        result = validate_entry(
            entry_type='BUY', symbol='AAPL', quantity=7,
            price=Decimal('180'), market='FOREIGN',
        )
        self.assertTrue(result['ok'])

    def test_crypto_allows_odd_lot(self):
        """D-35: crypto rơi vào `VN_SPOT` là sai. Ở đây nó có market riêng nên
        không nhận luật lô 100 của cổ phiếu Việt."""
        result = validate_entry(
            entry_type='BUY', symbol='BTC', quantity=3,
            price=Decimal('60000'), market='CRYPTO')
        self.assertTrue(result['ok'], result['errors'])

    def test_fractional_quantity_is_rejected(self):
        """`quantity` là BigIntegerField. Cho 0.5 lọt tới đây thì hoặc DB từ
        chối (500), hoặc backend khác làm tròn — cùng một payload, hai hành vi.
        Bắt ở validator để lỗi có `field` và trả 422."""
        result = validate_entry(
            entry_type='BUY', symbol='BTC', quantity='0.5',
            price=Decimal('60000'), market='CRYPTO')
        self.assertIn('quantity_not_integer', _codes(result))

    def test_unknown_market_warns_but_does_not_block(self):
        """Chặn oan lô 100 cho danh mục nhập tay là thiệt hại cho người dùng;
        bỏ qua thì dữ liệu sai lọt vào. Cảnh báo là đáp án trung thực."""
        result = validate_entry(
            entry_type='BUY', symbol='VNM', quantity=150,
            price=Decimal('70000'), market='UNKNOWN',
        )
        self.assertTrue(result['ok'])
        self.assertIn('market_unknown', _warning_codes(result))

    def test_rules_for_unknown_market_do_not_enforce_lot(self):
        rules = rules_for_market('khong-ton-tai')
        self.assertFalse(rules.enforce_lot)


class PriceAndQuantityTests(SimpleTestCase):
    def test_ac2_zero_price_on_buy_is_rejected(self):
        result = validate_entry(
            entry_type='BUY', symbol='VNM', quantity=100, price=Decimal('0'))
        self.assertIn('price_zero', _codes(result))

    def test_zero_price_on_dividend_is_allowed(self):
        """Luật giá > 0 chỉ áp cho MUA/BÁN — cổ tức 0 là chuyện khác."""
        result = validate_entry(
            entry_type='DIVIDEND', symbol='VNM', quantity=1000, price=Decimal('0'))
        self.assertTrue(result['ok'])

    def test_negative_price_is_rejected(self):
        result = validate_entry(
            entry_type='SELL', symbol='VNM', quantity=100, price=Decimal('-1'))
        self.assertIn('price_negative', _codes(result))

    def test_zero_quantity_on_buy_is_rejected(self):
        result = validate_entry(
            entry_type='BUY', symbol='VNM', quantity=0, price=Decimal('70000'))
        self.assertIn('quantity_zero', _codes(result))

    def test_ac4_negative_fee_is_rejected(self):
        result = validate_entry(
            entry_type='BUY', symbol='VNM', quantity=100,
            price=Decimal('70000'), fee=Decimal('-1'))
        self.assertIn('fee_negative', _codes(result))

    def test_negative_tax_is_rejected(self):
        result = validate_entry(
            entry_type='BUY', symbol='VNM', quantity=100,
            price=Decimal('70000'), tax=Decimal('-1'))
        self.assertIn('tax_negative', _codes(result))

    def test_missing_symbol_is_rejected(self):
        result = validate_entry(
            entry_type='BUY', symbol='  ', quantity=100, price=Decimal('70000'))
        self.assertIn('symbol_required', _codes(result))

    def test_unknown_entry_type_is_rejected(self):
        result = validate_entry(
            entry_type='TRADE', symbol='VNM', quantity=100, price=Decimal('70000'))
        self.assertIn('unknown_entry_type', _codes(result))

    def test_ac5_every_error_carries_a_field(self):
        result = validate_entry(
            entry_type='BUY', symbol='', quantity=0, price=Decimal('0'),
            fee=Decimal('-1'),
        )
        self.assertGreaterEqual(len(result['errors']), 4)
        for item in result['errors']:
            self.assertTrue(item['field'], f'error thiếu field: {item}')
            self.assertTrue(item['message'])


class OversellTests(SimpleTestCase):
    """AC3 — điểm quan trọng nhất của LED-04."""

    def test_oversell_is_not_an_error(self):
        """Dòng vẫn phải ghi được — broker đã thực thi, hệ thống không có quyền
        xoá. Từ chối ở đây nghĩa là mất dữ liệu đối soát."""
        result = validate_entry(
            entry_type='SELL', symbol='VNM', quantity=2000,
            price=Decimal('80000'), held_quantity=1000,
        )
        self.assertTrue(result['ok'])
        self.assertTrue(result['reconciliation_required'])

    def test_oversell_reports_the_excess(self):
        result = validate_entry(
            entry_type='SELL', symbol='VNM', quantity=2000,
            price=Decimal('80000'), held_quantity=1000,
        )
        oversell = [w for w in result['warnings'] if w['code'] == 'oversell'][0]
        self.assertEqual(oversell['detail']['excess_quantity'], '1000')
        self.assertEqual(oversell['detail']['held_quantity'], '1000')
        self.assertEqual(oversell['detail']['requested_quantity'], '2000')

    def test_sell_within_holdings_needs_no_reconciliation(self):
        result = validate_entry(
            entry_type='SELL', symbol='VNM', quantity=1000,
            price=Decimal('80000'), held_quantity=1000,
        )
        self.assertFalse(result['reconciliation_required'])

    def test_unknown_holdings_does_not_invent_an_oversell(self):
        """Chưa biết đang giữ bao nhiêu ⇒ không được báo bán vượt."""
        result = validate_entry(
            entry_type='SELL', symbol='VNM', quantity=5000,
            price=Decimal('80000'), held_quantity=None,
        )
        self.assertNotIn('oversell', _warning_codes(result))
        self.assertFalse(result['reconciliation_required'])

    def test_oversell_against_zero_holdings(self):
        result = validate_entry(
            entry_type='SELL', symbol='VNM', quantity=100,
            price=Decimal('80000'), held_quantity=0,
        )
        self.assertTrue(result['reconciliation_required'])


class DrfBridgeTests(SimpleTestCase):
    def test_clean_result_raises_nothing(self):
        result = validate_entry(
            entry_type='BUY', symbol='VNM', quantity=100, price=Decimal('1'))
        self.assertIsNone(as_drf_validation_error(result))

    def test_errors_become_drf_field_errors(self):
        result = validate_entry(
            entry_type='BUY', symbol='VNM', quantity=150, price=Decimal('70000'),
            market='VN_SPOT',
        )
        with self.assertRaises(ValidationError) as ctx:
            as_drf_validation_error(result)
        self.assertIn('quantity', ctx.exception.message_dict)


class ClampFreeTests(SimpleTestCase):
    """PB2 của LED-04, trả lời bằng hành vi quan sát được chứ không bằng grep."""

    def test_holdings_reports_oversell_instead_of_swallowing_it(self):
        rows = [
            _Tx(id=1, transaction_type='BUY', quantity=1000, price=Decimal('70000'),
                date='2026-01-05'),
            _Tx(id=2, transaction_type='SELL', quantity=2000, price=Decimal('80000'),
                date='2026-02-10'),
        ]
        ledger = compute_ledger(rows)
        oversell = [w for w in ledger['warnings'] if w['code'] == 'oversell']
        self.assertTrue(oversell, 'bán vượt phải được báo, không được bóp méo')
        self.assertTrue(ledger['reconciliation_required'])

    def test_holdings_sellable_part_is_still_priced(self):
        """Phần bán được vẫn vào P&L để con số truy vết được — đây là khác biệt
        giữa "giới hạn phạm vi tính" và "clamp im lặng"."""
        rows = [
            _Tx(id=1, transaction_type='BUY', quantity=1000, price=Decimal('70000'),
                date='2026-01-05'),
            _Tx(id=2, transaction_type='SELL', quantity=2000, price=Decimal('80000'),
                date='2026-02-10'),
        ]
        ledger = compute_ledger(rows)
        # 1000 bán được: (80 000 − 70 000) × 1 000 = 10 000 000
        self.assertEqual(ledger['realized_pnl'], Decimal('10000000.00'))
        self.assertNotIn('VNM', ledger['holdings'])

    def test_min_is_still_present_but_only_bounds_the_sellable_part(self):
        """Ghi lại sự thật thay vì xoá `min()`: nó còn ở `holdings.py`, và việc
        xoá nó sẽ làm phần bán vượt được tính vào P&L — sai theo hướng khác."""
        source = inspect.getsource(compute_ledger)
        self.assertIn('min(qty, position[\'quantity\'])', source)
