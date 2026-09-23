"""B+A S1 tests: personal API keys self-service (12 cases §6 + C5/C7/C8).

Chạy: python manage.py test identity_access.tests.test_personal_keys
"""
from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from identity_access.models import (
    CorePATCredential,
    CoreServiceAccount,
    CoreTenant,
    PATAuditLog,
    TenantMember,
)

BASE = '/core/v1/partner/me'


class PersonalKeysTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username='pk_owner', email='pk_owner@test.com', password='x')
        self.member = User.objects.create_user(
            username='pk_member', email='pk_member@test.com', password='x')
        self.tenant = CoreTenant.objects.create(
            public_id='pk-tenant-uuid', tenant_code='pk_tenant',
            display_name='PK Tenant', owner_user=self.owner,
            status=CoreTenant.StatusChoices.ACTIVE, plan=CoreTenant.PlanChoices.PRO)
        self.sa = CoreServiceAccount.objects.create(
            tenant=self.tenant, name='default',
            status=CoreServiceAccount.StatusChoices.ACTIVE,
            scopes=['market:read', 'signals:read', 'ai:invoke', 'manage_pats'])
        TenantMember.objects.create(
            tenant=self.tenant, user=self.member, role=TenantMember.RoleChoices.EDITOR)
        self.owner_client = APIClient()
        self.owner_client.force_authenticate(user=self.owner)
        self.member_client = APIClient()
        self.member_client.force_authenticate(user=self.member)

    def _issue(self, client=None, **body):
        client = client or self.owner_client
        payload = {'display_name': 'mykey'}
        payload.update(body)
        return client.post(f'{BASE}/keys/', payload, format='json')

    def test_01_owner_list_empty(self):
        resp = self.owner_client.get(f'{BASE}/keys/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()['results'], [])

    def test_02_owner_issue_returns_secret_once(self):
        resp = self._issue()
        self.assertEqual(resp.status_code, 201)
        body = resp.json()
        self.assertTrue(body['secret'].startswith('vni_'))  # C5: vni_, không vniv_
        self.assertEqual(body['token_prefix'], body['secret'][:12])
        self.assertTrue(body['label'].startswith('personal:'))
        self.key_id = body['id']

    def test_03_list_hides_secret(self):
        self._issue()
        resp = self.owner_client.get(f'{BASE}/keys/')
        self.assertEqual(len(resp.json()['results']), 1)
        self.assertNotIn('secret', resp.json()['results'][0])

    def test_04_scope_beyond_sa_rejected(self):
        resp = self._issue(scope_codes=['root:everything'])
        self.assertEqual(resp.status_code, 400)

    def test_05_past_expiry_rejected(self):
        past = (timezone.now() - timedelta(days=1)).isoformat()
        resp = self._issue(expires_at=past)
        self.assertEqual(resp.status_code, 400)

    def test_06_rotate_returns_new_secret_and_marks_rotating(self):
        created = self._issue().json()
        resp = self.owner_client.post(
            f"{BASE}/keys/{created['id']}/rotate/", {}, format='json')
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(body['new_token']['secret'].startswith('vni_'))
        old = CorePATCredential.objects.get(public_id=created['id'])
        self.assertEqual(old.status, CorePATCredential.StatusChoices.ROTATING)
        self.assertIsNotNone(old.expires_at)  # C7: định nghĩa thắng set expires_at

    def test_07_revoke_then_bearer_401(self):
        created = self._issue().json()
        secret = created['secret']
        resp = self.owner_client.post(
            f"{BASE}/keys/{created['id']}/revoke/", {'reason': 'lost'}, format='json')
        self.assertEqual(resp.status_code, 200)
        anon = APIClient()
        resp = anon.get(f'{BASE}/summary/', HTTP_AUTHORIZATION=f'Bearer {secret}')
        self.assertEqual(resp.status_code, 401)  # C7: revoked = 401 (không 403)

    def test_08_member_own_key_ok_other_404(self):
        mine = self.member_client.post(
            f'{BASE}/keys/', {'display_name': 'mine'}, format='json')
        self.assertEqual(mine.status_code, 201)
        theirs = self._issue().json()
        resp = self.member_client.post(
            f"{BASE}/keys/{theirs['id']}/rotate/", {}, format='json')
        self.assertEqual(resp.status_code, 404)  # fail-closed, không lộ tồn tại
        resp = self.member_client.get(f'{BASE}/keys/')
        self.assertEqual(len(resp.json()['results']), 1)

    def test_09_viewer_can_issue_self(self):
        viewer = User.objects.create_user(username='pk_viewer', password='x')
        TenantMember.objects.create(
            tenant=self.tenant, user=viewer, role=TenantMember.RoleChoices.VIEWER)
        client = APIClient()
        client.force_authenticate(user=viewer)
        resp = client.post(f'{BASE}/keys/', {'display_name': 'vkey'}, format='json')
        self.assertEqual(resp.status_code, 201)  # D3 self-service

    def test_10_bearer_summary_right_user(self):
        created = self._issue().json()
        bearer = APIClient()
        resp = bearer.get(f'{BASE}/summary/',
                          HTTP_AUTHORIZATION=f"Bearer {created['secret']}")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()['tenant']['tenant_code'], 'pk_tenant')
        self.assertEqual(resp.json()['my']['total_keys'], 1)

    def test_11_usage_summary_counts_seeded_logs(self):
        created = self._issue().json()
        pat = CorePATCredential.objects.get(public_id=created['id'])
        for _ in range(3):
            PATAuditLog.objects.create(
                pat=pat, tenant=self.tenant, ip_address='127.0.0.1',
                endpoint='/x/', method='GET', status_code=200)
        resp = self.owner_client.get(f'{BASE}/keys/usage-summary/?days=30')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()['total_calls_30d'], 3)
        self.assertEqual(resp.json()['keys'][0]['calls_30d'], 3)

    def test_12_max_active_pats_enforced(self):
        # N5: model chỉ đếm key CÓ expires_at tương lai → cả 2 key đều đặt expiry
        self.tenant.max_active_pats = 1
        self.tenant.save(update_fields=['max_active_pats'])
        future = (timezone.now() + timedelta(days=30)).isoformat()
        self.assertEqual(
            self._issue(display_name='k1', expires_at=future).status_code, 201)
        resp = self._issue(display_name='k2', expires_at=future)
        self.assertEqual(resp.status_code, 400)

    def test_13_summary_no_tenant_403(self):
        lonely = User.objects.create_user(username='pk_lonely', password='x')
        client = APIClient()
        client.force_authenticate(user=lonely)
        resp = client.get(f'{BASE}/summary/')
        self.assertEqual(resp.status_code, 403)  # C8: middleware chặn 403

    def test_14_admin_prefix_rejected(self):
        resp = self._issue(display_name='personal:hack')
        self.assertEqual(resp.status_code, 400)
