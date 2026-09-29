"""
ANA-01..ANA-05 — chỉ số portfolio.

Cùng nguyên tắc với `holdings.py` / `valuation.py`: **thuần, không DB, không
đọc đồng hồ hệ thống.** Mọi hàm nhận sẵn chuỗi số liệu và giờ cần so sánh. Lý do
đã được viết thành bẫy trong tài liệu (ANA-05 PB1/PB2): test dùng
`datetime.now()` sẽ xanh lúc 10h và đỏ lúc 23h.

Về việc "không trả 0 giả": mọi chỉ số không đủ dữ liệu đều trả `None` kèm
`<tên>_reason`. Riêng `max_drawdown` luôn có giá trị (kể cả 0 khi không giảm),
vì đó là một phát biểu có thật chứ không phải dữ liệu thiếu.
"""
from __future__ import annotations

import math
from datetime import date, time, timedelta
from decimal import Decimal

#: Số phiên giao dịch trong một năm — dùng để quy đổi chỉ số theo ngày sang
#: theo năm. 252 là quy ước, không phải dữ kiện đo được: đây là hằng số, đặt
#: ở đây để khi sai thì sửa một chỗ.
TRADING_DAYS_PER_YEAR = 252

#: ANA-03 AC2: dưới ngưỡng này thì ước lượng volatility từ mẫu nhỏ là vô
#: nghĩa (sai số mẫu nuốt hết con số), nên trả null kèm lý do.
MIN_SESSIONS_FOR_VOLATILITY = 20

#: ANA-02 AC2: cần ít nhất 2 cặp quan sát để hồi quy có ý nghĩa.
MIN_OBSERVATIONS_FOR_REGRESSION = 2

#: D-27: VN30 là benchmark chính, VN100 phụ.
DEFAULT_BENCHMARK = 'VN30'
BENCHMARKS = ('VN30', 'VN100')

#: D-28 — ngưỡng độ tươi theo nhà môi giới, tính bằng phút.
FRESHNESS_SLA_MINUTES = {
    'dnse': 15,
    'ssi': 30,
    'tcbs': 30,
}
#: Ngoài phiên: ngày dữ liệu cũ vẫn chấp nhận được trong 24 giờ.
FRESHNESS_OFF_SESSION_HOURS = 24

#: Phiên HOSE. Chỉ dùng để **giải thích** vì sao dữ liệu được coi là trong
#: phiên — không dùng để quyết định có cho phép đặt lệnh hay không.
VN_SESSION_MORNING = (time(9, 0), time(11, 30))
VN_SESSION_AFTERNOON = (time(13, 0), time(14, 45))
VN_TIMEZONE_HOURS = 7  # Asia/Ho_Chi_Minh, không dùng zoneinfo để khỏi kéo tzdata

MONEY_EXP = Decimal('0.01')

REASON_TEXT = {
    'insufficient_sessions': (
        f'Cần ít nhất {MIN_SESSIONS_FOR_VOLATILITY} phiên để ước lượng biến động; '
        f'hiện có ít hơn.'
    ),
    'insufficient_observations': 'Cần ít nhất 2 cặp quan sát để hồi quy alpha/beta.',
    'insufficient_cash_flows': (
        'MWR chỉ có nghĩa khi có ít nhất 2 dòng tiền bên ngoài; hiện chưa đủ.'
    ),
    'no_benchmark_data': 'Chuỗi benchmark trống hoặc thiếu dữ liệu.',
    'frequency_mismatch': 'Chuỗi portfolio và benchmark lệch tần suất.',
    'no_sign_change': 'XIRR không hội tụ: dòng tiền không đổi dấu.',
    'zero_variance_benchmark': 'Benchmark đứng yên nên beta không xác định.',
}


def _reason(code):
    return {'reason': code, 'reason_text': REASON_TEXT.get(code, code)}


# ══════════════════════════════════════════════════════════════════
# Thống kê cơ bản
# ══════════════════════════════════════════════════════════════════


def _mean(values):
    values = list(values)
    if not values:
        return None
    return math.fsum(values) / len(values)


