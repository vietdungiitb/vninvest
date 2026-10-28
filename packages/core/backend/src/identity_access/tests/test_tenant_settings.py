"""
Sprint 3: TenantSettings view tests.

Covers:
1. GET /core/v1/partner/settings/ returns (creating if absent) default settings for the active tenant
2. PUT /core/v1/partner/settings/ updates timezone/locale/theme/custom_domain and persists
3. Scope guard: machine PAT without manage_tenant scope is rejected (403)
4. Cross-tenant PAT cannot read another tenant's settings (403)
"""

import json
import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase

from identity_access.models import (
    CorePATCredential,
    CoreServiceAccount,
    CoreTenant,
    TenantMember,
)
from identity_access.tests.envelope import unwrapped_json

User = get_user_model()


def _parse_json_response(response):
    return json.loads(response.content.decode('utf-8'))


class PartnerTenantSettingsViewTests(TestCase):
    """API tests for PartnerTenantSettingsView (GET/PUT)."""

    def setUp(self):
        self.owner_user = User.objects.create_user(
            username='owner_user', email='owner@test.com', password='testpass123',
        )
        self.tenant = CoreTenant.objects.create(
            public_id='settings_tenant_1', tenant_code='settings_tenant',
            display_name='Settings Tenant', owner_user=self.owner_user,
            status=CoreTenant.StatusChoices.ACTIVE, plan=CoreTenant.PlanChoices.PRO,
        )
        TenantMember.objects.create(
            tenant=self.tenant, user=self.owner_user, role=TenantMember.RoleChoices.OWNER,
        )

        # Second tenant to test cross-tenant isolation
        self.other_owner = User.objects.create_user(
            username='other_owner', email='other@test.com', password='testpass123',
        )
        self.tenant2 = CoreTenant.objects.create(
            public_id='settings_tenant_2', tenant_code='settings_tenant_2',
            display_name='Other Tenant', owner_user=self.other_owner,
            status=CoreTenant.StatusChoices.ACTIVE, plan=CoreTenant.PlanChoices.FREE,
        )

    def _human_pat(self, scopes, tenant=None):
        tenant = tenant or self.tenant
        sa = CoreServiceAccount.objects.create(
            tenant=tenant, name=f'SA_{uuid.uuid4().hex[:8]}',
            status=CoreServiceAccount.StatusChoices.ACTIVE, scopes=scopes,
        )
        pat, raw = CorePATCredential.issue_for_service_account(
            service_account=sa, scopes=scopes,
            label='login:test', audit_reason='core login', is_human_session=True,
        )
        return raw

    def _machine_pat(self, scopes, tenant=None):
        tenant = tenant or self.tenant
        sa = CoreServiceAccount.objects.create(
            tenant=tenant, name=f'SA_{uuid.uuid4().hex[:8]}',
            status=CoreServiceAccount.StatusChoices.ACTIVE, scopes=scopes,
        )
        pat, raw = CorePATCredential.issue_for_service_account(
            service_account=sa, scopes=scopes,
            label='Machine PAT', audit_reason='test', is_human_session=False,
        )
        return raw

    def _headers(self, raw_token, tenant=None):
        tenant = tenant or self.tenant
        return {
            'HTTP_AUTHORIZATION': f'Bearer {raw_token}',
            'HTTP_X_TENANT_ID': tenant.public_id,
        }

    def test_get_creates_default_settings(self):
        raw = self._human_pat(['manage_tenant'])
        resp = self.client.get('/core/v1/partner/settings/', **self._headers(raw))
        self.assertEqual(resp.status_code, 200)
        data = unwrapped_json(resp)
        self.assertEqual(data['timezone'], 'Asia/Ho_Chi_Minh')
        self.assertEqual(data['locale'], 'vi')
        self.assertEqual(data['theme'], 'dark')

    def test_put_updates_settings(self):
        raw = self._human_pat(['manage_tenant'])
        payload = {
            'timezone': 'America/New_York',
            'locale': 'en',
            'theme': 'light',
            'custom_domain': 'app.example.com',
        }
        resp = self.client.put(
            '/core/v1/partner/settings/',
            data=json.dumps(payload),
            content_type='application/json',
            **self._headers(raw),
        )
        self.assertEqual(resp.status_code, 200)
        data = unwrapped_json(resp)
        self.assertEqual(data['timezone'], 'America/New_York')
        self.assertEqual(data['locale'], 'en')
        self.assertEqual(data['theme'], 'light')
        self.assertEqual(data['custom_domain'], 'app.example.com')

        # Confirm persisted
        resp2 = self.client.get('/core/v1/partner/settings/', **self._headers(raw))
        data2 = unwrapped_json(resp2)
        self.assertEqual(data2['timezone'], 'America/New_York')
        self.assertEqual(data2['custom_domain'], 'app.example.com')

    def test_machine_pat_missing_scope_rejected(self):
        raw = self._machine_pat(['market:read'])
        resp = self.client.get('/core/v1/partner/settings/', **self._headers(raw))
        self.assertEqual(resp.status_code, 403)

    def test_machine_pat_missing_scope_rejected_on_put(self):
        raw = self._machine_pat(['market:read'])
        resp = self.client.put(
            '/core/v1/partner/settings/',
            data=json.dumps({'theme': 'light'}),
            content_type='application/json',
            **self._headers(raw),
        )
        self.assertEqual(resp.status_code, 403)

    def test_cross_tenant_pat_rejected(self):
        # Machine PAT belongs to tenant2, but request targets tenant1
        raw = self._machine_pat(['manage_tenant'], tenant=self.tenant2)
        resp = self.client.get(
            '/core/v1/partner/settings/',
            HTTP_AUTHORIZATION=f'Bearer {raw}',
            HTTP_X_TENANT_ID=self.tenant.public_id,
        )
        self.assertEqual(resp.status_code, 403)
