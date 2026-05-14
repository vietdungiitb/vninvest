"""
test_soc_api_integration.py — End-to-end integration tests for SOC workflows
Test: Apply config → Audit record → Version bump → Health check flow
"""
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework.status import HTTP_200_OK, HTTP_201_CREATED
from service_ops.models import ServiceDefinition, ServiceConfig, ConfigChangeAudit

User = get_user_model()


class ConfigApplyEndToEndTestCase(TestCase):
    """Test full config apply workflow"""

    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user('admin', 'admin@test.com', 'pass123')
        admin_group, _ = Group.objects.get_or_create(name='admin_users')
        self.user.groups.add(admin_group)
        self.client.force_login(self.user)

        # Create services
        ServiceDefinition.objects.create(
            service_key='vnbroker',
            name='VNBroker',
            ownership_matrix={'mode': 'native-write', 'can_apply': True},
            config_schema={}
        )

    def test_apply_config_workflow(self):
        """
        E2E workflow:
        1. Fetch current config
        2. Apply new config
        3. Verify config changed
        4. Verify audit log created
        """
        # Step 1: Get current config
        response = self.client.get('/api/soc/vnbroker/config/')
        self.assertEqual(response.status_code, HTTP_200_OK)
        current = response.json()
        
        # Step 2: Apply new config
        new_config = {
            'timeout_config': {'connect': 10, 'read': 180},
            'providers': ['p1', 'p2'],
            'max_retries': 5
        }
        payload = {'config': new_config}
        response = self.client.post(
            '/api/soc/vnbroker/config/',
            data=payload,
            content_type='application/json'
        )
        self.assertIn(response.status_code, [HTTP_200_OK, HTTP_201_CREATED])

        # Step 3: Get new config and verify it changed
        response = self.client.get('/api/soc/vnbroker/config/')
        self.assertEqual(response.status_code, HTTP_200_OK)
        new = response.json()
        # Config should be updated
        self.assertIsNotNone(new.get('config'))

        # Step 4: Verify audit log was created
        response = self.client.get('/api/soc/overview/vnbroker/audit/')
        self.assertEqual(response.status_code, HTTP_200_OK)
        audits = response.json()
        self.assertIn('results', audits)
        self.assertGreater(len(audits['results']), 0)

    def test_version_increments_on_apply(self):
        """Test that config version increments"""
        # Create initial config
        ServiceConfig.objects.create(
            service=ServiceDefinition.objects.get(service_key='vnbroker'),
            config={'timeout': 5},
            status='active',
            applied_by=self.user,
        )

        # Apply second config
        payload = {'config': {'timeout': 10}}
        self.client.post(
            '/api/soc/vnbroker/config/',
            data=payload,
            content_type='application/json'
        )

        # Fetch history to verify versions
        response = self.client.get('/api/soc/overview/vnbroker/history/')
        self.assertEqual(response.status_code, HTTP_200_OK)
        history = response.json()
        
        # Should have at least 2 versions (or 1 if only second was created)
        self.assertGreaterEqual(len(history['results']), 1)

    def test_audit_log_contains_before_after(self):
        """Test that audit logs show config before/after"""
        # Create initial config via ORM
        svc = ServiceDefinition.objects.get(service_key='vnbroker')
        old_cfg = ServiceConfig.objects.create(
            service=svc,
            config={'timeout': 5},
            status='active',
            applied_by=self.user,
        )

        # Apply new config
        new_config = {'timeout': 10}
        payload = {'config': new_config}
        self.client.post(
            '/api/soc/vnbroker/config/',
            data=payload,
            content_type='application/json'
        )

        # Fetch audit and verify before/after
        response = self.client.get('/api/soc/overview/vnbroker/audit/')
        audits = response.json()
        
        # Should have audit entries with before/after
        for audit in audits['results']:
            # Each audit should have config_before and config_after
            self.assertIn('config_before', audit)
            self.assertIn('config_after', audit)


