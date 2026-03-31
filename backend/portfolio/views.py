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
from datetime import date, timedelta

from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from .models import Portfolio, Transaction, DailyPrice, SecuritiesGroup, SecuritiesItem, TrackedSymbol, UserConfig, SubAccount, WatchlistGroup, WatchlistItem
from .serializers import (
    PortfolioSerializer, TransactionSerializer, UserConfigSerializer, SubAccountSerializer,
    HoldingSerializer, SummarySerializer, ChartPointSerializer,
    SecuritiesGroupCreateSerializer, SecuritiesGroupDetailSerializer, SecuritiesItemSerializer,
    TrackedSymbolSerializer, WatchlistGroupSerializer, WatchlistItemSerializer
)

from .services import (
    fetch_and_save_daily_prices, sync_portfolio_prices, get_latest_price,
    get_price_changes, fetch_market_sectors_and_groups,
)

from .analytics import (
    compute_holdings, compute_nav_series, compute_allocation, build_summary,
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
        group = generics.get_object_or_400(WatchlistGroup, pk=group_id, user=self.request.user)
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
    """GET /api/portfolio/portfolios/{id}/allocation/ — Dữ liệu Pie Chart phân bổ danh mục."""
    permission_classes = [IsAuthenticated]

    def get(self, request, portfolio_id):
        portfolio = generics.get_object_or_404(
            Portfolio, pk=portfolio_id, user=request.user
        )
        allocation = compute_allocation(portfolio)
        return Response(allocation)


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
        groups = SecuritiesGroup.objects.filter(
            user=request.user
        ).prefetch_related('items')

        all_symbols = list({
            item.symbol
            for group in groups
            for item in group.items.all()
        })
        price_map = get_price_changes(all_symbols)

        data = [_build_group_response(g, price_map) for g in groups]
        return Response(data)

    def post(self, request):
        serializer = SecuritiesGroupCreateSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@method_decorator(csrf_exempt, name='dispatch')
class SecuritiesGroupDetailView(APIView):
    """
    PATCH  /api/portfolio/Securities/groups/{id}/  — Cập nhật nhóm.
    DELETE /api/portfolio/Securities/groups/{id}/  — Xóa nhóm.
    """
    permission_classes = [IsAuthenticated]

    def get_object(self, request, group_id):
        return generics.get_object_or_404(
            SecuritiesGroup, pk=group_id, user=request.user
        )

    def patch(self, request, group_id):
        group = self.get_object(request, group_id)
        serializer = SecuritiesGroupCreateSerializer(group, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, group_id):
        group = self.get_object(request, group_id)
        group.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@method_decorator(csrf_exempt, name='dispatch')
class SecuritiesItemCreateView(APIView):
    """POST /api/portfolio/Securities/groups/{id}/items/ — Thêm mã CK vào nhóm."""
    permission_classes = [IsAuthenticated]

    def post(self, request, group_id):
        group = generics.get_object_or_404(
            SecuritiesGroup, pk=group_id, user=request.user
        )
        symbol = request.data.get('symbol', '').upper().strip()
        if not symbol:
            return Response({'symbol': 'Không được để trống.'}, status=status.HTTP_400_BAD_REQUEST)

        item, created = SecuritiesItem.objects.get_or_create(
            group=group, symbol=symbol
        )
        if not created:
            return Response(
                {'detail': f'{symbol} đã có trong nhóm này.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        pc = get_price_changes([symbol]).get(symbol, {})
        return Response({'id': item.id, 'symbol': item.symbol, **pc}, status=status.HTTP_201_CREATED)


@method_decorator(csrf_exempt, name='dispatch')
class SecuritiesItemDeleteView(APIView):
    """DELETE /api/portfolio/Securities/items/{id}/ — Xóa mã CK khỏi nhóm."""
    permission_classes = [IsAuthenticated]

    def delete(self, request, item_id):
        item = generics.get_object_or_404(
            SecuritiesItem, pk=item_id, group__user=request.user
        )
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


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

    # Fallback cứng khi vnstock không trả về dữ liệu
    _FALLBACK_SECTORS = [
        {'name': 'Ngân hàng',         'group_type': 'SECTOR',     'color': '#3b82f6', 'order': 1,
         'description': 'Nhóm ngân hàng',
         'symbols': ['ACB','BID','CTG','EIB','HDB','LPB','MBB','MSB','OCB','SHB','SSB','STB','TCB','TPB','VCB','VIB','VPB']},
        {'name': 'Bất động sản',      'group_type': 'SECTOR',     'color': '#f59e0b', 'order': 2,
         'description': 'Nhóm bất động sản',
         'symbols': ['BCM','CEO','DIG','DXG','KBC','KDH','NLG','NVL','PDR','SJS','TDH','VHM','VIC','VRE']},
        {'name': 'Thép & Vật liệu',   'group_type': 'SECTOR',     'color': '#ef4444', 'order': 3,
         'description': 'Nhóm thép và vật liệu xây dựng',
         'symbols': ['BMP','HPG','HSG','NKG','TLH','VGC','VIS']},
        {'name': 'Dầu khí',           'group_type': 'SECTOR',     'color': '#8b5cf6', 'order': 4,
         'description': 'Nhóm dầu khí và năng lượng',
         'symbols': ['GAS','OIL','PLX','PVD','PVS','PVT']},
        {'name': 'Công nghệ',         'group_type': 'SECTOR',     'color': '#22c55e', 'order': 5,
         'description': 'Nhóm công nghệ và viễn thông',
         'symbols': ['CMG','ELC','FPT','SAM','VGI']},
        {'name': 'Bán lẻ & Tiêu dùng','group_type': 'SECTOR',     'color': '#ec4899', 'order': 6,
         'description': 'Nhóm bán lẻ và hàng tiêu dùng',
         'symbols': ['MSN','MWG','PNJ','SAB','VNM']},
        {'name': 'VN30',              'group_type': 'MARKET_CAP', 'color': '#6366f1', 'order': 7,
         'description': 'Top 30 cổ phiếu vốn hóa lớn nhất HOSE',
         'symbols': ['ACB','BID','CTG','DGC','FPT','GAS','GVR','HDB','HPG','LPB','MBB','MSN',
                     'MWG','PLX','SAB','SHB','SSB','SSI','STB','TCB','TPB','VCB','VHM','VIB',
                     'VIC','VJC','VNM','VPB','VPL','VRE']},
    ]

    def post(self, request):
        mode = request.query_params.get('mode', 'all')

        if mode == 'manual':
            return self._seed_from_list(request.user, self._FALLBACK_SECTORS)

        # --- Gọi vnstock để lấy dữ liệu thực ---
        data = fetch_market_sectors_and_groups()

        if data['error']:
            return Response({
                'warning': f"vnstock lỗi: {data['error']}. Dùng danh sách mặc định.",
                **self._apply_seed(request.user, self._FALLBACK_SECTORS),
            }, status=status.HTTP_207_MULTI_STATUS)

        groups_to_create = []

        if mode in ('all', 'sectors'):
            for i, sector in enumerate(data['sectors']):
                groups_to_create.append({
                    'name': sector['name'],
                    'group_type': 'SECTOR',
                    'description': sector['description'],
                    'color': sector['color'],
                    'order': i + 1,
                    'symbols': sector['symbols'],
                })

        if mode in ('all', 'caps'):
            offset = len(groups_to_create)
            for i, cap in enumerate(data['cap_groups']):
                groups_to_create.append({
                    'name': cap['name'],
                    'group_type': 'MARKET_CAP',
                    'description': cap['description'],
                    'color': cap['color'],
                    'order': offset + i + 1,
                    'symbols': cap['symbols'],
                })

        return Response(self._apply_seed(request.user, groups_to_create))

    @staticmethod
    def _apply_seed(user, groups: list) -> dict:
        """Tạo SecuritiesGroup + SecuritiesItem từ danh sách. Idempotent."""
        created_groups = []
        updated_groups = []

        # Removed broken/duplicate get_or_create block. Only use update_or_create below.
        for group_data in groups:
            symbols = group_data.get('symbols', [])
            group_defaults = {
                'group_type': group_data['group_type'],
                'description': group_data.get('description', ''),
                'color': group_data.get('color'),
                'order': group_data.get('order'),
            }
            group, created = SecuritiesGroup.objects.update_or_create(
                user=user, name=group_data['name'], defaults=group_defaults
            )

            # Lấy các mã đã có để tránh thêm trùng lặp
            existing_symbols = set(group.items.values_list('symbol', flat=True))
            new_items = [
                SecuritiesItem(group=group, symbol=sym.upper(), order=i)
                for i, sym in enumerate(symbols) if sym.upper() not in existing_symbols
            ]
            added_symbols = 0
            for i, sym in enumerate(symbols):
                _, sym_created = SecuritiesItem.objects.get_or_create(
                    group=group, symbol=sym.upper(),
                    defaults={'order': i},
                )
                if sym_created:
                    added_symbols += 1

            if new_items:
                SecuritiesItem.objects.bulk_create(new_items, ignore_conflicts=True)
                added_symbols = len(new_items)
            
            if created:
                created_groups.append({'group': group.name, 'symbols': len(symbols)})
            elif added_symbols:
                updated_groups.append({'group': group.name, 'new_symbols': added_symbols})

            g['symbols'] = symbols  # restore

        msg_parts = []
        if created_groups:
            msg_parts.append(f'{len(created_groups)} nhóm mới')
        if updated_groups:
            msg_parts.append(f'{len(updated_groups)} nhóm được cập nhật thêm mã')
        if not msg_parts:
            msg_parts = ['Tất cả nhóm đã tồn tại, không có thay đổi']

        return {
            'created': created_groups,
            'updated': updated_groups,
            'message': ', '.join(msg_parts) + '.',
            'total_groups': len(groups),
        }

    def _seed_from_list(self, user, groups):
        return Response(self._apply_seed(user, [dict(g) for g in groups]))


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

        results = sync_Securities_prices(request.user.id, days=days)
        if not results:
            return Response({'detail': 'Securities không có mã nào.'}, status=status.HTTP_200_OK)

        total_created = sum(r['created'] for r in results)
        total_errors = sum(r['errors'] for r in results)
        return Response({
            'synced': results,
            'total_symbols': len(results),
            'total_created': total_created,
            'total_errors': total_errors,
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

