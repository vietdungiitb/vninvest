"""B1.2 tests: broker config API (providers/schema/CRUD/test-connection/jobs) + alias cũ.

Chạy: python manage.py test user_workspace.test_broker_config_api
"""
import json
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from user_workspace.tests.envelope import unwrapped_json
from user_workspace.models import DNSECredential, UserBrokerConfig

BASE = '/core/v1/broker'
SECRET_ID = 'CID-TEST-001'
SECRET_SEC = 'CSEC-TEST-002'




def _tenant_client(username):
    """Client đã đăng nhập + tenant, đúng như một request thật (SAFE-04).

    `force_authenticate` chỉ gắn user lên DRF Request nên
    `TenantResolutionMiddleware` (tầng Django) không chạy và `request.tenant`
    không bao giờ được gán. Endpoint ghi broker kiểm tra quyền theo tenant
    (deny-by-default) nên fixture phải mô tả request CÓ THẬT — cùng cách
    `test_order_safety.py` và `test_analytics_tenant_matrix.py` làm.

    KHÔNG phải nới lỏng kiểm tra: nếu cho qua khi không có tenant thì quay về
    đúng lỗ hổng SAFE-04 sinh ra để đóng.
    """
    from identity_access.models import CoreTenant

    user = User.objects.create_user(username=username, password='x')
    tenant = CoreTenant.objects.create(
        tenant_code=f't-{username}', display_name=username,
        owner_user=user, status=CoreTenant.StatusChoices.ACTIVE,
    )
    client = APIClient()
    client.force_login(user)
    client.defaults['HTTP_X_TENANT_ID'] = tenant.public_id
    return user, tenant, client


class BrokerProvidersApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='bprov', password='x')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_providers_lists_all_three_supported(self):
        resp = self.client.get(f'{BASE}/providers/')
        self.assertEqual(resp.status_code, 200)
        by_id = {p['id']: p for p in unwrapped_json(resp)['providers']}
        self.assertEqual(set(by_id), {'dnse', 'ssi', 'tcbs'})
        self.assertEqual(by_id['ssi']['status'], 'never_connected')
        self.assertEqual(by_id['tcbs']['status'], 'never_connected')
        self.assertEqual(by_id['dnse']['status'], 'never_connected')

    def test_schema_dnse_shape(self):
        resp = self.client.get(f'{BASE}/config-schema/dnse/')
        self.assertEqual(resp.status_code, 200)
        fields = {f['key']: f for f in unwrapped_json(resp)['fields']}
        self.assertTrue(fields['client_id']['required'] and fields['client_id']['secret'])
        self.assertTrue(fields['client_secret']['required'] and fields['client_secret']['secret'])

    def test_schema_ssi_tcbs_shapes(self):
        for provider, required_key in (('ssi', 'api_key'), ('tcbs', 'api_key')):
            resp = self.client.get(f'{BASE}/config-schema/{provider}/')
            self.assertEqual(resp.status_code, 200, provider)
            fields = {f['key']: f for f in unwrapped_json(resp)['fields']}
            self.assertTrue(fields[required_key]['required'])
            self.assertTrue(fields[required_key]['secret'])

    def test_unknown_provider_404(self):
        resp = self.client.get(f'{BASE}/config-schema/xyz/')
        self.assertEqual(resp.status_code, 404)


