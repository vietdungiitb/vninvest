import asyncio

from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.contrib.auth.models import User
from django.test import TransactionTestCase
from django.test.utils import override_settings
from rest_framework_simplejwt.tokens import AccessToken
from unittest.mock import MagicMock, patch

from config.asgi import application
from portfolio.models import UserConfig
from portfolio.realtime.stream_consumers import WsBroadcastConsumer


@override_settings(
    CHANNEL_LAYERS={
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        }
    }
)
class RealtimeGatewayTests(TransactionTestCase):
    async_capable = True

    def setUp(self):
        self.user = User.objects.create_user(
            username="ws-user",
            email="ws-user@example.com",
            password="Test@123456",
        )

    def test_websocket_rejects_missing_token(self):
        async def run_test():
            communicator = WebsocketCommunicator(application, "/ws/realtime/")
            connected, _ = await communicator.connect()
            self.assertFalse(connected)
            await communicator.disconnect()

        asyncio.run(run_test())

    def test_websocket_accepts_valid_token_and_subscribe(self):
        async def run_test():
            token = str(AccessToken.for_user(self.user))
            communicator = WebsocketCommunicator(application, f"/ws/realtime/?token={token}")
            connected, _ = await communicator.connect()
            self.assertTrue(connected)

            message = await communicator.receive_json_from()
            self.assertEqual(message["event_type"], "connected")
            self.assertEqual(message["user_id"], self.user.id)

            await communicator.send_json_to({"action": "subscribe", "symbols": ["VNM", "HPG"]})
            subscribed = await communicator.receive_json_from()
            self.assertEqual(subscribed["event_type"], "subscribed")
            self.assertEqual(subscribed["symbols"], ["VNM", "HPG"])

            await communicator.send_json_to({"action": "unsubscribe", "symbols": ["HPG"]})
            unsubscribed = await communicator.receive_json_from()
            self.assertEqual(unsubscribed["event_type"], "unsubscribed")
            self.assertEqual(unsubscribed["symbols"], ["HPG"])

            await communicator.disconnect()

        asyncio.run(run_test())

    def test_websocket_masks_whale_advisory_detail_for_pro_plan(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'pro', 'email_verified': True},
        )

        async def run_test():
            token = str(AccessToken.for_user(self.user))
            communicator = WebsocketCommunicator(application, f"/ws/realtime/?token={token}")
            connected, _ = await communicator.connect()
            self.assertTrue(connected)

            await communicator.receive_json_from()
            await communicator.send_json_to({"action": "subscribe", "symbols": ["VNM"]})
            await communicator.receive_json_from()

            channel_layer = get_channel_layer()
            await channel_layer.group_send(
                'whale_VNM',
                {
                    'type': 'whale_advisory',
                    'payload': {
                        'event_type': 'whale_advisory',
                        'symbol': 'VNM',
                        'side': 'BUY',
                        'matched_value': 5_500_000_000,
                        'threshold': 5_000_000_000,
                        'ai_summary': 'Tom tat advisory',
                        'ai_detail': 'Chi tiet premium',
                        'ts': '2026-04-03T09:31:00+07:00',
                        'created_at': '2026-04-03T09:31:00+07:00',
                        'id': 99,
                    },
                },
            )

            advisory = await communicator.receive_json_from()
            self.assertEqual(advisory['event_type'], 'whale_advisory')
            self.assertEqual(advisory['symbol'], 'VNM')
            self.assertEqual(advisory['matched_value'], 5_500_000_000)
            self.assertEqual(advisory['threshold'], 5_000_000_000)
            self.assertEqual(advisory['ai_summary'], 'Tom tat advisory')
            self.assertEqual(advisory['ts'], '2026-04-03T09:31:00+07:00')
            self.assertNotIn('ai_detail', advisory)

            await communicator.disconnect()

        asyncio.run(run_test())

    def test_websocket_forwards_dark_flow_alert(self):
        async def run_test():
            token = str(AccessToken.for_user(self.user))
            communicator = WebsocketCommunicator(application, f"/ws/realtime/?token={token}")
            connected, _ = await communicator.connect()
            self.assertTrue(connected)

            await communicator.receive_json_from()
            await communicator.send_json_to({"action": "subscribe", "symbols": ["VNM"]})
            await communicator.receive_json_from()

            channel_layer = get_channel_layer()
            await channel_layer.group_send(
                'whale_VNM',
                {
                    'type': 'dark_flow_alert',
                    'data': {
                        'contract_version': '1.0',
                        'symbol': 'VNM',
                        'signal_type': 'iceberg',
                        'strength': 72.5,
                        'confidence': 'high',
                        'tick_rate': 18.3,
                        'small_order_ratio': 0.82,
                        'cvd_at_signal': -1_200_000_000,
                        'description': 'Phat hien 23 lenh nho lap tai 78,200 VND trong 5 phut',
                        'event_id': 'dark_flow:VNM:2026-04-04T13:00:00Z:iceberg',
                        'ts': '2026-04-04T13:00:00Z',
                    },
                },
            )

            event = await communicator.receive_json_from()
            self.assertEqual(event['event_type'], 'dark_flow_alert')
            self.assertEqual(event['symbol'], 'VNM')
            self.assertEqual(event['signal_type'], 'iceberg')
            self.assertEqual(event['confidence'], 'high')
            self.assertEqual(event['event_id'], 'dark_flow:VNM:2026-04-04T13:00:00Z:iceberg')

            await communicator.disconnect()

        asyncio.run(run_test())


    def test_stream_broadcaster_delivers_ticker_payload_shape(self):
        mock_sender = MagicMock()
        mock_channel_layer = MagicMock()

        with patch('channels.layers.get_channel_layer', return_value=mock_channel_layer), patch('asgiref.sync.async_to_sync', return_value=mock_sender):
            consumer = WsBroadcastConsumer()
            consumer.process_batch(
                'FPT',
                [
                    (
                        '1-0',
                        {
                            'ts': '2026-04-03T09:30:00+07:00',
                            'price': '75.4',
                            'volume': '100',
                            'side': 'BUY',
                        },
                    )
                ],
            )

        mock_sender.assert_called_once()
        group_name, event = mock_sender.call_args.args
        self.assertEqual(group_name, 'ticker_FPT')
        self.assertEqual(event['type'], 'ticker_update')
        self.assertEqual(event['payload']['event_type'], 'ticker_update')
        self.assertEqual(event['payload']['symbol'], 'FPT')
        self.assertEqual(event['payload']['price'], 75.4)

    @override_settings(REALTIME_BROADCAST_DEGRADE_ENABLED=True, REALTIME_BROADCAST_DEGRADE_PENDING_THRESHOLD=1)
    def test_stream_broadcaster_degrades_payload_when_backpressure_high(self):
        mock_sender = MagicMock()
        mock_channel_layer = MagicMock()

        with (
            patch('channels.layers.get_channel_layer', return_value=mock_channel_layer),
            patch('asgiref.sync.async_to_sync', return_value=mock_sender),
            patch('portfolio.realtime.stream_consumers.get_realtime_metric', return_value=10),
        ):
            consumer = WsBroadcastConsumer()
            consumer.process_batch(
                'FPT',
                [
                    (
                        '1-0',
                        {
                            'ts': '2026-04-03T09:30:00+07:00',
                            'price': '75.4',
                            'volume': '100',
                            'side': 'BUY',
                        },
                    )
                ],
            )

        group_name, event = mock_sender.call_args.args
        self.assertEqual(group_name, 'ticker_FPT')
        self.assertTrue(event['payload'].get('degraded'))
        self.assertEqual(event['payload']['symbol'], 'FPT')
