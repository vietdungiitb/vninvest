"""S1 WS ticket G0.2/C02 — fail-before: endpoint + single-use ticket chua co."""
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from identity_access.models import CorePATCredential, CoreServiceAccount, CoreTenant, TenantMember
from identity_access.ws_ticket import (
    issue_ws_ticket,
    redeem_ws_ticket,
    resolve_user_from_ws_query,
)


class WsTicketTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.owner = User.objects.create_user(
            username='ws_owner', email='ws@test.com', password='testpass123',
        )
        self.tenant = CoreTenant.objects.create(
            public_id='ws-tenant-uuid', tenant_code='ws',
            display_name='WS', owner_user=self.owner,
            status=CoreTenant.StatusChoices.ACTIVE, plan=CoreTenant.PlanChoices.PRO,
        )
        TenantMember.objects.create(
            tenant=self.tenant, user=self.owner, role=TenantMember.RoleChoices.OWNER,
        )

    def test_issue_requires_auth(self):
        resp = self.client.post('/core/v1/auth/ws-ticket/', {}, format='json')
        self.assertEqual(resp.status_code, 401)

    def test_issue_returns_ticket_shape(self):
        self.client.force_authenticate(user=self.owner)
        resp = self.client.post('/core/v1/auth/ws-ticket/', {}, format='json')
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertIsInstance(body.get('ticket'), str)
        self.assertGreaterEqual(len(body['ticket']), 32)
        self.assertEqual(body.get('expiresIn'), 60)

    def test_ticket_single_use(self):
        ticket, _ = issue_ws_ticket(self.owner.id, str(self.tenant.public_id))
        first = redeem_ws_ticket(ticket)
        self.assertIsNotNone(first)
        self.assertEqual(first['user_id'], self.owner.id)
        self.assertIsNone(redeem_ws_ticket(ticket))

    def test_redeem_invalid_none(self):
        self.assertIsNone(redeem_ws_ticket('nope-not-a-ticket'))

    def test_redeem_expired_none(self):
        ticket, _ = issue_ws_ticket(self.owner.id, timeout_s=0)
        self.assertIsNone(redeem_ws_ticket(ticket))

    def test_ws_query_ticket(self):
        ticket, _ = issue_ws_ticket(self.owner.id)
        user = resolve_user_from_ws_query(f'ticket={ticket}')
        self.assertIsNotNone(user)
        self.assertEqual(user.id, self.owner.id)
        self.assertIsNone(resolve_user_from_ws_query(f'ticket={ticket}'))

    def test_ws_query_token_compat(self):
        sa = CoreServiceAccount.objects.create(
            tenant=self.tenant, name='WS_SA', status=CoreServiceAccount.StatusChoices.ACTIVE,
            scopes=['market:read'],
        )
        _, raw = CorePATCredential.issue_for_service_account(
            service_account=sa, scopes=['market:read'],
            label='ws:test', audit_reason='test', is_human_session=False,
        )
        user = resolve_user_from_ws_query(f'token={raw}')
        self.assertIsNotNone(user)
        self.assertEqual(user.id, self.owner.id)

    def test_ws_query_empty_none(self):
        self.assertIsNone(resolve_user_from_ws_query(''))
        self.assertIsNone(resolve_user_from_ws_query('foo=bar'))
