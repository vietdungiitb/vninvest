import logging
from datetime import datetime, time, timedelta, timezone as dt_timezone

from django.core.cache import cache
from django.db.models import Max
from django.utils import timezone as dj_timezone
from django.utils.dateparse import parse_date
from drf_spectacular.openapi import OpenApiParameter, OpenApiTypes
from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework import generics, permissions, status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

from vninvest_core.pagination import SnapshotCursorPagination

from .models import SessionFacts, SessionFactsBucket, SymbolSnapshot
from .serializers import SessionFactsSerializer, SymbolSnapshotSerializer

_SNAPSHOT_TTL = 15   # seconds — SM-P2.4 cache TTL for market data
_SESSION_FACTS_TTL = 30


def _snapshot_cache_key(symbol: str, session_date) -> str:
    return f'core:snapshot:{symbol.upper()}:{session_date}'


def _session_facts_cache_key(symbol: str, session_date) -> str:
    return f'core:session_facts:{symbol.upper()}:{session_date}'


def _parse_trade_date_param(request):
    raw_trade_date = str(request.query_params.get('trade_date') or '').strip()
    if not raw_trade_date:
        return None

    try:
        parsed_trade_date = parse_date(raw_trade_date)
    except ValueError:
        parsed_trade_date = None
    if parsed_trade_date is None:
        raise ValidationError({
            'detail': 'trade_date phải theo định dạng YYYY-MM-DD.',
            'code': 'invalid_trade_date',
            'field_errors': {
                'trade_date': ['Định dạng không hợp lệ.'],
            },
        })
    return parsed_trade_date


def _parse_cvd_history_period(value):
    """SSOT: `_DARK_MONEY_PERIOD_DAYS`. Import tại function scope để tránh import vòng."""
    from market_data.stock_mgmt_native_views import _DARK_MONEY_PERIOD_DAYS

    raw = str(value or '').strip().upper()
    if raw not in _DARK_MONEY_PERIOD_DAYS:
        return None, None
    return raw, int(_DARK_MONEY_PERIOD_DAYS[raw])


def _cvd_history_candle_dates(symbol: str, start_date, end_date) -> list:
    """Import DailyPrice tại function scope — tránh UnboundLocalError kiểu hotfix :2105-2107."""
    from market_data.models import DailyPrice

    return list(
        DailyPrice.objects.filter(symbol=symbol, date__range=(start_date, end_date))
        .values_list('date', flat=True)
    )


def _get_materialized_session_facts(symbol: str, trade_date=None) -> SessionFacts | None:
    normalized_symbol = symbol.upper()

    if trade_date is not None:
        return SessionFacts.objects.filter(symbol=normalized_symbol, session_date=trade_date).first()

    today = dj_timezone.now().date()

    today_facts = SessionFacts.objects.filter(symbol=normalized_symbol, session_date=today).first()
    if today_facts is not None:
        return today_facts

    return SessionFacts.objects.filter(symbol=normalized_symbol).order_by('-session_date').first()


def _delta_strength_pct_from_facts(obj: SessionFacts) -> float:
    total = (obj.total_buy_volume or 0) + (obj.total_sell_volume or 0)
    if total == 0:
        return 0.0
    return round((obj.whale_net_flow or 0) / total * 100.0, 4)


def _get_materialized_session_fact_buckets(facts: SessionFacts, window: str) -> list[dict]:
    return list(
        SessionFactsBucket.objects
        .filter(session_facts=facts, window=window)
        .order_by('bucket_ts', 'pk')
        .values(
            'bucket_ts',
            'cumulative_cvd',
            'buy_strength',
            'institutional_strength',
            'buy_volume',
            'sell_volume',
        )
    )


def _build_empty_cvd_payload(symbol: str, window: str, bucket_minutes: int, trade_date, detail: str, *, session_date=None, code: str = 'no_data') -> dict:
    resolved_session_date = session_date or trade_date or dj_timezone.localdate()
    return {
        'symbol': symbol,
        'session_date': resolved_session_date.isoformat(),
        'window': window,
        'bucket_minutes': bucket_minutes,
        'cvd_normalized': 0.0,
        'delta_strength_pct': 0.0,
        'whale_net_flow': 0,
        'cvd_series': [],
        'bucket_count': 0,
        'data_status': code,
        'detail': detail,
        'unit': 'vnd',
        'source': 'whale_aggregate',
        'data_quality': 'derived_from_whale_alerts',
        'revision': 0,
        'updated_at': None,
        'trade_count': None,
        'delta': 0,
    }


