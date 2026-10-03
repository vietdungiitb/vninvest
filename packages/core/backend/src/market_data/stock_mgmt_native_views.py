"""
C3 — Native stock-management views for market_data domain.

Replaces StockManagementLegacyBridgeView for all stock-management frontend compat routes.
AI advisory routes keep route ownership here but delegate to the existing stock AI contract
handlers so `/api` and `/core/v1` stay aligned while tenant gating remains enforced.

All views require IsAuthenticated; symbol params are always uppercased.
Graceful stubs return empty/null for features not yet fully native.
"""
from collections import defaultdict
from copy import deepcopy
from decimal import Decimal
from datetime import date, datetime, time, timedelta, timezone as dt_timezone
from uuid import UUID

from django.db import DatabaseError, connection
from django.db.models import Q
from django.utils import timezone
from drf_spectacular.openapi import OpenApiParameter, OpenApiTypes
from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework import permissions, status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from vninvest_core.exceptions import (
    ValidationErrorException,
    NotFoundErrorException,
    PermissionErrorException,
    ConflictErrorException,
)

from advisory.models import AdvisoryRecord
from advisory.serializers import AdvisoryRecordSerializer

from vninvest_core.api_envelope import envelope_response
from identity_access.permissions import IsTenantActive
from .envelope import adopt_envelope, envelope, envelope_schema, paginated_envelope
from .global_symbol_planner import create_global_planner_run
from .global_symbol_registry import sync_admin_group_symbol_set, sync_system_default_symbol_group
from .models import DailyPrice, IntradayBar, IntradayTick, StockProfile
from .vnbroker_adapter import fetch_symbol_group_members
from service_ops.models import CachedSymbolGroup, CachedSymbolGroupMember
from user_workspace.models import PriceAlert, TrackedSymbol, Watchlist, WatchlistItem
import math

