from rest_framework import status
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from django.conf import settings

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
            if exc.code in {'vnstock_missing', 'ticker_cache_miss'}:
                configured_status = int(getattr(settings, 'TICKER_CACHE_MISS_STATUS_CODE', 503) or 503)
                http_status = configured_status if configured_status in {200, 503} else status.HTTP_503_SERVICE_UNAVAILABLE
            else:
                http_status = status.HTTP_502_BAD_GATEWAY
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


class BatchRealtimeTickerView(BaseMarketDataView):
    throttle_scope = 'realtime_ticker_batch'

    def get(self, request):
        symbols_str = request.query_params.get('symbols', '')
        if not symbols_str:
            return Response({'detail': 'Tham số symbols là bắt buộc.'}, status=status.HTTP_400_BAD_REQUEST)
            
        symbols = [s.strip().upper() for s in symbols_str.split(',') if s.strip()]
        if not symbols:
            return Response({'detail': 'Danh sách symbols không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)
            
        if len(symbols) > 50:
            return Response({'detail': 'Tối đa 50 mã mỗi lần yêu cầu.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            payload = market_data_service.get_realtime_tickers(symbols)
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
            response = self.handle_exception_response(exc)
            if response.status_code != status.HTTP_502_BAD_GATEWAY:
                return response
            # Keep stock detail UI responsive when upstream intraday source is flaky.
            return Response(
                {
                    'symbol': str(symbol or '').strip().upper(),
                    'trades': [],
                    'total': 0,
                    'source': 'intraday_degraded',
                    'stale': True,
                    'fallback_reason': 'backend_502_guard',
                    'fetched_at': None,
                    'source_event_at': None,
                    'detail': 'intraday_degraded_fallback',
                },
                status=status.HTTP_200_OK,
            )
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
        except ExternalSystemException:
            payload = {
                'symbol': str(symbol or '').strip().upper(),
                'buckets': [],
                'source': 'degraded_external_error',
                'fetched_at': None,
            }
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
            timeframe = query_data.get('timeframe')
            if timeframe in (None, '', '1H'):
                payload = market_data_service.get_stock_workspace_chart(
                    request.user,
                    symbol,
                    query_data['days'],
                )
            else:
                payload = market_data_service.get_stock_workspace_chart(
                    request.user,
                    symbol,
                    query_data['days'],
                    timeframe,
                )
        except Exception as exc:
            return self.handle_exception_response(exc)
        return Response(payload)