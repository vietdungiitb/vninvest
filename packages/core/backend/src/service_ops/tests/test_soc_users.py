"""A2 tests: SOC quản trị users (staff-only, audit, guards, N+1).

Chạy: python manage.py test service_ops.tests.test_soc_users
"""
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from identity_access.models import CoreTenant, TenantMember
from ops_audit.models import AuditEvent
from service_ops.tests.envelope import unwrapped_json

BASE = '/api/soc/users'


class SocUsersTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user(username='soc_staff', password='x')
        self.staff.is_staff = True
        self.staff.save(update_fields=['is_staff'])
        self.plain = User.objects.create_user(
            username='soc_plain', email='p@test.com', password='x')
        self.pro_user = User.objects.create_user(
            username='soc_pro', email='pro@test.com', password='x',
            first_name='Pro', last_name='User')
        self.pro_tenant = CoreTenant.objects.create(
            public_id='soc-pro-uuid', tenant_code='soc_pro',
            display_name='Pro T', owner_user=self.pro_user,
            status=CoreTenant.StatusChoices.ACTIVE, plan=CoreTenant.PlanChoices.PRO)
        self.staff_client = APIClient()
        self.staff_client.force_authenticate(user=self.staff)
        self.plain_client = APIClient()
        self.plain_client.force_authenticate(user=self.plain)

    def test_non_staff_forbidden(self):
        resp = self.plain_client.get(f'{BASE}/')
        self.assertEqual(resp.status_code, 403)

    def test_staff_list_envelope(self):
        resp = self.staff_client.get(f'{BASE}/')
        self.assertEqual(resp.status_code, 200)
        body = unwrapped_json(resp)
        self.assertIn('count', body)
        self.assertIn('results', body)
        usernames = [r['username'] for r in body['results']]
        self.assertIn('soc_pro', usernames)

    def test_search_and_filters(self):
        resp = self.staff_client.get(f'{BASE}/?search=soc_pro')
        self.assertEqual(len(unwrapped_json(resp)['results']), 1)
        resp = self.staff_client.get(f'{BASE}/?plan=pro')
        self.assertTrue(all(r['tenant'] and r['tenant']['plan'] == 'pro'
                            for r in unwrapped_json(resp)['results']))
        resp = self.staff_client.get(f'{BASE}/?status=none')
        self.assertTrue(all(r['tenant'] is None for r in unwrapped_json(resp)['results']))
        resp = self.staff_client.get(f'{BASE}/?is_staff=true')
        self.assertTrue(all(r['is_staff'] for r in unwrapped_json(resp)['results']))

    def test_set_active_lock_unlock_with_audit(self):
        resp = self.staff_client.post(
            f'{BASE}/{self.pro_user.id}/set-active/',
            {'is_active': False, 'reason': 'vi phạm chính sách'}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(unwrapped_json(resp)['is_active'])
        self.pro_user.refresh_from_db()
        self.assertFalse(self.pro_user.is_active)
        audit = AuditEvent.objects.filter(
            resource_type='core_user', resource_id=str(self.pro_user.id)).latest('occurred_at')
        self.assertEqual(audit.metadata['reason'], 'vi phạm chính sách')
        self.assertEqual(audit.actor_user_id, self.staff.id)
        resp = self.staff_client.post(
            f'{BASE}/{self.pro_user.id}/set-active/',
            {'is_active': True, 'reason': 'mở lại sau kiểm tra'}, format='json')
        self.assertEqual(resp.status_code, 200)

    def test_self_lock_and_missing_reason_rejected(self):
        resp = self.staff_client.post(
            f'{BASE}/{self.staff.id}/set-active/',
            {'is_active': False, 'reason': 'tự khóa'}, format='json')
        self.assertEqual(resp.status_code, 400)
        resp = self.staff_client.post(
            f'{BASE}/{self.pro_user.id}/set-active/',
            {'is_active': False, 'reason': 'x'}, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_cannot_lock_superuser_as_staff(self):
        sup = User.objects.create_user(username='soc_sup', password='x')
        sup.is_superuser = True
        sup.save(update_fields=['is_superuser'])
        resp = self.staff_client.post(
            f'{BASE}/{sup.id}/set-active/',
            {'is_active': False, 'reason': 'thử khóa superuser'}, format='json')
        self.assertEqual(resp.status_code, 403)

    def test_set_plan_ok_and_errors(self):
        resp = self.staff_client.post(
            f'{BASE}/{self.pro_user.id}/set-plan/',
            {'plan': 'enterprise', 'reason': 'nâng gói'}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(unwrapped_json(resp)['plan'], 'enterprise')
        self.pro_tenant.refresh_from_db()
        self.assertEqual(self.pro_tenant.plan, 'enterprise')
        self.assertTrue(AuditEvent.objects.filter(
            resource_type='tenant', resource_id='soc_pro').exists())
        resp = self.staff_client.post(
            f'{BASE}/{self.pro_user.id}/set-plan/',
            {'plan': 'diamond', 'reason': 'sai'}, format='json')
        self.assertEqual(resp.status_code, 400)
        resp = self.staff_client.post(
            f'{BASE}/{self.plain.id}/set-plan/',
            {'plan': 'pro', 'reason': 'không tenant'}, format='json')
        self.assertEqual(resp.status_code, 404)

    def test_list_query_count_bounded(self):
        for i in range(30):
            u = User.objects.create_user(username=f'soc_u{i}', password='x')
            TenantMember.objects.create(
                tenant=self.pro_tenant, user=u, role=TenantMember.RoleChoices.VIEWER)
        # Hằng số, không tăng theo số rows: 2 bootstrap SOC + 1 count + 1 page users
        # + 1 tenants prefetch + 1 members prefetch + 1 member-tenant + 1 request-user
        # tenant + 1 ops_audit request-trace = 9.
        with self.assertNumQueries(9):
            resp = self.staff_client.get(f'{BASE}/?page_size=30')
            self.assertEqual(resp.status_code, 200)
