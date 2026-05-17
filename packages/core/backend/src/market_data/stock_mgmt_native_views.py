"""
C3 — Native stock-management views for market_data domain.

Replaces StockManagementLegacyBridgeView for all stock-management frontend compat routes.
Advisory-related routes delegate to the advisory domain (already native since B5).

All views require IsAuthenticated; symbol params are always uppercased.
Graceful stubs return empty/null for features not yet fully native.
"""
from decimal import Decimal
from datetime import date, datetime, time, timedelta

from django.db import DatabaseError, connection
from django.db.models import Q
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from .global_symbol_planner import create_global_planner_run
from .global_symbol_registry import sync_admin_group_symbol_set, sync_system_default_symbol_group
from .models import DailyPrice, IntradayBar, StockProfile
from .vnbroker_adapter import fetch_symbol_group_members
from user_workspace.models import PriceAlert, TrackedSymbol, Watchlist, WatchlistItem


_STOCK_MANAGEMENT_DEFAULT_GROUPS = [
    {
        'name': 'Ngân hàng',
        'group_type': 'SECTOR',
        'description': 'Nhóm ngân hàng',
        'color': '#3b82f6',
        'order': 1,
        'symbols': ['ACB', 'BID', 'CTG', 'EIB', 'HDB', 'LPB', 'MBB', 'MSB', 'OCB', 'SHB', 'SSB', 'STB', 'TCB', 'TPB', 'VCB', 'VIB', 'VPB'],
    },
    {
        'name': 'Bất động sản',
        'group_type': 'SECTOR',
        'description': 'Nhóm bất động sản',
        'color': '#f59e0b',
        'order': 2,
        'symbols': ['BCM', 'CEO', 'DIG', 'DXG', 'KBC', 'KDH', 'NLG', 'NVL', 'PDR', 'SJS', 'TDH', 'VHM', 'VIC', 'VRE'],
    },
    {
        'name': 'Thép & Vật liệu',
        'group_type': 'SECTOR',
        'description': 'Nhóm thép và vật liệu xây dựng',
        'color': '#ef4444',
        'order': 3,
        'symbols': ['BMP', 'HPG', 'HSG', 'NKG', 'TLH', 'VGC', 'VIS'],
    },
    {
        'name': 'Dầu khí',
        'group_type': 'SECTOR',
        'description': 'Nhóm dầu khí và năng lượng',
        'color': '#8b5cf6',
        'order': 4,
        'symbols': ['GAS', 'OIL', 'PLX', 'PVD', 'PVS', 'PVT'],
    },
    {
        'name': 'Công nghệ',
        'group_type': 'SECTOR',
        'description': 'Nhóm công nghệ và viễn thông',
        'color': '#22c55e',
        'order': 5,
        'symbols': ['CMG', 'ELC', 'FPT', 'SAM', 'VGI'],
    },
    {
        'name': 'Bán lẻ & Tiêu dùng',
        'group_type': 'SECTOR',
        'description': 'Nhóm bán lẻ và hàng tiêu dùng',
        'color': '#ec4899',
        'order': 6,
        'symbols': ['MSN', 'MWG', 'PNJ', 'SAB', 'VNM'],
    },
    {
        'name': 'VN30',
        'group_type': 'MARKET_CAP',
        'description': 'Top 30 cổ phiếu vốn hóa lớn nhất HOSE',
        'color': '#6366f1',
        'order': 7,
        'symbols': ['ACB', 'BID', 'CTG', 'DGC', 'FPT', 'GAS', 'GVR', 'HDB', 'HPG', 'LPB', 'MBB', 'MSN', 'MWG', 'PLX', 'SAB', 'SHB', 'SSB', 'SSI', 'STB', 'TCB', 'TPB', 'VCB', 'VHM', 'VIB', 'VIC', 'VJC', 'VNM', 'VPB', 'VPL', 'VRE'],
    },
]
_STOCK_MANAGEMENT_DEFAULT_GROUP_LOOKUP = {group['name']: group for group in _STOCK_MANAGEMENT_DEFAULT_GROUPS}
_STOCK_MANAGEMENT_COLOR_PALETTE = ['#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#22c55e', '#ec4899', '#6366f1']
_SYSTEM_DEFAULT_SYMBOL_GROUP_IDS = ('vn30', 'vn100')


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


def _group_sort_key(watchlist):
    template = _STOCK_MANAGEMENT_DEFAULT_GROUP_LOOKUP.get(watchlist.name, {})
    return (
        template.get('order', 999),
        str(watchlist.name or '').lower(),
        watchlist.pk or 0,
    )


