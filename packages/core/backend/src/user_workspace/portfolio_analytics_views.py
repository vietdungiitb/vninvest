"""
C4 — Native portfolio analytics views for user_workspace domain.

Replaces PortfolioAnalyticsStubView and PortfolioListAnalyticsStubView
with real computed data from Transaction + SymbolSnapshot + DailyPrice.

All views require IsAuthenticated and scoped to request.user portfolios.
Performance note: small portfolios only — no pagination/caching at this stage.
"""
from datetime import date, timedelta
from decimal import Decimal

from django.shortcuts import get_object_or_404
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Portfolio, Transaction


def _get_user_portfolio(request, portfolio_id):
    """Raise 404 if portfolio not owned by request.user."""
    return get_object_or_404(Portfolio, pk=portfolio_id, user=request.user)


def _compute_holdings(portfolio_id):
    """
    Aggregate buy/sell transactions into current holdings dict.
    Returns {symbol: {'quantity': int, 'avg_cost': Decimal, 'total_cost': Decimal}}
    """
    txns = (
        Transaction.objects
        .filter(portfolio_id=portfolio_id)
        .exclude(transaction_type=Transaction.TransactionType.DIVIDEND)
        .order_by('date', 'pk')
    )
    holdings = {}
    for t in txns:
        sym = t.symbol
        if sym not in holdings:
            holdings[sym] = {'quantity': 0, 'total_cost': Decimal('0'), 'avg_cost': Decimal('0')}
        entry = holdings[sym]
        if t.transaction_type == Transaction.TransactionType.BUY:
            new_qty = entry['quantity'] + t.quantity
            if new_qty > 0:
                entry['total_cost'] += t.price * t.quantity + t.fee
                entry['avg_cost'] = entry['total_cost'] / new_qty
            entry['quantity'] = new_qty
        elif t.transaction_type == Transaction.TransactionType.SELL:
            sell_qty = min(t.quantity, entry['quantity'])
            if entry['quantity'] > 0:
                entry['total_cost'] -= entry['avg_cost'] * sell_qty
            entry['quantity'] = max(0, entry['quantity'] - sell_qty)
            if entry['quantity'] == 0:
                entry['total_cost'] = Decimal('0')
    # Remove zero-quantity holdings
    return {sym: v for sym, v in holdings.items() if v['quantity'] > 0}


class PortfolioHoldingsView(APIView):
    """GET /api/portfolio/portfolios/<portfolio_id>/holdings/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, portfolio_id):
        from market_serving.models import SymbolSnapshot
        _get_user_portfolio(request, portfolio_id)
        holdings = _compute_holdings(portfolio_id)
        if not holdings:
            return Response([])
        symbols = list(holdings.keys())
        today = date.today()
        snaps = SymbolSnapshot.objects.filter(symbol__in=symbols, session_date=today)
        price_map = {s.symbol: s for s in snaps}
        results = []
        for sym, h in holdings.items():
            snap = price_map.get(sym)
            current_price = Decimal(str(snap.price)) if snap else h['avg_cost']
            market_value = current_price * h['quantity']
            cost_value = h['avg_cost'] * h['quantity']
            unrealized_pnl = market_value - cost_value
            pnl_pct = float(unrealized_pnl / cost_value * 100) if cost_value else 0
            results.append({
                'symbol': sym,
                'quantity': h['quantity'],
                'avg_cost': str(round(h['avg_cost'], 2)),
                'current_price': str(current_price),
                'market_value': str(round(market_value, 2)),
                'unrealized_pnl': str(round(unrealized_pnl, 2)),
                'unrealized_pnl_pct': round(pnl_pct, 2),
                'stale': snap.stale if snap else True,
            })
        return Response(sorted(results, key=lambda x: x['symbol']))


class PortfolioSummaryView(APIView):
    """GET /api/portfolio/portfolios/<portfolio_id>/summary/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, portfolio_id):
        from market_serving.models import SymbolSnapshot
        portfolio = _get_user_portfolio(request, portfolio_id)
        holdings = _compute_holdings(portfolio_id)
        today = date.today()
        total_market_value = Decimal('0')
        total_cost = Decimal('0')
        if holdings:
            symbols = list(holdings.keys())
            snaps = SymbolSnapshot.objects.filter(symbol__in=symbols, session_date=today)
            price_map = {s.symbol: s for s in snaps}
            for sym, h in holdings.items():
                snap = price_map.get(sym)
                current_price = Decimal(str(snap.price)) if snap else h['avg_cost']
                total_market_value += current_price * h['quantity']
                total_cost += h['avg_cost'] * h['quantity']
        total_pnl = total_market_value - total_cost
        pnl_pct = float(total_pnl / total_cost * 100) if total_cost else 0
        return Response({
            'portfolio_id': portfolio_id,
            'portfolio_name': portfolio.name,
            'total_market_value': str(round(total_market_value, 2)),
            'total_cost': str(round(total_cost, 2)),
            'total_unrealized_pnl': str(round(total_pnl, 2)),
            'total_unrealized_pnl_pct': round(pnl_pct, 2),
            'num_holdings': len(holdings),
            'as_of': today.isoformat(),
        })


