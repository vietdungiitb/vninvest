"""
T10 Data Isolation Tests: Verify cross-tenant boundaries for Portfolio, Watchlist, PriceAlert.

ISOLATION RULES:
1. Queries scoped to tenant FK must not leak data across tenants
2. Cascade deletes on tenant deprovisioning must clean all associated assets
3. Bulk operations must filter by tenant to prevent data leakage
"""

from django.test import TestCase
from django.contrib.auth.models import User
from identity_access.models import CoreTenant, TenantMember
from user_workspace.models import Portfolio, Watchlist, WatchlistItem, PriceAlert


class PortfolioIsolationTest(TestCase):
    """Cross-tenant portfolio isolation."""

    def setUp(self):
        """Create 2 tenants with 2 users each."""
        self.user_a = User.objects.create_user(username='user_a', email='a@test.local', password='pass')
        self.user_b = User.objects.create_user(username='user_b', email='b@test.local', password='pass')
        self.user_c = User.objects.create_user(username='user_c', email='c@test.local', password='pass')
        self.user_d = User.objects.create_user(username='user_d', email='d@test.local', password='pass')

        # Tenant A: owned by user_a, member user_c
        self.tenant_a = CoreTenant.objects.create(
            owner_user=self.user_a,
            tenant_code='tenant_a',
            display_name='Tenant A',
            status='active',
            plan='pro',
        )
        TenantMember.objects.create(
            tenant=self.tenant_a,
            user=self.user_c,
            role='viewer',
            invited_by=self.user_a,
        )

        # Tenant B: owned by user_b, member user_d
        self.tenant_b = CoreTenant.objects.create(
            owner_user=self.user_b,
            tenant_code='tenant_b',
            display_name='Tenant B',
            status='active',
            plan='starter',
        )
        TenantMember.objects.create(
            tenant=self.tenant_b,
            user=self.user_d,
            role='editor',
            invited_by=self.user_b,
        )

    def test_portfolio_query_isolation_single_tenant(self):
        """User in Tenant A can only see Tenant A portfolios."""
        # Create portfolios in each tenant
        portfolio_a = Portfolio.objects.create(
            user=self.user_a,
            tenant=self.tenant_a,
            name='Portfolio A1',
        )
        portfolio_b = Portfolio.objects.create(
            user=self.user_b,
            tenant=self.tenant_b,
            name='Portfolio B1',
        )

        # Query as Tenant A: should only see tenant_a portfolios
        tenant_a_portfolios = Portfolio.objects.filter(tenant=self.tenant_a)
        self.assertEqual(tenant_a_portfolios.count(), 1)
        self.assertIn(portfolio_a, tenant_a_portfolios)
        self.assertNotIn(portfolio_b, tenant_a_portfolios)

    def test_portfolio_cascade_delete_on_tenant_deprovisioning(self):
        """Deleting tenant cascades to all its portfolios."""
        portfolio_a1 = Portfolio.objects.create(
            user=self.user_a,
            tenant=self.tenant_a,
            name='Portfolio A1',
        )
        portfolio_a2 = Portfolio.objects.create(
            user=self.user_c,
            tenant=self.tenant_a,
            name='Portfolio A2',
        )
        portfolio_b = Portfolio.objects.create(
            user=self.user_b,
            tenant=self.tenant_b,
            name='Portfolio B1',
        )

        # Delete tenant_a
        self.tenant_a.delete()

        # Verify cascading delete
        self.assertFalse(Portfolio.objects.filter(id=portfolio_a1.id).exists())
        self.assertFalse(Portfolio.objects.filter(id=portfolio_a2.id).exists())
        self.assertTrue(Portfolio.objects.filter(id=portfolio_b.id).exists())

    def test_portfolio_bulk_query_efficiency_with_tenant_scope(self):
        """Bulk Portfolio query with tenant filter should use index."""
        # Create 5 portfolios in tenant_a, 5 in tenant_b
        for i in range(5):
            Portfolio.objects.create(
                user=self.user_a,
                tenant=self.tenant_a,
                name=f'Portfolio A{i}',
            )
            Portfolio.objects.create(
                user=self.user_b,
                tenant=self.tenant_b,
                name=f'Portfolio B{i}',
            )

        # Query scoped to tenant_a should only hit 5 rows
        qs = Portfolio.objects.filter(tenant=self.tenant_a)
        self.assertEqual(qs.count(), 5)

        # Verify all belong to tenant_a
        for portfolio in qs:
            self.assertEqual(portfolio.tenant, self.tenant_a)


