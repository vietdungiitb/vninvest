import redis as redis_lib

from django.contrib.auth.models import User
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import generics, status
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .exceptions import ExternalSystemException, MarketDataValidationException
from .market_data_service import market_data_service
from .models import DailyPrice, MarketGroupSyncLog, Portfolio, StockProfile, StockProfileSyncLog, TrackedSymbol, WatchlistItem
from .serializers import StockProfileSerializer, StockWorkspaceOverviewSerializer


def _legacy_views_module():
    # Keep dynamic binding to portfolio.views so existing tests that patch
    # portfolio.views symbols continue to work during migration.
    from . import views as legacy_views

    return legacy_views


@method_decorator(csrf_exempt, name='dispatch')
class StockWorkspaceOverviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, symbol):
        legacy_views = _legacy_views_module()

        normalized_symbol = (symbol or '').strip().upper()
        if not normalized_symbol:
            return Response({'detail': 'Thiếu mã chứng khoán.'}, status=status.HTTP_400_BAD_REQUEST)

        profile = StockProfile.objects.filter(symbol=normalized_symbol).first()
        if not profile:
            return Response({'detail': 'Không tìm thấy mã chứng khoán.'}, status=status.HTTP_404_NOT_FOUND)

        cache_key = f'overview:{normalized_symbol}'
        cached = legacy_views._cache_get(cache_key)
        if cached is not None:
            return Response(cached)

        try:
            payload = legacy_views._build_stock_workspace_overview(symbol, request.user)
        except Exception as exc:
            legacy_views.logger.exception('StockWorkspaceOverviewView base payload lỗi %s: %s', normalized_symbol, exc)
            payload = {
                'tracked_symbol_id': None,
                'symbol': profile.symbol,
                'company_name': profile.company_name or '',
                'industry': profile.industry or '',
                'exchange': profile.exchange or '',
                'listed_date': profile.listed_date,
                'is_active': profile.is_active,
                'updated_at': profile.updated_at,
                'current_price': None,
                'prev_price': None,
                'change_value': None,
                'change_pct': None,
                'last_date': None,
                'open_price': None,
                'high_price': None,
                'low_price': None,
                'close_price': None,
                'volume': None,
                'average_price': None,
                'reference_price': None,
                'ceiling_price': None,
                'floor_price': None,
                'week52_high': None,
                'week52_low': None,
                'is_tracked': False,
                'source_group_name': None,
                'market_groups': [],
                'watchlist_groups': [],
                'market_group_refs': [],
                'watchlist_memberships': [],
            }

        try:
            df = legacy_views.fetch_price_board_dataframe([normalized_symbol], anchor_symbol=normalized_symbol)
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

                if match_price and ref_price:
                    chg_val = round(match_price - ref_price, 2)
                    chg_pct = round((match_price - ref_price) / ref_price * 100, 2)
                    payload['change_value'] = chg_val
                    payload['change_pct'] = chg_pct

                prices = [v for v in [open_price, highest, lowest, match_price] if v]
                if len(prices) >= 2:
                    payload['average_price'] = round(sum(prices) / len(prices), 2)

        except ExternalSystemException as exc:
            legacy_views.logger.warning('StockWorkspaceOverviewView vnstock overlay lỗi %s: %s', normalized_symbol, exc)
        except Exception as exc:
            legacy_views.logger.debug('StockWorkspaceOverviewView overlay parse lỗi %s: %s', normalized_symbol, exc)

        try:
            from datetime import date as _date, timedelta as _timedelta

            _end = _date.today().strftime('%Y-%m-%d')
            _start = (_date.today() - _timedelta(days=365)).strftime('%Y-%m-%d')
            hist_df = legacy_views.fetch_history_dataframe(
                normalized_symbol,
                start=_start,
                end=_end,
                interval='1D',
            )
            if hist_df is not None and not hist_df.empty and 'high' in hist_df.columns:
                w52_high = round(float(hist_df['high'].max()), 2)
                w52_low = round(float(hist_df['low'].min()), 2)
                if w52_high > 0:
                    payload['week52_high'] = w52_high
                if w52_low > 0:
                    payload['week52_low'] = w52_low
        except ExternalSystemException as exc:
            legacy_views.logger.debug('StockWorkspaceOverviewView 52W overlay lỗi %s: %s', normalized_symbol, exc)
        except Exception as exc:
            legacy_views.logger.debug('StockWorkspaceOverviewView 52W parse lỗi %s: %s', normalized_symbol, exc)

        if not payload.get('company_name'):
            try:
                ls_df = legacy_views.fetch_listing_symbols_dataframe(symbol=normalized_symbol, source='VCI')
                if ls_df is not None and not ls_df.empty:
                    row = ls_df[ls_df['symbol'] == normalized_symbol]
                    if not row.empty:
                        name = str(row.iloc[0].get('organ_name') or '').strip()
                        if name:
                            payload['company_name'] = name
            except ExternalSystemException as exc:
                legacy_views.logger.debug('StockWorkspaceOverviewView listing overlay lỗi %s: %s', normalized_symbol, exc)
            except Exception as exc:
                legacy_views.logger.debug('StockWorkspaceOverviewView listing parse lỗi %s: %s', normalized_symbol, exc)

        serialized = StockWorkspaceOverviewSerializer(payload).data
        legacy_views._cache_set(cache_key, serialized, timeout=12)
        return Response(serialized)


