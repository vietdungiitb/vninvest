from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from market_data.global_symbol_registry import sync_admin_group_symbol_set, sync_system_default_symbol_group, upsert_global_symbol_demand
from market_data.models import GlobalSymbolDemandSource, GlobalSymbolRegistry
from user_workspace.models import Portfolio, Transaction, Watchlist, WatchlistItem

User = get_user_model()


class GlobalSymbolRegistrySignalTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='registry-signal-user',
            email='registry-signal-user@test.local',
            password='pass123',
        )

    def test_watchlist_item_signal_creates_and_decays_registry_edge(self):
        watchlist = Watchlist.objects.create(user=self.user, name='Danh mục công nghệ', description='')
        item = WatchlistItem.objects.create(watchlist=watchlist, symbol='fpt')

        registry = GlobalSymbolRegistry.objects.get(symbol='FPT')
        edge = GlobalSymbolDemandSource.objects.get(
            registry=registry,
            source_type=GlobalSymbolDemandSource.SourceTypeChoices.WATCHLIST,
            source_ref=f'watchlist:{watchlist.pk}',
        )
        self.assertTrue(edge.is_active)
        self.assertEqual(registry.current_priority_tier, GlobalSymbolRegistry.PriorityTierChoices.HOT)
        self.assertEqual(registry.demand_source_count, 1)

        item.delete()

        registry.refresh_from_db()
        edge.refresh_from_db()
        self.assertFalse(edge.is_active)
        self.assertTrue(registry.is_active)
        self.assertEqual(registry.current_priority_tier, GlobalSymbolRegistry.PriorityTierChoices.RECOVERY)
        self.assertEqual(registry.demand_source_count, 0)
        self.assertIsNotNone(registry.decay_after_at)

    def test_transaction_signals_sync_holdings_per_portfolio_symbol(self):
        portfolio = Portfolio.objects.create(user=self.user, name='Danh mục giữ dài hạn')
        Transaction.objects.create(
            portfolio=portfolio,
            symbol='hpg',
            transaction_type=Transaction.TransactionType.BUY,
            date=timezone.localdate(),
            price=Decimal('25500.00'),
            quantity=100,
            fee=Decimal('0'),
            tax=Decimal('0'),
        )

        registry = GlobalSymbolRegistry.objects.get(symbol='HPG')
        edge = GlobalSymbolDemandSource.objects.get(
            registry=registry,
            source_type=GlobalSymbolDemandSource.SourceTypeChoices.HOLDING,
            source_ref=f'portfolio:{portfolio.pk}',
        )
        self.assertTrue(edge.is_active)
        self.assertEqual(edge.metadata['net_quantity'], 100)

        Transaction.objects.create(
            portfolio=portfolio,
            symbol='HPG',
            transaction_type=Transaction.TransactionType.SELL,
            date=timezone.localdate(),
            price=Decimal('26000.00'),
            quantity=100,
            fee=Decimal('0'),
            tax=Decimal('0'),
        )

        registry.refresh_from_db()
        edge.refresh_from_db()
        self.assertFalse(edge.is_active)
        self.assertEqual(registry.current_priority_tier, GlobalSymbolRegistry.PriorityTierChoices.RECOVERY)
        self.assertEqual(registry.demand_source_count, 0)

    def test_admin_group_sync_deactivates_removed_symbols(self):
        sync_admin_group_symbol_set('Nhóm thử nghiệm', ['FPT', 'HPG'], group_type='SECTOR', description='Test group')

        fpt_registry = GlobalSymbolRegistry.objects.get(symbol='FPT')
        hpg_registry = GlobalSymbolRegistry.objects.get(symbol='HPG')
        fpt_edge = GlobalSymbolDemandSource.objects.get(
            registry=fpt_registry,
            source_type=GlobalSymbolDemandSource.SourceTypeChoices.ADMIN_GROUP,
            source_ref='admin_group:nhóm_thử_nghiệm',
        )
        hpg_edge = GlobalSymbolDemandSource.objects.get(
            registry=hpg_registry,
            source_type=GlobalSymbolDemandSource.SourceTypeChoices.ADMIN_GROUP,
            source_ref='admin_group:nhóm_thử_nghiệm',
        )
        self.assertTrue(fpt_edge.is_active)
        self.assertTrue(hpg_edge.is_active)

        sync_admin_group_symbol_set('Nhóm thử nghiệm', ['FPT'], group_type='SECTOR', description='Test group')

        fpt_registry.refresh_from_db()
        hpg_registry.refresh_from_db()
        fpt_edge.refresh_from_db()
        hpg_edge.refresh_from_db()
        self.assertTrue(fpt_edge.is_active)
        self.assertFalse(hpg_edge.is_active)
        self.assertEqual(hpg_registry.current_priority_tier, GlobalSymbolRegistry.PriorityTierChoices.RECOVERY)

    def test_system_default_sync_canonicalizes_vn100_and_deactivates_top100_alias(self):
        registry, _ = upsert_global_symbol_demand(
            symbol='FPT',
            source_type=GlobalSymbolDemandSource.SourceTypeChoices.SYSTEM_DEFAULT,
            source_ref='system_default:top100',
            metadata={'group_id': 'top100'},
        )
        legacy_edge = GlobalSymbolDemandSource.objects.get(
            registry=registry,
            source_type=GlobalSymbolDemandSource.SourceTypeChoices.SYSTEM_DEFAULT,
            source_ref='system_default:top100',
        )
        self.assertTrue(legacy_edge.is_active)

        sync_system_default_symbol_group('vn100', ['FPT'])

        registry.refresh_from_db()
        legacy_edge.refresh_from_db()
        canonical_edge = GlobalSymbolDemandSource.objects.get(
            registry=registry,
            source_type=GlobalSymbolDemandSource.SourceTypeChoices.SYSTEM_DEFAULT,
            source_ref='system_default:vn100',
        )
        self.assertFalse(legacy_edge.is_active)
        self.assertTrue(canonical_edge.is_active)
        self.assertEqual(canonical_edge.metadata['group_id'], 'vn100')