def clean_nan(obj):
    if isinstance(obj, dict):
        return {k: clean_nan(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_nan(x) for x in obj]
    
    try:
        import numpy as np
        is_float = isinstance(obj, (float, np.floating))
        is_int = isinstance(obj, (int, np.integer))
    except ImportError:
        is_float = isinstance(obj, float)
        is_int = isinstance(obj, int)

    if is_float:
        if math.isnan(obj) or math.isinf(obj):
            return None
        return float(obj)
    elif is_int:
        return int(obj)
        
    return obj

from .default_groups import (
    get_default_groups,
    get_group_lookup,
    get_color_palette,
    get_system_default_group_ids,
    build_group_payload,
)

# Backwards compatibility - these are re-exported from default_groups
_STOCK_MANAGEMENT_DEFAULT_GROUPS = get_default_groups()
_STOCK_MANAGEMENT_DEFAULT_GROUP_LOOKUP = get_group_lookup()
_STOCK_MANAGEMENT_COLOR_PALETTE = get_color_palette()
_SYSTEM_DEFAULT_SYMBOL_GROUP_IDS = get_system_default_group_ids()


_PORTFOLIO_NEWS_DIGEST_SCHEMA = {
    'type': 'object',
    'properties': {
        'news': {
            'type': 'array',
            'items': {'type': 'object'},
        },
        'note': {'type': 'string'},
    },
    'required': ['news', 'note'],
}

_STOCK_MANAGEMENT_ITEM_SCHEMA = {
    'type': 'object',
    'properties': {
        'id': {'type': 'integer'},
        'symbol': {'type': 'string'},
        'note': {'type': 'string'},
        'current_price': {'type': 'number', 'nullable': True},
        'prev_price': {'type': 'number', 'nullable': True},
        'change_value': {'type': 'number', 'nullable': True},
        'change_pct': {'type': 'number', 'nullable': True},
        'last_date': {'type': 'string', 'nullable': True},
    },
    'required': ['id', 'symbol', 'note', 'current_price', 'prev_price', 'change_value', 'change_pct', 'last_date'],
}

_STOCK_MANAGEMENT_GROUP_SCHEMA = {
    'type': 'object',
    'properties': {
        'id': {'type': 'integer'},
        'name': {'type': 'string'},
        'group_type': {'type': 'string'},
        'description': {'type': 'string', 'nullable': True},
        'color': {'type': 'string'},
        'order': {'type': 'integer'},
        'items': {
            'type': 'array',
            'items': _STOCK_MANAGEMENT_ITEM_SCHEMA,
        },
    },
    'required': ['id', 'name', 'group_type', 'description', 'color', 'order', 'items'],
}

_STOCK_MANAGEMENT_GROUP_LIST_SCHEMA = {
    'type': 'array',
    'items': _STOCK_MANAGEMENT_GROUP_SCHEMA,
}

_TRACKED_SYMBOL_SCHEMA = {
    'type': 'object',
    'properties': {
        'id': {'type': 'integer'},
        'symbol': {'type': 'string'},
        'industry': {'type': 'string'},
        'company_name': {'type': 'string'},
        'market_cap_bn': {'type': 'number', 'nullable': True},
        'source_group_id': {'type': 'integer', 'nullable': True},
        'source_group_name': {'type': 'string', 'nullable': True},
        'whale_alert_threshold_million': {'type': 'number', 'nullable': True},
        'current_price': {'type': 'number', 'nullable': True},
        'prev_price': {'type': 'number', 'nullable': True},
        'change_value': {'type': 'number', 'nullable': True},
        'change_pct': {'type': 'number', 'nullable': True},
        'last_date': {'type': 'string', 'nullable': True},
        'added_at': {'type': 'string', 'nullable': True},
        'updated_at': {'type': 'string', 'nullable': True},
    },
    'required': [
        'id', 'symbol', 'industry', 'company_name', 'market_cap_bn',
        'source_group_id', 'source_group_name', 'whale_alert_threshold_million',
        'current_price', 'prev_price', 'change_value', 'change_pct',
        'last_date', 'added_at', 'updated_at',
    ],
}

_TRACKED_SYMBOL_LIST_SCHEMA = {
    'type': 'array',
    'items': _TRACKED_SYMBOL_SCHEMA,
}

_TRACKED_SYMBOL_CREATE_REQUEST_SCHEMA = {
    'type': 'object',
    'properties': {
        'symbol': {'type': 'string', 'minLength': 1, 'maxLength': 10},
        'source_group_id': {'type': 'integer', 'nullable': True},
        'whale_alert_threshold_million': {'type': 'number', 'nullable': True, 'minimum': 1},
    },
    'required': ['symbol'],
}

_TRACKED_SYMBOL_PATCH_REQUEST_SCHEMA = {
    'type': 'object',
    'properties': {
        'source_group_id': {'type': 'integer', 'nullable': True},
        'whale_alert_threshold_million': {'type': 'number', 'nullable': True, 'minimum': 1},
    },
}

_TRACKED_SYMBOL_BULK_THRESHOLD_REQUEST_SCHEMA = {
    'type': 'object',
    'properties': {
        'tracked_symbol_ids': {
            'type': 'array',
            'items': {'type': 'integer'},
            'minItems': 1,
        },
        'whale_alert_threshold_million': {'type': 'number', 'nullable': True, 'minimum': 1},
    },
    'required': ['tracked_symbol_ids'],
}

_TRACKED_SYMBOL_BULK_THRESHOLD_RESPONSE_SCHEMA = {
    'type': 'object',
    'properties': {
        'updated_count': {'type': 'integer'},
        'rows': {
            'type': 'array',
            'items': _TRACKED_SYMBOL_SCHEMA,
        },
    },
    'required': ['updated_count', 'rows'],
}

_STOCK_PROFILE_SCHEMA = {
    'type': 'object',
    'properties': {
        'symbol': {'type': 'string'},
        'company_name': {'type': 'string'},
        'exchange': {'type': 'string', 'nullable': True},
        'industry': {'type': 'string', 'nullable': True},
        'status': {'type': 'string', 'nullable': True},
        'outstanding_shares': {'type': 'number', 'nullable': True},
    },
    'required': ['symbol', 'company_name', 'exchange', 'industry', 'status', 'outstanding_shares'],
}

_STOCK_OVERVIEW_SCHEMA = {
    'type': 'object',
    'properties': {
        'symbol': {'type': 'string'},
        'company_name': {'type': 'string'},
        'industry': {'type': 'string', 'nullable': True},
        'exchange': {'type': 'string', 'nullable': True},
        'current_price': {'type': 'number', 'nullable': True},
        'reference_price': {'type': 'number', 'nullable': True},
        'change_value': {'type': 'number', 'nullable': True},
        'change_pct': {'type': 'number', 'nullable': True},
        'volume': {'type': 'integer', 'nullable': True},
        'is_tracked': {'type': 'boolean'},
        'tracked_symbol_id': {'type': 'integer', 'nullable': True},
        'market_group_refs': {'type': 'array', 'items': {'type': 'object'}},
        'watchlist_memberships': {'type': 'array', 'items': {'type': 'object'}},
    },
    'required': [
        'symbol', 'company_name', 'industry', 'exchange', 'current_price', 'reference_price',
        'change_value', 'change_pct', 'volume', 'is_tracked', 'tracked_symbol_id',
        'market_group_refs', 'watchlist_memberships',
    ],
}

_STOCK_CHART_SCHEMA = {
    'type': 'object',
    'properties': {
        'symbol': {'type': 'string'},
        'days': {'type': 'integer'},
        'timeframe': {'type': 'string'},
        'interval': {'type': 'string'},
        'start_date': {'type': 'string'},
        'end_date': {'type': 'string'},
        'points': {'type': 'array', 'items': {'type': 'object'}},
        'technical': {'type': 'object'},
    },
    'required': ['symbol', 'days', 'timeframe', 'interval', 'start_date', 'end_date', 'points', 'technical'],
}

_STOCK_ORDER_FLOW_SCHEMA = {
    'type': 'object',
    'properties': {
        'symbol': {'type': 'string'},
        'window': {'type': 'string'},
        'session_date': {'type': 'string', 'nullable': True},
        'dark_flow': {'type': 'object'},
        'latest_signal': {'type': 'object', 'nullable': True},
        'signals': {'type': 'array', 'items': {'type': 'object'}},
        'tick_rate': {'type': 'object'},
        'size_distribution': {'type': 'object'},
        'order_flow': {'type': 'array', 'items': {'type': 'object'}},
    },
    'required': ['symbol', 'window', 'session_date', 'dark_flow', 'latest_signal', 'signals', 'tick_rate', 'size_distribution', 'order_flow'],
}

_STOCK_DARK_MONEY_HISTORY_SCHEMA = {
    'type': 'object',
    'properties': {
        'ok': {'type': 'boolean'},
        'symbol': {'type': 'string'},
        'period': {'type': 'string'},
        'interval': {'type': 'string'},
        'candles': {'type': 'array', 'items': {'type': 'object'}},
        'dark_flow_series': {'type': 'array', 'items': {'type': 'object'}},
        'whale_signals': {'type': 'array', 'items': {'type': 'object'}},
        'moving_averages': {'type': 'object'},
        'smfi': {'type': 'number'},
        'strategy_table': {'type': 'array', 'items': {'type': 'object'}},
    },
    'required': ['ok', 'symbol', 'period', 'interval', 'candles', 'dark_flow_series', 'whale_signals', 'moving_averages', 'smfi', 'strategy_table'],
}

_STOCK_NEWS_STUB_SCHEMA = {
    'type': 'object',
    'properties': {
        'symbol': {'type': 'string'},
        'news': {'type': 'array', 'items': {'type': 'object'}},
        'note': {'type': 'string'},
    },
    'required': ['symbol', 'news', 'note'],
}

_STOCK_NEWS_AI_SUMMARY_SCHEMA = {
    'type': 'object',
    'properties': {
        'symbol': {'type': 'string'},
        'summary': {'type': 'object', 'nullable': True},
        'note': {'type': 'string'},
    },
    'required': ['symbol', 'summary', 'note'],
}

_STOCK_FINANCIALS_SCHEMA = {
    'type': 'object',
    'properties': {
        'symbol': {'type': 'string'},
        'financials': {'type': 'object', 'nullable': True},
        'note': {'type': 'string'},
    },
    'required': ['symbol', 'financials', 'note'],
}

TENANT_PERMISSION_CLASSES = [permissions.IsAuthenticated, IsTenantActive]

_DARK_MONEY_PERIOD_DAYS = {
    '1M': 30,
    '3M': 90,
    '6M': 180,
    '1Y': 365,
    '10Y': 3650,
}

_DARK_MONEY_INTERVAL_ALIASES = {
    '1m': '1m',
    '5m': '5m',
    '15m': '15m',
    '30m': '30m',
    '1h': '1h',
    '4h': '4h',
    '1d': '1D',
    '1w': '1W',
}

_DARK_MONEY_INTRADAY_MAX_DAYS = {
    '1m': 1,
    '5m': 3,
    '15m': 7,
    '30m': 7,
    '1h': 14,
    '4h': 30,
}


def _to_float(value):
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_int(value):
    try:
        if value is None:
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _round_or_none(value, digits=2):
    if value is None:
        return None
    try:
        return round(float(value), digits)
    except (TypeError, ValueError):
        return None


def _resolve_user_tenant(user):
    tenant = getattr(user, 'core_tenant', None)
    if tenant is not None:
        return tenant
    profile = getattr(user, 'core_profile', None)
    if profile is not None and getattr(profile, 'tenant_id', None):
        return profile.tenant
    return None


def _watchlists_queryset_for_user(user):
    queryset = Watchlist.objects.filter(user=user)
    tenant = _resolve_user_tenant(user)
    if tenant is not None:
        queryset = queryset.filter(tenant=tenant)
    return queryset


def _watchlist_items_queryset_for_user(user):
    queryset = WatchlistItem.objects.filter(watchlist__user=user).select_related('watchlist')
    tenant = _resolve_user_tenant(user)
    if tenant is not None:
        queryset = queryset.filter(watchlist__tenant=tenant)
    return queryset


def _tracked_symbols_queryset_for_user(user):
    queryset = TrackedSymbol.objects.filter(user=user).select_related('source_watchlist')
    tenant = _resolve_user_tenant(user)
    if tenant is not None:
        queryset = queryset.filter(tenant=tenant)
    return queryset


def _price_alerts_queryset_for_user(user):
    queryset = PriceAlert.objects.filter(user=user)
    tenant = _resolve_user_tenant(user)
    if tenant is not None:
        queryset = queryset.filter(tenant=tenant)
    return queryset


def _group_sort_key(watchlist, group_meta_map=None):
    meta = (group_meta_map or {}).get(watchlist.name, {})
    return (
        meta.get('display_order', 999),
        str(watchlist.name or '').lower(),
        watchlist.pk or 0,
    )


def _load_group_meta_map() -> dict[str, dict]:
    """Batch-load group display metadata from CachedSymbolGroup (DB).

    Returns: {group_name: {group_type, color, display_order}}
    Falls back to default_groups.py if DB is empty (first deploy / no sync yet).
    """
    try:
        from service_ops.models import CachedSymbolGroup
        groups = CachedSymbolGroup.objects.filter(is_active=True).values(
            'group_name', 'group_type', 'color', 'display_order',
        )
        if groups:
            return {
                g['group_name']: {
                    'group_type': g['group_type'],
                    'color': g['color'],
                    'display_order': g['display_order'],
                }
                for g in groups
            }
    except Exception:
        pass
    # Fallback: read from default_groups.py if CachedSymbolGroup is empty
    return {
        g['name']: {
            'group_type': g.get('group_type', 'CUSTOM'),
            'color': g.get('color', ''),
            'display_order': g.get('order', 999),
        }
        for g in _STOCK_MANAGEMENT_DEFAULT_GROUPS
    }


def _validate_stock_symbol(raw_symbol):
    symbol = str(raw_symbol or '').upper().strip()
    if not symbol:
        raise ValueError('Thiếu mã chứng khoán.')
    if not symbol.isalnum() or len(symbol) > 10:
        raise ValueError('Mã chứng khoán không hợp lệ. Chỉ chấp nhận 1-10 ký tự chữ in hoa và số.')
    if (
        StockProfile.objects.exists()
        and not StockProfile.objects.filter(symbol=symbol).exists()
        and not DailyPrice.objects.filter(symbol=symbol).exists()
        and not IntradayBar.objects.filter(symbol=symbol).exists()
        and _fetch_symbol_snapshot_payload(symbol) is None
    ):
        raise ValueError(f'Mã {symbol} không tồn tại trong hệ thống. Vui lòng kiểm tra lại mã chứng khoán.')
    return symbol


def _parse_tracked_symbol_threshold_million(raw_value):
    if raw_value in (None, ''):
        return None
    try:
        resolved = Decimal(str(raw_value))
    except Exception as exc:
        raise ValueError('Ngưỡng whale riêng phải là số >= 1 (triệu VNĐ).') from exc
    if resolved < Decimal('1'):
        raise ValueError('Ngưỡng whale riêng phải là số >= 1 (triệu VNĐ).')
    return resolved


def _parse_price_alert_condition(raw_value):
    condition = str(raw_value or 'ABOVE').upper().strip()
    allowed = {
        PriceAlert.AlertType.ABOVE,
        PriceAlert.AlertType.BELOW,
        PriceAlert.AlertType.EQUAL,
    }
    if condition not in allowed:
        raise ValueError('condition phải là ABOVE, BELOW hoặc EQUAL.')
    return condition


def _parse_price_alert_target(raw_value):
    try:
        target = Decimal(str(raw_value))
    except Exception as exc:
        raise ValueError('target_price phải là số > 0.') from exc
    if target <= 0:
        raise ValueError('target_price phải là số > 0.')
    return target


def _parse_cooldown_seconds(raw_value):
    if raw_value in (None, ''):
        return 300
    try:
        cooldown = int(raw_value)
    except (TypeError, ValueError) as exc:
        raise ValueError('cooldown_seconds phải là số nguyên >= 0.') from exc
    if cooldown < 0:
        raise ValueError('cooldown_seconds phải là số nguyên >= 0.')
    return cooldown


def _build_price_change_map(symbols):
    from market_serving.models import SymbolSnapshot

    normalized_symbols = []
    seen_symbols = set()
    for raw_symbol in symbols:
        symbol = str(raw_symbol or '').upper().strip()
        if not symbol or symbol in seen_symbols:
            continue
        seen_symbols.add(symbol)
        normalized_symbols.append(symbol)
    if not normalized_symbols:
        return {}

    snapshot_rows = list(
        SymbolSnapshot.objects.filter(symbol__in=normalized_symbols)
        .values('symbol', 'session_date', 'price', 'price_change', 'price_change_pct', 'stale', 'fetched_at')
        .order_by('symbol', '-session_date', '-fetched_at')
    )
    latest_snapshots = {}
    for row in snapshot_rows:
        latest_snapshots.setdefault(row['symbol'], row)

    daily_rows = list(
        DailyPrice.objects.filter(symbol__in=normalized_symbols)
        .values('symbol', 'date', 'close')
        .order_by('symbol', '-date')
    )
    latest_daily_rows = {}
    for row in daily_rows:
        bucket = latest_daily_rows.setdefault(row['symbol'], [])
        if len(bucket) < 2:
            bucket.append(row)

    payload = {}
    for symbol in normalized_symbols:
        snapshot = latest_snapshots.get(symbol)
        daily_bucket = latest_daily_rows.get(symbol, [])
        latest_daily = daily_bucket[0] if daily_bucket else None
        previous_daily = daily_bucket[1] if len(daily_bucket) > 1 else None

        current_price = _to_float(snapshot.get('price')) if snapshot else _to_float(latest_daily.get('close') if latest_daily else None)
        prev_price = None
        change_value = _to_float(snapshot.get('price_change')) if snapshot else None
        change_pct = _to_float(snapshot.get('price_change_pct')) if snapshot else None
        stale = bool(snapshot.get('stale')) if snapshot else False

        if current_price is not None and change_value is not None:
            prev_price = current_price - change_value
        if prev_price is None and previous_daily is not None:
            prev_price = _to_float(previous_daily.get('close'))
        if change_value is None and current_price is not None and prev_price not in (None, 0):
            change_value = current_price - prev_price
        if change_pct is None and change_value is not None and prev_price not in (None, 0):
            change_pct = (change_value / prev_price) * 100

        last_date = None
        if snapshot and snapshot.get('session_date') is not None:
            last_date = snapshot['session_date'].isoformat()
        elif latest_daily and latest_daily.get('date') is not None:
            last_date = latest_daily['date'].isoformat()

        payload[symbol] = {
            'current_price': _round_or_none(current_price),
            'prev_price': _round_or_none(prev_price),
            'change_value': _round_or_none(change_value),
            'change_pct': _round_or_none(change_pct),
            'last_date': last_date,
            'stale': stale,
        }
    return payload


def _build_profile_map(symbols, price_map):
    normalized_symbols = [str(symbol or '').upper().strip() for symbol in symbols if str(symbol or '').strip()]
    if not normalized_symbols:
        return {}

    rows = StockProfile.objects.filter(symbol__in=normalized_symbols).values(
        'symbol',
        'industry',
        'company_name',
        'outstanding_shares',
    )
    payload = {}
    for row in rows:
        current_price = _to_float(price_map.get(row['symbol'], {}).get('current_price'))
        outstanding_shares = _to_float(row.get('outstanding_shares'))
        market_cap_bn = None
        if current_price is not None and outstanding_shares is not None:
            market_cap_bn = round((current_price * outstanding_shares) / 1_000_000_000, 2)
        payload[row['symbol']] = {
            'industry': row.get('industry') or 'Khác',
            'company_name': row.get('company_name') or row['symbol'],
            'market_cap_bn': market_cap_bn,
        }
    return payload


def _serialize_stock_management_item(item, price_map):
    info = price_map.get(item.symbol, {})
    return {
        'id': item.pk,
        'symbol': item.symbol,
        'note': getattr(item, 'note', '') or '',
        'current_price': info.get('current_price'),
        'prev_price': info.get('prev_price'),
        'change_value': info.get('change_value'),
        'change_pct': info.get('change_pct'),
        'last_date': info.get('last_date'),
    }


def _serialize_stock_management_group(watchlist, index, price_map, group_meta_map=None):
    meta = (group_meta_map or {}).get(watchlist.name, {})
    color = meta.get('color') or _STOCK_MANAGEMENT_COLOR_PALETTE[index % len(_STOCK_MANAGEMENT_COLOR_PALETTE)]
    group_type = meta.get('group_type') or 'CUSTOM'
    order = meta.get('display_order') or (index + 1)
    return {
        'id': watchlist.pk,
        'name': watchlist.name,
        'group_type': group_type,
        'description': watchlist.description,
        'color': color,
        'order': order,
        'items': [_serialize_stock_management_item(item, price_map) for item in watchlist.items.all()],
    }


def _group_sort_key_cached(group, group_meta_map=None):
    meta = (group_meta_map or {}).get(group.group_name, {})
    return (
        meta.get('display_order', 999),
        str(group.group_name or '').lower(),
        group.pk or 0,
    )


def _serialize_cached_group(group, index, price_map, group_meta_map=None):
    meta = (group_meta_map or {}).get(group.group_name, {})
    color = meta.get('color') or _STOCK_MANAGEMENT_COLOR_PALETTE[index % len(_STOCK_MANAGEMENT_COLOR_PALETTE)]
    group_type = group.group_type or meta.get('group_type') or 'CUSTOM'
    order = group.display_order or meta.get('display_order') or (index + 1)
    return {
        'id': group.pk,
        'name': group.group_name,
        'group_type': group_type,
        'description': group.description,
        'color': color,
        'order': order,
        'items': [_serialize_stock_management_item(m, price_map) for m in group.members.all()],
    }


def _get_cached_group_or_404(group_id):
    group = CachedSymbolGroup.objects.filter(pk=group_id).prefetch_related('members').first()
    if group is None:
        raise NotFound('Không tìm thấy nhóm.')
    return group


def _serialize_tracked_symbol_row(tracked_symbol, price_map, profile_map):
    symbol = tracked_symbol.symbol
    info = price_map.get(symbol, {})
    profile = profile_map.get(symbol, {})
    source_watchlist = tracked_symbol.source_watchlist
    return {
        'id': tracked_symbol.pk,
        'symbol': symbol,
        'industry': profile.get('industry') or 'Khác',
        'company_name': profile.get('company_name') or symbol,
        'market_cap_bn': profile.get('market_cap_bn'),
        'source_group_id': source_watchlist.pk if source_watchlist else None,
        'source_group_name': source_watchlist.name if source_watchlist else None,
        'whale_alert_threshold_million': _to_float(tracked_symbol.whale_alert_threshold_million),
        'current_price': info.get('current_price'),
        'prev_price': info.get('prev_price'),
        'change_value': info.get('change_value'),
        'change_pct': info.get('change_pct'),
        'last_date': info.get('last_date'),
        'added_at': tracked_symbol.added_at.isoformat() if tracked_symbol.added_at else None,
        'updated_at': tracked_symbol.updated_at.isoformat() if tracked_symbol.updated_at else None,
    }


def _serialize_price_alert_row(alert, price_map):
    info = price_map.get(alert.symbol, {})
    current_price = _to_float(info.get('current_price'))
    target_price = _to_float(alert.price_threshold)
    is_active = bool(alert.is_enabled) and alert.status != PriceAlert.AlertStatus.DISABLED
    is_triggered = False
    if current_price is not None and target_price is not None:
        if alert.alert_type == PriceAlert.AlertType.ABOVE:
            is_triggered = current_price >= target_price
        elif alert.alert_type == PriceAlert.AlertType.BELOW:
            is_triggered = current_price <= target_price
        else:
            is_triggered = current_price == target_price
    return {
        'id': alert.pk,
        'symbol': alert.symbol,
        'condition': alert.alert_type,
        'target_price': target_price,
        'cooldown_seconds': int(alert.cooldown_seconds or 0),
        'is_active': is_active,
        'last_triggered_at': alert.last_triggered_at.isoformat() if alert.last_triggered_at else None,
        'created_at': alert.created_at.isoformat() if alert.created_at else None,
        'updated_at': alert.updated_at.isoformat() if alert.updated_at else None,
        'current_price': current_price,
        'stale': bool(info.get('stale', False)),
        'is_triggered': is_triggered,
    }


def _get_watchlist_or_404_for_user(user, group_id):
    watchlist = _watchlists_queryset_for_user(user).prefetch_related('items').filter(pk=group_id).first()
    if watchlist is None:
        raise NotFound('Không tìm thấy nhóm.')
    return watchlist


def _get_watchlist_item_or_404_for_user(user, item_id):
    item = _watchlist_items_queryset_for_user(user).filter(pk=item_id).first()
    if item is None:
        raise NotFound('Không tìm thấy mã trong nhóm.')
    return item


def _get_tracked_symbol_or_404_for_user(user, tracked_symbol_id):
    tracked_symbol = _tracked_symbols_queryset_for_user(user).filter(pk=tracked_symbol_id).first()
    if tracked_symbol is None:
        raise NotFound('Không tìm thấy mã theo dõi.')
    return tracked_symbol


def _get_price_alert_or_404_for_user(user, alert_id):
    alert = _price_alerts_queryset_for_user(user).filter(pk=alert_id).first()
    if alert is None:
        raise NotFound('Không tìm thấy cảnh báo giá.')
    return alert


def _default_chart_technical_payload():
    return {
        'bias': 'neutral',
        'bias_label': 'Trung tính',
        'bias_description': 'Chưa đủ dữ liệu để đánh giá xu hướng.',
        'sma20': None,
        'sma50': None,
        'rsi14': None,
        'avg_volume_20': None,
        'price_vs_sma20_pct': None,
        'price_vs_sma50_pct': None,
        'momentum_20d_pct': None,
        'range_position_pct': None,
        'latest_close': None,
        'rvol': None,
    }


def _compute_rsi14(closes):
    if len(closes) < 15:
        return None
    deltas = [current - previous for previous, current in zip(closes[:-1], closes[1:])]
    window = deltas[-14:]
    gains = [delta for delta in window if delta > 0]
    losses = [-delta for delta in window if delta < 0]
    avg_gain = sum(gains) / 14
    avg_loss = sum(losses) / 14
    if avg_loss == 0:
        return 100.0
    relative_strength = avg_gain / avg_loss
    return 100 - (100 / (1 + relative_strength))


def _compute_chart_technical_payload(points):
    payload = _default_chart_technical_payload()
    closes = [_to_float(point.get('close')) for point in points if _to_float(point.get('close')) is not None]
    volumes = [_to_float(point.get('volume')) for point in points if _to_float(point.get('volume')) is not None]
    if not closes:
        return payload

    latest_close = closes[-1]
    sma20 = sum(closes[-20:]) / min(len(closes), 20)
    sma50 = sum(closes[-50:]) / min(len(closes), 50)
    avg_volume_20 = sum(volumes[-20:]) / min(len(volumes), 20) if volumes else None
    rsi14 = _compute_rsi14(closes)
    rvol = volumes[-1] / avg_volume_20 if volumes and avg_volume_20 else None

    low_values = [_to_float(point.get('low')) for point in points if _to_float(point.get('low')) is not None]
    high_values = [_to_float(point.get('high')) for point in points if _to_float(point.get('high')) is not None]
    session_low = min(low_values) if low_values else None
    session_high = max(high_values) if high_values else None

    momentum_base = closes[-21] if len(closes) >= 21 else None
    momentum_20d_pct = None
    if momentum_base not in (None, 0):
        momentum_20d_pct = ((latest_close - momentum_base) / momentum_base) * 100

    range_position_pct = None
    if session_low is not None and session_high is not None and session_high > session_low:
        range_position_pct = ((latest_close - session_low) / (session_high - session_low)) * 100

    bias = 'neutral'
    bias_label = 'Trung tính'
    bias_description = 'Động lượng giá đang cân bằng.'
    if latest_close >= sma20 and sma20 >= sma50:
        bias = 'bullish'
        bias_label = 'Tích cực'
        bias_description = 'Giá đang vận động phía trên SMA20 và SMA50.'
    elif latest_close <= sma20 and sma20 <= sma50:
        bias = 'bearish'
        bias_label = 'Tiêu cực'
        bias_description = 'Giá đang nằm dưới các đường trung bình quan trọng.'

    payload.update(
        {
            'bias': bias,
            'bias_label': bias_label,
            'bias_description': bias_description,
            'sma20': _round_or_none(sma20),
            'sma50': _round_or_none(sma50),
            'rsi14': _round_or_none(rsi14),
            'avg_volume_20': _round_or_none(avg_volume_20),
            'price_vs_sma20_pct': _round_or_none(((latest_close - sma20) / sma20) * 100 if sma20 not in (None, 0) else None),
            'price_vs_sma50_pct': _round_or_none(((latest_close - sma50) / sma50) * 100 if sma50 not in (None, 0) else None),
            'momentum_20d_pct': _round_or_none(momentum_20d_pct),
            'range_position_pct': _round_or_none(range_position_pct),
            'latest_close': _round_or_none(latest_close),
            'rvol': _round_or_none(rvol),
        }
    )
    return payload


def _build_watchlist_membership_payload(user, symbol):
    memberships = list(
        _watchlist_items_queryset_for_user(user).filter(symbol=symbol)
        .select_related('watchlist')
        .order_by('-added_at', '-pk')
    )
    tracked_symbol = (
        _tracked_symbols_queryset_for_user(user)
        .filter(symbol=symbol)
        .order_by('-added_at', '-pk')
        .first()
    )
    refs = []
    seen_group_ids = set()
    if tracked_symbol is not None and tracked_symbol.source_watchlist_id is not None:
        seen_group_ids.add(tracked_symbol.source_watchlist_id)
        refs.append({'id': tracked_symbol.source_watchlist_id, 'name': tracked_symbol.source_watchlist.name})
    for item in memberships:
        group_id = item.watchlist_id
        if group_id in seen_group_ids:
            continue
        seen_group_ids.add(group_id)
        refs.append({'id': group_id, 'name': item.watchlist.name})
    return {
        'tracked_symbol_id': tracked_symbol.pk if tracked_symbol is not None else (memberships[0].pk if memberships else None),
        'is_tracked': bool(tracked_symbol) or bool(memberships),
        'source_group_name': tracked_symbol.source_watchlist.name if tracked_symbol is not None and tracked_symbol.source_watchlist_id is not None else (memberships[0].watchlist.name if memberships else None),
        'market_groups': [entry['name'] for entry in refs],
        'watchlist_groups': [entry['name'] for entry in refs],
        'market_group_refs': refs,
        'watchlist_memberships': [
            {
                'item_id': item.pk,
                'group_id': item.watchlist_id,
                'group_name': item.watchlist.name,
            }
            for item in memberships
        ],
    }


def _normalize_timeframe(value):
    timeframe = str(value or '1H').strip()
    upper = timeframe.upper()
    alias_map = {
        '1M': '1m',
        '5M': '5m',
        '15M': '15m',
        '30M': '30m',
        '1H': '1H',
        '2H': '2H',
        '4H': '4H',
        'D': 'D',
        '1D': 'D',
        'W': 'W',
        '1W': 'W',
        'M': 'M',
        '1MO': 'M',
        'Y': 'Y',
        '1Y': 'Y',
    }
    return alias_map.get(upper, '1H')


def _interval_for_timeframe(timeframe):
    return {
        '1m': '1m',
        '5m': '5m',
        '15m': '15m',
        '30m': '30m',
        '1H': '1H',
        '2H': '2H',
        '4H': '4H',
        'D': '1D',
        'W': '1W',
        'M': '1M',
        'Y': '1M',
    }[timeframe]


def _serialize_price_point(point_dt, open_price, high_price, low_price, close_price, volume):
    return {
        'date': point_dt.isoformat(),
        'open': _to_float(open_price),
        'high': _to_float(high_price),
        'low': _to_float(low_price),
        'close': _to_float(close_price),
        'volume': _to_float(volume),
    }


def _aggregate_daily_rows(rows, timeframe):
    if timeframe == 'D':
        return [
            _serialize_price_point(datetime.combine(row.date, time.min), row.open, row.high, row.low, row.close, row.volume)
            for row in rows
        ]

    buckets = []
    current_bucket = None
    for row in rows:
        if timeframe == 'W':
            bucket_key = row.date.isocalendar()[:2]
        elif timeframe == 'M':
            bucket_key = (row.date.year, row.date.month)
        else:
            bucket_key = (row.date.year,)

        if current_bucket is None or current_bucket['key'] != bucket_key:
            current_bucket = {
                'key': bucket_key,
                'date': row.date,
                'open': row.open,
                'high': row.high,
                'low': row.low,
                'close': row.close,
                'volume': _to_int(row.volume) or 0,
            }
            buckets.append(current_bucket)
            continue

        current_bucket['date'] = row.date
        current_bucket['high'] = max(current_bucket['high'], row.high)
        current_bucket['low'] = min(current_bucket['low'], row.low)
        current_bucket['close'] = row.close
        current_bucket['volume'] += _to_int(row.volume) or 0

    return [
        _serialize_price_point(
            datetime.combine(bucket['date'], time.min),
            bucket['open'],
            bucket['high'],
            bucket['low'],
            bucket['close'],
            bucket['volume'],
        )
        for bucket in buckets
    ]


def _get_table_column_names(model):
    try:
        with connection.cursor() as cursor:
            description = connection.introspection.get_table_description(cursor, model._meta.db_table)
    except DatabaseError:
        return set()
    return {
        getattr(column, 'name', column[0])
        for column in description
    }


def _fetch_symbol_snapshot_payload(symbol):
    from market_serving.models import SymbolSnapshot

    available_columns = _get_table_column_names(SymbolSnapshot)
    if not {'symbol', 'session_date', 'price'}.issubset(available_columns):
        return None

    selected_fields = [
        field
        for field in [
            'symbol',
            'session_date',
            'price',
            'price_change',
            'price_change_pct',
            'volume',
            'reference_price',
            'ceiling',
            'floor',
            'open',
            'high',
            'low',
            'stale',
            'fetched_at',
        ]
        if field in available_columns
    ]
    order_by = [field for field in ['-session_date', '-fetched_at'] if field.lstrip('-') in available_columns]

    queryset = SymbolSnapshot.objects.filter(symbol=symbol)
    if order_by:
        queryset = queryset.order_by(*order_by)
    return queryset.values(*selected_fields).first()


def _symbol_exists_for_stock_chart(symbol):
    return (
        StockProfile.objects.filter(symbol=symbol).exists()
        or DailyPrice.objects.filter(symbol=symbol).exists()
        or IntradayBar.objects.filter(symbol=symbol).exists()
    )


def _normalize_order_flow_window(value):
    resolved = str(value or '30m').strip().lower()
    window_map = {
        '5m': 5,
        '15m': 15,
        '30m': 30,
        '1h': 60,
    }
    if resolved not in window_map:
        return '30m', 30
    return resolved, window_map[resolved]


def _normalize_dark_money_interval(value):
    return _DARK_MONEY_INTERVAL_ALIASES.get(str(value or '').strip().lower(), '1D')


def _normalize_dark_money_period(value):
    raw = str(value or '3M').strip().upper()
    return raw if raw in _DARK_MONEY_PERIOD_DAYS else '3M'


def _to_unix_seconds(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        dt_value = value
    else:
        return None
    if dt_value.tzinfo is None:
        dt_value = timezone.make_aware(dt_value, timezone=timezone.get_current_timezone())
    return int(dt_value.timestamp())


def _floor_dark_money_bucket(dt_value, interval):
    if interval == '1h':
        return dt_value.replace(minute=0, second=0, microsecond=0)
    if interval == '30m':
        return dt_value.replace(minute=(dt_value.minute // 30) * 30, second=0, microsecond=0)
    if interval == '15m':
        return dt_value.replace(minute=(dt_value.minute // 15) * 15, second=0, microsecond=0)
    if interval == '5m':
        return dt_value.replace(minute=(dt_value.minute // 5) * 5, second=0, microsecond=0)
    if interval == '1m':
        return dt_value.replace(second=0, microsecond=0)
    if interval == '4h':
        return dt_value.replace(hour=(dt_value.hour // 4) * 4, minute=0, second=0, microsecond=0)
    return dt_value


def _compute_simple_moving_average(candles, window):
    key = f'ma{window}'
    result = []
    closes = [float(c.get('close') or 0) for c in candles]
    times = [c.get('time') for c in candles]
    for idx in range(len(closes)):
        if idx < window - 1:
            continue
        window_slice = closes[idx - window + 1: idx + 1]
        result.append({'time': times[idx], 'value': round(sum(window_slice) / len(window_slice), 2)})
    return key, result


def _build_dark_money_strategy_table(latest_strength, latest_signal_type):
    active_id = 'standby'
    if latest_strength >= 60 and latest_signal_type == 'whale_buy':
        active_id = 'allin'
    elif latest_strength >= 35 and latest_signal_type in {'whale_buy', 'dark_flow'}:
        active_id = 'accumulate'
    elif latest_signal_type in {'whale_sell', 'signal_sell'}:
        active_id = 'distribute'

    rows = [
        {'id': 'allin', 'label': 'All-in', 'meaning': 'Dong tien lon xac nhan xu huong', 'risk_level': 'low', 'is_active': active_id == 'allin'},
        {'id': 'accumulate', 'label': 'Accumulate', 'meaning': 'Co dau hieu gom hang', 'risk_level': 'medium', 'is_active': active_id == 'accumulate'},
        {'id': 'distribute', 'label': 'Distribute', 'meaning': 'Dau hieu phan phoi tang len', 'risk_level': 'high', 'is_active': active_id == 'distribute'},
        {'id': 'standby', 'label': 'Standby', 'meaning': 'Tin hieu yeu, uu tien quan sat', 'risk_level': 'none', 'is_active': active_id == 'standby'},
    ]
    return rows


def _safe_numeric(value):
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _extract_signal_strength(alert):
    metadata = alert.metadata if isinstance(alert.metadata, dict) else {}
    evidence = alert.evidence if isinstance(alert.evidence, dict) else {}
    raw_strength = (
        _safe_numeric(metadata.get('strength'))
        or _safe_numeric(metadata.get('whale_intensity'))
        or _safe_numeric(evidence.get('whale_intensity'))
    )
    if raw_strength is None:
        raw_strength = _safe_numeric(alert.confidence)
    if raw_strength is None:
        return 0.0
    if raw_strength <= 1:
        raw_strength *= 100
    return round(max(0.0, min(100.0, raw_strength)), 1)


def _build_tick_distribution_payload(symbol, window_minutes):
    now = timezone.now()
    window_start = now - timedelta(minutes=window_minutes)
    tick_rows = list(
        IntradayTick.objects.filter(symbol=symbol, timestamp__gte=window_start)
        .only('timestamp', 'volume')
        .order_by('-timestamp')
    )

    stale = False
    if not tick_rows:
        latest_tick = (
            IntradayTick.objects.filter(symbol=symbol)
            .only('timestamp')
            .order_by('-timestamp')
            .first()
        )
        if latest_tick is not None:
            stale = True
            trade_date = timezone.localdate(latest_tick.timestamp)
            tick_rows = list(
                IntradayTick.objects.filter(symbol=symbol, timestamp__date=trade_date)
                .only('timestamp', 'volume')
                .order_by('-timestamp')[:500]
            )

    if not tick_rows:
        return {
            'stale': True,
            'tick_rate_per_min': 0.0,
            'small_order_ratio': 0.0,
            'size_distribution': {
                'small_count': 0,
                'medium_count': 0,
                'large_count': 0,
                'small_ratio': 0.0,
                'medium_ratio': 0.0,
                'large_ratio': 0.0,
            },
        }

    timestamps = [row.timestamp for row in tick_rows]
    max_ts = max(timestamps)
    min_ts = min(timestamps)
    span_minutes = max((max_ts - min_ts).total_seconds() / 60.0, 1.0)
    volumes = [max(0, int(row.volume or 0)) for row in tick_rows]
    sorted_volumes = sorted(volumes)
    q33_idx = min(len(sorted_volumes) - 1, max(0, int((len(sorted_volumes) - 1) * 0.33)))
    q66_idx = min(len(sorted_volumes) - 1, max(0, int((len(sorted_volumes) - 1) * 0.66)))
    q33 = sorted_volumes[q33_idx]
    q66 = sorted_volumes[q66_idx]

    small_count = sum(1 for volume in volumes if volume <= q33)
    medium_count = sum(1 for volume in volumes if q33 < volume <= q66)
    large_count = sum(1 for volume in volumes if volume > q66)
    total = len(volumes)

    return {
        'stale': stale,
        'tick_rate_per_min': round(total / span_minutes, 2),
        'small_order_ratio': round(small_count / total, 4) if total else 0.0,
        'size_distribution': {
            'small_count': small_count,
            'medium_count': medium_count,
            'large_count': large_count,
            'small_ratio': round(small_count / total, 4) if total else 0.0,
            'medium_ratio': round(medium_count / total, 4) if total else 0.0,
            'large_ratio': round(large_count / total, 4) if total else 0.0,
        },
    }


def _serialize_stock_order_flow_signal(alert, tick_rate_per_min, small_order_ratio):
    metadata = alert.metadata if isinstance(alert.metadata, dict) else {}
    signal_type = str(metadata.get('signal_type') or alert.alert_type or 'signal').lower()
    
    # Standardize signal types for frontend taxonomy parity
    if signal_type == 'system' and str(alert.source_ref or '').startswith('stale_quote:'):
        signal_type = 'stale_quote'
    elif signal_type == 'signal':
        if str(alert.source_ref or '').startswith('market_anomaly:'):
            signal_type = 'price_shock'
        elif isinstance(alert.evidence, dict) and alert.evidence.get('price_change_pct') is not None:
            signal_type = 'price_shock'

    confidence = _safe_numeric(metadata.get('confidence'))
    if confidence is None:
        confidence = _safe_numeric(alert.confidence)
    return {
        'id': str(alert.alert_id),
        'symbol': alert.symbol,
        'signal_type': signal_type,
        'strength': _extract_signal_strength(alert),
        'confidence': round(confidence, 2) if confidence is not None else 0.0,
        'tick_rate': tick_rate_per_min,
        'small_order_ratio': small_order_ratio,
        'description': alert.title or alert.body or '',
        'created_at': alert.triggered_at.isoformat() if alert.triggered_at else None,
        'direction': alert.direction,
        'value': str(alert.value) if alert.value is not None else None,
    }


# ---------------------------------------------------------------------------
# Stock data views
# ---------------------------------------------------------------------------


from vninvest_core.pagination import CoreCursorPagination

class StockManagementStockListCursorPagination(CoreCursorPagination):
    ordering = 'symbol'
    page_size = 100

class StockManagementStockListView(APIView):
    """GET /api/stock-management/stocks/ — native stock catalog search."""

    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StockManagementStockListCursorPagination

    def get(self, request):
        search = str(request.query_params.get('search') or request.query_params.get('q') or '').strip()
        if search and len(search) == 3 and search.isalpha():
            search_upper = search.upper()
            if not StockProfile.objects.filter(symbol=search_upper).exists():
                from django.core.cache import cache
                from market_data.vnbroker_adapter import fetch_listing_symbols
                try:
                    # Cache listing symbols for 1 hour to avoid repeated provider calls
                    cache_key = 'vnbroker_listing_symbols_cache'
                    listings = cache.get(cache_key)
                    if listings is None:
                        listings = fetch_listing_symbols()
                        cache.set(cache_key, listings, timeout=3600)
                    match = next((item for item in listings if item.get('symbol') == search_upper), None)
                    if match:
                        StockProfile.objects.get_or_create(
                            symbol=search_upper,
                            defaults={
                                'exchange': match.get('exchange', 'HOSE') or 'HOSE',
                                'company_name': match.get('company_name', '') or '',
                                'industry': match.get('industry', '') or '',
                                'status': StockProfile.StatusChoices.ACTIVE
                            }
                        )
                except Exception as e:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.error(f"Error seeding stock profile for search {search_upper}: {e}")

        qs = StockProfile.objects.filter(status=StockProfile.StatusChoices.ACTIVE).order_by('symbol')
        if search:
            qs = qs.filter(
                Q(symbol__icontains=search)
                | Q(company_name__icontains=search)
                | Q(industry__icontains=search)
            )

        exchange = str(request.query_params.get('exchange') or '').strip().upper()
        if exchange:
            qs = qs.filter(exchange=exchange)

        industry = str(request.query_params.get('industry') or '').strip()
        if industry:
            qs = qs.filter(industry__icontains=industry)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request)
        if page is not None:
            results = [
                {
                    'symbol': profile.symbol,
                    'company_name': profile.company_name,
                    'industry': profile.industry,
                    'exchange': profile.exchange,
                    'listed_date': None,
                    'is_active': profile.status == StockProfile.StatusChoices.ACTIVE,
                    'updated_at': profile.updated_at.isoformat() if profile.updated_at else None,
                    'status': profile.status,
                    'outstanding_shares': profile.outstanding_shares,
                }
                for profile in page
            ]
            # Bọc cả khối phân trang. `dict(paged.data)` vì paginator trả
            # `Response`, không trả dict. Phải bọc GIỐNG nhánh fallback dưới.
            return paginated_envelope(dict(paginator.get_paginated_response(results).data))

        results = [
            {
                'symbol': profile.symbol,
                'company_name': profile.company_name,
                'industry': profile.industry,
                'exchange': profile.exchange,
                'listed_date': None,
                'is_active': profile.status == StockProfile.StatusChoices.ACTIVE,
                'updated_at': profile.updated_at.isoformat() if profile.updated_at else None,
                'status': profile.status,
                'outstanding_shares': profile.outstanding_shares,
            }
            for profile in qs
        ]
        return paginated_envelope({'results': results})


class StockManagementTechnicalsView(APIView):
    """GET /api/stock-management/technicals/bulk/?symbols=VCB,HPG"""
    permission_classes = [permissions.IsAuthenticated]

    _MAX_SYMBOLS = 200

    def _parse_symbols(self, request):
        query_symbols = str(request.query_params.get('symbols', '') or '').strip()
        body_symbols = request.data.get('symbols') if hasattr(request, 'data') else None

        if isinstance(body_symbols, list):
            raw = [str(item or '').strip() for item in body_symbols]
        elif isinstance(body_symbols, str) and body_symbols.strip():
            raw = [item.strip() for item in body_symbols.split(',')]
        elif query_symbols:
            raw = [item.strip() for item in query_symbols.split(',')]
        else:
            raw = []

        symbols = []
        seen = set()
        for item in raw:
            symbol = item.upper()
            if not symbol or symbol in seen:
                continue
            seen.add(symbol)
            symbols.append(symbol)
            if len(symbols) >= self._MAX_SYMBOLS:
                break
        return symbols

    def _build_response(self, symbols):
        if not symbols:
            return envelope({
                'technicals': [],
                'results': [],
                'requested_count': 0,
                'resolved_count': 0,
            })

        from market_serving.models import SymbolSnapshot

        today = timezone.localdate()
        lookback_start = today - timedelta(days=180)
        history_rows = list(
            DailyPrice.objects.filter(
                symbol__in=symbols,
                date__gte=lookback_start,
                date__lte=today,
            )
            .order_by('symbol', '-date')
            .values('symbol', 'date', 'open', 'high', 'low', 'close', 'volume')
        )
        history_by_symbol = {symbol: [] for symbol in symbols}
        for row in history_rows:
            normalized_symbol = str(row.get('symbol') or '').upper()
            if normalized_symbol in history_by_symbol:
                history_by_symbol[normalized_symbol].append(row)

        snapshot_rows = SymbolSnapshot.objects.filter(symbol__in=symbols).order_by(
            'symbol',
            '-session_date',
            '-fetched_at',
            '-pk',
        )
        snapshots_by_symbol = {}
        for snapshot_row in snapshot_rows:
            normalized_symbol = str(snapshot_row.symbol or '').upper()
            if normalized_symbol and normalized_symbol not in snapshots_by_symbol:
                snapshots_by_symbol[normalized_symbol] = snapshot_row

        results = []
        for sym in symbols:
            symbol_history_desc = history_by_symbol.get(sym, [])
            latest_daily = symbol_history_desc[0] if symbol_history_desc else None
            previous_daily = symbol_history_desc[1] if len(symbol_history_desc) > 1 else None
            symbol_points = [
                {
                    'open': row.get('open'),
                    'high': row.get('high'),
                    'low': row.get('low'),
                    'close': row.get('close'),
                    'volume': row.get('volume'),
                }
                for row in reversed(symbol_history_desc[:60])
            ]
            technical_payload = (
                _compute_chart_technical_payload(symbol_points)
                if symbol_points
                else _default_chart_technical_payload()
            )

            snapshot_row = snapshots_by_symbol.get(sym)
            price_value = _to_float(getattr(snapshot_row, 'price', None)) if snapshot_row else _to_float(latest_daily.get('close') if latest_daily else None)
            change_value = _to_float(getattr(snapshot_row, 'price_change', None)) if snapshot_row else None
            change_pct = _to_float(getattr(snapshot_row, 'price_change_pct', None)) if snapshot_row else None

            latest_close = _to_float(latest_daily.get('close') if latest_daily else None)
            previous_close = _to_float(previous_daily.get('close') if previous_daily else None)
            if change_value is None and latest_close is not None and previous_close not in (None, 0):
                change_value = latest_close - previous_close
            if change_pct is None and change_value is not None and previous_close not in (None, 0):
                change_pct = (change_value / previous_close) * 100

            volume_value = _to_int(getattr(snapshot_row, 'volume', None)) if snapshot_row else _to_int(latest_daily.get('volume') if latest_daily else None)
            stale_value = bool(getattr(snapshot_row, 'stale', False)) if snapshot_row is not None else latest_daily is None

            results.append({
                'symbol': sym,
                'date': str(latest_daily.get('date')) if latest_daily else None,
                'price': _round_or_none(price_value),
                'price_change': _round_or_none(change_value),
                'price_change_pct': _round_or_none(change_pct),
                'volume': volume_value,
                'stale': stale_value,
                'bias': technical_payload.get('bias'),
                'bias_label': technical_payload.get('bias_label'),
                'bias_description': technical_payload.get('bias_description'),
                'sma20': technical_payload.get('sma20'),
                'sma50': technical_payload.get('sma50'),
                'rsi14': technical_payload.get('rsi14'),
                'rsi_14': technical_payload.get('rsi14'),
                'ma20_distance_pct': technical_payload.get('price_vs_sma20_pct'),
                'rvol': technical_payload.get('rvol'),
                'updated_at': timezone.now().isoformat(),
                'avg_volume_20': technical_payload.get('avg_volume_20'),
                'price_vs_sma20_pct': technical_payload.get('price_vs_sma20_pct'),
                'price_vs_sma50_pct': technical_payload.get('price_vs_sma50_pct'),
                'momentum_20d_pct': technical_payload.get('momentum_20d_pct'),
                'range_position_pct': technical_payload.get('range_position_pct'),
                'latest_close': technical_payload.get('latest_close') if technical_payload.get('latest_close') is not None else _round_or_none(latest_close),
            })
        return envelope({
            'technicals': results,
            'results': results,
            'requested_count': len(symbols),
            'resolved_count': len(results),
        })

    @extend_schema(
        summary='Lấy technical indicators theo danh sách symbol',
        description=(
            'Endpoint native `/core/v1/market-data/technicals/bulk/`. '
            'Trả về payload technicals dùng cho lower-deck dashboard, '
            'đồng thời giữ tương thích với cả envelope `technicals` và `results`.'
        ),
        parameters=[
            OpenApiParameter(
                name='symbols',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description='Danh sách mã dạng CSV, ví dụ `TPB,FPT,VCB`.',
                required=True,
            ),
        ],
        responses={
            200: envelope_response(),
            401: OpenApiTypes.OBJECT,
        },
        examples=[
            OpenApiExample(
                'Technicals bulk',
                value={
                    'technicals': [
                        {
                            'symbol': 'TPB',
                            'price': 18.45,
                            'price_change_pct': 2.5,
                            'rsi_14': 63.4,
                            'sma20': 18.02,
                            'sma50': 17.48,
                            'momentum_20d_pct': 4.8,
                            'stale': False,
                        }
                    ],
                    'results': [
                        {
                            'symbol': 'TPB',
                            'price': 18.45,
                            'price_change_pct': 2.5,
                            'rsi_14': 63.4,
                            'sma20': 18.02,
                            'sma50': 17.48,
                            'momentum_20d_pct': 4.8,
                            'stale': False,
                        }
                    ],
                    'requested_count': 1,
                    'resolved_count': 1,
                },
            ),
        ],
    )
    def get(self, request):
        symbols = self._parse_symbols(request)
        return self._build_response(symbols)

    def post(self, request):
        symbols = self._parse_symbols(request)
        return self._build_response(symbols)


class StockManagementDetailView(APIView):
    """GET /api/stock-management/stocks/<symbol>/ — stock profile detail."""
    permission_classes = TENANT_PERMISSION_CLASSES

    @extend_schema(
        summary='Lấy hồ sơ mã cổ phiếu native',
        description='Endpoint native `/core/v1/stock-management/stocks/{symbol}/` trả về hồ sơ cơ bản của mã chứng khoán.',
        responses={
            200: envelope_response(),
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
            404: OpenApiTypes.OBJECT,
        },
    )

    def get(self, request, symbol):
        symbol = symbol.upper()
        try:
            profile = StockProfile.objects.get(symbol=symbol)
        except StockProfile.DoesNotExist:
            from market_data.vnbroker_adapter import fetch_listing_symbols
            try:
                listings = fetch_listing_symbols()
                match = next((item for item in listings if item.get('symbol') == symbol), None)
                if not match:
                    raise NotFound(f'Stock not found: {symbol}')
                profile = StockProfile.objects.create(
                    symbol=symbol,
                    exchange=match.get('exchange', 'HOSE') or 'HOSE',
                    company_name=match.get('company_name', '') or '',
                    industry=match.get('industry', '') or '',
                    status=StockProfile.StatusChoices.ACTIVE
                )
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Error dynamically creating StockProfile for {symbol}: {e}")
                raise NotFound(f'Stock not found: {symbol}')

        metadata = profile.metadata or {}
        cache_valid = False
        if 'updated_at' in metadata:
            try:
                updated_at = timezone.datetime.fromisoformat(metadata['updated_at'])
                if timezone.now() - updated_at < timezone.timedelta(days=1):
                    cache_valid = True
            except (ValueError, TypeError):
                pass

        if not cache_valid:
            from market_data.vnbroker_adapter import fetch_company_info
            info = fetch_company_info(symbol, source='KBS')
            metadata.update({
                'overview': info.get('overview', {}),
                'officers': info.get('officers', []),
                'shareholders': info.get('shareholders', []),
                'events': info.get('events', []),
                'updated_at': timezone.now().isoformat(),
            })
            profile.metadata = metadata
            profile.save(update_fields=['metadata'])

        return envelope({
            'symbol': profile.symbol,
            'company_name': profile.company_name or metadata.get('overview', {}).get('company_name', ''),
            'exchange': profile.exchange,
            'industry': profile.industry or metadata.get('overview', {}).get('company_type', ''),
            'status': profile.status,
            'outstanding_shares': profile.outstanding_shares or metadata.get('overview', {}).get('outstanding_shares'),
            'overview': metadata.get('overview', {}),
            'officers': metadata.get('officers', []),
            'shareholders': metadata.get('shareholders', []),
            'events': metadata.get('events', []),
            'note': 'native_profile_loaded',
        })



class StockManagementOverviewView(APIView):
    """GET /api/stock-management/stocks/<symbol>/overview/"""
    permission_classes = TENANT_PERMISSION_CLASSES

    @extend_schema(
        summary='Lấy stock workspace overview native',
        description='Endpoint native `/core/v1/stock-management/stocks/{symbol}/overview/` cho Stock Detail và Whale Alerts.',
        responses={
            200: envelope_response(),
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
            404: OpenApiTypes.OBJECT,
        },
    )

    def get(self, request, symbol):
        symbol = symbol.upper()
        snap = _fetch_symbol_snapshot_payload(symbol)

        today = timezone.localdate()
        trailing_rows = list(
            DailyPrice.objects.filter(symbol=symbol, date__lte=today).order_by('-date')[:366]
        )
        profile = StockProfile.objects.filter(symbol=symbol).first()
        if profile is None and snap is None and not trailing_rows:
            raise NotFound(f'Stock not found: {symbol}')
        latest_daily = trailing_rows[0] if trailing_rows else None
        previous_daily = trailing_rows[1] if len(trailing_rows) > 1 else None

        current_price = _to_float(snap.get('price')) if snap else _to_float(getattr(latest_daily, 'close', None))
        reference_price = _to_float(snap.get('reference_price')) if snap and snap.get('reference_price') is not None else _to_float(getattr(previous_daily, 'close', None))
        change_value = _to_float(snap.get('price_change')) if snap and snap.get('price_change') is not None else None
        if change_value is None and current_price is not None and reference_price not in (None, 0):
            change_value = current_price - reference_price

        change_pct = _to_float(snap.get('price_change_pct')) if snap and snap.get('price_change_pct') is not None else None
        if change_pct is None and change_value is not None and reference_price not in (None, 0):
            change_pct = (change_value / reference_price) * 100

        open_price = _to_float(snap.get('open')) if snap and snap.get('open') is not None else _to_float(getattr(latest_daily, 'open', None))
        high_price = _to_float(snap.get('high')) if snap and snap.get('high') is not None else _to_float(getattr(latest_daily, 'high', None))
        low_price = _to_float(snap.get('low')) if snap and snap.get('low') is not None else _to_float(getattr(latest_daily, 'low', None))
        close_price = current_price
        volume = _to_int(snap.get('volume')) if snap else _to_int(getattr(latest_daily, 'volume', None))

        ceiling_price = _to_float(snap.get('ceiling')) if snap and snap.get('ceiling') is not None else None
        floor_price = _to_float(snap.get('floor')) if snap and snap.get('floor') is not None else None
        if reference_price not in (None, 0):
            ceiling_price = ceiling_price if ceiling_price is not None else round(reference_price * 1.07, 2)
            floor_price = floor_price if floor_price is not None else round(reference_price * 0.93, 2)

        average_price = None
        valid_prices = [price for price in [open_price, high_price, low_price, close_price] if price is not None]
        if valid_prices:
            average_price = round(sum(valid_prices) / len(valid_prices), 2)

        week52_rows = trailing_rows[:252] if trailing_rows else []
        week52_high = max((_to_float(row.high) for row in week52_rows), default=None)
        week52_low = min((_to_float(row.low) for row in week52_rows), default=None)

        # Fetch latest SessionFacts for session-level aggregates
        from market_serving.models import SessionFacts
        session_facts = SessionFacts.objects.filter(symbol=symbol).order_by('-session_date').first()

        membership_payload = _build_watchlist_membership_payload(request.user, symbol)

        payload = {
            'tracked_symbol_id': membership_payload['tracked_symbol_id'],
            'symbol': symbol,
            'company_name': profile.company_name if profile else symbol,
            'industry': profile.industry if profile else '',
            'exchange': profile.exchange if profile else '',
            'listed_date': None,
            'is_active': profile.status == StockProfile.StatusChoices.ACTIVE if profile else True,
            'updated_at': profile.updated_at.isoformat() if profile and profile.updated_at else None,
            'current_price': _round_or_none(current_price),
            'prev_price': _round_or_none(reference_price),
            'change_value': _round_or_none(change_value),
            'change_pct': _round_or_none(change_pct),
            'last_date': snap.get('session_date').isoformat() if snap and snap.get('session_date') else (latest_daily.date.isoformat() if latest_daily else None),
            'open_price': _round_or_none(open_price),
            'high_price': _round_or_none(high_price),
            'low_price': _round_or_none(low_price),
            'close_price': _round_or_none(close_price),
            'volume': volume,
            'average_price': _round_or_none(average_price),
            'reference_price': _round_or_none(reference_price),
            'ceiling_price': _round_or_none(ceiling_price),
            'floor_price': _round_or_none(floor_price),
            'week52_high': _round_or_none(week52_high),
            'week52_low': _round_or_none(week52_low),
            'is_tracked': membership_payload['is_tracked'],
            'source_group_name': membership_payload['source_group_name'],
            'market_groups': membership_payload['market_groups'],
            'watchlist_groups': membership_payload['watchlist_groups'],
            'market_group_refs': membership_payload['market_group_refs'],
            'watchlist_memberships': membership_payload['watchlist_memberships'],
            # SessionFacts aggregates
            'total_buy_qty': _to_int(getattr(session_facts, 'total_buy_volume', None)),
            'total_sell_qty': _to_int(getattr(session_facts, 'total_sell_volume', None)),
            'institutional_buy': _round_or_none(getattr(session_facts, 'institutional_strength', None)),
            'retail_buy': _round_or_none(getattr(session_facts, 'buy_strength', None)),
            'cvd_normalized': _round_or_none(getattr(session_facts, 'cvd_normalized', None)),
            'whale_net_flow': _to_int(getattr(session_facts, 'whale_net_flow', None)),
            'dark_flow_score': _round_or_none(getattr(session_facts, 'dark_flow_score', None)),
            'session_facts_date': session_facts.session_date.isoformat() if session_facts else None,
            'session_facts_source': getattr(session_facts, 'source', None),
        }
        return envelope(payload)


class StockManagementChartView(APIView):
    """GET /api/stock-management/stocks/<symbol>/chart/ — native chart envelope."""
    permission_classes = TENANT_PERMISSION_CLASSES

    @extend_schema(
        summary='Lấy chart data native cho stock workspace',
        description='Endpoint native `/core/v1/stock-management/stocks/{symbol}/chart/` trả về chart envelope gồm points và technical.',
        parameters=[
            OpenApiParameter(
                name='days',
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                description='Số ngày lookback cho dữ liệu chart.',
                required=False,
            ),
            OpenApiParameter(
                name='timeframe',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description='Khung thời gian chart, ví dụ `1H`, `D`, `W`.',
                required=False,
            ),
        ],
        responses={
            200: envelope_response(),
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
            404: OpenApiTypes.OBJECT,
        },
    )

    def get(self, request, symbol):
        symbol = symbol.upper()
        if not _symbol_exists_for_stock_chart(symbol):
            raise NotFound(f'Stock not found: {symbol}')

        try:
            days = int(request.query_params.get('days', 180))
        except (TypeError, ValueError):
            days = 180
        days = max(1, min(days, 3650))

        timeframe = _normalize_timeframe(request.query_params.get('timeframe', '1H'))
        interval = _interval_for_timeframe(timeframe)
        end_date = timezone.localdate()
        start_date = end_date - timedelta(days=days)

        intraday_frames = {'1m', '5m', '15m', '30m', '1H', '2H', '4H'}
        if timeframe in intraday_frames:
            bars = list(
                IntradayBar.objects.filter(
                    symbol=symbol,
                    timeframe__iexact=timeframe,
                    datetime__date__range=(start_date, end_date),
                ).order_by('datetime')
            )
            points = [
                _serialize_price_point(bar.datetime, bar.open, bar.high, bar.low, bar.close, bar.volume)
                for bar in bars
            ]
        else:
            rows = list(
                DailyPrice.objects.filter(symbol=symbol, date__range=(start_date, end_date)).order_by('date')
            )
            points = _aggregate_daily_rows(rows, timeframe)

        payload = {
            'symbol': symbol,
            'days': days,
            'timeframe': timeframe,
            'interval': interval,
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'points': points,
            'technical': _compute_chart_technical_payload(points),
        }
        return envelope(payload)


class StockManagementDarkMoneyHistoryView(APIView):
    """GET /api/stock-management/stocks/<symbol>/dark-money-history/ — native dark-money-history envelope."""
    permission_classes = TENANT_PERMISSION_CLASSES

    @extend_schema(
        summary='Lay dark-money-history native theo timeframe',
        description='Endpoint native `/core/v1/stock-management/stocks/{symbol}/dark-money-history/` cho lich su OHLCV + dark flow + whale signal.',
        parameters=[
            OpenApiParameter(
                name='period',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description='Khoang lookback: 1M, 3M, 6M, 1Y, 10Y.',
                required=False,
            ),
            OpenApiParameter(
                name='interval',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description='Khung: 1m, 5m, 15m, 30m, 1h, 4h, 1D, 1W.',
                required=False,
            ),
        ],
        responses={
            200: envelope_schema(_STOCK_DARK_MONEY_HISTORY_SCHEMA),
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
            404: OpenApiTypes.OBJECT,
        },
    )
    def get(self, request, symbol):
        from signal_intelligence.models import UnifiedAlert

        symbol = str(symbol or '').strip().upper()
        if not _symbol_exists_for_stock_chart(symbol):
            raise NotFound(f'Stock not found: {symbol}')

        period = _normalize_dark_money_period(request.query_params.get('period', '3M'))
        interval = _normalize_dark_money_interval(request.query_params.get('interval', '1D'))
        period_days = _DARK_MONEY_PERIOD_DAYS[period]
        if interval in _DARK_MONEY_INTRADAY_MAX_DAYS:
            period_days = min(period_days, _DARK_MONEY_INTRADAY_MAX_DAYS[interval])

        end_date = timezone.localdate()
        start_date = end_date - timedelta(days=period_days)
        is_intraday = interval in _DARK_MONEY_INTRADAY_MAX_DAYS

        candles = []
        if is_intraday:
            timeframe_map = {
                '1m': '1m',
                '5m': '5m',
                '15m': '15m',
                '30m': '30m',
                '1h': '1H',
                '4h': '4H',
            }
            timeframe = timeframe_map[interval]
            bars = list(
                IntradayBar.objects.filter(
                    symbol=symbol,
                    timeframe__iexact=timeframe,
                    datetime__date__range=(start_date, end_date),
                ).order_by('datetime')
            )
            candles = [
                {
                    'time': _to_unix_seconds(bar.datetime),
                    'open': _to_float(bar.open) or 0,
                    'high': _to_float(bar.high) or 0,
                    'low': _to_float(bar.low) or 0,
                    'close': _to_float(bar.close) or 0,
                    'volume': _to_int(bar.volume) or 0,
                }
                for bar in bars
                if _to_unix_seconds(bar.datetime) is not None
            ]
        else:
            rows = list(
                DailyPrice.objects.filter(symbol=symbol, date__range=(start_date, end_date)).order_by('date')
            )
            timeframe = 'W' if interval == '1W' else 'D'
            points = _aggregate_daily_rows(rows, timeframe)
            candles = [
                {
                    'time': str(point.get('date') or '')[:10],
                    'open': _to_float(point.get('open')) or 0,
                    'high': _to_float(point.get('high')) or 0,
                    'low': _to_float(point.get('low')) or 0,
                    'close': _to_float(point.get('close')) or 0,
                    'volume': _to_int(point.get('volume')) or 0,
                }
                for point in points
            ]

        alerts = list(
            UnifiedAlert.objects.filter(
                symbol=symbol,
                triggered_at__date__gte=start_date,
                alert_type__in=(
                    UnifiedAlert.AlertTypeChoices.DARK_FLOW,
                    UnifiedAlert.AlertTypeChoices.WHALE,
                    UnifiedAlert.AlertTypeChoices.SIGNAL,
                ),
            ).order_by('triggered_at', 'pk')
        )

        grouped = defaultdict(lambda: {
            'strength_sum': 0.0,
            'confidence_sum': 0.0,
            'count': 0,
            'signal_types': defaultdict(int),
            'whale_buy_value': 0.0,
            'whale_sell_value': 0.0,
        })
        whale_signals = []

        for alert in alerts:
            local_dt = timezone.localtime(alert.triggered_at)
            if is_intraday:
                bucket_dt = _floor_dark_money_bucket(local_dt, interval)
                bucket_key = _to_unix_seconds(bucket_dt)
            else:
                bucket_key = local_dt.date().isoformat()

            if bucket_key is None:
                continue

            bucket = grouped[bucket_key]
            strength = _extract_signal_strength(alert)
            confidence = _safe_numeric(alert.confidence) or 0.0
            signal_type = str(
                (alert.metadata.get('signal_type') if isinstance(alert.metadata, dict) else None)
                or alert.alert_type
                or 'none'
            ).lower()

            bucket['strength_sum'] += strength
            bucket['confidence_sum'] += confidence
            bucket['count'] += 1
            bucket['signal_types'][signal_type] += 1

            alert_value = _safe_numeric(alert.value) or 0.0
            if alert.alert_type == UnifiedAlert.AlertTypeChoices.WHALE:
                if alert.direction == UnifiedAlert.DirectionChoices.BUY:
                    bucket['whale_buy_value'] += alert_value
                elif alert.direction == UnifiedAlert.DirectionChoices.SELL:
                    bucket['whale_sell_value'] += alert_value
                if len(whale_signals) < 100:
                    whale_signals.append(
                        {
                            'time': bucket_key,
                            'signal_type': signal_type,
                            'direction': alert.direction,
                            'confidence': round(confidence, 4),
                            'strength': round(strength, 2),
                            'value': round(alert_value, 2),
                        }
                    )

        dark_flow_series = []
        for bucket_key in sorted(grouped.keys()):
            bucket = grouped[bucket_key]
            count = max(1, int(bucket['count']))
            dominant_signal_type = max(bucket['signal_types'].items(), key=lambda item: item[1])[0]
            dark_flow_series.append(
                {
                    'time': bucket_key,
                    'strength': round(bucket['strength_sum'] / count, 2),
                    'confidence': round(bucket['confidence_sum'] / count, 4),
                    'signal_count': count,
                    'signal_type': dominant_signal_type,
                    'whale_buy_value': round(bucket['whale_buy_value'], 2),
                    'whale_sell_value': round(bucket['whale_sell_value'], 2),
                }
            )

        moving_averages = {}
        for window in (20, 50):
            key, values = _compute_simple_moving_average(candles, window)
            moving_averages[key] = values

        recent_dark_flow = dark_flow_series[-20:]
        net_whale_value = sum((item.get('whale_buy_value') or 0) - (item.get('whale_sell_value') or 0) for item in recent_dark_flow)
        reference_turnover = sum((item.get('close') or 0) * (item.get('volume') or 0) for item in candles[-20:])
        smfi = round((net_whale_value / reference_turnover) * 100, 2) if reference_turnover > 0 else 0.0

        latest_signal_type = dark_flow_series[-1]['signal_type'] if dark_flow_series else 'none'
        latest_strength = dark_flow_series[-1]['strength'] if dark_flow_series else 0.0

        return envelope(
            {
                'ok': True,
                'symbol': symbol,
                'period': period,
                'interval': interval,
                'candles': candles,
                'dark_flow_series': dark_flow_series,
                'whale_signals': whale_signals,
                'moving_averages': moving_averages,
                'smfi': smfi,
                'strategy_table': _build_dark_money_strategy_table(latest_strength, latest_signal_type),
            }
        )


class StockManagementOrderFlowView(APIView):
    """GET /api/stock-management/stocks/<symbol>/order-flow/"""
    permission_classes = TENANT_PERMISSION_CLASSES

    @extend_schema(
        summary='Lấy order-flow native cho stock workspace',
        description='Endpoint native `/core/v1/stock-management/stocks/{symbol}/order-flow/` trả về radar contract cho Stock Detail.',
        parameters=[
            OpenApiParameter(
                name='window',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description='Cửa sổ thời gian radar, ví dụ `15m`, `30m`, `2h`.',
                required=False,
            ),
            OpenApiParameter(
                name='limit',
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                description='Số signal tối đa trả về.',
                required=False,
            ),
        ],
        responses={
            200: envelope_response(),
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
        },
    )

    def get(self, request, symbol):
        from signal_intelligence.models import UnifiedAlert

        symbol = symbol.upper()
        try:
            limit = int(request.query_params.get('limit', 30))
        except (TypeError, ValueError):
            limit = 30
        limit = max(1, min(limit, 500))

        window, window_minutes = _normalize_order_flow_window(request.query_params.get('window', '30m'))

        alerts = list(
            UnifiedAlert.objects.filter(
                symbol=symbol,
                alert_type__in=(
                    UnifiedAlert.AlertTypeChoices.WHALE,
                    UnifiedAlert.AlertTypeChoices.DARK_FLOW,
                    UnifiedAlert.AlertTypeChoices.SIGNAL,
                    UnifiedAlert.AlertTypeChoices.SYSTEM,
                ),
            )
            .order_by('-triggered_at', '-pk')[:limit]
        )

        tick_payload = _build_tick_distribution_payload(symbol, window_minutes)
        tick_rate_per_min = tick_payload['tick_rate_per_min']
        small_order_ratio = tick_payload['small_order_ratio']

        signals = [
            _serialize_stock_order_flow_signal(alert, tick_rate_per_min, small_order_ratio)
            for alert in alerts
        ]
        latest_signal = signals[0] if signals else None

        dark_alert = next(
            (alert for alert in alerts if alert.alert_type == UnifiedAlert.AlertTypeChoices.DARK_FLOW),
            next((alert for alert in alerts if alert.alert_type != UnifiedAlert.AlertTypeChoices.SYSTEM), alerts[0] if alerts else None),
        )
        dark_flow = {
            'signal_type': str(
                (dark_alert.metadata.get('signal_type') if dark_alert and isinstance(dark_alert.metadata, dict) else None)
                or (dark_alert.alert_type if dark_alert else 'dark_flow')
            ).lower(),
            'strength': _extract_signal_strength(dark_alert) if dark_alert else 0.0,
            'confidence': round(_safe_numeric(dark_alert.confidence) or 0.0, 2) if dark_alert else 0.0,
            'direction': dark_alert.direction if dark_alert else None,
            'components': {
                'absorption': {
                    'description': (dark_alert.title or dark_alert.body) if dark_alert else '',
                },
            },
        }

        session_date = None
        if alerts and alerts[0].session_date is not None:
            session_date = alerts[0].session_date.isoformat()

        return envelope({
            'symbol': symbol,
            'window': window,
            'session_date': session_date,
            'dark_flow': dark_flow,
            'latest_signal': latest_signal,
            'signals': signals,
            'tick_rate': {
                'tick_rate_per_min': tick_rate_per_min,
                'small_order_ratio': small_order_ratio,
                'stale': tick_payload['stale'],
            },
            'size_distribution': tick_payload['size_distribution'],
            'order_flow': [{
                'id': str(a.alert_id),
                'type': a.alert_type,
                'value': str(a.value) if a.value is not None else None,
                'direction': a.direction,
                'created_at': a.triggered_at.isoformat(),
            } for a in alerts],
        })


class StockManagementNewsView(APIView):
    """GET /api/stock-management/stocks/<symbol>/news/ — graceful empty (no native news model)."""
    permission_classes = TENANT_PERMISSION_CLASSES

    @extend_schema(
        summary='Lấy tin tức mã cổ phiếu native',
        description='Endpoint native `/core/v1/stock-management/stocks/{symbol}/news/` trả về tin tức doanh nghiệp từ vnbroker (KBS) hoặc Google News RSS fallback, cache 30 phút.',
        parameters=[
            OpenApiParameter(
                name='force',
                type=OpenApiTypes.BOOL,
                location=OpenApiParameter.QUERY,
                description='Bỏ qua cache và fetch mới dữ liệu.',
                required=False,
            ),
        ],
        responses={
            200: _STOCK_NEWS_STUB_SCHEMA,
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
        },
    )

    def get(self, request, symbol):
        import pandas as pd
        from django.core.cache import cache
        
        symbol = symbol.upper()
        force = str(request.query_params.get('force', '')).lower() == 'true'
        cache_key = f"stock_news:{symbol}"
        
        if not force:
            cached_data = cache.get(cache_key)
            if cached_data is not None:
                return Response(cached_data)

        news_list = []
        try:
            from vnbroker.api.news import News
            kbs_news = News(source='KBS').by_symbol(symbol)
            if kbs_news is not None and isinstance(kbs_news, pd.DataFrame) and not kbs_news.empty:
                kbs_news = kbs_news.where(pd.notnull(kbs_news), None)
                raw_news_list = kbs_news.to_dict(orient='records')
                
                for item in raw_news_list:
                    pub_date = item.get('published_at')
                    if pd.isnull(pub_date):
                        pub_date_str = None
                    elif hasattr(pub_date, 'isoformat'):
                        pub_date_str = pub_date.isoformat()
                    else:
                        pub_date_str = str(pub_date) if pub_date else None

                    # Only append if title and url are present to keep it high quality
                    if item.get('title') and item.get('url'):
                        news_list.append({
                            'news_id': item.get('news_id') or f"kbs:{item.get('raw_hash')}",
                            'title': item.get('title') or '',
                            'summary': item.get('summary') or '',
                            'url': item.get('url') or '',
                            'published_at': pub_date_str,
                            'source': item.get('source') or 'KBS',
                        })
        except Exception as e:
            # Logger should be imported or used if available
            import logging
            logger = logging.getLogger(__name__)
            logger.error('Error in StockManagementNewsView vnbroker news retrieval for %s: %s', symbol, e)

        # Fallback to Google News RSS if no valid news items
        if not news_list:
            try:
                from market_data.vnbroker_adapter import fetch_rss_news
                news_list = fetch_rss_news(symbol)
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error('Error fetching fallback RSS news for %s: %s', symbol, e)

        response_data = {
            'symbol': symbol,
            'news': news_list,
            'note': 'news_loaded_successfully',
        }
        
        cache.set(cache_key, response_data, timeout=7200)  # 2 hours — news changes infrequently
        return envelope(response_data)


class StockManagementNewsAISummaryView(APIView):
    """GET /api/stock-management/stocks/<symbol>/news/ai-summary/"""
    permission_classes = TENANT_PERMISSION_CLASSES

    @extend_schema(
        summary='Lấy hoặc yêu cầu AI news summary native stub',
        description='Endpoint native `/core/v1/stock-management/stocks/{symbol}/news/ai-summary/` hiện trả về stub thống nhất cho client.',
        responses={
            200: envelope_schema(_STOCK_NEWS_AI_SUMMARY_SCHEMA),
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
        },
    )

    def get(self, request, symbol):
        return envelope({
            'symbol': symbol.upper(),
            'summary': None,
            'note': 'ai_summary_not_available_in_native',
        })

    @extend_schema(
        summary='Yêu cầu AI news summary native stub',
        description='Endpoint native `/core/v1/stock-management/stocks/{symbol}/news/ai-summary/` giữ tương thích POST cho client hiện tại.',
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'force_refresh': {'type': 'boolean'},
                },
            },
        },
responses={
            200: envelope_schema(_STOCK_NEWS_AI_SUMMARY_SCHEMA),
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
        },
    )

    def post(self, request, symbol):
        return self.get(request, symbol)


# ---------------------------------------------------------------------------
# Advisory compat views — native envelope backed by AdvisoryRecord snapshots
# ---------------------------------------------------------------------------

def _normalize_ai_symbol(symbol):
    return str(symbol or '').strip().upper()


def _ai_context_snapshot(record):
    return deepcopy(record.context_snapshot) if isinstance(record.context_snapshot, dict) else {}


def _dict_list(value):
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def _int_value(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _float_value(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _advisory_field(response, name):
    """Đọc một field từ `Response` của `AdvisoryRefreshView`.

    Chịu được **cả hai** hình dạng: payload phẳng, và payload bọc
    `{data: {...}}`. Lý do: hai call site bên dưới từng đọc thẳng
    `refresh_response.data.get(...)`. Khi envelope đổi hình dạng, chúng ra
    `None` — mà `None` lại **kích hoạt fallback âm thầm** sang record AI của
    phiên khác, không có exception, không có log. Người dùng thấy khuyến nghị
    cũ mà không có dấu hiệu nào là sai.

    Với từ khoá thiếu trả `None` — **không** trả `{}`. Trả `{}` sẽ làm
    `field.get(...)` của caller đổi nghĩa ngầm.
    """
    data = getattr(response, 'data', None)
    if not isinstance(data, dict):
        return None
    if name in data:
        return data[name]
    inner = data.get('data')
    if isinstance(inner, dict):
        return inner.get(name)
    return None


def _resolve_refreshed_advisory(response, *, user, symbol):
    """Trả `(record, advisory_id)` cho advisory mà refresh vừa tạo.

    **Không bao giờ** trả record khác khi `advisory_id` không resolve được.
    Nếu refresh đã chỉ định một phiên mà ta không tìm thấy, đó là **mâu thuẫn**
    — caller phải biết để báo lỗi, không phải âm thầm đưa nhầm phiên.

    Vì sao nguy hiểm: `_latest_ai_record` (`:2317`) lọc `session_date__lte` rồi
    `order_by('-created_at').first()`, **không dùng `advisory_id`**. Thay thế ở
    đây là trả khuyến nghị mua/bán của phiên khác — đúng loại P0 mà
    `AGENTS.md` Entry 231 ghi đã phải sửa một lần vì lý do gần giống vậy.
    """
    advisory_id = _advisory_field(response, 'advisory_id')
    if not advisory_id:
        return None, None
    record = AdvisoryRecord.objects.filter(
        advisory_id=advisory_id, user=user, symbol=symbol).first()
    if record is None:
        # Nêu tên để tra log được. Không log thì sự cố lặp lại sẽ vô hình.
        # File này không có logger ở module level — cả 3 chỗ còn lại đều tạo
        # local trong hàm, nên làm y vậy.
        import logging

        logging.getLogger(__name__).warning(
            'AdvisoryRefreshView tra advisory_id=%s nhung khong tim thay '
            'AdvisoryRecord cho user/symbol — tra loi o nguon, KHONG thay bang '
            'record khac.', advisory_id,
        )
    return record, advisory_id


def _latest_ai_record(user, symbol, selected_trade_date=None):
    queryset = AdvisoryRecord.objects.filter(user=user, symbol=symbol)
    if selected_trade_date is not None:
        queryset = queryset.filter(session_date__lte=selected_trade_date)
    return queryset.order_by('-created_at', '-updated_at', '-pk').first()


def _normalize_component_item(component):
    normalized = dict(component) if isinstance(component, dict) else {}
    normalized['id'] = _int_value(normalized.get('id'))
    normalized['symbol'] = str(normalized.get('symbol') or '').strip().upper()
    normalized['component_type'] = str(normalized.get('component_type') or 'indicator').strip()
    normalized['indicator_name'] = str(normalized.get('indicator_name') or 'Tín hiệu').strip()
    normalized['status'] = str(normalized.get('status') or 'neutral').strip()
    normalized['confidence_score'] = _int_value(normalized.get('confidence_score'), 5)
    normalized['suggested_action'] = str(normalized.get('suggested_action') or 'watch').strip()
    normalized['rationale_text'] = str(normalized.get('rationale_text') or '').strip()
    normalized['timeframe'] = str(normalized.get('timeframe') or '30m').strip()
    normalized['include_in_summary'] = bool(normalized.get('include_in_summary', True))
    normalized['is_deleted'] = bool(normalized.get('is_deleted', False))
    normalized['created_at'] = str(normalized.get('created_at') or timezone.now().isoformat())
    normalized['updated_at'] = str(normalized.get('updated_at') or normalized['created_at'])
    return normalized


def _normalize_component_collection(components):
    normalized_components = []
    next_identifier = 1
    for component in _dict_list(components):
        normalized_component = _normalize_component_item(component)
        if normalized_component['id'] <= 0:
            normalized_component['id'] = next_identifier
        next_identifier = max(next_identifier, normalized_component['id'] + 1)
        normalized_components.append(normalized_component)
    return normalized_components, next_identifier


def _default_component_templates(record, timeframe='30m', chart_context=None):
    chart_context = chart_context if isinstance(chart_context, dict) else {}
    rationale_prefix = str(
        chart_context.get('rationale_text')
        or chart_context.get('summary')
        or record.advisory_text
        or f'Phân tích native cho {record.symbol}'
    ).strip()
    return [
        {
            'symbol': record.symbol,
            'component_type': 'indicator',
            'indicator_name': 'RSI',
            'status': 'neutral',
            'confidence_score': 7,
            'suggested_action': 'watch',
            'rationale_text': rationale_prefix,
            'timeframe': timeframe,
            'include_in_summary': True,
            'is_deleted': False,
        },
        {
            'symbol': record.symbol,
            'component_type': 'flow',
            'indicator_name': 'Whale Flow',
            'status': 'bullish',
            'confidence_score': 8,
            'suggested_action': 'follow',
            'rationale_text': f'Native flow snapshot cho {record.symbol}',
            'timeframe': timeframe,
            'include_in_summary': True,
            'is_deleted': False,
        },
        {
            'symbol': record.symbol,
            'component_type': 'summary',
            'indicator_name': 'Executive Summary',
            'status': 'informative',
            'confidence_score': 6,
            'suggested_action': 'hold',
            'rationale_text': f'Tổng hợp native cho {record.symbol}',
            'timeframe': timeframe,
            'include_in_summary': False,
            'is_deleted': False,
        },
    ]


def _build_summary_from_components(record, components, deleted_components, summary_version):
    active_components = [item for item in components if not item.get('is_deleted') and item.get('include_in_summary')]
    confidence_values = [_float_value(item.get('confidence_score'), 0.0) for item in active_components]
    average_confidence = round(sum(confidence_values) / len(confidence_values), 1) if confidence_values else 5.0
    if average_confidence >= 7.5:
        strategy_action = 'buy'
        risk_level = 'low'
        score_band = 'high'
    elif average_confidence >= 5.5:
        strategy_action = 'hold'
        risk_level = 'medium'
        score_band = 'medium'
    else:
        strategy_action = 'reduce'
        risk_level = 'high'
        score_band = 'low'
    return {
        'id': summary_version,
        'summary_id': summary_version,
        'summary_version': summary_version,
        'symbol': record.symbol,
        'session_date': record.session_date.isoformat(),
        'strategy_action': strategy_action,
        'risk_level': risk_level,
        'overall_confidence': average_confidence,
        'score_band': score_band,
        'summary_text': f'Phân tích native cho {record.symbol}: {strategy_action}.',
        'component_ids': [item['id'] for item in active_components],
        'active_components_count': len(active_components),
        'deleted_components_count': len([item for item in deleted_components if item.get('is_deleted')]),
        'generated_at': timezone.now().isoformat(),
        'source': 'native',
    }


def _build_observability_snapshot(record, context, components, deleted_components):
    events = _dict_list(context.get('observability_events'))
    latest_telemetry = context.get('observability_telemetry') if isinstance(context.get('observability_telemetry'), dict) else {}
    confidences = [_float_value(item.get('confidence_score'), 0.0) for item in components if not item.get('is_deleted')]
    average_confidence = round(sum(confidences) / len(confidences), 1) if confidences else 5.0
    retry_events = []
    for item in events[-20:][::-1]:
        telemetry = item.get('telemetry') if isinstance(item.get('telemetry'), dict) else {}
        retry_events.append(
            {
                'event_type': item.get('event_type') or 'frontend_retry_telemetry',
                'outcome': item.get('outcome') or '',
                'reason': item.get('reason') or telemetry.get('last_reason') or '',
                'client_ts': item.get('client_ts') or '',
                'created_at': item.get('created_at') or '',
                'telemetry': telemetry,
            }
        )
    summary = {
        'severity_drift_label': context.get('severity_drift_label') or 'stable',
        'severity_delta': _float_value(context.get('severity_delta'), 0.0),
        'avg_aggregate_quality_score': average_confidence,
        'retry_scheduled_total': _int_value(latest_telemetry.get('scheduled_count'), 0),
        'retry_recovered_total': _int_value(latest_telemetry.get('recovered_count'), 0),
        'retry_failed_total': _int_value(latest_telemetry.get('failed_count'), 0),
    }
    governance = context.get('governance') if isinstance(context.get('governance'), dict) else {}
    return {
        'summary': summary,
        'retry_events': retry_events,
        'timeline': retry_events[:5],
        'governance': {
            'delta_thresholds': governance.get('delta_thresholds') if isinstance(governance.get('delta_thresholds'), dict) else {'warning': 2, 'critical': 4, 'cooldown': 2},
            'rollout_gate_deny_trend': _dict_list(governance.get('rollout_gate_deny_trend')),
            'rollout_gate_deny_by_endpoint': governance.get('rollout_gate_deny_by_endpoint') if isinstance(governance.get('rollout_gate_deny_by_endpoint'), dict) else {},
            'rollout_gate_deny_by_reason': governance.get('rollout_gate_deny_by_reason') if isinstance(governance.get('rollout_gate_deny_by_reason'), dict) else {},
            'rollout_gate_deny_by_cohort_mode': governance.get('rollout_gate_deny_by_cohort_mode') if isinstance(governance.get('rollout_gate_deny_by_cohort_mode'), dict) else {},
        },
    }


def _save_advisory_context(record, context):
    record.context_snapshot = context
    record.save(update_fields=['context_snapshot', 'updated_at'])


def _build_ai_session_payload(record, *, selected_trade_date=None, contract_version='v1', include_benchmarks=False):
    context = _ai_context_snapshot(record)
    components, next_component_id = _normalize_component_collection(context.get('components'))
    deleted_components, next_deleted_component_id = _normalize_component_collection(context.get('deleted_components'))
    if not components:
        components = []
    if not deleted_components:
        deleted_components = []

    summary_sequence = _int_value(context.get('summary_sequence'), 1)
    executive_summaries = _dict_list(context.get('executive_summaries'))
    executive_summary = context.get('executive_summary') if isinstance(context.get('executive_summary'), dict) else None
    if executive_summary is None and executive_summaries:
        executive_summary = executive_summaries[0]
    if executive_summary is None:
        executive_summary = _build_summary_from_components(record, components, deleted_components, summary_sequence)
        executive_summaries = [executive_summary]
    if not executive_summaries:
        executive_summaries = [executive_summary]

    advisory_payload = dict(AdvisoryRecordSerializer(record).data)
    advisory_payload.update({
        'strategy_action': executive_summary.get('strategy_action'),
        'risk_level': executive_summary.get('risk_level'),
        'confidence_score': executive_summary.get('overall_confidence'),
    })

    observability = _build_observability_snapshot(record, context, components, deleted_components)
    aggregate = context.get('aggregate') if isinstance(context.get('aggregate'), dict) else {}
    if not aggregate:
        aggregate = {
            'advisory_id': str(record.advisory_id),
            'session_date': record.session_date.isoformat(),
            'selected_trade_date': selected_trade_date.isoformat() if selected_trade_date else record.session_date.isoformat(),
            'contract_version': contract_version,
            'decision': {
                'action': executive_summary.get('strategy_action'),
                'risk': executive_summary.get('risk_level'),
                'score_band': executive_summary.get('score_band'),
                'score': round(_float_value(executive_summary.get('overall_confidence'), 0.0) / 10.0, 2),
            },
            'observability': {
                'severity_drift_24h': {
                    'label': observability['summary']['severity_drift_label'],
                    'delta': observability['summary']['severity_delta'],
                },
                'aggregate_quality': {
                    'score': observability['summary']['avg_aggregate_quality_score'],
                    'label': 'native',
                },
            },
        }
        if include_benchmarks:
            aggregate['benchmarks'] = {'enabled': True, 'rows': []}

    payload = dict(advisory_payload)
    payload.update(
        {
            'ok': True,
            'queued': record.status == AdvisoryRecord.StatusChoices.PENDING,
            'symbol': record.symbol,
            'contract_version': contract_version,
            'selected_trade_date': selected_trade_date.isoformat() if selected_trade_date else None,
            'user_ai_provider': context.get('user_ai_provider') or (record.ai_model or 'core-native'),
            'effective_ai_provider': context.get('effective_ai_provider') or context.get('user_ai_provider') or (record.ai_model or 'core-native'),
            'effective_ai_model': context.get('effective_ai_model') or record.ai_model or '',
            'effective_ai_source': context.get('effective_ai_source') or 'native',
            'advisory': dict(advisory_payload),
            'aggregate': aggregate,
            'components': components,
            'deleted_components': deleted_components,
            'executive_summary': executive_summary,
            'executive_summaries': executive_summaries,
        }
    )
    if context.get('message'):
        payload['message'] = context['message']
    return payload


def _find_component_context(record, component_id):
    context = _ai_context_snapshot(record)
    components, next_component_id = _normalize_component_collection(context.get('components'))
    deleted_components, next_deleted_component_id = _normalize_component_collection(context.get('deleted_components'))
    for index, component in enumerate(components):
        if component['id'] == component_id:
            return context, components, deleted_components, component, 'components', index
    for index, component in enumerate(deleted_components):
        if component['id'] == component_id:
            return context, components, deleted_components, component, 'deleted_components', index
    return context, components, deleted_components, None, None, None


def _find_component_record(user, component_id, advisory_id=None):
    matches = []
    queryset = AdvisoryRecord.objects.filter(user=user).order_by('-created_at', '-updated_at', '-pk')
    if advisory_id:
        try:
            advisory_id = UUID(str(advisory_id))
        except (TypeError, ValueError):
            return None, None, None, None, None, None, None, Response({'ok': False, 'message': 'advisory_id khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)
        queryset = queryset.filter(advisory_id=advisory_id)
    for record in queryset:
        context, components, deleted_components, component, component_bucket, component_index = _find_component_context(record, component_id)
        if component is not None:
            matches.append((record, context, components, deleted_components, component, component_bucket, component_index))
            if advisory_id:
                break
    if not matches:
        return None, None, None, None, None, None, None, Response({'ok': False, 'message': 'Component khong ton tai.'}, status=status.HTTP_404_NOT_FOUND)
    if len(matches) > 1:
        return None, None, None, None, None, None, None, Response({'ok': False, 'message': 'Khong the xac dinh advisory session. Hay truyen advisory_id.'}, status=status.HTTP_409_CONFLICT)
    record, context, components, deleted_components, component, component_bucket, component_index = matches[0]
    return record, context, components, deleted_components, component, component_bucket, component_index, None


def _find_symbol_advisory_record(user, symbol, advisory_id=None, *, require_unique=True):
    queryset = AdvisoryRecord.objects.filter(user=user, symbol=symbol).order_by('-created_at', '-updated_at', '-pk')
    if advisory_id:
        try:
            advisory_id = UUID(str(advisory_id))
        except (TypeError, ValueError):
            return None, Response({'ok': False, 'symbol': symbol, 'message': 'advisory_id khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)
        queryset = queryset.filter(advisory_id=advisory_id)
    records = list(queryset)
    if not records:
        return None, Response({'ok': False, 'symbol': symbol, 'message': 'AI session khong ton tai.'}, status=status.HTTP_404_NOT_FOUND)
    if require_unique and len(records) > 1 and not advisory_id:
        return None, Response({'ok': False, 'symbol': symbol, 'message': 'AI session khong ro. Hay truyen advisory_id.'}, status=status.HTTP_409_CONFLICT)
    return records[0], None


def _upsert_ai_components(record, *, timeframe='30m', chart_context=None):
    context = _ai_context_snapshot(record)
    components, next_component_id = _normalize_component_collection(context.get('components'))
    if components:
        context['components'] = components
        context['deleted_components'] = _normalize_component_collection(context.get('deleted_components'))[0]
        context['component_sequence'] = max(_int_value(context.get('component_sequence'), 0), next_component_id)
        _save_advisory_context(record, context)
        return components, False, []

    default_components, _ = _normalize_component_collection(_default_component_templates(record, timeframe=timeframe, chart_context=chart_context))
    context['components'] = default_components
    context['deleted_components'] = []
    context['component_sequence'] = len(default_components) + 1
    _save_advisory_context(record, context)
    return default_components, True, []


def _update_component_lists(record, components, deleted_components):
    context = _ai_context_snapshot(record)
    context['components'] = components
    context['deleted_components'] = deleted_components
    context['component_sequence'] = max([_int_value(item.get('id'), 0) for item in components + deleted_components] or [0]) + 1
    _save_advisory_context(record, context)


def _build_native_observability_payload(record, limit=20, window_hours=24, retry_outcome=None, retry_reason=None, retry_sort='newest'):
    context = _ai_context_snapshot(record)
    components, _ = _normalize_component_collection(context.get('components'))
    deleted_components, _ = _normalize_component_collection(context.get('deleted_components'))
    observability = _build_observability_snapshot(record, context, components, deleted_components)

    retry_events = observability['retry_events']
    if retry_outcome:
        retry_events = [item for item in retry_events if str(item.get('outcome') or '').lower() == retry_outcome]
    if retry_reason:
        retry_events = [item for item in retry_events if str(item.get('reason') or '').lower() == retry_reason]
    if retry_sort == 'oldest':
        retry_events = list(reversed(retry_events))
    elif retry_sort == 'most_failed':
        retry_events = sorted(retry_events, key=lambda item: 1 if str(item.get('outcome') or '').lower() == 'failed' else 0, reverse=True)

    observability['retry_events'] = retry_events[:limit]
    observability['timeline'] = observability['retry_events'][:5]
    observability['symbol'] = record.symbol
    observability['window_hours'] = window_hours
    observability['limit'] = limit
    observability['ok'] = True
    return observability

class StockManagementAIAdvisorySessionView(APIView):
    """GET /api/stock-management/stocks/<symbol>/ai-advisory-session/"""
    permission_classes = TENANT_PERMISSION_CLASSES

    def get(self, request, symbol):
        normalized_symbol = _normalize_ai_symbol(symbol)
        if not normalized_symbol:
            raise ValidationErrorException(detail='Symbol không hợp lệ.', code='validation_error')

        contract_raw = str(request.query_params.get('contract') or 'v1').strip().lower()
        if contract_raw and contract_raw not in {'v1', 'v2'}:
            raise ValidationErrorException(detail='Contract không hợp lệ. Hỗ trợ: v1, v2.', code='validation_error')

        include_benchmarks = str(request.query_params.get('include_benchmarks') or '').strip().lower() in {'1', 'true', 'yes', 'on'}
        trade_date_raw = str(request.query_params.get('trade_date') or request.query_params.get('date') or '').strip()
        selected_trade_date = None
        if trade_date_raw:
            try:
                selected_trade_date = datetime.fromisoformat(f'{trade_date_raw[:10]}T00:00:00').date()
            except ValueError:
                selected_trade_date = None

        record = _latest_ai_record(request.user, normalized_symbol, selected_trade_date=selected_trade_date)
        if record is None:
            # Return 200 with empty payload (legacy compat) - not an error
            return envelope(
                {
                    'queued': False,
                    'symbol': normalized_symbol,
                    'contract': contract_raw or 'v1',
                    'contract_version': contract_raw or 'v1',
                    'include_benchmarks': include_benchmarks,
                    'reason': 'no_advisory_data',
                    'message': f'Chưa có dữ liệu tư vấn AI cho mã {normalized_symbol}.',
                    'advisory': None,
                    'aggregate': None,
                    'components': [],
                    'deleted_components': [],
                    'executive_summary': None,
                    'executive_summaries': [],
                    'user_ai_provider': None,
                    'effective_ai_provider': None,
                    'effective_ai_model': None,
                    'effective_ai_source': None,
                },
                status=status.HTTP_200_OK,
            )

        payload = _build_ai_session_payload(
            record,
            selected_trade_date=selected_trade_date,
            contract_version='v2' if contract_raw == 'v2' else 'v1',
            include_benchmarks=include_benchmarks,
        )
        if payload.get('aggregate') and include_benchmarks:
            payload['aggregate']['benchmarks'] = {'enabled': True, 'rows': []}
        return envelope(payload, status=status.HTTP_200_OK)

    def post(self, request, symbol):
        from advisory.views import AdvisoryRefreshView

        normalized_symbol = _normalize_ai_symbol(symbol)
        if not normalized_symbol:
            raise ValidationErrorException(detail='Symbol không hợp lệ.', code='validation_error')

        django_request = getattr(request, '_request', request)
        refresh_response = AdvisoryRefreshView.as_view()(django_request, symbol=normalized_symbol)
        if refresh_response.status_code not in {status.HTTP_200_OK, status.HTTP_201_CREATED}:
            return refresh_response

        advisory_id = _advisory_field(refresh_response, 'advisory_id')
        record = _resolve_refreshed_advisory(
            refresh_response, user=request.user, symbol=normalized_symbol)[0]
        if record is None:
            if advisory_id:
                # Refresh đã chỉ định một phiên mà ta không tìm thấy. Báo lỗi
                # thay vì rơi xuống `_latest_ai_record` — rơi xuống đó là trả
                # khuyến nghị của phiên KHÁC, im lặng, và `status_code` không
                # đổi nên không có dấu hiệu lỗi cho người dùng.
                raise NotFoundErrorException(
                    detail=(
                        'Advisory vừa tạo không tìm thấy trong hệ thống. '
                        'Không phục vụ phiên khác để tránh trả khuyến nghị sai.'
                    ),
                    code='advisory_refresh_unresolvable',
                )
            # Refresh không trả `advisory_id` (ví dụ đã queue) — lúc đó *không
            # biết* phiên nào là đúng, nên tra phiên mới nhất là hành vi có chủ
            # đích, không phải thay thế âm thầm.
            record = _latest_ai_record(request.user, normalized_symbol)
        if record is None:
            # `adopt_envelope`: `AdvisoryRefreshView` (app khác) đã bọc, nên hôm
            # nay đây là no-op. Nhưng nếu trả thẳng và app kia chưa bọc, endpoint
            # này có HAI shape cùng lúc — đúng lỗi `service_ops` từng mắc và không
            # test nào bắt được. Nhánh `Response(payload)` phía trên luôn bọc, nên
            # phải bọc cả nhánh này. Không đụng nhánh lỗi ở trên.
            return adopt_envelope(refresh_response)

        payload = _build_ai_session_payload(record, contract_version='v1')
        payload['task_id'] = _advisory_field(refresh_response, 'task_id')
        payload['manual_trigger'] = _advisory_field(refresh_response, 'manual_trigger')
        payload['message'] = (
            _advisory_field(refresh_response, 'message')
            or payload.get('message') or 'Đã tạo advisory AI.'
        )
        payload['queued'] = payload.get('queued', False)
        return envelope(payload, status=refresh_response.status_code)


class StockManagementAIAdvisoryObservabilityView(APIView):
    """GET/POST /api/stock-management/stocks/<symbol>/ai-advisory-observability/"""
    permission_classes = TENANT_PERMISSION_CLASSES

    def get(self, request, symbol):
        normalized_symbol = _normalize_ai_symbol(symbol)
        if not normalized_symbol:
            raise ValidationErrorException(detail='Symbol không hợp lệ.', code='validation_error')

        limit_raw = request.query_params.get('limit')
        window_hours_raw = request.query_params.get('window_hours')
        retry_outcome = str(request.query_params.get('retry_outcome') or '').strip().lower() or None
        retry_reason = str(request.query_params.get('retry_reason') or '').strip().lower() or None
        retry_sort = str(request.query_params.get('retry_sort') or 'newest').strip().lower()
        governance_bucket = str(request.query_params.get('governance_bucket') or 'hour').strip().lower()

        try:
            limit = max(int(limit_raw or 20), 1)
            limit = min(limit, 100)
        except (TypeError, ValueError):
            raise ValidationErrorException(detail='limit không hợp lệ.', code='validation_error')

        try:
            window_hours = max(int(window_hours_raw or 24), 1)
            window_hours = min(window_hours, 168)
        except (TypeError, ValueError):
            raise ValidationErrorException(detail='window_hours không hợp lệ.', code='validation_error')

        if retry_sort not in {'newest', 'oldest', 'most_failed'}:
            raise ValidationErrorException(detail='retry_sort không hợp lệ.', code='validation_error')
        if governance_bucket not in {'hour', 'day'}:
            raise ValidationErrorException(detail='governance_bucket không hợp lệ.', code='validation_error')

        record = _latest_ai_record(request.user, normalized_symbol)
        if record is None:
            return envelope(
                {
                    'ok': True,
                    'symbol': normalized_symbol,
                    'summary': {
                        'severity_drift_label': 'stable',
                        'severity_delta': 0,
                        'avg_aggregate_quality_score': 0,
                        'retry_scheduled_total': 0,
                        'retry_recovered_total': 0,
                        'retry_failed_total': 0,
                    },
                    'retry_events': [],
                    'timeline': [],
                    'governance': {
                        'delta_thresholds': {'warning': 2, 'critical': 4, 'cooldown': 2},
                        'rollout_gate_deny_trend': [],
                        'rollout_gate_deny_by_endpoint': {},
                        'rollout_gate_deny_by_reason': {},
                        'rollout_gate_deny_by_cohort_mode': {},
                    },
                },
                status=status.HTTP_200_OK,
            )

        payload = _build_native_observability_payload(
            record,
            limit=limit,
            window_hours=window_hours,
            retry_outcome=retry_outcome,
            retry_reason=retry_reason,
            retry_sort=retry_sort,
        )
        payload['symbol'] = normalized_symbol
        payload['governance_bucket'] = governance_bucket
        return envelope(payload, status=status.HTTP_200_OK)

    def post(self, request, symbol):
        normalized_symbol = _normalize_ai_symbol(symbol)
        if not normalized_symbol:
            return Response({'ok': False, 'message': 'Symbol khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

        record = _latest_ai_record(request.user, normalized_symbol)
        if record is None:
            return envelope({'ok': True, 'symbol': normalized_symbol, 'received': True}, status=status.HTTP_201_CREATED)

        context = _ai_context_snapshot(record)
        events = _dict_list(context.get('observability_events'))
        payload = request.data if isinstance(request.data, dict) else {}
        telemetry = payload.get('telemetry') if isinstance(payload.get('telemetry'), dict) else {}
        event_type = str(payload.get('event_type') or 'frontend_retry_telemetry').strip()[:80]
        outcome = str(payload.get('outcome') or '').strip()[:60]
        client_ts = str(payload.get('client_ts') or '').strip()[:64]
        telemetry_payload = {
            'scheduled_count': _int_value(telemetry.get('scheduled_count'), 0),
            'recovered_count': _int_value(telemetry.get('recovered_count'), 0),
            'failed_count': _int_value(telemetry.get('failed_count'), 0),
            'last_reason': str(telemetry.get('last_reason') or '').strip()[:120],
            'last_event_at': str(telemetry.get('last_event_at') or '').strip()[:64],
        }
        events.append(
            {
                'event_type': event_type,
                'outcome': outcome,
                'client_ts': client_ts,
                'telemetry': telemetry_payload,
                'reason': telemetry_payload['last_reason'],
                'created_at': timezone.now().isoformat(),
            }
        )
        context['observability_events'] = events[-20:]
        context['observability_telemetry'] = telemetry_payload
        _save_advisory_context(record, context)
        return envelope({'ok': True, 'symbol': normalized_symbol, 'received': True}, status=status.HTTP_201_CREATED)


class StockManagementAIAdvisoryComponentsGenerateView(APIView):
    """POST /api/stock-management/stocks/<symbol>/ai-advisory-components/generate/"""
    permission_classes = TENANT_PERMISSION_CLASSES

    def post(self, request, symbol):
        normalized_symbol = _normalize_ai_symbol(symbol)
        if not normalized_symbol:
            raise ValidationErrorException(detail='Symbol không hợp lệ.', code='validation_error')

        record = _latest_ai_record(request.user, normalized_symbol)
        if record is None:
            from advisory.views import AdvisoryRefreshView

            django_request = getattr(request, '_request', request)
            import io
            # Force read raw body and reset stream to prevent RawPostDataException in nested views
            body_bytes = django_request.body
            django_request._stream = io.BytesIO(body_bytes)

            refresh_response = AdvisoryRefreshView.as_view()(django_request, symbol=normalized_symbol)
            if refresh_response.status_code not in {status.HTTP_200_OK, status.HTTP_201_CREATED}:
                return refresh_response
            advisory_id = _advisory_field(refresh_response, 'advisory_id')
            record = _resolve_refreshed_advisory(
                refresh_response, user=request.user, symbol=normalized_symbol)[0]
            if record is None:
                if advisory_id:
                    # Chặn chỗ này còn **nặng hơn** chỗ kia: `_upsert_ai_components`
                    # ở dưới GHI vào record. Thay nhầm record ở đây là ghi
                    # component của phiên này vào phiên khác — hỏng dữ liệu, không
                    # chỉ hiển thị sai.
                    raise NotFoundErrorException(
                        detail=(
                            'Advisory vừa tạo không tìm thấy trong hệ thống. '
                            'Từ chối tạo components trên phiên khác.'
                        ),
                        code='advisory_refresh_unresolvable',
                    )
                record = _latest_ai_record(request.user, normalized_symbol)

        if record is None:
            raise NotFoundErrorException(detail=f'Chưa có advisory gốc để tạo components cho {normalized_symbol}.', code='not_found')

        payload_data = request.data if isinstance(request.data, dict) else {}
        timeframe = str(payload_data.get('timeframe') or '30m').strip() or '30m'
        chart_context = payload_data.get('chart_context') if isinstance(payload_data.get('chart_context'), dict) else None
        components, created_now, warnings = _upsert_ai_components(record, timeframe=timeframe, chart_context=chart_context)

        context = _ai_context_snapshot(record)
        deleted_components = _dict_list(context.get('deleted_components'))
        summary_sequence = _int_value(context.get('summary_sequence'), 1)
        if not _dict_list(context.get('executive_summaries')):
            context['executive_summary'] = _build_summary_from_components(record, components, deleted_components, summary_sequence)
            context['executive_summaries'] = [context['executive_summary']]
            _save_advisory_context(record, context)

        manual_trigger = context.get('manual_trigger') if isinstance(context.get('manual_trigger'), dict) else {
            'job_key': 'advisory_refresh',
            'source': 'native_components_generate',
        }

        return envelope(
            {
                'symbol': normalized_symbol,
                'status': record.status,
                'advisory': AdvisoryRecordSerializer(record).data,
                'created_count': len(components) if created_now else 0,
                'generated_by_ai': False,
                'chart_context_used': bool(chart_context),
                'chart_context_warnings': warnings,
                'manual_trigger': manual_trigger,
                'components': components,
                'deleted_components': deleted_components,
            },
            status=status.HTTP_201_CREATED,
        )


class StockManagementAIAdvisoryComponentsDeletedView(APIView):
    """DELETE /api/stock-management/stocks/<symbol>/ai-advisory-components/deleted/"""
    permission_classes = TENANT_PERMISSION_CLASSES

    def get(self, request, symbol):
        normalized_symbol = _normalize_ai_symbol(symbol)
        if not normalized_symbol:
            raise ValidationErrorException(detail='Symbol không hợp lệ.', code='validation_error')

        advisory_id = str(request.query_params.get('advisory_id') or '').strip() or None
        record, error_response = _find_symbol_advisory_record(request.user, normalized_symbol, advisory_id=advisory_id)
        if error_response is not None:
            if error_response.status_code == status.HTTP_404_NOT_FOUND:
                return envelope({'symbol': normalized_symbol, 'deleted': []}, status=status.HTTP_200_OK)
            return error_response

        context = _ai_context_snapshot(record)
        deleted_components = _normalize_component_collection(context.get('deleted_components'))[0]
        return envelope({'symbol': normalized_symbol, 'deleted': deleted_components}, status=status.HTTP_200_OK)

    def delete(self, request, symbol):
        normalized_symbol = _normalize_ai_symbol(symbol)
        if not normalized_symbol:
            raise ValidationErrorException(detail='Symbol không hợp lệ.', code='validation_error')

        advisory_id = str(request.query_params.get('advisory_id') or '').strip() or None
        record, error_response = _find_symbol_advisory_record(request.user, normalized_symbol, advisory_id=advisory_id)
        if error_response is not None:
            if error_response.status_code == status.HTTP_404_NOT_FOUND:
                return envelope({'symbol': normalized_symbol, 'deleted_count': 0, 'message': 'Đã xóa toàn bộ deleted tabs.'}, status=status.HTTP_200_OK)
            return error_response

        context = _ai_context_snapshot(record)
        deleted_components, _ = _normalize_component_collection(context.get('deleted_components'))
        deleted_count = len(deleted_components)
        context['deleted_components'] = []
        _save_advisory_context(record, context)
        return envelope({'symbol': normalized_symbol, 'deleted_count': deleted_count, 'message': 'Đã xóa toàn bộ deleted tabs.'}, status=status.HTTP_200_OK)


class StockManagementAIAdvisorySummaryRegenerateView(APIView):
    """POST /api/stock-management/stocks/<symbol>/ai-advisory-summary/regenerate/"""
    permission_classes = TENANT_PERMISSION_CLASSES

    def post(self, request, symbol):
        normalized_symbol = _normalize_ai_symbol(symbol)
        if not normalized_symbol:
            raise ValidationErrorException(detail='Symbol không hợp lệ.', code='validation_error')

        advisory_id = str(request.query_params.get('advisory_id') or '').strip() or None
        record, error_response = _find_symbol_advisory_record(request.user, normalized_symbol, advisory_id=advisory_id)
        if error_response is not None:
            if error_response.status_code == status.HTTP_404_NOT_FOUND:
                raise NotFoundErrorException(detail=f'Chưa có advisory gốc để tổng hợp cho {normalized_symbol}.', code='not_found')
            return error_response

        payload_data = request.data if isinstance(request.data, dict) else {}
        component_ids = payload_data.get('component_ids')
        synthesis_preference = str(payload_data.get('synthesis_preference') or 'balanced').strip().lower()
        if synthesis_preference not in {'short_term_action', 'risk_management', 'balanced'}:
            synthesis_preference = 'balanced'
        raw_prompt_config = payload_data.get('prompt_config')
        prompt_config = raw_prompt_config if isinstance(raw_prompt_config, dict) else None

        context = _ai_context_snapshot(record)
        components, _ = _normalize_component_collection(context.get('components'))
        deleted_components, _ = _normalize_component_collection(context.get('deleted_components'))
        active_components = [
            item for item in components
            if not item.get('is_deleted') and item.get('include_in_summary')
        ]
        if isinstance(component_ids, list) and component_ids:
            requested_ids = {_int_value(item, -1) for item in component_ids}
            active_components = [item for item in active_components if item['id'] in requested_ids]

        if not active_components:
            raise ValidationErrorException(detail='Không có component active để tổng hợp.', code='validation_error')

        summary_sequence = _int_value(context.get('summary_sequence'), 0) + 1
        summary = _build_summary_from_components(record, active_components, deleted_components, summary_sequence)
        summary['synthesis_preference'] = synthesis_preference
        if prompt_config is not None:
            summary['prompt_config'] = prompt_config

        executive_summaries = _dict_list(context.get('executive_summaries'))
        executive_summaries = [summary, *[item for item in executive_summaries if _int_value(item.get('summary_version'), 0) != summary_sequence]]
        context['summary_sequence'] = summary_sequence
        context['executive_summary'] = summary
        context['executive_summaries'] = executive_summaries[:8]
        context['components'] = components
        context['deleted_components'] = deleted_components
        aggregate = context.get('aggregate') if isinstance(context.get('aggregate'), dict) else {}
        aggregate.update(
            {
                'advisory_id': str(record.advisory_id),
                'session_date': record.session_date.isoformat(),
                'selected_trade_date': record.session_date.isoformat(),
                'contract_version': 'v1',
                'decision': {
                    'action': summary['strategy_action'],
                    'risk': summary['risk_level'],
                    'score_band': summary['score_band'],
                    'score': round(_float_value(summary['overall_confidence'], 0.0) / 10.0, 2),
                },
                'observability': {
                    'severity_drift_24h': {'label': summary['strategy_action'], 'delta': 0},
                    'aggregate_quality': {'score': summary['overall_confidence'], 'label': 'native'},
                },
            }
        )
        context['aggregate'] = aggregate
        _save_advisory_context(record, context)

        return envelope(
            {
                'ok': True,
                'symbol': normalized_symbol,
                'status': record.status,
                'executive_summary': summary,
                'executive_summaries': executive_summaries[:8],
                'components': components,
            },
            status=status.HTTP_201_CREATED,
        )


class StockManagementAIAdvisorySummaryDetailView(APIView):
    """DELETE /api/stock-management/stocks/<symbol>/ai-advisory-summary/<summary_id>/"""
    permission_classes = TENANT_PERMISSION_CLASSES

    def delete(self, request, symbol, summary_id):
        normalized_symbol = _normalize_ai_symbol(symbol)
        if not normalized_symbol:
            raise ValidationErrorException(detail='Symbol không hợp lệ.', code='validation_error')

        advisory_id = str(request.query_params.get('advisory_id') or '').strip() or None
        record, error_response = _find_symbol_advisory_record(request.user, normalized_symbol, advisory_id=advisory_id)
        if error_response is not None:
            if error_response.status_code == status.HTTP_404_NOT_FOUND:
                raise NotFoundErrorException(detail=f'Thông tin tổng hợp không tồn tại cho {normalized_symbol}.', code='not_found')
            return error_response

        context = _ai_context_snapshot(record)
        executive_summaries = _dict_list(context.get('executive_summaries'))
        remaining_summaries = [item for item in executive_summaries if _int_value(item.get('summary_version'), 0) != _int_value(summary_id, 0)]
        if len(remaining_summaries) == len(executive_summaries):
            raise NotFoundErrorException(detail=f'Thông tin tổng hợp không tồn tại cho {normalized_symbol}.', code='not_found')

        context['executive_summaries'] = remaining_summaries
        if _int_value(context.get('summary_sequence'), 0) == _int_value(summary_id, 0):
            context['summary_sequence'] = _int_value(summary_id, 0)
        context['executive_summary'] = remaining_summaries[0] if remaining_summaries else None
        _save_advisory_context(record, context)
        return Response(status=status.HTTP_204_NO_CONTENT)


class StockManagementFinancialsView(APIView):
    """GET /api/stock-management/stocks/<symbol>/financials/ — graceful empty."""
    permission_classes = TENANT_PERMISSION_CLASSES

    @extend_schema(
        summary='Lấy báo cáo tài chính native cho stock workspace',
        description='Endpoint native `/core/v1/stock-management/stocks/{symbol}/financials/` trả về báo cáo tài chính (ratio, income_statement, balance_sheet) lấy từ vnbroker, cache 12 giờ.',
        parameters=[
            OpenApiParameter(
                name='force',
                type=OpenApiTypes.BOOL,
                location=OpenApiParameter.QUERY,
                description='Bỏ qua cache và fetch mới dữ liệu.',
                required=False,
            ),
        ],
        responses={
            200: _STOCK_FINANCIALS_SCHEMA,
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
        },
    )

    def get(self, request, symbol):
        from market_data.vnbroker_adapter import get_company_financials_response

        symbol = symbol.upper()
        force = str(request.query_params.get('force', '')).lower() == 'true'
        return Response(get_company_financials_response(symbol, force=force))


# ---------------------------------------------------------------------------
# Advisory component compat views
# ---------------------------------------------------------------------------

class StockManagementAdvisoryCompToggleView(APIView):
    """POST /api/stock-management/ai-advisory-components/<pk>/toggle-include/"""
    permission_classes = TENANT_PERMISSION_CLASSES

    def post(self, request, pk):
        advisory_id = str(request.query_params.get('advisory_id') or '').strip() or None
        record, context, components, deleted_components, component, component_bucket, component_index, error_response = _find_component_record(request.user, _int_value(pk, -1), advisory_id=advisory_id)
        if error_response is not None:
            return error_response
        if record is None or component is None:
            raise NotFoundErrorException(detail='Component không tồn tại.', code='not_found')

        if component_bucket == 'components':
            components[component_index]['include_in_summary'] = not bool(components[component_index].get('include_in_summary', True))
            components[component_index]['updated_at'] = timezone.now().isoformat()
        else:
            deleted_components[component_index]['include_in_summary'] = not bool(deleted_components[component_index].get('include_in_summary', False))
            deleted_components[component_index]['updated_at'] = timezone.now().isoformat()
        _update_component_lists(record, components, deleted_components)
        updated_component = components[component_index] if component_bucket == 'components' else deleted_components[component_index]
        return envelope({'component': updated_component}, status=status.HTTP_200_OK)


class StockManagementAdvisoryCompRefreshView(APIView):
    """POST /api/stock-management/ai-advisory-components/<pk>/refresh/"""
    permission_classes = TENANT_PERMISSION_CLASSES

    def post(self, request, pk):
        advisory_id = str(request.query_params.get('advisory_id') or '').strip() or None
        record, context, components, deleted_components, component, component_bucket, component_index, error_response = _find_component_record(request.user, _int_value(pk, -1), advisory_id=advisory_id)
        if error_response is not None:
            return error_response
        if record is None or component is None:
            raise NotFoundErrorException(detail='Chưa có advisory gốc để làm mới tab.', code='not_found')

        refreshed_component = dict(component)
        refreshed_component['confidence_score'] = min(10, _int_value(refreshed_component.get('confidence_score'), 5) + 1)
        refreshed_component['status'] = refreshed_component.get('status') or 'neutral'
        refreshed_component['rationale_text'] = refreshed_component.get('rationale_text') or f'Làm mới native cho {record.symbol}'
        refreshed_component['updated_at'] = timezone.now().isoformat()
        if component_bucket == 'components':
            components[component_index] = refreshed_component
        else:
            deleted_components[component_index] = refreshed_component
        _update_component_lists(record, components, deleted_components)
        return envelope({'generated_by_ai': False, 'component': refreshed_component, 'message': 'Đã làm mới tab AI đang chọn.'}, status=status.HTTP_200_OK)


class StockManagementAdvisoryCompRestoreView(APIView):
    """POST /api/stock-management/ai-advisory-components/<pk>/restore/"""
    permission_classes = TENANT_PERMISSION_CLASSES

    def post(self, request, pk):
        advisory_id = str(request.query_params.get('advisory_id') or '').strip() or None
        record, context, components, deleted_components, component, component_bucket, component_index, error_response = _find_component_record(request.user, _int_value(pk, -1), advisory_id=advisory_id)
        if error_response is not None:
            return error_response
        if record is None or component is None:
            raise NotFoundErrorException(detail='Component không tồn tại hoặc chưa bị xóa.', code='not_found')

        if component_bucket != 'deleted_components':
            raise NotFoundErrorException(detail='Component không tồn tại hoặc chưa bị xóa.', code='not_found')

        restored_component = dict(component)
        restored_component['is_deleted'] = False
        restored_component['include_in_summary'] = True
        restored_component['updated_at'] = timezone.now().isoformat()
        deleted_components.pop(component_index)
        components.append(restored_component)
        components.sort(key=lambda item: _int_value(item.get('id'), 0))
        _update_component_lists(record, components, deleted_components)
        return envelope({'component': restored_component}, status=status.HTTP_200_OK)


class StockManagementAdvisoryCompDetailView(APIView):
    """DELETE /api/stock-management/ai-advisory-components/<pk>/"""
    permission_classes = TENANT_PERMISSION_CLASSES

    def get(self, request, pk):
        advisory_id = str(request.query_params.get('advisory_id') or '').strip() or None
        record, context, components, deleted_components, component, component_bucket, component_index, error_response = _find_component_record(request.user, _int_value(pk, -1), advisory_id=advisory_id)
        if error_response is not None:
            return error_response
        if record is None or component is None:
            raise NotFoundErrorException(detail='Component không tồn tại.', code='not_found')
        return envelope({'id': component['id'], 'component': component, 'deleted_components': deleted_components}, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        advisory_id = str(request.query_params.get('advisory_id') or '').strip() or None
        record, context, components, deleted_components, component, component_bucket, component_index, error_response = _find_component_record(request.user, _int_value(pk, -1), advisory_id=advisory_id)
        if error_response is not None:
            return error_response
        if record is None or component is None:
            raise NotFoundErrorException(detail='Component không tồn tại.', code='not_found')

        if component_bucket == 'deleted_components':
            return Response(status=status.HTTP_204_NO_CONTENT)

        removed_component = dict(component)
        removed_component['is_deleted'] = True
        removed_component['include_in_summary'] = False
        removed_component['updated_at'] = timezone.now().isoformat()
        components.pop(component_index)
        deleted_components.insert(0, removed_component)
        _update_component_lists(record, components, deleted_components)
        return Response(status=status.HTTP_204_NO_CONTENT)


class StockManagementPortfolioNewsDigestView(APIView):
    """GET /api/stock-management/portfolio/news-digest/"""
    permission_classes = TENANT_PERMISSION_CLASSES

    @extend_schema(
        summary='Lấy portfolio news digest native cho frontend thuê bao',
        description=(
            'Endpoint native `/core/v1/stock-management/portfolio/news-digest/`. '
            'Hiện trả về stub facts-first để frontend render lane digest mà không phụ thuộc compat `/api`.'
        ),
        responses={
            200: envelope_schema(_PORTFOLIO_NEWS_DIGEST_SCHEMA),
            401: OpenApiTypes.OBJECT,
        },
        examples=[
            OpenApiExample(
                'Portfolio news digest stub',
                value={
                    'news': [],
                    'note': 'news_digest_not_available_in_native',
                },
            ),
        ],
    )
    def get(self, request):
        return envelope({'news': [], 'note': 'news_digest_not_available_in_native'})


# ---------------------------------------------------------------------------
# Groups / tracked symbols / price alerts
# ---------------------------------------------------------------------------

class StockManagementGroupsView(APIView):
    """GET /api/stock-management/groups/ — native watchlist-backed groups."""
    permission_classes = TENANT_PERMISSION_CLASSES

    @extend_schema(
        summary='Lấy market groups native cho watchlist và dashboard symbol universe',
        description=(
            'Endpoint native `/core/v1/stock-management/groups/`. '
            'Trả về danh sách group watchlist-backed kèm `items` inline để frontend thuê bao xây symbol universe và panel watchlist.'
        ),
        parameters=[
            OpenApiParameter(
                name='include_prices',
                type=OpenApiTypes.BOOL,
                location=OpenApiParameter.QUERY,
                description='Đặt `false` để bỏ price enrichment khi caller chỉ cần symbol universe.',
                required=False,
            ),
        ],
        responses={
            200: envelope_schema(_STOCK_MANAGEMENT_GROUP_LIST_SCHEMA),
            401: OpenApiTypes.OBJECT,
        },
        examples=[
            OpenApiExample(
                'Stock management groups',
                value=[
                    {
                        'id': 7,
                        'name': 'Ngân hàng',
                        'group_type': 'SECTOR',
                        'description': 'Nhóm ngân hàng',
                        'color': '#3b82f6',
                        'order': 1,
                        'items': [
                            {
                                'id': 81,
                                'symbol': 'TPB',
                                'note': 'Theo dõi ngân hàng',
                                'current_price': 18.25,
                                'prev_price': 17.9,
                                'change_value': 0.35,
                                'change_pct': 1.96,
                                'last_date': '2026-05-20',
                            },
                        ],
                    },
                ],
            ),
        ],
    )
    def get(self, request):
        include_prices = str(request.query_params.get('include_prices', '1')).strip().lower() not in {'0', 'false', 'no'}
        group_meta_map = _load_group_meta_map()
        groups = list(CachedSymbolGroup.objects.filter(is_active=True).prefetch_related('members'))
        groups.sort(key=lambda g: _group_sort_key_cached(g, group_meta_map))
        symbols = [m.symbol for g in groups for m in g.members.all()]
        price_map = _build_price_change_map(symbols) if include_prices else {}
        return envelope([
            _serialize_cached_group(g, index, price_map, group_meta_map)
            for index, g in enumerate(groups)
        ])


def seed_default_watchlist_groups(user, force_recreate=False, mode='active'):
    """Seed watchlist groups from CachedSymbolGroup (SSOT) — không dùng default_groups.py nữa.

    Group types:
    - SECTOR: classify từ StockProfile.industry/company_name
    - INDEX: fetch_symbol_group_members() từ vnbroker
    - EXCHANGE: classify từ StockProfile.exchange
    - ETF/CW/BOND/DERIVATIVE: fetch_symbol_group_members() hoặc skip nếu fail
    """
    tenant = _resolve_user_tenant(user)
    created_groups = []
    updated_groups = []
    created_group_pks = set()
    added_symbols = 0

    from .vnbroker_adapter import fetch_listing_symbols, fetch_symbol_group_members
    from market_data.models import StockProfile
    import logging
    logger = logging.getLogger(__name__)

    # ── Ensure StockProfiles are populated ──
    try:
        symbols_data = fetch_listing_symbols()
        if symbols_data:
            if mode == 'active':
                symbols_data = [
                    item for item in symbols_data
                    if item.get('symbol') and len(item['symbol']) == 3 and item['symbol'].isalpha()
                ]
            for item in symbols_data:
                StockProfile.objects.update_or_create(
                    symbol=item['symbol'],
                    defaults={
                        'exchange': item.get('exchange', 'HOSE') or 'HOSE',
                        'company_name': item.get('company_name', ''),
                        'industry': item.get('industry', '') or '',
                        'status': StockProfile.StatusChoices.ACTIVE,
                    }
                )
    except Exception as e:
        logger.warning("Failed to sync stock profiles from listing source during seeding: %s", e)

    # ── Load groups from CachedSymbolGroup (SSOT) ──
    from service_ops.models import CachedSymbolGroup
    cached_groups = list(CachedSymbolGroup.objects.filter(is_active=True).order_by('display_order', 'group_name'))

    # If DB empty, auto-sync first
    if not cached_groups:
        from .vnbroker_adapter import sync_cached_symbol_groups
        sync_cached_symbol_groups()
        cached_groups = list(CachedSymbolGroup.objects.filter(is_active=True).order_by('display_order', 'group_name'))

    # ── Classify sector groups from StockProfile ──
    # Sector group names for classification
    _SECTOR_NAMES = [g.group_name for g in cached_groups if g.group_type == 'SECTOR']

    def classify_profile(p):
        ind_lower = str(p.industry or '').strip().lower()
        name_lower = str(p.company_name or '').lower()

        if ind_lower:
            if any(k in ind_lower for k in ['ngân hàng', 'bank', 'chứng khoán', 'securities', 'bảo hiểm', 'insurance', 'tài chính', 'finance']):
                return "Ngân hàng"
            if any(k in ind_lower for k in ['bất động sản', 'real estate', 'property']):
                return "Bất động sản"
            if any(k in ind_lower for k in ['vật liệu', 'xây dựng', 'thép', 'steel', 'cement', 'xi măng', 'thiết bị điện', 'máy móc', 'phụ trợ', 'sắt', 'nhôm', 'kim loại', 'metal']):
                return "Thép & Vật liệu"
            if any(k in ind_lower for k in ['dầu khí', 'khai khoáng', 'coal', 'gas', 'tiện ích', 'petro', 'oil', 'năng lượng', 'energy', 'khoáng sản', 'mineral', 'mining', 'utility', 'utilities']):
                return "Dầu khí"
            if any(k in ind_lower for k in ['công nghệ', 'technology', 'viễn thông', 'telecom', 'phần mềm', 'software', 'tin học', 'communication']):
                return "Công nghệ"
            if any(k in ind_lower for k in ['bán lẻ', 'retail', 'tiêu dùng', 'consumer', 'thực phẩm', 'food', 'đồ uống', 'beverage', 'thủy sản', 'seafood', 'nông sản', 'nông - lâm - ngư', 'bán buôn', 'nhựa', 'hóa chất', 'chăm sóc sức khỏe', 'pharma', 'dược', 'gia dụng', 'household', 'vận tải', 'transport', 'logistic', 'logistics', 'cảng', 'port', 'hàng không', 'aviation', 'du lịch', 'tourism', 'dịch vụ', 'service', 'dệt', 'may', 'garment', 'y tế', 'medical', 'nông nghiệp', 'agriculture', 'chăn nuôi', 'cao su', 'rubber', 'nhựa', 'plastic', 'hóa chất', 'chemical', 'giấy', 'paper', 'sản xuất', 'chế biến']):
                return "Bán lẻ & Tiêu dùng"

        if name_lower:
            if any(k in name_lower for k in ['ngân hàng', 'bank', 'chứng khoán', 'securities', 'bảo hiểm', 'insurance', 'tài chính', 'finance', 'commercial bank']):
                return "Ngân hàng"
            if any(k in name_lower for k in ['bất động sản', 'địa ốc', 'land', 'real estate', 'house', 'đô thị', 'phát triển nhà', 'khu công nghiệp', 'property', 'properties']):
                return "Bất động sản"
            if any(k in name_lower for k in ['thép', 'steel', 'xi măng', 'cement', 'vật liệu', 'material', 'sắt', 'nhôm', 'gạch', 'bê tông', 'concrete', 'kính', 'glass', 'xây dựng', 'construction', 'mechanical', 'chế tạo', 'phụ tùng', 'kim loại', 'metal']):
                return "Thép & Vật liệu"
            if any(k in name_lower for k in ['dầu khí', 'xăng dầu', 'khí', 'petrol', 'petro', 'gas', 'oil', 'coal', 'than', 'năng lượng', 'energy', 'power', 'điện', 'nhiệt điện', 'thủy điện', 'khoáng sản', 'mineral', 'mining', 'khai thác']):
                return "Dầu khí"
            if any(k in name_lower for k in ['công nghệ', 'technology', 'viễn thông', 'telecom', 'phần mềm', 'software', 'tin học', 'communication', 'media', 'truyền thông']):
                return "Công nghệ"
            if any(k in name_lower for k in ['bán lẻ', 'retail', 'tiêu dùng', 'consumer', 'thực phẩm', 'food', 'đồ uống', 'beverage', 'thủy sản', 'seafood', 'nông sản', 'agriculture', 'sữa', 'milk', 'dược', 'pharmaceutical', 'pharma', 'y tế', 'medical', 'mỹ phẩm', 'cosmetics', 'may', 'garment', 'dệt', 'nhựa', 'bao bì', 'bánh', 'kẹo', 'hóa chất', 'chemical', 'cao su', 'rubber', 'giấy', 'paper', 'vận tải', 'transport', 'logistic', 'logistics', 'port', 'cảng', 'hàng không', 'aviation', 'airline', 'hàng hải', 'shipping', 'dịch vụ', 'service', 'du lịch', 'tourism', 'khách sạn', 'hotel', 'siêu thị', 'supermarket', 'nông nghiệp', 'chăn nuôi', 'thủy điện', 'nước', 'water', 'môi trường', 'environment', 'sách', 'book', 'in ấn', 'printing', 'chế biến', 'sản xuất', 'ingredient', 'ingredients', 'bagging', 'packaging', 'beer']):
                return "Bán lẻ & Tiêu dùng"

        return None

    # ── Build symbols map from CachedSymbolGroup ──
    group_symbols_map: dict[str, list[str]] = {g.group_name: [] for g in cached_groups}

    # Classify sector symbols from StockProfile
    profiles = list(StockProfile.objects.filter(status=StockProfile.StatusChoices.ACTIVE))
    if mode == 'active':
        profiles = [p for p in profiles if len(p.symbol) == 3 and p.symbol.isalpha()]
    for p in profiles:
        sector_name = classify_profile(p)
        if sector_name and sector_name in group_symbols_map:
            group_symbols_map[sector_name].append(p.symbol)
        # Exchange groups
        exch = str(p.exchange or '').upper().strip()
        if exch in group_symbols_map:
            group_symbols_map[exch].append(p.symbol)

    # Fetch index groups from vnbroker
    for g in cached_groups:
        if g.group_type == 'INDEX':
            try:
                syms = fetch_symbol_group_members(g.group_name.lower())
                if syms:
                    group_symbols_map[g.group_name] = syms
            except Exception as e:
                logger.warning("Failed to fetch %s symbols: %s", g.group_name, e)

    # Fetch ETF/CW/BOND/DERIVATIVE from vnbroker (best effort)
    for g in cached_groups:
        if g.group_type in ('ETF', 'CW', 'BOND', 'DERIVATIVE') and not group_symbols_map.get(g.group_name):
            try:
                syms = fetch_symbol_group_members(g.group_name.lower())
                if syms:
                    group_symbols_map[g.group_name] = syms
            except Exception:
                pass

    # ── Sync CachedSymbolGroup members (tách biệt với Watchlist của user) ──
    # Các nhóm này là system/market universe (BOND, HOSE, VN30, sector...),
    # KHÔNG phải danh mục do user tạo. Thành viên lưu vào CachedSymbolGroupMember
    # (bảng riêng), không ghi vào Watchlist/WatchlistItem của user → không lộn
    # vào "Danh mục của tôi".
    from service_ops.models import CachedSymbolGroupMember

    for g in cached_groups:
        group_symbols = group_symbols_map.get(g.group_name, [])

        if force_recreate:
            CachedSymbolGroupMember.objects.filter(group=g).delete()

        existing = set(
            CachedSymbolGroupMember.objects.filter(group=g).values_list('symbol', flat=True)
        )
        new_members = [
            CachedSymbolGroupMember(group=g, symbol=s, display_order=i)
            for i, s in enumerate(group_symbols)
            if s not in existing
        ]
        if new_members:
            CachedSymbolGroupMember.objects.bulk_create(new_members)

        group_added_symbols = len(new_members)

        from market_data.global_symbol_registry import sync_admin_group_symbol_set
        res_sync = sync_admin_group_symbol_set(
            g.group_name,
            group_symbols,
            group_type=g.group_type,
            description=g.description,
        )
        logger.debug("DEBUG SYNC: group='%s', symbols=%s, res_len=%d", g.group_name, group_symbols, len(res_sync))

        added_symbols += group_added_symbols
        if g.pk not in created_group_pks:
            created_groups.append({'group': g.group_name, 'symbols': len(group_symbols)})
            created_group_pks.add(g.pk)
        elif group_added_symbols:
            updated_groups.append({'group': g.group_name, 'new_symbols': group_added_symbols})

    # System default groups seeding
    from market_data.global_symbol_registry import sync_system_default_symbol_group
    system_default_group_ids = get_system_default_group_ids()
    synced_system_groups = []
    for group_id in system_default_group_ids:
        try:
            system_symbols = fetch_symbol_group_members(group_id)
        except Exception:
            system_symbols = []
        if system_symbols:
            sync_system_default_symbol_group(group_id, system_symbols)
            synced_system_groups.append({'group_id': group_id, 'symbols': len(system_symbols)})

    return {
        'created': created_groups,
        'updated': updated_groups,
        'added_symbols': added_symbols,
        'system_groups': synced_system_groups,
    }


class StockManagementSeedView(APIView):
    """POST /api/stock-management/seed/ — create/update default market groups."""
    permission_classes = TENANT_PERMISSION_CLASSES

    def post(self, request):
        result = seed_default_watchlist_groups(request.user, force_recreate=True)
        message_parts = []
        if result['created']:
            message_parts.append(f"đã tạo {len(result['created'])} nhóm mặc định")
        if result['updated']:
            message_parts.append(f"cập nhật {len(result['updated'])} nhóm")
        if result['added_symbols']:
            message_parts.append(f"thêm {result['added_symbols']} mã")
        if not message_parts:
            message_parts.append('không có thay đổi')

        return envelope({
            'created': result['created'],
            'updated': result['updated'],
            'added_symbols': result['added_symbols'],
            'system_default_groups': result['system_groups'],
            'message': ', '.join(message_parts).capitalize() + '.',
        })


class StockManagementSyncView(APIView):
    """POST /api/stock-management/sync/ — native quote refresh for user scope."""
    permission_classes = TENANT_PERMISSION_CLASSES

    def post(self, request):
        watchlist_symbols = list(
            _watchlist_items_queryset_for_user(request.user)
            .values_list('symbol', flat=True)
            .distinct()
        )
        tracked_symbols = list(
            _tracked_symbols_queryset_for_user(request.user)
            .values_list('symbol', flat=True)
            .distinct()
        )
        alert_symbols = list(
            _price_alerts_queryset_for_user(request.user)
            .values_list('symbol', flat=True)
            .distinct()
        )
        symbols = sorted({*(str(symbol).upper().strip() for symbol in watchlist_symbols), *(str(symbol).upper().strip() for symbol in tracked_symbols), *(str(symbol).upper().strip() for symbol in alert_symbols)} - {''})
        if not symbols:
            return envelope({
                'synced': [],
                'total_symbols': 0,
                'requested_symbols': 0,
                'scope': 'native',
                'message': 'Không có mã để đồng bộ trong phạm vi hiện tại.',
            })

        planner_result = create_global_planner_run(
            symbols=symbols,
            datasets=['price_board_snapshot'],
            mode='missing_only',
            force_refresh=False,
            reason='stock_management_user_sync',
            execution_mode='async',
            trigger='market_data.stock_management.sync',
            planner_queue='manual_on_demand',
            extra_input_summary={
                'scope': 'user_demand',
                'requested_symbols': len(symbols),
            },
        )
        return envelope({
            'synced': symbols,
            'total_symbols': len(symbols),
            'requested_symbols': len(symbols),
            'scope': 'global_ssot',
            'source': 'global_planner',
            'queued': bool(planner_result.get('queued')),
            'status': planner_result.get('status') or 'queued',
            'run_id': planner_result.get('run_id'),
            'celery_task_id': planner_result.get('celery_task_id'),
            'plan_summary': dict(planner_result.get('plan_summary') or {}),
            'message': f'Đã ghi nhận yêu cầu làm mới SSOT cho {len(symbols)} mã.',
        })


# =============================================================================
# OHLCV Bars endpoint — cursor-paginated bars contract
# =============================================================================

_OHLCV_VALID_TIMEFRAMES = frozenset(['1m', '5m', '15m', '1H', '2H', '4H', 'D', 'W', 'M'])
_OHLCV_INTRADAY_TIMEFRAMES = frozenset(['1m', '5m', '15m', '1H', '2H', '4H'])
_OHLCV_BAR_LIMIT_DEFAULT = 500
_OHLCV_BAR_LIMIT_MAX = 1000


def _parse_ohlcv_ts(raw):
    """Parse Unix ms int/str or ISO 8601 string → UTC-aware datetime. Returns None if falsy."""
    if raw is None or raw == '':
        return None
    try:
        ms = int(raw)
        return datetime.fromtimestamp(ms / 1000.0, tz=dt_timezone.utc)
    except (TypeError, ValueError, OSError, OverflowError):
        pass
    try:
        from django.utils.dateparse import parse_datetime as _parse_dt
        dt = _parse_dt(str(raw))
        if dt is not None:
            return dt if dt.tzinfo else dt.replace(tzinfo=dt_timezone.utc)
    except (TypeError, ValueError):
        pass
    return None


def _dt_to_unix_ms(dt):
    """Convert UTC-aware datetime → Unix milliseconds int. Returns None if None."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=dt_timezone.utc)
    return int(dt.timestamp() * 1000)


def _ohlcv_bar_from_intraday(bar):
    return {
        'timestamp': _dt_to_unix_ms(bar.datetime),
        'open': _to_float(bar.open),
        'high': _to_float(bar.high),
        'low': _to_float(bar.low),
        'close': _to_float(bar.close),
        'volume': _to_int(bar.volume) or 0,
    }


def _ohlcv_bar_from_daily(row):
    dt = datetime.combine(row.date, time.min).replace(tzinfo=dt_timezone.utc)
    return {
        'timestamp': _dt_to_unix_ms(dt),
        'open': _to_float(row.open),
        'high': _to_float(row.high),
        'low': _to_float(row.low),
        'close': _to_float(row.close),
        'volume': _to_int(row.volume) or 0,
    }


def _aggregate_daily_to_ohlcv_bars(rows, timeframe):
    """Aggregate DailyPrice rows into W or M OHLCV bars. Returns list of bar dicts."""
    if not rows:
        return []
    buckets = []
    current = None
    for row in rows:
        key = row.date.isocalendar()[:2] if timeframe == 'W' else (row.date.year, row.date.month)
        if current is None or current['key'] != key:
            current = {
                'key': key,
                'date': row.date,
                'open': row.open,
                'high': row.high,
                'low': row.low,
                'close': row.close,
                'volume': _to_int(row.volume) or 0,
            }
            buckets.append(current)
        else:
            current['high'] = max(current['high'], row.high)
            current['low'] = min(current['low'], row.low)
            current['close'] = row.close
            current['volume'] += _to_int(row.volume) or 0
    result = []
    for b in buckets:
        dt = datetime.combine(b['date'], time.min).replace(tzinfo=dt_timezone.utc)
        result.append({
            'timestamp': _dt_to_unix_ms(dt),
            'open': _to_float(b['open']),
            'high': _to_float(b['high']),
            'low': _to_float(b['low']),
            'close': _to_float(b['close']),
            'volume': b['volume'],
        })
    return result


def _fetch_ohlcv_bars_before(symbol, timeframe, before_dt, limit):
    """Return (bars_asc, has_more_before, has_more_after)."""
    fetch = limit + 1
    if timeframe in _OHLCV_INTRADAY_TIMEFRAMES:
        qs = list(
            IntradayBar.objects
            .filter(symbol=symbol, timeframe__iexact=timeframe, datetime__lt=before_dt)
            .order_by('-datetime')[:fetch]
        )
        has_more_before = len(qs) > limit
        qs = qs[:limit]
        qs.reverse()
        bars = [_ohlcv_bar_from_intraday(r) for r in qs]
        has_more_after = IntradayBar.objects.filter(
            symbol=symbol, timeframe__iexact=timeframe, datetime__gte=before_dt
        ).exists()
    elif timeframe == 'D':
        before_date = before_dt.date()
        qs = list(
            DailyPrice.objects
            .filter(symbol=symbol, date__lt=before_date)
            .order_by('-date')[:fetch]
        )
        has_more_before = len(qs) > limit
        qs = qs[:limit]
        qs.reverse()
        bars = [_ohlcv_bar_from_daily(r) for r in qs]
        has_more_after = DailyPrice.objects.filter(symbol=symbol, date__gte=before_date).exists()
    else:
        days_each = 7 if timeframe == 'W' else 31
        span_days = (limit + 2) * days_each
        start_date = before_dt.date() - timedelta(days=span_days)
        daily_rows = list(
            DailyPrice.objects
            .filter(symbol=symbol, date__range=(start_date, before_dt.date() - timedelta(days=1)))
            .order_by('date')
        )
        all_bars = _aggregate_daily_to_ohlcv_bars(daily_rows, timeframe)
        has_more_before = len(all_bars) > limit
        bars = all_bars[-limit:] if all_bars else []
        has_more_after = DailyPrice.objects.filter(symbol=symbol, date__gte=before_dt.date()).exists()
    return bars, has_more_before, has_more_after


def _fetch_ohlcv_bars_after(symbol, timeframe, after_dt, limit):
    """Return (bars_asc, has_more_before, has_more_after)."""
    fetch = limit + 1
    if timeframe in _OHLCV_INTRADAY_TIMEFRAMES:
        qs = list(
            IntradayBar.objects
            .filter(symbol=symbol, timeframe__iexact=timeframe, datetime__gt=after_dt)
            .order_by('datetime')[:fetch]
        )
        has_more_after = len(qs) > limit
        bars = [_ohlcv_bar_from_intraday(r) for r in qs[:limit]]
        has_more_before = IntradayBar.objects.filter(
            symbol=symbol, timeframe__iexact=timeframe, datetime__lte=after_dt
        ).exists()
    elif timeframe == 'D':
        after_date = after_dt.date()
        qs = list(
            DailyPrice.objects
            .filter(symbol=symbol, date__gt=after_date)
            .order_by('date')[:fetch]
        )
        has_more_after = len(qs) > limit
        bars = [_ohlcv_bar_from_daily(r) for r in qs[:limit]]
        has_more_before = DailyPrice.objects.filter(symbol=symbol, date__lte=after_date).exists()
    else:
        days_each = 7 if timeframe == 'W' else 31
        span_days = (limit + 2) * days_each
        end_date = after_dt.date() + timedelta(days=span_days)
        daily_rows = list(
            DailyPrice.objects
            .filter(symbol=symbol, date__range=(after_dt.date() + timedelta(days=1), end_date))
            .order_by('date')
        )
        all_bars = _aggregate_daily_to_ohlcv_bars(daily_rows, timeframe)
        has_more_after = len(all_bars) > limit
        bars = all_bars[:limit]
        has_more_before = DailyPrice.objects.filter(symbol=symbol, date__lte=after_dt.date()).exists()
    return bars, has_more_before, has_more_after


def _fetch_ohlcv_bars_window(symbol, timeframe, from_dt, to_dt):
    """Return (bars_asc, has_more_before, has_more_after)."""
    if timeframe in _OHLCV_INTRADAY_TIMEFRAMES:
        qs = list(
            IntradayBar.objects
            .filter(symbol=symbol, timeframe__iexact=timeframe,
                    datetime__gte=from_dt, datetime__lte=to_dt)
            .order_by('datetime')
        )
        bars = [_ohlcv_bar_from_intraday(r) for r in qs]
        has_more_before = IntradayBar.objects.filter(
            symbol=symbol, timeframe__iexact=timeframe, datetime__lt=from_dt
        ).exists()
        has_more_after = IntradayBar.objects.filter(
            symbol=symbol, timeframe__iexact=timeframe, datetime__gt=to_dt
        ).exists()
    elif timeframe == 'D':
        qs = list(
            DailyPrice.objects
            .filter(symbol=symbol, date__range=(from_dt.date(), to_dt.date()))
            .order_by('date')
        )
        bars = [_ohlcv_bar_from_daily(r) for r in qs]
        has_more_before = DailyPrice.objects.filter(symbol=symbol, date__lt=from_dt.date()).exists()
        has_more_after = DailyPrice.objects.filter(symbol=symbol, date__gt=to_dt.date()).exists()
    else:
        daily_rows = list(
            DailyPrice.objects
            .filter(symbol=symbol, date__range=(from_dt.date(), to_dt.date()))
            .order_by('date')
        )
        bars = _aggregate_daily_to_ohlcv_bars(daily_rows, timeframe)
        has_more_before = DailyPrice.objects.filter(symbol=symbol, date__lt=from_dt.date()).exists()
        has_more_after = DailyPrice.objects.filter(symbol=symbol, date__gt=to_dt.date()).exists()
    return bars, has_more_before, has_more_after


class StockManagementOHLCVBarsView(APIView):
    """GET /api/stock-management/stocks/<symbol>/bars/ — cursor-paginated OHLCV bars.

    Three mutually exclusive modes:
      window:        ?timeframe=D&from=<unix_ms>&to=<unix_ms>
      cursor_before: ?timeframe=D&before=<unix_ms>&limit=200   (default when no mode given)
      cursor_after:  ?timeframe=D&after=<unix_ms>&limit=200
    """
    permission_classes = TENANT_PERMISSION_CLASSES

    @extend_schema(
        summary='Lấy OHLCV bars cursor-paginated',
        description=(
            'Endpoint `/stock-management/stocks/{symbol}/bars/` trả về OHLCV bars có phân trang theo cursor. '
            'Ba mode: window (`from`+`to`), cursor before (`before`+`limit`), cursor after (`after`+`limit`). '
            'Timestamp là Unix milliseconds. Mặc định: cursor before=now, limit=500.'
        ),
        parameters=[
            OpenApiParameter('timeframe', OpenApiTypes.STR, OpenApiParameter.QUERY, required=True,
                             description='Khung thời gian: 1m 5m 15m 1H 2H 4H D W M'),
            OpenApiParameter('from', OpenApiTypes.INT, OpenApiParameter.QUERY, required=False,
                             description='Unix ms — window mode start (dùng cùng with `to`)'),
            OpenApiParameter('to', OpenApiTypes.INT, OpenApiParameter.QUERY, required=False,
                             description='Unix ms — window mode end (dùng cùng với `from`)'),
            OpenApiParameter('before', OpenApiTypes.INT, OpenApiParameter.QUERY, required=False,
                             description='Unix ms — lấy bars trước timestamp này'),
            OpenApiParameter('after', OpenApiTypes.INT, OpenApiParameter.QUERY, required=False,
                             description='Unix ms — lấy bars sau timestamp này'),
            OpenApiParameter('limit', OpenApiTypes.INT, OpenApiParameter.QUERY, required=False,
                             description=f'Số bars trả về (1–{_OHLCV_BAR_LIMIT_MAX}, mặc định {_OHLCV_BAR_LIMIT_DEFAULT})'),
            OpenApiParameter('snapshot_id', OpenApiTypes.STR, OpenApiParameter.QUERY, required=False,
                             description='Client snapshot correlation ID, echo lại trong response'),
        ],
        responses={
            200: envelope_response(),
            400: OpenApiTypes.OBJECT,
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
            404: OpenApiTypes.OBJECT,
        },
    )
    def get(self, request, symbol):
        symbol = symbol.upper()

        # --- validate timeframe ---
        raw_tf = request.query_params.get('timeframe', 'D')
        tf_token = str(raw_tf or 'D').strip()
        tf_token_upper = tf_token.upper()
        tf_token_lower = tf_token.lower()

        if tf_token_lower in {'1m', '5m', '15m'}:
            timeframe = tf_token_lower
        elif tf_token_upper in {'1H', '2H', '4H', 'D', '1D', 'W', '1W', 'M', '1MO'}:
            timeframe = {
                '1D': 'D',
                '1W': 'W',
                '1MO': 'M',
            }.get(tf_token_upper, tf_token_upper)
        else:
            timeframe = None

        if timeframe is None or timeframe not in _OHLCV_VALID_TIMEFRAMES:
            return Response(
                {'code': 'INVALID_TIMEFRAME', 'detail': f'Timeframe "{raw_tf}" không hợp lệ. Hợp lệ: 1m 5m 15m 1H 2H 4H D W M'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --- validate limit ---
        raw_limit = request.query_params.get('limit')
        if raw_limit is not None:
            try:
                limit = int(raw_limit)
            except (TypeError, ValueError):
                return Response(
                    {'code': 'INVALID_LIMIT', 'detail': 'limit phải là số nguyên dương.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not (1 <= limit <= _OHLCV_BAR_LIMIT_MAX):
                return Response(
                    {'code': 'LIMIT_EXCEEDED', 'detail': f'limit phải trong khoảng 1–{_OHLCV_BAR_LIMIT_MAX}.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            limit = _OHLCV_BAR_LIMIT_DEFAULT

        # --- determine mode ---
        raw_from = request.query_params.get('from')
        raw_to = request.query_params.get('to')
        raw_before = request.query_params.get('before')
        raw_after = request.query_params.get('after')
        snapshot_id = request.query_params.get('snapshot_id')

        mode_flags = [
            raw_from is not None or raw_to is not None,
            raw_before is not None,
            raw_after is not None,
        ]
        if sum(mode_flags) > 1:
            return Response(
                {'code': 'INVALID_QUERY', 'detail': 'Chỉ dùng một trong ba mode: (from+to), before, hoặc after.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if raw_from is not None or raw_to is not None:
            mode = 'window'
            from_dt = _parse_ohlcv_ts(raw_from)
            to_dt = _parse_ohlcv_ts(raw_to)
            if from_dt is None or to_dt is None:
                return Response(
                    {'code': 'INVALID_TIMESTAMP', 'detail': 'Window mode yêu cầu cả from và to là timestamp hợp lệ (Unix ms hoặc ISO 8601).'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        elif raw_before is not None:
            mode = 'cursor_before'
            before_dt = _parse_ohlcv_ts(raw_before)
            if before_dt is None:
                return Response(
                    {'code': 'INVALID_TIMESTAMP', 'detail': 'before không hợp lệ. Dùng Unix ms hoặc ISO 8601.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        elif raw_after is not None:
            mode = 'cursor_after'
            after_dt = _parse_ohlcv_ts(raw_after)
            if after_dt is None:
                return Response(
                    {'code': 'INVALID_TIMESTAMP', 'detail': 'after không hợp lệ. Dùng Unix ms hoặc ISO 8601.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            mode = 'cursor_before'
            before_dt = timezone.now()

        # --- symbol check ---
        if not _symbol_exists_for_stock_chart(symbol):
            raise NotFound(f'Stock not found: {symbol}')

        # --- fetch bars ---
        if mode == 'window':
            bars, has_more_before, has_more_after = _fetch_ohlcv_bars_window(
                symbol, timeframe, from_dt, to_dt
            )
            next_before = _dt_to_unix_ms(from_dt)
            next_after = _dt_to_unix_ms(to_dt)
        elif mode == 'cursor_before':
            bars, has_more_before, has_more_after = _fetch_ohlcv_bars_before(
                symbol, timeframe, before_dt, limit
            )
            next_before = bars[0]['timestamp'] if bars else None
            next_after = bars[-1]['timestamp'] if bars else None
        else:
            bars, has_more_before, has_more_after = _fetch_ohlcv_bars_after(
                symbol, timeframe, after_dt, limit
            )
            next_before = bars[0]['timestamp'] if bars else None
            next_after = bars[-1]['timestamp'] if bars else None

        return envelope({
            'symbol': symbol,
            'timeframe': timeframe,
            'bars': bars,
            'has_more_before': has_more_before,
            'has_more_after': has_more_after,
            'next_before': next_before,
            'next_after': next_after,
            'snapshot_id': snapshot_id,
        })


class StockManagementTrackedSymbolsView(APIView):
    """GET/POST /api/stock-management/tracked-symbols/ — native tracked symbol contract."""
    permission_classes = TENANT_PERMISSION_CLASSES

    @extend_schema(
        summary='Lấy danh sách tracked symbols native của user',
        description=(
            'Endpoint native `/core/v1/stock-management/tracked-symbols/`. '
            'Danh sách đã enrich với price snapshot và profile summary để frontend render shortlist trực tiếp.'
        ),
        responses={
200: envelope_schema(_TRACKED_SYMBOL_LIST_SCHEMA),
               401: OpenApiTypes.OBJECT,
        },
        examples=[
            OpenApiExample(
                'Tracked symbols list',
                value=[
                    {
                        'id': 11,
                        'symbol': 'TPB',
                        'industry': 'Ngân hàng',
                        'company_name': 'TPBank',
                        'market_cap_bn': 48000.25,
                        'source_group_id': 7,
                        'source_group_name': 'Ngân hàng',
                        'whale_alert_threshold_million': 850.0,
                        'current_price': 18.25,
                        'prev_price': 17.9,
                        'change_value': 0.35,
                        'change_pct': 1.96,
                        'last_date': '2026-05-20',
                        'added_at': '2026-05-20T09:15:00+07:00',
                        'updated_at': '2026-05-20T09:15:00+07:00',
                    },
                ],
            ),
        ],
    )
    def get(self, request):
        tracked_symbols = list(_tracked_symbols_queryset_for_user(request.user).order_by('-added_at', '-pk'))
        symbols = [row.symbol for row in tracked_symbols]
        price_map = _build_price_change_map(symbols)
        profile_map = _build_profile_map(symbols, price_map)
        return envelope([
            _serialize_tracked_symbol_row(row, price_map, profile_map)
            for row in tracked_symbols
        ])

    @extend_schema(
        summary='Thêm tracked symbol native cho user',
        description=(
            'Endpoint native `/core/v1/stock-management/tracked-symbols/`. '
            'Dùng cho add-to-tracked từ watchlist và stock detail mà không đi qua compat `/api`.'
        ),
        request=_TRACKED_SYMBOL_CREATE_REQUEST_SCHEMA,
        responses={
            201: envelope_schema(_TRACKED_SYMBOL_SCHEMA),
            400: OpenApiTypes.OBJECT,
            401: OpenApiTypes.OBJECT,
            409: OpenApiTypes.OBJECT,
        },
        examples=[
            OpenApiExample(
                'Create tracked symbol request',
                value={
                    'symbol': 'TPB',
                    'source_group_id': 7,
                    'whale_alert_threshold_million': 850,
                },
                request_only=True,
            ),
            OpenApiExample(
                'Create tracked symbol response',
                value={
                    'id': 11,
                    'symbol': 'TPB',
                    'industry': 'Ngân hàng',
                    'company_name': 'TPBank',
                    'market_cap_bn': 48000.25,
                    'source_group_id': 7,
                    'source_group_name': 'Ngân hàng',
                    'whale_alert_threshold_million': 850.0,
                    'current_price': 18.25,
                    'prev_price': 17.9,
                    'change_value': 0.35,
                    'change_pct': 1.96,
                    'last_date': '2026-05-20',
                    'added_at': '2026-05-20T09:15:00+07:00',
                    'updated_at': '2026-05-20T09:15:00+07:00',
                },
                response_only=True,
            ),
        ],
    )
    def post(self, request):
        try:
            symbol = _validate_stock_symbol(request.data.get('symbol') or request.data.get('ticker') or request.data.get('code'))
            threshold_million = _parse_tracked_symbol_threshold_million(request.data.get('whale_alert_threshold_million'))
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        source_watchlist = None
        source_group_id = request.data.get('source_group_id')
        if source_group_id not in (None, ''):
            source_watchlist = _watchlists_queryset_for_user(request.user).filter(pk=source_group_id).first()
            if source_watchlist is None:
                return Response({'detail': 'Nhóm thị trường nguồn không tồn tại.'}, status=status.HTTP_400_BAD_REQUEST)

        tracked_symbol, created = TrackedSymbol.objects.get_or_create(
            user=request.user,
            symbol=symbol,
            defaults={
                'tenant': _resolve_user_tenant(request.user),
                'source_watchlist': source_watchlist,
                'whale_alert_threshold_million': threshold_million,
            },
        )
        if not created:
            return Response({'detail': f'{symbol} đã có trong danh sách theo dõi.'}, status=status.HTTP_409_CONFLICT)

        price_map = _build_price_change_map([symbol])
        profile_map = _build_profile_map([symbol], price_map)
        return envelope(
            _serialize_tracked_symbol_row(tracked_symbol, price_map, profile_map),
            status=status.HTTP_201_CREATED,
        )


class StockManagementTrackedSymbolDetailView(APIView):
    """PATCH/DELETE /api/stock-management/tracked-symbols/<pk>/"""
    permission_classes = TENANT_PERMISSION_CLASSES

    @extend_schema(
        summary='Cập nhật tracked symbol native',
        description='Endpoint native `/core/v1/stock-management/tracked-symbols/{id}/` cho cập nhật threshold hoặc source group.',
        request=_TRACKED_SYMBOL_PATCH_REQUEST_SCHEMA,
        responses={
            200: envelope_schema(_TRACKED_SYMBOL_SCHEMA),
            400: OpenApiTypes.OBJECT,
            401: OpenApiTypes.OBJECT,
            404: OpenApiTypes.OBJECT,
        },
        examples=[
            OpenApiExample(
                'Patch tracked symbol request',
                value={
                    'whale_alert_threshold_million': 920,
                },
                request_only=True,
            ),
        ],
    )
    def patch(self, request, pk):
        tracked_symbol = _get_tracked_symbol_or_404_for_user(request.user, pk)
        update_fields = []

        if 'whale_alert_threshold_million' in request.data:
            try:
                threshold_million = _parse_tracked_symbol_threshold_million(request.data.get('whale_alert_threshold_million'))
            except ValueError as exc:
                return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            if tracked_symbol.whale_alert_threshold_million != threshold_million:
                tracked_symbol.whale_alert_threshold_million = threshold_million
                update_fields.append('whale_alert_threshold_million')

        if 'source_group_id' in request.data:
            source_group_id = request.data.get('source_group_id')
            source_watchlist = None
            if source_group_id not in (None, ''):
                source_watchlist = _watchlists_queryset_for_user(request.user).filter(pk=source_group_id).first()
                if source_watchlist is None:
                    return Response({'detail': 'Nhóm thị trường nguồn không tồn tại.'}, status=status.HTTP_400_BAD_REQUEST)
            if tracked_symbol.source_watchlist_id != (source_watchlist.pk if source_watchlist else None):
                tracked_symbol.source_watchlist = source_watchlist
                update_fields.append('source_watchlist')

        if update_fields:
            if 'updated_at' not in update_fields:
                update_fields.append('updated_at')
            tracked_symbol.save(update_fields=update_fields)

        price_map = _build_price_change_map([tracked_symbol.symbol])
        profile_map = _build_profile_map([tracked_symbol.symbol], price_map)
        return envelope(_serialize_tracked_symbol_row(tracked_symbol, price_map, profile_map))

    @extend_schema(
        summary='Xóa tracked symbol native',
        description='Endpoint native `/core/v1/stock-management/tracked-symbols/{id}/` cho thao tác remove-from-tracked.',
        responses={
            204: None,
            401: OpenApiTypes.OBJECT,
            404: OpenApiTypes.OBJECT,
        },
    )
    def delete(self, request, pk):
        tracked_symbol = _get_tracked_symbol_or_404_for_user(request.user, pk)
        tracked_symbol.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class StockManagementTrackedSymbolBulkThresholdView(APIView):
    """POST /api/stock-management/tracked-symbols/bulk-threshold/"""
    permission_classes = TENANT_PERMISSION_CLASSES

    @extend_schema(
        summary='Bulk set hoặc clear whale threshold cho tracked symbols native',
        description=(
            'Endpoint native `/core/v1/stock-management/tracked-symbols/bulk-threshold/`. '
            'Dùng cho thao tác hàng loạt trên Watchlist page mà không cần compat `/api`.'
        ),
        request=_TRACKED_SYMBOL_BULK_THRESHOLD_REQUEST_SCHEMA,
        responses={
            200: envelope_schema(_TRACKED_SYMBOL_BULK_THRESHOLD_RESPONSE_SCHEMA),
            400: OpenApiTypes.OBJECT,
            401: OpenApiTypes.OBJECT,
        },
        examples=[
            OpenApiExample(
                'Bulk threshold request',
                value={
                    'tracked_symbol_ids': [11, 18],
                    'whale_alert_threshold_million': None,
                },
                request_only=True,
            ),
            OpenApiExample(
                'Bulk threshold response',
                value={
                    'updated_count': 2,
                    'rows': [
                        {
                            'id': 11,
                            'symbol': 'TPB',
                            'industry': 'Ngân hàng',
                            'company_name': 'TPBank',
                            'market_cap_bn': 48000.25,
                            'source_group_id': 7,
                            'source_group_name': 'Ngân hàng',
                            'whale_alert_threshold_million': None,
                            'current_price': 18.25,
                            'prev_price': 17.9,
                            'change_value': 0.35,
                            'change_pct': 1.96,
                            'last_date': '2026-05-20',
                            'added_at': '2026-05-20T09:15:00+07:00',
                            'updated_at': '2026-05-20T09:25:00+07:00',
                        },
                    ],
                },
                response_only=True,
            ),
        ],
    )
    def post(self, request):
        tracked_symbol_ids = request.data.get('tracked_symbol_ids')
        if not isinstance(tracked_symbol_ids, list) or not tracked_symbol_ids:
            return Response({'detail': 'tracked_symbol_ids phải là mảng id không rỗng.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            normalized_ids = [int(raw_id) for raw_id in tracked_symbol_ids]
        except (TypeError, ValueError):
            return Response({'detail': 'tracked_symbol_ids chứa giá trị không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            threshold_million = _parse_tracked_symbol_threshold_million(request.data.get('whale_alert_threshold_million'))
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        queryset = _tracked_symbols_queryset_for_user(request.user).filter(id__in=normalized_ids)
        found_ids = set(queryset.values_list('id', flat=True))
        requested_ids = set(normalized_ids)
        missing_ids = sorted(requested_ids - found_ids)
        if missing_ids:
            return Response(
                {'detail': 'Một số tracked symbol không tồn tại hoặc không thuộc user.', 'missing_ids': missing_ids},
                status=status.HTTP_400_BAD_REQUEST,
            )

        updated_count = queryset.update(
            whale_alert_threshold_million=threshold_million,
            updated_at=timezone.now(),
        )
        updated_rows = list(_tracked_symbols_queryset_for_user(request.user).filter(id__in=found_ids).order_by('-added_at', '-pk'))
        symbols = [row.symbol for row in updated_rows]
        price_map = _build_price_change_map(symbols)
        profile_map = _build_profile_map(symbols, price_map)
        return envelope({
            'updated_count': updated_count,
            'whale_alert_threshold_million': _to_float(threshold_million),
            'applied_ids': sorted(found_ids),
            'rows': [_serialize_tracked_symbol_row(row, price_map, profile_map) for row in updated_rows],
        })


class StockManagementPriceAlertsView(APIView):
    """GET/POST /api/stock-management/price-alerts/ — native price alert contract."""
    permission_classes = TENANT_PERMISSION_CLASSES

    def get(self, request):
        alerts = list(_price_alerts_queryset_for_user(request.user).order_by('-created_at', '-pk'))
        price_map = _build_price_change_map([alert.symbol for alert in alerts])
        return envelope([_serialize_price_alert_row(alert, price_map) for alert in alerts])

    def post(self, request):
        try:
            symbol = _validate_stock_symbol(request.data.get('symbol'))
            condition = _parse_price_alert_condition(request.data.get('condition'))
            target_price = _parse_price_alert_target(request.data.get('target_price'))
            cooldown_seconds = _parse_cooldown_seconds(request.data.get('cooldown_seconds'))
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        is_active = bool(request.data.get('is_active', True))
        alert, created = PriceAlert.objects.get_or_create(
            user=request.user,
            tenant=_resolve_user_tenant(request.user),
            symbol=symbol,
            alert_type=condition,
            price_threshold=target_price,
            defaults={
                'cooldown_seconds': cooldown_seconds,
                'is_enabled': is_active,
                'status': PriceAlert.AlertStatus.ACTIVE if is_active else PriceAlert.AlertStatus.DISABLED,
            },
        )
        if not created:
            return Response({'detail': 'Cảnh báo giá này đã tồn tại.'}, status=status.HTTP_400_BAD_REQUEST)

        price_map = _build_price_change_map([symbol])
        return envelope(_serialize_price_alert_row(alert, price_map), status=status.HTTP_201_CREATED)


class StockManagementPriceAlertDetailView(APIView):
    """PATCH/DELETE /api/stock-management/price-alerts/<pk>/"""
    permission_classes = TENANT_PERMISSION_CLASSES

    def patch(self, request, pk):
        alert = _get_price_alert_or_404_for_user(request.user, pk)
        update_fields = []

        if 'condition' in request.data:
            try:
                condition = _parse_price_alert_condition(request.data.get('condition'))
            except ValueError as exc:
                return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            if alert.alert_type != condition:
                alert.alert_type = condition
                update_fields.append('alert_type')

        if 'target_price' in request.data:
            try:
                target_price = _parse_price_alert_target(request.data.get('target_price'))
            except ValueError as exc:
                return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            if alert.price_threshold != target_price:
                alert.price_threshold = target_price
                update_fields.append('price_threshold')

        if 'cooldown_seconds' in request.data:
            try:
                cooldown_seconds = _parse_cooldown_seconds(request.data.get('cooldown_seconds'))
            except ValueError as exc:
                return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            if int(alert.cooldown_seconds or 0) != cooldown_seconds:
                alert.cooldown_seconds = cooldown_seconds
                update_fields.append('cooldown_seconds')

        if 'is_active' in request.data:
            is_active = bool(request.data.get('is_active'))
            next_status = PriceAlert.AlertStatus.ACTIVE if is_active else PriceAlert.AlertStatus.DISABLED
            if alert.is_enabled != is_active:
                alert.is_enabled = is_active
                update_fields.append('is_enabled')
            if alert.status != next_status:
                alert.status = next_status
                update_fields.append('status')

        if update_fields:
            if 'updated_at' not in update_fields:
                update_fields.append('updated_at')
            alert.save(update_fields=update_fields)

        price_map = _build_price_change_map([alert.symbol])
        return envelope(_serialize_price_alert_row(alert, price_map))

    def delete(self, request, pk):
        alert = _get_price_alert_or_404_for_user(request.user, pk)
        alert.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class StockManagementPriceAlertTriggerView(APIView):
    """POST /api/stock-management/price-alerts/<pk>/mark-triggered/"""
    permission_classes = TENANT_PERMISSION_CLASSES

    def post(self, request, pk):
        alert = _get_price_alert_or_404_for_user(request.user, pk)
        alert.last_triggered_at = timezone.now()
        alert.save(update_fields=['last_triggered_at', 'updated_at'])
        price_map = _build_price_change_map([alert.symbol])
        return envelope(_serialize_price_alert_row(alert, price_map))


class StockManagementGroupDetailView(APIView):
    """GET/PUT/DELETE /api/stock-management/groups/<group_id>/"""
    permission_classes = TENANT_PERMISSION_CLASSES

    def get(self, request, group_id):
        group = _get_cached_group_or_404(group_id)
        symbols = [m.symbol for m in group.members.all()]
        price_map = _build_price_change_map(symbols)
        groups = list(CachedSymbolGroup.objects.filter(is_active=True).only('id', 'group_name'))
        groups.sort(key=_group_sort_key_cached)
        index_map = {g.pk: index for index, g in enumerate(groups)}
        return envelope(_serialize_cached_group(group, index_map.get(group.pk, 0), price_map))

    def patch(self, request, group_id):
        return Response(
            {'detail': 'Nhóm thị trường là taxonomy dùng chung và chỉ được cập nhật qua seed native.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def delete(self, request, group_id):
        return Response(
            {'detail': 'Nhóm thị trường là taxonomy dùng chung và chỉ được cập nhật qua seed native.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )


class StockManagementGroupItemsView(APIView):
    """GET /api/stock-management/groups/<group_id>/items/"""
    permission_classes = TENANT_PERMISSION_CLASSES

    def get(self, request, group_id):
        group = _get_cached_group_or_404(group_id)
        symbols = [m.symbol for m in group.members.all()]
        price_map = _build_price_change_map(symbols)
        return envelope([_serialize_stock_management_item(m, price_map) for m in group.members.all()])


class StockManagementItemDetailView(APIView):
    """GET/PUT/DELETE /api/stock-management/items/<item_id>/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, item_id):
        item = _get_watchlist_item_or_404_for_user(request.user, item_id)
        price_map = _build_price_change_map([item.symbol])
        return envelope(_serialize_stock_management_item(item, price_map))

    def delete(self, request, item_id):
        return Response(
            {'detail': 'Mã trong nhóm thị trường chỉ được cập nhật qua seed native.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )
