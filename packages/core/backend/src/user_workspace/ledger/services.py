"""
PA-2 / P1-DATA-03 — lớp DB + cache + provenance cho sổ cái.

Vai trò:
1. Đọc `Transaction` của một portfolio theo thứ tự `(date, pk)`.
2. Cache theo `tenant + portfolio + fingerprint` (P1-DATA-03 đề xuất
   `tenant+portfolio+as_of`; xem `CACHE_KEY_NOTE` vì sao phải thêm fingerprint).
3. Trả kèm `meta` provenance (as_of / source / stale / calculation_version)
   theo audit §H3.

Cố tình không thêm model/migration: `Portfolio` không có trường số dư mở đầu
nên `cash` chỉ là dòng tiền gom từ transaction (xem `CASH_BASIS_NOTE`).
"""

from datetime import date as date_cls
from decimal import Decimal

from django.core.cache import cache
from django.db.models import Count, Max

from user_workspace.models import Transaction

from .holdings import CALCULATION_VERSION, compute_ledger, money

LEDGER_CACHE_PREFIX = f'ledger:{CALCULATION_VERSION}'
LEDGER_CACHE_TTL_SECONDS = 60

# P1-DATA-03 gợi ý cache theo `tenant+portfolio+as_of`. `as_of` một mình KHÔNG
# đủ: sửa/xoá một giao dịch CŨ không đổi `as_of` (ngày giao dịch mới nhất)
# nhưng lại đổi kết quả tính ⇒ cache sẽ trả số sai. Vì vậy key còn mang
# fingerprint = (số giao dịch, max updated_at, max pk). TTL 60 s chỉ để bound
# độ trễ, không phải cơ chế đúng đắn.
CACHE_KEY_NOTE = (
    'cache key = tenant + portfolio + (transaction_count, max updated_at, max pk). '
    'as_of đơn thuần không đủ vì sửa giao dịch cũ không đổi as_of nhưng vẫn đổi kết quả.'
)

# `Transaction.Meta.ordering` là `-date, -pk`; sổ cái cần chiều tăng dần.
LEDGER_ORDERING = ('date', 'pk')


def _queryset(portfolio_id):
    return (
        Transaction.objects
        .filter(portfolio_id=portfolio_id)
        .order_by(*LEDGER_ORDERING)
    )


def _fingerprint(qs):
    """(count, max updated_at, max pk) — đủ để phát hiện mọi thay đổi lịch sử."""
    aggregate = qs.aggregate(
        count=Count('pk'),
        max_updated_at=Max('updated_at'),
        max_pk=Max('pk'),
    )
    return (
        aggregate['count'],
        aggregate['max_updated_at'].isoformat() if aggregate['max_updated_at'] else None,
        aggregate['max_pk'],
    )


def _cache_key(tenant_public_id, portfolio_id, fingerprint):
    tenant_part = tenant_public_id or 'no-tenant'
    return ':'.join([
        LEDGER_CACHE_PREFIX,
        str(tenant_part),
        str(portfolio_id),
        f'n{fingerprint[0]}',
        f'u{fingerprint[1] or "none"}',
        f'p{fingerprint[2] or 0}',
    ])


def invalidate_ledger_cache(portfolio_id, tenant_public_id=None):
    """Bump bộ đếm của một portfolio.

    GHI RÕ ĐIỀU MÀ DOCSTRING CŨ GHI SAI: bộ đếm này **không** nằm trong
    `_cache_key`. Cache tự đúng nhờ fingerprint `(count, max updated_at, max
    pk)` nên sửa bất kỳ giao dịch nào cũng làm key cũ không còn trúng — hàm
    này không phải cơ chế đúng của việc vô hiệu hoá cache.

    Giữ lại vì `ledger/__init__.py` export nó như API công khai. Sửa docstring
    thay vì xoá để không phá import; nếu sau này thêm counter vào key thì phải
    đổi `LEDGER_CACHE_PREFIX` để cache cũ không bị đọc lại.
    """
    bump_key = ':'.join([
        LEDGER_CACHE_PREFIX,
        'bump',
        str(tenant_public_id or 'no-tenant'),
        str(portfolio_id),
    ])
    try:
        return cache.incr(bump_key)
    except ValueError:
        cache.set(bump_key, 1, None)
        return 1


