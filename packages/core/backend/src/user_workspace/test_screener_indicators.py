"""W8: pin screener indicator formulas (P3 calibration baseline).

Documents the methodology contract: RSI = Cutler's SMA variant (not Wilder),
ADX field = single-period DX (not Wilder-smoothed ADX), VWAP = rolling-20
(not session VWAP), MFI = standard last-`window` money flow (W8 fixed the
full-history accumulation bug). Any future vendor calibration must update
these pins + docs/SCREENER_METHODOLOGY_20260914.md together.
"""
from django.test import SimpleTestCase

from user_workspace.screener_helpers import (
    _compute_adx,
    _compute_bollinger_width,
    _compute_mfi,
    _compute_rsi,
    _compute_vwap,
)


class ScreenerIndicatorFormulaTests(SimpleTestCase):
    def test_rsi_all_gains_pins_100(self):
        self.assertEqual(_compute_rsi([float(i) for i in range(1, 21)], 14), 100.0)

    def test_rsi_all_losses_pins_0(self):
        self.assertEqual(_compute_rsi([float(20 - i) for i in range(20)], 14), 0.0)

    def test_rsi_needs_more_than_window_points(self):
        self.assertIsNone(_compute_rsi([1.0] * 14, 14))

    def test_mfi_uses_last_window_only(self):
        # typical == close here (h == l == c). First 5 steps rise, last 5 fall.
        closes = [10.0, 11.0, 12.0, 13.0, 14.0, 15.0, 14.0, 13.0, 12.0, 11.0, 10.0]
        vols = [100.0] * len(closes)
        # Last-5 comparisons all fall -> negative only -> MFI == 0.
        # (Old full-history code returned ~52 here.)
        self.assertEqual(_compute_mfi(closes, closes, closes, vols, window=5), 0.0)

    def test_mfi_all_rising_pins_100(self):
        closes = [float(10 + i) for i in range(8)]
        vols = [100.0] * len(closes)
        self.assertEqual(_compute_mfi(closes, closes, closes, vols, window=5), 100.0)

    def test_adx_single_period_dx_range(self):
        highs = [float(10 + i) for i in range(20)]
        lows = [float(9 + i) for i in range(20)]
        closes = [float(9.5 + i) for i in range(20)]
        dx = _compute_adx(highs, lows, closes, 14)
        self.assertIsNotNone(dx)
        self.assertGreaterEqual(dx, 0)
        self.assertLessEqual(dx, 100)

    def test_vwap_rolling_window(self):
        self.assertAlmostEqual(_compute_vwap([10.0, 20.0], [1.0, 3.0], window=2), 17.5)

    def test_vwap_zero_volume_is_none(self):
        self.assertIsNone(_compute_vwap([10.0, 20.0], [0.0, 0.0], window=2))

    def test_bollinger_flat_series_width_zero(self):
        self.assertAlmostEqual(_compute_bollinger_width([50.0] * 25, 20, 2), 0.0)
