"""R5 tests: staff-switch A3 (staff-only, read-only, có audit).

Chạy: python manage.py test service_ops.tests.test_soc_staff_switch
"""
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from identity_access.models import CoreTenant, TenantWebhookConfig
from ops_audit.models import AuditEvent

SWITCH = '/api/soc/staff/switch/'


class SocStaffSwitchTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user(username='sw_staff', password='x')
        self.staff.is_staff = True
        self.staff.save(update_fields=['is_staff'])
        self.plain = User.objects.create_user(username='sw_plain', password='x')
        owner = User.objects.create_user(username='sw_owner', password='x')
        self.target = CoreTenant.objects.create(
            tenant_code='sw_target', display_name='Sw Target',
            owner_user=owner, status=CoreTenant.StatusChoices.ACTIVE)
        self.hook = TenantWebhookConfig.objects.create(
            tenant=self.target, url='https://example.com/hook')
        self.staff_client = APIClient()
        self.staff_client.force_authenticate(user=self.staff)
        self.plain_client = APIClient()
        self.plain_client.force_authenticate(user=self.plain)

    def _issue(self, tenant_id=None, reason='ho tro khach hang'):
        return self.staff_client.post(
            SWITCH, {'tenant_id': tenant_id or self.target.public_id,
                     'reason': reason}, format='json')

    def test_non_staff_forbidden(self):
        resp = self.plain_client.post(
            SWITCH, {'tenant_id': self.target.public_id, 'reason': 'ho tro'},
            format='json')
        self.assertEqual(resp.status_code, 403)

    def test_issue_ok_and_audit(self):
        resp = self._issue()
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertIn('token', body)
        self.assertEqual(body['role'], 'viewer')
        self.assertEqual(body['tenant']['id'], self.target.public_id)
        audit = AuditEvent.objects.filter(
            resource_type='staff_switch',
            resource_id=self.target.public_id).latest('occurred_at')
        self.assertEqual(audit.metadata['reason'], 'ho tro khach hang')
        self.assertEqual(audit.actor_user_id, self.staff.id)

    def test_reason_too_short_rejected(self):
        self.assertEqual(self._issue(reason='abc').status_code, 400)

    def test_unknown_tenant_404(self):
        self.assertEqual(self._issue(tenant_id='nope').status_code, 404)

    def test_own_tenant_rejected(self):
        own = CoreTenant.objects.create(
            tenant_code='sw_own', display_name='Sw Own',
            owner_user=self.staff, status=CoreTenant.StatusChoices.ACTIVE)
        self.assertEqual(self._issue(tenant_id=own.public_id).status_code, 400)

    def test_switch_header_reads_target_and_blocks_write(self):
        token = self._issue().json()['token']
        client = APIClient()
        # Đăng nhập session thật để middleware thấy Django request.user
        # (force_authenticate chỉ set DRF user, middleware sẽ bỏ qua).
        self.assertTrue(client.login(username='sw_staff', password='x'))
        # Viewer được đọc usage của tenant target → 200 chứng minh switch đúng tenant.
        resp = client.get('/core/v1/partner/usage/api-calls/?group_by=status&days=1',
                          HTTP_X_STAFF_SWITCH=token)
        self.assertEqual(resp.status_code, 200)
        resp = client.patch(
            f'/core/v1/partner/webhooks/{self.hook.id}/',
            {'name': 'Hacked'}, format='json', HTTP_X_STAFF_SWITCH=token)
        self.assertEqual(resp.status_code, 403)

    def test_forged_token_rejected(self):
        client = APIClient()
        self.assertTrue(client.login(username='sw_staff', password='x'))
        resp = client.get('/core/v1/partner/tenant/',
                          HTTP_X_STAFF_SWITCH='forged-token')
        self.assertEqual(resp.status_code, 403)
