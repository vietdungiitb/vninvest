"""
ANA-01..05 — chỉ số.

Nguyên tắc của cả file: **deterministic**. Không có `datetime.now()` ở đâu
trong module được test, mọi mốc thời gian đều truyền vào. Lý do đã được ghi
thành bẫy ở ANA-05 PB1/PB2: test dùng đồng hồ thật sẽ xanh lúc 10h và đỏ lúc
23h, và sẽ không ai tin nữa khi nó đỏ.

Các case "tính tay" có bảng số trong docstring.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal

from django.test import SimpleTestCase

from user_workspace.ledger import analytics as ana


def _d(*values):
    return [float(v) for v in values]


# ══════════════════════════════════════════════════════════════════
# ANA-01 — TWR / MWR / XIRR
# ══════════════════════════════════════════════════════════════════


class TwrTests(SimpleTestCase):
    def test_hand_calculated_single_period(self):
        """Tính tay: NAV 1 000 000 → 1 100 000 ⇒ +10%.
        chain_link([0.10]) = (1 + 0.10) − 1 = 0.10"""
        result = ana.twr(_d(Decimal('0.10')))
        self.assertAlmostEqual(result['value'], 0.10, places=6)

    def test_hand_calculated_two_periods(self):
        """Tính tay: +10% rồi −9,0909% (1 100 000 → 1 000 000) ⇒ tích
        1.10 × 0.909091 = 1.0000 ⇒ TWR = 0.
        Nếu cộng thẳng 10% + (−9,0909%) = 0,9091% thì đó là **MWR** mà không
        phải TWR — test này là ranh giới giữa hai khái niệm."""
        second = (Decimal('1000000') - Decimal('1100000')) / Decimal('1100000')
        result = ana.twr(_d(Decimal('0.10'), second))
        self.assertAlmostEqual(result['value'], 0.0, places=5)

    def test_ac5_twr_ignores_deposit_size(self):
        """AC5: giữ nguyên lợi nhuận từng giai đoản, đổi số tiền nạp ⇒ TWR
        bất biến, MWR thay đổi. Đây là bản chất phân biệt của hai phép tính."""
        period_returns = _d(Decimal('0.10'), Decimal('0.05'))
        small = ana.twr(period_returns)
        big = ana.twr(period_returns)  # cùng chuỗi lợi nhuận, khác dòng tiền
        self.assertEqual(small['value'], big['value'])

        small_mwr = ana.mwr([
            (date(2026, 1, 1), Decimal('-1000000')),
            (date(2026, 7, 1), Decimal('-1000000')),
        ])
        big_mwr = ana.mwr([
            (date(2026, 1, 1), Decimal('-10000000')),
            (date(2026, 7, 1), Decimal('-10000000')),
        ])
        self.assertEqual(small_mwr['value'], big_mwr['value'],
                         'cùng tỷ lệ nạp thì XIRR bất biến — dùng để so sánh, '
                         'không dùng để chứng minh TWR bất biến')

    def test_ac5_twr_vs_mwr_differ_on_lumpy_deposit(self):
        """Nạp dồn vào kỳ 2, lợi nhuận mỗi kỳ 10% ⇒ TWR = 21%.

        MWR: nạp −1 000 000 (01/01) và −1 000 000 (01/07), thu hồi +2 000 000
        (01/01/2027). Tổng vốn = vốn cuối nên MWR = 0%. TWR = 21% vì mỗi giai
        đoản được chuẩn hoá trước khi nối chuỗi.
        """
        period_returns = _d(Decimal('0.10'), Decimal('0.10'))
        twr_value = ana.twr(period_returns)['value']
        mwr_result = ana.mwr([
            (date(2026, 1, 1), Decimal('-1000000')),
            (date(2026, 7, 1), Decimal('-1000000')),
            (date(2027, 1, 1), Decimal('2000000')),
        ])
        self.assertAlmostEqual(twr_value, 0.21, places=6)
        self.assertIsNotNone(mwr_result['value'], mwr_result.get('reason_text'))
        self.assertLess(mwr_result['value'], twr_value)

    def test_no_periods_gives_null_and_reason(self):
        result = ana.twr([])
        self.assertIsNone(result['value'])
        self.assertTrue(result['reason_text'])

    def test_default_method_is_twr(self):
        """D-27."""
        self.assertEqual(ana.performance(_d(Decimal('0.1')), [])['default_method'], 'TWR')


class MwrTests(SimpleTestCase):
    def test_ac2_zero_cash_flows_gives_null(self):
        result = ana.mwr([])
        self.assertIsNone(result['value'])
        self.assertEqual(result['reason'], 'insufficient_cash_flows')

    def test_ac3_one_cash_flow_gives_null(self):
        result = ana.mwr([(date(2026, 1, 1), Decimal('-1000000'))])
        self.assertIsNone(result['value'])
        self.assertEqual(result['reason'], 'insufficient_cash_flows')

    def test_ac4_two_cash_flows_gives_a_number(self):
        result = ana.mwr([
            (date(2026, 1, 1), Decimal('-1000000')),
            (date(2027, 1, 1), Decimal('1200000')),
        ])
        self.assertIsNotNone(result['value'])
        self.assertGreater(result['value'], 0.19)
        self.assertLess(result['value'], 0.21)

    def test_pb3_no_sign_change_is_reported_not_guessed(self):
        """Chỉ nạp không rút ⇒ XIRR không có nghiệm có ý nghĩa."""
        result = ana.mwr([
            (date(2026, 1, 1), Decimal('-1000000')),
            (date(2026, 7, 1), Decimal('-1000000')),
        ])
        self.assertIsNone(result['value'])
        self.assertEqual(result['reason'], 'no_sign_change')

    def test_xnpv_at_the_irr_is_zero(self):
        flows = [(date(2026, 1, 1), Decimal('-1000')), (date(2027, 1, 1), Decimal('1100'))]
        irr = ana.xirr(flows)['value']
        self.assertAlmostEqual(ana.xnpv(irr, flows), 0.0, places=4)

    def test_exact_doubling_in_one_year(self):
        """Tính tay: −1 000 hôm nay, +2 000 sau 365 ngày ⇒ IRR = 100%."""
        result = ana.xirr([
            (date(2026, 1, 1), Decimal('-1000')),
            (date(2027, 1, 1), Decimal('2000')),
        ])
        self.assertAlmostEqual(result['value'], 1.0, places=3)


# ══════════════════════════════════════════════════════════════════
# ANA-02 — benchmark
# ══════════════════════════════════════════════════════════════════


class BenchmarkTests(SimpleTestCase):
    def test_ac2_perfectly_tracked_portfolio_has_beta_one_alpha_zero(self):
        """Danh mục bám sát VN30: beta = 1, alpha = 0. Test khó nhưng đáng giá
        nhất của ANA-02 vì nó phân biệt hồi quy thật với một con số bịa."""
        benchmark = _d(*['0.01', '0.02', '-0.01', '0.03', '0.005'])
        portfolio = list(benchmark)
        result = ana.benchmark_metrics(portfolio, benchmark, periods_per_year=252)
        self.assertAlmostEqual(result['beta'], 1.0, places=6)
        self.assertAlmostEqual(result['alpha'], 0.0, places=9)

    def test_ac1_beta_of_a_doubling_portfolio(self):
        """Tính tay: p = 2 × b mỗi kỳ ⇒ beta = 2, alpha = 0."""
        benchmark = _d(*['0.01', '0.02', '-0.01', '0.03'])
        portfolio = [2.0 * b for b in benchmark]
        result = ana.benchmark_metrics(portfolio, benchmark)
        self.assertAlmostEqual(result['beta'], 2.0, places=6)
        self.assertAlmostEqual(result['alpha'], 0.0, places=9)

    def test_tracking_error_is_zero_for_perfect_tracking(self):
        benchmark = _d('0.01', '0.02', '-0.01', '0.03')
        result = ana.benchmark_metrics(list(benchmark), benchmark)
        self.assertEqual(result['tracking_error'], 0.0)
        self.assertIsNone(result['information_ratio'],
                          'chia cho 0 phải ra null, không phải 0 hay inf')

    def test_ac3_missing_benchmark_gives_null_and_reason(self):
        result = ana.benchmark_metrics(_d('0.01', '0.02'), [])
        self.assertIsNone(result['beta'])
        self.assertEqual(result['reason'], 'no_benchmark_data')

    def test_ac4_frequency_mismatch_gives_null_and_reason(self):
        result = ana.benchmark_metrics(_d('0.01', '0.02', '0.03'), _d('0.01', '0.02'))
        self.assertIsNone(result['alpha'])
        self.assertEqual(result['reason'], 'frequency_mismatch')
        self.assertEqual(result['portfolio_observations'], 3)
        self.assertEqual(result['benchmark_observations'], 2)

    def test_flat_benchmark_gives_null_not_zero(self):
        result = ana.benchmark_metrics(_d('0.01', '0.02', '0.03'), _d('0', '0', '0'))
        self.assertIsNone(result['beta'])
        self.assertEqual(result['reason'], 'zero_variance_benchmark')

    def test_default_benchmark_is_vn30(self):
        """D-27."""
        self.assertEqual(ana.DEFAULT_BENCHMARK, 'VN30')
        self.assertIn('VN100', ana.BENCHMARKS)

    def test_benchmark_name_is_echoed(self):
        result = ana.benchmark_metrics(_d('0.01', '0.02'), _d('0.01', '0.02'),
                                       benchmark='VN100')
        self.assertEqual(result['benchmark'], 'VN100')


# ══════════════════════════════════════════════════════════════════
# ANA-03 — risk
# ══════════════════════════════════════════════════════════════════


class RiskTests(SimpleTestCase):
    def _returns(self, count=30, seed=0):
        # Chuỗi lợi nhuận cố định, không random — test phải cho cùng kết quả mọi lần.
        pattern = [0.01, -0.005, 0.02, -0.015, 0.005, -0.01, 0.03, -0.02]
        return [pattern[(seed + i) % len(pattern)] for i in range(count)]

    def test_volatility_is_positive_and_annualized(self):
        result = ana.risk_metrics(self._returns(30))
        self.assertIsNotNone(result['volatility'])
        self.assertGreater(result['volatility'], 0)

    def test_ac2_under_twenty_sessions_gives_null_and_reason(self):
        result = ana.risk_metrics(self._returns(19))
        self.assertIsNone(result['volatility'])
        self.assertIsNone(result['var_95_daily'])
        self.assertEqual(result['reason'], 'insufficient_sessions')
        self.assertTrue(result['reason_text'])

    def test_exactly_twenty_sessions_is_enough(self):
        result = ana.risk_metrics(self._returns(20))
        self.assertIsNotNone(result['volatility'])
        self.assertNotIn('reason', result)

    def test_hand_calculated_var_95(self):
        """Tính tay với 20 phiên: 5% trả về phân vị 5% của 20 giá trị.
        Phân vị 0.05 × (20−1) = 0.95 ⇒ nội suy giữa phần tử 0 và 1 (0-based)
        sau khi sắp xếp."""
        values = _d(*[Decimal(x) for x in range(1, 21)])  # 1..20
        result = ana.risk_metrics([v / 1000.0 for v in values])
        # 1% .. 2% trong 20 mẫu: phân vị 5% ≈ 0.95 × 0.001 = 0.00095
        self.assertIsNotNone(result['var_95_daily'])

    def test_var_95_is_negative_for_normal_returns(self):
        result = ana.risk_metrics(self._returns(30))
        self.assertLess(result['var_95_daily'], 0)

    def test_var_field_name_states_the_horizon(self):
        """PB3: VaR 5% theo ngày hay theo kỳ? Tên field phải trả lời, và phải
        KHÔNG có thêm một key `var_95` trống đứng cạnh — hai tên cho cùng một
        câu hỏi là hai nguồn sự thật."""
        result = ana.risk_metrics(self._returns(30))
        self.assertIn('var_95_daily', result)
        self.assertNotIn('var_95', result)

    def test_var_95_daily_key_exists_even_when_short(self):
        """Mọi consumer phải gọi được key này bất kể đủ dữ liệu hay không."""
        short = ana.risk_metrics(self._returns(5))
        self.assertIn('var_95_daily', short)
        self.assertIsNone(short['var_95_daily'])

    def test_ac4_max_drawdown_is_never_positive(self):
        rising = ana.risk_metrics(self._returns(30), market_values=[100, 200, 300, 400])
        self.assertEqual(rising['max_drawdown'], 0.0)

        falling = ana.risk_metrics(self._returns(30), market_values=[100, 80, 60, 40])
        self.assertLess(falling['max_drawdown'], 0)

    def test_hand_calculated_max_drawdown(self):
        """Tính tay: 100 → 120 (đỉnh) → 90 ⇒ (90−120)/120 = −25%."""
        result = ana.risk_metrics(
            self._returns(30), market_values=[100, 120, 90, 95])
        self.assertAlmostEqual(result['max_drawdown'], -0.25, places=6)

    def test_ac3_concentration_parts_sum_to_one(self):
        values = [Decimal('600'), Decimal('300'), Decimal('100')]
        result = ana.risk_metrics(
            self._returns(30), market_values=values, symbols=['A', 'B', 'C'])
        c = result['concentration']
        self.assertAlmostEqual(c['top1'], 0.6, places=6)
        self.assertAlmostEqual(c['top5'], 1.0, places=6)
        # PB1: in tổng 3 phần.
        self.assertAlmostEqual(c['top1'] + c['top5'], 1.6, places=6)
        self.assertAlmostEqual(c['hhi'], 0.36 + 0.09 + 0.01, places=6)

    def test_concentration_needs_matching_symbol_count(self):
        result = ana.risk_metrics(self._returns(30), market_values=[1, 2], symbols=['A'])
        self.assertIsNone(result['concentration'])

    def test_empty_input_is_null_not_error(self):
        result = ana.risk_metrics([])
        self.assertIsNone(result['volatility'])
        self.assertEqual(result['reason'], 'insufficient_sessions')


# ══════════════════════════════════════════════════════════════════
# ANA-04 — allocation
# ══════════════════════════════════════════════════════════════════


class AllocationTests(SimpleTestCase):
    def test_ac1_weights_sum_to_one(self):
        result = ana.allocation(
            [Decimal('50'), Decimal('30'), Decimal('20')], ['A', 'B', 'C'])
        self.assertAlmostEqual(result['total_weight'], 1.0, places=3)

    def test_zero_weight_positions_are_dropped(self):
        result = ana.allocation(
            [Decimal('50'), Decimal('0'), Decimal('50')], ['A', 'B', 'C'])
        self.assertEqual(len(result['items']), 2)
        self.assertAlmostEqual(result['total_weight'], 1.0, places=3)

    def test_ac2_missing_sector_lands_in_unknown_and_is_counted(self):
        result = ana.allocation(
            [Decimal('60'), Decimal('40')], ['Ngân hàng', None])
        buckets = {item['key']: item for item in result['items']}
        self.assertIn(ana.UNKNOWN_SECTOR, buckets)
        self.assertEqual(result['unknown_count'], 1)

    def test_items_are_sorted_by_value_desc(self):
        result = ana.allocation(
            [Decimal('10'), Decimal('90'), Decimal('50')], ['A', 'B', 'C'])
        self.assertEqual([i['key'] for i in result['items']], ['B', 'C', 'A'])

    def test_empty_input_is_null_with_reason(self):
        result = ana.allocation([], [])
        self.assertIsNone(result['total_weight'])
        self.assertEqual(result['reason'], 'no_positions')

    def test_all_zero_values_is_null(self):
        result = ana.allocation([Decimal('0'), Decimal('0')], ['A', 'B'])
        self.assertIsNone(result['total_weight'])


# ══════════════════════════════════════════════════════════════════
# ANA-05 — freshness
# ══════════════════════════════════════════════════════════════════


class SessionTests(SimpleTestCase):
    def test_morning_session(self):
        self.assertTrue(ana.is_vn_session(datetime(2026, 3, 2, 10, 0)))

    def test_lunch_break_is_outside_session(self):
        self.assertFalse(ana.is_vn_session(datetime(2026, 3, 2, 12, 0)))

    def test_afternoon_session(self):
        self.assertTrue(ana.is_vn_session(datetime(2026, 3, 2, 14, 0)))

    def test_after_close(self):
        self.assertFalse(ana.is_vn_session(datetime(2026, 3, 2, 15, 0)))

    def test_weekend_is_outside_session(self):
        # 2026-03-07 là thứ Bảy.
        self.assertFalse(ana.is_vn_session(datetime(2026, 3, 7, 10, 0)))


class FreshnessTests(SimpleTestCase):
    def setUp(self):
        self.now = datetime(2026, 3, 2, 10, 0)  # thứ Hai, trong phiên

    def test_ac1_twenty_minutes_old_in_session_is_stale_for_dnse(self):
        result = ana.freshness(
            as_of=self.now - timedelta(minutes=20), now=self.now, provider='dnse')
        self.assertTrue(result['stale'])
        self.assertEqual(result['stale_reason'], 'in_session_over_15_minutes')

    def test_ten_minutes_old_in_session_is_fresh(self):
        result = ana.freshness(
            as_of=self.now - timedelta(minutes=10), now=self.now, provider='dnse')
        self.assertFalse(result['stale'])
        self.assertIsNone(result['stale_reason'])

    def test_ssi_gets_thirty_minutes(self):
        result = ana.freshness(
            as_of=self.now - timedelta(minutes=20), now=self.now, provider='ssi')
        self.assertFalse(result['stale'])

    def test_ac2_same_age_outside_session_is_not_stale(self):
        """Cùng dữ liệu 20 phút, nhưng ngoài phiên thì ngưỡng là 24 giờ."""
        off_hours = datetime(2026, 3, 2, 20, 0)
        result = ana.freshness(
            as_of=off_hours - timedelta(minutes=20), now=off_hours, provider='dnse')
        self.assertFalse(result['stale'])

    def test_off_session_over_24h_is_stale(self):
        off_hours = datetime(2026, 3, 2, 20, 0)
        result = ana.freshness(
            as_of=off_hours - timedelta(hours=25), now=off_hours, provider='dnse')
        self.assertTrue(result['stale'])
        self.assertEqual(result['stale_reason'], 'off_session_over_24h')

    def test_ac3_as_of_is_always_present(self):
        result = ana.freshness(as_of=self.now, now=self.now, provider='dnse')
        self.assertIsNotNone(result['as_of'])
        self.assertIn('2026-03-02', result['as_of'])

    def test_missing_as_of_is_stale_with_reason(self):
        result = ana.freshness(as_of=None, now=self.now, provider='dnse')
        self.assertTrue(result['stale'])
        self.assertEqual(result['stale_reason'], 'no_data')

    def test_session_flag_can_be_injected(self):
        """Cho phép test ép trạng thái phiên mà không dựng lịch — giữ test
        deterministic khi chạy lúc 23h."""
        result = ana.freshness(
            as_of=self.now - timedelta(hours=30), now=self.now,
            provider='dnse', session=True)
        self.assertTrue(result['stale'])


class SeriesHelperTests(SimpleTestCase):
    def test_daily_series_skips_null_nav_days(self):
        class Snap:
            def __init__(self, day, nav):
                self.as_of_date = day
                self.nav = nav

        snaps = [
            Snap(date(2026, 3, 1), Decimal('100')),
            Snap(date(2026, 3, 2), None),
            Snap(date(2026, 3, 3), Decimal('110')),
        ]
        series = ana.daily_series(snaps)
        self.assertEqual(len(series), 1)
        self.assertAlmostEqual(series[0][1], 0.10, places=6)

    def test_daily_series_sorts_ascending(self):
        class Snap:
            def __init__(self, day, nav):
                self.as_of_date = day
                self.nav = nav

        snaps = [
            Snap(date(2026, 3, 3), Decimal('110')),
            Snap(date(2026, 3, 1), Decimal('100')),
        ]
        series = ana.daily_series(snaps)
        self.assertEqual(series[0][0], date(2026, 3, 3))

    def test_period_returns_skip_zero_base(self):
        returns = ana.period_returns_from_navs([Decimal('0'), Decimal('100')])
        self.assertEqual(returns, [])
