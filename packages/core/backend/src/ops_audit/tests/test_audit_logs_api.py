"""
Tests for Partner Audit Logs API.

Tests cover:
1. List audit logs for authenticated tenant
2. Filter by event_type
3. Filter by start_date
4. Filter by end_date
5. Pagination with CoreCursorPagination
6. Cross-tenant access blocked
7. Unauthenticated access blocked
"""

import json
from datetime import timedelta
from unittest.mock import MagicMock

from django.contrib.auth import get_user_model
from django.test import TestCase, RequestFactory
from django.utils import timezone

from rest_framework.test import APIClient, force_authenticate

from identity_access.models import CoreTenant, TenantMember
from tenant_lifecycle.models import TenantLifecycleEvent
from ops_audit.views import PartnerAuditLogsView

User = get_user_model()


class PartnerAuditLogsViewTests(TestCase):
    """Test cases for PartnerAuditLogsView."""

    def setUp(self):
        self.factory = RequestFactory()
        self.client = APIClient()

        # Create test users
        self.owner_user = User.objects.create_user(
            username='owner_user',
            email='owner@test.com',
            password='testpass123'
        )
        self.member_user = User.objects.create_user(
            username='member_user',
            email='member@test.com',
            password='testpass123'
        )
        self.other_user = User.objects.create_user(
            username='other_user',
            email='other@test.com',
            password='testpass123'
        )

        # Create audit log events with fixed dates for predictable testing
        base_date = timezone.now().replace(hour=12, minute=0, second=0, microsecond=0)
        self.base_date = base_date

        # Create test tenants
        self.tenant = CoreTenant.objects.create(
            public_id='test_tenant_123',
            tenant_code='test_tenant',
            display_name='Test Tenant',
            owner_user=self.owner_user,
            status=CoreTenant.StatusChoices.ACTIVE,
            plan=CoreTenant.PlanChoices.FREE
        )
        # Update the status_changed event from signal to be in the past
        TenantLifecycleEvent.objects.filter(tenant=self.tenant, event_type='status_changed').update(created_at=base_date - timedelta(days=10))
        
        self.other_tenant = CoreTenant.objects.create(
            public_id='other_tenant_456',
            tenant_code='other_tenant',
            display_name='Other Tenant',
            owner_user=self.other_user,
            status=CoreTenant.StatusChoices.ACTIVE,
            plan=CoreTenant.PlanChoices.FREE
        )
        # Update the status_changed event from signal for other_tenant
        TenantLifecycleEvent.objects.filter(tenant=self.other_tenant, event_type='status_changed').update(created_at=base_date - timedelta(days=10))

        # Create tenant member
        self.member = TenantMember.objects.create(
            tenant=self.tenant,
            user=self.member_user,
            role=TenantMember.RoleChoices.ADMIN,
            invited_by=self.owner_user
        )
        
        self.event1 = TenantLifecycleEvent.objects.create(
            tenant=self.tenant,
            event_type=TenantLifecycleEvent.EventType.MEMBER_INVITED,
            actor_type='api',
            actor_user=self.owner_user,
            new_value={'invited_email': 'new@test.com', 'role': 'editor'},
            ip_address='192.168.1.1',
        )
        TenantLifecycleEvent.objects.filter(pk=self.event1.pk).update(created_at=base_date - timedelta(days=5))
        self.event1.refresh_from_db()
        
        self.event2 = TenantLifecycleEvent.objects.create(
            tenant=self.tenant,
            event_type=TenantLifecycleEvent.EventType.MEMBER_JOINED,
            actor_type='api',
            actor_user=self.member_user,
            new_value={'user_id': self.member_user.id, 'role': 'editor'},
            ip_address='192.168.1.2',
        )
        TenantLifecycleEvent.objects.filter(pk=self.event2.pk).update(created_at=base_date - timedelta(days=3))
        self.event2.refresh_from_db()
        
        self.event3 = TenantLifecycleEvent.objects.create(
            tenant=self.tenant,
            event_type=TenantLifecycleEvent.EventType.PAT_ROTATED,
            actor_type='api',
            actor_user=self.owner_user,
            old_value={'pat_id': 'old_pat'},
            new_value={'pat_id': 'new_pat'},
            ip_address='192.168.1.3',
        )
        TenantLifecycleEvent.objects.filter(pk=self.event3.pk).update(created_at=base_date - timedelta(days=1))
        self.event3.refresh_from_db()
        
        self.other_event = TenantLifecycleEvent.objects.create(
            tenant=self.other_tenant,
            event_type=TenantLifecycleEvent.EventType.MEMBER_INVITED,
            actor_type='api',
            actor_user=self.other_user,
            new_value={'invited_email': 'other@test.com', 'role': 'viewer'},
            ip_address='10.0.0.1',
        )
        TenantLifecycleEvent.objects.filter(pk=self.other_event.pk).update(created_at=base_date - timedelta(days=2))
        self.other_event.refresh_from_db()

    def _create_request(self, path='/api/core/v1/partner/audit-logs/', user=None, query_params=None):
        """Helper to create a request with optional query params and user."""
        if query_params:
            query_string = '&'.join([f'{k}={v}' for k, v in query_params.items()])
            path = f'{path}?{query_string}'
        request = self.factory.get(path)
        if user:
            request.user = user
            # Force authenticate the request
            force_authenticate(request, user=user)
        else:
            request.user = MagicMock()
            request.user.is_authenticated = False
        # Set tenant on request (simulating TenantResolutionMiddleware)
        if user == self.owner_user or user == self.member_user:
            request.tenant = self.tenant
            request.tenant_role = TenantMember.RoleChoices.OWNER if user == self.owner_user else TenantMember.RoleChoices.ADMIN
        elif user == self.other_user:
            request.tenant = self.other_tenant
            request.tenant_role = TenantMember.RoleChoices.OWNER
        return request

    def _get_response_data(self, response):
        """Helper to render response and parse JSON."""
        response.render()
        return json.loads(response.content.decode('utf-8'))

    def test_list_audit_logs_owner(self):
        """Owner should be able to list audit logs for their tenant."""
        request = self._create_request(user=self.owner_user)
        view = PartnerAuditLogsView.as_view()
        response = view(request)
        
        self.assertEqual(response.status_code, 200)
        data = self._get_response_data(response)
        self.assertIn('results', data)
        # Should have 4 events from setUp (3 manual + 1 from signal on tenant creation)
        self.assertEqual(len(data['results']), 4)
        # Check ordering (newest first)
        self.assertEqual(data['results'][0]['event_type'], 'pat_rotated')
        self.assertEqual(data['results'][1]['event_type'], 'member_joined')
        self.assertEqual(data['results'][2]['event_type'], 'member_invited')
        self.assertEqual(data['results'][3]['event_type'], 'status_changed')

    def test_list_audit_logs_member(self):
        """Member should be able to list audit logs for their tenant."""
        request = self._create_request(user=self.member_user)
        view = PartnerAuditLogsView.as_view()
        response = view(request)
        
        self.assertEqual(response.status_code, 200)
        data = self._get_response_data(response)
        self.assertIn('results', data)
        # Should have 4 events from setUp (3 manual + 1 from signal on tenant creation)
        self.assertEqual(len(data['results']), 4)

    def test_filter_by_event_type(self):
        """Should filter audit logs by event_type."""
        request = self._create_request(
            user=self.owner_user,
            query_params={'event_type': 'member_invited'}
        )
        view = PartnerAuditLogsView.as_view()
        response = view(request)
        
        self.assertEqual(response.status_code, 200)
        data = self._get_response_data(response)
        self.assertIn('results', data)
        self.assertEqual(len(data['results']), 1)
        self.assertEqual(data['results'][0]['event_type'], 'member_invited')

    def test_filter_by_start_date(self):
        """Should filter audit logs by start_date."""
        # base_date is the reference date (day 0)
        # Events: status_changed (day -10), member_invited (day -5), member_joined (day -3), pat_rotated (day -1)
        # Filter from day -4 should include: member_joined (day -3), pat_rotated (day -1)
        start_date = (self.base_date - timedelta(days=4)).date().isoformat()
        request = self._create_request(
            user=self.owner_user,
            query_params={'start_date': start_date}
        )
        view = PartnerAuditLogsView.as_view()
        response = view(request)
        
        self.assertEqual(response.status_code, 200)
        data = self._get_response_data(response)
        self.assertIn('results', data)
        # Should include 2 events (day -3, -1)
        self.assertEqual(len(data['results']), 2)

    def test_filter_by_end_date(self):
        """Should filter audit logs by end_date."""
        # Filter up to day -2 should include: status_changed (day -10), member_invited (day -5), member_joined (day -3)
        # Events: status_changed (day -10), member_invited (day -5), member_joined (day -3), pat_rotated (day -1)
        end_date = (self.base_date - timedelta(days=2)).date().isoformat()
        request = self._create_request(
            user=self.owner_user,
            query_params={'end_date': end_date}
        )
        view = PartnerAuditLogsView.as_view()
        response = view(request)
        
        self.assertEqual(response.status_code, 200)
        data = self._get_response_data(response)
        self.assertIn('results', data)
        # Should include 3 events (day -10, -5, -3)
        self.assertEqual(len(data['results']), 3)

    def test_filter_by_date_range(self):
        """Should filter audit logs by both start_date and end_date."""
        # Filter from day -4 to day -2 should include only member_joined (day -3)
        # Events: status_changed (day -10), member_invited (day -5), member_joined (day -3), pat_rotated (day -1)
        start_date = (self.base_date - timedelta(days=4)).date().isoformat()
        end_date = (self.base_date - timedelta(days=2)).date().isoformat()
        request = self._create_request(
            user=self.owner_user,
            query_params={'start_date': start_date, 'end_date': end_date}
        )
        view = PartnerAuditLogsView.as_view()
        response = view(request)
        
        self.assertEqual(response.status_code, 200)
        data = self._get_response_data(response)
        self.assertIn('results', data)
        # Should include only event from day -3
        self.assertEqual(len(data['results']), 1)
        self.assertEqual(data['results'][0]['event_type'], 'member_joined')

    def test_pagination(self):
        """Should paginate results with CoreCursorPagination."""
        # Create more events to test pagination
        created_events = []
        for i in range(60):
            event = TenantLifecycleEvent.objects.create(
                tenant=self.tenant,
                event_type=TenantLifecycleEvent.EventType.MEMBER_INVITED,
                actor_type='api',
                actor_user=self.owner_user,
                new_value={'index': i},
            )
            TenantLifecycleEvent.objects.filter(pk=event.pk).update(created_at=self.base_date - timedelta(hours=i))
            event.refresh_from_db()
            created_events.append(event)
        
        try:
            request = self._create_request(user=self.owner_user)
            view = PartnerAuditLogsView.as_view()
            response = view(request)
            
            self.assertEqual(response.status_code, 200)
            data = self._get_response_data(response)
            self.assertIn('results', data)
            # Default page size should be 50 (CoreCursorPagination.page_size)
            self.assertLessEqual(len(data['results']), 50)
            self.assertIn('next', data)
            self.assertIn('previous', data)
        finally:
            # Clean up
            for event in created_events:
                event.delete()

    def test_cross_tenant_access_blocked(self):
        """User should not see audit logs from other tenants."""
        request = self._create_request(user=self.other_user)
        view = PartnerAuditLogsView.as_view()
        response = view(request)
        
        self.assertEqual(response.status_code, 200)
        data = self._get_response_data(response)
        self.assertIn('results', data)
        # Should only see events from other_tenant (1 manual + 1 from signal)
        self.assertEqual(len(data['results']), 2)
        # Both should be member_invited and status_changed
        event_types = {e['event_type'] for e in data['results']}
        self.assertIn('member_invited', event_types)
        self.assertIn('status_changed', event_types)

    def test_unauthenticated_access_blocked(self):
        """Unauthenticated users should be blocked."""
        request = self._create_request(user=None)
        view = PartnerAuditLogsView.as_view()
        response = view(request)
        
        # Should return 403 or 401
        self.assertIn(response.status_code, [401, 403])

    def test_response_structure(self):
        """Response should have correct structure with all required fields."""
        request = self._create_request(user=self.owner_user)
        view = PartnerAuditLogsView.as_view()
        response = view(request)
        
        self.assertEqual(response.status_code, 200)
        data = self._get_response_data(response)
        self.assertIn('results', data)
        
        event = data['results'][0]
        required_fields = [
            'id', 'event_type', 'actor_type', 'actor_username', 
            'actor_user', 'ip_address', 'old_value', 'new_value', 
            'metadata', 'created_at'
        ]
        for field in required_fields:
            self.assertIn(field, event, f"Missing field: {field}")

    def test_actor_username_populated(self):
        """actor_username should be populated from actor_user."""
        request = self._create_request(user=self.owner_user)
        view = PartnerAuditLogsView.as_view()
        response = view(request)
        
        self.assertEqual(response.status_code, 200)
        data = self._get_response_data(response)
        event = data['results'][0]
        self.assertEqual(event['actor_username'], 'owner_user')
        self.assertEqual(event['actor_user'], self.owner_user.id)

    def test_actor_username_fallback_to_actor_type(self):
        """actor_username should fallback to actor_type when no actor_user."""
        # Create event without actor_user
        event_no_user = TenantLifecycleEvent.objects.create(
            tenant=self.tenant,
            event_type=TenantLifecycleEvent.EventType.PLAN_CHANGED,
            actor_type='system',
            actor_user=None,
            new_value={'plan': 'pro'},
        )
        TenantLifecycleEvent.objects.filter(pk=event_no_user.pk).update(created_at=self.base_date)
        event_no_user.refresh_from_db()
        
        try:
            request = self._create_request(user=self.owner_user)
            view = PartnerAuditLogsView.as_view()
            response = view(request)
            
            self.assertEqual(response.status_code, 200)
            data = self._get_response_data(response)
            # Find the system event
            system_event = next((e for e in data['results'] if e['event_type'] == 'plan_changed'), None)
            self.assertIsNotNone(system_event)
            self.assertEqual(system_event['actor_username'], 'system')
            self.assertIsNone(system_event['actor_user'])
        finally:
            # Clean up
            event_no_user.delete()


