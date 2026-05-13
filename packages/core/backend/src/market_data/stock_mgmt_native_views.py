"""
C3 — Native stock-management views for market_data domain.

Replaces StockManagementLegacyBridgeView for all stock-management frontend compat routes.
Advisory-related routes delegate to the advisory domain (already native since B5).

All views require IsAuthenticated; symbol params are always uppercased.
Graceful stubs return empty/null for features not yet fully native.
"""
from datetime import date

from rest_framework import permissions, status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import DailyPrice, StockProfile


# ---------------------------------------------------------------------------
# Stock data views
# ---------------------------------------------------------------------------

class StockManagementTechnicalsView(APIView):
    """GET /api/stock-management/technicals/bulk/?symbols=VCB,HPG"""
    permission_classes = [permissions.IsAuthenticated]

    _MAX_SYMBOLS = 50

    def _parse_symbols(self, request):
        query_symbols = str(request.query_params.get('symbols', '') or '').strip()
        body_symbols = request.data.get('symbols') if hasattr(request, 'data') else None

        if isinstance(body_symbols, list):
            raw = [str(item or '').strip() for item in body_symbols]
        elif isinstance(body_symbols, str) and body_symbols.strip():
            raw = [item.strip() for item in body_symbols.split(',')]
        elif query_symbols:
            raw = [item.strip() for item in query_symbols.split(',')]
        else:
            raw = []

        symbols = []
        seen = set()
        for item in raw:
            symbol = item.upper()
            if not symbol or symbol in seen:
                continue
            seen.add(symbol)
            symbols.append(symbol)
            if len(symbols) >= self._MAX_SYMBOLS:
                break
        return symbols

    def _build_response(self, symbols):
        from market_serving.models import SymbolSnapshot

        if not symbols:
            return Response({'results': []})

        today = date.today()
        snaps = SymbolSnapshot.objects.filter(symbol__in=symbols, session_date=today)
        snap_map = {s.symbol: s for s in snaps}
        results = []
        for sym in symbols:
            snap = snap_map.get(sym)
            results.append({
                'symbol': sym,
                'price': str(snap.price) if snap else None,
                'price_change': str(snap.price_change) if snap else None,
                'price_change_pct': str(snap.price_change_pct) if snap else None,
                'volume': snap.volume if snap else None,
                'stale': snap.stale if snap else True,
            })
        return Response({'results': results})

    def get(self, request):
        symbols = self._parse_symbols(request)
        return self._build_response(symbols)

    def post(self, request):
        symbols = self._parse_symbols(request)
        return self._build_response(symbols)


class StockManagementDetailView(APIView):
    """GET /api/stock-management/stocks/<symbol>/ — stock profile detail."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        symbol = symbol.upper()
        try:
            profile = StockProfile.objects.get(symbol=symbol)
        except StockProfile.DoesNotExist:
            raise NotFound(f'Stock not found: {symbol}')
        return Response({
            'symbol': profile.symbol,
            'company_name': profile.company_name,
            'exchange': profile.exchange,
            'industry': profile.industry,
            'status': profile.status,
            'outstanding_shares': profile.outstanding_shares,
        })


class StockManagementOverviewView(APIView):
    """GET /api/stock-management/stocks/<symbol>/overview/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        from market_serving.models import SymbolSnapshot
        symbol = symbol.upper()
        try:
            profile = StockProfile.objects.get(symbol=symbol)
        except StockProfile.DoesNotExist:
            raise NotFound(f'Stock not found: {symbol}')
        snap = SymbolSnapshot.objects.filter(symbol=symbol).order_by('-fetched_at').first()

        # 52-week high/low from DailyPrice (last 365 days)
        from datetime import date as _date, timedelta
        from django.db.models import Max, Min
        _today = _date.today()
        _52w_ago = _today - timedelta(days=365)
        week52 = DailyPrice.objects.filter(
            symbol=symbol, date__gte=_52w_ago, date__lte=_today,
        ).aggregate(week52_high=Max('high'), week52_low=Min('low'))

        return Response({
            'symbol': symbol,
            'company_name': profile.company_name,
            'exchange': profile.exchange,
            'industry': profile.industry,
            'outstanding_shares': profile.outstanding_shares,
            # Price fields
            'price': str(snap.price) if snap else None,
            'current_price': str(snap.price) if snap else None,
            'price_change': str(snap.price_change) if snap else None,
            'change_value': str(snap.price_change) if snap else None,
            'price_change_pct': str(snap.price_change_pct) if snap else None,
            'change_pct': float(snap.price_change_pct) if snap else None,
            'volume': snap.volume if snap else None,
            # Session OHLC
            'high_price': str(snap.high) if snap and snap.high else None,
            'low_price': str(snap.low) if snap and snap.low else None,
            'open_price': str(snap.open) if snap and snap.open else None,
            # Reference / bands
            'reference_price': str(snap.reference_price) if snap and snap.reference_price else None,
            'ceiling': str(snap.ceiling) if snap and snap.ceiling else None,
            'floor': str(snap.floor) if snap and snap.floor else None,
            # 52-week range
            'week52_high': str(week52['week52_high']) if week52['week52_high'] else None,
            'week52_low': str(week52['week52_low']) if week52['week52_low'] else None,
            'stale': snap.stale if snap else True,
        })


