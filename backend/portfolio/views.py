
# --- Stock Management Modular Views ---
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
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

@api_view(['POST'])
@permission_classes([IsAdminUser])
def sync_market_groups_api(request):
    """
    POST /api/admin-ops/market-groups/sync/
    Trigger đồng bộ nhóm thị trườ ng (sectors, market caps) toàn hệ thống.
    Yêu cầu is_staff.
    """
    mode = request.query_params.get('mode', 'all')
    clear_existing = request.query_params.get('clear', 'false').lower() == 'true'

    result = sync_market_groups(
        requested_by=request.user,
        mode=mode,
        clear_existing=clear_existing,
        scope=MarketGroupSyncLog.ScopeChoices.GLOBAL,
    )

    if result.get('warning') and result.get('success'):
        resp_status = status.HTTP_207_MULTI_STATUS
    elif result.get('success'):
        resp_status = status.HTTP_200_OK
    else:
        resp_status = status.HTTP_500_INTERNAL_SERVER_ERROR

    return Response(
        {
            'success': result.get('success', False),
            'message': result.get('message', ''),
            'warning': result.get('warning'),
            'source': result.get('source'),
            'created_groups': result.get('created_groups_count', 0),
            'updated_groups': result.get('updated_groups_count', 0),
            'added_symbols': result.get('added_symbols_count', 0),
            'error': result.get('error', ''),
        },
        status=resp_status,
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

import logging

from django.db.models import Max, Min
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.core.cache import cache
from django.views.decorators.csrf import csrf_exempt
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth.models import User
import redis as redis_lib
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from .models import Portfolio, Transaction, DailyPrice, SecuritiesGroup, SecuritiesItem, TrackedSymbol, UserConfig, SubAccount, WatchlistGroup, WatchlistItem, StockProfile, PriceAlertRule, MarketGroupSyncLog, StockProfileSyncLog
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
    get_price_changes, get_price_series, sync_market_groups, sync_market_groups_for_user, sync_stock_profiles, sync_watchlist_prices,
)

