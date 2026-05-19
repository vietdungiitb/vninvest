"""
Tests cho S01 — Scheduler Catalog Contract.

Verifies:
1. build_scheduler_catalog() trả đúng fields và types.
2. domain_filter hoạt động.
3. API endpoints plan/health/history return đúng HTTP status và payload shape.
4. Ownership guard được nhúng vào plan response.
"""

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from service_ops.registry import ensure_service_registry
from service_ops.scheduler_catalog import (
    CATALOG_JOB_METADATA,
    build_scheduler_catalog,
    build_scheduler_health_summary,
)

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
        data = response.json()
        self.assertIn('generated_at', data)
        self.assertIn('jobs_total', data)
        self.assertIn('jobs', data)
        self.assertIn('ownership', data)

    def test_plan_jobs_is_list(self):
        response = self.client.get('/core/v1/operator/scraping/dataops/scheduler/plan/')
        data = response.json()
        self.assertIsInstance(data['jobs'], list)

    def test_plan_jobs_total_matches_jobs_length(self):
        response = self.client.get('/core/v1/operator/scraping/dataops/scheduler/plan/')
        data = response.json()
        self.assertEqual(data['jobs_total'], len(data['jobs']))

    def test_plan_domain_filter_query_param(self):
        response = self.client.get('/core/v1/operator/scraping/dataops/scheduler/plan/?domain=platform')
        self.assertEqual(response.status_code, 200)
        data = response.json()
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
        data = response.json()
        for field in ('generated_at', 'overall_health', 'jobs_total', 'by_status', 'by_domain', 'by_freshness'):
            self.assertIn(field, data)

    def test_health_jobs_total_is_int(self):
        response = self.client.get('/core/v1/operator/scraping/dataops/scheduler/health/')
        data = response.json()
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
        data = response.json()
        self.assertIn('job_key', data)
        self.assertIn('count', data)
        self.assertIn('results', data)
        self.assertEqual(data['job_key'], 'market-data-queue-tier-scheduler-30s')

    def test_history_unknown_job_returns_404(self):
        response = self.client.get(
            '/core/v1/operator/scraping/dataops/scheduler/jobs/non-existent-job-xyz/history/'
        )
        self.assertEqual(response.status_code, 404)
        data = response.json()
        self.assertIn('detail', data)
        self.assertEqual(data['code'], 'SCHEDULER_JOB_NOT_FOUND')
