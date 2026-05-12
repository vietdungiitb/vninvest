from unittest.mock import patch

from django.core.cache import cache
from django.test import SimpleTestCase

from portfolio.adapters import vnbroker_adapter
from portfolio.vnbroker_provider_benchmark import build_runtime_recommendation
from portfolio.vnbroker_provider_quality import (
    build_provider_quality_snapshot,
    cache_provider_quality_selection,
    cache_provider_quality_snapshot,
    calculate_provider_quality_score,
    resolve_provider_order,
)


class VnbrokerProviderQualityTests(SimpleTestCase):
    def setUp(self):
        super().setUp()
        cache.clear()

    def test_calculate_provider_quality_score_uses_weighted_formula(self):
        result = calculate_provider_quality_score(
            {
                'freshness_pct': 80,
                'completeness_pct': 90,
                'success_rate_pct': 70,
                'parse_quality_pct': 50,
            }
        )

        self.assertEqual(result['score'], 78.0)
        self.assertEqual(result['contributions']['freshness'], 32.0)
        self.assertEqual(result['contributions']['completeness'], 27.0)
        self.assertEqual(result['contributions']['success_rate'], 14.0)
        self.assertEqual(result['contributions']['parse_quality'], 5.0)

    def test_resolve_provider_order_prefers_highest_scored_provider(self):
        cache_provider_quality_snapshot(
            build_provider_quality_snapshot(
                provider='KBS',
                channel='price_board',
                metrics={
                    'freshness_pct': 72,
                    'completeness_pct': 74,
                    'success_rate_pct': 76,
                    'parse_quality_pct': 78,
                },
                source='benchmark',
            )
        )
        cache_provider_quality_snapshot(
            build_provider_quality_snapshot(
                provider='VCI',
                channel='price_board',
                metrics={
                    'freshness_pct': 96,
                    'completeness_pct': 98,
                    'success_rate_pct': 97,
                    'parse_quality_pct': 99,
                },
                source='benchmark',
            )
        )

        ordered = resolve_provider_order('price_board', ['KBS', 'VCI'])

        self.assertEqual(ordered, ['VCI', 'KBS'])

    def test_resolve_provider_order_keeps_selected_provider_within_hysteresis(self):
        cache_provider_quality_snapshot(
            build_provider_quality_snapshot(
                provider='KBS',
                channel='price_board',
                metrics={
                    'freshness_pct': 92,
                    'completeness_pct': 90,
                    'success_rate_pct': 90,
                    'parse_quality_pct': 90,
                },
                source='benchmark',
            )
        )
        cache_provider_quality_snapshot(
            build_provider_quality_snapshot(
                provider='VCI',
                channel='price_board',
                metrics={
                    'freshness_pct': 94,
                    'completeness_pct': 88,
                    'success_rate_pct': 90,
                    'parse_quality_pct': 90,
                },
                source='benchmark',
            )
        )
        cache_provider_quality_selection('price_board', 'KBS', market_phase='market_open')

        ordered = resolve_provider_order('price_board', ['KBS', 'VCI'], market_phase='market_open')

        self.assertEqual(ordered[0], 'KBS')

    @patch('portfolio.vnbroker_provider_quality.resolve_market_phase', return_value={'profile': 'market_open'})
    def test_resolve_provider_order_uses_current_market_phase_when_not_provided(self, _mock_phase):
        cache_provider_quality_snapshot(
            build_provider_quality_snapshot(
                provider='KBS',
                channel='price_board',
                metrics={
                    'freshness_pct': 92,
                    'completeness_pct': 90,
                    'success_rate_pct': 90,
                    'parse_quality_pct': 90,
                },
                source='benchmark',
            )
        )
        cache_provider_quality_snapshot(
            build_provider_quality_snapshot(
                provider='VCI',
                channel='price_board',
                metrics={
                    'freshness_pct': 94,
                    'completeness_pct': 88,
                    'success_rate_pct': 90,
                    'parse_quality_pct': 90,
                },
                source='benchmark',
            )
        )
        cache_provider_quality_selection('price_board', 'KBS', market_phase='market_open')

        ordered = resolve_provider_order('price_board', ['KBS', 'VCI'])

        self.assertEqual(ordered[0], 'KBS')

    def test_resolve_provider_order_keeps_market_phase_selections_isolated(self):
        cache_provider_quality_snapshot(
            build_provider_quality_snapshot(
                provider='KBS',
                channel='price_board',
                metrics={
                    'freshness_pct': 92,
                    'completeness_pct': 90,
                    'success_rate_pct': 90,
                    'parse_quality_pct': 90,
                },
                source='benchmark',
            )
        )
        cache_provider_quality_snapshot(
            build_provider_quality_snapshot(
                provider='VCI',
                channel='price_board',
                metrics={
                    'freshness_pct': 94,
                    'completeness_pct': 88,
                    'success_rate_pct': 90,
                    'parse_quality_pct': 90,
                },
                source='benchmark',
            )
        )
        cache_provider_quality_selection('price_board', 'KBS', market_phase='market_open')
        cache_provider_quality_selection('price_board', 'VCI', market_phase='offhours')

        open_order = resolve_provider_order('price_board', ['KBS', 'VCI'], market_phase='market_open')
        offhours_order = resolve_provider_order('price_board', ['KBS', 'VCI'], market_phase='offhours')

        self.assertEqual(open_order[0], 'KBS')
        self.assertEqual(offhours_order[0], 'VCI')

    @patch('portfolio.vnbroker_provider_benchmark.cache_provider_quality_snapshot')
    @patch('portfolio.vnbroker_provider_benchmark.resolve_provider_order', return_value=['VCI', 'KBS'])
    def test_build_runtime_recommendation_uses_quality_ranked_provider(self, mock_resolve_order, mock_cache_snapshot):
        report = build_runtime_recommendation(
            [
                {
                    'provider': 'KBS',
                    'concurrency': 4,
                    'p95_latency_seconds': 6.0,
                    'success_pct': 84.0,
                    'rate_limited_pct': 4.0,
                    'transport_errors': 2,
                    'total_requests': 100,
                    'requests_per_minute': 120.0,
                },
                {
                    'provider': 'VCI',
                    'concurrency': 8,
                    'p95_latency_seconds': 2.0,
                    'success_pct': 97.0,
                    'rate_limited_pct': 1.0,
                    'transport_errors': 0,
                    'total_requests': 100,
                    'requests_per_minute': 140.0,
                },
            ],
            timeout_seconds=8,
            market_phase='market_open',
        )

        self.assertEqual(report['primary_provider'], 'VCI')
        self.assertEqual(report['runtime_patch']['price_board_source'], 'VCI')
        self.assertEqual(report['runtime_patch']['fallback_sources'][0], 'KBS')
        self.assertEqual(report['market_phase'], 'market_open')
        self.assertEqual(report['decision_audit']['market_phase'], 'market_open')
        self.assertEqual(report['decision_audit']['selected_provider'], 'VCI')
        self.assertIn('quality_scores', report)
        self.assertGreaterEqual(len(report['quality_scores']), 2)
        self.assertEqual(mock_resolve_order.call_args.args[0], 'price_board')
        self.assertEqual(mock_resolve_order.call_args.kwargs['market_phase'], 'market_open')
        self.assertTrue(mock_cache_snapshot.called)

    @patch('portfolio.vnbroker_provider_benchmark.resolve_market_phase', return_value={'profile': 'offhours'})
    @patch('portfolio.vnbroker_provider_benchmark.cache_provider_quality_snapshot')
    @patch('portfolio.vnbroker_provider_benchmark.resolve_provider_order', return_value=['VCI', 'KBS'])
    def test_build_runtime_recommendation_uses_current_market_phase_when_not_provided(
        self,
        mock_resolve_order,
        mock_cache_snapshot,
        _mock_phase,
    ):
        report = build_runtime_recommendation(
            [
                {
                    'provider': 'KBS',
                    'concurrency': 4,
                    'p95_latency_seconds': 6.0,
                    'success_pct': 84.0,
                    'rate_limited_pct': 4.0,
                    'transport_errors': 2,
                    'total_requests': 100,
                    'requests_per_minute': 120.0,
                },
                {
                    'provider': 'VCI',
                    'concurrency': 8,
                    'p95_latency_seconds': 2.0,
                    'success_pct': 97.0,
                    'rate_limited_pct': 1.0,
                    'transport_errors': 0,
                    'total_requests': 100,
                    'requests_per_minute': 140.0,
                },
            ],
            timeout_seconds=8,
        )

        self.assertEqual(report['market_phase'], 'offhours')
        self.assertEqual(report['decision_audit']['market_phase'], 'offhours')
        self.assertEqual(mock_resolve_order.call_args.kwargs['market_phase'], 'offhours')
        self.assertTrue(mock_cache_snapshot.called)

    @patch('portfolio.adapters.vnbroker_adapter.get_vnbroker_runtime_settings', return_value={})
    @patch('portfolio.adapters.vnbroker_adapter.resolve_provider_order', return_value=['VCI', 'KBS'])
    def test_price_board_sources_use_quality_order_when_no_explicit_source(self, mock_resolve_order, _mock_settings):
        ordered = vnbroker_adapter._resolve_price_board_sources()

        self.assertEqual(ordered, ['VCI', 'KBS'])
        mock_resolve_order.assert_called_once_with('price_board', ['KBS', 'VCI'])

    @patch('portfolio.adapters.vnbroker_adapter.get_vnbroker_runtime_settings', return_value={})
    @patch('portfolio.adapters.vnbroker_adapter.resolve_provider_order')
    def test_price_board_sources_preserve_explicit_source(self, mock_resolve_order, _mock_settings):
        ordered = vnbroker_adapter._resolve_price_board_sources(explicit_source='VCI')

        self.assertEqual(ordered[0], 'VCI')
        mock_resolve_order.assert_not_called()