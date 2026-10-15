"""Wave 4 (mbw4) tests: SOC broker ops — lane metrics, queue depth, expiry, CSV.

B4.1: GET /api/soc/broker/health/ mo rong lane metrics (BrokerSyncRun/Issue,
read-only) + queue depth (fail-open) + top loi + envelope ADR-003 + staff-only.
B4.2: expiry derived (khong migration, O-3) + audit viewer CSV (scope service,
gioi han 5000, O-5). Kill-switch write dung lai config/apply hien co (O-4).

Chay TREN VPS STAGING theo runbook §12.3 (cam local):
  python manage.py test service_ops.tests.test_soc_broker_ops_wave4 --noinput

Fail-before: truoc B4.1/B4.2, health khong co key 'lane'/'queues'/'top_errors',
credentials khong co 'needs_verification', audit khong hieu '?download=csv'.
"""
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from identity_access.models import SystemBrokerCredential
from service_ops.tests.envelope import unwrapped_json
from service_ops.views.broker import BrokerAuditView
from user_workspace.models import BrokerSyncIssue, BrokerSyncRun
from user_workspace.tests.tenant_test_helpers import grant_tenant

BASE = '/api/soc/broker'


def _make_staff(name='socw4'):
    staff = User.objects.create_user(username=name, password='x')
    staff.is_staff = True
    staff.save(update_fields=['is_staff'])
    return staff


