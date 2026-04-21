from datetime import date
import logging

from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .exceptions import ExternalSystemException
from .models import IntradayTick
from .whale_scoring import resolve_whale_score_config
from .services_realtime_cache import (
    _cache_get,
    _cache_set,
    _is_vnstock_rate_limited,
    _mark_vnstock_rate_limited,
)
from .services_realtime_adapter import (
    fetch_intraday_dataframe,
)
from .whale_feed_helpers import (
    _build_whale_order_payload,
    _dataframe_has_threshold_hits,
    _resolve_user_whale_threshold_vnd,
)

logger = logging.getLogger(__name__)


class WhaleFeedView(APIView):
    """
    GET /api/realtime/whale-feed/<symbol>/
    Trả về các lệnh lớn trong phiên + tóm tắt dòng tiền từ intraday data.
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'realtime_whale_feed'

    def get(self, request, symbol):
        import pandas as pd

        normalized_symbol = (symbol or '').strip().upper()
        if not normalized_symbol or len(normalized_symbol) > 10:
            return Response({'detail': 'Thiếu mã chứng khoán.'}, status=status.HTTP_400_BAD_REQUEST)

        from .services import WhaleSignalEngine
        threshold_vnd, threshold_source = WhaleSignalEngine.resolve_threshold_vnd(request.user, normalized_symbol)
        score_config = resolve_whale_score_config()
        request_now = timezone.now()

        cache_key = f'whale_feed:{request.user.id}:{normalized_symbol}:{int(threshold_vnd)}'
        cached = _cache_get(cache_key)
        if cached is not None:
            return Response(cached)

        stream_df = None
        stream_has_hits = False
        try:
            from portfolio.realtime.stream_reader import StreamReader

            reader = StreamReader()
            stream_ticks = reader.get_intraday_ticks(normalized_symbol, count=500)
            if stream_ticks:
                stream_df = pd.DataFrame(
                    [
                        {
                            'price': float(t.get('price', 0)) * 0.001,  # Scale to k VND
                            'volume': float(t.get('volume', 0)),
                            'match_type': t.get('side', 'UNKNOWN'),
                            'side': t.get('side', 'UNKNOWN'),
                        }
                        for t in stream_ticks if float(t.get('volume', 0)) > 0
                    ]
                )
                stream_has_hits = _dataframe_has_threshold_hits(stream_df, threshold_vnd)
        except (Exception, SystemExit) as exc:
            logger.debug('WhaleFeed stream fallback failed for %s: %s', normalized_symbol, exc)

        db_df = None
        db_has_hits = False
        if stream_df is None or stream_df.empty or not stream_has_hits:
            db_rows = list(
                IntradayTick.objects.filter(symbol=normalized_symbol, trade_date=timezone.localdate())
                .order_by('-trade_time', '-id')
                .values('trade_time', 'price', 'volume', 'match_type', 'side')
            )
            if db_rows:
                db_df = pd.DataFrame(
                    [
                        {
                            'time': row['trade_time'].isoformat() if row.get('trade_time') else '',
                            'price': float(row.get('price') or 0),
                            'volume': float(row.get('volume') or 0),
                            'match_type': row.get('side') or row.get('match_type') or 'UNKNOWN',
                            'side': row.get('side') or row.get('match_type') or 'UNKNOWN',
                        }
                    for row in db_rows if float(row.get('volume') or 0) > 0
                    ]
                )
                db_has_hits = _dataframe_has_threshold_hits(db_df, threshold_vnd)

        try:
            if stream_df is not None and not stream_df.empty and stream_has_hits:
                df = stream_df
                data_source = 'redis_stream'
            elif db_df is not None and not db_df.empty and db_has_hits:
                df = db_df
                data_source = 'intraday_tick_db'
            elif stream_df is not None and not stream_df.empty:
                df = stream_df
                data_source = 'redis_stream'
            elif db_df is not None and not db_df.empty:
                df = db_df
                data_source = 'intraday_tick_db'
            else:
                try:
                    df = fetch_intraday_dataframe(symbol=normalized_symbol, page_size=100)
                    data_source = 'vnstock'
                except ExternalSystemException as exc:
                    if exc.code == 'vnstock_timeout':
                        logger.warning('WhaleFeedView timeout vnstock fallback %s', normalized_symbol)
                        df = None
                        data_source = 'timeout'
                    elif exc.code == 'vnstock_rate_limited':
                        _mark_vnstock_rate_limited('intraday', exc)
                        logger.info('WhaleFeedView vnstock rate-limited %s - activate cooldown', normalized_symbol)
                        data_source = 'vnstock_backoff'
                        df = None
                    else:
                        logger.warning('WhaleFeedView lỗi vnstock %s: %s', normalized_symbol, exc)
                        data_source = 'unavailable'
                        df = None
        except Exception as exc:
            logger.warning('WhaleFeedView data-source selection error %s: %s', normalized_symbol, exc)
            df = None
            data_source = 'error'

        if df is None or df.empty:
            return Response(
                {
                    'symbol': normalized_symbol,
                    'threshold': threshold_vnd,
                    'threshold_source': threshold_source,
                    'source': locals().get('data_source', 'unknown'),
                    'rate_limited': locals().get('data_source') in ('unavailable', 'timeout', 'vnstock_backoff'),
                    'whale_orders': [],
                    'summary': {
                        'buy_value': 0,
                        'sell_value': 0,
                        'flow_net': 0,
                        'shark_value': 0,
                        'whale_value': 0,
                        'small_value': 0,
                        'shark_pct': 0,
                        'whale_pct': 0,
                        'small_pct': 0,
                    },
                    'fetched_at': timezone.now().isoformat(),
                }
            )

        orders = []
        total_buy_value = 0.0
        total_sell_value = 0.0
        shark_value = 0.0
        whale_value_total = 0.0
        small_value = 0.0

        for _, row in df.iterrows():
            try:
                raw_price = float(row.get('price') or row.get('close') or 0)
                raw_vol = float(row.get('volume') or row.get('vol') or row.get('matchVolume') or 0)
            except (ValueError, TypeError):
                continue
            
            # Normalize price if it looks unscaled (e.g. > 1000)
            if raw_price > 1000:
                raw_price = round(raw_price * 0.001, 3)
            
            matched_value = raw_price * raw_vol * 1000  # Convert to raw VND for threshold comparison

            match_type_raw = str(row.get('match_type') or row.get('matchType') or row.get('side') or '')
            mt_lower = match_type_raw.lower()
            if mt_lower in ('buy', 'bu', 'b'):
                side = 'buy'
            elif mt_lower in ('sell', 'sd', 's'):
                side = 'sell'
            else:
                side = 'neutral'

            if matched_value >= 5_000_000_000:
                size_class = 'shark'
                shark_value += matched_value
            elif matched_value >= 1_000_000_000:
                size_class = 'whale'
                whale_value_total += matched_value
            else:
                size_class = 'small'
                small_value += matched_value

            if side == 'buy':
                total_buy_value += matched_value
            elif side == 'sell':
                total_sell_value += matched_value

            if matched_value >= threshold_vnd:
                raw_time = row.get('time') or row.get('tradingDate') or ''
                orders.append(
                    _build_whale_order_payload(
                        raw_time=raw_time,
                        raw_price=raw_price,
                        raw_vol=raw_vol,
                        matched_value=matched_value,
                        side=side,
                        size_class=size_class,
                        threshold_vnd=threshold_vnd,
                        threshold_source=threshold_source,
                        score_config=score_config,
                        now=request_now,
                    )
                )

        orders.sort(key=lambda x: x['matched_value'], reverse=True)
        total_value = shark_value + whale_value_total + small_value

        result = {
            'symbol': normalized_symbol,
            'threshold': threshold_vnd,
            'threshold_source': threshold_source,
            'source': data_source,
            'weights_version': score_config['version'],
            'whale_orders': orders[:50],
            'summary': {
                'buy_value': total_buy_value,
                'sell_value': total_sell_value,
                'flow_net': total_buy_value - total_sell_value,
                'shark_value': shark_value,
                'whale_value': whale_value_total,
                'small_value': small_value,
                'shark_pct': round(shark_value / total_value * 100, 1) if total_value > 0 else 0,
                'whale_pct': round(whale_value_total / total_value * 100, 1) if total_value > 0 else 0,
                'small_pct': round(small_value / total_value * 100, 1) if total_value > 0 else 0,
            },
            'fetched_at': timezone.now().isoformat(),
        }
        _cache_set(cache_key, result, timeout=20)
        return Response(result)


class RVOLView(APIView):
    """
    GET /api/realtime/rvol/<symbol>/
    Tính RVOL (Relative Volume) theo bucket 15 phút từ intraday data.
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'realtime_rvol'

    def get(self, request, symbol):
        import pandas as pd

        normalized_symbol = (symbol or '').strip().upper()
        if not normalized_symbol or len(normalized_symbol) > 10:
            return Response({'detail': 'Thiếu mã chứng khoán.'}, status=status.HTTP_400_BAD_REQUEST)

        cache_key = f'rvol:{normalized_symbol}'
        cached = _cache_get(cache_key)
        if cached is not None:
            return Response(cached)

        if _is_vnstock_rate_limited('intraday'):
            return Response(
                {
                    'symbol': normalized_symbol,
                    'buckets': [],
                    'source': 'vnstock_backoff',
                    'rate_limited': True,
                    'fetched_at': timezone.now().isoformat(),
                }
            )

        try:
            df = fetch_intraday_dataframe(symbol=normalized_symbol, page_size=500)
        except ExternalSystemException as exc:
            if exc.code == 'vnstock_rate_limited':
                _mark_vnstock_rate_limited('intraday', exc)
                return Response(
                    {
                        'symbol': normalized_symbol,
                        'buckets': [],
                        'source': 'vnstock_backoff',
                        'rate_limited': True,
                        'fetched_at': timezone.now().isoformat(),
                    }
                )
            logger.warning('RVOLView lỗi vnstock %s: %s', normalized_symbol, exc)
            return Response({'detail': f'Không lấy được dữ liệu: {exc.message}'}, status=status.HTTP_502_BAD_GATEWAY)

        if df is None or df.empty:
            return Response({'symbol': normalized_symbol, 'buckets': [], 'fetched_at': timezone.now().isoformat()})

        rows = []
        for _, row in df.iterrows():
            raw_time = row.get('time') or row.get('tradingDate') or ''
            raw_vol = row.get('volume') or row.get('vol') or row.get('matchVolume') or 0
            try:
                ts = pd.Timestamp(str(raw_time))
                vol = float(raw_vol)
                rows.append({'ts': ts, 'volume': vol})
            except Exception:
                continue

        if not rows:
            return Response({'symbol': normalized_symbol, 'buckets': [], 'fetched_at': timezone.now().isoformat()})

        frame = pd.DataFrame(rows).set_index('ts').sort_index()
        buckets_df = frame.resample('15min')['volume'].sum().reset_index()
        buckets_df.columns = ['time', 'volume']

        volumes = buckets_df['volume'].values
        window = min(20, len(volumes))
        sma20_vals = []
        for i in range(len(volumes)):
            start = max(0, i - window)
            sma20_vals.append(float(volumes[start : i + 1].mean()) if i >= 0 else 0.0)

        buckets = []
        for i, row in buckets_df.iterrows():
            vol = float(row['volume'])
            sma20 = sma20_vals[i] if i < len(sma20_vals) else 0.0
            rvol = round(vol / sma20, 2) if sma20 > 0 else 0.0
            try:
                time_str = row['time'].strftime('%H:%M')
            except Exception:
                time_str = str(row['time'])[:5]
            buckets.append(
                {
                    'time': time_str,
                    'volume': int(vol),
                    'sma20': int(sma20),
                    'rvol': rvol,
                    'is_spike': rvol >= 2.0,
                }
            )

        result = {
            'symbol': normalized_symbol,
            'buckets': buckets,
            'fetched_at': timezone.now().isoformat(),
        }
        _cache_set(cache_key, result, timeout=20)
        return Response(result)
