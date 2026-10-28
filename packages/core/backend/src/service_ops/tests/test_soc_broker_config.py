"""B2.3 tests: SOC broker config + credentials + audit + staff gate.

Chạy: python manage.py test service_ops.tests.test_soc_broker_config
"""
import json
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from service_ops.domain_configs.broker import get_default_broker_system_config
from service_ops.models import ConfigChangeAudit, ServiceConfig, ServiceDefinition
from service_ops.tests.envelope import unwrapped_json

BASE = '/api/soc/broker'


class SocBrokerConfigTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user(username='socbk', password='x')
        self.staff.is_staff = True
        self.staff.save(update_fields=['is_staff'])
        self.plain = User.objects.create_user(username='socplain', password='x')
        self.client = APIClient()
        self.client.force_authenticate(user=self.staff)

    def test_get_defaults(self):
        resp = self.client.get(f'{BASE}/config/')
        self.assertEqual(resp.status_code, 200)
        entries = unwrapped_json(resp)['config']['entries']
        self.assertEqual(set(entries), {'dnse', 'ssi', 'tcbs'})
        self.assertFalse(unwrapped_json(resp)['config']['kill_switch_write'])

    def test_non_staff_forbidden(self):
        self.client.force_authenticate(user=self.plain)
        for method, url in [('get', f'{BASE}/config/'), ('get', f'{BASE}/health/'),
                            ('get', f'{BASE}/audit/'), ('get', f'{BASE}/credentials/')]:
            resp = getattr(self.client, method)(url)
            self.assertEqual(resp.status_code, 403, url)

    def test_apply_valid_writes_version_and_audit(self):
        cfg = get_default_broker_system_config().to_dict()
        cfg['entries']['dnse']['requests_per_minute'] = 120
        resp = self.client.post(
            f'{BASE}/config/apply/',
            {'config_payload': cfg, 'change_reason': 'tang rpm dnse'},
            format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(any('requests_per_minute' in s
                            for s in unwrapped_json(resp)['change_summary']))
        service = ServiceDefinition.objects.get(service_key='broker_config')
        current = ServiceConfig.objects.get(service=service, is_current=True)
        self.assertEqual(current.config_payload['entries']['dnse']['requests_per_minute'], 120)
        audit = ConfigChangeAudit.objects.filter(service=service, action='apply').latest('timestamp')
        self.assertIn('tang rpm dnse', audit.change_summary)
        self.assertEqual(audit.actor, 'socbk')

    def test_apply_invalid_rejected_no_write(self):
        before_count = ServiceConfig.objects.count()
        cfg = get_default_broker_system_config().to_dict()
        cfg['entries']['ssi']['routing_order'] = 0  # trùng dnse
        resp = self.client.post(
            f'{BASE}/config/apply/', {'config_payload': cfg}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertTrue(unwrapped_json(resp)['validation_errors'])
        self.assertEqual(ServiceConfig.objects.count(), before_count)

    def test_preview_no_write(self):
        before_count = ServiceConfig.objects.count()
        cfg = get_default_broker_system_config().to_dict()
        cfg['kill_switch_write'] = True
        resp = self.client.post(
            f'{BASE}/config/preview/', {'config_payload': cfg}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('before', unwrapped_json(resp))
        self.assertTrue(any('kill_switch_write' in s
                            for s in unwrapped_json(resp)['change_summary']))
        self.assertEqual(ServiceConfig.objects.count(), before_count)

    def test_audit_list_and_limit(self):
        cfg = get_default_broker_system_config().to_dict()
        self.client.post(f'{BASE}/config/apply/', {'config_payload': cfg}, format='json')
        resp = self.client.get(f'{BASE}/audit/?limit=5')
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(len(unwrapped_json(resp)['audits']) >= 1)
        resp = self.client.get(f'{BASE}/audit/?limit=999')
        self.assertLessEqual(len(unwrapped_json(resp)['audits']), 200)

    def test_health_shape_no_secrets(self):
        resp = self.client.get(f'{BASE}/health/')
        self.assertEqual(resp.status_code, 200)
        body = json.dumps(unwrapped_json(resp))
        self.assertIn('kill_switch_write', body)
        self.assertIn('credential_present', body)
        providers = {p['provider']: p for p in unwrapped_json(resp)['providers']}
        self.assertFalse(providers['dnse']['credential_present'])

    def test_credentials_crud_masked_and_audited(self):
        resp = self.client.post(
            f'{BASE}/credentials/',
            {'provider': 'dnse',
             'secrets': {'client_id': 'SYSID9', 'client_secret': 'SYSSEC9'},
             'allowed_purposes': ['backfill']},
            format='json')
        self.assertEqual(resp.status_code, 200)
        body = json.dumps(unwrapped_json(resp))
        self.assertNotIn('SYSSEC9', body)
        self.assertNotIn('SYSID9', body)
        self.assertIn('****', body)
        resp = self.client.get(f'{BASE}/credentials/')
        self.assertEqual(len(unwrapped_json(resp)['credentials']), 1)
        service = ServiceDefinition.objects.get(service_key='broker_config')
        self.assertTrue(ConfigChangeAudit.objects.filter(
            service=service, action='apply',
            change_summary__contains='dnse').exists())
        resp = self.client.delete(f'{BASE}/credentials/dnse/')
        self.assertEqual(resp.status_code, 200)
        resp = self.client.get(f'{BASE}/credentials/')
        self.assertEqual(unwrapped_json(resp)['credentials'], [])

    def test_credentials_reject_bad_purpose_and_empty(self):
        resp = self.client.post(
            f'{BASE}/credentials/',
            {'provider': 'dnse', 'secrets': {'a': 'b'}, 'allowed_purposes': ['nope']},
            format='json')
        self.assertEqual(resp.status_code, 400)
        resp = self.client.post(
            f'{BASE}/credentials/', {'provider': 'xx', 'secrets': {}}, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_system_test_connection_enqueue(self):
        from identity_access.models import SystemBrokerCredential
        cred = SystemBrokerCredential(provider='dnse', allowed_purposes=['backfill'])
        cred.set_secrets({'client_id': 'A', 'client_secret': 'B'})
        cred.save()

        class FakeJob:
            id = 'sys-job-1'

        # view import lazy `from .tasks import ...` trong hàm → patch module attr là đủ
        with patch('service_ops.tasks.test_system_broker_connection_task') as mock_task:
            mock_task.delay.return_value = FakeJob()
            resp = self.client.post(
                f'{BASE}/test-connection/', {'provider': 'dnse'}, format='json')
        self.assertEqual(resp.status_code, 202)
        self.assertEqual(unwrapped_json(resp)['job_id'], 'sys-job-1')

        resp = self.client.post(
            f'{BASE}/test-connection/', {'provider': 'xx'}, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_system_test_connection_task_marks_check(self):
        from identity_access.models import SystemBrokerCredential
        from service_ops.tasks import test_system_broker_connection_task
        cred = SystemBrokerCredential(provider='dnse', allowed_purposes=['backfill'])
        cred.set_secrets({'client_id': 'BAD', 'client_secret': 'BAD'})
        cred.save()
        with patch('user_workspace.vnbroker_dnse_compat.build_dnse_client',
                   side_effect=RuntimeError('down')):
            result = test_system_broker_connection_task.run('dnse')
        self.assertFalse(result['ok'])
        self.assertIn('latency_ms', result)
        cred.refresh_from_db()
        self.assertFalse(cred.is_verified)
        self.assertTrue(cred.last_check['latency_ms'] >= 0)
        self.assertNotIn('BAD', str(cred.last_check))