class WatchlistIsolationTest(TestCase):
    """Cross-tenant watchlist isolation."""

    def setUp(self):
        """Create 2 tenants."""
        self.user_a = User.objects.create_user(username='user_a')
        self.user_b = User.objects.create_user(username='user_b')

        self.tenant_a = CoreTenant.objects.create(
            owner_user=self.user_a,
            tenant_code='tenant_a',
            display_name='Tenant A',
            status='active',
            plan='pro',
        )
        self.tenant_b = CoreTenant.objects.create(
            owner_user=self.user_b,
            tenant_code='tenant_b',
            display_name='Tenant B',
            status='active',
            plan='starter',
        )

    def test_watchlist_cross_tenant_isolation(self):
        """User in Tenant A can only see Tenant A watchlists."""
        watchlist_a = Watchlist.objects.create(
            user=self.user_a,
            tenant=self.tenant_a,
            name='My Watchlist A',
        )
        watchlist_b = Watchlist.objects.create(
            user=self.user_b,
            tenant=self.tenant_b,
            name='My Watchlist B',
        )

        # Query as Tenant A
        tenant_a_watchlists = Watchlist.objects.filter(tenant=self.tenant_a)
        self.assertEqual(tenant_a_watchlists.count(), 1)
        self.assertIn(watchlist_a, tenant_a_watchlists)
        self.assertNotIn(watchlist_b, tenant_a_watchlists)

    def test_watchlist_item_cascade_delete_on_tenant_deprovisioning(self):
        """Deleting tenant cascades to watchlist and its items."""
        watchlist_a = Watchlist.objects.create(
            user=self.user_a,
            tenant=self.tenant_a,
            name='Watchlist A',
        )
        WatchlistItem.objects.create(watchlist=watchlist_a, symbol='VNM')
        WatchlistItem.objects.create(watchlist=watchlist_a, symbol='VIC')

        watchlist_b = Watchlist.objects.create(
            user=self.user_b,
            tenant=self.tenant_b,
            name='Watchlist B',
        )
        WatchlistItem.objects.create(watchlist=watchlist_b, symbol='FPT')

        # Delete tenant_a
        self.tenant_a.delete()

        # Verify cascading delete
        self.assertFalse(Watchlist.objects.filter(id=watchlist_a.id).exists())
        self.assertEqual(WatchlistItem.objects.filter(watchlist=watchlist_a).count(), 0)
        self.assertTrue(Watchlist.objects.filter(id=watchlist_b.id).exists())
        self.assertEqual(WatchlistItem.objects.filter(watchlist=watchlist_b).count(), 1)


class PriceAlertIsolationTest(TestCase):
    """Cross-tenant price alert isolation."""

    def setUp(self):
        """Create 2 tenants."""
        self.user_a = User.objects.create_user(username='user_a')
        self.user_b = User.objects.create_user(username='user_b')

        self.tenant_a = CoreTenant.objects.create(
            owner_user=self.user_a,
            tenant_code='tenant_a',
            display_name='Tenant A',
            status='active',
            plan='pro',
        )
        self.tenant_b = CoreTenant.objects.create(
            owner_user=self.user_b,
            tenant_code='tenant_b',
            display_name='Tenant B',
            status='active',
            plan='starter',
        )

    def test_pricealert_cross_tenant_isolation(self):
        """User in Tenant A can only see Tenant A price alerts."""
        alert_a = PriceAlert.objects.create(
            user=self.user_a,
            tenant=self.tenant_a,
            symbol='VNM',
            alert_type='ABOVE',
            price_threshold='150000.00',
        )
        alert_b = PriceAlert.objects.create(
            user=self.user_b,
            tenant=self.tenant_b,
            symbol='FPT',
            alert_type='BELOW',
            price_threshold='100000.00',
        )

        # Query as Tenant A
        tenant_a_alerts = PriceAlert.objects.filter(tenant=self.tenant_a)
        self.assertEqual(tenant_a_alerts.count(), 1)
        self.assertIn(alert_a, tenant_a_alerts)
        self.assertNotIn(alert_b, tenant_a_alerts)

    def test_pricealert_cascade_delete_on_tenant_deprovisioning(self):
        """Deleting tenant cascades to all its price alerts."""
        alert_a1 = PriceAlert.objects.create(
            user=self.user_a,
            tenant=self.tenant_a,
            symbol='VNM',
            alert_type='ABOVE',
            price_threshold='150000.00',
        )
        alert_a2 = PriceAlert.objects.create(
            user=self.user_a,
            tenant=self.tenant_a,
            symbol='VIC',
            alert_type='BELOW',
            price_threshold='50000.00',
        )
        alert_b = PriceAlert.objects.create(
            user=self.user_b,
            tenant=self.tenant_b,
            symbol='FPT',
            alert_type='EQUAL',
            price_threshold='100000.00',
        )

        # Delete tenant_a
        self.tenant_a.delete()

        # Verify cascading delete
        self.assertFalse(PriceAlert.objects.filter(id=alert_a1.id).exists())
        self.assertFalse(PriceAlert.objects.filter(id=alert_a2.id).exists())
        self.assertTrue(PriceAlert.objects.filter(id=alert_b.id).exists())

    def test_pricealert_bulk_active_query_with_tenant_scope(self):
        """Bulk query for active alerts should filter by tenant and status."""
        # Create active and disabled alerts in both tenants
        alert_a_active = PriceAlert.objects.create(
            user=self.user_a,
            tenant=self.tenant_a,
            symbol='VNM',
            alert_type='ABOVE',
            price_threshold='150000.00',
            status='ACTIVE',
            is_enabled=True,
        )
        alert_a_disabled = PriceAlert.objects.create(
            user=self.user_a,
            tenant=self.tenant_a,
            symbol='VIC',
            alert_type='BELOW',
            price_threshold='50000.00',
            status='DISABLED',
            is_enabled=False,
        )
        alert_b_active = PriceAlert.objects.create(
            user=self.user_b,
            tenant=self.tenant_b,
            symbol='FPT',
            alert_type='EQUAL',
            price_threshold='100000.00',
            status='ACTIVE',
            is_enabled=True,
        )

        # Query active alerts for tenant_a
        qs = PriceAlert.objects.filter(
            tenant=self.tenant_a,
            status='ACTIVE',
            is_enabled=True,
        )
        self.assertEqual(qs.count(), 1)
        self.assertIn(alert_a_active, qs)
        self.assertNotIn(alert_a_disabled, qs)
        self.assertNotIn(alert_b_active, qs)


