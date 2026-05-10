"""
Native public bootstrap route tests.

ISOLATION RULE: No imports from backend.portfolio or backend.* allowed.
"""
import os
import sys
from unittest.mock import patch

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

import httpx
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.urls import resolve
from rest_framework import status
from rest_framework.test import APIClient

from commercial.views import PublicLegalPagesView
from market_data.views import TrackedSymbolsView


class NativePublicBootstrapRouteTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='bootstrap-owner', password='testpass123')

    def test_public_legal_pages_route_resolves_and_returns_results_envelope(self):
        resolver = resolve('/api/public/legal-pages/')
        self.assertIs(resolver.func.view_class, PublicLegalPagesView)

        response = self.client.get('/api/public/legal-pages/?locale=vi')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {'results': []})

    @override_settings(LEGACY_BACKEND_URL='')
    def test_tracked_symbols_route_resolves_and_returns_empty_list(self):
        self.client.force_authenticate(user=self.user)

        resolver = resolve('/api/stock-management/tracked-symbols/')
        self.assertIs(resolver.func.view_class, TrackedSymbolsView)

        response = self.client.get('/api/stock-management/tracked-symbols/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    @override_settings(LEGACY_BACKEND_URL='http://legacy.internal')
    @patch('vninvest_core.legacy_http_bridge.httpx.request')
    def test_tracked_symbols_route_bridges_to_legacy_when_enabled(self, mock_request):
        self.client.force_authenticate(user=self.user)
        auth_header = 'Bearer vni_pat_bridge_test'
        mock_request.side_effect = [
            httpx.Response(200, json=[{'id': 1, 'symbol': 'FPT'}]),
            httpx.Response(201, json={'id': 2, 'symbol': 'VCB'}),
        ]

        get_response = self.client.get('/api/stock-management/tracked-symbols/?page=1', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(get_response.status_code, status.HTTP_200_OK)
        self.assertEqual(get_response.data[0]['symbol'], 'FPT')

        post_response = self.client.post(
            '/api/stock-management/tracked-symbols/',
            {'symbol': 'VCB'},
            format='json',
            HTTP_AUTHORIZATION=auth_header,
        )
        self.assertEqual(post_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(post_response.data['symbol'], 'VCB')

        self.assertEqual(mock_request.call_count, 2)
        first_call = mock_request.call_args_list[0].kwargs
        second_call = mock_request.call_args_list[1].kwargs
        self.assertEqual(first_call['url'], 'http://legacy.internal/api/stock-management/tracked-symbols/')
        self.assertEqual(first_call['params'], {'page': '1'})
        self.assertEqual(first_call['headers']['Authorization'], auth_header)
        self.assertEqual(first_call['headers']['Host'], 'testserver')
        self.assertEqual(second_call['json'], {'symbol': 'VCB'})