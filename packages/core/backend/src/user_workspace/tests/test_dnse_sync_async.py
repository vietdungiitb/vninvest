"""Wave 0 B0.5 tests: 3 view sync DNSE enqueue (.delay) + envelope loi.

BAY OOM (ghi lai de khong lap): job gia dung `SimpleNamespace`, KHONG
MagicMock. MagicMock trong response lam DRF JSONEncoder de quy vo han qua
attribute tu sinh (`mock.__new__` -> `_increment_mock_call` -> ...) — process
phinh toi 10-20GB roi OOM-kill (exit 137), chung minh bang faulthandler.
Quy tac: mock tra ve response chi chua kieu du lieu that (str/int/dict).


Chay TREN VPS STAGING theo runbook §12 (cam local):
  python manage.py test user_workspace.tests.test_dnse_sync_async --noinput

Fail-before: truoc B0.5, view goi task truc tiep (khong `.delay`) nen mock
`.delay` khong duoc goi; nhanh loi tra `Response` tho (sync-accounts).

Tat ca goi broker that deu duoc mock — khong credential, khong mang.
"""
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from identity_access.models import CoreTenant
from user_workspace.models import set_user_broker_secrets
from user_workspace.tests.envelope import unwrapped_json

BASE = '/core/v1/broker/dnse'


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


def _with_credential(user):
    set_user_broker_secrets(
        user, 'dnse', {'client_id': 'CID', 'client_secret': 'CSEC'})


class DnseSyncAsyncTests(TestCase):
    def setUp(self):
        self.user, self.tenant, self.client = _owner_client('dnseasync')

    def test_sync_accounts_enqueues_202(self):
        _with_credential(self.user)
        fake_job = SimpleNamespace(id='job-accounts-1')
        with patch(
            'user_workspace.views_dnse.sync_dnse_accounts_task'
        ) as task:
            task.delay.return_value = fake_job
            resp = self.client.post(f'{BASE}/sync-accounts/')
        self.assertEqual(resp.status_code, 202)
        task.delay.assert_called_once()
        body = unwrapped_json(resp)
        self.assertEqual(body['job_id'], 'job-accounts-1')
        self.assertEqual(body['state'], 'pending')

    def test_sync_accounts_no_credential_400_envelope(self):
        resp = self.client.post(f'{BASE}/sync-accounts/')
        self.assertEqual(resp.status_code, 400)
        body = unwrapped_json(resp)
        self.assertEqual(body.get('code'), 'validation_error')

    def test_sync_balances_enqueues_202(self):
        _with_credential(self.user)
        fake_job = SimpleNamespace(id='job-balances-1')
        with patch(
            'user_workspace.views_dnse.sync_dnse_balances_task'
        ) as task:
            task.delay.return_value = fake_job
            resp = self.client.post(f'{BASE}/sync-balances/')
        self.assertEqual(resp.status_code, 202)
        task.delay.assert_called_once()
        self.assertEqual(unwrapped_json(resp)['job_id'], 'job-balances-1')

    def test_reconcile_enqueues_with_days_back(self):
        _with_credential(self.user)
        fake_job = SimpleNamespace(id='job-reconcile-1')
        with patch(
            'user_workspace.views_dnse.reconcile_dnse_transactions_task'
        ) as task:
            task.delay.return_value = fake_job
            resp = self.client.post(
                f'{BASE}/reconcile-transactions/', {'days_back': 30})
        self.assertEqual(resp.status_code, 202)
        _, kwargs = task.delay.call_args
        self.assertEqual(kwargs.get('days_back'), 30)

    def test_reconcile_days_back_clamped(self):
        _with_credential(self.user)
        fake_job = SimpleNamespace(id='job-reconcile-2')
        with patch(
            'user_workspace.views_dnse.reconcile_dnse_transactions_task'
        ) as task:
            task.delay.return_value = fake_job
            resp = self.client.post(
                f'{BASE}/reconcile-transactions/', {'days_back': 9999})
        self.assertEqual(resp.status_code, 202)
        _, kwargs = task.delay.call_args
        self.assertLessEqual(kwargs.get('days_back'), 365)

    def test_decorators_intact_unauthenticated_not_400(self):
        # Hoi quy B0.5: decorator `@api_view` + permission_classes tung roi
        # khoi `dnse_sync_accounts_api` (sua bodyquen decorator) lam view
        # thanh ham tran — mat xac thuc/phann quyen. Anon phai 401/403
        # (khong bao gio 400 credential — chua toi buoc do).
        from rest_framework.test import APIClient
        anon = APIClient()
        resp = anon.post(f'{BASE}/sync-accounts/')
        self.assertIn(resp.status_code, (401, 403))

    def test_get_not_allowed_405(self):
        # Cung hoi quy decorator: khong `@api_view(['POST'])` thi GET lot
        # vao logic POST. Phai 405.
        resp = self.client.get(f'{BASE}/sync-accounts/')
        self.assertEqual(resp.status_code, 405)

    def test_delay_failure_503(self):
        _with_credential(self.user)
        with patch(
            'user_workspace.views_dnse.sync_dnse_accounts_task'
        ) as task:
            task.delay.side_effect = ConnectionError('redis down')
            resp = self.client.post(f'{BASE}/sync-accounts/')
        self.assertEqual(resp.status_code, 503)
        self.assertEqual(unwrapped_json(resp).get('code'), 'broker_queue_unavailable')