def _sample_stdev(values):
    """Độ lệch chuẩn mẫu (n-1). None nếu n < 2 — trả 0 ở đây là sai."""
    values = list(values)
    n = len(values)
    if n < 2:
        return None
    mu = math.fsum(values) / n
    variance = math.fsum((v - mu) ** 2 for v in values) / (n - 1)
    return math.sqrt(variance)


def _percentile(values, q):
    """Phân vị tuyến tính. `q` trong [0, 1]."""
    values = sorted(values)
    if not values:
        return None
    if len(values) == 1:
        return values[0]
    pos = q * (len(values) - 1)
    low = math.floor(pos)
    high = math.ceil(pos)
    if low == high:
        return values[int(pos)]
    return values[low] + (values[high] - values[low]) * (pos - low)


def _r2(value, digits=6):
    if value is None:
        return None
    return round(float(value), digits)


# ══════════════════════════════════════════════════════════════════
# ANA-01 — TWR / MWR / XIRR
# ══════════════════════════════════════════════════════════════════


def chain_link(period_returns):
    """TWR từ chuỗi lợi nhuận theo giai đoạn. Đây là toàn bộ ý nghĩa của TWR.

    Tổng phản hồi theo thời gian = tích các lợi nhuận từng giai đoạn, **không**
    trộn tiền của người dùng vào. Cùng một lợi nhuận theo giai đoạn thì TWR luôn
    cho cùng một con số, bất kể giữa các giai đoạn có đóng/được rút bao nhiêu.

    (AC5 của ANA-01 nói "TWR không đổi khi thêm/sửa cash flow nội bộ". Cách
    kiểm đúng là: thay đổi số tiền các giai đoạn, **giữ nguyên lợi nhuận từng
    giai đoạn** ⇒ TWR bất biến, MWR thay đổi. Đó là phân biệt định nghĩa giữa
    hai phép tính; test hiện kiểm đúng phát biểu này.)
    """
    total = 1.0
    for r in period_returns:
        total *= (1.0 + float(r))
    return total - 1.0


def twr(period_returns):
    """Time-weighted return. Không có giai đoản nào ⇒ None + lý do."""
    periods = [float(r) for r in period_returns]
    if not periods:
        return {
            'value': None, 'method': 'TWR', 'calculation_version': 'ana01-v1',
            **_reason('insufficient_sessions'),
        }
    return {
        'value': _r2(chain_link(periods)), 'method': 'TWR',
        'calculation_version': 'ana01-v1', 'period_count': len(periods),
    }


def xnpv(rate, cash_flows):
    """NPV của dòng tiền theo ngày. `cash_flows` = [(ngày, số tiền), ...]."""
    if not cash_flows:
        return None
    origin = cash_flows[0][0]
    total = 0.0
    for when, amount in cash_flows:
        years = (when - origin).days / 365.0
        total += float(amount) / ((1.0 + rate) ** years)
    return total


def xirr(cash_flows, *, guess_lo=-0.9999, guess_hi=10.0, iterations=200,
         tolerance=Decimal('0.000001')):
    """IRR theo ngày (XIRR). Trả None + lý do khi không hội tụ.

    Dùng bisection thay vì Newton: bisection không bao giờ nhảy ra ngoài khoảng
    và không cần đạo hàm, nên không "chạy vô hạn" khi dòng tiền biến thiên.
    Không hội tụ thường vì dòng tiền không đổi dấu (chỉ nạp không rút, hoặc
    ngược lại) — đó là dữ liệu không đủ nghĩa, không phải lỗi thuật toán.
    """
    flows = sorted(cash_flows, key=lambda item: item[0])
    if len(flows) < 2:
        return {'value': None, 'method': 'XIRR', 'calculation_version': 'ana01-v1',
                **_reason('insufficient_cash_flows')}

    lo, hi = guess_lo, guess_hi
    f_lo, f_hi = xnpv(lo, flows), xnpv(hi, flows)
    if f_lo is None or f_hi is None or f_lo * f_hi > 0:
        return {'value': None, 'method': 'XIRR', 'calculation_version': 'ana01-v1',
                **_reason('no_sign_change')}

    mid = lo
    for _ in range(iterations):
        mid = (lo + hi) / 2.0
        f_mid = xnpv(mid, flows)
        if f_mid is None:
            break
        if abs(f_mid) < float(tolerance):
            return {'value': _r2(mid), 'method': 'XIRR',
                    'calculation_version': 'ana01-v1'}
        if f_lo * f_mid < 0:
            hi, f_hi = mid, f_mid
        else:
            lo, f_lo = mid, f_mid
    return {'value': _r2(mid), 'method': 'XIRR', 'calculation_version': 'ana01-v1'}