class StockManagementChartView(APIView):
    """GET /api/stock-management/stocks/<symbol>/chart/ — daily OHLCV prices."""
    permission_classes = [permissions.IsAuthenticated]

    _PAGE_SIZE = 250

    def get(self, request, symbol):
        symbol = symbol.upper()
        qs = DailyPrice.objects.filter(symbol=symbol).order_by('-date')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')

        # ?days=N → compute date_from automatically when date_from is absent
        days_param = request.query_params.get('days')
        if not date_from and days_param:
            try:
                from datetime import date as _date, timedelta
                date_from = (_date.today() - timedelta(days=int(days_param))).isoformat()
            except (ValueError, TypeError):
                pass

        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)

        # Intraday timeframes — DailyPrice only stores daily bars
        timeframe = request.query_params.get('timeframe', 'D')
        _INTRADAY_TF = {'1m', '5m', '15m', '30m', '1h', '1H', '2h', '2H', '4h', '4H'}
        if timeframe in _INTRADAY_TF:
            return Response({
                'symbol': symbol,
                'timeframe': timeframe,
                'results': [],
                'note': 'intraday_not_available_in_native',
            })

        try:
            page = max(1, int(request.query_params.get('page', 1)))
        except ValueError:
            page = 1
        offset = (page - 1) * self._PAGE_SIZE
        results = qs[offset: offset + self._PAGE_SIZE]
        return Response({
            'symbol': symbol,
            'results': [{
                'date': r.date.isoformat(),
                'open': str(r.open),
                'high': str(r.high),
                'low': str(r.low),
                'close': str(r.close),
                'volume': r.volume,
            } for r in results],
            'page': page,
        })


class StockManagementOrderFlowView(APIView):
    """GET /api/stock-management/stocks/<symbol>/order-flow/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        from signal_intelligence.models import UnifiedAlert
        symbol = symbol.upper()
        limit = min(int(request.query_params.get('limit', 100)), 500)
        alerts = UnifiedAlert.objects.filter(symbol=symbol).order_by('-triggered_at')[:limit]
        return Response({
            'symbol': symbol,
            'order_flow': [{
                'id': str(a.alert_id),
                'type': a.alert_type,
                'value': str(a.value) if a.value is not None else None,
                'direction': a.direction,
                'created_at': a.triggered_at.isoformat(),
            } for a in alerts],
        })


class StockManagementNewsView(APIView):
    """GET /api/stock-management/stocks/<symbol>/news/ — graceful empty (no native news model)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        return Response({
            'symbol': symbol.upper(),
            'news': [],
            'note': 'news_not_available_in_native',
        })


