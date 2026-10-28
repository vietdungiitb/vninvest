"""
Integration tests for user_workspace tenant isolation (P1-T05).

SAAS-TDB-P1-T05: Verify tenant isolation enforcement across all user_workspace endpoints.
Test scenario: 2 tenants (tenant_a, tenant_b), 3 users:
  - user1: belongs to tenant_a only
  - user2: belongs to tenant_b only
  - user3: belongs to both tenant_a and tenant_b (cross-tenant edge case)
"""
from decimal import Decimal
from datetime import date, timedelta

from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APIClient

from identity_access.models import CoreTenant, TenantMember
from user_workspace.models import Portfolio, Transaction, Watchlist, WatchlistItem, SubAccount
from user_workspace.tests.envelope import unwrapped


class UserWorkspaceTenantIsolationTests(TestCase):
    """
    Integration test suite for tenant isolation in user_workspace domain.
    """

    @classmethod
    def setUpTestData(cls):
        """Create test fixtures: 2 tenants, 3 users with tenant memberships."""
        # Create users
        cls.owner_a = User.objects.create_user(username='owner_a', password='pass')
        cls.owner_b = User.objects.create_user(username='owner_b', password='pass')
        cls.user1 = User.objects.create_user(username='user1', password='pass')
        cls.user2 = User.objects.create_user(username='user2', password='pass')
        cls.user3 = User.objects.create_user(username='user3', password='pass')

        # Create tenants
        cls.tenant_a = CoreTenant.objects.create(
            owner_user=cls.owner_a,
            tenant_code='tenant-a',
            display_name='Tenant A',
            plan='starter'
        )
        cls.tenant_b = CoreTenant.objects.create(
            owner_user=cls.owner_b,
            tenant_code='tenant-b',
            display_name='Tenant B',
            plan='starter'
        )

        # Create tenant memberships
        # user1 → tenant_a only
        TenantMember.objects.create(
            user=cls.user1,
            tenant=cls.tenant_a,
            role='viewer'
        )

        # user2 → tenant_b only
        TenantMember.objects.create(
            user=cls.user2,
            tenant=cls.tenant_b,
            role='viewer'
        )

        # user3 → both tenant_a and tenant_b
        TenantMember.objects.create(
            user=cls.user3,
            tenant=cls.tenant_a,
            role='viewer'
        )
        TenantMember.objects.create(
            user=cls.user3,
            tenant=cls.tenant_b,
            role='viewer'
        )

    def setUp(self):
        """Create portfolios, transactions, watchlists for each tenant."""
        # Portfolios for tenant_a
        self.portfolio_a1 = Portfolio.objects.create(
            user=self.user1,
            tenant=self.tenant_a,
            name='Portfolio A1',
            is_default=True
        )
        self.portfolio_a3 = Portfolio.objects.create(
            user=self.user3,
            tenant=self.tenant_a,
            name='Portfolio A3'
        )

        # Portfolios for tenant_b
        self.portfolio_b2 = Portfolio.objects.create(
            user=self.user2,
            tenant=self.tenant_b,
            name='Portfolio B2',
            is_default=True
        )
        self.portfolio_b3 = Portfolio.objects.create(
            user=self.user3,
            tenant=self.tenant_b,
            name='Portfolio B3'
        )

        # Transactions in tenant_a
        self.txn_a1 = Transaction.objects.create(
            portfolio=self.portfolio_a1,
            tenant=self.tenant_a,
            symbol='VNM',
            transaction_type=Transaction.TransactionType.BUY,
            date=date.today(),
            price=Decimal('85.5'),
            quantity=100
        )

        # Transactions in tenant_b
        self.txn_b2 = Transaction.objects.create(
            portfolio=self.portfolio_b2,
            tenant=self.tenant_b,
            symbol='VIC',
            transaction_type=Transaction.TransactionType.BUY,
            date=date.today(),
            price=Decimal('120.0'),
            quantity=50
        )

        # Watchlists for tenant_a
        self.watchlist_a1 = Watchlist.objects.create(
            user=self.user1,
            tenant=self.tenant_a,
            name='Watchlist A1'
        )
        WatchlistItem.objects.create(
            watchlist=self.watchlist_a1,
            symbol='VNM'
        )

        # Watchlists for tenant_b
        self.watchlist_b2 = Watchlist.objects.create(
            user=self.user2,
            tenant=self.tenant_b,
            name='Watchlist B2'
        )
        WatchlistItem.objects.create(
            watchlist=self.watchlist_b2,
            symbol='VIC'
        )

    def test_T01_portfolio_isolation_user1_cannot_see_user2_portfolio(self):
        """Portfolio isolation: user1 cannot access user2's portfolio in different tenant."""
        client = APIClient()
        client.force_authenticate(user=self.user1)

        # user1 tries to fetch user2's portfolio (tenant_b)
        response = client.get(f'/core/v1/workspace/portfolios/{self.portfolio_b2.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND,
                        msg='user1 should not see tenant_b portfolio')

    def test_T02_portfolio_filter_by_tenant_a(self):
        """Portfolio list: user1 sees only portfolios in tenant_a."""
        client = APIClient()
        client.force_authenticate(user=self.user1)

        response = client.get('/core/v1/workspace/portfolios/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = unwrapped(response).get('results', [])
        portfolio_names = [p['name'] for p in results]
        self.assertIn('Portfolio A1', portfolio_names)
        self.assertNotIn('Portfolio B2', portfolio_names)

    def test_T03_portfolio_filter_by_tenant_b(self):
        """Portfolio list: user2 sees only portfolios in tenant_b."""
        client = APIClient()
        client.force_authenticate(user=self.user2)

        response = client.get('/core/v1/workspace/portfolios/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = unwrapped(response).get('results', [])
        portfolio_names = [p['name'] for p in results]
        self.assertIn('Portfolio B2', portfolio_names)
        self.assertNotIn('Portfolio A1', portfolio_names)

    def test_T04_transaction_filtered_by_portfolio_tenant(self):
        """Transaction list: transactions inherit tenant from portfolio."""
        client = APIClient()
        client.force_authenticate(user=self.user1)

        response = client.get(f'/core/v1/workspace/portfolios/{self.portfolio_a1.id}/transactions/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify transaction has tenant set
        self.assertEqual(self.txn_a1.tenant_id, self.tenant_a.id,
                        msg='Transaction should have tenant_a set')

    def test_T05_transaction_cross_tenant_access_returns_404(self):
        """Transaction isolation: user cannot access transaction in cross-tenant portfolio."""
        client = APIClient()
        # PATCH là method GHI: user1 ('viewer') bị WorkspacePermission chặn 403
        # TRƯỚC khi tới kiểm tra tenant ⇒ mất đúng ý nghĩa test (404 = không
        # thấy, chứ không phải 403 = không đủ quyền). owner_a thuộc tenant_a và có
        # quyền ghi, nên vẫn phải trả **404** cho transaction của tenant_b.
        client.force_authenticate(user=self.owner_a)

        # user1 tries to access tenant_b transaction
        response = client.patch(f'/core/v1/workspace/transactions/{self.txn_b2.id}/', data={'note': 'hacked'})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND,
                        msg='user1 should not access tenant_b transaction')

    def test_T06_user3_sees_only_tenant_a_when_scoped(self):
        """Multi-tenant user: user3 can access both tenants but respects scope."""
        client = APIClient()
        client.force_authenticate(user=self.user3)

        # user3 can access portfolio in both tenants (if no scope enforced)
        # With proper scope, request.tenant would be set to one tenant
        response_a = client.get(f'/core/v1/workspace/portfolios/{self.portfolio_a3.id}/')
        self.assertEqual(response_a.status_code, status.HTTP_200_OK,
                        msg='user3 can access tenant_a portfolio')

    def test_T07_watchlist_filtered_by_tenant(self):
        """Watchlist isolation: user can only see watchlists in their tenant."""
        client = APIClient()
        client.force_authenticate(user=self.user1)

        response = client.get('/core/v1/workspace/watchlists/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = unwrapped(response).get('results', [])
        watchlist_names = [w['name'] for w in results]
        self.assertIn('Watchlist A1', watchlist_names)
        self.assertNotIn('Watchlist B2', watchlist_names)

        # user1 should only see watchlist_a1
        watchlist = Watchlist.objects.get(user=self.user1)
        self.assertEqual(watchlist.tenant_id, self.tenant_a.id,
                        msg='Watchlist should belong to tenant_a')

    def test_T08_watchlist_item_not_accessible_cross_tenant(self):
        """Watchlist item isolation: items are only accessible via correct watchlist."""
        client = APIClient()
        client.force_authenticate(user=self.user1)

        # user1 tries to delete item from tenant_b watchlist
        response = client.delete(f'/core/v1/workspace/watchlists/{self.watchlist_b2.id}/items/VIC/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND,
                        msg='user1 should not access tenant_b watchlist items')

    def test_T09_subaccount_filtered_by_tenant(self):
        """SubAccount isolation: filtered by tenant FK."""
        sub_a = SubAccount.objects.create(
            user=self.user1,
            tenant=self.tenant_a,
            broker='SSI',
            display_name='Sub A1'
        )
        sub_b = SubAccount.objects.create(
            user=self.user2,
            tenant=self.tenant_b,
            broker='VCI',
            display_name='Sub B2'
        )

        # user1 should only see sub_a
        user1_subs = SubAccount.objects.filter(user=self.user1, tenant=self.tenant_a)
        self.assertEqual(user1_subs.count(), 1,
                        msg='user1 should have 1 subaccount in tenant_a')
        self.assertEqual(user1_subs.first().id, sub_a.id)

    def test_T10_subaccount_cross_tenant_blocked(self):
        """SubAccount: user cannot access sub-account from different tenant."""
        sub_a = SubAccount.objects.create(
            user=self.user1,
            tenant=self.tenant_a,
            broker='SSI',
            display_name='Sub A1'
        )

        # Query with wrong tenant should return no results
        cross_query = SubAccount.objects.filter(user=self.user1, tenant=self.tenant_b)
        self.assertEqual(cross_query.count(), 0,
                        msg='Cross-tenant query should return 0 subaccounts')

    def test_T11_portfolio_list_pagination_format(self):
        """Pagination: list endpoints return correct format {count, next, previous, results}."""
        client = APIClient()
        client.force_authenticate(user=self.user1)

        response = client.get('/core/v1/workspace/portfolios/?page=1&page_size=10')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Shape sau B5: paginated trả `{next, previous, results}` — **khong**
        # `count` trong `data` (xem `user_workspace/envelope.py:20`). `count`
        # nam o `meta`/header cua paginator. Test cu o dinh nghia `count` nen
        # hong sau khi doi hop dong.
        payload = unwrapped(response)
        self.assertIn('results', payload,
                     msg='Response should have results')
        self.assertIn('next', payload,
                     msg='paginated shape should expose next')
        self.assertIn('previous', payload,
                     msg='paginated shape should expose previous')
        self.assertNotIn('count', payload,
                         msg='B5 shape khong dua count vao data')
        # next and previous optional if < 1 page

    def test_T12_transaction_list_pagination_with_filter(self):
        """Pagination: transaction list respects pagination params."""
        client = APIClient()
        client.force_authenticate(user=self.user1)

        # Add more transactions
        for i in range(25):
            Transaction.objects.create(
                portfolio=self.portfolio_a1,
                tenant=self.tenant_a,
                symbol='VNM',
                transaction_type=Transaction.TransactionType.BUY,
                date=date.today() - timedelta(days=i),
                price=Decimal('85.5'),
                quantity=10
            )

        response = client.get(f'/core/v1/workspace/portfolios/{self.portfolio_a1.id}/transactions/?page=1&page_size=10')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        results = unwrapped(response).get('results', [])
        self.assertEqual(len(results), 10,
                        msg='page_size=10 should return 10 results max')

    def test_T13_401_returns_standard_envelope(self):
        """Error handling: 401 Unauthorized returns standard error format."""
        client = APIClient()
        # No auth

        response = client.get('/core/v1/workspace/portfolios/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        # Should have error detail
        self.assertIn('detail', response.data,
                     msg='401 should have detail field')

    def test_T14_404_returns_standard_envelope(self):
        """Error handling: 404 Not Found returns standard error format."""
        client = APIClient()
        client.force_authenticate(user=self.user1)

        response = client.get('/core/v1/workspace/portfolios/99999/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        self.assertIn('detail', response.data,
                     msg='404 should have detail field')

    def test_T15_400_field_errors_in_envelope(self):
        """Error handling: 400 Bad Request includes field errors."""
        client = APIClient()
        # Xem T16: user1 là 'viewer' nên bị 403 trước khi tới validate 400.
        client.force_authenticate(user=self.owner_a)

        # Invalid portfolio creation (empty name)
        response = client.post('/core/v1/workspace/portfolios/', data={'name': ''})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST,
                 msg='Empty name should be rejected with 400')
        self.assertIn('field_errors', response.data,
                  msg='400 response should include field_errors')
        self.assertIn('name', response.data.get('field_errors', {}),
                  msg='400 response should include field error for name')

    def test_T16_create_portfolio_sets_tenant(self):
        """Write operations: new portfolio gets tenant set automatically."""
        client = APIClient()
        # user1 có TenantMember role='viewer' (L57) ⇒ KHÔNG có `portfolio_write`
        # (map sang `sa:write`, chỉ owner/admin có). Dùng owner_a — owner_user là
        # thành viên ngầm định của tenant_a nên đủ quyền ghi.
        client.force_authenticate(user=self.owner_a)

        response = client.post('/core/v1/workspace/portfolios/', 
                              data={'name': 'New Portfolio'})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Verify portfolio has tenant
        new_portfolio = Portfolio.objects.get(user=self.owner_a, name='New Portfolio')
        # If request.tenant is set by TenantScopePermission, it should be tenant_a
        self.assertIsNotNone(new_portfolio.tenant,
                            msg='New portfolio should have tenant set')

    def test_T17_create_transaction_inherits_portfolio_tenant(self):
        """Write operations: new transaction inherits tenant from portfolio."""
        client = APIClient()
        client.force_authenticate(user=self.owner_a)

        # `portfolio_a1` thuộc user1 ⇒ owner_a không có quyền thấy nó (404 đúng,
        # nhưng không phải điều test này muốn kiểm). Tạo portfolio của chính
        # owner_a trong tenant_a để thao tác ghi đúng ngữ nghĩa.
        owner_portfolio = Portfolio.objects.create(
            user=self.owner_a,
            tenant=self.tenant_a,
            name='Portfolio owner A',
        )

        response = client.post(
        f'/core/v1/workspace/portfolios/{owner_portfolio.id}/transactions/',
            data={
                'symbol': 'VCB',
                'transaction_type': 'BUY',
                'date': date.today().isoformat(),
                'price': '100.0',
                'quantity': 50
            }
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Verify transaction has tenant from portfolio
        new_txn = Transaction.objects.get(symbol='VCB', portfolio=owner_portfolio)
        self.assertEqual(new_txn.tenant_id, self.portfolio_a1.tenant_id,
                        msg='Transaction should inherit portfolio tenant')

    def test_T18_database_query_isolation(self):
        """Database layer: transactions filtered by both user and tenant."""
        # Query transactions as if from user1 in tenant_a
        # Should NOT see txn_b2 (which is in tenant_b)
        user1_a_txns = Transaction.objects.filter(
            portfolio__user=self.user1,
            tenant=self.tenant_a
        )
        self.assertNotIn(self.txn_b2.id, [t.id for t in user1_a_txns],
                        msg='user1 should not see tenant_b transactions')

        # Query transactions as if from user2 in tenant_b
        user2_b_txns = Transaction.objects.filter(
            portfolio__user=self.user2,
            tenant=self.tenant_b
        )
        self.assertNotIn(self.txn_a1.id, [t.id for t in user2_b_txns],
                        msg='user2 should not see tenant_a transactions')

    def test_T19_legacy_watchlist_group_list_isolation(self):
        """Legacy watchlist group list must fail closed, never leak tenant_b.

        These five T19-T23 cases hit `/api/portfolio/watchlist/*`, which resolves to
        the catch-all `vninvest_core.legacy_proxy.legacy_proxy_view` — there is no
        native route on that prefix. With no `LEGACY_BACKEND_URL` configured the
        proxy answers 503 `LEGACY_BACKEND_NOT_CONFIGURED` (`legacy_proxy.py:80-92`),
        so the old expectations (200 with a list payload, 404, 204) could never be
        satisfied and only encoded the legacy backend's behaviour, not the proxy's.

        What IS this repo's contract is fail-closed: an unconfigured proxy must not
        hand back watchlist data. Per-tenant filtering for watchlists is asserted
        natively in `user_workspace/tests/test_data_isolation.py:149`.
        """
        client = APIClient()
        client.force_authenticate(user=self.user1)

        response = client.get('/api/portfolio/watchlist/groups/')
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.json()['code'], 'LEGACY_BACKEND_NOT_CONFIGURED')

    def test_T20_legacy_watchlist_group_detail_isolation(self):
        """Legacy watchlist group detail: no cross-tenant read when proxy is down."""
        client = APIClient()
        client.force_authenticate(user=self.user1)

        response = client.get(f'/api/portfolio/watchlist/groups/{self.watchlist_b2.id}/')
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.json()['code'], 'LEGACY_BACKEND_NOT_CONFIGURED')

    def test_T21_legacy_watchlist_item_create_isolation(self):
        """Legacy watchlist item create: no cross-tenant write when proxy is down."""
        client = APIClient()
        client.force_authenticate(user=self.user1)

        response = client.post(f'/api/portfolio/watchlist/groups/{self.watchlist_b2.id}/items/', data={'symbol': 'HPG'})
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.json()['code'], 'LEGACY_BACKEND_NOT_CONFIGURED')

    def test_T22_legacy_watchlist_item_delete_isolation(self):
        """Legacy watchlist item delete: tenant_b's item survives a failed proxy."""
        client = APIClient()
        client.force_authenticate(user=self.user1)

        # Add item to tenant_b watchlist
        item_b = WatchlistItem.objects.create(watchlist=self.watchlist_b2, symbol='HPG')

        # user1 tries to delete it
        response = client.delete(f'/api/portfolio/watchlist/items/{item_b.id}/')
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.json()['code'], 'LEGACY_BACKEND_NOT_CONFIGURED')

        # Verify HPG still exists in watchlist_b2
        self.assertTrue(WatchlistItem.objects.filter(watchlist=self.watchlist_b2, symbol='HPG').exists())

    def test_T23_legacy_securities_group_list_isolation(self):
        """Legacy securities group list must not expose tenant_b groups."""
        client = APIClient()
        client.force_authenticate(user=self.user1)

        # Create custom watchlists to test securities list views
        watchlist_custom_a = Watchlist.objects.create(
            user=self.user1,
            tenant=self.tenant_a,
            name='Custom Group A'
        )
        watchlist_custom_b = Watchlist.objects.create(
            user=self.user2,
            tenant=self.tenant_b,
            name='Custom Group B'
        )

        response = client.get('/api/portfolio/watchlist/groups/')
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

        body = response.content.decode('utf-8', errors='replace')
        self.assertNotIn('Custom Group A', body)
        self.assertNotIn('Custom Group B', body)

    def test_T24_tenant_member_inactive_status_blocked(self):
        """Tenant isolation: user with suspended tenant cannot resolve it, falling back to None and getting blocked at endpoint level."""
        client = APIClient()
        
        # Create a user and a suspended tenant
        user_suspended = User.objects.create_user(username='user_suspended', password='pass')
        tenant_suspended = CoreTenant.objects.create(
            owner_user=user_suspended,
            tenant_code='tenant-suspended',
            display_name='Suspended Tenant',
            status='suspended'  # NOT active or trial
        )
        TenantMember.objects.create(
            user=user_suspended,
            tenant=tenant_suspended,
            role='viewer'
        )
        
        client.force_authenticate(user=user_suspended)
        
        # Since _resolve_tenant now filters out suspended tenants, this user's resolved tenant is None.
        from user_workspace.permissions import _resolve_tenant
        resolved = _resolve_tenant(user_suspended)
        self.assertIsNone(resolved, msg='Suspended tenant should resolve to None')

        # Attempt to access native workspace endpoint - should be blocked with 403
        response = client.get('/core/v1/workspace/portfolios/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN,
                         msg='User with suspended tenant should be blocked with 403')

    def test_T25_multi_tenant_user_can_select_tenant_by_query_hint(self):
        """Multi-tenant scope: tenant_code query hint must control request.tenant resolution."""
        client = APIClient()
        client.force_authenticate(user=self.user3)

        response = client.get('/core/v1/workspace/portfolios/?tenant_code=tenant-b')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        results = unwrapped(response).get('results', [])
        portfolio_names = [p['name'] for p in results]
        self.assertIn('Portfolio B3', portfolio_names)
        self.assertNotIn('Portfolio A3', portfolio_names)

    def test_T26_invalid_tenant_hint_is_forbidden(self):
        """Tenant hint must be authorized for current user, otherwise endpoint is forbidden."""
        client = APIClient()
        client.force_authenticate(user=self.user1)

        response = client.get('/core/v1/workspace/portfolios/?tenant_code=tenant-b')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
