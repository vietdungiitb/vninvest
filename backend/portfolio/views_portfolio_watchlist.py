import os
import sys
from decimal import Decimal

from django.core.cache import cache
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

# Setup path for packages/core imports
_core_backend_src = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '../../packages/core/backend/src')
)
if os.path.exists(_core_backend_src) and _core_backend_src not in sys.path:
    sys.path.insert(0, _core_backend_src)

# Core models (AUTHORITY)
try:
    from user_workspace.models import Portfolio, Watchlist, WatchlistItem
except (ImportError, RuntimeError):
    from .models import Portfolio, WatchlistGroup as Watchlist, WatchlistItem  # noqa: F401 - fallback

from .analytics import (
    build_risk_metrics,
    build_summary,
    compute_allocation,
    compute_allocation_by_sector,
    compute_holdings,
    compute_nav_series,
)
from .services import sync_portfolio_prices, sync_watchlist_prices
from .models import (
    DailyPrice,
    SubAccount,
    Transaction,
    UserConfig,
    StockProfile,
)
from .serializers import (
    ChartPointSerializer,
    HoldingSerializer,
    PortfolioSerializer,
    SubAccountSerializer,
    SummarySerializer,
    TransactionSerializer,
    UserConfigSerializer,
    WatchlistGroupSerializer,
    WatchlistItemSerializer,
)


class WatchlistGroupListCreateView(generics.ListCreateAPIView):
    serializer_class = WatchlistGroupSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated()]
        return []

    def get_queryset(self):
        if not self.request.user or not self.request.user.is_authenticated:
            return Watchlist.objects.none()
        return Watchlist.objects.filter(user=self.request.user).prefetch_related('items')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class WatchlistGroupDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = WatchlistGroupSerializer

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            return [IsAuthenticated()]
        return []

    def get_queryset(self):
        if not self.request.user or not self.request.user.is_authenticated:
            return Watchlist.objects.none()
        return Watchlist.objects.filter(user=self.request.user).prefetch_related('items')


class WatchlistItemCreateView(generics.CreateAPIView):
    serializer_class = WatchlistItemSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        group_id = self.kwargs['group_id']
        group = generics.get_object_or_404(Watchlist, pk=group_id, user=self.request.user)
        instance = serializer.save(watchlist=group)

        from .services_symbol_engagement import activate_symbol_engagement
        from django.db import transaction as db_transaction
        
        def _trigger_engagement():
            try:
                activate_symbol_engagement(
                    user_id=self.request.user.id,
                    symbol=instance.symbol,
                    source='watchlist_add'
                )
            except Exception as e:
                # Fail-soft: engagement failure should not break the main response
                import logging
                logging.getLogger(__name__).warning(f"Failed to trigger engagement warm-up for {instance.symbol}: {e}")

        db_transaction.on_commit(_trigger_engagement)


class WatchlistItemDeleteView(generics.DestroyAPIView):
    serializer_class = WatchlistItemSerializer
    permission_classes = [IsAuthenticated]
    lookup_url_kwarg = 'item_id'

    def get_queryset(self):
        return WatchlistItem.objects.filter(watchlist__user=self.request.user)


class WatchlistSeedView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        return Response({'detail': 'Seed not implemented'}, status=status.HTTP_501_NOT_IMPLEMENTED)


def _sync_cooldown_seconds_for_user(user) -> int:
    default_non_staff = 45
    default_staff = 10
    env_key = 'SYNC_PRICE_COOLDOWN_SECONDS_STAFF' if getattr(user, 'is_staff', False) else 'SYNC_PRICE_COOLDOWN_SECONDS'
    default_value = default_staff if getattr(user, 'is_staff', False) else default_non_staff
    try:
        parsed = int(os.getenv(env_key, str(default_value)))
    except (TypeError, ValueError):
        parsed = default_value
    return max(parsed, 0)


def _acquire_sync_cooldown(user, action: str) -> tuple[bool, int]:
    cooldown_seconds = _sync_cooldown_seconds_for_user(user)
    if cooldown_seconds <= 0:
        return True, 0

    now_ts = int(timezone.now().timestamp())
    cache_key = f'sync:cooldown:{action}:user:{user.id}'
    next_until = now_ts + cooldown_seconds
    try:
        if cache.add(cache_key, next_until, timeout=cooldown_seconds):
            return True, 0
    except Exception:
        pass

    locked_until = cache.get(cache_key)
    try:
        locked_until_int = int(locked_until)
    except (TypeError, ValueError):
        locked_until_int = 0

    if locked_until_int > now_ts:
        return False, max(locked_until_int - now_ts, 1)

    cache.set(cache_key, next_until, timeout=cooldown_seconds)
    return True, 0


