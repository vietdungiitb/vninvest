"""
analytics.py — Lớp tính toán danh mục sử dụng Pandas DataFrame.

Tại sao dùng Pandas thay vì Python loops thuần?
  1. Bulk load: .values() → DataFrame nhanh hơn ORM object iteration ~10×
  2. Vectorized ops: nhân/cộng trên toàn cột thay vì loop từng dòng.
  3. NAV series: pivot table + cumsum + element-wise multiply → O(n+m) thay vì O(n×m).
  4. GroupBy: tổng hợp theo mã CK bằng một câu lệnh thay vì nested dict.

Các hàm công khai:
  - load_transactions_df(portfolio)   → DataFrame giao dịch thô
  - compute_holdings(portfolio)       → DataFrame vị thế + giá vốn + P/L
  - compute_nav_series(portfolio)     → DataFrame chuỗi giá trị NAV theo ngày
  - compute_allocation(portfolio)     → DataFrame tỷ trọng Pie Chart
  - build_summary(portfolio)          → dict tổng quan tài sản
"""

import logging
from datetime import date, timedelta

import numpy as np
import pandas as pd

from .models import DailyPrice, Transaction

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Hằng số
# ---------------------------------------------------------------------------
BUY = Transaction.TransactionType.BUY
SELL = Transaction.TransactionType.SELL
DIVIDEND = Transaction.TransactionType.DIVIDEND

FLOAT_ROUND = 2  # số chữ số thập phân khi trả về API


# ---------------------------------------------------------------------------
# Bước 1: Load dữ liệu vào DataFrame
# ---------------------------------------------------------------------------


def load_transactions_df(subaccount) -> pd.DataFrame:
    """
    Load toàn bộ giao dịch của tiểu khoản thành DataFrame.


    Columns:
        id, symbol, transaction_type, date, price, quantity, fee

    Tại sao .values() thay vì ORM object?
        .values() trả về list[dict] trực tiếp từ SQL — không tạo object Python,
        nhanh hơn khoảng 5-10× với dataset lớn.
    """

    qs = subaccount.transactions.order_by('date', 'created_at').values(

        'id', 'symbol', 'transaction_type', 'date', 'price', 'quantity', 'fee',
    )
    if not qs.exists():
        return pd.DataFrame(columns=['id', 'symbol', 'transaction_type', 'date', 'price', 'quantity', 'fee'])

    df = pd.DataFrame.from_records(qs)

    # Ép kiểu: float cho tính toán số học (tránh Decimal overhead)
    df['price'] = df['price'].astype(float)
    df['quantity'] = df['quantity'].astype(float)
    df['fee'] = df['fee'].astype(float)
    df['date'] = pd.to_datetime(df['date'])

    return df


def load_prices_df(symbols: list[str], start_date: date, end_date: date) -> pd.DataFrame:
    """
    Load giá đóng cửa của nhiều mã từ DailyPrice thành DataFrame.

    Returns pivot DataFrame:
        index = date (DatetimeIndex)
        columns = symbol
        values = close_price (float)

    Tại sao pivot table?
        Để nhân trực tiếp holdings_df × prices_df bằng một lệnh, thay vì lookup dict.
    """
    qs = DailyPrice.objects.filter(
        symbol__in=symbols,
        date__range=(start_date, end_date),
    ).values('symbol', 'date', 'close_price')

    if not qs.exists():
        return pd.DataFrame()

    df = pd.DataFrame.from_records(qs)
    df['close_price'] = df['close_price'].astype(float)
    df['date'] = pd.to_datetime(df['date'])

    # Pivot: rows=ngày, cols=mã CK, values=giá đóng cửa
    pivot = df.pivot_table(index='date', columns='symbol', values='close_price', aggfunc='last')
    pivot.sort_index(inplace=True)

    return pivot


# ---------------------------------------------------------------------------
# Bước 2: Tính giá vốn trung bình gia quyền (Weighted Average Cost)
# ---------------------------------------------------------------------------

