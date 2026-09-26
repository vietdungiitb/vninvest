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
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.throttling import BaseThrottle
from rest_framework.views import APIView

from .endpoint_safety import UnsafeEndpointError, assert_safe_outbound_url
from .models import Portfolio, Transaction


class AIEndpointProbeThrottle(BaseThrottle):
    """    Dedicated bucket for the AI test-connection probe.

    The global UserRateThrottle allows 1000/hour (settings.py:263), which is not
    a mitigation for a view that makes an outbound HTTP request to a
    user-supplied address — it is an amplification budget. This caps probes
    per user per minute instead, so the SSRF guard is not the only thing
    standing between an authenticated account and the internal network.

    This throttle DOES run under the test suite. `DEFAULT_THROTTLE_CLASSES` is
    emptied when TESTING is true (settings.py:258-261), but a view that names
    `throttle_classes` explicitly keeps its own class regardless.
    """

    scope = 'ai_endpoint_probe'
    rate = 10          # requests
    window = 60        # seconds

    def get_cache_key(self, request, view):
        user = getattr(request, 'user', None)
        ident = getattr(user, 'pk', None) or getattr(user, 'username', None) or 'anon'
        return f'throttle_ai_endpoint_probe:{ident}'

    def allow_request(self, request, view):
        from django.core.cache import cache

        now = _monotonic()
        key = self.get_cache_key(request, view)
        self.history = [ts for ts in cache.get(key, []) if ts > now - self.window]
        if len(self.history) >= self.rate:
            return self.throttled()
        self.history.append(now)
        cache.set(key, self.history, self.window + 5)
        # BaseThrottle.allow_request raises NotImplementedError; a concrete
        # throttle must return True here rather than delegating upwards.
        return True

    def throttled(self):
        from rest_framework.exceptions import Throttled

        oldest = min(self.history) if self.history else _monotonic()
        return Throttled(wait=max(1, int(self.window - (_monotonic() - oldest))))


def _monotonic() -> float:
    import time as _time

    return _time.monotonic()


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

    def _get_or_create_user_credential(self, user):
        """Get or create UserAICredential for the user."""
        from advisory.models import UserAICredential
        try:
            return UserAICredential.objects.get(user=user)
        except UserAICredential.DoesNotExist:
            return UserAICredential.objects.create(user=user)

    def get(self, request):
        from advisory.models import SystemAISettings, UserAICredential
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

        # Read user credential (BYOK SSOT)
        try:
            user_cred = UserAICredential.objects.get(user=request.user)
        except UserAICredential.DoesNotExist:
            user_cred = None

        api_key_masked = ''
        if user_cred:
            provider = user_cred.ai_provider or 'openai'
            model = user_cred.ai_model or config.ai_model
            api_key_configured = bool(user_cred.encrypted_api_key)
            custom_endpoint = user_cred.custom_endpoint or ''
            fallback_remaining = user_cred.fallback_quota_remaining
            fallback_date = user_cred.fallback_quota_date
            if api_key_configured:
                # F4: expose only last4 mask — never full key in response body
                try:
                    from identity_access.security import decrypt_user_api_key
                    plain_key = decrypt_user_api_key(user_cred.encrypted_api_key)
                    api_key_masked = f'••••••••{plain_key[-4:]}' if len(plain_key) >= 4 else '••••••••'
                except Exception:
                    api_key_masked = '••••••••'
        else:
            # Fallback to legacy preferences
            from identity_access.models import UserProfile
            try:
                profile = UserProfile.objects.get(user=request.user)
                prefs = profile.preferences or {}
                provider = str(prefs.get('ai_provider', '') or 'openclaw').strip().lower()
                api_key_configured = bool(prefs.get('api_key', ''))
            except UserProfile.DoesNotExist:
                provider = 'openclaw'
                api_key_configured = False
            model = config.ai_model
            custom_endpoint = ''
            fallback_remaining = 0
            fallback_date = None
            if api_key_configured:
                try:
                    raw = str(prefs.get('api_key', '') or '')
                    try:
                        from identity_access.security import decrypt_user_api_key
                        plain_key = decrypt_user_api_key(raw)
                    except Exception:
                        plain_key = raw
                    api_key_masked = f'••••••••{plain_key[-4:]}' if len(plain_key) >= 4 else '••••••••'
                except Exception:
                    api_key_masked = '••••••••'

        ai_ready = api_key_configured or (provider == 'openclaw') or (provider == 'local')
        from django.conf import settings as django_settings
        fallback_quota_max = getattr(django_settings, 'AI_FALLBACK_DAILY_QUOTA', 5)

        # Per-user policy prefer (Slice C): user field > system metadata/config
        sys_refresh = int(metadata.get('advisory_refresh_interval_hours', 24))
        sys_max_auto = int(metadata.get('advisory_max_auto_refreshes_per_day', 24))
        sys_max_tokens = int(config.max_tokens)
        sys_temp = float(config.temperature)
        sys_prompt = metadata.get('ai_prompt_config') or prompt_config
        if user_cred:
            advisory_refresh = (
                user_cred.refresh_interval_hours
                if user_cred.refresh_interval_hours is not None else sys_refresh
            )
            advisory_max_auto = (
                user_cred.max_auto_refreshes_per_day
                if user_cred.max_auto_refreshes_per_day is not None else sys_max_auto
            )
            advisory_max_tokens = (
                user_cred.max_tokens_per_day
                if user_cred.max_tokens_per_day is not None else sys_max_tokens
            )
            advisory_temp = (
                user_cred.temperature
                if user_cred.temperature is not None else sys_temp
            )
            advisory_prompt = user_cred.prompt_config or sys_prompt
        else:
            advisory_refresh = sys_refresh
            advisory_max_auto = sys_max_auto
            advisory_max_tokens = sys_max_tokens
            advisory_temp = sys_temp
            advisory_prompt = sys_prompt

        response_data = {
            'ai_provider': provider,
            'ai_model': model,
            'ai_api_key': '',
            'ai_api_key_configured': api_key_configured,
            'ai_api_key_masked': api_key_masked,
            'system_prompt_template': config.prompt_template or '',
            'custom_endpoint': custom_endpoint,
            'effective_ai_source': metadata.get('effective_ai_source') or 'command_center',
            'effective_ai_provider': provider,
            'effective_ai_model': model or 'Chưa cấu hình',
            'ai_ready': ai_ready,
            'ai_config_message': metadata.get('ai_config_message') or 'AI Command Center đang phản ánh cấu hình hiệu lực của hệ thống.',
            'ai_prompt_config': advisory_prompt,
            'ai_prompt_config_history': list(user_cred.prompt_config_history or []) if user_cred else [],
            'advisory_refresh_interval_hours': int(advisory_refresh),
            'advisory_max_auto_refreshes_per_day': int(advisory_max_auto),
            'advisory_max_tokens_per_day': int(advisory_max_tokens),
            'temperature': float(advisory_temp),
            'fallback_quota_remaining': fallback_remaining,
            'fallback_quota_max': fallback_quota_max,
            'fallback_quota_reset': fallback_date,
        }
        return Response(response_data)

    def put(self, request):
        from advisory.models import SystemAISettings, UserAICredential
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

        # Save to UserAICredential (BYOK SSOT) — per-user policy lives here only (Slice C)
        user_cred = self._get_or_create_user_credential(request.user)

        # Resolve current effective policy (user > system) for audit before-snapshot
        sys_refresh = int(metadata.get('advisory_refresh_interval_hours', 24))
        sys_max_auto = int(metadata.get('advisory_max_auto_refreshes_per_day', 24))
        sys_max_tokens = int(config.max_tokens)
        sys_temp = float(config.temperature)
        before_refresh = (
            user_cred.refresh_interval_hours
            if user_cred.refresh_interval_hours is not None else sys_refresh
        )
        before_max_auto = (
            user_cred.max_auto_refreshes_per_day
            if user_cred.max_auto_refreshes_per_day is not None else sys_max_auto
        )
        before_max_tokens = (
            user_cred.max_tokens_per_day
            if user_cred.max_tokens_per_day is not None else sys_max_tokens
        )
        before_temp = (
            user_cred.temperature if user_cred.temperature is not None else sys_temp
        )

        from advisory.serializers import sanitize_sensitive_fields
        before_snapshot = sanitize_sensitive_fields({
            'ai_provider': user_cred.ai_provider or '',
            'ai_model': user_cred.ai_model or config.ai_model,
            'custom_endpoint': user_cred.custom_endpoint or '',
            'effective_ai_source': metadata.get('effective_ai_source') or 'command_center',
            'ai_ready': bool(user_cred.encrypted_api_key) or user_cred.ai_provider in ('openclaw', 'local'),
            'advisory_refresh_interval_hours': int(before_refresh),
            'advisory_max_auto_refreshes_per_day': int(before_max_auto),
            'advisory_max_tokens_per_day': int(before_max_tokens),
            'temperature': float(before_temp),
        })

        if 'ai_provider' in payload:
            user_cred.ai_provider = str(payload.get('ai_provider') or 'openai').strip().lower()

        if 'ai_api_key' in payload:
            api_key = str(payload.get('ai_api_key') or '').strip()
            if api_key:
                from identity_access.security import encrypt_user_api_key
                user_cred.encrypted_api_key = encrypt_user_api_key(api_key)
            else:
                # F4 clear: drop stored key for BYOK providers; keep local/openclaw as-is
                if user_cred.ai_provider not in ('local', 'openclaw'):
                    user_cred.encrypted_api_key = ''

        if 'ai_model' in payload:
            user_cred.ai_model = str(payload.get('ai_model') or '').strip()

        # R0.5 — validate provider/model SAU khi cả hai đã được gán, để bắt
        # được cả hai chiều: đổi provider (giữ model cũ) và đổi model
        # (giữ provider cũ). Không có check này thì cấu hình
        # provider=gemini + model=gpt-4o-mini lọt vào DB và mọi lần
        # advisory đều fail 404 từ provider.
        if 'ai_provider' in payload or 'ai_model' in payload:
            from advisory.model_choices import validate_model_for_provider
            _provider = str(user_cred.ai_provider or '').strip().lower()
            _model = str(user_cred.ai_model or '').strip()
            _is_valid, _model_error = validate_model_for_provider(_provider, _model)
            if not _is_valid:
                raise ValidationError({'ai_model': _model_error})

        if 'custom_endpoint' in payload:
            user_cred.custom_endpoint = str(payload.get('custom_endpoint') or '').strip()

        # Per-user advisory config — write UserAICredential only, never SystemAISettings
        # F7: JSON append history on every effective prompt_config change
        prompt_config_changed = False
        if 'ai_prompt_config' in payload:
            pc = payload.get('ai_prompt_config')
            new_pc = pc if isinstance(pc, dict) else {}
            old_pc = user_cred.prompt_config if isinstance(user_cred.prompt_config, dict) else {}
            if new_pc != old_pc:
                prompt_config_changed = True
                user_cred.prompt_config = new_pc

        if 'advisory_refresh_interval_hours' in payload:
            try:
                _val = int(payload.get('advisory_refresh_interval_hours'))
            except (TypeError, ValueError):
                raise ValidationError({'advisory_refresh_interval_hours': 'Must be an integer.'})
            if not (1 <= _val <= 168):
                raise ValidationError({'advisory_refresh_interval_hours': 'Must be 1..168.'})
            user_cred.refresh_interval_hours = _val

        if 'advisory_max_auto_refreshes_per_day' in payload:
            try:
                _val = int(payload.get('advisory_max_auto_refreshes_per_day'))
            except (TypeError, ValueError):
                raise ValidationError({'advisory_max_auto_refreshes_per_day': 'Must be an integer.'})
            if not (0 <= _val <= 24):
                raise ValidationError({'advisory_max_auto_refreshes_per_day': 'Must be 0..24.'})
            user_cred.max_auto_refreshes_per_day = _val

        if 'advisory_max_tokens_per_day' in payload:
            try:
                _val = int(payload.get('advisory_max_tokens_per_day'))
            except (TypeError, ValueError):
                raise ValidationError({'advisory_max_tokens_per_day': 'Must be an integer.'})
            if not (1 <= _val <= 100000):
                raise ValidationError({'advisory_max_tokens_per_day': 'Must be 1..100000.'})
            user_cred.max_tokens_per_day = _val

        if 'temperature' in payload:
            try:
                user_cred.temperature = min(1.0, max(0.0, float(payload.get('temperature'))))
            except (TypeError, ValueError):
                pass

        user_cred.save()

        # F7: append history AFTER save so entry sees final prompt_config
        if prompt_config_changed:
            from advisory.advisory_helpers import _append_prompt_config_history
            _append_prompt_config_history(user_cred, user_cred.prompt_config, source='save')
            user_cred.save(update_fields=['prompt_config_history', 'updated_at'])

        # Create audit log — after reflects user rows (C.1.6)
        from advisory.models import AIAuditLog
        after_snapshot = sanitize_sensitive_fields({
            'ai_provider': user_cred.ai_provider or '',
            'ai_model': user_cred.ai_model or config.ai_model,
            'custom_endpoint': user_cred.custom_endpoint or '',
            'effective_ai_source': metadata.get('effective_ai_source') or 'command_center',
            'ai_ready': bool(user_cred.encrypted_api_key) or user_cred.ai_provider in ('openclaw', 'local'),
            'advisory_refresh_interval_hours': int(
                user_cred.refresh_interval_hours
                if user_cred.refresh_interval_hours is not None else sys_refresh
            ),
            'advisory_max_auto_refreshes_per_day': int(
                user_cred.max_auto_refreshes_per_day
                if user_cred.max_auto_refreshes_per_day is not None else sys_max_auto
            ),
            'advisory_max_tokens_per_day': int(
                user_cred.max_tokens_per_day
                if user_cred.max_tokens_per_day is not None else sys_max_tokens
            ),
            'temperature': float(
                user_cred.temperature if user_cred.temperature is not None else sys_temp
            ),
        })
        diff_parts = []
        for field in [
            'ai_provider', 'ai_model', 'effective_ai_source', 'custom_endpoint',
            'advisory_refresh_interval_hours', 'advisory_max_auto_refreshes_per_day',
            'advisory_max_tokens_per_day', 'temperature',
        ]:
            bv = str(before_snapshot.get(field, ''))
            av = str(after_snapshot.get(field, ''))
            if bv != av:
                diff_parts.append(f'{field}: {bv} → {av}')
        AIAuditLog.objects.create(
            action=AIAuditLog.ActionChoices.UPDATE_SETTINGS,
            actor=request.user.username,
            reason=f'Cập nhật cấu hình AI: {"; ".join(diff_parts) if diff_parts else "không có thay đổi"}.',
            before_json=before_snapshot,
            after_json=after_snapshot,
            diff_summary='; '.join(diff_parts) if diff_parts else 'Không có thay đổi',
        )

        provider = user_cred.ai_provider or 'openai'
        model = user_cred.ai_model or config.ai_model
        api_key_configured = bool(user_cred.encrypted_api_key)
        ai_ready = api_key_configured or (provider in ('openclaw', 'local'))
        from django.conf import settings as django_settings
        fallback_quota_max = getattr(django_settings, 'AI_FALLBACK_DAILY_QUOTA', 5)
        api_key_masked = ''
        if api_key_configured:
            try:
                from identity_access.security import decrypt_user_api_key
                plain_key = decrypt_user_api_key(user_cred.encrypted_api_key)
                api_key_masked = f'••••••••{plain_key[-4:]}' if len(plain_key) >= 4 else '••••••••'
            except Exception:
                api_key_masked = '••••••••'

        response_data = {
            'ai_provider': provider,
            'ai_model': model,
            'ai_api_key': '',
            'ai_api_key_configured': api_key_configured,
            'ai_api_key_masked': api_key_masked,
            'system_prompt_template': config.prompt_template or '',
            'custom_endpoint': user_cred.custom_endpoint or '',
            'effective_ai_source': metadata.get('effective_ai_source') or 'command_center',
            'effective_ai_provider': provider,
            'effective_ai_model': model or 'Chưa cấu hình',
            'ai_ready': ai_ready,
            'ai_config_message': metadata.get('ai_config_message') or 'Cấu hình AI Command Center đã được cập nhật thành công.',
            'ai_prompt_config': user_cred.prompt_config or metadata.get('ai_prompt_config'),
            'ai_prompt_config_history': list(user_cred.prompt_config_history or []),
            'advisory_refresh_interval_hours': int(
                user_cred.refresh_interval_hours
                if user_cred.refresh_interval_hours is not None else sys_refresh
            ),
            'advisory_max_auto_refreshes_per_day': int(
                user_cred.max_auto_refreshes_per_day
                if user_cred.max_auto_refreshes_per_day is not None else sys_max_auto
            ),
            'advisory_max_tokens_per_day': int(
                user_cred.max_tokens_per_day
                if user_cred.max_tokens_per_day is not None else sys_max_tokens
            ),
            'temperature': float(
                user_cred.temperature if user_cred.temperature is not None else sys_temp
            ),
            'fallback_quota_remaining': user_cred.fallback_quota_remaining,
            'fallback_quota_max': fallback_quota_max,
            'fallback_quota_reset': user_cred.fallback_quota_date,
        }
        return Response(response_data)


