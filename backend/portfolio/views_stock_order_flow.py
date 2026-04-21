from datetime import datetime, timedelta
import base64
import logging

from django.db.models import Count, ExpressionWrapper, F, FloatField, Q, Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import IntradayTick, OrderFlowSignal, TrackedSymbol
from .opencore_analytics import track_api_call
from .opencore_dpi import check_feature_access
from .permissions import IsProPlan, resolve_user_entitlements
from .quota_service import build_quota_exceeded_payload, consume_quota
from .services import WhaleSignalEngine
from portfolio.order_flow import compute_cvd_series, detect_dark_flow

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsProPlan])
def whale_advisory_symbol_stats_api(request):
    """
    GET /api/portfolio/whale-advisory-symbol-stats/
    Thong ke BUY/SELL whale theo cung nguon IntradayTick nhu Whale Alerts,
    giup dong nhat so lieu hien thi giua Whale Alerts va Whale Advisory.
    """
    symbols_param = str(request.query_params.get('symbols') or '').strip()
    window = str(request.query_params.get('window') or 'session').strip().lower() or 'session'

    if symbols_param:
        symbols = [s.strip().upper() for s in symbols_param.split(',') if s.strip()]
    else:
        symbols = list(
            TrackedSymbol.objects.filter(user=request.user).values_list('symbol', flat=True)
        )
    symbols = list(dict.fromkeys(symbols))

    if not symbols:
        return Response(
            {
                'ok': True,
                'stats': [],
                'window': window,
                'source': 'intraday_tick_db',
            },
            status=status.HTTP_200_OK,
        )

    today_local = timezone.localdate()
    queryset = IntradayTick.objects.filter(symbol__in=symbols).annotate(
        matched_value=ExpressionWrapper(F('price') * F('volume'), output_field=FloatField())
    )

    if window == '5d':
        queryset = queryset.filter(trade_date__gte=today_local - timedelta(days=4))
    else:
        queryset = queryset.filter(trade_date=today_local)

    queryset = WhaleSignalEngine.annotate_queryset_with_threshold(queryset, request.user, symbols)

    aggregated_rows = (
        queryset
        .filter(matched_value__gte=F('threshold_vnd'))
        .values('symbol')
        .annotate(
            buy_count=Count('pk', filter=Q(side__iexact='BUY')),
            sell_count=Count('pk', filter=Q(side__iexact='SELL')),
            total_value=Sum('matched_value'),
            total_volume=Sum('volume'),
        )
    )

    stats_list = []
    # Get latest advisory for these symbols to enrich with discovery info
    advisories = {
        adv.symbol: adv for adv in WhaleAdvisory.objects.filter(symbol__in=symbols).order_by('symbol', '-created_at').distinct('symbol')
    }

    for row in aggregated_rows:
        symbol = row.get('symbol')
        buy_count = int(row.get('buy_count') or 0)
        sell_count = int(row.get('sell_count') or 0)
        total_count = buy_count + sell_count
        if total_count <= 0:
            continue

        total_value = float(row.get('total_value') or 0.0)
        total_volume = int(row.get('total_volume') or 0)
        avg_order_value = total_value / total_count

        adv = advisories.get(symbol)

        stats_list.append(
            {
                'symbol': symbol,
                'buyCount': buy_count,
                'sellCount': sell_count,
                'totalValue': total_value,
                'totalVolume': total_volume,
                'count': total_count,
                'avgOrderValue': avg_order_value,
                'isDiscovery': adv.is_discovery if adv else False,
                'whaleIntensity': adv.whale_intensity if adv else 0,
                'discoveryBucket': adv.discovery_bucket if adv else 'standard',
            }
        )

    stats_list.sort(key=lambda item: item['totalValue'], reverse=True)
    return Response(
        {
            'ok': True,
            'stats': stats_list,
            'window': window,
            'source': 'intraday_tick_db',
            'symbols_count': len(symbols),
            'stats_count': len(stats_list),
        },
        status=status.HTTP_200_OK,
    )


