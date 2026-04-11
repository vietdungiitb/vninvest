from rest_framework import status
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .exceptions import ExternalSystemException, MarketDataValidationException
from .serializers import MarketIntradayQuerySerializer, MarketStockChartQuerySerializer
from .market_data_service import market_data_service


class BaseMarketDataView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]

    def handle_exception_response(self, exc: Exception):
        if isinstance(exc, DRFValidationError):
            return Response({'detail': exc.detail}, status=status.HTTP_400_BAD_REQUEST)
        if isinstance(exc, MarketDataValidationException):
            return Response({'detail': exc.message}, status=status.HTTP_400_BAD_REQUEST)
        if isinstance(exc, ExternalSystemException):
            http_status = status.HTTP_503_SERVICE_UNAVAILABLE if exc.code == 'vnstock_missing' else status.HTTP_502_BAD_GATEWAY
            return Response({'detail': exc.message, **exc.payload}, status=http_status)
        return Response(
            {'detail': 'Lỗi ngoài dự kiến từ dịch vụ dữ liệu thị trường.'},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    def validate_query(self, serializer_class, query_params):
        serializer = serializer_class(data=query_params)
        serializer.is_valid(raise_exception=True)
        return serializer.validated_data


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
            query_data = self.validate_query(MarketIntradayQuerySerializer, request.query_params)
            payload = market_data_service.get_intraday_matched(
                symbol,
                page_size=query_data['page_size'],
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


class WhaleCampaignsView(BaseMarketDataView):
    throttle_scope = 'realtime_whale_aggregate'

    def get(self, request):
        try:
            payload = market_data_service.get_whale_campaigns(request.user, request.query_params)
        except Exception as exc:
            return self.handle_exception_response(exc)
        return Response(payload)


class UnifiedAlertsView(BaseMarketDataView):
    throttle_scope = 'realtime_whale_aggregate'

    def get(self, request):
        try:
            payload = market_data_service.get_unified_alerts(request.user, request.query_params)
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
            query_data = self.validate_query(MarketStockChartQuerySerializer, request.query_params)
            payload = market_data_service.get_stock_workspace_chart(
                request.user,
                symbol,
                query_data['days'],
            )
        except Exception as exc:
            return self.handle_exception_response(exc)
        return Response(payload)