import logging

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .market_data_service import market_data_service
from .services_realtime_cache import (
    _cache_get,
    _cache_set,
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
        normalized_symbol = (symbol or '').strip().upper()
        if not normalized_symbol or len(normalized_symbol) > 10:
            return Response({'detail': 'Thiếu mã chứng khoán.'}, status=status.HTTP_400_BAD_REQUEST)

        threshold_vnd, _threshold_source = market_data_service._get_user_whale_threshold_with_source_vnd(
            request.user,
            symbol=normalized_symbol,
        )
        cache_key = f'whale_feed:{request.user.id}:{normalized_symbol}:{int(threshold_vnd)}'
        cached = _cache_get(cache_key)
        if cached is not None:
            return Response(cached)

        try:
            result = market_data_service.get_whale_feed(request.user, normalized_symbol)
        except Exception as exc:
            logger.warning('WhaleFeedView canonical service error %s: %s', normalized_symbol, exc)
            result = market_data_service._build_empty_whale_feed_response(
                normalized_symbol,
                threshold_vnd,
                'error',
            )

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
