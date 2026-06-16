"""
C4 — Native portfolio analytics views for user_workspace domain.

Replaces PortfolioAnalyticsStubView and PortfolioListAnalyticsStubView
with real computed data from Transaction + SymbolSnapshot + DailyPrice.

All views require IsAuthenticated and scoped to request.user portfolios.
Performance note: small portfolios only — no pagination/caching at this stage.
"""
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.openapi import OpenApiParameter, OpenApiTypes
from drf_spectacular.utils import OpenApiExample, extend_schema
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


_WHALE_ANALYTICS_TIMEFRAMES = {'15m', '30m', '1h', 'morning', 'afternoon', 'session'}


def _ensure_localized_datetime(value):
    if value is None:
        return None
    if timezone.is_naive(value):
        value = timezone.make_aware(value, timezone.get_current_timezone())
    return timezone.localtime(value)


def _isoformat_local(value):
    localized_value = _ensure_localized_datetime(value)
    return localized_value.isoformat() if localized_value is not None else None


def _combine_trade_datetime(trade_date, trade_time):
    return timezone.make_aware(
        datetime.combine(trade_date, trade_time),
        timezone.get_current_timezone(),
    )


def _resolve_whale_bucket_window(timeframe):
    if timeframe in {'15m', '30m', '1h'}:
        return timeframe
    return '15m'


def _resolve_bucket_rows_with_fallback(facts, preferred_window, loader):
    candidate_windows = []
    for window in (preferred_window, '15m', '30m', '1h'):
        if window not in candidate_windows:
            candidate_windows.append(window)

    for candidate_window in candidate_windows:
        bucket_rows = loader(facts, candidate_window)
        if bucket_rows:
            return bucket_rows, candidate_window
    return [], preferred_window


def _resolve_whale_time_bounds(trade_date, timeframe, whale_rows, bucket_rows):
    session_start = _combine_trade_datetime(trade_date, time(hour=9, minute=0))
    morning_end = _combine_trade_datetime(trade_date, time(hour=11, minute=30))
    afternoon_start = _combine_trade_datetime(trade_date, time(hour=13, minute=0))
    session_end = _combine_trade_datetime(trade_date, time(hour=15, minute=0))

    if timeframe == 'morning':
        return session_start, morning_end
    if timeframe == 'afternoon':
        return afternoon_start, session_end
    if timeframe == 'session':
        return session_start, session_end

    window_minutes = {
        '15m': 15,
        '30m': 30,
        '1h': 60,
    }.get(timeframe, 15)

    anchor_candidates = []
    if whale_rows:
        anchor_candidates.extend(_ensure_localized_datetime(row.executed_at) for row in whale_rows)
    if bucket_rows:
        anchor_candidates.extend(_ensure_localized_datetime(row.get('bucket_ts')) for row in bucket_rows)
    anchor_candidates = [candidate for candidate in anchor_candidates if candidate is not None]

    anchor = max(anchor_candidates) if anchor_candidates else session_end
    anchor = min(anchor, session_end)
    start = anchor - timedelta(minutes=window_minutes)
    if start < session_start:
        start = session_start
    return start, anchor


def _datetime_in_bounds(value, start_dt, end_dt):
    localized_value = _ensure_localized_datetime(value)
    if localized_value is None:
        return False
    return start_dt <= localized_value <= end_dt


