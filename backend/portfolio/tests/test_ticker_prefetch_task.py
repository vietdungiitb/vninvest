import pandas as pd
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase, SimpleTestCase
from django.utils import timezone
from unittest.mock import patch

from portfolio.models import TrackedSymbol
from portfolio.tasks import (
    prefetch_ticker_price_board,
    _resolve_prefetch_time_profile,
    _resolve_effective_prefetch_settings,
    _prefetch_retry_countdown_with_policy,
    _increment_prefetch_metric,
)


class PrefetchTickerPriceBoardNormalizationTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username='prefetch-user', password='Test@123456')
        TrackedSymbol.objects.create(user=self.user, symbol='FPT')

    @patch('portfolio.tasks.fetch_price_board_dataframe')
    def test_prefetch_normalizes_vci_prices_to_vnd_before_caching(self, mock_fetch_price_board_dataframe):
        columns = pd.MultiIndex.from_tuples([
            ('listing', 'symbol'),
            ('listing', 'ref_price'),
            ('match', 'match_price'),
            ('match', 'highest'),
            ('match', 'lowest'),
            ('match', 'open_price'),
            ('match', 'accumulated_volume'),
        ])
        mock_fetch_price_board_dataframe.return_value = pd.DataFrame([
            ['FPT', 78.0, 79.0, 79.5, 77.5, 78.1, 123456],
        ], columns=columns)

        result = prefetch_ticker_price_board.run()

        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['cached'], 1)

        cached_ticker = cache.get('ticker:FPT')
        self.assertIsNotNone(cached_ticker)
        self.assertEqual(cached_ticker['current_price'], 79.0)
        self.assertEqual(cached_ticker['prev_price'], 78.0)
        self.assertEqual(cached_ticker['high_price'], 79.5)
        self.assertEqual(cached_ticker['low_price'], 77.5)
        self.assertEqual(cached_ticker['open_price'], 78.1)

    @patch('portfolio.tasks.fetch_price_board_dataframe')
    def test_prefetch_parses_flat_schema_payload(self, mock_fetch_price_board_dataframe):
        mock_fetch_price_board_dataframe.return_value = pd.DataFrame([
            {
                'symbol': 'FPT',
                'ref_price': 118.0,
                'match_price': 119.2,
                'highest': 120.0,
                'lowest': 117.3,
                'open_price': 118.4,
                'accumulated_volume': 987654,
            }
        ])

        result = prefetch_ticker_price_board.run()

        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['cached'], 1)
        cached_ticker = cache.get('ticker:FPT')
        self.assertIsNotNone(cached_ticker)
        self.assertEqual(cached_ticker['current_price'], 119.2)
        self.assertEqual(cached_ticker['prev_price'], 118.0)

    @patch('portfolio.tasks.fetch_price_board_dataframe')
    def test_prefetch_marks_parse_zero_cached_when_symbols_exist(self, mock_fetch_price_board_dataframe):
        mock_fetch_price_board_dataframe.return_value = pd.DataFrame([
            {
                'foo': 'bar',
                'unknown_price': 123.0,
            }
        ])

        result = prefetch_ticker_price_board.run()

        self.assertEqual(result['symbols'], 1)
        self.assertEqual(result['cached'], 0)
        self.assertEqual(result['status'], 'parse_zero_cached')
        self.assertEqual(result['reason'], 'no_rows_parsed_from_provider_payload')


class PrefetchTimePolicyResolverTests(SimpleTestCase):
    def test_resolve_profile_pre_open(self):
        now_dt = timezone.datetime(2026, 4, 13, 1, 35, tzinfo=timezone.utc)
        policy = {
            'timezone': 'Asia/Ho_Chi_Minh',
            'market': {
                'open_time': '09:00',
                'close_time': '15:00',
                'pre_open_minutes': 30,
                'post_close_minutes': 30,
                'lunch_break': {'enabled': True, 'start': '11:30', 'end': '13:00'},
                'weekend_mode': 'offhours',
            },
        }

        profile, reason = _resolve_prefetch_time_profile(now_dt=now_dt, policy=policy)
        self.assertEqual(profile, 'pre_open')
        self.assertIn('pre_open', reason)

    def test_resolve_profile_weekend_offhours(self):
        now_dt = timezone.datetime(2026, 4, 12, 3, 0, tzinfo=timezone.utc)
        profile, _ = _resolve_prefetch_time_profile(now_dt=now_dt, policy={'timezone': 'Asia/Ho_Chi_Minh'})
        self.assertEqual(profile, 'offhours')

    def test_effective_settings_follow_active_profile(self):
        runtime = {
            'batch_size': 60,
            'symbol_limit': 240,
            'max_retries': 6,
            'retry_base_seconds': 8,
            'retry_max_seconds': 120,
            'rate_limit_cooldown_seconds': 20,
            'circuit_window_seconds': 300,
            'circuit_breaker_timeout_threshold': 3,
            'circuit_breaker_cooldown_seconds': 1800,
            'include_group_symbols': False,
        }
        policy = {
            'timezone': 'Asia/Ho_Chi_Minh',
            'market': {
                'open_time': '09:00',
                'close_time': '15:00',
                'pre_open_minutes': 30,
                'post_close_minutes': 30,
                'lunch_break': {'enabled': True, 'start': '11:30', 'end': '13:00'},
                'weekend_mode': 'offhours',
            },
            'profiles': {
                'market_open': {
                    'query_enabled': True,
                    'interval_seconds': 45,
                    'batch_size': 18,
                    'symbol_limit': 42,
                    'max_retries': 4,
                },
            },
        }
        now_dt = timezone.datetime(2026, 4, 13, 3, 0, tzinfo=timezone.utc)

        effective, meta = _resolve_effective_prefetch_settings(runtime_settings=runtime, policy=policy, now_dt=now_dt)

        self.assertEqual(meta['profile'], 'market_open')
        self.assertTrue(meta['query_enabled'])
        self.assertEqual(meta['effective_interval_seconds'], 45)
        self.assertEqual(effective['batch_size'], 18)
        self.assertEqual(effective['symbol_limit'], 42)
        self.assertEqual(effective['max_retries'], 4)


class PrefetchPolicyGuardAndMetricTests(SimpleTestCase):
    def setUp(self):
        cache.clear()

    def test_prefetch_retry_countdown_with_policy_applies_multiplier_and_clamp(self):
        runtime_settings = {
            'retry_base_seconds': 10,
            'retry_max_seconds': 120,
        }
        policy_guard = {
            'cooldown_multiplier_on_429': 3,
            'max_interval_seconds': 180,
        }

        countdown, multiplier = _prefetch_retry_countdown_with_policy(
            retries=2,
            runtime_settings=runtime_settings,
            policy_guard=policy_guard,
        )

        self.assertEqual(multiplier, 3.0)
        self.assertEqual(countdown, 120)

    def test_increment_prefetch_metric_increments_counter(self):
        value1 = _increment_prefetch_metric('profile_hits_total', suffix='market_open')
        value2 = _increment_prefetch_metric('profile_hits_total', suffix='market_open')

        self.assertEqual(value1, 1)
        self.assertEqual(value2, 2)