class SymbolSnapshotListView(generics.ListAPIView):
    serializer_class = SymbolSnapshotSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = SnapshotCursorPagination

    def get_queryset(self):
        qs = SymbolSnapshot.objects.all().order_by('-session_date', 'symbol')
        symbol = self.request.query_params.get('symbol')
        if symbol:
            qs = qs.filter(symbol=symbol.upper())
        return qs


class SymbolSnapshotDetailView(generics.RetrieveAPIView):
    """SM-P2.4: Adds Redis cache layer with 15s TTL."""
    serializer_class = SymbolSnapshotSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        symbol = self.kwargs['symbol'].upper()
        obj = SymbolSnapshot.objects.filter(symbol=symbol).order_by('-session_date').first()
        if not obj:
            raise NotFound(f'No snapshot found for {symbol}')
        return obj

    def retrieve(self, request, *args, **kwargs):
        symbol = self.kwargs['symbol'].upper()
        obj = self.get_object()
        cache_key = _snapshot_cache_key(symbol, obj.session_date)

        try:
            cached = cache.get(cache_key)
        except Exception as e:
            logger.warning(f'SymbolSnapshot cache get failed: {e}')
            cached = None
        if cached is not None:
            data = cached
            data['_source'] = 'cache-hit'
            return Response(data)

        serializer = self.get_serializer(obj)
        data = serializer.data
        try:
            cache.set(cache_key, dict(data), timeout=_SNAPSHOT_TTL)
        except Exception as e:
            logger.warning(f'SymbolSnapshot cache set failed: {e}')
        data = dict(data)
        data['_source'] = 'db-read'
        return Response(data)


import os

_DEV_MODE = os.environ.get('DJANGO_DEBUG', '').strip().lower() in ('1', 'true', 'yes')


class MarketDataThrottle(UserRateThrottle):
    """Market data endpoints — higher limit in dev to avoid 429 during reload."""
    rate = '999999/day' if _DEV_MODE else '120/min'


class SessionFactsListView(generics.ListAPIView):
    """
    GET /api/market/session-facts/

    Danh sách SessionFacts (CVD + Strength) cho toàn bộ hoặc một symbol.
    Hỗ trợ filter ?symbol=VCB. Trả về cursor-paginated list.
    """
    serializer_class = SessionFactsSerializer
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [MarketDataThrottle]
    pagination_class = SnapshotCursorPagination

    def get_queryset(self):
        qs = SessionFacts.objects.all().order_by('-session_date', 'symbol')
        symbol = self.request.query_params.get('symbol')
        if symbol:
            qs = qs.filter(symbol=symbol.upper())
        return qs


