import os
import sys
from datetime import timedelta

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from advisory.models import AdvisoryRecord
from advisory.tests.envelope import unwrapped


class AdvisoryStatusApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='status-owner', password='testpass123')
        self.other = User.objects.create_user(username='status-other', password='testpass123')
        self.client.force_authenticate(user=self.user)
        self.today = timezone.localdate()

    def _record(self, user, record_status):
        return AdvisoryRecord.objects.create(
            user=user,
            symbol='FPT',
            session_date=self.today,
            status=record_status,
            structured_output={'summary': 'pending'},
        )

    def test_owner_can_poll_pending_then_generated(self):
        record = self._record(self.user, AdvisoryRecord.StatusChoices.PENDING)
        pending = self.client.get(f'/core/v1/advisory/status/{record.advisory_id}/')
        self.assertEqual(pending.status_code, status.HTTP_200_OK)
        self.assertEqual(pending.data['status'], 'pending')

        record.status = AdvisoryRecord.StatusChoices.GENERATED
        record.generated_at = timezone.now()
        record.save(update_fields=['status', 'generated_at', 'updated_at'])
        generated = self.client.get(f'/core/v1/advisory/status/{record.advisory_id}/')
        self.assertEqual(generated.status_code, status.HTTP_200_OK)
        self.assertEqual(generated.data['status'], 'generated')
        self.assertIsNotNone(generated.data['generated_at'])

    def test_other_user_gets_404(self):
        record = self._record(self.other, AdvisoryRecord.StatusChoices.PENDING)
        response = self.client.get(f'/core/v1/advisory/status/{record.advisory_id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_missing_record_gets_404(self):
        response = self.client.get('/core/v1/advisory/status/00000000-0000-0000-0000-000000000000/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class AdvisoryRefreshInfoApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='refresh-info-owner', password='testpass123')
        self.client.force_authenticate(user=self.user)
        self.today = timezone.localdate()

    def test_returns_real_budget_and_refresh_counters(self):
        from advisory.models import AdvisorySession
        AdvisorySession.objects.create(
            user=self.user,
            symbol='FPT',
            session_date=self.today,
            tokens_used=1800,
            token_budget=2000,
        )
        AdvisoryRecord.objects.create(
            user=self.user,
            symbol='FPT',
            session_date=self.today,
            status='generated',
        )
        response = self.client.get('/core/v1/advisory/refresh-info/FPT/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = unwrapped(response)
        self.assertEqual(body['symbol'], 'FPT')
        self.assertEqual(body['tokens_used'], 1800)
        self.assertEqual(body['token_budget'], 2000)
        self.assertEqual(body['tokens_remaining_today'], 200)
        self.assertTrue(body['budget_soft_warning'])
        self.assertFalse(body['budget_hard_exceeded'])
        self.assertEqual(body['auto_refreshes_used_today'], 1)
        self.assertIsNone(body['next_refresh_at'])
        self.assertFalse(body['auto_refresh'])

    def test_requires_authentication(self):
        self.client.force_authenticate(user=None)
        response = self.client.get('/core/v1/advisory/refresh-info/FPT/')
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))


class AdvisoryDeleteApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='advisory-delete-owner', password='testpass123')
        self.other = User.objects.create_user(username='advisory-delete-other', password='testpass123')
        self.client.force_authenticate(user=self.user)
        self.today = timezone.localdate()

    def test_owner_deletes_own_record(self):
        AdvisoryRecord.objects.create(user=self.user, symbol='FPT', session_date=self.today, status='generated')
        response = self.client.delete('/core/v1/advisory/latest/FPT/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(AdvisoryRecord.objects.filter(user=self.user, symbol='FPT').exists())

    def test_delete_does_not_touch_other_users_record(self):
        AdvisoryRecord.objects.create(user=self.other, symbol='FPT', session_date=self.today, status='generated')
        response = self.client.delete('/core/v1/advisory/latest/FPT/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(AdvisoryRecord.objects.filter(user=self.other, symbol='FPT').exists())