class WatchlistSyncView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        days_raw = request.data.get('days', 5)
        try:
            days = int(days_raw)
            if days < 1 or days > 90:
                raise ValueError
        except (ValueError, TypeError):
            return Response({'detail': 'days phải là số nguyên trong khoảng [1, 90].'}, status=status.HTTP_400_BAD_REQUEST)

        acquired, retry_after_seconds = _acquire_sync_cooldown(request.user, action='watchlist-sync')
        if not acquired:
            return Response(
                {
                    'detail': 'Bạn thao tác quá nhanh. Vui lòng đợi trước khi đồng bộ lại.',
                    'retry_after_seconds': retry_after_seconds,
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        try:
            include_global_groups = bool(request.user.is_staff)
            results = sync_watchlist_prices(
                user_id=request.user.id,
                days=days,
                include_global_groups=include_global_groups,
            )
        except (Exception, SystemExit) as exc:
            from .views import logger
            logger.error('WatchlistSyncView lỗi: %s', exc, exc_info=True)
            return Response(
                {'detail': f'Sync thất bại: {exc}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return Response(
            {
                'synced': len(results),
                'days': days,
                'scope': 'global+user' if request.user.is_staff else 'user-only',
            }
        )


@method_decorator(csrf_exempt, name='dispatch')
class PortfolioListCreateView(generics.ListCreateAPIView):
    serializer_class = PortfolioSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from django.db.models import Count
        return Portfolio.objects.filter(user=self.request.user).annotate(
            transaction_count_annotated=Count('sub_accounts__transactions', distinct=True),
            subaccount_count_annotated=Count('sub_accounts', distinct=True)
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class PortfolioDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PortfolioSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Portfolio.objects.filter(user=self.request.user)


class SubAccountListCreateView(generics.ListCreateAPIView):
    serializer_class = SubAccountSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SubAccount.objects.filter(portfolio__user=self.request.user).select_related('portfolio')

    def create(self, request, *args, **kwargs):
        payload = request.data.copy()
        if not payload.get('portfolio'):
            fallback_portfolio = Portfolio.objects.filter(user=request.user).first()
            if fallback_portfolio:
                payload['portfolio'] = fallback_portfolio.id

        serializer = self.get_serializer(data=payload)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        user = self.request.user
        if not user.portfolios.exists():
            from rest_framework import serializers
            raise serializers.ValidationError('User must have at least one Portfolio')

        requested_portfolio_id = self.request.data.get('portfolio')
        if requested_portfolio_id:
            portfolio = generics.get_object_or_404(Portfolio, pk=requested_portfolio_id, user=user)
        else:
            portfolio = user.portfolios.first()

        serializer.save(portfolio=portfolio)


class SubAccountDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = SubAccountSerializer
    permission_classes = [IsAuthenticated]
    queryset = SubAccount.objects.select_related('portfolio')
    lookup_field = 'pk'
    lookup_url_kwarg = 'pk'

    def get_queryset(self):
        return SubAccount.objects.filter(portfolio__user=self.request.user)


@method_decorator(csrf_exempt, name='dispatch')
class TransactionListCreateView(generics.ListCreateAPIView):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        sub_account_id = self.kwargs['sub_account_id']
        return Transaction.objects.filter(
            sub_account_id=sub_account_id,
            sub_account__portfolio__user=self.request.user,
        ).order_by('-date')

    def perform_create(self, serializer):
        sub_account_id = self.kwargs['sub_account_id']
        sub_account = generics.get_object_or_404(
            SubAccount, pk=sub_account_id, portfolio__user=self.request.user
        )
        serializer.save(sub_account=sub_account)


class TransactionDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Transaction.objects.filter(sub_account__portfolio__user=self.request.user)


class UserConfigView(generics.RetrieveUpdateAPIView):
    serializer_class = UserConfigSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        user_config, _created = UserConfig.objects.get_or_create(
            user=self.request.user,
            defaults={
                'whale_alert_threshold': Decimal('500'),
                'theme': 'dark',
            },
        )
        return user_config


class HoldingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, portfolio_id):
        portfolio = generics.get_object_or_404(Portfolio, pk=portfolio_id, user=request.user)

        period = request.query_params.get('period', '1D')
        if period not in ('1D', '5D', '1M', 'YTD'):
            period = '1D'

        from datetime import date as _date
        cache_key = f'holdings:{portfolio_id}:{period}:{_date.today().isoformat()}'
        ttl = 300 if period == '1D' else 3600

        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        df = compute_holdings(portfolio, period=period)
        holding_list = df.to_dict(orient='records') if not df.empty else []

        serializer = HoldingSerializer(holding_list, many=True)
        result = serializer.data
        cache.set(cache_key, result, ttl)
        return Response(result)


class SummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, portfolio_id):
        portfolio = generics.get_object_or_404(Portfolio, pk=portfolio_id, user=request.user)
        summary = build_summary(portfolio)
        serializer = SummarySerializer(summary)
        return Response(serializer.data)


class ChartDataView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, portfolio_id):
        portfolio = generics.get_object_or_404(Portfolio, pk=portfolio_id, user=request.user)
        try:
            days = int(request.query_params.get('days', 90))
            days = min(max(days, 7), 365)
        except ValueError:
            days = 90

        df = compute_nav_series(portfolio, days=days)
        chart_data = df.to_dict(orient='records') if not df.empty else []
        serializer = ChartPointSerializer(chart_data, many=True)
        return Response(serializer.data)


class EquityCurveView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, portfolio_id):
        portfolio = generics.get_object_or_404(Portfolio, pk=portfolio_id, user=request.user)
        try:
            days = int(request.query_params.get('days', 180))
            days = min(max(days, 7), 1825)
        except ValueError:
            days = 180

        import pandas as pd
        nav_df = compute_nav_series(portfolio, days=days)
        if nav_df.empty:
            return Response({'points': [], 'has_benchmark': False, 'period_days': days})

        nav_df['date'] = pd.to_datetime(nav_df['date'])
        nav_df = nav_df.sort_values('date')
        base_nav = float(nav_df.iloc[0]['value'])
        if base_nav == 0:
            return Response({'points': [], 'has_benchmark': False, 'period_days': days})

        nav_df['portfolio_pct'] = ((nav_df['value'].astype(float) / base_nav) - 1) * 100

        from .market_data_service import MarketDataService
        start_date = nav_df['date'].iloc[0].date()
        end_date = nav_df['date'].iloc[-1].date()
        
        # MDSU Canonical path for benchmark data
        bench_data_map = MarketDataService.get_ohlcv_batch(
            ['VNINDEX'], 
            start_date=start_date, 
            end_date=end_date,
            fields=['date', 'close_price']
        )
        
        bench_list = bench_data_map.get('VNINDEX', [])
        bench_map = {}
        if bench_list:
            base_bench = float(bench_list[0]['close_price'])
            if base_bench > 0:
                for row in bench_list:
                    bench_map[str(row['date'])] = round(
                        (float(row['close_price']) / base_bench - 1) * 100, 2
                    )

        points = []
        for _, row in nav_df.iterrows():
            date_str = str(row['date'].date())
            points.append({
                'date': date_str,
                'portfolio_pct': round(float(row['portfolio_pct']), 2),
                'benchmark_pct': bench_map.get(date_str),
            })

        return Response({
            'points': points,
            'has_benchmark': bool(bench_map),
            'period_days': days,
        })


