"""
Market Data domain REST API views.

Endpoints:
  GET /core/v1/market-data/symbols/                    — list StockProfile
  GET /core/v1/market-data/symbols/<symbol>/           — StockProfile detail
  GET /core/v1/market-data/daily-prices/<symbol>/      — DailyPrice history
"""
from rest_framework import permissions, status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from vninvest_core.legacy_http_bridge import legacy_bridge_response

from .models import DailyPrice, StockProfile
from .serializers import DailyPriceSerializer, StockProfileSerializer


class StockProfileListView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    _PAGE_SIZE = 100

    def get(self, request):
        qs = StockProfile.objects.filter(status='active').order_by('symbol')
        exchange = request.query_params.get('exchange')
        if exchange:
            qs = qs.filter(exchange=exchange.upper())
        industry = request.query_params.get('industry')
        if industry:
            qs = qs.filter(industry__icontains=industry)
        try:
            page = max(1, int(request.query_params.get('page', 1)))
        except ValueError:
            page = 1
        offset = (page - 1) * self._PAGE_SIZE
        results = qs[offset: offset + self._PAGE_SIZE]
        return Response({
            'results': StockProfileSerializer(results, many=True).data,
            'page': page,
            'page_size': self._PAGE_SIZE,
        })


class StockProfileDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        symbol = symbol.upper()
        try:
            profile = StockProfile.objects.get(symbol=symbol)
        except StockProfile.DoesNotExist:
            raise NotFound(f'Stock profile not found for {symbol}')
        return Response(StockProfileSerializer(profile).data)


class DailyPriceListView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    _PAGE_SIZE = 250

    def get(self, request, symbol):
        symbol = symbol.upper()
        qs = DailyPrice.objects.filter(symbol=symbol).order_by('-date')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)

        try:
            page = max(1, int(request.query_params.get('page', 1)))
        except ValueError:
            page = 1
        offset = (page - 1) * self._PAGE_SIZE
        results = qs[offset: offset + self._PAGE_SIZE]
        return Response({
            'symbol': symbol,
            'results': DailyPriceSerializer(results, many=True).data,
            'page': page,
            'page_size': self._PAGE_SIZE,
        })


class TrackedSymbolsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        bridged_response = legacy_bridge_response(
            request,
            '/api/stock-management/tracked-symbols/',
            unavailable_message='Legacy tracked-symbol bridge hiện không khả dụng.',
        )
        if bridged_response is not None:
            return bridged_response
        return Response([])

    def post(self, request):
        bridged_response = legacy_bridge_response(
            request,
            '/api/stock-management/tracked-symbols/',
            unavailable_message='Legacy tracked-symbol bridge hiện không khả dụng.',
        )
        if bridged_response is not None:
            return bridged_response
        return Response({'detail': 'Feature not yet available in SaaS.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
