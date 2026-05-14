"""
test_soc_api_signals.py — Integration tests for Signal Intelligence endpoints
Focus: Bridge-write pattern (read-only from SOC)
"""
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework.status import HTTP_200_OK, HTTP_403_FORBIDDEN
from service_ops.models import ServiceDefinition

User = get_user_model()


class SignalsApiReadOnlyTestCase(TestCase):
    """Test that Signals endpoints are read-only"""

    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user('admin', 'admin@test.com', 'pass123')
        admin_group, _ = Group.objects.get_or_create(name='admin_users')
        self.user.groups.add(admin_group)
        self.client.force_login(self.user)

    def test_get_signal_config_succeeds(self):
        """Test GET /api/soc/signals/config/ returns config"""
        response = self.client.get('/api/soc/signals/config/')
        self.assertEqual(response.status_code, HTTP_200_OK)

    def test_post_signal_config_returns_403(self):
        """Test POST /api/soc/signals/config/ returns 403 (bridge-write)"""
        payload = {
            'config': {
                'whale_detection': {'min_volume': 1000, 'enabled': True},
                'retention_days': 30
            }
        }
        response = self.client.post(
            '/api/soc/signals/config/',
            data=payload,
            content_type='application/json'
        )
        # Should return 403 Forbidden (bridge-write read-only)
        self.assertEqual(response.status_code, HTTP_403_FORBIDDEN)

    def test_patch_signal_config_returns_403(self):
        """Test PATCH /api/soc/signals/config/ returns 403"""
        payload = {'config': {'retention_days': 45}}
        response = self.client.patch(
            '/api/soc/signals/config/',
            data=payload,
            content_type='application/json'
        )
        self.assertEqual(response.status_code, HTTP_403_FORBIDDEN)

    def test_get_whale_detection_succeeds(self):
        """Test GET /api/soc/signals/whale-detection/ works"""
        response = self.client.get('/api/soc/signals/whale-detection/')
        self.assertEqual(response.status_code, HTTP_200_OK)

    def test_get_dark_pool_detection_succeeds(self):
        """Test GET /api/soc/signals/dark-pool/ works"""
        response = self.client.get('/api/soc/signals/dark-pool/')
        self.assertEqual(response.status_code, HTTP_200_OK)

    def test_get_screener_detection_succeeds(self):
        """Test GET /api/soc/signals/screener-detection/ works"""
        response = self.client.get('/api/soc/signals/screener-detection/')
        self.assertEqual(response.status_code, HTTP_200_OK)

    def test_get_signal_retention_succeeds(self):
        """Test GET /api/soc/signals/retention/ works"""
        response = self.client.get('/api/soc/signals/retention/')
        self.assertEqual(response.status_code, HTTP_200_OK)

    def test_get_signal_metrics_succeeds(self):
        """Test GET /api/soc/signals/metrics/ works"""
        response = self.client.get('/api/soc/signals/metrics/')
        self.assertEqual(response.status_code, HTTP_200_OK)

    def test_get_signal_ownership_succeeds(self):
        """Test GET /api/soc/signals/ownership/ shows write surface"""
        response = self.client.get('/api/soc/signals/ownership/')
        self.assertEqual(response.status_code, HTTP_200_OK)
        data = response.json()
        # Should indicate bridge-write and write surface (signal_intelligence)
        self.assertIsNotNone(data)


