from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase


class OperatorAdminRuntimeApiTests(APITestCase):
    def setUp(self):
        self.admin_user = User.objects.create_superuser(
            username='operator-admin',
            email='operator-admin@example.com',
            password='Admin@123456',
        )
        self.regular_user = User.objects.create_user(
            username='operator-user',
            email='operator-user@example.com',
            password='User@123456',
        )

    def _authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_operator_overview_requires_admin(self):
        self._authenticate(self.regular_user)

        response = self.client.get('/api/core/v1/operator/overview/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_operator_health_requires_admin(self):
        self._authenticate(self.regular_user)

        response = self.client.get('/api/core/v1/operator/health/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_operator_overview_returns_snapshot_structure(self):
        self._authenticate(self.admin_user)

        response = self.client.get('/api/core/v1/operator/overview/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['object'], 'operator_overview_snapshot')
        self.assertIn(data['health_status'], {'healthy', 'degraded'})
        self.assertIn('summary_cards', data)
        self.assertIn('health_cards', data)
        self.assertGreaterEqual(len(data['summary_cards']), 4)
        self.assertGreaterEqual(len(data['health_cards']), 4)
        self.assertIn('sections', data)
        self.assertIn('health', data['sections'])
        self.assertIn('admin_runtime_kpi', data['sections'])
        self.assertIn('ai_runtime', data['sections'])
        health_section = data['sections']['health']
        self.assertEqual(health_section['object'], 'operator_health_snapshot')
        self.assertIn('components', health_section)
        self.assertIn('degraded_components', health_section)

    def test_operator_health_returns_snapshot_structure(self):
        self._authenticate(self.admin_user)

        response = self.client.get('/api/core/v1/operator/health/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['object'], 'operator_health_snapshot')
        self.assertIn(data['health_status'], {'healthy', 'degraded'})
        self.assertIn('components', data)
        self.assertIn('degraded_components', data)
        self.assertIn('sources', data)
        self.assertIn('prefetch', data['sources'])
        self.assertIn('market_observability', data['sources'])
        self.assertIn('admin_runtime_kpi', data['sources'])
        self.assertIn('ai_runtime', data['sources'])
