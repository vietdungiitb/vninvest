from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase

from portfolio.global_signal_policy_helpers import (
    GLOBAL_SIGNAL_RETENTION_POLICY_KEY,
    GLOBAL_SIGNAL_SERVICES_CONFIG_KEY,
    GLOBAL_SIGNAL_UNIVERSE_POLICY_KEY,
    coerce_global_signal_services_config,
    default_global_signal_retention_policy,
    default_global_signal_services_config,
    default_global_signal_universe_policy,
    get_global_signal_retention_policy,
    get_global_signal_services_config,
    get_global_signal_universe_policy,
    invalidate_global_signal_universe_cache,
    set_global_signal_retention_policy,
    set_global_signal_services_config,
    set_global_signal_universe_policy,
)
from portfolio.models import (
    Portfolio,
    PriceAlertRule,
    SecuritiesGroup,
    SecuritiesItem,
    SubAccount,
    SystemSetting,
    TrackedSymbol,
    Transaction,
    WatchlistGroup,
    WatchlistItem,
)
from portfolio.system_settings import ensure_defaults
from portfolio.tasks_prefetch import (
    REALTIME_SHARD_CACHE_PREFIX,
    REALTIME_SHARD_LAST_ENQUEUE_PREFIX,
    REALTIME_UNIVERSE_SNAPSHOT_CACHE_KEY,
    REALTIME_UNIVERSE_TIER_CACHE_PREFIX,
)


class GlobalSignalPolicyHelpersTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = get_user_model().objects.create_user(username='signal-policy-user', password='secret123')

    def _seed_realtime_universe_cache(self):
        cache.set(
            REALTIME_UNIVERSE_SNAPSHOT_CACHE_KEY,
            {
                'topology': {
                    'hot_shards': 2,
                    'warm_shards': 1,
                    'cold_shards': 1,
                }
            },
            timeout=300,
        )
        cache.set(f'{REALTIME_UNIVERSE_TIER_CACHE_PREFIX}:hot', ['AAA'], timeout=300)
        cache.set(f'{REALTIME_UNIVERSE_TIER_CACHE_PREFIX}:warm', ['BBB'], timeout=300)
        cache.set(f'{REALTIME_UNIVERSE_TIER_CACHE_PREFIX}:cold', ['CCC'], timeout=300)
        cache.set(f'{REALTIME_SHARD_CACHE_PREFIX}:hot:0', ['AAA'], timeout=300)
        cache.set(f'{REALTIME_SHARD_CACHE_PREFIX}:hot:1', ['BBB'], timeout=300)
        cache.set(f'{REALTIME_SHARD_CACHE_PREFIX}:warm:0', ['CCC'], timeout=300)
        cache.set(f'{REALTIME_SHARD_CACHE_PREFIX}:cold:0', ['DDD'], timeout=300)
        cache.set(f'{REALTIME_SHARD_LAST_ENQUEUE_PREFIX}:hot:0', 123, timeout=300)
        cache.set(f'{REALTIME_SHARD_LAST_ENQUEUE_PREFIX}:hot:1', 456, timeout=300)
        cache.set(f'{REALTIME_SHARD_LAST_ENQUEUE_PREFIX}:warm:0', 789, timeout=300)
        cache.set(f'{REALTIME_SHARD_LAST_ENQUEUE_PREFIX}:cold:0', 999, timeout=300)

    def _build_transaction_dependencies(self):
        portfolio = Portfolio.objects.create(user=self.user, name='Danh mục test')
        sub_account = SubAccount.objects.create(
            portfolio=portfolio,
            type=SubAccount.TypeChoices.CASH,
            name='TK1',
        )
        return portfolio, sub_account

    def test_ensure_defaults_seeds_global_signal_system_settings(self):
        SystemSetting.objects.filter(
            key__in=[
                GLOBAL_SIGNAL_SERVICES_CONFIG_KEY,
                GLOBAL_SIGNAL_UNIVERSE_POLICY_KEY,
                GLOBAL_SIGNAL_RETENTION_POLICY_KEY,
            ]
        ).delete()

        ensure_defaults()

        self.assertTrue(SystemSetting.objects.filter(key=GLOBAL_SIGNAL_SERVICES_CONFIG_KEY).exists())
        self.assertTrue(SystemSetting.objects.filter(key=GLOBAL_SIGNAL_UNIVERSE_POLICY_KEY).exists())
        self.assertTrue(SystemSetting.objects.filter(key=GLOBAL_SIGNAL_RETENTION_POLICY_KEY).exists())

    def test_set_and_get_global_signal_services_config_normalizes_payload(self):
        normalized = set_global_signal_services_config(
            {
                'enabled': 'true',
                'whale_service': {
                    'default_threshold_vnd': '900000000',
                    'market_top_tier_multiplier': 7,
                    'cooldown_seconds': 180,
                    'manual_run_limit': 20,
                },
                'dark_flow_service': {
                    'window_seconds': 600,
                    'warning_strength': 35,
                    'urgent_strength': 80,
                    'cooldown_seconds': 400,
                },
                'distribution': {
                    'websocket_enabled': False,
                    'history_enabled': True,
                    'fanout_batch_size': '55',
                },
            }
        )

        self.assertEqual(normalized['whale_service']['default_threshold_vnd'], 900000000)
        self.assertEqual(normalized['distribution']['fanout_batch_size'], 55)

        persisted = get_global_signal_services_config()
        self.assertEqual(persisted, normalized)

    def test_coerce_global_signal_services_config_rejects_invalid_strength_order(self):
        with self.assertRaises(ValueError):
            coerce_global_signal_services_config(
                {
                    'dark_flow_service': {
                        'warning_strength': 80,
                        'urgent_strength': 60,
                    }
                }
            )

    def test_get_global_signal_universe_policy_falls_back_from_invalid_setting(self):
        SystemSetting.objects.update_or_create(
            key=GLOBAL_SIGNAL_UNIVERSE_POLICY_KEY,
            defaults={'value': '{invalid json'},
        )
        cache.clear()

        self.assertEqual(get_global_signal_universe_policy(), default_global_signal_universe_policy())

    def test_set_global_signal_universe_policy_normalizes_symbols_and_group_ids(self):
        normalized = set_global_signal_universe_policy(
            {
                'include_group_symbols': True,
                'selected_group_ids': ['1', 2, 2],
                'admin_symbols': [' hpg ', 'FPT', 'HPG'],
                'force_selected_groups_to_warm_tier': False,
            }
        )

        self.assertEqual(normalized['selected_group_ids'], [1, 2])
        self.assertEqual(normalized['admin_symbols'], ['HPG', 'FPT'])
        self.assertFalse(normalized['force_selected_groups_to_warm_tier'])
        self.assertEqual(get_global_signal_universe_policy(), normalized)

    def test_set_global_signal_universe_policy_invalidates_realtime_universe_cache_keys(self):
        self._seed_realtime_universe_cache()

        set_global_signal_universe_policy({'admin_symbols': ['FPT']})

        self.assertIsNone(cache.get(REALTIME_UNIVERSE_SNAPSHOT_CACHE_KEY))
        self.assertIsNone(cache.get(f'{REALTIME_UNIVERSE_TIER_CACHE_PREFIX}:hot'))
        self.assertIsNone(cache.get(f'{REALTIME_SHARD_CACHE_PREFIX}:hot:0'))
        self.assertIsNone(cache.get(f'{REALTIME_SHARD_LAST_ENQUEUE_PREFIX}:hot:0'))

    def test_invalidate_global_signal_universe_cache_returns_deleted_key_matrix(self):
        self._seed_realtime_universe_cache()

        deleted_keys = invalidate_global_signal_universe_cache()

        self.assertIn(REALTIME_UNIVERSE_SNAPSHOT_CACHE_KEY, deleted_keys)
        self.assertIn(f'{REALTIME_UNIVERSE_TIER_CACHE_PREFIX}:warm', deleted_keys)
        self.assertIn(f'{REALTIME_SHARD_CACHE_PREFIX}:cold:0', deleted_keys)
        self.assertIn(f'{REALTIME_SHARD_LAST_ENQUEUE_PREFIX}:hot:1', deleted_keys)

    def test_set_global_signal_retention_policy_normalizes_and_persists(self):
        normalized = set_global_signal_retention_policy(
            {
                'raw_intraday_keep_days': '14',
                'whale_event_keep_days': 120,
                'dark_flow_keep_days': 150,
                'summary_cache_ttl_seconds': 1800,
                'require_preview_before_purge': False,
            }
        )

        self.assertNotIn('raw_intraday_keep_days', normalized)
        self.assertEqual(normalized['summary_cache_ttl_seconds'], 1800)
        self.assertFalse(normalized['require_preview_before_purge'])
        self.assertEqual(get_global_signal_retention_policy(), normalized)

    def test_get_global_signal_retention_policy_returns_defaults_when_setting_missing(self):
        SystemSetting.objects.filter(key=GLOBAL_SIGNAL_RETENTION_POLICY_KEY).delete()
        cache.clear()

        self.assertEqual(get_global_signal_retention_policy(), default_global_signal_retention_policy())

    def test_get_global_signal_services_config_returns_defaults_when_setting_missing(self):
        SystemSetting.objects.filter(key=GLOBAL_SIGNAL_SERVICES_CONFIG_KEY).delete()
        cache.clear()

        self.assertEqual(get_global_signal_services_config(), default_global_signal_services_config())

    def test_signal_sources_invalidate_global_signal_universe_on_save(self):
        watchlist_group = WatchlistGroup.objects.create(user=self.user, name='Danh sách 1')
        securities_group = SecuritiesGroup.objects.create(name='Nhóm test')
        _, sub_account = self._build_transaction_dependencies()

        with patch('portfolio.signals.invalidate_global_signal_universe_cache') as invalidate_mock:
            TrackedSymbol.objects.create(user=self.user, symbol='AAA')
            WatchlistItem.objects.create(group=watchlist_group, symbol='BBB')
            PriceAlertRule.objects.create(
                user=self.user,
                symbol='CCC',
                condition=PriceAlertRule.Condition.ABOVE,
                target_price=Decimal('10.50'),
            )
            SecuritiesItem.objects.create(group=securities_group, symbol='DDD')
            Transaction.objects.create(
                sub_account=sub_account,
                symbol='EEE',
                transaction_type=Transaction.TransactionType.BUY,
                date=date.today(),
                price=Decimal('25.00'),
                quantity=Decimal('100'),
            )

        self.assertEqual(invalidate_mock.call_count, 5)

    def test_signal_sources_invalidate_global_signal_universe_on_delete(self):
        watchlist_group = WatchlistGroup.objects.create(user=self.user, name='Danh sách 2')
        securities_group = SecuritiesGroup.objects.create(name='Nhóm test 2')
        _, sub_account = self._build_transaction_dependencies()

        tracked = TrackedSymbol.objects.create(user=self.user, symbol='FFF')
        watchlist_item = WatchlistItem.objects.create(group=watchlist_group, symbol='GGG')
        alert_rule = PriceAlertRule.objects.create(
            user=self.user,
            symbol='HHH',
            condition=PriceAlertRule.Condition.ABOVE,
            target_price=Decimal('11.00'),
        )
        securities_item = SecuritiesItem.objects.create(group=securities_group, symbol='III')
        transaction = Transaction.objects.create(
            sub_account=sub_account,
            symbol='JJJ',
            transaction_type=Transaction.TransactionType.BUY,
            date=date.today(),
            price=Decimal('15.00'),
            quantity=Decimal('50'),
        )

        with patch('portfolio.signals.invalidate_global_signal_universe_cache') as invalidate_mock:
            tracked.delete()
            watchlist_item.delete()
            alert_rule.delete()
            securities_item.delete()
            transaction.delete()

        self.assertEqual(invalidate_mock.call_count, 5)
