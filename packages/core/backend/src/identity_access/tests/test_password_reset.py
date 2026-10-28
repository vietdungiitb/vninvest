"""
C1 Password Reset Token Model and Views Tests

Tests for PasswordResetToken model (C1 fix):
- DB-backed token persistence (survives restart)
- Token generation, expiration, and validation
- Views integration: password_reset_request_view and password_reset_confirm_view
- Error handling (expired tokens, invalid tokens, used tokens)
"""

from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from ..models import PasswordResetToken


class PasswordResetTokenModelTests(TestCase):
    """Test PasswordResetToken model (C1 fix)."""

    def setUp(self):
        """Set up test database."""
        self.user_email = 'test@example.com'
        self.user = User.objects.create_user(
            username='testuser',
            email=self.user_email,
            password='password123',
        )

    def test_generate_and_save_creates_token(self):
        """Test: generate_and_save creates token_hash in DB."""
        token_obj, raw_token = PasswordResetToken.generate_and_save(
            email=self.user_email,
            hours=1,
        )

        # Verify token_obj created with correct fields
        self.assertIsNotNone(token_obj.id)
        self.assertEqual(token_obj.email, self.user_email)
        self.assertFalse(token_obj.used)
        self.assertIsNone(token_obj.used_at)

        # Verify raw_token is returned (for email link)
        self.assertIsNotNone(raw_token)
        self.assertGreater(len(raw_token), 10)

    def test_token_persists_across_sessions(self):
        """Test: Token persists in DB (survives app restart)."""
        token_obj, raw_token = PasswordResetToken.generate_and_save(
            email=self.user_email,
            hours=1,
        )
        initial_id = token_obj.id

        # Simulate restart: fetch from DB
        fetched_token = PasswordResetToken.objects.get(id=initial_id)
        self.assertEqual(fetched_token.email, self.user_email)
        self.assertEqual(fetched_token.id, initial_id)

    def test_is_expired_property(self):
        """Test: is_expired property correctly identifies expired tokens."""
        # Create non-expired token (1 hour)
        token_obj, _ = PasswordResetToken.generate_and_save(
            email=self.user_email,
            hours=1,
        )
        self.assertFalse(token_obj.is_expired)

        # Create expired token (already past expires_at)
        expired_token = PasswordResetToken.objects.create(
            email=self.user_email,
            token_hash='dummy_hash',
            expires_at=timezone.now() - timedelta(hours=1),
        )
        self.assertTrue(expired_token.is_expired)

    def test_is_valid_property(self):
        """Test: is_valid checks both used and expired states."""
        token_obj, _ = PasswordResetToken.generate_and_save(
            email=self.user_email,
            hours=1,
        )
        self.assertTrue(token_obj.is_valid)

        # Mark as used
        token_obj.used = True
        token_obj.used_at = timezone.now()
        token_obj.save()
        self.assertFalse(token_obj.is_valid)

        # Create new token and expire it
        token_obj2, _ = PasswordResetToken.generate_and_save(
            email=self.user_email,
            hours=1,
        )
        token_obj2.expires_at = timezone.now() - timedelta(minutes=1)
        token_obj2.save()
        self.assertFalse(token_obj2.is_valid)

    def test_verify_and_mark_used_success(self):
        """Test: verify_and_mark_used hashes token and marks used."""
        token_obj, raw_token = PasswordResetToken.generate_and_save(
            email=self.user_email,
            hours=1,
        )

        # Verify token
        verified_token = PasswordResetToken.verify_and_mark_used(raw_token)

        self.assertEqual(verified_token.id, token_obj.id)
        self.assertTrue(verified_token.used)
        self.assertIsNotNone(verified_token.used_at)

        # Re-fetch from DB to confirm persistence
        refetched = PasswordResetToken.objects.get(id=token_obj.id)
        self.assertTrue(refetched.used)

    def test_verify_and_mark_used_invalid_token(self):
        """Test: verify_and_mark_used raises ValueError for invalid token."""
        with self.assertRaises(ValueError) as cm:
            PasswordResetToken.verify_and_mark_used('invalid_token_xyz')

        self.assertIn('invalid', str(cm.exception).lower())

    def test_verify_and_mark_used_already_used(self):
        """Test: verify_and_mark_used raises ValueError if token already used."""
        token_obj, raw_token = PasswordResetToken.generate_and_save(
            email=self.user_email,
            hours=1,
        )

        # First use: should succeed
        PasswordResetToken.verify_and_mark_used(raw_token)

        # Second use: should fail
        with self.assertRaises(ValueError) as cm:
            PasswordResetToken.verify_and_mark_used(raw_token)

        self.assertIn('been used', str(cm.exception).lower())

    def test_verify_and_mark_used_expired(self):
        """Test: verify_and_mark_used raises ValueError for expired token."""
        token_obj, raw_token = PasswordResetToken.generate_and_save(
            email=self.user_email,
            hours=1,
        )

        # Expire token in DB
        token_obj.expires_at = timezone.now() - timedelta(minutes=1)
        token_obj.save()

        with self.assertRaises(ValueError) as cm:
            PasswordResetToken.verify_and_mark_used(raw_token)

        self.assertIn('expired', str(cm.exception).lower())

    def test_cleanup_expired(self):
        """Test: cleanup_expired deletes only expired unused tokens."""
        # Create non-expired token
        active_token, _ = PasswordResetToken.generate_and_save(
            email=self.user_email,
            hours=1,
        )

        # Create expired unused token
        expired_token = PasswordResetToken.objects.create(
            email=self.user_email,
            token_hash='expired_hash',
            expires_at=timezone.now() - timedelta(hours=1),
        )

        # Create expired used token
        used_token, used_raw = PasswordResetToken.generate_and_save(
            email=self.user_email,
            hours=1,
        )
        PasswordResetToken.verify_and_mark_used(used_raw)
        used_token.refresh_from_db()
        used_token.expires_at = timezone.now() - timedelta(hours=1)
        used_token.save()

        # Run cleanup
        PasswordResetToken.cleanup_expired()

        # Verify: only expired unused token deleted
        self.assertTrue(PasswordResetToken.objects.filter(id=active_token.id).exists())
        self.assertFalse(PasswordResetToken.objects.filter(id=expired_token.id).exists())
        self.assertTrue(PasswordResetToken.objects.filter(id=used_token.id).exists())  # Used tokens not deleted

    def test_token_hash_uniqueness(self):
        """Test: token_hash is unique (no duplicates)."""
        token1, raw1 = PasswordResetToken.generate_and_save(
            email=self.user_email,
            hours=1,
        )

        # Same raw token used in different requests should hash to same value
        # (but this is controlled by generate_and_save, which uses secrets)
        # This test verifies the constraint exists
        from django.db import IntegrityError

        try:
            # Manually try to create duplicate token_hash
            PasswordResetToken.objects.create(
                email='other@example.com',
                token_hash=token1.token_hash,  # Same hash
                expires_at=timezone.now() + timedelta(hours=1),
            )
            self.fail('Should have raised IntegrityError for duplicate token_hash')
        except IntegrityError:
            pass  # Expected