def _serialize(ledger):
    """Decimal → str để cache đọc lại được và không phụ thuộc pickle."""
    return {
        'calculation_version': ledger['calculation_version'],
        'cash': str(ledger['cash']),
        'cash_complete': ledger['cash_complete'],
        'cash_note': ledger['cash_note'],
        'realized_pnl': str(ledger['realized_pnl']),
        'unrealized_pnl': ledger['unrealized_pnl'],
        'unrealized_pnl_reason': ledger['unrealized_pnl_reason'],
        'nav': ledger['nav'],
        'nav_reason': ledger['nav_reason'],
        'dividend_income': str(ledger['dividend_income']),
        'fees_paid': str(ledger['fees_paid']),
        'taxes_paid': str(ledger['taxes_paid']),
        'transaction_count': ledger['transaction_count'],
        'warnings': ledger['warnings'],
        'reconciliation_required': ledger['reconciliation_required'],
        'realized_by_symbol': {k: str(v) for k, v in ledger['realized_by_symbol'].items()},
        'holdings': {
            symbol: {
                'quantity': str(position['quantity']),
                'avg_cost': str(position['avg_cost']),
                'total_cost': str(position['total_cost']),
                'realized_pnl': str(position['realized_pnl']),
                'buy_quantity': str(position['buy_quantity']),
                'sell_quantity': str(position['sell_quantity']),
                'dividend_cash': str(position['dividend_cash']),
                'fees': str(position['fees']),
                'taxes': str(position['taxes']),
            }
            for symbol, position in ledger['holdings'].items()
        },
        'meta': {
            **ledger['meta'],
            'as_of': ledger['meta']['as_of'].isoformat() if ledger['meta']['as_of'] else None,
        },
    }


def _deserialize(payload):
    def d(value):
        return Decimal(value) if value is not None else None

    return {
        **payload,
        'cash': d(payload['cash']),
        'realized_pnl': d(payload['realized_pnl']),
        'dividend_income': d(payload['dividend_income']),
        'fees_paid': d(payload['fees_paid']),
        'taxes_paid': d(payload['taxes_paid']),
        'realized_by_symbol': {k: d(v) for k, v in payload['realized_by_symbol'].items()},
        'holdings': {
            symbol: {k: d(v) for k, v in position.items()}
            for symbol, position in payload['holdings'].items()
        },
        # `_serialize` luu `as_of` thanh chuoi ISO de JSON-safe. Phai khoi phuc
        # ve `date` o day, nguoc lai voi moi field `Decimal` ben tren — neu
        # khong, `build_meta` go `.isoformat()` tren `str` => AttributeError =>
        # HTTP 500 tren moi duong CACHE-HIT (chi request tinh tay moi duoc).
        'meta': {
            **payload['meta'],
            'as_of': (
                date_cls.fromisoformat(payload['meta']['as_of'])
                if payload['meta'].get('as_of') else None
            ),
        },
    }


