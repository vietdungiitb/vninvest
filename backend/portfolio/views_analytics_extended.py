import os
import sys
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.db.models import Max, Q
from datetime import date, timedelta

# Setup path for packages/core imports
_core_backend_src = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '../../packages/core/backend/src')
)
if os.path.exists(_core_backend_src) and _core_backend_src not in sys.path:
    sys.path.insert(0, _core_backend_src)

# Core models (AUTHORITY)
try:
    from user_workspace.models import Portfolio
except (ImportError, RuntimeError):
    from .models import Portfolio  # noqa: F401 - fallback

# Legacy models (remaining)
from .models import DailyPrice
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
    from .market_data_service import MarketDataService

    # 1. Fetch latest rows (snapshot)
    latest_rows = MarketDataService.get_latest_snapshot(symbols)
    if not latest_rows:
        return []

    # 2. Fetch history (90 days)
    # MarketDataService handles the lookup and caching
    history_map = MarketDataService.get_historical_indicators(
        symbols, 
        lookback_days=90,
        include_fields=['date', 'close_price', 'volume', 'high_price', 'low_price']
    )

    results = []
    for sym in symbols:
        latest_row = latest_rows.get(sym.upper())
        if not latest_row:
            continue
            
        sym_history = history_map.get(sym.upper(), [])
        # Adapting snapshot format to _screener_build_technical expectation 
        # (It expects 'symbol' and 'date' in the row dict)
        adapter_row = {**latest_row, 'symbol': sym.upper()}
        
        tech = _screener_build_technical(sym.upper(), adapter_row, history_map)
        results.append({
            'symbol': sym.upper(),
            'date': str(latest_row['date']),
            **tech,
        })
    return results

class PortfolioTechnicalView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, portfolio_id):
        from .market_data_service import MarketDataService
        portfolio = get_object_or_404(Portfolio, pk=portfolio_id, user=request.user)
        
        # 1. Lấy danh sách mã đang nắm giữ
        df_holdings = compute_holdings(portfolio)
        if df_holdings.empty:
            return Response({'technicals': []})
        
        symbols = df_holdings['symbol'].tolist()
        
        # 2. Lấy dữ liệu qua MarketDataService (SSOT)
        # Bulk fetch eliminates N+1 and direct ORM dependency
        latest_rows = MarketDataService.get_latest_snapshot(symbols)
        if not latest_rows:
             return Response({'technicals': []})

        history_map = MarketDataService.get_historical_indicators(
            symbols, 
            lookback_days=90,
            include_fields=['date', 'close_price', 'volume', 'high_price', 'low_price']
        )

        # 3. Build technicals
        results = []
        for symbol in symbols:
            sym_upper = symbol.upper()
            row = latest_rows.get(sym_upper)
            if not row:
                continue
                
            adapter_row = {**row, 'symbol': sym_upper}
            tech = _screener_build_technical(sym_upper, adapter_row, history_map)
            results.append({
                'symbol': sym_upper,
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
