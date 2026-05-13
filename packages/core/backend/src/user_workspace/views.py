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

from vninvest_core.pagination import StandardPageNumberPagination
from .models import Portfolio, Transaction, Watchlist, WatchlistItem, PriceAlert, SubAccount
from .permissions import TenantScopePermission
from .serializers import (
    PortfolioSerializer,
    TransactionSerializer,
    WatchlistItemSerializer,
    WatchlistSerializer,
)


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
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardPageNumberPagination

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
    permission_classes = [permissions.IsAuthenticated]

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
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardPageNumberPagination

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
    permission_classes = [permissions.IsAuthenticated]

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
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardPageNumberPagination

    def get(self, request):
        tenant = getattr(request, 'tenant', None)
        if tenant:
            watchlists = Watchlist.objects.filter(user=request.user, tenant=tenant).order_by('name')
        else:
            watchlists = Watchlist.objects.filter(user=request.user).order_by('name')
        
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


class WatchlistItemListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardPageNumberPagination

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
        item, created = WatchlistItem.objects.get_or_create(
            watchlist=watchlist,
            symbol=symbol,
        )
        code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(WatchlistItemSerializer(item).data, status=code)


class WatchlistItemDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

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