def get_cached_ledger(portfolio_id, tenant=None, *, use_cache=True, today=None):
    """Sổ cái của một portfolio, có cache + provenance.

    `tenant` là `CoreTenant` (thường là `request.tenant`) hoặc `None`. Không
    dùng tenant để lọc transaction — việc scope do
    `portfolio_analytics_views._get_user_portfolio()` lo (P0-ISO-01). Ở đây
    tenant chỉ đi vào cache key để hai tenant không bao giờ dùng nhầm cache.

    TEN-06: `tenant=None` now raises unless caching is explicitly bypassed.
    Previously it fell through to the literal `no-tenant` segment, so two
    different un-scoped callers shared one cache entry. That was latent — every
    production call site passed `portfolio.tenant` — but it meant a single new
    call site that forgot the argument would silently serve another request's
    ledger. Failing closed makes that mistake loud instead of quiet.
    """
    tenant_public_id = getattr(tenant, 'public_id', None)
    if not tenant_public_id and use_cache:
        raise ValueError(
            'get_cached_ledger() requires a tenant with a public_id when '
            'use_cache=True; refusing to read/write the shared "no-tenant" '
            'cache namespace. Pass use_cache=False if the caller has already '
            'scoped the data by other means.'
        )
    qs = _queryset(portfolio_id)
    fingerprint = _fingerprint(qs)
    bump_key = f'{LEDGER_CACHE_PREFIX}:bump:{portfolio_id}'
    key = _cache_key(tenant_public_id, portfolio_id, fingerprint)
    try:
        bump = cache.get(bump_key) or 0
    except Exception:
        bump = 0
    if bump:
        key = f'{key}:b{bump}'

    if use_cache:
        cached = cache.get(key)
        if cached is not None:
            ledger = _deserialize(cached)
            # LED-07 R5: `meta` phải ĐỦ, kể cả khi cache hit — nếu không,
            # consumer phải viết `if 'meta' in ledger` và một lần refactor nào
            # đó sẽ làm mất `cache_hit`, tức mất khả năng đối chiếu.
            ledger['meta']['from_cache'] = True
            ledger['meta']['cache_hit'] = True
            ledger['meta']['cache_key_note'] = CACHE_KEY_NOTE
            return ledger

    ledger = compute_ledger(
        qs,
        today=today or date_cls.today(),
        tenant_public_id=str(tenant_public_id) if tenant_public_id else None,
        portfolio_id=portfolio_id,
    )
    if use_cache:
        try:
            cache.set(key, _serialize(ledger), LEDGER_CACHE_TTL_SECONDS)
        except Exception:
            # Cache hỏng không được làm hỏng response — số liệu vẫn đúng.
            pass
    ledger['meta']['from_cache'] = False
    ledger['meta']['cache_hit'] = False
    ledger['meta']['cache_key_note'] = CACHE_KEY_NOTE
    return ledger


# ══════════════════════════════════════════════════════════════════
# LED-07 — `meta` provenance + NAV (LED-03) gắn vào sổ cái
# ══════════════════════════════════════════════════════════════════


class _FlowView:
    """Bọc `CashFlow.amount` đúng kiểu mà `sum_cash_flows` cần."""

    __slots__ = ('amount',)

    def __init__(self, amount):
        self.amount = amount


#: Lý do NAV chưa có, ngoài `no_opening_balance` của `valuation.py`.
#:
#: Cả hai đều là trạng thái **dữ liệu**, không phải lỗi code: ledger engine đã
#: sẵn sàng nhưng bảng `CashFlow` còn rỗng cho tới khi LED-05 backfill
#: `Transaction` → `LedgerEntry` + `CashFlow`. Trả 0 trong lúc đó sẽ ra một NAV
#: nhìn rất thuyết phục và hoàn toàn sai.
NAV_BLOCKER_CASH_FLOWS_EMPTY = 'cash_flows_not_backfilled'
NAV_BLOCKER_NO_PRICES = 'no_market_prices'


