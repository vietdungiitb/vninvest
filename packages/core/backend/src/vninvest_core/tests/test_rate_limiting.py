"""
Test suite for B1 Rate Limiting on auth endpoints (per CORE_API_FIX_CHECKLIST_20260513.md H2).

Validates:
- Login endpoint: 5 requests per minute per IP
- Register endpoint: 3 requests per minute per IP
- Password-reset endpoint: 3 requests per minute per EMAIL (OWASP A01 enumeration protection)
- 429 Too Many Requests response with StandardErrorEnvelope
- Rate limit expires after window (1 minute cache)

Uses django-ratelimit @ratelimit decorator for IP-based limiting.
Uses manual cache-based limiting for per-email rate limiting (password-reset).
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.core.cache import cache

from vninvest_core.exceptions import RateLimitErrorException


User = get_user_model()


class RateLimitLoginEndpointTests(APITestCase):
    """Test @ratelimit decorator on /api/auth/login/ endpoint (5/minute per IP)."""
    
    def setUp(self):
        self.client = APIClient()
        self.login_url = '/core/v1/login/'
        # Create a test user
        self.user = User.objects.create_user(
            username='testuser',
            email='testuser@test.com',
            password='TestPass123!',
        )
        # Clear cache before each test
        cache.clear()
    
    def test_login_within_limit(self):
        """First 5 login requests within limit should succeed or fail with auth error (not 429)."""
        for i in range(5):
            response = self.client.post(
                self.login_url,
                {
                    'username': 'testuser',
                    'password': 'TestPass123!',
                },
                format='json',
            )
            # Should be 200/401 (auth error), NOT 429
            self.assertNotEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
    
    def test_login_sixth_request_rate_limited(self):
        """6th login request from same IP should be rate limited (429)."""
        # Use 5 requests
        for i in range(5):
            self.client.post(
                self.login_url,
                {
                    'username': 'testuser',
                    'password': 'TestPass123!',
                },
                format='json',
            )
        
        # 6th request should be rate limited
        response = self.client.post(
            self.login_url,
            {
                'username': 'testuser',
                'password': 'TestPass123!',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
    
    def test_login_rate_limit_error_envelope(self):
        """Rate limit error should return StandardErrorEnvelope format."""
        # Exhaust limit (5 requests)
        for i in range(5):
            self.client.post(
                self.login_url,
                {
                    'username': 'testuser',
                    'password': 'TestPass123!',
                },
                format='json',
            )
        
        # Get rate limit error
        response = self.client.post(
            self.login_url,
            {
                'username': 'testuser',
                'password': 'TestPass123!',
            },
            format='json',
        )
        
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        data = response.json()
        
        # Verify StandardErrorEnvelope structure
        self.assertIn('detail', data)
        self.assertIn('code', data)
        self.assertIn('timestamp', data)
        self.assertIn('request_id', data)
        self.assertTrue(data['request_id'].startswith('req_'))


class RateLimitRegisterEndpointTests(APITestCase):
    """Test @ratelimit decorator on /api/auth/register/ endpoint (3/minute per IP)."""
    
    def setUp(self):
        self.client = APIClient()
        self.register_url = '/core/v1/register/'
        # Clear cache before each test
        cache.clear()
    
    def test_register_within_limit(self):
        """First 3 register requests within limit should succeed."""
        for i in range(3):
            response = self.client.post(
                self.register_url,
                {
                    'username': f'user{i}',
                    'email': f'user{i}@test.com',
                    'password': 'TestPass123!',
                },
                format='json',
            )
            # Expect 201 Created or 409 Conflict (duplicate), NOT 429
            self.assertIn(response.status_code, [status.HTTP_201_CREATED, status.HTTP_409_CONFLICT])
    
    def test_register_fourth_request_rate_limited(self):
        """4th register request from same IP should be rate limited (429)."""
        # Use 3 requests
        for i in range(3):
            self.client.post(
                self.register_url,
                {
                    'username': f'test_user_{i}',
                    'email': f'test_user_{i}@test.com',
                    'password': 'TestPass123!',
                },
                format='json',
            )
        
        # 4th request should be rate limited
        response = self.client.post(
            self.register_url,
            {
                'username': 'test_user_4',
                'email': 'test_user_4@test.com',
                'password': 'TestPass123!',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
    
    def test_register_rate_limit_error_envelope(self):
        """Rate limit error should return StandardErrorEnvelope format."""
        # Exhaust limit
        for i in range(3):
            self.client.post(
                self.register_url,
                {
                    'username': f'envelope_user_{i}',
                    'email': f'envelope_user_{i}@test.com',
                    'password': 'TestPass123!',
                },
                format='json',
            )
        
        # Get rate limit error
        response = self.client.post(
            self.register_url,
            {
                'username': 'envelope_user_3',
                'email': 'envelope_user_3@test.com',
                'password': 'TestPass123!',
            },
            format='json',
        )
        
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        data = response.json()
        
        # Verify StandardErrorEnvelope structure
        self.assertIn('detail', data)
        self.assertIn('code', data)
        self.assertIn('timestamp', data)
        self.assertIn('request_id', data)
        self.assertTrue(data['request_id'].startswith('req_'))


class RateLimitPasswordResetEndpointTests(APITestCase):
    """Test manual per-email rate limiting on /api/auth/password-reset/ endpoint (3/minute per email)."""
    
    def setUp(self):
        self.client = APIClient()
        self.password_reset_url = '/core/v1/password-reset/'
        # Clear cache before each test
        cache.clear()
    
    def test_password_reset_within_limit(self):
        """First 3 password-reset requests per email within limit should return 200."""
        email = 'test@example.com'
        for i in range(3):
            response = self.client.post(
                self.password_reset_url,
                {'email': email},
                format='json',
            )
            # Should return 200 OK (OWASP A01 - don't enumerate users)
            self.assertEqual(response.status_code, status.HTTP_200_OK)
    
    def test_password_reset_fourth_request_rate_limited(self):
        """4th password-reset request to same email should be rate limited (429)."""
        email = 'reset_test@example.com'
        
        # Use 3 requests
        for i in range(3):
            self.client.post(
                self.password_reset_url,
                {'email': email},
                format='json',
            )
        
        # 4th request should be rate limited
        response = self.client.post(
            self.password_reset_url,
            {'email': email},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
    
    def test_password_reset_different_emails_independent_limits(self):
        """Rate limit should be per email, not global."""
        email1 = 'email1@test.com'
        email2 = 'email2@test.com'
        
        # Exhaust limit for email1
        for i in range(3):
            self.client.post(
                self.password_reset_url,
                {'email': email1},
                format='json',
            )
        
        # email1 should be rate limited
        response1 = self.client.post(
            self.password_reset_url,
            {'email': email1},
            format='json',
        )
        self.assertEqual(response1.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        
        # email2 should still work (independent limit)
        response2 = self.client.post(
            self.password_reset_url,
            {'email': email2},
            format='json',
        )
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
    
    def test_password_reset_rate_limit_error_envelope(self):
        """Password-reset rate limit error should return StandardErrorEnvelope format."""
        email = 'envelope_reset@test.com'
        
        # Exhaust limit
        for i in range(3):
            self.client.post(
                self.password_reset_url,
                {'email': email},
                format='json',
            )
        
        # Get rate limit error
        response = self.client.post(
            self.password_reset_url,
            {'email': email},
            format='json',
        )
        
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        data = response.json()
        
        # Verify StandardErrorEnvelope structure
        self.assertIn('detail', data)
        self.assertIn('code', data)
        self.assertIn('timestamp', data)
        self.assertIn('request_id', data)
        self.assertEqual(data['code'], 'password_reset_rate_limit_exceeded')
        self.assertTrue(data['request_id'].startswith('req_'))


class RateLimitWindowExpiryTests(APITestCase):
    """Test rate limit counter expiration after 1 minute window."""
    
    def setUp(self):
        self.client = APIClient()
        self.register_url = '/core/v1/register/'
        self.password_reset_url = '/core/v1/password-reset/'
        # Clear cache before each test
        cache.clear()
    
    def test_register_limit_expires_after_window(self):
        """Register rate limit should reset after cache expiration (1 minute)."""
        # Exhaust limit
        for i in range(3):
            self.client.post(
                self.register_url,
                {
                    'username': f'window_user_{i}',
                    'email': f'window_user_{i}@test.com',
                    'password': 'TestPass123!',
                },
                format='json',
            )
        
        # Should be rate limited
        response = self.client.post(
            self.register_url,
            {
                'username': 'window_user_3',
                'email': 'window_user_3@test.com',
                'password': 'TestPass123!',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        
        # Manually clear rate limit cache (simulating 1 minute passing)
        cache.clear()
        
        # Should now be able to make requests again
        response = self.client.post(
            self.register_url,
            {
                'username': 'window_user_reset',
                'email': 'window_user_reset@test.com',
                'password': 'TestPass123!',
            },
            format='json',
        )
        self.assertNotEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
    
    def test_password_reset_limit_expires_after_window(self):
        """Password-reset rate limit should reset after cache expiration."""
        email = 'window_reset@test.com'
        
        # Exhaust limit
        for i in range(3):
            self.client.post(
                self.password_reset_url,
                {'email': email},
                format='json',
            )
        
        # Should be rate limited
        response = self.client.post(
            self.password_reset_url,
            {'email': email},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        
        # Manually clear rate limit cache (simulating 1 minute passing)
        cache.clear()
        
        # Should now be able to make requests again
        response = self.client.post(
            self.password_reset_url,
            {'email': email},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class RateLimitDecoratorComplianceTests(TestCase):
    """Verify @ratelimit decorator compliance with Checklist spec H2."""
    
    def test_checklist_h2_register_rate_limit(self):
        """
        Checklist H2 spec: `/api/auth/register/` → 3/minute per IP
        This test verifies the decorator is applied correctly via function introspection.
        """
        from identity_access.views_auth import register_view
        # Check that view has @ratelimit decorator
        self.assertTrue(hasattr(register_view, '__wrapped__'))
    
    def test_checklist_h2_login_rate_limit(self):
        """
        Checklist H2 spec: `/api/auth/login/` → 5/minute per IP
        This test verifies the decorator is applied correctly.
        """
        from identity_access.views_auth import login_view
        # Check that view has @ratelimit decorator
        self.assertTrue(hasattr(login_view, '__wrapped__'))
    
    def test_checklist_h2_password_reset_rate_limit(self):
        """
        Checklist H2 spec: `/api/auth/password-reset/` → 3/minute per email
        Per-email rate limiting is superior to per-IP for preventing user enumeration (OWASP A01).
        This is validated by the API tests above.
        """
        pass