class PortfolioAICommandCenterPromptConfigRollbackView(APIView):
    """POST /workspace/ai-command-center/prompt-config/rollback/ — F7 F-AC7.

    Body: {"version": int} — restore that snapshot into prompt_config and
    append a history entry with source='rollback'. Full config returned in
    history[i].config so GET alone is enough to inspect any version.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from advisory.models import SystemAISettings, UserAICredential
        from advisory.advisory_helpers import _append_prompt_config_history
        from vninvest_core.exceptions import ValidationErrorException

        payload = request.data if isinstance(request.data, dict) else {}
        try:
            version = int(payload.get('version'))
        except (TypeError, ValueError):
            raise ValidationErrorException(detail='version must be an integer')

        try:
            user_cred = UserAICredential.objects.get(user=request.user)
        except UserAICredential.DoesNotExist:
            raise ValidationErrorException(detail='No prompt config history for this user')

        history = list(user_cred.prompt_config_history or [])
        match = next((h for h in history if int(h.get('version', -1)) == version), None)
        if not match:
            raise ValidationErrorException(detail=f'Prompt config version {version} not found')

        restored = match.get('config') if isinstance(match.get('config'), dict) else {}
        user_cred.prompt_config = restored
        _append_prompt_config_history(user_cred, restored, source='rollback')
        user_cred.save(update_fields=['prompt_config', 'prompt_config_history', 'updated_at'])

        from advisory.models import AIAuditLog
        from advisory.serializers import sanitize_sensitive_fields
        AIAuditLog.objects.create(
            action=AIAuditLog.ActionChoices.UPDATE_SETTINGS,
            actor=request.user.username,
            reason=f'Rollback prompt config về version {version} (source=rollback).',
            before_json=sanitize_sensitive_fields({'prompt_config': None}),
            after_json=sanitize_sensitive_fields({'prompt_config_version': version}),
            diff_summary=f'prompt_config rollback → v{version}',
        )

        config = SystemAISettings.objects.filter(is_active=True).order_by('-updated_at').first()
        metadata = dict(config.metadata) if config else {}
        return Response({
            'ai_prompt_config': user_cred.prompt_config or metadata.get('ai_prompt_config'),
            'ai_prompt_config_history': list(user_cred.prompt_config_history or []),
            'rolled_back_to': version,
        })


class PortfolioAICommandCenterTestView(APIView):
    """POST /api/portfolio/ai-command-center/test-connection/
    
    Active Probe: gọi API thực tế đến provider để kiểm tra kết nối.
    - openclaw: system default, không cần key
    - local: gọi GET /models đến custom_endpoint hoặc localhost
    - openai/gemini/claude: gửi 1 tin nhắn test tối thiểu
    """
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [AIEndpointProbeThrottle]

    def post(self, request):
        from vninvest_core.exceptions import ValidationErrorException
        from advisory.models import AIAuditLog
        import httpx

        payload = request.data if isinstance(request.data, dict) else {}
        provider = str(payload.get('ai_provider') or '').strip().lower()
        model = str(payload.get('ai_model') or '').strip()
        api_key = str(payload.get('ai_api_key') or '').strip()
        custom_endpoint = str(payload.get('custom_endpoint') or '').strip()

        if not provider:
            raise ValidationErrorException(detail='Vui lòng chọn Nhà cung cấp AI hợp lệ.', code='validation_error')
        if not model:
            raise ValidationErrorException(detail='Vui lòng chọn hoặc cấu hình Mô hình AI.', code='validation_error')

        # Helper to write audit logs
        def _log_test(audit_action, message):
            AIAuditLog.objects.create(
                action=audit_action,
                actor=request.user.username,
                reason=message,
                before_json={},
                after_json={'ai_provider': provider, 'ai_model': model, 'status': 'success' if 'SUCCESS' in audit_action else 'failed'},
                diff_summary=f'Test connection {provider}/{model}: {message}',
            )

        # openclaw: system default, luôn ready
        if provider == 'openclaw':
            _log_test(AIAuditLog.ActionChoices.TEST_CONNECTION_SUCCESS, 'OpenClaw mặc định luôn sẵn sàng.')
            return Response({
                'message': f'Kết nối đến OpenClaw (Default) với mô hình {model} thành công. Phản hồi mượt mà.',
                'latency_ms': 0,
            })

        # local: active probe đến endpoint Ollama/vLLM
        if provider == 'local':
            endpoint = custom_endpoint.rstrip('/') if custom_endpoint else 'http://localhost:11434/v1'
            # P0-3 (audit Entry 228): custom_endpoint is user-controlled and was
            # passed straight to httpx, so any authenticated user could make this
            # server GET internal-only addresses. Validate before the outbound
            # call, not after. `local` is the only provider allowed to reach
            # loopback — a co-located Ollama/vLLM is the point of that provider —
            # but 169.254.169.254 (instance metadata), RFC1918, and non-HTTP
            # schemes stay blocked even here.
            try:
                assert_safe_outbound_url(endpoint, allow_loopback=True)
            except UnsafeEndpointError as exc:
                _log_test(
                    AIAuditLog.ActionChoices.TEST_CONNECTION_FAILED,
                    f'Local Model endpoint bị chặn: {exc}',
                )
                raise ValidationErrorException(
                    detail=f'Endpoint bị chặn: {exc}',
                    code='validation_error',
                )
            models_url = f'{endpoint}/models'
            try:
                with httpx.Client(timeout=5.0) as client:
                    resp = client.get(models_url)
                    resp.raise_for_status()
                    data = resp.json()
                    models_list = [m.get('name', m.get('id', '')) for m in (data.get('data') or data.get('models') or [])]
                    _log_test(AIAuditLog.ActionChoices.TEST_CONNECTION_SUCCESS, f'Local Model {endpoint} kết nối thành công.')
                    return Response({
                        'message': f'Kết nối đến Local Model ({endpoint}) thành công. Mô hình khả dụng: {", ".join(models_list[:5]) or "N/A"}.',
                        'endpoint': endpoint,
                        'models_available': models_list,
                        'latency_ms': int(resp.elapsed.total_seconds() * 1000),
                    })
            except httpx.TimeoutException:
                _log_test(AIAuditLog.ActionChoices.TEST_CONNECTION_FAILED, f'Local Model {endpoint} timeout 5s.')
                raise ValidationErrorException(
                    detail=f'Không thể kết nối đến Local Model tại {endpoint} — timeout 5s. Kiểm tra endpoint hoặc khởi động Ollama/vLLM.',
                    code='validation_error',
                )
            except httpx.HTTPStatusError as e:
                _log_test(AIAuditLog.ActionChoices.TEST_CONNECTION_FAILED, f'Local Model {endpoint} HTTP {e.response.status_code}.')
                raise ValidationErrorException(
                    detail=f'Local Model tại {endpoint} trả về lỗi HTTP {e.response.status_code}.',
                    code='validation_error',
                )
            except Exception as e:
                _log_test(AIAuditLog.ActionChoices.TEST_CONNECTION_FAILED, f'Local Model {endpoint}: {str(e)}.')
                raise ValidationErrorException(
                    detail=f'Không thể kết nối Local Model: {str(e)}.',
                    code='validation_error',
                )

        # OpenAI/Gemini/Claude: active probe thực tế
        # Resolve key: ưu tiên payload, fallback UserAICredential, fallback SystemAISettings
        resolved_key = api_key
        if not resolved_key:
            from advisory.models import UserAICredential, SystemAISettings
            try:
                user_cred = UserAICredential.objects.get(user=request.user)
                if user_cred.encrypted_api_key:
                    from identity_access.security import decrypt_user_api_key
                    resolved_key = decrypt_user_api_key(user_cred.encrypted_api_key)
            except UserAICredential.DoesNotExist:
                pass

        if not resolved_key:
            from advisory.models import SystemAISettings
            config = SystemAISettings.objects.filter(is_active=True).order_by('-updated_at').first()
            if config and config.metadata:
                sys_encrypted = config.metadata.get('encrypted_api_key', '')
                if sys_encrypted:
                    from identity_access.security import decrypt_user_api_key
                    resolved_key = decrypt_user_api_key(sys_encrypted)

        if not resolved_key:
            _log_test(AIAuditLog.ActionChoices.TEST_CONNECTION_FAILED, f'Thiếu API Key cho {provider}/{model}.')
            raise ValidationErrorException(
                detail=f'Lỗi kết nối đến {provider}: Thiếu API Key cho mô hình {model}. Vui lòng cấu hình API Key trong AI Command Center.',
                code='validation_error',
            )

        # Determine endpoint
        if provider == 'gemini':
            endpoint = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
        else:
            endpoint = "https://api.openai.com/v1/chat/completions"

        test_payload = {
            "model": model,
            "messages": [
                {"role": "user", "content": "Hello, respond with just 'OK'."}
            ],
            "max_tokens": 10,
            "temperature": 0.0,
        }
        headers = {
            "Authorization": f"Bearer {resolved_key}",
            "Content-Type": "application/json",
        }

        try:
            with httpx.Client(timeout=10.0) as client:
                start = __import__('time').time()
                resp = client.post(endpoint, headers=headers, json=test_payload)
                resp.raise_for_status()
                latency_ms = int((__import__('time').time() - start) * 1000)
                _log_test(AIAuditLog.ActionChoices.TEST_CONNECTION_SUCCESS, f'{provider}/{model} kết nối thành công ({latency_ms}ms).')
                return Response({
                    'message': f'Kiểm tra kết nối thành công: Đã xác thực API Key với {provider} / {model}. Phản hồi trong {latency_ms}ms.',
                    'latency_ms': latency_ms,
                })
        except httpx.TimeoutException:
            _log_test(AIAuditLog.ActionChoices.TEST_CONNECTION_FAILED, f'{provider}/{model} timeout 10s.')
            raise ValidationErrorException(
                detail=f'Kết nối đến {provider} timeout sau 10s. Kiểm tra API Key hoặc mạng.',
                code='validation_error',
            )
        except httpx.HTTPStatusError as e:
            status_code = e.response.status_code
            if status_code == 401:
                _log_test(AIAuditLog.ActionChoices.TEST_CONNECTION_FAILED, f'{provider}/{model} từ chối API Key (HTTP 401).')
                raise ValidationErrorException(
                    detail=f'{provider} từ chối API Key (HTTP 401). Kiểm tra lại API Key cho mô hình {model}.',
                    code='validation_error',
                )
            _log_test(AIAuditLog.ActionChoices.TEST_CONNECTION_FAILED, f'{provider}/{model} HTTP {status_code}.')
            raise ValidationErrorException(
                detail=f'{provider} trả về lỗi HTTP {status_code} cho mô hình {model}.',
                code='validation_error',
            )
        except Exception as e:
            _log_test(AIAuditLog.ActionChoices.TEST_CONNECTION_FAILED, f'{provider}/{model}: {str(e)}.')
            raise ValidationErrorException(
                detail=f'Lỗi kết nối đến {provider}: {str(e)}.',
                code='validation_error',
            )


class PortfolioAICommandCenterAuditLogView(APIView):
    """GET /workspace/ai-command-center/audit-logs/

    Trả về audit logs với pagination, filter theo action/actor/date range.

    R0.11 — `AIAuditLog` không có FK user/tenant, chỉ có `actor` (CharField,
    ghi bằng `request.user.username`). Trước đây `queryset = AIAuditLog.objects.all()`
    với `IsAuthenticated` nghĩa là BẤT KỲ user đăng nhập nào cũng đọc được log
    cấu hình AI của user khác (bao gồm `before_json`/`after_json` đã mask
    nhưng vẫn lộ metadata cấu hình). Nay scope theo actor, chỉ staff mới
    xem được toàn bộ.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from advisory.models import AIAuditLog
        from advisory.serializers import AIAuditLogSerializer

        queryset = AIAuditLog.objects.all()

        # R0.11 — chỉ superuser/staff được xem log toàn hệ thống.
        is_operator = bool(
            getattr(request.user, 'is_superuser', False)
            or getattr(request.user, 'is_staff', False)
        )
        if not is_operator:
            queryset = queryset.filter(actor=request.user.username)

        action = request.query_params.get('action', '').strip()
        if action:
            queryset = queryset.filter(action=action)

        actor = request.query_params.get('actor', '').strip()
        if actor:
            # User không phải operator không được lọc sang actor khác để dò
            # ra log ngoài phạm vi của mình.
            if is_operator or actor == request.user.username:
                queryset = queryset.filter(actor__icontains=actor)
            else:
                queryset = queryset.none()

        date_from = request.query_params.get('date_from', '').strip()
        if date_from:
            queryset = queryset.filter(created_at__gte=date_from)

        date_to = request.query_params.get('date_to', '').strip()
        if date_to:
            queryset = queryset.filter(created_at__lte=date_to)

        try:
            limit = min(int(request.query_params.get('limit', 10)), 100)
        except (TypeError, ValueError):
            limit = 10
        try:
            offset = max(int(request.query_params.get('offset', 0)), 0)
        except (TypeError, ValueError):
            offset = 0

        total = queryset.count()
        logs = queryset[offset:offset + limit]
        serializer = AIAuditLogSerializer(logs, many=True)

        return Response({
            'results': serializer.data,
            'total': total,
            'limit': limit,
            'offset': offset,
        })