@method_decorator(csrf_exempt, name='dispatch')
class StockWorkspaceChartView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'realtime_chart'

    def get(self, request, symbol):
        legacy_views = _legacy_views_module()
        normalized_symbol = (symbol or '').strip().upper()
        timeframe = request.query_params.get('timeframe')
        try:
            if timeframe:
                payload = market_data_service.get_stock_workspace_chart(
                    request.user,
                    normalized_symbol,
                    request.query_params.get('days', 180),
                    timeframe,
                )
            else:
                payload = market_data_service.get_stock_workspace_chart(
                    request.user,
                    normalized_symbol,
                    request.query_params.get('days', 180),
                )
        except MarketDataValidationException as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            legacy_views.logger.warning('StockWorkspaceChartView legacy bridge lỗi %s: %s', normalized_symbol, exc)

            # Safe fallback: build chart payload directly from DailyPrice
            # so UI still receives a deterministic response shape.
            try:
                try:
                    days = int(request.query_params.get('days', 180))
                except (TypeError, ValueError):
                    days = 180
                days = min(max(days, 7), 1825)

                rows_desc = list(
                    DailyPrice.objects
                    .filter(symbol=normalized_symbol)
                    .order_by('-date')
                    .values('date', 'open_price', 'high_price', 'low_price', 'close_price', 'volume')[:days]
                )
                if not rows_desc:
                    return Response({'detail': 'Không thể tải dữ liệu biểu đồ.'}, status=status.HTTP_502_BAD_GATEWAY)

                rows = list(reversed(rows_desc))

                points = [
                    {
                        'date': row['date'].isoformat() if row.get('date') else None,
                        'open': float(row['open_price']) if row.get('open_price') is not None else None,
                        'high': float(row['high_price']) if row.get('high_price') is not None else None,
                        'low': float(row['low_price']) if row.get('low_price') is not None else None,
                        'close': float(row['close_price']) if row.get('close_price') is not None else None,
                        'volume': float(row['volume']) if row.get('volume') is not None else None,
                    }
                    for row in rows
                ]

                technical = legacy_views._compute_stock_workspace_technical(
                    rows,
                    {
                        'week52_low': min(float(r['low_price']) for r in rows if r.get('low_price') is not None),
                        'week52_high': max(float(r['high_price']) for r in rows if r.get('high_price') is not None),
                    },
                )

                return Response(
                    {
                        'symbol': normalized_symbol,
                        'days': days,
                        'points': points,
                        'technical': technical,
                    },
                    status=status.HTTP_200_OK,
                )
            except Exception as fallback_exc:
                legacy_views.logger.warning('StockWorkspaceChartView fallback lỗi %s: %s', normalized_symbol, fallback_exc)
                return Response({'detail': 'Không thể tải dữ liệu biểu đồ.'}, status=status.HTTP_502_BAD_GATEWAY)

        return Response(payload)


class StockProfileDetailView(generics.RetrieveAPIView):
    queryset = StockProfile.objects.all()
    serializer_class = StockProfileSerializer
    lookup_field = 'symbol'
    permission_classes = []


class AdminOpsStatsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        from django.conf import settings
        from config.health import build_prefetch_health_snapshot
        from portfolio.services import (
            get_latest_whale_config_anomaly_overview,
            get_whale_config_dashboard_overview,
            get_whale_config_propagation_overview,
        )

        user_count = User.objects.count()
        portfolio_count = Portfolio.objects.count()
        tracked_symbol_count = TrackedSymbol.objects.count()
        watchlist_item_count = WatchlistItem.objects.count()

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

        return Response(
            {
                'user_count': user_count,
                'portfolio_count': portfolio_count,
                'tracked_symbol_count': tracked_symbol_count,
                'watchlist_item_count': watchlist_item_count,
                'last_market_group_sync': _fmt_sync(last_mg_sync),
                'last_stock_profile_sync': _fmt_sync(last_sp_sync),
                'channel_layer_type': channel_layer_type,
                'realtime_enabled': realtime_enabled,
                'redis_ok': redis_ok,
                'ticker_prefetch': build_prefetch_health_snapshot(),
                'whale_config_propagation': get_whale_config_propagation_overview(),
                'whale_config_anomaly': get_latest_whale_config_anomaly_overview(),
                'whale_config_dashboard': get_whale_config_dashboard_overview(),
            }
        )
