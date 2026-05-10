"""
Native admin-ops signal control contract tests.

ISOLATION RULE: No imports from backend.portfolio or backend.* allowed.
"""
import os
import sys
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
from rest_framework import status
from rest_framework.test import APIClient

from market_serving.models import SessionFacts
from signal_intelligence.models import OrderFlowEvent, UnifiedAlert, WhaleAlertCanonical
from user_workspace.models import Portfolio, Transaction, Watchlist, WatchlistItem
from vninvest_core.contracts.admin_ops.views import (
    AdminOpsSignalsConfigPreviewView,
    AdminOpsSignalsConfigView,
    AdminOpsSignalsJobRetryView,
    AdminOpsSignalsJobsRunView,
    AdminOpsSignalsJobsView,
    AdminOpsSignalsMaterializationPreviewView,
    AdminOpsSignalsRecentEventsView,
    AdminOpsSignalsRetentionPreviewView,
    AdminOpsSignalsSummaryView,
    AdminOpsSignalsUniverseApplyView,
    AdminOpsSignalsUniversePreviewView,
)


class AdminOpsSignalsContractApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='signal-admin',
            email='signal-admin@example.com',
            password='testpass123',
        )
        self.user.is_staff = True
        self.user.is_superuser = True
        self.user.save(update_fields=['is_staff', 'is_superuser'])
        self.client.force_authenticate(user=self.user)

        now = timezone.now()
        session_date = now.date()
        portfolio = Portfolio.objects.create(user=self.user, name='Signal Portfolio')
        Transaction.objects.create(
            portfolio=portfolio,
            symbol='FPT',
            transaction_type=Transaction.TransactionType.BUY,
            date=session_date,
            price=120000,
            quantity=100,
        )
        watchlist = Watchlist.objects.create(user=self.user, name='Signal Watchlist')
        WatchlistItem.objects.create(watchlist=watchlist, symbol='HPG')

        whale_alert = UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.WHALE,
            symbol='HPG',
            severity=UnifiedAlert.SeverityChoices.HIGH,
            title='Whale HPG',
            body='Core whale event',
            value=750000000,
            direction=UnifiedAlert.DirectionChoices.BUY,
            session_date=session_date,
            triggered_at=now,
            source_ref='whale-001',
            metadata={'source': 'test'},
        )
        WhaleAlertCanonical.objects.create(
            alert=whale_alert,
            symbol='HPG',
            session_date=session_date,
            side=WhaleAlertCanonical.SideChoices.BUY,
            price=120000,
            volume=1000,
            matched_value=750000000,
            is_dark_flow=False,
            order_id='order-001',
            executed_at=now,
        )

        dark_flow_alert = UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.DARK_FLOW,
            symbol='FPT',
            severity=UnifiedAlert.SeverityChoices.MEDIUM,
            title='Dark Flow FPT',
            body='Core dark flow event',
            value=250000000,
            direction=UnifiedAlert.DirectionChoices.NEUTRAL,
            session_date=session_date,
            triggered_at=now,
            source_ref='dark-flow-001',
            metadata={'source': 'test'},
        )
        OrderFlowEvent.objects.create(
            symbol='FPT',
            session_date=session_date,
            signal_type=OrderFlowEvent.SignalTypeChoices.DARK_FLOW,
            side=OrderFlowEvent.SideChoices.NEUTRAL,
            strength=65.0,
            whale_intensity=0.4,
            cvd_at_signal=0.25,
            source_ref='dark-flow-001',
            unified_alert=dark_flow_alert,
            triggered_at=now,
        )
        SessionFacts.objects.create(
            symbol='FPT',
            session_date=session_date,
            cvd_normalized=0.3,
            buy_strength=0.7,
            institutional_strength=0.6,
            whale_net_flow=125000000,
            dark_flow_score=0.4,
            total_buy_volume=10000,
            total_sell_volume=8000,
        )

    def test_signal_routes_resolve_to_native_contract_views(self):
        self.assertIs(resolve('/api/admin-ops/signals/summary/').func.view_class, AdminOpsSignalsSummaryView)
        self.assertIs(resolve('/api/admin-ops/signals/config/').func.view_class, AdminOpsSignalsConfigView)
        self.assertIs(resolve('/api/admin-ops/signals/config/preview/').func.view_class, AdminOpsSignalsConfigPreviewView)
        self.assertIs(resolve('/api/admin-ops/signals/universe/preview/').func.view_class, AdminOpsSignalsUniversePreviewView)
        self.assertIs(resolve('/api/admin-ops/signals/universe/apply/').func.view_class, AdminOpsSignalsUniverseApplyView)
        self.assertIs(resolve('/api/admin-ops/signals/money-flow/materialization/preview/').func.view_class, AdminOpsSignalsMaterializationPreviewView)
        self.assertIs(resolve('/api/admin-ops/signals/jobs/').func.view_class, AdminOpsSignalsJobsView)
        self.assertIs(resolve('/api/admin-ops/signals/jobs/run/').func.view_class, AdminOpsSignalsJobsRunView)
        self.assertIs(resolve('/api/admin-ops/signals/jobs/1/retry/').func.view_class, AdminOpsSignalsJobRetryView)
        self.assertIs(resolve('/api/admin-ops/signals/events/recent/').func.view_class, AdminOpsSignalsRecentEventsView)
        self.assertIs(resolve('/api/admin-ops/signals/retention/preview/').func.view_class, AdminOpsSignalsRetentionPreviewView)

    def test_signal_summary_and_config_return_native_payload(self):
        summary_response = self.client.get('/api/admin-ops/signals/summary/')

        self.assertEqual(summary_response.status_code, status.HTTP_200_OK)
        self.assertTrue(summary_response.data['ok'])
        self.assertEqual(summary_response.data['services']['whale']['recent_event_count_24h'], 1)
        self.assertEqual(summary_response.data['services']['dark_flow']['recent_event_count_24h'], 1)
        self.assertEqual(summary_response.data['universe']['counts']['effective'], 2)
        self.assertGreater(len(summary_response.data['ownership']['deprecation_notes']), 0)
        self.assertEqual(summary_response.data['whale_governance']['active_rollout']['status'], 'pending_legacy_cutover')

        config_response = self.client.get('/api/admin-ops/signals/config/')

        self.assertEqual(config_response.status_code, status.HTTP_200_OK)
        self.assertTrue(config_response.data['ok'])
        self.assertTrue(config_response.data['services_config']['whale_service']['enabled'])
        self.assertTrue(config_response.data['universe_policy']['include_watchlist_symbols'])
        self.assertEqual(config_response.data['retention_policy']['whale_event_keep_days'], 90)

    def test_signal_preview_routes_return_native_contract_payloads(self):
        config_preview_response = self.client.post(
            '/api/admin-ops/signals/config/preview/',
            {
                'services_config': {
                    'whale_service': {
                        'default_threshold_vnd': 900000000,
                    },
                },
                'universe_policy': {
                    'admin_symbols': ['vcb', 'fpt'],
                },
                'retention_policy': {
                    'whale_event_keep_days': 120,
                },
            },
            format='json',
        )
        self.assertEqual(config_preview_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            config_preview_response.data['effective_values']['services_config']['whale_service']['default_threshold_vnd'],
            900000000,
        )
        self.assertEqual(config_preview_response.data['universe_preview']['counts']['effective'], 3)

        universe_preview_response = self.client.post(
            '/api/admin-ops/signals/universe/preview/',
            {'admin_symbols': ['VCB'], 'include_watchlist_symbols': True, 'include_portfolio_symbols': True},
            format='json',
        )
        self.assertEqual(universe_preview_response.status_code, status.HTTP_200_OK)
        self.assertEqual(universe_preview_response.data['preview']['counts']['effective'], 3)

        retention_preview_response = self.client.post('/api/admin-ops/signals/retention/preview/', {}, format='json')
        self.assertEqual(retention_preview_response.status_code, status.HTTP_200_OK)
        self.assertEqual(retention_preview_response.data['preview']['raw_intraday']['keep_days'], 7)
        self.assertEqual(retention_preview_response.data['preview']['whale_events']['rows_total'], 1)

        materialization_preview_response = self.client.post('/api/admin-ops/signals/money-flow/materialization/preview/', {}, format='json')
        self.assertEqual(materialization_preview_response.status_code, status.HTTP_200_OK)
        self.assertEqual(materialization_preview_response.data['preview']['read_path'], 'facts_first')
        self.assertEqual(materialization_preview_response.data['impacted_counts']['session_fact_rows_total'], 1)

    def test_signal_events_jobs_and_guarded_writes(self):
        events_response = self.client.get('/api/admin-ops/signals/events/recent/?domain=all&page=1&page_size=10')
        self.assertEqual(events_response.status_code, status.HTTP_200_OK)
        self.assertEqual(events_response.data['count'], 2)
        self.assertEqual(len(events_response.data['results']), 2)

        jobs_response = self.client.get('/api/admin-ops/signals/jobs/?page=1&page_size=10')
        self.assertEqual(jobs_response.status_code, status.HTTP_200_OK)
        self.assertEqual(jobs_response.data['count'], 0)
        self.assertEqual(jobs_response.data['results'], [])

        config_put_response = self.client.put(
            '/api/admin-ops/signals/config/',
            {'services_config': {'whale_service': {'enabled': False}}},
            format='json',
        )
        self.assertEqual(config_put_response.status_code, status.HTTP_409_CONFLICT)

        universe_apply_response = self.client.post(
            '/api/admin-ops/signals/universe/apply/',
            {'confirm': True, 'policy': {'admin_symbols': ['VCB']}},
            format='json',
        )
        self.assertEqual(universe_apply_response.status_code, status.HTTP_409_CONFLICT)

        jobs_run_response = self.client.post(
            '/api/admin-ops/signals/jobs/run/',
            {'service_domain': 'whale'},
            format='json',
        )
        self.assertEqual(jobs_run_response.status_code, status.HTTP_409_CONFLICT)

        retry_response = self.client.post('/api/admin-ops/signals/jobs/1/retry/', {}, format='json')
        self.assertEqual(retry_response.status_code, status.HTTP_409_CONFLICT)

    @override_settings(LEGACY_BACKEND_URL='http://legacy.internal')
    def test_signal_summary_reports_bridge_write_ownership_when_legacy_bridge_enabled(self):
        response = self.client.get('/api/admin-ops/signals/summary/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['ownership']['mode'], 'native-read-legacy-write-through')
        self.assertEqual(response.data['ownership']['domains']['services_config']['status'], 'bridge-write')
        self.assertEqual(response.data['ownership']['domains']['jobs']['status'], 'bridge-write')

    @override_settings(LEGACY_BACKEND_URL='http://legacy.internal')
    @patch('vninvest_core.contracts.admin_ops.views.httpx.request')
    def test_signal_bridge_delegates_legacy_owned_config_and_jobs(self, mock_request):
        mock_request.side_effect = [
            httpx.Response(200, json={'ok': True, 'services_config': {'enabled': False}, 'universe_policy': {}, 'retention_policy': {}, 'ownership': {'domains': {}}}),
            httpx.Response(200, json={'ok': True, 'preview': {'services_config': {'enabled': False}}}),
            httpx.Response(200, json={'ok': True, 'preview': {'counts': {'effective': 5}}}),
            httpx.Response(200, json={'ok': True, 'applied': True}),
            httpx.Response(200, json={'ok': True, 'count': 1, 'results': [{'id': 7}]}),
            httpx.Response(202, json={'ok': True, 'status': 'queued', 'task_id': 'legacy-run-1'}),
            httpx.Response(200, json={'ok': True, 'status': 'retried'}),
            httpx.Response(200, json={'ok': True, 'saved': True}),
        ]

        auth_header = 'Bearer vni_pat_bridge_test'

        config_response = self.client.get('/api/admin-ops/signals/config/', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(config_response.status_code, status.HTTP_200_OK)
        self.assertFalse(config_response.data['services_config']['enabled'])

        config_preview_response = self.client.post(
            '/api/admin-ops/signals/config/preview/',
            {'services_config': {'enabled': False}},
            format='json',
            HTTP_AUTHORIZATION=auth_header,
        )
        self.assertEqual(config_preview_response.status_code, status.HTTP_200_OK)

        universe_preview_response = self.client.post(
            '/api/admin-ops/signals/universe/preview/',
            {'admin_symbols': ['FPT']},
            format='json',
            HTTP_AUTHORIZATION=auth_header,
        )
        self.assertEqual(universe_preview_response.status_code, status.HTTP_200_OK)
        self.assertEqual(universe_preview_response.data['preview']['counts']['effective'], 5)

        universe_apply_response = self.client.post(
            '/api/admin-ops/signals/universe/apply/',
            {'confirm': True, 'policy': {'admin_symbols': ['FPT']}},
            format='json',
            HTTP_AUTHORIZATION=auth_header,
        )
        self.assertEqual(universe_apply_response.status_code, status.HTTP_200_OK)

        jobs_response = self.client.get('/api/admin-ops/signals/jobs/?page=1&page_size=10', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(jobs_response.status_code, status.HTTP_200_OK)
        self.assertEqual(jobs_response.data['count'], 1)

        jobs_run_response = self.client.post(
            '/api/admin-ops/signals/jobs/run/',
            {'service_domain': 'whale'},
            format='json',
            HTTP_AUTHORIZATION=auth_header,
        )
        self.assertEqual(jobs_run_response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(jobs_run_response.data['task_id'], 'legacy-run-1')

        retry_response = self.client.post('/api/admin-ops/signals/jobs/7/retry/', {}, format='json', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(retry_response.status_code, status.HTTP_200_OK)

        config_put_response = self.client.put(
            '/api/admin-ops/signals/config/',
            {'services_config': {'whale_service': {'enabled': False}}},
            format='json',
            HTTP_AUTHORIZATION=auth_header,
        )
        self.assertEqual(config_put_response.status_code, status.HTTP_200_OK)

        self.assertEqual(mock_request.call_count, 8)
        first_call = mock_request.call_args_list[0].kwargs
        self.assertEqual(first_call['url'], 'http://legacy.internal/api/admin-ops/signals/config/')
        self.assertEqual(first_call['headers']['Authorization'], auth_header)
        self.assertEqual(first_call['headers']['Host'], 'testserver')
        run_call = mock_request.call_args_list[5].kwargs
        self.assertEqual(run_call['url'], 'http://legacy.internal/api/admin-ops/signals/jobs/run/')
        self.assertEqual(run_call['json'], {'service_domain': 'whale'})