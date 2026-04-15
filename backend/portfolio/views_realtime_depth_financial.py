import logging
import re

from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .exceptions import ExternalSystemException
from .services_realtime_cache import (
    _cache_get,
    _cache_set,
)
from .services_realtime_adapter import (
    fetch_price_board_dataframe,
    fetch_financial_ratio_dataframe,
)

logger = logging.getLogger(__name__)


class DepthChartView(APIView):
    """
    GET /api/realtime/depth-chart/<symbol>/
    Tính độ sâu tích lũy từ price_board để vẽ depth chart (bid/ask mountains).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, symbol):
        normalized_symbol = (symbol or '').strip().upper()
        if not normalized_symbol:
            return Response({'detail': 'Thiếu mã chứng khoán.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            df = fetch_price_board_dataframe([normalized_symbol], anchor_symbol=normalized_symbol)
        except ExternalSystemException as exc:
            logger.warning('DepthChartView lỗi vnstock %s: %s', normalized_symbol, exc)
            return Response({'detail': f'Không lấy được dữ liệu: {exc.message}'}, status=status.HTTP_502_BAD_GATEWAY)

        if df is None or df.empty:
            return Response({'symbol': normalized_symbol, 'bids': [], 'asks': [], 'walls': [], 'reference_price': None})

        def safe_f(val):
            try:
                v = float(val)
                return v if v == v else None
            except (TypeError, ValueError):
                return None

        def safe_i(val):
            try:
                v = float(val)
                return int(v) if v == v else None
            except (TypeError, ValueError):
                return None

        ba = df['bid_ask'].iloc[0]
        mt = df['match'].iloc[0]

        ref_price = safe_f(mt.get('reference_price')) or 0
        ceil_price = safe_f(mt.get('ceiling_price')) or (ref_price * 1.07 if ref_price else None)
        floor_price = safe_f(mt.get('floor_price')) or (ref_price * 0.93 if ref_price else None)

        bids = []
        cum_bid = 0
        for i in range(1, 4):
            bp = safe_f(ba.get(f'bid_{i}_price'))
            bv = safe_i(ba.get(f'bid_{i}_volume'))
            if bp and bv:
                cum_bid += bv
                bids.append({'price': bp, 'volume': bv, 'cumulative': cum_bid})

        asks = []
        cum_ask = 0
        for i in range(1, 4):
            ap = safe_f(ba.get(f'ask_{i}_price'))
            av = safe_i(ba.get(f'ask_{i}_volume'))
            if ap and av:
                cum_ask += av
                asks.append({'price': ap, 'volume': av, 'cumulative': cum_ask})

        all_vols = [b['volume'] for b in bids] + [a['volume'] for a in asks]
        avg_vol = sum(all_vols) / len(all_vols) if all_vols else 1
        wall_threshold = avg_vol * 2

        walls = []
        for b in bids:
            if b['volume'] >= wall_threshold:
                walls.append(
                    {
                        'side': 'bid',
                        'price': b['price'],
                        'volume': b['volume'],
                        'label': f'⚠️ TƯỜNG MUA: {b["volume"]:,}',
                    }
                )
        for a in asks:
            if a['volume'] >= wall_threshold:
                walls.append(
                    {
                        'side': 'ask',
                        'price': a['price'],
                        'volume': a['volume'],
                        'label': f'⚠️ TƯỜNG BÁN: {a["volume"]:,}',
                    }
                )

        return Response(
            {
                'symbol': normalized_symbol,
                'reference_price': ref_price,
                'ceiling_price': ceil_price,
                'floor_price': floor_price,
                'bids': bids,
                'asks': asks,
                'walls': walls,
                'fetched_at': timezone.now().isoformat(),
            }
        )


class FinancialMetricsView(APIView):
    """
    GET /api/stock-management/stocks/<symbol>/financials/
    Trả về chỉ tiêu tài chính theo năm (tối đa 5 năm gần nhất).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, symbol):
        normalized_symbol = (symbol or '').strip().upper()
        if not normalized_symbol:
            return Response({'detail': 'Thiếu mã chứng khoán.'}, status=status.HTTP_400_BAD_REQUEST)

        cache_key = f'financials:{normalized_symbol}'
        cached = _cache_get(cache_key)
        if cached is not None:
            return Response(cached)

        try:
            df = fetch_financial_ratio_dataframe(
                normalized_symbol,
                period='year',
                lang='vi',
                dropna=True,
                source='VCI',
            )
        except ExternalSystemException as exc:
            logger.warning('FinancialMetricsView lỗi vnstock %s: %s', normalized_symbol, exc)
            if exc.code == 'vnstock_missing':
                return Response({'detail': str(exc.message)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            return Response(
                {
                    'symbol': normalized_symbol,
                    'years': [],
                    'source': 'vnstock_unavailable',
                    'fetched_at': timezone.now().isoformat(),
                }
            )
        except Exception as exc:
            logger.exception('FinancialMetricsView unexpected lỗi %s: %s', normalized_symbol, exc)
            return Response(
                {
                    'symbol': normalized_symbol,
                    'years': [],
                    'source': 'error',
                    'fetched_at': timezone.now().isoformat(),
                }
            )

        if df is None or df.empty:
            return Response({'symbol': normalized_symbol, 'years': []})

        def _f(row, key):
            val = row.get(key)
            if val is None:
                return None
            try:
                v = float(val)
                return round(v, 4) if v == v else None
            except (TypeError, ValueError):
                return None

        def _parse_year(value):
            if value is None:
                return None
            try:
                return int(float(value))
            except (TypeError, ValueError):
                match = re.search(r'\d{4}', str(value))
                return int(match.group(0)) if match else None

        years = []
        try:
            for _, row in df.head(5).iterrows():
                year_val = row.get(('Meta', 'Năm')) or row.get('Năm') or row.get('year')
                years.append(
                    {
                        'year': _parse_year(year_val),
                        'eps': _f(row, ('Chỉ tiêu định giá', 'EPS (VND)')),
                        'pe': _f(row, ('Chỉ tiêu định giá', 'P/E')),
                        'pb': _f(row, ('Chỉ tiêu định giá', 'P/B')),
                        'ps': _f(row, ('Chỉ tiêu định giá', 'P/S')),
                        'bvps': _f(row, ('Chỉ tiêu định giá', 'BVPS (VND)')),
                        'market_cap_bn': _f(row, ('Chỉ tiêu định giá', 'Vốn hóa (Tỷ đồng)')),
                        'roe': _f(row, ('Chỉ tiêu khả năng sinh lợi', 'ROE (%)')),
                        'roa': _f(row, ('Chỉ tiêu khả năng sinh lợi', 'ROA (%)')),
                        'net_margin': _f(row, ('Chỉ tiêu khả năng sinh lợi', 'Biên lợi nhuận ròng (%)')),
                        'dividend_yield': _f(row, ('Chỉ tiêu khả năng sinh lợi', 'Tỷ suất cổ tức (%)')),
                        'leverage': _f(row, ('Chỉ tiêu thanh khoản', 'Đòn bẩy tài chính')),
                        'current_ratio': _f(row, ('Chỉ tiêu thanh khoản', 'Hệ số thanh toán hiện hành')),
                        'quick_ratio': _f(row, ('Chỉ tiêu thanh khoản', 'Hệ số thanh toán nhanh')),
                        'debt_equity': _f(row, ('Chỉ tiêu thanh khoản', 'Nợ/Vốn chủ sở hữu')),
                    }
                )
        except Exception as exc:
            logger.exception('FinancialMetricsView parse lỗi %s: %s', normalized_symbol, exc)
            return Response({'detail': 'Không parse được dữ liệu tài chính từ nguồn realtime.'}, status=status.HTTP_502_BAD_GATEWAY)

        result = {
            'symbol': normalized_symbol,
            'years': years,
            'fetched_at': timezone.now().isoformat(),
        }
        _cache_set(cache_key, result, timeout=21600)
        return Response(result)
