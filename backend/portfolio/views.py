
# --- Stock Management Modular Views ---
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import generics
from .models import StockProfile
from .serializers import StockProfileSerializer, SecuritiesGroupDetailSerializer, SecuritiesItemSerializer

# StockProfile List API
class StockProfileListView(generics.ListAPIView):
    queryset = StockProfile.objects.all()
    serializer_class = StockProfileSerializer
    permission_classes = [AllowAny]

# StockProfile Detail đã có

# Đồng bộ StockProfile từ vnstock (gọi management command hoặc service)
from django.http import JsonResponse
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sync_stockprofile_api(request):
    result = sync_stock_profiles(requested_by=request.user, mode=request.query_params.get('mode', 'all'))
    return JsonResponse(
        {
            'success': result['success'],
            'message': result['message'],
            'warning': result.get('warning'),
            'source': result.get('source'),
            'total_symbols': result.get('total_symbols', 0),
            'created_symbols': result.get('created_symbols', 0),
            'updated_symbols': result.get('updated_symbols', 0),
            'error': result.get('error', ''),
        },
        status=200 if result['success'] else 500,
    )

# SecuritiesGroup List API
class SecuritiesGroupListView(generics.ListAPIView):
    serializer_class = SecuritiesGroupDetailSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SecuritiesGroup.objects.all()

# SecuritiesItem List API (liệt kê các mã trong group)
class SecuritiesItemListView(generics.ListAPIView):
    serializer_class = SecuritiesItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        group_id = self.kwargs['pk']
        return SecuritiesItem.objects.filter(group_id=group_id)
"""
views.py — DRF API Views.

Endpoints:
  GET/POST   /api/portfolio/portfolios/
  GET/PUT/DELETE /api/portfolio/portfolios/{id}/
  GET/POST   /api/portfolio/portfolios/{id}/transactions/
  GET/PUT/DELETE /api/transactions/{id}/
  GET        /api/portfolio/portfolios/{id}/holdings/
  GET        /api/portfolio/portfolios/{id}/summary/
  GET        /api/portfolio/portfolios/{id}/chart/
  POST       /api/portfolio/portfolios/{id}/sync/
  GET/PUT    /api/portfolio/userconfig/ (UserConfig)
"""

from decimal import Decimal
from datetime import date, datetime, timedelta

from django.db.models import Max, Min
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from .models import Portfolio, Transaction, DailyPrice, SecuritiesGroup, SecuritiesItem, TrackedSymbol, UserConfig, SubAccount, WatchlistGroup, WatchlistItem, StockProfile, PriceAlertRule
from .serializers import (
    PortfolioSerializer, TransactionSerializer, UserConfigSerializer, SubAccountSerializer,
    HoldingSerializer, SummarySerializer, ChartPointSerializer,
    SecuritiesGroupCreateSerializer, SecuritiesGroupDetailSerializer, SecuritiesItemSerializer,
    TrackedSymbolSerializer, WatchlistGroupSerializer, WatchlistItemSerializer, StockProfileSerializer,
    PriceAlertRuleSerializer, StockWorkspaceChartPointSerializer, StockWorkspaceChartResponseSerializer,
    StockWorkspaceGroupRefSerializer, StockWorkspaceOverviewSerializer,
    StockWorkspaceTechnicalSerializer, StockWorkspaceWatchlistMembershipSerializer,
)

from .services import (
    fetch_and_save_daily_prices, sync_portfolio_prices, get_latest_price,
    get_price_changes, get_price_series, sync_market_groups_for_user, sync_stock_profiles, sync_watchlist_prices,
)

from .analytics import (
    compute_holdings, compute_nav_series, compute_allocation, build_summary,
    build_risk_metrics, compute_allocation_by_sector,
)

# --- Watchlist Group Views ---
class WatchlistGroupListCreateView(generics.ListCreateAPIView):
    serializer_class = WatchlistGroupSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return WatchlistGroup.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class WatchlistGroupDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = WatchlistGroupSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return WatchlistGroup.objects.filter(user=self.request.user)

# --- Watchlist Item Views ---
class WatchlistItemCreateView(generics.CreateAPIView):
    serializer_class = WatchlistItemSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        group_id = self.kwargs['group_id']
        group = generics.get_object_or_404(WatchlistGroup, pk=group_id, user=self.request.user)
        serializer.save(group=group)

