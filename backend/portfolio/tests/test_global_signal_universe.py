from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase

from portfolio.models import PriceAlertRule, SecuritiesGroup, SecuritiesItem, SystemSetting, TrackedSymbol, WatchlistGroup, WatchlistItem
from portfolio.services_global_signal_universe import GlobalSignalUniverseResolver


class GlobalSignalUniverseResolverTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username='signal-universe-user', password='Test@123456')

    def test_build_snapshot_returns_hybrid_effective_universe_contract(self):
        TrackedSymbol.objects.create(user=self.user, symbol='AAA')

        watchlist_group = WatchlistGroup.objects.create(user=self.user, name='Danh muc theo doi')
        WatchlistItem.objects.create(group=watchlist_group, symbol='BBB')

        PriceAlertRule.objects.create(
            user=self.user,
            symbol='CCC',
            condition=PriceAlertRule.Condition.ABOVE,
            target_price=100,
            is_active=True,
        )

        selected_group = SecuritiesGroup.objects.create(
            name='Admin Universe',
            group_type=SecuritiesGroup.GroupType.CUSTOM,
        )
        SecuritiesItem.objects.create(group=selected_group, symbol='FPT')

        snapshot = GlobalSignalUniverseResolver.build_snapshot(
            config={
                'selected_group_ids': [selected_group.id],
                'admin_symbols': ['SSI'],
            },
            topology={
                'universe_symbol_limit': 10,
                'hot_limit': 1,
                'warm_limit': 1,
                'hot_shards': 2,
                'warm_shards': 2,
                'cold_shards': 2,
            },
        )

        self.assertEqual(snapshot['counts']['tracked'], 1)
        self.assertEqual(snapshot['counts']['watchlist'], 1)
        self.assertEqual(snapshot['counts']['alerts'], 1)
        self.assertEqual(snapshot['counts']['admin_curated'], 2)
        self.assertEqual(snapshot['counts']['effective'], 5)
        self.assertEqual(snapshot['sources']['admin_groups'], [selected_group.id])
        self.assertEqual(snapshot['sources']['admin_symbols'], ['SSI'])
        self.assertEqual(snapshot['source_counts']['intraday_universe_group_items'], 1)
        self.assertEqual(snapshot['source_counts']['admin_symbols'], 1)
        self.assertCountEqual(snapshot['effective_symbols'], ['AAA', 'BBB', 'CCC', 'FPT', 'SSI'])

    def test_from_prefetch_runtime_settings_keeps_selected_group_symbols_warm(self):
        selected_group = SecuritiesGroup.objects.create(
            name='Selected Intraday Universe',
            group_type=SecuritiesGroup.GroupType.MARKET_CAP,
        )
        SecuritiesItem.objects.create(group=selected_group, symbol='VCB')

        snapshot = GlobalSignalUniverseResolver.build_snapshot(
            config=GlobalSignalUniverseResolver.from_prefetch_runtime_settings(
                {
                    'include_group_symbols': False,
                    'intraday_universe_group_ids': [selected_group.id],
                    'intraday_universe_force_warm_tier': True,
                }
            ),
            topology={
                'universe_symbol_limit': 10,
                'hot_limit': 0,
                'warm_limit': 0,
                'hot_shards': 2,
                'warm_shards': 2,
                'cold_shards': 2,
            },
        )

        self.assertEqual(snapshot['counts']['admin_curated'], 1)
        self.assertEqual(snapshot['counts']['effective'], 1)
        self.assertEqual(snapshot['source_counts']['intraday_universe_group_ids'], 1)
        self.assertEqual(snapshot['source_counts']['intraday_universe_group_items'], 1)
        self.assertEqual(snapshot['rows'][0]['symbol'], 'VCB')
        self.assertEqual(snapshot['rows'][0]['tier'], 'warm')
        self.assertTrue(snapshot['rows'][0]['is_intraday_universe_symbol'])

    def test_build_snapshot_loads_system_setting_policy_with_safe_fallback(self):
        group = WatchlistGroup.objects.create(user=self.user, name='Watchlist bi tat bang policy')
        WatchlistItem.objects.create(group=group, symbol='BBB')

        SystemSetting.objects.update_or_create(
            key=GlobalSignalUniverseResolver.SYSTEM_POLICY_KEY,
            defaults={'value': '{"include_watchlist_symbols": false, "admin_symbols": ["HPG"]}'},
        )
        cache.clear()

        snapshot = GlobalSignalUniverseResolver.build_snapshot(topology={'universe_symbol_limit': 10})

        self.assertEqual(snapshot['counts']['watchlist'], 0)
        self.assertEqual(snapshot['counts']['admin_curated'], 1)
        self.assertEqual(snapshot['effective_symbols'], ['HPG'])