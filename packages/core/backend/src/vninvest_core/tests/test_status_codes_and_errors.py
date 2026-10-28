"""
Tests for A4: Status Code Semantics and A5: Error Envelope Consistency.

Validates that all endpoints return correct HTTP status codes and
error responses follow standard envelope format per Constitutional R3 and R4.
"""
import json
from unittest.mock import patch
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from identity_access.models import CoreTenant, PasswordResetToken
from vninvest_core.exceptions import StandardErrorEnvelope

User = get_user_model()


@patch('identity_access.serializers.SaaSRegisterSerializer._verify_turnstile', lambda *args, **kwargs: None)
class StatusCodeSemanticsTests(APITestCase):
    """A4: Verify HTTP status code semantics across endpoints."""

    def setUp(self):
        """Set up test fixtures."""
        cache.clear()
        self.client = APIClient()
        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='AdminPass123!',
            is_active=True,
            is_staff=True,
            is_superuser=True,
        )
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='TestPass123!',
            is_active=True,
        )
        self.tenant = CoreTenant.objects.create(
            tenant_code='TEST001',
            display_name='Test Tenant',
            plan=CoreTenant.PlanChoices.STARTER,
            owner_user=self.admin_user,  # A5: CoreTenant requires owner_user
        )
        self.user.tenant = self.tenant
        self.user.save()

    def test_register_returns_201_created(self):
        """Register endpoint should return 201 CREATED."""
        response = self.client.post(
            '/core/v1/auth/register/',
            {
                'username': 'newuser',
                'email': 'newuser@example.com',
                'password': 'ValidPass123!',
                'password_confirm': 'ValidPass123!',
                'first_name': 'New',
                'last_name': 'User',
                'turnstile_token': 'dummy-token',
            },
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_invalid_register_returns_400_bad_request(self):
        """Register with missing required fields should return 400 BAD REQUEST."""
        response = self.client.post(
            '/core/v1/auth/register/',
            {
                'username': 'newuser',
                'email': 'newuser@example.com',
                'turnstile_token': 'dummy-token',
                # Missing password
            },
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_duplicate_username_returns_409_conflict(self):
        """Register with duplicate username should return 409 CONFLICT."""
        response = self.client.post(
            '/core/v1/auth/register/',
            {
                'username': 'testuser',  # Already exists
                'email': 'another@example.com',
                'password': 'ValidPass123!',
                'password_confirm': 'ValidPass123!',
                'turnstile_token': 'dummy-token',
            },
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

    def test_duplicate_email_returns_409_conflict(self):
        """Register with duplicate email should return 409 CONFLICT."""
        response = self.client.post(
            '/core/v1/auth/register/',
            {
                'username': 'anotheruser',
                'email': 'test@example.com',  # Already exists
                'password': 'ValidPass123!',
                'password_confirm': 'ValidPass123!',
                'turnstile_token': 'dummy-token',
            },
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

    def test_password_reset_request_returns_200_ok(self):
        """Password reset request should return 200 OK (no user enumeration)."""
        response = self.client.post(
            '/core/v1/auth/password-reset/',
            {'email': 'test@example.com'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_password_reset_nonexistent_email_returns_200_ok(self):
        """Password reset with nonexistent email should return 200 OK."""
        response = self.client.post(
            '/core/v1/auth/password-reset/',
            {'email': 'nonexistent@example.com'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_password_reset_confirm_valid_token_returns_200_ok(self):
        """Password reset confirm with valid token should return 200 OK."""
        # Create password reset token
        token_obj, raw_token = PasswordResetToken.generate_and_save(
            email='test@example.com',
            hours=1
        )
        
        response = self.client.post(
            '/core/v1/auth/password-reset/confirm/',
            {
                'token': raw_token,
                'password': 'NewPass123!'  # View expects 'password', not 'new_password'
            },
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_password_reset_confirm_invalid_token_returns_400_bad_request(self):
        """Password reset confirm with invalid token should return 400."""
        response = self.client.post(
            '/core/v1/auth/password-reset/confirm/',
            {
                'token': 'invalid-token',
                'new_password': 'NewPass123!'
            },
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


@patch('identity_access.serializers.SaaSRegisterSerializer._verify_turnstile', lambda *args, **kwargs: None)
class ErrorEnvelopeConsistencyTests(APITestCase):
    """A5: Verify all errors follow standard envelope format."""

    def setUp(self):
        """Set up test fixtures."""
        cache.clear()
        self.client = APIClient()

    def test_validation_error_has_standard_envelope(self):
        """Validation error should have standard envelope structure."""
        response = self.client.post(
            '/core/v1/auth/register/',
            {
                'username': 'test',
                # Missing email
                'password': 'short',  # Too short
                'turnstile_token': 'dummy-token',
            },
            format='json'
        )
        
        # Should be 400 and have envelope structure
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        data = response.json()
        
        # Verify envelope structure
        self.assertIn('detail', data)
        self.assertIn('code', data)
        self.assertIn('timestamp', data)
        self.assertIn('request_id', data)
        
        # Verify code is appropriate
        self.assertEqual(data['code'], 'validation_error')

    def test_error_envelope_has_iso8601_timestamp(self):
        """Error envelope timestamp should be ISO8601 format."""
        response = self.client.post(
            '/core/v1/auth/register/',
            {
                'username': 'test',
                'email': 'invalid',
                'password': 'short',
                'turnstile_token': 'dummy-token',
            },
            format='json'
        )
        
        data = response.json()
        timestamp = data.get('timestamp')
        
        # Verify ISO8601 format (ends with Z)
        self.assertIsNotNone(timestamp)
        self.assertTrue(timestamp.endswith('Z'))
        # Should be parseable as ISO8601
        self.assertTrue('T' in timestamp)

    def test_error_envelope_has_request_id(self):
        """Error envelope should have request_id for tracing."""
        response = self.client.post(
            '/core/v1/auth/register/',
            {
                'username': 'test',
                'email': 'invalid',
                'password': 'short',
                'turnstile_token': 'dummy-token',
            },
            format='json'
        )
        
        data = response.json()
        request_id = data.get('request_id')
        
        # Verify request_id exists and follows pattern
        self.assertIsNotNone(request_id)
        self.assertTrue(str(request_id).strip() != '')

    def test_success_response_preserves_envelope_compatibility(self):
        """Success responses should be envelope-compatible."""
        response = self.client.post(
            '/core/v1/auth/register/',
            {
                'username': 'newuser',
                'email': 'newuser@example.com',
                'password': 'ValidPass123!',
                'password_confirm': 'ValidPass123!',
                'first_name': 'New',
                'last_name': 'User',
                'turnstile_token': 'dummy-token',
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        
        # Success response should have status and data envelope fields
        self.assertIn('status', data)
        self.assertIn('data', data)


class StandardErrorEnvelopeTests(TestCase):
    """Unit tests for StandardErrorEnvelope class."""

    def test_envelope_creation_with_defaults(self):
        """StandardErrorEnvelope should auto-generate timestamp and request_id."""
        envelope = StandardErrorEnvelope(
            detail='Test error',
            code='test_error',
        )
        
        self.assertEqual(envelope.detail, 'Test error')
        self.assertEqual(envelope.code, 'test_error')
        self.assertIsNotNone(envelope.timestamp)
        self.assertIsNotNone(envelope.request_id)
        self.assertTrue(envelope.request_id.startswith('req_'))

    def test_envelope_to_dict(self):
        """StandardErrorEnvelope.to_dict() should return JSON-serializable dict."""
        envelope = StandardErrorEnvelope(
            detail='Test error',
            code='test_error',
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        
        data = envelope.to_dict()
        
        # Should be serializable
        json_str = json.dumps(data)
        self.assertIsNotNone(json_str)
        
        # Should have all required fields
        self.assertEqual(data['detail'], 'Test error')
        self.assertEqual(data['code'], 'test_error')
        self.assertIn('timestamp', data)
        self.assertIn('request_id', data)

    def test_envelope_with_field_errors(self):
        """StandardErrorEnvelope should include field_errors when provided."""
        field_errors = {
            'email': ['Invalid email format'],
            'password': ['Too short', 'Must contain uppercase']
        }
        envelope = StandardErrorEnvelope(
            detail='Validation failed',
            code='validation_error',
            field_errors=field_errors,
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        
        data = envelope.to_dict()
        self.assertEqual(data['field_errors'], field_errors)

    def test_envelope_to_response(self):
        """StandardErrorEnvelope.to_response() should return DRF Response."""
        envelope = StandardErrorEnvelope(
            detail='Test error',
            code='test_error',
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        
        response = envelope.to_response()
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['detail'], 'Test error')
        self.assertEqual(response.data['code'], 'test_error')
