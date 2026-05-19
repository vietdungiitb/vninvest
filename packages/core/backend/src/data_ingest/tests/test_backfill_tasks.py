"""
Unit tests cho backfill_intraday_tick_system (D03) và backfill_intraday_tick_user (D04).

Test cases:
  T-C1: System task abort khi no system credentials.
  T-C2: System task skip khi data đã tồn tại (presence check).
  T-C3: System task OK — ghi ticks vào IntradayTick.
  T-C4: User task error khi user chưa có credential.
  T-C5: User task skip khi data đã tồn tại.
  T-C6: POST /backfill/system/ — admin 202, non-admin 403.
  T-C7: POST /backfill/user/ — trade_date quá 180 ngày → 400.
"""
import os
from datetime import date, datetime, timedelta, timezone
from unittest.mock import patch, MagicMock

from cryptography.fernet import Fernet
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

TEST_FERNET_KEY = Fernet.generate_key().decode()

SAMPLE_TICKS = [
    {
        'timestamp': datetime(2026, 5, 10, 2, 30, 0, tzinfo=timezone.utc),
        'price': 25000.0, 'volume': 1000, 'side': 'buy',
        'match_type': 'NormalMatch', 'source': 'dnse_system',
    },
    {
        'timestamp': datetime(2026, 5, 10, 2, 31, 0, tzinfo=timezone.utc),
        'price': 25100.0, 'volume': 500, 'side': 'sell',
        'match_type': 'NormalMatch', 'source': 'dnse_system',
    },
]


class SystemBackfillTaskTests(TestCase):
    """T-C1 / T-C2 / T-C3."""

    def test_abort_when_no_system_credentials(self):
        """T-C1: get_system_provider_credentials() → None → abort."""
        with patch('identity_access.models.get_system_provider_credentials', return_value=None):
            with patch('data_ingest.tasks.get_system_provider_credentials', return_value=None, create=True):
                pass
            # Patch inside task's local import scope
            with patch('identity_access.models.UserDNSECredential.objects') as mock_obj:
                mock_obj.get.side_effect = Exception('no system provider')
                from data_ingest.tasks import backfill_intraday_tick_system
                # Patch directly via the models module
        with patch('identity_access.models.get_system_provider_credentials', return_value=None):
            # Force the task to use the patched version
            import data_ingest.tasks as tasks_module
            import identity_access.models as id_models
            original = id_models.get_system_provider_credentials
            id_models.get_system_provider_credentials = lambda: None
            try:
                result = tasks_module.backfill_intraday_tick_system.run(symbol='HPG', trade_date='2026-05-10')
            finally:
                id_models.get_system_provider_credentials = original
        self.assertEqual(result['status'], 'aborted')
        self.assertEqual(result['reason'], 'no_system_credentials')

    def test_skip_when_data_already_exists(self):
        """T-C2: presence check → skip khi đã có data."""
        import data_ingest.tasks as tasks_module
        import identity_access.models as id_models
        original_creds = id_models.get_system_provider_credentials
        id_models.get_system_provider_credentials = lambda: ('k', 's')
        try:
            with patch('market_data.models.IntradayTick.objects') as mock_qs:
                mock_qs.filter.return_value.exists.return_value = True
                result = tasks_module.backfill_intraday_tick_system.run(symbol='HPG', trade_date='2026-05-10')
        finally:
            id_models.get_system_provider_credentials = original_creds
        self.assertEqual(result['status'], 'skipped')
        self.assertEqual(result['reason'], 'already_exists')

    @patch.dict(os.environ, {'DNSE_CREDENTIAL_FERNET_KEY': TEST_FERNET_KEY})
    def test_ok_creates_intraday_ticks(self):
        """T-C3: normal flow — ghi ticks vào DB."""
        import data_ingest.tasks as tasks_module
        import identity_access.models as id_models
        from market_data.models import IntradayTick

        original_creds = id_models.get_system_provider_credentials
        id_models.get_system_provider_credentials = lambda: ('k', 's')
        try:
            with patch('market_data.vnbroker_adapter.fetch_intraday_tape_history', return_value=SAMPLE_TICKS):
                result = tasks_module.backfill_intraday_tick_system.run(symbol='HPG2', trade_date='2026-05-10')
        finally:
            id_models.get_system_provider_credentials = original_creds

        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['ticks'], 2)
        count = IntradayTick.objects.filter(symbol='HPG2').count()
        self.assertEqual(count, 2)


