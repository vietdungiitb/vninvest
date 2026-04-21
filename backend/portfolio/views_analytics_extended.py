from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.db.models import Max, Q
from datetime import date, timedelta

from .models import Portfolio, DailyPrice
from .analytics import compute_holdings
from .screener_helpers import _screener_build_technical


def _normalize_symbol_list(raw_symbols, max_symbols=100):
    if not isinstance(raw_symbols, list):
        return None, 'Truong symbols phai la array.'

    normalized = []
    seen = set()
    for value in raw_symbols:
        symbol = str(value or '').strip().upper()
        if not symbol:
            continue
        if symbol in seen:
            continue
        seen.add(symbol)
        normalized.append(symbol)

    if not normalized:
        return None, 'Danh sach symbols khong duoc rong.'

    if len(normalized) > max_symbols:
        return None, f'Danh sach symbols vuot qua gioi han {max_symbols} ma.'

    return normalized, None


def _build_symbol_technicals(symbols):
    latest_dates = DailyPrice.objects.filter(symbol__in=symbols).values('symbol').annotate(latest=Max('date'))
    symbol_date_map = {row['symbol']: row['latest'] for row in latest_dates}

    if not symbol_date_map:
        return []

    query = Q()
    for sym in symbols:
        latest_date = symbol_date_map.get(sym)
        if latest_date:
            query |= Q(symbol=sym, date=latest_date)

    rows = []
    if query:
        rows = list(
            DailyPrice.objects
            .filter(query)
            .values('symbol', 'close_price', 'volume', 'open_price', 'high_price', 'low_price', 'date')
        )

    history_map = {}
    cutoff = date.today() - timedelta(days=90)
    hist_qs = (
        DailyPrice.objects
        .filter(symbol__in=symbols, date__gte=cutoff)
        .values('symbol', 'date', 'close_price', 'volume', 'high_price', 'low_price')
        .order_by('symbol', 'date')
    )
    for row in hist_qs:
        history_map.setdefault(row['symbol'], []).append(row)

    latest_row_map = {row['symbol']: row for row in rows}
    results = []
    for sym in symbols:
        latest_row = latest_row_map.get(sym)
        if not latest_row:
            continue
        tech = _screener_build_technical(sym, latest_row, history_map)
        results.append({
            'symbol': sym,
            'date': str(latest_row['date']),
            **tech,
        })
    return results

class PortfolioTechnicalView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, portfolio_id):
        portfolio = get_object_or_404(Portfolio, pk=portfolio_id, user=request.user)
        
        # 1. Lấy danh sách mã đang nắm giữ
        df_holdings = compute_holdings(portfolio)
        if df_holdings.empty:
            return Response({'technicals': []})
        
        symbols = df_holdings['symbol'].tolist()
        
        # 2. Lấy giá mới nhất
        latest_dates = DailyPrice.objects.filter(symbol__in=symbols).values('symbol').annotate(latest=Max('date'))
        symbol_date_map = {row['symbol']: row['latest'] for row in latest_dates}
        
        if not symbol_date_map:
             return Response({'technicals': []})

        rows = []
        for sym in symbols:
            d = symbol_date_map.get(sym)
            if d:
                row = DailyPrice.objects.filter(symbol=sym, date=d).values(
                    'symbol', 'close_price', 'volume', 'open_price', 'high_price', 'low_price', 'date'
                ).first()
                if row:
                    rows.append(row)

        # 3. Lấy lịch sử 90 ngày để tính RSI/SMA (đảm bảo đủ ít nhất 50 phiên giao dịch)
        history_map = {}
        cutoff = date.today() - timedelta(days=90)
        hist_qs = (
            DailyPrice.objects
            .filter(symbol__in=symbols, date__gte=cutoff)
            .values('symbol', 'date', 'close_price', 'volume', 'high_price', 'low_price')
            .order_by('symbol', 'date')
        )
        for row in hist_qs:
            sym = row['symbol']
            if sym not in history_map:
                history_map[sym] = []
            history_map[sym].append(row)

        # 4. Build technicals
        results = []
        for row in rows:
            sym = row['symbol']
            tech = _screener_build_technical(sym, row, history_map)
            results.append({
                'symbol': sym,
                'date': str(row['date']),
                **tech
            })

        return Response({'technicals': results})


class BulkTechnicalBySymbolsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        symbols, err = _normalize_symbol_list(request.data.get('symbols'), max_symbols=100)
        if err:
            return Response({'detail': err}, status=status.HTTP_400_BAD_REQUEST)

        results = _build_symbol_technicals(symbols)
        return Response({
            'technicals': results,
            'requested_symbols': symbols,
            'requested_count': len(symbols),
            'resolved_count': len(results),
        })