def _validate_stock_symbol(raw_symbol):
    symbol = str(raw_symbol or '').upper().strip()
    if not symbol:
        raise ValueError('Thiếu mã chứng khoán.')
    if not symbol.isalnum() or len(symbol) > 10:
        raise ValueError('Mã chứng khoán không hợp lệ. Chỉ chấp nhận 1-10 ký tự chữ in hoa và số.')
    if StockProfile.objects.exists() and not StockProfile.objects.filter(symbol=symbol).exists():
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
        'note': item.note or '',
        'current_price': info.get('current_price'),
        'prev_price': info.get('prev_price'),
        'change_value': info.get('change_value'),
        'change_pct': info.get('change_pct'),
        'last_date': info.get('last_date'),
    }


def _serialize_stock_management_group(watchlist, index, price_map):
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
        'items': [_serialize_stock_management_item(item, price_map) for item in watchlist.items.all()],
    }


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


# ---------------------------------------------------------------------------
# Stock data views
# ---------------------------------------------------------------------------


class StockManagementStockListView(APIView):
    """GET /api/stock-management/stocks/ — native stock catalog search."""

    permission_classes = [permissions.IsAuthenticated]

    _DEFAULT_PAGE_SIZE = 100
    _MAX_PAGE_SIZE = 200

    def get(self, request):
        qs = StockProfile.objects.filter(status=StockProfile.StatusChoices.ACTIVE).order_by('symbol')

        search = str(request.query_params.get('search') or request.query_params.get('q') or '').strip()
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

        try:
            page_size = int(request.query_params.get('page_size', self._DEFAULT_PAGE_SIZE))
        except (TypeError, ValueError):
            page_size = self._DEFAULT_PAGE_SIZE
        page_size = max(1, min(page_size, self._MAX_PAGE_SIZE))

        try:
            page = int(request.query_params.get('page', 1))
        except (TypeError, ValueError):
            page = 1
        page = max(page, 1)

        total = qs.count()
        offset = (page - 1) * page_size
        rows = qs[offset: offset + page_size]

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
            for profile in rows
        ]
        return Response(
            {
                'count': total,
                'page': page,
                'page_size': page_size,
                'results': results,
            }
        )


class StockManagementTechnicalsView(APIView):
    """GET /api/stock-management/technicals/bulk/?symbols=VCB,HPG"""
    permission_classes = [permissions.IsAuthenticated]

    _MAX_SYMBOLS = 50

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
            return Response({'results': []})

        today = date.today()
        results = []
        for sym in symbols:
            snap = _fetch_symbol_snapshot_payload(sym)
            latest_daily = DailyPrice.objects.filter(symbol=sym, date=today).order_by('-date').first()
            if snap is None and latest_daily is None:
                results.append({
                    'symbol': sym,
                    'price': None,
                    'price_change': None,
                    'price_change_pct': None,
                    'volume': None,
                    'stale': True,
                })
                continue

            price_value = _to_float(snap.get('price')) if snap else _to_float(getattr(latest_daily, 'close', None))
            change_value = _to_float(snap.get('price_change')) if snap and snap.get('price_change') is not None else None
            change_pct = _to_float(snap.get('price_change_pct')) if snap and snap.get('price_change_pct') is not None else None
            if change_value is None and price_value is not None and latest_daily is not None and latest_daily.close not in (None, 0):
                change_value = price_value - _to_float(latest_daily.close)
            if change_pct is None and change_value is not None and latest_daily is not None and latest_daily.close not in (None, 0):
                change_pct = (change_value / _to_float(latest_daily.close)) * 100
            results.append({
                'symbol': sym,
                'price': _round_or_none(price_value),
                'price_change': _round_or_none(change_value),
                'price_change_pct': _round_or_none(change_pct),
                'volume': _to_int(snap.get('volume')) if snap else _to_int(getattr(latest_daily, 'volume', None)),
                'stale': bool(snap.get('stale', False)) if snap else True,
            })
        return Response({'results': results})

    def get(self, request):
        symbols = self._parse_symbols(request)
        return self._build_response(symbols)

    def post(self, request):
        symbols = self._parse_symbols(request)
        return self._build_response(symbols)


