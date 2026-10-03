from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from service_ops.models import ServiceRunLog
from service_ops.registry import ensure_service_registry

User = get_user_model()


class DataIngestAdminViewTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        ensure_service_registry()
        cls.user = User.objects.create_user(
            username='data-ingest-admin',
            email='data-ingest-admin@test.local',
            password='pass123',
        )
        cls.user.is_staff = True
        cls.user.is_superuser = True
        cls.user.save(update_fields=['is_staff', 'is_superuser'])

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    @patch('data_ingest.views.ingest_daily_prices.apply_async', return_value=Mock(id='ingest-task-1'))
    def test_trigger_daily_prices_creates_service_run_log(self, ingest_apply_async_mock):
        response = self.client.post(
            '/core/v1/data-ingest/trigger/daily-prices/',
            {'days': 3, 'symbols': ['ACB', 'VCI']},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        payload = response.json()
        service_run_log = ServiceRunLog.objects.get(pk=payload['service_run_log_id'])
        self.assertEqual(service_run_log.service.service_key, 'vnbroker_history')
        self.assertEqual(service_run_log.status, 'queued')
        self.assertEqual(service_run_log.input_summary['days'], 3)
        self.assertEqual(service_run_log.input_summary['symbols'], ['ACB', 'VCI'])
        self.assertEqual(service_run_log.input_summary['requested_by'], self.user.username)
        ingest_apply_async_mock.assert_called_once_with(
            kwargs={
                'days': 3,
                'symbols': ['ACB', 'VCI'],
                'service_run_log_id': service_run_log.id,
            },
            countdown=0,
        )

    @patch('data_ingest.tasks.fetch_and_upsert_price_board.apply_async', return_value=Mock(id='price-board-task-1'))
    def test_trigger_price_board_creates_service_run_log(self, price_board_apply_async_mock):
        response = self.client.post(
            '/core/v1/data-ingest/trigger/price-board/',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        payload = response.json()
        service_run_log = ServiceRunLog.objects.get(pk=payload['service_run_log_id'])
        self.assertEqual(service_run_log.service.service_key, 'vnbroker_price_board')
        self.assertEqual(service_run_log.status, 'queued')
        self.assertEqual(service_run_log.input_summary['requested_by'], self.user.username)
        price_board_apply_async_mock.assert_called_once_with(
            kwargs={'service_run_log_id': service_run_log.id},
            countdown=0,
        )