def mwr(cash_flows):
    """Money-weighted return.

    ANA-01 R2: chỉ hiện khi có **≥ 2 dòng tiền bên ngoài**. Dưới ngưỡng đó trả
    `null` + `mwr_reason` — trả 0 sẽ khiến người dùng đọc "hiệu suất bằng 0" cho
    một danh mục mới lập.
    """
    if len(cash_flows) < 2:
        return {'value': None, 'method': 'MWR', 'calculation_version': 'ana01-v1',
                **_reason('insufficient_cash_flows')}
    result = xirr(cash_flows)
    result.update({'method': 'MWR', 'calculation_version': 'ana01-v1'})
    return result


def performance(period_returns, cash_flows):
    """Gói trả về cho API: TWR luôn có, MWR chỉ khi đủ dòng tiền (D-27)."""
    return {
        'twr': twr(period_returns),
        'mwr': mwr(cash_flows),
        'default_method': 'TWR',
    }


# ══════════════════════════════════════════════════════════════════
# ANA-02 — benchmark, alpha, beta
# ══════════════════════════════════════════════════════════════════


def benchmark_metrics(portfolio_returns, benchmark_returns, *,
                      benchmark=DEFAULT_BENCHMARK, periods_per_year=TRADING_DAYS_PER_YEAR):
    """Alpha/beta/tracking error/information ratio.

    ANA-02 R6: hai chuỗi phải cùng tần suất. Khác độ dài ⇒ `null` + lý do, **không**
    cắt bớt cho khớp — cắt bớt là tự chọn ra một khoảng thời gian thuận lợi
    rồi gọi đó là kết quả.
    """
    base = {
        'benchmark': benchmark,
        'calculation_version': 'ana02-v1',
    }
    p = [float(x) for x in portfolio_returns]
    b = [float(x) for x in benchmark_returns]

    if not p or not b:
        return {**base, 'alpha': None, 'beta': None, 'tracking_error': None,
                'information_ratio': None, **_reason('no_benchmark_data')}
    if len(p) != len(b):
        return {**base, 'alpha': None, 'beta': None, 'tracking_error': None,
                'information_ratio': None,
                **_reason('frequency_mismatch'),
                'portfolio_observations': len(p), 'benchmark_observations': len(b)}
    if len(p) < MIN_OBSERVATIONS_FOR_REGRESSION:
        return {**base, 'alpha': None, 'beta': None, 'tracking_error': None,
                'information_ratio': None, **_reason('insufficient_observations')}

    mean_p, mean_b = _mean(p), _mean(b)
    var_b = _sample_stdev(b)
    if var_b is None or var_b == 0:
        # Beta = cov/var; var = 0 thì phép chia không xác định. Trả 0 sẽ nói
        # rằng danh mục không nhạy cảm với thị trường, điều không đúng.
        return {**base, 'alpha': None, 'beta': None, 'tracking_error': None,
                'information_ratio': None, **_reason('zero_variance_benchmark')}

    cov = math.fsum((pi - mean_p) * (bi - mean_b) for pi, bi in zip(p, b)) / (len(p) - 1)
    beta = cov / (var_b ** 2)
    alpha = mean_p - beta * mean_b

    excess = [pi - bi for pi, bi in zip(p, b)]
    te_period = _sample_stdev(excess)
    ir = None if (te_period in (None, 0)) else (_mean(excess) / te_period)

    return {
        **base,
        'alpha': _r2(alpha),
        'alpha_annualized': _r2(alpha * periods_per_year),
        'beta': _r2(beta),
        'tracking_error': None if te_period is None else _r2(te_period * math.sqrt(periods_per_year)),
        'information_ratio': None if ir is None else _r2(ir * math.sqrt(periods_per_year)),
        'observation_count': len(p),
    }