class PortfolioUserConfigLegacyView(APIView):
    """GET /workspace/userconfig/ — proxy đến identity_access.UserProfile

    Cung cấp event gate status (advisory_whale_signal_enabled) cho SaaS frontend.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from identity_access.models import UserProfile
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        prefs = profile.preferences or {}
        return Response({
            'id': profile.pk,
            'language': profile.language,
            'theme': profile.theme,
            'preferences': prefs,
            'advisory_whale_signal_enabled': prefs.get('advisory_whale_signal_enabled', True),
        })

    def patch(self, request):
        from identity_access.models import UserProfile
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        prefs = profile.preferences or {}

        if 'advisory_whale_signal_enabled' in request.data:
            prefs['advisory_whale_signal_enabled'] = bool(request.data['advisory_whale_signal_enabled'])

        profile.preferences = prefs
        profile.save(update_fields=['preferences'])

        return Response({
            'ok': True,
            'preferences': prefs,
            'advisory_whale_signal_enabled': prefs.get('advisory_whale_signal_enabled', True),
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
        # P0.6: inactive rules (template previews) are hidden from detail view;
        # PUT/DELETE still work so previews can be promoted or cleaned up.
        if not rule.is_active:
            raise NotFound('Bộ lọc không tồn tại.')
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


class PortfolioAIAdvisoryListView(APIView):
    """GET /portfolio/ai-advisory/ — batch advisory listing hôm nay của user.

    R0.12 — trước đây trả `{'items': []}` cố định, buộc FE phải fallback sang
    20 request per-symbol (`useWhaleAdvisoryData.js:7,16`). Implement thật để
    bỏ được N+1 request và cho sidebar một nguồn dữ liệu duy nhất.

    Scope: `user=request.user` + `session_date=hôm nay` (giờ Asia/Ho_Chi_Minh).
    """
    permission_classes = [permissions.IsAuthenticated]

    #: trần số record trả về để không kéo nặng response
    MAX_ITEMS = 200

    def get(self, request):
        from advisory.models import AdvisoryRecord
        from advisory.serializers import AdvisoryRecordSerializer
        from django.utils import timezone

        symbol = str(request.query_params.get('symbol') or '').strip().upper()
        session_date = timezone.localdate()

        queryset = (
            AdvisoryRecord.objects
            .filter(user=request.user, session_date=session_date)
            .order_by('-created_at')
        )
        if symbol:
            queryset = queryset.filter(symbol=symbol)

        records = list(queryset[: self.MAX_ITEMS])
        return Response({
            'items': AdvisoryRecordSerializer(records, many=True).data,
            'session_date': session_date.isoformat(),
            'count': len(records),
            'truncated': len(records) >= self.MAX_ITEMS,
        })


class PortfolioAIAdvisorySymbolStatsView(APIView):
    """GET /portfolio/ai-advisory-symbol-stats/ — stats theo mã cho sidebar.

    R0.6 — trước đây trả `{'stats': []}` cố định, khiến
    `WhaleSymbolSidebar.js:125,128,136` render "0%" / "▲ 0" cho MỌI mã:
    `buildFallbackSymbolStats` không có advisory nên mọi field về 0. Ba cột
    đó là số liệu bịa, không phải thiếu dữ liệu.

    Nay trả đúng những gì có nguồn thật. Cố ý KHÔNG trả `whale_intensity` /
    `buy_count` / `sell_count` vì không có trường nào trong DB làm nguồn cho
    chúng — thiếu dữ liệu thì vắng mặt, không phải điền 0.
    """
    permission_classes = [permissions.IsAuthenticated]

    MAX_SYMBOLS = 200

    def get(self, request):
        from advisory.models import AdvisoryRecord
        from advisory.signal_norm import normalize_confidence, normalize_signal, signal_to_side
        from django.utils import timezone

        session_date = timezone.localdate()

        raw_symbols = request.query_params.get('symbols') or ''
        requested = [
            token.strip().upper()
            for token in str(raw_symbols).split(',')
            if token.strip()
        ][: self.MAX_SYMBOLS]

        queryset = AdvisoryRecord.objects.filter(
            user=request.user,
            session_date=session_date,
        )
        if requested:
            queryset = queryset.filter(symbol__in=requested)

        # Chỉ tính record đã sinh thành công — record pending/failed không
        # có khuyến nghị để hiển thị.
        generated = [row for row in queryset.order_by('-created_at') if row.status == 'generated']

        latest_by_symbol = {}
        for row in generated:
            if row.symbol in latest_by_symbol:
                continue
            structured = row.structured_output if isinstance(row.structured_output, dict) else {}
            latest_by_symbol[row.symbol] = {
                'symbol': row.symbol,
                'side': signal_to_side(normalize_signal(structured.get('signal'))),
                'signal': normalize_signal(structured.get('signal')),
                'confidence_score': normalize_confidence(structured.get('confidence_score')),
                'is_discovery': bool(structured.get('is_discovery') or False),
                'updated_at': (
                    row.generated_at or row.updated_at
                ).isoformat() if (row.generated_at or row.updated_at) else None,
            }

        stats = sorted(
            latest_by_symbol.values(),
            key=lambda item: (
                -(item['confidence_score'] or 0),
                item['symbol'],
            ),
        )
        if requested:
            order = {symbol: index for index, symbol in enumerate(requested)}
            stats.sort(key=lambda item: order.get(item['symbol'], len(order)))

        return Response({
            'stats': stats,
            'session_date': session_date.isoformat(),
            'count': len(stats),
        })



# P0.1: allowlisted flow fields with NO SessionFacts source (see market_serving
# models SessionFacts: only cvd/strengths/whale_net_flow/dark_score/buy-sell
# volumes exist). Always None -> never match; reported via missing_fields (Q2).
_FLOW_FIELDS_NO_SOURCE = (
    'whale_unknown_value', 'whale_unknown_pct', 'whale_trade_count',
    'whale_whale_value', 'whale_shark_value', 'whale_small_value',
)

# P1.1: server-side sort/paging contract (IMPLEMENTATION_PLAN_SCREENER_P1_20260913.md §2).
# D2/D3 (Entry 73): default sort=ai_score/desc; limit enum includes 2000 for export.
# NOTE (minor plan extension, logged Entry 74): sortable set covers every numeric
# table column (+symbol/date) so the P0 table keeps full-column sorting via server.
_SORTABLE_FIELDS = ('ai_score', 'symbol', 'date', 'close', 'rsi_14', 'sma20', 'sma50',
                    'price_vs_sma20_pct', 'price_vs_sma50_pct', 'sma20_vs_sma50_pct',
                    'momentum_20d_pct', 'macd_hist', 'volume_rvol', 'avg_volume_20',
                    'range_position_pct', 'stochastic_k', 'stochastic_d', 'atr_14',
                    'adx_14', 'bollinger_width', 'vwap', 'mfi_14', 'pe_ratio',
                    'market_cap', 'dividend_yield', 'eps_growth_yoy', 'revenue_growth_yoy',
                    'debt_to_equity')
_PAGE_LIMITS = (10, 25, 50, 100, 2000)
_DEFAULT_SORT = 'ai_score'
_DEFAULT_ORDER = 'desc'
_DEFAULT_PAGE = 1
_DEFAULT_LIMIT = 25


def _parse_scan_params(request):
    """Parse optional P1.1 scan params (querystring first, JSON body fallback).

    Returns (has_params, sort, order, page, limit, include_ai, error_response).
    error_response is a DRF Response (400) when validation fails, else None.
    """
    from rest_framework.response import Response as _Response
    from rest_framework import status as _status

    def _bad(msg):
        return _Response({'detail': msg}, status=_status.HTTP_400_BAD_REQUEST)

    qp = request.query_params
    body = request.data if isinstance(request.data, dict) else {}

    def _param(name):
        v = qp.get(name, None)
        return body.get(name, v) if v is None else v

    raw = {k: _param(k) for k in ('sort', 'order', 'page', 'limit', 'include_ai')}
    has_params = any(v is not None for v in raw.values())

    sort, order, page, limit, include_ai = _DEFAULT_SORT, _DEFAULT_ORDER, _DEFAULT_PAGE, _DEFAULT_LIMIT, True
    if not has_params:
        return has_params, sort, order, page, limit, include_ai, None

    if raw['sort'] is not None:
        sort = str(raw['sort'])
        if sort not in _SORTABLE_FIELDS:
            return has_params, sort, order, page, limit, include_ai, _bad(
                f'Sort "{sort}" không hợp lệ. Cho phép: {", ".join(_SORTABLE_FIELDS)}.')
    if raw['order'] is not None:
        order = str(raw['order']).lower()
        if order not in ('asc', 'desc'):
            return has_params, sort, order, page, limit, include_ai, _bad(
                'Order phải là "asc" hoặc "desc".')
    if raw['page'] is not None:
        try:
            page = int(raw['page'])
        except (TypeError, ValueError):
            return has_params, sort, order, page, limit, include_ai, _bad('Page phải là số nguyên ≥ 1.')
        if page < 1:
            return has_params, sort, order, page, limit, include_ai, _bad('Page phải là số nguyên ≥ 1.')
    if raw['limit'] is not None:
        try:
            limit = int(raw['limit'])
        except (TypeError, ValueError):
            limit = -1
        if limit not in _PAGE_LIMITS:
            return has_params, sort, order, page, limit, include_ai, _bad(
                f'Limit phải thuộc {list(_PAGE_LIMITS)}.')
    if raw['include_ai'] is not None:
        s = str(raw['include_ai']).lower()
        if s in ('1', 'true'):
            include_ai = True
        elif s in ('0', 'false'):
            include_ai = False
        else:
            return has_params, sort, order, page, limit, include_ai, _bad(
                'include_ai phải là 0 hoặc 1.')
    if not include_ai and sort == 'ai_score':
        return has_params, sort, order, page, limit, include_ai, _bad(
            'include_ai=0 không dùng được với sort=ai_score (không có điểm AI để xếp hạng).')
    return has_params, sort, order, page, limit, include_ai, None



from django.conf import settings

from rest_framework.throttling import UserRateThrottle


class ScreenerRunThrottle(UserRateThrottle):
    """P1.5: rate-limit run endpoint (D5). Bypass in TESTING/DEBUG via settings (F-BE-04)."""

    scope = 'screener_run'

    def get_rate(self):
        if getattr(settings, 'TESTING', False) or getattr(settings, 'DEBUG', False):
            return '999999/day'
        return '30/min'


class ScreenerStatusThrottle(UserRateThrottle):
    """P1.5 + F-SEC-11: status polling needs higher budget (40/min at 1.5s interval > 30/min)."""

    scope = 'screener_status'

    def get_rate(self):
        if getattr(settings, 'TESTING', False) or getattr(settings, 'DEBUG', False):
            return '999999/day'
        return '60/min'

def _scan_sort_value(item, sort):
    if sort == 'ai_score':
        adv = item.get('ai_advisory') or {}
        return adv.get('ai_score_0_100')
    if sort == 'symbol':
        return str(item.get('symbol') or '')
    return item.get(sort)


# P1.2: Django-cache TTL for full scan results (D4, Entry 73).
_SCAN_CACHE_TTL = 14400  # overridden by settings.SCREENER_SCAN_CACHE_TTL

# P1.4: async threshold + job helpers (D1, Entry 77)
_SCREENER_SYNC_SYMBOL_LIMIT_DEFAULT = 800
_SCREENER_JOB_TTL = 3600
_SCREENER_MAX_PENDING = 3


def _screener_job_key(job_id: str) -> str:
    return f"screener:job:{job_id}"


def _screener_jobs_set_key(user_id: int) -> str:
    return f"screener:jobs:{user_id}"


def _get_pending_jobs(cache_obj, user_id: int):
    raw = cache_obj.get(_screener_jobs_set_key(user_id))
    if isinstance(raw, set):
        return set(raw)
    if isinstance(raw, list):
        return set(raw)
    return set()


def _add_pending_job(cache_obj, user_id: int, job_id: str):
    key = _screener_jobs_set_key(user_id)
    pending = _get_pending_jobs(cache_obj, user_id)
    pending.add(job_id)
    cache_obj.set(key, pending, timeout=_SCREENER_JOB_TTL)


def _remove_pending_job(cache_obj, user_id: int, job_id: str):
    key = _screener_jobs_set_key(user_id)
    pending = _get_pending_jobs(cache_obj, user_id)
    if job_id in pending:
        pending.remove(job_id)
        cache_obj.set(key, pending, timeout=_SCREENER_JOB_TTL)



def _scan_cache_key(user_id, rule, session_date, include_ai):
    """Cache key WITHOUT sort/order (Option B, Entry 76): one entry serves all
    sorts/pages; updated_at auto-invalidates on rule edit, session_date on new session."""
    updated_ts = int(rule.updated_at.timestamp()) if getattr(rule, "updated_at", None) else 0
    return (
        f"screener:scan:{user_id}:{rule.id}:{updated_ts}:"
        f"{session_date.isoformat()}:{int(bool(include_ai))}"
    )


def _compute_scan(conditions, session_date, include_ai):
    """P1.2: full scan compute extracted from PortfolioScreenerRuleRunView.post
    (P1.4 will reuse it from the celery task). Returns
    (matched_unsorted, total_scanned, missing_counts_dict, window_days)."""
    from market_serving.models import SymbolSnapshot, SessionFacts
    from market_data.models import DailyPrice
    from market_data.models import StockProfile
    from market_data.vnbroker_adapter import get_company_financials_response
    from user_workspace.screener_helpers import (
        _screener_build_technical, _apply_screener_condition, _compute_fundamental_metrics,
        _required_lookback_days, _lookback_calendar_days,
    )
    from user_workspace.ai_advisory_helpers import compute_ai_advisory
    from django.core.cache import cache as _fin_cache
    from datetime import timedelta
    from collections import defaultdict, Counter

    # P1.3: dynamic window from the rule's condition fields (D7 clamp [35, 90])
    # instead of a fixed 90 calendar days.
    window_days = _lookback_calendar_days(_required_lookback_days(conditions))

    # P1.3: trim columns — _screener_build_technical only reads
    # symbol/date/close/volume/high/low (deferred fields stay untouched;
    # touching them later would add queries — see U3).
    snapshots = SymbolSnapshot.objects.filter(session_date=session_date).only(
        'symbol', 'session_date', 'price', 'volume')
    symbols = [s.symbol for s in snapshots]

    facts_list = SessionFacts.objects.filter(session_date=session_date).only(
        'symbol', 'session_date', 'dark_flow_score', 'cvd_normalized',
        'total_buy_volume', 'total_sell_volume', 'whale_net_flow',
        'buy_strength', 'institutional_strength')
    facts_map = {f.symbol: f for f in facts_list}

    # Bulk-read outstanding shares (canonical profile source) for market_cap derivation
    profile_map = {
        p['symbol']: p
        for p in StockProfile.objects.filter(symbol__in=symbols).values('symbol', 'outstanding_shares')
    }

    lookback_date = session_date - timedelta(days=window_days)
    prices = DailyPrice.objects.filter(
        symbol__in=symbols, date__gte=lookback_date).only(
        'symbol', 'date', 'close', 'volume', 'high', 'low').order_by('symbol', 'date')

    history_map = defaultdict(list)
    for p in prices:
        history_map[p.symbol].append(p)

    # P1.3: pre-warm financials with ONE cache roundtrip (key format verified:
    # vnbroker_adapter caches `stock_financials:{SYMBOL}` 12h). Misses fall
    # through to the adapter (which re-caches). SSOT/TTL unchanged.
    _fin_cached = _fin_cache.get_many([f"stock_financials:{s.upper()}" for s in symbols])

    # P0.1: fields referenced by this rule's conditions — used to report
    # per-field missing-data coverage (Q2 badge).
    cond_list = conditions if isinstance(conditions, list) else []
    cond_fields = {c.get('field') for c in cond_list if isinstance(c, dict) and c.get('field')}
    missing_counts = Counter()

    matched = []
    for snap in snapshots:
        sym = snap.symbol
        hist = history_map[sym]
        # SSOT: fundamentals come from the canonical vnbroker adapter (cached 12h);
        # P1.3 serves cache hits from the pre-warmed batch above.
        _fin_hit = _fin_cached.get(f"stock_financials:{sym.upper()}")
        if isinstance(_fin_hit, dict):
            financials = _fin_hit.get('financials', {})
        else:
            financials = get_company_financials_response(sym).get('financials', {})
        os_shares = profile_map.get(sym, {}).get('outstanding_shares')
        fundamental_metrics = _compute_fundamental_metrics(
            financials,
            float(snap.price) if snap.price is not None else None,
            os_shares,
        )
        tech = _screener_build_technical(sym, snap.price, snap.volume, hist, fundamental_metrics=fundamental_metrics)

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
            # P0.1: same shape as the facts branch (deliberate zeros), so
            # every allowlisted field is always present in the row (R1.1).
            flow_facts = {
                'dark_flow_strength': 0.0,
                'dark_flow_avg_strength': 0.0,
                'dark_flow_max_strength': 0.0,
                'dark_flow_signal_count': 0,
                'dark_flow_cvd': 0.0,
                'whale_buy_value': 0.0,
                'whale_sell_value': 0.0,
                'whale_net_value': 0.0,
                'whale_total_value': 0.0,
                'whale_buy_pct': 0.0,
                'whale_sell_pct': 0.0,
                'whale_intensity': 0.0,
            }
        # P0.1: fields with no source are explicit None (never match —
        # _apply_screener_condition(None) is False) and surface via
        # missing_fields/missing_counts below (Q2 "thiếu dữ liệu" badge).
        for no_src_field in _FLOW_FIELDS_NO_SOURCE:
            flow_facts[no_src_field] = None

        row = {
            'symbol': sym,
            'date': session_date.isoformat(),
            **tech,
            **flow_facts,
        }

        # AI advisory (S3.1) — fallback None nếu lỗi, không crash scan.
        # P1.1: include_ai=0 skips the compute entirely (D6).
        if include_ai:
            try:
                row['ai_advisory'] = compute_ai_advisory(row)
            except Exception:
                row['ai_advisory'] = None
        else:
            row['ai_advisory'] = None

        # Evaluate conditions with AND/OR/NOT logic
        if conditions:
            # First condition always applies (no logic operator)
            first_cond = conditions[0]
            result = _apply_screener_condition(row.get(first_cond['field']), first_cond['op'], first_cond['value'])

            # Process remaining conditions with their logic operators
            for cond in conditions[1:]:
                cond_result = _apply_screener_condition(row.get(cond['field']), cond['op'], cond['value'])
                logic = cond.get('logic', 'AND')
                if logic == 'AND':
                    result = result and cond_result
                elif logic == 'OR':
                    result = result or cond_result
                elif logic == 'NOT':
                    result = result and (not cond_result)

            if result:
                matched.append(row)
        else:
            # No conditions means match all
            matched.append(row)

        # P0.1: count symbols missing each condition field (evaluated for
        # every scanned row, not just matched — coverage denominator below).
        for f in cond_fields:
            if row.get(f) is None:
                missing_counts[f] += 1
    return matched, len(symbols), dict(missing_counts), window_days


class PortfolioScreenerRuleRunView(APIView):
    """POST /api/portfolio/screener/rules/<pk>/run/"""
    # P0.6 deviation (see IMPLEMENTATION_PLAN_SCREENER_P0_20260913.md §1.3):
    # run intentionally ALLOWS inactive rules so template previews (P0.4,
    # stored as is_active=False) can execute without appearing in list/detail.
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScreenerRunThrottle]

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

        # P1.1: validate scan params BEFORE any heavy work (fail fast on 400).
        has_scan_params, sort, order, page, limit, include_ai, param_error = _parse_scan_params(request)
        if param_error is not None:
            return param_error

        from market_serving.models import SymbolSnapshot, SessionFacts
        from market_data.models import DailyPrice
        from user_workspace.screener_helpers import (
            _screener_build_technical, _apply_screener_condition, _compute_fundamental_metrics,
            _required_lookback_days, _lookback_calendar_days,
        )
        from user_workspace.ai_advisory_helpers import compute_ai_advisory
        from market_data.models import StockProfile
        from market_data.vnbroker_adapter import get_company_financials_response
        from datetime import date, timedelta
        from collections import defaultdict

        latest_snap = SymbolSnapshot.objects.order_by('-session_date').first()
        if not latest_snap:
            payload = {
                'rule_id': rule.id,
                'rule_name': rule.name,
                'total_scanned': 0,
                'matched_count': 0,
                'matched': [],
            }
            if has_scan_params:
                payload.update({'page': page, 'limit': limit, 'pages': 1, 'sort': sort, 'order': order})
            return Response(payload)
        
        session_date = latest_snap.session_date

        # P0.1: staleness metadata for the UI banner (weekends/holidays scan
        # the last available session — never silently).
        today = date.today()
        days_old = (today - session_date).days if session_date else 0
        is_stale = days_old > 0

        # P1.2: result cache (Option B) — key has no sort/order; sorting and
        # paging apply to the cached full list below. TTL from settings (D4).
        from django.core.cache import cache as _scan_cache
        from django.conf import settings as _scan_settings
        from user_workspace.screener_helpers import _required_lookback_days, _lookback_calendar_days
        _scan_ttl = getattr(_scan_settings, "SCREENER_SCAN_CACHE_TTL", _SCAN_CACHE_TTL)
        scan_cache_key = _scan_cache_key(request.user.id, rule, session_date, include_ai)
        cached_scan = _scan_cache.get(scan_cache_key)
        _cache_hit = isinstance(cached_scan, dict) and "matched" in cached_scan
        if _cache_hit and cached_scan.get("truncated") and has_scan_params:
            _cached_rows = cached_scan.get("matched") or []
            if (page - 1) * limit >= len(_cached_rows):
                # F-BE-06: page beyond cached top-N → recompute instead of
                # returning a short page.
                _cache_hit = False
        _truncated_total = None
        if _cache_hit:
            matched = cached_scan["matched"]
            total_scanned = cached_scan.get("total_scanned", len(matched))
            missing_counts = cached_scan.get("missing_counts", {})
            _truncated_total = cached_scan.get("total_matched")
            window_days = _lookback_calendar_days(_required_lookback_days(conditions))
        else:
            # P1.4: async branch — cache miss + large universe or ?async=1 → 202 queued
            from django.core.cache import cache as _job_cache
            from django.conf import settings as _job_settings
            import uuid
            _sync_limit = getattr(_job_settings, "SCREENER_SYNC_SYMBOL_LIMIT", _SCREENER_SYNC_SYMBOL_LIMIT_DEFAULT)
            # Universe size check (cheap count, not full scan)
            try:
                from market_serving.models import SymbolSnapshot as _SnapForCount
                _universe_cnt = _SnapForCount.objects.filter(session_date=session_date).count()
            except Exception:
                _universe_cnt = 0
            # ?async=1 forces async even for small universe (query param or JSON body)
            _force_async = False
            try:
                if request.query_params.get("async") == "1":
                    _force_async = True
                elif isinstance(request.data, dict) and str(request.data.get("async")) == "1":
                    _force_async = True
            except Exception:
                pass
            _should_async = _force_async or (_universe_cnt > _sync_limit)
            if _should_async:
                # Pending cap D5
                _pending = _get_pending_jobs(_job_cache, request.user.id)
                if len(_pending) >= _SCREENER_MAX_PENDING:
                    from rest_framework.response import Response as _R429
                    return _R429(
                        {"detail": "Quá nhiều tác vụ đang chờ. Vui lòng thử lại sau.", "retry_after": 60},
                        status=429,
                    )
                _job_id = uuid.uuid4().hex
                _job_key = _screener_job_key(_job_id)
                # Snapshot rule to avoid drift if user edits mid-run
                try:
                    _updated_ts = int(rule.updated_at.timestamp()) if getattr(rule, "updated_at", None) else 0
                except Exception:
                    _updated_ts = 0
                _snapshot = {"rules_json": conditions, "updated_at_ts": _updated_ts}
                # Queue job
                _job_cache.set(
                    _job_key,
                    {"status": "queued", "scanned": 0, "total": _universe_cnt, "job_id": _job_id, "rule_id": rule.id},
                    timeout=_SCREENER_JOB_TTL,
                )
                _add_pending_job(_job_cache, request.user.id, _job_id)
                # Delay task (ALWAYS_EAGER → runs sync in test, but we still return 202)
                try:
                    from user_workspace.screener_tasks import run_screener_scan_task

                    # tenant_id for task (optional, not used for compute but for audit)
                    _tenant_id = getattr(rule, "tenant_id", None)
                    if _tenant_id is None:
                        _t = getattr(rule, "tenant", None)
                        _tenant_id = getattr(_t, "id", None) if _t else None
                    run_screener_scan_task.delay(
                        request.user.id,
                        _tenant_id,
                        rule.id,
                        _snapshot,
                        session_date.isoformat(),
                        int(bool(include_ai)),
                        _job_id,
                    )
                except Exception as exc:
                    # If delay fails, mark failed and fallback to sync? For now return 500-like
                    _job_cache.set(_job_key, {"status": "failed", "error": str(exc), "job_id": _job_id}, timeout=_SCREENER_JOB_TTL)
                    _remove_pending_job(_job_cache, request.user.id, _job_id)
                    from rest_framework.response import Response as _R500
                    return _R500({"detail": f"Không thể tạo tác vụ quét: {exc}"}, status=500)
                poll_url = f"/core/v1/screener/rules/{rule.id}/run/status/?job_id={_job_id}"
                from rest_framework.response import Response as _R202

                return _R202({"status": "queued", "job_id": _job_id, "poll_url": poll_url}, status=202)
            # Sync path (small universe or not forced)
            matched, total_scanned, missing_counts, window_days = _compute_scan(
                conditions, session_date, include_ai)
            # F-BE-06: size-guarded cache write (top-N + truncated flag when >1MB).
            from user_workspace.screener_helpers import build_scan_cache_value
            _scan_cache.set(scan_cache_key, build_scan_cache_value(
                matched, total_scanned, missing_counts,
            ), timeout=_scan_ttl)

        if has_scan_params:
            # P1.1: server sort (None always last, both directions) + paging.
            valued = [r for r in matched if _scan_sort_value(r, sort) is not None]
            noval = [r for r in matched if _scan_sort_value(r, sort) is None]
            valued.sort(key=lambda item: _scan_sort_value(item, sort), reverse=(order == 'desc'))
            matched = valued + noval
        else:
            # Legacy path (no params): exact P0 behavior — close desc, full list.
            matched.sort(key=lambda item: item.get('close') or 0, reverse=True)

        payload = {
            'rule_id': rule.id,
            'rule_name': rule.name,
            'total_scanned': total_scanned,
            # F-BE-06: truncated cache reports the true total, not the top-N length.
            'matched_count': _truncated_total or len(matched),
            'matched': matched,
            # P0.1 additions (additive only — the 5 legacy keys above unchanged).
            'session_date': session_date.isoformat(),
            'is_stale': is_stale,
            'days_old': days_old,
            'missing_fields': sorted(missing_counts),
            'missing_counts': dict(missing_counts),
            # P1.3: calendar-day price window actually used (R3.1 evidence).
            'window_days': window_days,
        }
        if _truncated_total:
            # F-BE-06 (additive): cache held top-N only; FE paginates cached
            # rows, deeper pages trigger recompute server-side.
            payload['truncated'] = True
            payload['total_matched'] = _truncated_total
        if has_scan_params:
            # P1.1 meta (additive). pages min 1 so clients never divide by zero.
            pages = (len(matched) + limit - 1) // limit if limit > 0 else 1
            pages = max(pages, 1)
            start = (page - 1) * limit
            payload['matched'] = matched[start:start + limit]
            payload.update({'page': page, 'limit': limit, 'pages': pages, 'sort': sort, 'order': order})
        # P2.3: create history entry (BE, D10 quota 100/user) — Q5
        try:
            from user_workspace.models import ScreenerRunHistory

            # Use full matched (pre-paging, already sorted) for history, truncated to 100 rows
            history_source = matched  # full sorted list
            history_rows = []
            for r in history_source[:100]:
                adv = r.get('ai_advisory') or {}
                history_rows.append(
                    {
                        'symbol': r.get('symbol'),
                        'close': r.get('close'),
                        'action': adv.get('strategy_action'),
                        'score': adv.get('ai_score_0_100'),
                    }
                )
            # Tenant fallback: request.tenant may be None in tests (no TenantResolutionMiddleware)
            tenant_for_history = tenant or getattr(rule, 'tenant', None)
            if tenant_for_history is None:
                # Last resort: user's primary tenant
                try:
                    from identity_access.models import CoreTenant

                    tenant_for_history = CoreTenant.objects.filter(owner_user=request.user).first()
                except Exception:
                    tenant_for_history = None
            # If still None, skip history (avoid IntegrityError) — tenant is required
            if tenant_for_history is not None:
                ScreenerRunHistory.objects.create(
                    user=request.user,
                    tenant=tenant_for_history,
                    rule=rule,
                    rule_name=rule.name,
                    matched_count=len(history_source),
                    total_scanned=total_scanned,
                    window_days=window_days,
                    session_date=session_date,
                    matched=history_rows,
                    params={
                        'sort': sort,
                        'order': order,
                        'page': page,
                        'limit': limit,
                        'include_ai': int(bool(include_ai)),
                    }
                    if has_scan_params
                    else {},
                )
                # Enforce quota 100 per user+tenant
                qs = ScreenerRunHistory.objects.filter(user=request.user, tenant=tenant_for_history)
                if qs.count() > 100:
                    oldest_ids = list(qs.order_by('-run_at').values_list('id', flat=True)[100:])
                    if oldest_ids:
                        ScreenerRunHistory.objects.filter(id__in=oldest_ids).delete()
        except Exception:
            import logging

            logging.getLogger(__name__).exception("Failed to create screener history")
        return Response(payload)



class PortfolioScreenerRuleRunStatusView(APIView):
    """GET /screener/rules/<pk>/run/status/?job_id=... — P1.4 job polling."""

    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScreenerStatusThrottle]

    def get(self, request, pk):
        from user_workspace.models import ScreenerRule
        from django.core.cache import cache as _cache

        tenant = getattr(request, "tenant", None)
        try:
            if tenant:
                rule = ScreenerRule.objects.get(pk=pk, user=request.user, tenant=tenant)
            else:
                rule = ScreenerRule.objects.get(pk=pk, user=request.user)
        except ScreenerRule.DoesNotExist:
            raise NotFound("Bộ lọc không tồn tại.")

        job_id = request.query_params.get("job_id")
        if not job_id:
            from rest_framework.response import Response
            return Response({"detail": "Thiếu tham số job_id."}, status=400)
        # F-SEC-11: validate job_id format (uuid hex 32 chars) to avoid cache-key injection
        import re as _re

        if not _re.fullmatch(r"[0-9a-fA-F]{32}", str(job_id)):
            from rest_framework.response import Response
            return Response({"detail": "job_id không hợp lệ."}, status=400)

        job_key = _screener_job_key(job_id)
        payload = _cache.get(job_key)
        if payload is None:
            # Unknown / expired — FE fallback to sync per plan §5f
            from rest_framework.response import Response
            return Response({"status": "unknown", "job_id": job_id}, status=200)
        # Optional ownership check: job should belong to this user (stored rule_id check)
        # If payload has rule_id, ensure it matches requested pk
        if isinstance(payload, dict) and "rule_id" in payload and int(payload["rule_id"]) != int(pk):
            from rest_framework.response import Response
            return Response({"detail": "Tác vụ không thuộc bộ lọc này."}, status=404)
        from rest_framework.response import Response
        return Response(payload)


def _validate_schedule_payload(data):
    """Validate P2.4 schedule payload. Returns (ok, cleaned|error)."""
    if not isinstance(data, dict):
        return False, 'Payload phải là object.'
    name = str(data.get('name', '')).strip()
    if not name:
        return False, 'Tên lịch không được để trống.'
    rule_ids = data.get('rule_ids', [])
    if not isinstance(rule_ids, list) or not rule_ids:
        return False, 'rule_ids phải là list không rỗng.'
    try:
        rule_ids = [int(r) for r in rule_ids]
    except (TypeError, ValueError):
        return False, 'rule_ids phải là list số nguyên.'
    run_time_raw = str(data.get('run_time', '18:00')).strip()
    try:
        from datetime import datetime as _dt

        run_time = _dt.strptime(run_time_raw, '%H:%M').time()
    except (TypeError, ValueError):
        return False, 'run_time phải dạng HH:MM (VD: 18:00).'
    weekdays = data.get('weekdays', [0, 1, 2, 3, 4])
    if not isinstance(weekdays, list) or not all(isinstance(w, int) and 0 <= w <= 6 for w in weekdays):
        return False, 'weekdays phải là list số 0-6 (0=Mon).'
    channels = data.get('notify_channels', ['in_app'])
    if not isinstance(channels, list) or not all(c in ('in_app', 'email') for c in channels):
        return False, "notify_channels chỉ gồm 'in_app', 'email'."
    return True, {'name': name[:100], 'rule_ids': rule_ids, 'run_time': run_time, 'weekdays': weekdays, 'notify_channels': channels or ['in_app']}


def _schedule_to_dict(s):
    return {
        'id': s.id,
        'name': s.name,
        'rule_ids': s.rule_ids,
        'run_time': s.run_time.strftime('%H:%M') if s.run_time else None,
        'weekdays': s.weekdays,
        'is_active': s.is_active,
        'notify_channels': s.notify_channels,
        'last_run_at': s.last_run_at.isoformat() if s.last_run_at else None,
        'next_run_at': s.next_run_at.isoformat() if s.next_run_at else None,
    }


class ScreenerScheduleListCreateView(APIView):
    """P2.4: GET/POST /screener/schedules/"""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from user_workspace.models import ScreenerSchedule

        tenant = getattr(request, 'tenant', None)
        qs = ScreenerSchedule.objects.filter(user=request.user)
        if tenant:
            qs = qs.filter(tenant=tenant)
        return Response([_schedule_to_dict(s) for s in qs.order_by('-created_at')])

    def post(self, request):
        from user_workspace.models import ScreenerRule, ScreenerSchedule

        tenant = getattr(request, 'tenant', None)
        ok, cleaned = _validate_schedule_payload(request.data if isinstance(request.data, dict) else {})
        if not ok:
            return Response({'detail': cleaned}, status=400)
        # Rule IDs must exist for this user
        existing = set(
            ScreenerRule.objects.filter(user=request.user, pk__in=cleaned['rule_ids']).values_list('pk', flat=True)
        )
        missing = [r for r in cleaned['rule_ids'] if r not in existing]
        if missing:
            return Response({'detail': f'Rule không tồn tại: {missing}'}, status=400)
        # Tenant fallback like history
        tenant_for = tenant
        if tenant_for is None:
            try:
                from identity_access.models import CoreTenant

                tenant_for = CoreTenant.objects.filter(owner_user=request.user).first()
            except Exception:
                tenant_for = None
        if tenant_for is None:
            return Response({'detail': 'Không xác định tenant.'}, status=400)
        s = ScreenerSchedule.objects.create(
            user=request.user,
            tenant=tenant_for,
            name=cleaned['name'],
            rule_ids=cleaned['rule_ids'],
            run_time=cleaned['run_time'],
            weekdays=cleaned['weekdays'],
            notify_channels=cleaned['notify_channels'],
        )
        return Response(_schedule_to_dict(s), status=201)


class ScreenerScheduleDetailView(APIView):
    """P2.4: GET/PUT/DELETE /screener/schedules/<id>/"""

    permission_classes = [permissions.IsAuthenticated]

    def _get(self, request, pk):
        from user_workspace.models import ScreenerSchedule

        tenant = getattr(request, 'tenant', None)
        try:
            if tenant:
                return ScreenerSchedule.objects.get(pk=pk, user=request.user, tenant=tenant)
            return ScreenerSchedule.objects.get(pk=pk, user=request.user)
        except ScreenerSchedule.DoesNotExist:
            raise NotFound('Lịch không tồn tại.')

    def get(self, request, pk):
        return Response(_schedule_to_dict(self._get(request, pk)))

    def put(self, request, pk):
        s = self._get(request, pk)
        data = request.data if isinstance(request.data, dict) else {}
        # Partial update: name/rule_ids/run_time/weekdays/is_active/notify_channels
        if 'name' in data:
            name = str(data['name']).strip()
            if not name:
                return Response({'detail': 'Tên lịch không được để trống.'}, status=400)
            s.name = name[:100]
        if 'rule_ids' in data or 'run_time' in data or 'weekdays' in data or 'notify_channels' in data:
            merged = {
                'name': s.name,
                'rule_ids': data.get('rule_ids', s.rule_ids),
                'run_time': data.get('run_time', s.run_time.strftime('%H:%M') if s.run_time else '18:00'),
                'weekdays': data.get('weekdays', s.weekdays),
                'notify_channels': data.get('notify_channels', s.notify_channels),
            }
            ok, cleaned = _validate_schedule_payload(merged)
            if not ok:
                return Response({'detail': cleaned}, status=400)
            s.rule_ids, s.run_time, s.weekdays, s.notify_channels = (
                cleaned['rule_ids'],
                cleaned['run_time'],
                cleaned['weekdays'],
                cleaned['notify_channels'],
            )
            # Recompute next run when timing changes
            try:
                from user_workspace.models import _compute_next_run

                s.next_run_at = _compute_next_run(s.run_time, s.weekdays)
            except Exception:
                pass
        if 'is_active' in data:
            s.is_active = bool(data['is_active'])
        s.save()
        return Response(_schedule_to_dict(s))

    def delete(self, request, pk):
        self._get(request, pk).delete()
        return Response(status=204)


class ScreenerScheduleRunNowView(APIView):
    """P2.4: POST /screener/schedules/<id>/run-now/ — enqueue task per rule."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        from user_workspace.models import ScreenerRule

        tenant = getattr(request, 'tenant', None)
        try:
            from user_workspace.models import ScreenerSchedule

            if tenant:
                sched = ScreenerSchedule.objects.get(pk=pk, user=request.user, tenant=tenant)
            else:
                sched = ScreenerSchedule.objects.get(pk=pk, user=request.user)
        except Exception:
            raise NotFound('Lịch không tồn tại.')
        # Latest session for snapshot
        from datetime import date as _date

        try:
            from market_serving.models import SymbolSnapshot as _Snap

            _latest = _Snap.objects.order_by('-session_date').first()
            session_iso = _latest.session_date.isoformat() if _latest and _latest.session_date else _date.today().isoformat()
        except Exception:
            session_iso = _date.today().isoformat()
        import uuid as _uuid

        from user_workspace.screener_tasks import run_screener_scan_task

        job_ids = []
        for rid in (sched.rule_ids or []):
            try:
                rule = ScreenerRule.objects.filter(pk=int(rid), user=request.user).first()
                if rule is None:
                    continue
                try:
                    uts = int(rule.updated_at.timestamp()) if getattr(rule, 'updated_at', None) else 0
                except Exception:
                    uts = 0
                jid = _uuid.uuid4().hex
                run_screener_scan_task.delay(
                    request.user.id,
                    getattr(rule, 'tenant_id', None),
                    rule.id,
                    {"rules_json": rule.rules_json, "updated_at_ts": uts},
                    session_iso,
                    1,
                    jid,
                    sched.id,
                )
                job_ids.append({'rule_id': rule.id, 'job_id': jid})
            except Exception:
                continue
        # Update last_run_at
        try:
            from django.utils import timezone as _tz

            sched.last_run_at = _tz.now()
            sched.save(update_fields=['last_run_at'])
        except Exception:
            pass
        return Response({'scheduled': sched.id, 'jobs': job_ids})


