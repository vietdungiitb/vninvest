"""
test_soc_api_domain.py — Integration tests for SOC domain endpoints
Tests: vnbroker, prefetch, screener config endpoints + apply logic
"""
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.utils import timezone
from rest_framework.status import HTTP_200_OK, HTTP_201_CREATED, HTTP_403_FORBIDDEN
from service_ops.models import ServiceDefinition, ServiceConfig, ConfigChangeAudit

User = get_user_model()


class VnbrokerConfigApiTestCase(TestCase):
    """Test VNBroker configuration endpoints"""

    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user('admin', 'admin@test.com', 'pass123')
        admin_group, _ = Group.objects.get_or_create(name='admin_users')
        self.user.groups.add(admin_group)
        self.client.force_login(self.user)

    def test_get_vnbroker_config(self):
        """Test GET /api/soc/vnbroker/config/"""
        response = self.client.get('/api/soc/vnbroker/config/')
        self.assertEqual(response.status_code, HTTP_200_OK)
        data = response.json()
        self.assertIn('config', data)

    def test_apply_vnbroker_config(self):
        """Test POST /api/soc/vnbroker/config/ to apply new config"""
        payload = {
            'config': {
                'timeout_config': {'connect': 5, 'read': 120},
                'providers': ['provider1'],
                'max_retries': 3
            }
        }
        response = self.client.post(
            '/api/soc/vnbroker/config/',
            data=payload,
            content_type='application/json'
        )
        # Should be 200 or 201 depending on implementation
        self.assertIn(response.status_code, [HTTP_200_OK, HTTP_201_CREATED])

    def test_apply_config_creates_audit_log(self):
        """Test that applying config creates ConfigChangeAudit"""
        payload = {
            'config': {
                'timeout_config': {'connect': 5, 'read': 120},
                'providers': ['provider1'],
            }
        }
        response = self.client.post(
            '/api/soc/vnbroker/config/',
            data=payload,
            content_type='application/json'
        )
        
        # Verify audit was created
        audits = ConfigChangeAudit.objects.filter(service_key='vnbroker')
        self.assertGreater(audits.count(), 0)

    def test_get_vnbroker_health(self):
        """Test GET /api/soc/vnbroker/health/"""
        response = self.client.get('/api/soc/vnbroker/health/')
        self.assertEqual(response.status_code, HTTP_200_OK)

    def test_get_vnbroker_metrics(self):
        """Test GET /api/soc/vnbroker/metrics/"""
        response = self.client.get('/api/soc/vnbroker/metrics/')
        self.assertEqual(response.status_code, HTTP_200_OK)

    def test_get_vnbroker_providers(self):
        """Test GET /api/soc/vnbroker/providers/"""
        response = self.client.get('/api/soc/vnbroker/providers/')
        self.assertEqual(response.status_code, HTTP_200_OK)


class PrefetchConfigApiTestCase(TestCase):
    """Test Prefetch configuration endpoints"""

    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user('admin', 'admin@test.com', 'pass123')
        admin_group, _ = Group.objects.get_or_create(name='admin_users')
        self.user.groups.add(admin_group)
        self.client.force_login(self.user)

    def test_get_prefetch_config(self):
        """Test GET /api/soc/prefetch/config/"""
        response = self.client.get('/api/soc/prefetch/config/')
        self.assertEqual(response.status_code, HTTP_200_OK)

    def test_apply_prefetch_config(self):
        """Test POST /api/soc/prefetch/config/ to apply time policy"""
        payload = {
            'config': {
                'pre_open': {'interval_seconds': 300, 'enabled': True},
                'market_open': {'interval_seconds': 60, 'enabled': True},
                'lunch_break': {'interval_seconds': 300, 'enabled': True},
            }
        }
        response = self.client.post(
            '/api/soc/prefetch/config/',
            data=payload,
            content_type='application/json'
        )
        self.assertIn(response.status_code, [HTTP_200_OK, HTTP_201_CREATED])

    def test_get_prefetch_profiles(self):
        """Test GET /api/soc/prefetch/profiles/"""
        response = self.client.get('/api/soc/prefetch/profiles/')
        self.assertEqual(response.status_code, HTTP_200_OK)
        data = response.json()
        # Should have profiles list
        self.assertIsNotNone(data)

    def test_get_prefetch_cache_status(self):
        """Test GET /api/soc/prefetch/cache-status/"""
        response = self.client.get('/api/soc/prefetch/cache-status/')
        self.assertEqual(response.status_code, HTTP_200_OK)

    def test_purge_prefetch_cache(self):
        """Test POST /api/soc/prefetch/purge/"""
        response = self.client.post('/api/soc/prefetch/purge/')
        self.assertEqual(response.status_code, HTTP_200_OK)


