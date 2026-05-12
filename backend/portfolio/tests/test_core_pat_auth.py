"""
Focused test coverage for core_pat_auth.py PAT authentication flow.

Ensures PAT credential resolution, issuance, and DRF authentication
work correctly through ORM helpers without raw SQL.
"""
import secrets

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from core_pat_auth import (
    _resolve_user_from_pat,
    _resolve_or_create_tenant_for_user,
    _issue_pat_for_user,
    LegacyCorePATAuthentication,
)
from identity_access.models import CoreTenant, CoreServiceAccount, CorePATCredential

User = get_user_model()


class PatAuthenticationFlowTest(TestCase):
    """Integration tests for PAT authentication through ORM."""

    def setUp(self):
        """Create test user and tenant."""
        self.user = User.objects.create_user(
            username='pat_test_user',
            email='pat@example.com',
            password='test_password',
            is_active=True,
        )
        self.tenant = CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code='test-tenant-001',
            display_name='Test Tenant',
            plan=CoreTenant.PlanChoices.FREE,
            status=CoreTenant.StatusChoices.ACTIVE,
        )
        self.service_account = CoreServiceAccount.objects.create(
            tenant=self.tenant,
            name='test-account',
            status=CoreServiceAccount.StatusChoices.ACTIVE,
        )

    def test_resolve_or_create_tenant_for_user_creates_new(self):
        """Test creating a new tenant for user via ORM."""
        new_user = User.objects.create_user(
            username='new_user',
            email='new@example.com',
            password='test',
            is_active=True,
        )
        tenant = _resolve_or_create_tenant_for_user(new_user)
        self.assertIsNotNone(tenant.pk)
        self.assertEqual(tenant.owner_user, new_user)
        self.assertEqual(tenant.plan, CoreTenant.PlanChoices.FREE)
        self.assertEqual(tenant.status, CoreTenant.StatusChoices.ACTIVE)

    def test_resolve_or_create_tenant_for_user_idempotent(self):
        """Test that resolving existing tenant returns same tenant."""
        first_call = _resolve_or_create_tenant_for_user(self.user)
        second_call = _resolve_or_create_tenant_for_user(self.user)
        self.assertEqual(first_call.pk, second_call.pk)

    def test_issue_pat_for_user_creates_credential_and_returns_secret(self):
        """Test PAT issuance via ORM returns raw token once."""
        raw_token = _issue_pat_for_user(self.user, label='test-pat')
        self.assertIsNotNone(raw_token)
        self.assertTrue(raw_token.startswith('vni_'))
        # Verify credential was created
        cred = CorePATCredential.objects.filter(label='test-pat').first()
        self.assertIsNotNone(cred)
        self.assertEqual(cred.service_account.tenant, self.tenant)

    def test_resolve_user_from_pat_success(self):
        """Test resolving user from valid PAT via ORM."""
        raw_token = _issue_pat_for_user(self.user, label='test-resolve')
        resolved_user = _resolve_user_from_pat(raw_token)
        self.assertEqual(resolved_user.pk, self.user.pk)

    def test_resolve_user_from_pat_invalid_prefix(self):
        """Test resolving invalid PAT (wrong prefix)."""
        invalid_token = 'invalid_token_without_prefix'
        resolved_user = _resolve_user_from_pat(invalid_token)
        self.assertIsNone(resolved_user)

    def test_resolve_user_from_pat_not_found(self):
        """Test resolving PAT that doesn't exist in DB."""
        fake_token = 'vni_' + secrets.token_urlsafe(48)
        resolved_user = _resolve_user_from_pat(fake_token)
        self.assertIsNone(resolved_user)

    def test_resolve_user_from_pat_revoked_credential(self):
        """Test that revoked PAT cannot be used."""
        raw_token = _issue_pat_for_user(self.user, label='test-revoke')
        # Revoke the credential
        cred = CorePATCredential.objects.get(label='test-revoke')
        cred.revoke_pat(reason='Testing revocation')
        # Try to resolve revoked token
        resolved_user = _resolve_user_from_pat(raw_token)
        self.assertIsNone(resolved_user)

    def test_resolve_user_from_pat_inactive_user(self):
        """Test that inactive user cannot authenticate with PAT."""
        raw_token = _issue_pat_for_user(self.user, label='test-inactive')
        # Deactivate user
        self.user.is_active = False
        self.user.save()
        # Try to resolve from inactive user's PAT
        resolved_user = _resolve_user_from_pat(raw_token)
        self.assertIsNone(resolved_user)

    def test_drf_authentication_class_with_valid_pat(self):
        """Test DRF LegacyCorePATAuthentication with valid PAT."""
        raw_token = _issue_pat_for_user(self.user, label='test-drf')
        auth = LegacyCorePATAuthentication()
        
        # Mock request with PAT
        class MockRequest:
            def __init__(self, token):
                self.META = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
        
        request = MockRequest(raw_token)
        result = auth.authenticate(request)
        self.assertIsNotNone(result)
        user, token = result
        self.assertEqual(user.pk, self.user.pk)
        self.assertEqual(token, raw_token)

    def test_drf_authentication_class_without_auth_header(self):
        """Test DRF auth class when no auth header present."""
        auth = LegacyCorePATAuthentication()
        
        class MockRequest:
            META = {}
        
        request = MockRequest()
        result = auth.authenticate(request)
        self.assertIsNone(result)

    def test_drf_authentication_class_with_jwt_bearer(self):
        """Test DRF auth class ignores JWT tokens (not PAT)."""
        auth = LegacyCorePATAuthentication()
        
        class MockRequest:
            def __init__(self, token):
                self.META = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
        
        request = MockRequest('jwt_token_not_starting_with_vni_')
        result = auth.authenticate(request)
        # Should return None because token doesn't start with vni_
        self.assertIsNone(result)

    def test_drf_authentication_class_invalid_pat_raises_error(self):
        """Test DRF auth class raises AuthenticationFailed for invalid PAT."""
        auth = LegacyCorePATAuthentication()
        
        class MockRequest:
            def __init__(self, token):
                self.META = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
        
        invalid_token = 'vni_' + secrets.token_urlsafe(48)
        request = MockRequest(invalid_token)
        
        from rest_framework.exceptions import AuthenticationFailed
        with self.assertRaises(AuthenticationFailed):
            auth.authenticate(request)