class StockManagementNewsAISummaryView(APIView):
    """GET /api/stock-management/stocks/<symbol>/news/ai-summary/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        return Response({
            'symbol': symbol.upper(),
            'summary': None,
            'note': 'ai_summary_not_available_in_native',
        })


# ---------------------------------------------------------------------------
# Advisory compat views — delegate to advisory domain (native since B5)
# ---------------------------------------------------------------------------

class StockManagementAIAdvisorySessionView(APIView):
    """GET /api/stock-management/stocks/<symbol>/ai-advisory-session/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        from advisory.views import AdvisoryLatestView
        django_request = getattr(request, '_request', request)
        response = AdvisoryLatestView.as_view()(django_request, symbol=symbol.upper())
        if getattr(response, 'status_code', None) == status.HTTP_404_NOT_FOUND:
            normalized_symbol = symbol.upper()
            return Response({
                'ok': False,
                'queued': False,
                'symbol': normalized_symbol,
                'contract': request.query_params.get('contract', 'v1'),
                'include_benchmarks': str(request.query_params.get('include_benchmarks', '')).lower() in {'1', 'true', 'yes'},
                'reason': 'no_advisory_data',
                'message': f'Chưa có dữ liệu tư vấn AI cho mã {normalized_symbol}.',
                'advisory': None,
                'aggregate': None,
                'components': [],
                'deleted_components': [],
                'executive_summary': None,
                'executive_summaries': [],
            }, status=status.HTTP_200_OK)
        return response


class StockManagementAIAdvisoryObservabilityView(APIView):
    """GET/POST /api/stock-management/stocks/<symbol>/ai-advisory-observability/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        return Response({
            'symbol': symbol.upper(),
            'observability': None,
            'note': 'observability_not_available_in_native',
        })

    def post(self, request, symbol):
        # Accept telemetry events from the frontend advisory observer; no-op store for now.
        return Response({
            'symbol': symbol.upper(),
            'received': True,
        }, status=status.HTTP_201_CREATED)


class StockManagementAIAdvisoryComponentsGenerateView(APIView):
    """POST /api/stock-management/stocks/<symbol>/ai-advisory-components/generate/"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, symbol):
        from advisory.views import AdvisoryRefreshView
        django_request = getattr(request, '_request', request)
        return AdvisoryRefreshView.as_view()(django_request, symbol=symbol.upper())


class StockManagementAIAdvisoryComponentsDeletedView(APIView):
    """GET /api/stock-management/stocks/<symbol>/ai-advisory-components/deleted/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        return Response({'symbol': symbol.upper(), 'deleted': []})


class StockManagementAIAdvisorySummaryRegenerateView(APIView):
    """POST /api/stock-management/stocks/<symbol>/ai-advisory-summary/regenerate/"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, symbol):
        from advisory.views import AdvisoryRefreshView
        return AdvisoryRefreshView.as_view()(request, symbol=symbol.upper())


class StockManagementAIAdvisorySummaryDetailView(APIView):
    """DELETE /api/stock-management/stocks/<symbol>/ai-advisory-summary/<summary_id>/"""
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, symbol, summary_id):
        return Response(status=status.HTTP_204_NO_CONTENT)


class StockManagementFinancialsView(APIView):
    """GET /api/stock-management/stocks/<symbol>/financials/ — graceful empty."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        return Response({'symbol': symbol.upper(), 'financials': None, 'note': 'financials_not_available_in_native'})


# ---------------------------------------------------------------------------
# Advisory component compat views
# ---------------------------------------------------------------------------

class StockManagementAdvisoryCompToggleView(APIView):
    """POST /api/stock-management/ai-advisory-components/<pk>/toggle-include/"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        return Response({'id': pk, 'included': True})


class StockManagementAdvisoryCompRefreshView(APIView):
    """POST /api/stock-management/ai-advisory-components/<pk>/refresh/"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        return Response({'id': pk, 'status': 'refresh_queued'})


class StockManagementAdvisoryCompRestoreView(APIView):
    """POST /api/stock-management/ai-advisory-components/<pk>/restore/"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        return Response({'id': pk, 'status': 'restored'})


class StockManagementAdvisoryCompDetailView(APIView):
    """GET/DELETE /api/stock-management/ai-advisory-components/<pk>/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        return Response({'id': pk, 'data': None, 'note': 'component_not_available_in_native'})

    def delete(self, request, pk):
        return Response(status=status.HTTP_204_NO_CONTENT)


class StockManagementPortfolioNewsDigestView(APIView):
    """GET /api/stock-management/portfolio/news-digest/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({'news': [], 'note': 'news_digest_not_available_in_native'})


