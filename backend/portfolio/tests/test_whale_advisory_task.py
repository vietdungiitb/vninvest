from datetime import timedelta
from unittest.mock import MagicMock, patch

import pandas as pd

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone

from portfolio.models import AdvisoryAggregateAuditLog, AdvisoryAggregateSnapshot, AdvisoryTokenLog, IntradayTick, TrackedSymbol, UserConfig, WhaleAdvisory
from portfolio.observability import get_market_observability_snapshot, reset_market_observability
from portfolio.tasks import _accumulate_user_advisory_event, auto_generate_advisories_for_all_tracked, collect_and_publish_realtime, detect_whale_reversal, flush_merged_advisory_event, generate_whale_advisory_task
from portfolio.tasks import _compute_advisory_severity
from portfolio.tasks import _resolve_advisory_threshold_vnd


@override_settings(WHALE_ADVISORY_COOLDOWN_SECONDS=900)
class WhaleAdvisoryTaskTests(TestCase):
    def _create_user_config(self, username: str, provider: str = 'openai', model: str = 'gpt-4o', api_key: str = ''):
        user = User.objects.create_user(username=username, password='Test@123456', is_staff=True)
        cfg = UserConfig.objects.create(
            user=user,
            ai_provider=provider,
            ai_model=model,
        )
        if api_key:
            cfg.set_ai_api_key(api_key)
            cfg.save(update_fields=['ai_api_key'])
        return user

    def setUp(self):
        reset_market_observability()
        return super().setUp()

    @patch('asgiref.sync.async_to_sync')
    @patch('channels.layers.get_channel_layer')
    @patch('portfolio.ai_service.generate_whale_text')
    def test_task_persists_threshold_and_broadcast_metadata(
        self,
        mock_generate_text,
        mock_get_channel_layer,
        mock_async_to_sync,
    ):
        symbol = 'ZZZT'
        staff_user = self._create_user_config('staff-default', api_key='sk-test-default')
        cache.delete(f'whale_advisory_lock:{symbol}')

        mock_generate_text.side_effect = [
            {
                'text': 'Tom tat AI',
                'prompt_tokens': 10,
                'completion_tokens': 20,
            },
            {
                'text': 'Phan tich sau AI',
                'prompt_tokens': 30,
                'completion_tokens': 40,
            },
        ]
        mock_sender = MagicMock()
        mock_async_to_sync.return_value = mock_sender
        mock_get_channel_layer.return_value = MagicMock()

        result = generate_whale_advisory_task(
            symbol=symbol,
            matched_value_vnd=8_200_000_000,
            side='BUY',
            threshold=5_000_000_000,
            user_id=staff_user.id,
        )

        advisory = WhaleAdvisory.objects.get(symbol=symbol)
        self.assertEqual(result['status'], 'ok')
        self.assertEqual(advisory.user_id, staff_user.id)
        self.assertEqual(advisory.ai_model, 'gpt-4o')
        self.assertEqual(advisory.threshold, 5_000_000_000)
        self.assertEqual(advisory.ai_summary, 'Tom tat AI')
        self.assertEqual(advisory.ai_detail, 'Phan tich sau AI')

        mock_sender.assert_called_once()
        group_name, event = mock_sender.call_args.args
        self.assertEqual(group_name, f'user_{staff_user.id}_alerts')
        self.assertEqual(event['type'], 'whale_advisory')
        self.assertEqual(event['payload']['threshold'], 5_000_000_000)
        self.assertEqual(event['payload']['threshold_source'], 'user_default')
        self.assertEqual(event['payload']['matched_value'], 8_200_000_000)
        self.assertIn('ai_provider', event['payload'])
        self.assertIn('ai_model', event['payload'])
        self.assertIn('ts', event['payload'])
        self.assertEqual(result['threshold_source'], 'user_default')

    @patch('portfolio.ai_service.generate_whale_text')
    def test_auto_generation_skips_if_existing_advisory(self, mock_generate_text):
        symbol = 'AAA'
        WhaleAdvisory.objects.create(
            symbol=symbol,
            matched_value=1_000_000_000,
            side='BUY',
            threshold=500_000_000,
            ai_summary='existing summary',
            ai_detail='existing detail',
            ai_provider='openclaw',
        )

        result = generate_whale_advisory_task(
            symbol=symbol,
            matched_value_vnd=2_000_000_000,
            side='SELL',
            threshold=500_000_000,
        )

        self.assertEqual(result['status'], 'skipped')
        self.assertEqual(result['reason'], 'existing_advisory')
        self.assertEqual(WhaleAdvisory.objects.filter(symbol=symbol).count(), 1)
        mock_generate_text.assert_not_called()

    @patch('portfolio.ai_service.generate_whale_text')
    def test_force_refresh_generates_new_advisory_even_if_existing(self, mock_generate_text):
        symbol = 'BBB'
        staff_user = self._create_user_config('staff-force-refresh', api_key='sk-test-force')
        WhaleAdvisory.objects.create(
            symbol=symbol,
            matched_value=1_000_000_000,
            side='BUY',
            threshold=500_000_000,
            ai_summary='existing summary',
            ai_detail='existing detail',
            ai_provider='openclaw',
        )
        mock_generate_text.side_effect = [
            {'text': 'new summary', 'prompt_tokens': 11, 'completion_tokens': 22},
            {'text': 'new detail', 'prompt_tokens': 33, 'completion_tokens': 44},
        ]

        result = generate_whale_advisory_task(
            symbol=symbol,
            matched_value_vnd=3_000_000_000,
            side='SELL',
            threshold=500_000_000,
            force_refresh=True,
            user_id=staff_user.id,
        )

        self.assertEqual(result['status'], 'ok')
        self.assertTrue(result['force_refresh'])
        self.assertEqual(WhaleAdvisory.objects.filter(symbol=symbol, user_id=staff_user.id).count(), 1)
        latest = WhaleAdvisory.objects.filter(symbol=symbol, user_id=staff_user.id).order_by('-created_at').first()
        self.assertEqual(latest.ai_summary, 'new summary')

    @patch.dict('os.environ', {'COPILOT_API_KEY': 'ghp_test_env_token'}, clear=False)
    @patch('asgiref.sync.async_to_sync')
    @patch('channels.layers.get_channel_layer')
    @patch('portfolio.ai_service.generate_whale_text')
    def test_task_uses_env_api_key_when_staff_config_has_no_saved_key(
        self,
        mock_generate_text,
        mock_get_channel_layer,
        mock_async_to_sync,
    ):
        staff_user = self._create_user_config('staff-copilot', provider='copilot', model='openai/gpt-4.1-mini')
        mock_generate_text.side_effect = [
            {'text': 'summary from env', 'prompt_tokens': 12, 'completion_tokens': 23},
            {'text': 'detail from env', 'prompt_tokens': 34, 'completion_tokens': 45},
        ]
        mock_async_to_sync.return_value = MagicMock()
        mock_get_channel_layer.return_value = MagicMock()

        result = generate_whale_advisory_task(
            symbol='FPT',
            matched_value_vnd=4_000_000_000,
            side='BUY',
            threshold=1_000_000_000,
            force_refresh=True,
            user_id=staff_user.id,
        )

        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['ai_provider'], 'copilot')
        first_call = mock_generate_text.call_args_list[0]
        self.assertEqual(first_call.kwargs['provider'], 'copilot')
        self.assertEqual(first_call.kwargs['model'], 'openai/gpt-4.1-mini')
        self.assertEqual(first_call.kwargs['api_key'], 'ghp_test_env_token')

    @patch('asgiref.sync.async_to_sync')
    @patch('channels.layers.get_channel_layer')
    def test_task_generates_provider_aware_placeholder_when_staff_key_missing(
        self,
        mock_get_channel_layer,
        mock_async_to_sync,
    ):
        staff_user = self._create_user_config('staff-openai', provider='openai', model='gpt-4o')
        mock_async_to_sync.return_value = MagicMock()
        mock_get_channel_layer.return_value = MagicMock()

        result = generate_whale_advisory_task(
            symbol='VNM',
            matched_value_vnd=5_000_000_000,
            side='BUY',
            threshold=1_000_000_000,
            force_refresh=True,
            user_id=staff_user.id,
        )

        self.assertEqual(result['status'], 'skipped')
        self.assertEqual(result['reason'], 'missing_system_ai_settings')
        self.assertFalse(WhaleAdvisory.objects.filter(symbol='VNM').exists())

    def test_task_skips_when_user_has_no_ai_model(self):
        staff_user = self._create_user_config('staff-missing-model', provider='openai', model='')

        result = generate_whale_advisory_task(
            symbol='VCB',
            matched_value_vnd=6_000_000_000,
            side='BUY',
            threshold=1_000_000_000,
            force_refresh=True,
            user_id=staff_user.id,
        )

        self.assertEqual(result['status'], 'skipped')
        self.assertEqual(result['reason'], 'missing_system_ai_settings')
        self.assertFalse(WhaleAdvisory.objects.filter(symbol='VCB').exists())

    @patch('asgiref.sync.async_to_sync')
    @patch('channels.layers.get_channel_layer')
    @patch('portfolio.ai_service.generate_advisory_concise')
    def test_periodic_job_uses_concise_mode_and_logs_tokens(
        self,
        mock_generate_concise,
        mock_get_channel_layer,
        mock_async_to_sync,
    ):
        staff_user = self._create_user_config('staff-periodic', api_key='sk-test-periodic')
        mock_generate_concise.return_value = {
            'text': 'Tom tat ngan gon',
            'prompt_tokens': 21,
            'completion_tokens': 34,
        }
        mock_async_to_sync.return_value = MagicMock()
        mock_get_channel_layer.return_value = MagicMock()

        result = generate_whale_advisory_task(
            symbol='MBB',
            matched_value_vnd=2_500_000_000,
            side='INFO',
            threshold=1_000_000_000,
            force_refresh=True,
            user_id=staff_user.id,
            source=WhaleAdvisory.SourceChoices.PERIODIC_JOB,
        )

        advisory = WhaleAdvisory.objects.get(symbol='MBB', user=staff_user)
        token_log = AdvisoryTokenLog.objects.get(advisory=advisory)
        self.assertEqual(result['status'], 'ok')
        self.assertTrue(result['used_concise'])
        self.assertEqual(advisory.source, WhaleAdvisory.SourceChoices.PERIODIC_JOB)
        self.assertTrue(advisory.is_auto_generated)
        self.assertEqual(advisory.ai_detail, '')
        self.assertIsNotNone(advisory.next_refresh_at)
        self.assertEqual(token_log.tokens_used, 55)
        self.assertEqual(token_log.source, AdvisoryTokenLog.SourceChoices.AUTO_GENERATION)

    @patch('asgiref.sync.async_to_sync')
    @patch('channels.layers.get_channel_layer')
    @patch('portfolio.ai_service.generate_whale_text')
    def test_task_persists_metrics_into_aggregate_audit_log(
        self,
        mock_generate_text,
        mock_get_channel_layer,
        mock_async_to_sync,
    ):
        staff_user = self._create_user_config('staff-metrics-audit', api_key='sk-test-metrics')
        mock_generate_text.side_effect = [
            {'text': 'Tom tat co action', 'prompt_tokens': 14, 'completion_tokens': 26},
            {'text': 'Chi tiet co evidence', 'prompt_tokens': 28, 'completion_tokens': 42},
        ]
        mock_async_to_sync.return_value = MagicMock()
        mock_get_channel_layer.return_value = MagicMock()

        result = generate_whale_advisory_task(
            symbol='SSI',
            matched_value_vnd=7_500_000_000,
            side='BUY',
            threshold=2_000_000_000,
            force_refresh=True,
            user_id=staff_user.id,
        )

        advisory = WhaleAdvisory.objects.get(symbol='SSI', user=staff_user)
        audit = AdvisoryAggregateAuditLog.objects.get(symbol='SSI', user=staff_user)

        self.assertEqual(result['status'], 'ok')
        self.assertIsNotNone(advisory.aggregate_snapshot_id)
        self.assertEqual(audit.reason, AdvisoryAggregateAuditLog.ReasonChoices.NEW_WHALE_EVENT)
        self.assertEqual(audit.actor, AdvisoryAggregateAuditLog.ActorChoices.SYSTEM)
        self.assertEqual(audit.after_state_json['advisory_id'], advisory.id)
        self.assertEqual(audit.after_state_json['snapshot_id'], advisory.aggregate_snapshot_id)
        self.assertEqual(audit.after_state_json['severity'], advisory.severity)
        self.assertEqual(audit.metadata_json['advisory_id'], advisory.id)
        self.assertEqual(audit.metadata_json['snapshot_id'], advisory.aggregate_snapshot_id)
        self.assertEqual(audit.metadata_json['source'], WhaleAdvisory.SourceChoices.WHALE_SIGNAL)
        self.assertGreater(audit.metadata_json['token_cost'], 0)
        self.assertGreaterEqual(audit.metadata_json['latency_ms'], 0)
        self.assertIn('actionability_score', audit.metadata_json)
        self.assertIn('confidence', audit.metadata_json)

    @patch('asgiref.sync.async_to_sync')
    @patch('channels.layers.get_channel_layer')
    @patch('portfolio.ai_service.generate_whale_text')
    def test_task_persists_snapshot_with_monotonic_sequence(
        self,
        mock_generate_text,
        mock_get_channel_layer,
        mock_async_to_sync,
    ):
        staff_user = self._create_user_config('staff-snapshot-seq', api_key='sk-test-snapshot-seq')
        mock_generate_text.side_effect = [
            {'text': 'summary-1', 'prompt_tokens': 8, 'completion_tokens': 13},
            {'text': 'detail-1', 'prompt_tokens': 21, 'completion_tokens': 34},
            {'text': 'summary-2', 'prompt_tokens': 9, 'completion_tokens': 14},
            {'text': 'detail-2', 'prompt_tokens': 22, 'completion_tokens': 35},
        ]
        mock_async_to_sync.return_value = MagicMock()
        mock_get_channel_layer.return_value = MagicMock()

        first_result = generate_whale_advisory_task(
            symbol='H2A',
            matched_value_vnd=4_100_000_000,
            side='BUY',
            threshold=1_000_000_000,
            force_refresh=True,
            user_id=staff_user.id,
        )
        second_result = generate_whale_advisory_task(
            symbol='H2A',
            matched_value_vnd=4_300_000_000,
            side='BUY',
            threshold=1_000_000_000,
            force_refresh=True,
            user_id=staff_user.id,
        )

        snapshots = list(
            AdvisoryAggregateSnapshot.objects.filter(user=staff_user, symbol='H2A').order_by('snapshot_seq')
        )
        advisories = list(WhaleAdvisory.objects.filter(user=staff_user, symbol='H2A').order_by('created_at'))

        self.assertEqual(first_result['status'], 'ok')
        self.assertEqual(second_result['status'], 'ok')
        self.assertEqual([item.snapshot_seq for item in snapshots], [1, 2])
        self.assertEqual(len(advisories), 2)
        self.assertEqual(advisories[0].aggregate_snapshot_id, snapshots[0].id)
        self.assertEqual(advisories[1].aggregate_snapshot_id, snapshots[1].id)

    @patch('asgiref.sync.async_to_sync')
    @patch('channels.layers.get_channel_layer')
    @patch('portfolio.ai_service.generate_advisory_concise')
    def test_periodic_task_metrics_use_scheduler_audit_labels(
        self,
        mock_generate_concise,
        mock_get_channel_layer,
        mock_async_to_sync,
    ):
        staff_user = self._create_user_config('staff-periodic-audit', api_key='sk-test-periodic-audit')
        mock_generate_concise.return_value = {
            'text': 'Tom tat ngan gon theo lich',
            'prompt_tokens': 11,
            'completion_tokens': 19,
        }
        mock_async_to_sync.return_value = MagicMock()
        mock_get_channel_layer.return_value = MagicMock()

        generate_whale_advisory_task(
            symbol='VCI',
            matched_value_vnd=2_200_000_000,
            side='INFO',
            threshold=1_000_000_000,
            force_refresh=True,
            user_id=staff_user.id,
            source=WhaleAdvisory.SourceChoices.PERIODIC_JOB,
        )

        audit = AdvisoryAggregateAuditLog.objects.get(symbol='VCI', user=staff_user)
        self.assertEqual(audit.reason, AdvisoryAggregateAuditLog.ReasonChoices.AUTO_GENERATION)
        self.assertEqual(audit.actor, AdvisoryAggregateAuditLog.ActorChoices.SCHEDULER)
        self.assertTrue(audit.metadata_json['used_concise'])

    def test_task_skips_when_daily_budget_exceeded(self):
        staff_user = self._create_user_config('staff-budget', api_key='sk-test-budget')
        config = UserConfig.objects.get(user=staff_user)
        config.advisory_max_tokens_per_day = 1000
        config.save(update_fields=['advisory_max_tokens_per_day'])
        AdvisoryTokenLog.objects.create(
            user=staff_user,
            tokens_used=1000,
            source=AdvisoryTokenLog.SourceChoices.AUTO_GENERATION,
            symbol='HPG',
        )

        result = generate_whale_advisory_task(
            symbol='HPG',
            matched_value_vnd=1_500_000_000,
            side='INFO',
            threshold=1_000_000_000,
            force_refresh=True,
            user_id=staff_user.id,
            source=WhaleAdvisory.SourceChoices.PERIODIC_JOB,
        )

        self.assertEqual(result['status'], 'skipped')
        self.assertEqual(result['reason'], 'daily_budget_exceeded')
        self.assertFalse(WhaleAdvisory.objects.filter(symbol='HPG', user=staff_user).exists())

    def test_task_skips_when_daily_auto_refresh_limit_exceeded(self):
        staff_user = self._create_user_config('staff-autolimit', api_key='sk-test-autolimit')
        config = UserConfig.objects.get(user=staff_user)
        config.advisory_max_auto_refreshes_per_day = 1
        config.save(update_fields=['advisory_max_auto_refreshes_per_day'])
        AdvisoryTokenLog.objects.create(
            user=staff_user,
            tokens_used=120,
            source=AdvisoryTokenLog.SourceChoices.AUTO_GENERATION,
            symbol='ACB',
        )

        result = generate_whale_advisory_task(
            symbol='ACB',
            matched_value_vnd=1_500_000_000,
            side='INFO',
            threshold=1_000_000_000,
            force_refresh=True,
            user_id=staff_user.id,
            source=WhaleAdvisory.SourceChoices.PERIODIC_JOB,
        )

        self.assertEqual(result['status'], 'skipped')
        self.assertEqual(result['reason'], 'daily_auto_refresh_limit_exceeded')
        self.assertFalse(WhaleAdvisory.objects.filter(symbol='ACB', user=staff_user).exists())

    def test_task_skips_when_event_based_advisory_disabled_for_user(self):
        staff_user = self._create_user_config('staff-event-off', api_key='sk-test-event-off')
        config = UserConfig.objects.get(user=staff_user)
        config.advisory_whale_signal_enabled = False
        config.save(update_fields=['advisory_whale_signal_enabled'])

        result = generate_whale_advisory_task(
            symbol='EVT1',
            matched_value_vnd=2_000_000_000,
            side='BUY',
            threshold=1_000_000_000,
            force_refresh=True,
            user_id=staff_user.id,
            source=WhaleAdvisory.SourceChoices.WHALE_SIGNAL,
        )

        self.assertEqual(result['status'], 'skipped')
        self.assertEqual(result['reason'], 'whale_signal_disabled')
        self.assertFalse(WhaleAdvisory.objects.filter(symbol='EVT1', user=staff_user).exists())

    @patch('portfolio.tasks.generate_whale_advisory_task.apply_async')
    def test_auto_generate_task_queues_missing_and_stale_tracked_symbols(self, mock_apply_async):
        cache.delete('advisory:auto-generation:job-lock')
        staff_user = self._create_user_config('staff-auto-queue')
        config = UserConfig.objects.get(user=staff_user)
        config.advisory_refresh_interval_hours = 24
        config.advisory_max_tokens_per_day = 5000
        config.advisory_max_auto_refreshes_per_day = 5
        config.save(update_fields=['advisory_refresh_interval_hours', 'advisory_max_tokens_per_day', 'advisory_max_auto_refreshes_per_day'])
        TrackedSymbol.objects.create(user=staff_user, symbol='AAA')
        TrackedSymbol.objects.create(user=staff_user, symbol='BBB')
        cache.delete(f'advisory:auto-generation:queue:{staff_user.id}:AAA')
        cache.delete(f'advisory:auto-generation:queue:{staff_user.id}:BBB')
        WhaleAdvisory.objects.create(
            user=staff_user,
            symbol='BBB',
            matched_value=2_000_000_000,
            side='BUY',
            threshold=1_000_000_000,
            ai_summary='old summary',
            ai_detail='old detail',
            ai_provider='openclaw',
            next_refresh_at=timezone.now() - timedelta(hours=1),
        )

        result = auto_generate_advisories_for_all_tracked(batch_size=10)

        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['queued_count'], 2)
        self.assertEqual(mock_apply_async.call_count, 2)
        first_kwargs = mock_apply_async.call_args_list[0].kwargs['kwargs']
        second_kwargs = mock_apply_async.call_args_list[1].kwargs['kwargs']
        self.assertEqual(first_kwargs['source'], WhaleAdvisory.SourceChoices.PERIODIC_JOB)
        self.assertEqual(second_kwargs['source'], WhaleAdvisory.SourceChoices.PERIODIC_JOB)

    @patch('portfolio.tasks.generate_whale_advisory_task.apply_async')
    def test_auto_generate_task_respects_daily_auto_refresh_limit(self, mock_apply_async):
        cache.delete('advisory:auto-generation:job-lock')
        staff_user = self._create_user_config('staff-auto-limit')
        config = UserConfig.objects.get(user=staff_user)
        config.advisory_max_tokens_per_day = 5000
        config.advisory_max_auto_refreshes_per_day = 1
        config.save(update_fields=['advisory_max_tokens_per_day', 'advisory_max_auto_refreshes_per_day'])
        TrackedSymbol.objects.create(user=staff_user, symbol='AAA')
        TrackedSymbol.objects.create(user=staff_user, symbol='BBB')
        AdvisoryTokenLog.objects.create(
            user=staff_user,
            tokens_used=111,
            source=AdvisoryTokenLog.SourceChoices.AUTO_GENERATION,
            symbol='ZZZ',
        )

        result = auto_generate_advisories_for_all_tracked(batch_size=10)

        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['queued_count'], 0)
        self.assertEqual(result['users_skipped_budget'], 1)
        mock_apply_async.assert_not_called()

    def test_compute_advisory_severity_thresholds(self):
        self.assertEqual(_compute_advisory_severity(25_000_000_000, 5_000_000_000), 'urgent')
        self.assertEqual(_compute_advisory_severity(10_000_000_000, 5_000_000_000), 'warning')
        self.assertEqual(_compute_advisory_severity(5_500_000_000, 5_000_000_000), 'info')
        self.assertEqual(_compute_advisory_severity(5_000_000_000, 0), 'info')

    def test_resolve_advisory_threshold_prefers_tracked_symbol_override(self):
        user = self._create_user_config('staff-threshold-override', api_key='sk-test-threshold-override')
        cfg = UserConfig.objects.get(user=user)
        cfg.whale_alert_threshold = 1200
        cfg.save(update_fields=['whale_alert_threshold'])
        tracked = TrackedSymbol.objects.create(
            user=user,
            symbol='FPT',
            whale_alert_threshold_million=850,
        )

        threshold_vnd = _resolve_advisory_threshold_vnd(cfg, tracked_symbol=tracked)

        self.assertEqual(threshold_vnd, 850_000_000)

    def test_resolve_advisory_threshold_uses_explicit_tracked_threshold_value(self):
        user = self._create_user_config('staff-threshold-explicit', api_key='sk-test-threshold-explicit')
        cfg = UserConfig.objects.get(user=user)
        cfg.whale_alert_threshold = 900
        cfg.save(update_fields=['whale_alert_threshold'])

        threshold_vnd = _resolve_advisory_threshold_vnd(cfg, tracked_threshold_million=640)

        self.assertEqual(threshold_vnd, 640_000_000)

    @patch('portfolio.tasks.RealtimePublisher')
    @patch('portfolio.tasks.detect_whale_signals')
    @patch('portfolio.tasks.collect_intraday_frame')
    @patch('portfolio.tasks.collect_symbols_for_user')
    @patch('portfolio.tasks.resolve_whale_runtime_config')
    def test_collect_realtime_prefers_symbol_override_threshold(
        self,
        mock_resolve_runtime_config,
        mock_collect_symbols,
        mock_collect_intraday_frame,
        mock_detect_whale_signals,
        mock_realtime_publisher,
    ):
        user = self._create_user_config('staff-realtime-threshold-override', api_key='sk-test-realtime-threshold')
        cfg = UserConfig.objects.get(user=user)
        cfg.whale_alert_threshold = 500
        cfg.save(update_fields=['whale_alert_threshold'])
        TrackedSymbol.objects.create(user=user, symbol='FPT', whale_alert_threshold_million=850)

        mock_collect_symbols.return_value = ['FPT']
        mock_collect_intraday_frame.return_value = pd.DataFrame([
            {'price': 100000, 'volume': 10000, 'side': 'BUY', 'ts': timezone.now().isoformat()},
        ])
        mock_detect_whale_signals.return_value = []
        mock_resolve_runtime_config.return_value = {
            'version_code': 'test-v1',
            'mode': 'active',
            'score_config': {},
            'thresholds_vnd': [500_000_000],
        }

        publisher = MagicMock()
        publisher.next_seq.return_value = 1
        publisher.publish.return_value = False
        mock_realtime_publisher.return_value = publisher

        result = collect_and_publish_realtime.run(user_id=user.id)

        self.assertEqual(result['status'], 'ok')
        self.assertEqual(mock_detect_whale_signals.call_count, 1)
        kwargs = mock_detect_whale_signals.call_args.kwargs
        self.assertEqual(kwargs['symbol'], 'FPT')
        self.assertEqual(kwargs['thresholds'], [850_000_000])

    @patch('portfolio.tasks.RealtimePublisher')
    @patch('portfolio.tasks.detect_whale_signals')
    @patch('portfolio.tasks.collect_intraday_frame')
    @patch('portfolio.tasks.collect_symbols_for_user')
    @patch('portfolio.tasks.resolve_whale_runtime_config')
    def test_collect_realtime_uses_user_threshold_when_symbol_override_missing(
        self,
        mock_resolve_runtime_config,
        mock_collect_symbols,
        mock_collect_intraday_frame,
        mock_detect_whale_signals,
        mock_realtime_publisher,
    ):
        user = self._create_user_config('staff-realtime-threshold-default', api_key='sk-test-realtime-default')
        cfg = UserConfig.objects.get(user=user)
        cfg.whale_alert_threshold = 620
        cfg.save(update_fields=['whale_alert_threshold'])
        TrackedSymbol.objects.create(user=user, symbol='HPG', whale_alert_threshold_million=None)

        mock_collect_symbols.return_value = ['HPG']
        mock_collect_intraday_frame.return_value = pd.DataFrame([
            {'price': 100000, 'volume': 10000, 'side': 'BUY', 'ts': timezone.now().isoformat()},
        ])
        mock_detect_whale_signals.return_value = []
        mock_resolve_runtime_config.return_value = {
            'version_code': 'test-v1',
            'mode': 'active',
            'score_config': {},
            'thresholds_vnd': [500_000_000],
        }

        publisher = MagicMock()
        publisher.next_seq.return_value = 1
        publisher.publish.return_value = False
        mock_realtime_publisher.return_value = publisher

        result = collect_and_publish_realtime.run(user_id=user.id)

        self.assertEqual(result['status'], 'ok')
        self.assertEqual(mock_detect_whale_signals.call_count, 1)
        kwargs = mock_detect_whale_signals.call_args.kwargs
        self.assertEqual(kwargs['symbol'], 'HPG')
        self.assertEqual(kwargs['thresholds'], [620_000_000])

    @patch('asgiref.sync.async_to_sync')
    @patch('channels.layers.get_channel_layer')
    @patch('portfolio.ai_service.generate_whale_text')
    def test_task_sets_severity_based_on_value_threshold_ratio(
        self,
        mock_generate_text,
        mock_get_channel_layer,
        mock_async_to_sync,
    ):
        symbol = 'URGENT1'
        staff_user = self._create_user_config('staff-severity', api_key='sk-test-sev')
        cache.delete(f'whale_advisory_lock:{symbol}')

        mock_generate_text.side_effect = [
            {
                'text': 'Summary',
                'prompt_tokens': 10,
                'completion_tokens': 20,
            },
            {
                'text': 'Detail',
                'prompt_tokens': 30,
                'completion_tokens': 40,
            },
        ]
        mock_async_to_sync.return_value = MagicMock()
        mock_get_channel_layer.return_value = MagicMock()

        result = generate_whale_advisory_task(
            symbol=symbol,
            matched_value_vnd=30_000_000_000,
            side='BUY',
            threshold=5_000_000_000,
            force_refresh=False,
            user_id=staff_user.id,
        )

        self.assertEqual(result['status'], 'ok')
        advisory = WhaleAdvisory.objects.get(id=result['advisory_id'])
        self.assertEqual(advisory.severity, WhaleAdvisory.SeverityChoices.URGENT)

    @patch('portfolio.tasks.generate_whale_advisory_task.apply_async')
    def test_detect_whale_reversal_queues_reversal_advisory(self, mock_apply_async):
        staff_user = self._create_user_config('staff-reversal', api_key='sk-test-reversal')
        TrackedSymbol.objects.create(user=staff_user, symbol='REV1')
        cache.delete('reversal_alert_lock:REV1')

        now = timezone.localtime()
        today = timezone.localdate()
        base_time = (now - timedelta(minutes=5)).time()

        # 3 lệnh BUY liên tiếp
        IntradayTick.objects.create(symbol='REV1', trade_date=today, trade_time=base_time, price=10000, volume=100000, side='BUY')
        IntradayTick.objects.create(symbol='REV1', trade_date=today, trade_time=(now - timedelta(minutes=4)).time(), price=10010, volume=90000, side='BUY')
        IntradayTick.objects.create(symbol='REV1', trade_date=today, trade_time=(now - timedelta(minutes=3)).time(), price=10020, volume=95000, side='BUY')
        # 1 lệnh SELL lớn đảo chiều
        IntradayTick.objects.create(symbol='REV1', trade_date=today, trade_time=(now - timedelta(minutes=2)).time(), price=25000, volume=300000, side='SELL')

        result = detect_whale_reversal(symbol='REV1')

        self.assertEqual(result['status'], 'ok')
        self.assertGreaterEqual(result['processed'], 1)
        self.assertGreaterEqual(result['queued'], 1)
        kwargs = mock_apply_async.call_args.kwargs['kwargs']
        self.assertEqual(kwargs['symbol'], 'REV1')
        self.assertEqual(kwargs['advisory_type'], WhaleAdvisory.AdvisoryTypeChoices.REVERSAL)
        self.assertEqual(kwargs['severity_override'], WhaleAdvisory.SeverityChoices.URGENT)

    @patch('portfolio.tasks.generate_whale_advisory_task.apply_async')
    def test_detect_whale_reversal_skips_when_event_based_disabled(self, mock_apply_async):
        staff_user = self._create_user_config('staff-reversal-off', api_key='sk-test-reversal-off')
        config = UserConfig.objects.get(user=staff_user)
        config.advisory_whale_signal_enabled = False
        config.save(update_fields=['advisory_whale_signal_enabled'])
        TrackedSymbol.objects.create(user=staff_user, symbol='REV2')
        cache.delete('reversal_alert_lock:REV2')

        now = timezone.localtime()
        today = timezone.localdate()
        base_time = (now - timedelta(minutes=5)).time()

        IntradayTick.objects.create(symbol='REV2', trade_date=today, trade_time=base_time, price=10000, volume=100000, side='BUY')
        IntradayTick.objects.create(symbol='REV2', trade_date=today, trade_time=(now - timedelta(minutes=4)).time(), price=10010, volume=90000, side='BUY')
        IntradayTick.objects.create(symbol='REV2', trade_date=today, trade_time=(now - timedelta(minutes=3)).time(), price=10020, volume=95000, side='BUY')
        IntradayTick.objects.create(symbol='REV2', trade_date=today, trade_time=(now - timedelta(minutes=2)).time(), price=25000, volume=300000, side='SELL')

        result = detect_whale_reversal(symbol='REV2')

        self.assertEqual(result['status'], 'ok')
        self.assertGreaterEqual(result['processed'], 1)
        self.assertEqual(result['queued'], 0)
        mock_apply_async.assert_not_called()

    @patch('portfolio.tasks.generate_whale_advisory_task.apply_async')
    def test_flush_merged_event_passes_primary_and_sources(self, mock_apply_async):
        user = self._create_user_config('staff-merge-flush', api_key='sk-test-merge')
        cache_key = f'advisory:event-merge:{user.id}:FPT'
        cache.set(
            cache_key,
            {
                'user_id': user.id,
                'symbol': 'FPT',
                'threshold_vnd': 1_000_000_000,
                'matched_value_vnd': 2_000_000_000,
                'score_sum': 35.0,
                'sources': ['dark_flow', 'whale_alert'],
                'source_scores': {'dark_flow': 10.0, 'whale_alert': 25.0},
            },
            timeout=120,
        )
        mock_task = MagicMock()
        mock_task.id = 'merge-task-001'
        mock_apply_async.return_value = mock_task

        result = flush_merged_advisory_event(user_id=user.id, symbol='FPT')

        self.assertEqual(result['status'], 'queued')
        self.assertEqual(result['resolved_side'], 'BUY')
        self.assertEqual(result['primary_source'], 'whale_alert')
        self.assertEqual(result['threshold_source'], 'user_default')
        queued_kwargs = mock_apply_async.call_args.kwargs['kwargs']
        self.assertEqual(queued_kwargs['primary_source'], 'whale_alert')
        self.assertEqual(sorted(queued_kwargs['merged_sources']), ['dark_flow', 'whale_alert'])
        self.assertEqual(queued_kwargs['threshold_source'], 'user_default')

    @patch('asgiref.sync.async_to_sync')
    @patch('channels.layers.get_channel_layer')
    @patch('portfolio.ai_service.generate_whale_text')
    def test_generate_task_persists_merge_metadata(
        self,
        mock_generate_text,
        mock_get_channel_layer,
        mock_async_to_sync,
    ):
        symbol = 'MERGE1'
        staff_user = self._create_user_config('staff-merge-store', api_key='sk-test-merge-store')
        cache.delete(f'whale_advisory_lock:{symbol}')
        mock_generate_text.side_effect = [
            {'text': 'Summary merge', 'prompt_tokens': 10, 'completion_tokens': 20},
            {'text': 'Detail merge', 'prompt_tokens': 30, 'completion_tokens': 40},
        ]
        mock_async_to_sync.return_value = MagicMock()
        mock_get_channel_layer.return_value = MagicMock()

        result = generate_whale_advisory_task(
            symbol=symbol,
            matched_value_vnd=3_000_000_000,
            side='BUY',
            threshold=1_000_000_000,
            threshold_source='symbol_override',
            force_refresh=True,
            user_id=staff_user.id,
            merged_sources=['dark_flow', 'whale_alert'],
            primary_source='whale_alert',
        )

        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['threshold_source'], 'symbol_override')
        self.assertEqual(sorted(result['merged_sources']), ['dark_flow', 'whale_alert'])
        self.assertEqual(result['primary_source'], 'whale_alert')
        advisory = WhaleAdvisory.objects.get(id=result['advisory_id'])
        self.assertEqual(sorted(advisory.merged_sources), ['dark_flow', 'whale_alert'])
        self.assertEqual(advisory.primary_source, 'whale_alert')

    @patch('portfolio.tasks.flush_merged_advisory_event.apply_async')
    @override_settings(ADVISORY_EVENT_MERGE_WINDOW_SECONDS=180)
    def test_merge_window_180s_schedules_single_flush_for_whale_and_dark_flow(self, mock_flush_apply_async):
        user = self._create_user_config('staff-merge-180s', api_key='sk-test-merge-180s')
        cache_key = f'advisory:event-merge:{user.id}:FPT'
        cache.delete(cache_key)

        first = _accumulate_user_advisory_event(
            user_id=user.id,
            symbol='FPT',
            source='whale_alert',
            payload={'event_score': 35, 'side': 'buy', 'matched_value': 3_000_000_000},
            threshold_vnd=1_000_000_000,
        )
        second = _accumulate_user_advisory_event(
            user_id=user.id,
            symbol='FPT',
            source='dark_flow',
            payload={'strength': 60, 'signal_type': 'distribution', 'cvd_change': -12, 'matched_value_vnd': 2_500_000_000},
            threshold_vnd=1_000_000_000,
        )

        self.assertEqual(first['status'], 'scheduled')
        self.assertEqual(second['status'], 'merged')
        self.assertEqual(mock_flush_apply_async.call_count, 1)

        merged_state = cache.get(cache_key)
        self.assertIsNotNone(merged_state)
        self.assertEqual(sorted(merged_state.get('sources') or []), ['dark_flow', 'whale_alert'])
        self.assertIn('source_scores', merged_state)

        snapshot = get_market_observability_snapshot()
        self.assertEqual(snapshot['advisory_event_merge']['scheduled'], 1)
        self.assertEqual(snapshot['advisory_event_merge']['merged'], 1)