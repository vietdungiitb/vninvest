"""
Tests cho S01 — Scheduler Catalog Contract.

Verifies:
1. build_scheduler_catalog() trả đúng fields và types.
2. domain_filter hoạt động.
3. API endpoints plan/health/history return đúng HTTP status và payload shape.
4. Ownership guard được nhúng vào plan response.
"""

from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from service_ops.registry import ensure_service_registry
from service_ops.scheduler_catalog import (
    CATALOG_JOB_METADATA,
    build_scheduler_catalog,
    build_scheduler_health_summary,
)
from service_ops.tests.envelope import unwrapped_json

User = get_user_model()

_MINIMAL_SCHEDULE = {
    'market-data-queue-tier-scheduler-30s': {
        'task': 'service_ops.run_market_data_queue_tier_scheduler',
        'schedule': 30.0,
        'options': {'queue': 'manual_on_demand'},
    },
    'ingest-price-board-60s': {
        'task': 'data_ingest.tasks.fetch_and_upsert_price_board',
        'schedule': 60.0,
        'options': {'queue': 'realtime_prefetch'},
    },
    'materialize-session-facts-5m': {
        'task': 'market_serving.materializers.materialize_session_facts',
        'schedule': 300.0,
        'options': {'queue': 'realtime_prefetch'},
    },
}

_CRON_SCHEDULE = {
    'daily-backfill-prices-1700': {
        'task': 'data_ingest.tasks.backfill_daily_prices',
        'schedule': 'cron(hour=10, minute=5)',  # string for test isolation
        'options': {'queue': 'enrichment_offhours'},
        'kwargs': {'days': 365},
    },
}


