"""
Order Flow Engine — Core SaaS (Pandas edition)

Port và nâng cấp từ legacy backend/portfolio/order_flow.py, adapted cho
core SaaS models (market_data.IntradayTick với timestamp: DateTimeField).

Sự khác biệt với legacy:
  - Nguồn dữ liệu: market_data.IntradayTick (timestamp DateTimeField)
    thay vì portfolio.IntradayTick (trade_date / trade_time tách biệt)
  - Không có cột value sẵn → tính price * volume tại load time
  - Redis cache dùng django.core.cache thống nhất
  - Tất cả hàm đều pure/side-effect-free (chỉ đọc DB, không ghi)

Sử dụng: signal_intelligence/tasks.py gọi các hàm này rồi ghi vào DB.
"""
from __future__ import annotations

import logging
import math
import statistics
from collections.abc import Sequence
from datetime import date, datetime, time, timedelta

import pandas as pd
from django.core.cache import cache
from django.utils import timezone as django_timezone

logger = logging.getLogger(__name__)

# ── Thresholds ─────────────────────────────────────────────────────────────
WHALE_VALUE_MIN_VND        = 500_000_000    # 500 triệu VND — lệnh cá mập
DARK_FLOW_VALUE_MIN_VND    = 250_000_000    # 250 triệu VND — ngưỡng dark flow
DARK_FLOW_BUY_RATIO_MIN    = 0.65           # ≥ 65% buy count → tích lũy bất đối xứng
DARK_FLOW_PRICE_CV_MAX     = 0.005          # ≤ 0.5% coefficient of variation → giá khoá
SMALL_ORDER_THRESHOLD      = 50_000_000     # 50 triệu
LARGE_ORDER_THRESHOLD      = 2_000_000_000  # 2 tỷ
PRICE_LOCK_THRESHOLD_PCT   = 0.003          # 0.3% price range → coi là "giá khoá"
CVD_DEFAULT_BUCKET_MINUTES = 1              # bucket 1 phút mặc định

# ── Redis cache ─────────────────────────────────────────────────────────────
_CVD_CACHE_KEY_PREFIX   = 'order_flow:cvd_series'
_CVD_CACHE_TTL_INTRADAY = 600     # 10 phút trong giờ giao dịch
_CVD_CACHE_TTL_CLOSED   = 86_400  # 24h sau đóng cửa / phiên cũ


# ── Internal helpers ────────────────────────────────────────────────────────

def _cvd_cache_key(symbol: str, session_date: date, bucket_minutes: int) -> str:
    return f'{_CVD_CACHE_KEY_PREFIX}:{symbol.upper()}:{session_date.isoformat()}:{bucket_minutes}m'


def _cvd_cache_ttl(session_date: date) -> int:
    """TTL phù hợp: ngắn trong giờ giao dịch, dài cho phiên đã đóng."""
    today = django_timezone.localdate()
    if session_date < today:
        return _CVD_CACHE_TTL_CLOSED
    now_local = django_timezone.localtime()
    # VN market: 9:00 – 14:45 (không kể ATO/ATC)
    total_minutes = now_local.hour * 60 + now_local.minute
    if 9 * 60 <= total_minutes <= 14 * 60 + 45:
        return _CVD_CACHE_TTL_INTRADAY
    return _CVD_CACHE_TTL_CLOSED


# ═══════════════════════════════════════════════════════════════════════════
# 1. Load ticks → DataFrame
# ═══════════════════════════════════════════════════════════════════════════