def _wavg_cost_for_symbol(group: pd.DataFrame) -> dict:
    """
    Tính giá vốn BQ gia quyền cho một mã CK (tuần tự theo thời gian).

    Thuật toán:
        BUY:      avg_cost_mới = (avg_cost_cũ × qty_cũ + price × qty_mua + fee) / qty_mới
        SELL:     realized_pl += (price_bán - avg_cost) × qty_bán - fee
                  qty -= qty_bán ; nếu qty = 0 → reset avg_cost = 0
        DIVIDEND: dividends += price × quantity

    Tại sao vẫn dùng iterrows ở đây?
        Giá vốn WAVG là bài toán tuần tự — mỗi dòng phụ thuộc vào kết quả của dòng trước.
        Không thể vectorize hoàn toàn. Nhưng Pandas vẫn nhanh hơn ORM loop vì dữ liệu
        đã được load bulk một lần, không có network/DB round-trip trong vòng lặp.
    """
    qty = 0.0
    avg_cost = 0.0
    realized_pl = 0.0
    dividends = 0.0

    for _, row in group.sort_values('date').iterrows():
        t = row['transaction_type']
        p, q, f = row['price'], row['quantity'], row['fee']

        if t == BUY:
            total_old = avg_cost * qty
            total_new = p * q + f
            qty += q
            avg_cost = (total_old + total_new) / qty if qty > 0 else 0.0

        elif t == SELL:
            realized_pl += (p - avg_cost) * q - f
            qty = max(0.0, qty - q)
            if qty == 0:
                avg_cost = 0.0

        elif t == DIVIDEND:
            dividends += p * q

    return {
        'quantity': round(qty, FLOAT_ROUND),
        'avg_cost': round(avg_cost, FLOAT_ROUND),
        'cost_basis': round(avg_cost * qty, FLOAT_ROUND),
        'realized_pl': round(realized_pl, FLOAT_ROUND),
        'dividends_received': round(dividends, FLOAT_ROUND),
    }


# ---------------------------------------------------------------------------
# Bước 3: Holdings DataFrame + Unrealized P/L (vectorized)
# ---------------------------------------------------------------------------

def compute_holdings(portfolio) -> pd.DataFrame:
    """
    Tính toàn bộ vị thế đang nắm giữ + các chỉ số P/L.

    Flow:
        1. Load transactions → DataFrame (bulk, no ORM overhead)
        2. GroupBy symbol → _wavg_cost_for_symbol() (tuần tự, nhưng không có DB I/O)
        3. Load giá mới nhất → join vào DataFrame
        4. Vectorized: tính market_value, unrealized_pl, unrealized_pl_pct cho tất cả mã cùng lúc

    Returns DataFrame với các columns:
        symbol, quantity, avg_cost, cost_basis, current_price,
        market_value, unrealized_pl, unrealized_pl_pct,
        realized_pl, dividends_received
    """
    df_txs = load_transactions_df(portfolio)
    if df_txs.empty:
        return pd.DataFrame()

    # --- Bước 2a: Tính WAVG cho từng mã ---
    cost_records = {}
    for symbol, group in df_txs.groupby('symbol'):
        cost_records[symbol] = _wavg_cost_for_symbol(group)

    df_holdings = pd.DataFrame.from_dict(cost_records, orient='index')
    df_holdings.index.name = 'symbol'
    df_holdings.reset_index(inplace=True)

    # Chỉ giữ vị thế đang mở (quantity > 0)
    df_holdings = df_holdings[df_holdings['quantity'] > 0].copy()

    if df_holdings.empty:
        return df_holdings

    # --- Bước 3a: Lấy giá đóng cửa mới nhất cho từng mã (1 query duy nhất) ---
    symbols = df_holdings['symbol'].tolist()
    latest_prices_qs = (
        DailyPrice.objects
        .filter(symbol__in=symbols)
        .order_by('symbol', '-date')
        .distinct('symbol')
        .values('symbol', 'close_price')
    )
    # distinct('symbol') chỉ hoạt động với PostgreSQL.
    # Với SQLite dùng subquery thay thế:
    from django.db.models import Max, Subquery, OuterRef, FloatField
    latest_date_sub = (
        DailyPrice.objects
        .filter(symbol=OuterRef('symbol'))
        .order_by('-date')
        .values('date')[:1]
    )
    latest_prices_qs = DailyPrice.objects.filter(
        symbol__in=symbols,
        date=Subquery(latest_date_sub),
    ).values('symbol', 'close_price')

    df_prices = pd.DataFrame.from_records(latest_prices_qs)

    if not df_prices.empty:
        df_prices['close_price'] = df_prices['close_price'].astype(float)
        df_holdings = df_holdings.merge(
            df_prices.rename(columns={'close_price': 'current_price'}),
            on='symbol', how='left',
        )
    else:
        df_holdings['current_price'] = np.nan

    # --- Bước 3b: Vectorized P/L (toàn bộ cột cùng lúc — không có loop) ---
    df_holdings['market_value'] = (
        df_holdings['current_price'] * df_holdings['quantity']
    ).round(FLOAT_ROUND)

    df_holdings['unrealized_pl'] = (
        df_holdings['market_value'] - df_holdings['cost_basis']
    ).round(FLOAT_ROUND)

    # np.where: tránh ZeroDivisionError trên toàn cột
    df_holdings['unrealized_pl_pct'] = np.where(
        df_holdings['cost_basis'] != 0,
        (df_holdings['unrealized_pl'] / df_holdings['cost_basis'] * 100).round(FLOAT_ROUND),
        0.0,
    )

    # Cột NaN (chưa có giá) → None khi serialize
    df_holdings = df_holdings.where(pd.notna(df_holdings), other=None)

    df_holdings.sort_values('symbol', inplace=True)
    return df_holdings


