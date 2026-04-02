"""
services.py — Lớp trung gian giữa vnstock và database.

Chứa các hàm:
  - fetch_and_save_daily_prices(): Kéo giá EOD từ vnstock, lưu vào DailyPrice.
  - sync_portfolio_prices(): Lấy toàn bộ mã CK trong một Portfolio rồi sync.
  - get_latest_price(): Trả về giá đóng cửa mới nhất của một mã từ DB.
  - get_price_changes(): Trả về giá + % thay đổi so với phiên trước cho danh sách mã.
"""

import logging
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation

from django.contrib.auth.models import User
from django.db import transaction as db_transaction
from django.utils import timezone

from .models import DailyPrice, MarketGroupSyncLog, Portfolio, SecuritiesGroup, SecuritiesItem, StockProfile, StockProfileSyncLog, TrackedSymbol, WatchlistItem

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Hàm nội bộ: ánh xạ DataFrame của vnstock sang dict chuẩn hoá
# ---------------------------------------------------------------------------

def _normalise_ohlcv(row) -> dict | None:
    """
    Chuyển một row DataFrame (vnstock3) thành dict chuẩn.
    vnstock3 trả về các cột: time, open, high, low, close, volume
    Trả về None nếu dữ liệu không hợp lệ.
    """
    try:
        close = Decimal(str(row['close']))
        if close <= 0:
            return None
        return {
            'open_price':  _to_decimal(row.get('open')),
            'high_price':  _to_decimal(row.get('high')),
            'low_price':   _to_decimal(row.get('low')),
            'close_price': close,
            'volume':      _to_int(row.get('volume')),
        }
    except (KeyError, InvalidOperation, TypeError):
        return None


def _to_decimal(value) -> Decimal | None:
    try:
        return Decimal(str(value)) if value is not None else None
    except InvalidOperation:
        return None


def _to_int(value) -> int | None:
    try:
        return int(value) if value is not None else None
    except (ValueError, TypeError):
        return None


# ---------------------------------------------------------------------------
# Hàm công khai chính
# ---------------------------------------------------------------------------

def fetch_and_save_daily_prices(
    symbol: str,
    start_date: date | None = None,
    end_date: date | None = None,
) -> dict:
    """
    Kéo giá lịch sử (OHLCV) của `symbol` từ vnstock3 và lưu vào DailyPrice.

    Tham số:
        symbol     — Mã chứng khoán (VD: 'VNM', 'VIC').
        start_date — Ngày bắt đầu (mặc định: 30 ngày trước).
        end_date   — Ngày kết thúc (mặc định: hôm nay).

    Trả về dict:
        { 'symbol': str, 'created': int, 'updated': int, 'errors': int }
    """
    today = date.today()
    if end_date is None:
        end_date = today
    if start_date is None:
        start_date = today - timedelta(days=30)

    symbol = symbol.upper().strip()
    result = {'symbol': symbol, 'created': 0, 'updated': 0, 'errors': 0}

    # --- Gọi vnstock (>=3.5.0) với source KBS ---
    try:
        from vnstock import Vnstock  # import trễ để tránh lỗi nếu chưa cài

        stock = Vnstock().stock(symbol=symbol, source='KBS')
        df = stock.quote.history(
            start=start_date.strftime('%Y-%m-%d'),
            end=end_date.strftime('%Y-%m-%d'),
            interval='1D',
        )
    except ImportError:
        logger.error('vnstock chưa được cài đặt. Chạy: pip install vnstock -U')
        result['errors'] += 1
        return result
    except Exception as exc:
        logger.error('vnstock lỗi khi lấy dữ liệu %s: %s', symbol, exc)
        result['errors'] += 1
        return result

    if df is None or df.empty:
        logger.warning('vnstock3 không trả về dữ liệu cho %s (%s → %s)', symbol, start_date, end_date)
        return result

    # --- Lưu từng dòng vào DailyPrice (update_or_create để idempotent) ---
    with db_transaction.atomic():
        for _, row in df.iterrows():
            try:
                # vnstock3 dùng cột 'time' kiểu Timestamp
                price_date = row['time'].date() if hasattr(row['time'], 'date') else date.fromisoformat(str(row['time']))
            except Exception:
                result['errors'] += 1
                continue

            data = _normalise_ohlcv(row)
            if data is None:
                result['errors'] += 1
                continue

            try:
                _, created = DailyPrice.objects.update_or_create(
                    symbol=symbol,
                    date=price_date,
                    defaults=data,
                )
            except Exception as db_exc:
                logger.warning('DB error khi lưu %s / %s: %s', symbol, price_date, db_exc)
                result['errors'] += 1
                continue

            if created:
                result['created'] += 1
            else:
                result['updated'] += 1

    logger.info(
        'Sync %s: tạo mới=%d, cập nhật=%d, lỗi=%d',
        symbol, result['created'], result['updated'], result['errors'],
    )
    return result


