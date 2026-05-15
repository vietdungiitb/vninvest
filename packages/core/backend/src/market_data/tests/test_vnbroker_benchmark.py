from unittest.mock import patch

from django.test import TestCase

from market_data.vnbroker_benchmark import (
    get_latest_price_board_benchmark_report,
    run_price_board_provider_benchmark,
)


class VnbrokerBenchmarkTests(TestCase):
    @patch('market_data.vnbroker_benchmark.fetch_price_board_snapshot')
    def test_run_price_board_provider_benchmark_builds_cached_report(self, fetch_snapshot_mock):
        fetch_snapshot_mock.return_value = [{'symbol': 'FPT'}]

        report = run_price_board_provider_benchmark(
            {
                'symbol': 'FPT',
                'providers': ['KBS'],
                'concurrency_levels': [2],
                'runs': 1,
                'duration_seconds': 10,
                'timeout_seconds': 8,
            }
        )

        cached = get_latest_price_board_benchmark_report()
        self.assertEqual(report['status'], 'completed')
        self.assertEqual(report['symbol'], 'FPT')
        self.assertEqual(len(report['results']), 1)
        self.assertEqual(report['recommendation']['primary_provider'], 'KBS')
        self.assertEqual(cached['symbol'], 'FPT')
        self.assertEqual(fetch_snapshot_mock.call_count, 2)