class WatchlistItemDeleteView(generics.DestroyAPIView):
    serializer_class = WatchlistItemSerializer
    permission_classes = [IsAuthenticated]
    lookup_url_kwarg = 'item_id'

    def get_queryset(self):
        return WatchlistItem.objects.filter(group__user=self.request.user)

# --- Watchlist Seed/Sync Placeholder Views ---
class WatchlistSeedView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        return Response({'detail': 'Seed not implemented'}, status=status.HTTP_501_NOT_IMPLEMENTED)

class WatchlistSyncView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        return Response({'detail': 'Sync not implemented'}, status=status.HTTP_501_NOT_IMPLEMENTED)


class RealtimeTickerView(APIView):
    """
    GET /api/realtime/ticker/<symbol>/ — fallback polling endpoint for realtime views.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, symbol):
        normalized_symbol = (symbol or '').strip().upper()
        if not normalized_symbol:
            return Response({'detail': 'Thiếu mã chứng khoán.'}, status=status.HTTP_400_BAD_REQUEST)

        price_info = get_price_changes([normalized_symbol]).get(normalized_symbol, {})
        last_date = price_info.get('last_date')
        freshness_seconds = None
        stale = True

        if last_date:
            try:
                last_dt = datetime.fromisoformat(str(last_date))
                freshness_seconds = max(int((datetime.now() - last_dt).total_seconds()), 0)
                stale = freshness_seconds > 30
            except ValueError:
                freshness_seconds = None
                stale = True

        return Response(
            {
                'symbol': normalized_symbol,
                **price_info,
                'freshness_seconds': freshness_seconds,
                'stale': stale,
            }
        )

# ---------------------------------------------------------------------------
# Portfolio Views
# ---------------------------------------------------------------------------

@method_decorator(csrf_exempt, name='dispatch')
class PortfolioListCreateView(generics.ListCreateAPIView):
    serializer_class = PortfolioSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Portfolio.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class PortfolioDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PortfolioSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Portfolio.objects.filter(user=self.request.user)


# ---------------------------------------------------------------------------
# Transaction Views
# ---------------------------------------------------------------------------


class SubAccountListCreateView(generics.ListCreateAPIView):
    serializer_class = SubAccountSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SubAccount.objects.filter(portfolio__user=self.request.user).select_related('portfolio')

    def perform_create(self, serializer):
        # Auto-assign to user's first portfolio if not specified
        user = self.request.user
        if not user.portfolios.exists():
            from rest_framework import serializers
            raise serializers.ValidationError('User must have at least one Portfolio')
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



# ---------------------------------------------------------------------------
# UserConfig Views
# ---------------------------------------------------------------------------

class UserConfigView(generics.RetrieveUpdateAPIView):
    """
    GET/PUT /api/portfolio/userconfig/ — Lấy/cập nhật config cá nhân.
    Tự động tạo nếu chưa có.
    """
    serializer_class = UserConfigSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        user_config, created = UserConfig.objects.get_or_create(
            user=self.request.user,
            defaults={
                'whale_alert_threshold': Decimal('500'),
                'theme': 'dark',
            },
        )
        if created:
            print(f"Created UserConfig for {self.request.user.username}")
        return user_config


# ---------------------------------------------------------------------------
# Analytics Views
# ---------------------------------------------------------------------------

class HoldingsView(APIView):
    """GET /api/portfolio/portfolios/{id}/holdings/ — Danh sách vị thế đang nắm giữ + P/L."""
    permission_classes = [IsAuthenticated]

    def get(self, request, portfolio_id):
        portfolio = generics.get_object_or_404(
            Portfolio, pk=portfolio_id, user=request.user
        )
        df = compute_holdings(portfolio)
        holding_list = df.to_dict(orient='records') if not df.empty else []
        serializer = HoldingSerializer(holding_list, many=True)
        return Response(serializer.data)


class SummaryView(APIView):
    """GET /api/portfolio/portfolios/{id}/summary/ — Tổng quan tài sản."""
    permission_classes = [IsAuthenticated]

    def get(self, request, portfolio_id):
        portfolio = generics.get_object_or_404(
            Portfolio, pk=portfolio_id, user=request.user
        )
        summary = build_summary(portfolio)
        serializer = SummarySerializer(summary)
        return Response(serializer.data)


class ChartDataView(APIView):
    """GET /api/portfolio/portfolios/{id}/chart/?days=90 — Dữ liệu biểu đồ tăng trưởng."""
    permission_classes = [IsAuthenticated]

    def get(self, request, portfolio_id):
        portfolio = generics.get_object_or_404(
            Portfolio, pk=portfolio_id, user=request.user
        )
        try:
            days = int(request.query_params.get('days', 90))
            days = min(max(days, 7), 365)  # giới hạn 7–365 ngày
        except ValueError:
            days = 90

        df = compute_nav_series(portfolio, days=days)
        chart_data = df.to_dict(orient='records') if not df.empty else []
        serializer = ChartPointSerializer(chart_data, many=True)
        return Response(serializer.data)


@method_decorator(csrf_exempt, name='dispatch')
class SyncPricesView(APIView):
    """POST /api/portfolio/portfolios/{id}/sync/ — Kéo giá EOD mới nhất từ vnstock."""
    permission_classes = [IsAuthenticated]

    def post(self, request, portfolio_id):
        portfolio = generics.get_object_or_404(
            Portfolio, pk=portfolio_id, user=request.user
        )
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
    """
    GET /api/portfolio/portfolios/{id}/allocation/        — Pie Chart theo mã CK
    GET /api/portfolio/portfolios/{id}/allocation/?by=sector — Pie Chart theo ngành
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, portfolio_id):
        portfolio = generics.get_object_or_404(
            Portfolio, pk=portfolio_id, user=request.user
        )
        by = request.query_params.get('by', 'symbol')
        if by == 'sector':
            data = compute_allocation_by_sector(portfolio)
        else:
            data = compute_allocation(portfolio)
        return Response(data)