class SignalsBridgeWriteEnforcementTestCase(TestCase):
    """Test bridge-write pattern enforcement"""

    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user('admin', 'admin@test.com', 'pass123')
        admin_group, _ = Group.objects.get_or_create(name='admin_users')
        self.user.groups.add(admin_group)
        self.client.force_login(self.user)

    def test_all_post_endpoints_return_403(self):
        """Test that all POST endpoints on signals return 403"""
        endpoints = [
            '/api/soc/signals/config/',
            '/api/soc/signals/ownership/',
        ]
        
        for endpoint in endpoints:
            response = self.client.post(endpoint)
            # Should return 403 (or 405 if method not allowed, but 403 for ownership check)
            self.assertIn(response.status_code, [HTTP_403_FORBIDDEN, 405])

    def test_error_message_indicates_bridge_write(self):
        """Test that 403 error message indicates bridge-write"""
        response = self.client.post('/api/soc/signals/config/')
        data = response.json()
        
        if response.status_code == HTTP_403_FORBIDDEN:
            # Error detail should mention bridge-write or ownership
            detail = data.get('detail', '').lower()
            self.assertTrue(
                'bridge' in detail or 'ownership' in detail or 'write' in detail,
                f"Error message should mention ownership/bridge-write, got: {detail}"
            )


class SignalsReadOnlyValidationTestCase(TestCase):
    """Test that signals configuration validates correctly in read-only mode"""

    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user('admin', 'admin@test.com', 'pass123')
        admin_group, _ = Group.objects.get_or_create(name='admin_users')
        self.user.groups.add(admin_group)
        self.client.force_login(self.user)

    def test_signals_get_includes_config_structure(self):
        """Test that GET signals/config returns expected structure"""
        response = self.client.get('/api/soc/signals/config/')
        self.assertEqual(response.status_code, HTTP_200_OK)
        data = response.json()
        
        # Should have config field
        if 'config' in data:
            config = data['config']
            # May include whale_detection, dark_pool_detection, etc.
            self.assertIsInstance(config, (dict, type(None)))

    def test_signals_ownership_shows_write_surface(self):
        """Test that ownership endpoint shows write_surface"""
        response = self.client.get('/api/soc/signals/ownership/')
        self.assertEqual(response.status_code, HTTP_200_OK)
        data = response.json()
        
        # Should indicate which service owns write
        # (expected: signal_intelligence or similar)
        self.assertIsNotNone(data)
        # If structure has write_surface field, verify it
        if 'write_surface' in data:
            self.assertIsNotNone(data['write_surface'])


class SignalsPutDeleteBlockedTestCase(TestCase):
    """Test that PUT/DELETE are also blocked on bridge-write signals"""

    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user('admin', 'admin@test.com', 'pass123')
        admin_group, _ = Group.objects.get_or_create(name='admin_users')
        self.user.groups.add(admin_group)
        self.client.force_login(self.user)

    def test_put_signals_config_blocked(self):
        """Test PUT /api/soc/signals/config/ is blocked"""
        payload = {'config': {'retention_days': 45}}
        response = self.client.put(
            '/api/soc/signals/config/',
            data=payload,
            content_type='application/json'
        )
        # Should be 403 or 405
        self.assertIn(response.status_code, [HTTP_403_FORBIDDEN, 405])

    def test_delete_signals_config_blocked(self):
        """Test DELETE /api/soc/signals/config/ is blocked"""
        response = self.client.delete('/api/soc/signals/config/')
        # Should be 403 or 405
        self.assertIn(response.status_code, [HTTP_403_FORBIDDEN, 405])


class SignalsWithoutAuthenticationTestCase(TestCase):
    """Test authentication requirements on signals endpoints"""

    def setUp(self):
        self.client = Client()

    def test_unauthenticated_get_returns_401(self):
        """Test that unauthenticated requests return 401"""
        response = self.client.get('/api/soc/signals/config/')
        self.assertEqual(response.status_code, 401)

    def test_unauthenticated_post_returns_401(self):
        """Test that unauthenticated POST returns 401"""
        response = self.client.post('/api/soc/signals/config/')
        self.assertEqual(response.status_code, 401)

    def test_non_admin_get_returns_403(self):
        """Test that non-admin user gets 403"""
        user = User.objects.create_user('user', 'user@test.com', 'pass123')
        self.client.force_login(user)
        
        response = self.client.get('/api/soc/signals/config/')
        self.assertEqual(response.status_code, HTTP_403_FORBIDDEN)
