"""
LED-03 — NAV engine.

AC1 của LED-03 bắt buộc: **3 case tính tay, dán bảng số vào tài liệu và vào
test**. Ba bảng dưới đây là bảng đó. Số được kiểm bằng `Decimal` chứ không
phải so sánh "gần đúng", vì 1 đồng là 1 đồng.

    NAV = stock_value + cash − debt
    cash = opening_balance + Σ CashFlow.amount
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from django.test import SimpleTestCase

from user_workspace.ledger.valuation import (
    CALCULATION_VERSION,
    NAV_REASON_NO_OPENING_BALANCE,
    compute_nav,
    sum_cash_flows,
    to_decimal,
)


class _Flow:
    """CashFlow giả — engine không truy vấn DB nên test được không cần Postgres."""

    def __init__(self, amount):
        self.amount = amount


def _flows(*amounts):
    return [_flow for _flow in (_Flow(Decimal(str(a))) for a in amounts)]


# ══════════════════════════════════════════════════════════════════
# 3 case tính tay
# ══════════════════════════════════════════════════════════════════


class HandCalculatedNavTests(SimpleTestCase):
    """Bảng "tính tay vs hệ thống" — bắt buộc dán vào evidence (LED-03 §7)."""

    # ── Case 1: chỉ mua, không bán ──────────────────────────────────
    # 2026-01-05  MUA 1 000 VNM @ 70 000, phí 100 000
    #             tiền ra = 1 000×70 000 + 100 000 = 70 100 000
    # Mở đầu (nạp tiền trước khi hệ thống ghi) = 100 000 000
    # 2026-03-31  giá 75 000 ⇒ stock_value = 1 000×75 000 = 75 000 000
    #             cash = 100 000 000 − 70 100 000          = 29 900 000
    #             NAV  = 75 000 000 + 29 900 000 − 0        = 104 900 000
    def test_case1_nav_simple_long(self):
        result = compute_nav(
            stock_value=Decimal('75000000'),
            cash_flow_total=sum_cash_flows(_flows(-Decimal('70100000'))),
            opening_balance=Decimal('100000000'),
            debt=Decimal('0'),
        )
        self.assertEqual(result['cash'], Decimal('29900000.00'))
        self.assertEqual(result['nav'], Decimal('104900000.00'))
        self.assertEqual(result['nav_reason'], '')

    # ── Case 2: có bán, đã thực hiện P&L ───────────────────────────
    # Mở đầu = 100 000 000
    # 2026-01-05  MUA 1 000 @ 70 000, phí 100 000  → -70 100 000
    # 2026-02-10  BÁN  400 @ 80 000, phí  50 000  → +32 000 000 −  50 000
    #                                             = +31 950 000
    #             cash = 100 000 000 − 70 100 000 + 31 950 000 = 61 850 000
    #             còn 600 cổ phiếu, giá 75 000 ⇒ stock_value = 45 000 000
    #             NAV = 45 000 000 + 61 850 000            = 106 850 000
    def test_case2_nav_with_realized_pnl(self):
        result = compute_nav(
            stock_value=Decimal('45000000'),
            cash_flow_total=sum_cash_flows(
                _flows(-Decimal('70100000'), Decimal('31950000'))
            ),
            opening_balance=Decimal('100000000'),
            debt=Decimal('0'),
        )
        self.assertEqual(result['cash'], Decimal('61850000.00'))
        self.assertEqual(result['nav'], Decimal('106850000.00'))

    # ── Case 3: phí + thuế + cổ tức ───────────────────────────────
    # Mở đầu = 100 000 000
    # 2026-01-05  MUA 1 000 @ 70 000, phí 100 000, thuế 0    → -70 100 000
    # 2026-03-20  CỔ TỨC 1 000 cổ × 1 500/cổ, thuế 5% = 75 000
    #              gross = 1 500 000 ; thuế 75 000 ; thực nhận 1 425 000
    # 2026-03-31  BÁN 1 000 @ 75 000, phí 100 000, thuế 750 000
    #              proceeds 75 000 000 − 800 000 = 74 200 000
    # cash = 100 000 000 − 70 100 000 + 1 425 000 + 74 200 000 = 105 525 000
    # stock_value = 0 (đã bán hết)
    # NAV = 0 + 105 525 000 − 0 = 105 525 000
    def test_case3_nav_with_fees_and_tax(self):
        result = compute_nav(
            stock_value=Decimal('0'),
            cash_flow_total=sum_cash_flows(_flows(
                -Decimal('70100000'),   # mua + phí
                Decimal('1425000'),     # cổ tức 1 500 000 − thuế 5% 75 000
                Decimal('74200000'),    # bán 75 000 000 − phí 100 000 − thuế 750 000
            )),
            opening_balance=Decimal('100000000'),
            debt=Decimal('0'),
        )
        self.assertEqual(result['cash'], Decimal('105525000.00'))
        self.assertEqual(result['nav'], Decimal('105525000.00'))

    def test_debt_is_subtracted(self):
        """LED-03 PB3 hỏi margin thì sao — trả lời bằng công thức, chứ không đoán."""
        result = compute_nav(
            stock_value=Decimal('100000000'),
            cash_flow_total=sum_cash_flows(_flows()),
            opening_balance=Decimal('0'),
            debt=Decimal('30000000'),
        )
        self.assertEqual(result['nav'], Decimal('70000000.00'))


# ══════════════════════════════════════════════════════════════════
# Không bao giờ trả 0 giả
# ══════════════════════════════════════════════════════════════════


class NoFakeZeroNavTests(SimpleTestCase):
    def test_missing_opening_balance_gives_null_and_reason(self):
        """AC2 + AC4: null + lý do, KHÔNG phải 0."""
        result = compute_nav(
            stock_value=Decimal('75000000'),
            cash_flow_total=sum_cash_flows(_flows(-Decimal('70000000'))),
            opening_balance=None,
        )
        self.assertIsNone(result['nav'])
        self.assertEqual(result['nav_reason'], NAV_REASON_NO_OPENING_BALANCE)
        self.assertTrue(result['nav_reason_text'])
        self.assertIsNone(result['cash'])

    def test_zero_opening_balance_is_a_real_answer(self):
        """Phân biệt quan trọng: số dư mở đầu = 0 là một sự thật, khác với
        "chưa biết". Nếu gộp hai thứ này thì không bao giờ biết lúc nào số 0
        là thật."""
        result = compute_nav(
            stock_value=Decimal('1000000'),
            cash_flow_total=sum_cash_flows(_flows()),
            opening_balance=Decimal('0'),
        )
        self.assertEqual(result['nav'], Decimal('1000000.00'))
        self.assertEqual(result['nav_reason'], '')

    def test_nothing_ever_returns_integer_zero_for_missing_data(self):
        for missing in (None,):
            result = compute_nav(
                stock_value=Decimal('0'),
                cash_flow_total=sum_cash_flows(_flows()),
                opening_balance=missing,
            )
            self.assertIsNone(result['nav'])

    def test_rounding_is_half_up_to_two_decimals(self):
        result = compute_nav(
            stock_value=Decimal('1000.005'),
            cash_flow_total=sum_cash_flows(_flows()),
            opening_balance=Decimal('0'),
        )
        self.assertEqual(result['nav'], Decimal('1000.01'))


# ══════════════════════════════════════════════════════════════════
# Dòng tiền
# ══════════════════════════════════════════════════════════════════


class CashFlowSumTests(SimpleTestCase):
    def test_signed_amounts_sum(self):
        self.assertEqual(
            sum_cash_flows(_flows(-100, 250, -25)), Decimal('125'))

    def test_empty_flows_is_zero_not_none(self):
        """Tổng của rỗng là 0 — đây là số học, không phải "thiếu dữ liệu"."""
        self.assertEqual(sum_cash_flows([]), Decimal('0'))

    def test_generator_is_consumed_once(self):
        gen = (a for a in _flows(-100, 200))
        self.assertEqual(sum_cash_flows(gen), Decimal('100'))

    def test_string_amounts_from_cache_are_accepted(self):
        """Dữ liệu lấy từ cache là string — Decimal(str(x)) xử lý được."""
        self.assertEqual(to_decimal('1234.50'), Decimal('1234.50'))


class CalculationVersionTests(SimpleTestCase):
    def test_version_is_reported(self):
        result = compute_nav(
            stock_value=Decimal('1'), cash_flow_total=Decimal('0'),
            opening_balance=Decimal('0'),
        )
        self.assertEqual(result['calculation_version'], CALCULATION_VERSION)

    def test_currency_defaults_to_vnd(self):
        """D-05."""
        result = compute_nav(
            stock_value=Decimal('1'), cash_flow_total=Decimal('0'),
            opening_balance=Decimal('0'),
        )
        self.assertEqual(result['currency'], 'VND')
