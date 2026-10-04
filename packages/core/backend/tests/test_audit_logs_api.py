"""Tests for Partner Audit Logs API."""

import os
import sys
from datetime import timedelta

# Set required environment variables BEFORE importing Django settings
os.environ.setdefault('DJANGO_DEBUG', 'true')
os.environ.setdefault('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1,testserver')
os.environ.setdefault('CORE_PAT_PEPPER', 'test-pat-pepper-for-testing-only')
os.environ.setdefault('DJANGO_SECRET_KEY', 'test-secret-key-for-testing-only')

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from identity_access.models import CoreTenant, CoreServiceAccount, TenantMember
from tenant_lifecycle.models import TenantLifecycleEvent


class PartnerAuditLogsAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create owner user and tenant
        self.owner = User.objects.create_user(
            username='owner',
            email='owner@example.com',
            password='testpass123',
        )
        self.tenant = CoreTenant.objects.create(
            owner_user=self.owner,
            tenant_code='test-tenant-1',
            display_name='Test Tenant',
            plan=CoreTenant.PlanChoices.FREE,
            status=CoreTenant.StatusChoices.ACTIVE,
        )

        # Create a service account and PAT for authentication
        self.service_account = CoreServiceAccount.objects.create(
            tenant=self.tenant,
            name='Test Service Account',
            status=CoreServiceAccount.StatusChoices.ACTIVE,
            scopes=['manage_tenant', 'manage_service_accounts', 'manage_pats'],
        )
        self.pat_credential, self.raw_pat = CoreServiceAccount.objects.get(
            public_id=self.service_account.public_id
        ).pat_credentials.model.issue_for_service_account(
            service_account=self.service_account,
            scopes=['manage_tenant'],
            label='test-pat',
            audit_reason='test',
        )
        # Actually issue the PAT
        from identity_access.models import CorePATCredential
        self.pat_credential, self.raw_pat = CorePATCredential.issue_for_service_account(
            service_account=self.service_account,
            scopes=['manage_tenant'],
            label='test-pat',
            audit_reason='test',
        )

        # Create member user
        self.member_user = User.objects.create_user(
            username='member',
            email='member@example.com',
            password='testpass123',
        )
        self.member = TenantMember.objects.create(
            tenant=self.tenant,
            user=self.member_user,
            role=TenantMember.RoleChoices.EDITOR,
            invited_by=self.owner,
        )

        # Create another tenant for cross-tenant tests
        self.other_owner = User.objects.create_user(
            username='other_owner',
            email='other_owner@example.com',
            password='testpass123',
        )
        self.other_tenant = CoreTenant.objects.create(
            owner_user=self.other_owner,
            tenant_code='other-tenant-1',
            display_name='Other Tenant',
            plan=CoreTenant.PlanChoices.FREE,
            status=CoreTenant.StatusChoices.ACTIVE,
        )

        # Create some audit log events
        self.event1 = TenantLifecycleEvent.objects.create(
            tenant=self.tenant,
            event_type=TenantLifecycleEvent.EventType.MEMBER_INVITED,
            actor_type='api',
            actor_user=self.owner,
            new_value={'invited_email': 'new@example.com', 'role': 'editor'},
            ip_address='192.168.1.1',
        )
        self.event2 = TenantLifecycleEvent.objects.create(
            tenant=self.tenant,
            event_type=TenantLifecycleEvent.EventType.PAT_ROTATED,
            actor_type='api',
            actor_user=self.owner,
            old_value={'pat_id': 'old-pat-id'},
            new_value={'pat_id': 'new-pat-id'},
            ip_address='192.168.1.2',
        )
        self.event3 = TenantLifecycleEvent.objects.create(
            tenant=self.other_tenant,
            event_type=TenantLifecycleEvent.EventType.MEMBER_INVITED,
            actor_type='api',
            actor_user=self.other_owner,
            new_value={'invited_email': 'other@example.com', 'role': 'viewer'},
            ip_address='10.0.0.1',
        )

    def _authenticate_with_pat(self):
        """Set Authorization header with PAT token."""
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.raw_pat}')

    def _authenticate_with_session(self, user):
        """Use force_authenticate for session-based auth (if supported)."""
        self.client.force_authenticate(user=user)

    def test_list_audit_logs_returns_tenant_logs(self):
        """Test 1: Đọc lịch sử logs -> lọc đúng logs của tenant gọi API."""
        self._authenticate_with_pat()
        
        response = self.client.get('/core/v1/partner/audit-logs/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        
        # Should have pagination structure (CursorPagination format)
        self.assertIn('results', data)
        self.assertIn('next', data)
        self.assertIn('previous', data)
        
        # Should return logs for this tenant (3 events: tenant creation + 2 manual events)
        self.assertEqual(len(data['results']), 3)
        
        # Check event structure
        for event in data['results']:
            self.assertIn('event_type', event)
            self.assertIn('actor_username', event)
            self.assertIn('ip_address', event)
            self.assertIn('old_value', event)
            self.assertIn('new_value', event)
            self.assertIn('created_at', event)
            self.assertIn('metadata', event)
        
        # Check specific events
        event_types = [e['event_type'] for e in data['results']]
        self.assertIn('member_invited', event_types)
        self.assertIn('pat_rotated', event_types)
        # Also includes tenant creation event (status_changed since tenant is ACTIVE)
        self.assertIn('status_changed', event_types)

    def test_cross_tenant_access_returns_403(self):
        """Test 2: Thử đọc logs tenant khác -> 403 Forbidden."""
        self._authenticate_with_pat()
        
        # Try to access other tenant's logs by setting header
        response = self.client.get(
            '/core/v1/partner/audit-logs/',
            HTTP_X_TENANT_ID=self.other_tenant.public_id
        )
        
        # Should return 403 because owner is not a member of other_tenant
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        data = response.json()
        # A machine PAT bound to its issuing tenant is rejected by the dedicated
        # `pat_tenant_mismatch` branch (middleware.py), which is STRICTER than the
        # old path that fell through to `_resolve_tenant` and said
        # `tenant_not_found`. The security guarantee is the 403 above, which still
        # holds; only the machine-readable slug moved. Canonical assertion lives in
        # `src/identity_access/tests/test_pat_tenant_binding.py`.
        self.assertEqual(data['error'], 'pat_tenant_mismatch')

    def test_member_can_access_audit_logs(self):
        """Test: Member with appropriate role can access audit logs."""
        # Create a PAT for the member user
        member_sa = CoreServiceAccount.objects.create(
            tenant=self.tenant,
            name='Member Service Account',
            status=CoreServiceAccount.StatusChoices.ACTIVE,
            scopes=['manage_tenant'],
        )
        from identity_access.models import CorePATCredential
        member_pat, member_raw_pat = CorePATCredential.issue_for_service_account(
            service_account=member_sa,
            scopes=['manage_tenant'],
            label='member-test-pat',
            audit_reason='test',
        )
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {member_raw_pat}')
        
        response = self.client.get('/core/v1/partner/audit-logs/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        # Should see all 3 events (tenant creation + 2 manual events)
        self.assertEqual(len(data['results']), 3)

    def test_filter_by_event_type(self):
        """Test: Filter audit logs by event_type."""
        self._authenticate_with_pat()
        
        response = self.client.get('/core/v1/partner/audit-logs/?event_type=member_invited')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(len(data['results']), 1)
        self.assertEqual(data['results'][0]['event_type'], 'member_invited')

    def test_filter_by_start_date(self):
        """Test: Filter audit logs by start_date."""
        self._authenticate_with_pat()
        
        # Use tomorrow's date to filter out existing events
        tomorrow = (timezone.now() + timedelta(days=1)).date().isoformat()
        response = self.client.get(f'/core/v1/partner/audit-logs/?start_date={tomorrow}')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(len(data['results']), 0)

    def test_filter_by_end_date(self):
        """Test: Filter audit logs by end_date."""
        self._authenticate_with_pat()
        
        # Use yesterday's date to filter out existing events
        yesterday = (timezone.now() - timedelta(days=1)).date().isoformat()
        response = self.client.get(f'/core/v1/partner/audit-logs/?end_date={yesterday}')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(len(data['results']), 0)

    def test_filter_by_date_range(self):
        """Test: Filter audit logs by date range."""
        self._authenticate_with_pat()
        
        today = timezone.now().date().isoformat()
        response = self.client.get(f'/core/v1/partner/audit-logs/?start_date={today}&end_date={today}')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        # All 3 events should be from today
        self.assertEqual(len(data['results']), 3)

    def test_pagination_works(self):
        """Test: Pagination works with CoreCursorPagination."""
        self._authenticate_with_pat()
        
        response = self.client.get('/core/v1/partner/audit-logs/?page_size=1')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(len(data['results']), 1)
        self.assertIn('next', data)
        self.assertIn('previous', data)

    def test_unauthenticated_request_returns_401(self):
        """Test: Unauthenticated request returns 401."""
        response = self.client.get('/core/v1/partner/audit-logs/')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_suspended_tenant_cannot_access(self):
        """Test: Suspended tenant cannot access audit logs."""
        suspended_owner = User.objects.create_user(
            username='suspended_owner2',
            email='suspended_owner2@example.com',
            password='testpass123',
        )
        suspended_tenant = CoreTenant.objects.create(
            owner_user=suspended_owner,
            tenant_code='suspended-tenant-2',
            display_name='Suspended Tenant 2',
            plan=CoreTenant.PlanChoices.FREE,
            status=CoreTenant.StatusChoices.SUSPENDED,
        )
        
        # Create PAT for suspended tenant
        suspended_sa = CoreServiceAccount.objects.create(
            tenant=suspended_tenant,
            name='Suspended SA',
            status=CoreServiceAccount.StatusChoices.ACTIVE,
            scopes=['manage_tenant'],
        )
        from identity_access.models import CorePATCredential
        suspended_pat, suspended_raw_pat = CorePATCredential.issue_for_service_account(
            service_account=suspended_sa,
            scopes=['manage_tenant'],
            label='suspended-test-pat',
            audit_reason='test',
        )
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {suspended_raw_pat}')
        response = self.client.get('/core/v1/partner/audit-logs/')
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        data = response.json()
        self.assertEqual(data['error'], 'tenant_suspended')

    def test_event_structure_has_required_fields(self):
        """Test: Each event has all required fields."""
        self._authenticate_with_pat()
        
        response = self.client.get('/core/v1/partner/audit-logs/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        
        self.assertGreater(len(data['results']), 0)
        event = data['results'][0]
        required_fields = ['id', 'event_type', 'actor_type', 'actor_username', 
                          'ip_address', 'old_value', 'new_value', 'metadata', 'created_at']
        for field in required_fields:
            self.assertIn(field, event, f"Missing field: {field}")

    def test_actor_username_populated(self):
        """Test: actor_username is populated from actor_user."""
        self._authenticate_with_pat()
        
        response = self.client.get('/core/v1/partner/audit-logs/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        
        # Check that events with actor_user have correct username
        # The tenant creation event has actor_type='system' and actor_user=None
        for event in data['results']:
            if event['actor_type'] == 'api' and event.get('actor_user') is not None:
                self.assertEqual(event['actor_username'], 'owner')
            elif event['actor_type'] == 'system':
                self.assertEqual(event['actor_username'], 'system')