class StockManagementDetailView(APIView):
    """GET /api/stock-management/stocks/<symbol>/ — stock profile detail."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        symbol = symbol.upper()
        try:
            profile = StockProfile.objects.get(symbol=symbol)
        except StockProfile.DoesNotExist:
            raise NotFound(f'Stock not found: {symbol}')
        return Response({
            'symbol': profile.symbol,
            'company_name': profile.company_name,
            'exchange': profile.exchange,
            'industry': profile.industry,
            'status': profile.status,
            'outstanding_shares': profile.outstanding_shares,
        })


class StockManagementOverviewView(APIView):
    """GET /api/stock-management/stocks/<symbol>/overview/"""
    permission_classes = [permissions.IsAuthenticated]

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
        }
        return Response(payload)


class StockManagementChartView(APIView):
    """GET /api/stock-management/stocks/<symbol>/chart/ — native chart envelope."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        symbol = symbol.upper()
        if not StockProfile.objects.filter(symbol=symbol).exists():
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

        intraday_frames = {'1m', '5m', '15m', '1H', '2H', '4H'}
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
        return Response(payload)


class StockManagementOrderFlowView(APIView):
    """GET /api/stock-management/stocks/<symbol>/order-flow/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        from signal_intelligence.models import UnifiedAlert
        symbol = symbol.upper()
        limit = min(int(request.query_params.get('limit', 100)), 500)
        alerts = UnifiedAlert.objects.filter(symbol=symbol).order_by('-triggered_at')[:limit]
        return Response({
            'symbol': symbol,
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
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        return Response({
            'symbol': symbol.upper(),
            'news': [],
            'note': 'news_not_available_in_native',
        })


class StockManagementNewsAISummaryView(APIView):
    """GET /api/stock-management/stocks/<symbol>/news/ai-summary/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        return Response({
            'symbol': symbol.upper(),
            'summary': None,
            'note': 'ai_summary_not_available_in_native',
        })

    def post(self, request, symbol):
        return self.get(request, symbol)


# ---------------------------------------------------------------------------
# Advisory compat views — delegate to advisory domain (native since B5)
# ---------------------------------------------------------------------------

class StockManagementAIAdvisorySessionView(APIView):
    """GET /api/stock-management/stocks/<symbol>/ai-advisory-session/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        from advisory.views import AdvisoryLatestView
        django_request = getattr(request, '_request', request)
        response = AdvisoryLatestView.as_view()(django_request, symbol=symbol.upper())
        if getattr(response, 'status_code', None) == status.HTTP_404_NOT_FOUND:
            normalized_symbol = symbol.upper()
            return Response({
                'ok': False,
                'queued': False,
                'symbol': normalized_symbol,
                'contract': request.query_params.get('contract', 'v1'),
                'include_benchmarks': str(request.query_params.get('include_benchmarks', '')).lower() in {'1', 'true', 'yes'},
                'reason': 'no_advisory_data',
                'message': f'Chưa có dữ liệu tư vấn AI cho mã {normalized_symbol}.',
                'advisory': None,
                'aggregate': None,
                'components': [],
                'deleted_components': [],
                'executive_summary': None,
                'executive_summaries': [],
            }, status=status.HTTP_200_OK)
        return response


class StockManagementAIAdvisoryObservabilityView(APIView):
    """GET/POST /api/stock-management/stocks/<symbol>/ai-advisory-observability/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        return Response({
            'symbol': symbol.upper(),
            'observability': None,
            'note': 'observability_not_available_in_native',
        })

    def post(self, request, symbol):
        # Accept telemetry events from the frontend advisory observer; no-op store for now.
        return Response({
            'symbol': symbol.upper(),
            'received': True,
        }, status=status.HTTP_201_CREATED)


class StockManagementAIAdvisoryComponentsGenerateView(APIView):
    """POST /api/stock-management/stocks/<symbol>/ai-advisory-components/generate/"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, symbol):
        from advisory.views import AdvisoryRefreshView
        django_request = getattr(request, '_request', request)
        return AdvisoryRefreshView.as_view()(django_request, symbol=symbol.upper())


class StockManagementAIAdvisoryComponentsDeletedView(APIView):
    """GET /api/stock-management/stocks/<symbol>/ai-advisory-components/deleted/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        return Response({'symbol': symbol.upper(), 'deleted': []})


class StockManagementAIAdvisorySummaryRegenerateView(APIView):
    """POST /api/stock-management/stocks/<symbol>/ai-advisory-summary/regenerate/"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, symbol):
        from advisory.views import AdvisoryRefreshView
        django_request = getattr(request, '_request', request)
        return AdvisoryRefreshView.as_view()(django_request, symbol=symbol.upper())


class StockManagementAIAdvisorySummaryDetailView(APIView):
    """DELETE /api/stock-management/stocks/<symbol>/ai-advisory-summary/<summary_id>/"""
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, symbol, summary_id):
        return Response(status=status.HTTP_204_NO_CONTENT)


class StockManagementFinancialsView(APIView):
    """GET /api/stock-management/stocks/<symbol>/financials/ — graceful empty."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        return Response({'symbol': symbol.upper(), 'financials': None, 'note': 'financials_not_available_in_native'})


