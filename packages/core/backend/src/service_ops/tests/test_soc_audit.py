"""R4 tests: SOC audit-events viewer cross-tenant (staff-only, read-only).

Chạy: python manage.py test service_ops.tests.test_soc_audit
"""
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from identity_access.models import CoreTenant
from ops_audit.models import AuditEvent
from service_ops.tests.envelope import unwrapped_json

BASE = '/api/soc/audit-events/'


def _event(**kw):
    defaults = {'actor_user_id': None, 'actor_label': 'staff',
                     'tenant_id': '', 'action': 'access', 'resource_type': 'core_user',
                     'resource_id': '1', 'metadata': {}}
    defaults.update(kw)
    return AuditEvent.objects.create(**defaults)


class SocAuditEventsTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user(username='aud_staff', password='x')
        self.staff.is_staff = True
        self.staff.save(update_fields=['is_staff'])
        # Staff CÓ tenant riêng — regression flaw endpoint cũ (bóp về 1 tenant).
        self.staff_tenant = CoreTenant.objects.create(
            tenant_code='aud_staff_t', display_name='Aud Staff T',
            owner_user=self.staff, status=CoreTenant.StatusChoices.ACTIVE)
        owner = User.objects.create_user(username='aud_owner', password='x')
        self.other_tenant = CoreTenant.objects.create(
            tenant_code='aud_other_t', display_name='Aud Other T',
            owner_user=owner, status=CoreTenant.StatusChoices.ACTIVE)
        _event(tenant_id=self.staff_tenant.public_id, action='access',
               resource_type='core_user', actor_label='staff')
        _event(tenant_id=self.other_tenant.public_id, action='update',
               resource_type='core_user', actor_label='staff')
        _event(tenant_id=self.other_tenant.public_id, action='update',
               resource_type='tenant', resource_id='x', actor_label='staff')
        self.staff_client = APIClient()
        self.staff_client.force_authenticate(user=self.staff)
        self.plain = User.objects.create_user(username='aud_plain', password='x')
        self.plain_client = APIClient()
        self.plain_client.force_authenticate(user=self.plain)

    def test_non_staff_forbidden(self):
        self.assertEqual(self.plain_client.get(BASE).status_code, 403)

    def test_staff_sees_multi_tenant(self):
        body = unwrapped_json(self.staff_client.get(BASE))
        self.assertEqual(body['count'], 3)
        tenant_ids = {r['tenant_id'] for r in body['results']}
        self.assertIn(self.staff_tenant.public_id, tenant_ids)
        self.assertIn(self.other_tenant.public_id, tenant_ids)

    def test_filters(self):
        body = unwrapped_json(self.staff_client.get(
            f'{BASE}?tenant_id={self.other_tenant.public_id}'))
        self.assertEqual(body['count'], 2)
        body = unwrapped_json(self.staff_client.get(f'{BASE}?action=update'))
        self.assertEqual(body['count'], 2)
        body = unwrapped_json(self.staff_client.get(f'{BASE}?resource_type=tenant'))
        self.assertEqual(body['count'], 1)
        resp = self.staff_client.get(f'{BASE}?action=nope')
        self.assertEqual(resp.status_code, 400)

    def test_pagination(self):
        body = unwrapped_json(self.staff_client.get(f'{BASE}?page=2&page_size=2'))
        self.assertEqual(body['count'], 3)
        self.assertEqual(len(body['results']), 1)

    def test_csv_export(self):
        resp = self.staff_client.get(f'{BASE}?download=csv&action=update')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('text/csv', resp['Content-Type'])
        content = b''.join(resp.streaming_content).decode('utf-8')
        lines = content.strip().splitlines()
        self.assertTrue(lines[0].startswith('event_id,'))
        self.assertEqual(len(lines), 3)  # header + 2 update
        self.assertNotIn('secret', content.lower())