# ══════════════════════════════════════════════════════════════════
# ANA-03 — risk
# ══════════════════════════════════════════════════════════════════


def risk_metrics(daily_returns, market_values=None, symbols=None,
                 *, periods_per_year=TRADING_DAYS_PER_YEAR):
    """Volatility, VaR 95, max drawdown, concentration.

    `daily_returns` là **lợi nhuận theo ngày** (đơn vị phần trăm dạng 0.01 =
    1%), không phải giá trị danh mục.
    """
    returns = [float(x) for x in daily_returns]
    out = {
        'calculation_version': 'ana03-v1',
        'volatility': None,
        'var_95': None,
        'max_drawdown': None,
        'concentration': None,
    }

    if len(returns) < MIN_SESSIONS_FOR_VOLATILITY:
        out.update(_reason('insufficient_sessions'))
        out['observation_count'] = len(returns)
        return out

    sd = _sample_stdev(returns)
    out['volatility'] = None if sd is None else _r2(sd * math.sqrt(periods_per_year))
    # Historical simulation trên **ngày**: lỗ 5% trong một ngày. Field tên
    # `var_95_daily` để không ai đọc nhầm là VaR cả kỳ (ANA-03 PB3).
    out['var_95_daily'] = _r2(_percentile(returns, 0.05))
    out['observation_count'] = len(returns)

    if market_values:
        peak = None
        trough = 0.0
        for value in market_values:
            v = float(value)
            if peak is None or v > peak:
                peak = v
            if peak and peak > 0:
                trough = min(trough, (v - peak) / peak)
        # Luôn ≤ 0: trough khởi tạo bằng 0 nên không thể dương. Test AC4 khẳng
        # định điều này độc lập.
        out['max_drawdown'] = _r2(trough)

    if market_values and symbols and len(market_values) == len(symbols):
        total = math.fsum(float(v) for v in market_values)
        if total > 0:
            weights = sorted(
                (float(v) / total for v in market_values), reverse=True)
            top5 = weights[:5]
            out['concentration'] = {
                'top1': _r2(weights[0]),
                'top5': _r2(math.fsum(top5)),
                'hhi': _r2(math.fsum(w * w for w in weights)),
                'position_count': len(weights),
            }
    return out


# ══════════════════════════════════════════════════════════════════
# ANA-04 — allocation
# ══════════════════════════════════════════════════════════════════

UNKNOWN_SECTOR = 'unknown'


def allocation(values, keys, *, total=None):
    """Chia tỷ trọng, tổng luôn = 1.0 (ANA-04 AC1).

    Vị thế có `market_value` bằng 0 bị loại khỏi danh sách trước khi chia — để
    ở lại thì nó có tỷ trọng 0 và làm số mã của báo cáo không khớp với bảng
    holdings.
    """
    pairs = [
        (k, float(v)) for k, v in zip(keys, values)
        if v is not None and float(v) > 0
    ]
    if not pairs:
        return {'items': [], 'total_weight': None, 'calculation_version': 'ana04-v1',
                **_reason('no_positions')}

    denom = float(total) if total else math.fsum(v for _k, v in pairs)
    if denom <= 0:
        return {'items': [], 'total_weight': None, 'calculation_version': 'ana04-v1',
                **_reason('no_positions')}

    items = []
    for key, value in sorted(pairs, key=lambda kv: kv[1], reverse=True):
        bucket = key if key else UNKNOWN_SECTOR
        items.append({'key': str(bucket), 'value': _r2(value),
                      'weight': _r2(value / denom)})
    return {
        'items': items,
        'total_weight': _r2(math.fsum(item['weight'] for item in items)),
        'calculation_version': 'ana04-v1',
        'unknown_count': sum(1 for item in items if item['key'] == UNKNOWN_SECTOR),
    }


