"""
User Workspace domain REST API views.

Endpoints:
  GET/POST       /core/v1/workspace/portfolios/
  GET/PATCH/DEL  /core/v1/workspace/portfolios/<id>/
  GET/POST       /core/v1/workspace/portfolios/<id>/transactions/
  GET/POST       /core/v1/workspace/watchlists/
  GET/POST/DEL   /core/v1/workspace/watchlists/<id>/items/
  DEL            /core/v1/workspace/watchlists/<id>/items/<symbol>/
  
TENANT ISOLATION:
  All views enforce double-filter: user=request.user AND tenant=request.tenant
  TenantScopePermission optional for backward compat; recommended for multi-tenant deployments.
"""
from rest_framework import permissions, status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from vninvest_core.pagination import CoreCursorPagination

class TransactionCursorPagination(CoreCursorPagination):
    ordering = ('-date', '-id')

class WatchlistCursorPagination(CoreCursorPagination):
    ordering = 'name'

class WatchlistItemCursorPagination(CoreCursorPagination):
    ordering = '-added_at'
from .models import Portfolio, Transaction, Watchlist, WatchlistItem, PriceAlert, SubAccount, ScreenerRule
from .permissions import TenantScopePermission
from .serializers import (
    PortfolioSerializer,
    TransactionSerializer,
    WatchlistItemSerializer,
    WatchlistSerializer,
    SubAccountSerializer,
    ScreenerRuleSerializer,
)
from .screener_helpers import _validate_screener_rules


def _get_portfolio_or_404(user, portfolio_id, tenant=None):
    """
    Retrieve portfolio with double-filter: user + tenant.
    
    Args:
        user: Django User instance
        portfolio_id: Portfolio PK
        tenant: CoreTenant instance (optional, if None only filters by user)
    
    Returns:
        Portfolio instance
        
    Raises:
        NotFound: if portfolio doesn't exist or crosses tenant boundary
    """
    try:
        if tenant:
            portfolio = Portfolio.objects.get(pk=portfolio_id, user=user, tenant=tenant)
        else:
            portfolio = Portfolio.objects.get(pk=portfolio_id, user=user)
    except Portfolio.DoesNotExist:
        raise NotFound(f'Portfolio {portfolio_id} not found.')
    return portfolio


def _get_watchlist_or_404(user, watchlist_id, tenant=None):
    """Retrieve watchlist with double-filter: user + tenant."""
    try:
        if tenant:
            watchlist = Watchlist.objects.get(pk=watchlist_id, user=user, tenant=tenant)
        else:
            watchlist = Watchlist.objects.get(pk=watchlist_id, user=user)
    except Watchlist.DoesNotExist:
        raise NotFound(f'Watchlist {watchlist_id} not found.')
    return watchlist


def _get_transaction_or_404(user, transaction_id, tenant=None):
    """Retrieve transaction with double-filter: portfolio.user + portfolio.tenant."""
    try:
        q_filter = {'pk': transaction_id, 'portfolio__user': user}
        if tenant:
            q_filter['portfolio__tenant'] = tenant
        transaction = Transaction.objects.select_related('portfolio').get(**q_filter)
    except Transaction.DoesNotExist:
        raise NotFound(f'Transaction {transaction_id} not found.')
    return transaction


class PortfolioListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated, TenantScopePermission]
    pagination_class = CoreCursorPagination

    def get(self, request):
        # Apply double-filter: user + tenant
        tenant = getattr(request, 'tenant', None)
        if tenant:
            portfolios = Portfolio.objects.filter(user=request.user, tenant=tenant).order_by('-created_at')
        else:
            portfolios = Portfolio.objects.filter(user=request.user).order_by('-created_at')
        
        # Apply pagination
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(portfolios, request)
        if page is not None:
            serializer = PortfolioSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)
        
        serializer = PortfolioSerializer(portfolios, many=True)
        return Response({'count': len(portfolios), 'results': serializer.data})

    def post(self, request):
        serializer = PortfolioSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        tenant = getattr(request, 'tenant', None)
        portfolio = serializer.save(user=request.user, tenant=tenant)
        return Response(PortfolioSerializer(portfolio).data, status=status.HTTP_201_CREATED)


class PortfolioDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, TenantScopePermission]

    def get(self, request, portfolio_id):
        tenant = getattr(request, 'tenant', None)
        portfolio = _get_portfolio_or_404(request.user, portfolio_id, tenant)
        return Response(PortfolioSerializer(portfolio).data)

    def patch(self, request, portfolio_id):
        tenant = getattr(request, 'tenant', None)
        portfolio = _get_portfolio_or_404(request.user, portfolio_id, tenant)
        serializer = PortfolioSerializer(portfolio, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, portfolio_id):
        tenant = getattr(request, 'tenant', None)
        portfolio = _get_portfolio_or_404(request.user, portfolio_id, tenant)
        portfolio.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TransactionListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated, TenantScopePermission]
    pagination_class = TransactionCursorPagination

    def get(self, request, portfolio_id):
        tenant = getattr(request, 'tenant', None)
        portfolio = _get_portfolio_or_404(request.user, portfolio_id, tenant)
        qs = portfolio.transactions.order_by('-date', '-pk')
        
        # Filter by symbol if provided
        symbol = request.query_params.get('symbol')
        if symbol:
            qs = qs.filter(symbol=symbol.upper())
        
        # Apply pagination
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request)
        if page is not None:
            serializer = TransactionSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)
        
        serializer = TransactionSerializer(qs, many=True)
        return Response({'count': qs.count(), 'results': serializer.data})

    def post(self, request, portfolio_id):
        tenant = getattr(request, 'tenant', None)
        portfolio = _get_portfolio_or_404(request.user, portfolio_id, tenant)
        serializer = TransactionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Auto-set tenant from portfolio
        txn = serializer.save(portfolio=portfolio, tenant=portfolio.tenant)
        return Response(TransactionSerializer(txn).data, status=status.HTTP_201_CREATED)


class TransactionDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, TenantScopePermission]

    def patch(self, request, transaction_id):
        tenant = getattr(request, 'tenant', None)
        transaction = _get_transaction_or_404(request.user, transaction_id, tenant)
        serializer = TransactionSerializer(transaction, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, transaction_id):
        tenant = getattr(request, 'tenant', None)
        transaction = _get_transaction_or_404(request.user, transaction_id, tenant)
        transaction.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WatchlistListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated, TenantScopePermission]
    pagination_class = WatchlistCursorPagination

    def get(self, request):
        tenant = getattr(request, 'tenant', None)
        if tenant:
            watchlists = Watchlist.objects.filter(user=request.user, tenant=tenant).exclude(is_default=True).order_by('name')
        else:
            watchlists = Watchlist.objects.filter(user=request.user).exclude(is_default=True).order_by('name')
        
        # Apply pagination
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(watchlists, request)
        if page is not None:
            serializer = WatchlistSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)
        
        serializer = WatchlistSerializer(watchlists, many=True)
        return Response({'count': watchlists.count(), 'results': serializer.data})

    def post(self, request):
        serializer = WatchlistSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        tenant = getattr(request, 'tenant', None)
        watchlist = serializer.save(user=request.user, tenant=tenant)
        return Response(WatchlistSerializer(watchlist).data, status=status.HTTP_201_CREATED)


class WatchlistDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, TenantScopePermission]

    def _get_watchlist(self, request, watchlist_id):
        tenant = getattr(request, 'tenant', None)
        try:
            if tenant:
                return Watchlist.objects.get(pk=watchlist_id, user=request.user, tenant=tenant)
            else:
                return Watchlist.objects.get(pk=watchlist_id, user=request.user)
        except Watchlist.DoesNotExist:
            return None

    def get(self, request, watchlist_id):
        watchlist = self._get_watchlist(request, watchlist_id)
        if watchlist is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(WatchlistSerializer(watchlist).data)

    def patch(self, request, watchlist_id):
        watchlist = self._get_watchlist(request, watchlist_id)
        if watchlist is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = WatchlistSerializer(watchlist, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, watchlist_id):
        watchlist = self._get_watchlist(request, watchlist_id)
        if watchlist is None:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        watchlist.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WatchlistItemListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated, TenantScopePermission]
    pagination_class = WatchlistItemCursorPagination

    def get(self, request, watchlist_id):
        tenant = getattr(request, 'tenant', None)
        watchlist = _get_watchlist_or_404(request.user, watchlist_id, tenant)
        items = watchlist.items.order_by('-added_at')
        
        # Apply pagination
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(items, request)
        if page is not None:
            serializer = WatchlistItemSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)
        
        serializer = WatchlistItemSerializer(items, many=True)
        return Response({'count': items.count(), 'results': serializer.data})

    def post(self, request, watchlist_id):
        tenant = getattr(request, 'tenant', None)
        watchlist = _get_watchlist_or_404(request.user, watchlist_id, tenant)
        symbol = str(request.data.get('symbol', '')).strip().upper()
        if not symbol:
            return Response({'detail': 'symbol là bắt buộc.'}, status=status.HTTP_400_BAD_REQUEST)
        # Ensure StockProfile exists for this symbol (seed dynamically from vnbroker)
        from market_data.models import StockProfile
        if not StockProfile.objects.filter(symbol=symbol).exists():
            from market_data.vnbroker_adapter import fetch_listing_symbols
            try:
                listings = fetch_listing_symbols()
                match = next((item for item in listings if item.get('symbol') == symbol), None)
                if match:
                    StockProfile.objects.get_or_create(
                        symbol=symbol,
                        defaults={
                            'exchange': match.get('exchange', 'HOSE') or 'HOSE',
                            'company_name': match.get('company_name', '') or '',
                            'industry': match.get('industry', '') or '',
                            'status': StockProfile.StatusChoices.ACTIVE
                        }
                    )
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Error dynamically seeding StockProfile when adding to watchlist: {e}")

        item, created = WatchlistItem.objects.get_or_create(
            watchlist=watchlist,
            symbol=symbol,
        )
        code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(WatchlistItemSerializer(item).data, status=code)


class WatchlistItemDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated, TenantScopePermission]

    def delete(self, request, watchlist_id, symbol):
        tenant = getattr(request, 'tenant', None)
        watchlist = _get_watchlist_or_404(request.user, watchlist_id, tenant)
        deleted, _ = WatchlistItem.objects.filter(
            watchlist=watchlist,
            symbol=symbol.upper(),
        ).delete()
        if not deleted:
            raise NotFound(f'{symbol} không tồn tại trong watchlist {watchlist_id}.')
        return Response(status=status.HTTP_204_NO_CONTENT)


class SubAccountListCreateAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated, TenantScopePermission]

    def get(self, request):
        tenant = getattr(request, 'tenant', None)
        if tenant:
            qs = SubAccount.objects.filter(user=request.user, tenant=tenant).order_by('-created_at')
        else:
            qs = SubAccount.objects.filter(user=request.user).order_by('-created_at')
        serializer = SubAccountSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        tenant = getattr(request, 'tenant', None)
        serializer = SubAccountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        portfolio_id = request.data.get('portfolio')
        if portfolio_id:
            try:
                if tenant:
                    portfolio = Portfolio.objects.get(pk=portfolio_id, user=request.user, tenant=tenant)
                else:
                    portfolio = Portfolio.objects.get(pk=portfolio_id, user=request.user)
            except Portfolio.DoesNotExist:
                return Response({'portfolio': ['Portfolio không tồn tại hoặc không thuộc người dùng.']}, status=status.HTTP_400_BAD_REQUEST)
        else:
            if tenant:
                portfolio = Portfolio.objects.filter(user=request.user, tenant=tenant).first()
            else:
                portfolio = Portfolio.objects.filter(user=request.user).first()

            if not portfolio:
                portfolio = Portfolio.objects.create(
                    user=request.user,
                    tenant=tenant,
                    name="Default Portfolio",
                    is_default=True
                )

        sub_account = serializer.save(user=request.user, tenant=tenant, portfolio=portfolio)
        return Response(SubAccountSerializer(sub_account).data, status=status.HTTP_201_CREATED)


class SubAccountDetailAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated, TenantScopePermission]

    def get_object(self, pk, user, tenant):
        try:
            if tenant:
                return SubAccount.objects.get(pk=pk, user=user, tenant=tenant)
            else:
                return SubAccount.objects.get(pk=pk, user=user)
        except SubAccount.DoesNotExist:
            raise NotFound('Tiểu khoản không tồn tại.')

    def get(self, request, pk):
        tenant = getattr(request, 'tenant', None)
        sub_account = self.get_object(pk, request.user, tenant)
        return Response(SubAccountSerializer(sub_account).data)

    def patch(self, request, pk):
        tenant = getattr(request, 'tenant', None)
        sub_account = self.get_object(pk, request.user, tenant)
        serializer = SubAccountSerializer(sub_account, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        tenant = getattr(request, 'tenant', None)
        sub_account = self.get_object(pk, request.user, tenant)
        sub_account.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SubAccountTransactionsAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated, TenantScopePermission]
    pagination_class = TransactionCursorPagination

    def get_sub_account(self, pk, user, tenant):
        try:
            if tenant:
                return SubAccount.objects.get(pk=pk, user=user, tenant=tenant)
            else:
                return SubAccount.objects.get(pk=pk, user=user)
        except SubAccount.DoesNotExist:
            raise NotFound('Tiểu khoản không tồn tại.')

    def get(self, request, pk):
        tenant = getattr(request, 'tenant', None)
        sub_account = self.get_sub_account(pk, request.user, tenant)
        portfolio = sub_account.portfolio
        if not portfolio:
            return Response({'count': 0, 'results': []})

        qs = Transaction.objects.filter(portfolio=portfolio, tenant=portfolio.tenant).order_by('-date', '-pk')

        symbol = request.query_params.get('symbol')
        if symbol:
            qs = qs.filter(symbol=symbol.upper())

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request)
        if page is not None:
            serializer = TransactionSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)

        serializer = TransactionSerializer(qs, many=True)
        return Response({'count': qs.count(), 'results': serializer.data})

    def post(self, request, pk):
        tenant = getattr(request, 'tenant', None)
        sub_account = self.get_sub_account(pk, request.user, tenant)
        portfolio = sub_account.portfolio
        if not portfolio:
            return Response({'detail': 'Tiểu khoản này chưa liên kết với danh mục.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = TransactionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        txn = serializer.save(portfolio=portfolio, tenant=portfolio.tenant)
        return Response(TransactionSerializer(txn).data, status=status.HTTP_201_CREATED)


class ScreenerRuleListCreateAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated, TenantScopePermission]

    def get(self, request):
        # P0.6: list only active rules (inactive = template previews, see P0.4).
        tenant = getattr(request, 'tenant', None)
        if tenant:
            rules = ScreenerRule.objects.filter(user=request.user, tenant=tenant, is_active=True)
        else:
            rules = ScreenerRule.objects.filter(user=request.user, is_active=True)
        return Response(ScreenerRuleSerializer(rules, many=True).data)

    def post(self, request):
        tenant = getattr(request, 'tenant', None)
        serializer = ScreenerRuleSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        rules_json = serializer.validated_data.get('rules_json', [])
        ok, err = _validate_screener_rules(rules_json)
        if not ok:
            return Response({'detail': err}, status=status.HTTP_400_BAD_REQUEST)

        rule = serializer.save(user=request.user, tenant=tenant)
        return Response(ScreenerRuleSerializer(rule).data, status=status.HTTP_201_CREATED)


class ScreenerPublicRuleListAPIView(APIView):
    """W8 P3 preset cộng đồng: GET /screener/rules/public/.

    Catalog các rule đang chia sẻ (is_public=True, is_active=True) trong cùng
    tenant — user nào cũng xem được, kể cả rule của người khác. Tenant isolation:
    không tenant → chỉ rule public của chính mình (fail-closed cross-tenant).
    """
    permission_classes = [permissions.IsAuthenticated, TenantScopePermission]

    def get(self, request):
        tenant = getattr(request, 'tenant', None)
        if tenant:
            rules = ScreenerRule.objects.filter(
                tenant=tenant, is_public=True, is_active=True
            ).select_related('user').order_by('-updated_at')[:100]
        else:
            rules = ScreenerRule.objects.filter(
                user=request.user, is_public=True, is_active=True
            ).select_related('user').order_by('-updated_at')[:100]
        return Response(ScreenerRuleSerializer(rules, many=True).data)


class ScreenerRuleForkAPIView(APIView):
    """W8 P3 preset cộng đồng: POST /screener/rules/<pk>/fork/.

    Sao chép 1 rule public (cùng tenant) hoặc rule của chính mình thành rule
    riêng (is_public=False). Tên "X (bản sao)", giữ nguyên rules_json đã validate.
    """
    permission_classes = [permissions.IsAuthenticated, TenantScopePermission]

    def post(self, request, pk):
        from django.db.models import Q
        tenant = getattr(request, 'tenant', None)
        try:
            if tenant:
                src = ScreenerRule.objects.get(
                    Q(is_public=True) | Q(user=request.user),
                    pk=pk, tenant=tenant, is_active=True,
                )
            else:
                src = ScreenerRule.objects.get(pk=pk, user=request.user, is_active=True)
        except ScreenerRule.DoesNotExist:
            raise NotFound('Bộ lọc không tồn tại hoặc chưa được chia sẻ.')

        ok, err = _validate_screener_rules(src.rules_json)
        if not ok:
            return Response({'detail': f'Bộ lọc gốc không hợp lệ: {err}'}, status=status.HTTP_400_BAD_REQUEST)

        name = str(src.name or 'Bộ lọc')[:90]
        copy = ScreenerRule.objects.create(
            user=request.user,
            tenant=tenant,
            name=f'{name} (bản sao)',
            rules_json=src.rules_json,
            is_active=True,
            is_public=False,
        )
        return Response(ScreenerRuleSerializer(copy).data, status=status.HTTP_201_CREATED)