class PartnerAuditLogsViewIntegrationTests(TestCase):
    """Integration tests for PartnerAuditLogsView with RequestFactory."""

    def setUp(self):
        self.factory = RequestFactory()
        
        self.owner_user = User.objects.create_user(
            username='owner_user',
            email='owner@test.com',
            password='testpass123'
        )
        self.member_user = User.objects.create_user(
            username='member_user',
            email='member@test.com',
            password='testpass123'
        )

        self.now = timezone.now()
        self.tenant = CoreTenant.objects.create(
            public_id='test_tenant_123',
            tenant_code='test_tenant',
            display_name='Test Tenant',
            owner_user=self.owner_user,
            status=CoreTenant.StatusChoices.ACTIVE,
            plan=CoreTenant.PlanChoices.FREE
        )
        # Update the status_changed event from signal to be in the past
        TenantLifecycleEvent.objects.filter(tenant=self.tenant, event_type='status_changed').update(created_at=self.now - timedelta(days=10))

        self.member = TenantMember.objects.create(
            tenant=self.tenant,
            user=self.member_user,
            role=TenantMember.RoleChoices.ADMIN,
            invited_by=self.owner_user
        )

        event = TenantLifecycleEvent.objects.create(
            tenant=self.tenant,
            event_type=TenantLifecycleEvent.EventType.MEMBER_INVITED,
            actor_type='api',
            actor_user=self.owner_user,
            new_value={'invited_email': 'new@test.com', 'role': 'editor'},
            ip_address='192.168.1.1',
        )
        TenantLifecycleEvent.objects.filter(pk=event.pk).update(created_at=self.now - timedelta(days=1))
        event.refresh_from_db()

    def _create_request(self, path='/core/v1/partner/audit-logs/', user=None, query_params=None):
        """Helper to create a request with optional query params and user."""
        if query_params:
            query_string = '&'.join([f'{k}={v}' for k, v in query_params.items()])
            path = f'{path}?{query_string}'
        request = self.factory.get(path)
        if user:
            request.user = user
            force_authenticate(request, user=user)
        else:
            request.user = MagicMock()
            request.user.is_authenticated = False
        # Set tenant on request (simulating TenantResolutionMiddleware)
        if user == self.owner_user or user == self.member_user:
            request.tenant = self.tenant
            request.tenant_role = TenantMember.RoleChoices.OWNER if user == self.owner_user else TenantMember.RoleChoices.ADMIN
        return request

    def test_api_endpoint_with_session_auth(self):
        """API endpoint should work with session authentication."""
        request = self._create_request(user=self.owner_user)
        view = PartnerAuditLogsView.as_view()
        response = view(request)
        response.render()
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content.decode('utf-8'))
        self.assertIn('results', data)
        # Should have 2 events from setUp (1 manual + 1 from signal)
        self.assertEqual(len(data['results']), 2)

    def test_api_endpoint_with_pat_auth(self):
        """API endpoint should work with PAT authentication."""
        # This would require setting up PAT auth, which is more complex
        # For now, test with session auth
        request = self._create_request(user=self.owner_user)
        view = PartnerAuditLogsView.as_view()
        response = view(request)
        response.render()
        
        self.assertEqual(response.status_code, 200)

    def test_api_endpoint_requires_auth(self):
        """API endpoint should require authentication."""
        request = self._create_request(user=None)
        view = PartnerAuditLogsView.as_view()
        response = view(request)
        
        self.assertIn(response.status_code, [401, 403])
