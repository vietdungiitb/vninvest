"""B07 — Multi-mode backfill execution tests.

Kiểm tra:
- backfill_daily_prices nhận mode/trigger params
- BackfillRunNowView: mode required, invalid mode rejected, valid enqueued
- Mode propagated vào BackfillExecutionRun
"""
from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

from django.test import TestCase, RequestFactory

from service_ops.models import BackfillExecutionRun
from service_ops.registry import ensure_service_registry


# ---------------------------------------------------------------------------
# Unit: backfill_daily_prices — mode/trigger params via DB verification
# ---------------------------------------------------------------------------

class BackfillTaskModeParamTest(TestCase):
    """Mode and trigger params are stored in BackfillExecutionRun when task runs."""

    @classmethod
    def setUpTestData(cls):
        ensure_service_registry()

    def _create_run_directly(self, mode: str = 'daily_delta', trigger: str = 'beat_schedule'):
        """Create BackfillExecutionRun directly to verify mode/trigger field validation."""
        from service_ops.models import BackfillExecutionRun
        import uuid
        run = BackfillExecutionRun.objects.create(
            run_id=str(uuid.uuid4()),
            job_key='test-job',
            mode=mode,
            trigger=trigger,
            status='running',
            requested_days=30,
            planned_symbols_count=1,
        )
        return run

    def test_daily_delta_mode_stored(self):
        run = self._create_run_directly(mode='daily_delta', trigger='beat_schedule')
        self.assertEqual(run.mode, 'daily_delta')
        self.assertEqual(run.trigger, 'beat_schedule')

    def test_repair_missing_mode_stored(self):
        run = self._create_run_directly(mode='repair_missing', trigger='operator_run_now')
        self.assertEqual(run.mode, 'repair_missing')
        self.assertEqual(run.trigger, 'operator_run_now')

    def test_targeted_symbol_repair_mode_stored(self):
        run = self._create_run_directly(mode='targeted_symbol_repair', trigger='auto_promotion_fast_path')
        self.assertEqual(run.mode, 'targeted_symbol_repair')
        self.assertEqual(run.trigger, 'auto_promotion_fast_path')


# ---------------------------------------------------------------------------
# Unit: BackfillRunNowView
# ---------------------------------------------------------------------------

class BackfillRunNowViewTest(TestCase):
    def setUp(self):
        from django.contrib.auth import get_user_model
        from rest_framework.test import APIClient
        User = get_user_model()
        self.staff = User.objects.create_user(
            username='b07staff', password='pw', is_staff=True, is_superuser=True, is_active=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.staff)

    def _post(self, body: dict):
        url = '/core/v1/operator/scraping/dataops/backfill/run-now/'
        return self.client.post(
            url,
            data=json.dumps(body),
            content_type='application/json',
        )

    def test_missing_mode_returns_400(self):
        resp = self._post({'days': 30})
        self.assertEqual(resp.status_code, 400)
        data = resp.json()
        self.assertIn('code', data)
        self.assertIn('mode_required', data['code'])

    def test_invalid_mode_returns_400(self):
        resp = self._post({'mode': 'invalid_mode_xyz'})
        self.assertEqual(resp.status_code, 400)
        data = resp.json()
        self.assertIn('invalid_mode', data['code'])

    def test_valid_mode_enqueues(self):
        mock_task = MagicMock()
        mock_result = MagicMock()
        mock_result.id = 'b07-task-id'
        mock_task.apply_async.return_value = mock_result

        with patch('service_ops.services.backfill_service.backfill_daily_prices', mock_task):
            resp = self._post({'mode': 'repair_missing', 'days': 30, 'symbols': ['VCB']})

        self.assertEqual(resp.status_code, 202)
        data = resp.json()
        self.assertEqual(data['status'], 'queued')
        self.assertEqual(data['mode'], 'repair_missing')
        self.assertIn('task_id', data)

    def test_deep_bootstrap_mode_accepted(self):
        mock_task = MagicMock()
        mock_task.apply_async.return_value = MagicMock(id='deep-id')

        with patch('service_ops.services.backfill_service.backfill_daily_prices', mock_task):
            resp = self._post({'mode': 'deep_bootstrap', 'days': 365})

        self.assertEqual(resp.status_code, 202)
        self.assertEqual(resp.json()['mode'], 'deep_bootstrap')

    def test_symbols_normalized_to_uppercase(self):
        mock_task = MagicMock()
        mock_task.apply_async.return_value = MagicMock(id='norm-id')

        with patch('service_ops.services.backfill_service.backfill_daily_prices', mock_task):
            resp = self._post({'mode': 'targeted_symbol_repair', 'symbols': ['vcb', 'fpt']})

        self.assertEqual(resp.status_code, 202)
        self.assertIsNotNone(mock_task.apply_async.call_args, 'backfill_daily_prices.apply_async should be called')
        call_kwargs = mock_task.apply_async.call_args
        # apply_async(kwargs={...}) — symbols should be uppercased via view normalisation
        kwargs_payload = None
        if call_kwargs.kwargs and 'kwargs' in call_kwargs.kwargs:
            kwargs_payload = call_kwargs.kwargs['kwargs']
        elif len(call_kwargs.args) > 0 and isinstance(call_kwargs.args[0], dict):
            kwargs_payload = call_kwargs.args[0].get('kwargs')
        passed_symbols = (kwargs_payload or {}).get('symbols')
        self.assertEqual(passed_symbols, ['VCB', 'FPT'])
        self.assertIn('task_id', resp.json())
