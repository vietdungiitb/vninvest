"""
User Workspace domain REST API views.

Endpoints:
  GET/POST       /core/v1/workspace/portfolios/
  GET/PATCH/DEL  /core/v1/workspace/portfolios/<id>/
  GET/POST       /core/v1/workspace/portfolios/<id>/transactions/
  GET/POST       /core/v1/workspace/watchlists/
  GET/POST/DEL   /core/v1/workspace/watchlists/<id>/items/
  DEL            /core/v1/workspace/watchlists/<id>/items/<symbol>/
"""
from rest_framework import permissions, status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Portfolio, Transaction, Watchlist, WatchlistItem
from .serializers import (
    PortfolioSerializer,
    TransactionSerializer,
    WatchlistItemSerializer,
    WatchlistSerializer,
)


def _get_portfolio_or_404(user, portfolio_id):
    try:
        portfolio = Portfolio.objects.get(pk=portfolio_id, user=user)
    except Portfolio.DoesNotExist:
        raise NotFound(f'Portfolio {portfolio_id} not found.')
    return portfolio


def _get_watchlist_or_404(user, watchlist_id):
    try:
        watchlist = Watchlist.objects.get(pk=watchlist_id, user=user)
    except Watchlist.DoesNotExist:
        raise NotFound(f'Watchlist {watchlist_id} not found.')
    return watchlist


class PortfolioListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        portfolios = Portfolio.objects.filter(user=request.user).order_by('-created_at')
        return Response({'results': PortfolioSerializer(portfolios, many=True).data})

    def post(self, request):
        serializer = PortfolioSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        portfolio = serializer.save(user=request.user)
        return Response(PortfolioSerializer(portfolio).data, status=status.HTTP_201_CREATED)


class PortfolioDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, portfolio_id):
        portfolio = _get_portfolio_or_404(request.user, portfolio_id)
        return Response(PortfolioSerializer(portfolio).data)

    def patch(self, request, portfolio_id):
        portfolio = _get_portfolio_or_404(request.user, portfolio_id)
        serializer = PortfolioSerializer(portfolio, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, portfolio_id):
        portfolio = _get_portfolio_or_404(request.user, portfolio_id)
        portfolio.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TransactionListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, portfolio_id):
        portfolio = _get_portfolio_or_404(request.user, portfolio_id)
        qs = portfolio.transactions.order_by('-date', '-pk')
        symbol = request.query_params.get('symbol')
        if symbol:
            qs = qs.filter(symbol=symbol.upper())
        return Response({'results': TransactionSerializer(qs, many=True).data})

    def post(self, request, portfolio_id):
        portfolio = _get_portfolio_or_404(request.user, portfolio_id)
        serializer = TransactionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        txn = serializer.save(portfolio=portfolio)
        return Response(TransactionSerializer(txn).data, status=status.HTTP_201_CREATED)


class WatchlistListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        watchlists = Watchlist.objects.filter(user=request.user).order_by('name')
        return Response({'results': WatchlistSerializer(watchlists, many=True).data})

    def post(self, request):
        serializer = WatchlistSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        watchlist = serializer.save(user=request.user)
        return Response(WatchlistSerializer(watchlist).data, status=status.HTTP_201_CREATED)


class WatchlistItemListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, watchlist_id):
        watchlist = _get_watchlist_or_404(request.user, watchlist_id)
        items = watchlist.items.order_by('-added_at')
        return Response({'results': WatchlistItemSerializer(items, many=True).data})

    def post(self, request, watchlist_id):
        watchlist = _get_watchlist_or_404(request.user, watchlist_id)
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
        watchlist = _get_watchlist_or_404(request.user, watchlist_id)
        deleted, _ = WatchlistItem.objects.filter(
            watchlist=watchlist,
            symbol=symbol.upper(),
        ).delete()
        if not deleted:
            raise NotFound(f'{symbol} không tồn tại trong watchlist {watchlist_id}.')
        return Response(status=status.HTTP_204_NO_CONTENT)