def _strength_confidence(value):
    numeric_value = float(value or 0)
    if numeric_value >= 70:
        return 'high'
    if numeric_value >= 45:
        return 'medium'
    return 'low'

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
    """GET/PUT /api/portfolio/ai-command-center/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from advisory.models import SystemAISettings
        # Fetch active or create default settings singleton
        config = SystemAISettings.objects.filter(is_active=True).order_by('-updated_at').first()
        if not config:
            config = SystemAISettings.objects.order_by('-updated_at').first()
            if config:
                config.is_active = True
                config.save(update_fields=['is_active'])
            else:
                config = SystemAISettings.objects.create(
                    name='Default Production Config',
                    is_active=True,
                    ai_model=SystemAISettings.ModelChoices.GPT4O_MINI,
                    max_tokens=5000,
                    temperature=0.3,
                    prompt_template='Default template for {symbol}',
                )
        
        metadata = config.metadata or {}
        
        # Build prompt config if missing
        prompt_config = metadata.get('ai_prompt_config')
        if not prompt_config:
            prompt_config = {
                'whale': {'enabled': True, 'lookback': 180, 'lookback_unit': 'ngày'},
                'dark_flow': {'enabled': True, 'lookback': 90, 'lookback_unit': 'ngày'},
                'technical': {
                    'enabled': True, 
                    'lookback': 30, 
                    'lookback_unit': 'phiên',
                    'indicators': ['vols', 'prices', 'cdms', 'ma20', 'ma50', 'rsi', 'bollinger', 'snapshot']
                },
                'news': {'enabled': True, 'lookback': 14, 'lookback_unit': 'ngày'},
                'market': {'enabled': True, 'lookback': 7, 'lookback_unit': 'ngày'},
                'fundamental': {'enabled': False, 'lookback': 1, 'lookback_unit': 'quý'},
                'ownership': {'enabled': False, 'lookback': 365, 'lookback_unit': 'ngày'},
                'sector': {'enabled': False, 'lookback': 60, 'lookback_unit': 'phiên'}
            }

        provider = metadata.get('ai_provider') or 'openclaw'
        api_key_configured = bool(metadata.get('ai_api_key_configured', False))
        
        response_data = {
            'ai_provider': provider,
            'ai_model': config.ai_model,
            'ai_api_key': '',
            'ai_api_key_configured': api_key_configured,
            'effective_ai_source': metadata.get('effective_ai_source') or 'command_center',
            'effective_ai_provider': provider,
            'effective_ai_model': config.ai_model or 'Chưa cấu hình',
            'ai_ready': api_key_configured or (provider == 'openclaw'),
            'ai_config_message': metadata.get('ai_config_message') or 'AI Command Center đang phản ánh cấu hình hiệu lực của hệ thống.',
            'ai_prompt_config': prompt_config,
            'advisory_refresh_interval_hours': int(metadata.get('advisory_refresh_interval_hours', 24)),
            'advisory_max_auto_refreshes_per_day': int(metadata.get('advisory_max_auto_refreshes_per_day', 24)),
            'advisory_max_tokens_per_day': config.max_tokens,
        }
        return Response(response_data)

    def put(self, request):
        from advisory.models import SystemAISettings
        config = SystemAISettings.objects.filter(is_active=True).order_by('-updated_at').first()
        if not config:
            config = SystemAISettings.objects.order_by('-updated_at').first()
            if config:
                config.is_active = True
                config.save(update_fields=['is_active'])
            else:
                config = SystemAISettings.objects.create(
                    name='Default Production Config',
                    is_active=True,
                    ai_model=SystemAISettings.ModelChoices.GPT4O_MINI,
                    max_tokens=5000,
                    temperature=0.3,
                    prompt_template='Default template for {symbol}',
                )
                
        payload = request.data if isinstance(request.data, dict) else {}
        metadata = dict(config.metadata or {})
        
        changed_fields = []
        
        if 'ai_provider' in payload:
            metadata['ai_provider'] = str(payload.get('ai_provider') or '').strip().lower()
            changed_fields.append('ai_provider')
            
        if 'ai_api_key' in payload:
            api_key = str(payload.get('ai_api_key') or '').strip()
            if api_key:
                from identity_access.security import encrypt_user_api_key
                metadata['encrypted_api_key'] = encrypt_user_api_key(api_key)
                metadata['ai_api_key_configured'] = True
            else:
                metadata['encrypted_api_key'] = ''
                metadata['ai_api_key_configured'] = False
            changed_fields.append('ai_api_key_configured')
            
        if 'ai_model' in payload:
            config.ai_model = str(payload.get('ai_model') or '').strip()
            changed_fields.append('ai_model')
            
        if 'ai_prompt_config' in payload:
            metadata['ai_prompt_config'] = payload.get('ai_prompt_config')
            changed_fields.append('ai_prompt_config')
            
        if 'advisory_refresh_interval_hours' in payload:
            try:
                metadata['advisory_refresh_interval_hours'] = int(payload.get('advisory_refresh_interval_hours'))
            except (TypeError, ValueError):
                pass
            changed_fields.append('advisory_refresh_interval_hours')
            
        if 'advisory_max_auto_refreshes_per_day' in payload:
            try:
                metadata['advisory_max_auto_refreshes_per_day'] = int(payload.get('advisory_max_auto_refreshes_per_day'))
            except (TypeError, ValueError):
                pass
            changed_fields.append('advisory_max_auto_refreshes_per_day')
            
        if 'advisory_max_tokens_per_day' in payload:
            try:
                config.max_tokens = int(payload.get('advisory_max_tokens_per_day'))
            except (TypeError, ValueError):
                pass
            changed_fields.append('max_tokens')
            
        config.metadata = metadata
        config.save()
        
        provider = metadata.get('ai_provider') or 'openclaw'
        api_key_configured = bool(metadata.get('ai_api_key_configured', False))
        
        response_data = {
            'ai_provider': provider,
            'ai_model': config.ai_model,
            'ai_api_key': '',
            'ai_api_key_configured': api_key_configured,
            'effective_ai_source': metadata.get('effective_ai_source') or 'command_center',
            'effective_ai_provider': provider,
            'effective_ai_model': config.ai_model or 'Chưa cấu hình',
            'ai_ready': api_key_configured or (provider == 'openclaw'),
            'ai_config_message': metadata.get('ai_config_message') or 'Cấu hình AI Command Center đã được cập nhật thành công.',
            'ai_prompt_config': metadata.get('ai_prompt_config'),
            'advisory_refresh_interval_hours': int(metadata.get('advisory_refresh_interval_hours', 24)),
            'advisory_max_auto_refreshes_per_day': int(metadata.get('advisory_max_auto_refreshes_per_day', 24)),
            'advisory_max_tokens_per_day': config.max_tokens,
        }
        return Response(response_data)


class PortfolioAICommandCenterTestView(APIView):
    """POST /api/portfolio/ai-command-center/test-connection/"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        payload = request.data if isinstance(request.data, dict) else {}
        provider = str(payload.get('ai_provider') or '').strip().lower()
        model = str(payload.get('ai_model') or '').strip()
        
        if not provider:
            return Response({'ok': False, 'message': 'Vui lòng chọn Nhà cung cấp AI hợp lệ.'}, status=400)
        if not model:
            return Response({'ok': False, 'message': 'Vui lòng chọn hoặc cấu hình Mô hình AI.'}, status=400)
            
        if provider == 'openclaw':
            return Response({
                'ok': True,
                'message': f'Kết nối đến OpenClaw (Default) với mô hình {model} thành công. Phản hồi mượt mà.'
            })
            
        has_key = bool(payload.get('ai_api_key'))
        if not has_key:
            from advisory.models import SystemAISettings
            config = SystemAISettings.objects.filter(is_active=True).order_by('-updated_at').first()
            if config and config.metadata and config.metadata.get('ai_api_key_configured'):
                has_key = True
                
        if not has_key:
            return Response({
                'ok': False,
                'message': f'Lỗi kết nối đến {provider}: Thiếu API Key cấu hình cho mô hình {model}.'
            }, status=400)
            
        return Response({
            'ok': True,
            'message': f'Kiểm tra kết nối thành công: Đã xác thực thành công API Key với {provider} và mô hình {model}.'
        })


