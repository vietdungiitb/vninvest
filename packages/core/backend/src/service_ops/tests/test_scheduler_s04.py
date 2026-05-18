# -*- coding: utf-8 -*-
"""Tests for S04: Runtime Status Aggregator — history endpoint + inflight enrichment."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from service_ops.registry import ensure_service_registry

User = get_user_model()

_HISTORY_URL = '/core/v1/operator/scraping/dataops/scheduler/jobs/{job_key}/history/'


class SchedulerJobHistoryS04Tests(TestCase):
    """S04: history endpoint returns ServiceRunLog data."""

    @classmethod
    def setUpTestData(cls):
        ensure_service_registry()
        cls.admin = User.objects.create_user(
            username='sched-s04-admin',
            email='sched-s04-admin@test.local',
            password='pass123',
        )
        cls.admin.is_staff = True
        cls.admin.is_superuser = True
        cls.admin.save(update_fields=['is_staff', 'is_superuser'])

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def test_history_returns_pagination_fields(self):
        url = _HISTORY_URL.format(job_key='market-data-queue-tier-scheduler-30s')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('count', data)
        self.assertIn('page', data)
        self.assertIn('page_size', data)
        self.assertIn('total_pages', data)
        self.assertIn('results', data)

    def test_history_count_is_int(self):
        url = _HISTORY_URL.format(job_key='market-data-queue-tier-scheduler-30s')
        response = self.client.get(url)
        data = response.json()
        self.assertIsInstance(data['count'], int)

    def test_history_results_is_list(self):
        url = _HISTORY_URL.format(job_key='market-data-queue-tier-scheduler-30s')
        response = self.client.get(url)
        data = response.json()
        self.assertIsInstance(data['results'], list)

    def test_history_shows_run_log_when_service_key_mapped(self):
        """If service_key is mapped, ServiceRunLog entries appear in history."""
        from service_ops.models import ServiceDefinition, ServiceRunLog
        # Only runs if the service registry has vnbroker_price_board
        svc = ServiceDefinition.objects.filter(service_key='vnbroker_price_board').first()
        if svc is None:
            self.skipTest('vnbroker_price_board service not in registry')
        run_log = ServiceRunLog.objects.create(
            service=svc,
            celery_task_id='test-task-s04-xyz',
            status='success',
        )
        url = _HISTORY_URL.format(job_key='market-data-queue-tier-scheduler-30s')
        response = self.client.get(url)
        data = response.json()
        self.assertGreater(data['count'], 0)
        ids = [r['id'] for r in data['results']]
        self.assertIn(run_log.pk, ids)
        run_log.delete()

    def test_history_result_items_have_required_fields(self):
        """Each result item must have standard log fields."""
        from service_ops.models import ServiceDefinition, ServiceRunLog
        svc = ServiceDefinition.objects.filter(service_key='vnbroker_price_board').first()
        if svc is None:
            self.skipTest('vnbroker_price_board service not in registry')
        run_log = ServiceRunLog.objects.create(
            service=svc,
            celery_task_id='test-task-s04-fields',
            status='success',
        )
        url = _HISTORY_URL.format(job_key='market-data-queue-tier-scheduler-30s')
        response = self.client.get(url)
        data = response.json()
        if data['results']:
            item = data['results'][0]
            for field in ('id', 'celery_task_id', 'status', 'started_at'):
                self.assertIn(field, item)
        run_log.delete()

    def test_history_unknown_job_returns_404(self):
        url = _HISTORY_URL.format(job_key='non-existent-scheduler-job-s04')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 404)

    def test_history_page_size_param_respected(self):
        url = _HISTORY_URL.format(job_key='market-data-queue-tier-scheduler-30s')
        response = self.client.get(url + '?page_size=5')
        data = response.json()
        self.assertLessEqual(len(data['results']), 5)
        self.assertEqual(data['page_size'], 5)


class SchedulerCatalogInflightEnrichmentTests(TestCase):
    """S04: is_inflight enrichment in catalog from ServiceRunLog."""

    @classmethod
    def setUpTestData(cls):
        ensure_service_registry()

    def test_inflight_is_true_when_running_run_log_exists(self):
        """build_scheduler_catalog marks is_inflight=True when ServiceRunLog status=running."""
        from service_ops.models import ServiceDefinition, ServiceRunLog
        from service_ops.scheduler_catalog import build_scheduler_catalog

        svc = ServiceDefinition.objects.filter(service_key='vnbroker_price_board').first()
        if svc is None:
            self.skipTest('vnbroker_price_board service not in registry')

        run_log = ServiceRunLog.objects.create(
            service=svc,
            celery_task_id='test-inflight-catalog',
            status='running',
        )
        import service_ops.scheduler_catalog as cat_mod
        schedule = {
            'market-data-queue-tier-scheduler-30s': {
                'task': 'service_ops.run_market_data_queue_tier_scheduler',
                'schedule': 30.0,
                'options': {'queue': 'manual_on_demand'},
            }
        }
        catalog = build_scheduler_catalog(schedule_map=schedule)
        job = next((j for j in catalog if j['job_key'] == 'market-data-queue-tier-scheduler-30s'), None)
        self.assertIsNotNone(job)
        self.assertTrue(job['is_inflight'])
        self.assertEqual(job['status'], 'running')
        run_log.delete()

    def test_inflight_is_false_when_no_running_logs(self):
        """build_scheduler_catalog marks is_inflight=False when no running ServiceRunLog."""
        from service_ops.scheduler_catalog import build_scheduler_catalog
        schedule = {
            'market-data-queue-tier-scheduler-30s': {
                'task': 'service_ops.run_market_data_queue_tier_scheduler',
                'schedule': 30.0,
                'options': {'queue': 'manual_on_demand'},
            }
        }
        catalog = build_scheduler_catalog(schedule_map=schedule)
        job = next((j for j in catalog if j['job_key'] == 'market-data-queue-tier-scheduler-30s'), None)
        self.assertIsNotNone(job)
        self.assertFalse(job['is_inflight'])