_OPENCORE_STOCK_FEATURE_KEYS = {
    'stock_order_flow_api': 'dark_pool_flow',
    'whale_advisory_symbol_stats_api': 'dark_pool_flow',
    'market_discovery_hub_api': 'dark_pool_flow',
    'stock_ai_advisory_session_api': 'whale_momentum',
    'stock_ai_advisory_components_generate_api': 'sentiment_score',
    'stock_ai_advisory_component_refresh_api': 'sentiment_score',
    'stock_ai_advisory_summary_regenerate_api': 'sentiment_score',
    'stock_ai_advisory_component_toggle_include_api': 'sentiment_score',
    'stock_ai_advisory_component_delete_api': 'sentiment_score',
    'stock_ai_advisory_component_clear_deleted_api': 'sentiment_score',
    'stock_ai_advisory_component_restore_api': 'sentiment_score',
    'stock_ai_advisory_summary_delete_api': 'sentiment_score',
}

_OPENCORE_STOCK_ENDPOINT_QUOTA_KEYS = {
    'whale_advisory_symbol_stats_api': {
        'GET': 'api_calls_per_day',
    },
    'market_discovery_hub_api': {
        'GET': 'api_calls_per_day',
    },
    'stock_order_flow_api': {
        'GET': 'api_calls_per_day',
        'POST': 'api_calls_per_day',
    },
    'stock_ai_advisory_session_api': {
        'POST': 'ai_regenerate_per_day',
    },
    'stock_ai_advisory_components_generate_api': {
        'POST': 'ai_regenerate_per_day',
    },
    'stock_ai_advisory_component_refresh_api': {
        'POST': 'ai_regenerate_per_day',
    },
    'stock_ai_advisory_summary_regenerate_api': {
        'POST': 'ai_regenerate_per_day',
    },
    'stock_ai_advisory_component_toggle_include_api': {
        'POST': 'api_calls_per_day',
    },
    'stock_ai_advisory_component_delete_api': {
        'DELETE': 'api_calls_per_day',
    },
    'stock_ai_advisory_component_clear_deleted_api': {
        'DELETE': 'api_calls_per_day',
    },
    'stock_ai_advisory_component_restore_api': {
        'POST': 'api_calls_per_day',
    },
    'stock_ai_advisory_summary_delete_api': {
        'DELETE': 'api_calls_per_day',
    },
}


def _enforce_opencore_feature_for_stock_endpoint(request, endpoint_name: str):
    """
    Sprint26 Day 2 feature gate for stock workspace endpoints.

    Transitional behavior:
    - Legacy users chua co DPI license tam thoi duoc cho phep di qua
      de tranh hard-break truoc khi backfill license toan he thong.
    """
    feature_key = _OPENCORE_STOCK_FEATURE_KEYS.get(endpoint_name)
    if not feature_key:
        return None

    try:
        request.user.dpi_license
    except Exception:
        return None

    can_access, reason = check_feature_access(request.user, feature_key)
    if can_access:
        return None

    _track_opencore_stock_endpoint_usage(
        request,
        endpoint_name,
        status.HTTP_403_FORBIDDEN,
    )

    return Response(
        {
            'ok': False,
            'code': 'feature_locked',
            'feature_key': feature_key,
            'message': 'Tinh nang nay yeu cau goi cao hon hoac license hop le.',
            'reason': reason,
        },
        status=status.HTTP_403_FORBIDDEN,
    )


