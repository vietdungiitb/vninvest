from datetime import date, datetime, timedelta, timezone as datetime_timezone
from unittest.mock import MagicMock, patch

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from portfolio.global_signal_policy_helpers import get_global_signal_universe_policy
from portfolio.models import IntradayTick, OrderFlowSignal, SignalServiceRun, WhaleAlertEvent, WhaleConfigAuditLog, WhaleConfigDraft, WhaleConfigRollout, WhaleConfigVersion
from portfolio.services_global_whale_alerts import GLOBAL_WHALE_LATEST_EVENT_CACHE_PREFIX
from portfolio.tasks_order_flow import ORDER_FLOW_LATEST_SIGNAL_CACHE_PREFIX
from portfolio.views_signal_admin import _cached_heavy_count, HEAVY_COUNT_CACHE_TTL_SECONDS


class SignalAdminApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.staff = User.objects.create_user(username='signal-admin', password='Test@123456', is_staff=True)
        self.regular = User.objects.create_user(username='signal-user', password='Test@123456', is_staff=False)

    def _auth_staff(self):
        self.client.force_authenticate(user=self.staff)

    def _auth_regular(self):
        self.client.force_authenticate(user=self.regular)

    def test_summary_requires_staff(self):
        self._auth_regular()
        response = self.client.get('/api/admin-ops/signals/summary/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_summary_returns_whale_dark_flow_and_retention_structure(self):
        self._auth_staff()
        now = datetime.now(datetime_timezone.utc)

        whale_version = WhaleConfigVersion.objects.create(
            version_code='WHALE-2026-05-01',
            config_json={'whale_threshold': 800},
            status=WhaleConfigVersion.StatusChoices.ACTIVE,
            approved_at=now - timedelta(minutes=15),
            activated_at=now - timedelta(minutes=10),
        )
        WhaleConfigRollout.objects.create(
            version=whale_version,
            mode=WhaleConfigRollout.ModeChoices.NOW,
            status=WhaleConfigRollout.StatusChoices.RUNNING,
            started_at=now - timedelta(minutes=9),
            note='created_from_admin_apply',
        )

        WhaleAlertEvent.objects.create(
            event_id='whale:FPT:2026-04-28T09:15:00+00:00:BUY:700000000:redis_stream',
            symbol='FPT',
            side='BUY',
            matched_value_vnd=700_000_000,
            threshold_vnd=500_000_000,
            threshold_policy_version='threshold-v1',
            severity='urgent',
            event_score=8.4,
            confidence='high',
            source='redis_stream',
            source_layer='live',
            trade_date=date.today(),
            occurred_at=now,
            payload_json={'symbol': 'FPT', 'ts': now.isoformat()},
        )
        OrderFlowSignal.objects.create(
            symbol='VCB',
            signal_type=OrderFlowSignal.SignalType.ICEBERG,
            strength=74.0,
            confidence='high',
            tick_rate=3.0,
            small_order_ratio=0.3,
            cvd_at_signal=125.0,
            price_at_signal=100000,
            window_seconds=300,
            components_json={},
            event_id='dark_flow:VCB:2026-04-28T09:16:00+00:00:iceberg',
            severity=OrderFlowSignal.SeverityChoices.WARNING,
            trade_date=date.today(),
        )
        SignalServiceRun.objects.create(
            service_domain=SignalServiceRun.ServiceDomain.WHALE,
            run_type=SignalServiceRun.RunType.SCHEDULED,
            status=SignalServiceRun.StatusChoices.COMPLETED,
            processed_items=1,
            stored_items=1,
            started_at=now - timedelta(minutes=2),
            finished_at=now - timedelta(minutes=1),
        )
        SignalServiceRun.objects.create(
            service_domain=SignalServiceRun.ServiceDomain.DARK_FLOW,
            run_type=SignalServiceRun.RunType.SCHEDULED,
            status=SignalServiceRun.StatusChoices.FAILED,
            failed_items=1,
            started_at=now - timedelta(minutes=4),
            finished_at=now - timedelta(minutes=3),
        )
        SignalServiceRun.objects.create(
            service_domain=SignalServiceRun.ServiceDomain.DARK_FLOW,
            run_type=SignalServiceRun.RunType.MATERIALIZATION,
            status=SignalServiceRun.StatusChoices.QUEUED,
            params_json={'symbol': 'VCB'},
        )
        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:30:00', '%H:%M:%S').time(),
            price=100000,
            volume=1000,
            side='BUY',
            stream_id='fpt-retention-1',
        )
        cache.set(f'{GLOBAL_WHALE_LATEST_EVENT_CACHE_PREFIX}:FPT', {'cached_at': now.isoformat(), 'ts': now.isoformat()}, timeout=60)
        cache.set(
            f'{ORDER_FLOW_LATEST_SIGNAL_CACHE_PREFIX}:VCB',
            {
                'cached_at': now.isoformat(),
                'triggered_at': now.isoformat(),
                'bucket_facts': [
                    {
                        'bucket_ts': now.isoformat(),
                        'bucket_index': 0,
                        'bucket_seconds': 30,
                        'bucket_minutes': 0.5,
                        'tick_count': 4,
                        'small_order_count': 1,
                        'small_order_ratio': 0.25,
                        'buy_value': 2_000_000.0,
                        'sell_value': 500_000.0,
                        'total_value': 2_500_000.0,
                        'net_value': 1_500_000.0,
                        'cvd': 1_500_000.0,
                        'cumulative_cvd': 1_500_000.0,
                        'dominant_side': 'buy',
                        'max_tick_value': 1_000_000.0,
                        'first_trade_time': '09:30:00',
                        'last_trade_time': '09:30:30',
                    }
                ],
                'bucket_fact_count': 1,
                'session_summary': {
                    'symbol': 'VCB',
                    'window_minutes': 5,
                    'window_seconds': 300,
                    'bucket_fact_count': 1,
                    'tick_count': 4,
                    'total_buy_value': 2_000_000.0,
                    'total_sell_value': 500_000.0,
                    'net_value': 1_500_000.0,
                    'dominant_side': 'buy',
                    'signal_type': 'iceberg',
                    'strength': 74.0,
                    'confidence': 'high',
                    'tick_rate_per_min': 3.0,
                    'small_order_ratio': 0.3,
                    'signals_active': ['iceberg'],
                    'anomaly_count': 1,
                    'peak_bucket': {
                        'bucket_ts': now.isoformat(),
                        'bucket_index': 0,
                        'tick_count': 4,
                        'total_value': 2_500_000.0,
                        'net_value': 1_500_000.0,
                        'cumulative_cvd': 1_500_000.0,
                        'dominant_side': 'buy',
                    },
                },
                'anomaly_markers': [
                    {
                        'kind': 'iceberg',
                        'label': 'Iceberg',
                        'severity': 'warning',
                        'detected': True,
                        'strength': 30.0,
                        'repeat_count': 6,
                        'confidence': 'high',
                        'level': 100000,
                        'value_per_occurrence_avg': 125000.0,
                    }
                ],
                'materialization': {
                    'source': 'dark_flow_detect',
                    'generated_at': now.isoformat(),
                    'cached_at': now.isoformat(),
                    'freshness_state': 'fresh',
                    'lag_seconds': 0.0,
                    'bucket_fact_count': 1,
                    'anomaly_count': 1,
                    'session_summary_state': 'complete',
                    'read_path': 'facts_first',
                },
            },
            timeout=60,
        )

        response = self.client.get('/api/admin-ops/signals/summary/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['ok'])
        self.assertEqual(response.data['services']['whale']['recent_event_count_24h'], 1)
        self.assertEqual(response.data['services']['dark_flow']['total_event_count'], 1)
        self.assertEqual(response.data['services']['dark_flow']['materialization']['freshness_state'], 'fresh')
        self.assertEqual(response.data['services']['dark_flow']['materialization']['bucket_fact_count'], 1)
        self.assertEqual(response.data['services']['dark_flow']['session_summary']['bucket_fact_count'], 1)
        self.assertEqual(response.data['services']['dark_flow']['anomaly_markers'][0]['kind'], 'iceberg')
        self.assertEqual(response.data['services']['dark_flow']['pending_run_count'], 1)
        self.assertEqual(response.data['services']['dark_flow']['cache_freshness']['freshness_state'], 'fresh')
        self.assertIn('lifecycle', response.data)
        self.assertEqual(response.data['lifecycle']['tiers']['forensic_windows']['storage_mode'], 'physical_carve_out')
        self.assertEqual(response.data['lifecycle']['materialization_lag']['dark_flow']['freshness_state'], 'fresh')
        self.assertEqual(response.data['lifecycle']['anomaly_backlog']['dark_flow'], 1)
        self.assertEqual(response.data['lifecycle']['effective_owner_matrix']['version'], '2026-05-01')
        self.assertIn('raw_intraday_keep_days', response.data['lifecycle']['risky_duplicate_fields'])
        self.assertTrue(response.data['lifecycle']['deprecation_warnings'])
        self.assertEqual(response.data['whale_governance']['active_version']['version_code'], 'WHALE-2026-05-01')
        self.assertEqual(response.data['whale_governance']['active_rollout']['status'], 'running')
        self.assertIsNone(response.data['whale_governance']['pending_draft'])
        self.assertEqual(response.data['whale_governance']['propagation']['signal'], 'red')
        self.assertIn('counts', response.data['universe'])
        self.assertIn('raw_intraday', response.data['retention'])
        self.assertIn('ownership', response.data)
        self.assertIn('raw_intraday_keep_days', response.data['ownership']['compatibility'])

    def test_whale_governance_bridge_preview_and_apply_create_pending_draft(self):
        self._auth_staff()
        now = datetime.now(datetime_timezone.utc)
        active_version = WhaleConfigVersion.objects.create(
            version_code='WHALE-2026-05-01',
            config_json={
                'whale_threshold': 800,
                'shark_threshold': 200,
                'cooldown_seconds': 900,
                'rate_limit_per_minute': 60,
                'coverage_mode': 'tracked',
                'weights': {
                    'size_impact': 0.5,
                    'aggression_bonus': 0.25,
                    'concentration_ratio': 0.25,
                },
            },
            status=WhaleConfigVersion.StatusChoices.ACTIVE,
            approved_at=now - timedelta(minutes=15),
            activated_at=now - timedelta(minutes=10),
        )

        bridge_payload = {
            'name': 'Cầu nối Whale Governance FPT',
            'reason': 'Bridge test cho whale governance',
            'ticket_ref': 'MFC-13',
            'config_json': {
                'whale_threshold': 900,
                'shark_threshold': 225,
                'cooldown_seconds': 600,
                'rate_limit_per_minute': 90,
                'coverage_mode': 'tracked',
                'weights': {
                    'size_impact': 0.5,
                    'aggression_bonus': 0.25,
                    'concentration_ratio': 0.25,
                },
            },
        }

        preview_response = self.client.post(
            '/api/admin-ops/signals/whale-governance/bridge/preview/',
            bridge_payload,
            format='json',
        )

        self.assertEqual(preview_response.status_code, status.HTTP_200_OK)
        self.assertEqual(preview_response.data['status'], 'ready')
        self.assertEqual(preview_response.data['bridge_state'], 'ready')
        self.assertTrue(preview_response.data['approval_required'])
        self.assertEqual(preview_response.data['confirmation_metadata']['preview_kind'], 'whale_governance_bridge')
        self.assertEqual(preview_response.data['confirmation_metadata']['bridge_semantics'], 'pending_draft')
        self.assertIn('whale_threshold_million', preview_response.data['diff'])
        self.assertEqual(WhaleConfigDraft.objects.count(), 0)
        self.assertIsNone(preview_response.data['whale_governance']['pending_draft'])

        apply_response = self.client.post(
            '/api/admin-ops/signals/whale-governance/bridge/apply/',
            {
                **bridge_payload,
                'confirm': True,
            },
            format='json',
        )

        self.assertEqual(apply_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(apply_response.data['status'], 'submitted')
        self.assertEqual(apply_response.data['bridge_state'], 'pending_approval')
        self.assertTrue(apply_response.data['approval_required'])
        self.assertTrue(apply_response.data['confirmation_metadata']['confirmed'])
        self.assertEqual(apply_response.data['confirmation_metadata']['preview_state'], 'submitted')
        self.assertEqual(apply_response.data['confirmation_metadata']['draft_status'], WhaleConfigDraft.StatusChoices.SUBMITTED)
        self.assertEqual(apply_response.data['draft']['name'], 'Cầu nối Whale Governance FPT')
        self.assertEqual(apply_response.data['pending_draft']['status'], WhaleConfigDraft.StatusChoices.SUBMITTED)
        self.assertEqual(apply_response.data['pending_draft']['linked_version_code'], active_version.version_code)

        draft = WhaleConfigDraft.objects.get()
        self.assertEqual(draft.status, WhaleConfigDraft.StatusChoices.SUBMITTED)
        self.assertEqual(draft.linked_version_id, active_version.id)
        self.assertTrue(WhaleConfigAuditLog.objects.filter(action='create_draft', draft=draft).exists())
        self.assertTrue(WhaleConfigAuditLog.objects.filter(action='submit_draft', draft=draft).exists())

        active_version.refresh_from_db()
        self.assertEqual(active_version.status, WhaleConfigVersion.StatusChoices.ACTIVE)

        summary_response = self.client.get('/api/admin-ops/signals/summary/')
        self.assertEqual(summary_response.status_code, status.HTTP_200_OK)
        self.assertEqual(summary_response.data['whale_governance']['pending_draft']['draft_id'], draft.id)
        self.assertEqual(summary_response.data['whale_governance']['pending_draft']['status'], WhaleConfigDraft.StatusChoices.SUBMITTED)

    def test_whale_governance_bridge_apply_requires_confirm(self):
        self._auth_staff()

        response = self.client.post(
            '/api/admin-ops/signals/whale-governance/bridge/apply/',
            {
                'config_json': {
                    'whale_threshold': 900,
                    'shark_threshold': 225,
                    'cooldown_seconds': 600,
                    'rate_limit_per_minute': 90,
                    'coverage_mode': 'tracked',
                },
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(WhaleConfigDraft.objects.count(), 0)

    @patch('portfolio.views_signal_admin.cache')
    def test_cached_heavy_count_reuses_redis_value(self, mock_cache):
        count_fn = MagicMock(return_value=37)
        mock_cache.get.side_effect = [None, 37]

        first = _cached_heavy_count('whale_event_total_count', count_fn)
        second = _cached_heavy_count('whale_event_total_count', count_fn)

        self.assertEqual(first, 37)
        self.assertEqual(second, 37)
        count_fn.assert_called_once()
        mock_cache.set.assert_called_once_with(
            'admin_ops:signals:heavy_count:v1:whale_event_total_count',
            37,
            timeout=HEAVY_COUNT_CACHE_TTL_SECONDS,
        )

    def test_config_preview_normalizes_without_persisting(self):
        self._auth_staff()

        response = self.client.post(
            '/api/admin-ops/signals/config/preview/',
            {
                'services_config': {
                    'dark_flow_service': {
                        'warning_strength': 55,
                        'urgent_strength': 80,
                    },
                },
                'retention_policy': {
                    'raw_intraday_keep_days': 12,
                    'whale_event_keep_days': 110,
                },
                'universe_policy': {
                    'admin_symbols': ['fpt'],
                },
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['preview']['services_config']['dark_flow_service']['warning_strength'], 55)
        self.assertEqual(response.data['preview']['universe_policy']['admin_symbols'], ['FPT'])
        self.assertNotIn('raw_intraday_keep_days', response.data['preview']['retention_policy'])
        self.assertEqual(response.data['preview']['retention_policy']['whale_event_keep_days'], 110)
        self.assertIn('ownership', response.data)
        self.assertEqual(response.data['ownership']['compatibility']['raw_intraday_keep_days']['status'], 'deprecated-alias')
        self.assertIn('effective_owner', response.data)
        self.assertIn('effective_values', response.data)
        self.assertIn('diff', response.data)
        self.assertIn('impacted_counts', response.data)
        self.assertIn('freshness', response.data)
        self.assertIn('confirmation_metadata', response.data)
        self.assertIn('effective_value_warnings', response.data)
        self.assertEqual(response.data['confirmation_metadata']['preview_kind'], 'config_preview')
        self.assertEqual(get_global_signal_universe_policy().get('admin_symbols'), [])

    def test_universe_apply_requires_confirm_and_persists_policy(self):
        self._auth_staff()

        bad_response = self.client.post('/api/admin-ops/signals/universe/apply/', {'policy': {'admin_symbols': ['FPT']}}, format='json')
        self.assertEqual(bad_response.status_code, status.HTTP_400_BAD_REQUEST)

        response = self.client.post(
            '/api/admin-ops/signals/universe/apply/',
            {
                'confirm': True,
                'policy': {'admin_symbols': ['FPT']},
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['policy']['admin_symbols'], ['FPT'])
        self.assertEqual(get_global_signal_universe_policy()['admin_symbols'], ['FPT'])
        self.assertIn('FPT', response.data['preview']['effective_symbols'])

    @patch('portfolio.views_signal_admin.detect_and_store_global_whale_alerts')
    def test_jobs_run_queues_manual_whale_run_and_list_returns_it(self, mock_task):
        self._auth_staff()
        mock_task.apply_async.return_value = type('TaskResult', (), {'id': 'task-whale-1'})()

        run_response = self.client.post(
            '/api/admin-ops/signals/jobs/run/',
            {'service_domain': 'whale', 'symbol': 'FPT'},
            format='json',
        )

        self.assertEqual(run_response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(run_response.data['run']['status'], SignalServiceRun.StatusChoices.QUEUED)
        mock_task.apply_async.assert_called_once()

        list_response = self.client.get('/api/admin-ops/signals/jobs/?service_domain=whale')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data['count'], 1)
        self.assertEqual(list_response.data['results'][0]['task_id'], 'task-whale-1')

    @patch('portfolio.views_signal_admin.detect_and_store_order_flow')
    def test_job_retry_creates_new_queued_run(self, mock_task):
        self._auth_staff()
        source_run = SignalServiceRun.objects.create(
            service_domain=SignalServiceRun.ServiceDomain.DARK_FLOW,
            run_type=SignalServiceRun.RunType.MANUAL,
            status=SignalServiceRun.StatusChoices.FAILED,
            params_json={'symbol': 'VCB'},
        )
        mock_task.apply_async.return_value = type('TaskResult', (), {'id': 'task-dark-2'})()

        response = self.client.post(f'/api/admin-ops/signals/jobs/{source_run.id}/retry/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(SignalServiceRun.objects.count(), 2)
        retry_run = SignalServiceRun.objects.exclude(id=source_run.id).get()
        self.assertEqual(retry_run.status, SignalServiceRun.StatusChoices.QUEUED)
        self.assertEqual(retry_run.task_id, 'task-dark-2')

    def test_job_retry_rejects_lifecycle_runs(self):
        self._auth_staff()
        source_run = SignalServiceRun.objects.create(
            service_domain=SignalServiceRun.ServiceDomain.LIFECYCLE,
            run_type=SignalServiceRun.RunType.PURGE,
            status=SignalServiceRun.StatusChoices.FAILED,
        )

        response = self.client.post(f'/api/admin-ops/signals/jobs/{source_run.id}/retry/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(SignalServiceRun.objects.count(), 1)

    def test_jobs_list_supports_page_and_page_size(self):
        self._auth_staff()
        runs = []
        for index in range(5):
            runs.append(
                SignalServiceRun.objects.create(
                    service_domain=SignalServiceRun.ServiceDomain.WHALE if index % 2 == 0 else SignalServiceRun.ServiceDomain.DARK_FLOW,
                    run_type=SignalServiceRun.RunType.MANUAL,
                    status=SignalServiceRun.StatusChoices.COMPLETED,
                )
            )

        response = self.client.get('/api/admin-ops/signals/jobs/?page=2&page_size=2')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 5)
        self.assertEqual(response.data['page'], 2)
        self.assertEqual(response.data['page_size'], 2)
        self.assertEqual([row['id'] for row in response.data['results']], [runs[2].id, runs[1].id])

    @patch('portfolio.views_signal_admin._get_runtime_prefetch_settings')
    def test_recent_events_and_retention_preview_return_expected_shapes(self, mock_runtime_settings):
        self._auth_staff()
        mock_runtime_settings.return_value = {'intraday_tick_keep_days': 11}
        now = datetime.now(datetime_timezone.utc)
        WhaleAlertEvent.objects.create(
            event_id='whale:FPT:2026-04-28T09:15:00+00:00:BUY:700000000:redis_stream',
            symbol='FPT',
            side='BUY',
            matched_value_vnd=700_000_000,
            threshold_vnd=500_000_000,
            threshold_policy_version='threshold-v1',
            severity='urgent',
            event_score=8.4,
            confidence='high',
            source='redis_stream',
            source_layer='live',
            trade_date=date.today(),
            occurred_at=now,
            payload_json={'symbol': 'FPT', 'ts': now.isoformat()},
        )
        OrderFlowSignal.objects.create(
            symbol='VCB',
            signal_type=OrderFlowSignal.SignalType.ICEBERG,
            strength=74.0,
            confidence='high',
            tick_rate=3.0,
            small_order_ratio=0.3,
            cvd_at_signal=125.0,
            price_at_signal=100000,
            window_seconds=300,
            components_json={},
            event_id='dark_flow:VCB:2026-04-28T09:16:00+00:00:iceberg',
            severity=OrderFlowSignal.SeverityChoices.WARNING,
            trade_date=date.today(),
        )

        events_response = self.client.get('/api/admin-ops/signals/events/recent/?domain=all&limit=5')
        retention_response = self.client.post('/api/admin-ops/signals/retention/preview/', {}, format='json')

        self.assertEqual(events_response.status_code, status.HTTP_200_OK)
        self.assertEqual(events_response.data['count'], 2)
        self.assertEqual(events_response.data['page'], 1)
        self.assertEqual(events_response.data['page_size'], 5)
        self.assertEqual(retention_response.status_code, status.HTTP_200_OK)
        self.assertIn('policy', retention_response.data['preview'])
        self.assertIn('raw_intraday', retention_response.data['preview'])
        self.assertEqual(retention_response.data['preview']['raw_intraday']['keep_days'], 11)
        self.assertIn('safety_gate', retention_response.data['preview'])
        self.assertTrue(retention_response.data['preview']['safety_gate']['preview_required'])
        self.assertTrue(retention_response.data['preview']['safety_gate']['purge_ready'])
        self.assertEqual(retention_response.data['preview']['safety_gate']['blocked_reasons'], [])
        self.assertEqual(retention_response.data['preview']['preview_state'], 'ready')
        self.assertIn('forensic_policy', retention_response.data['preview'])
        self.assertEqual(retention_response.data['preview']['forensic_policy']['storage_mode'], 'physical_carve_out')
        self.assertEqual(retention_response.data['preview']['forensic_policy']['candidate_count'], 2)
        self.assertEqual(retention_response.data['preview']['forensic_policy']['candidate_windows'][0]['target_tier'], 'L5')
        self.assertIn('effective_owner', retention_response.data)
        self.assertIn('effective_values', retention_response.data)
        self.assertIn('diff', retention_response.data)
        self.assertIn('impacted_counts', retention_response.data)
        self.assertIn('freshness', retention_response.data)
        self.assertIn('confirmation_metadata', retention_response.data)
        self.assertIn('effective_value_warnings', retention_response.data)
        self.assertEqual(retention_response.data['confirmation_metadata']['preview_kind'], 'retention_preview')

        retention_run = SignalServiceRun.objects.get(
            service_domain=SignalServiceRun.ServiceDomain.LIFECYCLE,
            run_type=SignalServiceRun.RunType.RETENTION_PREVIEW,
        )
        self.assertEqual(retention_run.status, SignalServiceRun.StatusChoices.COMPLETED)
        self.assertEqual(retention_response.data['preview']['safety_gate']['preview_run_id'], retention_run.id)

        lifecycle_jobs_response = self.client.get('/api/admin-ops/signals/jobs/?service_domain=lifecycle')
        self.assertEqual(lifecycle_jobs_response.status_code, status.HTTP_200_OK)
        self.assertEqual(lifecycle_jobs_response.data['count'], 1)
        self.assertEqual(lifecycle_jobs_response.data['results'][0]['run_type'], SignalServiceRun.RunType.RETENTION_PREVIEW)

    @patch('portfolio.views_signal_admin.run_intraday_side_backfill_apply.apply_async')
    @patch('portfolio.views_signal_admin._is_celery_worker_available', return_value=True)
    @patch('portfolio.views_signal_admin.intraday_side_backfill_preview')
    def test_money_flow_materialization_preview_and_run_return_confirmation_metadata(
        self,
        mock_preview,
        _mock_worker_available,
        mock_apply_async,
    ):
        self._auth_staff()
        mock_preview.return_value = {
            'scope_rows': 12,
            'changed_rows': 3,
            'inferred_distribution': {'BUY': 2, 'SELL': 1},
            'transitions': {'SELL->BUY': 2, 'BUY->SELL': 1},
            'sample_rows': [
                {'id': 1, 'symbol': 'VNM', 'trade_date': '2026-04-01', 'trade_time': '09:30:00', 'side': 'BUY'},
            ],
            'is_capped': False,
            'preview_rows_scanned': 12,
        }
        mock_apply_async.return_value = type('TaskResult', (), {'id': 'materialization-task-1'})()

        preview_response = self.client.post(
            '/api/admin-ops/signals/money-flow/materialization/preview/',
            {
                'symbols': ['VNM'],
                'start_date': '2026-04-01',
                'end_date': '2026-04-21',
                'threshold': 0,
                'batch_size': 2000,
            },
            format='json',
        )

        self.assertEqual(preview_response.status_code, status.HTTP_200_OK)
        self.assertEqual(preview_response.data['preview']['scope_rows'], 12)
        self.assertEqual(preview_response.data['impacted_counts']['changed_rows'], 3)
        self.assertEqual(preview_response.data['freshness']['state'], 'recompute pending')
        self.assertEqual(preview_response.data['confirmation_metadata']['preview_kind'], 'materialization')
        self.assertIn('effective_owner', preview_response.data)

        run_response = self.client.post(
            '/api/admin-ops/signals/money-flow/materialization/run/',
            {
                'confirm': True,
                'symbols': ['VNM'],
                'start_date': '2026-04-01',
                'end_date': '2026-04-21',
                'threshold': 0,
                'batch_size': 2000,
            },
            format='json',
        )

        self.assertEqual(run_response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(run_response.data['status'], 'queued')
        self.assertEqual(run_response.data['task_id'], 'materialization-task-1')
        self.assertTrue(run_response.data['confirmation_metadata']['confirmed'])
        mock_apply_async.assert_called_once()
        self.assertEqual(mock_apply_async.call_args.kwargs.get('queue'), 'manual_on_demand')

    def test_recent_events_support_page_and_page_size_across_merged_domains(self):
        self._auth_staff()
        now = datetime.now(datetime_timezone.utc)

        WhaleAlertEvent.objects.create(
            event_id='whale:FPT:1',
            symbol='FPT',
            side='BUY',
            matched_value_vnd=700_000_000,
            threshold_vnd=500_000_000,
            threshold_policy_version='threshold-v1',
            severity='urgent',
            event_score=8.4,
            confidence='high',
            source='redis_stream',
            source_layer='live',
            trade_date=date.today(),
            occurred_at=now,
            payload_json={'symbol': 'FPT', 'ts': now.isoformat()},
        )
        WhaleAlertEvent.objects.create(
            event_id='whale:FPT:2',
            symbol='FPT',
            side='BUY',
            matched_value_vnd=650_000_000,
            threshold_vnd=500_000_000,
            threshold_policy_version='threshold-v1',
            severity='warning',
            event_score=7.1,
            confidence='high',
            source='redis_stream',
            source_layer='live',
            trade_date=date.today(),
            occurred_at=now - timedelta(minutes=2),
            payload_json={'symbol': 'FPT', 'ts': (now - timedelta(minutes=2)).isoformat()},
        )
        WhaleAlertEvent.objects.create(
            event_id='whale:FPT:3',
            symbol='FPT',
            side='BUY',
            matched_value_vnd=600_000_000,
            threshold_vnd=500_000_000,
            threshold_policy_version='threshold-v1',
            severity='warning',
            event_score=6.5,
            confidence='medium',
            source='redis_stream',
            source_layer='live',
            trade_date=date.today(),
            occurred_at=now - timedelta(minutes=4),
            payload_json={'symbol': 'FPT', 'ts': (now - timedelta(minutes=4)).isoformat()},
        )

        dark_flow_one = OrderFlowSignal.objects.create(
            symbol='VCB',
            signal_type=OrderFlowSignal.SignalType.ICEBERG,
            strength=74.0,
            confidence='high',
            tick_rate=3.0,
            small_order_ratio=0.3,
            cvd_at_signal=125.0,
            price_at_signal=100000,
            window_seconds=300,
            components_json={},
            event_id='dark_flow:VCB:1',
            severity=OrderFlowSignal.SeverityChoices.WARNING,
            trade_date=date.today(),
        )
        dark_flow_two = OrderFlowSignal.objects.create(
            symbol='VCB',
            signal_type=OrderFlowSignal.SignalType.ICEBERG,
            strength=68.0,
            confidence='high',
            tick_rate=2.7,
            small_order_ratio=0.25,
            cvd_at_signal=118.0,
            price_at_signal=99900,
            window_seconds=300,
            components_json={},
            event_id='dark_flow:VCB:2',
            severity=OrderFlowSignal.SeverityChoices.WARNING,
            trade_date=date.today(),
        )
        dark_flow_three = OrderFlowSignal.objects.create(
            symbol='VCB',
            signal_type=OrderFlowSignal.SignalType.ICEBERG,
            strength=64.0,
            confidence='medium',
            tick_rate=2.3,
            small_order_ratio=0.22,
            cvd_at_signal=112.0,
            price_at_signal=99800,
            window_seconds=300,
            components_json={},
            event_id='dark_flow:VCB:3',
            severity=OrderFlowSignal.SeverityChoices.WARNING,
            trade_date=date.today(),
        )
        OrderFlowSignal.objects.filter(id=dark_flow_one.id).update(created_at=now - timedelta(minutes=1))
        OrderFlowSignal.objects.filter(id=dark_flow_two.id).update(created_at=now - timedelta(minutes=3))
        OrderFlowSignal.objects.filter(id=dark_flow_three.id).update(created_at=now - timedelta(minutes=5))

        response = self.client.get('/api/admin-ops/signals/events/recent/?domain=all&page=2&page_size=2')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 6)
        self.assertEqual(response.data['page'], 2)
        self.assertEqual(response.data['page_size'], 2)
        self.assertEqual([row['event_id'] for row in response.data['results']], ['whale:FPT:2', 'dark_flow:VCB:2'])