class SchedulerCatalogUnitTests(TestCase):
    """Unit tests cho build_scheduler_catalog()."""

    @classmethod
    def setUpTestData(cls):
        ensure_service_registry()

    def test_catalog_returns_list(self):
        catalog = build_scheduler_catalog(schedule_map=_MINIMAL_SCHEDULE)
        self.assertIsInstance(catalog, list)
        self.assertEqual(len(catalog), 3)

    def test_catalog_job_has_required_fields(self):
        catalog = build_scheduler_catalog(schedule_map=_MINIMAL_SCHEDULE)
        required_fields = {
            'job_key', 'display_name', 'domain', 'data_types', 'trigger_type',
            'control_mode', 'schedule_label', 'task_path', 'queue', 'status',
            'status_reason', 'enabled', 'is_inflight', 'next_run_at', 'last_run_at',
            'lag_seconds', 'freshness_state', 'total_run_count', 'beat_registered',
            'capabilities',
        }
        for job in catalog:
            for field in required_fields:
                self.assertIn(field, job, f"Missing field '{field}' in job {job.get('job_key')}")

    def test_catalog_job_key_matches_schedule_key(self):
        catalog = build_scheduler_catalog(schedule_map=_MINIMAL_SCHEDULE)
        keys = {j['job_key'] for j in catalog}
        self.assertEqual(keys, set(_MINIMAL_SCHEDULE.keys()))

    def test_catalog_domain_filter(self):
        catalog = build_scheduler_catalog(schedule_map=_MINIMAL_SCHEDULE, domain_filter='dataops')
        self.assertTrue(all(j['domain'] == 'dataops' for j in catalog))
        # ingest-price-board-60s is dataops, materialize-session-facts-5m is materialization
        self.assertGreaterEqual(len(catalog), 1)

    def test_catalog_unknown_job_gets_default_metadata(self):
        unknown_schedule = {
            'unknown-custom-task': {
                'task': 'some.app.custom_task',
                'schedule': 120.0,
                'options': {'queue': 'celery'},
            },
        }
        catalog = build_scheduler_catalog(schedule_map=unknown_schedule)
        self.assertEqual(len(catalog), 1)
        job = catalog[0]
        # Should not crash; uses platform domain as default
        self.assertEqual(job['job_key'], 'unknown-custom-task')
        self.assertEqual(job['domain'], 'platform')
        self.assertEqual(job['capabilities'], [])

    def test_catalog_job_disabled_when_schedule_def_says_false(self):
        schedule_with_disabled = {
            'ingest-daily-prices-1705': {
                'task': 'data_ingest.tasks.ingest_daily_prices',
                'schedule': 'cron',
                'options': {'queue': 'enrichment_offhours'},
                'enabled': False,
            },
        }
        catalog = build_scheduler_catalog(schedule_map=schedule_with_disabled)
        self.assertEqual(len(catalog), 1)
        job = catalog[0]
        self.assertFalse(job['enabled'])
        self.assertEqual(job['status'], 'disabled')

    def test_catalog_capabilities_from_metadata(self):
        catalog = build_scheduler_catalog(schedule_map=_MINIMAL_SCHEDULE)
        job = next(j for j in catalog if j['job_key'] == 'market-data-queue-tier-scheduler-30s')
        meta = CATALOG_JOB_METADATA['market-data-queue-tier-scheduler-30s']
        self.assertEqual(set(job['capabilities']), set(meta['capabilities']))

    def test_catalog_schedule_label_interval(self):
        catalog = build_scheduler_catalog(schedule_map=_MINIMAL_SCHEDULE)
        job = next(j for j in catalog if j['job_key'] == 'market-data-queue-tier-scheduler-30s')
        self.assertEqual(job['schedule_label'], 'every 30s')

    def test_catalog_freshness_missing_when_never_run(self):
        from service_ops.scheduler_catalog import CATALOG_JOB_METADATA
        catalog = build_scheduler_catalog(schedule_map=_MINIMAL_SCHEDULE)
        for job in catalog:
            # Jobs WITH a service_key may get last_run_at from ServiceRunLog (S04-ext behavior).
            # Only assert "missing" for jobs without a service_key — those have no fallback path.
            if CATALOG_JOB_METADATA.get(job['job_key'], {}).get('service_key'):
                continue
            # No PeriodicTask in test DB, so last_run_at is None
            self.assertIsNone(job['last_run_at'])
            self.assertEqual(job['freshness_state'], 'missing')

    def test_catalog_beat_registered_false_when_no_periodic_task(self):
        catalog = build_scheduler_catalog(schedule_map=_MINIMAL_SCHEDULE)
        for job in catalog:
            self.assertFalse(job['beat_registered'])

    def test_catalog_empty_schedule_returns_empty(self):
        catalog = build_scheduler_catalog(schedule_map={})
        self.assertEqual(catalog, [])

    def test_daily_backfill_uses_daily_freshness_window(self):
        from django.core.cache import cache
        from service_ops.models import ServiceRunLog
        from service_ops.registry import get_registered_service

        finished_at = timezone.now() - timedelta(hours=6)
        service = get_registered_service('backfill_daily_prices')
        ServiceRunLog.objects.filter(
            service=service,
            status__in=['queued', 'running'],
        ).update(
            status='failed',
            finished_at=finished_at - timedelta(minutes=30),
            duration_seconds=0.0,
            error_detail='Cleared by test isolation',
        )
        cache.delete('scheduler:inflight:daily-backfill-prices-1700')
        cache.delete('scheduler:manual_run:daily-backfill-prices-1700')
        run_log = ServiceRunLog.objects.create(
            service=service,
            status='success',
            input_summary={'job_key': 'daily-backfill-prices-1700', 'triggered_by': 'beat_schedule'},
            output_summary={'planned_items': 1536},
        )
        ServiceRunLog.objects.filter(pk=run_log.pk).update(
            started_at=finished_at - timedelta(minutes=15),
            finished_at=finished_at,
            duration_seconds=900.0,
        )

        catalog = build_scheduler_catalog(schedule_map=_CRON_SCHEDULE)
        job = next(j for j in catalog if j['job_key'] == 'daily-backfill-prices-1700')

        self.assertEqual(job['status'], 'enabled')
        self.assertEqual(job['freshness_state'], 'warm')
        self.assertGreaterEqual(job['lag_seconds'], 6 * 3600)
        self.assertLess(job['lag_seconds'], (6 * 3600) + 60)
        self.assertFalse(job['is_inflight'])
        self.assertEqual(job['queue'], 'enrichment_offhours')

    def test_daily_backfill_reports_daily_threshold_when_truly_stale(self):
        from django.core.cache import cache
        from service_ops.models import ServiceRunLog
        from service_ops.registry import get_registered_service

        finished_at = timezone.now() - timedelta(hours=30)
        service = get_registered_service('backfill_daily_prices')
        ServiceRunLog.objects.filter(
            service=service,
            status__in=['queued', 'running'],
        ).update(
            status='failed',
            finished_at=finished_at - timedelta(minutes=30),
            duration_seconds=0.0,
            error_detail='Cleared by test isolation',
        )
        cache.delete('scheduler:inflight:daily-backfill-prices-1700')
        cache.delete('scheduler:manual_run:daily-backfill-prices-1700')

        run_log = ServiceRunLog.objects.create(
            service=service,
            status='success',
            input_summary={'job_key': 'daily-backfill-prices-1700', 'triggered_by': 'beat_schedule'},
            output_summary={'planned_items': 1536},
        )
        ServiceRunLog.objects.filter(pk=run_log.pk).update(
            started_at=finished_at - timedelta(minutes=15),
            finished_at=finished_at,
            duration_seconds=900.0,
        )

        catalog = build_scheduler_catalog(schedule_map=_CRON_SCHEDULE)
        job = next(j for j in catalog if j['job_key'] == 'daily-backfill-prices-1700')

        self.assertEqual(job['status'], 'degraded')
        self.assertEqual(job['freshness_state'], 'stale')
        self.assertIn('(86400s)', job['status_reason'])
        self.assertIn('lag=', job['status_reason'])

    def test_hourly_job_uses_hourly_freshness_window(self):
        from django_celery_beat.models import IntervalSchedule, PeriodicTask

        last_run_at = timezone.now() - timedelta(minutes=30)
        interval, _ = IntervalSchedule.objects.get_or_create(every=1, period=IntervalSchedule.HOURS)
        PeriodicTask.objects.update_or_create(
            name='market-data-parity-snapshot-retention-cleanup-hourly',
            defaults={
                'task': 'service_ops.tasks.cleanup_market_data_parity_snapshots',
                'interval': interval,
                'enabled': True,
                'last_run_at': last_run_at,
                'total_run_count': 3,
                'queue': 'manual_on_demand',
            },
        )

        schedule_map = {
            'market-data-parity-snapshot-retention-cleanup-hourly': {
                'task': 'service_ops.tasks.cleanup_market_data_parity_snapshots',
                'schedule': 3600.0,
                'options': {'queue': 'manual_on_demand'},
            },
        }

        catalog = build_scheduler_catalog(schedule_map=schedule_map)
        job = next(j for j in catalog if j['job_key'] == 'market-data-parity-snapshot-retention-cleanup-hourly')

        self.assertEqual(job['status'], 'enabled')
        self.assertEqual(job['freshness_state'], 'warm')
        self.assertIsNone(job['status_reason'])
        self.assertGreaterEqual(job['lag_seconds'], 30 * 60)
        self.assertLess(job['lag_seconds'], (30 * 60) + 60)

    def test_weekly_job_uses_weekly_freshness_window(self):
        from django_celery_beat.models import CrontabSchedule, PeriodicTask

        last_run_at = timezone.now() - timedelta(days=2)
        crontab, _ = CrontabSchedule.objects.get_or_create(
            minute='0',
            hour='1',
            day_of_week='0',
            day_of_month='*',
            month_of_year='*',
            timezone='UTC',
        )
        PeriodicTask.objects.update_or_create(
            name='auto-deprovision-stale',
            defaults={
                'task': 'tenant_lifecycle.tasks.auto_deprovision_stale',
                'crontab': crontab,
                'enabled': True,
                'last_run_at': last_run_at,
                'total_run_count': 2,
                'queue': 'celery',
            },
        )

        schedule_map = {
            'auto-deprovision-stale': {
                'task': 'tenant_lifecycle.tasks.auto_deprovision_stale',
                'schedule': 'cron(day_of_week=0, hour=1, minute=0)',
                'options': {'queue': 'celery'},
            },
        }

        catalog = build_scheduler_catalog(schedule_map=schedule_map)
        job = next(j for j in catalog if j['job_key'] == 'auto-deprovision-stale')

        self.assertEqual(job['status'], 'enabled')
        self.assertEqual(job['freshness_state'], 'warm')
        self.assertIsNone(job['status_reason'])
        self.assertGreaterEqual(job['lag_seconds'], 2 * 24 * 3600)
        self.assertLess(job['lag_seconds'], (2 * 24 * 3600) + 60)

    def test_cron_next_run_uses_crontab_timezone(self):
        from datetime import datetime

        from django_celery_beat.models import CrontabSchedule, PeriodicTask

        crontab, _ = CrontabSchedule.objects.get_or_create(
            minute='5',
            hour='17',
            day_of_week='*',
            day_of_month='*',
            month_of_year='*',
            timezone='Asia/Ho_Chi_Minh',
        )
        PeriodicTask.objects.update_or_create(
            name='daily-backfill-prices-1700',
            defaults={
                'task': 'data_ingest.tasks.backfill_daily_prices',
                'crontab': crontab,
                'enabled': True,
                'queue': 'enrichment_offhours',
            },
        )

        schedule_map = {
            'daily-backfill-prices-1700': {
                'task': 'data_ingest.tasks.backfill_daily_prices',
                'schedule': 'cron(hour=17, minute=5)',
                'options': {'queue': 'enrichment_offhours'},
            },
        }

        catalog = build_scheduler_catalog(schedule_map=schedule_map)
        job = next(j for j in catalog if j['job_key'] == 'daily-backfill-prices-1700')

        self.assertIsNotNone(job['next_run_at'])
        next_run = datetime.fromisoformat(job['next_run_at'])
        self.assertEqual(next_run.utcoffset(), timedelta(hours=7))
        self.assertEqual(next_run.hour, 17)
        self.assertIn(next_run.minute, (4, 5))



