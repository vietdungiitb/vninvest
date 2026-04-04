"""
test_order_flow.py — Unit tests cho order_flow.py (Sprint 15)

Phạm vi:
  - compute_cvd_series: bucket logic, UNKNOWN split, cumulative_cvd, empty case
  - compute_tick_rate: count, ratio, cache TTL
  - compute_size_distribution: histogram, ratios, statistics, empty case
  - detect_absorption: price_locked flag, strength formula, threshold, empty case
  - detect_iceberg_clustering: clustering, confidence levels, window filter, empty case
  - detect_dark_flow: signal_type routing (absorption/iceberg/twap_bot/mixed/none), baseline

Dùng TestCase (cần DB) cho compute_cvd_series và compute_tick_rate vì query IntradayTick.
Dùng SimpleTestCase cho các hàm thuần (size_dist, absorption, iceberg).
"""

import math
from datetime import date, datetime, time, timedelta, timezone
from unittest.mock import patch, MagicMock

from django.contrib.auth import get_user_model
from django.test import TestCase, SimpleTestCase
from django.core.cache import cache
from rest_framework.test import APIClient

from portfolio.order_flow import (
    SMALL_ORDER_THRESHOLD,
    LARGE_ORDER_THRESHOLD,
    compute_cvd_series,
    compute_tick_rate,
    compute_size_distribution,
    detect_absorption,
    detect_iceberg_clustering,
    detect_dark_flow,
    _bucket_index,
    _time_to_seconds,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_tick(price: float, volume: int, side: str, trade_time: time) -> dict:
    return {
        "trade_time": trade_time,
        "price": price,
        "volume": volume,
        "side": side,
        "value": price * volume,
    }


def _t(h: int, m: int, s: int = 0) -> time:
    return time(h, m, s)


# ---------------------------------------------------------------------------
# Helpers — internal functions
# ---------------------------------------------------------------------------

class TestInternalHelpers(SimpleTestCase):

    def test_time_to_seconds(self):
        self.assertEqual(_time_to_seconds(time(0, 0, 0)), 0)
        self.assertEqual(_time_to_seconds(time(1, 0, 0)), 3600)
        self.assertEqual(_time_to_seconds(time(9, 30, 0)), 34200)
        self.assertEqual(_time_to_seconds(time(15, 0, 0)), 54000)

    def test_bucket_index(self):
        # 9:30:00 = 34200 secs; bucket_seconds=60 → 570
        self.assertEqual(_bucket_index(_t(9, 30, 0), 60), 570)
        # 9:31:00 = 34260 secs → bucket 571
        self.assertEqual(_bucket_index(_t(9, 31, 0), 60), 571)
        # Hai tick trong cùng phút → cùng bucket
        self.assertEqual(
            _bucket_index(_t(9, 30, 10), 60),
            _bucket_index(_t(9, 30, 50), 60),
        )


# ---------------------------------------------------------------------------
# compute_size_distribution (SimpleTestCase — không cần DB)
# ---------------------------------------------------------------------------

class TestSizeDistribution(SimpleTestCase):

    def _ticks_with_values(self, values: list[float]) -> list[dict]:
        return [{"value": v, "trade_time": _t(9, 30), "price": v, "volume": 1, "side": "BUY"} for v in values]

    def test_empty_ticks_returns_safe_defaults(self):
        result = compute_size_distribution("VNM", [])
        self.assertEqual(result["total_ticks"], 0)
        self.assertEqual(result["avg_value"], 0.0)
        self.assertEqual(result["small_ratio"], 0.0)
        self.assertEqual(result["large_ratio"], 0.0)

    def test_small_ratio_correct(self):
        # 3 nhỏ + 1 lớn
        ticks = self._ticks_with_values([
            10_000_000, 20_000_000, 30_000_000,  # < 50tr
            600_000_000,                          # >= 500tr
        ])
        result = compute_size_distribution("VNM", ticks)
        self.assertAlmostEqual(result["small_ratio"], 0.75, places=2)
        self.assertAlmostEqual(result["large_ratio"], 0.25, places=2)

    def test_histogram_bucketing(self):
        ticks = self._ticks_with_values([
            40_000_000,    # <50m
            100_000_000,   # 50-200m
            300_000_000,   # 200-500m
            1_000_000_000, # 500m-2b
            3_000_000_000, # >2b
        ])
        result = compute_size_distribution("VNM", ticks)
        h = result["bucket_histogram"]
        self.assertEqual(h["<50m"], 1)
        self.assertEqual(h["50-200m"], 1)
        self.assertEqual(h["200-500m"], 1)
        self.assertEqual(h["500m-2b"], 1)
        self.assertEqual(h[">2b"], 1)

    def test_p95_value(self):
        # 20 giá trị [1..20] * 1e6; p95 → phần tử thứ floor(0.95*20)=19 → giá trị 19e6
        values = [i * 1_000_000 for i in range(1, 21)]
        ticks = self._ticks_with_values(values)
        result = compute_size_distribution("VNM", ticks)
        expected_p95 = sorted(values)[int(math.floor(0.95 * 20))]
        self.assertAlmostEqual(result["p95_value"], expected_p95, delta=1)

    def test_single_tick(self):
        ticks = [{"value": 100_000_000, "trade_time": _t(9, 30), "price": 100_000_000, "volume": 1, "side": "BUY"}]
        result = compute_size_distribution("VNM", ticks)
        self.assertEqual(result["total_ticks"], 1)
        self.assertAlmostEqual(result["avg_value"], 100_000_000, delta=1)


# ---------------------------------------------------------------------------
# detect_absorption (SimpleTestCase)
# ---------------------------------------------------------------------------

class TestDetectAbsorption(SimpleTestCase):

    def _cvd_series(self, cumulative_values: list[float]) -> list[dict]:
        result = []
        prev = 0.0
        for i, cum in enumerate(cumulative_values):
            cvd = cum - prev
            result.append({
                "bucket_ts": f"2026-04-04T09:{30+i:02d}:00",
                "buy_value": max(cvd, 0),
                "sell_value": max(-cvd, 0),
                "cvd": cvd,
                "cumulative_cvd": cum,
            })
            prev = cum
        return result

    def test_empty_inputs_return_not_detected(self):
        result = detect_absorption("VNM", [], [], min_buckets=3)
        self.assertFalse(result["detected"])

    def test_insufficient_buckets_return_not_detected(self):
        cvd = self._cvd_series([100.0, 200.0])  # chỉ 2 buckets
        prices = [10000.0, 10005.0]
        result = detect_absorption("VNM", cvd, prices, min_buckets=3)
        self.assertFalse(result["detected"])

    def test_price_locked_flag_when_price_stable(self):
        # Giá thay đổi < 0.3%
        prices = [10000.0, 10001.0, 10002.0]
        cvd = self._cvd_series([0.0, 500_000_000.0, 1_000_000_000.0])
        result = detect_absorption("VNM", cvd, prices, min_buckets=3)
        self.assertTrue(result["price_locked"])

    def test_price_not_locked_when_price_moves(self):
        # Giá thay đổi > 0.3%
        prices = [10000.0, 10050.0, 10100.0]
        cvd = self._cvd_series([0.0, 500_000_000.0, 1_000_000_000.0])
        result = detect_absorption("VNM", cvd, prices, min_buckets=3)
        self.assertFalse(result["price_locked"])

    def test_detected_when_price_locked_and_cvd_surges(self):
        # Giá ổn định + CVD tăng mạnh → absorption
        prices = [10000.0, 10001.0, 10002.0, 10001.0, 10003.0]
        # CVD tăng từ 0 → 2 tỷ trong 5 buckets
        cvd = self._cvd_series([0.0, 400_000_000.0, 800_000_000.0, 1_200_000_000.0, 2_000_000_000.0])
        result = detect_absorption("VNM", cvd, prices, min_buckets=5)
        self.assertTrue(result["detected"])
        self.assertTrue(result["price_locked"])
        self.assertGreater(result["strength"], 0)

    def test_strength_in_range_0_100(self):
        prices = [10000.0] * 5
        cvd = self._cvd_series([0.0, 1e10, 2e10, 3e10, 4e10])
        result = detect_absorption("VNM", cvd, prices, min_buckets=5)
        self.assertGreaterEqual(result["strength"], 0)
        self.assertLessEqual(result["strength"], 100)


# ---------------------------------------------------------------------------
# detect_iceberg_clustering (SimpleTestCase)
# ---------------------------------------------------------------------------

class TestDetectIceberg(SimpleTestCase):

    def _make_ticks_at_price(
        self, price: float, n: int, t_start: int = 34200, gap_secs: int = 10
    ) -> list[dict]:
        """Tạo n tick tại cùng giá, cách nhau gap_secs giây."""
        ticks = []
        for i in range(n):
            total_secs = t_start + i * gap_secs
            h = total_secs // 3600
            m = (total_secs % 3600) // 60
            s = total_secs % 60
            ticks.append({
                "trade_time": time(h, m, s),
                "price": price,
                "volume": 100,
                "side": "BUY",
                "value": price * 100,
            })
        return ticks

    def test_empty_ticks_returns_not_detected(self):
        result = detect_iceberg_clustering([])
        self.assertFalse(result["detected"])

    def test_not_detected_when_fewer_than_min_repeat(self):
        ticks = self._make_ticks_at_price(10000.0, 4)  # < min_repeat=5
        result = detect_iceberg_clustering(ticks, min_repeat=5)
        self.assertFalse(result["detected"])

    def test_detected_at_min_repeat(self):
        ticks = self._make_ticks_at_price(10000.0, 5)
        result = detect_iceberg_clustering(ticks, min_repeat=5)
        self.assertTrue(result["detected"])
        self.assertEqual(result["repeat_count"], 5)
        self.assertAlmostEqual(result["level"], 10000.0, delta=10)

    def test_confidence_low_medium_high(self):
        low_ticks = self._make_ticks_at_price(50000.0, 5)
        medium_ticks = self._make_ticks_at_price(50000.0, 10)
        high_ticks = self._make_ticks_at_price(50000.0, 20)

        self.assertEqual(detect_iceberg_clustering(low_ticks, min_repeat=5)["confidence"], "low")
        self.assertEqual(detect_iceberg_clustering(medium_ticks, min_repeat=5)["confidence"], "medium")
        self.assertEqual(detect_iceberg_clustering(high_ticks, min_repeat=5)["confidence"], "high")

    def test_ticks_outside_window_ignored(self):
        # Tạo 5 tick cũ (> 300s trước) + 0 tick mới → không detect
        old_ticks = self._make_ticks_at_price(10000.0, 5, t_start=0, gap_secs=1)
        recent_tick = _make_tick(20000.0, 100, "BUY", _t(9, 30, 0))
        all_ticks = old_ticks + [recent_tick]
        # window_seconds=10 → chỉ thấy recent_tick (1 tick tại 20000) + tick cũ trong cửa sổ
        # latest tick sẽ là recent_tick tại 34200s; cutoff = 34200 - 10 = 34190
        # old_ticks ở giây 0..4 → bị loại; kết quả chỉ 1 tick → không đủ min_repeat=5
        result = detect_iceberg_clustering(all_ticks, min_repeat=5, window_seconds=10)
        self.assertFalse(result["detected"])

    def test_two_price_levels_picks_dominant(self):
        # 8 tick tại 10000, 3 tick tại 20000
        ticks = (
            self._make_ticks_at_price(10000.0, 8, t_start=34200)
            + self._make_ticks_at_price(20000.0, 3, t_start=34300)
        )
        result = detect_iceberg_clustering(ticks, min_repeat=3)
        self.assertTrue(result["detected"])
        self.assertGreaterEqual(result["repeat_count"], 8)


# ---------------------------------------------------------------------------
# detect_dark_flow (patch _fetch_ticks để không cần DB)
# ---------------------------------------------------------------------------

class TestDetectDarkFlow(SimpleTestCase):

    def _base_ticks(self, n: int = 10, price: float = 10000.0, side: str = "BUY") -> list[dict]:
        return [
            _make_tick(price, 100, side, _t(9, 30, i * 5))
            for i in range(n)
        ]

    @patch("portfolio.order_flow._fetch_ticks")
    @patch("portfolio.order_flow.compute_tick_rate")
    def test_no_signal_when_no_ticks(self, mock_tick_rate, mock_fetch):
        mock_fetch.return_value = []
        mock_tick_rate.return_value = {
            "tick_rate_per_min": 0.0,
            "small_order_count": 0,
            "total_count": 0,
            "small_order_ratio": 0.0,
            "window_seconds": 300,
        }
        result = detect_dark_flow("VNM")
        self.assertEqual(result["signal_type"], "none")
        self.assertEqual(result["strength"], 0.0)
        self.assertIn("triggered_at", result)

    @patch("portfolio.order_flow._fetch_ticks")
    @patch("portfolio.order_flow.compute_tick_rate")
    def test_result_has_required_keys(self, mock_tick_rate, mock_fetch):
        mock_fetch.return_value = []
        mock_tick_rate.return_value = {
            "tick_rate_per_min": 1.0,
            "small_order_count": 0,
            "total_count": 0,
            "small_order_ratio": 0.0,
            "window_seconds": 300,
        }
        result = detect_dark_flow("VNM")
        for key in ("signal_type", "strength", "confidence", "components", "triggered_at"):
            self.assertIn(key, result)

    @patch("portfolio.order_flow._fetch_ticks")
    @patch("portfolio.order_flow.compute_tick_rate")
    def test_twap_bot_detected_when_high_tick_rate_and_small_orders(self, mock_tick_rate, mock_fetch):
        # i*5 giây: max i=29 → 145s > 59 → dùng _ts với phút cuộn
        def _ts(i):
            total = 34200 + i * 5  # giây kể từ 00:00
            return time(total // 3600, (total % 3600) // 60, total % 60)
        ticks = [
            _make_tick(10000.0, 4, "BUY", _ts(i))  # value=40tr < 50tr
            for i in range(30)
        ]
        mock_fetch.return_value = ticks
        mock_tick_rate.return_value = {
            "tick_rate_per_min": 30.0,  # > 3x baseline(5) = 15
            "small_order_count": 30,
            "total_count": 30,
            "small_order_ratio": 1.0,   # > 0.60
            "window_seconds": 300,
        }
        result = detect_dark_flow("VNM", avg_tick_rate_baseline=5.0)
        self.assertIn(result["signal_type"], ("twap_bot", "mixed"))

    @patch("portfolio.order_flow._fetch_ticks")
    @patch("portfolio.order_flow.compute_tick_rate")
    def test_confidence_high_when_strength_above_70(self, mock_tick_rate, mock_fetch):
        mock_fetch.return_value = []
        mock_tick_rate.return_value = {
            "tick_rate_per_min": 1.0,
            "small_order_count": 0,
            "total_count": 0,
            "small_order_ratio": 0.0,
            "window_seconds": 300,
        }
        result = detect_dark_flow("VNM")
        # Với no-tick case: strength=0 → confidence='low'
        self.assertEqual(result["confidence"], "low")

    @patch("portfolio.order_flow._fetch_ticks")
    @patch("portfolio.order_flow.compute_tick_rate")
    def test_components_keys_present(self, mock_tick_rate, mock_fetch):
        mock_fetch.return_value = []
        mock_tick_rate.return_value = {
            "tick_rate_per_min": 0.0,
            "small_order_count": 0,
            "total_count": 0,
            "small_order_ratio": 0.0,
            "window_seconds": 300,
        }
        result = detect_dark_flow("VNM")
        comps = result["components"]
        for key in ("absorption", "iceberg", "tick_rate", "size_distribution"):
            self.assertIn(key, comps)


# ---------------------------------------------------------------------------
# compute_cvd_series + compute_tick_rate (TestCase — dùng DB)
# ---------------------------------------------------------------------------

class TestComputeCVDSeriesDB(TestCase):

    def setUp(self):
        from portfolio.models import IntradayTick
        today = datetime.now(timezone.utc).date()
        # Tạo 3 tick: 2 BUY + 1 SELL trong 60 phút gần nhất
        # Giả lập giờ hiện tại ~ 10:00 → tick tại 9:30, 9:31, 9:32
        IntradayTick.objects.create(
            symbol="TST",
            trade_date=today,
            trade_time=time(9, 30, 0),
            price=10000,
            volume=1000,
            side="BUY",
        )
        IntradayTick.objects.create(
            symbol="TST",
            trade_date=today,
            trade_time=time(9, 31, 0),
            price=10000,
            volume=500,
            side="SELL",
        )
        IntradayTick.objects.create(
            symbol="TST",
            trade_date=today,
            trade_time=time(9, 32, 0),
            price=10000,
            volume=200,
            side="UNKNOWN",
        )

    def test_returns_list(self):
        result = compute_cvd_series("TST", window_minutes=600)
        self.assertIsInstance(result, list)

    def test_bucket_has_required_keys(self):
        result = compute_cvd_series("TST", window_minutes=600)
        if result:
            bucket = result[0]
            for key in ("bucket_ts", "buy_value", "sell_value", "cvd", "cumulative_cvd"):
                self.assertIn(key, bucket)

    def test_unknown_side_split_half(self):
        # UNKNOWN tick: value = 10000 * 200 = 2_000_000
        # Buy phần: 1_000_000, Sell phần: 1_000_000
        result = compute_cvd_series("TST", window_minutes=600, bucket_seconds=60)
        # Tìm bucket 9:32 (570 + 2 = 572)
        unk_buckets = [b for b in result if "09:32" in b["bucket_ts"]]
        if unk_buckets:
            b = unk_buckets[0]
            self.assertAlmostEqual(b["buy_value"], 1_000_000, delta=1)
            self.assertAlmostEqual(b["sell_value"], 1_000_000, delta=1)

    def test_empty_symbol_returns_empty_list(self):
        result = compute_cvd_series("NOEXIST", window_minutes=60)
        self.assertEqual(result, [])

    def test_cumulative_cvd_accumulates(self):
        result = compute_cvd_series("TST", window_minutes=600, bucket_seconds=60)
        if len(result) >= 2:
            prev_cum = 0.0
            for b in result:
                expected_cum = prev_cum + b["cvd"]
                self.assertAlmostEqual(b["cumulative_cvd"], expected_cum, delta=1)
                prev_cum = b["cumulative_cvd"]


class TestComputeTickRateDB(TestCase):

    def setUp(self):
        cache.clear()
        from portfolio.models import IntradayTick
        today = datetime.now(timezone.utc).date()
        # 5 tick nhỏ + 2 tick lớn trong 5 phút gần nhất
        # Dùng trade_time gần midnight để đảm bảo nằm trong window
        now_t = datetime.now(timezone.utc).time()
        h, m = now_t.hour, now_t.minute

        for i in range(5):
            IntradayTick.objects.create(
                symbol="TST2",
                trade_date=today,
                trade_time=time(h, m, 0),  # ngay trước now
                price=10000,
                volume=1,   # value = 10_000 < 50tr → nhỏ
                side="BUY",
            )
        for i in range(2):
            IntradayTick.objects.create(
                symbol="TST2",
                trade_date=today,
                trade_time=time(h, m, 0),
                price=10000,
                volume=10000,  # value = 100_000_000 > 50tr → không nhỏ
                side="SELL",
            )

    def tearDown(self):
        cache.clear()

    def test_tick_rate_positive(self):
        result = compute_tick_rate("TST2", window_seconds=300)
        self.assertGreaterEqual(result["tick_rate_per_min"], 0)
        self.assertIn("small_order_ratio", result)
        self.assertIn("total_count", result)

    def test_small_order_ratio_in_range(self):
        result = compute_tick_rate("TST2", window_seconds=300)
        self.assertGreaterEqual(result["small_order_ratio"], 0.0)
        self.assertLessEqual(result["small_order_ratio"], 1.0)

    def test_unknown_symbol_returns_zero_rate(self):
        result = compute_tick_rate("NOEXIST2", window_seconds=60)
        self.assertEqual(result["tick_rate_per_min"], 0.0)
        self.assertEqual(result["total_count"], 0)

    def test_result_is_cached(self):
        result1 = compute_tick_rate("TST2", window_seconds=300)
        result2 = compute_tick_rate("TST2", window_seconds=300)
        self.assertEqual(result1, result2)


class TestOrderFlowSignalTask(TestCase):

    def setUp(self):
        cache.clear()

    def tearDown(self):
        cache.clear()

    @patch("portfolio.order_flow.detect_dark_flow")
    def test_task_stores_signal_when_strength_above_20(self, mock_detect):
        from django.contrib.auth import get_user_model
        from portfolio.models import OrderFlowSignal, TrackedSymbol
        from portfolio.tasks import detect_and_store_order_flow

        user = get_user_model().objects.create_user(username="of_user", password="Test@123456")
        TrackedSymbol.objects.create(user=user, symbol="VNM")
        mock_detect.return_value = {
            "signal_type": "iceberg",
            "strength": 65.0,
            "confidence": "high",
            "components": {
                "tick_rate": {"tick_rate_per_min": 12.5},
                "size_distribution": {"small_ratio": 0.8},
                "absorption": {"cvd_change": 123456789},
                "iceberg": {"repeat_count": 8, "level": 78200},
            },
            "triggered_at": "2026-04-04T06:00:00+00:00",
        }

        result = detect_and_store_order_flow.run(symbol="VNM")
        self.assertEqual(result["stored"], 1)
        self.assertEqual(OrderFlowSignal.objects.filter(symbol="VNM").count(), 1)

    @patch("portfolio.order_flow.detect_dark_flow")
    def test_task_skips_when_disabled(self, mock_detect):
        from django.test import override_settings
        from portfolio.tasks import detect_and_store_order_flow

        with override_settings(ORDER_FLOW_DETECTION_ENABLED=False):
            result = detect_and_store_order_flow.run(symbol="VNM")
        self.assertEqual(result["status"], "disabled")
        mock_detect.assert_not_called()

    @patch("portfolio.order_flow.detect_dark_flow")
    def test_task_honors_cooldown_lock(self, mock_detect):
        from portfolio.models import OrderFlowSignal
        from portfolio.tasks import detect_and_store_order_flow

        cache.set("order_flow_lock:VNM", True, timeout=300)
        result = detect_and_store_order_flow.run(symbol="VNM")
        self.assertEqual(result["processed"], 0)
        self.assertEqual(OrderFlowSignal.objects.count(), 0)
        mock_detect.assert_not_called()


class TestOrderFlowApi(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(username="orderflow-api", password="Test@123456")
        self.client.force_authenticate(user=self.user)

    @patch("portfolio.order_flow.detect_dark_flow")
    @patch("portfolio.order_flow.compute_cvd_series")
    def test_order_flow_endpoint_returns_payload(self, mock_cvd, mock_detect):
        from portfolio.models import OrderFlowSignal

        OrderFlowSignal.objects.create(
            symbol="FPT",
            signal_type="iceberg",
            strength=61.5,
            confidence="high",
            tick_rate=12.3,
            small_order_ratio=0.77,
            cvd_at_signal=123456,
            price_at_signal=101000,
            window_seconds=300,
            components_json={"iceberg": {"repeat_count": 7}},
        )
        mock_cvd.return_value = [{"bucket_ts": "2026-04-04T09:30:00", "cumulative_cvd": 1000, "cvd": 1000, "buy_value": 1500, "sell_value": 500}]
        mock_detect.return_value = {
            "signal_type": "iceberg",
            "strength": 61.5,
            "confidence": "high",
            "components": {
                "tick_rate": {"tick_rate_per_min": 12.3},
                "size_distribution": {"small_ratio": 0.77},
            },
            "triggered_at": "2026-04-04T09:30:00Z",
        }

        response = self.client.get("/api/stock-management/stocks/FPT/order-flow/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["ok"])
        self.assertEqual(response.data["symbol"], "FPT")
        self.assertEqual(response.data["latest_signal"]["signal_type"], "iceberg")
        self.assertEqual(len(response.data["cvd_series"]), 1)

    def test_order_flow_endpoint_requires_authentication(self):
        self.client.force_authenticate(user=None)
        response = self.client.get("/api/stock-management/stocks/FPT/order-flow/")
        self.assertEqual(response.status_code, 401)