def _enforce_opencore_quota_for_stock_endpoint(request, endpoint_name: str):
    quota_key = (_OPENCORE_STOCK_ENDPOINT_QUOTA_KEYS.get(endpoint_name) or {}).get(request.method.upper())
    if not quota_key:
        return None

    entitlements = resolve_user_entitlements(request.user)
    quota_result = consume_quota(
        request.user,
        quota_key=quota_key,
        entitlements=entitlements,
    )
    if quota_result.get('allowed', True):
        return None

    _track_opencore_stock_endpoint_usage(
        request,
        endpoint_name,
        status.HTTP_429_TOO_MANY_REQUESTS,
    )

    quota_messages = {
        'api_calls_per_day': 'Ban da dung het quota API trong ngay.',
        'ai_regenerate_per_day': 'Ban da dung het quota refresh AI trong ngay.',
    }
    return Response(
        build_quota_exceeded_payload(
            quota_result,
            quota_messages.get(quota_key, 'Ban da dung het quota trong ngay.'),
        ),
        status=status.HTTP_429_TOO_MANY_REQUESTS,
    )


def _track_opencore_stock_endpoint_usage(request, endpoint_name: str, response_status_code: int):
    feature_key = _OPENCORE_STOCK_FEATURE_KEYS.get(endpoint_name, '')
    try:
        from . import views as legacy_views

        tracker = getattr(legacy_views, 'track_api_call', track_api_call)
        tracker(
            user=request.user,
            endpoint=request.path,
            method=request.method,
            status_code=int(response_status_code),
            feature=feature_key,
            api_weight=1,
        )
    except Exception as exc:
        logger.debug('OpenCore stock endpoint usage tracking failed for %s: %s', endpoint_name, exc)


def _timeframe_to_minutes(timeframe: str) -> int:
    """
    F2 Helper: Convert timeframe string (30m, 1h, 4h, 1d) to minutes
    for detect_dark_flow window_minutes parameter.
    Defaults to 30 minutes if format unrecognized.
    """
    timeframe_lower = str(timeframe or '').strip().lower()

    if timeframe_lower.endswith('m'):
        try:
            return max(int(timeframe_lower.rstrip('m')), 1)
        except (ValueError, TypeError):
            return 30
    if timeframe_lower.endswith('h'):
        try:
            hours = int(timeframe_lower.rstrip('h'))
            return max(hours * 60, 1)
        except (ValueError, TypeError):
            return 30
    if timeframe_lower.endswith('d'):
        try:
            days = int(timeframe_lower.rstrip('d'))
            return max(days * 24 * 60, 1)
        except (ValueError, TypeError):
            return 30

    return 30



