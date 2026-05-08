"""
Native public bootstrap route tests.

ISOLATION RULE: No imports from backend.portfolio or backend.* allowed.
"""
import os
import sys

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

from django.contrib.auth.models import User
from django.test import TestCase
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

    def test_tracked_symbols_route_resolves_and_returns_empty_list(self):
        self.client.force_authenticate(user=self.user)

        resolver = resolve('/api/stock-management/tracked-symbols/')
        self.assertIs(resolver.func.view_class, TrackedSymbolsView)

        response = self.client.get('/api/stock-management/tracked-symbols/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])