def sync_portfolio_prices(portfolio_id: int, days: int = 30) -> list[dict]:
    """
    Lấy toàn bộ mã CK đang có trong portfolio và gọi fetch_and_save_daily_prices
    cho từng mã.

    Trả về danh sách kết quả (list of dict) của từng mã.
    """
    try:
        portfolio = Portfolio.objects.get(pk=portfolio_id)
    except Portfolio.DoesNotExist:
        logger.error('Portfolio id=%d không tồn tại', portfolio_id)
        return []

    symbols = (
        portfolio.transactions
        .values_list('symbol', flat=True)
        .distinct()
    )

    start_date = date.today() - timedelta(days=days)
    results = []
    for symbol in symbols:
        res = fetch_and_save_daily_prices(symbol, start_date=start_date)
        results.append(res)

    return results


def get_latest_price(symbol: str) -> Decimal | None:
    """
    Trả về giá đóng cửa mới nhất của `symbol` từ bảng DailyPrice.
    Trả về None nếu chưa có dữ liệu.
    """
    record = (
        DailyPrice.objects
        .filter(symbol=symbol.upper())
        .order_by('-date')
        .values('close_price')
        .first()
    )
    return record['close_price'] if record else None


def get_price_series(symbol: str, start_date: date, end_date: date) -> list[dict]:
    """
    Trả về chuỗi giá đóng cửa của `symbol` trong khoảng thời gian,
    dạng [{'date': '2024-01-02', 'close': 12345.00}, ...].
    Dùng cho biểu đồ Line Chart ở Bước 5.
    """
    qs = (
        DailyPrice.objects
        .filter(symbol=symbol.upper(), date__range=(start_date, end_date))
        .order_by('date')
        .values('date', 'close_price')
    )
    return [
        {'date': str(r['date']), 'close': float(r['close_price'])}
        for r in qs
    ]


def get_price_changes(symbols: list) -> dict:
    """
    Lấy giá đóng cửa hiện tại và phiên trước của từng mã, tính % thay đổi.

    Trả về dict:
        { 'VNM': { current_price, prev_price, change_value, change_pct, last_date } }
    """
    if not symbols:
        return {}

    result = {}
    upper_symbols = [s.upper() for s in symbols]

    for symbol in upper_symbols:
        prices = list(
            DailyPrice.objects
            .filter(symbol=symbol)
            .order_by('-date')
            .values('close_price', 'date')[:2]
        )
        if not prices:
            result[symbol] = {
                'current_price': None, 'prev_price': None,
                'change_value': None, 'change_pct': None, 'last_date': None,
            }
            continue

        current = float(prices[0]['close_price'])
        entry = {
            'current_price': current,
            'last_date': str(prices[0]['date']),
            'prev_price': None,
            'change_value': None,
            'change_pct': None,
        }
        if len(prices) >= 2:
            prev = float(prices[1]['close_price'])
            entry['prev_price'] = prev
            entry['change_value'] = round(current - prev, 2)
            entry['change_pct'] = round((current - prev) / prev * 100, 2) if prev > 0 else 0.0

        result[symbol] = entry

    return result