class BrokerConfigCrudTests(TestCase):
    def setUp(self):
        self.user, self.tenant, self.client = _tenant_client('bcrud')

    def test_post_missing_field_400_per_field(self):
        resp = self.client.post(
            f'{BASE}/dnse/config/', {'client_id': '  '}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('client_secret', str(resp.content))

    def test_post_valid_masks_secret_and_fernet_db(self):
        resp = self.client.post(
            f'{BASE}/dnse/config/',
            {'client_id': SECRET_ID, 'client_secret': SECRET_SEC}, format='json')
        self.assertEqual(resp.status_code, 200)
        body = json.dumps(unwrapped_json(resp))
        self.assertNotIn(SECRET_ID, body)
        self.assertNotIn(SECRET_SEC, body)
        self.assertIn('****', body)
        cfg = UserBrokerConfig.objects.get(user=self.user, provider='dnse')
        self.assertNotIn(SECRET_ID, cfg.secrets_cipher)
        self.assertEqual(cfg.get_secrets()['client_id'], SECRET_ID)
        # mirror sang store cũ để tasks sync còn chạy (transitional)
        legacy = DNSECredential.objects.get(user=self.user)
        self.assertTrue(legacy.has_credentials())

    def test_post_ssi_valid_masks_and_stores(self):
        resp = self.client.post(
            f'{BASE}/ssi/config/',
            {'api_key': 'AK1', 'api_secret': 'AS1', 'client_id': 'C1'}, format='json')
        self.assertEqual(resp.status_code, 200)
        body = json.dumps(unwrapped_json(resp))
        self.assertNotIn('AK1', body)
        self.assertNotIn('AS1', body)
        cfg = UserBrokerConfig.objects.get(user=self.user, provider='ssi')
        self.assertEqual(cfg.get_secrets()['client_id'], 'C1')

    def test_post_ssi_missing_required_400(self):
        resp = self.client.post(
            f'{BASE}/ssi/config/', {'api_key': 'AK1'}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('api_secret', str(resp.content))

    def test_post_tcbs_valid(self):
        resp = self.client.post(
            f'{BASE}/tcbs/config/',
            {'api_key': 'TK1', 'custody_code': '105C123'}, format='json')
        self.assertEqual(resp.status_code, 200)
        cfg = UserBrokerConfig.objects.get(user=self.user, provider='tcbs')
        self.assertEqual(cfg.get_secrets()['custody_code'], '105C123')

    def test_get_and_delete(self):
        self.client.post(
            f'{BASE}/dnse/config/',
            {'client_id': SECRET_ID, 'client_secret': SECRET_SEC}, format='json')
        resp = self.client.get(f'{BASE}/dnse/config/')
        self.assertTrue(unwrapped_json(resp)['is_configured'])
        self.assertEqual(unwrapped_json(resp)['status'], 'never_connected')
        resp = self.client.delete(f'{BASE}/dnse/config/')
        self.assertEqual(resp.status_code, 200)
        resp = self.client.get(f'{BASE}/dnse/config/')
        self.assertFalse(unwrapped_json(resp)['is_configured'])

    def test_legacy_route_compat_shape(self):
        """Path cũ broker/dnse/config/ nay do view mới phục vụ (store UserBrokerConfig)."""
        resp = self.client.post(
            '/core/v1/broker/dnse/config/',
            {'client_id': 'LEGID', 'client_secret': 'LEGSEC'}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(unwrapped_json(resp)['ok'])
        self.assertIn('****', json.dumps(unwrapped_json(resp)))
        resp = self.client.get('/core/v1/broker/dnse/config/')
        self.assertTrue(unwrapped_json(resp)['is_configured'])
        self.assertIn('****', unwrapped_json(resp)['preview']['client_id'])
        self.assertTrue(UserBrokerConfig.objects.filter(
            user=self.user, provider='dnse').exists())


class BrokerTestConnectionTests(TestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()  # sqlite tái dùng id sau rollback → key rate-limit trùng giữa tests
        self.user, self.tenant, self.client = _tenant_client('btest')

    def test_requires_config_first(self):
        resp = self.client.post(f'{BASE}/dnse/test-connection/', {}, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_enqueue_returns_job_immediately(self):
        self.client.post(
            f'{BASE}/dnse/config/',
            {'client_id': SECRET_ID, 'client_secret': SECRET_SEC}, format='json')

        class FakeJob:
            id = 'job-123'

        with patch(
                'user_workspace.views_broker.test_broker_connection_task') as mock_task:
            mock_task.delay.return_value = FakeJob()
            resp = self.client.post(f'{BASE}/dnse/test-connection/', {}, format='json')
        self.assertEqual(resp.status_code, 202)
        self.assertEqual(unwrapped_json(resp)['job_id'], 'job-123')

    def test_rate_limit_sixth_rejected(self):
        self.client.post(
            f'{BASE}/dnse/config/',
            {'client_id': SECRET_ID, 'client_secret': SECRET_SEC}, format='json')

        class FakeJob:
            id = 'job-x'

        with patch(
                'user_workspace.views_broker.test_broker_connection_task') as mock_task:
            mock_task.delay.return_value = FakeJob()
            codes = [
                self.client.post(f'{BASE}/dnse/test-connection/', {}, format='json').status_code
                for _ in range(6)
            ]
        self.assertEqual(codes[:5], [202] * 5)
        self.assertEqual(codes[5], 429)

    def test_job_poll_unknown_pending(self):
        resp = self.client.get(f'{BASE}/jobs/00000000-0000-0000-0000-000000000000/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(unwrapped_json(resp)['state'], 'pending')


class BrokerConnectionTaskTests(TestCase):
    def test_task_marks_error_without_leaking_secret(self):
        user = User.objects.create_user(username='btask', password='x')
        from user_workspace.models import set_user_broker_secrets
        cfg = set_user_broker_secrets(
            user, 'dnse', {'client_id': 'BADID', 'client_secret': 'BADSEC'})
        from user_workspace.tasks import test_broker_connection_task
        with patch(
                'user_workspace.vnbroker_dnse_compat.build_dnse_client',
                side_effect=RuntimeError('upstream down')):
            result = test_broker_connection_task.run(cfg.id)
        self.assertFalse(result['ok'])
        cfg.refresh_from_db()
        self.assertEqual(cfg.status, 'error')
        self.assertNotIn('BADSEC', cfg.last_error)

    def test_task_ssi_success_marks_connected(self):
        import sys
        import types
        from unittest.mock import MagicMock
        user = User.objects.create_user(username='btaskssi', password='x')
        from user_workspace.models import set_user_broker_secrets
        cfg = set_user_broker_secrets(
            user, 'ssi', {'api_key': 'K', 'api_secret': 'S'})
        client = MagicMock()
        client.get_account_list.return_value = [{'account_no': '1'}]
        factory = MagicMock(return_value=client)
        saved = {}
        for name in ('vnbroker', 'vnbroker.broker', 'vnbroker.broker.ssi',
                     'vnbroker.broker.ssi.client'):
            saved[name] = sys.modules.get(name)
            mod = types.ModuleType(name)
            mod.__path__ = []
            sys.modules[name] = mod
        sys.modules['vnbroker.broker.ssi.client'].SSIBrokerClient = factory
        try:
            from user_workspace.tasks import test_broker_connection_task
            result = test_broker_connection_task.run(cfg.id)
        finally:
            for name, mod in saved.items():
                if mod is None:
                    sys.modules.pop(name, None)
                else:
                    sys.modules[name] = mod
        self.assertTrue(result['ok'])
        _, kwargs = factory.call_args
        self.assertEqual(kwargs.get('api_key'), 'K')
        self.assertEqual(kwargs.get('api_secret'), 'S')
        cfg.refresh_from_db()
        self.assertEqual(cfg.status, 'connected')
        self.assertIsNotNone(cfg.last_verified_at)

    def test_task_tcbs_unverified_not_error(self):
        import sys
        import types
        from unittest.mock import MagicMock
        user = User.objects.create_user(username='btasktcbs', password='x')
        from user_workspace.models import set_user_broker_secrets
        cfg = set_user_broker_secrets(user, 'tcbs', {'api_key': 'TK'})
        saved = {}
        for name in ('vnbroker', 'vnbroker.broker', 'vnbroker.broker.tcbs',
                     'vnbroker.broker.tcbs.client'):
            saved[name] = sys.modules.get(name)
            mod = types.ModuleType(name)
            mod.__path__ = []
            sys.modules[name] = mod
        sys.modules['vnbroker.broker.tcbs.client'].TCBSBrokerClient = MagicMock()
        try:
            from user_workspace.tasks import test_broker_connection_task
            result = test_broker_connection_task.run(cfg.id)
        finally:
            for name, mod in saved.items():
                if mod is None:
                    sys.modules.pop(name, None)
                else:
                    sys.modules[name] = mod
        self.assertFalse(result['ok'])
        self.assertTrue(result.get('unverified'))
        cfg.refresh_from_db()
        self.assertEqual(cfg.status, 'unverified')
        self.assertEqual(cfg.last_error, '')
