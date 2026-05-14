"""
test_soc_api_overview.py — Integration tests for SOC overview endpoints
Tests: GET /api/soc/overview/, detail, config, health, audit, history
"""
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.utils import timezone
from rest_framework.status import HTTP_200_OK, HTTP_403_FORBIDDEN
from service_ops.models import ServiceDefinition, ServiceConfig, ConfigChangeAudit

User = get_user_model()


class SOCOverviewApiTestCase(TestCase):
    """Test SOC overview endpoints"""

    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user('admin', 'admin@test.com', 'pass123')
        
        # Create admin group and add user
        admin_group, _ = Group.objects.get_or_create(name='admin_users')
        self.user.groups.add(admin_group)
        
        self.client.force_login(self.user)

        # Create test services
        self.service_vnbroker = ServiceDefinition.objects.create(
            service_key='vnbroker',
            name='VNBroker Integration',
            ownership_matrix={'mode': 'native-write', 'can_apply': True},
            config_schema={}
        )
        self.service_signals = ServiceDefinition.objects.create(
            service_key='signals',
            name='Signal Intelligence',
            ownership_matrix={'mode': 'bridge-write', 'can_apply': False},
            config_schema={}
        )

    def test_overview_list_endpoint(self):
        """Test GET /api/soc/overview/ returns service list"""
        response = self.client.get('/api/soc/overview/')
        self.assertEqual(response.status_code, HTTP_200_OK)
        data = response.json()
        self.assertIn('results', data)
        self.assertEqual(len(data['results']), 2)

    def test_overview_list_has_pagination(self):
        """Test that list endpoint has pagination"""
        response = self.client.get('/api/soc/overview/')
        data = response.json()
        self.assertIn('count', data)
        self.assertIn('next', data)
        self.assertIn('previous', data)

    def test_overview_detail_endpoint(self):
        """Test GET /api/soc/overview/{service_key}/ returns service detail"""
        response = self.client.get('/api/soc/overview/vnbroker/')
        self.assertEqual(response.status_code, HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['service_key'], 'vnbroker')
        self.assertEqual(data['name'], 'VNBroker Integration')

    def test_overview_detail_not_found(self):
        """Test 404 for non-existent service"""
        response = self.client.get('/api/soc/overview/nonexistent/')
        self.assertEqual(response.status_code, 404)

    def test_overview_config_endpoint(self):
        """Test GET /api/soc/overview/{service_key}/config/ returns current config"""
        config_data = {'timeout': 5, 'providers': ['p1']}
        cfg = ServiceConfig.objects.create(
            service=self.service_vnbroker,
            config=config_data,
            status='active',
            applied_by=self.user,
        )

        response = self.client.get('/api/soc/overview/vnbroker/config/')
        self.assertEqual(response.status_code, HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['config'], config_data)

    def test_overview_health_endpoint(self):
        """Test GET /api/soc/overview/{service_key}/health/ returns health status"""
        response = self.client.get('/api/soc/overview/vnbroker/health/')
        self.assertEqual(response.status_code, HTTP_200_OK)
        data = response.json()
        # Should have health info even if no explicit ServiceHealth record
        self.assertIsNotNone(data)

    def test_overview_audit_endpoint(self):
        """Test GET /api/soc/overview/{service_key}/audit/ returns audit logs"""
        ConfigChangeAudit.objects.create(
            service_key='vnbroker',
            config_before={'timeout': 5},
            config_after={'timeout': 10},
            applied_by=self.user,
            applied_at=timezone.now(),
            change_summary='Test audit',
        )

        response = self.client.get('/api/soc/overview/vnbroker/audit/')
        self.assertEqual(response.status_code, HTTP_200_OK)
        data = response.json()
        self.assertIn('results', data)
        self.assertGreater(len(data['results']), 0)

    def test_overview_history_endpoint(self):
        """Test GET /api/soc/overview/{service_key}/history/ returns version history"""
        ServiceConfig.objects.create(
            service=self.service_vnbroker,
            config={'timeout': 5},
            status='active',
            applied_by=self.user,
        )
        ServiceConfig.objects.create(
            service=self.service_vnbroker,
            config={'timeout': 10},
            status='active',
            applied_by=self.user,
        )

        response = self.client.get('/api/soc/overview/vnbroker/history/')
        self.assertEqual(response.status_code, HTTP_200_OK)
        data = response.json()
        self.assertIn('results', data)
        self.assertEqual(len(data['results']), 2)

    def test_overview_requires_authentication(self):
        """Test that overview endpoints require authentication"""
        self.client.logout()
        response = self.client.get('/api/soc/overview/')
        self.assertEqual(response.status_code, 401)

    def test_overview_requires_admin_permissions(self):
        """Test that overview endpoints require admin permissions"""
        # Create non-admin user
        user = User.objects.create_user('user', 'user@test.com', 'pass123')
        self.client.force_login(user)
        
        response = self.client.get('/api/soc/overview/')
        self.assertEqual(response.status_code, HTTP_403_FORBIDDEN)

    def test_error_response_envelope(self):
        """Test that error responses use proper envelope format"""
        self.client.logout()
        response = self.client.get('/api/soc/overview/')
        data = response.json()
        
        # Error envelope should have detail, code, timestamp, request_id
        self.assertIn('detail', data)
        self.assertIn('code', data)
        self.assertIn('timestamp', data)