class PasswordResetViewTests(APITestCase):
    """Test password reset views (C1 fix)."""

    def setUp(self):
        """Set up test database."""
        self.user_email = 'reset@example.com'
        self.user = User.objects.create_user(
            username='resetuser',
            email=self.user_email,
            password='OldPassword123!',
        )

    def test_password_reset_request_creates_db_token(self):
        """Test: password_reset_request_view creates PasswordResetToken in DB."""
        with patch('identity_access.views.password_reset.send_password_reset_email') as mock_send:
            response = self.client.post(
                '/core/v1/auth/password-reset/',
                {'email': self.user_email},
                format='json',
            )

        self.assertEqual(response.status_code, 200)

        # Verify token created in DB
        token_obj = PasswordResetToken.objects.get(email=self.user_email)
        self.assertFalse(token_obj.used)
        self.assertIsNone(token_obj.used_at)

        # Verify async task was called
        mock_send.delay.assert_called_once()

    def test_password_reset_request_no_user_enumeration(self):
        """Test: password_reset_request returns 200 for nonexistent email (OWASP A01)."""
        response = self.client.post(
            '/core/v1/auth/password-reset/',
            {'email': 'nonexistent@example.com'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)

        # No token created for nonexistent email
        token_count = PasswordResetToken.objects.filter(
            email='nonexistent@example.com',
        ).count()
        self.assertEqual(token_count, 0)

    def test_password_reset_confirm_success(self):
        """Test: password_reset_confirm_view updates user password."""
        # Create token
        token_obj, raw_token = PasswordResetToken.generate_and_save(
            email=self.user_email,
            hours=1,
        )

        new_password = 'NewPassword123!'
        response = self.client.post(
            '/core/v1/auth/password-reset/confirm/',
            {
                'token': raw_token,
                'password': new_password,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)

        # Verify password changed
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(new_password))

        # Verify token marked used
        token_obj.refresh_from_db()
        self.assertTrue(token_obj.used)

    def test_password_reset_confirm_invalid_token(self):
        """Test: password_reset_confirm rejects invalid token."""
        response = self.client.post(
            '/core/v1/auth/password-reset/confirm/',
            {
                'token': 'invalid_token_xyz',
                'password': 'NewPassword123!',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('invalid', response.data.get('detail', '').lower())

    def test_password_reset_confirm_expired_token(self):
        """Test: password_reset_confirm rejects expired token."""
        token_obj, raw_token = PasswordResetToken.generate_and_save(
            email=self.user_email,
            hours=1,
        )
        token_obj.expires_at = timezone.now() - timedelta(minutes=1)
        token_obj.save()

        response = self.client.post(
            '/core/v1/auth/password-reset/confirm/',
            {
                'token': raw_token,
                'password': 'NewPassword123!',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('expired', response.data.get('detail', '').lower())

    def test_password_reset_confirm_already_used(self):
        """Test: password_reset_confirm rejects already-used token."""
        token_obj, raw_token = PasswordResetToken.generate_and_save(
            email=self.user_email,
            hours=1,
        )

        # First use
        response = self.client.post(
            '/core/v1/auth/password-reset/confirm/',
            {
                'token': raw_token,
                'password': 'NewPassword123!',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 200)

        # Second use (same token)
        response = self.client.post(
            '/core/v1/auth/password-reset/confirm/',
            {
                'token': raw_token,
                'password': 'AnotherPassword123!',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('been used', response.data.get('detail', '').lower())

    def test_password_reset_confirm_short_password(self):
        """Test: password_reset_confirm enforces AUTH_PASSWORD_VALIDATORS.

        CHANGED ASSERTION (slice A / A2). This test used to assert the literal
        Vietnamese string '8 ký tự', which came from a hard-coded
        `len(new_password) < 8` guard in password_reset_confirm_view. That guard
        was the defect: it was the ONLY password policy on this endpoint, and it
        was weaker than the one registration enforces. The endpoint now calls
        django.contrib.auth.password_validation.validate_password(), so the
        assertion targets the code + per-field error shape instead of a message
        that was never a real requirement.

        The endpoint behaviour is now: min 10 characters (MinimumLengthValidator
        from AUTH_PASSWORD_VALIDATORS), plus common/numeric/similarity checks.
        """
        token_obj, raw_token = PasswordResetToken.generate_and_save(
            email=self.user_email,
            hours=1,
        )

        response = self.client.post(
            '/core/v1/auth/password-reset/confirm/',
            {
                'token': raw_token,
                'password': 'Short1!',  # 7 chars - below the enforced minimum
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        body = response.data
        self.assertEqual(body.get('code'), 'weak_password')
        field_errors = body.get('field_errors') or {}
        # Reported under both the canonical and the legacy body key so a client
        # can map the error onto whichever input it sent.
        self.assertTrue(field_errors.get('new_password'))
        self.assertTrue(field_errors.get('password'))

    def test_password_reset_flow_end_to_end(self):
        """Test: Complete password reset flow (request → confirm)."""
        # Step 1: Request reset
        with patch('identity_access.views.password_reset.send_password_reset_email') as mock_send:
            response = self.client.post(
                '/core/v1/auth/password-reset/',
                {'email': self.user_email},
                format='json',
            )

        self.assertEqual(response.status_code, 200)
        mock_send.delay.assert_called_once()

        # Extract raw_token from async task call
        call_args = mock_send.delay.call_args
        raw_token = call_args[1]['token']  # keyword argument
        self.assertIsNotNone(raw_token)

        # Step 2: Confirm reset
        new_password = 'CompleteFlow123!'
        response = self.client.post(
            '/core/v1/auth/password-reset/confirm/',
            {
                'token': raw_token,
                'password': new_password,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)

        # Verify password changed
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(new_password))

        # Verify can't reuse token
        response = self.client.post(
            '/core/v1/auth/password-reset/confirm/',
            {
                'token': raw_token,
                'password': 'ReuseAttempt123!',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 400)