class ScreenerScheduleAlertsView(APIView):
    """P2.4: GET /screener/schedules/alerts/ — in_app new_symbols alerts (cache 7d)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.core.cache import cache as _cache

        alerts = _cache.get(f"screener:sched_alerts:{request.user.id}") or []
        if not isinstance(alerts, list):
            alerts = []
        return Response({'count': len(alerts), 'results': alerts[:50]})


class ScreenerTemplatesView(APIView):
    """GET /screener/templates/ — pre-built screener template catalog (S2.5)."""

    def get(self, request):
        from .screener_templates import SCREENER_TEMPLATES

        return Response({'templates': SCREENER_TEMPLATES})


class ScreenerHistoryListView(APIView):
    """P2.3: GET /screener/history/?rule_id=&page=&limit= — list + DELETE clear all."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from user_workspace.models import ScreenerRunHistory

        tenant = getattr(request, 'tenant', None)
        qs = ScreenerRunHistory.objects.filter(user=request.user)
        if tenant:
            qs = qs.filter(tenant=tenant)
        rule_id = request.query_params.get('rule_id')
        if rule_id:
            try:
                qs = qs.filter(rule_id=int(rule_id))
            except (TypeError, ValueError):
                pass
        # Pagination: page/limit, default 1/20
        try:
            page = int(request.query_params.get('page', '1'))
            limit = int(request.query_params.get('limit', '20'))
        except (TypeError, ValueError):
            page, limit = 1, 20
        page = max(1, page)
        limit = max(1, min(limit, 100))
        total = qs.count()
        pages = (total + limit - 1) // limit if limit else 1
        start = (page - 1) * limit
        items = qs.order_by('-run_at')[start : start + limit]
        data = [
            {
                'id': h.id,
                'rule_id': h.rule_id,
                'rule_name': h.rule_name,
                'run_at': h.run_at.isoformat() if h.run_at else None,
                'matched_count': h.matched_count,
                'total_scanned': h.total_scanned,
                'window_days': h.window_days,
                'session_date': h.session_date.isoformat() if h.session_date else None,
                'matched': h.matched,
                'params': h.params,
            }
            for h in items
        ]
        return Response({'count': total, 'page': page, 'limit': limit, 'pages': pages, 'results': data})

    def delete(self, request):
        from user_workspace.models import ScreenerRunHistory

        tenant = getattr(request, 'tenant', None)
        qs = ScreenerRunHistory.objects.filter(user=request.user)
        if tenant:
            qs = qs.filter(tenant=tenant)
        deleted, _ = qs.delete()
        return Response({'deleted': deleted})


