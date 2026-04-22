from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from portfolio.models import CrawlJob, CrawlRun
from portfolio.services_service_control import acquire_job_lock, _REDIS_CLIENT, _lock_key

User = get_user_model()

class AdminCrawlControlTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(username='admin_crawl', password='pw')
        from portfolio.models import UserConfig
        UserConfig.objects.create(user=self.user, plan='admin')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.job = CrawlJob.objects.create(
            service_code='test_job',
            description='Test crawling job',
            is_active=True
        )

    def tearDown(self):
        _REDIS_CLIENT.delete(_lock_key(self.job.id))

    def test_run_endpoint_creates_run_and_dispatches_task(self):
        url = f'/api/v1/admin/crawl/jobs/{self.job.id}/run/'
        res = self.client.post(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        run = CrawlRun.objects.get(id=res.data['run_id'])
        self.assertEqual(run.status, 'queued')
        self.assertEqual(run.trigger_type, 'manual')

    def test_stop_endpoint_revokes_task_and_releases_lock(self):
        # Create a run that simulates running
        run = CrawlRun.objects.create(
            job=self.job,
            status='running',
            trigger_type='manual',
            task_id='test-celery-id-123'
        )
        # Acquire lock to simulate worker holding it
        lock = acquire_job_lock(self.job.id, task_id='test-celery-id-123')
        self.assertIsNotNone(lock)
        
        # Another process shouldn't be able to get it
        self.assertIsNone(acquire_job_lock(self.job.id, task_id='other-task', timeout=0))

        # Stop the job
        url = f'/api/v1/admin/crawl/jobs/{self.job.id}/stop/'
        res = self.client.post(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        
        run.refresh_from_db()
        self.assertEqual(run.status, 'failed')
        self.assertIn('Force stopped by admin', run.log)

        # Ensure lock was released safely by token
        lock_val = _REDIS_CLIENT.get(_lock_key(self.job.id))
        self.assertIsNone(lock_val)
        
    def test_stop_endpoint_does_not_release_lock_if_token_mismatches(self):
        run = CrawlRun.objects.create(
            job=self.job,
            status='running',
            trigger_type='manual',
            task_id='test-celery-id-OLD'
        )
        # Simulate that a new worker actually holds the lock
        lock = acquire_job_lock(self.job.id, task_id='test-celery-id-NEW')
        
        url = f'/api/v1/admin/crawl/jobs/{self.job.id}/stop/'
        res = self.client.post(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        
        # Ensure lock was NOT released because the token didn't match old run
        lock_val = _REDIS_CLIENT.get(_lock_key(self.job.id))
        self.assertEqual(lock_val.decode(), 'test-celery-id-NEW')
        
        # Cleanup
        lock.release()

    def test_run_inactive_job_forbidden(self):
        self.job.is_active = False
        self.job.save()
        url = f'/api/v1/admin/crawl/jobs/{self.job.id}/run/'
        res = self.client.post(url)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_stop_no_active_run(self):
        url = f'/api/v1/admin/crawl/jobs/{self.job.id}/stop/'
        res = self.client.post(url)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