@method_decorator(csrf_exempt, name='dispatch')
class SyncPricesView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, portfolio_id):
        portfolio = generics.get_object_or_404(Portfolio, pk=portfolio_id, user=request.user)
        try:
            days = int(request.data.get('days', 30))
            days = min(max(days, 1), 365)
        except (ValueError, TypeError):
            days = 30

        results = sync_portfolio_prices(portfolio.id, days=days)

        if not results:
            return Response(
                {'detail': 'Danh mục không có giao dịch nào để đồng bộ.'},
                status=status.HTTP_200_OK,
            )

        return Response({
            'synced': results,
            'total_symbols': len(results),
        }, status=status.HTTP_200_OK)


class AllocationView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, portfolio_id):
        portfolio = generics.get_object_or_404(Portfolio, pk=portfolio_id, user=request.user)
        by = request.query_params.get('by', 'symbol')
        if by == 'sector':
            items = compute_allocation_by_sector(portfolio)
            hhi_score = round(sum(row['hhi_contribution'] for row in items), 2)
            return Response({'items': items, 'hhi_score': hhi_score})
        data = compute_allocation(portfolio)
        return Response(data)


class PortfolioAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, portfolio_id):
        portfolio = generics.get_object_or_404(Portfolio, pk=portfolio_id, user=request.user)
        days_raw = request.query_params.get('days', '365')
        try:
            days = int(days_raw)
            if days < 5 or days > 1825:
                raise ValueError
        except ValueError:
            return Response(
                {'detail': 'days phải là số nguyên trong khoảng [5, 1825].'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        metrics = build_risk_metrics(portfolio, days=days)
        return Response(metrics)