@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def stock_order_flow_api(request, symbol: str):
    """
    GET /api/stock-management/stocks/<symbol>/order-flow/
    Tra summary order flow cho stock detail page.
    Query params:
      - window: 5m | 15m | 30m (default) | 1h.
    """
    denied_response = _enforce_opencore_feature_for_stock_endpoint(request, 'stock_order_flow_api')
    if denied_response is not None:
        return denied_response

    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return Response({'ok': False, 'message': 'Symbol khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    quota_response = _enforce_opencore_quota_for_stock_endpoint(request, 'stock_order_flow_api')
    if quota_response is not None:
        return quota_response

    window_map = {'5m': 5, '15m': 15, '30m': 30, '1h': 60}
    window_param = str(request.query_params.get('window', '30m')).strip().lower()
    window_minutes = window_map.get(window_param, 30)

    dark_flow = detect_dark_flow(normalized_symbol, window_minutes=window_minutes)
    cvd_series = compute_cvd_series(normalized_symbol, window_minutes=window_minutes, bucket_seconds=60)

    try:
        offset = int(request.query_params.get('offset', 0) or 0)
    except (TypeError, ValueError):
        offset = 0
    offset = max(0, min(offset, 10000))

    try:
        limit = int(request.query_params.get('limit', 8) or 8)
    except (TypeError, ValueError):
        limit = 8
    limit = max(1, min(limit, 50))

    cursor = str(request.query_params.get('cursor', '')).strip()
    cursor_timestamp = None
    cursor_id = None
    if cursor:
        try:
            decoded = base64.b64decode(cursor).decode('utf-8')
            cursor_timestamp, cursor_id_raw = decoded.rsplit(':', 1)
            cursor_id = int(cursor_id_raw)
        except Exception:
            pass

    queryset = OrderFlowSignal.objects.filter(symbol=normalized_symbol).order_by('-created_at', '-id')

    if cursor_timestamp and cursor_id is not None:
        try:
            cursor_dt = datetime.fromisoformat(cursor_timestamp.replace('Z', '+00:00'))
            queryset = queryset.filter(
                Q(created_at__lt=cursor_dt) |
                Q(created_at=cursor_dt, id__lt=cursor_id)
            )
        except Exception:
            pass

    total_count = queryset.count()
    signals_with_extra = list(queryset[offset:offset + limit + 1].values(
        'id', 'symbol', 'signal_type', 'strength', 'confidence', 'tick_rate',
        'small_order_ratio', 'cvd_at_signal', 'price_at_signal', 'created_at',
        'event_id', 'severity'
    ))

    has_more = len(signals_with_extra) > limit
    recent_signals = signals_with_extra[:limit]

    next_cursor = None
    if has_more and recent_signals:
        last_signal = recent_signals[-1]
        cursor_payload = f"{last_signal['created_at'].isoformat()}:{last_signal['id']}"
        next_cursor = base64.b64encode(cursor_payload.encode('utf-8')).decode('utf-8')

    latest_signal = recent_signals[0] if recent_signals else None

    _track_opencore_stock_endpoint_usage(request, 'stock_order_flow_api', status.HTTP_200_OK)
    return Response(
        {
            'ok': True,
            'symbol': normalized_symbol,
            'window': window_param,
            'window_minutes': window_minutes,
            'latest_signal': latest_signal,
            'signals': recent_signals,
            'cvd_series': cvd_series,
            'dark_flow': dark_flow,
            'tick_rate': (dark_flow.get('components') or {}).get('tick_rate') or {},
            'size_distribution': (dark_flow.get('components') or {}).get('size_distribution') or {},
            'pagination': {
                'offset': offset,
                'limit': limit,
                'total_count': total_count,
                'has_more': has_more,
                'next_cursor': next_cursor,
            }
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def market_discovery_hub_api(request):
    """
    GET /api/portfolio/market-discovery-hub/
    Tra ve danh sach cac ma co tin hieu Whale Discovery, duoc phan loai vao 
    cac bucket: 'anomaly', 'potential', 'standard'.
    """
    denied_response = _enforce_opencore_feature_for_stock_endpoint(request, 'market_discovery_hub_api')
    if denied_response is not None:
        return denied_response

    quota_response = _enforce_opencore_quota_for_stock_endpoint(request, 'market_discovery_hub_api')
    if quota_response is not None:
        return quota_response

    # Lay top 30 signals discovery moi nhat trong 24h qua
    one_day_ago = timezone.now() - timedelta(days=1)
    queryset = WhaleAdvisory.objects.filter(
        is_discovery=True,
        created_at__gte=one_day_ago
    ).select_related('user').order_by('-whale_intensity', '-created_at')[:30]

    discovery_list = []
    for adv in queryset:
        discovery_list.append({
            'id': adv.id,
            'symbol': adv.symbol,
            'side': adv.side,
            'intensity': adv.whale_intensity,
            'bucket': adv.discovery_bucket,
            'matched_value': adv.matched_value,
            'severity': adv.severity,
            'summary': adv.ai_summary,
            'created_at': adv.created_at,
            'is_new_to_market': adv.discovery_bucket != 'standard',
        })

    # Group by bucket for Bento Grid rendering
    buckets = {
        'anomaly': [d for d in discovery_list if d['bucket'] == 'anomaly'],
        'potential': [d for d in discovery_list if d['bucket'] == 'potential'],
        'standard': [d for d in discovery_list if d['bucket'] == 'standard'],
    }

    _track_opencore_stock_endpoint_usage(request, 'market_discovery_hub_api', status.HTTP_200_OK)
    return Response({
        'ok': True,
        'discovery_signals': discovery_list,
        'buckets': buckets,
        'timestamp': timezone.now(),
    }, status=status.HTTP_200_OK)