class SocBrokerOpsWave4Tests(TestCase):
    def setUp(self):
        self.staff = _make_staff()
        self.plain = User.objects.create_user(username='socw4plain', password='x')
        self.tenant = grant_tenant(self.staff)
        self.client = APIClient()
        self.client.force_authenticate(user=self.staff)

    def _providers(self, body):
        return {p['provider']: p for p in body['providers']}

    # --- B4.1: health lane metrics (DB rong) ---

    def test_health_lane_shape_empty(self):
        with patch('service_ops.tasks._get_redis_queue_depth', return_value=0):
            resp = self.client.get(f'{BASE}/health/')
        self.assertEqual(resp.status_code, 200)
        body = unwrapped_json(resp)
        self.assertIn('queues', body)
        self.assertEqual(body['queues'], {'celery': 0})
        self.assertIn('top_errors', body)
        self.assertEqual(body['top_errors'], [])
        self.assertEqual(set(self._providers(body)), {'dnse', 'ssi', 'tcbs'})
        lane = self._providers(body)['dnse']['lane']
        self.assertIsNone(lane['last_run'])
        self.assertEqual(lane['runs_24h']['total'], 0)
        self.assertEqual(lane['error_rate_24h'], 0.0)
        self.assertIsNone(lane['avg_latency_s_24h'])
        self.assertEqual(lane['unresolved_issues']['total'], 0)
        self.assertEqual(lane['top_errors'], [])
        self.assertEqual(lane['consecutive_failures'], 0)
        # retry lay tu config entry (khong che so lieu quan sat)
        self.assertEqual(lane['retries_configured'], 3)

    def test_health_lane_aggregates_runs_and_issues(self):
        now = timezone.now()
        r1 = BrokerSyncRun.objects.create(
            user=self.staff, tenant=self.tenant, provider='dnse',
            status='succeeded', stats={'positions': 5},
            finished_at=now - timedelta(hours=1))
        BrokerSyncRun.objects.filter(pk=r1.pk).update(
            started_at=now - timedelta(hours=1, minutes=2))
        r2 = BrokerSyncRun.objects.create(
            user=self.staff, tenant=self.tenant, provider='dnse',
            status='failed', error='boom',
            finished_at=now - timedelta(minutes=30))
        BrokerSyncRun.objects.filter(pk=r2.pk).update(
            started_at=now - timedelta(minutes=31))
        BrokerSyncIssue.objects.create(
            run=r2, tenant=self.tenant, severity='error',
            code='sync_failed', payload={})
        BrokerSyncIssue.objects.create(
            run=None, tenant=self.tenant, severity='warning',
            code='position_drift', payload={})
        with patch('service_ops.tasks._get_redis_queue_depth', return_value=4):
            resp = self.client.get(f'{BASE}/health/')
        self.assertEqual(resp.status_code, 200)
        body = unwrapped_json(resp)
        lane = self._providers(body)['dnse']['lane']
        self.assertEqual(lane['runs_24h']['total'], 2)
        self.assertEqual(lane['runs_24h']['succeeded'], 1)
        self.assertEqual(lane['runs_24h']['failed'], 1)
        self.assertEqual(lane['error_rate_24h'], 0.5)
        # chi run succeeded co ca started+finished (120s) duoc tinh latency
        self.assertEqual(lane['avg_latency_s_24h'], 120.0)
        self.assertEqual(lane['last_run']['status'], 'failed')
        self.assertEqual(lane['last_run']['error'], 'boom')
        self.assertEqual(lane['unresolved_issues']['total'], 1)
        self.assertEqual(lane['unresolved_issues']['error'], 1)
        self.assertEqual(lane['top_errors'], [{'code': 'sync_failed', 'count': 1}])
        self.assertEqual(lane['consecutive_failures'], 1)
        self.assertEqual(self._providers(body)['dnse']['queue_depth'], 4)
        self.assertEqual(body['queues'], {'celery': 4})
        # issue da resolve khong tinh
        self.assertEqual(
            body['top_errors'], [{'code': 'sync_failed', 'count': 1}])

    def test_health_queue_depth_fail_open(self):
        with patch('service_ops.tasks._get_redis_queue_depth',
                   side_effect=RuntimeError('redis down')):
            resp = self.client.get(f'{BASE}/health/')
        self.assertEqual(resp.status_code, 200)
        body = unwrapped_json(resp)
        self.assertEqual(body['queues'], {'celery': 0})

    def test_health_non_staff_forbidden(self):
        self.client.force_authenticate(user=self.plain)
        resp = self.client.get(f'{BASE}/health/')
        self.assertEqual(resp.status_code, 403)

    # --- B4.2: expiry derived (khong migration) ---

    def _cred(self, provider, verified, age_days=None):
        cred = SystemBrokerCredential(provider=provider, allowed_purposes=['backfill'])
        cred.set_secrets({'client_id': 'ID', 'client_secret': 'SEC'})
        cred.is_verified = verified
        cred.last_verified_at = (
            (timezone.now() - timedelta(days=age_days)) if age_days is not None else None)
        cred.save()
        return cred

    def test_credentials_expiry_derived_matrix(self):
        self._cred('dnse', verified=False)
        self._cred('ssi', verified=True, age_days=1)
        self._cred('tcbs', verified=True, age_days=45)
        resp = self.client.get(f'{BASE}/credentials/')
        self.assertEqual(resp.status_code, 200)
        creds = {c['provider']: c for c in unwrapped_json(resp)['credentials']}
        self.assertTrue(creds['dnse']['needs_verification'])
        self.assertEqual(creds['dnse']['stale_reason'], 'chua_xac_minh')
        self.assertFalse(creds['ssi']['needs_verification'])
        self.assertEqual(creds['ssi']['stale_reason'], '')
        self.assertTrue(creds['tcbs']['needs_verification'])
        self.assertEqual(creds['tcbs']['stale_reason'], 'qua_han_30_ngay')

    def test_health_exposes_expiry_badges(self):
        self._cred('dnse', verified=True, age_days=45)
        with patch('service_ops.tasks._get_redis_queue_depth', return_value=0):
            resp = self.client.get(f'{BASE}/health/')
        prov = self._providers(unwrapped_json(resp))['dnse']
        self.assertTrue(prov['credential_present'])
        self.assertTrue(prov['needs_verification'])
        self.assertEqual(prov['stale_reason'], 'qua_han_30_ngay')

    # --- B4.2: audit viewer CSV (scope service, 5000) ---

    def test_audit_csv_download(self):
        from service_ops.domain_configs.broker import get_default_broker_system_config
        cfg = get_default_broker_system_config().to_dict()
        self.client.post(f'{BASE}/config/apply/',
                         {'config_payload': cfg, 'change_reason': 'csv test'},
                         format='json')
        resp = self.client.get(f'{BASE}/audit/?download=csv')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('text/csv', resp['Content-Type'])
        self.assertIn('soc-broker-audit.csv', resp['Content-Disposition'])
        content = b''.join(resp.streaming_content).decode('utf-8')
        self.assertIn('timestamp,action,actor,actor_ip,change_summary,request_id', content)
        self.assertIn('csv test', content)

    def test_audit_csv_cap_constant(self):
        self.assertEqual(BrokerAuditView.CSV_MAX_ROWS, 5000)

    def test_audit_csv_non_staff_forbidden(self):
        self.client.force_authenticate(user=self.plain)
        resp = self.client.get(f'{BASE}/audit/?download=csv')
        self.assertEqual(resp.status_code, 403)

    # --- B4.2: kill-switch qua config/apply hien co (O-4, khong route moi) ---

    def test_kill_switch_via_apply_reflected_in_health(self):
        from service_ops.domain_configs.broker import get_default_broker_system_config
        cfg = get_default_broker_system_config().to_dict()
        cfg['kill_switch_write'] = True
        resp = self.client.post(
            f'{BASE}/config/apply/',
            {'config_payload': cfg, 'change_reason': 'drill bat kill-switch'},
            format='json')
        self.assertEqual(resp.status_code, 200)
        with patch('service_ops.tasks._get_redis_queue_depth', return_value=0):
            health = unwrapped_json(self.client.get(f'{BASE}/health/'))
        self.assertTrue(health['kill_switch_write'])