class ScreenerHistoryDetailView(APIView):
    """P2.3: GET/DELETE /screener/history/<id>/"""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        from user_workspace.models import ScreenerRunHistory

        tenant = getattr(request, 'tenant', None)
        try:
            if tenant:
                h = ScreenerRunHistory.objects.get(pk=pk, user=request.user, tenant=tenant)
            else:
                h = ScreenerRunHistory.objects.get(pk=pk, user=request.user)
        except ScreenerRunHistory.DoesNotExist:
            raise NotFound('Lịch sử không tồn tại.')
        return Response(
            {
                'id': h.id,
                'rule_id': h.rule_id,
                'rule_name': h.rule_name,
                'run_at': h.run_at.isoformat() if h.run_at else None,
                'matched_count': h.matched_count,
                'total_scanned': h.total_scanned,
                'window_days': h.window_days,
                'session_date': h.session_date.isoformat() if h.session_date else None,
                'matched': h.matched,
                'params': h.params,
            }
        )

    def delete(self, request, pk):
        from user_workspace.models import ScreenerRunHistory

        tenant = getattr(request, 'tenant', None)
        try:
            if tenant:
                h = ScreenerRunHistory.objects.get(pk=pk, user=request.user, tenant=tenant)
            else:
                h = ScreenerRunHistory.objects.get(pk=pk, user=request.user)
        except ScreenerRunHistory.DoesNotExist:
            raise NotFound('Lịch sử không tồn tại.')
        h.delete()
        return Response(status=204)


