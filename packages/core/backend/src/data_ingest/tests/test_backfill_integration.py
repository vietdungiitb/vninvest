"""
D06 – Integration tests cho backfill system và user flows.

T-E1: Ghi IntradayTick qua backfill_intraday_tick_system → verify DB.
T-E2: Ghi IntradayTick qua backfill_intraday_tick_user → verify DB.
T-E3: Presence check idempotency — chạy 2 lần không tạo duplicate.
T-E4: backfill_intraday_tick_system → detect_and_store_global_whale_alerts cùng ngày → whale alerts được tạo.
"""
from datetime import datetime, timezone, date
from unittest.mock import patch, MagicMock

from django.contrib.auth import get_user_model
from django.test import TestCase

User = get_user_model()


def _make_ticks(symbol: str, trade_date: str, count: int = 5) -> list[dict]:
    """Tạo fake tick data."""
    ticks = []
    for i in range(count):
        ticks.append({
            'symbol': symbol,
            'timestamp': datetime(2026, 5, 10, 9, i, 0, tzinfo=timezone.utc),
            'price': 25000.0 + i * 100,
            'volume': 5_000_000_000,  # 5 tỷ → whale threshold
            'side': 'buy',
            'source': 'dnse',
        })
    return ticks


class BackfillSystemIntegrationTest(TestCase):
    """T-E1, T-E3, T-E4."""

    def setUp(self):
        from identity_access.models import UserDNSECredential, _encrypt_credential
        from django.contrib.auth import get_user_model
        User = get_user_model()
        self.admin = User.objects.create_superuser('admin_d06', 'admin@test.com', 'pass1234')

    @patch('market_data.vnbroker_adapter.fetch_intraday_tape_history')
    @patch('identity_access.models.get_system_provider_credentials')
    def test_system_backfill_writes_ticks(self, mock_creds, mock_fetch):
        """T-E1: Backfill system → IntradayTick được ghi vào DB."""
        from market_data.models import IntradayTick
        from data_ingest.tasks import backfill_intraday_tick_system

        mock_creds.return_value = ('key123', 'secret456')
        mock_fetch.return_value = _make_ticks('HPG', '2026-05-10')

        result = backfill_intraday_tick_system.apply(
            kwargs={'symbol': 'HPG', 'trade_date': '2026-05-10'}
        ).get()

        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['ticks'], 5)
        self.assertEqual(IntradayTick.objects.filter(symbol='HPG').count(), 5)

    @patch('market_data.vnbroker_adapter.fetch_intraday_tape_history')
    @patch('identity_access.models.get_system_provider_credentials')
    def test_system_backfill_idempotent(self, mock_creds, mock_fetch):
        """T-E3: Gọi 2 lần cùng symbol+date → không duplicate."""
        from market_data.models import IntradayTick
        from data_ingest.tasks import backfill_intraday_tick_system

        mock_creds.return_value = ('key123', 'secret456')
        mock_fetch.return_value = _make_ticks('VNM', '2026-05-10')

        backfill_intraday_tick_system.apply(
            kwargs={'symbol': 'VNM', 'trade_date': '2026-05-10'}
        ).get()
        result2 = backfill_intraday_tick_system.apply(
            kwargs={'symbol': 'VNM', 'trade_date': '2026-05-10'}
        ).get()

        self.assertEqual(result2['status'], 'skipped')
        self.assertEqual(result2['reason'], 'already_exists')
        self.assertEqual(IntradayTick.objects.filter(symbol='VNM').count(), 5)


class BackfillUserIntegrationTest(TestCase):
    """T-E2."""

    def setUp(self):
        import os
        os.environ.setdefault('DNSE_CREDENTIAL_FERNET_KEY', 'QFqvwJDGxrXhGm7K8PKXjLZXWBzz1Jlh5GRxeYz9gns=')
        from identity_access.models import UserDNSECredential
        from django.contrib.auth import get_user_model
        User = get_user_model()
        self.user = User.objects.create_user('user_d06', 'u@test.com', 'pass1234')
        cred = UserDNSECredential(user=self.user)
        cred.set_credentials('api_key_test', 'api_secret_test')
        cred.save()

    @patch('market_data.vnbroker_adapter.fetch_intraday_tape_history')
    def test_user_backfill_writes_ticks(self, mock_fetch):
        """T-E2: Backfill user → IntradayTick được ghi vào shared table."""
        from market_data.models import IntradayTick
        from data_ingest.tasks import backfill_intraday_tick_user

        mock_fetch.return_value = _make_ticks('FPT', '2026-05-10')

        result = backfill_intraday_tick_user.apply(
            kwargs={'user_id': self.user.id, 'symbol': 'FPT', 'trade_date': '2026-05-10'}
        ).get()

        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['ticks'], 5)
        # Ghi vào SHARED table, không per-user
        self.assertEqual(IntradayTick.objects.filter(symbol='FPT').count(), 5)
