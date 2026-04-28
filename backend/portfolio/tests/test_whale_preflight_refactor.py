from datetime import date
from unittest.mock import patch

from django.test import SimpleTestCase

from portfolio.tasks_whale_preflight import (
    _build_whale_generation_context_dict,
    _prepare_whale_generation_context,
    _return_with_preflight_profile,
    _unwrap_or_return_skip,
)
from portfolio.tasks_whale_preflight_cache import (
    METRIC_COOLDOWN_HIT,
    METRIC_EXISTING_ADVISORY_HIT,
    WHALE_PREFLIGHT_KPI_SCHEMA_VERSION,
    WHALE_PREFLIGHT_METRIC_NAMES,
    _build_preflight_metric_rates,
    _build_preflight_metric_summary,
    _build_skip_response,
    _check_cooldown_skip,
    _check_preflight_cache_skips,
    _increment_preflight_counter,
    _metric_cache_key,
    _read_preflight_metrics,
    _read_preflight_metrics_window,
    _sum_preflight_metrics_window,
)


class WhalePreflightCacheRefactorTests(SimpleTestCase):
    def test_kpi_schema_version_is_stable_string(self):
        self.assertEqual(WHALE_PREFLIGHT_KPI_SCHEMA_VERSION, '2026-04-13.v1')

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

    @patch('portfolio.tasks_whale_preflight_cache._read_preflight_metrics')
    def test_read_preflight_metrics_window_builds_oldest_to_newest(self, mock_read):
        mock_read.side_effect = [
            {'existing_advisory_hit': 1},
            {'existing_advisory_hit': 2},
            {'existing_advisory_hit': 3},
        ]

        rows = _read_preflight_metrics_window(
            end_date=date(2026, 4, 13),
            window_days=3,
        )

        self.assertEqual([row['date'] for row in rows], ['2026-04-11', '2026-04-12', '2026-04-13'])
        self.assertEqual(rows[-1]['metrics']['existing_advisory_hit'], 3)

    def test_sum_preflight_metrics_window_aggregates_numeric_values(self):
        totals = _sum_preflight_metrics_window(
            window_rows=[
                {'date': '2026-04-12', 'metrics': {'existing_advisory_hit': 2, 'cooldown_hit': 4}},
                {'date': '2026-04-13', 'metrics': {'existing_advisory_hit': 3, 'cooldown_hit': 1}},
            ]
        )

        self.assertEqual(totals['existing_advisory_hit'], 5)
        self.assertEqual(totals['cooldown_hit'], 5)

    def test_build_preflight_metric_rates_returns_expected_percentages(self):
        rates = _build_preflight_metric_rates(
            totals={
                'existing_advisory_hit': 4,
                'existing_advisory_miss': 6,
                'cooldown_hit': 3,
                'cooldown_miss': 1,
                'cooldown_bypass_force_refresh': 1,
            }
        )

        self.assertEqual(rates['existing_advisory_hit_rate_pct'], 40.0)
        self.assertEqual(rates['cooldown_hit_rate_pct'], 75.0)
        self.assertEqual(rates['cooldown_bypass_rate_pct'], 20.0)

    def test_build_preflight_metric_summary_returns_dashboard_fields(self):
        summary = _build_preflight_metric_summary(
            totals={
                'existing_advisory_hit': 4,
                'existing_advisory_miss': 6,
                'cooldown_hit': 8,
                'cooldown_miss': 2,
                'cooldown_bypass_force_refresh': 1,
            },
            rates={
                'existing_advisory_hit_rate_pct': 40.0,
                'cooldown_hit_rate_pct': 80.0,
                'cooldown_bypass_rate_pct': 9.09,
            },
        )

        self.assertEqual(summary['top_signal_name'], 'cooldown_hit')
        self.assertEqual(summary['top_signal_count'], 8)
        self.assertEqual(summary['decision_volume_total'], 21)
        self.assertEqual(summary['existing_advisory_decisions_total'], 10)
        self.assertEqual(summary['cooldown_decisions_total'], 10)
        self.assertEqual(summary['force_refresh_bypass_total'], 1)

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
            cache_key='whale_advisory_lock:VCB',
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

    @patch('portfolio.tasks_whale_preflight._check_preflight_cache_skips', return_value=None)
    @patch('portfolio.tasks_whale_preflight._check_provider_rate_limit', return_value=None)
    @patch('portfolio.tasks_whale_preflight._extract_ai_config_values', return_value=('openai', 'gpt-4o-mini', 'masked'))
    @patch('portfolio.tasks_whale_preflight._check_ai_runtime_config', return_value=({'source': 'env'}, None))
    @patch('portfolio.tasks_whale_preflight._resolve_advisory_output_config', return_value={'output_language': 'vi', 'resolved_model': 'gpt-4o-mini', 'use_concise': True})
    @patch('portfolio.tasks_whale_preflight._check_user_cfg_guards', return_value=(None, 900))
    @patch('portfolio.tasks_whale_preflight.UserConfig.objects.filter')
    @patch('portfolio.tasks_whale_preflight.WhaleAdvisory.objects.filter')
    def test_prepare_whale_generation_context_uses_symbol_only_lock_key(
        self,
        mock_whale_filter,
        mock_user_filter,
        _mock_user_cfg_guards,
        _mock_resolve_output_config,
        _mock_ai_runtime_config,
        _mock_extract_ai_config,
        _mock_rate_limit,
        _mock_cache_skips,
    ):
        user_cfg = type('UserCfg', (), {'advisory_max_tokens_per_day': 1200, 'user': object()})()
        mock_user_filter.return_value.select_related.return_value.first.return_value = user_cfg
        mock_whale_filter.return_value.filter.return_value.order_by.return_value.first.return_value = None

        context = _prepare_whale_generation_context(
            symbol='VCB',
            user_id=7,
            source='PERIODIC_JOB',
            force_refresh=False,
        )

        self.assertEqual(context['cache_key'], 'whale_advisory_lock:VCB')
        self.assertIsNone(context['latest_existing_advisory'])