def load_session_ticks_df(symbol: str, session_date: date) -> pd.DataFrame:
    """
    Load IntradayTick cho (symbol, session_date) → DataFrame.

    Columns kết quả:
        timestamp  — tz-aware UTC datetime
        price      — float
        volume     — int64
        side       — 'BUY' | 'SELL' | 'UNKNOWN'
        value      — float = price × volume (VND)

    Không raise nếu không có data — trả về DataFrame rỗng với schema đúng.
    """
    from market_data.models import IntradayTick

    _empty_schema = ['timestamp', 'price', 'volume', 'side', 'value']

    _day_start = django_timezone.make_aware(datetime.combine(session_date, time.min))
    _day_end = _day_start + timedelta(days=1)
    qs = (
        IntradayTick.objects
        .filter(symbol=symbol.upper(), timestamp__gte=_day_start, timestamp__lt=_day_end)
        .values('timestamp', 'price', 'volume', 'side')
        .order_by('timestamp')
    )
    rows = list(qs)
    if not rows:
        return pd.DataFrame(columns=_empty_schema)

    df = pd.DataFrame.from_records(rows)
    df['price']  = pd.to_numeric(df['price'],  errors='coerce').fillna(0.0).astype('float64')
    df['volume'] = pd.to_numeric(df['volume'], errors='coerce').fillna(0).astype('int64')
    df['value']  = df['price'] * df['volume']
    df['side']   = df['side'].astype(str).str.upper().fillna('UNKNOWN')

    # Chuẩn hoá timestamp → tz-aware UTC
    if not pd.api.types.is_datetime64_any_dtype(df['timestamp']):
        df['timestamp'] = pd.to_datetime(df['timestamp'], utc=True)
    elif df['timestamp'].dt.tz is None:
        df['timestamp'] = df['timestamp'].dt.tz_localize('UTC')
    else:
        df['timestamp'] = df['timestamp'].dt.tz_convert('UTC')

    return df


# ═══════════════════════════════════════════════════════════════════════════
# 2. CVD bucket series (Pandas vectorized)
# ═══════════════════════════════════════════════════════════════════════════

def compute_cvd_buckets_df(
    df: pd.DataFrame,
    bucket_minutes: int = CVD_DEFAULT_BUCKET_MINUTES,
) -> pd.DataFrame:
    """
    Tính Cumulative Volume Delta theo bucket thời gian.

    Input : DataFrame từ load_session_ticks_df.
    Output: DataFrame (index reset) với columns:
        bucket_ts        — Timestamp (tz-aware)
        buy_value        — float
        sell_value       — float
        total_value      — float
        tick_count       — int
        small_order_count— int
        small_order_ratio— float 0..1
        cvd              — float = buy_value - sell_value trong bucket
        cumulative_cvd   — float tích lũy từ đầu phiên
        dominant_side    — 'buy' | 'sell' | 'neutral'
    """
    if df.empty:
        return pd.DataFrame()

    df = df.copy()
    df['bucket_ts'] = df['timestamp'].dt.floor(f'{bucket_minutes}min')

    # Phân bổ value theo side (UNKNOWN chia đôi 50/50)
    df['buy_value']  = 0.0
    df['sell_value'] = 0.0
    buy_mask     = df['side'] == 'BUY'
    sell_mask    = df['side'] == 'SELL'
    unknown_mask = ~(buy_mask | sell_mask)

    df.loc[buy_mask,     'buy_value']  = df.loc[buy_mask,     'value']
    df.loc[sell_mask,    'sell_value'] = df.loc[sell_mask,    'value']
    df.loc[unknown_mask, 'buy_value']  = df.loc[unknown_mask, 'value'] * 0.5
    df.loc[unknown_mask, 'sell_value'] = df.loc[unknown_mask, 'value'] * 0.5

    df['is_small'] = df['value'] < SMALL_ORDER_THRESHOLD

    bucketed = (
        df.groupby('bucket_ts', as_index=False)
        .agg(
            buy_value        = ('buy_value',  'sum'),
            sell_value       = ('sell_value', 'sum'),
            total_value      = ('value',      'sum'),
            tick_count       = ('value',      'count'),
            small_order_count= ('is_small',   'sum'),
        )
        .sort_values('bucket_ts')
        .reset_index(drop=True)
    )

    bucketed['cvd']            = bucketed['buy_value'] - bucketed['sell_value']
    bucketed['cumulative_cvd'] = bucketed['cvd'].cumsum()
    bucketed['dominant_side']  = bucketed['cvd'].apply(
        lambda x: 'buy' if x > 0 else ('sell' if x < 0 else 'neutral')
    )
    bucketed['small_order_ratio'] = (
        bucketed['small_order_count'] / bucketed['tick_count'].clip(lower=1)
    ).round(4)

    return bucketed