class TenantDataIsolationBoundaryTest(TestCase):
    """Edge cases and boundary conditions for tenant isolation."""

    def setUp(self):
        """Create users and tenants."""
        self.user_orphan = User.objects.create_user(username='orphan')
        self.user_a = User.objects.create_user(username='user_a')
        self.tenant_a = CoreTenant.objects.create(
            owner_user=self.user_a,
            tenant_code='tenant_a',
            display_name='Tenant A',
            status='active',
            plan='pro',
        )

    def test_portfolio_without_tenant_assignment_fails_isolation_query(self):
        """Portfolio without tenant FK should not appear in tenant queries."""
        # Create portfolio with NULL tenant (should not happen in normal flow)
        portfolio_orphan = Portfolio.objects.create(
            user=self.user_orphan,
            tenant=None,
            name='Orphan Portfolio',
        )
        portfolio_a = Portfolio.objects.create(
            user=self.user_a,
            tenant=self.tenant_a,
            name='Portfolio A',
        )

        # Query tenant_a should not include orphan
        qs = Portfolio.objects.filter(tenant=self.tenant_a)
        self.assertNotIn(portfolio_orphan, qs)
        self.assertIn(portfolio_a, qs)

    def test_multi_tenant_user_isolation(self):
        """User member of multiple tenants should see data scoped to each tenant."""
        user_shared = User.objects.create_user(username='shared')
        user_owner_x = User.objects.create_user(username='owner_x')
        user_owner_y = User.objects.create_user(username='owner_y')
        
        tenant_x = CoreTenant.objects.create(
            owner_user=user_owner_x,
            tenant_code='tenant_x',
            display_name='Tenant X',
            status='active',
            plan='pro',
        )
        tenant_y = CoreTenant.objects.create(
            owner_user=user_owner_y,
            tenant_code='tenant_y',
            display_name='Tenant Y',
            status='active',
            plan='starter',
        )

        # user_shared is member of both tenants
        TenantMember.objects.create(
            tenant=tenant_x,
            user=user_shared,
            role='editor',
            invited_by=user_owner_x,
        )
        TenantMember.objects.create(
            tenant=tenant_y,
            user=user_shared,
            role='viewer',
            invited_by=user_owner_y,
        )

        # Create portfolios in each tenant
        portfolio_x = Portfolio.objects.create(
            user=user_shared,
            tenant=tenant_x,
            name='Portfolio X',
        )
        portfolio_y = Portfolio.objects.create(
            user=user_shared,
            tenant=tenant_y,
            name='Portfolio Y',
        )

        # Query by tenant should isolate data
        qs_x = Portfolio.objects.filter(tenant=tenant_x)
        qs_y = Portfolio.objects.filter(tenant=tenant_y)

        self.assertIn(portfolio_x, qs_x)
        self.assertNotIn(portfolio_y, qs_x)
        self.assertIn(portfolio_y, qs_y)
        self.assertNotIn(portfolio_x, qs_y)
