"""Slice D1 — AI usage self-scope permissions (no IsCoreOperator).

D-AC1..AC2, D-AC6..AC7.
"""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from ai_analytics.models import AIUsageRecord, AIUsageSummary

USAGE_URL = '/core/v1/ai/usage/'
SUMMARY_URL = '/core/v1/ai/usage/summary/'
AGGREGATE_URL = '/core/v1/ai/usage/aggregate/'


class AIUsagePermissionTests(TestCase):
    def setUp(self):
        self.user_a = User.objects.create_user(username='usage_user_a', password='x')
        self.user_b = User.objects.create_user(username='usage_user_b', password='x')
        self.staff = User.objects.create_user(
            username='usage_staff', password='x', is_staff=True,
        )
        self.client_a = APIClient()
        self.client_a.force_authenticate(user=self.user_a)
        self.client_b = APIClient()
        self.client_b.force_authenticate(user=self.user_b)
        self.staff_client = APIClient()
        self.staff_client.force_authenticate(user=self.staff)

        AIUsageRecord.objects.create(
            user=self.user_a, action='advisory', tokens_in=10, tokens_out=20,
        )
        AIUsageRecord.objects.create(
            user=self.user_b, action='advisory', tokens_in=999, tokens_out=999,
        )
        AIUsageSummary.objects.create(
            date='2026-09-24', user=self.user_a, action='advisory',
            total_requests=1, total_tokens_in=10, total_tokens_out=20,
        )
        AIUsageSummary.objects.create(
            date='2026-09-24', user=self.user_b, action='advisory',
            total_requests=1, total_tokens_in=999, total_tokens_out=999,
        )

    def test_d_ac1_non_staff_usage_200(self):
        response = self.client_a.get(USAGE_URL)
        self.assertEqual(response.status_code, 200)

    def test_d_ac2_non_staff_sees_only_own_records(self):
        body = self.client_a.get(USAGE_URL).json()
        usernames = {row.get('username') for row in body['results']}
        self.assertEqual(usernames, {'usage_user_a'})
        self.assertEqual(body['total'], 1)

    def test_d_ac2b_non_staff_user_id_filter_ignored(self):
        body = self.client_a.get(f'{USAGE_URL}?user_id={self.user_b.id}').json()
        usernames = {row.get('username') for row in body['results']}
        self.assertEqual(usernames, {'usage_user_a'})

    def test_d_ac2c_summary_scoped_to_self(self):
        body = self.client_a.get(SUMMARY_URL).json()
        self.assertEqual(len(body['results']), 1)
        self.assertEqual(body['results'][0]['action'], 'advisory')

    def test_d_ac2d_aggregate_scoped_to_self(self):
        body = self.client_a.get(AGGREGATE_URL).json()
        self.assertEqual(body['total_requests'], 1)
        self.assertEqual(body['total_tokens_in'], 10)

    def test_d_ac6_staff_sees_all_users(self):
        body = self.staff_client.get(USAGE_URL).json()
        usernames = {row.get('username') for row in body['results']}
        self.assertEqual(usernames, {'usage_user_a', 'usage_user_b'})
        self.assertEqual(body['total'], 2)

    def test_d_ac6b_staff_user_id_filter(self):
        body = self.staff_client.get(f'{USAGE_URL}?user_id={self.user_b.id}').json()
        usernames = {row.get('username') for row in body['results']}
        self.assertEqual(usernames, {'usage_user_b'})

    def test_d_ac7_both_non_staff_users_can_list(self):
        self.assertEqual(self.client_a.get(USAGE_URL).status_code, 200)
        self.assertEqual(self.client_b.get(USAGE_URL).status_code, 200)

    def test_unauthenticated_forbidden(self):
        from rest_framework.test import APIClient as C
        self.assertIn(C().get(USAGE_URL).status_code, (401, 403))


class AIUsageModelStatusFilterTests(TestCase):
    """F2 — model / status query filters on usage list."""

    def setUp(self):
        self.user = User.objects.create_user(username='usage_filter_user', password='x')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        AIUsageRecord.objects.create(
            user=self.user, action='advisory', model='gpt-4o-mini',
            status='success', tokens_in=1, tokens_out=1,
        )
        AIUsageRecord.objects.create(
            user=self.user, action='advisory', model='gpt-4o',
            status='error', tokens_in=1, tokens_out=1,
        )
        AIUsageRecord.objects.create(
            user=self.user, action='test_connection', model='gpt-4o-mini',
            status='success', tokens_in=1, tokens_out=1,
        )

    def test_f2_model_filter(self):
        body = self.client.get(f'{USAGE_URL}?model=gpt-4o-mini').json()
        self.assertEqual(body['total'], 2)
        self.assertTrue(all(r['model'] == 'gpt-4o-mini' for r in body['results']))

    def test_f2_status_filter(self):
        body = self.client.get(f'{USAGE_URL}?status=error').json()
        self.assertEqual(body['total'], 1)
        self.assertEqual(body['results'][0]['status'], 'error')

    def test_f2_model_and_status_combined(self):
        body = self.client.get(f'{USAGE_URL}?model=gpt-4o-mini&status=success&action=test_connection').json()
        self.assertEqual(body['total'], 1)
        self.assertEqual(body['results'][0]['action'], 'test_connection')
