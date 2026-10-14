"""Wave 0 B0.6 tests: GET /broker/capabilities/ + mo config ca 3 lane.

Chay TREN VPS STAGING theo runbook §12 (cam local):
  python manage.py test user_workspace.tests.test_broker_capabilities --noinput

Fail-before: truoc B0.6, GET /broker/capabilities/ tra 404 (route chua co);
ssi/tcbs chi co trang thai noi bo, khong co co `fully_supported` tren API.
"""
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from identity_access.models import CoreTenant
from user_workspace.broker.base import CAPABILITY_MATRIX_VERSION
from user_workspace.tests.envelope import unwrapped_json

BASE = '/core/v1/broker'


def _owner_client(username):
    user = User.objects.create_user(username=username, password='x')
    tenant = CoreTenant.objects.create(
        tenant_code=f't-{username}', display_name=username,
        owner_user=user, status=CoreTenant.StatusChoices.ACTIVE,
    )
    client = APIClient()
    client.force_login(user)
    client.defaults['HTTP_X_TENANT_ID'] = tenant.public_id
    return user, tenant, client


class BrokerCapabilitiesApiTests(TestCase):
    def setUp(self):
        self.user, self.tenant, self.client = _owner_client('broker-cap')

    def test_capabilities_version_matches_matrix(self):
        resp = self.client.get(f'{BASE}/capabilities/')
        self.assertEqual(resp.status_code, 200)
        body = unwrapped_json(resp)
        self.assertEqual(body['version'], CAPABILITY_MATRIX_VERSION)
        self.assertEqual(set(body['providers']), {'dnse', 'ssi', 'tcbs'})

    def test_only_dnse_verified_contract(self):
        body = unwrapped_json(self.client.get(f'{BASE}/capabilities/'))
        providers = body['providers']
        self.assertTrue(providers['dnse']['verified_contract'])
        self.assertFalse(providers['ssi']['verified_contract'])
        self.assertFalse(providers['tcbs']['verified_contract'])

    def test_providers_list_has_fully_supported_flag(self):
        body = unwrapped_json(self.client.get(f'{BASE}/providers/'))
        by_id = {p['id']: p for p in body['providers']}
        self.assertTrue(by_id['dnse']['fully_supported'])
        self.assertFalse(by_id['ssi']['fully_supported'])
        self.assertFalse(by_id['tcbs']['fully_supported'])

    def test_ssi_schema_open_no_not_supported_yet(self):
        # Hoi quy C-1: config/credential mo cho ca 3 lane da biet.
        resp = self.client.get(f'{BASE}/config-schema/ssi/')
        self.assertEqual(resp.status_code, 200)

    def test_ssi_save_config_open_no_not_supported_yet(self):
        resp = self.client.post(f'{BASE}/ssi/config/', {
            'api_key': 'AK', 'api_secret': 'AS',
            'client_id': 'C1', 'private_key': 'PK',
        })
        self.assertNotEqual(
            resp.status_code, 404,
            'ssi config khong duoc 404 not_supported_yet')
        if resp.status_code == 400:
            self.assertNotEqual(
                unwrapped_json(resp).get('code'), 'not_supported_yet')

    def test_unknown_provider_404(self):
        resp = self.client.get(f'{BASE}/config-schema/xyz/')
        self.assertEqual(resp.status_code, 404)
        self.assertEqual(
            unwrapped_json(resp).get('code'), 'broker_not_supported')
