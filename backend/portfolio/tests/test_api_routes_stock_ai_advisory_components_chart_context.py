from unittest.mock import patch

from rest_framework import status
from rest_framework.test import APITestCase


class ApiRouteStockAiAdvisoryComponentsChartContextTests(APITestCase):
    def setUp(self):
        from . import test_api_routes as legacy_routes

        legacy_routes.ApiRouteSmokeTests.setUp(self)

    def authenticate(self):
        from . import test_api_routes as legacy_routes

        return legacy_routes.ApiRouteSmokeTests.authenticate(self)

    def _attach_dpi_license(self, plan_name, feature_flags=None, status='active', grace_days=7):
        from . import test_api_routes as legacy_routes

        return legacy_routes.ApiRouteSmokeTests._attach_dpi_license(self, plan_name, feature_flags, status, grace_days)

    def _create_stock_workspace_advisory(self, symbol='BCM'):
        from . import test_api_routes as legacy_routes

        return legacy_routes.ApiRouteSmokeTests._create_stock_workspace_advisory(self, symbol)

    @patch('portfolio.views._sprint17_build_component_templates')
    @patch('portfolio.views._sprint17_generate_component_templates_with_ai', return_value=[])
    @patch('portfolio.order_flow.detect_dark_flow')
    def test_stock_ai_advisory_components_generate_accepts_chart_context_and_returns_usage_flags(
        self,
        mock_detect_dark_flow,
        mock_generate_with_ai,
        mock_build_templates,
    ):
        self._attach_dpi_license('pro', {'sentiment_score': True})
        self.authenticate()
        self._create_stock_workspace_advisory(symbol='BCM')

        mock_detect_dark_flow.return_value = {
            'signal_type': 'iceberg',
            'strength': 65,
            'confidence': 'high',
            'components': {'tick_rate': {'score': 55}},
        }
        mock_build_templates.return_value = [
            {
                'symbol': 'BCM',
                'component_type': 'indicator',
                'indicator_name': 'RSI',
                'status': 'neutral',
                'confidence_score': 6,
                'suggested_action': 'watch',
                'rationale_text': 'chart-context-test',
                'timeframe': '30m',
                'include_in_summary': True,
            },
        ]

        response = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-components/generate/',
            {
                'timeframe': '30m',
                'chart_context': {
                    'symbol': 'BCM',
                    'chart_timeframe': '30m',
                    'visible_range': {'from_ts': 1712500000000, 'to_ts': 1712507200000},
                    'ohlcv': [
                        {'ts': 1712500000000, 'o': 70.1, 'h': 70.3, 'l': 69.9, 'c': 70.0, 'v': 120000},
                        {'ts': 1712501800000, 'o': 70.0, 'h': 70.4, 'l': 69.8, 'c': 70.2, 'v': 98000},
                    ],
                    'active_indicators': {'MA': True, 'VOL': True, 'MACD': True},
                    'computed_metrics': {'change_visible_pct': 1.3, 'volatility_visible': 0.8},
                },
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['chart_context_used'])
        self.assertEqual(response.data['chart_context_warnings'], [])
        kwargs = mock_generate_with_ai.call_args.kwargs
        self.assertIn('chart_context', kwargs)
        self.assertEqual(kwargs['chart_context']['symbol'], 'BCM')

    @patch('portfolio.views._sprint17_build_component_templates')
    @patch('portfolio.views._sprint17_generate_component_templates_with_ai', return_value=[])
    @patch('portfolio.order_flow.detect_dark_flow')
    def test_stock_ai_advisory_components_generate_invalid_chart_context_sets_warning(
        self,
        mock_detect_dark_flow,
        _mock_generate_with_ai,
        mock_build_templates,
    ):
        self._attach_dpi_license('pro', {'sentiment_score': True})
        self.authenticate()
        self._create_stock_workspace_advisory(symbol='BCM')

        mock_detect_dark_flow.return_value = {
            'signal_type': None,
            'strength': 0,
            'confidence': 'low',
            'components': {},
        }
        mock_build_templates.return_value = [
            {
                'symbol': 'BCM',
                'component_type': 'indicator',
                'indicator_name': 'RSI',
                'status': 'neutral',
                'confidence_score': 6,
                'suggested_action': 'watch',
                'rationale_text': 'invalid-chart-context-test',
                'timeframe': '30m',
                'include_in_summary': True,
            },
        ]

        response = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-components/generate/',
            {
                'timeframe': '30m',
                'chart_context': {
                    'symbol': 'VNM',
                    'ohlcv': [{'ts': 1, 'o': 1, 'h': 1, 'l': 1, 'c': 1, 'v': 1}],
                },
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.data['chart_context_used'])
        self.assertIn('chart_context_invalid', response.data['chart_context_warnings'])

    @patch('portfolio.views._sprint17_generate_component_templates_with_ai', return_value=[])
    @patch('portfolio.order_flow.detect_dark_flow')
    def test_stock_ai_advisory_components_generate_prefers_active_rsi_indicator_from_chart_context(
        self,
        mock_detect_dark_flow,
        _mock_generate_with_ai,
    ):
        self._attach_dpi_license('pro', {'sentiment_score': True})
        self.authenticate()
        self._create_stock_workspace_advisory(symbol='BCM')

        mock_detect_dark_flow.return_value = {
            'signal_type': 'iceberg',
            'strength': 60,
            'confidence': 'high',
            'components': {'tick_rate': {'score': 70}},
        }

        response = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-components/generate/',
            {
                'timeframe': '30m',
                'chart_context': {
                    'symbol': 'BCM',
                    'chart_timeframe': '30m',
                    'visible_range': {'from_ts': 1712500000000, 'to_ts': 1712507200000},
                    'ohlcv': [
                        {'ts': 1712500000000, 'o': 70.1, 'h': 70.3, 'l': 69.9, 'c': 70.0, 'v': 120000},
                        {'ts': 1712501800000, 'o': 70.0, 'h': 70.4, 'l': 69.8, 'c': 70.2, 'v': 98000},
                    ],
                    'active_indicators': {'RSI': True, 'MA': False, 'MACD': False, 'VOL': False},
                },
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        indicator_components = [
            item for item in response.data.get('components', [])
            if item.get('component_type') == 'indicator'
        ]
        self.assertGreaterEqual(len(indicator_components), 1)
        self.assertEqual(indicator_components[0].get('indicator_name'), 'RSI')

    @patch('portfolio.views._sprint17_build_component_templates')
    @patch('portfolio.views._sprint17_generate_component_templates_with_ai', return_value=[])
    @patch('portfolio.order_flow.detect_dark_flow')
    def test_stock_ai_advisory_components_generate_without_chart_context_has_no_warning(
        self,
        mock_detect_dark_flow,
        mock_generate_with_ai,
        mock_build_templates,
    ):
        self._attach_dpi_license('pro', {'sentiment_score': True})
        self.authenticate()
        self._create_stock_workspace_advisory(symbol='BCM')

        mock_detect_dark_flow.return_value = {
            'signal_type': 'iceberg',
            'strength': 40,
            'confidence': 'medium',
            'components': {},
        }
        mock_build_templates.return_value = [
            {
                'symbol': 'BCM',
                'component_type': 'indicator',
                'indicator_name': 'MA',
                'status': 'neutral',
                'confidence_score': 5,
                'suggested_action': 'watch',
                'rationale_text': 'no-chart-context',
                'timeframe': '30m',
                'include_in_summary': True,
            },
        ]

        response = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-components/generate/',
            {'timeframe': '30m'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.data['chart_context_used'])
        self.assertEqual(response.data['chart_context_warnings'], [])
        kwargs = mock_generate_with_ai.call_args.kwargs
        self.assertIsNone(kwargs.get('chart_context'))

    @patch('portfolio.views._sprint17_build_component_templates')
    @patch('portfolio.views._sprint17_generate_component_templates_with_ai', return_value=[])
    @patch('portfolio.order_flow.detect_dark_flow')
    def test_stock_ai_advisory_components_generate_chart_context_oversize_points_sets_warning(
        self,
        mock_detect_dark_flow,
        mock_generate_with_ai,
        mock_build_templates,
    ):
        self._attach_dpi_license('pro', {'sentiment_score': True})
        self.authenticate()
        self._create_stock_workspace_advisory(symbol='BCM')

        mock_detect_dark_flow.return_value = {
            'signal_type': 'iceberg',
            'strength': 40,
            'confidence': 'medium',
            'components': {},
        }
        mock_build_templates.return_value = [
            {
                'symbol': 'BCM',
                'component_type': 'indicator',
                'indicator_name': 'MA',
                'status': 'neutral',
                'confidence_score': 5,
                'suggested_action': 'watch',
                'rationale_text': 'oversize-chart-context',
                'timeframe': '30m',
                'include_in_summary': True,
            },
        ]

        ohlcv = [
            {'ts': 1712500000000 + i * 60000, 'o': 70.0, 'h': 70.3, 'l': 69.9, 'c': 70.1, 'v': 100000}
            for i in range(301)
        ]

        response = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-components/generate/',
            {
                'timeframe': '30m',
                'chart_context': {
                    'symbol': 'BCM',
                    'chart_timeframe': '30m',
                    'ohlcv': ohlcv,
                },
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.data['chart_context_used'])
        self.assertIn('chart_context_invalid', response.data['chart_context_warnings'])
        kwargs = mock_generate_with_ai.call_args.kwargs
        self.assertIsNone(kwargs.get('chart_context'))