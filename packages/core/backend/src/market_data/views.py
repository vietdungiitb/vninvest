"""
Market Data domain REST API views.

Endpoints:
  GET /core/v1/market-data/symbols/                    — list StockProfile
  GET /core/v1/market-data/symbols/<symbol>/           — StockProfile detail
  GET /core/v1/market-data/daily-prices/<symbol>/      — DailyPrice history
"""
from datetime import timedelta

from rest_framework import permissions, status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone

from .envelope import envelope, paginated_envelope
from .models import DailyPrice, IntradayBar, IntradayTick, StockProfile
from .serializers import DailyPriceSerializer, StockProfileSerializer


from vninvest_core.pagination import CoreCursorPagination
from drf_spectacular.utils import extend_schema
from drf_spectacular.openapi import OpenApiTypes
from vninvest_core.api_envelope import envelope_response


class StockProfileCursorPagination(CoreCursorPagination):
    ordering = 'symbol'
    page_size = 100

@extend_schema(
    summary='StockProfileListView',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class StockProfileListView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StockProfileCursorPagination

    def get(self, request):
        qs = StockProfile.objects.filter(status='active').order_by('symbol')
        search = request.query_params.get('search') or request.query_params.get('q')
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(symbol__icontains=search) |
                Q(company_name__icontains=search)
            )
            # N3 — xếp hạng kết quả tìm kiếm.
            #
            # Bằng chứng (2026-09-26, `StockProfile` 1399 mã active): trước khi
            # sửa, gõ `VIC` trả về `ABS, ACS, AST` — vì `icontains` khớp cả
            # chuỗi con trong TÊN CÔNG TY ("Se**rvic**e", "Tase**co** A**vi**on**s",
            # "**Arc**hitec**ts**") và `order_by('symbol')` đẩy mã đúng xuống
            # cuối. Gõ `SSI` cũng vậy. Người dùng gõ mã cổ phiếu mà không thấy
            # mã đó ở đầu, dễ kết luận chức năng tìm kiếm hỏng.
            #
            # Thứ tự ưu tiên: khớp CHÍNH XÁC mã > mã bắt đầu bằng chuỗi > tên
            # công ty. `symbol` giữ làm khoá phụ để thứ tự vẫn tất định — bắt buộc
            # với cursor pagination (thiếu khoá phụ thì vị trí trang không ổn định).
            from django.db.models import Case, IntegerField, Value, When
            qs = qs.annotate(
                _n3_rank=Case(
                    When(symbol__iexact=search, then=Value(0, output_field=IntegerField())),
                    When(symbol__istartswith=search, then=Value(1, output_field=IntegerField())),
                    default=Value(2, output_field=IntegerField()),
                )
            ).order_by('_n3_rank', 'symbol')
        exchange = request.query_params.get('exchange')
        if exchange:
            qs = qs.filter(exchange=exchange.upper())
        industry = request.query_params.get('industry')
        if industry:
            qs = qs.filter(industry__icontains=industry)

        paginator = self.pagination_class()
        # N3 — `CursorPagination` ghi đè `order_by` của queryset bằng
        # `paginator.ordering`, nên annotation `_n3_rank` phải được khai báo
        # ở paginator mới có tác dụng. Chỉ đổi khi có `q` để giữ nguyên hành vi
        # cũ của lệnh list thuần (lọc exchange/industry, không tìm kiếm).
        if search:
            paginator.ordering = ('_n3_rank', 'symbol')
        page = paginator.paginate_queryset(qs, request)
        if page is not None:
            serializer = StockProfileSerializer(page, many=True)
            paged = paginator.get_paginated_response(serializer.data)
            # Bọc cả khối phân trang trong `data`. `dict(paged.data)` vì paginator
            # trả `Response`, không trả dict. Cursor ⇒ không có `count`.
            return paginated_envelope(dict(paged.data))

        # Nhánh fallback: phải bọc **giống hệt** nhánh trên, nếu không endpoint
        # này có HAI shape cùng lúc.
        serializer = StockProfileSerializer(qs, many=True)
        return paginated_envelope({'results': serializer.data})


