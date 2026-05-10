from datetime import date, datetime, timezone as datetime_timezone
from unittest.mock import MagicMock, patch

from django.core.cache import cache

from django.test import TestCase

from portfolio.models import WhaleAlertEvent
from portfolio.services_global_whale_alerts import (
    GLOBAL_WHALE_LATEST_EVENT_CACHE_PREFIX,
    REALTIME_UNIVERSE_SNAPSHOT_CACHE_KEY,
    build_whale_alert_event_id,
    persist_whale_alert_event,
    run_global_whale_alert_detection,
)
from portfolio.tasks_whale_service import detect_and_store_global_whale_alerts, distribute_whale_alert_event


class GlobalWhaleAlertsServiceTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_build_whale_alert_event_id_is_deterministic_and_symbol_scoped(self):
        occurred_at = datetime(2026, 4, 28, 9, 15, 45, tzinfo=datetime_timezone.utc)

        first = build_whale_alert_event_id(
            symbol='vcb',
            occurred_at=occurred_at,
            side='buy',
            matched_value_vnd=1_250_000_000,
            source_key='redis_stream',
        )
        second = build_whale_alert_event_id(
            symbol='VCB',
            occurred_at=occurred_at,
            side='BUY',
            matched_value_vnd=1_250_000_000,
            source_key='redis_stream',
        )
        different_symbol = build_whale_alert_event_id(
            symbol='FPT',
            occurred_at=occurred_at,
            side='BUY',
            matched_value_vnd=1_250_000_000,
            source_key='redis_stream',
        )

        self.assertEqual(first, second)
        self.assertNotEqual(first, different_symbol)
        self.assertEqual(first, 'whale:VCB:2026-04-28T09:15:45+00:00:BUY:1250000000:redis_stream')

    def test_persist_whale_alert_event_is_idempotent_by_event_id(self):
        occurred_at = datetime(2026, 4, 28, 9, 30, 0, tzinfo=datetime_timezone.utc)

        event, created = persist_whale_alert_event(
            symbol='HPG',
            side='SELL',
            matched_value_vnd=2_400_000_000,
            threshold_vnd=500_000_000,
            severity='urgent',
            event_score=93.5,
            confidence='high',
            source='redis_stream',
            source_layer='live',
            occurred_at=occurred_at,
            trade_date=date(2026, 4, 28),
            market_wide=True,
            payload_json={'source_record_id': 'stream-1'},
        )
        same_event, created_again = persist_whale_alert_event(
            symbol='HPG',
            side='SELL',
            matched_value_vnd=2_400_000_000,
            threshold_vnd=500_000_000,
            severity='warning',
            event_score=95.0,
            confidence='high',
            source='redis_stream',
            source_layer='live',
            occurred_at=occurred_at,
            trade_date=date(2026, 4, 28),
            market_wide=False,
            is_market_discovery=True,
            payload_json={'source_record_id': 'stream-2'},
        )

        self.assertTrue(created)
        self.assertFalse(created_again)
        self.assertEqual(WhaleAlertEvent.objects.count(), 1)
        self.assertEqual(event.id, same_event.id)

        same_event.refresh_from_db()
        self.assertEqual(same_event.symbol, 'HPG')
        self.assertEqual(same_event.severity, WhaleAlertEvent.SeverityChoices.WARNING)
        self.assertEqual(same_event.trade_date, date(2026, 4, 28))
        self.assertFalse(same_event.market_wide)
        self.assertTrue(same_event.is_market_discovery)
        self.assertEqual(same_event.payload_json['source_record_id'], 'stream-2')

    @patch('portfolio.services_global_whale_alerts._build_whale_payloads_for_symbol')
    def test_run_global_whale_alert_detection_persists_events_from_effective_universe_snapshot(self, mock_build_payloads):
        cache.set(
            REALTIME_UNIVERSE_SNAPSHOT_CACHE_KEY,
            {'effective_symbols': ['VCB', 'FPT']},
            timeout=60,
        )
        mock_build_payloads.side_effect = [
            (
                [
                    {
                        'event_id': 'whale:VCB:2026-04-28T09:20:00+00:00:buy:1250000000',
                        'symbol': 'VCB',
                        'side': 'buy',
                        'matched_value': 1_250_000_000,
                        'threshold': 500_000_000,
                        'severity': 'urgent',
                        'event_score': 9.1,
                        'source': 'redis_stream',
                        'source_layer': 'live',
                        'ts': '2026-04-28T09:20:00+00:00',
                        'config_version': 'threshold-v1',
                    }
                ],
                'redis_stream',
            ),
            ([], 'none'),
        ]

        result = run_global_whale_alert_detection()

        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['symbols'], 2)
        self.assertEqual(result['processed'], 1)
        self.assertEqual(result['created'], 1)
        self.assertEqual(result['updated'], 0)
        self.assertEqual(len(result['created_event_ids']), 1)
        self.assertEqual(WhaleAlertEvent.objects.count(), 1)

        event = WhaleAlertEvent.objects.get(symbol='VCB')
        cached = cache.get(f'{GLOBAL_WHALE_LATEST_EVENT_CACHE_PREFIX}:VCB')
        self.assertEqual(cached['event_id'], event.event_id)
        self.assertEqual(cached['severity'], 'urgent')

    @patch('portfolio.services_global_whale_alerts._build_whale_payloads_for_symbol')
    def test_run_global_whale_alert_detection_updates_existing_event_instead_of_duplicate_insert(self, mock_build_payloads):
        cache.set(REALTIME_UNIVERSE_SNAPSHOT_CACHE_KEY, {'effective_symbols': ['HPG']}, timeout=60)
        mock_build_payloads.return_value = (
            [
                {
                    'event_id': 'whale:HPG:2026-04-28T09:25:00+00:00:sell:2400000000',
                    'symbol': 'HPG',
                    'side': 'sell',
                    'matched_value': 2_400_000_000,
                    'threshold': 500_000_000,
                    'severity': 'warning',
                    'event_score': 6.2,
                    'source': 'intraday_tick_db',
                    'source_layer': 'db',
                    'ts': '2026-04-28T09:25:00+00:00',
                    'config_version': 'threshold-v1',
                }
            ],
            'intraday_tick_db',
        )

        first = run_global_whale_alert_detection()
        cache.delete('global_whale_alert_lock:HPG')
        mock_build_payloads.return_value = (
            [
                {
                    'event_id': 'whale:HPG:2026-04-28T09:25:00+00:00:sell:2400000000',
                    'symbol': 'HPG',
                    'side': 'sell',
                    'matched_value': 2_400_000_000,
                    'threshold': 500_000_000,
                    'severity': 'urgent',
                    'event_score': 8.8,
                    'source': 'intraday_tick_db',
                    'source_layer': 'db',
                    'ts': '2026-04-28T09:25:00+00:00',
                    'config_version': 'threshold-v1',
                }
            ],
            'intraday_tick_db',
        )
        second = run_global_whale_alert_detection()

        self.assertEqual(first['created'], 1)
        self.assertEqual(second['created'], 0)
        self.assertEqual(second['updated'], 1)
        self.assertEqual(WhaleAlertEvent.objects.count(), 1)
        event = WhaleAlertEvent.objects.get(symbol='HPG')
        self.assertEqual(event.severity, 'urgent')

    @patch('portfolio.tasks_whale_service.distribute_whale_alert_event')
    @patch('portfolio.tasks_whale_service.run_global_whale_alert_detection')
    def test_detect_and_store_global_whale_alerts_enqueues_distribution_for_created_events(self, mock_run_detection, mock_distribute_task):
        mock_run_detection.return_value = {
            'status': 'ok',
            'symbols': 1,
            'processed': 1,
            'created': 2,
            'updated': 0,
            'cached': 2,
            'skipped_locked': 0,
            'errors': 0,
            'created_event_ids': [11, 12],
        }
        mock_distribute_task.delay = MagicMock()

        result = detect_and_store_global_whale_alerts.run(symbol='FPT')

        self.assertEqual(result['distribution_enqueued'], 2)
        mock_distribute_task.delay.assert_any_call(11)
        mock_distribute_task.delay.assert_any_call(12)

    @patch('portfolio.tasks_whale_service.deliver_whale_alert_event')
    def test_distribute_whale_alert_event_task_loads_event_and_returns_delivery_result(self, mock_deliver_whale_alert_event):
        event = WhaleAlertEvent.objects.create(
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
            trade_date=date(2026, 4, 28),
            occurred_at=datetime(2026, 4, 28, 9, 15, 0, tzinfo=datetime_timezone.utc),
            payload_json={'symbol': 'FPT'},
        )
        mock_deliver_whale_alert_event.return_value = {
            'status': 'ok',
            'history_count': 1,
            'symbol_broadcast_count': 1,
            'user_broadcast_count': 1,
            'audience_rows': [{'user_id': 1}],
        }

        result = distribute_whale_alert_event.run(event.id)

        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['event_id'], event.event_id)
        mock_deliver_whale_alert_event.assert_called_once()