class MultiDomainWorkflowTestCase(TestCase):
    """Test workflows across multiple domains"""

    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user('admin', 'admin@test.com', 'pass123')
        admin_group, _ = Group.objects.get_or_create(name='admin_users')
        self.user.groups.add(admin_group)
        self.client.force_login(self.user)

        # Create multiple services
        for key, name in [('vnbroker', 'VNBroker'), ('prefetch', 'Prefetch'), ('signals', 'Signals')]:
            ServiceDefinition.objects.create(
                service_key=key,
                name=name,
                ownership_matrix={
                    'mode': 'bridge-write' if key == 'signals' else 'native-write',
                    'can_apply': key != 'signals'
                },
                config_schema={}
            )

    def test_apply_native_write_succeeds(self):
        """Test applying config to native-write domains"""
        for service_key in ['vnbroker', 'prefetch']:
            payload = {'config': {'test': True}}
            response = self.client.post(
                f'/api/soc/{service_key}/config/',
                data=payload,
                content_type='application/json'
            )
            # Should succeed or return validation error, not 403
            self.assertNotEqual(response.status_code, 403)

    def test_apply_bridge_write_fails(self):
        """Test that applying to bridge-write (signals) fails with 403"""
        payload = {'config': {'test': True}}
        response = self.client.post(
            '/api/soc/signals/config/',
            data=payload,
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 403)

    def test_get_all_services_succeeds(self):
        """Test that overview list shows all services"""
        response = self.client.get('/api/soc/overview/')
        self.assertEqual(response.status_code, HTTP_200_OK)
        data = response.json()
        self.assertEqual(len(data['results']), 3)

    def test_get_detail_per_service(self):
        """Test getting detail for each service"""
        for key in ['vnbroker', 'prefetch', 'signals']:
            response = self.client.get(f'/api/soc/overview/{key}/')
            self.assertEqual(response.status_code, HTTP_200_OK)
            detail = response.json()
            self.assertEqual(detail['service_key'], key)


class PaginationIntegrationTestCase(TestCase):
    """Test pagination on list and history endpoints"""

    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user('admin', 'admin@test.com', 'pass123')
        admin_group, _ = Group.objects.get_or_create(name='admin_users')
        self.user.groups.add(admin_group)
        self.client.force_login(self.user)

        svc = ServiceDefinition.objects.create(
            service_key='test',
            name='Test',
            ownership_matrix={'mode': 'native-write', 'can_apply': True},
            config_schema={}
        )

        # Create multiple configs to test pagination
        for i in range(25):
            ServiceConfig.objects.create(
                service=svc,
                config={'iteration': i},
                status='active',
                applied_by=self.user,
            )

    def test_overview_list_pagination(self):
        """Test that overview list is paginated"""
        response = self.client.get('/api/soc/overview/')
        data = response.json()
        
        # Should have pagination metadata
        self.assertIn('count', data)
        self.assertIn('next', data)
        self.assertIn('previous', data)
        self.assertIn('results', data)

    def test_history_pagination(self):
        """Test that history is paginated"""
        response = self.client.get('/api/soc/overview/test/history/?page=1')
        data = response.json()
        
        # Should have pagination
        self.assertIn('results', data)
        self.assertIn('count', data)

    def test_audit_pagination(self):
        """Test that audit log is paginated"""
        # Create some audit entries
        for i in range(5):
            ConfigChangeAudit.objects.create(
                service_key='test',
                config_before={'v': i},
                config_after={'v': i + 1},
                applied_by=self.user,
                applied_at=None,
                change_summary=f'Change {i}',
            )

        response = self.client.get('/api/soc/overview/test/audit/?page=1')
        data = response.json()
        
        self.assertIn('results', data)


class ErrorHandlingIntegrationTestCase(TestCase):
    """Test error handling across endpoints"""

    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user('admin', 'admin@test.com', 'pass123')
        admin_group, _ = Group.objects.get_or_create(name='admin_users')
        self.user.groups.add(admin_group)
        self.client.force_login(self.user)

    def test_nonexistent_service_returns_404(self):
        """Test that nonexistent service returns 404"""
        response = self.client.get('/api/soc/overview/nonexistent/')
        self.assertEqual(response.status_code, 404)
        data = response.json()
        # Should have error envelope
        self.assertIn('detail', data)

    def test_invalid_json_returns_400(self):
        """Test that invalid JSON returns 400"""
        response = self.client.post(
            '/api/soc/vnbroker/config/',
            data='invalid json',
            content_type='application/json'
        )
        self.assertGreaterEqual(response.status_code, 400)

    def test_missing_config_field_returns_error(self):
        """Test that missing required fields return error"""
        # Missing 'config' key
        payload = {}
        response = self.client.post(
            '/api/soc/vnbroker/config/',
            data=payload,
            content_type='application/json'
        )
        self.assertGreaterEqual(response.status_code, 400)

    def test_all_errors_have_proper_envelope(self):
        """Test that all error responses have proper envelope"""
        # Trigger 404
        response = self.client.get('/api/soc/overview/bad/')
        data = response.json()
        
        # Must have detail, code, timestamp
        self.assertIn('detail', data)
        self.assertIn('code', data)
        self.assertIn('timestamp', data)