def get_cvd_series_list(
    symbol: str,
    session_date: date,
    bucket_minutes: int = CVD_DEFAULT_BUCKET_MINUTES,
) -> list[dict]:
    """
    Trả về CVD series dưới dạng list[dict] sẵn sàng cho API/Redis.

    Tự động cache trong Redis theo TTL phù hợp với giờ thị trường.
    """
    cache_key = _cvd_cache_key(symbol, session_date, bucket_minutes)
    try:
        cached = cache.get(cache_key)
        if cached is not None:
            return cached
    except Exception as exc:
        logger.warning('CVD cache get failed %s/%s: %s', symbol, session_date, exc)

    df      = load_session_ticks_df(symbol, session_date)
    bucketed = compute_cvd_buckets_df(df, bucket_minutes=bucket_minutes)
    if bucketed.empty:
        return []

    result = []
    for row in bucketed.to_dict(orient='records'):
        bts = row['bucket_ts']
        result.append({
            'bucket_ts':         bts.isoformat() if hasattr(bts, 'isoformat') else str(bts),
            'buy_value':         round(float(row['buy_value']),         2),
            'sell_value':        round(float(row['sell_value']),        2),
            'total_value':       round(float(row['total_value']),       2),
            'cvd':               round(float(row['cvd']),               2),
            'cumulative_cvd':    round(float(row['cumulative_cvd']),    2),
            'tick_count':        int(row['tick_count']),
            'small_order_ratio': float(row['small_order_ratio']),
            'dominant_side':     row['dominant_side'],
        })

    ttl = _cvd_cache_ttl(session_date)
    try:
        cache.set(cache_key, result, timeout=ttl)
    except Exception as exc:
        logger.warning('CVD cache set failed %s/%s: %s', symbol, session_date, exc)

    return result


def invalidate_cvd_cache(symbol: str, session_date: date) -> None:
    """Xoá CVD cache khi có dữ liệu mới ghi vào DB."""
    for bm in (1, 5, 15, 30, 60):
        try:
            cache.delete(_cvd_cache_key(symbol, session_date, bm))
        except Exception:
            pass


# ═══════════════════════════════════════════════════════════════════════════
# 3. Whale tick detection (per-tick)
# ═══════════════════════════════════════════════════════════════════════════

def detect_whale_ticks(
    df: pd.DataFrame,
    threshold_vnd: int = WHALE_VALUE_MIN_VND,
) -> pd.DataFrame:
    """
    Trả về DataFrame các tick có value >= threshold.

    Mỗi hàng là một lệnh whale riêng lẻ — dùng để ghi
    WhaleAlertCanonical với granularity đúng per-tick.
    """
    if df.empty:
        return df.iloc[:0].copy()
    return df[df['value'] >= threshold_vnd].copy()


# ═══════════════════════════════════════════════════════════════════════════
# 4. Dark flow detection (sliding window, giữ nguyên logic legacy)
# ═══════════════════════════════════════════════════════════════════════════

