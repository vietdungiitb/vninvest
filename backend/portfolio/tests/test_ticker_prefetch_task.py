from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase, SimpleTestCase
from django.utils import timezone
from unittest.mock import patch

from portfolio.models import TrackedSymbol, WatchlistGroup, WatchlistItem, PriceAlertRule, SecuritiesGroup, SecuritiesItem
from portfolio.tasks import (
    _resolve_prefetch_time_profile,
    _resolve_effective_prefetch_settings,
    _prefetch_retry_countdown_with_policy,
    _increment_prefetch_metric,
    _collect_realtime_symbol_universe,
    _resolve_scheduler_plan,
    schedule_realtime_prefetch_shards,
)
from portfolio.tasks_prefetch import (
    _cleanup_session_close_retention,
    _resolve_session_close_date,
)
from portfolio.models import TickerSessionClose


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

    def test_resolve_profile_holiday_offhours(self):
        now_dt = timezone.datetime(2026, 4, 14, 3, 0, tzinfo=timezone.utc)
        profile, reason = _resolve_prefetch_time_profile(
            now_dt=now_dt,
            policy={
                'timezone': 'Asia/Ho_Chi_Minh',
                'market': {
                    'holiday_dates': ['2026-04-14'],
                },
            },
        )
        self.assertEqual(profile, 'offhours')
        self.assertIn('holiday', reason)

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


class SessionCloseCalendarTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_resolve_session_close_date_rolls_back_holiday_and_weekend(self):
        now_dt = timezone.datetime(2026, 4, 13, 17, 15, tzinfo=timezone.utc)
        session_date = _resolve_session_close_date(
            'pre_open',
            now_dt=now_dt,
            policy={
                'timezone': 'Asia/Ho_Chi_Minh',
                'market': {
                    'holiday_dates': ['2026-04-13'],
                },
            },
        )

        self.assertEqual(session_date.isoformat(), '2026-04-10')

    def test_cleanup_retention_uses_market_local_date(self):
        TickerSessionClose.objects.create(
            symbol='FPT',
            market_code='VN_STOCK',
            timezone_name='Asia/Ho_Chi_Minh',
            session_date=timezone.datetime(2026, 4, 8).date(),
            close_price=100,
            captured_at=timezone.now(),
        )
        TickerSessionClose.objects.create(
            symbol='HPG',
            market_code='VN_STOCK',
            timezone_name='Asia/Ho_Chi_Minh',
            session_date=timezone.datetime(2026, 4, 9).date(),
            close_price=50,
            captured_at=timezone.now(),
        )

        _cleanup_session_close_retention(
            runtime_settings={'session_close_retention_days': 7},
            policy={'timezone': 'Asia/Ho_Chi_Minh'},
            now_dt=timezone.datetime(2026, 4, 15, 17, 30, tzinfo=timezone.utc),
        )

        self.assertFalse(TickerSessionClose.objects.filter(symbol='FPT').exists())
        self.assertTrue(TickerSessionClose.objects.filter(symbol='HPG').exists())


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


class RealtimeUniverseAndShardSchedulerTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username='universe-user', password='Test@123456')

    def test_collect_realtime_symbol_universe_assigns_tier_and_stable_shard(self):
        TrackedSymbol.objects.create(user=self.user, symbol='AAA')
        TrackedSymbol.objects.create(user=self.user, symbol='BBB')
        TrackedSymbol.objects.create(user=self.user, symbol='CCC')

        group = WatchlistGroup.objects.create(user=self.user, name='Theo doi chinh')
        WatchlistItem.objects.create(group=group, symbol='AAA')
        PriceAlertRule.objects.create(
            user=self.user,
            symbol='AAA',
            condition=PriceAlertRule.Condition.ABOVE,
            target_price=100,
            is_active=True,
        )

        topology = {
            'universe_symbol_limit': 10,
            'hot_limit': 1,
            'warm_limit': 1,
            'hot_shards': 2,
            'warm_shards': 2,
            'cold_shards': 2,
        }
        runtime_settings = {'include_group_symbols': False}

        rows, source_counts = _collect_realtime_symbol_universe(topology=topology, runtime_settings=runtime_settings)

        self.assertEqual(source_counts['tracked_symbols'], 3)
        self.assertEqual(source_counts['watchlist_items'], 1)
        self.assertEqual(source_counts['price_alerts'], 1)
        self.assertEqual(rows[0]['symbol'], 'AAA')
        self.assertEqual(rows[0]['tier'], 'hot')
        self.assertEqual(rows[1]['tier'], 'warm')
        self.assertEqual(rows[2]['tier'], 'cold')
        self.assertIn(rows[0]['shard_id'], {0, 1})

    def test_collect_realtime_symbol_universe_includes_admin_selected_groups(self):
        selected_group = SecuritiesGroup.objects.create(
            name='VN100 Universe',
            group_type=SecuritiesGroup.GroupType.MARKET_CAP,
        )
        SecuritiesItem.objects.create(group=selected_group, symbol='FPT')
        SecuritiesItem.objects.create(group=selected_group, symbol='VCB')

        topology = {
            'universe_symbol_limit': 10,
            'hot_limit': 0,
            'warm_limit': 0,
            'hot_shards': 2,
            'warm_shards': 2,
            'cold_shards': 2,
        }
        runtime_settings = {
            'include_group_symbols': False,
            'intraday_universe_group_ids': [selected_group.id],
            'intraday_universe_force_warm_tier': True,
        }

        rows, source_counts = _collect_realtime_symbol_universe(topology=topology, runtime_settings=runtime_settings)

        symbols = {row['symbol']: row for row in rows}
        self.assertIn('FPT', symbols)
        self.assertIn('VCB', symbols)
        self.assertTrue(symbols['FPT']['is_intraday_universe_symbol'])
        self.assertEqual(symbols['FPT']['tier'], 'warm')
        self.assertEqual(source_counts['intraday_universe_group_ids'], 1)
        self.assertEqual(source_counts['intraday_universe_group_items'], 2)

    def test_resolve_scheduler_plan_degrades_cold_before_warm(self):
        snapshot = {
            'totals': {
                'hot': 200,
                'warm': 600,
                'cold': 1000,
            }
        }
        topology = {
            'hot_interval_seconds': 3,
            'warm_interval_seconds': 5,
            'cold_interval_seconds': 15,
            'batch_size_hot': 50,
            'batch_size_warm': 60,
            'batch_size_cold': 60,
            'hot_shards': 4,
            'warm_shards': 6,
            'cold_shards': 6,
            'enable_warm_tier': True,
            'enable_cold_tier': True,
            'upstream_soft_cap_per_minute': 10,
            'upstream_warning_cap_per_minute': 20,
            'upstream_hard_cap_per_minute': 30,
            'emergency_override_enabled': False,
            'emergency_interval_multiplier': 2.0,
            'emergency_disable_cold': True,
        }

        plan, budget = _resolve_scheduler_plan(snapshot=snapshot, topology=topology)

        self.assertFalse(plan['cold']['enabled'])
        self.assertGreaterEqual(plan['warm']['interval_seconds'], 5)
        self.assertIn('estimated_upstream_calls_per_minute', budget)

    def test_resolve_scheduler_plan_emergency_override_relaxes_cadence(self):
        snapshot = {
            'totals': {
                'hot': 200,
                'warm': 300,
                'cold': 400,
            }
        }
        topology = {
            'hot_interval_seconds': 3,
            'warm_interval_seconds': 5,
            'cold_interval_seconds': 15,
            'batch_size_hot': 50,
            'batch_size_warm': 60,
            'batch_size_cold': 60,
            'hot_shards': 4,
            'warm_shards': 6,
            'cold_shards': 6,
            'enable_warm_tier': True,
            'enable_cold_tier': True,
            'upstream_soft_cap_per_minute': 400,
            'upstream_warning_cap_per_minute': 500,
            'upstream_hard_cap_per_minute': 600,
            'emergency_override_enabled': True,
            'emergency_interval_multiplier': 3.0,
            'emergency_disable_cold': True,
        }

        plan, _ = _resolve_scheduler_plan(snapshot=snapshot, topology=topology)

        self.assertEqual(plan['hot']['interval_seconds'], 9)


class PrefetchSchedulerCanonicalConfigTests(SimpleTestCase):
    def test_celery_beat_uses_canonical_shard_scheduler_only(self):
        self.assertTrue(getattr(settings, 'TICKER_PREFETCH_SHARD_SCHEDULER_ENABLED', False))
        self.assertIn('build-realtime-symbol-universe-snapshot', settings.CELERY_BEAT_SCHEDULE)
        self.assertIn('schedule-realtime-prefetch-shards', settings.CELERY_BEAT_SCHEDULE)
        self.assertIn('cleanup-signal-service-runs', settings.CELERY_BEAT_SCHEDULE)
        self.assertNotIn('prefetch-ticker-price-board', settings.CELERY_BEAT_SCHEDULE)

    @patch('portfolio.tasks_prefetch.prefetch_realtime_ticker_shard.apply_async')
    @patch('portfolio.tasks_prefetch._resolve_prefetch_topology')
    def test_schedule_realtime_prefetch_shards_enqueues_due_shards(self, mock_topology, mock_apply_async):
        now_iso = timezone.now().isoformat()
        cache.set(
            'realtime:universe:snapshot',
            {
                'computed_at': now_iso,
                'totals': {'hot': 2, 'warm': 1, 'cold': 0},
            },
            timeout=120,
        )
        cache.set('realtime:shard:hot:0', ['AAA'], timeout=120)
        cache.set('realtime:shard:hot:1', ['BBB'], timeout=120)
        cache.set('realtime:shard:warm:0', ['CCC'], timeout=120)

        mock_topology.return_value = {
            'universe_refresh_seconds': 60,
            'hot_interval_seconds': 1,
            'warm_interval_seconds': 1,
            'cold_interval_seconds': 5,
            'hot_shards': 2,
            'warm_shards': 1,
            'cold_shards': 1,
            'batch_size_hot': 50,
            'batch_size_warm': 60,
            'batch_size_cold': 60,
            'enable_warm_tier': True,
            'enable_cold_tier': True,
            'upstream_soft_cap_per_minute': 400,
            'upstream_warning_cap_per_minute': 500,
            'upstream_hard_cap_per_minute': 600,
            'emergency_override_enabled': False,
            'emergency_interval_multiplier': 2.0,
            'emergency_disable_cold': True,
        }

        result = schedule_realtime_prefetch_shards.run()

        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['enqueued_total'], 3)
        self.assertEqual(mock_apply_async.call_count, 3)
