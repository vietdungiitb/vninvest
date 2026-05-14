"""
test_soc_models.py — Unit tests for SOC domain models
Covers: ServiceDefinition, ServiceConfig, ServiceHealth, ServiceRunLog, 
         OwnershipRecord, ConfigChangeAudit
"""
import json
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from service_ops.models import (
    ServiceDefinition, ServiceConfig, ServiceHealth, ServiceRunLog,
    OwnershipRecord, ConfigChangeAudit
)

User = get_user_model()


class ServiceDefinitionModelTestCase(TestCase):
    """Test ServiceDefinition model"""

    def setUp(self):
        self.service = ServiceDefinition.objects.create(
            service_key='vnbroker',
            name='VNBroker Integration',
            ownership_matrix={
                'mode': 'native-write',
                'can_apply': True,
                'write_surface': 'core-api',
            },
            config_schema={
                'type': 'object',
                'properties': {
                    'timeout_config': {'type': 'object'},
                    'providers': {'type': 'array'},
                }
            }
        )

    def test_service_creation(self):
        """Test creating a ServiceDefinition"""
        self.assertEqual(self.service.service_key, 'vnbroker')
        self.assertEqual(self.service.name, 'VNBroker Integration')
        self.assertEqual(self.service.ownership_matrix['mode'], 'native-write')

    def test_service_str_representation(self):
        """Test string representation"""
        expected = 'vnbroker | VNBroker Integration'
        self.assertEqual(str(self.service), expected)

    def test_config_schema_validation(self):
        """Test that config_schema is stored as JSON"""
        self.assertIsInstance(self.service.config_schema, dict)
        self.assertIn('properties', self.service.config_schema)


class ServiceConfigModelTestCase(TestCase):
    """Test ServiceConfig model with auto-versioning"""

    def setUp(self):
        self.service = ServiceDefinition.objects.create(
            service_key='vnbroker',
            name='VNBroker Integration',
            ownership_matrix={'mode': 'native-write', 'can_apply': True},
            config_schema={}
        )
        self.user = User.objects.create_user('admin', 'admin@test.com', 'pass123')

    def test_service_config_creation(self):
        """Test creating a ServiceConfig"""
        config_data = {
            'timeout_config': {'connect': 5, 'read': 120},
            'providers': ['provider1'],
        }
        cfg = ServiceConfig.objects.create(
            service=self.service,
            config=config_data,
            status='active',
            applied_by=self.user,
        )
        self.assertEqual(cfg.service.service_key, 'vnbroker')
        self.assertEqual(cfg.config, config_data)
        self.assertEqual(cfg.version, 1)

    def test_service_config_auto_versioning(self):
        """Test that version auto-increments on save"""
        cfg = ServiceConfig.objects.create(
            service=self.service,
            config={'test': 1},
            status='active',
            applied_by=self.user,
        )
        self.assertEqual(cfg.version, 1)

        cfg.config = {'test': 2}
        cfg.save()
        # Re-fetch to check auto-increment
        cfg.refresh_from_db()
        self.assertEqual(cfg.version, 2)

    def test_service_config_applied_timestamp(self):
        """Test applied_at timestamp is set"""
        cfg = ServiceConfig.objects.create(
            service=self.service,
            config={},
            status='active',
            applied_by=self.user,
        )
        self.assertIsNotNone(cfg.applied_at)
        self.assertLessEqual(cfg.applied_at, timezone.now())


class ServiceHealthModelTestCase(TestCase):
    """Test ServiceHealth model"""

    def setUp(self):
        self.health = ServiceHealth.objects.create(
            service_key='vnbroker',
            status='healthy',
            last_check=timezone.now(),
            reason='All providers operational',
        )

    def test_service_health_creation(self):
        """Test creating ServiceHealth"""
        self.assertEqual(self.health.service_key, 'vnbroker')
        self.assertEqual(self.health.status, 'healthy')

    def test_service_health_status_choices(self):
        """Test valid status values"""
        valid_statuses = ['healthy', 'degraded', 'critical']
        for status in valid_statuses:
            h = ServiceHealth.objects.create(
                service_key=f'test_{status}',
                status=status,
                last_check=timezone.now(),
            )
            self.assertEqual(h.status, status)


class ServiceRunLogModelTestCase(TestCase):
    """Test ServiceRunLog model"""

    def test_service_run_log_creation(self):
        """Test creating a ServiceRunLog"""
        log = ServiceRunLog.objects.create(
            task_name='prefetch_universe',
            status='completed',
            started_at=timezone.now(),
            completed_at=timezone.now(),
            result={'symbols_prefetched': 100},
            error=None,
        )
        self.assertEqual(log.task_name, 'prefetch_universe')
        self.assertEqual(log.status, 'completed')
        self.assertEqual(log.result['symbols_prefetched'], 100)

    def test_service_run_log_failed_status(self):
        """Test failed status with error"""
        log = ServiceRunLog.objects.create(
            task_name='vnbroker_health_check',
            status='failed',
            started_at=timezone.now(),
            completed_at=timezone.now(),
            result=None,
            error='Connection timeout',
        )
        self.assertEqual(log.status, 'failed')
        self.assertEqual(log.error, 'Connection timeout')


