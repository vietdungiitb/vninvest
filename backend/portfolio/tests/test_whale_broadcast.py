from unittest.mock import MagicMock, patch

from django.contrib.auth.models import User
from django.test import TestCase

from portfolio.models import TrackedSymbol, UserAlertHistory, UserConfig
from portfolio.tasks_whale_broadcast import _broadcast_screener_matched


class WhaleBroadcastTests(TestCase):
    def _create_user(self, username: str) -> User:
        user = User.objects.create_user(username=username, password='Test@123456', is_staff=True)
        UserConfig.objects.create(user=user)
        return user

    @patch('portfolio.tasks_whale_broadcast.async_to_sync')
    @patch('portfolio.tasks_whale_broadcast.get_channel_layer')
    def test_broadcast_screener_matched_persists_history_and_sends_alert(self, mock_get_channel_layer, mock_async_to_sync):
        user = self._create_user('screener-user')
        TrackedSymbol.objects.create(user=user, symbol='VCB')

        mock_sender = MagicMock()
        mock_async_to_sync.return_value = mock_sender
        mock_get_channel_layer.return_value = MagicMock()

        result = _broadcast_screener_matched(symbol='vcb')

        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['symbol'], 'VCB')
        self.assertEqual(result['audience_count'], 1)
        self.assertEqual(result['history_count'], 1)
        self.assertEqual(UserAlertHistory.objects.count(), 1)

        history = UserAlertHistory.objects.get()
        self.assertEqual(history.user, user)
        self.assertEqual(history.symbol, 'VCB')
        self.assertEqual(history.alert_type, UserAlertHistory.AlertTypeChoices.SCREENER)
        self.assertIn('screener toàn cục', history.message)

        mock_sender.assert_called_once()
        group_name, event = mock_sender.call_args.args
        self.assertEqual(group_name, f'user_{user.id}_alerts')
        self.assertEqual(event['type'], 'screener_matched')
        self.assertEqual(event['payload']['event_type'], 'screener_matched')
        self.assertEqual(event['payload']['symbol'], 'VCB')