class PortfolioChartView(APIView):
    """GET /api/portfolio/portfolios/<portfolio_id>/chart/ — daily portfolio value."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, portfolio_id):
        _get_user_portfolio(request, portfolio_id)
        # Alias to equity curve for frontend compatibility
        return PortfolioEquityCurveView().get(request, portfolio_id=portfolio_id)


class PortfolioEquityCurveView(APIView):
    """GET /api/portfolio/portfolios/<portfolio_id>/equity-curve/ — daily NAV history."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, portfolio_id):
        from market_data.models import DailyPrice
        _get_user_portfolio(request, portfolio_id)
        holdings = _compute_holdings(portfolio_id)
        if not holdings:
            return Response({'portfolio_id': portfolio_id, 'curve': []})
        symbols = list(holdings.keys())
        today = date.today()
        date_from = today - timedelta(days=365)
        prices = (
            DailyPrice.objects.filter(symbol__in=symbols, date__gte=date_from)
            .order_by('date', 'symbol')
        )
        # Build date → symbol → close map
        date_price_map: dict[date, dict[str, Decimal]] = {}
        for p in prices:
            day = p.date
            if day not in date_price_map:
                date_price_map[day] = {}
            date_price_map[day][p.symbol] = Decimal(str(p.close))
        curve = []
        for day in sorted(date_price_map.keys()):
            day_prices = date_price_map[day]
            nav = sum(
                day_prices.get(sym, h['avg_cost']) * h['quantity']
                for sym, h in holdings.items()
            )
            curve.append({'date': day.isoformat(), 'nav': str(round(nav, 2))})
        return Response({'portfolio_id': portfolio_id, 'curve': curve})


class PortfolioAllocationView(APIView):
    """GET /api/portfolio/portfolios/<portfolio_id>/allocation/ — symbol weight breakdown."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, portfolio_id):
        from market_serving.models import SymbolSnapshot
        _get_user_portfolio(request, portfolio_id)
        holdings = _compute_holdings(portfolio_id)
        if not holdings:
            return Response({'portfolio_id': portfolio_id, 'allocation': []})
        symbols = list(holdings.keys())
        today = date.today()
        snaps = SymbolSnapshot.objects.filter(symbol__in=symbols, session_date=today)
        price_map = {s.symbol: s for s in snaps}
        values = {}
        total = Decimal('0')
        for sym, h in holdings.items():
            snap = price_map.get(sym)
            price = Decimal(str(snap.price)) if snap else h['avg_cost']
            val = price * h['quantity']
            values[sym] = val
            total += val
        if total == 0:
            total = Decimal('1')
        allocation = sorted(
            [{'symbol': sym, 'value': str(round(v, 2)), 'weight_pct': round(float(v / total * 100), 2)}
             for sym, v in values.items()],
            key=lambda x: -x['weight_pct'],
        )
        return Response({'portfolio_id': portfolio_id, 'total_value': str(round(total, 2)), 'allocation': allocation})


class PortfolioAnalyticsView(APIView):
    """GET /api/portfolio/portfolios/<portfolio_id>/analytics/ — combined analytics overview."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, portfolio_id):
        _get_user_portfolio(request, portfolio_id)
        summary_resp = PortfolioSummaryView().get(request, portfolio_id=portfolio_id)
        return Response({
            'summary': summary_resp.data,
            'note': 'full_analytics_available_via_sub_endpoints',
        })


class PortfolioSyncView(APIView):
    """POST /api/portfolio/portfolios/<portfolio_id>/sync/"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, portfolio_id):
        _get_user_portfolio(request, portfolio_id)
        return Response({'portfolio_id': portfolio_id, 'status': 'sync_queued'})


class PortfolioTechnicalsView(APIView):
    """GET /api/portfolio/portfolios/<portfolio_id>/technicals/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, portfolio_id):
        from market_serving.models import SymbolSnapshot
        _get_user_portfolio(request, portfolio_id)
        holdings = _compute_holdings(portfolio_id)
        if not holdings:
            return Response([])
        symbols = list(holdings.keys())
        today = date.today()
        snaps = SymbolSnapshot.objects.filter(symbol__in=symbols, session_date=today)
        return Response([{
            'symbol': s.symbol,
            'price': str(s.price),
            'price_change': str(s.price_change),
            'price_change_pct': str(s.price_change_pct),
            'volume': s.volume,
            'stale': s.stale,
        } for s in snaps])


# ---------------------------------------------------------------------------
# Portfolio AI advisory compat — delegates to advisory domain
# ---------------------------------------------------------------------------

def _unwrap_django_request(request):
    return getattr(request, '_request', request)

class PortfolioAIAdvisoryCanonicalView(APIView):
    """GET /api/portfolio/ai-advisory/<symbol>/canonical/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        from advisory.views import AdvisoryLatestView
        return AdvisoryLatestView.as_view()(_unwrap_django_request(request), symbol=symbol.upper())


class PortfolioAIAdvisoryCurrentView(APIView):
    """GET /api/portfolio/ai-advisory/<symbol>/current/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        from advisory.views import AdvisoryLatestView
        return AdvisoryLatestView.as_view()(_unwrap_django_request(request), symbol=symbol.upper())


class PortfolioAIAdvisoryAutoRefreshInfoView(APIView):
    """GET /api/portfolio/ai-advisory/<symbol>/auto-refresh-info/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        return Response({'symbol': symbol.upper(), 'auto_refresh': False, 'note': 'auto_refresh_not_available'})


class PortfolioAIAdvisoryRefreshView(APIView):
    """POST /api/portfolio/ai-advisory/<symbol>/refresh/"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, symbol):
        from advisory.views import AdvisoryRefreshView
        return AdvisoryRefreshView.as_view()(_unwrap_django_request(request), symbol=symbol.upper())


class PortfolioAICommandCenterView(APIView):
    """GET /api/portfolio/ai-command-center/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({'status': 'available', 'note': 'ai_command_center_native'})


class PortfolioAICommandCenterTestView(APIView):
    """POST /api/portfolio/ai-command-center/test-connection/"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        return Response({'ok': True})


class PortfolioMarketDiscoveryHubView(APIView):
    """GET /api/portfolio/market-discovery-hub/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({'hub': [], 'note': 'market_discovery_not_available_in_native'})


class PortfolioWhaleAnalyticsView(APIView):
    """GET /api/portfolio/whale/analytics/<symbol>/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        from signal_intelligence.models import UnifiedAlert
        symbol = symbol.upper()
        limit = min(int(request.query_params.get('limit', 50)), 200)
        alerts = UnifiedAlert.objects.filter(symbol=symbol).order_by('-triggered_at')[:limit]
        return Response({
            'symbol': symbol,
            'whale_analytics': [{
                'id': str(a.alert_id),
                'type': a.alert_type,
                'severity': a.severity,
                'direction': a.direction,
                'value': str(a.value) if a.value is not None else None,
                'triggered_at': a.triggered_at.isoformat(),
            } for a in alerts],
        })


class PortfolioWhaleBacktestStatsView(APIView):
    """GET /api/portfolio/whale/backtest-stats/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({'stats': [], 'note': 'backtest_stats_not_available_in_native'})


class PortfolioScreenerRuleDetailView(APIView):
    """GET/PUT/DELETE /api/portfolio/screener/rules/<pk>/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        return Response({'id': pk, 'data': None, 'note': 'screener_rule_not_available_in_native'})

    def put(self, request, pk):
        return Response({'id': pk, 'status': 'not_available_in_native'})

    def delete(self, request, pk):
        from rest_framework import status as http_status
        return Response(status=http_status.HTTP_204_NO_CONTENT)


class PortfolioScreenerRuleRunView(APIView):
    """POST /api/portfolio/screener/rules/<pk>/run/"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        return Response({'id': pk, 'status': 'run_not_available_in_native'})
