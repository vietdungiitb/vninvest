from datetime import datetime
from zoneinfo import ZoneInfo

from django.test import SimpleTestCase

from portfolio.services_whale_analytics_snapshot import _build_flow_compare_series, _build_flow_series, _build_heatmap_series, _build_marker_series


VN_TZ = ZoneInfo('Asia/Ho_Chi_Minh')


class WhaleAnalyticsSnapshotFlowSeriesTestCase(SimpleTestCase):
    def _bucket(self, hour: int, minute: int, *, buy_value: float, sell_value: float, total_value: float) -> dict:
        return {
            'bucket_ts': datetime(2026, 4, 24, hour, minute, tzinfo=VN_TZ),
            'buy_value': float(buy_value),
            'sell_value': float(sell_value),
            'total_value': float(total_value),
        }

    def test_buy_strength_does_not_false_saturate_on_small_clean_bucket(self):
        bucket_rows = [
            self._bucket(9, 0, buy_value=500_000_000, sell_value=500_000_000, total_value=1_000_000_000),
            self._bucket(9, 15, buy_value=520_000_000, sell_value=480_000_000, total_value=1_000_000_000),
            self._bucket(9, 30, buy_value=100_000_000, sell_value=0, total_value=100_000_000),
        ]

        flow_series = _build_flow_series(bucket_rows, whale_value_by_bucket={}, bucket_window=30)

        last_strength = flow_series['buy_strength'][-1]['value']
        self.assertLess(last_strength, 60)
        self.assertEqual(flow_series['buy_strength'][-1]['confidence'], 'low')

    def test_buy_strength_rises_for_truly_abnormal_bucket(self):
        bucket_rows = [
            self._bucket(9, 0, buy_value=500_000_000, sell_value=500_000_000, total_value=1_000_000_000),
            self._bucket(9, 15, buy_value=520_000_000, sell_value=480_000_000, total_value=1_000_000_000),
            self._bucket(9, 30, buy_value=5_500_000_000, sell_value=500_000_000, total_value=6_000_000_000),
        ]

        flow_series = _build_flow_series(bucket_rows, whale_value_by_bucket={}, bucket_window=30)

        baseline_strength = flow_series['buy_strength'][1]['value']
        abnormal_strength = flow_series['buy_strength'][-1]['value']
        self.assertGreater(abnormal_strength, baseline_strength)
        self.assertGreaterEqual(abnormal_strength, 70)
        self.assertLessEqual(abnormal_strength, 99.5)
        self.assertIn(flow_series['buy_strength'][-1]['confidence'], {'medium', 'high'})

    def test_institutional_strength_uses_whale_context_not_buy_strength_clone(self):
        bucket_rows = [
            self._bucket(9, 0, buy_value=800_000_000, sell_value=200_000_000, total_value=1_000_000_000),
            self._bucket(9, 15, buy_value=800_000_000, sell_value=200_000_000, total_value=1_000_000_000),
        ]
        whale_value_by_bucket = {
            bucket_rows[1]['bucket_ts'].isoformat(): 900_000_000,
        }

        flow_series = _build_flow_series(bucket_rows, whale_value_by_bucket=whale_value_by_bucket, bucket_window=30)

        first_buy_strength = flow_series['buy_strength'][0]['value']
        second_buy_strength = flow_series['buy_strength'][1]['value']
        first_institutional = flow_series['institutional_strength'][0]['value']
        second_institutional = flow_series['institutional_strength'][1]['value']

        self.assertAlmostEqual(first_buy_strength, second_buy_strength, delta=5)
        self.assertGreater(second_institutional, first_institutional)
        self.assertNotEqual(second_institutional, second_buy_strength)

    def test_flow_compare_series_normalizes_cvd_around_neutral_baseline(self):
        bucket_rows = [
            self._bucket(9, 0, buy_value=200_000_000, sell_value=500_000_000, total_value=700_000_000),
            self._bucket(9, 15, buy_value=900_000_000, sell_value=200_000_000, total_value=1_100_000_000),
        ]

        flow_series = _build_flow_series(bucket_rows, whale_value_by_bucket={}, bucket_window=30)
        flow_compare_series = _build_flow_compare_series(flow_series)

        self.assertEqual(len(flow_compare_series), 2)
        self.assertEqual(flow_compare_series[0]['baseline'], 50.0)
        self.assertLess(flow_compare_series[0]['cvd_normalized_0_100'], 50.0)
        self.assertGreater(flow_compare_series[1]['cvd_normalized_0_100'], 50.0)

    def test_heatmap_and_marker_series_follow_bucket_side_and_score_bounds(self):
        bucket_rows = [
            self._bucket(9, 0, buy_value=900_000_000, sell_value=100_000_000, total_value=1_000_000_000),
            self._bucket(9, 15, buy_value=200_000_000, sell_value=1_100_000_000, total_value=1_300_000_000),
        ]
        whale_value_by_bucket = {
            bucket_rows[0]['bucket_ts'].isoformat(): 800_000_000,
            bucket_rows[1]['bucket_ts'].isoformat(): 1_000_000_000,
        }

        flow_series = _build_flow_series(bucket_rows, whale_value_by_bucket=whale_value_by_bucket, bucket_window=30)
        flow_compare_series = _build_flow_compare_series(flow_series)
        heatmap_series = _build_heatmap_series(bucket_rows, whale_value_by_bucket=whale_value_by_bucket, bucket_window=30)
        marker_series = _build_marker_series(
            [
                {
                    'bucket_ts': bucket_rows[0]['bucket_ts'].isoformat(),
                    'side': 'BUY',
                    'matched_value': 900_000_000,
                    'event_score': 82,
                },
                {
                    'bucket_ts': bucket_rows[1]['bucket_ts'].isoformat(),
                    'side': 'SELL',
                    'matched_value': 1_100_000_000,
                    'event_score': 91,
                },
            ],
            heatmap_series,
            flow_compare_series,
        )

        self.assertEqual(len(heatmap_series), 2)
        self.assertGreater(heatmap_series[0]['buy_heat'], heatmap_series[0]['sell_heat'])
        self.assertLess(heatmap_series[1]['net_heat'], 0)
        self.assertEqual(len(marker_series), 2)
        self.assertEqual(marker_series[0]['side'], 'buy')
        self.assertEqual(marker_series[1]['side'], 'sell')
        self.assertGreaterEqual(marker_series[0]['score'], 0)
        self.assertLessEqual(marker_series[0]['score'], 100)