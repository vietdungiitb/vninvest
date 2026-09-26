"""
PA-2 — sổ cái tối thiểu cho danh mục (P0-DATA-03 + P1-DATA-03).

Tách khỏi `portfolio_analytics_views.py` vì file đó >2500 dòng và đang chứa
code AI Advisory/Screener chạy production.

- `holdings.py` — thuật toán thuần (không DB, không DRF) để golden fixture
  test được không cần database.
- `services.py` — lấy transaction từ DB, cache theo
  `tenant + portfolio + fingerprint`, dựng `meta` provenance.

Không tạo migration, không đụng `models.py` (ngoài phạm vi agent này).
"""

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
    build_meta,
    get_cached_ledger,
    get_holdings_for_portfolio,
    holdings_from_ledger,
    invalidate_ledger_cache,
)

__all__ = [
    'CALCULATION_VERSION',
    'LEDGER_CACHE_PREFIX',
    'LEDGER_CACHE_TTL_SECONDS',
    'MONEY_EXP',
    'MONEY_ROUNDING',
    'STALE_AFTER_DAYS',
    'build_meta',
    'compute_ledger',
    'get_cached_ledger',
    'get_holdings_for_portfolio',
    'holdings_from_ledger',
    'invalidate_ledger_cache',
    'money',
]
