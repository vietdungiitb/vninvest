from unittest.mock import patch

from rest_framework import status
from rest_framework.test import APITestCase

from portfolio.models import AIAdvisoryComponentRecord, AdvisoryAggregateAuditLog, WhaleAdvisory


class ApiRouteStockWorkspaceUsagePersistenceTests(APITestCase):
    def setUp(self):
        from . import test_api_routes as legacy_routes

        legacy_routes.ApiRouteSmokeTests.setUp(self)
        _ai_ready = {'ready': True, 'message': 'ok', 'reason': ''}
        self._patcher_ai_status = patch('portfolio.views._get_ai_runtime_config_status', return_value=_ai_ready)
        self._patcher_ai_status.start()
        self.addCleanup(self._patcher_ai_status.stop)

    def authenticate(self):
        from . import test_api_routes as legacy_routes

        return legacy_routes.ApiRouteSmokeTests.authenticate(self)

    def _attach_dpi_license(self, plan_name, feature_flags=None, status='active', grace_days=7):
        from . import test_api_routes as legacy_routes

        return legacy_routes.ApiRouteSmokeTests._attach_dpi_license(self, plan_name, feature_flags, status, grace_days)

    def _create_stock_workspace_advisory(self, symbol='BCM'):
        from . import test_api_routes as legacy_routes

        return legacy_routes.ApiRouteSmokeTests._create_stock_workspace_advisory(self, symbol)

    @patch('portfolio.order_flow.detect_dark_flow')
    @patch('portfolio.order_flow.compute_cvd_series')
    def test_stock_order_flow_usage_tracking_calls_track_api_call(self, mock_cvd_series, mock_detect_dark_flow):
        self._attach_dpi_license('pro', {'dark_pool_flow': True})
        self.authenticate()
        mock_cvd_series.return_value = []
        mock_detect_dark_flow.return_value = {
            'signal_type': None,
            'strength': 0,
            'confidence': 'low',
            'components': {},
        }

        with patch('portfolio.views.track_api_call') as mock_track_api_call:
            response = self.client.get('/api/stock-management/stocks/FPT/order-flow/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(mock_track_api_call.called)
        self.assertEqual(mock_track_api_call.call_args.kwargs.get('feature'), 'dark_pool_flow')
        self.assertEqual(mock_track_api_call.call_args.kwargs.get('status_code'), status.HTTP_200_OK)

    def test_stock_ai_advisory_session_usage_tracking_calls_track_api_call(self):
        self._attach_dpi_license('pro', {'whale_momentum': True})
        self.authenticate()
        self._create_stock_workspace_advisory(symbol='BCM')

        with patch('portfolio.views.track_api_call') as mock_track_api_call:
            response = self.client.get('/api/stock-management/stocks/BCM/ai-advisory-session/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(mock_track_api_call.called)
        self.assertEqual(mock_track_api_call.call_args.kwargs.get('feature'), 'whale_momentum')
        self.assertEqual(mock_track_api_call.call_args.kwargs.get('status_code'), status.HTTP_200_OK)

    @patch('portfolio.views._sprint17_generate_component_templates_with_ai', return_value=[])
    @patch('portfolio.views._sprint17_build_component_templates')
    @patch('portfolio.order_flow.detect_dark_flow')
    def test_stock_ai_advisory_components_generate_usage_tracking_calls_track_api_call(
        self,
        mock_detect_dark_flow,
        mock_build_templates,
        _mock_generate_with_ai,
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
                'rationale_text': 'tracking-test',
                'timeframe': '30m',
                'include_in_summary': True,
            },
        ]

        with patch('portfolio.views.track_api_call') as mock_track_api_call:
            response = self.client.post(
                '/api/stock-management/stocks/BCM/ai-advisory-components/generate/',
                {'timeframe': '30m'},
                format='json',
            )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(mock_track_api_call.called)
        self.assertEqual(mock_track_api_call.call_args.kwargs.get('feature'), 'sentiment_score')
        self.assertEqual(mock_track_api_call.call_args.kwargs.get('status_code'), status.HTTP_201_CREATED)

    def test_stock_ai_advisory_components_generate_creates_component_records(self):
        self.authenticate()
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='BCM',
            matched_value=7_000_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Stock workspace summary',
            ai_detail='Stock workspace detail',
            ai_provider='copilot',
            ai_model='openai/gpt-4o',
        )

        response = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-components/generate/',
            {'timeframe': '15m'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['ok'])
        self.assertGreaterEqual(response.data['created_count'], 3)
        self.assertIn('generated_by_ai', response.data)
        self.assertEqual(AIAdvisoryComponentRecord.objects.filter(user=self.user, symbol='BCM', is_deleted=False).count(), response.data['created_count'])

    @patch('portfolio.views._sprint17_build_component_templates')
    @patch('portfolio.views._sprint17_generate_component_templates_with_ai', return_value=[])
    @patch('portfolio.order_flow.detect_dark_flow')
    def test_stock_ai_advisory_components_generate_persists_component_metrics_audit_log(
        self,
        mock_detect_dark_flow,
        _mock_generate_with_ai,
        mock_build_templates,
    ):
        self.authenticate()
        self._create_stock_workspace_advisory(symbol='BCM')
        mock_detect_dark_flow.return_value = {
            'signal_type': 'iceberg',
            'strength': 72,
            'confidence': 'high',
            'components': {'tick_rate': {'score': 18}},
        }
        mock_build_templates.return_value = [
            {
                'symbol': 'BCM',
                'component_type': 'indicator',
                'indicator_name': 'RSI',
                'status': 'bullish',
                'confidence_score': 8,
                'suggested_action': 'accumulate',
                'rationale_text': 'component-metrics-test',
                'timeframe': '15m',
                'include_in_summary': True,
            },
            {
                'symbol': 'BCM',
                'component_type': 'flow',
                'indicator_name': 'DARK_FLOW',
                'status': 'bullish',
                'confidence_score': 9,
                'suggested_action': 'follow',
                'rationale_text': 'dark-flow-component',
                'timeframe': '15m',
                'include_in_summary': True,
            },
        ]

        response = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-components/generate/',
            {'timeframe': '15m'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        audit = AdvisoryAggregateAuditLog.objects.get(user=self.user, symbol='BCM')
        self.assertEqual(audit.reason, AdvisoryAggregateAuditLog.ReasonChoices.MANUAL_REFRESH)
        self.assertEqual(audit.actor, AdvisoryAggregateAuditLog.ActorChoices.USER)
        self.assertEqual(audit.metadata_json['operation'], 'component_generation')
        self.assertEqual(audit.metadata_json['timeframe'], '15m')
        self.assertEqual(audit.metadata_json['created_count'], 2)
        self.assertGreaterEqual(audit.metadata_json['latency_ms'], 0)
        self.assertIn('component_template_generation', audit.metadata_json['phase_timings'])
        self.assertIn('template_generation_fallback', audit.metadata_json['component_timings'])
        self.assertIn('indicator:RSI', audit.metadata_json['created_component_keys'])