def portfolio_valuation(portfolio, *, ledger=None, price_by_symbol=None):
    """NAV của một portfolio theo LED-03. Trả dict, không raise, không query giá.

    Tham số:
    - `portfolio`: model `Portfolio` (dùng `opening_balance`).
    - `ledger`: kết quả `get_cached_ledger()`. Nếu không truyền thì gọi
      `compute_ledger` không cache — dành cho caller đã có sẵn.
    - `price_by_symbol`: `{symbol: price}`. Thiếu mã nào thì mã đó **không**
      được đưa vào `stock_value`; nếu không có giá nào thì NAV = null + lý do,
      vì "giá trị 0" không phải câu trả lời.
    """
    from .valuation import compute_nav, sum_cash_flows

    if ledger is None:
        ledger = compute_ledger(
            _queryset(portfolio.pk),
            tenant_public_id=getattr(portfolio.tenant, 'public_id', None),
            portfolio_id=portfolio.pk,
        )

    prices = price_by_symbol or {}
    priced = []
    unpriced = []
    for symbol, position in sorted(ledger['holdings'].items()):
        price = prices.get(symbol)
        if price is None:
            unpriced.append(symbol)
            continue
        priced.append((symbol, position, price))

    if ledger['holdings'] and not priced:
        return {
            **compute_nav(
                stock_value=0, cash_flow_total=0, opening_balance=None,
            ),
            'nav_reason': NAV_BLOCKER_NO_PRICES,
            'nav_reason_text': (
                'Chưa có giá market cho bất kỳ mã nào đang giữ '
                f'({len(ledger["holdings"])} mã) nên chưa định giá được.'
            ),
            'unpriced_symbols': sorted(ledger['holdings']),
            'calculation_version': ledger.get('calculation_version'),
        }

    stock_value = sum(
        (position['quantity'] * price for _s, position, price in priced),
        Decimal('0'),
    )

    from user_workspace.models import CashFlow

    cash_flow_total = sum_cash_flows(
        _FlowView(flow.amount)
        for flow in CashFlow.objects.filter(
            entry__portfolio=portfolio,
        ).values_list('amount', flat=True)
    )

    if ledger['transaction_count'] and cash_flow_total == 0:
        # Có giao dịch nhưng không có dòng tiền nào ⇒ backfill LED-05 chưa chạy.
        # `cash` từ sổ cái là tổng dòng tiền kể từ khi hệ thống bắt đầu ghi,
        # khác số dư tài khoản thật; cộng nó vào NAV sẽ ra con số bịa.
        return {
            'nav': None,
            'nav_reason': NAV_BLOCKER_CASH_FLOWS_EMPTY,
            'nav_reason_text': (
                'Bảng CashFlow còn rỗng cho danh mục này (migration LED-05 chưa '
                'backfill). Chưa thể suy ra số dư tiền mặt thật từ sổ cái.'
            ),
            'cash': None,
            'cash_complete': False,
            'stock_value': money(stock_value),
            'unpriced_symbols': sorted(unpriced),
            'opening_balance': portfolio.opening_balance,
            'calculation_version': ledger.get('calculation_version'),
        }

    result = compute_nav(
        stock_value=stock_value,
        cash_flow_total=cash_flow_total,
        opening_balance=portfolio.opening_balance,
    )
    result['unpriced_symbols'] = sorted(unpriced)
    return result


def holdings_from_ledger(ledger):
    """Shape cũ mà 8 view analytics đang đọc: đúng 3 key, position đang mở."""
    return {
        symbol: {
            'quantity': int(position['quantity']),
            'avg_cost': position['avg_cost'],
            'total_cost': position['total_cost'],
        }
        for symbol, position in ledger['holdings'].items()
    }


def get_holdings_for_portfolio(portfolio_id, tenant=None, *, use_cache=True, today=None):
    """Wrapper tương thích shape cũ của `_compute_holdings`.

    Chỉ trả position đang mở với đúng 3 key mà 8 view analytics đang đọc
    (`quantity`, `avg_cost`, `total_cost`) — không thêm key để không phá vỡ
    chỗ gọi cũ.
    """
    ledger = get_cached_ledger(
        portfolio_id, tenant, use_cache=use_cache, today=today,
    )
    return holdings_from_ledger(ledger)


def build_meta(ledger):
    """`meta` provenance theo audit §H3, JSON-safe."""
    meta = dict(ledger['meta'])
    as_of = meta.get('as_of')
    # `as_of` la `date` khi moi tinh va tren duong cache-hit (xem
    # `_deserialize`). Nhan `str` de an toan khi gap cache entry do ban
    # `_serialize` cu hon ghi vao — serializer nay khong bao gio duoc nem 500.
    if isinstance(as_of, date_cls):
        as_of_iso = as_of.isoformat()
    elif isinstance(as_of, str):
        as_of_iso = as_of
    else:
        as_of_iso = None
    return {
        'tenant_id': meta.get('tenant_id'),
        'portfolio_id': meta.get('portfolio_id'),
        'as_of': as_of_iso,
        'as_of_precision': 'date' if as_of_iso is not None else None,
        'as_of_reason': meta.get('as_of_reason'),
        'source': meta.get('source'),
        'stale': meta.get('stale'),
        'stale_reason': meta.get('stale_reason'),
        'calculation_version': meta.get('calculation_version'),
        'cost_method': meta.get('cost_method'),
        'transaction_count': meta.get('transaction_count'),
        'from_cache': meta.get('from_cache'),
        # LED-07 R1 đòi tên `cache_hit`; `from_cache` là tên cũ. Giữ cả hai
        # trong một release để không phá consumer cũ, ghi chú ở đây để người
        # đọc biết chỉ có một cái là thật.
        'cache_hit': meta.get('cache_hit'),
        'cache_key_note': CACHE_KEY_NOTE,
    }
