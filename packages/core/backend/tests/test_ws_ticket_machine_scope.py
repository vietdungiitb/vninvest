"""WS ticket machine PAT scope (2026-11-20) — fail-before tests.

Machine PAT may mint a short-lived WS ticket ONLY with `ws:realtime` scope.
Machine tickets must never restore staff/tenant-admin privileges at redeem.
"""
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from identity_access.models import (
    CorePATCredential, CoreServiceAccount, CoreTenant, TenantMember,
)
from identity_access.ws_ticket import issue_ws_ticket, resolve_user_from_ws_query

MINT_URL = '/core/v1/auth/ws-ticket/'
ALERT_STREAM = '/core/v1/signals/alert-center/stream/'


class MachineWsTicketTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user(
            username='ws_machine_owner', email='ws-machine@test.com',
            password='testpass123', is_staff=True, is_superuser=True,
        )
        cls.tenant = CoreTenant.objects.create(
            public_id='ws-machine-tenant', tenant_code='wsm',
            display_name='WS Machine', owner_user=cls.owner,
            status=CoreTenant.StatusChoices.ACTIVE,
            plan=CoreTenant.PlanChoices.PRO,
        )
        TenantMember.objects.create(
            tenant=cls.tenant, user=cls.owner, role=TenantMember.RoleChoices.OWNER,
        )
        cls.sa = CoreServiceAccount.objects.create(
            tenant=cls.tenant, name='WS_MACHINE_SA',
            status=CoreServiceAccount.StatusChoices.ACTIVE,
            scopes=['ws:realtime', 'market:read'],
        )

    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def _pat(self, scopes):
        _, raw = CorePATCredential.issue_for_service_account(
            service_account=self.sa, scopes=scopes,
            label='ws:machine', audit_reason='test', is_human_session=False,
        )
        return raw

    def _client_as_machine(self, scopes):
        # Bearer header makes CorePATAuthentication set request.auth = credential
        # (permissions.py:39-52 reads it); force_authenticate(auth=...) is not
        # available in this DRF version.
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {self._pat(scopes)}')
        return client

    def test_machine_pat_with_scope_mints_ticket(self):
        rsp = self._client_as_machine(['ws:realtime']).post(MINT_URL, {}, format='json')
        self.assertEqual(rsp.status_code, status.HTTP_200_OK)
        body = rsp.json()
        self.assertIsInstance(body.get('ticket'), str)
        self.assertGreaterEqual(len(body['ticket']), 32)
        self.assertLessEqual(body.get('expiresIn'), 60)
        payload = cache.get('ws_ticket:' + body['ticket'])
        self.assertTrue(payload.get('machine'))
        self.assertEqual(payload.get('tenant_id'), str(self.tenant.public_id))

    def test_machine_pat_without_scope_denied(self):
        rsp = self._client_as_machine(['market:read']).post(MINT_URL, {}, format='json')
        self.assertEqual(rsp.status_code, status.HTTP_403_FORBIDDEN)

    def test_human_session_still_mints(self):
        self.client.force_authenticate(user=self.owner)
        rsp = self.client.post(MINT_URL, {}, format='json')
        self.assertEqual(rsp.status_code, status.HTTP_200_OK)
        self.assertEqual(rsp.json().get('expiresIn'), 60)

    def test_machine_ticket_single_use(self):
        ticket, _ = issue_ws_ticket(
            self.owner.id, str(self.tenant.public_id), machine=True,
        )
        first = resolve_user_from_ws_query('ticket=' + ticket)
        self.assertIsNotNone(first)
        self.assertIsNone(resolve_user_from_ws_query('ticket=' + ticket))

    def test_machine_ticket_strips_staff_on_resolve(self):
        User.objects.filter(pk=self.owner.pk).update(is_staff=True, is_superuser=True)
        ticket, _ = issue_ws_ticket(
            self.owner.id, str(self.tenant.public_id), machine=True,
        )
        user = resolve_user_from_ws_query('ticket=' + ticket)
        self.assertIsNotNone(user)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)

    def test_machine_ticket_on_alert_center_stream_is_403(self):
        ticket, _ = issue_ws_ticket(
            self.owner.id, str(self.tenant.public_id), machine=True,
        )
        rsp = self.client.get(f'{ALERT_STREAM}?ticket={ticket}')
        self.assertEqual(rsp.status_code, status.HTTP_403_FORBIDDEN)

    def test_human_ticket_on_alert_center_stream_still_ok(self):
        ticket, _ = issue_ws_ticket(self.owner.id, str(self.tenant.public_id))
        rsp = self.client.get(f'{ALERT_STREAM}?ticket={ticket}')
        self.assertEqual(rsp.status_code, status.HTTP_200_OK)
