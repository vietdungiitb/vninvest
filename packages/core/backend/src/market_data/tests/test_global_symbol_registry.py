from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from market_data.global_symbol_registry import (
    deactivate_global_symbol_demand,
    sync_admin_group_symbol_set,
    sync_global_source_symbol_set,
    sync_system_default_symbol_group,
    upsert_global_symbol_demand,
)
from market_data.models import GlobalSymbolDemandSource, GlobalSymbolRegistry
from user_workspace.models import (
    Portfolio,
    PriceAlert,
    TrackedSymbol,
    Transaction,
    Watchlist,
    WatchlistItem,
)

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

    def test_tracked_symbol_signal_syncs_and_deactivates_demand_edge(self):
        tracked = TrackedSymbol.objects.create(
            user=self.user,
            symbol='SSI',
            is_active=True,
        )

        registry = GlobalSymbolRegistry.objects.get(symbol='SSI')
        edge = GlobalSymbolDemandSource.objects.get(
            registry=registry,
            source_type=GlobalSymbolDemandSource.SourceTypeChoices.TRACKED_SYMBOL,
            source_ref=f'tracked_symbol:{tracked.pk}',
        )
        self.assertTrue(edge.is_active)
        self.assertEqual(registry.current_priority_tier, GlobalSymbolRegistry.PriorityTierChoices.HOT)

        tracked.is_active = False
        tracked.save(update_fields=['is_active', 'updated_at'])

        registry.refresh_from_db()
        edge.refresh_from_db()
        self.assertFalse(edge.is_active)
        self.assertEqual(registry.current_priority_tier, GlobalSymbolRegistry.PriorityTierChoices.RECOVERY)

    def test_price_alert_signal_syncs_and_deactivates_demand_edge(self):
        alert = PriceAlert.objects.create(
            user=self.user,
            symbol='VCB',
            alert_type=PriceAlert.AlertType.ABOVE,
            price_threshold=Decimal('105000.00'),
            status=PriceAlert.AlertStatus.ACTIVE,
            is_enabled=True,
        )

        registry = GlobalSymbolRegistry.objects.get(symbol='VCB')
        edge = GlobalSymbolDemandSource.objects.get(
            registry=registry,
            source_type=GlobalSymbolDemandSource.SourceTypeChoices.ALERT,
            source_ref=f'price_alert:{alert.pk}',
        )
        self.assertTrue(edge.is_active)
        self.assertEqual(edge.metadata['alert_type'], PriceAlert.AlertType.ABOVE)

        alert.is_enabled = False
        alert.status = PriceAlert.AlertStatus.DISABLED
        alert.save(update_fields=['is_enabled', 'status', 'updated_at'])

        registry.refresh_from_db()
        edge.refresh_from_db()
        self.assertFalse(edge.is_active)
        self.assertEqual(registry.current_priority_tier, GlobalSymbolRegistry.PriorityTierChoices.RECOVERY)

    def test_upsert_rejects_invalid_source_type(self):
        with self.assertRaisesMessage(ValueError, 'Source type khong hop le'):
            upsert_global_symbol_demand(
                symbol='FPT',
                source_type='unsupported_source_type',
                source_ref='invalid:1',
            )

    def test_upsert_rejects_empty_source_ref(self):
        with self.assertRaisesMessage(ValueError, 'Source ref khong duoc de trong'):
            upsert_global_symbol_demand(
                symbol='FPT',
                source_type=GlobalSymbolDemandSource.SourceTypeChoices.WATCHLIST,
                source_ref='   ',
            )

    def test_sync_global_source_symbol_set_normalizes_and_validates_source_contract(self):
        sync_global_source_symbol_set(
            source_type=' WATCHLIST ',
            source_ref=' watchlist:123 ',
            symbols=['fpt'],
        )

        edge = GlobalSymbolDemandSource.objects.get(
            source_type=GlobalSymbolDemandSource.SourceTypeChoices.WATCHLIST,
            source_ref='watchlist:123',
            registry__symbol='FPT',
        )
        self.assertTrue(edge.is_active)

        with self.assertRaisesMessage(ValueError, 'Source type khong hop le'):
            sync_global_source_symbol_set(
                source_type='not_a_real_source',
                source_ref='watchlist:123',
                symbols=['FPT'],
            )

    def test_deactivate_rejects_invalid_source_contract(self):
        with self.assertRaisesMessage(ValueError, 'Source type khong hop le'):
            deactivate_global_symbol_demand(
                symbol='FPT',
                source_type='invalid',
                source_ref='watchlist:1',
            )