def sync_watchlist_prices(user_id: int, days: int = 5) -> list[dict]:
    """
    Kéo giá EOD mới nhất cho tất cả mã CK user đang quan tâm trong market groups,
    tracked symbols và danh sách theo dõi cá nhân.
    Mặc định sync 5 ngày để cập nhật giá nhanh.
    """
    group_symbols = list(
        SecuritiesGroup.objects
        .values_list('items__symbol', flat=True)
        .distinct()
    )
    tracked_symbols = list(
        TrackedSymbol.objects
        .filter(user_id=user_id)
        .values_list('symbol', flat=True)
        .distinct()
    )
    watchlist_symbols = list(
        WatchlistItem.objects
        .filter(group__user_id=user_id)
        .values_list('symbol', flat=True)
        .distinct()
    )
    symbols = sorted({symbol for symbol in [*group_symbols, *tracked_symbols, *watchlist_symbols] if symbol})

    start_date = date.today() - timedelta(days=days)
    results = []
    for symbol in symbols:
        res = fetch_and_save_daily_prices(symbol, start_date=start_date)
        results.append(res)
    return results


# ---------------------------------------------------------------------------
# Bảng màu cho các nhóm ngành (25 màu cho 25 industry sections)
# ---------------------------------------------------------------------------
_SECTOR_COLORS = [
    '#3b82f6', '#f59e0b', '#ef4444', '#22c55e', '#8b5cf6',
    '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#06b6d4',
    '#84cc16', '#a855f7', '#f43f5e', '#10b981', '#eab308',
    '#0ea5e9', '#d946ef', '#fb923c', '#4ade80', '#38bdf8',
    '#c084fc', '#fb7185', '#34d399', '#fbbf24', '#818cf8',
]

# Màu cố định cho nhóm vốn hóa
_CAP_GROUP_DEFS = [
    ('VN30',  'VN30 — Top 30 vốn hóa lớn HOSE',   '#6366f1'),
    ('VN100', 'VN100 — Top 100 cổ phiếu HOSE',     '#3b82f6'),
    ('HNX30', 'HNX30 — Top 30 cổ phiếu HNX',       '#f59e0b'),
]

_MANUAL_MARKET_GROUPS = [
    {'name': 'Ngân hàng', 'group_type': 'SECTOR', 'color': '#3b82f6', 'order': 1,
     'description': 'Nhóm ngân hàng',
     'symbols': ['ACB', 'BID', 'CTG', 'EIB', 'HDB', 'LPB', 'MBB', 'MSB', 'OCB', 'SHB', 'SSB', 'STB', 'TCB', 'TPB', 'VCB', 'VIB', 'VPB']},
    {'name': 'Bất động sản', 'group_type': 'SECTOR', 'color': '#f59e0b', 'order': 2,
     'description': 'Nhóm bất động sản',
     'symbols': ['BCM', 'CEO', 'DIG', 'DXG', 'KBC', 'KDH', 'NLG', 'NVL', 'PDR', 'SJS', 'TDH', 'VHM', 'VIC', 'VRE']},
    {'name': 'Thép & Vật liệu', 'group_type': 'SECTOR', 'color': '#ef4444', 'order': 3,
     'description': 'Nhóm thép và vật liệu xây dựng',
     'symbols': ['BMP', 'HPG', 'HSG', 'NKG', 'TLH', 'VGC', 'VIS']},
    {'name': 'Dầu khí', 'group_type': 'SECTOR', 'color': '#8b5cf6', 'order': 4,
     'description': 'Nhóm dầu khí và năng lượng',
     'symbols': ['GAS', 'OIL', 'PLX', 'PVD', 'PVS', 'PVT']},
    {'name': 'Công nghệ', 'group_type': 'SECTOR', 'color': '#22c55e', 'order': 5,
     'description': 'Nhóm công nghệ và viễn thông',
     'symbols': ['CMG', 'ELC', 'FPT', 'SAM', 'VGI']},
    {'name': 'Bán lẻ & Tiêu dùng', 'group_type': 'SECTOR', 'color': '#ec4899', 'order': 6,
     'description': 'Nhóm bán lẻ và hàng tiêu dùng',
     'symbols': ['MSN', 'MWG', 'PNJ', 'SAB', 'VNM']},
    {'name': 'VN30', 'group_type': 'MARKET_CAP', 'color': '#6366f1', 'order': 7,
     'description': 'Top 30 cổ phiếu vốn hóa lớn nhất HOSE',
     'symbols': ['ACB', 'BID', 'CTG', 'DGC', 'FPT', 'GAS', 'GVR', 'HDB', 'HPG', 'LPB', 'MBB', 'MSN',
                 'MWG', 'PLX', 'SAB', 'SHB', 'SSB', 'SSI', 'STB', 'TCB', 'TPB', 'VCB', 'VHM', 'VIB',
                 'VIC', 'VJC', 'VNM', 'VPB', 'VPL', 'VRE']},
]


