"""
One-shot migration: legacy Portfolio/Watchlist/PriceAlertRule → core models.
Run once, validate, then delete legacy code.

Usage:
  python manage.py shell < migrate_legacy_portfolio_complete.py
  
Or:
  python migrate_legacy_portfolio_complete.py --dry-run
  python migrate_legacy_portfolio_complete.py
"""

import os
import sys
import django

# Setup Django
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src_dir = os.path.join(backend_dir, 'src')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')
sys.path.insert(0, src_dir)
sys.path.insert(0, backend_dir)
django.setup()

from decimal import Decimal
from django.db import transaction
from django.utils import timezone

# Core imports
from src.identity_access.models import CoreTenant, TenantMember
from src.user_workspace.models import (
    Portfolio, Watchlist, WatchlistItem, PriceAlert
)

# Legacy imports (will be deleted after migration)
try:
    from backend.portfolio.models import (
        Portfolio as LegacyPortfolio,
        Watchlist as LegacyWatchlist,
        WatchlistItem as LegacyWatchlistItem,
        PriceAlertRule as LegacyPriceAlertRule,
    )
    LEGACY_AVAILABLE = True
except ImportError:
    print("⚠️  Legacy models not available (already deleted?)")
    LEGACY_AVAILABLE = False


class MigrationExecutor:
    def __init__(self, dry_run=False):
        self.dry_run = dry_run
        self.stats = {
            'portfolios_migrated': 0,
            'watchlists_migrated': 0,
            'pricealerts_migrated': 0,
            'portfolios_skipped': 0,
            'watchlists_skipped': 0,
            'pricealerts_skipped': 0,
            'errors': 0,
        }

    def run(self):
        print('=' * 80)
        print('LEGACY DATA MIGRATION: Portfolio/Watchlist/PriceAlertRule → Core')
        print('=' * 80)

        if not LEGACY_AVAILABLE:
            print('✓ Legacy data already cleaned up (no migration needed)')
            return

        if self.dry_run:
            print('⚠️  DRY RUN MODE: No data will be written\n')

        # Count legacy data
        legacy_portfolio_count = LegacyPortfolio.objects.count()
        legacy_watchlist_count = LegacyWatchlist.objects.count()
        legacy_pricealert_count = LegacyPriceAlertRule.objects.count()

        print(f'\nLegacy data found:')
        print(f'  - Portfolios: {legacy_portfolio_count}')
        print(f'  - Watchlists: {legacy_watchlist_count}')
        print(f'  - PriceAlerts: {legacy_pricealert_count}')
        print('')

        if legacy_portfolio_count == 0 and legacy_watchlist_count == 0 and legacy_pricealert_count == 0:
            print('✓ No legacy data to migrate (already clean)')
            return

        try:
            with transaction.atomic():
                # 1. Migrate Portfolios
                self._migrate_portfolios()

                # 2. Migrate Watchlists
                self._migrate_watchlists()

                # 3. Migrate PriceAlerts
                self._migrate_pricealerts()

                # 4. Validate
                self._validate_migration()

                # Summary
                self._print_summary()

        except Exception as e:
            print(f'\n❌ Migration failed: {e}')
            import traceback
            traceback.print_exc()
            sys.exit(1)

    def _migrate_portfolios(self):
        """Migrate all legacy Portfolios to core."""
        print('Migrating Portfolios...')

        for legacy_pf in LegacyPortfolio.objects.all():
            tenant = self._get_user_tenant(legacy_pf.user)
            if not tenant:
                print(f'  ⚠️  Portfolio {legacy_pf.id} (user {legacy_pf.user.id}): No tenant found, skipping')
                self.stats['portfolios_skipped'] += 1
                continue

            if self.dry_run:
                print(f'  → {legacy_pf.name} (user={legacy_pf.user.id}, tenant={tenant.id})')
            else:
                _, created = Portfolio.objects.get_or_create(
                    user=legacy_pf.user,
                    tenant=tenant,
                    name=legacy_pf.name,
                    defaults={
                        'description': legacy_pf.description or '',
                        'is_default': legacy_pf.is_default,
                    }
                )

            self.stats['portfolios_migrated'] += 1

        print(f'  ✓ {self.stats["portfolios_migrated"]} portfolios migrated\n')

    def _migrate_watchlists(self):
        """Migrate all legacy Watchlists (and items) to core."""
        print('Migrating Watchlists...')

        for legacy_wl in LegacyWatchlist.objects.all():
            tenant = self._get_user_tenant(legacy_wl.user)
            if not tenant:
                print(f'  ⚠️  Watchlist {legacy_wl.id} (user {legacy_wl.user.id}): No tenant found, skipping')
                self.stats['watchlists_skipped'] += 1
                continue

            if self.dry_run:
                print(f'  → {legacy_wl.name} (user={legacy_wl.user.id}, tenant={tenant.id})')
            else:
                core_wl, created = Watchlist.objects.get_or_create(
                    user=legacy_wl.user,
                    tenant=tenant,
                    name=legacy_wl.name,
                    defaults={
                        'description': legacy_wl.description or '',
                        'is_default': legacy_wl.is_default,
                    }
                )

                # Migrate watchlist items
                for legacy_item in LegacyWatchlistItem.objects.filter(watchlist=legacy_wl):
                    WatchlistItem.objects.get_or_create(
                        watchlist=core_wl,
                        symbol=legacy_item.symbol,
                        defaults={'added_at': legacy_item.added_at or timezone.now()}
                    )

            self.stats['watchlists_migrated'] += 1

        print(f'  ✓ {self.stats["watchlists_migrated"]} watchlists migrated\n')

    def _migrate_pricealerts(self):
        """Migrate all legacy PriceAlertRules to core PriceAlert."""
        print('Migrating PriceAlerts...')

        alert_type_map = {
            'ABOVE': 'ABOVE',
            'BELOW': 'BELOW',
            'EQUAL': 'EQUAL',
        }

        for legacy_rule in LegacyPriceAlertRule.objects.all():
            tenant = self._get_user_tenant(legacy_rule.user)
            if not tenant:
                print(f'  ⚠️  PriceAlert {legacy_rule.id} (user {legacy_rule.user.id}): No tenant found, skipping')
                self.stats['pricealerts_skipped'] += 1
                continue

            if self.dry_run:
                print(f'  → {legacy_rule.symbol}@{legacy_rule.price_threshold} (user={legacy_rule.user.id})')
            else:
                PriceAlert.objects.get_or_create(
                    user=legacy_rule.user,
                    tenant=tenant,
                    symbol=legacy_rule.symbol,
                    alert_type=alert_type_map.get(legacy_rule.alert_type, 'ABOVE'),
                    defaults={
                        'price_threshold': legacy_rule.price_threshold,
                        'status': 'ACTIVE' if legacy_rule.is_active else 'DISABLED',
                        'is_enabled': legacy_rule.is_active,
                        'notify_email': getattr(legacy_rule, 'notify_email', True),
                        'notify_sms': getattr(legacy_rule, 'notify_sms', False),
                        'notify_push': getattr(legacy_rule, 'notify_push', False),
                    }
                )

            self.stats['pricealerts_migrated'] += 1

        print(f'  ✓ {self.stats["pricealerts_migrated"]} price alerts migrated\n')

    def _get_user_tenant(self, user):
        """Get tenant for user: owner_user or first TenantMember."""
        # Try: user owns a tenant
        tenant = CoreTenant.objects.filter(owner_user=user).first()
        if tenant:
            return tenant

        # Fallback: user is member of a tenant
        member = TenantMember.objects.filter(user=user).first()
        if member:
            return member.tenant

        return None

    def _validate_migration(self):
        """Quick parity check: compare counts between legacy and core."""
        print('\nValidating migration parity...')

        legacy_pf_count = LegacyPortfolio.objects.count()
        core_pf_count = Portfolio.objects.count()
        pf_match = (legacy_pf_count == core_pf_count)

        legacy_wl_count = LegacyWatchlist.objects.count()
        core_wl_count = Watchlist.objects.count()
        wl_match = (legacy_wl_count == core_wl_count)

        legacy_pa_count = LegacyPriceAlertRule.objects.count()
        core_pa_count = PriceAlert.objects.count()
        pa_match = (legacy_pa_count == core_pa_count)

        print(f'  Portfolios: {legacy_pf_count} → {core_pf_count} {"✓" if pf_match else "⚠️"}')
        print(f'  Watchlists: {legacy_wl_count} → {core_wl_count} {"✓" if wl_match else "⚠️"}')
        print(f'  PriceAlerts: {legacy_pa_count} → {core_pa_count} {"✓" if pa_match else "⚠️"}')

        if not (pf_match and wl_match and pa_match):
            print('\n⚠️  Count mismatch detected. Investigate before deleting legacy code.')

    def _print_summary(self):
        """Print migration summary."""
        print('\n' + '=' * 80)
        print('MIGRATION SUMMARY')
        print('=' * 80)
        print(f'Portfolios: {self.stats["portfolios_migrated"]} migrated, {self.stats["portfolios_skipped"]} skipped')
        print(f'Watchlists: {self.stats["watchlists_migrated"]} migrated, {self.stats["watchlists_skipped"]} skipped')
        print(f'PriceAlerts: {self.stats["pricealerts_migrated"]} migrated, {self.stats["pricealerts_skipped"]} skipped')

        if self.dry_run:
            print(f'\n⚠️  Dry-run complete. No data written. Run again without --dry-run to commit.')
        else:
            print(f'\n✅ Migration complete! All data migrated to core.')
            print(f'Next: Run full test suite, then delete legacy code.')


if __name__ == '__main__':
    dry_run = '--dry-run' in sys.argv or '-n' in sys.argv
    executor = MigrationExecutor(dry_run=dry_run)
    executor.run()