from .analytics import (
    compute_holdings, compute_nav_series, compute_allocation, build_summary,
    build_risk_metrics, compute_allocation_by_sector,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Cache helpers — silent fallback nếu Redis không sẵn sàng
# ---------------------------------------------------------------------------
def _cache_get(key):
    try:
        return cache.get(key)
    except Exception:
        return None


def _cache_set(key, value, timeout):
    try:
        cache.set(key, value, timeout=timeout)
    except Exception:
        pass



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
        days_raw = request.data.get('days', 5)
        try:
            days = int(days_raw)
            if days < 1 or days > 90:
                raise ValueError
        except (ValueError, TypeError):
            return Response({'detail': 'days phải là số nguyên trong khoảng [1, 90].'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            results = sync_watchlist_prices(user_id=request.user.id, days=days)
        except Exception as exc:
            logger.error('WatchlistSyncView lỗi: %s', exc, exc_info=True)
            return Response(
                {'detail': f'Sync thất bại: {exc}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return Response({'synced': len(results), 'days': days})


class RealtimeTickerView(APIView):
    """
    GET /api/realtime/ticker/<symbol>/ — fallback polling endpoint for realtime views.
    Dữ liệu thực từ vnstock price_board, fallback về DB nếu vnstock lỗi.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, symbol):
        normalized_symbol = (symbol or '').strip().upper()
        if not normalized_symbol:
            return Response({'detail': 'Thiếu mã chứng khoán.'}, status=status.HTTP_400_BAD_REQUEST)

        # --- Thử lấy dữ liệu thực từ vnstock price_board ---
        try:
            from vnstock import Vnstock
            stock = Vnstock().stock(symbol=normalized_symbol, source='VCI')
            df = stock.trading.price_board(symbols_list=[normalized_symbol])
            if df is not None and not df.empty:
                ls = df['listing'].iloc[0]
                mt = df['match'].iloc[0]

                def _f(val):
                    try:
                        v = float(val)
                        return v if v == v and v != 0 else None
                    except (TypeError, ValueError):
                        return None

                def _i(val):
                    try:
                        v = float(val)
                        return int(v) if v == v else None
                    except (TypeError, ValueError):
                        return None

                match_price = _f(mt.get('match_price'))
                ref_price = _f(ls.get('ref_price')) or _f(mt.get('reference_price'))
                highest = _f(mt.get('highest'))
                lowest = _f(mt.get('lowest'))
                open_price = _f(mt.get('open_price'))
                accum_vol = _i(mt.get('accumulated_volume'))

                change_value = None
                change_pct = None
                if match_price and ref_price:
                    change_value = round(match_price - ref_price, 2)
                    change_pct = round((match_price - ref_price) / ref_price * 100, 2)

                return Response({
                    'symbol': normalized_symbol,
                    'current_price': match_price,
                    'prev_price': ref_price,
                    'change_value': change_value,
                    'change_pct': change_pct,
                    'high_price': highest,
                    'low_price': lowest,
                    'open_price': open_price,
                    'volume': accum_vol,
                    'last_date': timezone.now().isoformat(),
                    'freshness_seconds': 0,
                    'stale': False,
                    'source': 'live',
                })
        except Exception as exc:
            logger.warning('RealtimeTickerView vnstock lỗi %s: %s', normalized_symbol, exc)

        # --- Fallback: DB ---
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

        latest_dp = (
            DailyPrice.objects
            .filter(symbol=normalized_symbol)
            .order_by('-date')
            .values('open_price', 'high_price', 'low_price', 'volume')
            .first()
        )
        ohlc_extra = {}
        if latest_dp:
            ohlc_extra = {
                'open_price': float(latest_dp['open_price']) if latest_dp['open_price'] is not None else None,
                'high_price': float(latest_dp['high_price']) if latest_dp['high_price'] is not None else None,
                'low_price': float(latest_dp['low_price']) if latest_dp['low_price'] is not None else None,
                'volume': int(latest_dp['volume']) if latest_dp['volume'] is not None else None,
            }

        return Response({
            'symbol': normalized_symbol,
            **price_info,
            **ohlc_extra,
            'freshness_seconds': freshness_seconds,
            'stale': stale,
            'source': 'db',
        })


class IntradayMatchedView(APIView):
    """
    GET /api/realtime/intraday/<symbol>/?page_size=50
    Lấy dữ liệu khớp lệnh trong phiên giao dịch hôm nay từ vnstock.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, symbol):
        normalized_symbol = (symbol or '').strip().upper()
        if not normalized_symbol:
            return Response({'detail': 'Thiếu mã chứng khoán.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            page_size = int(request.query_params.get('page_size', 50))
            page_size = max(10, min(200, page_size))
        except (ValueError, TypeError):
            page_size = 50

        cache_key = f'intraday:{normalized_symbol}:{page_size}'
        cached = _cache_get(cache_key)
        if cached is not None:
            return Response(cached)

        try:
            from vnstock import Vnstock  # import trễ
            stock = Vnstock().stock(symbol=normalized_symbol, source='VCI')
            df = stock.quote.intraday(symbol=normalized_symbol, page_size=page_size)
        except ImportError:
            return Response({'detail': 'vnstock chưa được cài đặt.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception as exc:
            logger.warning('IntradayMatchedView lỗi vnstock %s: %s', normalized_symbol, exc)
            return Response({'detail': f'Không lấy được dữ liệu khớp lệnh: {exc}'}, status=status.HTTP_502_BAD_GATEWAY)

        if df is None or df.empty:
            return Response({'symbol': normalized_symbol, 'trades': [], 'total': 0, 'fetched_at': timezone.now().isoformat()})

        trades = []
        for _, row in df.iterrows():
            raw_time = row.get('time') or row.get('tradingDate') or row.get('date') or ''
            raw_price = row.get('price') or row.get('close') or 0
            raw_vol = row.get('volume') or row.get('vol') or row.get('matchVolume') or 0

            # vnstock VCI trả về match_type = 'Buy' / 'Sell' / 'ATO' / 'ATC'
            match_type_raw = str(row.get('match_type') or row.get('matchType') or row.get('side') or '')
            mt_lower = match_type_raw.lower()
            if mt_lower in ('buy', 'bu', 'b'):
                side = 'buy'
            elif mt_lower in ('sell', 'sd', 's'):
                side = 'sell'
            else:
                side = 'neutral'

            try:
                price_val = float(raw_price) if raw_price else None
                vol_val = int(float(raw_vol)) if raw_vol else None
            except (ValueError, TypeError):
                price_val = None
                vol_val = None

            if price_val is None:
                continue

            time_str = ''
            try:
                import pandas as pd
                ts = pd.Timestamp(raw_time)
                time_str = ts.strftime('%H:%M:%S')
            except Exception:
                time_str = str(raw_time)[:8]

            trades.append({
                'time': time_str,
                'price': price_val,
                'volume': vol_val,
                'side': side,
                'match_type': match_type_raw,
            })

        result = {
            'symbol': normalized_symbol,
            'trades': trades,
            'total': len(trades),
            'fetched_at': timezone.now().isoformat(),
        }
        _cache_set(cache_key, result, timeout=8)
        return Response(result)


class PriceBoardView(APIView):
    """
    GET /api/realtime/price-board/<symbol>/
    Trả về sổ lệnh 3 mức giá (bid/ask) và dữ liệu khớp thực từ vnstock price_board.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, symbol):
        normalized_symbol = (symbol or '').strip().upper()
        if not normalized_symbol:
            return Response({'detail': 'Thiếu mã chứng khoán.'}, status=status.HTTP_400_BAD_REQUEST)

        cache_key = f'price_board:{normalized_symbol}'
        cached = _cache_get(cache_key)
        if cached is not None:
            return Response(cached)

        try:
            from vnstock import Vnstock
            stock = Vnstock().stock(symbol=normalized_symbol, source='VCI')
            df = stock.trading.price_board(symbols_list=[normalized_symbol])
        except ImportError:
            return Response({'detail': 'vnstock chưa được cài đặt.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception as exc:
            logger.warning('PriceBoardView lỗi vnstock %s: %s', normalized_symbol, exc)
            return Response({'detail': f'Không lấy được dữ liệu sổ lệnh: {exc}'}, status=status.HTTP_502_BAD_GATEWAY)

        if df is None or df.empty:
            return Response({'symbol': normalized_symbol, 'depth': [], 'match': {}})

        row = df.iloc[0]

        def safe_float(val):
            try:
                v = float(val)
                return v if v == v else None  # NaN check
            except (TypeError, ValueError):
                return None

        def safe_int(val):
            try:
                v = float(val)
                return int(v) if v == v else None
            except (TypeError, ValueError):
                return None

        ba = df['bid_ask'].iloc[0]
        mt = df['match'].iloc[0]

        depth = []
        for i in range(1, 4):
            bp = safe_float(ba.get(f'bid_{i}_price'))
            bv = safe_int(ba.get(f'bid_{i}_volume'))
            ap = safe_float(ba.get(f'ask_{i}_price'))
            av = safe_int(ba.get(f'ask_{i}_volume'))
            if bp is not None or ap is not None:
                depth.append({'level': i, 'bid_price': bp, 'bid_volume': bv, 'ask_price': ap, 'ask_volume': av})

        ref = safe_float(mt.get('reference_price'))
        match_price = safe_float(mt.get('match_price'))
        change_pct = round((match_price - ref) / ref * 100, 2) if ref and match_price else None

        match_data = {
            'match_price': match_price,
            'open_price': safe_float(mt.get('open_price')),
            'highest': safe_float(mt.get('highest')),
            'lowest': safe_float(mt.get('lowest')),
            'reference_price': ref,
            'accumulated_volume': safe_int(mt.get('accumulated_volume')),
            'foreign_buy_volume': safe_int(mt.get('foreign_buy_volume')),
            'foreign_sell_volume': safe_int(mt.get('foreign_sell_volume')),
            'change_pct': change_pct,
        }

        result = {
            'symbol': normalized_symbol,
            'depth': depth,
            'match': match_data,
            'fetched_at': timezone.now().isoformat(),
        }
        _cache_set(cache_key, result, timeout=8)
        return Response(result)


class SectorBreadthView(APIView):
    """
    GET /api/realtime/breadth/<symbol>/
    Trả về diễn biến giá các mã cùng nhóm ngành với symbol, dùng price_board.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, symbol):
        normalized_symbol = (symbol or '').strip().upper()
        if not normalized_symbol:
            return Response({'detail': 'Thiếu mã chứng khoán.'}, status=status.HTTP_400_BAD_REQUEST)

        cache_key = f'breadth:{normalized_symbol}'
        cached = _cache_get(cache_key)
        if cached is not None:
            return Response(cached)

        # Lấy các nhóm mà symbol thuộc về
        group_items = (
            SecuritiesItem.objects
            .filter(symbol=normalized_symbol)
            .select_related('group')
            .order_by('group__order', 'group__name')[:5]
        )

        if not group_items.exists():
            return Response({'symbol': normalized_symbol, 'groups': [], 'fetched_at': timezone.now().isoformat()})

        # Gom tất cả symbols cần fetch (tối đa 15 mã/nhóm)
        groups_meta = []
        all_symbols = set()
        for item in group_items:
            group = item.group
            peers = list(
                SecuritiesItem.objects
                .filter(group=group)
                .exclude(symbol=normalized_symbol)
                .values_list('symbol', flat=True)
                .order_by('order', 'symbol')[:14]
            )
            peers.insert(0, normalized_symbol)
            groups_meta.append({'id': group.id, 'name': group.name, 'symbols': peers})
            all_symbols.update(peers)

        all_symbols = list(all_symbols)

        try:
            from vnstock import Vnstock
            stock = Vnstock().stock(symbol=normalized_symbol, source='VCI')
            df = stock.trading.price_board(symbols_list=all_symbols)
        except ImportError:
            return Response({'detail': 'vnstock chưa được cài đặt.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception as exc:
            logger.warning('SectorBreadthView lỗi vnstock %s: %s', normalized_symbol, exc)
            return Response({'detail': f'Không lấy được dữ liệu breadth: {exc}'}, status=status.HTTP_502_BAD_GATEWAY)

        # Xây dựng lookup: symbol -> change_pct, price, status
        price_map = {}
        for _, row in df.iterrows():
            sym = row.get(('listing', 'symbol'))
            if not sym:
                continue
            try:
                ref = float(row.get(('match', 'reference_price')) or 0)
                price = float(row.get(('match', 'match_price')) or 0)
                chg = round((price - ref) / ref * 100, 2) if ref > 0 else None
            except (TypeError, ValueError):
                chg = None
                price = None
            status_val = 'up' if chg is not None and chg > 0.5 else 'down' if chg is not None and chg < -0.5 else 'flat'
            price_map[str(sym).upper()] = {'price': price, 'change_pct': chg, 'status': status_val}

        result_groups = []
        for gm in groups_meta:
            peers = []
            for s in gm['symbols']:
                info = price_map.get(s.upper(), {})
                peers.append({
                    'symbol': s,
                    'price': info.get('price'),
                    'change_pct': info.get('change_pct'),
                    'status': info.get('status', 'flat'),
                    'is_self': s == normalized_symbol,
                })
            result_groups.append({'name': gm['name'], 'peers': peers})

        result = {
            'symbol': normalized_symbol,
            'groups': result_groups,
            'fetched_at': timezone.now().isoformat(),
        }
        _cache_set(cache_key, result, timeout=30)
        return Response(result)


class WhaleFeedView(APIView):
    """
    GET /api/realtime/whale-feed/<symbol>/
    Trả về các lệnh lớn trong phiên + tóm tắt dòng tiền từ intraday data.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, symbol):
        import pandas as pd
        normalized_symbol = (symbol or '').strip().upper()
        if not normalized_symbol:
            return Response({'detail': 'Thiếu mã chứng khoán.'}, status=status.HTTP_400_BAD_REQUEST)

        config = UserConfig.objects.filter(user=request.user).values('whale_alert_threshold').first()
        threshold_m = float((config or {}).get('whale_alert_threshold') or 500)
        threshold_vnd = threshold_m * 1_000_000

        cache_key = f'whale_feed:{normalized_symbol}'
        cached = _cache_get(cache_key)
        if cached is not None:
            return Response(cached)

        try:
            from vnstock import Vnstock
            stock = Vnstock().stock(symbol=normalized_symbol, source='VCI')
            df = stock.quote.intraday(symbol=normalized_symbol, page_size=500)
        except Exception as exc:
            logger.warning('WhaleFeedView lỗi vnstock %s: %s', normalized_symbol, exc)
            return Response({'detail': f'Không lấy được dữ liệu: {exc}'}, status=status.HTTP_502_BAD_GATEWAY)

        if df is None or df.empty:
            return Response({
                'symbol': normalized_symbol, 'threshold': threshold_vnd,
                'whale_orders': [], 'summary': {
                    'buy_value': 0, 'sell_value': 0, 'flow_net': 0,
                    'shark_value': 0, 'whale_value': 0, 'small_value': 0,
                    'shark_pct': 0, 'whale_pct': 0, 'small_pct': 0,
                },
                'fetched_at': timezone.now().isoformat(),
            })

        orders = []
        total_buy_value = 0.0
        total_sell_value = 0.0
        shark_value = 0.0
        whale_value_total = 0.0
        small_value = 0.0

        for _, row in df.iterrows():
            try:
                raw_price = float(row.get('price') or row.get('close') or 0)
                raw_vol = float(row.get('volume') or row.get('vol') or row.get('matchVolume') or 0)
            except (ValueError, TypeError):
                continue
            matched_value = raw_price * raw_vol

            match_type_raw = str(row.get('match_type') or row.get('matchType') or row.get('side') or '')
            mt_lower = match_type_raw.lower()
            if mt_lower in ('buy', 'bu', 'b'):
                side = 'buy'
            elif mt_lower in ('sell', 'sd', 's'):
                side = 'sell'
            else:
                side = 'neutral'

            if matched_value >= 5_000_000_000:
                size_class = 'shark'
                shark_value += matched_value
            elif matched_value >= 1_000_000_000:
                size_class = 'whale'
                whale_value_total += matched_value
            else:
                size_class = 'small'
                small_value += matched_value

            if side == 'buy':
                total_buy_value += matched_value
            elif side == 'sell':
                total_sell_value += matched_value

            if matched_value >= threshold_vnd:
                raw_time = row.get('time') or row.get('tradingDate') or ''
                try:
                    time_str = pd.Timestamp(str(raw_time)).strftime('%H:%M:%S')
                except Exception:
                    time_str = str(raw_time)[:8]
                orders.append({
                    'time': time_str,
                    'price': raw_price,
                    'volume': int(raw_vol),
                    'matched_value': matched_value,
                    'side': side,
                    'size_class': size_class,
                })

        orders.sort(key=lambda x: x['matched_value'], reverse=True)
        total_value = shark_value + whale_value_total + small_value

        result = {
            'symbol': normalized_symbol,
            'threshold': threshold_vnd,
            'whale_orders': orders[:50],
            'summary': {
                'buy_value': total_buy_value,
                'sell_value': total_sell_value,
                'flow_net': total_buy_value - total_sell_value,
                'shark_value': shark_value,
                'whale_value': whale_value_total,
                'small_value': small_value,
                'shark_pct': round(shark_value / total_value * 100, 1) if total_value > 0 else 0,
                'whale_pct': round(whale_value_total / total_value * 100, 1) if total_value > 0 else 0,
                'small_pct': round(small_value / total_value * 100, 1) if total_value > 0 else 0,
            },
            'fetched_at': timezone.now().isoformat(),
        }
        _cache_set(cache_key, result, timeout=20)
        return Response(result)


class RVOLView(APIView):
    """
    GET /api/realtime/rvol/<symbol>/
    Tính RVOL (Relative Volume) theo bucket 15 phút từ intraday data.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, symbol):
        import pandas as pd
        normalized_symbol = (symbol or '').strip().upper()
        if not normalized_symbol:
            return Response({'detail': 'Thiếu mã chứng khoán.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from vnstock import Vnstock
            stock = Vnstock().stock(symbol=normalized_symbol, source='VCI')
            df = stock.quote.intraday(symbol=normalized_symbol, page_size=500)
        except Exception as exc:
            logger.warning('RVOLView lỗi vnstock %s: %s', normalized_symbol, exc)
            return Response({'detail': f'Không lấy được dữ liệu: {exc}'}, status=status.HTTP_502_BAD_GATEWAY)

        if df is None or df.empty:
            return Response({'symbol': normalized_symbol, 'buckets': [], 'fetched_at': timezone.now().isoformat()})

        rows = []
        for _, row in df.iterrows():
            raw_time = row.get('time') or row.get('tradingDate') or ''
            raw_vol = row.get('volume') or row.get('vol') or row.get('matchVolume') or 0
            try:
                ts = pd.Timestamp(str(raw_time))
                vol = float(raw_vol)
                rows.append({'ts': ts, 'volume': vol})
            except Exception:
                continue

        if not rows:
            return Response({'symbol': normalized_symbol, 'buckets': [], 'fetched_at': timezone.now().isoformat()})

        frame = pd.DataFrame(rows).set_index('ts').sort_index()
        buckets_df = frame.resample('15min')['volume'].sum().reset_index()
        buckets_df.columns = ['time', 'volume']

        volumes = buckets_df['volume'].values
        window = min(20, len(volumes))
        sma20_vals = []
        for i in range(len(volumes)):
            start = max(0, i - window)
            sma20_vals.append(float(volumes[start:i + 1].mean()) if i >= 0 else 0.0)

        buckets = []
        for i, row in buckets_df.iterrows():
            vol = float(row['volume'])
            sma20 = sma20_vals[i] if i < len(sma20_vals) else 0.0
            rvol = round(vol / sma20, 2) if sma20 > 0 else 0.0
            try:
                time_str = row['time'].strftime('%H:%M')
            except Exception:
                time_str = str(row['time'])[:5]
            buckets.append({
                'time': time_str,
                'volume': int(vol),
                'sma20': int(sma20),
                'rvol': rvol,
                'is_spike': rvol >= 2.0,
            })

        return Response({
            'symbol': normalized_symbol,
            'buckets': buckets,
            'fetched_at': timezone.now().isoformat(),
        })


class DepthChartView(APIView):
    """
    GET /api/realtime/depth-chart/<symbol>/
    Tính độ sâu tích lũy từ price_board để vẽ depth chart (bid/ask mountains).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, symbol):
        normalized_symbol = (symbol or '').strip().upper()
        if not normalized_symbol:
            return Response({'detail': 'Thiếu mã chứng khoán.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from vnstock import Vnstock
            stock = Vnstock().stock(symbol=normalized_symbol, source='VCI')
            df = stock.trading.price_board(symbols_list=[normalized_symbol])
        except Exception as exc:
            logger.warning('DepthChartView lỗi vnstock %s: %s', normalized_symbol, exc)
            return Response({'detail': f'Không lấy được dữ liệu: {exc}'}, status=status.HTTP_502_BAD_GATEWAY)

        if df is None or df.empty:
            return Response({'symbol': normalized_symbol, 'bids': [], 'asks': [], 'walls': [], 'reference_price': None})

        def safe_f(val):
            try:
                v = float(val)
                return v if v == v else None
            except (TypeError, ValueError):
                return None

        def safe_i(val):
            try:
                v = float(val)
                return int(v) if v == v else None
            except (TypeError, ValueError):
                return None

        ba = df['bid_ask'].iloc[0]
        mt = df['match'].iloc[0]

        ref_price = safe_f(mt.get('reference_price')) or 0
        ceil_price = safe_f(mt.get('ceiling_price')) or (ref_price * 1.07 if ref_price else None)
        floor_price = safe_f(mt.get('floor_price')) or (ref_price * 0.93 if ref_price else None)

        bids = []
        cum_bid = 0
        for i in range(1, 4):
            bp = safe_f(ba.get(f'bid_{i}_price'))
            bv = safe_i(ba.get(f'bid_{i}_volume'))
            if bp and bv:
                cum_bid += bv
                bids.append({'price': bp, 'volume': bv, 'cumulative': cum_bid})

        asks = []
        cum_ask = 0
        for i in range(1, 4):
            ap = safe_f(ba.get(f'ask_{i}_price'))
            av = safe_i(ba.get(f'ask_{i}_volume'))
            if ap and av:
                cum_ask += av
                asks.append({'price': ap, 'volume': av, 'cumulative': cum_ask})

        all_vols = [b['volume'] for b in bids] + [a['volume'] for a in asks]
        avg_vol = sum(all_vols) / len(all_vols) if all_vols else 1
        wall_threshold = avg_vol * 2

        walls = []
        for b in bids:
            if b['volume'] >= wall_threshold:
                walls.append({'side': 'bid', 'price': b['price'], 'volume': b['volume'],
                               'label': f'⚠️ TƯỜNG MUA: {b["volume"]:,}'})
        for a in asks:
            if a['volume'] >= wall_threshold:
                walls.append({'side': 'ask', 'price': a['price'], 'volume': a['volume'],
                               'label': f'⚠️ TƯỜNG BÁN: {a["volume"]:,}'})

        return Response({
            'symbol': normalized_symbol,
            'reference_price': ref_price,
            'ceiling_price': ceil_price,
            'floor_price': floor_price,
            'bids': bids,
            'asks': asks,
            'walls': walls,
            'fetched_at': timezone.now().isoformat(),
        })


# ---------------------------------------------------------------------------
# Financial Metrics View
# ---------------------------------------------------------------------------

class FinancialMetricsView(APIView):
    """
    GET /api/stock-management/stocks/<symbol>/financials/
    Trả về chỉ tiêu tài chính theo năm (tối đa 5 năm gần nhất).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, symbol):
        normalized_symbol = (symbol or '').strip().upper()
        if not normalized_symbol:
            return Response({'detail': 'Thiếu mã chứng khoán.'}, status=status.HTTP_400_BAD_REQUEST)

        cache_key = f'financials:{normalized_symbol}'
        cached = _cache_get(cache_key)
        if cached is not None:
            return Response(cached)

        try:
            from vnstock import Vnstock
            stock = Vnstock().stock(symbol=normalized_symbol, source='VCI')
            df = stock.finance.ratio(period='year', lang='vi', dropna=True)
        except Exception as exc:
            logger.warning('FinancialMetricsView lỗi vnstock %s: %s', normalized_symbol, exc)
            return Response({'detail': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        if df is None or df.empty:
            return Response({'symbol': normalized_symbol, 'years': []})

        def _f(row, key):
            val = row.get(key)
            if val is None:
                return None
            try:
                v = float(val)
                return round(v, 4) if v == v else None
            except (TypeError, ValueError):
                return None

        years = []
        for _, row in df.head(5).iterrows():
            year_val = row.get(('Meta', 'Năm')) or row.get('Năm')
            years.append({
                'year': int(year_val) if year_val else None,
                # Định giá
                'eps':         _f(row, ('Chỉ tiêu định giá', 'EPS (VND)')),
                'pe':          _f(row, ('Chỉ tiêu định giá', 'P/E')),
                'pb':          _f(row, ('Chỉ tiêu định giá', 'P/B')),
                'ps':          _f(row, ('Chỉ tiêu định giá', 'P/S')),
                'bvps':        _f(row, ('Chỉ tiêu định giá', 'BVPS (VND)')),
                'market_cap_bn': _f(row, ('Chỉ tiêu định giá', 'Vốn hóa (Tỷ đồng)')),
                # Sinh lời
                'roe':           _f(row, ('Chỉ tiêu khả năng sinh lợi', 'ROE (%)')),
                'roa':           _f(row, ('Chỉ tiêu khả năng sinh lợi', 'ROA (%)')),
                'net_margin':    _f(row, ('Chỉ tiêu khả năng sinh lợi', 'Biên lợi nhuận ròng (%)')),
                'dividend_yield': _f(row, ('Chỉ tiêu khả năng sinh lợi', 'Tỷ suất cổ tức (%)')),
                # Thanh khoản / đòn bẩy
                'leverage':      _f(row, ('Chỉ tiêu thanh khoản', 'Đòn bẩy tài chính')),
                'current_ratio': _f(row, ('Chỉ tiêu thanh khoản', 'Hệ số thanh toán hiện hành')),
                'quick_ratio':   _f(row, ('Chỉ tiêu thanh khoản', 'Hệ số thanh toán nhanh')),
                'debt_equity':   _f(row, ('Chỉ tiêu thanh khoản', 'Nợ/Vốn chủ sở hữu')),
            })

        result = {
            'symbol': normalized_symbol,
            'years': years,
            'fetched_at': timezone.now().isoformat(),
        }
        _cache_set(cache_key, result, timeout=21600)  # 6 giờ
        return Response(result)


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


class EquityCurveView(APIView):
    """
    GET /api/portfolio/portfolios/{id}/equity-curve/?days=180

    Trả về chuỗi NAV portfolio và VN-Index chuẩn hóa về % tăng trưởng từ ngày đầu.
    Response: {
      points: [{date, portfolio_pct, benchmark_pct}],
      has_benchmark: bool,
      period_days: int
    }
    """
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

        # Load VNINDEX từ DailyPrice
        start_date = nav_df['date'].iloc[0].date()
        end_date = nav_df['date'].iloc[-1].date()
        bench_qs = (
            DailyPrice.objects
            .filter(symbol='VNINDEX', date__gte=start_date, date__lte=end_date)
            .order_by('date')
            .values('date', 'close_price')
        )
        has_benchmark = bench_qs.exists()
        bench_map = {}
        if has_benchmark:
            bench_list = list(bench_qs)
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
            items = compute_allocation_by_sector(portfolio)
            hhi_score = round(sum(row['hhi_contribution'] for row in items), 2)
            return Response({'items': items, 'hhi_score': hhi_score})
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


def _compute_ema(values, period):
    """Tính EMA với smoothing factor k = 2 / (period + 1)."""
    if len(values) < period:
        return None
    k = 2.0 / (period + 1)
    ema = sum(values[:period]) / period  # seed = SMA của period đầu
    for v in values[period:]:
        ema = v * k + ema * (1 - k)
    return ema


def _compute_macd_hist(values):
    """
    MACD histogram = (EMA12 - EMA26) - EMA9(EMA12 - EMA26).
    Cần ít nhất 35 giá trị để tính đủ (26 + 9 extra).
    """
    if len(values) < 35:
        return None
    k12 = 2.0 / 13
    k26 = 2.0 / 27
    k9  = 2.0 / 10
    ema12 = sum(values[:12]) / 12
    ema26 = sum(values[:26]) / 26
    macd_series = []
    for i, v in enumerate(values[1:], start=1):
        ema12 = v * k12 + ema12 * (1 - k12)
        ema26 = v * k26 + ema26 * (1 - k26)
        if i >= 25:
            macd_series.append(ema12 - ema26)
    if len(macd_series) < 9:
        return None
    signal = sum(macd_series[:9]) / 9
    for m in macd_series[9:]:
        signal = m * k9 + signal * (1 - k9)
    return macd_series[-1] - signal


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
        normalized_symbol = (symbol or '').strip().upper()

        cache_key = f'overview:{normalized_symbol}'
        cached = _cache_get(cache_key)
        if cached is not None:
            return Response(cached)

        payload = _build_stock_workspace_overview(symbol, request.user)
        try:
            from vnstock import Vnstock
            stock = Vnstock().stock(symbol=normalized_symbol, source='VCI')
            df = stock.trading.price_board(symbols_list=[normalized_symbol])
            if df is not None and not df.empty:
                ls = df['listing'].iloc[0]
                mt = df['match'].iloc[0]

                def _f(val):
                    try:
                        v = float(val)
                        return v if v == v and v != 0 else None
                    except (TypeError, ValueError):
                        return None

                def _i(val):
                    try:
                        v = float(val)
                        return int(v) if v == v else None
                    except (TypeError, ValueError):
                        return None

                match_price = _f(mt.get('match_price'))
                ref_price = _f(ls.get('ref_price')) or _f(mt.get('reference_price'))
                ceil_price = _f(ls.get('ceiling')) or _f(mt.get('ceiling_price'))
                floor_price = _f(ls.get('floor')) or _f(mt.get('floor_price'))
                highest = _f(mt.get('highest'))
                lowest = _f(mt.get('lowest'))
                open_price = _f(mt.get('open_price'))
                accum_vol = _i(mt.get('accumulated_volume'))
                exchange_raw = str(ls.get('exchange') or '').strip()

                if match_price:
                    payload['current_price'] = match_price
                    payload['close_price'] = match_price
                if ref_price:
                    payload['reference_price'] = ref_price
                    payload['prev_price'] = ref_price
                if ceil_price:
                    payload['ceiling_price'] = ceil_price
                if floor_price:
                    payload['floor_price'] = floor_price
                if highest:
                    payload['high_price'] = highest
                if lowest:
                    payload['low_price'] = lowest
                if open_price:
                    payload['open_price'] = open_price
                if accum_vol and accum_vol > 0:
                    payload['volume'] = accum_vol
                if exchange_raw and not payload.get('exchange'):
                    payload['exchange'] = exchange_raw

                # Tính change từ giá thực
                if match_price and ref_price:
                    chg_val = round(match_price - ref_price, 2)
                    chg_pct = round((match_price - ref_price) / ref_price * 100, 2)
                    payload['change_value'] = chg_val
                    payload['change_pct'] = chg_pct

                # average_price: trung bình OHLC thực
                prices = [v for v in [open_price, highest, lowest, match_price] if v]
                if len(prices) >= 2:
                    payload['average_price'] = round(sum(prices) / len(prices), 2)

        except Exception as exc:
            logger.warning('StockWorkspaceOverviewView vnstock overlay lỗi %s: %s', normalized_symbol, exc)

        # 52W high/low thực từ vnstock history (1D, 365 ngày)
        try:
            from vnstock import Vnstock
            from datetime import date as _date, timedelta as _timedelta
            stock52 = Vnstock().stock(symbol=normalized_symbol, source='VCI')
            _end = _date.today().strftime('%Y-%m-%d')
            _start = (_date.today() - _timedelta(days=365)).strftime('%Y-%m-%d')
            hist_df = stock52.quote.history(symbol=normalized_symbol, start=_start, end=_end, interval='1D')
            if hist_df is not None and not hist_df.empty and 'high' in hist_df.columns:
                # vnstock history trả về đơn vị nghìn đồng (VND/1000)
                _scale = 1000.0
                w52_high = round(float(hist_df['high'].max()) * _scale, 0)
                w52_low = round(float(hist_df['low'].min()) * _scale, 0)
                if w52_high > 0:
                    payload['week52_high'] = w52_high
                if w52_low > 0:
                    payload['week52_low'] = w52_low
        except Exception as exc4:
            logger.debug('StockWorkspaceOverviewView 52W overlay lỗi %s: %s', normalized_symbol, exc4)

        # Nếu company_name / exchange vẫn trống, thử lấy từ listing.all_symbols
        if not payload.get('company_name'):
            try:
                from vnstock import Vnstock
                stock3 = Vnstock().stock(symbol=normalized_symbol, source='VCI')
                ls_df = stock3.listing.all_symbols()
                if ls_df is not None and not ls_df.empty:
                    row = ls_df[ls_df['symbol'] == normalized_symbol]
                    if not row.empty:
                        name = str(row.iloc[0].get('organ_name') or '').strip()
                        if name:
                            payload['company_name'] = name
            except Exception as exc3:
                logger.debug('StockWorkspaceOverviewView listing overlay lỗi %s: %s', normalized_symbol, exc3)

        serialized = StockWorkspaceOverviewSerializer(payload).data
        _cache_set(cache_key, serialized, timeout=12)
        return Response(serialized)


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


# ---------------------------------------------------------------------------
# Admin Ops
# ---------------------------------------------------------------------------

class AdminOpsStatsView(APIView):
    """
    GET /api/admin-ops/stats/

    Trả về thống kê hệ thống để admin theo dõi: số user, danh mục,
    mã theo dõi, watchlist, lần sync cuối, trạng thái Redis/channel layer.
    Yêu cầu is_staff (IsAdminUser).
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        from django.conf import settings

        # --- Counts ---
        user_count = User.objects.count()
        portfolio_count = Portfolio.objects.count()
        tracked_symbol_count = TrackedSymbol.objects.count()
        watchlist_item_count = WatchlistItem.objects.count()

        # --- Last sync logs ---
        last_mg_sync = MarketGroupSyncLog.objects.order_by('-started_at').first()
        last_sp_sync = StockProfileSyncLog.objects.order_by('-started_at').first()

        def _fmt_sync(log):
            if log is None:
                return None
            return {
                'started_at': log.started_at.isoformat() if log.started_at else None,
                'finished_at': log.finished_at.isoformat() if log.finished_at else None,
                'success': log.success,
                'mode': log.mode,
                'message': log.message,
            }

        # --- Redis / channel layer health ---
        channel_layer_type = getattr(settings, 'REALTIME_CHANNEL_LAYER', 'redis')
        realtime_enabled = getattr(settings, 'REALTIME_ENABLED', False)
        redis_ok = None
        if channel_layer_type != 'inmemory':
            try:
                redis_url = getattr(settings, 'REALTIME_REDIS_URL', 'redis://localhost:6379/0')
                client = redis_lib.from_url(redis_url, socket_connect_timeout=1)
                client.ping()
                redis_ok = True
            except Exception:
                redis_ok = False

        return Response({
            'user_count': user_count,
            'portfolio_count': portfolio_count,
            'tracked_symbol_count': tracked_symbol_count,
            'watchlist_item_count': watchlist_item_count,
            'last_market_group_sync': _fmt_sync(last_mg_sync),
            'last_stock_profile_sync': _fmt_sync(last_sp_sync),
            'channel_layer_type': channel_layer_type,
            'realtime_enabled': realtime_enabled,
            'redis_ok': redis_ok,
        })


# ---------------------------------------------------------------------------
# Screener — CRUD + Evaluator
# ---------------------------------------------------------------------------
from .models import ScreenerRule
from .serializers import ScreenerRuleSerializer

# Tập field hợp lệ cho screener conditions
_SCREENER_ALLOWED_FIELDS = {
    'close', 'volume', 'rsi_14', 'sma20', 'sma50',
    'momentum_20d_pct', 'price_vs_sma20_pct', 'price_vs_sma50_pct',
    'range_position_pct', 'avg_volume_20',
}
_SCREENER_ALLOWED_OPS = {'lt', 'lte', 'gt', 'gte', 'eq'}


def _validate_screener_rules(rules_json):
    """
    Kiểm tra cú pháp rules_json.
    rules_json phải là list[dict] với mỗi dict có: field (str), op (str), value (number).
    Trả về (ok: bool, error_msg: str)
    """
    if not isinstance(rules_json, list) or len(rules_json) == 0:
        return False, 'rules_json phải là list không rỗng.'
    for i, cond in enumerate(rules_json):
        if not isinstance(cond, dict):
            return False, f'Condition #{i} phải là object.'
        field = cond.get('field')
        op = cond.get('op')
        value = cond.get('value')
        if field not in _SCREENER_ALLOWED_FIELDS:
            return False, f'Field "{field}" không hợp lệ. Cho phép: {sorted(_SCREENER_ALLOWED_FIELDS)}.'
        if op not in _SCREENER_ALLOWED_OPS:
            return False, f'Op "{op}" không hợp lệ. Cho phép: {sorted(_SCREENER_ALLOWED_OPS)}.'
        if not isinstance(value, (int, float)):
            return False, f'Value của condition #{i} phải là số.'
    return True, ''


def _apply_screener_condition(field_val, op, target_val):
    if field_val is None:
        return False
    try:
        fv = float(field_val)
        tv = float(target_val)
    except (TypeError, ValueError):
        return False
    if op == 'lt':  return fv < tv
    if op == 'lte': return fv <= tv
    if op == 'gt':  return fv > tv
    if op == 'gte': return fv >= tv
    if op == 'eq':  return abs(fv - tv) < 1e-9
    return False


class ScreenerRuleListCreateView(APIView):
    """
    GET  /api/portfolio/screener/rules/    — danh sách rule của user
    POST /api/portfolio/screener/rules/    — tạo rule mới
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        rules = ScreenerRule.objects.filter(user=request.user)
        return Response(ScreenerRuleSerializer(rules, many=True).data)

    def post(self, request):
        serializer = ScreenerRuleSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        ok, err = _validate_screener_rules(serializer.validated_data.get('rules_json', []))
        if not ok:
            return Response({'detail': err}, status=status.HTTP_400_BAD_REQUEST)
        rule = serializer.save(user=request.user)
        return Response(ScreenerRuleSerializer(rule).data, status=status.HTTP_201_CREATED)


class ScreenerRuleDetailView(APIView):
    """
    GET    /api/portfolio/screener/rules/{id}/
    PUT    /api/portfolio/screener/rules/{id}/
    DELETE /api/portfolio/screener/rules/{id}/
    """
    permission_classes = [IsAuthenticated]

    def _get_rule(self, request, rule_id):
        return generics.get_object_or_404(ScreenerRule, pk=rule_id, user=request.user)

    def get(self, request, rule_id):
        rule = self._get_rule(request, rule_id)
        return Response(ScreenerRuleSerializer(rule).data)

    def put(self, request, rule_id):
        rule = self._get_rule(request, rule_id)
        serializer = ScreenerRuleSerializer(rule, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        if 'rules_json' in serializer.validated_data:
            ok, err = _validate_screener_rules(serializer.validated_data['rules_json'])
            if not ok:
                return Response({'detail': err}, status=status.HTTP_400_BAD_REQUEST)
        rule = serializer.save()
        return Response(ScreenerRuleSerializer(rule).data)

    def delete(self, request, rule_id):
        rule = self._get_rule(request, rule_id)
        rule.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ScreenerRuleRunView(APIView):
    """
    POST /api/portfolio/screener/rules/{id}/run/

    Chạy screener rule trên toàn bộ DailyPrice hiện có.
    Trả về danh sách mã khớp kèm giá + technical snapshot.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, rule_id):
        rule = generics.get_object_or_404(ScreenerRule, pk=rule_id, user=request.user)
        conditions = rule.rules_json  # list[{field, op, value}]

        # Lấy danh sách symbol có dữ liệu giá gần nhất
        from django.db.models import Max
        latest_dates = (
            DailyPrice.objects
            .values('symbol')
            .annotate(latest=Max('date'))
        )
        symbol_date_map = {row['symbol']: row['latest'] for row in latest_dates}

        if not symbol_date_map:
            return Response({'matched': [], 'total_scanned': 0, 'rule_id': rule.id})

        # Batch load tất cả DailyPrice mới nhất (1 query)
        from django.db.models import Q
        filter_q = Q()
        for sym, dt in symbol_date_map.items():
            filter_q |= Q(symbol=sym, date=dt)

        # Nếu quá nhiều symbols, chunk để tránh quá large query
        all_symbols = list(symbol_date_map.keys())
        CHUNK = 500
        rows = []
        for i in range(0, len(all_symbols), CHUNK):
            chunk_syms = all_symbols[i:i + CHUNK]
            chunk_q = Q()
            for sym in chunk_syms:
                chunk_q |= Q(symbol=sym, date=symbol_date_map[sym])
            rows.extend(
                DailyPrice.objects.filter(chunk_q).values(
                    'symbol', 'close_price', 'volume', 'open_price', 'high_price', 'low_price', 'date'
                )
            )

        # Tính technical fields cần thiết (dùng _compute_rsi + SMA từ lịch sử gần đây)
        # Lấy 60 ngày gần nhất để tính SMA50 đủ điểm
        from datetime import timedelta
        required_fields = {cond['field'] for cond in conditions}
        needs_history = required_fields & {'rsi_14', 'sma20', 'sma50', 'momentum_20d_pct',
                                           'price_vs_sma20_pct', 'price_vs_sma50_pct',
                                           'range_position_pct', 'avg_volume_20',
                                           'macd_hist', 'volume_rvol', 'sma20_vs_sma50_pct'}

        history_map = {}  # symbol -> list of (close, volume) sorted by date asc
        if needs_history:
            from datetime import date as date_cls
            cutoff = date_cls.today() - timedelta(days=70)
            hist_qs = (
                DailyPrice.objects
                .filter(symbol__in=all_symbols, date__gte=cutoff)
                .values('symbol', 'date', 'close_price', 'volume', 'high_price', 'low_price')
                .order_by('symbol', 'date')
            )
            for row in hist_qs:
                sym = row['symbol']
                if sym not in history_map:
                    history_map[sym] = []
                history_map[sym].append(row)

        def _build_technical(sym, latest_row):
            hist = history_map.get(sym, [])
            closes = [float(r['close_price']) for r in hist if r['close_price'] is not None]
            volumes = [float(r['volume']) for r in hist if r['volume'] is not None]
            highs = [float(r['high_price']) for r in hist if r['high_price'] is not None]
            lows = [float(r['low_price']) for r in hist if r['low_price'] is not None]

            close = float(latest_row['close_price']) if latest_row['close_price'] else None

            sma20 = (sum(closes[-20:]) / 20) if len(closes) >= 20 else None
            sma50 = (sum(closes[-50:]) / 50) if len(closes) >= 50 else None
            rsi_14 = _safe_round(_compute_rsi(closes, 14))
            momentum_20d = _safe_round(
                ((closes[-1] / closes[-21] - 1) * 100) if len(closes) >= 21 else None
            )
            price_vs_sma20 = _safe_round(
                ((close / sma20 - 1) * 100) if close and sma20 else None
            )
            price_vs_sma50 = _safe_round(
                ((close / sma50 - 1) * 100) if close and sma50 else None
            )
            hi52 = max(highs[-52:]) if len(highs) >= 10 else None
            lo52 = min(lows[-52:]) if len(lows) >= 10 else None
            range_pos = _safe_round(
                ((close - lo52) / (hi52 - lo52) * 100) if close and hi52 and lo52 and (hi52 - lo52) > 0 else None
            )
            avg_vol20 = _safe_round(
                (sum(volumes[-20:]) / 20) if len(volumes) >= 20 else None
            )
            # MACD histogram (>0 = đà tăng, <0 = đà giảm)
            macd_hist = _safe_round(_compute_macd_hist(closes), 4)
            # Volume relative (current vol / avg_vol_20)
            cur_vol = float(latest_row['volume']) if latest_row.get('volume') else None
            volume_rvol = _safe_round(
                (cur_vol / (sum(volumes[-20:]) / 20)) if cur_vol and len(volumes) >= 20 else None
            )
            # SMA20 vs SMA50 (>0 = golden cross, <0 = death cross)
            sma20_vs_sma50_pct = _safe_round(
                ((sma20 / sma50 - 1) * 100) if sma20 and sma50 else None
            )

            return {
                'close': close,
                'volume': float(latest_row['volume']) if latest_row.get('volume') else None,
                'rsi_14': rsi_14,
                'sma20': _safe_round(sma20),
                'sma50': _safe_round(sma50),
                'momentum_20d_pct': momentum_20d,
                'price_vs_sma20_pct': price_vs_sma20,
                'price_vs_sma50_pct': price_vs_sma50,
                'range_position_pct': range_pos,
                'avg_volume_20': avg_vol20,
                'macd_hist': macd_hist,
                'volume_rvol': volume_rvol,
                'sma20_vs_sma50_pct': sma20_vs_sma50_pct,
            }

        matched = []
        total_scanned = len(rows)
        for row in rows:
            sym = row['symbol']
            tech = _build_technical(sym, row)
            # Áp dụng tất cả conditions (AND logic)
            if all(_apply_screener_condition(tech.get(c['field']), c['op'], c['value']) for c in conditions):
                matched.append({
                    'symbol': sym,
                    'date': str(row['date']),
                    **tech,
                })

        matched.sort(key=lambda x: x.get('close') or 0, reverse=True)

        return Response({
            'rule_id': rule.id,
            'rule_name': rule.name,
            'total_scanned': total_scanned,
            'matched_count': len(matched),
            'matched': matched,
        })

