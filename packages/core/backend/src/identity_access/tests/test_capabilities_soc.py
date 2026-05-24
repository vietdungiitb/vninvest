"""Capability payload tests for the Service Operations Center menu."""

import json

from django.contrib.auth.models import User
from django.test import RequestFactory, TestCase

from ..models import CoreTenant
from ..views_auth import _build_abilities, _build_navigation
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