def fetch_market_sectors_and_groups() -> dict:
    """
    Tự động lấy toàn bộ nhóm ngành và nhóm vốn hóa từ vnstock (VCI source).

    Trả về dict:
        {
          'sectors':    [{ name, industry_code, group_type, description, color, symbols }],
          'cap_groups': [{ name, group_type, description, color, symbols }],
          'error': None | str,
        }

    Cách dùng:
        data = fetch_market_sectors_and_groups()
        for sector in data['sectors']:
            print(sector['name'], len(sector['symbols']))
    """
    try:
        from vnstock import Vnstock
        stock = Vnstock().stock(symbol='ACB', source='VCI')

        # --- 1. Lấy 25 nhóm ngành ICB ---
        df = stock.listing.symbols_by_industries()
        # df columns: symbol, industry_code, industry_name

        sectors = []
        for i, ((code, name), group) in enumerate(
            df.groupby(['industry_code', 'industry_name'])
        ):
            color = _SECTOR_COLORS[i % len(_SECTOR_COLORS)]
            sectors.append({
                'industry_code': int(code),
                'name': name.strip(),
                'group_type': 'SECTOR',
                'description': f'Nhóm cổ phiếu ngành {name.strip()}',
                'color': color,
                'symbols': sorted(group['symbol'].str.upper().tolist()),
            })
        sectors.sort(key=lambda x: x['industry_code'])

        # --- 2. Lấy các nhóm vốn hóa ---
        cap_groups = []
        for group_code, description, color in _CAP_GROUP_DEFS:
            try:
                series = stock.listing.symbols_by_group(group_code)
                cap_groups.append({
                    'name': group_code,
                    'group_type': 'MARKET_CAP',
                    'description': description,
                    'color': color,
                    'symbols': sorted(series.str.upper().tolist()),
                })
            except Exception as exc:
                logger.warning('symbols_by_group(%s) lỗi: %s', group_code, exc)

        return {'sectors': sectors, 'cap_groups': cap_groups, 'error': None}

    except Exception as exc:
        logger.error('fetch_market_sectors_and_groups thất bại: %s', exc)
        return {'sectors': [], 'cap_groups': [], 'error': str(exc)}


def get_manual_market_group_payload() -> list[dict]:
    return [dict(group) for group in _MANUAL_MARKET_GROUPS]


