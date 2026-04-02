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


def load_transactions_df(container) -> pd.DataFrame:
    """
    Load toàn bộ giao dịch của portfolio hoặc tiểu khoản thành DataFrame.


    Columns:
        id, symbol, transaction_type, date, price, quantity, fee

    Tại sao .values() thay vì ORM object?
        .values() trả về list[dict] trực tiếp từ SQL — không tạo object Python,
        nhanh hơn khoảng 5-10× với dataset lớn.
    """

    if hasattr(container, 'sub_accounts'):
        qs = Transaction.objects.filter(
            sub_account__portfolio=container,
        ).order_by('date', 'created_at').values(
            'id', 'symbol', 'transaction_type', 'date', 'price', 'quantity', 'fee',
        )
    else:
        qs = container.transactions.order_by('date', 'created_at').values(
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
    timeline_index = daily_changes.index.union(all_price_dates).sort_values()
    holdings_pivot = (
        daily_changes
        .reindex(timeline_index, fill_value=0.0)
        .cumsum()
        .clip(lower=0)
        .reindex(all_price_dates, method='ffill', fill_value=0.0)
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


def compute_allocation_by_sector(portfolio) -> list[dict]:
    """
    Tính tỷ trọng phân bổ tài sản nhóm theo ngành (industry).

    Join compute_holdings() với StockProfile.industry.

    Returns list[dict]: [{ sector, value, percentage, hhi_contribution }, ...]
        hhi_contribution: đóng góp vào Herfindahl-Hirschman Index (đo mức độ tập trung)
        HHI = sum(percentage_i^2), càng nhỏ càng đa dạng hóa
    """
    from .models import StockProfile

    df = compute_holdings(portfolio)
    if df.empty or 'market_value' not in df.columns:
        return []

    df_alloc = df[df['market_value'].notna() & (df['market_value'] > 0)].copy()
    if df_alloc.empty:
        return []

    # Load industry mapping từ StockProfile (1 query duy nhất)
    symbols = df_alloc['symbol'].tolist()
    profiles_qs = StockProfile.objects.filter(symbol__in=symbols).values('symbol', 'industry')
    industry_map = {p['symbol']: p['industry'] or 'Khác' for p in profiles_qs}

    df_alloc['sector'] = df_alloc['symbol'].map(
        lambda s: industry_map.get(s, 'Khác')
    )

    # Group by sector: tổng market_value mỗi ngành
    sector_series = df_alloc.groupby('sector')['market_value'].sum()
    total = sector_series.sum()
    if total == 0:
        return []

    result_df = sector_series.reset_index()
    result_df.columns = ['sector', 'value']
    result_df['percentage'] = (result_df['value'] / total * 100).round(FLOAT_ROUND)
    # HHI contribution: (weight%)^2 — sum toàn bộ = HHI tổng
    result_df['hhi_contribution'] = (result_df['percentage'] ** 2).round(FLOAT_ROUND)
    result_df.sort_values('value', ascending=False, inplace=True)

    return result_df[['sector', 'value', 'percentage', 'hhi_contribution']].to_dict(orient='records')


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


# ---------------------------------------------------------------------------
# Bước 7: Risk Metrics — Sharpe, Sortino, Drawdown, TWR, Volatility
# ---------------------------------------------------------------------------

def compute_daily_returns(nav_df: pd.DataFrame) -> pd.Series:
    """
    Tính daily return từ NAV DataFrame.

    Parameters:
        nav_df: DataFrame với columns ['date', 'value'] từ compute_nav_series()

    Returns:
        pd.Series of daily returns (float, e.g. 0.012 = 1.2%)
    """
    if nav_df.empty or len(nav_df) < 2:
        return pd.Series(dtype=float)

    values = pd.Series(nav_df['value'].values, index=pd.to_datetime(nav_df['date']))
    values = values.sort_index()
    # pct_change() = (V_t - V_{t-1}) / V_{t-1}; dropna() loại bỏ NaN đầu tiên
    returns = values.pct_change().dropna()
    return returns


def compute_max_drawdown(nav_df: pd.DataFrame) -> float:
    """
    Tính Maximum Drawdown (%) từ NAV series.

    Công thức: MDD = min( (V_t - peak_t) / peak_t ) × 100
    Ý nghĩa: mức sụt giảm lớn nhất từ đỉnh cao nhất đến đáy thấp nhất.

    Returns:
        float: MDD as negative % (e.g. -15.3), hoặc 0.0 nếu không đủ dữ liệu
    """
    if nav_df.empty or len(nav_df) < 2:
        return 0.0

    values = nav_df['value'].values.astype(float)
    # rolling maximum (peak) tính đến thời điểm t
    peaks = np.maximum.accumulate(values)
    drawdowns = np.where(peaks > 0, (values - peaks) / peaks * 100, 0.0)
    return round(float(np.min(drawdowns)), FLOAT_ROUND)


def compute_volatility(returns: pd.Series) -> float:
    """
    Tính Annualized Volatility (độ lệch chuẩn hàng năm).

    Công thức: σ_annual = std(returns_daily) × sqrt(252)
    252 = số ngày giao dịch trung bình mỗi năm (VN market).

    Returns:
        float: volatility as % (e.g. 18.5 = 18.5%/năm), hoặc 0.0 nếu không đủ dữ liệu
    """
    if returns.empty or len(returns) < 2:
        return 0.0

    vol = float(returns.std()) * np.sqrt(252) * 100
    return round(vol, FLOAT_ROUND)


def compute_sharpe(returns: pd.Series, risk_free_annual: float = 0.05) -> float:
    """
    Tính Sharpe Ratio (annualized).

    Công thức: Sharpe = (R_p - R_f) / σ_p
        R_p = annualized portfolio return = mean(r_daily) × 252
        R_f = risk-free rate mỗi năm (default 5% cho VN)
        σ_p = annualized volatility = std(r_daily) × sqrt(252)

    Returns:
        float: Sharpe ratio, hoặc 0.0 nếu không đủ dữ liệu / volatility = 0
    """
    if returns.empty or len(returns) < 5:
        return 0.0

    mean_daily = float(returns.mean())
    std_daily = float(returns.std())

    if std_daily < 1e-12:
        return 0.0

    # Chuyển risk_free về daily rate: (1 + R_f)^(1/252) - 1 ≈ R_f/252
    risk_free_daily = risk_free_annual / 252

    sharpe = (mean_daily - risk_free_daily) / std_daily * np.sqrt(252)
    return round(float(sharpe), FLOAT_ROUND)


def compute_sortino(returns: pd.Series, risk_free_annual: float = 0.05) -> float:
    """
    Tính Sortino Ratio (annualized) — chỉ phạt downside risk.

    Công thức: Sortino = (R_p - R_f) / σ_downside
        σ_downside = std(r_i where r_i < 0) × sqrt(252)
        Chỉ tính độ lệch chuẩn của các ngày thua lỗ (khác Sharpe tính cả upside).

    Returns:
        float: Sortino ratio, hoặc 0.0 nếu không đủ dữ liệu / không có ngày lỗ
    """
    if returns.empty or len(returns) < 5:
        return 0.0

    mean_daily = float(returns.mean())
    risk_free_daily = risk_free_annual / 252

    negative_returns = returns[returns < 0]
    if negative_returns.empty:
        # Danh mục không có ngày lỗ → Sortino = +∞, trả về 99.0 làm sentinel
        return 99.0

    downside_std = float(negative_returns.std())
    if downside_std == 0:
        return 0.0

    sortino = (mean_daily - risk_free_daily) / downside_std * np.sqrt(252)
    return round(float(sortino), FLOAT_ROUND)


def compute_twr(nav_df: pd.DataFrame) -> float:
    """
    Tính Time-Weighted Return (TWR) từ NAV series.

    TWR loại bỏ ảnh hưởng của các khoản nạp/rút tiền, phản ánh
    đúng hiệu suất đầu tư thuần túy của danh mục.

    Công thức đơn giản (daily chain-linking):
        TWR = (∏ (1 + r_i)) - 1
        Trong đó r_i = daily return

    Đây là xấp xỉ Modified Dietz / daily-chaining khi không có
    timestamp chính xác của cashflow.

    Returns:
        float: TWR as % (e.g. 23.5 = 23.5% từ đầu kỳ đến cuối kỳ),
               hoặc 0.0 nếu không đủ dữ liệu
    """
    if nav_df.empty or len(nav_df) < 2:
        return 0.0

    values = pd.Series(nav_df['value'].values, index=pd.to_datetime(nav_df['date']))
    values = values.sort_index()

    # Tính sub-period returns: (V_t / V_{t-1}) - 1
    sub_period_factors = (values / values.shift(1)).dropna()

    if sub_period_factors.empty:
        return 0.0

    # Chain-link: nhân tất cả (1 + r_i)
    twr = float(sub_period_factors.prod()) - 1.0
    return round(twr * 100, FLOAT_ROUND)


def build_risk_metrics(portfolio, days: int = 365) -> dict:
    """
    Tổng hợp tất cả risk metrics cho một portfolio.

    Gọi một lần: tính NAV series → daily returns → tất cả metrics.
    Không truy vấn DB nhiều lần.

    Returns dict:
        {
            sharpe_ratio, sortino_ratio, max_drawdown_pct, twr_pct,
            volatility_annual_pct, best_day_pct, worst_day_pct,
            total_trading_days, period_days
        }
    """
    nav_df = compute_nav_series(portfolio, days=days)

    empty_result = {
        'sharpe_ratio': None,
        'sortino_ratio': None,
        'max_drawdown_pct': None,
        'twr_pct': None,
        'volatility_annual_pct': None,
        'best_day_pct': None,
        'worst_day_pct': None,
        'total_trading_days': 0,
        'period_days': days,
    }

    if nav_df.empty or len(nav_df) < 5:
        return empty_result

    returns = compute_daily_returns(nav_df)

    if returns.empty:
        return empty_result

    best_day = round(float(returns.max()) * 100, FLOAT_ROUND)
    worst_day = round(float(returns.min()) * 100, FLOAT_ROUND)

    return {
        'sharpe_ratio': compute_sharpe(returns),
        'sortino_ratio': compute_sortino(returns),
        'max_drawdown_pct': compute_max_drawdown(nav_df),
        'twr_pct': compute_twr(nav_df),
        'volatility_annual_pct': compute_volatility(returns),
        'best_day_pct': best_day,
        'worst_day_pct': worst_day,
        'total_trading_days': len(nav_df),
        'period_days': days,
    }
