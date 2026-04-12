from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from portfolio.models import AdvisoryAggregateAuditLog, AdvisoryAggregateSnapshot, WhaleAdvisory


class ApiRouteStockAIAdvisoryTraceTests(APITestCase):
    def setUp(self):
        from . import test_api_routes as legacy_routes

        legacy_routes.ApiRouteSmokeTests.setUp(self)

    def authenticate(self):
        from . import test_api_routes as legacy_routes

        return legacy_routes.ApiRouteSmokeTests.authenticate(self)

    def test_stock_ai_advisory_trace_returns_snapshot_and_matched_audit_logs(self):
        self.authenticate()
        snapshot = AdvisoryAggregateSnapshot.objects.create(
            user=self.user,
            symbol='BCM',
            snapshot_seq=1,
            state_json={'seq': 1, 'history': [{'event': 'seed'}]},
        )
        advisory = WhaleAdvisory.objects.create(
            user=self.user,
            symbol='BCM',
            matched_value=6_000_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='trace summary',
            ai_detail='trace detail',
            ai_provider='openclaw',
            ai_model='default',
            aggregate_snapshot=snapshot,
        )
        AdvisoryAggregateAuditLog.objects.create(
            user=self.user,
            symbol='BCM',
            before_state_json={'advisory_id': advisory.id - 1, 'snapshot_id': 0},
            after_state_json={'advisory_id': advisory.id, 'snapshot_id': snapshot.id},
            reason=AdvisoryAggregateAuditLog.ReasonChoices.NEW_WHALE_EVENT,
            actor=AdvisoryAggregateAuditLog.ActorChoices.SYSTEM,
            actor_id='unit-test',
            metadata_json={'advisory_id': advisory.id, 'snapshot_id': snapshot.id, 'operation': 'advisory_generation'},
        )

        response = self.client.get(
            f'/api/stock-management/stocks/BCM/ai-advisory-trace/?advisory_id={advisory.id}&max_logs=5'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['ok'])
        self.assertEqual(response.data['trace']['advisory_id'], advisory.id)
        self.assertEqual(response.data['trace']['snapshot_id'], snapshot.id)
        self.assertEqual(response.data['advisory']['aggregate_snapshot_id'], snapshot.id)
        self.assertEqual(response.data['snapshot']['snapshot_seq'], 1)
        self.assertGreaterEqual(response.data['counts']['matched_audit_logs'], 1)

    def test_stock_ai_advisory_trace_list_supports_cursor_pagination(self):
        self.authenticate()
        for seq in (1, 2, 3):
            snapshot = AdvisoryAggregateSnapshot.objects.create(
                user=self.user,
                symbol='BCM',
                snapshot_seq=seq,
                state_json={'seq': seq},
            )
            advisory = WhaleAdvisory.objects.create(
                user=self.user,
                symbol='BCM',
                matched_value=6_000_000_000 + seq,
                side='BUY',
                threshold=5_000_000_000,
                ai_summary=f'trace summary {seq}',
                ai_detail=f'trace detail {seq}',
                ai_provider='openclaw',
                ai_model='default',
                aggregate_snapshot=snapshot,
            )
            AdvisoryAggregateAuditLog.objects.create(
                user=self.user,
                symbol='BCM',
                before_state_json={'advisory_id': advisory.id - 1, 'snapshot_id': max(seq - 1, 0)},
                after_state_json={'advisory_id': advisory.id, 'snapshot_id': snapshot.id},
                reason=AdvisoryAggregateAuditLog.ReasonChoices.NEW_WHALE_EVENT,
                actor=AdvisoryAggregateAuditLog.ActorChoices.SYSTEM,
                actor_id='unit-test',
                metadata_json={'advisory_id': advisory.id, 'snapshot_id': snapshot.id},
            )

        first = self.client.get('/api/stock-management/stocks/BCM/ai-advisory-traces/?limit=2')
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertTrue(first.data['ok'])
        self.assertEqual(len(first.data['items']), 2)
        self.assertTrue(first.data['paging']['has_more'])
        self.assertIsNotNone(first.data['paging']['next_cursor'])

        next_cursor = first.data['paging']['next_cursor']
        second = self.client.get(f'/api/stock-management/stocks/BCM/ai-advisory-traces/?limit=2&cursor={next_cursor}')
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertTrue(second.data['ok'])
        self.assertEqual(len(second.data['items']), 1)
        self.assertFalse(second.data['paging']['has_more'])
        self.assertIsNone(second.data['paging']['next_cursor'])

    def test_stock_ai_advisory_trace_list_supports_reason_actor_time_filters(self):
        self.authenticate()
        now = timezone.now()

        snapshot_old = AdvisoryAggregateSnapshot.objects.create(
            user=self.user,
            symbol='BCM',
            snapshot_seq=1,
            state_json={'seq': 1},
        )
        advisory_old = WhaleAdvisory.objects.create(
            user=self.user,
            symbol='BCM',
            matched_value=6_000_000_001,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='old trace summary',
            ai_detail='old trace detail',
            ai_provider='openclaw',
            ai_model='default',
            aggregate_snapshot=snapshot_old,
        )
        old_log = AdvisoryAggregateAuditLog.objects.create(
            user=self.user,
            symbol='BCM',
            before_state_json={'advisory_id': advisory_old.id - 1, 'snapshot_id': 0},
            after_state_json={'advisory_id': advisory_old.id, 'snapshot_id': snapshot_old.id},
            reason=AdvisoryAggregateAuditLog.ReasonChoices.MANUAL_REFRESH,
            actor=AdvisoryAggregateAuditLog.ActorChoices.USER,
            actor_id='unit-test-user',
            metadata_json={'advisory_id': advisory_old.id, 'snapshot_id': snapshot_old.id},
        )
        AdvisoryAggregateAuditLog.objects.filter(pk=old_log.pk).update(created_at=now - timedelta(days=2))

        snapshot_new = AdvisoryAggregateSnapshot.objects.create(
            user=self.user,
            symbol='BCM',
            snapshot_seq=2,
            state_json={'seq': 2},
        )
        advisory_new = WhaleAdvisory.objects.create(
            user=self.user,
            symbol='BCM',
            matched_value=6_000_000_002,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='new trace summary',
            ai_detail='new trace detail',
            ai_provider='openclaw',
            ai_model='default',
            aggregate_snapshot=snapshot_new,
        )
        AdvisoryAggregateAuditLog.objects.create(
            user=self.user,
            symbol='BCM',
            before_state_json={'advisory_id': advisory_new.id - 1, 'snapshot_id': snapshot_old.id},
            after_state_json={'advisory_id': advisory_new.id, 'snapshot_id': snapshot_new.id},
            reason=AdvisoryAggregateAuditLog.ReasonChoices.NEW_WHALE_EVENT,
            actor=AdvisoryAggregateAuditLog.ActorChoices.SYSTEM,
            actor_id='unit-test-system',
            metadata_json={'advisory_id': advisory_new.id, 'snapshot_id': snapshot_new.id},
        )

        start_at = (now - timedelta(hours=1)).isoformat()
        response = self.client.get(
            '/api/stock-management/stocks/BCM/ai-advisory-traces/',
            {
                'limit': 10,
                'reason': 'new_whale_event',
                'actor': 'system',
                'start_at': start_at,
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['ok'])
        self.assertEqual(len(response.data['items']), 1)
        self.assertEqual(response.data['items'][0]['advisory_id'], advisory_new.id)
        self.assertEqual(response.data['items'][0]['last_audit_reason'], AdvisoryAggregateAuditLog.ReasonChoices.NEW_WHALE_EVENT)
        self.assertEqual(response.data['filters']['reason'], 'new_whale_event')
        self.assertEqual(response.data['filters']['actor'], 'system')

    def test_stock_ai_advisory_trace_list_returns_400_for_invalid_reason_filter(self):
        self.authenticate()
        response = self.client.get('/api/stock-management/stocks/BCM/ai-advisory-traces/?reason=invalid_reason')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['ok'])

    def test_stock_ai_advisory_trace_export_returns_audit_artifact_bundle(self):
        self.authenticate()
        snapshot = AdvisoryAggregateSnapshot.objects.create(
            user=self.user,
            symbol='BCM',
            snapshot_seq=9,
            state_json={'seq': 9, 'quality': {'actionability': 0.61}},
        )
        advisory = WhaleAdvisory.objects.create(
            user=self.user,
            symbol='BCM',
            matched_value=6_500_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='export trace summary',
            ai_detail='export trace detail',
            ai_provider='openclaw',
            ai_model='default',
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
            actor_id='unit-test-system',
            metadata_json={'advisory_id': advisory.id, 'snapshot_id': snapshot.id},
        )

        response = self.client.get(
            f'/api/stock-management/stocks/BCM/ai-advisory-trace-export/?advisory_id={advisory.id}&contract=v2&history_limit=3'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['ok'])
        self.assertEqual(response.data['symbol'], 'BCM')
        self.assertEqual(response.data['filters']['contract'], 'v2')
        self.assertIn('exported_at', response.data)
        self.assertIn('session', response.data)
        self.assertIn('trace', response.data)
        self.assertIn('history', response.data)
        self.assertEqual(response.data['session']['contract_version'], 'v2')
        self.assertEqual(response.data['session']['aggregate']['advisory_id'], advisory.id)
        self.assertEqual(response.data['session']['aggregate']['decision']['score_band'], 'medium')
        self.assertIn('observability', response.data['session']['aggregate'])
        self.assertIn('label', response.data['session']['aggregate']['observability']['aggregate_quality'])
        self.assertEqual(response.data['trace']['trace']['advisory_id'], advisory.id)
        self.assertGreaterEqual(len(response.data['history']['items']), 1)
