from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from portfolio.models import WhaleServiceJob, UserConfig
from portfolio.whale_service_manager import WhaleJobManager
from unittest.mock import patch

class WhaleServiceOrchestrationTests(TestCase):
    def setUp(self):
        self.admin_user = User.objects.create_superuser(username='admin', password='password', email='admin@example.com')
        UserConfig.objects.create(user=self.admin_user, plan='admin')
        
        self.pro_user = User.objects.create_user(username='pro_user', password='password')
        UserConfig.objects.create(user=self.pro_user, plan='pro')

        self.free_user = User.objects.create_user(username='free_user', password='password')
        UserConfig.objects.create(user=self.free_user, plan='free')

        self.staff_free_user = User.objects.create_user(username='staff_free_user', password='password', is_staff=True)
        UserConfig.objects.create(user=self.staff_free_user, plan='free')
        
        self.client = APIClient(HTTP_HOST='localhost')

    @patch('portfolio.tasks_whale_service.whale_service_job_task.delay')
    def test_trigger_user_refresh_pro_user(self, mock_task):
        self.client.force_authenticate(user=self.pro_user)
        payload = {
            "service_type": "USER_REFRESH",
            "params": {"symbol": "VNM"}
        }
        response = self.client.post('/api/portfolio/whale-service/trigger/', payload, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'accepted')
        job_id = response.data['job']['id']
        mock_task.assert_called_once_with(job_id)
        
        job = WhaleServiceJob.objects.get(id=job_id)
        self.assertEqual(job.service_type, WhaleServiceJob.ServiceType.USER_REFRESH)
        self.assertEqual(job.params['symbol'], 'VNM')

    def test_trigger_backfill_admin_only(self):
        # Pro user should be denied
        self.client.force_authenticate(user=self.pro_user)
        payload = {
            "service_type": "BACKFILL",
            "params": {"symbols": ["VNM"], "start_date": "2026-01-01", "end_date": "2026-01-02"}
        }
        response = self.client.post('/api/portfolio/whale-service/trigger/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Admin user should be allowed
        self.client.force_authenticate(user=self.admin_user)
        with patch('portfolio.tasks_whale_service.whale_service_job_task.delay'):
            response = self.client.post('/api/portfolio/whale-service/trigger/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_trigger_user_refresh_free_user_forbidden(self):
        self.client.force_authenticate(user=self.free_user)
        payload = {
            "service_type": "USER_REFRESH",
            "params": {"symbol": "VNM"}
        }
        response = self.client.post('/api/portfolio/whale-service/trigger/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_trigger_backfill_staff_without_pro_admin_forbidden(self):
        self.client.force_authenticate(user=self.staff_free_user)
        payload = {
            "service_type": "BACKFILL",
            "params": {"symbols": ["VNM"], "start_date": "2026-01-01", "end_date": "2026-01-02"}
        }
        response = self.client.post('/api/portfolio/whale-service/trigger/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @patch('portfolio.tasks_whale_service.whale_service_job_task.delay')
    def test_idempotency_conflict(self, mock_task):
        self.client.force_authenticate(user=self.admin_user)
        payload = {
            "service_type": "BACKFILL",
            "params": {"symbols": ["VNM"], "start_date": "2026-01-01", "end_date": "2026-01-02"}
        }
        
        # Trigger first time
        resp1 = self.client.post('/api/portfolio/whale-service/trigger/', payload, format='json')
        self.assertEqual(resp1.status_code, status.HTTP_201_CREATED)
        
        # Trigger second time with same params
        resp2 = self.client.post('/api/portfolio/whale-service/trigger/', payload, format='json')
        self.assertEqual(resp2.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(resp2.data['status'], 'duplicate')

    def test_mark_job_skipped_duplicate_finalizes_pending(self):
        job = WhaleServiceJob.objects.create(
            service_type=WhaleServiceJob.ServiceType.USER_REFRESH,
            status=WhaleServiceJob.StatusChoices.PENDING,
            params={"symbol": "VNM", "user_id": self.pro_user.id},
            idempotency_key='k1',
            lock_key='whale:lock:user_refresh:test',
            created_by=self.pro_user,
        )
        marked = WhaleJobManager.mark_job_skipped_duplicate(job.id, 'conflict')
        self.assertTrue(marked)

        job.refresh_from_db()
        self.assertEqual(job.status, WhaleServiceJob.StatusChoices.SKIPPED_DUPLICATE)
        self.assertIsNotNone(job.finished_at)
        self.assertIn('conflict', job.log)