# ---------------------------------------------------------------------------
# Advisory component compat views
# ---------------------------------------------------------------------------

class StockManagementAdvisoryCompToggleView(APIView):
    """POST /api/stock-management/ai-advisory-components/<pk>/toggle-include/"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        return Response({'id': pk, 'included': True})


class StockManagementAdvisoryCompRefreshView(APIView):
    """POST /api/stock-management/ai-advisory-components/<pk>/refresh/"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        return Response({'id': pk, 'status': 'refresh_queued'})


class StockManagementAdvisoryCompRestoreView(APIView):
    """POST /api/stock-management/ai-advisory-components/<pk>/restore/"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        return Response({'id': pk, 'status': 'restored'})


class StockManagementAdvisoryCompDetailView(APIView):
    """GET/DELETE /api/stock-management/ai-advisory-components/<pk>/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        return Response({'id': pk, 'data': None, 'note': 'component_not_available_in_native'})

    def delete(self, request, pk):
        return Response(status=status.HTTP_204_NO_CONTENT)


class StockManagementPortfolioNewsDigestView(APIView):
    """GET /api/stock-management/portfolio/news-digest/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({'news': [], 'note': 'news_digest_not_available_in_native'})


# ---------------------------------------------------------------------------
# Groups / tracked symbols / price alerts
# ---------------------------------------------------------------------------

class StockManagementGroupsView(APIView):
    """GET /api/stock-management/groups/ — native watchlist-backed groups."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        watchlists = list(_watchlists_queryset_for_user(request.user).prefetch_related('items'))
        watchlists.sort(key=_group_sort_key)
        symbols = [item.symbol for watchlist in watchlists for item in watchlist.items.all()]
        price_map = _build_price_change_map(symbols)
        return Response([
            _serialize_stock_management_group(watchlist, index, price_map)
            for index, watchlist in enumerate(watchlists)
        ])


class StockManagementSeedView(APIView):
    """POST /api/stock-management/seed/ — create/update default market groups."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        tenant = _resolve_user_tenant(request.user)
        created_groups = []
        updated_groups = []
        added_symbols = 0

        for group_data in _STOCK_MANAGEMENT_DEFAULT_GROUPS:
            group_symbols = []
            watchlist, created = Watchlist.objects.get_or_create(
                user=request.user,
                tenant=tenant,
                name=group_data['name'],
                defaults={
                    'description': group_data['description'],
                    'is_default': False,
                },
            )

            updated_fields = []
            if watchlist.description != group_data['description']:
                watchlist.description = group_data['description']
                updated_fields.append('description')
            if watchlist.is_default:
                watchlist.is_default = False
                updated_fields.append('is_default')
            if updated_fields:
                watchlist.save(update_fields=updated_fields)

            group_added_symbols = 0
            for raw_symbol in group_data['symbols']:
                symbol = str(raw_symbol or '').upper().strip()
                if symbol:
                    group_symbols.append(symbol)
                _, item_created = WatchlistItem.objects.get_or_create(
                    watchlist=watchlist,
                    symbol=symbol,
                    defaults={'note': ''},
                )
                if item_created:
                    group_added_symbols += 1

            sync_admin_group_symbol_set(
                group_data['name'],
                group_symbols,
                group_type=group_data.get('group_type'),
                description=group_data.get('description'),
            )

            added_symbols += group_added_symbols
            if created:
                created_groups.append({'group': watchlist.name, 'symbols': len(group_data['symbols'])})
            elif updated_fields or group_added_symbols:
                updated_groups.append({'group': watchlist.name, 'new_symbols': group_added_symbols})

        synced_system_groups = []
        for group_id in _SYSTEM_DEFAULT_SYMBOL_GROUP_IDS:
            system_symbols = fetch_symbol_group_members(group_id)
            sync_system_default_symbol_group(group_id, system_symbols)
            synced_system_groups.append({'group_id': group_id, 'symbols': len(system_symbols)})

        message_parts = []
        if created_groups:
            message_parts.append(f'đã tạo {len(created_groups)} nhóm mặc định')
        if updated_groups:
            message_parts.append(f'cập nhật {len(updated_groups)} nhóm')
        if added_symbols:
            message_parts.append(f'thêm {added_symbols} mã')
        if not message_parts:
            message_parts.append('không có thay đổi')

        return Response({
            'created': created_groups,
            'updated': updated_groups,
            'added_symbols': added_symbols,
            'system_default_groups': synced_system_groups,
            'message': ', '.join(message_parts).capitalize() + '.',
        })


class StockManagementSyncView(APIView):
    """POST /api/stock-management/sync/ — native quote refresh for user scope."""
    permission_classes = [permissions.IsAuthenticated]

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
            return Response({
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
        return Response({
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


class StockManagementTrackedSymbolsView(APIView):
    """GET/POST /api/stock-management/tracked-symbols/ — native tracked symbol contract."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        tracked_symbols = list(_tracked_symbols_queryset_for_user(request.user).order_by('-added_at', '-pk'))
        symbols = [row.symbol for row in tracked_symbols]
        price_map = _build_price_change_map(symbols)
        profile_map = _build_profile_map(symbols, price_map)
        return Response([
            _serialize_tracked_symbol_row(row, price_map, profile_map)
            for row in tracked_symbols
        ])

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
        return Response(
            _serialize_tracked_symbol_row(tracked_symbol, price_map, profile_map),
            status=status.HTTP_201_CREATED,
        )