class SchedulerHealthSummaryUnitTests(TestCase):
    """Unit tests cho build_scheduler_health_summary()."""

    def test_health_summary_has_required_fields(self):
        catalog = build_scheduler_catalog(schedule_map=_MINIMAL_SCHEDULE)
        summary = build_scheduler_health_summary(catalog=catalog)
        required = {
            'generated_at', 'overall_health', 'jobs_total',
            'by_status', 'by_domain', 'by_freshness',
            'enabled_count', 'degraded_count', 'unregistered_count',
        }
        for field in required:
            self.assertIn(field, summary)

    def test_health_summary_jobs_total(self):
        catalog = build_scheduler_catalog(schedule_map=_MINIMAL_SCHEDULE)
        summary = build_scheduler_health_summary(catalog=catalog)
        self.assertEqual(summary['jobs_total'], len(_MINIMAL_SCHEDULE))

    def test_health_summary_unregistered_equals_total_when_no_periodic_tasks(self):
        catalog = build_scheduler_catalog(schedule_map=_MINIMAL_SCHEDULE)
        summary = build_scheduler_health_summary(catalog=catalog)
        # No PeriodicTask in test DB -> all unregistered
        self.assertEqual(summary['unregistered_count'], len(_MINIMAL_SCHEDULE))

    def test_health_summary_overall_health_degraded_when_unregistered(self):
        catalog = build_scheduler_catalog(schedule_map=_MINIMAL_SCHEDULE)
        summary = build_scheduler_health_summary(catalog=catalog)
        # Unregistered jobs -> degraded
        self.assertEqual(summary['overall_health'], 'degraded')

    def test_health_summary_healthy_when_empty_catalog(self):
        summary = build_scheduler_health_summary(catalog=[])
        self.assertEqual(summary['jobs_total'], 0)
        self.assertEqual(summary['overall_health'], 'healthy')


