from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .exceptions import ExternalSystemException, MarketDataValidationException
from .market_data_service import market_data_service


class BaseMarketDataView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]

    def handle_exception_response(self, exc: Exception):
        if isinstance(exc, MarketDataValidationException):
            return Response({'detail': exc.message}, status=status.HTTP_400_BAD_REQUEST)
        if isinstance(exc, ExternalSystemException):
            http_status = status.HTTP_503_SERVICE_UNAVAILABLE if exc.code == 'vnstock_missing' else status.HTTP_502_BAD_GATEWAY
            return Response({'detail': exc.message, **exc.payload}, status=http_status)
        raise exc


class RealtimeTickerView(BaseMarketDataView):
    throttle_scope = 'realtime_ticker'

    def get(self, request, symbol):
        try:
            payload = market_data_service.get_realtime_ticker(symbol)
        except Exception as exc:
            return self.handle_exception_response(exc)
        return Response(payload)


class IntradayMatchedView(BaseMarketDataView):
    throttle_scope = 'realtime_intraday'

    def get(self, request, symbol):
        try:
            payload = market_data_service.get_intraday_matched(
                symbol,
                page_size=request.query_params.get('page_size', 50),
            )
        except Exception as exc:
            return self.handle_exception_response(exc)
        return Response(payload)


class PriceBoardView(BaseMarketDataView):
    throttle_scope = 'realtime_price_board'

    def get(self, request, symbol):
        try:
            payload = market_data_service.get_price_board(symbol)
        except Exception as exc:
            return self.handle_exception_response(exc)
        return Response(payload)


class SectorBreadthView(BaseMarketDataView):
    throttle_scope = 'realtime_breadth'

    def get(self, request, symbol):
        try:
            payload = market_data_service.get_sector_breadth(symbol)
        except Exception as exc:
            return self.handle_exception_response(exc)
        return Response(payload)


class RVOLView(BaseMarketDataView):
    throttle_scope = 'realtime_rvol'

    def get(self, request, symbol):
        try:
            payload = market_data_service.get_rvol(symbol)
        except Exception as exc:
            return self.handle_exception_response(exc)
        return Response(payload)


class WhaleFeedView(BaseMarketDataView):
    throttle_scope = 'realtime_whale_feed'

    def get(self, request, symbol):
        try:
            payload = market_data_service.get_whale_feed(request.user, symbol)
        except Exception as exc:
            return self.handle_exception_response(exc)
        return Response(payload)


class WhaleFeedAggregateView(BaseMarketDataView):
    throttle_scope = 'realtime_whale_aggregate'

    def get(self, request):
        try:
            payload = market_data_service.get_whale_feed_aggregate(request.user, request.query_params)
        except Exception as exc:
            return self.handle_exception_response(exc)
        return Response(payload)


class DepthChartView(BaseMarketDataView):
    def get(self, request, symbol):
        try:
            payload = market_data_service.get_depth_chart(symbol)
        except Exception as exc:
            return self.handle_exception_response(exc)
        return Response(payload)


class FinancialMetricsView(BaseMarketDataView):
    def get(self, request, symbol):
        try:
            payload = market_data_service.get_financial_metrics(symbol)
        except Exception as exc:
            return self.handle_exception_response(exc)
        return Response(payload)


class StockWorkspaceOverviewView(BaseMarketDataView):
    def get(self, request, symbol):
        try:
            payload = market_data_service.get_stock_workspace_overview(request.user, symbol)
        except Exception as exc:
            return self.handle_exception_response(exc)
        return Response(payload)


class StockWorkspaceChartView(BaseMarketDataView):
    throttle_scope = 'realtime_chart'

    def get(self, request, symbol):
        try:
            payload = market_data_service.get_stock_workspace_chart(
                request.user,
                symbol,
                request.query_params.get('days', 180),
            )
        except Exception as exc:
            return self.handle_exception_response(exc)
        return Response(payload)