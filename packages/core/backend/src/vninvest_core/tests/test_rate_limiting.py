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
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from unittest.mock import MagicMock, patch
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.core.cache import cache



User = get_user_model()

#: `TURNSTILE_SECRET_KEY` đặt cho các test đăng ký. Không để rỗng vì
#: `serializers.py::_verify_turnstile` chỉ **bỏ qua** khi key rỗng; key có giá
#: trị thì bắt buộc phải có token.
TURNSTILE_KEY = 'test-secret-key'


def reg_payload(username, email, password='TestPass123!'):
    """Payload đăng ký **kèm `turnstile_token`**.

    Sửa 2026-10-13 (Entry 284 §7). `SaaSRegisterSerializer._verify_turnstile`
    (`identity_access/serializers.py`) **yêu cầu token khi `TURNSTILE_SECRET_KEY`
    có giá trị**, kể cả khi chạy test — nhánh "thiếu key mới bỏ qua" mới có điều
    kiện `settings.TESTING`, nhánh "thiếu token" thì không.

    ⇒ Các test dưới đây viết trước khi Turnstile được siết, gửi payload không
    có token ⇒ endpoint trả **400** thay vì 201/409/429 ⇒ **mọi assert về rate
    limit trở nên vô nghĩa** (5 FAIL, đã chứng minh là baseline đỏ có sẵn).

    KHÔNG sửa production code để "cho test chạy": có test chủ động kiểm Turnstile
    chặn đúng (`identity_access/tests/test_register_upgrade.py::
    test_turnstile_token_invalid_blocked`), nới lỏng ở đó sẽ xoá một lớp bảo vệ.
    """
    return {
        'username': username,
        'email': email,
        'password': password,
        'password_confirm': password,
        'turnstile_token': 'test-turnstile-token',
    }


def turnstile_ok(_url=None, **_kwargs):
    """Trả về payload Cloudflare coi token là hợp lệ.

    Dùng cho `@patch('requests.post')` — `_verify_turnstile` gọi
    `requests.post(verify_url, ...)`.
    """
    response = MagicMock()
    response.status_code = 200
    response.json.return_value = {'success': True}
    return response