# ---------------------------------------------------------------------------
# Bước 4: NAV Time Series — O(n + m) thay vì O(n × m)
# ---------------------------------------------------------------------------

def compute_nav_series(portfolio, days: int = 90) -> pd.DataFrame:
    """
    Tính chuỗi giá trị danh mục (NAV) theo từng ngày giao dịch.

    Thuật toán cũ (views.py):
        for mỗi ngày d:
            for mỗi giao dịch tx:          ← O(n × m) — rất chậm khi nhiều mã/ngày
                tính lại holdings từ đầu

    Thuật toán mới (Pandas cumsum + pivot multiply):
        1. Tính qty_change mỗi ngày cho từng mã (BUY=+qty, SELL=-qty).
        2. cumsum theo thời gian → quantity held on any date.
        3. reindex vào tất cả ngày có giá → ffill (giữ nguyên nếu không có giao dịch).
        4. Multiply holdings_pivot × price_pivot element-wise → NAV per symbol per day.
        5. sum(axis=1) → tổng NAV portfolio → O(n + m) total.

    Returns DataFrame: columns = ['date', 'value']
    """
    df_txs = load_transactions_df(portfolio)
    if df_txs.empty:
        return pd.DataFrame(columns=['date', 'value'])

    end_date = date.today()
    start_date = end_date - timedelta(days=days)
    symbols = df_txs['symbol'].unique().tolist()

    # Load price pivot: index=date, columns=symbol
    price_pivot = load_prices_df(symbols, start_date, end_date)
    if price_pivot.empty:
        return pd.DataFrame(columns=['date', 'value'])

    all_price_dates = price_pivot.index  # DatetimeIndex các ngày có dữ liệu giá

    # --- Bước 4a: qty_change mỗi ngày, mỗi mã ---
    # BUY → +qty, SELL → -qty, DIVIDEND → 0
    df_txs['qty_signed'] = df_txs.apply(
        lambda r: r['quantity'] if r['transaction_type'] == BUY
        else (-r['quantity'] if r['transaction_type'] == SELL else 0.0),
        axis=1,
    )

    # Tổng thay đổi theo (date, symbol) — xử lý nhiều lệnh cùng ngày
    daily_changes = (
        df_txs.groupby(['date', 'symbol'])['qty_signed']
        .sum()
        .unstack(fill_value=0.0)  # pivot: index=date, columns=symbol
    )

    # --- Bước 4b: cumsum → quantity held after each date ---
    # reindex để bao gồm tất cả ngày có giá (không chỉ ngày có giao dịch)
    holdings_pivot = (
        daily_changes
        .reindex(all_price_dates, fill_value=0.0)
        .cumsum()
        .clip(lower=0)  # không thể âm
    )

    # Chỉ giữ các mã có trong cả hai bảng
    common_symbols = [s for s in symbols
                      if s in holdings_pivot.columns and s in price_pivot.columns]
    if not common_symbols:
        return pd.DataFrame(columns=['date', 'value'])

    # --- Bước 4c: NAV = sum(holdings × price) mỗi ngày — VECTORIZED ---
    #
    #   holdings_pivot[common]:  shape (m_days, n_symbols)
    #   price_pivot[common]:     shape (m_days, n_symbols)
    #   → element-wise multiply → sum per row → Series(m_days,)
    #
    nav_series = (
        holdings_pivot[common_symbols]
        .multiply(price_pivot[common_symbols])
        .sum(axis=1)
    )

    # Chỉ giữ ngày có NAV > 0
    nav_series = nav_series[nav_series > 0]

    result = pd.DataFrame({
        'date': nav_series.index.date,
        'value': nav_series.round(FLOAT_ROUND).values,
    })

    return result


