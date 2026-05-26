from datetime import datetime, timezone as datetime_timezone
from unittest.mock import MagicMock, patch

from django.contrib.auth.models import User
from django.test import TestCase

from portfolio.models import TrackedSymbol, UserAlertHistory, UserConfig, WhaleAlertEvent
from user_workspace.models import Watchlist, WatchlistItem
from portfolio.services_global_signal_distribution import deliver_dark_flow_signal, deliver_whale_alert_event, resolve_signal_audience


class GlobalSignalDistributionServiceTests(TestCase):
    def _create_user(self, username: str) -> User:
        user = User.objects.create_user(username=username, password='Test@123456', is_staff=True)
        UserConfig.objects.create(user=user)
        return user

    def test_resolve_signal_audience_unions_tracked_and_watchlist_without_duplicates(self):
        tracked_user = self._create_user('tracked-user')
        watchlist_user = self._create_user('watchlist-user')
        both_user = self._create_user('both-user')

        TrackedSymbol.objects.create(user=tracked_user, symbol='VCB', whale_alert_threshold_million=900)
        TrackedSymbol.objects.create(user=both_user, symbol='VCB', whale_alert_threshold_million=750)

        watchlist_a = Watchlist.objects.create(user=watchlist_user, name='Theo dõi A')
        watchlist_b = Watchlist.objects.create(user=both_user, name='Theo dõi B')
        WatchlistItem.objects.create(watchlist=watchlist_a, symbol='VCB')
        WatchlistItem.objects.create(watchlist=watchlist_b, symbol='VCB')

        audience = resolve_signal_audience('vcb')

        self.assertEqual([row['user_id'] for row in audience], [tracked_user.id, watchlist_user.id, both_user.id])
        self.assertEqual(audience[0]['tracked_threshold_million'], 900)
        self.assertEqual(audience[1]['tracked_threshold_million'], None)
        self.assertEqual(audience[2]['tracked_threshold_million'], 750)
        self.assertEqual(audience[2]['sources'], ['tracked', 'watchlist'])

    @patch('portfolio.services_global_signal_distribution.async_to_sync')
    @patch('portfolio.services_global_signal_distribution.get_channel_layer')
    def test_deliver_dark_flow_signal_persists_history_and_broadcasts_symbol_and_user_groups(self, mock_get_channel_layer, mock_async_to_sync):
        user = self._create_user('dark-flow-user')
        watchlist = Watchlist.objects.create(user=user, name='Theo dõi dark flow')
        WatchlistItem.objects.create(watchlist=watchlist, symbol='VCB')

        mock_sender = MagicMock()
        mock_async_to_sync.return_value = mock_sender
        mock_get_channel_layer.return_value = MagicMock()

        result = deliver_dark_flow_signal(
            symbol='vcb',
            payload={'signal_type': 'iceberg', 'strength': 72.0, 'confidence': 'high'},
            message='Dòng tiền tối VCB: tín hiệu iceberg strength=72.',
        )

        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['history_count'], 1)
        self.assertEqual(result['symbol_broadcast_count'], 1)
        self.assertEqual(result['user_broadcast_count'], 1)
        self.assertEqual(UserAlertHistory.objects.count(), 1)

        history = UserAlertHistory.objects.get()
        self.assertEqual(history.user, user)
        self.assertEqual(history.symbol, 'VCB')
        self.assertEqual(history.alert_type, UserAlertHistory.AlertTypeChoices.DARK_MONEY)

        group_names = [call.args[0] for call in mock_sender.call_args_list]
        self.assertEqual(group_names, ['whale_VCB', f'user_{user.id}_alerts'])

    @patch('portfolio.services_global_signal_distribution.async_to_sync')
    @patch('portfolio.services_global_signal_distribution.get_channel_layer')
    def test_deliver_whale_alert_event_persists_history_and_broadcasts_symbol_and_user_groups(self, mock_get_channel_layer, mock_async_to_sync):
        user = self._create_user('whale-user')
        watchlist = Watchlist.objects.create(user=user, name='Theo dõi whale')
        WatchlistItem.objects.create(watchlist=watchlist, symbol='FPT')

        event = WhaleAlertEvent.objects.create(
            event_id='whale:FPT:2026-04-28T09:15:00+00:00:BUY:700000000:redis_stream',
            symbol='FPT',
            side='BUY',
            matched_value_vnd=700_000_000,
            threshold_vnd=500_000_000,
            threshold_policy_version='threshold-v1',
            severity='urgent',
            event_score=8.4,
            confidence='high',
            source='redis_stream',
            source_layer='live',
            trade_date=datetime(2026, 4, 28, 9, 15, 0, tzinfo=datetime_timezone.utc).date(),
            occurred_at=datetime(2026, 4, 28, 9, 15, 0, tzinfo=datetime_timezone.utc),
            payload_json={
                'event_id': 'whale:FPT:2026-04-28T09:15:00+00:00:BUY:700000000:redis_stream',
                'symbol': 'FPT',
                'side': 'buy',
                'matched_value': 700_000_000,
                'threshold': 500_000_000,
                'ts': '2026-04-28T09:15:00+00:00',
                'source': 'redis_stream',
            },
        )

        mock_sender = MagicMock()
        mock_async_to_sync.return_value = mock_sender
        mock_get_channel_layer.return_value = MagicMock()

        result = deliver_whale_alert_event(event=event)

        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['history_count'], 1)
        self.assertEqual(result['symbol_broadcast_count'], 1)
        self.assertEqual(result['user_broadcast_count'], 1)

        history = UserAlertHistory.objects.get(symbol='FPT', alert_type=UserAlertHistory.AlertTypeChoices.WHALE)
        self.assertEqual(history.user, user)

        group_names = [call.args[0] for call in mock_sender.call_args_list]
        self.assertEqual(group_names, ['whale_FPT', f'user_{user.id}_alerts'])