class SchedulerPlanApiTests(TestCase):
    """API contract tests cho GET /core/v1/operator/scraping/dataops/scheduler/plan/."""

    @classmethod
    def setUpTestData(cls):
        ensure_service_registry()
        cls.admin = User.objects.create_user(
            username='sched-admin-s01',
            email='sched-admin-s01@test.local',
            password='pass123',
        )
        cls.admin.is_staff = True
        cls.admin.is_superuser = True
        cls.admin.save(update_fields=['is_staff', 'is_superuser'])

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_plan_returns_200(self):
        response = self.client.get('/core/v1/operator/scraping/dataops/scheduler/plan/')
        self.assertEqual(response.status_code, 200)

    def test_plan_has_required_envelope_fields(self):
        response = self.client.get('/core/v1/operator/scraping/dataops/scheduler/plan/')
        data = unwrapped_json(response)
        self.assertIn('generated_at', data)
        self.assertIn('jobs_total', data)
        self.assertIn('jobs', data)
        self.assertIn('ownership', data)

    def test_plan_jobs_is_list(self):
        response = self.client.get('/core/v1/operator/scraping/dataops/scheduler/plan/')
        data = unwrapped_json(response)
        self.assertIsInstance(data['jobs'], list)

    def test_plan_jobs_total_matches_jobs_length(self):
        response = self.client.get('/core/v1/operator/scraping/dataops/scheduler/plan/')
        data = unwrapped_json(response)
        self.assertEqual(data['jobs_total'], len(data['jobs']))

    def test_plan_domain_filter_query_param(self):
        response = self.client.get('/core/v1/operator/scraping/dataops/scheduler/plan/?domain=platform')
        self.assertEqual(response.status_code, 200)
        data = unwrapped_json(response)
        for job in data['jobs']:
            self.assertEqual(job['domain'], 'platform')

    def test_plan_requires_auth(self):
        client = APIClient()
        response = client.get('/core/v1/operator/scraping/dataops/scheduler/plan/')
        self.assertEqual(response.status_code, 401)

    def test_plan_requires_admin(self):
        regular_user = User.objects.create_user(
            username='sched-regular-s01',
            email='sched-regular-s01@test.local',
            password='pass123',
        )
        client = APIClient()
        client.force_authenticate(user=regular_user)
        response = client.get('/core/v1/operator/scraping/dataops/scheduler/plan/')
        self.assertEqual(response.status_code, 403)