# ---------------------------------------------------------------------------
# Group/item compat views (graceful stubs — groups live in legacy DB)
# ---------------------------------------------------------------------------

class StockManagementGroupDetailView(APIView):
    """GET/PUT/DELETE /api/stock-management/groups/<group_id>/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, group_id):
        return Response({'id': group_id, 'data': None, 'note': 'group_detail_not_available_in_native'})

    def put(self, request, group_id):
        return Response({'id': group_id, 'status': 'not_available_in_native'})

    def delete(self, request, group_id):
        return Response(status=status.HTTP_204_NO_CONTENT)


class StockManagementGroupItemsView(APIView):
    """GET /api/stock-management/groups/<group_id>/items/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, group_id):
        return Response({'group_id': group_id, 'items': [], 'note': 'group_items_not_available_in_native'})


class StockManagementItemDetailView(APIView):
    """GET/PUT/DELETE /api/stock-management/items/<item_id>/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, item_id):
        return Response({'id': item_id, 'data': None, 'note': 'item_detail_not_available_in_native'})

    def delete(self, request, item_id):
        return Response(status=status.HTTP_204_NO_CONTENT)

    def post(self, request, symbol):
        """POST /api/stock-management/stocks/<symbol>/ai-advisory-observability/
        
        Accepts telemetry data from frontend for audit logging.
        Returns 201 CREATED with log_id.
        """
        try:
            from portfolio.models import AdvisoryAggregateAuditLog
        except ImportError:
            # Fallback if portfolio models not available
            return Response(
                {
                    'ok': False,
                    'message': 'Audit log model not available',
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        
        normalized_symbol = str(symbol or '').strip().upper()
        if not normalized_symbol:
            return Response(
                {'ok': False, 'message': 'Symbol khong hop le.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        payload = request.data if isinstance(request.data, dict) else {}
        telemetry = payload.get('telemetry') if isinstance(payload.get('telemetry'), dict) else {}
        
        event_type = str(payload.get('event_type') or 'frontend_retry_telemetry').strip()[:80]
        outcome = str(payload.get('outcome') or '').strip()[:60]
        client_ts = str(payload.get('client_ts') or '').strip()[:64]
        
        def _safe_non_negative_int(value, default=0):
            try:
                parsed = int(value)
                return parsed if parsed >= 0 else default
            except (TypeError, ValueError):
                return default
        
        scheduled_count = _safe_non_negative_int(telemetry.get('scheduled_count', 0))
        recovered_count = _safe_non_negative_int(telemetry.get('recovered_count', 0))
        failed_count = _safe_non_negative_int(telemetry.get('failed_count', 0))
        last_reason = str(telemetry.get('last_reason') or '').strip()[:120]
        
        metadata_payload = {
            'event_type': event_type,
            'outcome': outcome,
            'telemetry': {
                'scheduled_count': scheduled_count,
                'recovered_count': recovered_count,
                'failed_count': failed_count,
                'last_reason': last_reason,
                'last_event_at': str(telemetry.get('last_event_at') or '').strip()[:64],
            },
            'client_ts': client_ts,
        }
        
        try:
            audit_log = AdvisoryAggregateAuditLog.objects.create(
                user=request.user,
                symbol=normalized_symbol,
                before_state_json={},
                after_state_json={
                    'operation': 'frontend_retry_telemetry',
                    'outcome': outcome,
                    'event_type': event_type,
                },
                reason=AdvisoryAggregateAuditLog.ReasonChoices.MANUAL_REFRESH,
                actor=AdvisoryAggregateAuditLog.ActorChoices.USER,
                actor_id=str(request.user.id),
                metadata_json=metadata_payload,
            )
            
            return Response(
                {
                    'ok': True,
                    'symbol': normalized_symbol,
                    'log_id': audit_log.id,
                    'message': 'Telemetry recorded.',
                },
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f'Failed to record observability telemetry for {normalized_symbol}: {str(e)}')
            return Response(
                {
                    'ok': False,
                    'message': 'Failed to record telemetry',
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
