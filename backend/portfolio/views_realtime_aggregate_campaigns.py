import logging
from datetime import datetime, timedelta

from django.db.models import ExpressionWrapper, F, FloatField, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .exceptions import ExternalSystemException, MarketDataValidationException
from .models import IntradayTick
from .whale_scoring import resolve_whale_score_config

logger = logging.getLogger(__name__)


def _legacy_views_module():
    from . import views as legacy_views

    return legacy_views


class WhaleFeedAggregateView(APIView):
    """
    GET /api/realtime/whale-feed/aggregate/
    Aggregate whale events với pipeline ưu tiên Redis stream -> IntradayTick DB -> vnstock.
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'realtime_whale_aggregate'

    def get(self, request):
        legacy_views = _legacy_views_module()

        threshold_vnd = legacy_views._get_user_whale_threshold_vnd(request.user)
        entitlements = legacy_views.resolve_user_entitlements(request.user)
        api_quota = legacy_views.consume_quota(
            request.user,
            quota_key='api_calls_per_day',
            entitlements=entitlements,
        )
        if not api_quota.get('allowed', True):
            return Response(
                legacy_views.build_quota_exceeded_payload(api_quota, 'Ban da dung het quota API trong ngay.'),
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        symbols, scope, watchlist_group_ids, scope_source = legacy_views._resolve_whale_feed_symbols(request)
        symbol_threshold_overrides = legacy_views._get_user_symbol_threshold_overrides_vnd(request.user, symbols)

        def _resolve_threshold_for_symbol(resolved_symbol: str) -> float:
            return symbol_threshold_overrides.get(str(resolved_symbol or '').strip().upper(), threshold_vnd)

        def _resolve_threshold_source_for_symbol(resolved_symbol: str) -> str:
            normalized_symbol = str(resolved_symbol or '').strip().upper()
            if normalized_symbol and normalized_symbol in symbol_threshold_overrides:
                return 'symbol_override'
            return 'user_default'

        min_threshold_vnd = min([_resolve_threshold_for_symbol(symbol) for symbol in symbols], default=threshold_vnd)
        score_config = resolve_whale_score_config()
        request_now = timezone.now()

        limit_raw = request.query_params.get('limit', 20)
        try:
            limit = int(limit_raw)
        except (TypeError, ValueError):
            return Response({'detail': 'limit phải là số nguyên trong khoảng [1, 50].'}, status=status.HTTP_400_BAD_REQUEST)
        if limit < 1 or limit > 50:
            return Response({'detail': 'limit phải là số nguyên trong khoảng [1, 50].'}, status=status.HTTP_400_BAD_REQUEST)

        sort = str(request.query_params.get('sort', 'ts')).strip().lower()
        if sort not in ('ts', 'matched_value'):
            return Response({'detail': "sort không hợp lệ. Chỉ hỗ trợ: 'ts' hoặc 'matched_value'."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            window = legacy_views._parse_aggregate_window(request.query_params.get('window', 'session'))
        except ValueError:
            return Response({'detail': "window không hợp lệ. Chỉ hỗ trợ: '5m', '15m', '1h', 'session', '5d'."}, status=status.HTTP_400_BAD_REQUEST)

        cursor_payload = legacy_views._decode_whale_feed_cursor(request.query_params.get('cursor'))
        if request.query_params.get('cursor') and cursor_payload is None:
            return Response({'detail': 'cursor không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)
        if cursor_payload is not None:
            cursor_sort = str(cursor_payload.get('sort', '')).strip().lower()
            if cursor_sort and cursor_sort != sort:
                return Response({'detail': 'cursor không hợp lệ cho sort hiện tại.'}, status=status.HTTP_400_BAD_REQUEST)
            cursor_window = str(cursor_payload.get('window', 'session')).strip().lower() or 'session'
            if cursor_window != window:
                return Response({'detail': 'cursor không hợp lệ cho window hiện tại.'}, status=status.HTTP_400_BAD_REQUEST)

        if not symbols:
            if cursor_payload is not None:
                return Response({'detail': 'cursor không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)
            return Response(
                {
                    'results': [],
                    'next_cursor': None,
                    'has_more': False,
                    'server_time': timezone.now().isoformat(),
                    'source': 'intraday_tick_db',
                    'filters': {
                        'scope': scope,
                        'scope_source': scope_source,
                        'symbols': [],
                        'watchlist_group_ids': watchlist_group_ids,
                        'sort': sort,
                        'window': window,
                        'limit': limit,
                        'threshold': threshold_vnd,
                    },
                    'meta': {
                        'contract_version': '1.1',
                        'pagination': {
                            'sort': sort,
                            'limit': limit,
                            'has_more': False,
                            'next_cursor': None,
                        },
                        'scope': {
                            'value': scope,
                            'source': scope_source,
                        },
                    },
                    'entitlements': entitlements,
                    'weights_version': score_config['version'],
                }
            )

        stream_records = legacy_views._build_stream_aggregate_records(symbols, min_threshold_vnd)
        if stream_records:
            stream_records = [
                row
                for row in stream_records
                if (
                    float(row.get('matched_value') or 0.0) >= _resolve_threshold_for_symbol(row.get('symbol'))
                    and legacy_views._is_event_timestamp_in_window(row.get('ts'), window, now=request_now)
                )
            ]
        if stream_records:
            normalized_records, ok = legacy_views._normalize_aggregate_event_records(stream_records, sort=sort, cursor_payload=cursor_payload)
            if not ok:
                return Response({'detail': 'cursor không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

            has_more = len(normalized_records) > limit
            page_rows = normalized_records[:limit]
            next_cursor = None
            if has_more and page_rows:
                last_row = page_rows[-1]
                if sort == 'matched_value':
                    next_cursor = legacy_views._encode_whale_feed_cursor(
                        {
                            'sort': sort,
                            'window': window,
                            'matched_value': float(last_row['matched_value']),
                            'id': int(last_row['id']),
                        }
                    )
                else:
                    last_dt = datetime.fromisoformat(str(last_row['ts']).replace('Z', '+00:00'))
                    next_cursor = legacy_views._encode_whale_feed_cursor(
                        {
                            'sort': sort,
                            'window': window,
                            'trade_date': last_dt.date().isoformat(),
                            'trade_time': last_dt.time().isoformat(),
                            'id': int(last_row['id']),
                        }
                    )

            results = [
                legacy_views._build_aggregate_event_payload_from_record(
                    row,
                    _resolve_threshold_for_symbol(row.get('symbol')),
                    threshold_source=_resolve_threshold_source_for_symbol(row.get('symbol')),
                    score_config=score_config,
                    now=request_now,
                )
                for row in page_rows
            ]
            return Response(
                {
                    'results': results,
                    'next_cursor': next_cursor,
                    'has_more': has_more,
                    'server_time': timezone.now().isoformat(),
                    'source': 'redis_stream',
                    'weights_version': score_config['version'],
                    'filters': {
                        'scope': scope,
                        'scope_source': scope_source,
                        'symbols': symbols,
                        'watchlist_group_ids': watchlist_group_ids,
                        'sort': sort,
                        'window': window,
                        'limit': limit,
                        'threshold': threshold_vnd,
                    },
                    'meta': {
                        'contract_version': '1.1',
                        'pagination': {
                            'sort': sort,
                            'limit': limit,
                            'has_more': has_more,
                            'next_cursor': next_cursor,
                        },
                        'scope': {
                            'value': scope,
                            'source': scope_source,
                        },
                    },
                    'entitlements': entitlements,
                }
            )

        queryset = (
            IntradayTick.objects.filter(symbol__in=symbols)
            .annotate(matched_value=ExpressionWrapper(F('price') * F('volume'), output_field=FloatField()))
            .filter(matched_value__gte=min_threshold_vnd)
        )

        today_local = timezone.localdate()
        if window == 'session':
            queryset = queryset.filter(trade_date=today_local)
        elif window == '5d':
            queryset = queryset.filter(trade_date__gte=today_local - timedelta(days=4))
        else:
            queryset = queryset.filter(trade_date=today_local)

        if sort == 'matched_value':
            if cursor_payload is not None:
                parsed_cursor = legacy_views._parse_cursor_matched_value(cursor_payload)
                if parsed_cursor is None:
                    return Response({'detail': 'cursor không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)
                cursor_value, cursor_id = parsed_cursor
                queryset = queryset.filter(Q(matched_value__lt=cursor_value) | Q(matched_value=cursor_value, id__lt=cursor_id))
            queryset = queryset.order_by('-matched_value', '-id')
        else:
            if cursor_payload is not None:
                parsed_cursor = legacy_views._parse_cursor_datetime(cursor_payload)
                if parsed_cursor is None:
                    return Response({'detail': 'cursor không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)
                cursor_date, cursor_time, cursor_id = parsed_cursor
                queryset = queryset.filter(
                    Q(trade_date__lt=cursor_date)
                    | Q(trade_date=cursor_date, trade_time__lt=cursor_time)
                    | Q(trade_date=cursor_date, trade_time=cursor_time, id__lt=cursor_id)
                )
            queryset = queryset.order_by('-trade_date', '-trade_time', '-id')

        rows = [
            row
            for row in queryset
            if (
                float(getattr(row, 'matched_value', 0) or 0.0) >= _resolve_threshold_for_symbol(getattr(row, 'symbol', ''))
                and legacy_views._is_tick_row_in_window(row, window, now=request_now)
            )
        ]
        has_more = len(rows) > limit
        page_rows = rows[:limit]

        if not page_rows:
            try:
                vnstock_records = legacy_views._build_vnstock_aggregate_records(symbols, min_threshold_vnd)
            except ExternalSystemException:
                vnstock_records = []
            except Exception as exc:
                if legacy_views._is_rate_limited_error(exc):
                    legacy_views._mark_vnstock_rate_limited('intraday', exc)
                    logger.info('Aggregate whale vnstock generic rate-limited; fallback to empty records.')
                else:
                    logger.warning('Aggregate whale vnstock unexpected fallback error: %s', exc)
                vnstock_records = []
            if vnstock_records:
                vnstock_records = [
                    row
                    for row in vnstock_records
                    if (
                        float(row.get('matched_value') or 0.0) >= _resolve_threshold_for_symbol(row.get('symbol'))
                        and legacy_views._is_event_timestamp_in_window(row.get('ts'), window, now=request_now)
                    )
                ]
            normalized_records, ok = legacy_views._normalize_aggregate_event_records(vnstock_records, sort=sort, cursor_payload=cursor_payload)
            if not ok:
                return Response({'detail': 'cursor không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

            has_more = len(normalized_records) > limit
            page_rows = normalized_records[:limit]
            next_cursor = None
            if has_more and page_rows:
                last_row = page_rows[-1]
                if sort == 'matched_value':
                    next_cursor = legacy_views._encode_whale_feed_cursor(
                        {
                            'sort': sort,
                            'window': window,
                            'matched_value': float(last_row['matched_value']),
                            'id': int(last_row['id']),
                        }
                    )
                else:
                    last_dt = datetime.fromisoformat(str(last_row['ts']).replace('Z', '+00:00'))
                    next_cursor = legacy_views._encode_whale_feed_cursor(
                        {
                            'sort': sort,
                            'window': window,
                            'trade_date': last_dt.date().isoformat(),
                            'trade_time': last_dt.time().isoformat(),
                            'id': int(last_row['id']),
                        }
                    )

            results = [
                legacy_views._build_aggregate_event_payload_from_record(
                    row,
                    _resolve_threshold_for_symbol(row.get('symbol')),
                    threshold_source=_resolve_threshold_source_for_symbol(row.get('symbol')),
                    score_config=score_config,
                    now=request_now,
                )
                for row in page_rows
            ]
            return Response(
                {
                    'results': results,
                    'next_cursor': next_cursor,
                    'has_more': has_more,
                    'server_time': timezone.now().isoformat(),
                    'source': 'vnstock' if page_rows else 'intraday_tick_db',
                    'weights_version': score_config['version'],
                    'filters': {
                        'scope': scope,
                        'scope_source': scope_source,
                        'symbols': symbols,
                        'watchlist_group_ids': watchlist_group_ids,
                        'sort': sort,
                        'window': window,
                        'limit': limit,
                        'threshold': threshold_vnd,
                    },
                    'meta': {
                        'contract_version': '1.1',
                        'pagination': {
                            'sort': sort,
                            'limit': limit,
                            'has_more': has_more,
                            'next_cursor': next_cursor,
                        },
                        'scope': {
                            'value': scope,
                            'source': scope_source,
                        },
                    },
                    'entitlements': entitlements,
                }
            )

        next_cursor = None
        if has_more and page_rows:
            last_row = page_rows[-1]
            if sort == 'matched_value':
                next_cursor = legacy_views._encode_whale_feed_cursor(
                    {
                        'sort': sort,
                        'window': window,
                        'matched_value': float(getattr(last_row, 'matched_value', 0) or 0),
                        'id': last_row.id,
                    }
                )
            else:
                next_cursor = legacy_views._encode_whale_feed_cursor(
                    {
                        'sort': sort,
                        'window': window,
                        'trade_date': last_row.trade_date.isoformat(),
                        'trade_time': last_row.trade_time.isoformat(),
                        'id': last_row.id,
                    }
                )

        results = [
            legacy_views._build_aggregate_event_payload(
                row,
                _resolve_threshold_for_symbol(getattr(row, 'symbol', '')),
                threshold_source=_resolve_threshold_source_for_symbol(getattr(row, 'symbol', '')),
                score_config=score_config,
                now=request_now,
            )
            for row in page_rows
        ]
        return Response(
            {
                'results': results,
                'next_cursor': next_cursor,
                'has_more': has_more,
                'server_time': timezone.now().isoformat(),
                'source': 'intraday_tick_db',
                'weights_version': score_config['version'],
                'filters': {
                    'scope': scope,
                    'scope_source': scope_source,
                    'symbols': symbols,
                    'watchlist_group_ids': watchlist_group_ids,
                    'sort': sort,
                    'window': window,
                    'limit': limit,
                    'threshold': threshold_vnd,
                },
                'meta': {
                    'contract_version': '1.1',
                    'pagination': {
                        'sort': sort,
                        'limit': limit,
                        'has_more': has_more,
                        'next_cursor': next_cursor,
                    },
                    'scope': {
                        'value': scope,
                        'source': scope_source,
                    },
                },
                'entitlements': entitlements,
            }
        )


class WhaleCampaignsView(APIView):
    """
    GET /api/realtime/whale-campaigns/
    Group aggregate whale events thanh campaign clusters theo symbol/side/time-gap.
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'realtime_whale_aggregate'

    def get(self, request):
        legacy_views = _legacy_views_module()

        try:
            payload = legacy_views.market_data_service.get_whale_campaigns(request.user, request.query_params)
            return Response(payload)
        except MarketDataValidationException as exc:
            return Response({'detail': exc.message}, status=status.HTTP_400_BAD_REQUEST)
        except ExternalSystemException as exc:
            http_status = status.HTTP_503_SERVICE_UNAVAILABLE if exc.code == 'vnstock_missing' else status.HTTP_502_BAD_GATEWAY
            return Response({'detail': exc.message, **exc.payload}, status=http_status)
        except Exception:
            legacy_views.logger.exception('WhaleCampaignsView unexpected error')
            return Response({'detail': 'Lỗi ngoài dự kiến khi tổng hợp whale campaigns.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