@extend_schema(
    summary='StockProfileDetailView',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class StockProfileDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        symbol = symbol.upper()
        try:
            profile = StockProfile.objects.get(symbol=symbol)
        except StockProfile.DoesNotExist:
            raise NotFound(f'Stock profile not found for {symbol}')
        return envelope(StockProfileSerializer(profile).data)


class DailyPriceCursorPagination(CoreCursorPagination):
    ordering = ('-date', '-id')
    page_size = 250

@extend_schema(
    summary='DailyPriceListView',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class DailyPriceListView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = DailyPriceCursorPagination

    def get(self, request, symbol):
        symbol = symbol.upper()
        qs = DailyPrice.objects.filter(symbol=symbol).order_by('-date', '-id')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request)
        if page is not None:
            serializer = DailyPriceSerializer(page, many=True)
            paged = paginator.get_paginated_response(serializer.data)
            # `symbol` phải nằm BÊN TRONG `data`, **không** phải ngang hàng
            # `data`/`meta`. Bản gốc ghi `response.data['symbol']`; bọc phẳng rồi
            # ghi tiếp sẽ ra `{symbol, data, meta}` — vừa hỏng envelope vừa hỏng
            # client. Nên copy khối phân trang ra dict, thêm `symbol`, rồi bọc.
            page_body = dict(paged.data)
            page_body['symbol'] = symbol
            return paginated_envelope(page_body)

        # Nhánh fallback: bọc giống hệt nhánh trên.
        serializer = DailyPriceSerializer(qs, many=True)
        return paginated_envelope({
            'symbol': symbol,
            'results': serializer.data,
        })


class StockChartView(APIView):
    """
    Native stock chart endpoint for frontend consumption.
    
    GET /api/stock-management/stocks/{symbol}/chart/?days=180&timeframe=1H
    
    Returns OHLCV daily price data in the format expected by frontend KLineChartPanel.
    For intraday timeframes, returns empty points (intraday not yet in core_db).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        from datetime import timedelta, datetime, time
        
        symbol = symbol.upper()
        
        # Validate input
        try:
            days = max(1, min(int(request.query_params.get('days', 180)), 3650))
        except (TypeError, ValueError):
            days = 180
        
        timeframe = str(request.query_params.get('timeframe', '1H')).strip().upper()
        
        # For intraday frames, return empty (not yet available in core_db)
        intraday_frames = ('1M', '5M', '15M', '1H', '2H', '4H')
        if timeframe in intraday_frames:
            return envelope({
                'symbol': symbol,
                'days': days,
                'timeframe': timeframe,
                'interval': timeframe.lower(),
                'start_date': timezone.now().date().isoformat(),
                'end_date': timezone.now().date().isoformat(),
                'points': [],
                'technical': {
                    'change_percent': None,
                    'rsi_14': None,
                    'macd': None,
                    'macd_signal': None,
                    'atr_14': None,
                    'volatility_20': None,
                    'volume_ratio': None,
                },
            })
        
        # Daily/weekly/monthly frames: query DailyPrice
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=days)
        
        qs = (
            DailyPrice.objects
            .filter(symbol=symbol, date__range=[start_date, end_date])
            .order_by('date')
        )
        
        # Serialize to OHLCV points
        points = []
        for row in qs:
            points.append({
                'date': datetime.combine(row.date, time.min).isoformat(),
                'open': float(row.open_price) if row.open_price is not None else None,
                'high': float(row.high_price) if row.high_price is not None else None,
                'low': float(row.low_price) if row.low_price is not None else None,
                'close': float(row.close_price) if row.close_price is not None else None,
                'volume': int(row.volume) if row.volume is not None else None,
            })
        
        # Basic technical indicators (placeholder)
        technical = {
            'change_percent': None,
            'rsi_14': None,
            'macd': None,
            'macd_signal': None,
            'atr_14': None,
            'volatility_20': None,
            'volume_ratio': None,
        }
        
        if points:
            first_close = points[0].get('close')
            last_close = points[-1].get('close')
            if first_close and last_close:
                technical['change_percent'] = round(
                    ((last_close - first_close) / first_close) * 100, 2
                )
        
        return envelope({
            'symbol': symbol,
            'days': days,
            'timeframe': timeframe,
            'interval': timeframe.lower(),
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'points': points,
            'technical': technical,
        })


class TrackedSymbolsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from user_workspace.models import WatchlistItem

        items = (
            WatchlistItem.objects
            .filter(watchlist__user=request.user)
            .order_by('-added_at', '-pk')
        )
        seen_symbols = set()
        payload = []
        for item in items:
            symbol = str(item.symbol or '').upper().strip()
            if not symbol or symbol in seen_symbols:
                continue
            seen_symbols.add(symbol)
            payload.append(
                {
                    'id': item.pk,
                    'symbol': symbol,
                    'note': item.note or '',
                }
            )
        return envelope(payload)

    def post(self, request):
        from user_workspace.models import Watchlist, WatchlistItem

        raw_symbol = request.data.get('symbol') or request.data.get('ticker') or request.data.get('code')
        symbol = str(raw_symbol or '').upper().strip()
        if not symbol:
            return Response({'detail': 'symbol là bắt buộc.'}, status=status.HTTP_400_BAD_REQUEST)

        watchlist = (
            Watchlist.objects
            .filter(user=request.user)
            .order_by('-is_default', 'name', 'pk')
            .first()
        )
        if watchlist is None:
            tenant = getattr(request.user, 'core_tenant', None)
            watchlist = Watchlist.objects.create(
                user=request.user,
                tenant=tenant,
                name='Danh mục theo dõi',
                description='Tạo tự động cho tracked symbols.',
                is_default=True,
            )

        item, created = WatchlistItem.objects.get_or_create(
            watchlist=watchlist,
            symbol=symbol,
            defaults={'note': str(request.data.get('note') or '')[:255]},
        )
        return envelope(
            {
                'id': item.pk,
                'symbol': item.symbol,
                'note': item.note or '',
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


@extend_schema(
    summary='IntradayPricesView',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class IntradayPricesView(APIView):
    """
    GET /core/v1/market-data/intraday-prices/{symbol}/

    Phase 2: Query native IntradayBar model (replaces bridge).

    Query params:
        timeframe: 1m|5m|15m|1H|2H|4H|D|W|M  (default: 1H)
        days: int  (default: 180)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        symbol = symbol.upper()
        timeframe = request.query_params.get('timeframe', '1H')
        try:
            days = max(1, min(int(request.query_params.get('days', 180)), 3650))
        except (TypeError, ValueError):
            days = 180

        cutoff = timezone.now() - timedelta(days=days)
        bars = list(
            IntradayBar.objects.filter(symbol=symbol, timeframe=timeframe, datetime__gte=cutoff)
            .order_by('datetime')
        )

        return envelope({
            'symbol': symbol,
            'days': len(bars),
            'timeframe': timeframe,
            'interval': timeframe.lower(),
            'points': [
                {
                    'date': bar.datetime.isoformat(),
                    'open': float(bar.open),
                    'high': float(bar.high),
                    'low': float(bar.low),
                    'close': float(bar.close),
                    'volume': bar.volume,
                }
                for bar in bars
            ],
            'technical': {},
            'source': 'intraday_bar_db',
        })


@extend_schema(
    summary='IntradayTapeView',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class IntradayTapeView(APIView):
    """
    GET /core/v1/market-data/intraday-tape/{symbol}/

    Phase 2: Query native IntradayTick model with Redis cache (5 min TTL).

    Query params:
        page_size: int  (default: 50)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        symbol = symbol.upper()
        try:
            page_size = max(1, min(int(request.query_params.get('page_size', 50)), 200))
        except (TypeError, ValueError):
            page_size = 50

        served_at = timezone.now()
        latest_tick = (
            IntradayTick.objects.filter(symbol=symbol)
            .only('timestamp', 'created_at')
            .order_by('-timestamp')
            .first()
        )
        if latest_tick is None:
            return envelope({
                'symbol': symbol,
                'trades': [],
                'total': 0,
                'source': 'intraday_tick_db_missing',
                'stale': True,
                'fetched_at': None,
                'source_event_at': None,
                'served_at': served_at.isoformat(),
                'age_seconds': None,
            })

        latest_trade_date = timezone.localdate(latest_tick.timestamp)
        tick_rows = list(
            IntradayTick.objects.filter(symbol=symbol, timestamp__date=latest_trade_date)
            .order_by('-timestamp')[:page_size]
        )
        age_seconds = max(int((served_at - latest_tick.timestamp).total_seconds()), 0)

        return envelope({
            'symbol': symbol,
            'trades': [
                {
                    'time': timezone.localtime(t.timestamp).strftime('%H:%M:%S'),
                    'ts': t.timestamp.isoformat(),
                    'price': float(t.price),
                    'volume': t.volume,
                    'side': t.side,
                    'match_type': t.match_type or 'NormalMatch',
                }
                for t in tick_rows
            ],
            'total': len(tick_rows),
            'source': 'intraday_tick_db',
            'stale': latest_trade_date != timezone.localdate(),
            'fetched_at': latest_tick.created_at.isoformat() if latest_tick.created_at else latest_tick.timestamp.isoformat(),
            'source_event_at': latest_tick.timestamp.isoformat(),
            'served_at': served_at.isoformat(),
            'age_seconds': age_seconds,
        })
