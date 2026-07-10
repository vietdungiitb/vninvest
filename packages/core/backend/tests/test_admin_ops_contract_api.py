"""
Native admin-ops contract API tests.

ISOLATION RULE: No imports from backend.portfolio or backend.* allowed.
"""
import os
import sys
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

import httpx
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.urls import resolve
from django.utils import timezone
from django_celery_beat.models import IntervalSchedule, PeriodicTask
from rest_framework import status
from rest_framework.test import APIClient

from advisory.models import SystemAISettings
from market_data.vnbroker_benchmark import (
    clear_latest_price_board_benchmark_report,
    set_latest_price_board_benchmark_report,
)
from market_data.models import VnbrokerRuntimeConfig
from ops_audit.models import RequestTrace
from user_workspace.models import Portfolio, Watchlist, WatchlistItem
from vninvest_core.contracts.admin_ops.views import (
    AdminOpsIntradaySideBackfillApplyView,
    AdminOpsIntradaySideBackfillPreviewView,
    AdminOpsIntradaySideBackfillStatusView,
    AdminOpsIntradayUniverseWarmNowView,
    AdminOpsMarketGroupsSyncView,
    AdminOpsPrefetchWarmView,
    AdminOpsRuntimeKPIView,
    AdminOpsStatsView,
    AdminOpsSystemAiSettingsView,
    AdminOpsVnbrokerBenchmarkLatestView,
    AdminOpsVnbrokerBenchmarkRunView,
    AdminOpsVnbrokerConfigCurrentView,
    AdminOpsVnbrokerConfigResetView,
)


