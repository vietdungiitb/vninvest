from datetime import date, datetime, timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.test.utils import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from portfolio.models import (
    AdvisoryAggregateAuditLog,
    AdvisoryAggregateSnapshot,
    DailyPrice,
    IntradayTick,
    UserConfig,
    WhaleAdvisory,
)


class ApiRouteStockAiAdvisorySessionTests(APITestCase):
    def setUp(self):
        from . import test_api_routes as legacy_routes

        legacy_routes.ApiRouteSmokeTests.setUp(self)

    def authenticate(self):
        from . import test_api_routes as legacy_routes

        return legacy_routes.ApiRouteSmokeTests.authenticate(self)

    def _attach_dpi_license(self, plan_name, feature_flags=None, status='active', grace_days=7):
        from . import test_api_routes as legacy_routes

        return legacy_routes.ApiRouteSmokeTests._attach_dpi_license(self, plan_name, feature_flags, status, grace_days)

    @patch('portfolio.views._cache_get', return_value=None)
    @patch('portfolio.tasks.generate_whale_advisory_task.run')
    @patch('portfolio.tasks.generate_whale_advisory_task.apply_async')
    def test_stock_ai_advisory_session_get_creates_sync_when_missing(self, mock_apply_async, mock_task_run, _mock_cache_get):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'email_verified': True, 'ai_provider': 'openai', 'ai_model': 'gpt-4o'},
        )
        self.authenticate()

        def _mock_run_side_effect(**kwargs):
            advisory = WhaleAdvisory.objects.create(
                user=self.user,
                symbol=kwargs['symbol'],
                matched_value=int(kwargs['matched_value_vnd']),
                side=kwargs['side'],
                threshold=float(kwargs['threshold']),
                ai_summary='sync summary',
                ai_detail='sync detail',
                ai_provider='openai',
                ai_model='gpt-4o',
            )
            return {
                'status': 'ok',
                'advisory_id': advisory.id,
                'symbol': kwargs['symbol'],
                'ai_source': 'user',
            }

        mock_task_run.side_effect = _mock_run_side_effect

        response = self.client.get('/api/stock-management/stocks/BCM/ai-advisory-session/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['queued'])
        self.assertEqual(response.data['symbol'], 'BCM')
        mock_apply_async.assert_not_called()
        mock_task_run.assert_called_once()

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
    def test_stock_ai_advisory_session_get_returns_409_when_ai_model_missing(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'email_verified': True, 'ai_provider': 'openai', 'ai_model': '', 'ai_api_key': ''},
        )
        self.authenticate()

        response = self.client.get('/api/stock-management/stocks/BCM/ai-advisory-session/')

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertFalse(response.data['ok'])
        self.assertEqual(response.data['reason'], 'ai_not_configured')
        self.assertTrue(response.data.get('config_issue'))

    @patch('portfolio.views._cache_get', return_value=None)
    @patch('portfolio.tasks.generate_whale_advisory_task.run', side_effect=RuntimeError('sync failed'))
    @patch('portfolio.tasks.generate_whale_advisory_task.apply_async', side_effect=RuntimeError('broker down'))
    def test_stock_ai_advisory_session_get_returns_503_when_queue_unavailable(self, _mock_apply_async, _mock_task_run, _mock_cache_get):
        self.authenticate()

        response = self.client.get('/api/stock-management/stocks/BCM/ai-advisory-session/')

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertFalse(response.data['ok'])
        self.assertFalse(response.data['queued'])
        self.assertEqual(response.data['symbol'], 'BCM')
        self.assertIn('queue', response.data['message'].lower())

    def test_stock_ai_advisory_session_get_returns_latest_advisory(self):
        self.authenticate()
        advisory = WhaleAdvisory.objects.create(
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

        response = self.client.get('/api/stock-management/stocks/BCM/ai-advisory-session/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['queued'])
        self.assertEqual(response.data['advisory']['id'], advisory.id)
        self.assertEqual(response.data['advisory']['symbol'], 'BCM')
        self.assertIn('components', response.data)
        self.assertIn('deleted_components', response.data)
        self.assertIn('executive_summary', response.data)
        self.assertIn('executive_summaries', response.data)

    @override_settings(STOCK_AI_ADVISORY_SESSION_V2_ENABLED=True)
    def test_stock_ai_advisory_session_get_returns_v2_contract_when_enabled(self):
        self.authenticate()
        snapshot = AdvisoryAggregateSnapshot.objects.create(
            user=self.user,
            symbol='BCM',
            snapshot_seq=7,
            state_json={'seq': 7, 'quality': {'actionability': 0.82}},
        )
        advisory = WhaleAdvisory.objects.create(
            user=self.user,
            symbol='BCM',
            matched_value=7_000_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Stock workspace summary',
            ai_detail='Stock workspace detail',
            ai_provider='copilot',
            ai_model='openai/gpt-4o',
            aggregate_snapshot=snapshot,
            severity=WhaleAdvisory.SeverityChoices.WARNING,
        )
        AdvisoryAggregateAuditLog.objects.create(
            user=self.user,
            symbol='BCM',
            before_state_json={'advisory_id': advisory.id - 1, 'snapshot_id': snapshot.id - 1},
            after_state_json={'advisory_id': advisory.id, 'snapshot_id': snapshot.id},
            reason=AdvisoryAggregateAuditLog.ReasonChoices.NEW_WHALE_EVENT,
            actor=AdvisoryAggregateAuditLog.ActorChoices.SYSTEM,
            actor_id='route-smoke-system',
            metadata_json={'advisory_id': advisory.id, 'snapshot_id': snapshot.id},
        )

        response = self.client.get('/api/stock-management/stocks/BCM/ai-advisory-session/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['contract_version'], 'v2')
        self.assertIn('aggregate', response.data)
        self.assertEqual(response.data['aggregate']['advisory_id'], advisory.id)
        self.assertEqual(response.data['aggregate']['snapshot_id'], snapshot.id)
        self.assertEqual(response.data['aggregate']['snapshot_seq'], 7)
        self.assertEqual(response.data['aggregate']['last_audit_reason'], AdvisoryAggregateAuditLog.ReasonChoices.NEW_WHALE_EVENT)
        self.assertEqual(response.data['aggregate']['last_audit_actor'], AdvisoryAggregateAuditLog.ActorChoices.SYSTEM)
        self.assertIn('decision', response.data['aggregate'])
        self.assertEqual(response.data['aggregate']['decision']['action'], 'accumulate')
        self.assertEqual(response.data['aggregate']['decision']['risk'], 'medium')
        self.assertEqual(response.data['aggregate']['decision']['score_band'], 'high')
        self.assertEqual(response.data['aggregate']['decision']['score'], 0.82)
        self.assertIn('observability', response.data['aggregate'])
        self.assertIn('severity_drift_24h', response.data['aggregate']['observability'])
        self.assertIn('aggregate_quality', response.data['aggregate']['observability'])

    def test_stock_ai_advisory_session_get_accepts_contract_v2_query_override(self):
        self.authenticate()
        snapshot = AdvisoryAggregateSnapshot.objects.create(
            user=self.user,
            symbol='BCM',
            snapshot_seq=8,
            state_json={'seq': 8},
        )
        advisory = WhaleAdvisory.objects.create(
            user=self.user,
            symbol='BCM',
            matched_value=7_000_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Stock workspace summary',
            ai_detail='Stock workspace detail',
            ai_provider='copilot',
            ai_model='openai/gpt-4o',
            aggregate_snapshot=snapshot,
        )
        AdvisoryAggregateAuditLog.objects.create(
            user=self.user,
            symbol='BCM',
            before_state_json={'advisory_id': advisory.id - 1, 'snapshot_id': snapshot.id - 1},
            after_state_json={'advisory_id': advisory.id, 'snapshot_id': snapshot.id},
            reason=AdvisoryAggregateAuditLog.ReasonChoices.NEW_WHALE_EVENT,
            actor=AdvisoryAggregateAuditLog.ActorChoices.SYSTEM,
            actor_id='route-smoke-system',
            metadata_json={'advisory_id': advisory.id, 'snapshot_id': snapshot.id},
        )

        response = self.client.get('/api/stock-management/stocks/BCM/ai-advisory-session/?contract=v2')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['contract_version'], 'v2')
        self.assertEqual(response.data['aggregate']['snapshot_seq'], 8)

    def test_stock_ai_advisory_session_get_returns_400_for_invalid_contract_query(self):
        self.authenticate()

        response = self.client.get('/api/stock-management/stocks/BCM/ai-advisory-session/?contract=beta')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['ok'])
        self.assertIn('contract', response.data['message'])

    @override_settings(HOLISTIC_ADVISORY_V1_ENABLED=False, STOCK_AI_ADVISORY_SESSION_V2_ENABLED=True)
    def test_stock_ai_advisory_session_v2_contract_returns_403_when_holistic_gate_disabled(self):
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

        response = self.client.get('/api/stock-management/stocks/BCM/ai-advisory-session/?contract=v2')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(response.data['ok'])
        self.assertEqual(response.data['reason'], 'holistic_disabled')

    @override_settings(
        HOLISTIC_ADVISORY_V1_ENABLED=True,
        HOLISTIC_ADVISORY_V1_COHORT_MODE='allowlist',
        HOLISTIC_ADVISORY_V1_COHORT_USERNAMES=['another-user'],
        STOCK_AI_ADVISORY_SESSION_V2_ENABLED=True,
    )
    def test_stock_ai_advisory_session_v2_contract_returns_403_when_user_not_in_holistic_allowlist(self):
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

        response = self.client.get('/api/stock-management/stocks/BCM/ai-advisory-session/?contract=v2')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(response.data['ok'])
        self.assertEqual(response.data['reason'], 'holistic_disabled')

    @override_settings(STOCK_AI_ADVISORY_SESSION_V2_ENABLED=True, STOCK_AI_ADVISORY_BENCHMARKS_ENABLED=True)
    def test_stock_ai_advisory_session_v2_includes_benchmark_enrichment(self):
        self.authenticate()

        snapshot = AdvisoryAggregateSnapshot.objects.create(
            user=self.user,
            symbol='BCM',
            snapshot_seq=10,
            state_json={'seq': 10, 'quality': {'actionability': 0.66}},
        )
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='BCM',
            matched_value=6_800_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='benchmark summary',
            ai_detail='benchmark detail',
            ai_provider='copilot',
            ai_model='openai/gpt-4o',
            aggregate_snapshot=snapshot,
            severity=WhaleAdvisory.SeverityChoices.WARNING,
        )

        base_date = date(2026, 3, 1)
        for idx in range(25):
            DailyPrice.objects.create(
                symbol='BCM',
                date=base_date + timedelta(days=idx),
                open_price=100 + idx,
                high_price=101 + idx,
                low_price=99 + idx,
                close_price=100 + idx,
                volume=1_000_000 + (idx * 10_000),
            )
            DailyPrice.objects.create(
                symbol='VNINDEX',
                date=base_date + timedelta(days=idx),
                open_price=1200 + idx,
                high_price=1205 + idx,
                low_price=1195 + idx,
                close_price=1200 + idx,
                volume=50_000_000,
            )

        trade_day = date(2026, 3, 30)
        IntradayTick.objects.create(
            symbol='BCM',
            trade_date=trade_day,
            trade_time=datetime.strptime('09:15:00', '%H:%M:%S').time(),
            price=120,
            volume=1000,
            side=IntradayTick.Side.BUY,
        )
        IntradayTick.objects.create(
            symbol='BCM',
            trade_date=trade_day,
            trade_time=datetime.strptime('09:30:00', '%H:%M:%S').time(),
            price=123,
            volume=2000,
            side=IntradayTick.Side.BUY,
        )

        response = self.client.get('/api/stock-management/stocks/BCM/ai-advisory-session/?contract=v2')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['contract_version'], 'v2')
        self.assertIn('benchmarks', response.data['aggregate'])
        benchmarks = response.data['aggregate']['benchmarks']
        self.assertIsNotNone(benchmarks['rvol'])
        self.assertIn(benchmarks['rvol_regime'], {'spike', 'elevated', 'normal', 'dry', 'unknown'})
        self.assertIsNotNone(benchmarks['relative_strength_20d_pct'])
        self.assertIn('vwap_deviation_pct', benchmarks)
        self.assertIn('mtf_confirmation_score', benchmarks)

    def test_stock_ai_advisory_session_returns_403_when_feature_locked_for_free_dpi_license(self):
        self._attach_dpi_license('free', {'whale_momentum': False})
        self.authenticate()

        response = self.client.get('/api/stock-management/stocks/BCM/ai-advisory-session/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(response.data['ok'])
        self.assertEqual(response.data['code'], 'feature_locked')
        self.assertEqual(response.data['feature_key'], 'whale_momentum')

    @override_settings(
        OPEN_CORE_QUOTA_ENFORCEMENT_ENABLED=True,
        OPEN_CORE_QUOTA_CAPS_BY_TIER={
            'community': {
                'api_calls_per_day': 1,
                'ai_regenerate_per_day': 1,
                'whale_symbols_max': 10,
                'exports_per_day': 0,
            },
        },
    )
    def test_stock_ai_advisory_session_get_is_not_blocked_by_api_quota(self):
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

        first = self.client.get('/api/stock-management/stocks/BCM/ai-advisory-session/')
        second = self.client.get('/api/stock-management/stocks/BCM/ai-advisory-session/')

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)