# ---------------------------------------------------------------------------
# Bước 5: Allocation (Pie Chart) — vectorized từ kết quả compute_holdings
# ---------------------------------------------------------------------------

def compute_allocation(portfolio) -> list[dict]:
    """
    Tính tỷ trọng phân bổ tài sản (%) cho Pie Chart.

    Sử dụng lại compute_holdings() → tránh tính lại từ đầu.

    Returns list[dict]: [{ symbol, value, percentage }, ...]
    """
    df = compute_holdings(portfolio)
    if df.empty or 'market_value' not in df.columns:
        return []

    df_alloc = df[df['market_value'].notna() & (df['market_value'] > 0)].copy()
    total = df_alloc['market_value'].sum()
    if total == 0:
        return []

    df_alloc = df_alloc.copy()
    df_alloc['percentage'] = (df_alloc['market_value'] / total * 100).round(FLOAT_ROUND)
    df_alloc.sort_values('market_value', ascending=False, inplace=True)

    return df_alloc[['symbol', 'market_value', 'percentage']].rename(
        columns={'market_value': 'value'}
    ).to_dict(orient='records')


# ---------------------------------------------------------------------------
# Bước 6: Summary — tổng hợp toàn danh mục
# ---------------------------------------------------------------------------

def build_summary(portfolio) -> dict:
    """
    Tổng hợp các chỉ số NAV cho toàn bộ danh mục.

    Sử dụng lại compute_holdings() → không truy vấn DB lần thứ 2.

    Returns dict: tất cả fields cho SummarySerializer.
    """
    df = compute_holdings(portfolio)

    if df.empty:
        return {
            'portfolio_id': portfolio.id,
            'portfolio_name': portfolio.name,
            'total_market_value': 0.0,
            'total_cost_basis': 0.0,
            'total_unrealized_pl': 0.0,
            'total_unrealized_pl_pct': 0.0,
            'total_realized_pl': 0.0,
            'total_dividends': 0.0,
            'last_updated': None,
        }

    # --- Vectorized aggregation trên toàn DataFrame ---
    total_market_value = round(df['market_value'].fillna(0).sum(), FLOAT_ROUND)
    total_cost_basis = round(df['cost_basis'].sum(), FLOAT_ROUND)
    total_unrealized_pl = round(total_market_value - total_cost_basis, FLOAT_ROUND)
    total_unrealized_pl_pct = round(
        (total_unrealized_pl / total_cost_basis * 100) if total_cost_basis != 0 else 0.0,
        FLOAT_ROUND,
    )

    # realized_pl và dividends bao gồm cả vị thế đã đóng
    # → phải tính lại từ df_txs của TẤT CẢ giao dịch (không lọc qty > 0)
    df_txs = load_transactions_df(portfolio)
    total_realized_pl = 0.0
    total_dividends = 0.0

    if not df_txs.empty:
        for symbol, group in df_txs.groupby('symbol'):
            r = _wavg_cost_for_symbol(group)
            total_realized_pl += r['realized_pl']
            total_dividends += r['dividends_received']

    last_price_record = (
        DailyPrice.objects
        .filter(symbol__in=df['symbol'].tolist())
        .order_by('-date')
        .values('date')
        .first()
    )

    return {
        'portfolio_id': portfolio.id,
        'portfolio_name': portfolio.name,
        'total_market_value': float(total_market_value),
        'total_cost_basis': float(total_cost_basis),
        'total_unrealized_pl': float(total_unrealized_pl),
        'total_unrealized_pl_pct': float(total_unrealized_pl_pct),
        'total_realized_pl': round(float(total_realized_pl), FLOAT_ROUND),
        'total_dividends': round(float(total_dividends), FLOAT_ROUND),
        'last_updated': last_price_record['date'] if last_price_record else None,
    }
