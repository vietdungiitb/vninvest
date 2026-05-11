from unittest.mock import MagicMock, patch

from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from portfolio.ai_options import ADVISORY_CAPABILITY
from portfolio.models import SignalServiceRun, UserConfig


class ManualQueuePolicySignalAdminTests(APITestCase):
    def setUp(self):
        self.staff = User.objects.create_user(username='signal-admin-queue-staff', password='Test@123456', is_staff=True)
        self.client.force_authenticate(user=self.staff)

    @patch('portfolio.views_signal_admin.detect_and_store_global_whale_alerts.apply_async')
    def test_signal_admin_jobs_run_queues_manual_on_demand_for_whale(self, mock_apply_async):
        mock_apply_async.return_value = MagicMock(id='whale-run-1')

        response = self.client.post(
            '/api/admin-ops/signals/jobs/run/',
            {'service_domain': 'whale', 'symbol': 'FPT'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertTrue(response.data['ok'])
        self.assertEqual(mock_apply_async.call_args.kwargs.get('queue'), 'manual_on_demand')
        self.assertEqual(mock_apply_async.call_args.kwargs['kwargs']['symbol'], 'FPT')

    @patch('portfolio.views_signal_admin.detect_and_store_order_flow.apply_async')
    def test_signal_admin_job_retry_queues_manual_on_demand_for_dark_flow(self, mock_apply_async):
        mock_apply_async.return_value = MagicMock(id='dark-flow-retry-1')
        run = SignalServiceRun.objects.create(
            service_domain=SignalServiceRun.ServiceDomain.DARK_FLOW,
            run_type=SignalServiceRun.RunType.MANUAL,
            status=SignalServiceRun.StatusChoices.FAILED,
            params_json={'symbol': 'VCB'},
            created_by=self.staff,
        )

        response = self.client.post(f'/api/admin-ops/signals/jobs/{run.id}/retry/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertTrue(response.data['ok'])
        self.assertEqual(mock_apply_async.call_args.kwargs.get('queue'), 'manual_on_demand')
        self.assertEqual(mock_apply_async.call_args.kwargs['kwargs']['symbol'], 'VCB')


class ManualQueuePolicyStockNewsTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='stock-news-queue-user', password='Test@123456')
        self.client.force_authenticate(user=self.user)
        cfg, _ = UserConfig.objects.get_or_create(user=self.user)
        cfg.email_verified = True
        cfg.ai_provider = 'openai'
        cfg.ai_model = 'gpt-4o'
        cfg.set_ai_api_key('unit-test-ai-key')
        cfg.save(update_fields=['email_verified', 'ai_provider', 'ai_model', 'ai_api_key', 'updated_at'])

    @patch('portfolio.adapters.cache_adapter.set_cache')
    @patch('portfolio.views_stock_news.stock_news_api')
    @patch('portfolio.ai_options.get_model_entry')
    @patch('portfolio.ai_options.is_valid_provider', return_value=True)
    @patch('portfolio.tasks_news_digest.generate_stock_news_ai_summary_task.apply_async')
    def test_stock_news_ai_summary_queues_manual_on_demand(
        self,
        mock_apply_async,
        _mock_valid_provider,
        mock_model_entry,
        mock_stock_news_api,
        _mock_set_cache,
    ):
        mock_model_entry.return_value = {'capabilities': [ADVISORY_CAPABILITY]}
        mock_task = MagicMock()
        mock_task.get.return_value = {
            'summary': 'Tom tat tin tuc',
            'full': 'Phan tich tin tuc',
            'item_count': 2,
            'prompt_tokens': 10,
            'completion_tokens': 20,
        }
        mock_apply_async.return_value = mock_task
        from rest_framework.response import Response

        mock_stock_news_api.return_value = Response(
            {
                'symbol': 'BCM',
                'items': [
                    {'title': 'Tin 1', 'source': 'source-a', 'published_at': '2026-05-11T08:00:00+07:00'},
                    {'title': 'Tin 2', 'source': 'source-b', 'published_at': '2026-05-11T09:00:00+07:00'},
                ],
                'fetched_at': '2026-05-11T09:30:00+07:00',
                'unavailable': False,
            }
        )

        response = self.client.post(
            '/api/stock-management/stocks/BCM/news/ai-summary/',
            {'force_refresh': True},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['summary'], 'Tom tat tin tuc')
        self.assertEqual(response.data['full'], 'Phan tich tin tuc')
        self.assertEqual(mock_apply_async.call_args.kwargs.get('queue'), 'manual_on_demand')
        self.assertEqual(mock_apply_async.call_args.kwargs['kwargs']['user_config_id'], self.user.user_config.id)