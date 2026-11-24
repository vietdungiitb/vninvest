"""REV.2.1 WS identity helper — additive, never breaks legacy User|None callers."""
from unittest.mock import patch

from django.test import SimpleTestCase

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