@extend_schema(
    summary='Lấy SessionFacts (CVD + Strength) cho một symbol',
    description=(
        'Trả về SessionFacts materialized cho phiên giao dịch hiện tại hoặc gần nhất. '
        'Primary path chỉ đọc read model đã materialize từ WhaleAlertCanonical, '
        'không compute on-demand trong request path. '
        'Cache Redis TTL 30 giây. Xác thực bắt buộc.'
    ),
    parameters=[
        OpenApiParameter(
            name='symbol',
            type=OpenApiTypes.STR,
            location=OpenApiParameter.PATH,
            description='Mã chứng khoán, ví dụ VCB, VPB, HPG.',
            required=True,
        ),
        OpenApiParameter(
            name='trade_date',
            type=OpenApiTypes.DATE,
            location=OpenApiParameter.QUERY,
            description='Ngày phiên cần lấy theo định dạng YYYY-MM-DD. Nếu truyền, endpoint chỉ trả đúng phiên đó hoặc 404.',
            required=False,
        )
    ],
    responses={
        200: SessionFactsSerializer,
        401: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class SessionFactsDetailView(generics.RetrieveAPIView):
    """
    GET /api/market/session-facts/<symbol>/

    Trả về SessionFacts cho symbol theo phiên gần nhất.
    Nếu truyền `trade_date`, endpoint chỉ trả đúng phiên đó hoặc 404.
    Nếu không truyền, endpoint ưu tiên phiên hôm nay rồi fallback về phiên materialized gần nhất.

    Cache TTL: 30 s (Redis).
    """
    serializer_class = SessionFactsSerializer
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [MarketDataThrottle]

    def get_object(self):
        symbol = self.kwargs['symbol'].upper()
        requested_trade_date = _parse_trade_date_param(self.request)
        obj = _get_materialized_session_facts(symbol, trade_date=requested_trade_date)
        if obj is None:
            if requested_trade_date is not None:
                raise NotFound({
                    'detail': f'Không có dữ liệu SessionFacts cho {symbol} ở phiên {requested_trade_date.isoformat()}.',
                    'code': 'not_found',
                })
            raise NotFound(f'Không có dữ liệu SessionFacts cho {symbol}')
        return obj

    def retrieve(self, request, *args, **kwargs):
        symbol = self.kwargs['symbol'].upper()
        obj = self.get_object()
        cache_key = _session_facts_cache_key(symbol, obj.session_date)

        try:
            cached = cache.get(cache_key)
        except Exception as e:
            logger.warning(f'SessionFacts cache get failed: {e}')
            cached = None
        if cached is not None:
            data = dict(cached)
            data['_source'] = 'cache-hit'
            return Response(data)

        serializer = self.get_serializer(obj)
        data = dict(serializer.data)
        try:
            cache.set(cache_key, data, timeout=_SESSION_FACTS_TTL)
        except Exception as e:
            logger.warning(f'SessionFacts cache set failed: {e}')
        data['_source'] = 'db-read'
        return Response(data)


# ── CVD Series endpoint ───────────────────────────────────

_WINDOW_TO_BUCKET_MINUTES: dict[str, int] = {
    '5m': 5, '15m': 15, '30m': 30, '1h': 60, '4h': 240, '1D': 1440, '1d': 1440,
}
_CVD_SERIES_CACHE_TTL = 30   # seconds — same as SessionFacts
# A1 history (window=1D + period). Giới hạn response cho 10Y (~3650 ngày lịch).
_CVD_HISTORY_MAX_BUCKETS = 2600


@extend_schema(
    summary='Lấy chuỗi CVD whale theo bucket thời gian (SSOT)',
    description=(
        'Trả về chuỗi CVD tích lũy theo bucket thời gian cho một symbol, '
        'được đọc từ SessionFacts materialized từ nguồn SSOT duy nhất là '
        '**WhaleAlertCanonical**. Đây là primary read path cho CVD chart, '
        'không compute on-demand trong request path. '
        'Mỗi bucket trả về `bucket_ts` (ISO 8601), `cumulative_cvd` (VND), '
        '`buy_strength`, `institutional_strength`, `buy_volume`, `sell_volume`. '
        'Cache Redis TTL 30 giây. Xác thực bắt buộc.'
    ),
    parameters=[
        OpenApiParameter(
            name='symbol',
            type=OpenApiTypes.STR,
            location=OpenApiParameter.PATH,
            description='Mã chứng khoán, ví dụ VCB, VPB, HPG.',
            required=True,
        ),
        OpenApiParameter(
            name='window',
            type=OpenApiTypes.STR,
            location=OpenApiParameter.QUERY,
            description='Độ rộng bucket: 5m | 15m (mặc định) | 30m | 1h.',
            required=False,
            enum=['5m', '15m', '30m', '1h'],
        ),
        OpenApiParameter(
            name='trade_date',
            type=OpenApiTypes.DATE,
            location=OpenApiParameter.QUERY,
            description='Ngày phiên cần lấy theo định dạng YYYY-MM-DD. Nếu truyền, endpoint khóa đúng selected session; nếu chưa có dữ liệu thì trả payload rỗng.',
            required=False,
        ),
        OpenApiParameter(
            name='period',
            type=OpenApiTypes.STR,
            location=OpenApiParameter.QUERY,
            description='Chỉ có nghĩa với window=1D: 1M | 3M | 6M | 1Y | 10Y. Trả history multi-session; trade_date thắng period.',
            required=False,
            enum=['1M', '3M', '6M', '1Y', '10Y'],
        ),
    ],
    responses={
        200: OpenApiTypes.OBJECT,
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
    },
    examples=[
        OpenApiExample(
            'VPB 15m',
            value={
                'symbol': 'VPB',
                'session_date': '2026-05-13',
                'window': '15m',
                'bucket_minutes': 15,
                'cvd_normalized': 50.0,
                'delta_strength_pct': -100.0,
                'whale_net_flow': -500000000,
                'cvd_series': [
                    {'bucket_ts': '2026-05-13T09:00:00+07:00', 'cumulative_cvd': -250000000.0,
                     'buy_strength': 41.2, 'institutional_strength': 36.5,
                     'buy_volume': 0, 'sell_volume': 250000000},
                ],
                'bucket_count': 1,
                '_source': 'db-read',
            },
        ),
    ],
)
class SessionFactsCvdView(APIView):
    """
    GET /api/market/session-facts/<symbol>/cvd/

    Chuỗi CVD theo bucket từ SSOT duy nhất (WhaleAlertCanonical).
    Dùng để render CVD chart — thay thế cvd_series từ IntradayTick.

    Query params:
      window   — 5m | 15m (default) | 30m | 1h
            trade_date — YYYY-MM-DD; nếu truyền thì khóa đúng selected session

    Response fields:
      symbol, session_date, window, bucket_minutes,
      cvd_normalized, delta_strength_pct, whale_net_flow,
            cvd_series[{bucket_ts, cumulative_cvd, buy_strength,
                                    institutional_strength, buy_volume, sell_volume}],
      bucket_count, _source
    """
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [MarketDataThrottle]

    def _get_cvd_history(self, symbol, window, bucket_minutes, period, days):
        """A1: history đa-session cho window=1D — KHÔNG đụng path legacy."""
        end_date = dj_timezone.localdate()
        start_date = end_date - timedelta(days=days)

        # R1: revision là int Unix (cùng kiểu legacy), lấy max(computed_at) trong khoảng.
        # R2: start/end là khoảng truy vấn: localdate() và localdate()-period_days (inclusive).
        revision_dt = (
            SessionFacts.objects
            .filter(symbol=symbol, session_date__range=(start_date, end_date))
            .aggregate(Max('computed_at'))['computed_at__max']
        )
        revision = int(revision_dt.timestamp()) if revision_dt is not None else 0
        cache_key = (
            f'core:cvd_series:v3:{symbol}:{window}:{period}:'
            f'{start_date.isoformat()}:{end_date.isoformat()}:{revision}'
        )

        try:
            cached = cache.get(cache_key)
        except Exception as e:
            logger.warning('SessionFactsCvd history cache get failed: %s', e)
            cached = None
        if cached is not None:
            return Response({**cached, '_source': 'cache-hit'})

        rows = list(
            SessionFactsBucket.objects
            .filter(
                session_facts__symbol=symbol,
                window='1D',
                session_facts__session_date__range=(start_date, end_date),
            )
            .select_related('session_facts')
            .order_by('bucket_ts', 'pk')
        )

        by_date = {}
        for row in rows:
            by_date.setdefault(row.session_facts.session_date, []).append({
                'session_date': row.session_facts.session_date,
                'bucket_ts': row.bucket_ts,
                'buy_volume': int(row.buy_volume or 0),
                'sell_volume': int(row.sell_volume or 0),
                'buy_strength': row.buy_strength,
                'institutional_strength': row.institutional_strength,
                'pk': row.pk,
            })

        # DailyPrice có date nhưng không có whale bucket ⇒ bucket delta=0, không fabricate alert.
        # Bucket 1D thật được floor trên UTC midnight rồi chiếu localtime (07:00+07:00).
        for candle_day in _cvd_history_candle_dates(symbol, start_date, end_date):
            if candle_day in by_date:
                continue
            by_date[candle_day] = [{
                'session_date': candle_day,
                'bucket_ts': dj_timezone.localtime(
                    datetime.combine(candle_day, time.min, tzinfo=dt_timezone.utc)
                ),
                'buy_volume': 0,
                'sell_volume': 0,
                'buy_strength': 0.0,
                'institutional_strength': 0.0,
                'pk': 0,
            }]

        buckets = []
        for day in sorted(by_date):
            buckets.extend(sorted(by_date[day], key=lambda b: (b['bucket_ts'], b['pk'])))
        if len(buckets) > _CVD_HISTORY_MAX_BUCKETS:
            buckets = buckets[-_CVD_HISTORY_MAX_BUCKETS:]

        if not buckets:
            empty = _build_empty_cvd_payload(
                symbol, window, bucket_minutes, None,
                f'Không có dữ liệu CVD history cho {symbol} ở window {window}.',
                session_date=end_date, code='missing_cvd_buckets',
            )
            empty.update({
                'period': period,
                'history': True,
                'date_from': start_date.isoformat(),
                'date_to': end_date.isoformat(),
                'revision': revision,  # helper chung tra 0 cứng; day la revision that cua khoang
            })
            empty['_source'] = 'no-data'
            return Response(empty)

        # Invariant: cumulative = Σ delta; KHÔNG cộng dồn cumulative_cvd của từng session.
        running = 0
        cumulative = []
        for bucket in buckets:
            delta = bucket['buy_volume'] - bucket['sell_volume']
            running += delta
            cumulative.append(float(running))

        latest_facts = (
            SessionFacts.objects
            .filter(symbol=symbol, session_date__range=(start_date, end_date))
            .order_by('-session_date', '-pk')
            .first()
        )
        data = {
            'symbol': symbol,
            'delta': sum(b['buy_volume'] - b['sell_volume'] for b in buckets),
            'session_date': buckets[-1]['session_date'].isoformat(),
            'window': window,
            'bucket_minutes': bucket_minutes,
            'cvd_normalized': latest_facts.cvd_normalized if latest_facts else 0.0,
            'delta_strength_pct': _delta_strength_pct_from_facts(latest_facts) if latest_facts else 0.0,
            'whale_net_flow': latest_facts.whale_net_flow if latest_facts else 0,
            'unit': 'vnd',
            'source': 'whale_aggregate',
            'data_quality': 'derived_from_whale_alerts',
            'revision': revision,
            'updated_at': dj_timezone.localtime(revision_dt).isoformat() if revision_dt is not None else None,
            'trade_count': None,
            'cvd_series': [
                {
                    'bucket_ts': dj_timezone.localtime(b['bucket_ts']).isoformat(),
                    'cumulative_cvd': cum,
                    'buy_strength': b['buy_strength'],
                    'institutional_strength': b['institutional_strength'],
                    'buy_volume': b['buy_volume'],
                    'sell_volume': b['sell_volume'],
                    'delta': b['buy_volume'] - b['sell_volume'],
                    'trade_count': None,
                }
                for b, cum in zip(buckets, cumulative)
            ],
            'bucket_count': len(buckets),
            'period': period,
            'history': True,
            'date_from': start_date.isoformat(),
            'date_to': end_date.isoformat(),
        }
        try:
            cache.set(cache_key, data, timeout=_CVD_SERIES_CACHE_TTL)
        except Exception as e:
            logger.warning('SessionFactsCvd history cache set failed: %s', e)
        return Response({**data, '_source': 'db-read'})

    def get(self, request, symbol: str):
        from identity_access.permissions import require_pat_scopes_or_human_session
        from rest_framework.exceptions import ValidationError

        require_pat_scopes_or_human_session(request, 'market:read')

        symbol = symbol.strip().upper()
        if not symbol:
            raise ValidationError({'detail': 'Symbol không hợp lệ.', 'code': 'invalid_symbol'})

        raw_window = str(request.query_params.get('window', '15m')).strip()
        window_lc = raw_window.lower()
        _WINDOW_CANONICAL = {'5m': '5m', '15m': '15m', '30m': '30m', '1h': '1h', '4h': '4h', '1d': '1D'}
        if window_lc not in _WINDOW_CANONICAL:
            return Response({'code': 'UNSUPPORTED_WINDOW',
                             'detail': 'window chi nhan 5m | 15m | 30m | 1h | 4h | 1D.'},
                            status=status.HTTP_400_BAD_REQUEST)
        window = _WINDOW_CANONICAL[window_lc]
        bucket_minutes = _WINDOW_TO_BUCKET_MINUTES[window_lc]
        requested_trade_date = _parse_trade_date_param(request)

        # history chỉ có nghĩa với window=1D; trade_date thắng period (kể cả period sai).
        raw_period = str(request.query_params.get('period') or '').strip()
        if window == '1D' and requested_trade_date is None and raw_period:
            period, days = _parse_cvd_history_period(raw_period)
            if period is None:
                return Response(
                    {'code': 'UNSUPPORTED_PERIOD',
                     'detail': 'period chỉ nhận 1M | 3M | 6M | 1Y | 10Y.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return self._get_cvd_history(symbol, window, bucket_minutes, period, days)

        facts = _get_materialized_session_facts(symbol, trade_date=requested_trade_date)
        if facts is None:
            detail = (
                f'Không có dữ liệu SessionFacts cho {symbol} ở phiên {requested_trade_date.isoformat()}.'
                if requested_trade_date is not None
                else f'Không có dữ liệu SessionFacts cho {symbol}.'
            )
            empty_payload = _build_empty_cvd_payload(
                symbol, window, bucket_minutes, requested_trade_date, detail,
                session_date=requested_trade_date,
                code='missing_session_facts',
            )
            empty_payload['_source'] = 'no-data'
            return Response(empty_payload)

        # REV.2.1: version the cache key with the materialization timestamp so a
        # recomputed SessionFacts can never be served with a stale series/revision.
        revision = int(facts.computed_at.timestamp())
        cache_key = f'core:cvd_series:v2:{symbol}:{facts.session_date}:{bucket_minutes}:{revision}'

        try:
            cached = cache.get(cache_key)
        except Exception as e:
            logger.warning('SessionFactsCvd cache get failed: %s', e)
            cached = None

        if cached is not None:
            return Response({**cached, '_source': 'cache-hit'})

        bucket_rows = _get_materialized_session_fact_buckets(facts, window)
        if not bucket_rows:
            detail = f'Không có dữ liệu CVD materialized cho {symbol} ở window {window}.'
            empty_payload = _build_empty_cvd_payload(
                symbol, window, bucket_minutes, requested_trade_date, detail,
                session_date=facts.session_date,
                code='missing_cvd_buckets',
            )
            empty_payload['_source'] = 'no-data'
            return Response(empty_payload)

        top_level_delta = sum(
            int(row['buy_volume']) - int(row['sell_volume']) for row in bucket_rows
        )
        data = {
            'symbol': symbol,
            'delta': top_level_delta,
            'session_date': facts.session_date.isoformat(),
            'window': window,
            'bucket_minutes': bucket_minutes,
            'cvd_normalized': facts.cvd_normalized,
            'delta_strength_pct': _delta_strength_pct_from_facts(facts),
            'whale_net_flow': facts.whale_net_flow,
            'unit': 'vnd',
            'source': 'whale_aggregate',
            'data_quality': 'derived_from_whale_alerts',
            'revision': revision,
            'updated_at': dj_timezone.localtime(facts.computed_at).isoformat(),
            'trade_count': None,  # no raw trade counter in the materialized source
            'cvd_series': [
                {
                    'bucket_ts': dj_timezone.localtime(bucket_row['bucket_ts']).isoformat(),
                    'cumulative_cvd': bucket_row['cumulative_cvd'],
                    'buy_strength': bucket_row['buy_strength'],
                    'institutional_strength': bucket_row['institutional_strength'],
                    'buy_volume': bucket_row['buy_volume'],
                    'sell_volume': bucket_row['sell_volume'],
                    'delta': bucket_row['buy_volume'] - bucket_row['sell_volume'],
                    'trade_count': None,
                }
                for bucket_row in bucket_rows
            ],
            'bucket_count': len(bucket_rows),
        }

        try:
            cache.set(cache_key, data, timeout=_CVD_SERIES_CACHE_TTL)
        except Exception as e:
            logger.warning('SessionFactsCvd cache set failed: %s', e)

        return Response({**data, '_source': 'db-read'})