@override_settings(ROOT_URLCONF='tests.urls_test_admin_ops')
class AdminOpsContractApiTests(TestCase):
    def setUp(self):
        clear_latest_price_board_benchmark_report()
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='core-admin-ops',
            email='core-admin-ops@example.com',
            password='testpass123',
        )
        self.user.is_staff = True
        self.user.is_superuser = True
        self.user.save(update_fields=['is_staff', 'is_superuser'])
        self.client.force_authenticate(user=self.user)

    def test_admin_ops_routes_resolve_to_native_contract_views(self):
        resolver_stats = resolve('/api/admin-ops/stats/')
        self.assertIs(resolver_stats.func.view_class, AdminOpsStatsView)

        resolver_runtime_kpi = resolve('/api/admin-ops/runtime-kpi/')
        self.assertIs(resolver_runtime_kpi.func.view_class, AdminOpsRuntimeKPIView)

        resolver_system_ai = resolve('/api/admin-ops/system-ai-settings/')
        self.assertIs(resolver_system_ai.func.view_class, AdminOpsSystemAiSettingsView)

        resolver_vnbroker_current = resolve('/api/admin-ops/vnbroker-config/current/')
        self.assertIs(resolver_vnbroker_current.func.view_class, AdminOpsVnbrokerConfigCurrentView)

        resolver_vnbroker_reset = resolve('/api/admin-ops/vnbroker-config/reset-to-defaults/')
        self.assertIs(resolver_vnbroker_reset.func.view_class, AdminOpsVnbrokerConfigResetView)

        resolver_vnbroker_benchmark_latest = resolve('/api/admin-ops/vnbroker-config/benchmark-price-board/latest/')
        self.assertIs(resolver_vnbroker_benchmark_latest.func.view_class, AdminOpsVnbrokerBenchmarkLatestView)

        resolver_vnbroker_benchmark_run = resolve('/api/admin-ops/vnbroker-config/benchmark-price-board/run/')
        self.assertIs(resolver_vnbroker_benchmark_run.func.view_class, AdminOpsVnbrokerBenchmarkRunView)

        resolver_prefetch_warm = resolve('/api/admin-ops/prefetch/warm/')
        self.assertIs(resolver_prefetch_warm.func.view_class, AdminOpsPrefetchWarmView)

        resolver_market_groups_sync = resolve('/api/admin-ops/market-groups/sync/')
        self.assertIs(resolver_market_groups_sync.func.view_class, AdminOpsMarketGroupsSyncView)

        resolver_backfill_preview = resolve('/api/admin-ops/intraday-side-backfill/preview/')
        self.assertIs(resolver_backfill_preview.func.view_class, AdminOpsIntradaySideBackfillPreviewView)

        resolver_backfill_apply = resolve('/api/admin-ops/intraday-side-backfill/apply/')
        self.assertIs(resolver_backfill_apply.func.view_class, AdminOpsIntradaySideBackfillApplyView)

        resolver_backfill_status = resolve('/api/admin-ops/intraday-side-backfill/status/task-1/')
        self.assertIs(resolver_backfill_status.func.view_class, AdminOpsIntradaySideBackfillStatusView)

        resolver_intraday_warm_now = resolve('/api/admin-ops/intraday-universe/warm-now/')
        self.assertIs(resolver_intraday_warm_now.func.view_class, AdminOpsIntradayUniverseWarmNowView)

    def test_stats_returns_core_snapshot_shape(self):
        Portfolio.objects.create(user=self.user, name='Core Portfolio')
        watchlist = Watchlist.objects.create(user=self.user, name='Theo doi')
        second_watchlist = Watchlist.objects.create(user=self.user, name='Theo doi 2')
        WatchlistItem.objects.create(watchlist=watchlist, symbol='FPT')
        WatchlistItem.objects.create(watchlist=watchlist, symbol='VNM')
        WatchlistItem.objects.create(watchlist=second_watchlist, symbol='FPT')

        response = self.client.get('/api/admin-ops/stats/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user_count'], 1)
        self.assertEqual(response.data['portfolio_count'], 1)
        self.assertEqual(response.data['tracked_symbol_count'], 2)
        self.assertEqual(response.data['watchlist_item_count'], 3)
        self.assertIn('ticker_prefetch', response.data)
        self.assertIn('surface_permissions', response.data)
        self.assertTrue(response.data['surface_permissions']['vnbroker_config_write'])

    @override_settings(
        CELERY_BEAT_SCHEDULE={
            'materialize-symbol-snapshot-60s': {
                'task': 'market_serving.materializers.materialize_symbol_snapshot',
                'schedule': 60.0,
                'options': {'queue': 'realtime_prefetch'},
            },
            'materialize-session-facts-5m': {
                'task': 'market_serving.materializers.materialize_session_facts',
                'schedule': 300.0,
                'options': {'queue': 'realtime_prefetch'},
            },
        }
    )
    def test_runtime_kpi_aggregates_request_trace_snapshot(self):
        interval_60, _ = IntervalSchedule.objects.get_or_create(every=60, period='seconds')
        interval_300, _ = IntervalSchedule.objects.get_or_create(every=300, period='seconds')
        RequestTrace.objects.create(
            request_id='trace-001',
            method='GET',
            path='/core/v1/health',
            status_code=200,
            actor_user_id=self.user.id,
            duration_ms=25,
        )
        RequestTrace.objects.create(
            request_id='trace-002',
            method='GET',
            path='/core/v1/health',
            status_code=503,
            actor_user_id=self.user.id,
            duration_ms=125,
        )
        PeriodicTask.objects.create(
            name='materialize-symbol-snapshot-60s',
            task='market_serving.materializers.materialize_symbol_snapshot',
            queue='realtime_prefetch',
            interval=interval_60,
            enabled=True,
            last_run_at=timezone.now() - timedelta(seconds=60),
            total_run_count=5,
        )
        PeriodicTask.objects.create(
            name='materialize-session-facts-5m',
            task='market_serving.materializers.materialize_session_facts',
            queue='realtime_prefetch',
            interval=interval_300,
            enabled=True,
            last_run_at=timezone.now() - timedelta(seconds=900),
            total_run_count=2,
        )

        response = self.client.get('/api/admin-ops/runtime-kpi/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['market_observability']['overall']['http_requests'], 2)
        self.assertEqual(response.data['market_observability']['overall']['http_5xx_ratio_pct'], 50.0)
        endpoint_snapshot = response.data['market_observability']['endpoints']['/core/v1/health']
        self.assertEqual(endpoint_snapshot['latency_ms']['p95'], 25.0)
        scheduler_metrics = response.data['prefetch_scheduler_metrics']
        self.assertEqual(scheduler_metrics['runs_total'], 7)
        self.assertEqual(scheduler_metrics['enqueued_total'], 2)
        self.assertAlmostEqual(scheduler_metrics['estimated_upstream_calls_per_minute_total'], 1.2)
        self.assertEqual(scheduler_metrics['queue_drift_count'], 0)
        self.assertEqual(scheduler_metrics['freshness']['fresh'], 1)
        self.assertEqual(scheduler_metrics['freshness']['stale'], 1)
        self.assertEqual([task['task_name'] for task in scheduler_metrics['tasks']], [
            'materialize-session-facts-5m',
            'materialize-symbol-snapshot-60s',
        ])
        self.assertGreaterEqual(scheduler_metrics['queue_lag_seconds']['max'], 900)

    def test_system_ai_settings_updates_governance_thresholds_and_blocks_prefetch_writers(self):
        response = self.client.get('/api/admin-ops/system-ai-settings/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['settings']['write_capabilities']['prefetch_runtime_settings'])

        update_response = self.client.put(
            '/api/admin-ops/system-ai-settings/',
            {
                'governance_delta_thresholds': {
                    'warning': 1.5,
                    'critical': 3.5,
                    'cooldown': 1.0,
                },
            },
            format='json',
        )

        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(update_response.data['settings']['governance_delta_thresholds']['warning'], 1.5)
        config = SystemAISettings.objects.get(name='default')
        self.assertEqual(config.metadata['governance_delta_thresholds']['critical'], 3.5)

        blocked_response = self.client.put(
            '/api/admin-ops/system-ai-settings/',
            {
                'prefetch_runtime_settings': {
                    'batch_size': 10,
                },
            },
            format='json',
        )
        self.assertEqual(blocked_response.status_code, status.HTTP_409_CONFLICT)

    def test_vnbroker_config_update_reset_and_changelog_are_native(self):
        get_response = self.client.get('/api/admin-ops/vnbroker-config/current/')

        self.assertEqual(get_response.status_code, status.HTTP_200_OK)
        self.assertIn('settings', get_response.data)
        self.assertIn('rulebook', get_response.data)

        patch_response = self.client.patch(
            '/api/admin-ops/vnbroker-config/update-config/',
            {
                'max_concurrency': 8,
                'retry_attempts': 5,
                'retry_backoff_seconds': 1.5,
                'rate_limit_cooldown_seconds': 45,
                'price_board_source': 'VCI',
                'fallback_sources': ['KBS', 'TCBS'],
                'timeout_config': {
                    'price_board': 12,
                    'intraday': 18,
                },
                'enable_caching': False,
            },
            format='json',
        )

        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_response.data['settings']['max_concurrency'], 8)
        self.assertEqual(patch_response.data['settings']['retry_attempts'], 5)
        self.assertEqual(patch_response.data['settings']['price_board_source'], 'VCI')
        self.assertEqual(patch_response.data['settings']['timeout_config']['price_board'], 12)
        self.assertIn('VCI', patch_response.data['settings']['fallback_sources'])

        changelog_response = self.client.get('/api/admin-ops/vnbroker-config/changelog/?limit=10&offset=0')
        self.assertEqual(changelog_response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(changelog_response.data['total'], 1)

        reset_response = self.client.post('/api/admin-ops/vnbroker-config/reset-to-defaults/', {}, format='json')
        self.assertEqual(reset_response.status_code, status.HTTP_200_OK)
        self.assertEqual(reset_response.data['settings']['max_concurrency'], 4)
        self.assertEqual(reset_response.data['settings']['price_board_source'], 'KBS')

        config = VnbrokerRuntimeConfig.objects.get(name='default')
        self.assertEqual(config.data_source, 'KBS')
        self.assertEqual(config.max_workers, 4)

    @patch('data_ingest.tasks.fetch_and_upsert_price_board.apply_async')
    def test_prefetch_warm_async_dispatches_native_ingest_task(self, mock_apply_async):
        mock_apply_async.return_value = SimpleNamespace(id='task-123')

        response = self.client.post('/api/admin-ops/prefetch/warm/?mode=async', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertTrue(response.data['queued'])
        self.assertEqual(response.data['task_id'], 'task-123')
        self.assertEqual(response.data['flow'], 'core_price_board_ingest')
        mock_apply_async.assert_called_once()

    @patch('data_ingest.tasks.fetch_and_upsert_price_board.run')
    def test_prefetch_warm_sync_returns_native_payload(self, mock_run):
        mock_run.return_value = {
            'status': 'ok',
            'upserted': 42,
        }

        response = self.client.post('/api/admin-ops/prefetch/warm/?mode=sync', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['queued'])
        self.assertEqual(response.data['result']['upserted'], 42)

    def test_benchmark_latest_returns_native_empty_state_without_report(self):
        benchmark_response = self.client.get('/api/admin-ops/vnbroker-config/benchmark-price-board/latest/')
        self.assertEqual(benchmark_response.status_code, status.HTTP_200_OK)
        self.assertFalse(benchmark_response.data['has_report'])

    @patch('vninvest_core.contracts.admin_ops.views._is_celery_alive', return_value=True)
    @patch('data_ingest.tasks.run_vnbroker_price_board_benchmark.apply_async')
    def test_benchmark_run_dispatches_native_task(self, mock_apply_async, _is_celery_alive_mock):
        mock_apply_async.return_value = SimpleNamespace(id='bench-1')

        response = self.client.post(
            '/api/admin-ops/vnbroker-config/benchmark-price-board/run/',
            {'symbol': 'FPT'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data['status'], 'started')
        self.assertEqual(response.data['task_id'], 'bench-1')
        self.assertEqual(response.data['mode'], 'celery')
        mock_apply_async.assert_called_once_with(kwargs={'payload': {'symbol': 'FPT'}}, queue='manual_on_demand')

    @override_settings(LEGACY_BACKEND_URL='http://legacy.internal')
    @patch('vninvest_core.contracts.admin_ops.views.httpx.request')
    @patch('vninvest_core.contracts.admin_ops.views._is_celery_alive', return_value=True)
    @patch('data_ingest.tasks.run_vnbroker_price_board_benchmark.apply_async')
    def test_benchmark_routes_remain_native_even_when_legacy_bridge_is_configured(
        self,
        mock_apply_async,
        _is_celery_alive_mock,
        mock_request,
    ):
        mock_apply_async.return_value = SimpleNamespace(id='bench-2')

        latest_response = self.client.get('/api/admin-ops/vnbroker-config/benchmark-price-board/latest/')
        run_response = self.client.post(
            '/api/admin-ops/vnbroker-config/benchmark-price-board/run/',
            {'symbol': 'VNM'},
            format='json',
        )

        self.assertEqual(latest_response.status_code, status.HTTP_200_OK)
        self.assertFalse(latest_response.data['has_report'])
        self.assertEqual(run_response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(run_response.data['task_id'], 'bench-2')
        mock_request.assert_not_called()

    def test_benchmark_latest_returns_cached_native_report(self):
        set_latest_price_board_benchmark_report(
            {
                'status': 'completed',
                'started_at': timezone.now().isoformat(),
                'finished_at': timezone.now().isoformat(),
                'symbol': 'FPT',
                'duration_seconds': 10,
                'results': [],
                'recommendation': {'primary_provider': 'KBS'},
            }
        )

        response = self.client.get('/api/admin-ops/vnbroker-config/benchmark-price-board/latest/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['has_report'])
        self.assertEqual(response.data['report']['symbol'], 'FPT')

    def test_market_groups_sync_remains_native_without_bridge(self):
        market_groups_response = self.client.post('/api/admin-ops/market-groups/sync/', {}, format='json')
        self.assertEqual(market_groups_response.status_code, status.HTTP_200_OK)
        self.assertEqual(market_groups_response.data['status'], 'accepted')

    @override_settings(LEGACY_BACKEND_URL='http://legacy.internal')
    @patch('vninvest_core.contracts.admin_ops.views.httpx.request')
    def test_bridge_backed_admin_ops_routes_delegate_to_legacy_backend(self, mock_request):
        mock_request.side_effect = [
            httpx.Response(200, json={'success': True, 'message': 'synced'}),
            httpx.Response(200, json={'ok': True, 'scope_rows': 3}),
            httpx.Response(202, json={'ok': True, 'task_id': 'bf-1'}),
            httpx.Response(200, json={'ok': True, 'task': {'status': 'queued'}}),
            httpx.Response(200, json={'ok': True, 'dispatched_count': 2}),
        ]

        auth_header = 'Bearer vni_pat_bridge_test'

        market_groups_response = self.client.post(
            '/api/admin-ops/market-groups/sync/?mode=all&clear=true',
            {},
            format='json',
            HTTP_AUTHORIZATION=auth_header,
        )
        self.assertEqual(market_groups_response.status_code, status.HTTP_200_OK)

        backfill_preview_response = self.client.post(
            '/api/admin-ops/intraday-side-backfill/preview/',
            {'symbols': ['FPT']},
            format='json',
            HTTP_AUTHORIZATION=auth_header,
        )
        self.assertEqual(backfill_preview_response.status_code, status.HTTP_200_OK)

        backfill_apply_response = self.client.post(
            '/api/admin-ops/intraday-side-backfill/apply/',
            {'confirm': True},
            format='json',
            HTTP_AUTHORIZATION=auth_header,
        )
        self.assertEqual(backfill_apply_response.status_code, status.HTTP_202_ACCEPTED)

        backfill_status_response = self.client.get(
            '/api/admin-ops/intraday-side-backfill/status/bf-1/',
            HTTP_AUTHORIZATION=auth_header,
        )
        self.assertEqual(backfill_status_response.status_code, status.HTTP_200_OK)

        warm_now_response = self.client.post(
            '/api/admin-ops/intraday-universe/warm-now/',
            {},
            format='json',
            HTTP_AUTHORIZATION=auth_header,
        )
        self.assertEqual(warm_now_response.status_code, status.HTTP_200_OK)

        self.assertEqual(mock_request.call_count, 5)
        self.assertEqual(mock_request.call_args_list[0].kwargs['url'], 'http://legacy.internal/api/admin-ops/market-groups/sync/')
        self.assertEqual(mock_request.call_args_list[0].kwargs['params'], {'mode': 'all', 'clear': 'true'})
        self.assertEqual(mock_request.call_args_list[4].kwargs['url'], 'http://legacy.internal/api/admin-ops/intraday-universe/warm-now/')
