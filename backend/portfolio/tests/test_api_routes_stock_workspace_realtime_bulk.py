from unittest.mock import MagicMock, patch
from decimal import Decimal
import base64
import json
import os

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test.utils import override_settings
from django.utils import timezone
import pandas as pd
from portfolio.exceptions import ExternalSystemException
from portfolio import auth_views
from portfolio.models import AdvisoryAggregateAuditLog, AdvisoryAggregateSnapshot, DailyPrice, IntradayTick, OnboardingPlanPolicy, OrderFlowSignal, PlanAssignmentLog, Portfolio, SecuritiesGroup, SecuritiesItem, StockProfile, SubAccount, TrackedSymbol, UserConfig, WatchlistGroup, WatchlistItem, WhaleAdvisory, AIAdvisoryComponentRecord, AIAdvisoryExecutiveSummary, SystemAISettings
from portfolio.starter_portfolio_service import STARTER_PORTFOLIO_TEMPLATES, STARTER_SUBACCOUNT_TEMPLATES
from datetime import date, datetime, timedelta
from rest_framework import status
from rest_framework.test import APITestCase


class ApiRouteStockWorkspaceRealtimeBulkTests(APITestCase):
    def setUp(self):
        from . import test_api_routes as legacy_routes

        legacy_routes.ApiRouteSmokeTests.setUp(self)

    def authenticate(self):
        from . import test_api_routes as legacy_routes

        return legacy_routes.ApiRouteSmokeTests.authenticate(self)

    def authenticate_direct(self):
        from . import test_api_routes as legacy_routes

        return legacy_routes.ApiRouteSmokeTests.authenticate_direct(self)

    def _attach_dpi_license(self, plan_name, feature_flags=None, status='active', grace_days=7):
        from . import test_api_routes as legacy_routes

        return legacy_routes.ApiRouteSmokeTests._attach_dpi_license(self, plan_name, feature_flags, status, grace_days)

    def _detach_dpi_license(self):
        from . import test_api_routes as legacy_routes

        return legacy_routes.ApiRouteSmokeTests._detach_dpi_license(self)

    def _create_stock_workspace_advisory(self, symbol='BCM'):
        from . import test_api_routes as legacy_routes

        return legacy_routes.ApiRouteSmokeTests._create_stock_workspace_advisory(self, symbol)

    def test_stock_workspace_p0_role_matrix_blocks_free_dpi_license(self):
        self._attach_dpi_license(
            'free',
            {
                'dark_pool_flow': False,
                'whale_momentum': False,
                'sentiment_score': False,
            },
        )
        self.authenticate()

        matrix_cases = [
            ('order_flow', self.client.get('/api/stock-management/stocks/FPT/order-flow/'), 'dark_pool_flow'),
            ('advisory_session', self.client.get('/api/stock-management/stocks/BCM/ai-advisory-session/'), 'whale_momentum'),
            (
                'advisory_components_generate',
                self.client.post(
                    '/api/stock-management/stocks/BCM/ai-advisory-components/generate/',
                    {'timeframe': '15m'},
                    format='json',
                ),
                'sentiment_score',
            ),
        ]

        for case_name, response, expected_feature_key in matrix_cases:
            with self.subTest(case=case_name):
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
                self.assertEqual(response.data['code'], 'feature_locked')
                self.assertEqual(response.data['feature_key'], expected_feature_key)

    @patch('portfolio.views._sprint17_generate_component_templates_with_ai', return_value=[])
    @patch('portfolio.views._sprint17_build_component_templates')
    @patch('portfolio.order_flow.detect_dark_flow')
    @patch('portfolio.order_flow.compute_cvd_series')
    def test_stock_workspace_p0_role_matrix_allows_access_for_pro_premium_admin_trial_grace(
        self,
        mock_cvd_series,
        mock_detect_dark_flow,
        mock_build_templates,
        _mock_generate_with_ai,
    ):
        self.authenticate()
        self._create_stock_workspace_advisory(symbol='BCM')
        mock_cvd_series.return_value = []
        mock_detect_dark_flow.return_value = {
            'signal_type': None,
            'strength': 0,
            'confidence': 'low',
            'components': {},
        }
        mock_build_templates.return_value = [
            {
                'symbol': 'BCM',
                'component_type': 'indicator',
                'indicator_name': 'RSI',
                'status': 'neutral',
                'confidence_score': 6,
                'suggested_action': 'watch',
                'rationale_text': 'matrix-test',
                'timeframe': '30m',
                'include_in_summary': True,
            },
        ]

        matrix_cases = [
            (
                'pro_active',
                lambda: self._attach_dpi_license(
                    'pro',
                    {'dark_pool_flow': True, 'whale_momentum': True, 'sentiment_score': True},
                    status='active',
                ),
            ),
            (
                'pro_trial',
                lambda: self._attach_dpi_license(
                    'pro',
                    {'dark_pool_flow': True, 'whale_momentum': True, 'sentiment_score': True},
                    status='trial',
                ),
            ),
            (
                'pro_grace',
                lambda: self._attach_dpi_license(
                    'pro',
                    {'dark_pool_flow': True, 'whale_momentum': True, 'sentiment_score': True},
                    status='grace',
                ),
            ),
            (
                'premium_legacy_without_dpi',
                lambda: [
                    self._detach_dpi_license(),
                    UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'premium', 'email_verified': True}),
                ],
            ),
            (
                'admin_legacy_without_dpi',
                lambda: [
                    self._detach_dpi_license(),
                    UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'admin', 'email_verified': True}),
                ],
            ),
        ]

        for case_name, setup_case in matrix_cases:
            with self.subTest(case=case_name):
                setup_case()

                order_flow_resp = self.client.get('/api/stock-management/stocks/FPT/order-flow/')
                session_resp = self.client.get('/api/stock-management/stocks/BCM/ai-advisory-session/')
                components_resp = self.client.post(
                    '/api/stock-management/stocks/BCM/ai-advisory-components/generate/',
                    {'timeframe': '30m'},
                    format='json',
                )

                self.assertEqual(order_flow_resp.status_code, status.HTTP_200_OK)
                self.assertEqual(session_resp.status_code, status.HTTP_200_OK)
                self.assertEqual(components_resp.status_code, status.HTTP_201_CREATED)

    def test_stock_workspace_p0_role_matrix_blocks_expired_license(self):
        self._attach_dpi_license(
            'pro',
            {
                'dark_pool_flow': True,
                'whale_momentum': True,
                'sentiment_score': True,
            },
            status='expired',
        )
        self.authenticate()

        matrix_cases = [
            ('order_flow', self.client.get('/api/stock-management/stocks/FPT/order-flow/'), 'dark_pool_flow'),
            ('advisory_session', self.client.get('/api/stock-management/stocks/BCM/ai-advisory-session/'), 'whale_momentum'),
            (
                'advisory_components_generate',
                self.client.post(
                    '/api/stock-management/stocks/BCM/ai-advisory-components/generate/',
                    {'timeframe': '15m'},
                    format='json',
                ),
                'sentiment_score',
            ),
        ]

        for case_name, response, expected_feature_key in matrix_cases:
            with self.subTest(case=case_name):
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
                self.assertEqual(response.data['code'], 'feature_locked')
                self.assertEqual(response.data['feature_key'], expected_feature_key)

    @patch('portfolio.views._cache_get', return_value=None)
    @patch('portfolio.views._sprint17_generate_component_templates_with_ai')
    def test_stock_workspace_p1_regression_matrix_matches_current_gating_policy(self, mock_generate_with_ai, _mock_cache_get):
        self.authenticate()
        mock_generate_with_ai.return_value = [
            {
                'symbol': 'BCM',
                'component_type': 'indicator',
                'indicator_name': 'RSI Updated',
                'status': 'neutral',
                'confidence_score': 7,
                'suggested_action': 'watch',
                'rationale_text': 'p1-matrix',
                'timeframe': '30m',
                'include_in_summary': True,
            }
        ]

        matrix_cases = [
            (
                'free_active',
                lambda: self._attach_dpi_license(
                    'free',
                    {'dark_pool_flow': False, 'whale_momentum': False, 'sentiment_score': False},
                    status='active',
                ),
                True,
            ),
            (
                'pro_active',
                lambda: self._attach_dpi_license(
                    'pro',
                    {'dark_pool_flow': True, 'whale_momentum': True, 'sentiment_score': True},
                    status='active',
                ),
                False,
            ),
            (
                'pro_trial',
                lambda: self._attach_dpi_license(
                    'pro',
                    {'dark_pool_flow': True, 'whale_momentum': True, 'sentiment_score': True},
                    status='trial',
                ),
                False,
            ),
            (
                'pro_grace',
                lambda: self._attach_dpi_license(
                    'pro',
                    {'dark_pool_flow': True, 'whale_momentum': True, 'sentiment_score': True},
                    status='grace',
                ),
                False,
            ),
            (
                'premium_legacy_without_dpi',
                lambda: [
                    self._detach_dpi_license(),
                    UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'premium', 'email_verified': True}),
                ],
                False,
            ),
            (
                'admin_legacy_without_dpi',
                lambda: [
                    self._detach_dpi_license(),
                    UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'admin', 'email_verified': True}),
                ],
                False,
            ),
        ]

        for case_name, setup_case, expect_locked in matrix_cases:
            with self.subTest(case=case_name):
                setup_case()
                self._create_stock_workspace_advisory(symbol='BCM')
                component = AIAdvisoryComponentRecord.objects.create(
                    user=self.user,
                    symbol='BCM',
                    component_type='indicator',
                    indicator_name='RSI',
                    status='neutral',
                    confidence_score=6,
                    suggested_action='watch',
                    rationale_text='p1-regression',
                    timeframe='30m',
                    include_in_summary=True,
                )

                refresh_resp = self.client.post(
                    f'/api/stock-management/ai-advisory-components/{component.id}/refresh/',
                    {},
                    format='json',
                )
                summary_resp = self.client.post(
                    '/api/stock-management/stocks/BCM/ai-advisory-summary/regenerate/',
                    {'component_ids': [component.id]},
                    format='json',
                )

                if expect_locked:
                    self.assertEqual(refresh_resp.status_code, status.HTTP_403_FORBIDDEN)
                    self.assertEqual(summary_resp.status_code, status.HTTP_403_FORBIDDEN)
                    self.assertEqual(refresh_resp.data.get('code'), 'feature_locked')
                    self.assertEqual(summary_resp.data.get('code'), 'feature_locked')
                else:
                    self.assertEqual(refresh_resp.status_code, status.HTTP_200_OK)
                    self.assertEqual(summary_resp.status_code, status.HTTP_201_CREATED)

    def test_stock_ai_advisory_observability_returns_summary_and_timeline(self):
        self.authenticate()
        for idx, severity in enumerate([
            WhaleAdvisory.SeverityChoices.INFO,
            WhaleAdvisory.SeverityChoices.WARNING,
            WhaleAdvisory.SeverityChoices.URGENT,
        ], start=1):
            snapshot = AdvisoryAggregateSnapshot.objects.create(
                user=self.user,
                symbol='BCM',
                snapshot_seq=20 + idx,
                state_json={
                    'seq': 20 + idx,
                    'quality': {
                        'actionability': 0.4 + (idx * 0.1),
                        'noise_ratio': 0.2,
                        'consistency': 0.7,
                    },
                },
            )
            WhaleAdvisory.objects.create(
                user=self.user,
                symbol='BCM',
                matched_value=6_000_000_000 + idx,
                side='BUY',
                threshold=5_000_000_000,
                ai_summary=f'observability summary {idx}',
                ai_detail=f'observability detail {idx}',
                ai_provider='openclaw',
                ai_model='default',
                aggregate_snapshot=snapshot,
                severity=severity,
            )

        response = self.client.get('/api/stock-management/stocks/BCM/ai-advisory-observability/?window_hours=48&limit=2')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['ok'])
        self.assertEqual(response.data['symbol'], 'BCM')
        self.assertEqual(response.data['window_hours'], 48)
        self.assertEqual(response.data['limit'], 2)
        self.assertIn('summary', response.data)
        self.assertIn('timeline', response.data)
        self.assertEqual(len(response.data['timeline']), 2)
        self.assertIn('severity_drift_label', response.data['summary'])
        self.assertIn('avg_aggregate_quality_score', response.data['summary'])
        self.assertIn('aggregate_quality', response.data['timeline'][0])

    def test_stock_ai_advisory_observability_post_retry_telemetry_creates_audit_log(self):
        self.authenticate()

        payload = {
            'event_type': 'frontend_retry_telemetry',
            'outcome': 'recovered',
            'client_ts': '2026-04-11T10:20:30Z',
            'telemetry': {
                'scheduled_count': 2,
                'recovered_count': 1,
                'failed_count': 0,
                'last_reason': 'session_conflict',
                'last_event_at': '2026-04-11T10:20:29Z',
            },
        }

        response = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-observability/',
            payload,
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['ok'])
        self.assertEqual(response.data['symbol'], 'BCM')
        self.assertIn('log_id', response.data)

        latest_log = AdvisoryAggregateAuditLog.objects.filter(user=self.user, symbol='BCM').order_by('-created_at').first()
        self.assertIsNotNone(latest_log)
        self.assertEqual(latest_log.reason, AdvisoryAggregateAuditLog.ReasonChoices.MANUAL_REFRESH)
        self.assertEqual(latest_log.actor, AdvisoryAggregateAuditLog.ActorChoices.USER)
        self.assertEqual(latest_log.metadata_json.get('event_type'), 'frontend_retry_telemetry')
        self.assertEqual(latest_log.metadata_json.get('outcome'), 'recovered')
        self.assertEqual(latest_log.metadata_json.get('telemetry', {}).get('scheduled_count'), 2)

    def test_stock_ai_advisory_observability_get_includes_retry_events_from_audit_logs(self):
        self.authenticate()

        AdvisoryAggregateAuditLog.objects.create(
            user=self.user,
            symbol='BCM',
            before_state_json={},
            after_state_json={'operation': 'frontend_retry_telemetry'},
            reason=AdvisoryAggregateAuditLog.ReasonChoices.MANUAL_REFRESH,
            actor=AdvisoryAggregateAuditLog.ActorChoices.USER,
            actor_id=str(self.user.id),
            metadata_json={
                'event_type': 'frontend_retry_telemetry',
                'outcome': 'scheduled',
                'client_ts': '2026-04-11T11:00:00Z',
                'telemetry': {
                    'scheduled_count': 3,
                    'recovered_count': 1,
                    'failed_count': 1,
                    'last_reason': 'session_conflict',
                    'last_event_at': '2026-04-11T10:59:58Z',
                },
            },
        )

        response = self.client.get('/api/stock-management/stocks/BCM/ai-advisory-observability/?window_hours=48&limit=5')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['ok'])
        self.assertIn('retry_events', response.data)
        self.assertGreaterEqual(len(response.data['retry_events']), 1)
        first_event = response.data['retry_events'][0]
        self.assertEqual(first_event['outcome'], 'scheduled')
        self.assertEqual(first_event['reason'], 'session_conflict')
        self.assertEqual(first_event['scheduled_count'], 3)
        self.assertEqual(response.data['summary']['retry_scheduled_total'], 3)
        self.assertEqual(response.data['summary']['retry_recovered_total'], 1)
        self.assertEqual(response.data['summary']['retry_failed_total'], 1)

    @override_settings(HOLISTIC_ADVISORY_V1_ENABLED=False)
    def test_stock_ai_advisory_observability_returns_403_when_holistic_gate_disabled(self):
        self.authenticate()

        response = self.client.get('/api/stock-management/stocks/BCM/ai-advisory-observability/?window_hours=24&limit=10')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(response.data['ok'])
        self.assertEqual(response.data['reason'], 'holistic_disabled')

        deny_log = AdvisoryAggregateAuditLog.objects.filter(user=self.user, symbol='BCM').order_by('-created_at').first()
        self.assertIsNotNone(deny_log)
        self.assertEqual(deny_log.reason, AdvisoryAggregateAuditLog.ReasonChoices.HOLISTIC_ROLLOUT_DENY)
        self.assertEqual(deny_log.metadata_json.get('event_type'), 'rollout_gate_deny')
        self.assertEqual(deny_log.metadata_json.get('endpoint'), 'stock_ai_advisory_observability_api')
        self.assertEqual(deny_log.metadata_json.get('deny_reason'), 'global_disabled')

    @override_settings(
        HOLISTIC_ADVISORY_V1_ENABLED=True,
        HOLISTIC_ADVISORY_V1_COHORT_MODE='allowlist',
        HOLISTIC_ADVISORY_V1_COHORT_USERNAMES=['another-user'],
    )
    def test_stock_ai_advisory_observability_returns_403_when_user_not_in_holistic_allowlist(self):
        self.authenticate()

        response = self.client.get('/api/stock-management/stocks/BCM/ai-advisory-observability/?window_hours=24&limit=10')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(response.data['ok'])
        self.assertEqual(response.data['reason'], 'holistic_disabled')

    def test_stock_ai_advisory_observability_get_applies_retry_filters_and_sort(self):
        self.authenticate()

        AdvisoryAggregateAuditLog.objects.create(
            user=self.user,
            symbol='BCM',
            before_state_json={},
            after_state_json={'operation': 'frontend_retry_telemetry'},
            reason=AdvisoryAggregateAuditLog.ReasonChoices.MANUAL_REFRESH,
            actor=AdvisoryAggregateAuditLog.ActorChoices.USER,
            actor_id=str(self.user.id),
            metadata_json={
                'event_type': 'frontend_retry_telemetry',
                'outcome': 'scheduled',
                'telemetry': {
                    'scheduled_count': 3,
                    'recovered_count': 0,
                    'failed_count': 4,
                    'last_reason': 'session_conflict',
                },
            },
        )
        AdvisoryAggregateAuditLog.objects.create(
            user=self.user,
            symbol='BCM',
            before_state_json={},
            after_state_json={'operation': 'frontend_retry_telemetry'},
            reason=AdvisoryAggregateAuditLog.ReasonChoices.MANUAL_REFRESH,
            actor=AdvisoryAggregateAuditLog.ActorChoices.USER,
            actor_id=str(self.user.id),
            metadata_json={
                'event_type': 'frontend_retry_telemetry',
                'outcome': 'recovered',
                'telemetry': {
                    'scheduled_count': 1,
                    'recovered_count': 1,
                    'failed_count': 0,
                    'last_reason': 'session_conflict',
                },
            },
        )

        filtered_response = self.client.get(
            '/api/stock-management/stocks/BCM/ai-advisory-observability/?window_hours=48&limit=5&retry_outcome=scheduled'
        )
        self.assertEqual(filtered_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(filtered_response.data['retry_events']), 1)
        self.assertEqual(filtered_response.data['retry_events'][0]['outcome'], 'scheduled')

        sorted_response = self.client.get(
            '/api/stock-management/stocks/BCM/ai-advisory-observability/?window_hours=48&limit=5&retry_sort=most_failed'
        )
        self.assertEqual(sorted_response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(sorted_response.data['retry_events']), 2)
        self.assertGreaterEqual(
            sorted_response.data['retry_events'][0]['failed_count'],
            sorted_response.data['retry_events'][1]['failed_count'],
        )

    def test_stock_ai_advisory_observability_get_includes_rollout_governance_trend(self):
        self.authenticate()

        AdvisoryAggregateAuditLog.objects.create(
            user=self.user,
            symbol='BCM',
            before_state_json={},
            after_state_json={'operation': 'holistic_rollout_gate', 'outcome': 'denied'},
            reason=AdvisoryAggregateAuditLog.ReasonChoices.HOLISTIC_ROLLOUT_DENY,
            actor=AdvisoryAggregateAuditLog.ActorChoices.SYSTEM,
            actor_id='holistic_rollout_gate',
            metadata_json={
                'event_type': 'rollout_gate_deny',
                'endpoint': 'stock_ai_advisory_session_api',
                'deny_reason': 'allowlist_blocked',
                'cohort_mode': 'allowlist',
            },
        )

        response = self.client.get('/api/stock-management/stocks/BCM/ai-advisory-observability/?window_hours=48&limit=5')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['ok'])
        self.assertEqual(response.data['summary']['rollout_gate_deny_total'], 1)
        self.assertIn('governance', response.data)
        self.assertEqual(response.data['governance']['rollout_gate_deny_total'], 1)
        self.assertEqual(
            response.data['governance']['rollout_gate_deny_by_endpoint']['stock_ai_advisory_session_api'],
            1,
        )
        self.assertEqual(
            response.data['governance']['rollout_gate_deny_by_reason']['allowlist_blocked'],
            1,
        )
        self.assertIn('allowlist', response.data['governance']['cohort_modes_seen'])

    def test_stock_ai_advisory_observability_get_supports_governance_day_bucket(self):
        self.authenticate()

        AdvisoryAggregateAuditLog.objects.create(
            user=self.user,
            symbol='BCM',
            before_state_json={},
            after_state_json={'operation': 'holistic_rollout_gate', 'outcome': 'denied'},
            reason=AdvisoryAggregateAuditLog.ReasonChoices.HOLISTIC_ROLLOUT_DENY,
            actor=AdvisoryAggregateAuditLog.ActorChoices.SYSTEM,
            actor_id='holistic_rollout_gate',
            metadata_json={
                'event_type': 'rollout_gate_deny',
                'endpoint': 'stock_ai_advisory_observability_api',
                'deny_reason': 'global_disabled',
                'cohort_mode': 'all',
            },
        )

        response = self.client.get(
            '/api/stock-management/stocks/BCM/ai-advisory-observability/?window_hours=48&limit=5&governance_bucket=day'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['ok'])
        self.assertEqual(response.data['governance']['trend_bucket'], 'day')
        self.assertGreaterEqual(len(response.data['governance']['rollout_gate_deny_trend']), 1)
        first_bucket = response.data['governance']['rollout_gate_deny_trend'][0]
        self.assertIn('bucket', first_bucket)
        self.assertGreaterEqual(first_bucket['deny_total'], 1)
        self.assertGreaterEqual(first_bucket['deny_by_endpoint'].get('stock_ai_advisory_observability_api', 0), 1)
        self.assertGreaterEqual(first_bucket['deny_by_reason'].get('global_disabled', 0), 1)
        self.assertGreaterEqual(first_bucket['deny_by_cohort_mode'].get('all', 0), 1)

    def test_stock_ai_advisory_observability_get_returns_400_for_invalid_governance_bucket(self):
        self.authenticate()

        response = self.client.get(
            '/api/stock-management/stocks/BCM/ai-advisory-observability/?window_hours=48&limit=5&governance_bucket=week'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['ok'])

    def test_stock_ai_advisory_observability_get_applies_governance_endpoint_reason_filters(self):
        self.authenticate()

        AdvisoryAggregateAuditLog.objects.create(
            user=self.user,
            symbol='BCM',
            before_state_json={},
            after_state_json={'operation': 'holistic_rollout_gate', 'outcome': 'denied'},
            reason=AdvisoryAggregateAuditLog.ReasonChoices.HOLISTIC_ROLLOUT_DENY,
            actor=AdvisoryAggregateAuditLog.ActorChoices.SYSTEM,
            actor_id='holistic_rollout_gate',
            metadata_json={
                'event_type': 'rollout_gate_deny',
                'endpoint': 'stock_ai_advisory_session_api',
                'deny_reason': 'allowlist_blocked',
                'cohort_mode': 'allowlist',
            },
        )
        AdvisoryAggregateAuditLog.objects.create(
            user=self.user,
            symbol='BCM',
            before_state_json={},
            after_state_json={'operation': 'holistic_rollout_gate', 'outcome': 'denied'},
            reason=AdvisoryAggregateAuditLog.ReasonChoices.HOLISTIC_ROLLOUT_DENY,
            actor=AdvisoryAggregateAuditLog.ActorChoices.SYSTEM,
            actor_id='holistic_rollout_gate',
            metadata_json={
                'event_type': 'rollout_gate_deny',
                'endpoint': 'stock_ai_advisory_observability_api',
                'deny_reason': 'staff_only',
                'cohort_mode': 'staff',
            },
        )

        response = self.client.get(
            '/api/stock-management/stocks/BCM/ai-advisory-observability/?window_hours=48&limit=5&governance_endpoint=stock_ai_advisory_session_api&governance_reason=allowlist_blocked'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['ok'])
        self.assertEqual(response.data['governance']['rollout_gate_deny_total'], 1)
        self.assertEqual(
            response.data['governance']['rollout_gate_deny_by_endpoint'].get('stock_ai_advisory_session_api'),
            1,
        )
        self.assertEqual(
            response.data['governance']['rollout_gate_deny_by_reason'].get('allowlist_blocked'),
            1,
        )
        self.assertEqual(response.data['governance']['filters']['endpoint'], 'stock_ai_advisory_session_api')
        self.assertEqual(response.data['governance']['filters']['reason'], 'allowlist_blocked')

    @override_settings(
        HOLISTIC_GOVERNANCE_DELTA_WARNING_THRESHOLD=1.5,
        HOLISTIC_GOVERNANCE_DELTA_CRITICAL_THRESHOLD=3.5,
        HOLISTIC_GOVERNANCE_DELTA_COOLDOWN_THRESHOLD=1.2,
    )
    def test_stock_ai_advisory_observability_get_includes_governance_delta_thresholds(self):
        self.authenticate()

        response = self.client.get('/api/stock-management/stocks/BCM/ai-advisory-observability/?window_hours=48&limit=5')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['ok'])
        self.assertEqual(response.data['governance']['delta_thresholds']['warning'], 1.5)
        self.assertEqual(response.data['governance']['delta_thresholds']['critical'], 3.5)
        self.assertEqual(response.data['governance']['delta_thresholds']['cooldown'], 1.2)

    @patch.dict(
        'os.environ',
        {
            'OPENAI_API_KEY': '',
            'OPENCLAW_API_KEY': '',
            'ANTHROPIC_API_KEY': '',
            'GEMINI_API_KEY': '',
            'COPILOT_API_KEY': '',
        },
        clear=False,
    )
    def test_stock_ai_advisory_components_generate_returns_409_when_ai_api_not_configured(self):
        self.authenticate()
        cfg = UserConfig.objects.get(user=self.user)
        cfg.ai_model = ''
        cfg.ai_api_key = ''
        cfg.save(update_fields=['ai_model', 'ai_api_key'])
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='BCM',
            matched_value=7_000_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Stock workspace summary',
            ai_detail='Stock workspace detail',
            ai_provider='copilot',
            ai_model='openai/gpt-4o',
        )

        response = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-components/generate/',
            {'timeframe': '15m'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertFalse(response.data['ok'])
        self.assertEqual(response.data['reason'], 'ai_not_configured')
        self.assertTrue(response.data.get('config_issue'))

    @override_settings(
        OPEN_CORE_QUOTA_ENFORCEMENT_ENABLED=True,
        OPEN_CORE_QUOTA_CAPS_BY_TIER={
            'community': {
                'api_calls_per_day': 300,
                'ai_regenerate_per_day': 1,
                'whale_symbols_max': 10,
                'exports_per_day': 0,
            },
        },
    )
    @patch('portfolio.views._sprint17_generate_component_templates_with_ai', return_value=[])
    @patch('portfolio.views._sprint17_build_component_templates')
    def test_stock_ai_advisory_components_generate_returns_429_when_ai_regenerate_quota_exceeded(self, mock_build_templates, _mock_generate_with_ai):
        cache.clear()
        self.authenticate()
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='BCM',
            matched_value=7_000_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Stock workspace summary',
            ai_detail='Stock workspace detail',
            ai_provider='copilot',
            ai_model='openai/gpt-4o',
        )

        mock_build_templates.return_value = [
            {
                'symbol': 'BCM',
                'component_type': 'indicator',
                'indicator_name': 'RSI',
                'status': 'neutral',
                'confidence_score': 6,
                'suggested_action': 'watch',
                'rationale_text': 'quota-test',
                'timeframe': '30m',
                'include_in_summary': True,
            },
        ]

        first = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-components/generate/',
            {'timeframe': '30m'},
            format='json',
        )
        second = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-components/generate/',
            {'timeframe': '30m'},
            format='json',
        )

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(second.data['code'], 'quota_exceeded')
        self.assertEqual(second.data['quota_key'], 'ai_regenerate_per_day')
        self.assertEqual(second.data['limit'], 1)
        self.assertEqual(second.data['remaining'], 0)

    def test_stock_ai_advisory_component_toggle_include_flips_flag(self):
        self.authenticate()
        component = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='RSI',
            status='neutral',
            confidence_score=5,
            suggested_action='watch',
            rationale_text='test',
            timeframe='30m',
            include_in_summary=True,
        )

        response = self.client.post(
            f'/api/stock-management/ai-advisory-components/{component.id}/toggle-include/',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        component.refresh_from_db()
        self.assertFalse(component.include_in_summary)
        self.assertFalse(response.data['component']['include_in_summary'])

    def test_stock_ai_advisory_component_toggle_include_returns_403_when_feature_locked_for_free_dpi_license(self):
        self._attach_dpi_license('free', {'sentiment_score': False})
        self.authenticate()
        component = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='RSI',
            status='neutral',
            confidence_score=5,
            suggested_action='watch',
            rationale_text='test',
            timeframe='30m',
            include_in_summary=True,
        )

        response = self.client.post(
            f'/api/stock-management/ai-advisory-components/{component.id}/toggle-include/',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['code'], 'feature_locked')
        self.assertEqual(response.data['feature_key'], 'sentiment_score')

    @override_settings(
        OPEN_CORE_QUOTA_ENFORCEMENT_ENABLED=True,
        OPEN_CORE_QUOTA_CAPS_BY_TIER={
            'pro_individual': {
                'api_calls_per_day': 1,
                'ai_regenerate_per_day': 30,
                'whale_symbols_max': 25,
                'exports_per_day': 20,
            },
        },
    )
    def test_stock_ai_advisory_component_toggle_include_returns_429_when_api_quota_exceeded(self):
        cache.clear()
        self._attach_dpi_license('pro', {'sentiment_score': True})
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'pro', 'email_verified': True})
        self.authenticate()
        component = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='RSI',
            status='neutral',
            confidence_score=5,
            suggested_action='watch',
            rationale_text='test',
            timeframe='30m',
            include_in_summary=True,
        )

        first = self.client.post(
            f'/api/stock-management/ai-advisory-components/{component.id}/toggle-include/',
            {},
            format='json',
        )
        second = self.client.post(
            f'/api/stock-management/ai-advisory-components/{component.id}/toggle-include/',
            {},
            format='json',
        )

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(second.data['code'], 'quota_exceeded')
        self.assertEqual(second.data['quota_key'], 'api_calls_per_day')

    def test_stock_ai_advisory_component_toggle_include_usage_tracking_calls_track_api_call(self):
        self._attach_dpi_license('pro', {'sentiment_score': True})
        self.authenticate()
        component = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='RSI',
            status='neutral',
            confidence_score=5,
            suggested_action='watch',
            rationale_text='test',
            timeframe='30m',
            include_in_summary=True,
        )

        with patch('portfolio.views.track_api_call') as mock_track_api_call:
            response = self.client.post(
                f'/api/stock-management/ai-advisory-components/{component.id}/toggle-include/',
                {},
                format='json',
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(mock_track_api_call.called)
        self.assertEqual(mock_track_api_call.call_args.kwargs.get('feature'), 'sentiment_score')
        self.assertEqual(mock_track_api_call.call_args.kwargs.get('status_code'), status.HTTP_200_OK)

    @patch('portfolio.views._sprint17_generate_component_templates_with_ai')
    def test_stock_ai_advisory_component_refresh_updates_only_target_component(self, mock_generate_with_ai):
        self.authenticate()
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='BCM',
            matched_value=7_000_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Stock workspace summary',
            ai_detail='Stock workspace detail',
            ai_provider='copilot',
            ai_model='openai/gpt-4o',
        )
        target = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='RSI',
            status='neutral',
            confidence_score=5,
            suggested_action='watch',
            rationale_text='old-target',
            timeframe='30m',
            include_in_summary=True,
        )
        untouched = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='price_action',
            indicator_name='Price Action',
            status='neutral',
            confidence_score=6,
            suggested_action='watch',
            rationale_text='old-untouched',
            timeframe='30m',
            include_in_summary=True,
        )
        mock_generate_with_ai.return_value = [
            {
                'symbol': 'BCM',
                'component_type': 'indicator',
                'indicator_name': 'RSI Làm mới',
                'status': 'breakout',
                'confidence_score': 8,
                'suggested_action': 'buy',
                'rationale_text': 'new-target',
                'timeframe': '30m',
                'include_in_summary': True,
            }
        ]

        response = self.client.post(
            f'/api/stock-management/ai-advisory-components/{target.id}/refresh/',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['ok'])
        self.assertEqual(response.data['component']['id'], target.id)
        self.assertEqual(response.data['component']['indicator_name'], 'RSI Làm mới')
        self.assertEqual(response.data['component']['status'], 'breakout')
        self.assertEqual(response.data['component']['suggested_action'], 'buy')
        target.refresh_from_db()
        untouched.refresh_from_db()
        self.assertEqual(target.rationale_text, 'new-target')
        self.assertEqual(untouched.rationale_text, 'old-untouched')

    def test_stock_ai_advisory_component_refresh_returns_404_when_component_missing(self):
        self.authenticate()

        response = self.client.post('/api/stock-management/ai-advisory-components/999999/refresh/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertFalse(response.data['ok'])

    def test_stock_ai_advisory_component_refresh_returns_403_when_feature_locked_for_free_dpi_license(self):
        self._attach_dpi_license('free', {'sentiment_score': False})
        self.authenticate()
        component = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='RSI',
            status='neutral',
            confidence_score=5,
            suggested_action='watch',
            rationale_text='test',
            timeframe='30m',
            include_in_summary=True,
        )

        response = self.client.post(
            f'/api/stock-management/ai-advisory-components/{component.id}/refresh/',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['code'], 'feature_locked')
        self.assertEqual(response.data['feature_key'], 'sentiment_score')

    @override_settings(
        OPEN_CORE_QUOTA_ENFORCEMENT_ENABLED=True,
        OPEN_CORE_QUOTA_CAPS_BY_TIER={
            'pro_individual': {
                'api_calls_per_day': 3000,
                'ai_regenerate_per_day': 1,
                'whale_symbols_max': 25,
                'exports_per_day': 20,
            },
        },
    )
    @patch('portfolio.views._sprint17_generate_component_templates_with_ai', return_value=[])
    @patch('portfolio.views._sprint17_build_component_templates')
    @patch('portfolio.order_flow.detect_dark_flow')
    def test_stock_ai_advisory_component_refresh_returns_429_when_ai_regenerate_quota_exceeded(
        self,
        mock_detect_dark_flow,
        mock_build_templates,
        _mock_generate_with_ai,
    ):
        cache.clear()
        self._attach_dpi_license('pro', {'sentiment_score': True})
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'pro', 'email_verified': True})
        self.authenticate()
        self._create_stock_workspace_advisory(symbol='BCM')
        component = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='RSI',
            status='neutral',
            confidence_score=5,
            suggested_action='watch',
            rationale_text='quota-test',
            timeframe='30m',
            include_in_summary=True,
        )
        mock_detect_dark_flow.return_value = {
            'signal_type': None,
            'strength': 0,
            'confidence': 'low',
            'components': {},
        }
        mock_build_templates.return_value = [
            {
                'symbol': 'BCM',
                'component_type': 'indicator',
                'indicator_name': 'RSI Refresh',
                'status': 'neutral',
                'confidence_score': 7,
                'suggested_action': 'watch',
                'rationale_text': 'quota-refresh',
                'timeframe': '30m',
                'include_in_summary': True,
            }
        ]

        first = self.client.post(
            f'/api/stock-management/ai-advisory-components/{component.id}/refresh/',
            {},
            format='json',
        )
        second = self.client.post(
            f'/api/stock-management/ai-advisory-components/{component.id}/refresh/',
            {},
            format='json',
        )

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(second.data['code'], 'quota_exceeded')
        self.assertEqual(second.data['quota_key'], 'ai_regenerate_per_day')

    @patch('portfolio.views._sprint17_generate_component_templates_with_ai')
    def test_stock_ai_advisory_component_refresh_usage_tracking_calls_track_api_call(self, mock_generate_with_ai):
        self._attach_dpi_license('pro', {'sentiment_score': True})
        self.authenticate()
        self._create_stock_workspace_advisory(symbol='BCM')
        component = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='RSI',
            status='neutral',
            confidence_score=5,
            suggested_action='watch',
            rationale_text='tracking-test',
            timeframe='30m',
            include_in_summary=True,
        )
        mock_generate_with_ai.return_value = [
            {
                'symbol': 'BCM',
                'component_type': 'indicator',
                'indicator_name': 'RSI New',
                'status': 'breakout',
                'confidence_score': 8,
                'suggested_action': 'buy',
                'rationale_text': 'tracking-refreshed',
                'timeframe': '30m',
                'include_in_summary': True,
            }
        ]

        with patch('portfolio.views.track_api_call') as mock_track_api_call:
            response = self.client.post(
                f'/api/stock-management/ai-advisory-components/{component.id}/refresh/',
                {},
                format='json',
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(mock_track_api_call.called)
        self.assertEqual(mock_track_api_call.call_args.kwargs.get('feature'), 'sentiment_score')
        self.assertEqual(mock_track_api_call.call_args.kwargs.get('status_code'), status.HTTP_200_OK)

    def test_stock_ai_advisory_component_delete_soft_deletes_record(self):
        self.authenticate()
        component = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='MACD',
            status='neutral',
            confidence_score=5,
            suggested_action='watch',
            rationale_text='test',
            timeframe='30m',
            include_in_summary=True,
        )

        response = self.client.delete(f'/api/stock-management/ai-advisory-components/{component.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        component.refresh_from_db()
        self.assertTrue(component.is_deleted)
        self.assertFalse(component.include_in_summary)

    def test_stock_ai_advisory_component_delete_returns_403_when_feature_locked_for_free_dpi_license(self):
        self._attach_dpi_license('free', {'sentiment_score': False})
        self.authenticate()
        component = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='MACD',
            status='neutral',
            confidence_score=5,
            suggested_action='watch',
            rationale_text='test',
            timeframe='30m',
            include_in_summary=True,
        )

        response = self.client.delete(f'/api/stock-management/ai-advisory-components/{component.id}/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['code'], 'feature_locked')
        self.assertEqual(response.data['feature_key'], 'sentiment_score')

    @override_settings(
        OPEN_CORE_QUOTA_ENFORCEMENT_ENABLED=True,
        OPEN_CORE_QUOTA_CAPS_BY_TIER={
            'pro_individual': {
                'api_calls_per_day': 1,
                'ai_regenerate_per_day': 30,
                'whale_symbols_max': 25,
                'exports_per_day': 20,
            },
        },
    )
    def test_stock_ai_advisory_component_delete_returns_429_when_api_quota_exceeded(self):
        cache.clear()
        self._attach_dpi_license('pro', {'sentiment_score': True})
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'pro', 'email_verified': True})
        self.authenticate()
        first_component = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='MACD',
            status='neutral',
            confidence_score=5,
            suggested_action='watch',
            rationale_text='first',
            timeframe='30m',
            include_in_summary=True,
        )
        second_component = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='RSI',
            status='neutral',
            confidence_score=5,
            suggested_action='watch',
            rationale_text='second',
            timeframe='30m',
            include_in_summary=True,
        )

        first = self.client.delete(f'/api/stock-management/ai-advisory-components/{first_component.id}/')
        second = self.client.delete(f'/api/stock-management/ai-advisory-components/{second_component.id}/')

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(second.data['code'], 'quota_exceeded')
        self.assertEqual(second.data['quota_key'], 'api_calls_per_day')

    def test_stock_ai_advisory_component_delete_usage_tracking_calls_track_api_call(self):
        self._attach_dpi_license('pro', {'sentiment_score': True})
        self.authenticate()
        component = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='MACD',
            status='neutral',
            confidence_score=5,
            suggested_action='watch',
            rationale_text='test',
            timeframe='30m',
            include_in_summary=True,
        )

        with patch('portfolio.views.track_api_call') as mock_track_api_call:
            response = self.client.delete(f'/api/stock-management/ai-advisory-components/{component.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(mock_track_api_call.called)
        self.assertEqual(mock_track_api_call.call_args.kwargs.get('feature'), 'sentiment_score')
        self.assertEqual(mock_track_api_call.call_args.kwargs.get('status_code'), status.HTTP_200_OK)

    def test_stock_ai_advisory_component_clear_deleted_hard_deletes_deleted_records(self):
        self._attach_dpi_license('pro', {'sentiment_score': True})
        self.authenticate()

        deleted_component = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='MACD',
            status='neutral',
            confidence_score=5,
            suggested_action='watch',
            rationale_text='deleted',
            timeframe='30m',
            include_in_summary=False,
            is_deleted=True,
        )
        AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='RSI',
            status='neutral',
            confidence_score=5,
            suggested_action='watch',
            rationale_text='active',
            timeframe='30m',
            include_in_summary=True,
            is_deleted=False,
        )

        response = self.client.delete('/api/stock-management/stocks/BCM/ai-advisory-components/deleted/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['ok'])
        self.assertEqual(response.data['deleted_count'], 1)
        self.assertFalse(AIAdvisoryComponentRecord.objects.filter(id=deleted_component.id).exists())
        self.assertEqual(
            AIAdvisoryComponentRecord.objects.filter(user=self.user, symbol='BCM', is_deleted=False).count(),
            1,
        )

    def test_stock_ai_advisory_component_restore_reactivates_record(self):
        self.authenticate()
        component = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='MACD',
            status='neutral',
            confidence_score=5,
            suggested_action='watch',
            rationale_text='test',
            timeframe='30m',
            include_in_summary=False,
            is_deleted=True,
        )

        response = self.client.post(
            f'/api/stock-management/ai-advisory-components/{component.id}/restore/',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['ok'])
        component.refresh_from_db()
        self.assertFalse(component.is_deleted)
        self.assertTrue(component.include_in_summary)
        self.assertEqual(response.data['component']['id'], component.id)

    def test_stock_ai_advisory_component_restore_returns_403_when_feature_locked_for_free_dpi_license(self):
        self._attach_dpi_license('free', {'sentiment_score': False})
        self.authenticate()
        component = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='MACD',
            status='neutral',
            confidence_score=5,
            suggested_action='watch',
            rationale_text='test',
            timeframe='30m',
            include_in_summary=False,
            is_deleted=True,
        )

        response = self.client.post(
            f'/api/stock-management/ai-advisory-components/{component.id}/restore/',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['code'], 'feature_locked')
        self.assertEqual(response.data['feature_key'], 'sentiment_score')

    @override_settings(
        OPEN_CORE_QUOTA_ENFORCEMENT_ENABLED=True,
        OPEN_CORE_QUOTA_CAPS_BY_TIER={
            'pro_individual': {
                'api_calls_per_day': 1,
                'ai_regenerate_per_day': 30,
                'whale_symbols_max': 25,
                'exports_per_day': 20,
            },
        },
    )
    def test_stock_ai_advisory_component_restore_returns_429_when_api_quota_exceeded(self):
        cache.clear()
        self._attach_dpi_license('pro', {'sentiment_score': True})
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'pro', 'email_verified': True})
        self.authenticate()
        first_component = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='MACD',
            status='neutral',
            confidence_score=5,
            suggested_action='watch',
            rationale_text='first',
            timeframe='30m',
            include_in_summary=False,
            is_deleted=True,
        )
        second_component = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='RSI',
            status='neutral',
            confidence_score=5,
            suggested_action='watch',
            rationale_text='second',
            timeframe='30m',
            include_in_summary=False,
            is_deleted=True,
        )

        first = self.client.post(
            f'/api/stock-management/ai-advisory-components/{first_component.id}/restore/',
            {},
            format='json',
        )
        second = self.client.post(
            f'/api/stock-management/ai-advisory-components/{second_component.id}/restore/',
            {},
            format='json',
        )

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(second.data['code'], 'quota_exceeded')
        self.assertEqual(second.data['quota_key'], 'api_calls_per_day')

    def test_stock_ai_advisory_component_restore_usage_tracking_calls_track_api_call(self):
        self._attach_dpi_license('pro', {'sentiment_score': True})
        self.authenticate()
        component = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='MACD',
            status='neutral',
            confidence_score=5,
            suggested_action='watch',
            rationale_text='test',
            timeframe='30m',
            include_in_summary=False,
            is_deleted=True,
        )

        with patch('portfolio.views.track_api_call') as mock_track_api_call:
            response = self.client.post(
                f'/api/stock-management/ai-advisory-components/{component.id}/restore/',
                {},
                format='json',
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(mock_track_api_call.called)
        self.assertEqual(mock_track_api_call.call_args.kwargs.get('feature'), 'sentiment_score')
        self.assertEqual(mock_track_api_call.call_args.kwargs.get('status_code'), status.HTTP_200_OK)

    @patch('portfolio.views._cache_get', return_value=None)
    def test_stock_ai_advisory_summary_regenerate_creates_version(self, _mock_cache_get):
        self.authenticate()
        first = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='price_action',
            indicator_name='Price Action',
            status='accumulation',
            confidence_score=7,
            suggested_action='buy',
            rationale_text='test',
            timeframe='30m',
            include_in_summary=True,
        )
        second = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='RSI',
            status='neutral',
            confidence_score=6,
            suggested_action='watch',
            rationale_text='test',
            timeframe='30m',
            include_in_summary=True,
        )

        response = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-summary/regenerate/',
            {'component_ids': [first.id, second.id]},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['ok'])
        summary = AIAdvisoryExecutiveSummary.objects.filter(user=self.user, symbol='BCM').latest('created_at')
        self.assertEqual(summary.summary_version, 1)
        self.assertEqual(set(summary.used_component_ids), {first.id, second.id})

    @patch('portfolio.views._cache_get', return_value=None)
    @patch('portfolio.views._sprint17_generate_executive_synthesis_with_ai', return_value='- Dong 1\n- Dong 2\n- Dong 3')
    def test_stock_ai_advisory_summary_regenerate_prefers_ai_detailed_synthesis(self, _mock_ai_synthesis, _mock_cache_get):
        self.authenticate()
        first = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='price_action',
            indicator_name='Price Action',
            status='accumulation',
            confidence_score=7,
            suggested_action='buy',
            rationale_text='test',
            timeframe='30m',
            include_in_summary=True,
        )

        response = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-summary/regenerate/',
            {'component_ids': [first.id]},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        summary = AIAdvisoryExecutiveSummary.objects.filter(user=self.user, symbol='BCM').latest('created_at')
        self.assertIn('- Dong 1', summary.synthesis_text)
        self.assertIn('- Dong 2', summary.synthesis_text)
        self.assertIn('Evidence bullets:', summary.synthesis_text)
        self.assertIn('Invalidating conditions:', summary.synthesis_text)

    @patch('portfolio.views._cache_get', return_value=None)
    @patch('portfolio.views._sprint17_generate_executive_synthesis_with_ai', return_value='- Chi tiet')
    def test_stock_ai_advisory_summary_regenerate_passes_synthesis_preference(self, mock_ai_synthesis, _mock_cache_get):
        self.authenticate()
        component = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='RSI',
            status='neutral',
            confidence_score=6,
            suggested_action='watch',
            rationale_text='test',
            timeframe='30m',
            include_in_summary=True,
        )

        response = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-summary/regenerate/',
            {
                'component_ids': [component.id],
                'synthesis_preference': 'risk_management',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(mock_ai_synthesis.called)
        self.assertEqual(mock_ai_synthesis.call_args.kwargs.get('synthesis_preference'), 'risk_management')

    @patch('portfolio.views._cache_get', return_value='2026-04-04T10:00:00+07:00')
    def test_stock_ai_advisory_summary_regenerate_returns_429_when_cooldown_active(self, _mock_cache_get):
        self.authenticate()

        response = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-summary/regenerate/',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertFalse(response.data['ok'])
        self.assertIn('retry_after_seconds', response.data)

    def test_stock_ai_advisory_summary_regenerate_returns_403_when_feature_locked_for_free_dpi_license(self):
        self._attach_dpi_license('free', {'sentiment_score': False})
        self.authenticate()

        response = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-summary/regenerate/',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['code'], 'feature_locked')
        self.assertEqual(response.data['feature_key'], 'sentiment_score')

    @override_settings(
        OPEN_CORE_QUOTA_ENFORCEMENT_ENABLED=True,
        OPEN_CORE_QUOTA_CAPS_BY_TIER={
            'pro_individual': {
                'api_calls_per_day': 3000,
                'ai_regenerate_per_day': 1,
                'whale_symbols_max': 25,
                'exports_per_day': 20,
            },
        },
    )
    @patch('portfolio.views._cache_get', return_value=None)
    def test_stock_ai_advisory_summary_regenerate_returns_429_when_ai_regenerate_quota_exceeded(self, _mock_cache_get):
        cache.clear()
        self._attach_dpi_license('pro', {'sentiment_score': True})
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'pro', 'email_verified': True})
        self.authenticate()
        component = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='RSI',
            status='neutral',
            confidence_score=6,
            suggested_action='watch',
            rationale_text='quota-summary',
            timeframe='30m',
            include_in_summary=True,
        )

        first = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-summary/regenerate/',
            {'component_ids': [component.id]},
            format='json',
        )
        second = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-summary/regenerate/',
            {'component_ids': [component.id]},
            format='json',
        )

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(second.data['code'], 'quota_exceeded')
        self.assertEqual(second.data['quota_key'], 'ai_regenerate_per_day')

    @patch('portfolio.views._cache_get', return_value=None)
    def test_stock_ai_advisory_summary_regenerate_usage_tracking_calls_track_api_call(self, _mock_cache_get):
        self._attach_dpi_license('pro', {'sentiment_score': True})
        self.authenticate()
        component = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='indicator',
            indicator_name='RSI',
            status='neutral',
            confidence_score=6,
            suggested_action='watch',
            rationale_text='tracking-summary',
            timeframe='30m',
            include_in_summary=True,
        )

        with patch('portfolio.views.track_api_call') as mock_track_api_call:
            response = self.client.post(
                '/api/stock-management/stocks/BCM/ai-advisory-summary/regenerate/',
                {'component_ids': [component.id]},
                format='json',
            )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(mock_track_api_call.called)
        self.assertEqual(mock_track_api_call.call_args.kwargs.get('feature'), 'sentiment_score')
        self.assertEqual(mock_track_api_call.call_args.kwargs.get('status_code'), status.HTTP_201_CREATED)

    def test_stock_ai_advisory_summary_delete_removes_selected_summary(self):
        self._attach_dpi_license('pro', {'sentiment_score': True})
        self.authenticate()
        summary = AIAdvisoryExecutiveSummary.objects.create(
            user=self.user,
            symbol='BCM',
            summary_version=1,
            strategy_action='HOLD',
            risk_level='medium',
            overall_confidence=6,
            synthesis_text='summary',
            used_component_ids=[1, 2],
        )

        response = self.client.delete(
            f'/api/stock-management/stocks/BCM/ai-advisory-summary/{summary.id}/'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['ok'])
        self.assertFalse(AIAdvisoryExecutiveSummary.objects.filter(id=summary.id).exists())

    @patch('portfolio.views._cache_get', return_value=None)
    def test_stock_ai_advisory_session_returns_summary_history_desc_by_version(self, _mock_cache_get):
        self.authenticate()
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='BCM',
            matched_value=7_000_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Stock workspace summary',
            ai_detail='Stock workspace detail',
            ai_provider='copilot',
            ai_model='openai/gpt-4o',
        )
        component = AIAdvisoryComponentRecord.objects.create(
            user=self.user,
            symbol='BCM',
            component_type='price_action',
            indicator_name='Price Action',
            status='accumulation',
            confidence_score=7,
            suggested_action='buy',
            rationale_text='test',
            timeframe='30m',
            include_in_summary=True,
        )

        first = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-summary/regenerate/',
            {'component_ids': [component.id]},
            format='json',
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)

        with patch('portfolio.views._cache_get', return_value=None):
            second = self.client.post(
                '/api/stock-management/stocks/BCM/ai-advisory-summary/regenerate/',
                {'component_ids': [component.id]},
                format='json',
            )
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)

        session_response = self.client.get('/api/stock-management/stocks/BCM/ai-advisory-session/')
        self.assertEqual(session_response.status_code, status.HTTP_200_OK)
        self.assertTrue(session_response.data['executive_summaries'])
        versions = [item['summary_version'] for item in session_response.data['executive_summaries']]
        self.assertEqual(versions[0], 2)
        self.assertIn(1, versions)

    @patch('portfolio.views._cache_get', return_value='2026-04-04T10:00:00+07:00')
    def test_stock_ai_advisory_session_post_returns_429_when_refresh_cooldown_active(self, _mock_cache_get):
        self.authenticate()

        response = self.client.post('/api/stock-management/stocks/BCM/ai-advisory-session/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertFalse(response.data['queued'])
        self.assertEqual(response.data['symbol'], 'BCM')
        self.assertIn('retry_after_seconds', response.data)

    @patch('portfolio.views._cache_get', return_value=None)
    @patch('portfolio.tasks.generate_whale_advisory_task.apply_async', side_effect=RuntimeError('broker down'))
    def test_stock_ai_advisory_session_post_returns_503_when_queue_unavailable(self, _mock_apply_async, _mock_cache_get):
        self.authenticate()
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='BCM',
            matched_value=7_000_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Stock workspace summary',
            ai_detail='Stock workspace detail',
            ai_provider='copilot',
            ai_model='openai/gpt-4o',
        )

        response = self.client.post('/api/stock-management/stocks/BCM/ai-advisory-session/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertFalse(response.data['ok'])
        self.assertFalse(response.data['queued'])
        self.assertEqual(response.data['symbol'], 'BCM')
        self.assertIn('queue', response.data['message'].lower())

    @patch('portfolio.views._cache_set')
    @patch('portfolio.views._cache_get', return_value=None)
    @patch('vnstock.Vnstock')
    def test_whale_feed_cache_key_scopes_by_user_and_threshold(self, mock_vnstock, _mock_cache_get, mock_cache_set):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'free', 'email_verified': True, 'whale_alert_threshold': 750},
        )
        self.authenticate()

        intraday_df = pd.DataFrame([
            {'time': '2026-04-03T09:30:00+07:00', 'price': 100000, 'volume': 12000, 'match_type': 'buy'},
            {'time': '2026-04-03T09:31:00+07:00', 'price': 99500, 'volume': 4000, 'match_type': 'sell'},
        ])
        mock_vnstock.return_value.stock.return_value.quote.intraday.return_value = intraday_df

        response = self.client.get('/api/realtime/whale-feed/FPT/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['threshold'], 750_000_000)
        cache_key = mock_cache_set.call_args.args[0]
        self.assertEqual(cache_key, f'whale_feed:{self.user.id}:FPT:750000000')

    @patch('portfolio.realtime.stream_reader.StreamReader')
    @patch('portfolio.views._cache_get', return_value=None)
    @patch('vnstock.Vnstock')
    def test_whale_feed_response_contains_scoring_contract(self, mock_vnstock, _mock_cache_get, mock_stream_reader):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'free', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        self.authenticate()
        mock_stream_reader.return_value.get_intraday_ticks.return_value = []

        intraday_df = pd.DataFrame([
            {'time': '2026-04-03T09:30:00+07:00', 'price': 100000, 'volume': 12000, 'match_type': 'buy'},
            {'time': '2026-04-03T09:31:00+07:00', 'price': 99500, 'volume': 4000, 'match_type': 'sell'},
        ])
        mock_vnstock.return_value.stock.return_value.quote.intraday.return_value = intraday_df

        response = self.client.get('/api/realtime/whale-feed/FPT/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['weights_version'], 'weights-v1')
        self.assertEqual(response.data.get('threshold_source'), 'user_default')
        self.assertEqual(len(response.data['whale_orders']), 1)
        order = response.data['whale_orders'][0]
        self.assertEqual(order.get('threshold_source'), 'user_default')
        self.assertIn('event_score', order)
        self.assertIn('display_score', order)
        self.assertIn('severity', order)
        self.assertIn('score_breakdown', order)
        self.assertEqual(order['weights_version'], response.data['weights_version'])
        self.assertLessEqual(order['display_score'], order['event_score'])

    @patch('portfolio.realtime.stream_reader.StreamReader')
    @patch('portfolio.views._cache_get', return_value=None)
    @patch('vnstock.Vnstock')
    def test_whale_feed_falls_back_to_intraday_tick_db_when_stream_and_vnstock_unavailable(self, mock_vnstock, _mock_cache_get, mock_stream_reader):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'premium', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        self.authenticate()
        mock_stream_reader.return_value.get_intraday_ticks.return_value = []
        mock_vnstock.return_value.stock.return_value.quote.intraday.side_effect = RuntimeError('vnstock unavailable')

        IntradayTick.objects.create(
            symbol='MWG',
            trade_date=date.today(),
            trade_time=datetime.strptime('10:31:15', '%H:%M:%S').time(),
            price=Decimal('61800'),
            volume=16000,
            side='BUY',
            stream_id='mwg-db-1',
        )
        IntradayTick.objects.create(
            symbol='MWG',
            trade_date=date.today(),
            trade_time=datetime.strptime('11:22:33', '%H:%M:%S').time(),
            price=Decimal('60500'),
            volume=21000,
            side='SELL',
            stream_id='mwg-db-2',
        )

        response = self.client.get('/api/realtime/whale-feed/MWG/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'MWG')
        self.assertGreaterEqual(len(response.data['whale_orders']), 2)
        self.assertEqual(response.data['whale_orders'][0]['side'], 'sell')

    @patch('portfolio.realtime.stream_reader.StreamReader')
    @patch('portfolio.views._cache_get', return_value=None)
    @patch('vnstock.Vnstock')
    def test_whale_feed_falls_back_to_intraday_tick_db_when_stream_has_no_threshold_hits(self, mock_vnstock, _mock_cache_get, mock_stream_reader):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'premium', 'email_verified': True, 'whale_alert_threshold': 750},
        )
        self.authenticate()
        mock_stream_reader.return_value.get_intraday_ticks.return_value = [
            {'price': 61800, 'volume': 60, 'side': 'BUY', 'ts': '2026-04-03T10:31:15+07:00'},
            {'price': 60500, 'volume': 120, 'side': 'SELL', 'ts': '2026-04-03T11:22:33+07:00'},
        ]
        mock_vnstock.return_value.stock.return_value.quote.intraday.side_effect = RuntimeError('vnstock unavailable')

        IntradayTick.objects.create(
            symbol='MWG',
            trade_date=date.today(),
            trade_time=datetime.strptime('10:31:15', '%H:%M:%S').time(),
            price=Decimal('61800'),
            volume=16000,
            side='BUY',
            stream_id='mwg-db-threshold-1',
        )
        IntradayTick.objects.create(
            symbol='MWG',
            trade_date=date.today(),
            trade_time=datetime.strptime('11:22:33', '%H:%M:%S').time(),
            price=Decimal('60500'),
            volume=21000,
            side='SELL',
            stream_id='mwg-db-threshold-2',
        )

        response = self.client.get('/api/realtime/whale-feed/MWG/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'MWG')
        self.assertGreaterEqual(len(response.data['whale_orders']), 2)
        self.assertEqual(response.data['whale_orders'][0]['side'], 'sell')

    @patch('portfolio.realtime.stream_reader.StreamReader')
    @patch('portfolio.views._cache_get', return_value=None)
    @patch('vnstock.Vnstock')
    def test_whale_feed_db_fallback_keeps_older_threshold_hits_beyond_latest_500_ticks(self, mock_vnstock, _mock_cache_get, mock_stream_reader):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'premium', 'email_verified': True, 'whale_alert_threshold': 750},
        )
        self.authenticate()
        mock_stream_reader.return_value.get_intraday_ticks.return_value = [
            {'price': 79.3, 'volume': 697800, 'side': 'UNKNOWN', 'ts': '2026-04-03T14:45:00+07:00'},
        ]
        mock_vnstock.return_value.stock.return_value.quote.intraday.side_effect = RuntimeError('vnstock unavailable')

        older_hits = [
            IntradayTick(
                symbol='MWG',
                trade_date=date.today(),
                trade_time=datetime.strptime('10:31:15', '%H:%M:%S').time(),
                price=Decimal('61800'),
                volume=16000,
                side='BUY',
                stream_id='mwg-older-hit-1',
            ),
            IntradayTick(
                symbol='MWG',
                trade_date=date.today(),
                trade_time=datetime.strptime('11:22:33', '%H:%M:%S').time(),
                price=Decimal('60500'),
                volume=21000,
                side='SELL',
                stream_id='mwg-older-hit-2',
            ),
        ]
        newer_small_ticks = [
            IntradayTick(
                symbol='MWG',
                trade_date=date.today(),
                trade_time=datetime.strptime('14:45:00', '%H:%M:%S').time(),
                price=Decimal('79.30'),
                volume=697800,
                side='UNKNOWN',
                stream_id=f'mwg-small-{index}',
            )
            for index in range(501)
        ]
        IntradayTick.objects.bulk_create(older_hits + newer_small_ticks)

        response = self.client.get('/api/realtime/whale-feed/MWG/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'MWG')
        self.assertGreaterEqual(len(response.data['whale_orders']), 2)
        returned_sides = {item['side'] for item in response.data['whale_orders']}
        self.assertIn('buy', returned_sides)
        self.assertIn('sell', returned_sides)

    def test_whale_feed_aggregate_defaults_to_tracked_symbols_and_returns_entitlements(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'pro', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        TrackedSymbol.objects.create(user=self.user, symbol='FPT')
        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:15:00', '%H:%M:%S').time(),
            price=Decimal('100000'),
            volume=7000,
            side='BUY',
            stream_id='fpt-1',
        )
        IntradayTick.objects.create(
            symbol='HPG',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:16:00', '%H:%M:%S').time(),
            price=Decimal('100000'),
            volume=8000,
            side='SELL',
            stream_id='hpg-1',
        )
        self.authenticate()

        response = self.client.get('/api/realtime/whale-feed/aggregate/?window=5d')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['filters']['scope'], 'tracked')
        self.assertEqual(response.data['filters']['symbols'], ['FPT'])
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['symbol'], 'FPT')
        self.assertEqual(response.data['results'][0]['event_id'], f"tick:{response.data['results'][0]['id']}")
        self.assertIn('event_score', response.data['results'][0])
        self.assertIn('display_score', response.data['results'][0])
        self.assertIn('severity', response.data['results'][0])
        self.assertIn('alert_at', response.data['results'][0])
        self.assertIn('alert_first_seen_at', response.data['results'][0])
        self.assertIn('alert_age_seconds', response.data['results'][0])
        self.assertIn('score_breakdown', response.data['results'][0])
        self.assertEqual(response.data['results'][0]['weights_version'], response.data['weights_version'])
        self.assertLessEqual(response.data['results'][0]['display_score'], response.data['results'][0]['event_score'])
        self.assertTrue(response.data['entitlements']['can_read_whale_advisory'])
        self.assertFalse(response.data['entitlements']['can_read_whale_advisory_detail'])

    @patch('portfolio.realtime.stream_reader.StreamReader')
    def test_whale_feed_aggregate_prefers_redis_stream_over_intraday_tick_db(self, mock_stream_reader):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'pro', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        TrackedSymbol.objects.create(user=self.user, symbol='FPT')
        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:15:00', '%H:%M:%S').time(),
            price=Decimal('100000'),
            volume=7000,
            side='BUY',
            stream_id='db-fpt-1',
        )
        mock_stream_reader.return_value.get_intraday_ticks.return_value = [
            {
                'price': 101000,
                'volume': 10000,
                'side': 'BUY',
                'ts': (timezone.now() - timedelta(minutes=1)).isoformat(),
            },
        ]
        self.authenticate()

        response = self.client.get('/api/realtime/whale-feed/aggregate/?window=5d')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['source'], 'redis_stream')
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['source'], 'redis_stream')

    @override_settings(
        OPEN_CORE_QUOTA_ENFORCEMENT_ENABLED=True,
        OPEN_CORE_QUOTA_CAPS_BY_TIER={
            'community': {
                'api_calls_per_day': 1,
                'ai_regenerate_per_day': 0,
                'whale_symbols_max': 10,
                'exports_per_day': 0,
            },
        },
    )
    def test_whale_feed_aggregate_returns_429_when_api_quota_exceeded(self):
        cache.clear()
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'free', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        self.authenticate()

        first = self.client.get('/api/realtime/whale-feed/aggregate/')
        second = self.client.get('/api/realtime/whale-feed/aggregate/')

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(second.data['code'], 'quota_exceeded')
        self.assertEqual(second.data['quota_key'], 'api_calls_per_day')
        self.assertEqual(second.data['limit'], 1)
        self.assertEqual(second.data['remaining'], 0)

    @patch('portfolio.realtime.stream_reader.StreamReader')
    @patch('vnstock.Vnstock')
    def test_whale_feed_aggregate_falls_back_to_vnstock_after_stream_and_db_miss(self, mock_vnstock, mock_stream_reader):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'free', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        TrackedSymbol.objects.create(user=self.user, symbol='FPT')
        mock_stream_reader.return_value.get_intraday_ticks.return_value = []
        mock_vnstock.return_value.stock.return_value.quote.intraday.return_value = pd.DataFrame([
            {
                'time': (timezone.now() - timedelta(minutes=1)).isoformat(),
                'price': 100000,
                'volume': 12000,
                'match_type': 'buy',
            },
        ])
        self.authenticate()

        response = self.client.get('/api/realtime/whale-feed/aggregate/?window=5d')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['source'], 'vnstock')
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['symbol'], 'FPT')

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    def test_whale_campaigns_groups_events_into_campaigns(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'pro', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        TrackedSymbol.objects.create(user=self.user, symbol='FPT')
        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:15:00', '%H:%M:%S').time(),
            price=Decimal('100000'),
            volume=7000,
            side='BUY',
            stream_id='camp-fpt-1',
        )
        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:20:00', '%H:%M:%S').time(),
            price=Decimal('101000'),
            volume=7500,
            side='BUY',
            stream_id='camp-fpt-2',
        )
        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today(),
            trade_time=datetime.strptime('11:00:00', '%H:%M:%S').time(),
            price=Decimal('102000'),
            volume=7600,
            side='SELL',
            stream_id='camp-fpt-3',
        )
        self.authenticate()

        response = self.client.get('/api/realtime/whale-campaigns/?window=5d&campaign_limit=10&campaign_sort=strength')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.data)
        self.assertGreaterEqual(len(response.data['results']), 2)
        first_campaign = response.data['results'][0]
        self.assertIn('campaign_id', first_campaign)
        self.assertIn('campaign_strength', first_campaign)
        self.assertIn('events', first_campaign)
        self.assertGreaterEqual(first_campaign['event_count'], 1)
        self.assertIn('campaign_sort', response.data['filters'])

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    def test_whale_campaigns_rejects_invalid_campaign_limit(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'free', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        TrackedSymbol.objects.create(user=self.user, symbol='FPT')
        self.authenticate()

        response = self.client.get('/api/realtime/whale-campaigns/?campaign_limit=0')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    def test_whale_campaigns_supports_cursor_pagination(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'pro', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        TrackedSymbol.objects.create(user=self.user, symbol='FPT')
        TrackedSymbol.objects.create(user=self.user, symbol='HPG')

        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:05:00', '%H:%M:%S').time(),
            price=Decimal('100000'),
            volume=7000,
            side='BUY',
            stream_id='camp-page-fpt-1',
        )
        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:07:00', '%H:%M:%S').time(),
            price=Decimal('101000'),
            volume=7200,
            side='BUY',
            stream_id='camp-page-fpt-2',
        )
        IntradayTick.objects.create(
            symbol='HPG',
            trade_date=date.today(),
            trade_time=datetime.strptime('10:15:00', '%H:%M:%S').time(),
            price=Decimal('45000'),
            volume=15000,
            side='SELL',
            stream_id='camp-page-hpg-1',
        )
        IntradayTick.objects.create(
            symbol='HPG',
            trade_date=date.today(),
            trade_time=datetime.strptime('10:20:00', '%H:%M:%S').time(),
            price=Decimal('45200'),
            volume=14000,
            side='SELL',
            stream_id='camp-page-hpg-2',
        )

        self.authenticate()

        first_response = self.client.get('/api/realtime/whale-campaigns/?window=5d&campaign_limit=1&campaign_sort=latest')
        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(first_response.data['results']), 1)
        self.assertTrue(first_response.data['has_more'])
        self.assertIsNotNone(first_response.data.get('next_cursor'))

        first_campaign_id = first_response.data['results'][0]['campaign_id']
        next_cursor = first_response.data['next_cursor']

        second_response = self.client.get(
            '/api/realtime/whale-campaigns/',
            {
                'window': '5d',
                'campaign_limit': 1,
                'campaign_sort': 'latest',
                'cursor': next_cursor,
            },
        )
        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(second_response.data['results']), 1)
        self.assertNotEqual(second_response.data['results'][0]['campaign_id'], first_campaign_id)

    @override_settings(BASELINE_CACHE_ENABLED=True)
    @patch('portfolio.baseline_cache_service.enrich_campaign_with_baseline')
    def test_whale_campaigns_applies_baseline_enrichment_hook(self, mock_enrich):
        def _inject(campaign):
            item = dict(campaign)
            item['baseline_context'] = {'adv_relative': 0.12}
            return item

        mock_enrich.side_effect = _inject

        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'pro', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        TrackedSymbol.objects.create(user=self.user, symbol='FPT')

        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:10:00', '%H:%M:%S').time(),
            price=Decimal('100000'),
            volume=7000,
            side='BUY',
            stream_id='camp-baseline-1',
        )
        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:12:00', '%H:%M:%S').time(),
            price=Decimal('101000'),
            volume=7200,
            side='BUY',
            stream_id='camp-baseline-2',
        )

        self.authenticate()
        response = self.client.get('/api/realtime/whale-campaigns/?window=5d&campaign_limit=5')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data['results']), 1)
        self.assertIn('baseline_context', response.data['results'][0])
        self.assertTrue(mock_enrich.called)

    def test_build_whale_payload_includes_trust_metadata_fields(self):
        from portfolio.realtime.compute import WhaleSignal, build_whale_payload

        signal = WhaleSignal(
            symbol='FPT',
            matched_value=1_250_000_000,
            side='BUY',
            threshold=500_000_000,
            ts=datetime.now().isoformat(),
        )

        payload = build_whale_payload(
            signal=signal,
            seq=1,
            source='intraday-engine:active',
            threshold_source='symbol_override',
            recovered=False,
        )

        self.assertIn('source_layer', payload)
        self.assertIn('freshness_bucket', payload)
        self.assertIn('recovered', payload)
        self.assertIn('threshold_source', payload)
        self.assertEqual(payload['source_layer'], 'live')
        self.assertEqual(payload['threshold_source'], 'symbol_override')
        self.assertEqual(payload['recovered'], False)

    def test_baseline_cache_service_exposes_phase1_interface(self):
        from portfolio.baseline_cache_service import BaselineCacheService

        service = BaselineCacheService()
        baseline = service.fetch_symbol_baseline('FPT', days=20)

        self.assertIsInstance(baseline, dict)
        self.assertEqual(baseline['symbol'], 'FPT')
        self.assertEqual(baseline['days'], 20)
        self.assertIn('adv_vnd', baseline)
        self.assertIn('p90_session_vnd', baseline)
        self.assertIn('computed_at', baseline)

    @patch.dict('os.environ', {'WHALE_AGGREGATE_VNSTOCK_MAX_SYMBOLS': '2'}, clear=False)
    @patch('portfolio.realtime.stream_reader.StreamReader')
    @patch('vnstock.Vnstock')
    def test_whale_feed_aggregate_skips_vnstock_fallback_for_large_symbol_sets(self, mock_vnstock, mock_stream_reader):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'free', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        for symbol in ['FPT', 'HPG', 'VCB']:
            TrackedSymbol.objects.create(user=self.user, symbol=symbol)
        mock_stream_reader.return_value.get_intraday_ticks.return_value = []
        self.authenticate()

        response = self.client.get('/api/realtime/whale-feed/aggregate/?window=5d')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['source'], 'intraday_tick_db')
        self.assertEqual(response.data['results'], [])
        mock_vnstock.assert_not_called()

    def test_whale_feed_aggregate_supports_watchlist_filter(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'free', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        watchlist_group = WatchlistGroup.objects.create(user=self.user, name='Theo doi sat')
        WatchlistItem.objects.create(group=watchlist_group, symbol='HPG')
        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:15:00', '%H:%M:%S').time(),
            price=Decimal('100000'),
            volume=7000,
            side='BUY',
            stream_id='fpt-1',
        )
        IntradayTick.objects.create(
            symbol='HPG',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:16:00', '%H:%M:%S').time(),
            price=Decimal('100000'),
            volume=8000,
            side='SELL',
            stream_id='hpg-1',
        )
        self.authenticate()

        response = self.client.get(f'/api/realtime/whale-feed/aggregate/?watchlist_group_ids={watchlist_group.id}')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['filters']['scope'], 'watchlist')
        self.assertEqual(response.data['filters']['symbols'], ['HPG'])
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['symbol'], 'HPG')

    def test_whale_feed_aggregate_cursor_is_stable_for_matched_value_sort(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'free', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        TrackedSymbol.objects.create(user=self.user, symbol='FPT')

        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:15:00', '%H:%M:%S').time(),
            price=Decimal('100000'),
            volume=9000,
            side='BUY',
            stream_id='fpt-1',
        )
        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:16:00', '%H:%M:%S').time(),
            price=Decimal('100000'),
            volume=8000,
            side='SELL',
            stream_id='fpt-2',
        )
        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:17:00', '%H:%M:%S').time(),
            price=Decimal('100000'),
            volume=7000,
            side='BUY',
            stream_id='fpt-3',
        )
        self.authenticate()

        page_one = self.client.get('/api/realtime/whale-feed/aggregate/?sort=matched_value&limit=2')

        self.assertEqual(page_one.status_code, status.HTTP_200_OK)
        self.assertEqual(len(page_one.data['results']), 2)
        self.assertTrue(page_one.data['has_more'])
        page_one_ids = [item['id'] for item in page_one.data['results']]

        page_two = self.client.get(
            f"/api/realtime/whale-feed/aggregate/?sort=matched_value&limit=2&cursor={page_one.data['next_cursor']}"
        )

        self.assertEqual(page_two.status_code, status.HTTP_200_OK)
        self.assertEqual(len(page_two.data['results']), 1)
        self.assertFalse(page_two.data['has_more'])
        self.assertNotIn(page_two.data['results'][0]['id'], page_one_ids)

    def test_whale_feed_aggregate_rejects_invalid_limit_sort_and_cursor_sort_mismatch(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'free', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        TrackedSymbol.objects.create(user=self.user, symbol='FPT')
        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:15:00', '%H:%M:%S').time(),
            price=Decimal('100000'),
            volume=9000,
            side='BUY',
            stream_id='fpt-invalid-1',
        )
        self.authenticate()

        invalid_limit_resp = self.client.get('/api/realtime/whale-feed/aggregate/?limit=0')
        self.assertEqual(invalid_limit_resp.status_code, status.HTTP_400_BAD_REQUEST)

        invalid_sort_resp = self.client.get('/api/realtime/whale-feed/aggregate/?sort=bad_sort')
        self.assertEqual(invalid_sort_resp.status_code, status.HTTP_400_BAD_REQUEST)

        page_one = self.client.get('/api/realtime/whale-feed/aggregate/?sort=matched_value&limit=1')
        self.assertEqual(page_one.status_code, status.HTTP_200_OK)

        forced_cursor = page_one.data['next_cursor']
        if forced_cursor is None and len(page_one.data.get('results', [])) == 1:
            row = page_one.data['results'][0]
            import base64
            import json
            forced_cursor = base64.urlsafe_b64encode(
                json.dumps(
                    {
                        'sort': 'matched_value',
                        'matched_value': float(row['matched_value']),
                        'id': int(row['id']),
                    },
                    separators=(',', ':'),
                ).encode('utf-8')
            ).decode('ascii')

        self.assertIsNotNone(forced_cursor)

        cursor_mismatch_resp = self.client.get(
            f"/api/realtime/whale-feed/aggregate/?sort=ts&limit=1&cursor={forced_cursor}"
        )
        self.assertEqual(cursor_mismatch_resp.status_code, status.HTTP_400_BAD_REQUEST)

        malformed_cursor_resp = self.client.get('/api/realtime/whale-feed/aggregate/?cursor=@@not_base64@@')
        self.assertEqual(malformed_cursor_resp.status_code, status.HTTP_400_BAD_REQUEST)

        import base64
        import json
        bad_shape_cursor = base64.urlsafe_b64encode(
            json.dumps({'sort': 'matched_value', 'id': 1}, separators=(',', ':')).encode('utf-8')
        ).decode('ascii')
        bad_shape_resp = self.client.get(
            f'/api/realtime/whale-feed/aggregate/?sort=matched_value&cursor={bad_shape_cursor}'
        )
        self.assertEqual(bad_shape_resp.status_code, status.HTTP_400_BAD_REQUEST)

        wrong_field_cursor = base64.urlsafe_b64encode(
            json.dumps(
                {'sort': 'ts', 'trade_date': str(date.today()), 'trade_time': '09:15:00', 'id': 1, 'matched_value': 100},
                separators=(',', ':'),
            ).encode('utf-8')
        ).decode('ascii')
        wrong_field_resp = self.client.get(
            f'/api/realtime/whale-feed/aggregate/?sort=ts&cursor={wrong_field_cursor}'
        )
        self.assertEqual(wrong_field_resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_whale_feed_aggregate_supports_scope_param_and_meta_payload(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'free', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        WatchlistGroup.objects.create(user=self.user, name='WL empty')
        self.authenticate()

        response = self.client.get('/api/realtime/whale-feed/aggregate/?scope=watchlist&watchlist_group_ids=999999&limit=10&sort=ts')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['filters']['scope'], 'watchlist')
        self.assertIn('scope_source', response.data['filters'])
        self.assertIn('meta', response.data)
        self.assertEqual(response.data['meta']['contract_version'], '1.1')
        self.assertEqual(response.data['meta']['pagination']['limit'], 10)
        self.assertEqual(response.data['meta']['pagination']['sort'], 'ts')
        self.assertEqual(response.data['meta']['scope']['value'], 'watchlist')

    def test_whale_feed_aggregate_symbols_are_deduplicated(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'free', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:15:00', '%H:%M:%S').time(),
            price=Decimal('100000'),
            volume=9000,
            side='BUY',
            stream_id='fpt-dedup-1',
        )
        self.authenticate()

        response = self.client.get('/api/realtime/whale-feed/aggregate/?symbols=fpt,FPT,fpt')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['filters']['scope'], 'custom')
        self.assertEqual(response.data['filters']['symbols'], ['FPT'])

    def test_whale_feed_aggregate_empty_symbols_returns_empty_payload(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'free', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        self.authenticate()

        response = self.client.get('/api/realtime/whale-feed/aggregate/?scope=symbols&symbols=,, ,')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['results'], [])
        self.assertFalse(response.data['has_more'])
        self.assertIsNone(response.data['next_cursor'])
        self.assertEqual(response.data['filters']['scope'], 'custom')
        self.assertEqual(response.data['filters']['symbols'], [])

    def test_whale_feed_aggregate_cursor_is_stable_for_ts_sort(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'free', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        TrackedSymbol.objects.create(user=self.user, symbol='FPT')

        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:15:02', '%H:%M:%S').time(),
            price=Decimal('100000'),
            volume=9000,
            side='BUY',
            stream_id='fpt-ts-1',
        )
        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:15:01', '%H:%M:%S').time(),
            price=Decimal('100000'),
            volume=8000,
            side='SELL',
            stream_id='fpt-ts-2',
        )
        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:15:00', '%H:%M:%S').time(),
            price=Decimal('100000'),
            volume=7000,
            side='BUY',
            stream_id='fpt-ts-3',
        )
        self.authenticate()

        page_one = self.client.get('/api/realtime/whale-feed/aggregate/?sort=ts&limit=2')
        self.assertEqual(page_one.status_code, status.HTTP_200_OK)
        self.assertEqual(len(page_one.data['results']), 2)
        self.assertTrue(page_one.data['has_more'])
        self.assertGreaterEqual(page_one.data['results'][0]['ts'], page_one.data['results'][1]['ts'])
        page_one_ids = [item['id'] for item in page_one.data['results']]

        page_two = self.client.get(
            f"/api/realtime/whale-feed/aggregate/?sort=ts&limit=2&cursor={page_one.data['next_cursor']}"
        )
        self.assertEqual(page_two.status_code, status.HTTP_200_OK)
        self.assertEqual(len(page_two.data['results']), 1)
        self.assertFalse(page_two.data['has_more'])
        self.assertNotIn(page_two.data['results'][0]['id'], page_one_ids)

    def test_realtime_ticker_fallback_endpoint(self):
        self.authenticate()
        DailyPrice.objects.create(symbol='VNM', date=date.today(), close_price=100000)

        response = self.client.get('/api/realtime/ticker/VNM/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'VNM')
        self.assertIn('current_price', response.data)
        self.assertIn('freshness_seconds', response.data)
        self.assertIn('stale', response.data)

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_views.market_data_service.get_realtime_ticker')
    def test_realtime_ticker_endpoint_uses_refactored_market_view_when_flag_enabled(self, mock_get_realtime_ticker):
        self.authenticate()
        mock_get_realtime_ticker.return_value = {
            'symbol': 'VNM',
            'current_price': 100000,
            'freshness_seconds': 0,
            'stale': False,
            'source': 'db',
        }

        response = self.client.get('/api/realtime/ticker/VNM/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'VNM')
        mock_get_realtime_ticker.assert_called_once_with('VNM')

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True, MARKET_VIEWS_CANARY_PERCENT=100)
    @patch('portfolio.market_data_service.fetch_price_board_dataframe')
    @patch('portfolio.market_data_service.get_cache', return_value=None)
    @patch('portfolio.market_data_service.is_vnstock_rate_limited', return_value=False)
    def test_realtime_ticker_refactored_on_demand_selects_matching_symbol_row(
        self,
        _mock_rate_limited,
        _mock_get_cache,
        mock_fetch_price_board,
    ):
        self.authenticate()
        mock_fetch_price_board.return_value = pd.DataFrame([
            {'symbol': 'VNM', 'match_price': 115.70, 'reference_price': 115.85},
            {'symbol': 'FPT', 'match_price': 76.20, 'reference_price': 76.35},
        ])

        response = self.client.get('/api/realtime/ticker/FPT/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'FPT')
        self.assertEqual(float(response.data['current_price']), 76.20)
        self.assertEqual(response.data['source'], 'vnstock_on_demand')

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True, MARKET_VIEWS_CANARY_PERCENT=0)
    @patch('portfolio.market_views.market_data_service.get_realtime_ticker')
    @patch('portfolio.views._cache_get', return_value=None)
    @patch('portfolio.views.get_price_changes')
    def test_realtime_ticker_endpoint_uses_legacy_view_when_canary_percent_zero(
        self,
        mock_get_price_changes,
        _mock_cache_get,
        mock_get_realtime_ticker,
    ):
        self.authenticate()
        mock_get_price_changes.return_value = {
            'VNM': {
                'current_price': 100000,
                'prev_price': 99000,
                'last_date': datetime.now().isoformat(),
            }
        }

        response = self.client.get('/api/realtime/ticker/VNM/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'VNM')
        mock_get_realtime_ticker.assert_not_called()
        mock_get_price_changes.assert_called_once_with(['VNM'])

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True, MARKET_VIEWS_CANARY_PERCENT=0)
    @patch('portfolio.views.fetch_price_board_dataframe')
    @patch('portfolio.views._cache_get', return_value=None)
    @patch('portfolio.views._is_vnstock_rate_limited', return_value=False)
    @patch('portfolio.views.get_price_changes')
    def test_realtime_ticker_legacy_on_demand_selects_matching_symbol_row(
        self,
        mock_get_price_changes,
        _mock_rate_limited,
        _mock_cache_get,
        mock_fetch_price_board,
    ):
        self.authenticate()
        mock_get_price_changes.return_value = {'FPT': {}}
        mock_fetch_price_board.return_value = pd.DataFrame([
            {'symbol': 'VNM', 'match_price': 115.70, 'reference_price': 115.85},
            {'symbol': 'FPT', 'match_price': 76.20, 'reference_price': 76.35},
        ])

        response = self.client.get('/api/realtime/ticker/FPT/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'FPT')
        self.assertEqual(float(response.data['current_price']), 76.20)
        self.assertEqual(response.data['source'], 'vnstock_on_demand')

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_views.market_data_service.get_intraday_matched')
    def test_realtime_intraday_endpoint_uses_refactored_market_view_when_flag_enabled(self, mock_get_intraday_matched):
        self.authenticate()
        mock_get_intraday_matched.return_value = {
            'symbol': 'VNM',
            'trades': [],
            'total': 0,
            'fetched_at': '2026-04-05T10:00:00+07:00',
        }

        response = self.client.get('/api/realtime/intraday/VNM/?page_size=25')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'VNM')
        mock_get_intraday_matched.assert_called_once_with('VNM', page_size=25)

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_views.market_data_service.get_intraday_matched')
    def test_realtime_intraday_endpoint_rejects_invalid_page_size(self, mock_get_intraday_matched):
        self.authenticate()

        response = self.client.get('/api/realtime/intraday/VNM/?page_size=abc')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        mock_get_intraday_matched.assert_not_called()

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_views.market_data_service.get_price_board')
    def test_price_board_endpoint_uses_refactored_market_view_when_flag_enabled(self, mock_get_price_board):
        self.authenticate()
        mock_get_price_board.return_value = {
            'symbol': 'VNM',
            'depth': [],
            'match': {},
            'fetched_at': '2026-04-05T10:00:00+07:00',
        }

        response = self.client.get('/api/realtime/price-board/VNM/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'VNM')
        mock_get_price_board.assert_called_once_with('VNM')

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_data_service.read_stream_intraday_ticks')
    @patch('portfolio.market_data_service.fetch_intraday_dataframe')
    def test_realtime_intraday_refactored_returns_200_fallback_on_provider_exception(self, mock_fetch_intraday, mock_read_stream):
        self.authenticate()
        mock_read_stream.return_value = []
        mock_fetch_intraday.side_effect = RuntimeError('upstream broken')

        response = self.client.get('/api/realtime/intraday/BCM/?page_size=50')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'BCM')
        self.assertEqual(response.data['trades'], [])
        self.assertIn('source', response.data)

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_data_service.fetch_price_board_dataframe')
    def test_price_board_refactored_returns_200_fallback_on_provider_exception(self, mock_fetch_price_board):
        self.authenticate()
        mock_fetch_price_board.side_effect = RuntimeError('upstream broken')

        response = self.client.get('/api/realtime/price-board/BCM/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'BCM')
        self.assertEqual(response.data['depth'], [])
        self.assertEqual(response.data['match'], {})
        self.assertIn('source', response.data)

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_views.market_data_service.get_sector_breadth')
    def test_sector_breadth_endpoint_uses_refactored_market_view_when_flag_enabled(self, mock_get_sector_breadth):
        self.authenticate()
        mock_get_sector_breadth.return_value = {
            'symbol': 'VNM',
            'groups': [],
            'fetched_at': '2026-04-05T10:00:00+07:00',
        }

        response = self.client.get('/api/realtime/breadth/VNM/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'VNM')
        mock_get_sector_breadth.assert_called_once_with('VNM')

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_views.market_data_service.get_rvol')
    def test_rvol_endpoint_uses_refactored_market_view_when_flag_enabled(self, mock_get_rvol):
        self.authenticate()
        mock_get_rvol.return_value = {
            'symbol': 'VNM',
            'buckets': [],
            'fetched_at': '2026-04-05T10:00:00+07:00',
        }

        response = self.client.get('/api/realtime/rvol/VNM/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'VNM')
        mock_get_rvol.assert_called_once_with('VNM')

    @patch('portfolio.views.fetch_price_board_dataframe')
    @patch('portfolio.views._cache_get')
    def test_price_board_legacy_returns_200_fallback_on_provider_exception(self, mock_cache_get, mock_fetch_price_board):
        self.authenticate()
        mock_cache_get.return_value = None
        mock_fetch_price_board.side_effect = RuntimeError('upstream broken')

        response = self.client.get('/api/realtime/price-board/BCM/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'BCM')
        self.assertEqual(response.data['depth'], [])
        self.assertEqual(response.data['match'], {})
        self.assertIn('source', response.data)

    @patch('portfolio.realtime.stream_reader.StreamReader.get_intraday_ticks')
    @patch('portfolio.views.fetch_intraday_dataframe')
    @patch('portfolio.views._cache_get')
    def test_intraday_legacy_returns_200_fallback_on_provider_exception(self, mock_cache_get, mock_fetch_intraday, mock_get_intraday_ticks):
        self.authenticate()
        mock_cache_get.return_value = None
        mock_get_intraday_ticks.return_value = []
        mock_fetch_intraday.side_effect = RuntimeError('upstream broken')

        response = self.client.get('/api/realtime/intraday/BCM/?page_size=50')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'BCM')
        self.assertEqual(response.data['trades'], [])
        self.assertIn('source', response.data)

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_views.market_data_service.get_whale_feed')
    def test_whale_feed_endpoint_uses_refactored_market_view_when_flag_enabled(self, mock_get_whale_feed):
        self.authenticate()
        mock_get_whale_feed.return_value = {
            'symbol': 'VNM',
            'threshold': 500000000,
            'source': 'redis_stream',
            'weights_version': 'weights-v1',
            'whale_orders': [],
            'summary': {
                'buy_value': 0,
                'sell_value': 0,
                'flow_net': 0,
                'shark_value': 0,
                'whale_value': 0,
                'small_value': 0,
                'shark_pct': 0,
                'whale_pct': 0,
                'small_pct': 0,
            },
            'fetched_at': '2026-04-05T10:00:00+07:00',
        }

        response = self.client.get('/api/realtime/whale-feed/VNM/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'VNM')
        mock_get_whale_feed.assert_called_once_with(self.user, 'VNM')

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_data_service.get_cache', return_value=None)
    @patch('portfolio.market_data_service.read_stream_intraday_ticks', return_value=[])
    @patch('portfolio.market_data_service.fetch_intraday_dataframe')
    def test_refactored_whale_feed_response_contains_scoring_contract(self, mock_fetch_intraday_dataframe, _mock_stream_ticks, _mock_get_cache):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'free', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        self.authenticate()
        mock_fetch_intraday_dataframe.return_value = pd.DataFrame([
            {'time': '2026-04-03T09:30:00+07:00', 'price': 100000, 'volume': 12000, 'match_type': 'buy'},
            {'time': '2026-04-03T09:31:00+07:00', 'price': 99500, 'volume': 4000, 'match_type': 'sell'},
        ])

        response = self.client.get('/api/realtime/whale-feed/FPT/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['weights_version'], 'weights-v1')
        self.assertEqual(response.data.get('threshold_source'), 'user_default')
        self.assertEqual(len(response.data['whale_orders']), 1)
        order = response.data['whale_orders'][0]
        self.assertEqual(order.get('threshold_source'), 'user_default')
        self.assertIn('event_score', order)
        self.assertIn('display_score', order)
        self.assertIn('severity', order)
        self.assertIn('score_breakdown', order)
        self.assertEqual(order['weights_version'], response.data['weights_version'])
        self.assertLessEqual(order['display_score'], order['event_score'])

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_data_service.get_cache', return_value=None)
    @patch('portfolio.market_data_service.read_stream_intraday_ticks', return_value=[])
    @patch('portfolio.market_data_service.fetch_intraday_dataframe', side_effect=ExternalSystemException('vnstock unavailable', code='vnstock_error'))
    def test_refactored_whale_feed_falls_back_to_intraday_tick_db_when_vnstock_unavailable(self, _mock_fetch_intraday_dataframe, _mock_stream_ticks, _mock_get_cache):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'premium', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        self.authenticate()

        IntradayTick.objects.create(
            symbol='MWG',
            trade_date=date.today(),
            trade_time=datetime.strptime('10:31:15', '%H:%M:%S').time(),
            price=Decimal('61800'),
            volume=16000,
            side='BUY',
            stream_id='mwg-refactor-db-1',
        )
        IntradayTick.objects.create(
            symbol='MWG',
            trade_date=date.today(),
            trade_time=datetime.strptime('11:22:33', '%H:%M:%S').time(),
            price=Decimal('60500'),
            volume=21000,
            side='SELL',
            stream_id='mwg-refactor-db-2',
        )

        response = self.client.get('/api/realtime/whale-feed/MWG/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'MWG')
        self.assertGreaterEqual(len(response.data['whale_orders']), 2)
        self.assertEqual(response.data['whale_orders'][0]['side'], 'sell')

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_views.market_data_service.get_whale_feed_aggregate')
    def test_whale_feed_aggregate_endpoint_uses_refactored_market_view_when_flag_enabled(self, mock_get_whale_feed_aggregate):
        self.authenticate()
        mock_get_whale_feed_aggregate.return_value = {
            'results': [],
            'next_cursor': None,
            'has_more': False,
            'server_time': '2026-04-05T10:00:00+07:00',
            'source': 'intraday_tick_db',
            'weights_version': 'weights-v1',
            'filters': {
                'scope': 'tracked',
                'scope_source': 'default_tracked',
                'symbols': [],
                'watchlist_group_ids': [],
                'sort': 'ts',
                'limit': 20,
                'threshold': 500000000,
            },
            'meta': {
                'contract_version': '1.1',
                'pagination': {
                    'sort': 'ts',
                    'limit': 20,
                    'has_more': False,
                    'next_cursor': None,
                },
                'scope': {
                    'value': 'tracked',
                    'source': 'default_tracked',
                },
            },
            'entitlements': {'plan': 'free'},
        }

        response = self.client.get('/api/realtime/whale-feed/aggregate/?window=5d')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_get_whale_feed_aggregate.assert_called_once()

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    def test_refactored_whale_feed_aggregate_defaults_to_tracked_symbols_and_returns_entitlements(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'pro', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        TrackedSymbol.objects.create(user=self.user, symbol='FPT')
        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:15:00', '%H:%M:%S').time(),
            price=Decimal('100000'),
            volume=7000,
            side='BUY',
            stream_id='fpt-refactor-agg-1',
        )
        self.authenticate()

        response = self.client.get('/api/realtime/whale-feed/aggregate/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['filters']['scope'], 'tracked')
        self.assertEqual(response.data['filters']['symbols'], ['FPT'])
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['symbol'], 'FPT')
        self.assertTrue(response.data['entitlements']['can_read_whale_advisory'])
        self.assertFalse(response.data['entitlements']['can_read_whale_advisory_detail'])

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_data_service.read_stream_intraday_ticks')
    def test_refactored_whale_feed_aggregate_prefers_redis_stream_over_intraday_tick_db(self, mock_read_stream_intraday_ticks):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'pro', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        TrackedSymbol.objects.create(user=self.user, symbol='FPT')
        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:15:00', '%H:%M:%S').time(),
            price=Decimal('100000'),
            volume=7000,
            side='BUY',
            stream_id='db-refactor-agg-fpt-1',
        )
        mock_read_stream_intraday_ticks.return_value = [
            {
                'price': 101000,
                'volume': 10000,
                'side': 'BUY',
                'ts': (timezone.now() - timedelta(minutes=1)).isoformat(),
            },
        ]
        self.authenticate()

        response = self.client.get('/api/realtime/whale-feed/aggregate/?window=5d')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['source'], 'redis_stream')
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['source'], 'redis_stream')

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    def test_refactored_whale_feed_aggregate_rejects_invalid_cursor(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'free', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        TrackedSymbol.objects.create(user=self.user, symbol='FPT')
        self.authenticate()

        response = self.client.get('/api/realtime/whale-feed/aggregate/?cursor=@@not_base64@@')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    def test_refactored_whale_feed_aggregate_rejects_invalid_window(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'free', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        TrackedSymbol.objects.create(user=self.user, symbol='FPT')
        self.authenticate()

        response = self.client.get('/api/realtime/whale-feed/aggregate/?window=2h')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    def test_refactored_whale_feed_aggregate_rejects_cursor_window_mismatch(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'free', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        TrackedSymbol.objects.create(user=self.user, symbol='FPT')
        self.authenticate()

        cursor_payload = {
            'sort': 'ts',
            'trade_date': date.today().isoformat(),
            'trade_time': '09:30:00',
            'id': 10,
            'window': 'session',
        }
        cursor = base64.urlsafe_b64encode(json.dumps(cursor_payload).encode('utf-8')).decode('ascii').rstrip('=')

        response = self.client.get(f'/api/realtime/whale-feed/aggregate/?window=5d&cursor={cursor}')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch.dict(os.environ, {'WHALE_MARKET_OPEN_HOUR': '0', 'WHALE_MARKET_OPEN_MINUTE': '0'}, clear=False)
    def test_refactored_whale_feed_aggregate_applies_window_filter(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'pro', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        TrackedSymbol.objects.create(user=self.user, symbol='FPT')

        local_now = timezone.localtime(timezone.now())
        local_today = timezone.localdate()
        in_session_time = (local_now - timedelta(minutes=5)).time().replace(microsecond=0)

        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=local_today,
            trade_time=in_session_time,
            price=Decimal('100000'),
            volume=7000,
            side='BUY',
            stream_id='fpt-window-session',
        )
        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=local_today - timedelta(days=2),
            trade_time=in_session_time,
            price=Decimal('101000'),
            volume=7000,
            side='BUY',
            stream_id='fpt-window-5d',
        )
        self.authenticate()

        session_response = self.client.get('/api/realtime/whale-feed/aggregate/?window=session')
        five_day_response = self.client.get('/api/realtime/whale-feed/aggregate/?window=5d')

        self.assertEqual(session_response.status_code, status.HTTP_200_OK)
        self.assertEqual(session_response.data['filters']['window'], 'session')
        self.assertGreaterEqual(len(session_response.data['results']), 0)

        self.assertEqual(five_day_response.status_code, status.HTTP_200_OK)
        self.assertEqual(five_day_response.data['filters']['window'], '5d')
        self.assertGreaterEqual(len(five_day_response.data['results']), len(session_response.data['results']))

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_data_service.market_data_service.get_whale_feed_aggregate')
    def test_unified_alerts_endpoint_returns_combined_whale_and_dark_flow(self, mock_whale_aggregate):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'pro', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        TrackedSymbol.objects.create(user=self.user, symbol='FPT')

        mock_whale_aggregate.return_value = {
            'results': [
                {
                    'event_id': 'whale:FPT:test-unified-1',
                    'symbol': 'FPT',
                    'severity': 'high',
                    'side': 'BUY',
                    'matched_value': 1_250_000_000,
                    'ts': timezone.now().isoformat(),
                }
            ]
        }

        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:22:00', '%H:%M:%S').time(),
            price=Decimal('100000'),
            volume=8000,
            side='BUY',
            stream_id='fpt-unified-whale-1',
        )
        OrderFlowSignal.objects.create(
            symbol='FPT',
            signal_type=OrderFlowSignal.SignalType.ICEBERG,
            strength=82,
            confidence='high',
            tick_rate=14.5,
            small_order_ratio=0.66,
            cvd_at_signal=1500000,
            price_at_signal=100500,
            window_seconds=300,
            components_json={'test': True},
            event_id='dark_flow:FPT:test-unified-1',
            severity=OrderFlowSignal.SeverityChoices.URGENT,
        )
        self.authenticate_direct()

        response = self.client.get('/api/realtime/unified-alerts/?window=session&limit=10')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.data)
        self.assertGreaterEqual(len(response.data['results']), 1)
        sources = {item.get('source') for item in response.data['results']}
        self.assertIn('dark_flow', sources)
        self.assertIn('whale', sources)
        self.assertEqual(response.data['meta']['contract_version'], '2.0')

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_data_service.market_data_service.get_whale_feed_aggregate')
    def test_unified_alerts_endpoint_respects_severity_min_filter(self, mock_whale_aggregate):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'pro', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        TrackedSymbol.objects.create(user=self.user, symbol='HPG')
        mock_whale_aggregate.return_value = {
            'results': [
                {
                    'event_id': 'whale:HPG:test-unified-critical',
                    'symbol': 'HPG',
                    'severity': 'extreme',
                    'side': 'SELL',
                    'matched_value': 1_500_000_000,
                    'ts': timezone.now().isoformat(),
                }
            ]
        }

        OrderFlowSignal.objects.create(
            symbol='HPG',
            signal_type=OrderFlowSignal.SignalType.ICEBERG,
            strength=70,
            confidence='medium',
            tick_rate=12.1,
            small_order_ratio=0.51,
            cvd_at_signal=500000,
            price_at_signal=45000,
            window_seconds=300,
            components_json={'test': True},
            event_id='dark_flow:HPG:test-unified-high',
            severity=OrderFlowSignal.SeverityChoices.WARNING,
        )
        self.authenticate_direct()

        response = self.client.get('/api/realtime/unified-alerts/?window=session&limit=10&severity_min=critical')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for item in response.data['results']:
            self.assertEqual(item.get('severity'), 'critical')

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    def test_unified_alerts_endpoint_rejects_invalid_severity_min(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'pro', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        self.authenticate_direct()

        response = self.client.get('/api/realtime/unified-alerts/?severity_min=extreme_plus')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_data_service.market_data_service.get_whale_feed_aggregate')
    def test_unified_alerts_endpoint_cursor_pagination_has_no_overlap(self, mock_whale_aggregate):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'pro', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        TrackedSymbol.objects.create(user=self.user, symbol='VNM')
        mock_whale_aggregate.return_value = {'results': []}

        OrderFlowSignal.objects.create(
            symbol='VNM',
            signal_type=OrderFlowSignal.SignalType.ICEBERG,
            strength=85,
            confidence='high',
            tick_rate=15.2,
            small_order_ratio=0.62,
            cvd_at_signal=1200000,
            price_at_signal=78000,
            window_seconds=300,
            components_json={'case': 1},
            event_id='dark_flow:VNM:cursor-1',
            severity=OrderFlowSignal.SeverityChoices.URGENT,
        )
        OrderFlowSignal.objects.create(
            symbol='VNM',
            signal_type=OrderFlowSignal.SignalType.ABSORPTION,
            strength=81,
            confidence='high',
            tick_rate=13.7,
            small_order_ratio=0.57,
            cvd_at_signal=900000,
            price_at_signal=77900,
            window_seconds=300,
            components_json={'case': 2},
            event_id='dark_flow:VNM:cursor-2',
            severity=OrderFlowSignal.SeverityChoices.URGENT,
        )
        self.authenticate_direct()

        page_one = self.client.get('/api/realtime/unified-alerts/?window=session&limit=1&severity_min=medium')

        self.assertEqual(page_one.status_code, status.HTTP_200_OK)
        self.assertTrue(page_one.data['has_more'])
        self.assertIsNotNone(page_one.data['next_cursor'])
        self.assertEqual(len(page_one.data['results']), 1)

        page_two = self.client.get(
            f"/api/realtime/unified-alerts/?window=session&limit=1&severity_min=medium&cursor={page_one.data['next_cursor']}"
        )

        self.assertEqual(page_two.status_code, status.HTTP_200_OK)
        self.assertEqual(len(page_two.data['results']), 1)
        self.assertNotEqual(page_one.data['results'][0]['event_id'], page_two.data['results'][0]['event_id'])

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    def test_unified_alerts_endpoint_rejects_invalid_cursor(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'pro', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        self.authenticate_direct()

        response = self.client.get('/api/realtime/unified-alerts/?window=session&severity_min=medium&cursor=not-a-valid-cursor')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    def test_unified_alerts_endpoint_rejects_cursor_window_mismatch(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'pro', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        self.authenticate_direct()

        cursor_payload = {
            'severity_rank': 3,
            'event_id': 'dark_flow:VNM:cursor-window',
            'ts': timezone.now().isoformat(),
            'window': 'session',
            'severity_min': 'medium',
        }
        cursor = base64.urlsafe_b64encode(json.dumps(cursor_payload).encode('utf-8')).decode('ascii').rstrip('=')

        response = self.client.get(f'/api/realtime/unified-alerts/?window=5d&severity_min=medium&cursor={cursor}')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    def test_unified_alerts_endpoint_rejects_cursor_severity_min_mismatch(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'pro', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        self.authenticate_direct()

        cursor_payload = {
            'severity_rank': 3,
            'event_id': 'dark_flow:VNM:cursor-severity',
            'ts': timezone.now().isoformat(),
            'window': 'session',
            'severity_min': 'medium',
        }
        cursor = base64.urlsafe_b64encode(json.dumps(cursor_payload).encode('utf-8')).decode('ascii').rstrip('=')

        response = self.client.get(f'/api/realtime/unified-alerts/?window=session&severity_min=critical&cursor={cursor}')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_views.market_data_service.get_depth_chart')
    def test_depth_chart_endpoint_uses_refactored_market_view_when_flag_enabled(self, mock_get_depth_chart):
        self.authenticate()
        mock_get_depth_chart.return_value = {
            'symbol': 'VNM',
            'reference_price': 100000,
            'ceiling_price': 107000,
            'floor_price': 93000,
            'bids': [],
            'asks': [],
            'walls': [],
            'fetched_at': '2026-04-05T10:00:00+07:00',
        }

        response = self.client.get('/api/realtime/depth-chart/VNM/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'VNM')
        mock_get_depth_chart.assert_called_once_with('VNM')

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_views.market_data_service.get_financial_metrics')
    def test_financial_metrics_endpoint_uses_refactored_market_view_when_flag_enabled(self, mock_get_financial_metrics):
        self.authenticate()
        mock_get_financial_metrics.return_value = {
            'symbol': 'VNM',
            'years': [],
            'fetched_at': '2026-04-05T10:00:00+07:00',
        }

        response = self.client.get('/api/stock-management/stocks/VNM/financials/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'VNM')
        mock_get_financial_metrics.assert_called_once_with('VNM')

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_views.market_data_service.get_stock_workspace_overview')
    def test_stock_workspace_overview_endpoint_uses_refactored_market_view_when_flag_enabled(self, mock_get_stock_workspace_overview):
        self.authenticate()
        mock_get_stock_workspace_overview.return_value = {
            'symbol': 'VNM',
            'fetched_at': '2026-04-05T10:00:00+07:00',
        }

        response = self.client.get('/api/stock-management/stocks/VNM/overview/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'VNM')
        mock_get_stock_workspace_overview.assert_called_once_with(self.user, 'VNM')

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_views.market_data_service.get_stock_workspace_overview')
    def test_stock_workspace_overview_refactored_returns_502_on_unexpected_exception(self, mock_get_stock_workspace_overview):
        self.authenticate()
        mock_get_stock_workspace_overview.side_effect = RuntimeError('boom')

        response = self.client.get('/api/stock-management/stocks/VNM/overview/')

        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
        self.assertIn('detail', response.data)

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_views.market_data_service.get_financial_metrics')
    def test_financial_metrics_refactored_returns_502_on_unexpected_exception(self, mock_get_financial_metrics):
        self.authenticate()
        mock_get_financial_metrics.return_value = {
            'symbol': 'VNM',
            'years': [],
            'source': 'error',
            'fetched_at': '2026-04-05T10:00:00+07:00',
        }

        response = self.client.get('/api/stock-management/stocks/VNM/financials/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'VNM')
        self.assertEqual(response.data['years'], [])

    @patch('portfolio.views.fetch_financial_ratio_dataframe')
    def test_financial_metrics_returns_502_on_unexpected_provider_exception(self, mock_fetch_financials):
        self.authenticate()
        mock_fetch_financials.side_effect = RuntimeError('provider broken')

        response = self.client.get('/api/stock-management/stocks/VNM/financials/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'VNM')
        self.assertEqual(response.data['years'], [])
        self.assertIn('source', response.data)

    @patch('portfolio.views._build_stock_workspace_overview')
    def test_stock_workspace_overview_fallback_when_base_builder_crashes(self, mock_build_overview):
        self.authenticate()
        StockProfile.objects.create(symbol='VNM', company_name='Vinamilk')
        mock_build_overview.side_effect = RuntimeError('unexpected error')

        response = self.client.get('/api/stock-management/stocks/VNM/overview/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'VNM')
        self.assertIn('current_price', response.data)
        self.assertIn('market_groups', response.data)

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_views.market_data_service.get_stock_workspace_chart')
    def test_stock_workspace_chart_endpoint_uses_refactored_market_view_when_flag_enabled(self, mock_get_stock_workspace_chart):
        self.authenticate()
        mock_get_stock_workspace_chart.return_value = {
            'symbol': 'VNM',
            'days': 180,
            'points': [],
            'technical': {},
        }

        response = self.client.get('/api/stock-management/stocks/VNM/chart/?days=120')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'VNM')
        mock_get_stock_workspace_chart.assert_called_once_with(self.user, 'VNM', 120)

    @override_settings(ENABLE_NEW_MARKET_VIEWS=True)
    @patch('portfolio.market_views.market_data_service.get_stock_workspace_chart')
    def test_stock_workspace_chart_endpoint_rejects_invalid_days(self, mock_get_stock_workspace_chart):
        self.authenticate()

        response = self.client.get('/api/stock-management/stocks/VNM/chart/?days=9999')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        mock_get_stock_workspace_chart.assert_not_called()

    def test_price_alert_rule_crud_and_trigger_endpoint(self):
        self.authenticate()
        DailyPrice.objects.create(symbol='FPT', date=date.today(), close_price=120000)

        create_response = self.client.post(
            '/api/stock-management/price-alerts/',
            {
                'symbol': 'FPT',
                'condition': 'ABOVE',
                'target_price': '118000',
                'cooldown_seconds': 300,
                'is_active': True,
            },
            format='json',
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create_response.data['symbol'], 'FPT')
        self.assertTrue(create_response.data['is_triggered'])

        list_response = self.client.get('/api/stock-management/price-alerts/')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 1)

        rule_id = create_response.data['id']
        trigger_response = self.client.post(f'/api/stock-management/price-alerts/{rule_id}/mark-triggered/', {}, format='json')
        self.assertEqual(trigger_response.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(trigger_response.data['last_triggered_at'])

        delete_response = self.client.delete(f'/api/stock-management/price-alerts/{rule_id}/')
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)

    def test_tracked_symbol_supports_per_symbol_threshold_create_and_patch(self):
        self.authenticate()

        create_response = self.client.post(
            '/api/stock-management/tracked-symbols/',
            {
                'symbol': 'FPT',
                'whale_alert_threshold_million': 850,
            },
            format='json',
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create_response.data['symbol'], 'FPT')
        self.assertEqual(create_response.data['whale_alert_threshold_million'], 850.0)

        tracked_id = create_response.data['id']
        patch_response = self.client.patch(
            f'/api/stock-management/tracked-symbols/{tracked_id}/',
            {
                'whale_alert_threshold_million': 920,
            },
            format='json',
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_response.data['whale_alert_threshold_million'], 920.0)

        clear_response = self.client.patch(
            f'/api/stock-management/tracked-symbols/{tracked_id}/',
            {
                'whale_alert_threshold_million': None,
            },
            format='json',
        )
        self.assertEqual(clear_response.status_code, status.HTTP_200_OK)
        self.assertIsNone(clear_response.data['whale_alert_threshold_million'])

    def test_whale_feed_aggregate_applies_per_symbol_threshold_override(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'free', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        TrackedSymbol.objects.create(user=self.user, symbol='FPT', whale_alert_threshold_million=900)
        TrackedSymbol.objects.create(user=self.user, symbol='HPG')
        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:15:00', '%H:%M:%S').time(),
            price=Decimal('100000'),
            volume=7000,
            side='BUY',
            stream_id='fpt-threshold-1',
        )
        IntradayTick.objects.create(
            symbol='HPG',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:16:00', '%H:%M:%S').time(),
            price=Decimal('100000'),
            volume=7000,
            side='BUY',
            stream_id='hpg-threshold-1',
        )
        self.authenticate()

        response = self.client.get('/api/realtime/whale-feed/aggregate/?scope=tracked&sort=matched_value&limit=20')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        result_symbols = [row['symbol'] for row in response.data['results']]
        by_symbol = {row['symbol']: row for row in response.data['results']}
        self.assertIn('HPG', result_symbols)
        self.assertNotIn('FPT', result_symbols)
        self.assertEqual(by_symbol['HPG'].get('threshold_source'), 'user_default')

    def test_whale_feed_aggregate_sets_threshold_source_per_symbol(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'free', 'email_verified': True, 'whale_alert_threshold': 500},
        )
        TrackedSymbol.objects.create(user=self.user, symbol='FPT', whale_alert_threshold_million=900)
        TrackedSymbol.objects.create(user=self.user, symbol='HPG')
        IntradayTick.objects.create(
            symbol='FPT',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:15:00', '%H:%M:%S').time(),
            price=Decimal('100000'),
            volume=10000,
            side='BUY',
            stream_id='fpt-threshold-source-1',
        )
        IntradayTick.objects.create(
            symbol='HPG',
            trade_date=date.today(),
            trade_time=datetime.strptime('09:16:00', '%H:%M:%S').time(),
            price=Decimal('100000'),
            volume=7000,
            side='BUY',
            stream_id='hpg-threshold-source-1',
        )
        self.authenticate()

        response = self.client.get('/api/realtime/whale-feed/aggregate/?scope=tracked&sort=matched_value&limit=20')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        by_symbol = {row['symbol']: row for row in response.data['results']}
        self.assertEqual(by_symbol['FPT'].get('threshold_source'), 'symbol_override')
        self.assertEqual(by_symbol['HPG'].get('threshold_source'), 'user_default')

    def test_tracked_symbol_bulk_threshold_endpoint_updates_multiple_rows(self):
        self.authenticate()
        ts1 = TrackedSymbol.objects.create(user=self.user, symbol='FPT')
        ts2 = TrackedSymbol.objects.create(user=self.user, symbol='HPG', whale_alert_threshold_million=600)

        response = self.client.post(
            '/api/stock-management/tracked-symbols/bulk-threshold/',
            {
                'tracked_symbol_ids': [ts1.id, ts2.id],
                'whale_alert_threshold_million': 750,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['updated_count'], 2)
        self.assertEqual(response.data['whale_alert_threshold_million'], 750.0)
        self.assertEqual(len(response.data['rows']), 2)
        returned_ids = sorted([row['id'] for row in response.data['rows']])
        self.assertEqual(returned_ids, sorted([ts1.id, ts2.id]))
        ts1.refresh_from_db()
        ts2.refresh_from_db()
        self.assertEqual(float(ts1.whale_alert_threshold_million), 750.0)
        self.assertEqual(float(ts2.whale_alert_threshold_million), 750.0)

    def test_tracked_symbol_bulk_threshold_endpoint_validates_ids(self):
        self.authenticate()

        response = self.client.post(
            '/api/stock-management/tracked-symbols/bulk-threshold/',
            {
                'tracked_symbol_ids': [],
                'whale_alert_threshold_million': 500,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('vnstock.Vnstock')
    def test_stock_workspace_overview_and_chart_endpoints(self, mock_vnstock):
        self.authenticate()
        stock_client = MagicMock()
        stock_client.trading.price_board.return_value = None
        stock_client.quote.history.return_value = None
        stock_client.listing.all_symbols.return_value = None
        mock_vnstock.return_value.stock.return_value = stock_client

        latest_date = date.today()
        for offset in range(60, -1, -1):
            current_date = latest_date - timedelta(days=offset)
            close_price = 100000 + ((60 - offset) * 500)
            DailyPrice.objects.create(
                symbol='VNM',
                date=current_date,
                open_price=close_price - 800,
                high_price=close_price + 1200,
                low_price=close_price - 1500,
                close_price=close_price,
                volume=1000000 + ((60 - offset) * 10000),
            )
        StockProfile.objects.create(
            symbol='VNM',
            company_name='CTCP Sua Viet Nam',
            industry='Thuc pham',
            exchange='HOSE',
            is_active=True,
        )
        group = SecuritiesGroup.objects.create(
            name='Bluechips',
            group_type='CUSTOM',
            description='Nhom lon',
            color='#22c55e',
            order=1,
        )
        SecuritiesItem.objects.create(group=group, symbol='VNM')
        TrackedSymbol.objects.create(user=self.user, symbol='VNM', source_group=group)
        watchlist_group = WatchlistGroup.objects.create(user=self.user, name='Theo doi sat')
        WatchlistItem.objects.create(group=watchlist_group, symbol='VNM')

        overview_response = self.client.get('/api/stock-management/stocks/VNM/overview/')

        self.assertEqual(overview_response.status_code, status.HTTP_200_OK)
        self.assertEqual(overview_response.data['symbol'], 'VNM')
        self.assertEqual(overview_response.data['current_price'], 130000.0)
        self.assertTrue(overview_response.data['is_tracked'])
        self.assertIsNotNone(overview_response.data['tracked_symbol_id'])
        self.assertIn('Bluechips', overview_response.data['market_groups'])
        self.assertIn('Theo doi sat', overview_response.data['watchlist_groups'])
        self.assertEqual(len(overview_response.data['watchlist_memberships']), 1)

        chart_response = self.client.get('/api/stock-management/stocks/VNM/chart/?days=90')

        self.assertEqual(chart_response.status_code, status.HTTP_200_OK)
        self.assertEqual(chart_response.data['symbol'], 'VNM')
        self.assertEqual(chart_response.data['days'], 90)
        self.assertEqual(len(chart_response.data['points']), 61)
        self.assertIn('open', chart_response.data['points'][0])
        self.assertIn('high', chart_response.data['points'][0])
        self.assertIn('low', chart_response.data['points'][0])
        self.assertIn('volume', chart_response.data['points'][0])
        self.assertEqual(chart_response.data['points'][0]['open'], 99200.0)
        self.assertEqual(chart_response.data['points'][0]['high'], 101200.0)
        self.assertEqual(chart_response.data['points'][0]['low'], 98500.0)
        self.assertEqual(chart_response.data['points'][0]['volume'], 1000000.0)
        self.assertIn('technical', chart_response.data)
        self.assertEqual(chart_response.data['technical']['bias'], 'BULLISH')
        self.assertEqual(chart_response.data['technical']['bias_label'], 'Tăng')
        self.assertIn('động lượng', chart_response.data['technical']['bias_description'])
        self.assertIsNotNone(chart_response.data['technical']['sma20'])
        self.assertIsNotNone(chart_response.data['technical']['sma50'])
        self.assertIsNotNone(chart_response.data['technical']['rsi14'])

    def test_market_group_write_endpoints_are_read_only(self):
        self.authenticate()
        group = SecuritiesGroup.objects.create(name='Shared VN30', group_type='MARKET_CAP')
        item = SecuritiesItem.objects.create(group=group, symbol='FPT')

        create_response = self.client.post('/api/stock-management/groups/', {'name': 'New shared group'}, format='json')
        patch_response = self.client.patch(f'/api/stock-management/groups/{group.id}/', {'name': 'Renamed'}, format='json')
        delete_response = self.client.delete(f'/api/stock-management/groups/{group.id}/')
        add_item_response = self.client.post(f'/api/stock-management/groups/{group.id}/items/', {'symbol': 'VCB'}, format='json')
        delete_item_response = self.client.delete(f'/api/stock-management/items/{item.id}/')

        self.assertEqual(create_response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(patch_response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(delete_response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(add_item_response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(delete_item_response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
