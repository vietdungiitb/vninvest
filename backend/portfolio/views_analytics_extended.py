from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.db.models import Max, Q
from datetime import date, timedelta

from .models import Portfolio, DailyPrice
from .analytics import compute_holdings
from .screener_helpers import _screener_build_technical

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
