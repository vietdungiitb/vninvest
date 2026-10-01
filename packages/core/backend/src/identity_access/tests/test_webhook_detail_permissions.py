"""F1 hotfix tests: WebhookConfigDetailView thiếu _require_tenant_permission.

Viewer GET/PATCH/DELETE → 403; owner → 200/204.
Chạy: python manage.py test identity_access.tests.test_webhook_detail_permissions
"""
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from identity_access.tests.envelope import unwrapped, unwrapped_json
from identity_access.models import (
    CoreServiceAccount,
    CoreTenant,
    TenantMember,
    TenantWebhookConfig,
)


class WebhookDetailPermissionTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username='wh_owner', email='wh_owner@test.com', password='x')
        self.viewer = User.objects.create_user(
            username='wh_viewer', email='wh_viewer@test.com', password='x')
        self.tenant = CoreTenant.objects.create(
            public_id='wh_tenant_uuid', tenant_code='wh_tenant',
            display_name='WH Tenant', owner_user=self.owner,
            status=CoreTenant.StatusChoices.ACTIVE, plan=CoreTenant.PlanChoices.PRO,
        )
        CoreServiceAccount.objects.create(
            tenant=self.tenant, name='default',
            status=CoreServiceAccount.StatusChoices.ACTIVE,
            scopes=['market:read', 'signals:read', 'ai:invoke', 'manage_pats'],
        )
        TenantMember.objects.create(
            tenant=self.tenant, user=self.viewer, role=TenantMember.RoleChoices.VIEWER)
        self.config = TenantWebhookConfig.objects.create(
            tenant=self.tenant, name='WH1', url='https://example.com/hook',
            events=['signal'], secret='s3cr3t',
        )
        self.url = f'/core/v1/partner/webhooks/{self.config.id}/'
        self.owner_client = APIClient()
        self.owner_client.force_authenticate(user=self.owner)
        self.viewer_client = APIClient()
        self.viewer_client.force_authenticate(user=self.viewer)

    def test_viewer_get_forbidden(self):
        resp = self.viewer_client.get(self.url)
        self.assertEqual(resp.status_code, 403)

    def test_viewer_patch_forbidden(self):
        resp = self.viewer_client.patch(self.url, {'name': 'Hacked'}, format='json')
        self.assertEqual(resp.status_code, 403)

    def test_viewer_delete_forbidden(self):
        resp = self.viewer_client.delete(self.url)
        self.assertEqual(resp.status_code, 403)
        self.assertTrue(TenantWebhookConfig.objects.filter(id=self.config.id).exists())

    def test_owner_get_ok(self):
        resp = self.owner_client.get(self.url)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(unwrapped_json(resp)['name'], 'WH1')

    def test_owner_patch_ok(self):
        resp = self.owner_client.patch(self.url, {'name': 'WH2'}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.config.refresh_from_db()
        self.assertEqual(self.config.name, 'WH2')

    def test_owner_delete_ok(self):
        resp = self.owner_client.delete(self.url)
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(TenantWebhookConfig.objects.filter(id=self.config.id).exists())
