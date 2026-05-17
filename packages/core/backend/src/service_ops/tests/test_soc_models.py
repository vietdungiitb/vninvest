"""Model coverage for the current SOC schema."""

from django.db import IntegrityError
from django.test import TestCase
from django.utils import timezone

from service_ops.models import (
    ConfigChangeAudit,
    MarketDataParitySnapshot,
    OwnershipRecord,
    ScrapeMatrix,
    ScrapeMatrixCell,
    ServiceConfig,
    ServiceDefinition,
    ServiceHealth,
    ServiceRunLog,
)


class ServiceDefinitionModelTestCase(TestCase):
    def test_service_definition_creation_and_string(self):
        service = ServiceDefinition.objects.create(
            service_key='custom_platform_service',
            name='Custom Platform Service',
            domain='platform',
            description='Synthetic platform service',
            owner_team='core',
            tags=['ops', 'test'],
        )

        self.assertEqual(service.service_key, 'custom_platform_service')
        self.assertEqual(service.domain, 'platform')
        self.assertEqual(str(service), 'custom_platform_service (platform)')


class ServiceConfigModelTestCase(TestCase):
    def setUp(self):
        self.service = ServiceDefinition.objects.create(
            service_key='config_test_service',
            name='Config Test Service',
            domain='platform',
            description='Config test service',
            owner_team='core',
            tags=[],
        )

    def test_new_current_config_marks_previous_config_inactive(self):
        first_config = ServiceConfig.objects.create(
            service=self.service,
            config_payload={'value': 1},
            applied_by='tester',
            change_reason='first',
        )
        second_config = ServiceConfig.objects.create(
            service=self.service,
            config_payload={'value': 2},
            applied_by='tester',
            change_reason='second',
        )

        first_config.refresh_from_db()
        second_config.refresh_from_db()
        self.assertFalse(first_config.is_current)
        self.assertTrue(second_config.is_current)

    def test_applied_at_is_set_on_create(self):
        config = ServiceConfig.objects.create(
            service=self.service,
            config_payload={'value': 1},
            applied_by='tester',
            change_reason='timestamp',
        )

        self.assertIsNotNone(config.applied_at)
        self.assertLessEqual(config.applied_at, timezone.now())


class ServiceHealthModelTestCase(TestCase):
    def setUp(self):
        self.service = ServiceDefinition.objects.create(
            service_key='health_test_service',
            name='Health Test Service',
            domain='platform',
            description='Health test service',
            owner_team='core',
            tags=[],
        )

    def test_service_health_creation_and_detail(self):
        health = ServiceHealth.objects.create(
            service=self.service,
            status='healthy',
            last_success_at=timezone.now(),
            consecutive_failures=0,
            avg_response_ms=12.5,
            detail={'source': 'test'},
        )

        self.assertEqual(health.service, self.service)
        self.assertEqual(health.status, 'healthy')
        self.assertEqual(health.detail['source'], 'test')
        self.assertEqual(str(health), 'health_test_service: healthy')


class ServiceRunLogModelTestCase(TestCase):
    def setUp(self):
        self.service = ServiceDefinition.objects.create(
            service_key='run_log_test_service',
            name='Run Log Test Service',
            domain='platform',
            description='Run log test service',
            owner_team='core',
            tags=[],
        )

    def test_service_run_log_tracks_output_and_failure_detail(self):
        success_log = ServiceRunLog.objects.create(
            service=self.service,
            status='success',
            input_summary={'trigger': 'manual'},
            output_summary={'processed': 10},
        )
        failed_log = ServiceRunLog.objects.create(
            service=self.service,
            status='failed',
            input_summary={'trigger': 'manual'},
            output_summary={},
            error_detail='Connection timeout',
        )

        self.assertEqual(success_log.output_summary['processed'], 10)
        self.assertEqual(failed_log.error_detail, 'Connection timeout')
        self.assertIn('run_log_test_service run', str(success_log))


class MarketDataParitySnapshotModelTestCase(TestCase):
    def setUp(self):
        self.service = ServiceDefinition.objects.create(
            service_key='parity_snapshot_test_service',
            name='Parity Snapshot Test Service',
            domain='matrix',
            description='Parity snapshot test service',
            owner_team='core',
            tags=[],
        )

    def test_unique_scheduler_task_id_and_window_hours(self):
        MarketDataParitySnapshot.objects.create(
            service=self.service,
            scheduler_task_id='sched-001',
            window_hours=24,
            strict_fresh_parity=0.99,
            fresh_or_warm_parity=1.0,
        )

        with self.assertRaises(IntegrityError):
            MarketDataParitySnapshot.objects.create(
                service=self.service,
                scheduler_task_id='sched-001',
                window_hours=24,
                strict_fresh_parity=0.95,
                fresh_or_warm_parity=0.97,
            )


class OwnershipRecordModelTestCase(TestCase):
    def test_ownership_record_writability_and_block_reason(self):
        native_record = OwnershipRecord.objects.create(
            domain='native_domain',
            owner_team='core',
            write_mode='native-write',
            write_surface='service_ops',
            locked_fields=[],
            compatibility_domains=[],
        )
        readonly_record = OwnershipRecord.objects.create(
            domain='readonly_domain',
            owner_team='core',
            write_mode='read-only',
            write_surface='legacy',
            locked_fields=['field_a'],
            compatibility_domains=['legacy'],
        )

        self.assertTrue(native_record.is_writable())
        self.assertIsNone(native_record.get_write_block_reason())
        self.assertFalse(readonly_record.is_writable())
        self.assertIn('read-only', readonly_record.get_write_block_reason())


class ConfigChangeAuditModelTestCase(TestCase):
    def setUp(self):
        self.service = ServiceDefinition.objects.create(
            service_key='audit_test_service',
            name='Audit Test Service',
            domain='platform',
            description='Audit test service',
            owner_team='core',
            tags=[],
        )

    def test_config_change_audit_persists_before_and_after_snapshots(self):
        audit = ConfigChangeAudit.objects.create(
            service=self.service,
            action='apply',
            actor='ops-user',
            actor_ip='127.0.0.1',
            before_snapshot={'timeout': 5},
            after_snapshot={'timeout': 10},
            change_summary='Updated timeout',
            request_id='req_test_123',
        )

        self.assertEqual(audit.before_snapshot['timeout'], 5)
        self.assertEqual(audit.after_snapshot['timeout'], 10)
        self.assertEqual(audit.request_id, 'req_test_123')


class ScrapeMatrixModelTestCase(TestCase):
    def test_scrape_matrix_progress_pct_and_cell_string(self):
        matrix = ScrapeMatrix.objects.create(
            cycle_id='cycle_test_001',
            status='active',
            providers=['vci', 'kbs'],
            total_rows=10,
            done_rows=4,
            failed_rows=1,
        )
        cell = ScrapeMatrixCell.objects.create(
            matrix=matrix,
            symbol_group_id='vn30',
            provider='vci',
            status='working',
            worker_id='worker-1',
            symbols_processed=12,
        )

        self.assertEqual(matrix.progress_pct, 40.0)
        self.assertIn('cycle_test_001 vn30 x vci', str(cell))