class StockManagementTrackedSymbolDetailView(APIView):
    """PATCH/DELETE /api/stock-management/tracked-symbols/<pk>/"""
    permission_classes = [permissions.IsAuthenticated]

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
        return Response(_serialize_tracked_symbol_row(tracked_symbol, price_map, profile_map))

    def delete(self, request, pk):
        tracked_symbol = _get_tracked_symbol_or_404_for_user(request.user, pk)
        tracked_symbol.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class StockManagementTrackedSymbolBulkThresholdView(APIView):
    """POST /api/stock-management/tracked-symbols/bulk-threshold/"""
    permission_classes = [permissions.IsAuthenticated]

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
        return Response({
            'updated_count': updated_count,
            'whale_alert_threshold_million': _to_float(threshold_million),
            'applied_ids': sorted(found_ids),
            'rows': [_serialize_tracked_symbol_row(row, price_map, profile_map) for row in updated_rows],
        })


class StockManagementPriceAlertsView(APIView):
    """GET/POST /api/stock-management/price-alerts/ — native price alert contract."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        alerts = list(_price_alerts_queryset_for_user(request.user).order_by('-created_at', '-pk'))
        price_map = _build_price_change_map([alert.symbol for alert in alerts])
        return Response([_serialize_price_alert_row(alert, price_map) for alert in alerts])

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
        return Response(_serialize_price_alert_row(alert, price_map), status=status.HTTP_201_CREATED)


class StockManagementPriceAlertDetailView(APIView):
    """PATCH/DELETE /api/stock-management/price-alerts/<pk>/"""
    permission_classes = [permissions.IsAuthenticated]

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
        return Response(_serialize_price_alert_row(alert, price_map))

    def delete(self, request, pk):
        alert = _get_price_alert_or_404_for_user(request.user, pk)
        alert.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class StockManagementPriceAlertTriggerView(APIView):
    """POST /api/stock-management/price-alerts/<pk>/mark-triggered/"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        alert = _get_price_alert_or_404_for_user(request.user, pk)
        alert.last_triggered_at = timezone.now()
        alert.save(update_fields=['last_triggered_at', 'updated_at'])
        price_map = _build_price_change_map([alert.symbol])
        return Response(_serialize_price_alert_row(alert, price_map))


class StockManagementGroupDetailView(APIView):
    """GET/PUT/DELETE /api/stock-management/groups/<group_id>/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, group_id):
        watchlist = _get_watchlist_or_404_for_user(request.user, group_id)
        symbols = [item.symbol for item in watchlist.items.all()]
        price_map = _build_price_change_map(symbols)
        watchlists = list(_watchlists_queryset_for_user(request.user).only('id', 'name'))
        watchlists.sort(key=_group_sort_key)
        index_map = {item.pk: index for index, item in enumerate(watchlists)}
        return Response(_serialize_stock_management_group(watchlist, index_map.get(watchlist.pk, 0), price_map))

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
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, group_id):
        watchlist = _get_watchlist_or_404_for_user(request.user, group_id)
        symbols = [item.symbol for item in watchlist.items.all()]
        price_map = _build_price_change_map(symbols)
        return Response([_serialize_stock_management_item(item, price_map) for item in watchlist.items.all()])


class StockManagementItemDetailView(APIView):
    """GET/PUT/DELETE /api/stock-management/items/<item_id>/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, item_id):
        item = _get_watchlist_item_or_404_for_user(request.user, item_id)
        price_map = _build_price_change_map([item.symbol])
        return Response(_serialize_stock_management_item(item, price_map))

    def delete(self, request, item_id):
        return Response(
            {'detail': 'Mã trong nhóm thị trường chỉ được cập nhật qua seed native.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )
