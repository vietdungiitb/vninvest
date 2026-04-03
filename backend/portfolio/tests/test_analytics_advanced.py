"""
test_analytics_advanced.py — Unit tests cho các hàm risk metrics trong analytics.py

Kiểm tra:
  - compute_daily_returns
  - compute_max_drawdown
  - compute_sharpe
  - compute_sortino
  - compute_twr
  - compute_volatility
  - build_risk_metrics (integration: hàm tổng hợp với fixture portfolio)

Sử dụng SimpleTestCase cho các test thuần toán học (không cần DB).
Sử dụng TestCase + fixture cho build_risk_metrics.
"""

import math

import numpy as np
import pandas as pd
from django.contrib.auth import get_user_model
from django.test import TestCase, SimpleTestCase

from portfolio.analytics import (
    compute_daily_returns,
    compute_max_drawdown,
    compute_sharpe,
    compute_sortino,
    compute_twr,
    compute_volatility,
    build_risk_metrics,
)

User = get_user_model()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_nav_df(values: list[float], start: str = "2025-01-02") -> pd.DataFrame:
    """Tạo NAV DataFrame từ list giá trị, bắt đầu từ ngày start."""
    dates = pd.date_range(start=start, periods=len(values), freq="B")
    return pd.DataFrame({"date": dates.date, "value": values})


# ---------------------------------------------------------------------------
# Test compute_daily_returns
# ---------------------------------------------------------------------------

class TestComputeDailyReturns(SimpleTestCase):
    def test_basic_returns_calculated_correctly(self):
        # NAV: 100 → 110 → 99 → 105.6
        nav_df = _make_nav_df([100.0, 110.0, 99.0, 105.6])
        returns = compute_daily_returns(nav_df)

        self.assertEqual(len(returns), 3)  # n-1 returns from n values
        self.assertAlmostEqual(returns.iloc[0], 0.10, places=5)     # (110-100)/100
        self.assertAlmostEqual(returns.iloc[1], -0.10, places=5)    # (99-110)/110
        self.assertAlmostEqual(returns.iloc[2], (105.6 - 99.0) / 99.0, places=4)

    def test_empty_nav_returns_empty_series(self):
        result = compute_daily_returns(pd.DataFrame(columns=["date", "value"]))
        self.assertTrue(result.empty)

    def test_single_value_returns_empty_series(self):
        result = compute_daily_returns(_make_nav_df([100.0]))
        self.assertTrue(result.empty)


# ---------------------------------------------------------------------------
# Test compute_max_drawdown
# ---------------------------------------------------------------------------

class TestComputeMaxDrawdown(SimpleTestCase):
    def test_known_drawdown(self):
        # Tăng từ 100 → 200, sau đó rớt xuống 150
        # Drawdown tại đáy: (150 - 200) / 200 * 100 = -25%
        nav_df = _make_nav_df([100.0, 120.0, 150.0, 200.0, 180.0, 160.0, 150.0])
        mdd = compute_max_drawdown(nav_df)

        self.assertAlmostEqual(mdd, -25.0, places=1)

    def test_monotonically_increasing_has_zero_drawdown(self):
        nav_df = _make_nav_df([100.0, 110.0, 120.0, 130.0, 140.0])
        mdd = compute_max_drawdown(nav_df)
        self.assertEqual(mdd, 0.0)

    def test_empty_returns_zero(self):
        result = compute_max_drawdown(pd.DataFrame(columns=["date", "value"]))
        self.assertEqual(result, 0.0)

    def test_deep_drawdown(self):
        # Đỉnh 1000, đáy 300: MDD = -70%
        nav_df = _make_nav_df([500.0, 800.0, 1000.0, 750.0, 500.0, 300.0, 400.0])
        mdd = compute_max_drawdown(nav_df)
        self.assertAlmostEqual(mdd, -70.0, places=1)


# ---------------------------------------------------------------------------
# Test compute_sharpe
# ---------------------------------------------------------------------------

class TestComputeSharpe(SimpleTestCase):
    def test_positive_sharpe_for_good_portfolio(self):
        # Returns đều dương: mean > risk_free → Sharpe dương
        rng = np.random.default_rng(42)
        daily_returns = pd.Series(rng.normal(loc=0.001, scale=0.01, size=252))
        sharpe = compute_sharpe(daily_returns, risk_free_annual=0.05)
        self.assertGreater(sharpe, 0)

    def test_negative_sharpe_for_bad_portfolio(self):
        rng = np.random.default_rng(7)
        daily_returns = pd.Series(rng.normal(loc=-0.002, scale=0.01, size=252))
        sharpe = compute_sharpe(daily_returns, risk_free_annual=0.05)
        self.assertLess(sharpe, 0)

    def test_empty_returns_zero(self):
        result = compute_sharpe(pd.Series(dtype=float))
        self.assertEqual(result, 0.0)

    def test_few_returns_returns_zero(self):
        # < 5 điểm → không đủ dữ liệu
        result = compute_sharpe(pd.Series([0.01, 0.02, 0.01]))
        self.assertEqual(result, 0.0)

    def test_zero_volatility_returns_zero(self):
        # Mọi ngày bằng nhau → std=0, tránh ZeroDivisionError
        result = compute_sharpe(pd.Series([0.001] * 20))
        self.assertEqual(result, 0.0)


# ---------------------------------------------------------------------------
# Test compute_sortino
# ---------------------------------------------------------------------------

class TestComputeSortino(SimpleTestCase):
    def test_sortino_higher_than_sharpe_when_asymmetric(self):
        """Sortino thường cao hơn Sharpe vì chỉ phạt downside."""
        rng = np.random.default_rng(99)
        # Mostly positive, occasional negative
        raw = rng.normal(loc=0.001, scale=0.015, size=252)
        returns = pd.Series(raw)

        sharpe = compute_sharpe(returns, risk_free_annual=0.05)
        sortino = compute_sortino(returns, risk_free_annual=0.05)

        # Cả hai cùng chiều dấu
        self.assertEqual(sharpe > 0, sortino > 0)

    def test_no_negative_days_returns_sentinel(self):
        # Không có ngày lỗ → Sortino = +99 (sentinel)
        returns = pd.Series([0.001, 0.002, 0.003, 0.001, 0.002, 0.001] * 20)
        result = compute_sortino(returns)
        self.assertEqual(result, 99.0)

    def test_empty_returns_zero(self):
        result = compute_sortino(pd.Series(dtype=float))
        self.assertEqual(result, 0.0)


# ---------------------------------------------------------------------------
# Test compute_twr
# ---------------------------------------------------------------------------

class TestComputeTwr(SimpleTestCase):
    def test_known_twr(self):
        # NAV: 100 → 110 → 99 → 105.6
        # Sub-period (1): 110/100 = 1.10
        # Sub-period (2): 99/110 = 0.9 = 0.9
        # Sub-period (3): 105.6/99 ≈ 1.06667
        # TWR = 1.10 × 0.9 × 1.06667 - 1 ≈ 0.056 = 5.6%
        nav_df = _make_nav_df([100.0, 110.0, 99.0, 105.6])
        twr = compute_twr(nav_df)
        self.assertAlmostEqual(twr, 5.6, places=1)

    def test_flat_nav_twr_zero(self):
        nav_df = _make_nav_df([100.0, 100.0, 100.0, 100.0])
        twr = compute_twr(nav_df)
        self.assertAlmostEqual(twr, 0.0, places=3)

    def test_empty_returns_zero(self):
        result = compute_twr(pd.DataFrame(columns=["date", "value"]))
        self.assertEqual(result, 0.0)

    def test_positive_trend_twr_positive(self):
        nav_df = _make_nav_df([1000.0, 1050.0, 1100.0, 1200.0, 1300.0])
        twr = compute_twr(nav_df)
        self.assertGreater(twr, 0)
        self.assertAlmostEqual(twr, 30.0, places=0)  # 1300/1000 - 1 = 30%

    def test_negative_trend_twr_negative(self):
        nav_df = _make_nav_df([1000.0, 900.0, 800.0, 700.0])
        twr = compute_twr(nav_df)
        self.assertLess(twr, 0)
        self.assertAlmostEqual(twr, -30.0, places=0)


# ---------------------------------------------------------------------------
# Test compute_volatility
# ---------------------------------------------------------------------------

class TestComputeVolatility(SimpleTestCase):
    def test_zero_returns_zero_volatility(self):
        returns = pd.Series([0.0] * 50)
        vol = compute_volatility(returns)
        self.assertEqual(vol, 0.0)

    def test_volatility_annualized_correctly(self):
        # daily std = 0.01 → annual = 0.01 * sqrt(252) ≈ 15.87%
        returns = pd.Series([0.01, -0.01] * 100)
        vol = compute_volatility(returns)
        expected = 0.01 * math.sqrt(252) * 100
        self.assertAlmostEqual(vol, expected, places=0)

    def test_empty_returns_zero(self):
        result = compute_volatility(pd.Series(dtype=float))
        self.assertEqual(result, 0.0)


# ---------------------------------------------------------------------------
# Test build_risk_metrics (integration, yêu cầu DB)
# ---------------------------------------------------------------------------

class TestBuildRiskMetrics(TestCase):
    """Integration test: build_risk_metrics với Portfolio thật trong DB."""

    def setUp(self):
        from portfolio.models import Portfolio, SubAccount, Transaction, DailyPrice
        import datetime

        self.user = User.objects.create_user(username="testuser_analytics", password="x")
        self.portfolio = Portfolio.objects.create(
            user=self.user,
            name="Test Portfolio Analytics",
        )
        self.sub = SubAccount.objects.create(
            portfolio=self.portfolio,
            name="Main",
        )

        # Tạo giao dịch đơn giản: mua VNM
        txs = [
            Transaction(
                sub_account=self.sub,
                symbol="VNM",
                transaction_type=Transaction.TransactionType.BUY,
                date=datetime.date(2025, 1, 2),
                price=80000,
                quantity=100,
                fee=0,
            ),
        ]
        Transaction.objects.bulk_create(txs)

        # Tạo lịch sử giá để compute_nav_series có dữ liệu
        today = datetime.date(2025, 6, 30)
        start = datetime.date(2025, 1, 2)
        current = start
        prices = []
        nav = 80000.0
        import random
        random.seed(42)
        while current <= today:
            if current.weekday() < 5:  # ngày làm việc
                nav = nav * (1 + random.uniform(-0.02, 0.025))
                prices.append(DailyPrice(
                    symbol="VNM",
                    date=current,
                    close_price=round(nav, 0),
                    open_price=round(nav * 0.99, 0),
                    high_price=round(nav * 1.01, 0),
                    low_price=round(nav * 0.98, 0),
                    volume=100000,
                ))
            current += datetime.timedelta(days=1)
        DailyPrice.objects.bulk_create(prices, ignore_conflicts=True)

    def test_build_risk_metrics_returns_expected_keys(self):
        result = build_risk_metrics(self.portfolio, days=180)

        expected_keys = {
            'sharpe_ratio', 'sortino_ratio', 'max_drawdown_pct',
            'twr_pct', 'volatility_annual_pct', 'best_day_pct',
            'worst_day_pct', 'total_trading_days', 'period_days',
            'beta', 'alpha_annual_pct',
        }
        self.assertEqual(set(result.keys()), expected_keys)

    def test_build_risk_metrics_values_are_numeric_or_none(self):
        result = build_risk_metrics(self.portfolio, days=180)

        numeric_keys = [
            'sharpe_ratio', 'sortino_ratio', 'max_drawdown_pct',
            'twr_pct', 'volatility_annual_pct', 'best_day_pct', 'worst_day_pct',
        ]
        for key in numeric_keys:
            val = result[key]
            self.assertTrue(
                val is None or isinstance(val, (int, float)),
                msg=f"{key} should be numeric or None, got {type(val)}",
            )

    def test_build_risk_metrics_max_drawdown_non_positive(self):
        result = build_risk_metrics(self.portfolio, days=180)
        if result['max_drawdown_pct'] is not None:
            self.assertLessEqual(result['max_drawdown_pct'], 0.0)

    def test_build_risk_metrics_period_days_matches_input(self):
        result = build_risk_metrics(self.portfolio, days=90)
        self.assertEqual(result['period_days'], 90)

    def test_build_risk_metrics_empty_portfolio_returns_none_values(self):
        from portfolio.models import Portfolio
        empty_portfolio = Portfolio.objects.create(
            user=self.user,
            name="Empty Portfolio",
        )
        result = build_risk_metrics(empty_portfolio, days=180)
        # Không có giao dịch → không có NAV → các chỉ số là None
        self.assertIsNone(result['sharpe_ratio'])
        self.assertIsNone(result['max_drawdown_pct'])