class ScreenerHistoryBacktestView(APIView):
    """P2.3: GET /screener/history/<id>/backtest/?horizon=5 — server backtest v2."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        from user_workspace.models import ScreenerRunHistory
        from market_data.models import DailyPrice
        from datetime import timedelta

        tenant = getattr(request, 'tenant', None)
        try:
            if tenant:
                h = ScreenerRunHistory.objects.get(pk=pk, user=request.user, tenant=tenant)
            else:
                h = ScreenerRunHistory.objects.get(pk=pk, user=request.user)
        except ScreenerRunHistory.DoesNotExist:
            raise NotFound('Lịch sử không tồn tại.')
        # horizon: 5 or 20 days (default 5)
        try:
            horizon = int(request.query_params.get('horizon', '5'))
        except (TypeError, ValueError):
            horizon = 5
        horizon = max(1, min(horizon, 60))
        # Build trades like screenerHistoryStore.buildTrades but server-side from DailyPrice
        matched = h.matched or []
        # Only BUY/SELL with close
        candidates = [r for r in matched if r.get('action') in ('BUY', 'SELL') and r.get('close') is not None and r.get('symbol')]
        if not candidates:
            return Response({'winRate': 0, 'wins': 0, 'losses': 0, 'evaluated': 0, 'trades': [], 'horizon': horizon})
        # For each candidate, find exit price after horizon trading days from run_at date
        # Use DailyPrice: for symbol, date > run_at.date, order by date, take horizon-th
        run_date = h.run_at.date() if h.run_at else None
        trades = []
        wins = 0
        for row in candidates:
            sym = row['symbol']
            entry = float(row['close'])
            action = row['action']
            # Find exit: DailyPrice for symbol where date > run_date, limit horizon, take last
            qs = DailyPrice.objects.filter(symbol=sym)
            if run_date:
                qs = qs.filter(date__gt=run_date)
            qs = qs.order_by('date')[:horizon]
            closes = list(qs.values_list('close', flat=True))
            if not closes:
                continue
            exit_price = float(closes[-1])
            win = (exit_price > entry) if action == 'BUY' else (exit_price < entry)
            if win:
                wins += 1
            trades.append({'symbol': sym, 'action': action, 'entry': entry, 'exit': exit_price, 'win': win})
        evaluated = len(trades)
        losses = evaluated - wins
        win_rate = (wins / evaluated * 100) if evaluated else 0
        return Response(
            {
                'winRate': round(win_rate, 2),
                'wins': wins,
                'losses': losses,
                'evaluated': evaluated,
                'trades': trades[:15],
                'horizon': horizon,
            }
        )