def detect_dark_flow_windows(
    df: pd.DataFrame,
    window_minutes: int = 5,
    threshold_vnd: int = DARK_FLOW_VALUE_MIN_VND,
    buy_ratio_min: float = DARK_FLOW_BUY_RATIO_MIN,
    price_cv_max: float = DARK_FLOW_PRICE_CV_MAX,
) -> list[dict]:
    """
    Phát hiện dark flow theo cửa sổ trượt.

    Dark flow = trong window:
      - tổng giá trị giao dịch >= threshold
      - tỷ lệ lệnh mua >= buy_ratio_min (tích lũy bất đối xứng)
      - coefficient of variation giá <= price_cv_max (giá khoá)

    Trả về list[dict] với các window được phát hiện và metadata.
    """
    if df.empty or len(df) < 5:
        return []

    df = df.copy()
    df['window_ts'] = df['timestamp'].dt.floor(f'{window_minutes}min')

    dark_flow_signals = []
    for window_ts, group in df.groupby('window_ts'):
        total_value = float(group['value'].sum())
        if total_value < threshold_vnd:
            continue

        total_count = len(group)
        buy_count   = int((group['side'] == 'BUY').sum())
        buy_ratio   = buy_count / total_count if total_count > 0 else 0.0
        if buy_ratio < buy_ratio_min:
            continue

        # Kiểm tra giá ổn định qua coefficient of variation
        prices     = group['price'].astype(float)
        price_mean = float(prices.mean())
        price_std  = float(prices.std(ddof=0)) if len(prices) > 1 else 0.0
        price_cv   = price_std / price_mean if price_mean > 0 else 0.0
        if price_cv > price_cv_max:
            continue

        buy_ticks = group.loc[group['side'] == 'BUY']
        buy_value = float(buy_ticks['value'].sum())
        # F1-darkflow-value: tổng khối lượng MUA (cổ phiếu) của window — dùng để
        # tính VWAP và matched_value ở tầng tasks/materializers. Đơn vị PHẢI là
        # cổ phiếu (không phải số đếm tick) để nhất quán với volume_at_signal.
        buy_volume = int(buy_ticks['volume'].sum())
        dark_flow_signals.append({
            'window_ts':   window_ts.isoformat() if hasattr(window_ts, 'isoformat') else str(window_ts),
            'total_value': round(total_value, 2),
            'buy_value':   round(buy_value, 2),
            'buy_volume':  buy_volume,
            'buy_ratio':   round(buy_ratio, 4),
            'price_cv':    round(price_cv, 6),
            'tick_count':  total_count,
            'buy_count':   buy_count,
            'intensity':   round(min(1.0, total_value / 2_000_000_000), 4),
        })

    return dark_flow_signals


# ═══════════════════════════════════════════════════════════════════════════
# 5. Absorption detection (price lock + CVD divergence)
# ═══════════════════════════════════════════════════════════════════════════

def detect_absorption(
    cvd_series: list[dict],
    price_series: Sequence[float],
    min_buckets: int = 3,
) -> dict:
    """
    Phát hiện absorption: giá khoá trong khi CVD dịch chuyển mạnh.

    Trả về {detected, strength, price_locked, price_range_pct, cvd_change, description}.
    Dùng cumulative_cvd từ cvd_series (output của get_cvd_series_list).
    """
    _empty = {
        'detected':       False,
        'strength':       0.0,
        'price_locked':   False,
        'price_range_pct': 0.0,
        'cvd_change':     0.0,
        'description':    'Không đủ dữ liệu',
    }

    if len(cvd_series) < min_buckets or len(price_series) < min_buckets:
        return _empty

    recent_cvd    = cvd_series[-min_buckets:]
    recent_prices = list(price_series[-min_buckets:])

    price_min       = min(recent_prices)
    price_max       = max(recent_prices)
    price_range_pct = (price_max - price_min) / price_min if price_min > 0 else 0.0
    price_locked    = price_range_pct < PRICE_LOCK_THRESHOLD_PCT

    cvd_values     = [b['cumulative_cvd'] for b in recent_cvd]
    cvd_change     = cvd_values[-1] - cvd_values[0]
    abs_mean       = statistics.mean([abs(v) for v in cvd_values]) or 1.0
    cvd_change_pct = abs(cvd_change) / abs_mean * 100 if abs_mean else 0.0
    strength       = min(cvd_change_pct / 20 * 100, 100.0)
    detected       = price_locked and cvd_change_pct > 20.0

    if detected:
        direction   = 'tăng mạnh' if cvd_change > 0 else 'giảm mạnh'
        description = (
            f'Giá khoá trong {price_range_pct * 100:.2f}% trong khi CVD {direction} '
            f'{cvd_change_pct:.0f}% — dấu hiệu hấp thụ'
        )
    else:
        description = 'Không phát hiện hấp thụ'

    return {
        'detected':        detected,
        'strength':        round(strength, 2),
        'price_locked':    price_locked,
        'price_range_pct': round(price_range_pct * 100, 4),
        'cvd_change':      round(cvd_change, 2),
        'description':     description,
    }