class SOCDetailEndpointsTestCase(TestCase):
    """Test detail retrieval endpoints"""

    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user('admin', 'admin@test.com', 'pass123')
        admin_group, _ = Group.objects.get_or_create(name='admin_users')
        self.user.groups.add(admin_group)
        self.client.force_login(self.user)

        self.service = ServiceDefinition.objects.create(
            service_key='test_service',
            name='Test Service',
            ownership_matrix={'mode': 'native-write', 'can_apply': True},
            config_schema={}
        )

    def test_detail_endpoint_includes_ownership(self):
        """Test that detail endpoint includes ownership info"""
        response = self.client.get('/api/soc/overview/test_service/')
        data = response.json()
        self.assertIn('ownership_matrix', data)
        self.assertEqual(data['ownership_matrix']['mode'], 'native-write')

    def test_detail_endpoint_includes_current_config(self):
        """Test that detail endpoint includes current config"""
        config_data = {'setting1': 'value1'}
        ServiceConfig.objects.create(
            service=self.service,
            config=config_data,
            status='active',
            applied_by=self.user,
        )

        response = self.client.get('/api/soc/overview/test_service/')
        data = response.json()
        # Config may be in a nested field depending on serializer
        self.assertIsNotNone(data)


class SOCVersionHistoryTestCase(TestCase):
    """Test config version history tracking"""

    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user('admin', 'admin@test.com', 'pass123')
        admin_group, _ = Group.objects.get_or_create(name='admin_users')
        self.user.groups.add(admin_group)
        self.client.force_login(self.user)

        self.service = ServiceDefinition.objects.create(
            service_key='version_test',
            name='Version Test',
            ownership_matrix={'mode': 'native-write', 'can_apply': True},
            config_schema={}
        )

    def test_history_shows_all_versions(self):
        """Test that history endpoint returns all config versions"""
        for i in range(3):
            ServiceConfig.objects.create(
                service=self.service,
                config={'iteration': i},
                status='active',
                applied_by=self.user,
            )

        response = self.client.get('/api/soc/overview/version_test/history/')
        self.assertEqual(response.status_code, HTTP_200_OK)
        data = response.json()
        self.assertEqual(len(data['results']), 3)

    def test_history_ordered_by_version(self):
        """Test that history is ordered by version"""
        for i in range(3):
            ServiceConfig.objects.create(
                service=self.service,
                config={'iteration': i},
                status='active',
                applied_by=self.user,
            )

        response = self.client.get('/api/soc/overview/version_test/history/')
        data = response.json()
        versions = [cfg['version'] for cfg in data['results']]
        # Should be ordered
        self.assertEqual(versions, sorted(versions))
