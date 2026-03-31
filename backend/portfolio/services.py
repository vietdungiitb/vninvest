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

from django.db import transaction as db_transaction

from .models import DailyPrice, Portfolio, SecuritiesGroup

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

            _, created = DailyPrice.objects.update_or_create(
                symbol=symbol,
                date=price_date,
                defaults=data,
            )
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
    Kéo giá EOD mới nhất cho tất cả mã CK trong watchlist của một user.
    Mặc định sync 5 ngày để cập nhật giá nhanh.
    """
    symbols = list(
        SecuritiesGroup.objects
        .filter(user_id=user_id)
        .values_list('items__symbol', flat=True)
        .distinct()
    )
    symbols = [s for s in symbols if s]  # loại bỏ None

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