def build_market_group_payload(mode: str = 'all') -> dict:
    normalized_mode = mode if mode in {'all', 'sectors', 'caps', 'manual'} else 'all'
    if normalized_mode == 'manual':
        return {
            'groups': get_manual_market_group_payload(),
            'source': 'manual',
            'warning': None,
            'mode': normalized_mode,
        }

    data = fetch_market_sectors_and_groups()
    if data['error']:
        return {
            'groups': get_manual_market_group_payload(),
            'source': 'manual',
            'warning': f'vnstock lỗi: {data["error"]}. Dùng danh sách mặc định.',
            'mode': normalized_mode,
        }

    groups = []
    if normalized_mode in ('all', 'sectors'):
        for index, sector in enumerate(data['sectors']):
            groups.append({
                'name': sector['name'],
                'group_type': 'SECTOR',
                'description': sector['description'],
                'color': sector['color'],
                'order': index + 1,
                'symbols': sector['symbols'],
            })

    if normalized_mode in ('all', 'caps'):
        offset = len(groups)
        for index, cap in enumerate(data['cap_groups']):
            groups.append({
                'name': cap['name'],
                'group_type': 'MARKET_CAP',
                'description': cap['description'],
                'color': cap['color'],
                'order': offset + index + 1,
                'symbols': cap['symbols'],
            })

    return {
        'groups': groups,
        'source': 'vnstock',
        'warning': None,
        'mode': normalized_mode,
    }


def apply_market_group_payload(groups: list[dict], clear_existing: bool = False) -> dict:
    created_groups = []
    updated_groups = []
    added_symbols = 0
    deleted_groups = 0

    if clear_existing:
        deleted_groups = SecuritiesGroup.objects.count()
        SecuritiesGroup.objects.all().delete()

    for group_data in groups:
        symbols = [symbol.upper().strip() for symbol in group_data.get('symbols', []) if symbol]
        group, created = SecuritiesGroup.objects.get_or_create(
            name=group_data['name'],
            group_type=group_data['group_type'],
            defaults={
                'description': group_data.get('description', ''),
                'color': group_data.get('color', '#22c55e'),
                'order': group_data.get('order', 0),
            },
        )

        metadata_updates = []
        for field_name, field_value in {
            'description': group_data.get('description', ''),
            'color': group_data.get('color', '#22c55e'),
            'order': group_data.get('order', 0),
        }.items():
            if getattr(group, field_name) != field_value:
                setattr(group, field_name, field_value)
                metadata_updates.append(field_name)
        if metadata_updates:
            group.save(update_fields=metadata_updates)

        existing_items = {
            item.symbol: item
            for item in group.items.all()
        }
        group_added_symbols = 0
        reordered_symbols = 0

        for index, symbol in enumerate(symbols):
            existing_item = existing_items.get(symbol)
            if existing_item:
                if existing_item.order != index:
                    existing_item.order = index
                    existing_item.save(update_fields=['order'])
                    reordered_symbols += 1
                continue

            SecuritiesItem.objects.create(group=group, symbol=symbol, order=index)
            group_added_symbols += 1

        removed_symbols = group.items.exclude(symbol__in=symbols)
        removed_symbols_count = removed_symbols.count()
        if removed_symbols_count:
            removed_symbols.delete()

        added_symbols += group_added_symbols
        if created:
            created_groups.append({'group': group.name, 'symbols': len(symbols)})
        elif metadata_updates or group_added_symbols or removed_symbols_count or reordered_symbols:
            updated_groups.append(
                {
                    'group': group.name,
                    'new_symbols': group_added_symbols,
                    'removed_symbols': removed_symbols_count,
                }
            )

    message_parts = []
    if deleted_groups:
        message_parts.append(f'da xoa {deleted_groups} nhom cu')
    if created_groups:
        message_parts.append(f'tao moi {len(created_groups)} nhom')
    if updated_groups:
        message_parts.append(f'cap nhat {len(updated_groups)} nhom')
    if not message_parts:
        message_parts.append('khong co thay doi')

    return {
        'created': created_groups,
        'updated': updated_groups,
        'deleted_groups': deleted_groups,
        'total_groups': len(groups),
        'created_groups_count': len(created_groups),
        'updated_groups_count': len(updated_groups),
        'added_symbols_count': added_symbols,
        'message': ', '.join(message_parts) + '.',
    }