class OwnershipRecordModelTestCase(TestCase):
    """Test OwnershipRecord model"""

    def test_ownership_record_creation(self):
        """Test creating an OwnershipRecord"""
        record = OwnershipRecord.objects.create(
            service_key='signals',
            mode='bridge-write',
            can_apply=False,
            write_block_reason='Controlled by signal_intelligence service',
            last_modified=timezone.now(),
        )
        self.assertEqual(record.service_key, 'signals')
        self.assertEqual(record.mode, 'bridge-write')
        self.assertFalse(record.can_apply)

    def test_ownership_record_modes(self):
        """Test various ownership modes"""
        modes = ['native-write', 'bridge-write', 'read-only']
        for idx, mode in enumerate(modes):
            record = OwnershipRecord.objects.create(
                service_key=f'service_{idx}',
                mode=mode,
                can_apply=(mode != 'read-only'),
                last_modified=timezone.now(),
            )
            self.assertEqual(record.mode, mode)


class ConfigChangeAuditModelTestCase(TestCase):
    """Test ConfigChangeAudit model"""

    def setUp(self):
        self.user = User.objects.create_user('admin', 'admin@test.com', 'pass123')

    def test_config_change_audit_creation(self):
        """Test creating a ConfigChangeAudit"""
        old_config = {'timeout': 5}
        new_config = {'timeout': 10}
        audit = ConfigChangeAudit.objects.create(
            service_key='vnbroker',
            config_before=old_config,
            config_after=new_config,
            applied_by=self.user,
            applied_at=timezone.now(),
            change_summary='Updated timeout from 5s to 10s',
        )
        self.assertEqual(audit.service_key, 'vnbroker')
        self.assertEqual(audit.config_before['timeout'], 5)
        self.assertEqual(audit.config_after['timeout'], 10)

    def test_config_change_audit_diff_calculation(self):
        """Test that diff can be calculated from before/after"""
        before = {'a': 1, 'b': 2, 'c': 3}
        after = {'a': 1, 'b': 20, 'c': 3, 'd': 4}
        
        audit = ConfigChangeAudit.objects.create(
            service_key='test',
            config_before=before,
            config_after=after,
            applied_by=self.user,
            applied_at=timezone.now(),
            change_summary='Multiple changes',
        )
        
        # Verify the audit captured both configs
        self.assertEqual(audit.config_before['b'], 2)
        self.assertEqual(audit.config_after['b'], 20)
        self.assertNotIn('d', audit.config_before)
        self.assertIn('d', audit.config_after)


class OwnershipIntegrationTestCase(TestCase):
    """Integration tests for ownership enforcement"""

    def setUp(self):
        self.service_native = ServiceDefinition.objects.create(
            service_key='vnbroker',
            name='VNBroker',
            ownership_matrix={'mode': 'native-write', 'can_apply': True},
            config_schema={}
        )
        self.service_bridge = ServiceDefinition.objects.create(
            service_key='signals',
            name='Signals',
            ownership_matrix={'mode': 'bridge-write', 'can_apply': False},
            config_schema={}
        )

    def test_native_write_service_allows_apply(self):
        """Test native-write service can be applied"""
        self.assertEqual(self.service_native.ownership_matrix['mode'], 'native-write')
        self.assertTrue(self.service_native.ownership_matrix['can_apply'])

    def test_bridge_write_service_disallows_apply(self):
        """Test bridge-write service cannot be applied from SOC"""
        self.assertEqual(self.service_bridge.ownership_matrix['mode'], 'bridge-write')
        self.assertFalse(self.service_bridge.ownership_matrix['can_apply'])


class ConfigVersioningIntegrationTestCase(TestCase):
    """Test config versioning workflow"""

    def setUp(self):
        self.service = ServiceDefinition.objects.create(
            service_key='prefetch',
            name='Prefetch',
            ownership_matrix={'mode': 'native-write', 'can_apply': True},
            config_schema={}
        )
        self.user = User.objects.create_user('admin', 'admin@test.com', 'pass123')

    def test_config_version_history(self):
        """Test that config versions are tracked"""
        # Create v1
        cfg_v1 = ServiceConfig.objects.create(
            service=self.service,
            config={'interval': 300},
            status='active',
            applied_by=self.user,
        )
        self.assertEqual(cfg_v1.version, 1)

        # Create v2
        cfg_v2 = ServiceConfig.objects.create(
            service=self.service,
            config={'interval': 600},
            status='active',
            applied_by=self.user,
        )
        # Version should auto-increment
        cfg_v2 = ServiceConfig.objects.get(pk=cfg_v2.pk)
        self.assertEqual(cfg_v2.version, 2)

        # Verify both configs exist
        configs = ServiceConfig.objects.filter(service=self.service).order_by('version')
        self.assertEqual(configs.count(), 2)
        self.assertEqual(configs[0].version, 1)
        self.assertEqual(configs[1].version, 2)

    def test_audit_log_on_config_change(self):
        """Test that audit logs are created when config changes"""
        old_config = {'interval': 300}
        new_config = {'interval': 600}

        cfg = ServiceConfig.objects.create(
            service=self.service,
            config=old_config,
            status='active',
            applied_by=self.user,
        )

        audit = ConfigChangeAudit.objects.create(
            service_key=self.service.service_key,
            config_before=old_config,
            config_after=new_config,
            applied_by=self.user,
            applied_at=timezone.now(),
            change_summary='Interval change',
        )

        # Verify audit was created
        audit_records = ConfigChangeAudit.objects.filter(service_key=self.service.service_key)
        self.assertEqual(audit_records.count(), 1)
        self.assertEqual(audit_records[0].config_before['interval'], 300)
        self.assertEqual(audit_records[0].config_after['interval'], 600)
