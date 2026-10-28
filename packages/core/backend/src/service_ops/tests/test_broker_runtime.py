"""B2.4 tests: broker_runtime (routing/kill-switch/quiet-hours) + backfill switch + fan-out gate.

Chạy: python manage.py test service_ops.tests.test_broker_runtime
"""
from datetime import datetime
from unittest.mock import patch

import pytz
from django.test import TestCase

from service_ops.broker_runtime import (
    BrokerWriteDisabled,
    check_kill_switch,
    in_quiet_hours,
    provider_for_purpose,
)

ICT = pytz.timezone('Asia/Ho_Chi_Minh')


class BrokerRuntimeTests(TestCase):
    def test_defaults_routing(self):
        self.assertEqual(provider_for_purpose('backfill'), 'dnse')
        self.assertEqual(provider_for_purpose('snapshot'), 'ssi')
        self.assertIsNone(provider_for_purpose('nope'))
        check_kill_switch()  # không raise khi tắt

    def test_quiet_hours_window(self):
        # Mặc định yên tĩnh 17:00→08:30 (qua đêm)
        self.assertFalse(in_quiet_hours(datetime(2026, 9, 23, 10, 0, tzinfo=ICT)))
        self.assertTrue(in_quiet_hours(datetime(2026, 9, 23, 20, 0, tzinfo=ICT)))
        self.assertTrue(in_quiet_hours(datetime(2026, 9, 24, 3, 0, tzinfo=ICT)))
        self.assertTrue(in_quiet_hours(datetime(2026, 9, 24, 8, 29, tzinfo=ICT)))
        self.assertFalse(in_quiet_hours(datetime(2026, 9, 24, 8, 30, tzinfo=ICT)))

    def test_kill_switch_from_stored_config(self):
        from service_ops.domain_configs.broker import get_default_broker_system_config
        from service_ops.models import ServiceConfig, ServiceDefinition
        service, _ = ServiceDefinition.objects.get_or_create(
            service_key='broker_config',
            defaults={'name': 'Broker', 'domain': 'platform'})
        cfg = get_default_broker_system_config().to_dict()
        cfg['kill_switch_write'] = True
        ServiceConfig.objects.create(service=service, config_payload=cfg, is_current=True)
        with self.assertRaises(BrokerWriteDisabled):
            check_kill_switch()

    def test_invalid_stored_config_falls_back(self):
        from service_ops.models import ServiceConfig, ServiceDefinition
        service, _ = ServiceDefinition.objects.get_or_create(
            service_key='broker_config',
            defaults={'name': 'Broker', 'domain': 'platform'})
        ServiceConfig.objects.create(
            service=service, config_payload={'entries': {'xx': {}}}, is_current=True)
        self.assertEqual(provider_for_purpose('backfill'), 'dnse')

    def test_fanout_skipped_in_quiet_hours(self):
        from user_workspace.tasks import (
            reconcile_all_dnse_transactions_task,
            sync_all_dnse_balances_task,
        )
        with patch('service_ops.broker_runtime.in_quiet_hours', return_value=True):
            r1 = reconcile_all_dnse_transactions_task.run()
            r2 = sync_all_dnse_balances_task.run()
        self.assertEqual(r1.get('skipped'), 'quiet_hours')
        self.assertEqual(r2.get('skipped'), 'quiet_hours')

    def test_system_backfill_prefers_system_credential(self):
        from identity_access.models import SystemBrokerCredential
        cred = SystemBrokerCredential(provider='dnse', allowed_purposes=['backfill'])
        cred.set_secrets({'client_id': 'SYSK', 'client_secret': 'SYSS'})
        cred.save()
        from data_ingest.tasks import backfill_intraday_tick_system
        with patch('market_data.vnbroker_adapter.fetch_intraday_tape_history',
                   return_value=[]) as mock_fetch:
            result = backfill_intraday_tick_system.run(
                symbol='ACB', trade_date='2026-09-22')
        self.assertEqual(result['status'], 'empty')
        _, kwargs = mock_fetch.call_args
        self.assertEqual(kwargs.get('api_key'), 'SYSK')
        self.assertEqual(kwargs.get('api_secret'), 'SYSS')

    def test_system_backfill_aborts_without_any_credential(self):
        from data_ingest.tasks import backfill_intraday_tick_system
        with patch('identity_access.models.get_system_provider_credentials',
                   return_value=None):
            result = backfill_intraday_tick_system.run(
                symbol='ACB', trade_date='2026-09-22')
        self.assertEqual(result['status'], 'aborted')
        self.assertEqual(result['reason'], 'no_system_credentials')