class SchedulerHealthApiTests(TestCase):
    """API contract tests cho GET /core/v1/operator/scraping/dataops/scheduler/health/."""

    @classmethod
    def setUpTestData(cls):
        ensure_service_registry()
        cls.admin = User.objects.create_user(
            username='sched-admin-health',
            email='sched-admin-health@test.local',
            password='pass123',
        )
        cls.admin.is_staff = True
        cls.admin.is_superuser = True
        cls.admin.save(update_fields=['is_staff', 'is_superuser'])

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_health_returns_200(self):
        response = self.client.get('/core/v1/operator/scraping/dataops/scheduler/health/')
        self.assertEqual(response.status_code, 200)

    def test_health_has_required_fields(self):
        response = self.client.get('/core/v1/operator/scraping/dataops/scheduler/health/')
        data = unwrapped_json(response)
        for field in ('generated_at', 'overall_health', 'jobs_total', 'by_status', 'by_domain', 'by_freshness'):
            self.assertIn(field, data)

    def test_health_jobs_total_is_int(self):
        response = self.client.get('/core/v1/operator/scraping/dataops/scheduler/health/')
        data = unwrapped_json(response)
        self.assertIsInstance(data['jobs_total'], int)

    def test_health_requires_auth(self):
        client = APIClient()
        response = client.get('/core/v1/operator/scraping/dataops/scheduler/health/')
        self.assertEqual(response.status_code, 401)


class SchedulerJobHistoryApiTests(TestCase):
    """API contract tests cho GET .../scheduler/jobs/{job_key}/history/."""

    @classmethod
    def setUpTestData(cls):
        ensure_service_registry()
        cls.admin = User.objects.create_user(
            username='sched-admin-hist',
            email='sched-admin-hist@test.local',
            password='pass123',
        )
        cls.admin.is_staff = True
        cls.admin.is_superuser = True
        cls.admin.save(update_fields=['is_staff', 'is_superuser'])

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_history_known_job_returns_200(self):
        response = self.client.get(
            '/core/v1/operator/scraping/dataops/scheduler/jobs/market-data-queue-tier-scheduler-30s/history/'
        )
        self.assertEqual(response.status_code, 200)

    def test_history_response_has_count_and_results(self):
        response = self.client.get(
            '/core/v1/operator/scraping/dataops/scheduler/jobs/market-data-queue-tier-scheduler-30s/history/'
        )
        data = unwrapped_json(response)
        self.assertIn('job_key', data)
        self.assertIn('count', data)
        self.assertIn('results', data)
        self.assertEqual(data['job_key'], 'market-data-queue-tier-scheduler-30s')

    def test_history_unknown_job_returns_404(self):
        response = self.client.get(
            '/core/v1/operator/scraping/dataops/scheduler/jobs/non-existent-job-xyz/history/'
        )
        self.assertEqual(response.status_code, 404)
        data = unwrapped_json(response)
        self.assertIn('detail', data)
        self.assertEqual(data['code'], 'SCHEDULER_JOB_NOT_FOUND')
