# Location: packages/core/backend/src/identity_access/tests/test_login_upgrade.py
import os
import sys
from unittest.mock import patch, MagicMock

# Inject mock google modules into sys.modules BEFORE rest of imports to prevent collection errors
sys.modules['google'] = MagicMock()
sys.modules['google.oauth2'] = MagicMock()
sys.modules['google.oauth2.service_account'] = MagicMock()
sys.modules['googleapiclient'] = MagicMock()
sys.modules['googleapiclient.discovery'] = MagicMock()

from django.contrib.auth import get_user_model
from django.test import TransactionTestCase, override_settings
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from identity_access.models import CoreTenant, CoreServiceAccount, CorePATCredential, UserProfile

User = get_user_model()

@override_settings(
    LOGIN_IP_LIMIT_THRESHOLD=5,
    LOGIN_SUBNET_LIMIT_THRESHOLD=15,
    LOGIN_USER_LIMIT_THRESHOLD=3,
)
class SaaSUserLoginUpgradeTests(TransactionTestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        
        # Create active test user with tenant, profile, and active service account
        self.user = User.objects.create_user(
            username='active_user',
            email='user@vninvest.vn',
            password='SecurePassword123!',
            is_active=True
        )
        
        self.tenant = CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code='tenant_active_user',
            display_name="User's Workspace",
            plan=CoreTenant.PlanChoices.FREE,
            status=CoreTenant.StatusChoices.ACTIVE
        )
        
        self.profile = UserProfile.objects.create(
            user=self.user,
            tenant=self.tenant,
            display_name="Active User",
            theme='dark',
            language='vi'
        )
        
        self.service_account = CoreServiceAccount.objects.create(
            tenant=self.tenant,
            name="default",
            status=CoreServiceAccount.StatusChoices.ACTIVE,
            scopes=['market:read', 'signals:read']
        )

    def test_login_success_username(self):
        """Happy Path: Login successfully using username, verify success envelope."""
        response = self.client.post('/core/v1/auth/login/', {
            'username': 'active_user',
            'password': 'SecurePassword123!'
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        res_data = response.json()
        self.assertEqual(res_data['status'], 'success')
        self.assertIn('request_id', res_data)
        self.assertIn('timestamp', res_data)
        
        data = res_data['data']
        self.assertIn('access', data)
        self.assertIn('refresh', data)
        self.assertEqual(data['plan'], 'free')
        self.assertEqual(data['user']['username'], 'active_user')

    def test_login_success_email(self):
        """Happy Path: Login successfully using email, verifying email-to-username resolution."""
        response = self.client.post('/core/v1/auth/login/', {
            'username': 'user@vninvest.vn',  # Email input
            'password': 'SecurePassword123!'
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        res_data = response.json()
        self.assertEqual(res_data['status'], 'success')
        self.assertEqual(res_data['data']['user']['username'], 'active_user')

    def test_login_validation_missing_fields(self):
        """Validation: Missing username or password returns ValidationErrorException."""
        response = self.client.post('/core/v1/auth/login/', {
            'username': 'active_user',
            'password': ''
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        res_data = response.json()
        self.assertEqual(res_data['code'], 'validation_error')
        self.assertEqual(res_data['detail'], 'Tên đăng nhập và mật khẩu không được để trống.')

    def test_login_inactive_user(self):
        """Security: Inactive user (unverified email) throws AuthenticationErrorException (user_inactive)."""
        inactive_user = User.objects.create_user(
            username='inactive_user',
            email='inactive@vninvest.vn',
            password='SecurePassword123!',
            is_active=False
        )
        
        response = self.client.post('/core/v1/auth/login/', {
            'username': 'inactive_user',
            'password': 'SecurePassword123!'
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        res_data = response.json()
        self.assertEqual(res_data['code'], 'user_inactive')
        self.assertEqual(res_data['detail'], 'Tài khoản chưa được kích hoạt. Vui lòng xác minh email trước khi đăng nhập.')

    def test_login_invalid_credentials(self):
        """Security: Wrong password throws AuthenticationErrorException (invalid_credentials)."""
        response = self.client.post('/core/v1/auth/login/', {
            'username': 'active_user',
            'password': 'WrongPassword123!'
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        res_data = response.json()
        self.assertEqual(res_data['code'], 'invalid_credentials')
        self.assertEqual(res_data['detail'], 'Tên đăng nhập hoặc mật khẩu không chính xác.')

    def test_login_tenant_not_found(self):
        """Security: Authenticated user with no core tenant throws PermissionErrorException (tenant_not_found)."""
        orphan_user = User.objects.create_user(
            username='orphan_user',
            email='orphan@vninvest.vn',
            password='SecurePassword123!',
            is_active=True
        )
        
        response = self.client.post('/core/v1/auth/login/', {
            'username': 'orphan_user',
            'password': 'SecurePassword123!'
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        res_data = response.json()
        self.assertEqual(res_data['code'], 'tenant_not_found')
        self.assertEqual(res_data['detail'], 'Không tìm thấy Workspace/Tenant liên kết với tài khoản này.')

    def test_login_service_account_inactive(self):
        """Security: Tenant with no active service account throws PermissionErrorException (service_account_inactive)."""
        self.service_account.status = CoreServiceAccount.StatusChoices.DISABLED
        self.service_account.save()
        
        response = self.client.post('/core/v1/auth/login/', {
            'username': 'active_user',
            'password': 'SecurePassword123!'
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        res_data = response.json()
        self.assertEqual(res_data['code'], 'service_account_inactive')
        self.assertEqual(res_data['detail'], 'Tài khoản chưa có Service Account hoạt động.')

    def test_login_rate_limiting_ip(self):
        """Anti-Abuse: IP Rate Limiting blocks login requests exceeding dynamic threshold (5/min)."""
        # Create 5 distinct users and try to log them in from the same IP
        for i in range(5):
            user = User.objects.create_user(
                username=f'active_user_{i}',
                email=f'user_{i}@vninvest.vn',
                password='SecurePassword123!',
                is_active=True
            )
            tenant = CoreTenant.objects.create(
                owner_user=user,
                tenant_code=f'tenant_active_user_{i}',
                display_name="User's Workspace",
                plan=CoreTenant.PlanChoices.FREE,
                status=CoreTenant.StatusChoices.ACTIVE
            )
            UserProfile.objects.create(
                user=user,
                tenant=tenant,
                display_name=f"Active User {i}",
                theme='dark',
                language='vi'
            )
            CoreServiceAccount.objects.create(
                tenant=tenant,
                name="default",
                status=CoreServiceAccount.StatusChoices.ACTIVE,
                scopes=['market:read', 'signals:read']
            )

            response = self.client.post('/core/v1/auth/login/', {
                'username': f'active_user_{i}',
                'password': 'SecurePassword123!'
            }, format='json')
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            
        # The 6th call from the same IP (for active_user) must be blocked by IP rate limit
        response = self.client.post('/core/v1/auth/login/', {
            'username': 'active_user',
            'password': 'SecurePassword123!'
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        res_data = response.json()
        self.assertEqual(res_data['code'], 'login_rate_limit_exceeded')
        self.assertEqual(res_data['detail'], 'Quá nhiều yêu cầu đăng nhập từ địa chỉ IP này. Vui lòng thử lại sau 1 phút.')

    def test_login_rate_limiting_user(self):
        """Anti-Abuse: User Rate Limiting blocks requests exceeding user threshold (3/min)."""
        # Trigger rate limits from different simulated IPs using REMOTE_ADDR
        for i in range(3):
            response = self.client.post('/core/v1/auth/login/', {
                'username': 'active_user',
                'password': 'SecurePassword123!'
            }, HTTP_X_FORWARDED_FOR=f'1.2.3.{i}', format='json')
            self.assertEqual(response.status_code, status.HTTP_200_OK)

        # 4th login attempt for 'active_user' must be blocked even from a fresh IP
        response = self.client.post('/core/v1/auth/login/', {
            'username': 'active_user',
            'password': 'SecurePassword123!'
        }, HTTP_X_FORWARDED_FOR='9.9.9.9', format='json')
        
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        res_data = response.json()
        self.assertEqual(res_data['code'], 'login_rate_limit_exceeded')
        self.assertEqual(res_data['detail'], 'Quá nhiều yêu cầu đăng nhập cho tài khoản này. Vui lòng thử lại sau 1 phút.')

    def test_refresh_token_success(self):
        """Happy Path: Rotate refresh token successfully, returning success envelope."""
        # Issue a credential
        credential, raw_secret = CorePATCredential.issue_for_service_account(
            service_account=self.service_account,
            scopes=['market:read'],
            expires_at=timezone.now() + timezone.timedelta(days=1),
            label='test-refresh',
            is_human_session=True
        )
        
        response = self.client.post('/core/v1/auth/token/refresh/', {
            'refresh': raw_secret
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        res_data = response.json()
        self.assertEqual(res_data['status'], 'success')
        self.assertIn('access', res_data['data'])
        self.assertIn('refresh', res_data['data'])
        
        # Verify old token has been revoked
        credential.refresh_from_db()
        self.assertEqual(credential.status, 'revoked')

    def test_refresh_token_missing(self):
        """Validation: Missing refresh token parameter returns ValidationErrorException."""
        response = self.client.post('/core/v1/auth/token/refresh/', {
            'refresh': ''
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        res_data = response.json()
        self.assertEqual(res_data['code'], 'validation_error')
        self.assertEqual(res_data['detail'], 'Refresh token không được để trống.')

    def test_refresh_token_invalid(self):
        """Security: Invalid/revoked refresh token throws AuthenticationErrorException."""
        response = self.client.post('/core/v1/auth/token/refresh/', {
            'refresh': 'invalid_secret_token_signature'
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        res_data = response.json()
        self.assertEqual(res_data['code'], 'invalid_refresh_token')
        self.assertEqual(res_data['detail'], 'Refresh token không hợp lệ hoặc đã hết hạn.')