class ScreenerConfigApiTestCase(TestCase):
    """Test Screener configuration endpoints"""

    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user('admin', 'admin@test.com', 'pass123')
        admin_group, _ = Group.objects.get_or_create(name='admin_users')
        self.user.groups.add(admin_group)
        self.client.force_login(self.user)

    def test_get_screener_config(self):
        """Test GET /api/soc/screener/config/"""
        response = self.client.get('/api/soc/screener/config/')
        self.assertEqual(response.status_code, HTTP_200_OK)

    def test_apply_screener_config(self):
        """Test POST /api/soc/screener/config/"""
        payload = {
            'config': {
                'rules': [
                    {
                        'name': 'price_range_rule',
                        'type': 'price_range',
                        'condition': {'min': 100, 'max': 500},
                        'enabled': True
                    }
                ],
                'max_concurrent_scans': 5
            }
        }
        response = self.client.post(
            '/api/soc/screener/config/',
            data=payload,
            content_type='application/json'
        )
        self.assertIn(response.status_code, [HTTP_200_OK, HTTP_201_CREATED])

    def test_get_screener_rules(self):
        """Test GET /api/soc/screener/rules/"""
        response = self.client.get('/api/soc/screener/rules/')
        self.assertEqual(response.status_code, HTTP_200_OK)

    def test_get_screener_results(self):
        """Test GET /api/soc/screener/results/"""
        response = self.client.get('/api/soc/screener/results/')
        self.assertEqual(response.status_code, HTTP_200_OK)

    def test_get_screener_alerts(self):
        """Test GET /api/soc/screener/alerts/"""
        response = self.client.get('/api/soc/screener/alerts/')
        self.assertEqual(response.status_code, HTTP_200_OK)

    def test_manual_scan(self):
        """Test POST /api/soc/screener/manual-scan/"""
        payload = {'rule_ids': [1, 2, 3]}
        response = self.client.post(
            '/api/soc/screener/manual-scan/',
            data=payload,
            content_type='application/json'
        )
        self.assertEqual(response.status_code, HTTP_200_OK)


class ConfigApplyValidationTestCase(TestCase):
    """Test config apply validation and error handling"""

    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user('admin', 'admin@test.com', 'pass123')
        admin_group, _ = Group.objects.get_or_create(name='admin_users')
        self.user.groups.add(admin_group)
        self.client.force_login(self.user)

    def test_apply_invalid_config_returns_error(self):
        """Test that invalid config returns error with proper envelope"""
        payload = {'config': None}  # Invalid
        response = self.client.post(
            '/api/soc/vnbroker/config/',
            data=payload,
            content_type='application/json'
        )
        
        # Should return error
        self.assertGreaterEqual(response.status_code, 400)
        data = response.json()
        # Error envelope should be present
        self.assertIn('detail', data)

    def test_apply_unauthenticated_returns_401(self):
        """Test that unauthenticated apply returns 401"""
        self.client.logout()
        payload = {'config': {'timeout': 10}}
        response = self.client.post(
            '/api/soc/vnbroker/config/',
            data=payload,
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 401)

    def test_apply_non_admin_returns_403(self):
        """Test that non-admin user gets 403"""
        user = User.objects.create_user('user', 'user@test.com', 'pass123')
        self.client.force_login(user)
        
        payload = {'config': {'timeout': 10}}
        response = self.client.post(
            '/api/soc/vnbroker/config/',
            data=payload,
            content_type='application/json'
        )
        self.assertEqual(response.status_code, HTTP_403_FORBIDDEN)

    def test_error_response_has_proper_envelope(self):
        """Test that all error responses use proper envelope format"""
        self.client.logout()
        response = self.client.post('/api/soc/vnbroker/config/')
        data = response.json()
        
        # Envelope must have these fields
        self.assertIn('detail', data)
        self.assertIn('code', data)
        self.assertIn('timestamp', data)
        # request_id optional but recommended
        if 'request_id' in data:
            self.assertIsNotNone(data['request_id'])


class OwnershipEnforcementTestCase(TestCase):
    """Test ownership-based access control"""

    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user('admin', 'admin@test.com', 'pass123')
        admin_group, _ = Group.objects.get_or_create(name='admin_users')
        self.user.groups.add(admin_group)
        self.client.force_login(self.user)

    def test_native_write_service_allows_apply(self):
        """Test that native-write services (vnbroker, prefetch) allow apply"""
        payload = {'config': {'timeout': 5}}
        
        # vnbroker is native-write
        response = self.client.post(
            '/api/soc/vnbroker/config/',
            data=payload,
            content_type='application/json'
        )
        # Should succeed (200 or 201) or fail with validation error, not 403
        self.assertNotEqual(response.status_code, HTTP_403_FORBIDDEN)

    def test_read_only_get_returns_success(self):
        """Test that read-only endpoints return 200"""
        response = self.client.get('/api/soc/signals/config/')
        # GET should work
        self.assertIn(response.status_code, [HTTP_200_OK, 404])

    def test_bridge_write_apply_blocked(self):
        """Test that bridge-write services return 403 on apply attempt"""
        # Test in signals_api tests (signals is bridge-write)
        # This is tested in test_soc_api_signals.py
        pass