class UserBackfillTaskTests(TestCase):
    """T-C4 / T-C5."""

    def setUp(self):
        self.user = User.objects.create_user(username='backfill_user', password='pass')

    def test_error_when_no_user_credential(self):
        """T-C4: UserDNSECredential DoesNotExist → error."""
        from data_ingest.tasks import backfill_intraday_tick_user
        result = backfill_intraday_tick_user.run(
            user_id=self.user.id, symbol='HPG', trade_date='2026-05-10'
        )
        self.assertEqual(result['status'], 'error')
        self.assertEqual(result['reason'], 'no_user_credential')

    @patch.dict(os.environ, {'DNSE_CREDENTIAL_FERNET_KEY': TEST_FERNET_KEY})
    def test_skip_when_data_exists(self):
        """T-C5: presence check → skip."""
        from identity_access.models import UserDNSECredential
        import data_ingest.tasks as tasks_module

        cred = UserDNSECredential(user=self.user)
        cred.set_credentials('api_key', 'api_secret')
        cred.save()

        with patch('market_data.models.IntradayTick.objects') as mock_qs:
            mock_qs.filter.return_value.exists.return_value = True
            result = tasks_module.backfill_intraday_tick_user.run(
                user_id=self.user.id, symbol='HPG', trade_date='2026-05-10'
            )
        self.assertEqual(result['status'], 'skipped')


class BackfillViewTests(TestCase):
    """T-C6 / T-C7: HTTP API."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='view_user', password='pass')
        self.admin = User.objects.create_user(username='view_admin', password='pass', is_staff=True)

    def test_system_backfill_requires_admin(self):
        """T-C6: non-admin nhận 403."""
        self.client.force_authenticate(user=self.user)
        resp = self.client.post('/core/v1/data-ingest/backfill/system/', {
            'symbol': 'HPG', 'trade_date': '2026-05-10',
        }, format='json')
        self.assertEqual(resp.status_code, 403)

    def test_system_backfill_admin_accepted(self):
        """T-C6: admin nhận 202."""
        self.client.force_authenticate(user=self.admin)
        with patch('data_ingest.tasks.backfill_intraday_tick_system') as mock_task:
            mock_result = MagicMock()
            mock_result.id = 'test-task-id'
            mock_task.apply_async.return_value = mock_result
            resp = self.client.post('/core/v1/data-ingest/backfill/system/', {
                'symbol': 'HPG', 'trade_date': '2026-05-10',
            }, format='json')
        self.assertEqual(resp.status_code, 202)
        self.assertIn('task_id', resp.json())

    def test_user_backfill_old_date_returns_400(self):
        """T-C7: trade_date > 180 ngày → 400."""
        self.client.force_authenticate(user=self.user)
        old_date = (date.today() - timedelta(days=200)).isoformat()
        resp = self.client.post('/core/v1/data-ingest/backfill/user/', {
            'symbol': 'HPG', 'trade_date': old_date,
        }, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_user_backfill_valid_date_accepted(self):
        """User backfill recent date → 202."""
        self.client.force_authenticate(user=self.user)
        recent_date = (date.today() - timedelta(days=10)).isoformat()
        with patch('data_ingest.tasks.backfill_intraday_tick_user') as mock_task:
            mock_result = MagicMock()
            mock_result.id = 'test-task-id-2'
            mock_task.apply_async.return_value = mock_result
            resp = self.client.post('/core/v1/data-ingest/backfill/user/', {
                'symbol': 'HPG', 'trade_date': recent_date,
            }, format='json')
        self.assertEqual(resp.status_code, 202)