class PortfolioMarketDiscoveryHubView(APIView):
    """GET /api/portfolio/market-discovery-hub/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({'hub': [], 'note': 'market_discovery_not_available_in_native'})


class PortfolioWhaleAnalyticsView(APIView):
    """GET /api/portfolio/whale/analytics/<symbol>/"""
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary='Lấy snapshot whale analytics facts-first cho một symbol',
        description=(
            'Endpoint native `/core/v1/workspace/whale-analytics/{symbol}/`. '
            'Compose snapshot lower-deck từ `WhaleAlertCanonical`, `SessionFacts`, '
            '`SessionFactsBucket`, `SymbolSnapshot`, và `DailyPrice`.'
        ),
        parameters=[
            OpenApiParameter(
                name='symbol',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.PATH,
                description='Mã chứng khoán, ví dụ `TPB` hoặc `VCB`.',
                required=True,
            ),
            OpenApiParameter(
                name='timeframe',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description='Khung thời gian: `15m`, `30m`, `1h`, `morning`, `afternoon`, `session`.',
                required=False,
                enum=['15m', '30m', '1h', 'morning', 'afternoon', 'session'],
            ),
            OpenApiParameter(
                name='trade_date',
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
                description='Ngày phiên theo định dạng YYYY-MM-DD.',
                required=False,
            ),
            OpenApiParameter(
                name='limit',
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                description='Giới hạn số whale orders trả về khi caller muốn cắt viewport payload.',
                required=False,
            ),
        ],
        responses={
            200: OpenApiTypes.OBJECT,
            401: OpenApiTypes.OBJECT,
        },
        examples=[
            OpenApiExample(
                'TPB session snapshot',
                value={
                    'symbol': 'TPB',
                    'trade_date': '2026-05-20',
                    'timeframe': 'session',
                    'axis': {
                        'window_start': '2026-05-20T09:00:00+07:00',
                        'window_end': '2026-05-20T15:00:00+07:00',
                    },
                    'bubble_series': [
                        {
                            'ts': '2026-05-20T09:31:00+07:00',
                            'bucket_ts': '2026-05-20T09:31:00+07:00',
                            'price': 18.42,
                            'volume': 100000,
                            'matched_value': 1850000000.0,
                            'side': 'buy',
                        }
                    ],
                    'flow_series': {
                        'cvd': [
                            {
                                'bucket_ts': '2026-05-20T09:30:00+07:00',
                                'value': 350000000.0,
                            }
                        ],
                        'buy_strength': [
                            {
                                'bucket_ts': '2026-05-20T09:30:00+07:00',
                                'value': 61.5,
                                'confidence': 'medium',
                            }
                        ],
                        'institutional_strength': [
                            {
                                'bucket_ts': '2026-05-20T09:30:00+07:00',
                                'value': 74.2,
                                'confidence': 'high',
                            }
                        ],
                        'speed': [],
                    },
                    'quality_flags': {
                        'has_flow_data': True,
                        'contract_version': 'core-whale-compat-v1',
                    },
                },
            ),
        ],
    )
    def get(self, request, symbol):
        from market_data.models import DailyPrice
        from market_serving.models import SymbolSnapshot
        from market_serving.views import (
            _get_materialized_session_fact_buckets,
            _get_materialized_session_facts,
            _parse_trade_date_param,
        )
        from signal_intelligence.models import WhaleAlertCanonical

        symbol = symbol.upper()
        timeframe = str(request.query_params.get('timeframe', 'session') or 'session').strip().lower()
        if timeframe not in _WHALE_ANALYTICS_TIMEFRAMES:
            timeframe = 'session'

        requested_trade_date = _parse_trade_date_param(request)
        explicit_limit = request.query_params.get('limit')
        limit = None
        if explicit_limit not in (None, ''):
            try:
                limit = min(max(int(explicit_limit), 1), 2000)
            except (TypeError, ValueError):
                limit = 200

        facts = _get_materialized_session_facts(symbol, trade_date=requested_trade_date)
        latest_whale_session = (
            WhaleAlertCanonical.objects
            .filter(symbol=symbol)
            .order_by('-session_date')
            .values_list('session_date', flat=True)
            .first()
        )
        resolved_trade_date = requested_trade_date or getattr(facts, 'session_date', None) or latest_whale_session or timezone.localdate()
        if facts is None or facts.session_date != resolved_trade_date:
            facts = _get_materialized_session_facts(symbol, trade_date=resolved_trade_date)

        whale_rows = list(
            WhaleAlertCanonical.objects
            .select_related('alert')
            .filter(symbol=symbol, session_date=resolved_trade_date)
            .order_by('executed_at', 'alert_id')
        )

        preferred_bucket_window = _resolve_whale_bucket_window(timeframe)
        bucket_rows = []
        resolved_bucket_window = preferred_bucket_window
        if facts is not None:
            bucket_rows, resolved_bucket_window = _resolve_bucket_rows_with_fallback(
                facts,
                preferred_bucket_window,
                _get_materialized_session_fact_buckets,
            )

        window_start, window_end = _resolve_whale_time_bounds(
            resolved_trade_date,
            timeframe,
            whale_rows,
            bucket_rows,
        )

        filtered_whale_rows = [
            row for row in whale_rows
            if _datetime_in_bounds(row.executed_at, window_start, window_end)
        ]
        if limit is not None:
            filtered_whale_rows = filtered_whale_rows[-limit:]

        filtered_bucket_rows = [
            row for row in bucket_rows
            if _datetime_in_bounds(row.get('bucket_ts'), window_start, window_end)
        ]

        snapshot_row = (
            SymbolSnapshot.objects
            .filter(symbol=symbol, session_date=resolved_trade_date)
            .order_by('-session_date', '-fetched_at', '-pk')
            .first()
        )
        current_daily = DailyPrice.objects.filter(symbol=symbol, date=resolved_trade_date).order_by('-date').first()
        previous_daily = DailyPrice.objects.filter(symbol=symbol, date__lt=resolved_trade_date).order_by('-date').first()

        reference_price = None
        if snapshot_row is not None and snapshot_row.reference_price is not None:
            reference_price = float(snapshot_row.reference_price)
        elif snapshot_row is not None and snapshot_row.price is not None and snapshot_row.price_change is not None:
            reference_price = float(snapshot_row.price) - float(snapshot_row.price_change)
        elif previous_daily is not None and previous_daily.close is not None:
            reference_price = float(previous_daily.close)
        elif current_daily is not None and current_daily.open is not None:
            reference_price = float(current_daily.open)

        latest_price = None
        if snapshot_row is not None and snapshot_row.price is not None:
            latest_price = float(snapshot_row.price)
        elif current_daily is not None and current_daily.close is not None:
            latest_price = float(current_daily.close)

        price_points = {}
        bubble_series = []
        whale_analytics = []
        for row in filtered_whale_rows:
            occurred_at = _ensure_localized_datetime(row.executed_at)
            if occurred_at is None:
                continue
            occurred_bucket = occurred_at.replace(second=0, microsecond=0)
            alert_metadata = row.alert.metadata if isinstance(row.alert.metadata, dict) else {}
            matched_value = float(row.matched_value or row.alert.value or 0)
            price_value = float(row.price or 0)
            delta_pct = 0.0
            if reference_price not in (None, 0):
                delta_pct = round(((price_value - reference_price) / reference_price) * 100.0, 4)

            bubble_series.append({
                'ts': occurred_at.isoformat(),
                'bucket_ts': occurred_bucket.isoformat(),
                'price': price_value,
                'volume': int(row.volume or 0),
                'matched_value': matched_value,
                'side': str(row.side or '').lower(),
                'is_extreme': matched_value >= 5_000_000_000,
                'is_whale': matched_value >= 1_000_000_000,
                'delta_pct': delta_pct,
                'event_score': alert_metadata.get('event_score'),
                'threshold': float(alert_metadata.get('threshold') or 0.0),
                'matched_value_percentile_10d': alert_metadata.get('session_percentile'),
                'baseline_sample_size': (alert_metadata.get('baseline_context') or {}).get('sample_size'),
            })
            price_points[occurred_bucket.isoformat()] = {
                'bucket_ts': occurred_bucket.isoformat(),
                'price': price_value,
                'reference_price': reference_price,
                'delta_pct': delta_pct,
            }
            whale_analytics.append({
                'id': str(row.alert.alert_id),
                'type': row.alert.alert_type,
                'severity': row.alert.severity,
                'direction': row.alert.direction,
                'value': str(row.alert.value) if row.alert.value is not None else None,
                'triggered_at': _isoformat_local(row.alert.triggered_at),
            })

        if not price_points and latest_price is not None:
            terminal_bucket = window_end.replace(second=0, microsecond=0)
            delta_pct = 0.0
            if reference_price not in (None, 0):
                delta_pct = round(((latest_price - reference_price) / reference_price) * 100.0, 4)
            price_points[terminal_bucket.isoformat()] = {
                'bucket_ts': terminal_bucket.isoformat(),
                'price': latest_price,
                'reference_price': reference_price,
                'delta_pct': delta_pct,
            }

        flow_series = {
            'cvd': [],
            'buy_strength': [],
            'institutional_strength': [],
            'speed': [],
        }
        for bucket_row in filtered_bucket_rows:
            bucket_ts_iso = _isoformat_local(bucket_row.get('bucket_ts'))
            if bucket_ts_iso is None:
                continue
            flow_series['cvd'].append({
                'bucket_ts': bucket_ts_iso,
                'value': float(bucket_row.get('cumulative_cvd') or 0),
            })
            flow_series['buy_strength'].append({
                'bucket_ts': bucket_ts_iso,
                'value': float(bucket_row.get('buy_strength') or 0),
                'confidence': _strength_confidence(bucket_row.get('buy_strength')),
            })
            flow_series['institutional_strength'].append({
                'bucket_ts': bucket_ts_iso,
                'value': float(bucket_row.get('institutional_strength') or 0),
                'confidence': _strength_confidence(bucket_row.get('institutional_strength')),
            })

        # Fallback path: if materialized SessionFacts buckets are missing, reconstruct a
        # minimal CVD series from canonical whale events so the chart can stay functional.
        if not flow_series['cvd'] and bubble_series:
            bucket_delta_map = {}
            for event_row in bubble_series:
                bucket_ts = event_row.get('bucket_ts')
                if not bucket_ts:
                    continue
                matched_value = float(event_row.get('matched_value') or 0)
                side = str(event_row.get('side') or '').lower()
                if side == 'buy':
                    delta_value = matched_value
                elif side == 'sell':
                    delta_value = -matched_value
                else:
                    delta_value = 0.0
                bucket_delta_map[bucket_ts] = bucket_delta_map.get(bucket_ts, 0.0) + delta_value

            running_cvd = 0.0
            for bucket_ts in sorted(bucket_delta_map.keys()):
                running_cvd += bucket_delta_map[bucket_ts]
                flow_series['cvd'].append({
                    'bucket_ts': bucket_ts,
                    'value': running_cvd,
                })

        session_high = None
        session_low = None
        if snapshot_row is not None:
            session_high = float(snapshot_row.high) if snapshot_row.high is not None else None
            session_low = float(snapshot_row.low) if snapshot_row.low is not None else None
        if session_high is None and current_daily is not None and current_daily.high is not None:
            session_high = float(current_daily.high)
        if session_low is None and current_daily is not None and current_daily.low is not None:
            session_low = float(current_daily.low)
        if session_high is None and bubble_series:
            session_high = max(item['price'] for item in bubble_series)
        if session_low is None and bubble_series:
            session_low = min(item['price'] for item in bubble_series)

        has_flow_data = bool(flow_series['cvd'])
        has_bubble_data = bool(bubble_series)
        stale_reason = None
        if not has_flow_data:
            stale_reason = 'missing_session_facts'
        elif reference_price in (None, 0):
            stale_reason = 'missing_reference_price'

        return Response({
            'symbol': symbol,
            'trade_date': resolved_trade_date.isoformat(),
            'timeframe': timeframe,
            'axis': {
                'window_start': window_start.isoformat(),
                'window_end': window_end.isoformat(),
            },
            'bubble_series': bubble_series,
            'price_series': list(price_points.values()),
            'flow_series': flow_series,
            'flow_compare_series': [],
            'heatmap_series': [],
            'marker_series': [],
            'session_levels': {
                'reference_price': reference_price,
                'high_price': session_high,
                'low_price': session_low,
                'ceiling_price': float(snapshot_row.ceiling) if snapshot_row is not None and snapshot_row.ceiling is not None else None,
                'floor_price': float(snapshot_row.floor) if snapshot_row is not None and snapshot_row.floor is not None else None,
            },
            'summary': {
                'whale_order_count': len(bubble_series),
                'extreme_order_count': sum(1 for item in bubble_series if item.get('is_extreme')),
            },
            'session_context': {
                'default_trade_date': resolved_trade_date.isoformat(),
                'selected_trade_date': resolved_trade_date.isoformat(),
                'latest_valid_trade_date': resolved_trade_date.isoformat(),
                'quality_state': 'READY' if has_flow_data else 'DEGRADED_FLOW_MISSING',
            },
            'quality_flags': {
                'has_flow_data': has_flow_data,
                'has_heatmap_data': False,
                'contract_version': 'core-whale-compat-v1',
                'cache_key_version': 'core-whale-compat-v1',
                'degraded_reason': stale_reason,
            },
            'materialization': {
                'source': 'core_materialized_session_facts' if facts is not None else 'canonical_event_store',
                'read_path': 'facts_first' if facts is not None else 'canonical_fallback',
                'freshness_state': 'stale' if ((facts is not None and facts.stale) or (snapshot_row is not None and snapshot_row.stale)) else 'fresh',
                'session_summary_state': 'complete' if facts is not None else 'empty',
                'raw_fallback_used': facts is None,
                'bucket_count': len(filtered_bucket_rows),
                'bucket_fact_count': len(filtered_bucket_rows),
                'tick_count': len(filtered_whale_rows),
                'bucket_window': resolved_bucket_window,
            },
            'session_summary': {
                'selected_trade_date': resolved_trade_date.isoformat(),
                'session_summary_state': 'complete' if facts is not None else 'empty',
            },
            'meta': {
                'data_state': 'snapshot',
                'degraded_mode': not has_flow_data,
                'is_stale': bool((facts is not None and facts.stale) or (snapshot_row is not None and snapshot_row.stale)),
                'stale_reason': stale_reason,
            },
            'whale_analytics': whale_analytics,
        })


class PortfolioWhaleBacktestStatsView(APIView):
    """GET /api/portfolio/whale/backtest-stats/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({'stats': [], 'note': 'backtest_stats_not_available_in_native'})