def sync_market_groups(
    requested_by: User | None = None,
    mode: str = 'all',
    clear_existing: bool = False,
    payload: dict | None = None,
    scope: str = MarketGroupSyncLog.ScopeChoices.GLOBAL,
    target_user: User | None = None,
    total_users: int = 0,
) -> dict:
    resolved_payload = payload or build_market_group_payload(mode)
    log = MarketGroupSyncLog.objects.create(
        scope=scope,
        target_user=target_user,
        requested_by=requested_by,
        mode=resolved_payload['mode'],
        clear_existing=clear_existing,
        source=resolved_payload['source'],
        total_users=total_users,
        total_groups=len(resolved_payload['groups']),
    )

    try:
        result = apply_market_group_payload(resolved_payload['groups'], clear_existing=clear_existing)
        message = result['message']
        if resolved_payload['warning']:
            message = f'{message} {resolved_payload["warning"]}'
        log.success = True
        log.created_groups = result['created_groups_count']
        log.updated_groups = result['updated_groups_count']
        log.added_symbols = result['added_symbols_count']
        log.message = message
        log.finished_at = timezone.now()
        log.save(update_fields=['success', 'created_groups', 'updated_groups', 'added_symbols', 'message', 'finished_at'])
        return {
            **result,
            'success': True,
            'warning': resolved_payload['warning'],
            'source': resolved_payload['source'],
            'log': log,
        }
    except Exception as exc:
        logger.exception('sync_market_groups thất bại')
        log.success = False
        log.error = str(exc)
        log.message = 'Đồng bộ nhóm thị trường thất bại.'
        log.finished_at = timezone.now()
        log.save(update_fields=['success', 'error', 'message', 'finished_at'])
        return {
            'success': False,
            'warning': resolved_payload['warning'],
            'source': resolved_payload['source'],
            'error': str(exc),
            'message': 'Đồng bộ nhóm thị trường thất bại.',
            'log': log,
        }


def sync_market_groups_for_user(
    user: User,
    requested_by: User | None = None,
    mode: str = 'all',
    clear_existing: bool = False,
    payload: dict | None = None,
) -> dict:
    return sync_market_groups(
        requested_by=requested_by,
        mode=mode,
        clear_existing=clear_existing,
        payload=payload,
        scope=MarketGroupSyncLog.ScopeChoices.USER,
        target_user=user,
        total_users=1,
    )


def sync_market_groups_for_users(
    users,
    requested_by: User | None = None,
    mode: str = 'all',
    clear_existing: bool = False,
) -> dict:
    user_list = list(users)
    return sync_market_groups(
        requested_by=requested_by,
        mode=mode,
        clear_existing=clear_existing,
        total_users=len(user_list),
        scope=MarketGroupSyncLog.ScopeChoices.GLOBAL,
    )


def _fetch_exchange_lookup(timeout: int = 20) -> dict:
    """Lấy company_name và exchange cho toàn bộ mã từ vnstock symbols_by_exchange().
    Chạy trong thread daemon với timeout để tránh crash Django do vnstock gọi sys.exit().
    Trả về dict: symbol → {'company_name': str, 'exchange': str}
    """
    import threading

    result: dict = {}
    exc_holder: list = []

    def _worker():
        try:
            from vnstock import Vnstock
            stock = Vnstock().stock(symbol='ACB', source='VCI')
            df = stock.listing.symbols_by_exchange()
            result.update({
                row['symbol'].upper().strip(): {
                    'company_name': row.get('organ_name', '') or '',
                    'exchange': row.get('exchange', '') or '',
                }
                for _, row in df.iterrows()
            })
        except BaseException as exc:  # bắt cả SystemExit từ vnstock
            exc_holder.append(exc)

    t = threading.Thread(target=_worker, daemon=True)
    t.start()
    t.join(timeout=timeout)

    if t.is_alive():
        logger.warning('_fetch_exchange_lookup timeout sau %ss — bỏ qua', timeout)
    elif exc_holder:
        logger.warning('_fetch_exchange_lookup thất bại: %s', exc_holder[0])

    return result