# ═══════════════════════════════════════════════════════════════════════════
# 6. Iceberg clustering detection
# ═══════════════════════════════════════════════════════════════════════════

def detect_iceberg_clustering(
    df: pd.DataFrame,
    price_tolerance_pct: float = 0.05,
    min_repeat: int = 5,
    window_seconds: int = 300,
) -> dict:
    """
    Phát hiện lệnh iceberg: nhiều lệnh nhỏ lặp lại tại cùng mức giá.

    {detected, level, repeat_count, value_per_occurrence_avg, confidence}
    """
    _empty = {
        'detected':                False,
        'level':                   0.0,
        'repeat_count':            0,
        'value_per_occurrence_avg': 0.0,
        'confidence':              'none',
    }

    if df.empty or len(df) < min_repeat:
        return _empty

    # Lọc window_seconds gần nhất
    latest_ts = df['timestamp'].max()
    cutoff_ts = latest_ts - pd.Timedelta(seconds=window_seconds)
    recent    = df[df['timestamp'] >= cutoff_ts].copy()

    if len(recent) < min_repeat:
        return _empty

    # Bucket hoá theo giá với tolerance
    def _price_bucket(price: float) -> int:
        if price <= 0:
            return 0
        unit = max(price * price_tolerance_pct / 100, 0.01)
        return int(round(price / unit))

    recent['price_bucket'] = recent['price'].apply(_price_bucket)
    bucket_counts          = recent.groupby('price_bucket').size()
    if bucket_counts.empty:
        return _empty

    best_bucket = int(bucket_counts.idxmax())
    best_group  = recent[recent['price_bucket'] == best_bucket]
    repeat_count = int(len(best_group))

    if repeat_count < min_repeat:
        return _empty

    level     = float(best_group['price'].mean())
    avg_value = float(best_group['value'].mean())
    if repeat_count >= min_repeat * 4:
        confidence = 'high'
    elif repeat_count >= min_repeat * 2:
        confidence = 'medium'
    else:
        confidence = 'low'

    return {
        'detected':                True,
        'level':                   round(level, 2),
        'repeat_count':            repeat_count,
        'value_per_occurrence_avg': round(avg_value, 2),
        'confidence':              confidence,
    }


# ═══════════════════════════════════════════════════════════════════════════
# 7. Size distribution
# ═══════════════════════════════════════════════════════════════════════════

def compute_size_distribution(df: pd.DataFrame) -> dict:
    """
    Phân bổ kích thước lệnh: avg, median, p95, small/large ratio, histogram.
    """
    _empty = {
        'avg_value':    0.0,
        'median_value': 0.0,
        'p95_value':    0.0,
        'small_ratio':  0.0,
        'large_ratio':  0.0,
        'bucket_histogram': {'<50m': 0, '50-200m': 0, '200-500m': 0, '500m-2b': 0, '>2b': 0},
        'total_ticks':  0,
    }

    if df.empty:
        return _empty

    values = df['value'].dropna().astype(float)
    n = len(values)
    if n == 0:
        return _empty

    p95_idx     = min(int(math.ceil(0.95 * n)), n - 1)
    sorted_vals = sorted(values.tolist())

    return {
        'avg_value':    round(float(values.mean()),            2),
        'median_value': round(float(values.median()),          2),
        'p95_value':    round(float(sorted_vals[p95_idx]),     2),
        'small_ratio':  round(float((values < SMALL_ORDER_THRESHOLD).sum())  / n, 4),
        'large_ratio':  round(float((values >= LARGE_ORDER_THRESHOLD).sum()) / n, 4),
        'bucket_histogram': {
            '<50m':     int((values < 50_000_000).sum()),
            '50-200m':  int(((values >= 50_000_000)  & (values < 200_000_000)).sum()),
            '200-500m': int(((values >= 200_000_000) & (values < 500_000_000)).sum()),
            '500m-2b':  int(((values >= 500_000_000) & (values < 2_000_000_000)).sum()),
            '>2b':      int((values >= 2_000_000_000).sum()),
        },
        'total_ticks': n,
    }