class RateLimitLoginEndpointTests(APITestCase):
    """Test @ratelimit decorator on /api/auth/login/ endpoint (5/minute per IP)."""
    
    def setUp(self):
        self.client = APIClient()
        self.login_url = '/core/v1/auth/login/'
        # Create a test user
        self.user = User.objects.create_user(
            username='testuser',
            email='testuser@test.com',
            password='TestPass123!',
        )
        # Clear cache before each test
        cache.clear()
    
    @override_settings(LOGIN_USER_LIMIT_THRESHOLD=5)
    def test_login_within_limit(self):
        """First 5 login requests within limit should succeed or fail with auth error (not 429).

        Login co 3 lop throttle: IP=5, subnet=15, **user=3**
        (`settings.py:903-905`). Loop cao hon `LOGIN_USER_LIMIT_THRESHOLD` se
        cham ngan `user` truoc ngan `IP` ⇒ 429 dung chu khong phai loi. Test nay
        override ngan user len 5 de kiem tra dung y nghia: "trong han muc thi
        KHONG bi chan".
        """
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
        # Error body chuyen sang problem+json (OpenAPI ProblemDetail): `request_id`
        # la UUID thuan, KHONG con prefix `req_` cua StandardErrorEnvelope cu.
        # Shape chuan: xem `test_problem_json.py`.
        self.assertIn('type', data)
        self.assertIn('title', data)
        self.assertEqual(data['status'], status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertTrue(str(data['request_id']).strip() != '')


class RateLimitRegisterEndpointTests(APITestCase):
    """Test @ratelimit decorator on /api/auth/register/ endpoint (3/minute per IP).

    `override_settings` + mock `requests.post`: xem `reg_payload()` — Turnstile
    bắt buộc token khi secret có giá trị, nếu không mọi request đều 400 và assert
    rate limit vô nghĩa. Mock trả `{'success': True}` để token "hợp lệ".
    """

    @override_settings(TURNSTILE_SECRET_KEY=TURNSTILE_KEY)
    def setUp(self):
        self.client = APIClient()
        self.register_url = '/core/v1/auth/register/'
        # Clear cache before each test
        cache.clear()
        # Patch ở setUp, KHÔNG dùng `@patch` trên class.
        # Lý do: `@patch` cấp class truyền thêm 1 đối số mock vào **mọi** method
        # của class, kể cả method không khai tham số ⇒
        # `TypeError: test_x() takes 1 positional argument but 2 were given`.
        # Đo thật 2026-10-13: 5 FAIL biến thành 5 ERROR cùng loại.
        patcher = patch('requests.post', side_effect=turnstile_ok)
        patcher.start()
        self.addCleanup(patcher.stop)
    
    def test_register_within_limit(self):
        """First 3 register requests within limit should succeed."""
        for i in range(3):
            response = self.client.post(
                self.register_url,
                reg_payload(f'user{i}', f'user{i}@test.com'),
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
                reg_payload(f'test_user_{i}', f'test_user_{i}@test.com'),
                format='json',
            )

        # 4th request should be rate limited
        response = self.client.post(
            self.register_url,
            reg_payload('test_user_4', 'test_user_4@test.com'),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_register_rate_limit_error_envelope(self):
        """Rate limit error should return StandardErrorEnvelope format."""
        # Exhaust limit
        for i in range(3):
            self.client.post(
                self.register_url,
                reg_payload(f'envelope_user_{i}', f'envelope_user_{i}@test.com'),
                format='json',
            )

        # Get rate limit error
        response = self.client.post(
            self.register_url,
            reg_payload('envelope_user_3', 'envelope_user_3@test.com'),
            format='json',
        )
        
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        data = response.json()
        
        # Verify StandardErrorEnvelope structure
        self.assertIn('detail', data)
        self.assertIn('code', data)
        self.assertIn('timestamp', data)
        self.assertIn('request_id', data)
        # Error body chuyen sang problem+json (OpenAPI ProblemDetail): `request_id`
        # la UUID thuan, KHONG con prefix `req_` cua StandardErrorEnvelope cu.
        # Shape chuan: xem `test_problem_json.py`.
        self.assertIn('type', data)
        self.assertIn('title', data)
        self.assertEqual(data['status'], status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertTrue(str(data['request_id']).strip() != '')


class RateLimitPasswordResetEndpointTests(APITestCase):
    """Test manual per-email rate limiting on /api/auth/password-reset/ endpoint (3/minute per email)."""
    
    def setUp(self):
        self.client = APIClient()
        self.password_reset_url = '/core/v1/auth/password-reset/'
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
        # ProblemDetail: `request_id` la UUID thuan, khong prefix `req_`.
        self.assertTrue(str(data['request_id']).strip() != '')


@override_settings(TURNSTILE_SECRET_KEY=TURNSTILE_KEY)
class RateLimitWindowExpiryTests(APITestCase):
    """Test rate limit counter expiration after 1 minute window.

    Mock Turnstile cho phần `register` — xem `reg_payload()`. Patch ở `setUp`,
    không `@patch` cấp class (xem `RateLimitRegisterEndpointTests`).
    """

    @override_settings(TURNSTILE_SECRET_KEY=TURNSTILE_KEY)
    def setUp(self):
        self.client = APIClient()
        self.register_url = '/core/v1/auth/register/'
        self.password_reset_url = '/core/v1/auth/password-reset/'
        # Clear cache before each test
        cache.clear()
        patcher = patch('requests.post', side_effect=turnstile_ok)
        patcher.start()
        self.addCleanup(patcher.stop)
    
    def test_register_limit_expires_after_window(self):
        """Register rate limit should reset after cache expiration (1 minute)."""
        # Exhaust limit
        for i in range(3):
            self.client.post(
                self.register_url,
                reg_payload(f'window_user_{i}', f'window_user_{i}@test.com'),
                format='json',
            )

        # Should be rate limited
        response = self.client.post(
            self.register_url,
            reg_payload('window_user_3', 'window_user_3@test.com'),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

        # Manually clear rate limit cache (simulating 1 minute passing)
        cache.clear()

        # Should now be able to make requests again
        response = self.client.post(
            self.register_url,
            reg_payload('window_user_reset', 'window_user_reset@test.com'),
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