def build_stock_profile_payload(mode: str = 'all') -> dict:
    resolved_payload = build_market_group_payload(mode)

    # Lấy company_name + exchange từ vnstock listing (một lần duy nhất)
    exchange_lookup = _fetch_exchange_lookup()

    symbol_map = {}
    for group in resolved_payload['groups']:
        industry = group['name'] if group.get('group_type') == 'SECTOR' else ''
        for symbol in group.get('symbols', []):
            normalized_symbol = symbol.upper().strip()
            current = symbol_map.get(normalized_symbol, {
                'symbol': normalized_symbol,
                'industry': '',
                'exchange': '',
                'company_name': '',
            })
            if industry and not current['industry']:
                current['industry'] = industry
            # Bổ sung company_name và exchange nếu còn trống
            lookup = exchange_lookup.get(normalized_symbol, {})
            if not current['company_name'] and lookup.get('company_name'):
                current['company_name'] = lookup['company_name']
            if not current['exchange'] and lookup.get('exchange'):
                current['exchange'] = lookup['exchange']
            symbol_map[normalized_symbol] = current

    # Thêm các mã có trong exchange_lookup nhưng chưa có trong symbol_map
    # (tức là các mã không thuộc nhóm ngành nào, nhưng vẫn là cổ phiếu thật)
    for symbol, info in exchange_lookup.items():
        if symbol not in symbol_map:
            symbol_map[symbol] = {
                'symbol': symbol,
                'industry': '',
                'company_name': info['company_name'],
                'exchange': info['exchange'],
            }

    warning = resolved_payload['warning']
    if not exchange_lookup:
        note = 'Không lấy được company_name/exchange từ vnstock.'
        warning = f'{warning} {note}'.strip() if warning else note

    return {
        'symbols': list(symbol_map.values()),
        'source': resolved_payload['source'],
        'warning': warning,
        'mode': resolved_payload['mode'],
    }


def sync_stock_profiles(requested_by: User | None = None, mode: str = 'all') -> dict:
    payload = build_stock_profile_payload(mode)
    log = StockProfileSyncLog.objects.create(
        requested_by=requested_by,
        mode=payload['mode'],
        source=payload['source'],
        total_symbols=len(payload['symbols']),
    )

    created_symbols = 0
    updated_symbols = 0
    try:
        with db_transaction.atomic():
            for row in payload['symbols']:
                _, created = StockProfile.objects.update_or_create(
                    symbol=row['symbol'],
                    defaults={
                        'industry': row.get('industry', ''),
                        'exchange': row.get('exchange', ''),
                        'company_name': row.get('company_name', ''),
                        'is_active': True,
                    },
                )
                if created:
                    created_symbols += 1
                else:
                    updated_symbols += 1

        message = f'Da dong bo {len(payload["symbols"])} ma chung khoan (tao moi: {created_symbols}, cap nhat: {updated_symbols}).'
        if payload['warning']:
            message = f'{message} {payload["warning"]}'
        log.success = True
        log.created_symbols = created_symbols
        log.updated_symbols = updated_symbols
        log.message = message
        log.finished_at = timezone.now()
        log.save(update_fields=['success', 'created_symbols', 'updated_symbols', 'message', 'finished_at'])
        return {
            'success': True,
            'message': message,
            'warning': payload['warning'],
            'source': payload['source'],
            'total_symbols': len(payload['symbols']),
            'created_symbols': created_symbols,
            'updated_symbols': updated_symbols,
            'log': log,
        }
    except Exception as exc:
        logger.exception('sync_stock_profiles thất bại')
        log.success = False
        log.error = str(exc)
        log.message = 'Đồng bộ hồ sơ mã chứng khoán thất bại.'
        log.finished_at = timezone.now()
        log.save(update_fields=['success', 'error', 'message', 'finished_at'])
        return {
            'success': False,
            'message': 'Đồng bộ hồ sơ mã chứng khoán thất bại.',
            'warning': payload['warning'],
            'source': payload['source'],
            'error': str(exc),
            'log': log,
        }