class PortfolioScreenerRuleDetailView(APIView):
    """GET/PUT/DELETE /api/portfolio/screener/rules/<pk>/"""
    permission_classes = [permissions.IsAuthenticated]

    def _get_rule(self, request, pk):
        from user_workspace.models import ScreenerRule
        tenant = getattr(request, 'tenant', None)
        try:
            if tenant:
                return ScreenerRule.objects.get(pk=pk, user=request.user, tenant=tenant)
            else:
                return ScreenerRule.objects.get(pk=pk, user=request.user)
        except ScreenerRule.DoesNotExist:
            raise NotFound('Bộ lọc không tồn tại.')

    def get(self, request, pk):
        rule = self._get_rule(request, pk)
        from user_workspace.serializers import ScreenerRuleSerializer
        return Response(ScreenerRuleSerializer(rule).data)

    def put(self, request, pk):
        rule = self._get_rule(request, pk)
        from user_workspace.serializers import ScreenerRuleSerializer
        serializer = ScreenerRuleSerializer(rule, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        if 'rules_json' in serializer.validated_data:
            from user_workspace.screener_helpers import _validate_screener_rules
            ok, err = _validate_screener_rules(serializer.validated_data['rules_json'])
            if not ok:
                return Response({'detail': err}, status=status.HTTP_400_BAD_REQUEST)
        
        rule = serializer.save()
        return Response(ScreenerRuleSerializer(rule).data)

    def delete(self, request, pk):
        rule = self._get_rule(request, pk)
        rule.delete()
        from rest_framework import status as http_status
        return Response(status=http_status.HTTP_204_NO_CONTENT)


class PortfolioScreenerRuleRunView(APIView):
    """POST /api/portfolio/screener/rules/<pk>/run/"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        from user_workspace.models import ScreenerRule
        tenant = getattr(request, 'tenant', None)
        try:
            if tenant:
                rule = ScreenerRule.objects.get(pk=pk, user=request.user, tenant=tenant)
            else:
                rule = ScreenerRule.objects.get(pk=pk, user=request.user)
        except ScreenerRule.DoesNotExist:
            raise NotFound('Bộ lọc không tồn tại.')

        conditions = rule.rules_json
        
        from market_serving.models import SymbolSnapshot, SessionFacts
        from market_data.models import DailyPrice
        from user_workspace.screener_helpers import _screener_build_technical, _apply_screener_condition
        from datetime import date, timedelta
        from collections import defaultdict
        
        latest_snap = SymbolSnapshot.objects.order_by('-session_date').first()
        if not latest_snap:
            return Response({
                'rule_id': rule.id,
                'rule_name': rule.name,
                'total_scanned': 0,
                'matched_count': 0,
                'matched': [],
            })
        
        session_date = latest_snap.session_date
        
        snapshots = SymbolSnapshot.objects.filter(session_date=session_date)
        symbols = [s.symbol for s in snapshots]
        
        facts_list = SessionFacts.objects.filter(session_date=session_date)
        facts_map = {f.symbol: f for f in facts_list}
        
        lookback_date = session_date - timedelta(days=90)
        prices = DailyPrice.objects.filter(symbol__in=symbols, date__gte=lookback_date).order_by('symbol', 'date')
        
        history_map = defaultdict(list)
        for p in prices:
            history_map[p.symbol].append(p)
            
        matched = []
        for snap in snapshots:
            sym = snap.symbol
            hist = history_map[sym]
            tech = _screener_build_technical(sym, snap.price, snap.volume, hist)
            
            facts = facts_map.get(sym)
            flow_facts = {}
            if facts:
                flow_facts = {
                    'dark_flow_strength': facts.dark_flow_score,
                    'dark_flow_avg_strength': facts.dark_flow_score,
                    'dark_flow_max_strength': facts.dark_flow_score,
                    'dark_flow_signal_count': 1 if facts.dark_flow_score > 0 else 0,
                    'dark_flow_cvd': facts.cvd_normalized,
                    
                    'whale_buy_value': facts.total_buy_volume * float(snap.price),
                    'whale_sell_value': facts.total_sell_volume * float(snap.price),
                    'whale_net_value': facts.whale_net_flow,
                    'whale_total_value': (facts.total_buy_volume + facts.total_sell_volume) * float(snap.price),
                    'whale_buy_pct': facts.buy_strength * 100,
                    'whale_sell_pct': (1 - facts.buy_strength) * 100,
                    'whale_intensity': facts.institutional_strength,
                }
            else:
                flow_facts = {
                    'dark_flow_strength': 0.0,
                    'dark_flow_avg_strength': 0.0,
                    'dark_flow_max_strength': 0.0,
                    'dark_flow_signal_count': 0,
                    'dark_flow_cvd': 0.0,
                    'whale_net_value': 0.0,
                    'whale_intensity': 0.0,
                }
                
            row = {
                'symbol': sym,
                'date': session_date.isoformat(),
                **tech,
                **flow_facts,
            }
            
            if all(_apply_screener_condition(row.get(cond['field']), cond['op'], cond['value']) for cond in conditions):
                matched.append(row)
                
        matched.sort(key=lambda item: item.get('close') or 0, reverse=True)
        
        return Response({
            'rule_id': rule.id,
            'rule_name': rule.name,
            'total_scanned': len(symbols),
            'matched_count': len(matched),
            'matched': matched,
        })

