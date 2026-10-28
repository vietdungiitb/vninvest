"""
PA-2 — sổ cái tối thiểu cho danh mục (P0-DATA-03 + P1-DATA-03).

Tách khỏi `portfolio_analytics_views.py` vì file đó >2500 dòng và đang chứa
code AI Advisory/Screener chạy production.

- `holdings.py` — thuật toán thuần (không DB, không DRF) để golden fixture
  test được không cần database.
- `services.py` — lấy transaction từ DB, cache theo
  `tenant + portfolio + fingerprint`, dựng `meta` provenance.
- `valuation.py` — LED-03: NAV = stock_value + cash − debt.
- `validators.py` — LED-04: lỗi có `field` + cảnh báo có cấu trúc, KHÔNG clamp.
- `analytics.py` — ANA-01..05: TWR/MWR, alpha/beta, risk, allocation, freshness.

Mọi module ở trên đều thuần: không đọc đồng hồ hệ thống, không tự truy vấn DB.
Thời gian và dữ liệu luôn được truyền vào để test deterministic.
"""

from .analytics import (
    BENCHMARKS,
    DEFAULT_BENCHMARK,
    FRESHNESS_SLA_MINUTES,
    MIN_SESSIONS_FOR_VOLATILITY,
    TRADING_DAYS_PER_YEAR,
    UNKNOWN_SECTOR,
    allocation,
    benchmark_metrics,
    chain_link,
    daily_series,
    freshness,
    is_vn_session,
    mwr,
    performance,
    period_returns_from_navs,
    risk_metrics,
    twr,
    xirr,
    xnpv,
)
from .holdings import (
    CALCULATION_VERSION,
    MONEY_EXP,
    MONEY_ROUNDING,
    STALE_AFTER_DAYS,
    compute_ledger,
    money,
)
from .services import (
    LEDGER_CACHE_PREFIX,
    LEDGER_CACHE_TTL_SECONDS,
    NAV_BLOCKER_CASH_FLOWS_EMPTY,
    NAV_BLOCKER_NO_PRICES,
    NAV_BLOCKER_PARTIAL_PRICES,
    build_meta,
    get_cached_ledger,
    get_holdings_for_portfolio,
    holdings_from_ledger,
    invalidate_ledger_cache,
    portfolio_valuation,
)
from .validators import (
    VN_SPOT_LOT_SIZE,
    validate_entry,
)
from .valuation import (
    CALCULATION_VERSION as VALUATION_CALCULATION_VERSION,
)
from .valuation import (
    NAV_REASON_NO_OPENING_BALANCE,
    NAV_REASON_TEXT,
    compute_nav,
    sum_cash_flows,
)

__all__ = [
    'BENCHMARKS',
    'CALCULATION_VERSION',
    'DEFAULT_BENCHMARK',
    'FRESHNESS_SLA_MINUTES',
    'LEDGER_CACHE_PREFIX',
    'LEDGER_CACHE_TTL_SECONDS',
    'MIN_SESSIONS_FOR_VOLATILITY',
    'MONEY_EXP',
    'MONEY_ROUNDING',
    'NAV_BLOCKER_CASH_FLOWS_EMPTY',
    'NAV_BLOCKER_NO_PRICES',
    'NAV_BLOCKER_PARTIAL_PRICES',
    'NAV_REASON_NO_OPENING_BALANCE',
    'NAV_REASON_TEXT',
    'STALE_AFTER_DAYS',
    'TRADING_DAYS_PER_YEAR',
    'UNKNOWN_SECTOR',
    'VALUATION_CALCULATION_VERSION',
    'VN_SPOT_LOT_SIZE',
    'allocation',
    'benchmark_metrics',
    'build_meta',
    'chain_link',
    'compute_ledger',
    'compute_nav',
    'daily_series',
    'freshness',
    'get_cached_ledger',
    'get_holdings_for_portfolio',
    'holdings_from_ledger',
    'invalidate_ledger_cache',
    'is_vn_session',
    'money',
    'mwr',
    'performance',
    'period_returns_from_navs',
    'portfolio_valuation',
    'risk_metrics',
    'sum_cash_flows',
    'twr',
    'validate_entry',
    'xirr',
    'xnpv',
]