class PortfolioAnalyticsView(APIView):
    """
    GET /api/portfolio/portfolios/{id}/analytics/?days=365

    Trả về risk metrics cho danh mục:
        sharpe_ratio, sortino_ratio, max_drawdown_pct, twr_pct,
        volatility_annual_pct, best_day_pct, worst_day_pct,
        total_trading_days, period_days
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, portfolio_id):
        portfolio = generics.get_object_or_404(
            Portfolio, pk=portfolio_id, user=request.user
        )
        days_raw = request.query_params.get('days', '365')
        try:
            days = int(days_raw)
            if days < 5 or days > 1825:  # 5 ngày → 5 năm
                raise ValueError
        except ValueError:
            return Response(
                {'detail': 'days phải là số nguyên trong khoảng [5, 1825].'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        metrics = build_risk_metrics(portfolio, days=days)
        return Response(metrics)


# ---------------------------------------------------------------------------
# Securities Views
# ---------------------------------------------------------------------------

def _build_group_response(group: SecuritiesGroup, price_map: dict) -> dict:
    """Xây dựng dict response cho một SecuritiesGroup kèm dữ liệu giá."""
    items_data = []
    for item in group.items.all():
        pc = price_map.get(item.symbol, {
            'current_price': None, 'prev_price': None,
            'change_value': None, 'change_pct': None, 'last_date': None,
        })
        items_data.append({'id': item.id, 'symbol': item.symbol, **pc})
    return {
        'id': group.id,
        'name': group.name,
        'group_type': group.group_type,
        'description': group.description,
        'color': group.color,
        'order': group.order,
        'items': items_data,
    }


@method_decorator(csrf_exempt, name='dispatch')
class SecuritiesGroupListCreateView(APIView):
    """
    GET  /api/portfolio/Securities/groups/  — Tất cả nhóm Securities kèm giá.
    POST /api/portfolio/Securities/groups/  — Tạo nhóm mới.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        groups = SecuritiesGroup.objects.all().prefetch_related('items')

        all_symbols = list({
            item.symbol
            for group in groups
            for item in group.items.all()
        })
        price_map = get_price_changes(all_symbols)

        data = [_build_group_response(g, price_map) for g in groups]
        return Response(data)

    def post(self, request):
        return Response(
            {'detail': 'Nhóm thị trường là taxonomy dùng chung và chỉ được cập nhật qua admin sync.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )


@method_decorator(csrf_exempt, name='dispatch')
class SecuritiesGroupDetailView(APIView):
    """
    PATCH  /api/portfolio/Securities/groups/{id}/  — Cập nhật nhóm.
    DELETE /api/portfolio/Securities/groups/{id}/  — Xóa nhóm.
    """
    permission_classes = [IsAuthenticated]

    def get_object(self, request, group_id):
        return generics.get_object_or_404(
            SecuritiesGroup, pk=group_id
        )

    def patch(self, request, group_id):
        return Response(
            {'detail': 'Nhóm thị trường là taxonomy dùng chung và chỉ được cập nhật qua admin sync.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def delete(self, request, group_id):
        return Response(
            {'detail': 'Nhóm thị trường là taxonomy dùng chung và chỉ được cập nhật qua admin sync.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )


@method_decorator(csrf_exempt, name='dispatch')
class SecuritiesItemCreateView(APIView):
    """POST /api/portfolio/Securities/groups/{id}/items/ — Thêm mã CK vào nhóm."""
    permission_classes = [IsAuthenticated]

    def post(self, request, group_id):
        return Response(
            {'detail': 'Mã trong nhóm thị trường chỉ được cập nhật qua admin sync.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )


@method_decorator(csrf_exempt, name='dispatch')
class SecuritiesItemDeleteView(APIView):
    """DELETE /api/portfolio/Securities/items/{id}/ — Xóa mã CK khỏi nhóm."""
    permission_classes = [IsAuthenticated]

    def delete(self, request, item_id):
        return Response(
            {'detail': 'Mã trong nhóm thị trường chỉ được cập nhật qua admin sync.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )


@method_decorator(csrf_exempt, name='dispatch')
@method_decorator(csrf_exempt, name='dispatch')
class SecuritiesSeedView(APIView):
    """
    POST /api/portfolio/Securities/seed/

    Tự động lấy toàn bộ nhóm ngành (25 nhóm ICB) + nhóm vốn hóa (VN30/VN100/HNX30)
    từ vnstock (VCI source) và tạo SecuritiesGroup + SecuritiesItem cho user hiện tại.

    Query params:
        ?mode=sectors   — chỉ tạo nhóm ngành
        ?mode=caps      — chỉ tạo nhóm vốn hóa
        ?mode=all       — tạo tất cả (mặc định)
        ?mode=manual    — dùng danh sách cứng (fallback khi vnstock lỗi)
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        mode = request.query_params.get('mode', 'all')
        result = sync_market_groups_for_user(request.user, requested_by=request.user, mode=mode)
        response_status = status.HTTP_200_OK if result['success'] and not result['warning'] else status.HTTP_207_MULTI_STATUS
        if not result['success']:
            response_status = status.HTTP_500_INTERNAL_SERVER_ERROR

        return Response(
            {
                'created': result.get('created', []),
                'updated': result.get('updated', []),
                'message': result['message'],
                'warning': result.get('warning'),
                'source': result.get('source'),
                'total_groups': result.get('total_groups', 0),
                'success': result['success'],
            },
            status=response_status,
        )


@method_decorator(csrf_exempt, name='dispatch')
class SecuritiesSyncView(APIView):
    """POST /api/portfolio/Securities/sync/ — Đồng bộ giá cho toàn bộ mã trong Securities."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            days = int(request.data.get('days', 5))
            days = min(max(days, 1), 30)
        except (ValueError, TypeError):
            days = 5

        # Đồng bộ giá cho toàn bộ mã trong SecuritiesGroup của user.
        all_symbols = list({
            item.symbol
            for group in SecuritiesGroup.objects.all().prefetch_related('items')
            for item in group.items.all()
        })
        if not all_symbols:
            return Response({'detail': 'Securities không có mã nào.'}, status=status.HTTP_200_OK)

        results = sync_watchlist_prices(request.user.id, days=days)
        return Response({
            'synced': results,
            'total_symbols': len(all_symbols),
        })


# ---------------------------------------------------------------------------
# Mã Theo dõi Views
# ---------------------------------------------------------------------------

class TrackedSymbolListCreateView(APIView):
    """
    GET  /api/portfolio/tracked-symbols/  — Danh sách Mã Theo dõi cá nhân kèm giá.
    POST /api/portfolio/tracked-symbols/  — Thêm mã. Body: {symbol, source_group_id (optional)}
    """
    permission_classes = [IsAuthenticated]

    def _enrich(self, ts):
        """Gắn giá thị trường vào một TrackedSymbol instance."""
        changes = get_price_changes([ts.symbol])
        info = changes.get(ts.symbol, {})
        grp = ts.source_group
        return {
            'id': ts.id,
            'symbol': ts.symbol,
            'source_group_id': grp.id if grp else None,
            'source_group_name': grp.name if grp else None,
            'current_price': info.get('current_price'),
            'prev_price': info.get('prev_price'),
            'change_value': info.get('change_value'),
            'change_pct': info.get('change_pct'),
            'last_date': info.get('last_date'),
            'added_at': ts.added_at,
        }

    def get(self, request):
        tracked = (
            TrackedSymbol.objects
            .filter(user=request.user)
            .select_related('source_group')
        )
        # Lấy giá cho tất cả mã cùng lúc
        symbols = [t.symbol for t in tracked]
        changes = get_price_changes(symbols) if symbols else {}
        rows = []
        for ts in tracked:
            grp = ts.source_group
            info = changes.get(ts.symbol, {})
            rows.append({
                'id': ts.id,
                'symbol': ts.symbol,
                'source_group_id': grp.id if grp else None,
                'source_group_name': grp.name if grp else None,
                'current_price': info.get('current_price'),
                'prev_price': info.get('prev_price'),
                'change_value': info.get('change_value'),
                'change_pct': info.get('change_pct'),
                'last_date': info.get('last_date'),
                'added_at': ts.added_at,
            })
        serializer = TrackedSymbolSerializer(rows, many=True)
        return Response(serializer.data)

    def post(self, request):
        symbol = (request.data.get('symbol') or '').strip().upper()
        if not symbol:
            return Response({'detail': 'Thiếu mã chứng khoán.'}, status=status.HTTP_400_BAD_REQUEST)

        source_group_id = request.data.get('source_group_id')
        source_group = None
        if source_group_id:
            try:
                source_group = SecuritiesGroup.objects.get(id=source_group_id)
            except SecuritiesGroup.DoesNotExist:
                pass

        ts, created = TrackedSymbol.objects.get_or_create(
            user=request.user,
            symbol=symbol,
            defaults={'source_group': source_group},
        )
        if not created:
            return Response({'detail': f'{symbol} đã có trong danh sách theo dõi.'}, status=status.HTTP_409_CONFLICT)

        # Cập nhật source_group nếu mới cung cấp
        if created and source_group and ts.source_group != source_group:
            ts.source_group = source_group
            ts.save(update_fields=['source_group'])

        grp = ts.source_group
        info = get_price_changes([symbol]).get(symbol, {})
        row = {
            'id': ts.id,
            'symbol': ts.symbol,
            'source_group_id': grp.id if grp else None,
            'source_group_name': grp.name if grp else None,
            'current_price': info.get('current_price'),
            'prev_price': info.get('prev_price'),
            'change_value': info.get('change_value'),
            'change_pct': info.get('change_pct'),
            'last_date': info.get('last_date'),
            'added_at': ts.added_at,
        }
        return Response(TrackedSymbolSerializer(row).data, status=status.HTTP_201_CREATED)


class TrackedSymbolDeleteView(APIView):
    """
    DELETE /api/portfolio/tracked-symbols/<id>/ — Xóa mã khỏi danh sách Mã Theo dõi.
    """
    permission_classes = [IsAuthenticated]

    def delete(self, request, ts_id):
        try:
            ts = TrackedSymbol.objects.get(id=ts_id, user=request.user)
        except TrackedSymbol.DoesNotExist:
            return Response({'detail': 'Không tìm thấy mã.'}, status=status.HTTP_404_NOT_FOUND)
        ts.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


def _price_alert_is_triggered(rule: PriceAlertRule, current_price: float | None) -> bool:
    if current_price is None or not rule.is_active:
        return False
    target_price = float(rule.target_price)
    if rule.condition == PriceAlertRule.Condition.ABOVE:
        return float(current_price) >= target_price
    return float(current_price) <= target_price


def _build_price_alert_rule_row(rule: PriceAlertRule, price_map: dict) -> dict:
    current_price = price_map.get(rule.symbol, {}).get('current_price')
    return {
        'id': rule.id,
        'symbol': rule.symbol,
        'condition': rule.condition,
        'target_price': rule.target_price,
        'cooldown_seconds': rule.cooldown_seconds,
        'is_active': rule.is_active,
        'last_triggered_at': rule.last_triggered_at,
        'created_at': rule.created_at,
        'updated_at': rule.updated_at,
        'current_price': current_price,
        'is_triggered': _price_alert_is_triggered(rule, current_price),
    }


@method_decorator(csrf_exempt, name='dispatch')
class PriceAlertRuleListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        rules = list(PriceAlertRule.objects.filter(user=request.user).order_by('-created_at'))
        price_map = get_price_changes([rule.symbol for rule in rules])
        rows = [_build_price_alert_rule_row(rule, price_map) for rule in rules]
        return Response(PriceAlertRuleSerializer(rows, many=True).data)

    def post(self, request):
        serializer = PriceAlertRuleSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        rule, created = PriceAlertRule.objects.get_or_create(
            user=request.user,
            symbol=serializer.validated_data['symbol'],
            condition=serializer.validated_data['condition'],
            target_price=serializer.validated_data['target_price'],
            defaults={
                'cooldown_seconds': serializer.validated_data['cooldown_seconds'],
                'is_active': serializer.validated_data['is_active'],
            },
        )

        if not created:
            return Response(
                {'detail': 'Cảnh báo giá này đã tồn tại.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        price_map = get_price_changes([rule.symbol])
        row = _build_price_alert_rule_row(rule, price_map)
        return Response(PriceAlertRuleSerializer(row).data, status=status.HTTP_201_CREATED)


@method_decorator(csrf_exempt, name='dispatch')
class PriceAlertRuleDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, request, rule_id):
        return generics.get_object_or_404(PriceAlertRule, id=rule_id, user=request.user)

    def patch(self, request, rule_id):
        rule = self.get_object(request, rule_id)
        serializer = PriceAlertRuleSerializer(rule, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        price_map = get_price_changes([rule.symbol])
        row = _build_price_alert_rule_row(rule, price_map)
        return Response(PriceAlertRuleSerializer(row).data)

    def delete(self, request, rule_id):
        rule = self.get_object(request, rule_id)
        rule.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@method_decorator(csrf_exempt, name='dispatch')
class PriceAlertRuleTriggerView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, rule_id):
        rule = generics.get_object_or_404(PriceAlertRule, id=rule_id, user=request.user)
        rule.last_triggered_at = timezone.now()
        rule.save(update_fields=['last_triggered_at', 'updated_at'])
        price_map = get_price_changes([rule.symbol])
        row = _build_price_alert_rule_row(rule, price_map)
        return Response(PriceAlertRuleSerializer(row).data)


def _to_float(value):
    return float(value) if value is not None else None


def _get_exchange_price_band(exchange):
    normalized_exchange = (exchange or '').strip().upper()
    if normalized_exchange == 'HNX':
        return Decimal('0.10')
    if normalized_exchange in {'UPCOM', 'UPCOM'}:
        return Decimal('0.15')
    return Decimal('0.07')


def _build_stock_workspace_overview(symbol, user):
    normalized_symbol = (symbol or '').strip().upper()
    profile = generics.get_object_or_404(StockProfile, symbol=normalized_symbol)
    latest_daily_price = (
        DailyPrice.objects
        .filter(symbol=normalized_symbol)
        .order_by('-date')
        .values('open_price', 'high_price', 'low_price', 'close_price', 'volume')
        .first()
    )
    price_info = get_price_changes([normalized_symbol]).get(normalized_symbol, {})
    year_stats = (
        DailyPrice.objects
        .filter(symbol=normalized_symbol, date__gte=date.today() - timedelta(days=365))
        .aggregate(week52_high=Max('high_price'), week52_low=Min('low_price'))
    )

    average_price = None
    if latest_daily_price:
        numeric_prices = [
            value
            for value in [
                latest_daily_price.get('open_price'),
                latest_daily_price.get('high_price'),
                latest_daily_price.get('low_price'),
                latest_daily_price.get('close_price'),
            ]
            if value is not None
        ]
        if numeric_prices:
            average_price = _to_float(sum(numeric_prices, Decimal('0')) / Decimal(len(numeric_prices)))

    reference_price = price_info.get('prev_price')
    if reference_price is None and latest_daily_price:
        reference_price = _to_float(latest_daily_price.get('close_price'))

    ceiling_price = None
    floor_price = None
    if reference_price is not None:
        reference_decimal = Decimal(str(reference_price))
        band = _get_exchange_price_band(profile.exchange)
        ceiling_price = _to_float(reference_decimal * (Decimal('1') + band))
        floor_price = _to_float(reference_decimal * (Decimal('1') - band))

    tracked_item = None
    market_groups = []
    watchlist_groups = []
    market_group_refs = []
    watchlist_memberships = []
    if user and user.is_authenticated:
        tracked_item = (
            TrackedSymbol.objects
            .select_related('source_group')
            .filter(user=user, symbol=normalized_symbol)
            .first()
        )
        market_group_refs = list(
            SecuritiesGroup.objects
            .filter(items__symbol=normalized_symbol)
            .order_by('name')
            .values('id', 'name')
            .distinct()
        )
        market_groups = [group['name'] for group in market_group_refs]
        watchlist_memberships = list(
            WatchlistItem.objects
            .filter(group__user=user, symbol=normalized_symbol)
            .select_related('group')
            .order_by('group__name')
            .values('id', 'group_id', 'group__name')
        )
        watchlist_groups = [item['group__name'] for item in watchlist_memberships]

    return {
        'tracked_symbol_id': tracked_item.id if tracked_item else None,
        'symbol': profile.symbol,
        'company_name': profile.company_name,
        'industry': profile.industry,
        'exchange': profile.exchange,
        'listed_date': profile.listed_date,
        'is_active': profile.is_active,
        'updated_at': profile.updated_at,
        'current_price': price_info.get('current_price'),
        'prev_price': price_info.get('prev_price'),
        'change_value': price_info.get('change_value'),
        'change_pct': price_info.get('change_pct'),
        'last_date': price_info.get('last_date'),
        'open_price': _to_float(latest_daily_price.get('open_price')) if latest_daily_price else None,
        'high_price': _to_float(latest_daily_price.get('high_price')) if latest_daily_price else None,
        'low_price': _to_float(latest_daily_price.get('low_price')) if latest_daily_price else None,
        'close_price': _to_float(latest_daily_price.get('close_price')) if latest_daily_price else None,
        'volume': latest_daily_price.get('volume') if latest_daily_price else None,
        'average_price': average_price,
        'reference_price': reference_price,
        'ceiling_price': ceiling_price,
        'floor_price': floor_price,
        'week52_high': _to_float(year_stats.get('week52_high')),
        'week52_low': _to_float(year_stats.get('week52_low')),
        'is_tracked': tracked_item is not None,
        'source_group_name': tracked_item.source_group.name if tracked_item and tracked_item.source_group else None,
        'market_groups': market_groups,
        'watchlist_groups': watchlist_groups,
        'market_group_refs': market_group_refs,
        'watchlist_memberships': [
            {
                'item_id': item['id'],
                'group_id': item['group_id'],
                'group_name': item['group__name'],
            }
            for item in watchlist_memberships
        ],
    }


def _safe_round(value, digits=2):
    if value is None:
        return None
    return round(float(value), digits)


def _compute_rsi(values, window=14):
    if len(values) <= window:
        return None

    deltas = [values[index] - values[index - 1] for index in range(1, len(values))]
    gains = [max(delta, 0) for delta in deltas]
    losses = [abs(min(delta, 0)) for delta in deltas]
    recent_gains = gains[-window:]
    recent_losses = losses[-window:]

    average_gain = sum(recent_gains) / window
    average_loss = sum(recent_losses) / window
    if average_loss == 0:
        return 100.0 if average_gain > 0 else 50.0

    rs = average_gain / average_loss
    return 100 - (100 / (1 + rs))


def _technical_bias_meta(bias):
    normalized_bias = (bias or 'NEUTRAL').strip().upper()
    if normalized_bias == 'BULLISH':
        return {
            'bias': 'BULLISH',
            'bias_label': 'Tăng',
            'bias_description': 'Giá đang nằm trên SMA20 và SMA50, động lượng duy trì tích cực.',
        }
    if normalized_bias == 'WEAK':
        return {
            'bias': 'WEAK',
            'bias_label': 'Yếu',
            'bias_description': 'Giá đang nằm dưới các đường trung bình và động lượng suy yếu.',
        }
    return {
        'bias': 'NEUTRAL',
        'bias_label': 'Trung tính',
        'bias_description': 'Cấu trúc giá chưa nghiêng rõ theo một hướng mạnh.',
    }


def _compute_stock_workspace_technical(rows, overview):
    close_values = [float(row['close_price']) for row in rows if row.get('close_price') is not None]
    volume_values = [float(row['volume']) for row in rows if row.get('volume') is not None]
    latest_close = close_values[-1] if close_values else None

    sma20 = sum(close_values[-20:]) / 20 if len(close_values) >= 20 else None
    sma50 = sum(close_values[-50:]) / 50 if len(close_values) >= 50 else None
    rsi14 = _compute_rsi(close_values, 14)
    avg_volume_20 = sum(volume_values[-20:]) / 20 if len(volume_values) >= 20 else None
    momentum_20d_pct = None
    if len(close_values) >= 21 and close_values[-21] > 0:
        momentum_20d_pct = ((close_values[-1] - close_values[-21]) / close_values[-21]) * 100

    range_position_pct = None
    week52_low = overview.get('week52_low')
    week52_high = overview.get('week52_high')
    if latest_close is not None and week52_low is not None and week52_high is not None and week52_high > week52_low:
        range_position_pct = ((latest_close - week52_low) / (week52_high - week52_low)) * 100

    price_vs_sma20_pct = None
    if latest_close is not None and sma20:
        price_vs_sma20_pct = ((latest_close - sma20) / sma20) * 100

    price_vs_sma50_pct = None
    if latest_close is not None and sma50:
        price_vs_sma50_pct = ((latest_close - sma50) / sma50) * 100

    bias = 'NEUTRAL'
    if latest_close is not None and sma20 and sma50 and rsi14 is not None:
        if latest_close > sma20 > sma50 and rsi14 >= 55:
            bias = 'BULLISH'
        elif latest_close < sma20 < sma50 and rsi14 <= 45:
            bias = 'WEAK'

    bias_meta = _technical_bias_meta(bias)

    return {
        **bias_meta,
        'sma20': _safe_round(sma20),
        'sma50': _safe_round(sma50),
        'rsi14': _safe_round(rsi14),
        'avg_volume_20': _safe_round(avg_volume_20),
        'price_vs_sma20_pct': _safe_round(price_vs_sma20_pct),
        'price_vs_sma50_pct': _safe_round(price_vs_sma50_pct),
        'momentum_20d_pct': _safe_round(momentum_20d_pct),
        'range_position_pct': _safe_round(range_position_pct),
        'latest_close': _safe_round(latest_close),
    }


@method_decorator(csrf_exempt, name='dispatch')
class StockWorkspaceOverviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, symbol):
        payload = _build_stock_workspace_overview(symbol, request.user)
        return Response(StockWorkspaceOverviewSerializer(payload).data)


@method_decorator(csrf_exempt, name='dispatch')
class StockWorkspaceChartView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, symbol):
        normalized_symbol = (symbol or '').strip().upper()
        generics.get_object_or_404(StockProfile, symbol=normalized_symbol)

        try:
            days = int(request.query_params.get('days', 180))
        except (TypeError, ValueError):
            days = 180

        days = min(max(days, 30), 365)
        end_date = date.today()
        start_date = end_date - timedelta(days=days)
        price_rows = list(
            DailyPrice.objects
            .filter(symbol=normalized_symbol, date__range=(start_date, end_date))
            .order_by('date')
            .values('date', 'open_price', 'high_price', 'low_price', 'close_price', 'volume')
        )
        series = [
            {
                'date': str(row['date']),
                'open': _to_float(row['open_price']),
                'high': _to_float(row['high_price']),
                'low': _to_float(row['low_price']),
                'close': float(row['close_price']),
                'volume': _to_float(row['volume']),
            }
            for row in price_rows
        ]
        overview = _build_stock_workspace_overview(normalized_symbol, request.user)
        payload = {
            'symbol': normalized_symbol,
            'days': days,
            'start_date': str(start_date),
            'end_date': str(end_date),
            'points': StockWorkspaceChartPointSerializer(series, many=True).data,
            'technical': StockWorkspaceTechnicalSerializer(_compute_stock_workspace_technical(price_rows, overview)).data,
        }

        return Response(StockWorkspaceChartResponseSerializer(payload).data)

# --- StockProfile Views ---
from .models import StockProfile
from .serializers import StockProfileSerializer

class StockProfileDetailView(generics.RetrieveAPIView):
    queryset = StockProfile.objects.all()
    serializer_class = StockProfileSerializer
    lookup_field = 'symbol'
    permission_classes = []  # Public, hoặc thêm quyền nếu cần

