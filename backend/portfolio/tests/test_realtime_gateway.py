import asyncio

from channels.testing import WebsocketCommunicator
from django.contrib.auth.models import User
from django.test import TransactionTestCase
from django.test.utils import override_settings
from rest_framework_simplejwt.tokens import AccessToken

from config.asgi import application


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