class PatCredentialEdgeCasesTest(TestCase):
    """Edge case tests for PAT credential handling."""

    def setUp(self):
        """Create test user and tenant."""
        self.user = User.objects.create_user(
            username='edge_test_user',
            email='edge@example.com',
            password='test_password',
            is_active=True,
        )

    def test_issue_pat_without_existing_service_account_creates_default(self):
        """Test PAT issuance creates default service account if needed."""
        # User exists but no CoreTenant/ServiceAccount yet
        raw_token = _issue_pat_for_user(self.user)
        self.assertIsNotNone(raw_token)
        
        # Verify tenant and service account were created
        tenant = CoreTenant.objects.filter(owner_user=self.user).first()
        self.assertIsNotNone(tenant)
        
        service_account = CoreServiceAccount.objects.filter(
            tenant=tenant,
            name='default'
        ).first()
        self.assertIsNotNone(service_account)

    def test_pat_with_empty_string_returns_none(self):
        """Test empty PAT string resolves to None."""
        resolved = _resolve_user_from_pat('')
        self.assertIsNone(resolved)

    def test_pat_with_none_returns_none(self):
        """Test None PAT resolves to None."""
        resolved = _resolve_user_from_pat(None)
        self.assertIsNone(resolved)

    def test_pat_with_whitespace_stripped(self):
        """Test PAT with leading/trailing whitespace is handled."""
        raw_token = _issue_pat_for_user(self.user, label='test-whitespace')
        padded_token = f'  {raw_token}  '
        resolved = _resolve_user_from_pat(padded_token)
        self.assertEqual(resolved.pk, self.user.pk)


class PatSmokeTest(TestCase):
    """Smoke test: issue PAT → use PAT to authenticate."""

    def test_full_pat_lifecycle(self):
        """End-to-end: create user → issue PAT → authenticate."""
        # 1. Create user
        user = User.objects.create_user(
            username='smoke_user',
            email='smoke@example.com',
            password='test_password',
            is_active=True,
        )
        
        # 2. Issue PAT
        raw_token = _issue_pat_for_user(user, label='smoke-test')
        self.assertTrue(raw_token.startswith('vni_'))
        
        # 3. Resolve user from PAT
        resolved_user = _resolve_user_from_pat(raw_token)
        self.assertEqual(resolved_user.pk, user.pk)
        
        # 4. Use PAT in DRF authentication
        auth = LegacyCorePATAuthentication()
        
        class MockRequest:
            def __init__(self, token):
                self.META = {'HTTP_AUTHORIZATION': f'Bearer {token}'}
        
        request = MockRequest(raw_token)
        result = auth.authenticate(request)
        authenticated_user, returned_token = result
        self.assertEqual(authenticated_user.pk, user.pk)
        self.assertEqual(returned_token, raw_token)
