import os
import sys

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

from advertising.models import TrademarkConfig
from identity_access.views.helpers import _build_abilities
from identity_access.models import CoreTenant


class TrademarkConfigEndpointTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(username='tm-owner', password='testpass123')
        self.tenant = CoreTenant.objects.create(
            owner_user=self.owner,
            tenant_code='tm-tenant',
            display_name='TM Tenant',
            plan=CoreTenant.PlanChoices.INTERNAL,
            status=CoreTenant.StatusChoices.ACTIVE,
        )
        self.admin = User.objects.create_superuser(username='tm-admin', email='a@b.co', password='testpass123')

    def test_widget_config_is_public_and_returns_trademark(self):
        response = self.client.get('/core/v1/widget/config/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('trademark', response.data)
        self.assertEqual(response.data['trademark']['version'], 'cfg_v1')
        self.assertFalse(response.data['trademark']['enabled'])

    def test_trademark_patch_requires_admin(self):
        response = self.client.patch(
            '/core/v1/widget/config/',
            {'enabled': True},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_admin_can_update_trademark_config(self):
        self.client.force_authenticate(user=self.admin)
        activation_ts = int(timezone.now().timestamp() * 1000)
        response = self.client.patch(
            '/core/v1/widget/config/',
            {'enabled': True, 'activation_ts': activation_ts},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['trademark']['enabled'])
        self.assertEqual(response.data['trademark']['activationTs'], activation_ts)

        config = TrademarkConfig.get_config()
        self.assertTrue(config.enabled)
        self.assertEqual(config.activation_ts, activation_ts)

    def test_non_admin_cannot_update_trademark_config(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.patch(
            '/core/v1/widget/config/',
            {'enabled': True},
            format='json',
        )
        self.assertIn(response.status_code, (status.HTTP_403_FORBIDDEN, status.HTTP_401_UNAUTHORIZED))


class TrademarkCaslAbilityTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='casl-owner', password='testpass123')
        self.admin = User.objects.create_superuser(username='casl-admin', email='a@b.co', password='x')
        self.tenant = CoreTenant.objects.create(
            owner_user=self.owner,
            tenant_code='casl-tenant',
            display_name='Casl Tenant',
            plan=CoreTenant.PlanChoices.INTERNAL,
            status=CoreTenant.StatusChoices.ACTIVE,
        )

    def test_staff_receives_trademark_abilities(self):
        abilities = _build_abilities(self.admin, self.tenant)
        subjects = {(a['action'], a['subject']) for a in abilities}
        self.assertIn(('read', 'Advertising'), subjects)
        self.assertIn(('manage', 'AdCampaign'), subjects)
        self.assertIn(('update', 'TrademarkConfig'), subjects)

    def test_regular_user_lacks_trademark_abilities(self):
        # Regular (non-staff) user on a non-internal plan must NOT receive
        # the advertising/trademark abilities. Use a distinct owner user to
        # respect CoreTenant's unique owner_user constraint.
        free_owner = User.objects.create_user(username='casl-free-owner', password='x')
        free_tenant = CoreTenant.objects.create(
            owner_user=free_owner,
            tenant_code='casl-free',
            display_name='Casl Free',
            plan=CoreTenant.PlanChoices.FREE,
            status=CoreTenant.StatusChoices.ACTIVE,
        )
        abilities = _build_abilities(free_owner, free_tenant)
        subjects = {(a['action'], a['subject']) for a in abilities}
        self.assertNotIn(('update', 'TrademarkConfig'), subjects)
        self.assertNotIn(('read', 'Advertising'), subjects)
