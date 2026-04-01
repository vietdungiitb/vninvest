import pandas as pd
from django.test import SimpleTestCase

from portfolio.realtime.compute import build_ticker_payload, detect_whale_signals


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
        self.assertEqual(payload["volume"], 200.0)
        self.assertEqual(payload["vwap"], 15.0)

    def test_detect_whale_signals_emits_threshold_hits(self):
        frame = pd.DataFrame(
            [
                {"price": 10000, "volume": 100000, "side": "BUY"},
            ]
        )

        signals = detect_whale_signals("HPG", frame, thresholds=[100000000, 500000000, 2000000000])

        self.assertEqual(len(signals), 2)
        self.assertEqual(signals[0].symbol, "HPG")
        self.assertEqual(signals[0].side, "BUY")
        self.assertGreaterEqual(signals[0].matched_value, 1000000000.0)