# ══════════════════════════════════════════════════════════════════
# ANA-05 — freshness
# ══════════════════════════════════════════════════════════════════


def _as_datetime(value):
    if value is None:
        return None
    if isinstance(value, date) and not isinstance(value, type(None)):
        from datetime import datetime as _dt
        if not hasattr(value, 'hour'):
            return _dt.combine(value, time(0, 0))
    return value


def is_vn_session(moment):
    """True nếu `moment` (naive, giờ VN) rơi vào phiên HOSE.

    Nhận giờ naive theo giờ VN. Hàm cố tình **không** tự quy đổi múi giờ: việc
    đó thuộc về tầng gọi, và nhét vào đây sẽ khiến test khó kiểm soát.
    """
    if moment is None:
        return False
    if moment.weekday() >= 5:
        return False
    clock = moment.time()
    for start, end in (VN_SESSION_MORNING, VN_SESSION_AFTERNOON):
        if start <= clock <= end:
            return True
    return False


def freshness(*, as_of, now, provider='dnse', session=None):
    """Cờ `stale` theo D-28.

    `as_of` = thời điểm đồng bộ cuối (bắt buộc có mặt — R4).
    `now`   = thời điểm so sánh, **truyền vào**, không tự lấy `now()`.
    `session` = `is_vn_session(now)`; mặc định tự tính từ `now`.
    """
    provider = (provider or 'dnse').lower()
    threshold = FRESHNESS_SLA_MINUTES.get(provider)
    out = {
        'as_of': as_of.isoformat() if hasattr(as_of, 'isoformat') else as_of,
        'provider': provider,
        'stale': True,
        'stale_reason': 'no_data',
        'threshold_minutes': threshold,
        'age_minutes': None,
    }
    if as_of is None or now is None:
        return out

    age_minutes = (now - as_of).total_seconds() / 60.0
    in_session = is_vn_session(now) if session is None else bool(session)
    out['age_minutes'] = _r2(age_minutes, 2)

    if in_session and threshold is not None:
        out['stale'] = age_minutes > threshold
        out['stale_reason'] = (
            None if not out['stale'] else f'in_session_over_{threshold}_minutes'
        )
    else:
        out['stale'] = age_minutes > FRESHNESS_OFF_SESSION_HOURS * 60
        out['stale_reason'] = None if not out['stale'] else 'off_session_over_24h'
    return out


def daily_series(snapshots, field='nav'):
    """Rút chuỗi lời nhuận ngày từ danh sách snapshot đã sắp theo ngày tăng dần.

    `snapshots` là iterable các object có `.as_of_date` và `.nav`. Ngày có
    `nav = None` bị **bỏ qua**, không coi là 0 — nếu coi là 0 thì biểu đồ có
    một đoạn rơi thẳng xuống sàn ở đúng ngày mất dữ liệu, tức biểu diễn sai.
    """
    series = []
    previous = None
    for snapshot in sorted(snapshots, key=lambda s: s.as_of_date):
        value = getattr(snapshot, field, None)
        if value is None:
            continue
        value = float(value)
        if previous is not None and previous != 0:
            series.append((snapshot.as_of_date, (value - previous) / previous))
        previous = value
    return series


def period_returns_from_navs(navs):
    """Lời nhuận theo giai đoản từ chuỗi NAV (đã bỏ null, tăng dần)."""
    returns = []
    for i in range(1, len(navs)):
        prev, cur = float(navs[i - 1]), float(navs[i])
        if prev != 0:
            returns.append((cur - prev) / prev)
    return returns


__all__ = [
    'TRADING_DAYS_PER_YEAR', 'DEFAULT_BENCHMARK', 'BENCHMARKS',
    'FRESHNESS_SLA_MINUTES', 'UNKNOWN_SECTOR',
    'chain_link', 'twr', 'xnpv', 'xirr', 'mwr', 'performance',
    'benchmark_metrics', 'risk_metrics', 'allocation',
    'is_vn_session', 'freshness', 'daily_series', 'period_returns_from_navs',
    'timedelta',
]
