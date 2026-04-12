from unittest.mock import patch

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase


class ApiRouteSymbolInvestigationTests(APITestCase):
    def setUp(self):
        from . import test_api_routes as legacy_routes

        legacy_routes.ApiRouteSmokeTests.setUp(self)

    def authenticate(self):
        from . import test_api_routes as legacy_routes

        return legacy_routes.ApiRouteSmokeTests.authenticate(self)

    def test_symbol_investigation_endpoint_requires_auth(self):
        response = self.client.get('/api/realtime/symbol-investigation/FPT/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch('portfolio.coobservation_service.CoObservationService.get_symbol_investigation')
    def test_symbol_investigation_endpoint_returns_payload(self, mock_get_symbol_investigation):
        self.authenticate()
        mock_get_symbol_investigation.return_value = {
            'symbol': 'FPT',
            'server_time': timezone.now().isoformat(),
            'window_params': {'window': '5d'},
            'whale_campaigns': [],
            'dark_flow_signals': [],
            'co_observation_summary': {'overall_conviction': 'LOW'},
            'timeline': [],
        }

        response = self.client.get('/api/realtime/symbol-investigation/FPT/?window=5d&sort=created_at')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'FPT')
        self.assertIn('co_observation_summary', response.data)
        mock_get_symbol_investigation.assert_called_once()

    @patch('portfolio.coobservation_service.CoObservationService.get_symbol_investigation')
    def test_symbol_investigation_endpoint_supports_include_alias_params(self, mock_get_symbol_investigation):
        self.authenticate()
        mock_get_symbol_investigation.return_value = {
            'symbol': 'FPT',
            'server_time': timezone.now().isoformat(),
            'window_params': {'window': '5d'},
            'whale_campaigns': [],
            'dark_flow_signals': [],
            'correlated_campaigns': [],
            'correlated_signals': [],
            'co_observation_summary': {'overall_conviction': 'LOW'},
            'timeline': [],
            'grouped_timeline': [],
        }

        response = self.client.get('/api/realtime/symbol-investigation/FPT/?include_campaigns=false&include_signals=false')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_get_symbol_investigation.assert_called_once()
        _, kwargs = mock_get_symbol_investigation.call_args
        self.assertFalse(kwargs['include_whale'])
        self.assertFalse(kwargs['include_dark_flow'])

    def test_symbol_investigation_endpoint_rejects_invalid_sort(self):
        self.authenticate()
        response = self.client.get('/api/realtime/symbol-investigation/FPT/?sort=invalid')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Sort không hợp lệ', response.data['detail'])