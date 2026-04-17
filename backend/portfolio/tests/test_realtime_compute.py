import pandas as pd
from django.test import SimpleTestCase

from portfolio.realtime.compute import (
    WhaleSignal,
    build_ticker_payload,
    build_ticker_payload_native,
    build_whale_payload,
    detect_whale_signals,
)


class RealtimeComputeTests(SimpleTestCase):
    def test_build_ticker_payload_computes_vwap(self):
        frame = pd.DataFrame(
            [
                {"price": 10, "volume": 100, "side": "BUY"},
                {"price": 20, "volume": 100, "side": "SELL"},
            ]
        )

        payload = build_ticker_payload("VNM", frame, seq=1)

        self.assertEqual(payload["symbol"], "VNM")
        self.assertEqual(payload["seq"], 1)
        self.assertEqual(payload["price"], 20.0)
        self.assertEqual(payload["current_price"], 20.0)
        self.assertEqual(payload["volume"], 200.0)
        self.assertEqual(payload["vwap"], 15.0)
        self.assertEqual(payload["freshness_seconds"], 0)
        self.assertEqual(payload["stale"], False)
        self.assertEqual(payload["source"], "ws_stream")
        self.assertTrue(payload["ts"])
        self.assertEqual(payload["last_date"], payload["ts"])

    def test_build_ticker_payload_native_matches_dataframe_path(self):
        rows = [
            {"price": 10, "volume": 100, "side": "BUY"},
            {"price": 20, "volume": 300, "side": "SELL"},
        ]
        frame = pd.DataFrame(rows)

        payload_df = build_ticker_payload("VNM", frame, seq=7)
        payload_native = build_ticker_payload_native("VNM", rows, seq=7)

        self.assertEqual(payload_native["symbol"], payload_df["symbol"])
        self.assertEqual(payload_native["seq"], payload_df["seq"])
        self.assertEqual(payload_native["price"], payload_df["price"])
        self.assertEqual(payload_native["volume"], payload_df["volume"])
        self.assertEqual(payload_native["vwap"], payload_df["vwap"])
        self.assertEqual(payload_native["source"], payload_df["source"])

    def test_detect_whale_signals_emits_threshold_hits(self):
        frame = pd.DataFrame(
            [
                {"price": 10000, "volume": 100000, "side": "BUY"},
            ]
        )

        signals = detect_whale_signals("HPG", frame, thresholds=[100000000, 500000000, 2000000000])

        self.assertEqual(len(signals), 1)
        self.assertEqual(signals[0].symbol, "HPG")
        self.assertEqual(signals[0].side, "BUY")
        self.assertGreaterEqual(signals[0].matched_value, 1000000000.0)
        self.assertEqual(signals[0].threshold, 500000000.0)

    def test_detect_whale_signals_selects_highest_matched_threshold_only(self):
        frame = pd.DataFrame(
            [
                {"price": 10000, "volume": 600000, "side": "SELL"},
            ]
        )

        signals = detect_whale_signals("VNM", frame, thresholds=[100000000, 1000000000, 5000000000])

        self.assertEqual(len(signals), 1)
        self.assertEqual(signals[0].symbol, "VNM")
        self.assertEqual(signals[0].side, "SELL")
        self.assertEqual(signals[0].threshold, 5000000000.0)

    def test_build_whale_payload_includes_explainability_fields(self):
        signal = WhaleSignal(
            symbol="VNM",
            matched_value=3_000_000_000,
            side="BUY",
            threshold=1_000_000_000,
            ts="2026-04-11T09:00:00+00:00",
        )
        payload = build_whale_payload(signal, seq=1)

        self.assertIn("why_triggered", payload)
        self.assertIn("next_checks", payload)
        self.assertIsInstance(payload["why_triggered"], list)
        self.assertIsInstance(payload["next_checks"], list)
        self.assertTrue(len(payload["why_triggered"]) >= 2)
        # 3x threshold → ratio bullet present
        self.assertTrue(any("3.0x" in w for w in payload["why_triggered"]))
        # buy side → check_related_symbols in next_checks
        self.assertIn("check_related_symbols", payload["next_checks"])
        # always includes compare_dark_flow
        self.assertIn("compare_dark_flow", payload["next_checks"])

    def test_build_whale_payload_sell_side_explainability(self):
        signal = WhaleSignal(
            symbol="SSI",
            matched_value=6_000_000_000,
            side="SELL",
            threshold=1_000_000_000,
            ts="2026-04-11T09:00:00+00:00",
        )
        payload = build_whale_payload(signal, seq=2)

        # shark-class trade
        self.assertTrue(any("shark" in w for w in payload["why_triggered"]))
        # sell side → monitor_reversal
        self.assertIn("monitor_reversal", payload["next_checks"])
        # shark → check_depth_wall
        self.assertIn("check_depth_wall", payload["next_checks"])
