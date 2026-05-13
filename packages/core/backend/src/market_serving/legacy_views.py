"""
Compatibility shim views for legacy frontend API paths.

These views map legacy `/api/<legacy-path>/` routes to either:
  - Existing core domain views (real data), or
  - Graceful stub responses (empty lists / minimal objects) for features not yet
    fully migrated to packages/core.

IMPORTANT: Every stub here is a placeholder.  As more domain functionality is
migrated, replace the stub with the real core view.
"""
import base64
import hashlib
import json
from datetime import datetime, timedelta

from django.contrib.auth.models import User
from django.db.models import Max, Prefetch, Q
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from vninvest_core.utils.legacy_bridge import legacy_bridge_response


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _empty_list():
    return Response([], status=status.HTTP_200_OK)


def _empty_paginated(request=None):
    return Response({"count": 0, "results": [], "next": None, "previous": None})


_STOCK_MANAGEMENT_DEFAULT_GROUPS = [
    {
        "name": "Ngân hàng",
        "group_type": "SECTOR",
        "description": "Nhóm ngân hàng",
        "color": "#3b82f6",
        "order": 1,
        "symbols": ['ACB', 'BID', 'CTG', 'EIB', 'HDB', 'LPB', 'MBB', 'MSB', 'OCB', 'SHB', 'SSB', 'STB', 'TCB', 'TPB', 'VCB', 'VIB', 'VPB'],
    },
    {
        "name": "Bất động sản",
        "group_type": "SECTOR",
        "description": "Nhóm bất động sản",
        "color": "#f59e0b",
        "order": 2,
        "symbols": ['BCM', 'CEO', 'DIG', 'DXG', 'KBC', 'KDH', 'NLG', 'NVL', 'PDR', 'SJS', 'TDH', 'VHM', 'VIC', 'VRE'],
    },
    {
        "name": "Thép & Vật liệu",
        "group_type": "SECTOR",
        "description": "Nhóm thép và vật liệu xây dựng",
        "color": "#ef4444",
        "order": 3,
        "symbols": ['BMP', 'HPG', 'HSG', 'NKG', 'TLH', 'VGC', 'VIS'],
    },
    {
        "name": "Dầu khí",
        "group_type": "SECTOR",
        "description": "Nhóm dầu khí và năng lượng",
        "color": "#8b5cf6",
        "order": 4,
        "symbols": ['GAS', 'OIL', 'PLX', 'PVD', 'PVS', 'PVT'],
    },
    {
        "name": "Công nghệ",
        "group_type": "SECTOR",
        "description": "Nhóm công nghệ và viễn thông",
        "color": "#22c55e",
        "order": 5,
        "symbols": ['CMG', 'ELC', 'FPT', 'SAM', 'VGI'],
    },
    {
        "name": "Bán lẻ & Tiêu dùng",
        "group_type": "SECTOR",
        "description": "Nhóm bán lẻ và hàng tiêu dùng",
        "color": "#ec4899",
        "order": 6,
        "symbols": ['MSN', 'MWG', 'PNJ', 'SAB', 'VNM'],
    },
    {
        "name": "VN30",
        "group_type": "MARKET_CAP",
        "description": "Top 30 cổ phiếu vốn hóa lớn nhất HOSE",
        "color": "#6366f1",
        "order": 7,
        "symbols": ['ACB', 'BID', 'CTG', 'DGC', 'FPT', 'GAS', 'GVR', 'HDB', 'HPG', 'LPB', 'MBB', 'MSN', 'MWG', 'PLX', 'SAB', 'SHB', 'SSB', 'SSI', 'STB', 'TCB', 'TPB', 'VCB', 'VHM', 'VIB', 'VIC', 'VJC', 'VNM', 'VPB', 'VPL', 'VRE'],
    },
]

_STOCK_MANAGEMENT_DEFAULT_GROUP_LOOKUP = {group['name']: group for group in _STOCK_MANAGEMENT_DEFAULT_GROUPS}
_STOCK_MANAGEMENT_COLOR_PALETTE = ['#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#22c55e', '#ec4899', '#6366f1']


def _build_stock_management_item_payload(item):
    return {
        'id': item.pk,
        'symbol': item.symbol,
        'note': getattr(item, 'note', '') or '',
        'current_price': None,
        'prev_price': None,
        'change_value': None,
        'change_pct': None,
        'last_date': None,
    }


def _build_stock_management_group_payload(watchlist, index: int):
    template = _STOCK_MANAGEMENT_DEFAULT_GROUP_LOOKUP.get(watchlist.name) or {}
    color = template.get('color') or _STOCK_MANAGEMENT_COLOR_PALETTE[index % len(_STOCK_MANAGEMENT_COLOR_PALETTE)]
    group_type = template.get('group_type') or 'CUSTOM'
    order = template.get('order') or (index + 1)
    return {
        'id': watchlist.pk,
        'name': watchlist.name,
        'group_type': group_type,
        'description': watchlist.description,
        'color': color,
        'order': order,
        'items': [_build_stock_management_item_payload(item) for item in watchlist.items.all()],
    }


# ---------------------------------------------------------------------------
# Stock-management stubs (not yet migrated to core)
# ---------------------------------------------------------------------------




