"""REV.2.1 WS identity helper — additive, never breaks legacy User|None callers."""
from unittest.mock import patch

from django.test import SimpleTestCase, TransactionTestCase, override_settings

from identity_access.ws_ticket import resolve_ws_identity


class ResolveWsIdentityTests(SimpleTestCase):
    def test_ticket_and_token_are_distinguished(self):
        with patch('identity_access.ws_ticket.resolve_user_from_ws_query', return_value='USER'):
            self.assertEqual(
                resolve_ws_identity('ticket=abc'),
                {'user': 'USER', 'auth_method': 'ticket'},
            )
            self.assertEqual(
                resolve_ws_identity('token=raw-pat'),
                {'user': 'USER', 'auth_method': 'token'},
            )

    def test_unauthenticated_returns_none(self):
        with patch('identity_access.ws_ticket.resolve_user_from_ws_query', return_value=None):
            self.assertIsNone(resolve_ws_identity(''))
            self.assertIsNone(resolve_ws_identity('ticket=expired'))

    def test_legacy_function_is_not_removed(self):
        # tests/test_ws_ticket.py asserts `.id` on the old return shape.
        from identity_access import ws_ticket
        self.assertTrue(callable(ws_ticket.resolve_user_from_ws_query))


@override_settings(CHANNEL_LAYERS={
    'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'},
})
class RealtimeConsumerEventsTests(TransactionTestCase):
    """AC10: opt-in events get `not_provisioned`; opt-out traffic is untouched."""

    async def test_opted_event_gets_not_provisioned(self):
        from types import SimpleNamespace

        from channels.testing import WebsocketCommunicator
        from signal_intelligence.consumers import RealtimeConsumer

        identity = {
            'user': SimpleNamespace(username='ws-contract', is_authenticated=True),
            'auth_method': 'ticket',
        }
        with patch('identity_access.ws_ticket.resolve_ws_identity', return_value=identity):
            communicator = WebsocketCommunicator(RealtimeConsumer.as_asgi(), '/ws/realtime/?ticket=x')
            connected, _ = await communicator.connect()
            self.assertTrue(connected)
            await communicator.send_json_to({
                'action': 'subscribe', 'symbols': ['VIC'], 'events': ['whale_order'],
            })
            ack = await communicator.receive_json_from()
            self.assertEqual(ack['event_type'], 'subscribed')
            self.assertEqual(ack['events'], ['whale_order'])
            event = await communicator.receive_json_from()
            self.assertEqual(event['code'], 'not_provisioned')
            self.assertEqual(event['event'], 'whale_order')
            await communicator.disconnect()
