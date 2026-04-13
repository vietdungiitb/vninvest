from unittest.mock import patch

from django.test import SimpleTestCase

from portfolio.tasks_whale_preflight import (
    _build_whale_generation_context_dict,
    _return_with_preflight_profile,
    _unwrap_or_return_skip,
)
from portfolio.tasks_whale_preflight_cache import (
    METRIC_COOLDOWN_HIT,
    METRIC_EXISTING_ADVISORY_HIT,
    WHALE_PREFLIGHT_METRIC_NAMES,
    _build_skip_response,
    _check_cooldown_skip,
    _check_preflight_cache_skips,
    _increment_preflight_counter,
    _metric_cache_key,
    _read_preflight_metrics,
)


class WhalePreflightCacheRefactorTests(SimpleTestCase):
    def test_metric_cache_key_uses_prefix_and_day(self):
        key = _metric_cache_key(day_key='2026-04-13', metric=METRIC_EXISTING_ADVISORY_HIT)
        self.assertEqual(key, 'whale_preflight:metrics:2026-04-13:existing_advisory_hit')

    @patch('portfolio.tasks_whale_preflight_cache.cache.get')
    def test_read_preflight_metrics_returns_zero_on_cache_error(self, mock_cache_get):
        mock_cache_get.side_effect = RuntimeError('cache unavailable')

        metrics = _read_preflight_metrics(day_key='2026-04-13')

        self.assertEqual(set(metrics.keys()), set(WHALE_PREFLIGHT_METRIC_NAMES))
        self.assertTrue(all(v == 0 for v in metrics.values()))

    @patch('portfolio.tasks_whale_preflight_cache.logger.warning')
    @patch('portfolio.tasks_whale_preflight_cache.cache.incr')
    def test_increment_preflight_counter_ignores_unknown_metric(self, mock_incr, mock_warn):
        _increment_preflight_counter('unknown_metric')

        mock_incr.assert_not_called()
        self.assertTrue(mock_warn.called)

    def test_build_skip_response_returns_expected_shape(self):
        result = _build_skip_response(symbol='VCB', reason='cooldown')

        self.assertEqual(result['skip_response']['status'], 'skipped')
        self.assertEqual(result['skip_response']['symbol'], 'VCB')
        self.assertEqual(result['skip_response']['reason'], 'cooldown')

    def test_check_preflight_cache_skips_existing_advisory_first(self):
        skip = _check_preflight_cache_skips(
            force_refresh=False,
            latest_existing_advisory=object(),
            cache_key='whale_advisory_lock:1:VCB',
            symbol='VCB',
        )

        self.assertIsNotNone(skip)
        self.assertEqual(skip['skip_response']['reason'], 'existing_advisory')

    @patch('portfolio.tasks_whale_preflight_cache.cache.get', return_value=True)
    def test_check_preflight_cache_skips_cooldown(self, _mock_cache_get):
        skip = _check_preflight_cache_skips(
            force_refresh=False,
            latest_existing_advisory=None,
            cache_key='whale_advisory_lock:1:VCB',
            symbol='VCB',
        )

        self.assertIsNotNone(skip)
        self.assertEqual(skip['skip_response']['reason'], 'cooldown')

    @patch('portfolio.tasks_whale_preflight_cache._increment_preflight_counter')
    @patch('portfolio.tasks_whale_preflight_cache.cache.get', return_value=True)
    def test_check_cooldown_skip_records_hit_metric(self, _mock_cache_get, mock_counter):
        skip = _check_cooldown_skip(
            force_refresh=False,
            cache_key='whale_advisory_lock:1:VCB',
            symbol='VCB',
        )

        self.assertIsNotNone(skip)
        mock_counter.assert_called_with(METRIC_COOLDOWN_HIT)


class WhalePreflightContextAssemblyTests(SimpleTestCase):
    def test_unwrap_or_return_skip_for_skip_dict(self):
        skip_input = {'skip_response': {'status': 'skipped', 'symbol': 'VCB', 'reason': 'cooldown'}}

        skip, payload = _unwrap_or_return_skip(skip_input)

        self.assertEqual(skip, skip_input)
        self.assertIsNone(payload)

    def test_unwrap_or_return_skip_for_payload_tuple(self):
        payload_input = ({'ready': True, 'source': 'env'}, None)

        skip, payload = _unwrap_or_return_skip(payload_input)

        self.assertIsNone(skip)
        self.assertEqual(payload, payload_input)

    def test_build_whale_generation_context_dict_keeps_legacy_aliases(self):
        ctx = _build_whale_generation_context_dict(
            cooldown=900,
            cache_key='whale_advisory_lock:1:VCB',
            source_key='periodic_job',
            latest_existing_advisory=None,
            target_user=None,
            user_cfg=None,
            remaining_budget=1200,
            provider='openai',
            resolved_model='gpt-4o-mini',
            api_key='masked',
            ai_source='env',
            output_language='vi',
            total_budget=5000,
            use_concise=True,
        )

        self.assertEqual(ctx['provider'], 'openai')
        self.assertEqual(ctx['primary_provider'], 'openai')
        self.assertEqual(ctx['model'], 'gpt-4o-mini')
        self.assertEqual(ctx['primary_model'], 'gpt-4o-mini')
        self.assertTrue(ctx['use_concise'])

    @patch('portfolio.tasks_whale_preflight.logger.info')
    @patch('portfolio.tasks_whale_preflight.time.perf_counter', side_effect=[1.0, 1.01])
    def test_return_with_preflight_profile_logs_skip(self, _mock_perf, mock_log):
        result = _return_with_preflight_profile(
            symbol='VCB',
            user_id=1,
            started_at=1.0,
            result={'skip_response': {'status': 'skipped', 'symbol': 'VCB', 'reason': 'cooldown'}},
        )

        self.assertIn('skip_response', result)
        self.assertTrue(mock_log.called)
