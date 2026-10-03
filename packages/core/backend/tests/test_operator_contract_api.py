"""
Native operator contract API tests.

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

from vninvest_core.contracts.operator.views import OperatorHealthView, OperatorOverviewView


class OperatorContractApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='operator-admin',
            email='operator-admin@example.com',
            password='testpass123',
        )
        self.user.is_staff = True
        self.user.is_superuser = True
        self.user.save(update_fields=['is_staff', 'is_superuser'])
        self.client.force_authenticate(user=self.user)

    def test_operator_routes_resolve_and_return_supported_snapshots(self):
        resolver_overview = resolve('/core/v1/operator/overview/')
        self.assertIs(resolver_overview.func.view_class, OperatorOverviewView)

        resolver_health = resolve('/core/v1/operator/health/')
        self.assertIs(resolver_health.func.view_class, OperatorHealthView)

        overview_response = self.client.get('/core/v1/operator/overview/')
        self.assertEqual(overview_response.status_code, status.HTTP_200_OK)
        self.assertEqual(overview_response.data['object'], 'operator_overview_snapshot')
        self.assertGreater(len(overview_response.data['summary_cards']), 0)
        self.assertGreater(len(overview_response.data['health_cards']), 0)
        self.assertIn('sections', overview_response.data)
        self.assertIn('health', overview_response.data['sections'])

        health_response = self.client.get('/core/v1/operator/health/')
        self.assertEqual(health_response.status_code, status.HTTP_200_OK)
        self.assertEqual(health_response.data['object'], 'operator_health_snapshot')
        self.assertGreater(len(health_response.data['components']), 0)
        self.assertIn('sources', health_response.data)