"""Capability payload tests for the Service Operations Center menu."""

import json

from django.contrib.auth.models import User
from django.test import RequestFactory, TestCase

from ..models import CoreTenant
from ..views.helpers import _build_abilities, _build_navigation
from vninvest_core.views_health import capability_bootstrap


class ServiceOpsCenterCapabilityTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.user = User.objects.create_user(
            username='admin',
            email='admin@localhost',
            password='adminpass123',
            is_staff=True,
            is_superuser=True,
        )
        self.tenant = CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code='vni-internal',
            display_name='VNI Internal',
            plan=CoreTenant.PlanChoices.INTERNAL,
            status=CoreTenant.StatusChoices.ACTIVE,
        )

    def test_internal_admin_includes_service_ops_center_ability(self):
        abilities = _build_abilities(self.user, self.tenant)

        self.assertIn(
            {'action': 'read', 'subject': 'ServiceOpsCenter'},
            abilities,
        )
        self.assertIn(
            {'action': 'read', 'subject': 'TenantMemberAdmin'},
            abilities,
        )
        self.assertIn(
            {'action': 'create', 'subject': 'TenantMemberAdmin'},
            abilities,
        )
        self.assertIn(
            {'action': 'remove', 'subject': 'TenantMemberAdmin'},
            abilities,
        )
        self.assertIn(
            {'action': 'read', 'subject': 'TenantRoleAdmin'},
            abilities,
        )
        self.assertIn(
            {'action': 'manage', 'subject': 'TenantRoleAdmin'},
            abilities,
        )

    def test_internal_admin_navigation_includes_operations_center_route(self):
        navigation = _build_navigation(self.user, self.tenant)

        self.assertIn('operations-center', navigation['visible_routes'])
        self.assertNotIn('admin-ops', navigation['visible_routes'])

    def test_capability_bootstrap_includes_operations_center_route(self):
        response = capability_bootstrap(self.factory.get('/core/v1/capability-bootstrap'))
        payload = json.loads(response.content.decode('utf-8'))

        self.assertIn('operations-center', payload['navigation']['visible_routes'])
        self.assertNotIn('admin-ops', payload['navigation']['visible_routes'])
        self.assertTrue(payload['surfaces']['show_operations_center'])

    def test_menu_20260922_staff_navigation_covers_all_menu_paths(self):
        navigation = _build_navigation(self.user, self.tenant)

        for route in (
            'dashboard', 'watchlist', 'screener', 'support', 'settings', 'upgrade',
            'ai-advisory', 'whale-alerts', 'alert-center', 'transactions', 'portfolios',
            'operations-center', 'operations-center-mail-config', 'ai-command-center',
            'admin-crawl-control', 'tenant-admin', 'commercial-billing-center',
            'advertising-admin',
        ):
            self.assertIn(route, navigation['visible_routes'])
        self.assertIn('admin', navigation['visible_groups'])

    def test_menu_20260922_free_plan_navigation_is_limited(self):
        free_user = User.objects.create_user(
            username='freeuser',
            email='freeuser@localhost',
            password='freepass123',
        )
        free_tenant = CoreTenant.objects.create(
            owner_user=free_user,
            tenant_code='vni-free',
            display_name='VNI Free',
            plan=CoreTenant.PlanChoices.FREE,
            status=CoreTenant.StatusChoices.ACTIVE,
        )
        navigation = _build_navigation(free_user, free_tenant)

        for route in ('dashboard', 'watchlist', 'screener', 'support', 'settings', 'upgrade'):
            self.assertIn(route, navigation['visible_routes'])
        for route in (
            'ai-advisory', 'whale-alerts', 'alert-center', 'transactions', 'portfolios',
            'operations-center', 'admin-crawl-control', 'tenant-admin',
        ):
            self.assertNotIn(route, navigation['visible_routes'])
        self.assertNotIn('admin', navigation['visible_groups'])