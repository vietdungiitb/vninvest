from rest_framework import status
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from django.conf import settings

from .exceptions import ExternalSystemException, MarketDataValidationException
from .serializers import MarketIntradayQuerySerializer, MarketStockChartQuerySerializer, OHLCVBarsQuerySerializer
from .market_data_service import market_data_service
from .permissions import resolve_user_entitlements
from .quota_service import build_quota_exceeded_payload, consume_quota


class BaseMarketDataView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]

    def handle_exception_response(self, exc: Exception):
        if isinstance(exc, DRFValidationError):
            return Response({'detail': exc.detail}, status=status.HTTP_400_BAD_REQUEST)
        if isinstance(exc, MarketDataValidationException):
            return Response({'detail': exc.message}, status=status.HTTP_400_BAD_REQUEST)
        if isinstance(exc, ExternalSystemException):
            if exc.code in {'vnbroker_missing', 'ticker_cache_miss'}:
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
        entitlements = resolve_user_entitlements(request.user)
        quota_result = consume_quota(request.user, quota_key='api_calls_per_day', entitlements=entitlements)
        if not quota_result.get('allowed', True):
            return Response(
                build_quota_exceeded_payload(quota_result, 'Bạn đã dùng hết quota API trong ngày.'),
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
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


class StockOHLCVBarsView(BaseMarketDataView):
    """
    GET /api/stock-management/stocks/{symbol}/bars/

    Endpoint OHLCV contract mới — hỗ trợ:
      - Window  : ?timeframe=D&from=<unix_ms>&to=<unix_ms>
      - Before  : ?timeframe=D&before=<unix_ms>&limit=500  (pan-left / backfill)
      - After   : ?timeframe=D&after=<unix_ms>&limit=500   (forward polling fallback)

    Response chuẩn hóa:
      {
        "symbol": "TCB",
        "timeframe": "D",
        "bars": [{"timestamp": <unix_ms>, "open":..., "high":..., "low":..., "close":..., "volume":...}],
        "has_more_before": true,
        "has_more_after": false,
        "next_before": <unix_ms | null>,
        "next_after": <unix_ms | null>,
        "snapshot_id": "TCB:D:2026-05-21T15:30Z"
      }

    Error response machine-readable:
      400: {"code": "INVALID_TIMEFRAME" | "INVALID_TIMESTAMP" | ..., "detail": "..."}
      404: {"code": "SYMBOL_NOT_FOUND", "detail": "..."}
    """
    throttle_scope = 'realtime_chart'

    _VALIDATION_CODE_MAP = {
        'invalid_choice': 'INVALID_TIMEFRAME',
        'invalid': 'INVALID_TIMESTAMP',
        'max_value': 'LIMIT_EXCEEDED',
        'min_value': 'INVALID_LIMIT',
        'non_field_errors': 'INVALID_QUERY',
    }

    def _machine_readable_error(self, detail, code: str = 'VALIDATION_ERROR') -> Response:
        if isinstance(detail, dict):
            # Lấy code từ first key
            first_key = next(iter(detail), 'non_field_errors')
            mapped = self._VALIDATION_CODE_MAP.get(first_key, code)
            first_msg = detail[first_key]
            if isinstance(first_msg, list):
                first_msg = str(first_msg[0])
            return Response(
                {'code': mapped, 'detail': first_msg},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if isinstance(detail, list) and detail:
            item = detail[0]
            if hasattr(item, 'code'):
                mapped = self._VALIDATION_CODE_MAP.get(item.code, code)
            else:
                mapped = code
            return Response(
                {'code': mapped, 'detail': str(item)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({'code': code, 'detail': str(detail)}, status=status.HTTP_400_BAD_REQUEST)

    def get(self, request, symbol):
        from rest_framework.exceptions import ValidationError as DRFVErr

        # Validate input
        serializer = OHLCVBarsQuerySerializer(data=request.query_params)
        if not serializer.is_valid():
            return self._machine_readable_error(serializer.errors)

        params = serializer.validated_data

        try:
            payload = market_data_service.get_ohlcv_bars(symbol, params)
        except MarketDataValidationException as exc:
            return Response(
                {'code': 'SYMBOL_NOT_FOUND', 'detail': exc.message},
                status=status.HTTP_404_NOT_FOUND,
            )
        except DRFVErr as exc:
            return self._machine_readable_error(exc.detail)
        except Exception as exc:
            return self.handle_exception_response(exc)

        return Response(payload)
