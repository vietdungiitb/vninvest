"""
Tests for authenticated password change + avatar_url profile field.

- POST /core/v1/auth/password-change/ (password_change_view):
  success, wrong current password, mismatch, too short, same-as-current,
  unauthenticated, rate limit.
- UserProfile.avatar_url: model default + PATCH round-trip via UserProfileView.
"""

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from ..models import UserProfile

User = get_user_model()
URL = '/core/v1/auth/password-change/'
PROFILE_URL = '/core/v1/identity/profile/'


class PasswordChangeViewTests(TestCase):
    def setUp(self):
        cache.clear()  # LocMemCache persists across tests — isolate rate-limit bucket
        self.user = User.objects.create_user(
            username='pwchange-user', email='pwchange@example.com', password='old-password-1',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _payload(self, **over):
        body = {
            'current_password': 'old-password-1',
            'new_password': 'brand-new-pass-2',
            'new_password_confirm': 'brand-new-pass-2',
        }
        body.update(over)
        return body

    def test_success_changes_password(self):
        res = self.client.post(URL, self._payload(), format='json')
        self.assertEqual(res.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('brand-new-pass-2'))
        self.assertFalse(self.user.check_password('old-password-1'))

    def test_wrong_current_password_rejected(self):
        res = self.client.post(URL, self._payload(current_password='nope'), format='json')
        self.assertEqual(res.status_code, 400)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('old-password-1'))

    def test_mismatch_rejected(self):
        res = self.client.post(URL, self._payload(new_password_confirm='different-3'), format='json')
        self.assertEqual(res.status_code, 400)

    def test_too_short_rejected(self):
        res = self.client.post(
            URL, self._payload(new_password='short', new_password_confirm='short'), format='json',
        )
        self.assertEqual(res.status_code, 400)

    def test_same_as_current_rejected(self):
        res = self.client.post(
            URL,
            self._payload(new_password='old-password-1', new_password_confirm='old-password-1'),
            format='json',
        )
        self.assertEqual(res.status_code, 400)

    def test_unauthenticated_rejected(self):
        anon = APIClient()
        res = anon.post(URL, self._payload(), format='json')
        self.assertIn(res.status_code, (401, 403))

    def test_rate_limit_after_5_attempts(self):
        for _ in range(5):
            self.client.post(URL, self._payload(current_password='nope'), format='json')
        res = self.client.post(URL, self._payload(), format='json')
        self.assertEqual(res.status_code, 400)


class UserProfileAvatarTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='avatar-user', email='avatar@example.com', password='password123',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_avatar_url_defaults_empty(self):
        profile = UserProfile.objects.create(user=self.user)
        self.assertEqual(profile.avatar_url, '')

    def test_patch_avatar_url_round_trip(self):
        res = self.client.patch(
            PROFILE_URL, {'avatar_url': 'https://example.com/a.png'}, format='json',
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['avatar_url'], 'https://example.com/a.png')
        res2 = self.client.get(PROFILE_URL)
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.json()['avatar_url'], 'https://example.com/a.png')