class RealtimeUnifiedAlertsView(APIView):
    """Serve legacy unified-alerts contract from native core signal tables."""

    permission_classes = [permissions.IsAuthenticated]

    _WINDOW_DELTAS = {
        '5m': timedelta(minutes=5),
        '15m': timedelta(minutes=15),
        '1h': timedelta(hours=1),
        '5d': timedelta(days=5),
    }
    _SEVERITY_RANK = {
        'low': 1,
        'medium': 2,
        'high': 3,
        'critical': 4,
    }

    def get(self, request, **kwargs):
        from signal_intelligence.models import UnifiedAlert

        try:
            limit = self._parse_limit(request.query_params.get('limit', 20))
            window = self._parse_window(request.query_params.get('window', 'session'))
            severity_min = self._parse_severity_min(request.query_params.get('severity_min', 'low'))
            include_market_top_tier = self._parse_boolean_flag(
                request.query_params.get('include_market_top_tier'),
                default=True,
            )
            cursor_payload = self._decode_cursor(request.query_params.get('cursor'))
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if request.query_params.get('cursor') and cursor_payload is None:
            return Response({'detail': 'cursor không hợp lệ cho unified alerts.'}, status=status.HTTP_400_BAD_REQUEST)
        if cursor_payload is not None and str(cursor_payload.get('window') or '') != window:
            return Response({'detail': 'cursor không hợp lệ cho window hiện tại.'}, status=status.HTTP_400_BAD_REQUEST)
        if cursor_payload is not None and str(cursor_payload.get('severity_min') or '') != severity_min:
            return Response({'detail': 'cursor không hợp lệ cho severity_min hiện tại.'}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        symbols, scope, watchlist_group_ids, scope_source = self._resolve_scope(request)

        severity_values = [
            value for value, rank in self._SEVERITY_RANK.items()
            if rank >= self._SEVERITY_RANK[severity_min]
        ]

        base_queryset = UnifiedAlert.objects.filter(
            alert_type__in=[
                UnifiedAlert.AlertTypeChoices.WHALE,
                UnifiedAlert.AlertTypeChoices.DARK_FLOW,
            ],
            severity__in=severity_values,
        ).select_related('whale_detail').prefetch_related(
            Prefetch('order_flow_events')
        )

        scoped_items = self._serialize_alerts(
            queryset=self._apply_window_filter(base_queryset, window, now).filter(symbol__in=symbols) if symbols else base_queryset.none(),
            watchlist_symbol=True,
            market_wide=False,
        )

        market_top_tier_items = []
        if include_market_top_tier:
            market_top_tier_items = self._serialize_alerts(
                queryset=self._apply_window_filter(base_queryset, window, now)
                .filter(alert_type=UnifiedAlert.AlertTypeChoices.WHALE)
                .exclude(symbol__in=symbols)
                .order_by('-triggered_at', '-pk')[: max(limit * 2, 10)],
                watchlist_symbol=False,
                market_wide=True,
            )

        combined = scoped_items + market_top_tier_items
        combined.sort(
            key=lambda item: (
                int(item.get('_priority_rank') or 1),
                self._safe_parse_ts(item.get('ts')),
                str(item.get('event_id') or ''),
            ),
            reverse=True,
        )

        seen = set()
        deduped = []
        for item in combined:
            event_id = str(item.get('event_id') or '')
            if event_id in seen:
                continue
            seen.add(event_id)
            deduped.append(item)

        if cursor_payload is not None:
            deduped = self._apply_cursor(deduped, cursor_payload)

        has_more = len(deduped) > limit
        page_items = deduped[:limit]
        next_cursor = self._build_next_cursor(page_items[-1], window=window, severity_min=severity_min) if has_more and page_items else None
        results = [self._sanitize_item(item) for item in page_items]

        if not results:
            bridged_response = legacy_bridge_response(
                request,
                request.path,
                unavailable_message='Legacy unified-alerts bridge hiện không khả dụng.',
            )
            if bridged_response is not None:
                return bridged_response

        return Response({
            'results': results,
            'server_time': now.isoformat(),
            'filters': {
                'scope': scope,
                'scope_source': scope_source,
                'symbols': symbols,
                'watchlist_group_ids': watchlist_group_ids,
                'window': window,
                'limit': limit,
                'severity_min': severity_min,
            },
            'next_cursor': next_cursor,
            'has_more': has_more,
            'meta': {
                'contract_version': '2.0',
                'source_mix': {
                    'whale': len([item for item in results if item.get('source') == 'whale']),
                    'dark_flow': len([item for item in results if item.get('source') == 'dark_flow']),
                },
                'market_top_tier': {
                    'enabled': include_market_top_tier,
                    'count': len([item for item in results if item.get('market_wide') is True]),
                },
                'pagination': {
                    'limit': limit,
                    'has_more': has_more,
                    'next_cursor': next_cursor,
                },
            },
        })

    def _resolve_scope(self, request):
        from user_workspace.models import WatchlistItem

        scope_raw = str(request.query_params.get('scope', '') or '').strip().lower()
        explicit_symbols = str(request.query_params.get('symbols', '') or '')
        watchlist_group_ids_raw = str(request.query_params.get('watchlist_group_ids', '') or '')

        if scope_raw in {'custom', 'symbols'} or explicit_symbols:
            symbols = self._normalize_symbols(explicit_symbols.split(','))
            return symbols, 'custom', [], 'symbols_param' if explicit_symbols else 'query_scope'

        group_ids = self._parse_watchlist_group_ids(watchlist_group_ids_raw)
        if scope_raw == 'watchlist' or group_ids:
            qs = WatchlistItem.objects.filter(watchlist__user=request.user)
            if group_ids:
                qs = qs.filter(
                    Q(watchlist_id__in=group_ids) |
                    Q(watchlist__legacy_group_id__in=group_ids)
                )
            symbols = self._normalize_symbols(qs.values_list('symbol', flat=True))
            return symbols, 'watchlist', group_ids, 'watchlist_param' if group_ids else 'query_scope'

        symbols = self._normalize_symbols(
            WatchlistItem.objects.filter(watchlist__user=request.user).values_list('symbol', flat=True)
        )
        return symbols, 'watchlist', [], 'default_watchlists'

    def _serialize_alerts(self, queryset, *, watchlist_symbol, market_wide):
        items = []
        for alert in queryset:
            source = 'whale' if alert.alert_type == 'whale' else 'dark_flow'
            direction = str(alert.direction or '').lower()
            if source == 'whale':
                alert_type = 'buy' if direction == 'buy' else 'sell' if direction == 'sell' else 'neutral'
                whale_detail = getattr(alert, 'whale_detail', None)
                matched_value = float(
                    getattr(whale_detail, 'matched_value', None)
                    or alert.value
                    or 0
                )
                confidence = None
                if isinstance(alert.metadata, dict):
                    confidence = alert.metadata.get('display_score') or alert.metadata.get('event_score')
                headline = alert.title or (
                    'Large buy flow detected' if alert_type == 'buy' else 'Large sell flow detected'
                )
                detail = alert.body or f'Matched value: {round(matched_value, 2)}'
            else:
                alert_type = 'flow'
                order_flow_events = list(alert.order_flow_events.all())
                latest_event = order_flow_events[0] if order_flow_events else None
                confidence = float(getattr(latest_event, 'strength', 0.0) or 0.0) if latest_event is not None else None
                headline = alert.title or 'Dark money signal detected'
                detail = alert.body or (
                    f"Signal {latest_event.signal_type} | strength={round(float(latest_event.strength or 0.0), 1)}"
                    if latest_event is not None else 'Dark money signal detected'
                )

            items.append({
                'event_id': str(alert.alert_id),
                'symbol': str(alert.symbol or '').upper(),
                'source': source,
                'severity': self._normalize_severity(alert.severity),
                'type': alert_type,
                'confidence': confidence,
                'headline': headline,
                'detail': detail,
                'ts': alert.triggered_at.isoformat(),
                'to': f"/whale-alerts/{alert.symbol}" if source == 'whale' else f"/stocks/{alert.symbol}",
                'market_wide': market_wide,
                'watchlist_symbol': watchlist_symbol,
                '_priority_rank': self._compute_priority_rank(
                    severity=str(alert.severity or ''),
                    watchlist_symbol=watchlist_symbol,
                    market_wide=market_wide,
                ),
            })
        return items

    def _apply_window_filter(self, queryset, window, now):
        if window == 'session':
            latest_session = queryset.aggregate(latest_session=Max('session_date')).get('latest_session')
            return queryset.filter(session_date=latest_session) if latest_session is not None else queryset.none()
        delta = self._WINDOW_DELTAS.get(window)
        if delta is None:
            return queryset
        return queryset.filter(triggered_at__gte=now - delta)

    def _apply_cursor(self, items, cursor_payload):
        cursor_rank = int(cursor_payload.get('priority_rank'))
        cursor_ts = self._safe_parse_ts(cursor_payload.get('ts'))
        cursor_event_id = str(cursor_payload.get('event_id') or '')
        filtered = []
        for item in items:
            item_rank = int(item.get('_priority_rank') or 1)
            item_ts = self._safe_parse_ts(item.get('ts'))
            item_event_id = str(item.get('event_id') or '')
            if item_rank < cursor_rank:
                filtered.append(item)
                continue
            if item_rank == cursor_rank and item_ts < cursor_ts:
                filtered.append(item)
                continue
            if item_rank == cursor_rank and item_ts == cursor_ts and item_event_id < cursor_event_id:
                filtered.append(item)
        return filtered

    def _build_next_cursor(self, item, *, window, severity_min):
        payload = {
            'priority_rank': int(item.get('_priority_rank') or 1),
            'event_id': str(item.get('event_id') or ''),
            'ts': str(item.get('ts') or ''),
            'window': str(window),
            'severity_min': str(severity_min),
        }
        encoded = base64.urlsafe_b64encode(json.dumps(payload).encode('utf-8')).decode('ascii')
        return encoded.rstrip('=')

    def _decode_cursor(self, raw_cursor):
        if not raw_cursor:
            return None
        try:
            padded = str(raw_cursor) + '=' * (-len(str(raw_cursor)) % 4)
            payload = json.loads(base64.urlsafe_b64decode(padded.encode('ascii')).decode('utf-8'))
            priority_rank = int(payload.get('priority_rank') or payload.get('severity_rank'))
            event_id = str(payload.get('event_id') or '')
            ts = str(payload.get('ts') or '')
            window = str(payload.get('window') or '')
            severity_min = str(payload.get('severity_min') or '')
        except Exception:
            return None
        if priority_rank < 1 or priority_rank > 8:
            return None
        if not event_id or not ts or not window or not severity_min:
            return None
        return {
            'priority_rank': priority_rank,
            'event_id': event_id,
            'ts': ts,
            'window': window,
            'severity_min': severity_min,
        }

    def _sanitize_item(self, item):
        sanitized = dict(item)
        sanitized.pop('_priority_rank', None)
        return sanitized

    def _normalize_symbols(self, raw_symbols):
        return sorted({
            str(symbol).strip().upper()
            for symbol in raw_symbols
            if str(symbol).strip()
        })

    def _parse_watchlist_group_ids(self, raw_value):
        parsed_ids = []
        for chunk in str(raw_value or '').split(','):
            chunk = str(chunk).strip()
            if not chunk:
                continue
            try:
                parsed_ids.append(int(chunk))
            except (TypeError, ValueError):
                continue
        return sorted(set(parsed_ids))

    def _parse_limit(self, limit_raw):
        try:
            limit = int(limit_raw)
        except (TypeError, ValueError):
            raise ValueError('limit phải là số nguyên trong khoảng [1, 50].')
        if limit < 1 or limit > 50:
            raise ValueError('limit phải là số nguyên trong khoảng [1, 50].')
        return limit

    def _parse_window(self, window_raw):
        window = str(window_raw or 'session').strip().lower() or 'session'
        if window not in {'5m', '15m', '1h', 'session', '5d'}:
            raise ValueError("window không hợp lệ. Chỉ hỗ trợ: '5m', '15m', '1h', 'session', '5d'.")
        return window

    def _parse_severity_min(self, severity_raw):
        severity = str(severity_raw or 'low').strip().lower()
        if severity not in self._SEVERITY_RANK:
            raise ValueError("severity_min không hợp lệ. Chỉ hỗ trợ: 'low', 'medium', 'high', 'critical'.")
        return severity

    def _parse_boolean_flag(self, raw_value, *, default=False):
        if raw_value is None:
            return default
        normalized = str(raw_value).strip().lower()
        if normalized in {'1', 'true', 'yes', 'on'}:
            return True
        if normalized in {'0', 'false', 'no', 'off'}:
            return False
        return default

    def _normalize_severity(self, raw_severity):
        normalized = str(raw_severity or '').strip().lower()
        return normalized if normalized in self._SEVERITY_RANK else 'medium'

    def _compute_priority_rank(self, *, severity, watchlist_symbol, market_wide):
        rank = self._SEVERITY_RANK.get(self._normalize_severity(severity), 1)
        if watchlist_symbol:
            rank += 2
        if market_wide:
            rank = max(rank - 1, 1)
        return min(rank, 8)

    def _safe_parse_ts(self, ts_raw):
        if not ts_raw:
            return timezone.datetime.min.replace(tzinfo=timezone.utc)
        try:
            parsed = timezone.datetime.fromisoformat(str(ts_raw).replace('Z', '+00:00'))
            if timezone.is_naive(parsed):
                return timezone.make_aware(parsed, timezone.get_current_timezone())
            return parsed
        except Exception:
            return timezone.datetime.min.replace(tzinfo=timezone.utc)




class RealtimeWhaleFeedAggregateView(RealtimeUnifiedAlertsView):
    """Serve legacy whale-feed aggregate contract from core signal tables."""

    def get(self, request, **kwargs):
        from signal_intelligence.models import WhaleAlertCanonical

        try:
            limit = self._parse_limit(request.query_params.get('limit', 20))
            sort = self._parse_sort(request.query_params.get('sort', 'ts'))
            window = self._parse_window(request.query_params.get('window', 'session'))
            cursor_payload = self._decode_cursor(request.query_params.get('cursor'), sort=sort)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if request.query_params.get('cursor') and cursor_payload is None:
            return Response({'detail': 'cursor không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)
        if cursor_payload is not None and str(cursor_payload.get('sort') or '') != sort:
            return Response({'detail': 'cursor không hợp lệ cho sort hiện tại.'}, status=status.HTTP_400_BAD_REQUEST)
        if cursor_payload is not None and str(cursor_payload.get('window') or '') != window:
            return Response({'detail': 'cursor không hợp lệ cho window hiện tại.'}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        symbols, scope, watchlist_group_ids, scope_source = self._resolve_scope(request)
        explicit_scope = self._has_explicit_scope(request)
        entitlements = self._build_entitlements(request)

        if not symbols:
            if explicit_scope or scope == 'tracked':
                return Response(
                    self._build_response(
                        results=[],
                        next_cursor=None,
                        has_more=False,
                        source='canonical_event_store',
                        weights_version='core-materialized',
                        entitlements=entitlements,
                        scope=scope,
                        scope_source=scope_source,
                        symbols=symbols,
                        watchlist_group_ids=watchlist_group_ids,
                        sort=sort,
                        window=window,
                        limit=limit,
                    )
                )

            bridged_response = legacy_bridge_response(
                request,
                request.path,
                unavailable_message='Legacy whale aggregate bridge hiện không khả dụng.',
            )
            if bridged_response is not None:
                return bridged_response

            return Response(
                self._build_response(
                    results=[],
                    next_cursor=None,
                    has_more=False,
                    source='canonical_event_store',
                    weights_version='core-materialized',
                    entitlements=entitlements,
                    scope=scope,
                    scope_source=scope_source,
                    symbols=symbols,
                    watchlist_group_ids=watchlist_group_ids,
                    sort=sort,
                    window=window,
                    limit=limit,
                )
            )

        queryset = WhaleAlertCanonical.objects.select_related('alert').filter(symbol__in=symbols)
        queryset = self._apply_whale_window_filter(queryset, window, now)

        if sort == 'matched_value':
            if cursor_payload is not None:
                cursor_value = float(cursor_payload['matched_value'])
                cursor_id = int(cursor_payload['id'])
                queryset = queryset.filter(
                    Q(matched_value__lt=cursor_value)
                    | Q(matched_value=cursor_value, alert_id__lt=cursor_id)
                )
            queryset = queryset.order_by('-matched_value', '-alert_id')
        else:
            if cursor_payload is not None:
                cursor_dt = self._cursor_datetime(cursor_payload)
                cursor_id = int(cursor_payload['id'])
                queryset = queryset.filter(
                    Q(executed_at__lt=cursor_dt)
                    | Q(executed_at=cursor_dt, alert_id__lt=cursor_id)
                )
            queryset = queryset.order_by('-executed_at', '-alert_id')

        page_rows_with_probe = list(queryset[:limit + 1])
        has_more = len(page_rows_with_probe) > limit
        page_rows = page_rows_with_probe[:limit]

        if not page_rows and scope != 'tracked':
            bridged_response = legacy_bridge_response(
                request,
                request.path,
                unavailable_message='Legacy whale aggregate bridge hiện không khả dụng.',
            )
            if bridged_response is not None:
                return bridged_response

        results = [self._serialize_whale_record(row, now=now) for row in page_rows]
        next_cursor = None
        if has_more and page_rows:
            next_cursor = self._build_next_cursor(page_rows[-1], sort=sort, window=window)

        weights_version = 'core-materialized'
        if results:
            weights_version = str(results[0].get('weights_version') or weights_version)

        return Response(
            self._build_response(
                results=results,
                next_cursor=next_cursor,
                has_more=has_more,
                source='canonical_event_store',
                weights_version=weights_version,
                entitlements=entitlements,
                scope=scope,
                scope_source=scope_source,
                symbols=symbols,
                watchlist_group_ids=watchlist_group_ids,
                sort=sort,
                window=window,
                limit=limit,
            )
        )

    def _resolve_scope(self, request):
        scope_raw = str(request.query_params.get('scope', '') or '').strip().lower()
        explicit_symbols = str(request.query_params.get('symbols', '') or '')
        watchlist_group_ids_raw = str(request.query_params.get('watchlist_group_ids', '') or '')

        if scope_raw in {'custom', 'symbols'}:
            symbols = self._normalize_symbols(explicit_symbols.split(','))
            return symbols, 'custom', [], 'query_scope'

        if scope_raw == 'watchlist':
            group_ids = self._parse_watchlist_group_ids(watchlist_group_ids_raw)
            symbols = self._resolve_watchlist_symbols(request.user, group_ids)
            return symbols, 'watchlist', group_ids, 'query_scope'

        if scope_raw == 'tracked':
            symbols = self._resolve_tracked_symbols(request)
            return symbols, 'tracked', [], 'query_scope'

        if explicit_symbols:
            symbols = self._normalize_symbols(explicit_symbols.split(','))
            return symbols, 'custom', [], 'symbols_param'

        if watchlist_group_ids_raw:
            group_ids = self._parse_watchlist_group_ids(watchlist_group_ids_raw)
            symbols = self._resolve_watchlist_symbols(request.user, group_ids)
            return symbols, 'watchlist', group_ids, 'watchlist_param'

        symbols = self._resolve_tracked_symbols(request)
        return symbols, 'tracked', [], 'default_tracked'

    def _resolve_watchlist_symbols(self, user, group_ids):
        from user_workspace.models import WatchlistItem

        if not group_ids:
            return []

        queryset = WatchlistItem.objects.filter(watchlist__user=user).filter(
            Q(watchlist_id__in=group_ids) |
            Q(watchlist__legacy_group_id__in=group_ids)
        )
        return self._normalize_symbols(queryset.values_list('symbol', flat=True))

    def _resolve_tracked_symbols(self, request):
        from user_workspace.models import WatchlistItem
        user = request.user
        if not user or not user.is_authenticated:
            return []
        symbols = (
            WatchlistItem.objects
            .filter(watchlist__user=user)
            .values_list('symbol', flat=True)
        )
        return self._normalize_symbols(symbols)

    def _extract_tracked_symbols(self, payload):
        if isinstance(payload, list):
            items = payload
        elif isinstance(payload, dict):
            if isinstance(payload.get('results'), list):
                items = payload.get('results') or []
            elif isinstance(payload.get('items'), list):
                items = payload.get('items') or []
            elif isinstance(payload.get('data'), list):
                items = payload.get('data') or []
            else:
                items = [payload]
        else:
            items = []

        symbols = []
        for item in items:
            if isinstance(item, dict):
                symbol = item.get('symbol') or item.get('ticker') or item.get('code')
            else:
                symbol = item
            if symbol:
                symbols.append(symbol)
        return self._normalize_symbols(symbols)

    def _has_explicit_scope(self, request):
        return any(
            str(request.query_params.get(key, '') or '').strip()
            for key in ('scope', 'symbols', 'watchlist_group_ids')
        )

    def _apply_whale_window_filter(self, queryset, window, now):
        if window == 'session':
            latest_session = queryset.aggregate(latest_session=Max('session_date')).get('latest_session')
            return queryset.filter(session_date=latest_session) if latest_session is not None else queryset.none()
        delta = self._WINDOW_DELTAS.get(window)
        if delta is None:
            return queryset
        return queryset.filter(executed_at__gte=now - delta)

    def _parse_sort(self, sort_raw):
        sort = str(sort_raw or 'ts').strip().lower() or 'ts'
        if sort not in {'ts', 'matched_value'}:
            raise ValueError("sort không hợp lệ. Chỉ hỗ trợ: 'ts', 'matched_value'.")
        return sort

    def _decode_cursor(self, raw_cursor, *, sort):
        if not raw_cursor:
            return None
        try:
            padded = str(raw_cursor) + '=' * (-len(str(raw_cursor)) % 4)
            payload = json.loads(base64.urlsafe_b64decode(padded.encode('ascii')).decode('utf-8'))
        except Exception:
            return None
        if not isinstance(payload, dict):
            return None

        if sort == 'matched_value':
            expected_keys = {'sort', 'matched_value', 'id'}
            extra_keys = set(payload.keys()) - expected_keys
            if extra_keys and extra_keys != {'window'}:
                return None
            try:
                return {
                    'sort': str(payload['sort']),
                    'matched_value': float(payload['matched_value']),
                    'id': int(payload['id']),
                    'window': str(payload.get('window') or ''),
                }
            except (KeyError, TypeError, ValueError):
                return None

        expected_keys = {'sort', 'trade_date', 'trade_time', 'id'}
        extra_keys = set(payload.keys()) - expected_keys
        if extra_keys and extra_keys != {'window'}:
            return None
        try:
            datetime.fromisoformat(f"{payload['trade_date']}T{payload['trade_time']}")
            return {
                'sort': str(payload['sort']),
                'trade_date': str(payload['trade_date']),
                'trade_time': str(payload['trade_time']),
                'id': int(payload['id']),
                'window': str(payload.get('window') or ''),
            }
        except (KeyError, TypeError, ValueError):
            return None

    def _cursor_datetime(self, cursor_payload):
        parsed = datetime.fromisoformat(
            f"{cursor_payload['trade_date']}T{cursor_payload['trade_time']}"
        )
        if timezone.is_naive(parsed):
            return timezone.make_aware(parsed, timezone.get_current_timezone())
        return parsed

    def _build_next_cursor(self, row, *, sort, window):
        if sort == 'matched_value':
            payload = {
                'sort': sort,
                'matched_value': float(row.matched_value or 0),
                'id': int(row.alert_id),
                'window': str(window),
            }
        else:
            executed_at = row.executed_at
            if timezone.is_naive(executed_at):
                executed_at = timezone.make_aware(executed_at, timezone.get_current_timezone())
            payload = {
                'sort': sort,
                'trade_date': executed_at.date().isoformat(),
                'trade_time': executed_at.time().isoformat(),
                'id': int(row.alert_id),
                'window': str(window),
            }
        encoded = base64.urlsafe_b64encode(json.dumps(payload).encode('utf-8')).decode('ascii')
        return encoded.rstrip('=')

    def _serialize_whale_record(self, row, *, now):
        alert = row.alert
        metadata = alert.metadata if isinstance(alert.metadata, dict) else {}
        occurred_at = row.executed_at or alert.triggered_at or now
        if timezone.is_naive(occurred_at):
            occurred_at = timezone.make_aware(occurred_at, timezone.get_current_timezone())
        ts = occurred_at.isoformat()
        alert_first_seen_at = str(metadata.get('alert_first_seen_at') or ts)
        alert_age_seconds = metadata.get('alert_age_seconds')
        if alert_age_seconds is None:
            alert_age_seconds = max((now - occurred_at).total_seconds(), 0.0)

        matched_value = float(row.matched_value or alert.value or 0)
        return {
            'id': int(row.alert_id),
            'event_id': str(metadata.get('event_id') or alert.source_ref or alert.alert_id),
            'contract_version': '1.0',
            'config_version': str(metadata.get('config_version') or 'core-materialized'),
            'weights_version': str(metadata.get('weights_version') or 'core-materialized'),
            'symbol': str(row.symbol or alert.symbol or '').upper(),
            'side': str(row.side or 'buy').lower(),
            'matched_value': round(matched_value, 2),
            'volume': int(row.volume or 0),
            'threshold': float(metadata.get('threshold') or 0.0),
            'size_class': str(metadata.get('size_class') or self._classify_signal_size(matched_value)),
            'ts': ts,
            'alert_at': ts,
            'alert_first_seen_at': alert_first_seen_at,
            'alert_age_seconds': float(alert_age_seconds or 0.0),
            'source': str(metadata.get('source') or 'canonical_event_store'),
            'threshold_source': str(metadata.get('threshold_source') or 'discovery_global'),
            'event_score': metadata.get('event_score'),
            'display_score': metadata.get('display_score'),
            'severity': self._normalize_severity(metadata.get('severity') or alert.severity),
            'score_breakdown': metadata.get('score_breakdown') or {},
            'normalized_features': metadata.get('normalized_features') or {},
            'raw_features': metadata.get('raw_features') or {},
            'score_decay': metadata.get('score_decay') or {
                'age_seconds': float(alert_age_seconds or 0.0),
                'decay_factor': None,
            },
            'abnormality_score': metadata.get('abnormality_score', 50.0),
            'session_percentile': metadata.get('session_percentile', 50.0),
            'baseline_context': metadata.get('baseline_context') or {},
        }

    def _classify_signal_size(self, matched_value):
        if matched_value >= 5_000_000_000:
            return 'whale'
        if matched_value >= 1_000_000_000:
            return 'shark'
        if matched_value >= 500_000_000:
            return 'big'
        return 'normal'

    def _build_entitlements(self, request):
        from identity_access.models import CoreTenant

        try:
            tenant = request.user.core_tenant
        except CoreTenant.DoesNotExist:
            return {}

        advisory_plans = {
            CoreTenant.PlanChoices.PRO,
            CoreTenant.PlanChoices.ENTERPRISE,
            CoreTenant.PlanChoices.CUSTOM,
            CoreTenant.PlanChoices.INTERNAL,
        }
        advisory_detail_plans = {
            CoreTenant.PlanChoices.ENTERPRISE,
            CoreTenant.PlanChoices.CUSTOM,
            CoreTenant.PlanChoices.INTERNAL,
        }
        plan = str(tenant.plan or CoreTenant.PlanChoices.FREE)

        return {
            'plan': plan,
            'status': str(tenant.status or ''),
            'tenant_id': str(tenant.public_id),
            'tenant_code': tenant.tenant_code,
            'trial_ends_at': tenant.trial_ends_at.isoformat() if tenant.trial_ends_at else None,
            'can_read_whale_feed': True,
            'can_read_whale_advisory': plan in advisory_plans,
            'can_read_whale_advisory_detail': plan in advisory_detail_plans,
        }

    def _build_response(
        self,
        *,
        results,
        next_cursor,
        has_more,
        source,
        weights_version,
        entitlements,
        scope,
        scope_source,
        symbols,
        watchlist_group_ids,
        sort,
        window,
        limit,
    ):
        threshold_vnd = 0.0
        if results:
            thresholds = [float(item.get('threshold') or 0.0) for item in results]
            threshold_vnd = min(thresholds) if thresholds else 0.0
        return {
            'results': results,
            'next_cursor': next_cursor,
            'has_more': has_more,
            'server_time': timezone.now().isoformat(),
            'source': source,
            'weights_version': weights_version,
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



class RealtimeWhaleCampaignsView(RealtimeWhaleFeedAggregateView):
    """Serve legacy whale-campaigns contract from core canonical whale events."""

    def get(self, request, **kwargs):
        from signal_intelligence.models import WhaleAlertCanonical

        try:
            campaign_limit = self._parse_campaign_limit(request.query_params.get('campaign_limit', 25))
            campaign_sort = self._parse_campaign_sort(request.query_params.get('campaign_sort', 'strength'))
            campaign_cursor = self._decode_campaign_cursor(request.query_params.get('cursor'))
            window = self._parse_window(request.query_params.get('window', 'session'))
            max_gap_minutes = self._resolve_campaign_gap_minutes(
                window_raw=window,
                gap_raw=request.query_params.get('campaign_gap_minutes'),
            )
            aggregate_limit_raw = request.query_params.get('limit')
            aggregate_limit = (
                self._parse_limit(aggregate_limit_raw)
                if aggregate_limit_raw
                else min(max(campaign_limit * 2, 30), 50)
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if request.query_params.get('cursor') and campaign_cursor is None:
            return Response({'detail': 'campaign cursor không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)
        if campaign_cursor is not None:
            cursor_sort = str(campaign_cursor.get('campaign_sort') or '').strip().lower()
            if cursor_sort and cursor_sort != campaign_sort:
                return Response(
                    {'detail': 'campaign cursor không hợp lệ cho campaign_sort hiện tại.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        now = timezone.now()
        symbols, scope, watchlist_group_ids, scope_source = self._resolve_scope(request)
        explicit_scope = self._has_explicit_scope(request)
        entitlements = self._build_entitlements(request)

        if not symbols:
            if explicit_scope or scope == 'tracked':
                return Response(
                    self._build_campaign_response(
                        results=[],
                        next_cursor=None,
                        has_more=False,
                        source='canonical_event_store',
                        weights_version='core-materialized',
                        entitlements=entitlements,
                        scope=scope,
                        scope_source=scope_source,
                        symbols=symbols,
                        watchlist_group_ids=watchlist_group_ids,
                        window=window,
                        aggregate_limit=aggregate_limit,
                        campaign_limit=campaign_limit,
                        campaign_sort=campaign_sort,
                        campaign_gap_minutes=max_gap_minutes,
                        cursor=request.query_params.get('cursor') or None,
                        threshold_vnd=0.0,
                    )
                )

            bridged_response = legacy_bridge_response(
                request,
                request.path,
                unavailable_message='Legacy whale campaigns bridge hiện không khả dụng.',
            )
            if bridged_response is not None:
                return bridged_response

            return Response(
                self._build_campaign_response(
                    results=[],
                    next_cursor=None,
                    has_more=False,
                    source='canonical_event_store',
                    weights_version='core-materialized',
                    entitlements=entitlements,
                    scope=scope,
                    scope_source=scope_source,
                    symbols=symbols,
                    watchlist_group_ids=watchlist_group_ids,
                    window=window,
                    aggregate_limit=aggregate_limit,
                    campaign_limit=campaign_limit,
                    campaign_sort=campaign_sort,
                    campaign_gap_minutes=max_gap_minutes,
                    cursor=request.query_params.get('cursor') or None,
                    threshold_vnd=0.0,
                )
            )

        queryset = WhaleAlertCanonical.objects.select_related('alert').filter(symbol__in=symbols)
        queryset = self._apply_whale_window_filter(queryset, window, now).order_by('-executed_at', '-alert_id')

        page_rows = list(queryset[:aggregate_limit])
        if not page_rows and scope != 'tracked':
            bridged_response = legacy_bridge_response(
                request,
                request.path,
                unavailable_message='Legacy whale campaigns bridge hiện không khả dụng.',
            )
            if bridged_response is not None:
                return bridged_response

        events = [self._serialize_whale_record(row, now=now) for row in page_rows]
        campaigns = self._group_events_into_campaigns(events, max_gap_minutes=max_gap_minutes)

        if campaign_sort == 'latest':
            campaigns.sort(
                key=lambda item: (
                    str(item.get('last_event_at') or ''),
                    str(item.get('campaign_id') or ''),
                ),
                reverse=True,
            )
        elif campaign_sort == 'value':
            campaigns.sort(
                key=lambda item: (
                    float(item.get('total_matched_value') or 0.0),
                    str(item.get('campaign_id') or ''),
                ),
                reverse=True,
            )
        else:
            campaigns.sort(
                key=lambda item: (
                    float(item.get('campaign_strength') or 0.0),
                    str(item.get('campaign_id') or ''),
                ),
                reverse=True,
            )

        if campaign_cursor is not None:
            campaigns = self._apply_campaign_cursor(
                campaigns,
                campaign_sort=campaign_sort,
                cursor_payload=campaign_cursor,
            )

        has_more = len(campaigns) > campaign_limit
        campaign_rows = campaigns[:campaign_limit]
        next_cursor = None
        if has_more and campaign_rows:
            next_cursor = self._build_campaign_next_cursor(campaign_rows[-1], campaign_sort)

        weights_version = 'core-materialized'
        if events:
            weights_version = str(events[0].get('weights_version') or weights_version)
        threshold_vnd = 0.0
        if events:
            threshold_values = [float(item.get('threshold') or 0.0) for item in events]
            threshold_vnd = min(threshold_values) if threshold_values else 0.0

        return Response(
            self._build_campaign_response(
                results=campaign_rows,
                next_cursor=next_cursor,
                has_more=has_more,
                source='canonical_event_store',
                weights_version=weights_version,
                entitlements=entitlements,
                scope=scope,
                scope_source=scope_source,
                symbols=symbols,
                watchlist_group_ids=watchlist_group_ids,
                window=window,
                aggregate_limit=aggregate_limit,
                campaign_limit=campaign_limit,
                campaign_sort=campaign_sort,
                campaign_gap_minutes=max_gap_minutes,
                cursor=request.query_params.get('cursor') or None,
                threshold_vnd=threshold_vnd,
            )
        )

    def _build_campaign_response(
        self,
        *,
        results,
        next_cursor,
        has_more,
        source,
        weights_version,
        entitlements,
        scope,
        scope_source,
        symbols,
        watchlist_group_ids,
        window,
        aggregate_limit,
        campaign_limit,
        campaign_sort,
        campaign_gap_minutes,
        cursor,
        threshold_vnd,
    ):
        return {
            'results': results,
            'next_cursor': next_cursor,
            'has_more': has_more,
            'server_time': timezone.now().isoformat(),
            'source': source,
            'weights_version': weights_version,
            'filters': {
                'scope': scope,
                'scope_source': scope_source,
                'symbols': symbols,
                'watchlist_group_ids': watchlist_group_ids,
                'sort': 'ts',
                'window': window,
                'limit': aggregate_limit,
                'threshold': threshold_vnd,
                'campaign_limit': campaign_limit,
                'campaign_sort': campaign_sort,
                'campaign_gap_minutes': campaign_gap_minutes,
                'cursor': cursor,
            },
            'meta': {
                'contract_version': '1.0',
                'campaign_count': len(results),
                'has_more': has_more,
                'next_cursor': next_cursor,
            },
            'entitlements': entitlements,
        }

    def _build_campaign_next_cursor(self, campaign_item, campaign_sort):
        payload = {
            'campaign_sort': campaign_sort,
            'campaign_id': str(campaign_item.get('campaign_id') or ''),
        }
        if campaign_sort == 'latest':
            payload['last_event_at'] = str(campaign_item.get('last_event_at') or '')
        elif campaign_sort == 'value':
            payload['total_matched_value'] = float(campaign_item.get('total_matched_value') or 0.0)
        else:
            payload['campaign_strength'] = float(campaign_item.get('campaign_strength') or 0.0)

        raw = json.dumps(payload, separators=(',', ':')).encode('utf-8')
        return base64.urlsafe_b64encode(raw).decode('ascii')

    def _decode_campaign_cursor(self, raw_cursor):
        if not raw_cursor:
            return None
        try:
            padded = str(raw_cursor) + '=' * (-len(str(raw_cursor)) % 4)
            decoded = base64.urlsafe_b64decode(padded.encode('ascii')).decode('utf-8')
            payload = json.loads(decoded)
        except (ValueError, TypeError, json.JSONDecodeError):
            return None
        return payload if isinstance(payload, dict) else None

    def _apply_campaign_cursor(self, campaigns, campaign_sort, cursor_payload):
        cursor_campaign_id = str(cursor_payload.get('campaign_id') or '')
        if not cursor_campaign_id:
            return []

        if campaign_sort == 'latest':
            cursor_ts = str(cursor_payload.get('last_event_at') or '')
            if not cursor_ts:
                return []
            return [
                item for item in campaigns
                if (
                    str(item.get('last_event_at') or '') < cursor_ts
                    or (
                        str(item.get('last_event_at') or '') == cursor_ts
                        and str(item.get('campaign_id') or '') < cursor_campaign_id
                    )
                )
            ]

        if campaign_sort == 'value':
            try:
                cursor_value = float(cursor_payload.get('total_matched_value'))
            except (TypeError, ValueError):
                return []
            return [
                item for item in campaigns
                if (
                    float(item.get('total_matched_value') or 0.0) < cursor_value
                    or (
                        float(item.get('total_matched_value') or 0.0) == cursor_value
                        and str(item.get('campaign_id') or '') < cursor_campaign_id
                    )
                )
            ]

        try:
            cursor_strength = float(cursor_payload.get('campaign_strength'))
        except (TypeError, ValueError):
            return []
        return [
            item for item in campaigns
            if (
                float(item.get('campaign_strength') or 0.0) < cursor_strength
                or (
                    float(item.get('campaign_strength') or 0.0) == cursor_strength
                    and str(item.get('campaign_id') or '') < cursor_campaign_id
                )
            )
        ]

    def _parse_campaign_limit(self, limit_raw):
        try:
            limit = int(limit_raw)
        except (TypeError, ValueError):
            raise ValueError('campaign_limit phải là số nguyên trong khoảng [1, 100].')
        if limit < 1 or limit > 100:
            raise ValueError('campaign_limit phải là số nguyên trong khoảng [1, 100].')
        return limit

    def _parse_campaign_sort(self, sort_raw):
        sort = str(sort_raw or 'strength').strip().lower()
        if sort not in {'strength', 'latest', 'value'}:
            raise ValueError("campaign_sort không hợp lệ. Chỉ hỗ trợ: 'strength', 'latest', 'value'.")
        return sort

    def _resolve_campaign_gap_minutes(self, window_raw, gap_raw):
        window = self._parse_window(window_raw)
        if gap_raw in (None, ''):
            default_by_window = {
                '5m': 3,
                '15m': 8,
                '1h': 20,
                'session': 45,
                '5d': 180,
            }
            return default_by_window.get(window, 45)
        try:
            gap = int(gap_raw)
        except (TypeError, ValueError):
            raise ValueError('campaign_gap_minutes phải là số nguyên trong khoảng [1, 240].')
        if gap < 1 or gap > 240:
            raise ValueError('campaign_gap_minutes phải là số nguyên trong khoảng [1, 240].')
        return gap

    def _group_events_into_campaigns(self, events, max_gap_minutes):
        normalized_events = []
        for event in events:
            if not isinstance(event, dict):
                continue
            symbol = str(event.get('symbol') or '').strip().upper()
            side = str(event.get('side') or 'neutral').strip().lower() or 'neutral'
            ts_raw = event.get('ts')
            if not symbol or not ts_raw:
                continue
            try:
                ts_value = datetime.fromisoformat(str(ts_raw).replace('Z', '+00:00'))
            except Exception:
                continue
            if timezone.is_naive(ts_value):
                ts_value = timezone.make_aware(ts_value, timezone.get_current_timezone())
            normalized_events.append({
                'event': event,
                'symbol': symbol,
                'side': side,
                'ts': ts_value,
            })

        normalized_events.sort(key=lambda item: (item['symbol'], item['side'], item['ts']))

        clusters = []
        for item in normalized_events:
            if not clusters:
                clusters.append([item])
                continue
            current_cluster = clusters[-1]
            last_item = current_cluster[-1]
            if item['symbol'] != last_item['symbol'] or item['side'] != last_item['side']:
                clusters.append([item])
                continue
            gap_seconds = (item['ts'] - last_item['ts']).total_seconds()
            if gap_seconds > max_gap_minutes * 60:
                clusters.append([item])
            else:
                current_cluster.append(item)

        campaigns = []
        for cluster in clusters:
            if not cluster:
                continue
            first_item = cluster[0]
            last_item = cluster[-1]
            symbol = first_item['symbol']
            side = first_item['side']
            cluster_events = [item['event'] for item in cluster]

            total_value = float(sum(float(event.get('matched_value') or 0.0) for event in cluster_events))
            avg_event_score = (
                sum(float(event.get('event_score') or 0.0) for event in cluster_events) / len(cluster_events)
                if cluster_events else 0.0
            )
            duration_seconds = max(int((last_item['ts'] - first_item['ts']).total_seconds()), 0)
            strength = min(
                100.0,
                round(
                    (len(cluster_events) * 8.0)
                    + min(total_value / 1_000_000_000.0, 20.0) * 2.5
                    + avg_event_score * 0.45,
                    2,
                ),
            )

            campaign_seed = '|'.join([
                symbol,
                side,
                first_item['ts'].isoformat(),
                last_item['ts'].isoformat(),
                str(len(cluster_events)),
                str(round(total_value, 2)),
            ])
            campaign_id = f"camp:{hashlib.md5(campaign_seed.encode('utf-8')).hexdigest()[:16]}"

            if side == 'buy':
                campaign_type = 'accumulation'
            elif side == 'sell':
                campaign_type = 'distribution'
            else:
                campaign_type = 'mixed'

            events_payload = [
                {
                    'event_id': event.get('event_id'),
                    'symbol': event.get('symbol'),
                    'side': event.get('side'),
                    'ts': event.get('ts'),
                    'matched_value': event.get('matched_value'),
                    'source': event.get('source'),
                    'event_score': event.get('event_score'),
                    'display_score': event.get('display_score'),
                    'threshold_source': event.get('threshold_source'),
                    'size_class': event.get('size_class'),
                }
                for event in cluster_events
            ]

            source_mix = {}
            for event in cluster_events:
                source = str(event.get('source') or 'unknown')
                source_mix[source] = int(source_mix.get(source, 0)) + 1

            campaigns.append({
                'campaign_id': campaign_id,
                'contract_version': '1.0',
                'symbol': symbol,
                'side_bias': side,
                'campaign_type': campaign_type,
                'campaign_strength': strength,
                'event_count': len(cluster_events),
                'total_matched_value': round(total_value, 2),
                'avg_event_score': round(avg_event_score, 2),
                'duration_seconds': duration_seconds,
                'created_at': first_item['ts'].isoformat(),
                'last_event_at': last_item['ts'].isoformat(),
                'source_mix': source_mix,
                'events': events_payload,
            })

        return campaigns


