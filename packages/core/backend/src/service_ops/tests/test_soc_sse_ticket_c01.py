"""C-01: SSE ?ticket= (human-only) + khoa mint ticket cho machine PAT.

- Mint: human (JWT/force_authenticate) -> 200 {ticket, expiresIn};
  machine PAT -> 403 (require_human_session).
- Stream: ?ticket= hop le -> 200 nhu JWT; ticket dung lai/sai -> 401/403;
  non-staff + SOC stream -> 403; ?token= tuong thich van 200.
- BE test can Postgres (L-B01): CHAY TREN VPS, khong chay local.
"""
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from identity_access.models import (
    CorePATCredential,
    CoreServiceAccount,
    CoreTenant,
    TenantMember,
)
from identity_access.ws_ticket import issue_ws_ticket

User = get_user_model()

ALERT_STREAM = '/core/v1/signals/alert-center/stream/?max_loops=1'
SOC_SIGNALS = '/api/soc/signals/stream/?max_loops=1'
SOC_DATAOPS = '/api/soc/dataops/stream/?max_loops=1'
SOC_OVERVIEW = '/api/soc/overview/stream/?max_loops=1'
MINT_URL = '/core/v1/auth/ws-ticket/'


def _read_content(response, max_bytes=20000) -> str:
    chunks = []
    for chunk in response.streaming_content:
        chunks.append(chunk.decode() if isinstance(chunk, bytes) else str(chunk))
        if sum(len(c) for c in chunks) > max_bytes:
            break
    return ''.join(chunks)


class SseTicketC01Tests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.staff = User.objects.create_user(
            username='sse-staff', email='sse-staff@test.local', password='pass123',
        )
        cls.staff.is_staff = True
        cls.staff.is_superuser = True
        cls.staff.save(update_fields=['is_staff', 'is_superuser'])
        cls.plain = User.objects.create_user(
            username='sse-plain', email='sse-plain@test.local', password='pass123',
        )
        cls.tenant = CoreTenant.objects.create(
            public_id='sse-ticket-uuid', tenant_code='sse-ticket',
            display_name='SSE Ticket', owner_user=cls.staff,
            status=CoreTenant.StatusChoices.ACTIVE, plan=CoreTenant.PlanChoices.PRO,
        )
        TenantMember.objects.create(
            tenant=cls.tenant, user=cls.staff,
            role=TenantMember.RoleChoices.OWNER,
        )
        cls.sa = CoreServiceAccount.objects.create(
            tenant=cls.tenant, name='SSE_SA',
            status=CoreServiceAccount.StatusChoices.ACTIVE,
            scopes=['market:read'],
        )
        _, cls.machine_raw = CorePATCredential.issue_for_service_account(
            service_account=cls.sa, scopes=['market:read'],
            label='sse:test', audit_reason='test', is_human_session=False,
        )
        # Human PAT giu staff flags (apply_pat_user_privileges khong strip) —
        # dung cho test nhanh ?token= tuong thich tren SOC stream.
        _, cls.human_raw = CorePATCredential.issue_for_service_account(
            service_account=cls.sa, scopes=['market:read'],
            label='sse:test-human', audit_reason='test', is_human_session=True,
        )

    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def _machine_client(self):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.machine_raw}')
        return client

    def test_human_mint_returns_ticket_shape(self):
        self.client.force_authenticate(user=self.staff)
        rsp = self.client.post(MINT_URL, {}, format='json')
        self.assertEqual(rsp.status_code, status.HTTP_200_OK)
        body = rsp.json()
        self.assertIsInstance(body.get('ticket'), str)
        self.assertGreaterEqual(len(body['ticket']), 32)
        self.assertEqual(body.get('expiresIn'), 60)

    def test_machine_pat_cannot_mint(self):
        rsp = self._machine_client().post(MINT_URL, {}, format='json')
        self.assertEqual(rsp.status_code, status.HTTP_403_FORBIDDEN)

    def test_alert_stream_ticket_ok(self):
        ticket, _ = issue_ws_ticket(self.staff.id, str(self.tenant.public_id))
        rsp = self.client.get(f'{ALERT_STREAM}&ticket={ticket}')
        self.assertEqual(rsp.status_code, status.HTTP_200_OK)

    def test_alert_stream_ticket_reuse_denied(self):
        ticket, _ = issue_ws_ticket(self.staff.id, str(self.tenant.public_id))
        first = self.client.get(f'{ALERT_STREAM}&ticket={ticket}')
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        second = self.client.get(f'{ALERT_STREAM}&ticket={ticket}')
        self.assertIn(second.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_alert_stream_bad_ticket_denied(self):
        rsp = self.client.get(f'{ALERT_STREAM}&ticket=nope-not-a-ticket')
        self.assertIn(rsp.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_soc_signals_ticket_staff_ok(self):
        ticket, _ = issue_ws_ticket(self.staff.id, str(self.tenant.public_id))
        rsp = self.client.get(f'{SOC_SIGNALS}&ticket={ticket}')
        self.assertEqual(rsp.status_code, status.HTTP_200_OK)
        self.assertIn('retry: 3000', _read_content(rsp))

    def test_soc_signals_ticket_plain_user_denied(self):
        ticket, _ = issue_ws_ticket(self.plain.id)
        rsp = self.client.get(f'{SOC_SIGNALS}&ticket={ticket}')
        self.assertEqual(rsp.status_code, status.HTTP_403_FORBIDDEN)

    def test_soc_dataops_and_overview_ticket_staff_ok(self):
        for url in (SOC_DATAOPS, SOC_OVERVIEW):
            ticket, _ = issue_ws_ticket(self.staff.id, str(self.tenant.public_id))
            rsp = self.client.get(f'{url}&ticket={ticket}')
            self.assertEqual(rsp.status_code, status.HTTP_200_OK, msg=url)

    def test_soc_signals_token_compat_still_works(self):
        rsp = self.client.get(f'{SOC_SIGNALS}&token={self.human_raw}')
        self.assertEqual(rsp.status_code, status.HTTP_200_OK)
