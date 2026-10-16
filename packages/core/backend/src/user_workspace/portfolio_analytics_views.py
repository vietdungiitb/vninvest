"""
C4 — Native portfolio analytics views for user_workspace domain.

Replaces PortfolioAnalyticsStubView and PortfolioListAnalyticsStubView
with real computed data from Transaction + SymbolSnapshot + DailyPrice.

All views require IsAuthenticated and are scoped to (request.user, request.tenant).
Holdings come from `user_workspace.ledger` (weighted average, D-06) and are
cached per tenant+portfolio+transaction fingerprint.
"""
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.openapi import OpenApiParameter, OpenApiTypes
from drf_spectacular.utils import OpenApiExample, extend_schema
# P1-5: `status` phai co o module scope. Hai dong trong
# `PortfolioScreenerRuleDetailView.put` dung `status.HTTP_400_BAD_REQUEST`
# nhung chi co `permissions` duoc import o day; `status` chi duoc import
# BEN TRONG ham `delete` (alias `http_status`) nen o scope module khong
# ton tai => `NameError` => HTTP 500 thay vi 400 khi payload PUT sai.
from rest_framework import permissions, status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.throttling import BaseThrottle
from rest_framework.views import APIView

from .endpoint_safety import UnsafeEndpointError, assert_safe_outbound_url
from .permissions import WorkspacePermission
from .ledger import (
    build_meta,
    get_cached_ledger,
    holdings_from_ledger,
    money,
    portfolio_valuation,
)
from .models import Portfolio, Transaction
from .envelope import adopt_envelope, envelope, inner_payload, paginated_envelope
from vninvest_core.api_envelope import envelope_response


class AIEndpointProbeThrottle(BaseThrottle):
    """    Dedicated bucket for the AI test-connection probe.

    R0.6 (plan Rev.2 AC7): scope `ai_test_connection`, 20 probes/hour/user.
    The global UserRateThrottle allows 1000/hour, which is not a mitigation
    for a view that makes an outbound HTTP request to a user-supplied
    address — it is an amplification budget. This caps probes per user per
    hour instead, so the SSRF guard is not the only thing standing between
    an authenticated account and the internal network.

    This throttle DOES run under the test suite. `DEFAULT_THROTTLE_CLASSES` is
    emptied when TESTING is true, but a view that names `throttle_classes`
    explicitly keeps its own class regardless.
    """

    scope = 'ai_test_connection'
    rate = 20          # requests
    window = 3600      # seconds (1 hour)

    def get_cache_key(self, request, view):
        user = getattr(request, 'user', None)
        ident = getattr(user, 'pk', None) or getattr(user, 'username', None) or 'anon'
        return f'throttle_ai_test_connection:{ident}'

    def allow_request(self, request, view):
        from django.core.cache import cache

        now = _monotonic()
        key = self.get_cache_key(request, view)
        self.history = [ts for ts in cache.get(key, []) if ts > now - self.window]
        if len(self.history) >= self.rate:
            # R0.6 AC7 (bug that that): DRF `check_throttles` throttle khi va chi khi
            # `allow_request` tra ve False-y. Ban cu `return self.throttled()` tra ve
            # mot instance `Throttled` (truthy) nen throttle KHONG BAO GIO kich hoat.
            return False
        self.history.append(now)
        cache.set(key, self.history, self.window + 5)
        # BaseThrottle.allow_request raises NotImplementedError; a concrete
        # throttle must return True here rather than delegating upwards.
        return True

    def wait(self):
        # DRF goi `wait()` de dien `Retry-After` khi `allow_request` tra False.
        oldest = min(self.history) if self.history else _monotonic()
        return max(1, int(self.window - (_monotonic() - oldest)))


def _monotonic() -> float:
    import time as _time

    return _time.monotonic()


def _get_user_portfolio(request, portfolio_id):
    """
    Lấy portfolio thuộc đúng `(user, tenant)` của request, nếu không thì 404.

    P0-ISO-01: trước đây chỉ lọc `pk` + `user`, nên user đa tenant đọc được
    holdings/NAV của portfolio thuộc tenant khác chỉ cần biết id.

    - `request.tenant` do `TenantResolutionMiddleware` gán sẵn
      (`identity_access/middleware.py:112`). Không tạo resolver mới ở đây —
      `tenantreg-b` đang hợp nhất 4 resolver, thêm cái thứ 5 sẽ phá việc đó.
    - `request.tenant is None` ⇒ fail-closed 404, KHÔNG fallback về lọc
      `user` (fallback đó chính là lỗ hổng).
    - Trả 404 chứ không 403 để không tạo oracle "id này tồn tại ở tenant khác".
    - Row legacy `tenant IS NULL` không khớp tenant nào ⇒ 404. Xem
      `user_workspace/migrations/0012_enforce_tenant_not_null_real.py`.
    """
    tenant = getattr(request, 'tenant', None)
    if tenant is None:
        raise NotFound('Portfolio not found.')
    return get_object_or_404(
        Portfolio.objects.select_related('tenant'),
        pk=portfolio_id, user=request.user, tenant=tenant,
    )


def _compute_holdings(portfolio_id, tenant=None):
    """
    Wrapper tương thích shape cũ — thuật toán thật nằm ở `user_workspace.ledger`.

    P0-DATA-03: bản cũ nằm ngay trong file này và sai 6 chỗ đã xác minh
    (loại cổ tức khỏi queryset, không cộng `tax` BUY, không trừ `fee`/`tax`
    SELL, clamp oversell im lặng, xoá cứng cost basis khi hết hàng, không
    theo dõi tiền mặt). Xem `ledger/holdings.py` cho bảng đối chiếu và
    golden fixture ở `test_golden/holdings.json`.

    Giữ nguyên tên + shape `{symbol: {'quantity', 'avg_cost', 'total_cost'}}`
    để 8 view analytics cũ không phải sửa call site.
    """
    return holdings_from_ledger(get_cached_ledger(portfolio_id, tenant))


# S-00c: chuỗi "" cho ngành rỗng. FE dùng đúng giá trị này để hiện
# "Chưa phân ngành" + `industry_reason` thay vì gộp mọi mã chưa có ngành
# vào một slice tên là "Khác" — làm người dùng tưởng đó là một ngành thật.
UNCLASSIFIED_INDUSTRY = ''


def _industry_profile_map(symbols):
    """`{symbol: (company_name, industry)}` từ `market_data.StockProfile`.

    Nguồn: `market_data/models.py` — `StockProfile.company_name` (:32) và
    `StockProfile.industry` (:40, verbose_name='Ngành'). Cả hai được
    `data_ingest/tasks.py` (:1254-1284) đồng bộ từ upstream listing client.

    Trả map rỗng khi app `market_data` chưa có trong INSTALLED_APPS hoặc
    bảng chưa migrate — view không được sập vì thiếu dữ liệu tên/ngành.
    """
    try:
        from market_data.models import StockProfile
    except Exception:  # pragma: no cover - market_data chưa cài
        return {}
    try:
        rows = StockProfile.objects.filter(symbol__in=list(symbols)).values('symbol', 'company_name', 'industry')
    except Exception:  # pragma: no cover - chưa migrate
        return {}
    return {
        r['symbol']: (r.get('company_name') or '', r.get('industry') or UNCLASSIFIED_INDUSTRY)
        for r in rows
    }


def _allocation_rows(values, profiles):
    """Danh sách allocation đã sắp xếp theo `weight_pct` giảm dần.

    Tách riêng khỏi view để test được không cần DB — mọi quyết định về shape
    (thứ tự, `null` thay vì 0, ngành rỗng) nằm ở đây.
    """
    total = sum(values.values(), Decimal('0'))
    rows = [
        {
            'symbol': sym,
            'value': str(round(v, 2)),
            'weight_pct': round(float(v / total * 100), 2),
            # S-00c: ngành để FE group-by sector mà không cần gọi thêm endpoint.
            'industry': profiles.get(sym, ('', UNCLASSIFIED_INDUSTRY))[1],
        }
        for sym, v in values.items()
    ]
    rows.sort(key=lambda x: -x['weight_pct'])
    return rows


def _build_holdings_payload(holdings, price_map, profiles, source=None):
    """Payload holdings đã enrich — thuần, không chạm DB.

    `profiles` = output của `_industry_profile_map`: `{symbol: (company_name, industry)}`.
    `source` = `Portfolio.kind` (`manual|broker_backed|aggregate`) — moi dong deu
    thuoc cung 1 danh muc nen chia se cung nguon; FE dung de render `SourceBadge`
    (thieu ⇒ badge fail-closed ve null). Khong doi shape: chi THEM field.

    Ràng buộc không được phá (S-00c):
    - Mã thiếu giá ⇒ `market_value`/`unrealized_pnl`/`weight_pct`/`price_change_pct`
      là `null` **kèm reason**, KHÔNG phải 0 (xem LED-03 AC4 trong view).
    - `weight_pct` tính trên tổng các mã **có** giá; mã thiếu giá không vào mẫu số
      vì nếu vào sẽ làm méo tỷ trọng của các mã đã có giá.
    """
    results = []
    for sym, h in holdings.items():
        snap = price_map.get(sym)
        current_price = Decimal(str(snap.price)) if snap and snap.price is not None else None
        quantity = h['quantity']
        cost_value = h['avg_cost'] * quantity
        if current_price is None:
            market_value = None
            unrealized_pnl = None
            pnl_pct = None
        else:
            market_value = current_price * quantity
            unrealized_pnl = market_value - cost_value
            pnl_pct = (float(unrealized_pnl / cost_value * 100) if cost_value else None)
        company_name, industry = profiles.get(sym, ('', UNCLASSIFIED_INDUSTRY))
        results.append({
            'symbol': sym,
            'company_name': company_name,
            'industry': industry,
            'industry_reason': None if industry else 'no_master_profile',
            'quantity': quantity,
            'avg_cost': str(round(h['avg_cost'], 2)),
            'current_price': None if current_price is None else str(current_price),
            'market_value': None if market_value is None else str(round(market_value, 2)),
            'unrealized_pnl': (None if unrealized_pnl is None else str(round(unrealized_pnl, 2))),
            'unrealized_pnl_pct': None if pnl_pct is None else round(pnl_pct, 2),
            # LED-03 AC4: chỉ đặt reason khi **thiếu** giá. Điều kiện đảo ngược
            # làm 2 test `NoFabricatedZeroInViewTests` đỏ — đã bắt bằng
            # `python manage.py test user_workspace` (delta so với baseline).
            'price_missing_reason': None if current_price is not None else 'no_quote_for_today',
            'source': source,
            'stale': snap.stale if snap else True,
            'price_change_pct': (None if snap is None or snap.price_change_pct is None
                                 else round(float(snap.price_change_pct), 2)),
        })
    priced_total = sum(
        (Decimal(r['market_value']) for r in results if r['market_value'] is not None),
        Decimal('0'),
    )
    for r in results:
        if r['market_value'] is None or not priced_total:
            r['weight_pct'] = None
        else:
            r['weight_pct'] = round(float(Decimal(r['market_value']) / priced_total * 100), 2)
    results.sort(key=lambda x: x['symbol'])
    return results


@extend_schema(
    summary='PortfolioHoldingsView (native route)',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. The real payload shape is checked by test_flat_views_are_not_documented_as_envelope.',
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class PortfolioHoldingsView(APIView):
    """GET /api/portfolio/portfolios/<portfolio_id>/holdings/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, portfolio_id):
        from market_serving.models import SymbolSnapshot
        portfolio = _get_user_portfolio(request, portfolio_id)
        holdings = _compute_holdings(portfolio_id, portfolio.tenant)
        if not holdings:
            return envelope([])
        symbols = list(holdings.keys())
        today = date.today()
        snaps = SymbolSnapshot.objects.filter(symbol__in=symbols, session_date=today)
        price_map = {s.symbol: s for s in snaps}
        profiles = _industry_profile_map(symbols)
        kind = getattr(portfolio, 'kind', None) or 'manual'
        payload = _build_holdings_payload(holdings, price_map, profiles, source=kind)
        # S-00c: `data` GIỮ NGUYÊN là list phẳng — 3 consumer đang chạy đọc
        # shape này (`useCoreDashboardData.js:133`, `WatchlistContext.tsx:253`,
        # `useWhaleAdvisoryData.js:223`, tất cả qua `normalizeHoldingsList`).
        # Không đổi `data` thành `{holdings: [...]}`: sẽ phá cả 3.
        # Số tổng đi vào `meta` vì `envelope()` đã hỗ trợ sẵn.
        unpriced_symbols = sorted(r['symbol'] for r in payload if r['market_value'] is None)
        priced_total = sum(
            (Decimal(r['market_value']) for r in payload if r['market_value'] is not None),
            Decimal('0'),
        )
        return envelope(payload, meta={
            'priced_total_value': str(round(priced_total, 2)),
            'unpriced_symbols': unpriced_symbols,
            'weight_covers_all_holdings': not unpriced_symbols,
            'count': len(payload),
            'kind': kind,
        })


@extend_schema(
    summary='PortfolioSummaryView (native route)',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. The real payload shape is checked by test_flat_views_are_not_documented_as_envelope.',
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class PortfolioSummaryView(APIView):
    """GET /api/portfolio/portfolios/<portfolio_id>/summary/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, portfolio_id):
        from market_serving.models import SymbolSnapshot
        portfolio = _get_user_portfolio(request, portfolio_id)
        ledger = get_cached_ledger(portfolio_id, portfolio.tenant)
        holdings = holdings_from_ledger(ledger)
        today = date.today()
        total_market_value = Decimal('0')
        total_cost = Decimal('0')
        unpriced_symbols = []
        # Dùng chung một lần truy vấn giá cho cả hai mục đích: tổng PnL dưới
        # đây, và `portfolio_valuation` bên dưới. Trước đây chỉ có mục đích
        # đầu — nối NAV vào mà không tái sử dụng thì mỗi lần gọi summary sẽ
        # query `SymbolSnapshot` **hai lần** cho cùng một tập mã.
        price_by_symbol = {}
        if holdings:
            symbols = list(holdings.keys())
            snaps = SymbolSnapshot.objects.filter(symbol__in=symbols, session_date=today)
            price_map = {s.symbol: s for s in snaps}
            for sym, h in holdings.items():
                snap = price_map.get(sym)
                # Cùng lý do với `PortfolioHoldingsView`: không có giá thì
                # `total_market_value` KHÔNG được coi là bằng tổng giá vốn. Cộng
                # `avg_cost × quantity` vào "giá trị thị trường" làm số tổng
                # luôn khớp `total_cost` nên `total_unrealized_pnl = 0` — tức báo
                # "không lãi không lỗ" cho cả danh mục khi chưa có bất kỳ giá
                # nào. Thay vào đó: giá trị thị trường `null` + danh sách mã
                # chưa có giá.
                if not snap or snap.price is None:
                    unpriced_symbols.append(sym)
                    continue
                current_price = Decimal(str(snap.price))
                price_by_symbol[sym] = current_price
                total_market_value += current_price * h['quantity']
                total_cost += h['avg_cost'] * h['quantity']
        if unpriced_symbols:
            market_value_out = None
            pnl_out = None
            pnl_pct_out = None
        else:
            market_value_out = str(round(total_market_value, 2))
            pnl_out = str(round(total_market_value - total_cost, 2))
            pnl_pct_out = (
                None if not total_cost
                else round(float((total_market_value - total_cost) / total_cost * 100), 2)
            )
        # --- LED-05 cutover: NAV tính thật, không còn hardcode `None` --------
        # Trước đây dòng này là `'nav': None` kèm comment "cần số dư mở đầu từ
        # broker (model `Portfolio` không có trường đó ⇒ cần migration, ngoài
        # PA-2)". Migration `0021` đã thêm đúng trường đó (`opening_balance`)
        # và `portfolio_valuation()` đã được viết + test — nhưng **không ai gọi
        # nó**, nên toàn bộ NAV engine đã merge chưa từng chạy ngoài test.
        #
        # `portfolio_valuation` không raise: thiếu `opening_balance` thì
        # `no_opening_balance`; thiếu giá thì `no_market_prices` /
        # `partial_market_prices`; chưa backfill `CashFlow` thì
        # `cash_flows_not_backfilled`. Tất cả đều là `nav = null` + mã lý do —
        # fail-closed theo LED-03 R5, không bao giờ 0 giả.
        valuation = portfolio_valuation(
            portfolio, ledger=ledger, price_by_symbol=price_by_symbol,
        )
        # `Decimal` → `str` để JSON mang đúng 2 chữ số thập phân, khớp quy ước
        # của `cash`/`realized_pnl` ngay phía trên (và của `total_cost`).
        nav_out = valuation['nav']
        payload = {
            'portfolio_id': portfolio_id,
            'portfolio_name': portfolio.name,
            'total_market_value': market_value_out,
            'total_cost': str(round(total_cost, 2)),
            'total_unrealized_pnl': pnl_out,
            'total_unrealized_pnl_pct': pnl_pct_out,
            'unpriced_symbols': sorted(unpriced_symbols),
            'market_value_reason': (
                None if not unpriced_symbols
                else f'{len(unpriced_symbols)} mã chưa có giá phiên {today.isoformat()}'
            ),
            'num_holdings': len(holdings),
            'as_of': today.isoformat(),
            # --- PA-2: sổ cái + provenance (P0-DATA-03 / P1-DATA-03) ---------
            # Toàn bộ là key MỚI, không đổi key cũ ⇒ FE đọc theo tên vẫn chạy.
            'cash': str(money(ledger['cash'])),
            'cash_complete': ledger['cash_complete'],
            'cash_note': ledger['cash_note'],
            'realized_pnl': str(money(ledger['realized_pnl'])),
            'dividend_income': str(money(ledger['dividend_income'])),
            # --- LED-03/05: NAV thật -----------------------------------------
            'nav': None if nav_out is None else str(nav_out),
            # Mã máy, không phải câu văn — cùng nguyên tắc với
            # `price_missing_reason: 'no_quote_for_today'` ở view trên. Rỗng khi
            # NAV đã tính được; có mã khi bị chặn.
            'nav_reason': valuation.get('nav_reason') or '',
            'nav_reason_text': valuation.get('nav_reason_text') or '',
            'nav_unpriced_symbols': valuation.get('unpriced_symbols', []),
            'opening_balance': (
                None if valuation.get('opening_balance') is None
                else str(valuation['opening_balance'])
            ),
            'stock_value': (
                None if valuation.get('stock_value') is None
                else str(valuation['stock_value'])
            ),
            'debt': None if valuation.get('debt') is None else str(valuation['debt']),
            'currency': valuation.get('currency'),
            'ledger_warnings': ledger['warnings'],
            'reconciliation_required': ledger['reconciliation_required'],
        }
        # `cash_cross_check` chỉ có **khi** hai nguồn tiền thật sự lệch
        # (thường do bán vượt số lượng đang giữ — tiền đã chuyển nhưng chưa có
        # cost basis). Không đặt sẵn key rỗng: client không nên phải dò xem
        # rồi tự hiểu là "không có gì".
        if 'cash_cross_check' in valuation:
            payload['cash_cross_check'] = valuation['cash_cross_check']
            # Hệ thống đã cảnh báo cả hai lệch, nên `reconciliation_required` ở
            # trên phải phản ánh cả trường hợp này, không chỉ cảnh báo sổ cái.
            payload['reconciliation_required'] = True
        # B5: provenance đi vào `meta` của envelope, không nằm lại trong `data`.
        # `build_meta(ledger)` **đã có sẵn** từ trước B5 (PA-2 / P1-DATA-03) nên
        # đây là di chuyển, không phải bịa giá trị mới. Client đọc `meta.as_of`
        # ở top-level vẫn thấy đúng nội dung cũ.
        #
        # KHÔNG đụng `nav` / `nav_reason` / `unpriced_symbols` ở trên: đó là
        # fail-closed LED-03 R5 (thiếu `opening_balance` / giá / `CashFlow`
        # backfill ⇒ `null` + mã lý do, không bao giờ 0 giả).
        return envelope(payload, meta=build_meta(ledger))


@extend_schema(
    summary='PortfolioChartView (native route)',
    description='Alias of equity-curve — delegates to PortfolioEquityCurveView. Kept for existing clients; do not compare the two responses.',
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class PortfolioChartView(APIView):
    """GET /api/portfolio/portfolios/<portfolio_id>/chart/ — daily portfolio value."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, portfolio_id):
        _get_user_portfolio(request, portfolio_id)
        # Alias to equity curve for frontend compatibility
        return PortfolioEquityCurveView().get(request, portfolio_id=portfolio_id)


@extend_schema(
    summary='PortfolioEquityCurveView (native route)',
    description='Daily NAV series. `nav` is null + `nav_reason` on days where any held symbol has no price — never 0.',
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class PortfolioEquityCurveView(APIView):
    """GET /api/portfolio/portfolios/<portfolio_id>/equity-curve/ — daily NAV history."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, portfolio_id):
        from market_data.models import DailyPrice
        portfolio = _get_user_portfolio(request, portfolio_id)
        holdings = _compute_holdings(portfolio_id, portfolio.tenant)
        if not holdings:
            return envelope({'portfolio_id': portfolio_id, 'curve': []})
        symbols = list(holdings.keys())
        today = date.today()
        date_from = today - timedelta(days=365)
        prices = (
            DailyPrice.objects.filter(symbol__in=symbols, date__gte=date_from)
            .order_by('date', 'symbol')
        )
        # Build date → symbol → close map
        date_price_map: dict[date, dict[str, Decimal]] = {}
        for p in prices:
            day = p.date
            if day not in date_price_map:
                date_price_map[day] = {}
            date_price_map[day][p.symbol] = Decimal(str(p.close))
        curve = []
        for day in sorted(date_price_map.keys()):
            day_prices = date_price_map[day]
            # LED-03 AC4: mã không có giá trong ngày ⇒ bỏ qua và **báo**,
            # không lấy `avg_cost` làm giá. Lấy giá vốn tạo ra một đường cong
            # trông rất thuyết phục nhưng hoàn toàn bịa — và vì `PortfolioSummaryView`
            # đã trả `null` cho cùng tình huống, hai màn hình sẽ mâu thuẫn nhau.
            missing = sorted(
                sym for sym in holdings if sym not in day_prices)
            nav = sum(
                day_prices[sym] * h['quantity']
                for sym, h in holdings.items() if sym in day_prices
            )
            curve.append({
                'date': day.isoformat(),
                'nav': str(round(nav, 2)) if not missing else None,
                'nav_reason': None if not missing else 'missing_price_for_some_symbols',
                'missing_symbols': missing,
            })
        return envelope({'portfolio_id': portfolio_id, 'curve': curve})


def _nav_series(holdings, symbols, date_from):
    """`[{date, nav_float}]` — NAV danh mục theo ngày, dùng cho chỉ số.

    Ngày thiếu giá cho **một số** mã ⇒ bỏ qua ngày đó. Lấy giá vốn thay cho giá
    thiếu sẽ tạo ra một đường cong trông thuyết phục nhưng hoàn toàn bịa —
    cùng lý do LED-03 AC4 mà `PortfolioEquityCurveView` đã áp dụng.
    """
    from market_data.models import DailyPrice

    prices = (
        DailyPrice.objects.filter(symbol__in=symbols, date__gte=date_from)
        .order_by('date', 'symbol')
    )
    date_price_map: dict[date, dict[str, Decimal]] = {}
    for p in prices:
        date_price_map.setdefault(p.date, {})[p.symbol] = Decimal(str(p.close))
    series = []
    for day in sorted(date_price_map):
        day_prices = date_price_map[day]
        if any(sym not in day_prices for sym in holdings):
            continue
        series.append({
            'date': day,
            'nav': float(sum(day_prices[sym] * h['quantity'] for sym, h in holdings.items())),
        })
    return series


def _benchmark_returns(symbol, date_from, date_to):
    """Lợi nhuận ngày của chỉ số. `([], 'no_benchmark_data')` khi thiếu giá."""
    from market_data.models import DailyPrice

    rows = (
        DailyPrice.objects
        .filter(symbol=symbol, date__gte=date_from, date__lte=date_to)
        .order_by('date').values_list('close', flat=True)
    )
    closes = [float(c) for c in rows if c is not None]
    if len(closes) < 2:
        return [], 'no_benchmark_data'
    return [(cur - prev) / prev for prev, cur in zip(closes, closes[1:]) if prev != 0], None


@extend_schema(
    summary='PortfolioMetricsView (native route)',
    description='Risk/return/benchmark metrics for one portfolio. Every metric group is `null` + a `*_reason` when data is missing; never a fabricated zero. See PortfolioMetricsView docstring.',
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class PortfolioMetricsView(APIView):
    """GET /core/v1/workspace/portfolios/<id>/metrics/ — chỉ số THẬT.

    S-00b. `risk_metrics` / `benchmark_metrics` / `performance` / `freshness`
    trong `user_workspace/ledger/analytics.py` là **code chết**: traverse cho
    thấy 0 caller ngoài test. Code viết đúng nhưng không endpoint nào gọi.

    Ràng buộc D7 — không bịa số:
    - Thiếu dữ liệu ⇒ `null` **kèm** `reason_code`, không phải 0.
    - `sharpe`/`sortino`/`correlation` KHÔNG có ở backend (`grep -c` = 2 comment,
      0, 0) nên endpoint này không khai chúng; FE không được hiện card cho 3 số này.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, portfolio_id):
        from django.utils import timezone as _tz

        from user_workspace.ledger.analytics import (
            DEFAULT_BENCHMARK,
            benchmark_metrics,
            freshness,
            performance,
            risk_metrics,
        )

        portfolio = _get_user_portfolio(request, portfolio_id)
        holdings = _compute_holdings(portfolio_id, portfolio.tenant)
        if not holdings:
            return envelope({
                'portfolio_id': portfolio_id,
                'performance': None, 'risk': None, 'benchmark': None,
                'freshness': None, 'reason': 'no_holdings', 'observations': 0,
            })

        symbols = list(holdings)
        series = _nav_series(holdings, symbols, date.today() - timedelta(days=365))
        navs = [row['nav'] for row in series]
        daily_returns = [(c - p) / p for p, c in zip(navs, navs[1:]) if p]

        payload = {
            'portfolio_id': portfolio_id,
            'performance': None, 'risk': None, 'benchmark': None,
            'freshness': None, 'observations': len(series),
        }

        if len(daily_returns) >= 1:
            # `cash_flows` rỗng ⇒ `mwr` = None (thiếu dòng tiền thật) — đúng, không bịa.
            payload['performance'] = performance(daily_returns, [])
        else:
            payload['performance_reason'] = 'insufficient_nav_history'

        if len(daily_returns) >= 2:
            payload['risk'] = risk_metrics(daily_returns, market_values=navs)
        else:
            payload['risk_reason'] = 'insufficient_nav_history'

        if len(series) >= 2:
            bench, reason = _benchmark_returns(
                DEFAULT_BENCHMARK, series[0]['date'], series[-1]['date'])
            if reason is None and len(bench) == len(daily_returns):
                out = benchmark_metrics(daily_returns, bench, benchmark=DEFAULT_BENCHMARK)
                out['benchmark'] = DEFAULT_BENCHMARK
                payload['benchmark'] = out
            else:
                payload['benchmark_reason'] = reason or 'benchmark_length_mismatch'
        else:
            payload['benchmark_reason'] = 'insufficient_nav_history'

        try:
            now = _tz.now()
            payload['freshness'] = freshness(as_of=now, now=now)
        except Exception as exc:  # noqa: BLE001
            payload['freshness'] = None
            payload['freshness_reason'] = type(exc).__name__

        return envelope(payload)


@extend_schema(
    summary='PortfolioAllocationView (native route)',
    description='Value weight per symbol, with `industry` for sector grouping. `weight_covers_all_holdings` is false when any symbol lacks a price, so weights do not total 100%.',
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class PortfolioAllocationView(APIView):
    """GET /api/portfolio/portfolios/<portfolio_id>/allocation/ — symbol weight breakdown."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, portfolio_id):
        from market_serving.models import SymbolSnapshot
        portfolio = _get_user_portfolio(request, portfolio_id)
        holdings = _compute_holdings(portfolio_id, portfolio.tenant)
        if not holdings:
            return envelope({'portfolio_id': portfolio_id, 'allocation': []})
        symbols = list(holdings.keys())
        today = date.today()
        snaps = SymbolSnapshot.objects.filter(symbol__in=symbols, session_date=today)
        price_map = {s.symbol: s for s in snaps}
        profiles = _industry_profile_map(symbols)
        values = {}
        unpriced = []
        total = Decimal('0')
        for sym, h in holdings.items():
            snap = price_map.get(sym)
            # Cùng lý do với `PortfolioSummaryView`: mã không có giá thì giá trị
            # và tỷ trọng phải là `null`, không phải con số tính từ giá vốn.
            # Ở đây còn tệ hơn vì con số bịa đó nằm ngay trong `weight_pct` —
            # người dùng sẽ thấy một biểu đồ phân bổ đầy đủ tin cậy giả.
            if not snap or snap.price is None:
                unpriced.append(sym)
                continue
            price = Decimal(str(snap.price))
            val = price * h['quantity']
            values[sym] = val
            total += val
        if not values:
            return envelope({
                'portfolio_id': portfolio_id,
                'total_value': None,
                'allocation': [],
                'unpriced_symbols': sorted(unpriced),
                'reason': 'no_market_prices',
            })
        allocation = _allocation_rows(values, profiles)
        return envelope({
            'portfolio_id': portfolio_id,
            'total_value': str(round(total, 2)),
            'allocation': allocation,
            'unpriced_symbols': sorted(unpriced),
            # Tổng weight chỉ còn 100% khi mọi mã đều có giá. Nói rõ để không ai
            # đọc `weight_pct` như phân bổ của cả danh mục.
            'weight_covers_all_holdings': not unpriced,
        })


@extend_schema(
    summary='PortfolioAnalyticsView (native route)',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. The real payload shape is checked by test_flat_views_are_not_documented_as_envelope.',
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class PortfolioAnalyticsView(APIView):
    """GET /api/portfolio/portfolios/<portfolio_id>/analytics/ — combined analytics overview."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, portfolio_id):
        _get_user_portfolio(request, portfolio_id)
        summary_resp = PortfolioSummaryView().get(request, portfolio_id=portfolio_id)
        # `PortfolioSummaryView` đã trả envelope `{data, meta}` ⇒ phải mở ra
        # trước khi lồng vào `summary`, nếu không `summary` sẽ là envelope
        # **lồng envelope** và client phải đào 2 tầng ở riêng endpoint này.
        #
        # Provenance của summary (`build_meta(ledger)`) được đưa lên `meta` của
        # chính endpoint này: mỗi response chỉ có **một** chỗ mang `meta`, và
        # nội dung giữ nguyên.
        summary_body = summary_resp.data
        return envelope({
            'summary': inner_payload(summary_body),
            'note': 'full_analytics_available_via_sub_endpoints',
        }, meta=summary_body.get('meta') if isinstance(summary_body, dict) else None)


@extend_schema(
    summary='PortfolioTechnicalsView (native route)',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. The real payload shape is checked by test_flat_views_are_not_documented_as_envelope.',
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class PortfolioTechnicalsView(APIView):
    """GET /api/portfolio/portfolios/<portfolio_id>/technicals/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, portfolio_id):
        from market_serving.models import SymbolSnapshot
        portfolio = _get_user_portfolio(request, portfolio_id)
        holdings = _compute_holdings(portfolio_id, portfolio.tenant)
        if not holdings:
            return envelope([])
        symbols = list(holdings.keys())
        today = date.today()
        snaps = SymbolSnapshot.objects.filter(symbol__in=symbols, session_date=today)
        return envelope([{
            'symbol': s.symbol,
            'price': str(s.price),
            'price_change': str(s.price_change),
            'price_change_pct': str(s.price_change_pct),
            'volume': s.volume,
            'stale': s.stale,
        } for s in snaps])


# ---------------------------------------------------------------------------
# Portfolio AI advisory compat — delegates to advisory domain
# ---------------------------------------------------------------------------

def _unwrap_django_request(request):
    return getattr(request, '_request', request)


_WHALE_ANALYTICS_TIMEFRAMES = {'15m', '30m', '1h', 'morning', 'afternoon', 'session'}


def _ensure_localized_datetime(value):
    if value is None:
        return None
    if timezone.is_naive(value):
        value = timezone.make_aware(value, timezone.get_current_timezone())
    return timezone.localtime(value)


def _isoformat_local(value):
    localized_value = _ensure_localized_datetime(value)
    return localized_value.isoformat() if localized_value is not None else None


def _combine_trade_datetime(trade_date, trade_time):
    return timezone.make_aware(
        datetime.combine(trade_date, trade_time),
        timezone.get_current_timezone(),
    )


def _resolve_whale_bucket_window(timeframe):
    if timeframe in {'15m', '30m', '1h'}:
        return timeframe
    return '15m'


def _resolve_bucket_rows_with_fallback(facts, preferred_window, loader):
    candidate_windows = []
    for window in (preferred_window, '15m', '30m', '1h'):
        if window not in candidate_windows:
            candidate_windows.append(window)

    for candidate_window in candidate_windows:
        bucket_rows = loader(facts, candidate_window)
        if bucket_rows:
            return bucket_rows, candidate_window
    return [], preferred_window


def _resolve_whale_time_bounds(trade_date, timeframe, whale_rows, bucket_rows):
    session_start = _combine_trade_datetime(trade_date, time(hour=9, minute=0))
    morning_end = _combine_trade_datetime(trade_date, time(hour=11, minute=30))
    afternoon_start = _combine_trade_datetime(trade_date, time(hour=13, minute=0))
    session_end = _combine_trade_datetime(trade_date, time(hour=15, minute=0))

    if timeframe == 'morning':
        return session_start, morning_end
    if timeframe == 'afternoon':
        return afternoon_start, session_end
    if timeframe == 'session':
        return session_start, session_end

    window_minutes = {
        '15m': 15,
        '30m': 30,
        '1h': 60,
    }.get(timeframe, 15)

    anchor_candidates = []
    if whale_rows:
        anchor_candidates.extend(_ensure_localized_datetime(row.executed_at) for row in whale_rows)
    if bucket_rows:
        anchor_candidates.extend(_ensure_localized_datetime(row.get('bucket_ts')) for row in bucket_rows)
    anchor_candidates = [candidate for candidate in anchor_candidates if candidate is not None]

    anchor = max(anchor_candidates) if anchor_candidates else session_end
    anchor = min(anchor, session_end)
    start = anchor - timedelta(minutes=window_minutes)
    if start < session_start:
        start = session_start
    return start, anchor


def _datetime_in_bounds(value, start_dt, end_dt):
    localized_value = _ensure_localized_datetime(value)
    if localized_value is None:
        return False
    return start_dt <= localized_value <= end_dt


def _strength_confidence(value):
    numeric_value = float(value or 0)
    if numeric_value >= 70:
        return 'high'
    if numeric_value >= 45:
        return 'medium'
    return 'low'

class PortfolioAIAdvisoryCanonicalView(APIView):
    """GET /api/portfolio/ai-advisory/<symbol>/canonical/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        from advisory.views import AdvisoryLatestView
        return adopt_envelope(
            AdvisoryLatestView.as_view()(_unwrap_django_request(request), symbol=symbol.upper())
        )


class PortfolioAIAdvisoryCurrentView(APIView):
    """GET /api/portfolio/ai-advisory/<symbol>/current/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        from advisory.views import AdvisoryLatestView
        return adopt_envelope(
            AdvisoryLatestView.as_view()(_unwrap_django_request(request), symbol=symbol.upper())
        )


class PortfolioAIAdvisoryAutoRefreshInfoView(APIView):
    """GET /api/portfolio/ai-advisory/<symbol>/auto-refresh-info/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        return envelope({'symbol': symbol.upper(), 'auto_refresh': False, 'note': 'auto_refresh_not_available'})


class PortfolioAIAdvisoryRefreshView(APIView):
    """POST /api/portfolio/ai-advisory/<symbol>/refresh/"""
    permission_classes = [permissions.IsAuthenticated, WorkspacePermission]
    required_workspace_permission = 'portfolio_write'

    def post(self, request, symbol):
        from advisory.views import AdvisoryRefreshView
        return adopt_envelope(
            AdvisoryRefreshView.as_view()(_unwrap_django_request(request), symbol=symbol.upper())
        )


@extend_schema(
    summary='PortfolioAICommandCenterView (native route)',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. The real payload shape is checked by test_flat_views_are_not_documented_as_envelope.',
    # This class has a PUT alongside the GET, so the REQUEST side must be typed
    # too; responses= alone still yields the unguessable-serializer error.
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class PortfolioAICommandCenterView(APIView):
    """GET/PUT /api/portfolio/ai-command-center/"""
    permission_classes = [permissions.IsAuthenticated, WorkspacePermission]
    required_workspace_permission = 'portfolio_write'

    def _get_or_create_user_credential(self, user):
        """Get or create UserAICredential for the user."""
        from advisory.models import UserAICredential
        try:
            return UserAICredential.objects.get(user=user)
        except UserAICredential.DoesNotExist:
            return UserAICredential.objects.create(user=user)

    def get(self, request):
        from advisory.models import SystemAISettings, UserAICredential
        # Fetch active or create default settings singleton
        config = SystemAISettings.objects.filter(is_active=True).order_by('-updated_at').first()
        if not config:
            config = SystemAISettings.objects.order_by('-updated_at').first()
            if config:
                config.is_active = True
                config.save(update_fields=['is_active'])
            else:
                config = SystemAISettings.objects.create(
                    name='Default Production Config',
                    is_active=True,
                    ai_model=SystemAISettings.ModelChoices.GPT4O_MINI,
                    max_tokens=5000,
                    temperature=0.3,
                    prompt_template='Default template for {symbol}',
                )

        metadata = config.metadata or {}

        # R0.2: default + normalize VE canonical v2 (khong dict phang,
        # khong key chet `lookback_unit`). Khong persist am tham o GET.
        from advisory.advisory_helpers import (
            _get_default_prompt_config,
            _parse_prompt_config,
            build_ai_readiness,
        )
        prompt_config = _parse_prompt_config(
            metadata.get('ai_prompt_config'))

        # Read user credential (BYOK SSOT). Giữ read-only (không get-or-create):
        # user legacy chưa có cred vẫn đọc được prefs cũ ở nhánh else bên dưới.
        # config_updated_at=None với user mới là bình thường — PUT đầu (không
        # kèm expected) tạo row và trả token mới (R1.9).
        try:
            user_cred = UserAICredential.objects.get(user=request.user)
        except UserAICredential.DoesNotExist:
            user_cred = None

        api_key_masked = ''
        if user_cred:
            provider = user_cred.ai_provider or 'openai'
            model = user_cred.ai_model or config.ai_model
            api_key_configured = bool(user_cred.encrypted_api_key)
            custom_endpoint = user_cred.custom_endpoint or ''
            fallback_remaining = user_cred.fallback_quota_remaining
            fallback_date = user_cred.fallback_quota_date
            if api_key_configured:
                # F4: expose only last4 mask — never full key in response body
                try:
                    from identity_access.security import decrypt_user_api_key
                    plain_key = decrypt_user_api_key(user_cred.encrypted_api_key)
                    api_key_masked = f'••••••••{plain_key[-4:]}' if len(plain_key) >= 4 else '••••••••'
                except Exception:
                    api_key_masked = '••••••••'
        else:
            # Fallback to legacy preferences
            from identity_access.models import UserProfile
            try:
                profile = UserProfile.objects.get(user=request.user)
                prefs = profile.preferences or {}
                provider = str(prefs.get('ai_provider', '') or 'openclaw').strip().lower()
                api_key_configured = bool(prefs.get('api_key', ''))
            except UserProfile.DoesNotExist:
                provider = 'openclaw'
                api_key_configured = False
            model = config.ai_model
            custom_endpoint = ''
            fallback_remaining = 0
            fallback_date = None
            if api_key_configured:
                try:
                    raw = str(prefs.get('api_key', '') or '')
                    try:
                        from identity_access.security import decrypt_user_api_key
                        plain_key = decrypt_user_api_key(raw)
                    except Exception:
                        plain_key = raw
                    api_key_masked = f'••••••••{plain_key[-4:]}' if len(plain_key) >= 4 else '••••••••'
                except Exception:
                    api_key_masked = '••••••••'

        ai_ready = api_key_configured or (provider == 'openclaw') or (provider == 'local')
        from django.conf import settings as django_settings
        fallback_quota_max = getattr(django_settings, 'AI_FALLBACK_DAILY_QUOTA', 5)

        # Per-user policy prefer (Slice C): user field > system metadata/config
        sys_refresh = int(metadata.get('advisory_refresh_interval_hours', 24))
        sys_max_auto = int(metadata.get('advisory_max_auto_refreshes_per_day', 24))
        sys_max_tokens = int(config.max_tokens)
        sys_temp = float(config.temperature)
        sys_prompt = metadata.get('ai_prompt_config') or prompt_config
        if user_cred:
            advisory_refresh = (
                user_cred.refresh_interval_hours
                if user_cred.refresh_interval_hours is not None else sys_refresh
            )
            advisory_max_auto = (
                user_cred.max_auto_refreshes_per_day
                if user_cred.max_auto_refreshes_per_day is not None else sys_max_auto
            )
            advisory_max_tokens = (
                user_cred.max_tokens_per_day
                if user_cred.max_tokens_per_day is not None else sys_max_tokens
            )
            advisory_temp = (
                user_cred.temperature
                if user_cred.temperature is not None else sys_temp
            )
            advisory_prompt = user_cred.prompt_config or sys_prompt
        else:
            advisory_refresh = sys_refresh
            advisory_max_auto = sys_max_auto
            advisory_max_tokens = sys_max_tokens
            advisory_temp = sys_temp
            advisory_prompt = sys_prompt
        # R0.2: GET luon tra canonical v2 (legacy phang hien v2, khong persist).
        advisory_prompt = _parse_prompt_config(advisory_prompt)

        # R0.9 lop A/B: truong he thong chi staff thay. User thuong nhan
        # system_policy.managed_by_platform thay vi noi dung template.
        is_operator = bool(
            getattr(request.user, 'is_staff', False)
            or getattr(request.user, 'is_superuser', False)
        )
        response_data = {
            'ai_provider': provider,
            'ai_model': model,
            'ai_api_key': '',
            'ai_api_key_configured': api_key_configured,
            'ai_readiness': build_ai_readiness(provider, api_key_configured),
            'ai_api_key_masked': api_key_masked,
            'system_policy': {'managed_by_platform': True},
            'custom_endpoint': custom_endpoint,
            'effective_ai_source': metadata.get('effective_ai_source') or 'command_center',
            'effective_ai_provider': provider,
            'effective_ai_model': model or 'Chưa cấu hình',
            'ai_ready': ai_ready,
            'ai_prompt_config': advisory_prompt,
            'ai_prompt_config_history': list(user_cred.prompt_config_history or []) if user_cred else [],
            'advisory_refresh_interval_hours': int(advisory_refresh),
            'advisory_max_auto_refreshes_per_day': int(advisory_max_auto),
            'advisory_max_tokens_per_day': int(advisory_max_tokens),
            'temperature': float(advisory_temp),
            'fallback_quota_remaining': fallback_remaining,
            'fallback_quota_max': fallback_quota_max,
            'fallback_quota_reset': fallback_date,
            # R1.10 AC1: nhãn đúng nghĩa + nguồn quota.
            'fallback_quota_used_today': user_cred.fallback_quota_used_today if user_cred else 0,
            'fallback_quota_source': 'personal_key' if api_key_configured else 'system',
            # R1.9: optimistic-lock token — client gửi lại ở PUT (expected_updated_at).
            'config_updated_at': (
                user_cred.updated_at.isoformat() if user_cred and user_cred.updated_at else None
            ),
        }
        if is_operator:
            response_data['system_prompt_template'] = config.prompt_template or ''
        return envelope(response_data)

    def put(self, request):
        from advisory.models import SystemAISettings, UserAICredential
        config = SystemAISettings.objects.filter(is_active=True).order_by('-updated_at').first()
        if not config:
            config = SystemAISettings.objects.order_by('-updated_at').first()
            if config:
                config.is_active = True
                config.save(update_fields=['is_active'])
            else:
                config = SystemAISettings.objects.create(
                    name='Default Production Config',
                    is_active=True,
                    ai_model=SystemAISettings.ModelChoices.GPT4O_MINI,
                    max_tokens=5000,
                    temperature=0.3,
                    prompt_template='Default template for {symbol}',
                )

        payload = request.data if isinstance(request.data, dict) else {}
        metadata = dict(config.metadata or {})

        # Save to UserAICredential (BYOK SSOT) — per-user policy lives here only (Slice C)
        user_cred = self._get_or_create_user_credential(request.user)

        # Resolve current effective policy (user > system) for audit before-snapshot
        sys_refresh = int(metadata.get('advisory_refresh_interval_hours', 24))
        sys_max_auto = int(metadata.get('advisory_max_auto_refreshes_per_day', 24))
        sys_max_tokens = int(config.max_tokens)
        sys_temp = float(config.temperature)
        before_refresh = (
            user_cred.refresh_interval_hours
            if user_cred.refresh_interval_hours is not None else sys_refresh
        )
        before_max_auto = (
            user_cred.max_auto_refreshes_per_day
            if user_cred.max_auto_refreshes_per_day is not None else sys_max_auto
        )
        before_max_tokens = (
            user_cred.max_tokens_per_day
            if user_cred.max_tokens_per_day is not None else sys_max_tokens
        )
        before_temp = (
            user_cred.temperature if user_cred.temperature is not None else sys_temp
        )

        from advisory.serializers import sanitize_sensitive_fields
        before_snapshot = sanitize_sensitive_fields({
            'ai_provider': user_cred.ai_provider or '',
            'ai_model': user_cred.ai_model or config.ai_model,
            'custom_endpoint': user_cred.custom_endpoint or '',
            'effective_ai_source': metadata.get('effective_ai_source') or 'command_center',
            'ai_ready': bool(user_cred.encrypted_api_key) or user_cred.ai_provider in ('openclaw', 'local'),
            'advisory_refresh_interval_hours': int(before_refresh),
            'advisory_max_auto_refreshes_per_day': int(before_max_auto),
            'advisory_max_tokens_per_day': int(before_max_tokens),
            'temperature': float(before_temp),
        })

        # R1.9: optimistic lock — client gửi expected_updated_at lấy từ GET
        # (config_updated_at). Lệch ⇒ 409 để client tải bản mới / ghi đè có
        # chủ đích, thay vì ghi đè âm thầm. Vắng mặt ⇒ hành vi cũ (AC3).
        expected_updated_at = payload.get('expected_updated_at')
        if expected_updated_at is not None and str(expected_updated_at).strip() != '':
            from datetime import datetime as _dt
            from django.utils import timezone as _tz
            try:
                _expected = _dt.fromisoformat(str(expected_updated_at).strip())
            except (TypeError, ValueError):
                raise ValidationError({
                    'expected_updated_at': 'Dinh dang thoi gian khong hop le (ISO 8601).',
                })
            if _expected.tzinfo is None:
                _expected = _expected.replace(tzinfo=_tz.utc)
            _current = user_cred.updated_at
            # So sánh tuyệt đối (không dung sai): DB timestamptz giữ microsecond,
            # isoformat đi-về chính xác — dung sai sẽ mở lại cửa sổ mất update.
            if _current is None or _current != _expected:
                return Response(
                    {
                        'detail': 'Cau hinh da doi tu luc ban doc. Tai ban moi roi thu lai.',
                        'code': 'ai_config_conflict',
                        'current_updated_at': _current.isoformat() if _current else None,
                        'current': before_snapshot,
                    },
                    status=status.HTTP_409_CONFLICT,
                )

        if 'ai_provider' in payload:
            _raw_provider = str(payload.get('ai_provider') or '').strip().lower()
            # R0.5: provider la (copilot da go, xyz, rong) -> 400 truoc khi luu.
            # D-03 (tat claude/go openclaw khoi UI) can Owner, KHONG lam o day.
            _known = {c.value for c in UserAICredential.ProviderChoices}
            if _raw_provider not in _known:
                raise ValidationError({
                    'ai_provider': 'Nha cung cap AI khong hop le.',
                })
            user_cred.ai_provider = _raw_provider

        if 'ai_api_key' in payload:
            api_key = str(payload.get('ai_api_key') or '').strip()
            if api_key:
                from identity_access.security import encrypt_user_api_key
                user_cred.encrypted_api_key = encrypt_user_api_key(api_key)
            else:
                # F4 clear: drop stored key for BYOK providers; keep local/openclaw as-is
                if user_cred.ai_provider not in ('local', 'openclaw'):
                    user_cred.encrypted_api_key = ''

        if 'ai_model' in payload:
            user_cred.ai_model = str(payload.get('ai_model') or '').strip()

        # R0.5 — validate provider/model SAU khi cả hai đã được gán, để bắt
        # được cả hai chiều: đổi provider (giữ model cũ) và đổi model
        # (giữ provider cũ). Không có check này thì cấu hình
        # provider=gemini + model=gpt-4o-mini lọt vào DB và mọi lần
        # advisory đều fail 404 từ provider.
        if 'ai_provider' in payload or 'ai_model' in payload:
            from advisory.model_choices import validate_model_for_provider
            _provider = str(user_cred.ai_provider or '').strip().lower()
            _model = str(user_cred.ai_model or '').strip()
            _is_valid, _model_error = validate_model_for_provider(_provider, _model)
            if not _is_valid:
                raise ValidationError({'ai_model': _model_error})

        if 'custom_endpoint' in payload:
            user_cred.custom_endpoint = str(payload.get('custom_endpoint') or '').strip()

        # Per-user advisory config — write UserAICredential only, never SystemAISettings
        # F7: JSON append history on every effective prompt_config change
        prompt_config_changed = False
        if 'ai_prompt_config' in payload:
            from advisory.advisory_helpers import is_canonical_prompt_config
            pc = payload.get('ai_prompt_config')
            # R0.2: tu choi shape phang — chi nhan canonical v2. Client cu gui
            # phang se nhan 400 + tu sua theo GET (GET luon tra v2).
            if not is_canonical_prompt_config(pc):
                raise ValidationError({
                    'ai_prompt_config': 'Shape phai la canonical v2 '
                                        '{version: 2, sources: {...}}.',
                })
            new_pc = pc
            old_pc = user_cred.prompt_config if isinstance(user_cred.prompt_config, dict) else {}
            if new_pc != old_pc:
                prompt_config_changed = True
                user_cred.prompt_config = new_pc

        if 'advisory_refresh_interval_hours' in payload:
            try:
                _val = int(payload.get('advisory_refresh_interval_hours'))
            except (TypeError, ValueError):
                raise ValidationError({'advisory_refresh_interval_hours': 'Must be an integer.'})
            if not (1 <= _val <= 168):
                raise ValidationError({'advisory_refresh_interval_hours': 'Must be 1..168.'})
            user_cred.refresh_interval_hours = _val

        if 'advisory_max_auto_refreshes_per_day' in payload:
            try:
                _val = int(payload.get('advisory_max_auto_refreshes_per_day'))
            except (TypeError, ValueError):
                raise ValidationError({'advisory_max_auto_refreshes_per_day': 'Must be an integer.'})
            if not (0 <= _val <= 24):
                raise ValidationError({'advisory_max_auto_refreshes_per_day': 'Must be 0..24.'})
            user_cred.max_auto_refreshes_per_day = _val

        if 'advisory_max_tokens_per_day' in payload:
            try:
                _val = int(payload.get('advisory_max_tokens_per_day'))
            except (TypeError, ValueError):
                raise ValidationError({'advisory_max_tokens_per_day': 'Must be an integer.'})
            if not (1 <= _val <= 100000):
                raise ValidationError({'advisory_max_tokens_per_day': 'Must be 1..100000.'})
            user_cred.max_tokens_per_day = _val

        if 'temperature' in payload:
            try:
                user_cred.temperature = min(1.0, max(0.0, float(payload.get('temperature'))))
            except (TypeError, ValueError):
                pass

        user_cred.save()

        # F7: append history AFTER save so entry sees final prompt_config
        if prompt_config_changed:
            from advisory.advisory_helpers import _append_prompt_config_history
            _append_prompt_config_history(user_cred, user_cred.prompt_config, source='save')
            user_cred.save(update_fields=['prompt_config_history', 'updated_at'])

        # Create audit log — after reflects user rows (C.1.6)
        from advisory.models import AIAuditLog
        after_snapshot = sanitize_sensitive_fields({
            'ai_provider': user_cred.ai_provider or '',
            'ai_model': user_cred.ai_model or config.ai_model,
            'custom_endpoint': user_cred.custom_endpoint or '',
            'effective_ai_source': metadata.get('effective_ai_source') or 'command_center',
            'ai_ready': bool(user_cred.encrypted_api_key) or user_cred.ai_provider in ('openclaw', 'local'),
            'advisory_refresh_interval_hours': int(
                user_cred.refresh_interval_hours
                if user_cred.refresh_interval_hours is not None else sys_refresh
            ),
            'advisory_max_auto_refreshes_per_day': int(
                user_cred.max_auto_refreshes_per_day
                if user_cred.max_auto_refreshes_per_day is not None else sys_max_auto
            ),
            'advisory_max_tokens_per_day': int(
                user_cred.max_tokens_per_day
                if user_cred.max_tokens_per_day is not None else sys_max_tokens
            ),
            'temperature': float(
                user_cred.temperature if user_cred.temperature is not None else sys_temp
            ),
        })
        diff_parts = []
        for field in [
            'ai_provider', 'ai_model', 'effective_ai_source', 'custom_endpoint',
            'advisory_refresh_interval_hours', 'advisory_max_auto_refreshes_per_day',
            'advisory_max_tokens_per_day', 'temperature',
        ]:
            bv = str(before_snapshot.get(field, ''))
            av = str(after_snapshot.get(field, ''))
            if bv != av:
                diff_parts.append(f'{field}: {bv} → {av}')
        AIAuditLog.objects.create(
            action=AIAuditLog.ActionChoices.UPDATE_SETTINGS,
            actor=request.user.username,
            user=request.user,
            tenant=getattr(request, 'tenant', None),
            reason=f'Cập nhật cấu hình AI: {"; ".join(diff_parts) if diff_parts else "không có thay đổi"}.',
            before_json=before_snapshot,
            after_json=after_snapshot,
            diff_summary='; '.join(diff_parts) if diff_parts else 'Không có thay đổi',
        )

        provider = user_cred.ai_provider or 'openai'
        model = user_cred.ai_model or config.ai_model
        api_key_configured = bool(user_cred.encrypted_api_key)
        ai_ready = api_key_configured or (provider in ('openclaw', 'local'))
        from django.conf import settings as django_settings
        fallback_quota_max = getattr(django_settings, 'AI_FALLBACK_DAILY_QUOTA', 5)
        api_key_masked = ''
        if api_key_configured:
            try:
                from identity_access.security import decrypt_user_api_key
                plain_key = decrypt_user_api_key(user_cred.encrypted_api_key)
                api_key_masked = f'••••••••{plain_key[-4:]}' if len(plain_key) >= 4 else '••••••••'
            except Exception:
                api_key_masked = '••••••••'

        # R0.2: PUT cung tra canonical nhu GET (client luon thay v2 day du).
        from advisory.advisory_helpers import (
            _parse_prompt_config as _parse_pc_put,
            build_ai_readiness as _build_readiness_put,
        )
        # R0.9 lop A/B (nhu GET): template he thong chi staff thay.
        is_operator_put = bool(
            getattr(request.user, 'is_staff', False)
            or getattr(request.user, 'is_superuser', False)
        )
        response_data = {
            'ai_provider': provider,
            'ai_model': model,
            'ai_api_key': '',
            'ai_api_key_configured': api_key_configured,
            'ai_readiness': _build_readiness_put(provider, api_key_configured),
            'ai_api_key_masked': api_key_masked,
            'system_policy': {'managed_by_platform': True},
            'custom_endpoint': user_cred.custom_endpoint or '',
            'effective_ai_source': metadata.get('effective_ai_source') or 'command_center',
            'effective_ai_provider': provider,
            'effective_ai_model': model or 'Chưa cấu hình',
            'ai_ready': ai_ready,
            'ai_prompt_config': _parse_pc_put(
                user_cred.prompt_config or metadata.get('ai_prompt_config')),
            'ai_prompt_config_history': list(user_cred.prompt_config_history or []),
            'advisory_refresh_interval_hours': int(
                user_cred.refresh_interval_hours
                if user_cred.refresh_interval_hours is not None else sys_refresh
            ),
            'advisory_max_auto_refreshes_per_day': int(
                user_cred.max_auto_refreshes_per_day
                if user_cred.max_auto_refreshes_per_day is not None else sys_max_auto
            ),
            'advisory_max_tokens_per_day': int(
                user_cred.max_tokens_per_day
                if user_cred.max_tokens_per_day is not None else sys_max_tokens
            ),
            'temperature': float(
                user_cred.temperature if user_cred.temperature is not None else sys_temp
            ),
            'fallback_quota_remaining': user_cred.fallback_quota_remaining,
            'fallback_quota_max': fallback_quota_max,
            'fallback_quota_reset': user_cred.fallback_quota_date,
            # R1.10 AC1: nhãn đúng nghĩa + nguồn quota.
            'fallback_quota_used_today': user_cred.fallback_quota_used_today,
            'fallback_quota_source': 'personal_key' if api_key_configured else 'system',
            # R1.9: token mới sau mỗi lần lưu — client dùng cho PUT kế tiếp.
            'config_updated_at': (
                user_cred.updated_at.isoformat() if user_cred.updated_at else None
            ),
        }
        if is_operator_put:
            response_data['system_prompt_template'] = config.prompt_template or ''
        return envelope(response_data)


@extend_schema(
    summary='PortfolioAICommandCenterPolicyView (native route)',
    description='Lop B he thong (R0.9, D-01): chi staff. GET tra cau hinh he thong '
                '(system prompt template + system model); PUT cho staff sua template.',
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class PortfolioAICommandCenterPolicyView(APIView):
    """GET/PUT /workspace/ai-command-center/policy/ — staff-only.

    R0.9 + SAFE-04: `required_workspace_permission` khai tren CLASS de gate
    AST (`test_capability_matrix_pav.py`) thay; `IsAdminUser` la lop khoa
    that (staff-only). Ca hai phai xanh — thieu 1 la do hoac hong.
    """
    permission_classes = [permissions.IsAuthenticated, WorkspacePermission, permissions.IsAdminUser]
    required_workspace_permission = 'broker_manage'

    def _get_config(self):
        from advisory.models import SystemAISettings

        config = SystemAISettings.objects.filter(is_active=True).order_by('-updated_at').first()
        if config is None:
            config = SystemAISettings.objects.order_by('-updated_at').first()
        return config

    def get(self, request):
        from rest_framework.exceptions import NotFound

        config = self._get_config()
        if config is None:
            raise NotFound('Chua co cau hinh AI he thong.')
        return envelope({
            'system_prompt_template': config.prompt_template or '',
            'system_model': config.ai_model or '',
            'managed_by_platform': True,
        })

    def put(self, request):
        from vninvest_core.exceptions import ValidationErrorException
        from advisory.models import AIAuditLog

        config = self._get_config()
        if config is None:
            raise ValidationErrorException(
                detail='Chua co cau hinh AI he thong.',
                code='validation_error',
            )
        payload = request.data if isinstance(request.data, dict) else {}
        template = payload.get('system_prompt_template')
        if template is not None and not isinstance(template, str):
            raise ValidationErrorException(
                detail='system_prompt_template phai la chuoi.',
                code='validation_error',
            )
        if template is not None:
            config.prompt_template = template
            config.save(update_fields=['prompt_template', 'updated_at'])
            AIAuditLog.objects.create(
                action=AIAuditLog.ActionChoices.UPDATE_SETTINGS,
                actor=request.user.username,
                user=request.user,
                tenant=getattr(request, 'tenant', None),
                reason='Staff cap nhat system prompt template (policy).',
                before_json={},
                after_json={'system_prompt_template_updated': True},
                diff_summary='policy: system_prompt_template updated by staff',
            )
        return envelope({
            'system_prompt_template': config.prompt_template or '',
            'system_model': config.ai_model or '',
            'managed_by_platform': True,
        })


@extend_schema(
    summary='PortfolioAICommandCenterPromptConfigRollbackView (native route)',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. The real payload shape is checked by test_flat_views_are_not_documented_as_envelope.',
    # This class has a body-carrying method, so the REQUEST side must be typed too;
    # responses= alone still yields the unguessable-serializer error.
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class PortfolioAICommandCenterPromptConfigRollbackView(APIView):
    """POST /workspace/ai-command-center/prompt-config/rollback/ — F7 F-AC7.

    Body: {"version": int} — restore that snapshot into prompt_config and
    append a history entry with source='rollback'. Full config returned in
    history[i].config so GET alone is enough to inspect any version.
    """
    permission_classes = [permissions.IsAuthenticated, WorkspacePermission]
    required_workspace_permission = 'portfolio_write'

    def post(self, request):
        from advisory.models import SystemAISettings, UserAICredential
        from advisory.advisory_helpers import _append_prompt_config_history
        from vninvest_core.exceptions import ValidationErrorException

        payload = request.data if isinstance(request.data, dict) else {}
        try:
            version = int(payload.get('version'))
        except (TypeError, ValueError):
            raise ValidationErrorException(detail='version must be an integer')

        try:
            user_cred = UserAICredential.objects.get(user=request.user)
        except UserAICredential.DoesNotExist:
            raise ValidationErrorException(detail='No prompt config history for this user')

        history = list(user_cred.prompt_config_history or [])
        match = next((h for h in history if int(h.get('version', -1)) == version), None)
        if not match:
            raise ValidationErrorException(detail=f'Prompt config version {version} not found')

        restored = match.get('config') if isinstance(match.get('config'), dict) else {}
        user_cred.prompt_config = restored
        _append_prompt_config_history(user_cred, restored, source='rollback')
        user_cred.save(update_fields=['prompt_config', 'prompt_config_history', 'updated_at'])

        from advisory.models import AIAuditLog
        from advisory.serializers import sanitize_sensitive_fields
        AIAuditLog.objects.create(
            action=AIAuditLog.ActionChoices.UPDATE_SETTINGS,
            actor=request.user.username,
            user=request.user,
            tenant=getattr(request, 'tenant', None),
            reason=f'Rollback prompt config về version {version} (source=rollback).',
            before_json=sanitize_sensitive_fields({'prompt_config': None}),
            after_json=sanitize_sensitive_fields({'prompt_config_version': version}),
            diff_summary=f'prompt_config rollback → v{version}',
        )

        config = SystemAISettings.objects.filter(is_active=True).order_by('-updated_at').first()
        metadata = dict(config.metadata) if config else {}
        return envelope({
            'ai_prompt_config': user_cred.prompt_config or metadata.get('ai_prompt_config'),
            'ai_prompt_config_history': list(user_cred.prompt_config_history or []),
            'rolled_back_to': version,
        })


@extend_schema(
    summary='PortfolioAICommandCenterTestView (native route)',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. The real payload shape is checked by test_flat_views_are_not_documented_as_envelope.',
    # This class has a body-carrying method, so the REQUEST side must be typed too;
    # responses= alone still yields the unguessable-serializer error.
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class PortfolioAICommandCenterTestView(APIView):
    """POST /api/portfolio/ai-command-center/test-connection/
    
    Active Probe: gọi API thực tế đến provider để kiểm tra kết nối.
    - openclaw: system default, không cần key
    - local: gọi GET /models đến custom_endpoint hoặc localhost
    - openai/gemini/claude: gửi 1 tin nhắn test tối thiểu
    """
    permission_classes = [permissions.IsAuthenticated, WorkspacePermission]
    required_workspace_permission = 'broker_manage'
    throttle_classes = [AIEndpointProbeThrottle]

    def post(self, request):
        from vninvest_core.exceptions import ValidationErrorException
        from advisory.models import AIAuditLog
        import httpx

        payload = request.data if isinstance(request.data, dict) else {}
        provider = str(payload.get('ai_provider') or '').strip().lower()
        model = str(payload.get('ai_model') or '').strip()
        api_key = str(payload.get('ai_api_key') or '').strip()
        custom_endpoint = str(payload.get('custom_endpoint') or '').strip()

        if not provider:
            raise ValidationErrorException(detail='Vui lòng chọn Nhà cung cấp AI hợp lệ.', code='validation_error')
        if not model:
            raise ValidationErrorException(detail='Vui lòng chọn hoặc cấu hình Mô hình AI.', code='validation_error')

        # Helper to write audit logs
        def _log_test(audit_action, message):
            AIAuditLog.objects.create(
                action=audit_action,
                actor=request.user.username,
                user=request.user,
                tenant=getattr(request, 'tenant', None),
                reason=message,
                before_json={},
                after_json={'ai_provider': provider, 'ai_model': model, 'status': 'success' if 'SUCCESS' in audit_action else 'failed'},
                diff_summary=f'Test connection {provider}/{model}: {message}',
            )

        # openclaw: system default, luôn ready
        if provider == 'openclaw':
            _log_test(AIAuditLog.ActionChoices.TEST_CONNECTION_SUCCESS, 'OpenClaw mặc định luôn sẵn sàng.')
            return envelope({
                'message': f'Kết nối đến OpenClaw (Default) với mô hình {model} thành công. Phản hồi mượt mà.',
                'latency_ms': 0,
            })

        # local: active probe đến endpoint Ollama/vLLM
        if provider == 'local':
            endpoint = custom_endpoint.rstrip('/') if custom_endpoint else 'http://localhost:11434/v1'
            # P0-3 (audit Entry 228): custom_endpoint is user-controlled and was
            # passed straight to httpx, so any authenticated user could make this
            # server GET internal-only addresses. Validate before the outbound
            # call, not after. `local` is the only provider allowed to reach
            # loopback — a co-located Ollama/vLLM is the point of that provider —
            # but 169.254.169.254 (instance metadata), RFC1918, and non-HTTP
            # schemes stay blocked even here.
            try:
                assert_safe_outbound_url(endpoint, allow_loopback=True)
            except UnsafeEndpointError as exc:
                _log_test(
                    AIAuditLog.ActionChoices.TEST_CONNECTION_FAILED,
                    f'Local Model endpoint bị chặn: {exc}',
                )
                # R0.6 AC5: message loi KHONG echo endpoint user nhap.
                # Hint van hanh (ten bien env phia may chu) du de operator
                # hanh dong ma khong lo dia chi bi chan.
                raise ValidationErrorException(
                    detail=(
                        'Endpoint bị chặn vì lý do an toàn (SSRF). '
                        'Nếu đây là endpoint on-prem hợp lệ, cấu hình '
                        'SOC_AI_ALLOWED_ENDPOINT_HOSTS phía máy chủ.'
                    ),
                    code='validation_error',
                )
            models_url = f'{endpoint}/models'
            try:
                with httpx.Client(timeout=5.0) as client:
                    resp = client.get(models_url)
                    resp.raise_for_status()
                    data = resp.json()
                    models_list = [m.get('name', m.get('id', '')) for m in (data.get('data') or data.get('models') or [])]
                    _log_test(AIAuditLog.ActionChoices.TEST_CONNECTION_SUCCESS, f'Local Model {endpoint} kết nối thành công.')
                    return envelope({
                        'message': f'Kết nối đến Local Model ({endpoint}) thành công. Mô hình khả dụng: {", ".join(models_list[:5]) or "N/A"}.',
                        'endpoint': endpoint,
                        'models_available': models_list,
                        'latency_ms': int(resp.elapsed.total_seconds() * 1000),
                    })
            except httpx.TimeoutException:
                _log_test(AIAuditLog.ActionChoices.TEST_CONNECTION_FAILED, 'Local Model timeout 5s.')
                raise ValidationErrorException(
                    detail='Không thể kết nối đến Local Model — timeout 5s. Kiểm tra endpoint hoặc khởi động Ollama/vLLM.',
                    code='validation_error',
                )
            except httpx.HTTPStatusError as e:
                _log_test(AIAuditLog.ActionChoices.TEST_CONNECTION_FAILED, f'Local Model HTTP {e.response.status_code}.')
                raise ValidationErrorException(
                    detail=f'Local Model trả về lỗi HTTP {e.response.status_code}.',
                    code='validation_error',
                )
            except Exception as e:
                # R0.6 AC8: KHONG str(e) raw — co the chua Traceback/httpx.*
                # Chi luu ten lop exception de van hanh, khong tra cho user.
                _log_test(AIAuditLog.ActionChoices.TEST_CONNECTION_FAILED, f'Local Model loi {type(e).__name__}.')
                raise ValidationErrorException(
                    detail='Không thể kết nối Local Model. Kiểm tra endpoint hoặc khởi động Ollama/vLLM.',
                    code='validation_error',
                )

        # OpenAI/Gemini/Claude: active probe thực tế
        # Resolve key: ưu tiên payload, fallback UserAICredential, fallback SystemAISettings
        resolved_key = api_key
        if not resolved_key:
            from advisory.models import UserAICredential, SystemAISettings
            try:
                user_cred = UserAICredential.objects.get(user=request.user)
                if user_cred.encrypted_api_key:
                    from identity_access.security import decrypt_user_api_key
                    resolved_key = decrypt_user_api_key(user_cred.encrypted_api_key)
            except UserAICredential.DoesNotExist:
                pass

        if not resolved_key:
            from advisory.models import SystemAISettings
            config = SystemAISettings.objects.filter(is_active=True).order_by('-updated_at').first()
            if config and config.metadata:
                sys_encrypted = config.metadata.get('encrypted_api_key', '')
                if sys_encrypted:
                    from identity_access.security import decrypt_user_api_key
                    resolved_key = decrypt_user_api_key(sys_encrypted)

        if not resolved_key:
            _log_test(AIAuditLog.ActionChoices.TEST_CONNECTION_FAILED, f'Thiếu API Key cho {provider}/{model}.')
            raise ValidationErrorException(
                detail=f'Lỗi kết nối đến {provider}: Thiếu API Key cho mô hình {model}. Vui lòng cấu hình API Key trong AI Command Center.',
                code='validation_error',
            )

        # Determine endpoint
        if provider == 'gemini':
            endpoint = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
        else:
            endpoint = "https://api.openai.com/v1/chat/completions"

        test_payload = {
            "model": model,
            "messages": [
                {"role": "user", "content": "Hello, respond with just 'OK'."}
            ],
            "max_tokens": 10,
            "temperature": 0.0,
        }
        headers = {
            "Authorization": f"Bearer {resolved_key}",
            "Content-Type": "application/json",
        }

        try:
            with httpx.Client(timeout=10.0) as client:
                start = __import__('time').time()
                resp = client.post(endpoint, headers=headers, json=test_payload)
                resp.raise_for_status()
                latency_ms = int((__import__('time').time() - start) * 1000)
                _log_test(AIAuditLog.ActionChoices.TEST_CONNECTION_SUCCESS, f'{provider}/{model} kết nối thành công ({latency_ms}ms).')
                return envelope({
                    'message': f'Kiểm tra kết nối thành công: Đã xác thực API Key với {provider} / {model}. Phản hồi trong {latency_ms}ms.',
                    'latency_ms': latency_ms,
                })
        except httpx.TimeoutException:
            _log_test(AIAuditLog.ActionChoices.TEST_CONNECTION_FAILED, f'{provider}/{model} timeout 10s.')
            raise ValidationErrorException(
                detail=f'Kết nối đến {provider} timeout sau 10s. Kiểm tra API Key hoặc mạng.',
                code='validation_error',
            )
        except httpx.HTTPStatusError as e:
            status_code = e.response.status_code
            if status_code == 401:
                _log_test(AIAuditLog.ActionChoices.TEST_CONNECTION_FAILED, f'{provider}/{model} từ chối API Key (HTTP 401).')
                raise ValidationErrorException(
                    detail=f'{provider} từ chối API Key (HTTP 401). Kiểm tra lại API Key cho mô hình {model}.',
                    code='validation_error',
                )
            _log_test(AIAuditLog.ActionChoices.TEST_CONNECTION_FAILED, f'{provider}/{model} HTTP {status_code}.')
            raise ValidationErrorException(
                detail=f'{provider} trả về lỗi HTTP {status_code} cho mô hình {model}.',
                code='validation_error',
            )
        except Exception as e:
            # R0.6 AC8: KHONG str(e) raw o message tra cho user.
            _log_test(AIAuditLog.ActionChoices.TEST_CONNECTION_FAILED, f'{provider}/{model}: loi {type(e).__name__}.')
            raise ValidationErrorException(
                detail=f'Lỗi kết nối đến {provider} cho mô hình {model}. Vui lòng thử lại sau.',
                code='validation_error',
            )


@extend_schema(
    summary='PortfolioAICommandCenterAuditLogView (native route)',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. The real payload shape is checked by test_flat_views_are_not_documented_as_envelope.',
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class PortfolioAICommandCenterAuditLogView(APIView):
    """GET /workspace/ai-command-center/audit-logs/

    Trả về audit logs với pagination, filter theo action/actor/date range.

    R0.11 — `AIAuditLog` không có FK user/tenant, chỉ có `actor` (CharField,
    ghi bằng `request.user.username`). Trước đây `queryset = AIAuditLog.objects.all()`
    với `IsAuthenticated` nghĩa là BẤT KỲ user đăng nhập nào cũng đọc được log
    cấu hình AI của user khác (bao gồm `before_json`/`after_json` đã mask
    nhưng vẫn lộ metadata cấu hình). Nay scope theo actor, chỉ staff mới
    xem được toàn bộ.
    R0.7 — scope theo FK that: user thuong chi thay log cua minh (user FK +
    dong legacy trung actor cua minh); staff loc theo tenant qua hint
    `X-Tenant-ID`/`?tenant=` (SSOT `resolve_tenant_for_user`, fail-closed:
    hint ro nhung khong co membership => thay nothing); `?actor=` doi sang
    exact match (icontains bien `admin` thanh oracle do `administrator`).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.db.models import Q

        from advisory.models import AIAuditLog
        from advisory.serializers import AIAuditLogSerializer

        queryset = AIAuditLog.objects.all()

        # R0.11 — chỉ superuser/staff được xem log toàn hệ thống.
        is_operator = bool(
            getattr(request.user, 'is_superuser', False)
            or getattr(request.user, 'is_staff', False)
        )
        if not is_operator:
            # R0.7 AC1: user FK that + nhin lai dong legacy (user NULL) trung
            # actor cua minh. Dong legacy cua user khac van khong thay.
            queryset = queryset.filter(
                Q(user=request.user)
                | Q(user__isnull=True, actor=request.user.username)
            )

        action = request.query_params.get('action', '').strip()
        if action:
            queryset = queryset.filter(action=action)

        actor = request.query_params.get('actor', '').strip()
        if actor:
            # User không phải operator không được lọc sang actor khác để dò
            # ra log ngoài phạm vi của mình.
            if is_operator or actor == request.user.username:
                # R0.7 AC4: exact match — icontains bien ?actor=admin thanh
                # oracle do duoc log cua administrator.
                queryset = queryset.filter(actor=actor)
            else:
                queryset = queryset.none()

        if is_operator:
            # R0.7 AC2: staff loc theo tenant. Hint qua SSOT membership check;
            # khong hint => giu hanh vi operator toan he thong cu (R0.11).
            queryset = self._scope_operator_by_tenant(request, queryset)

        date_from = request.query_params.get('date_from', '').strip()
        if date_from:
            queryset = queryset.filter(created_at__gte=date_from)

        date_to = request.query_params.get('date_to', '').strip()
        if date_to:
            queryset = queryset.filter(created_at__lte=date_to)

        try:
            limit = min(int(request.query_params.get('limit', 10)), 100)
        except (TypeError, ValueError):
            limit = 10
        try:
            offset = max(int(request.query_params.get('offset', 0)), 0)
        except (TypeError, ValueError):
            offset = 0

        total = queryset.count()
        # R0.7: so ban ghi legacy chua gan chu trong pham vi dang xem —
        # FE hien thi "N ban ghi (M ban ghi legacy chua gan)".
        legacy_unattributed_count = queryset.filter(legacy_unattributed=True).count()
        logs = queryset[offset:offset + limit]
        serializer = AIAuditLogSerializer(logs, many=True)

        return paginated_envelope({
            'results': serializer.data,
            'total': total,
            'legacy_unattributed_count': legacy_unattributed_count,
            'limit': limit,
            'offset': offset,
        })

    @staticmethod
    def _scope_operator_by_tenant(request, queryset):
        """Scope staff theo tenant qua hint, fail-closed khi hint la (R0.7 AC2).

        Hint tu `X-Tenant-ID` (uu tien) hoac `?tenant=`, di qua SSOT
        `resolve_tenant_for_user` (membership check, khong tu che resolver).
        - Hint hop le + co membership => chi log cua tenant do.
        - Hint ro nhung khong co membership => thay nothing (khong fallback
          ve toan he thong — do chinh la oracle can dong).
        - Khong hint => giu hanh vi operator toan he thong cu (R0.11).
        """
        from identity_access.utils.resolve_tenant import (
            is_plausible_tenant_public_id,
            resolve_tenant_for_user,
        )

        hint = (
            request.headers.get('X-Tenant-ID', '').strip()
            or request.query_params.get('tenant', '').strip()
        )
        if not hint:
            return queryset
        if not is_plausible_tenant_public_id(hint):
            return queryset.none()
        tenant, _role = resolve_tenant_for_user(request.user, hint)
        if tenant is None:
            return queryset.none()
        return queryset.filter(tenant=tenant)


@extend_schema(
    summary='PortfolioUserConfigLegacyView (native route)',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. The real payload shape is checked by test_flat_views_are_not_documented_as_envelope.',
    # This class has a body-carrying method, so the REQUEST side must be typed too;
    # responses= alone still yields the unguessable-serializer error.
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class PortfolioUserConfigLegacyView(APIView):
    """GET /workspace/userconfig/ — proxy đến identity_access.UserProfile

    Cung cấp event gate status (advisory_whale_signal_enabled) cho SaaS frontend.
    """
    permission_classes = [permissions.IsAuthenticated, WorkspacePermission]
    required_workspace_permission = 'portfolio_write'

    def get(self, request):
        from identity_access.models import UserProfile
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        prefs = profile.preferences or {}
        return envelope({
            'id': profile.pk,
            'language': profile.language,
            'theme': profile.theme,
            'preferences': prefs,
            'advisory_whale_signal_enabled': prefs.get('advisory_whale_signal_enabled', True),
        })

    def patch(self, request):
        from identity_access.models import UserProfile
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        prefs = profile.preferences or {}

        if 'advisory_whale_signal_enabled' in request.data:
            prefs['advisory_whale_signal_enabled'] = bool(request.data['advisory_whale_signal_enabled'])

        profile.preferences = prefs
        profile.save(update_fields=['preferences'])

        return envelope({
            'ok': True,
            'preferences': prefs,
            'advisory_whale_signal_enabled': prefs.get('advisory_whale_signal_enabled', True),
        })


@extend_schema(
    summary='Lấy market discovery hub',
    description=(
        'Endpoint native `/core/v1/portfolio/market-discovery-hub/`. '
        'Frontend `getMarketDiscoveryHub()` goi route nay o discovery mode; '
        'trả `hub` rỗng cho tới khi co native co discovery pipeline.'
    ),
    responses={
        200: envelope_response(),
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class PortfolioMarketDiscoveryHubView(APIView):
    """GET /api/portfolio/market-discovery-hub/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return envelope({'hub': [], 'note': 'market_discovery_not_available_in_native'})


@extend_schema(
    summary='Lấy canonical AI advisory cho một mã',
    description=(
        'Endpoint native `/core/v1/portfolio/ai-advisory/{symbol}/canonical/`. '
        'Delegate sang `AdvisoryLatestView` nên payload giống hệt '
        '`/core/v1/advisory/latest/{symbol}/`.'
    ),
    parameters=[
        OpenApiParameter(
            name='symbol',
            type=OpenApiTypes.STR,
            location=OpenApiParameter.PATH,
            required=True,
            description='Mã chứng khoán, ví dụ `TPB` hoặc `VCB`.',
        ),
    ],
    responses={
        200: envelope_response(),
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class PortfolioAIAdvisoryCanonicalView(APIView):
    """GET /api/portfolio/ai-advisory/<symbol>/canonical/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        from advisory.views import AdvisoryLatestView
        return adopt_envelope(
            AdvisoryLatestView.as_view()(_unwrap_django_request(request), symbol=symbol.upper())
        )


class PortfolioWhaleAnalyticsView(APIView):
    """GET /api/portfolio/whale/analytics/<symbol>/"""
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary='Lấy snapshot whale analytics facts-first cho một symbol',
        description=(
            'Endpoint native `/core/v1/workspace/whale-analytics/{symbol}/`. '
            'Compose snapshot lower-deck từ `WhaleAlertCanonical`, `SessionFacts`, '
            '`SessionFactsBucket`, `SymbolSnapshot`, và `DailyPrice`.'
        ),
        parameters=[
            OpenApiParameter(
                name='symbol',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.PATH,
                description='Mã chứng khoán, ví dụ `TPB` hoặc `VCB`.',
                required=True,
            ),
            OpenApiParameter(
                name='timeframe',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description='Khung thời gian: `15m`, `30m`, `1h`, `morning`, `afternoon`, `session`.',
                required=False,
                enum=['15m', '30m', '1h', 'morning', 'afternoon', 'session'],
            ),
            OpenApiParameter(
                name='trade_date',
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
                description='Ngày phiên theo định dạng YYYY-MM-DD.',
                required=False,
            ),
            OpenApiParameter(
                name='limit',
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                description='Giới hạn số whale orders trả về khi caller muốn cắt viewport payload.',
                required=False,
            ),
        ],
        responses={
            200: envelope_response(),
            401: OpenApiTypes.OBJECT,
        },
        examples=[
            OpenApiExample(
                'TPB session snapshot',
                value={
                    'symbol': 'TPB',
                    'trade_date': '2026-05-20',
                    'timeframe': 'session',
                    'axis': {
                        'window_start': '2026-05-20T09:00:00+07:00',
                        'window_end': '2026-05-20T15:00:00+07:00',
                    },
                    'bubble_series': [
                        {
                            'ts': '2026-05-20T09:31:00+07:00',
                            'bucket_ts': '2026-05-20T09:31:00+07:00',
                            'price': 18.42,
                            'volume': 100000,
                            'matched_value': 1850000000.0,
                            'side': 'buy',
                        }
                    ],
                    'flow_series': {
                        'cvd': [
                            {
                                'bucket_ts': '2026-05-20T09:30:00+07:00',
                                'value': 350000000.0,
                            }
                        ],
                        'buy_strength': [
                            {
                                'bucket_ts': '2026-05-20T09:30:00+07:00',
                                'value': 61.5,
                                'confidence': 'medium',
                            }
                        ],
                        'institutional_strength': [
                            {
                                'bucket_ts': '2026-05-20T09:30:00+07:00',
                                'value': 74.2,
                                'confidence': 'high',
                            }
                        ],
                        'speed': [],
                    },
                    'quality_flags': {
                        'has_flow_data': True,
                        'contract_version': 'core-whale-compat-v1',
                    },
                },
            ),
        ],
    )
    def get(self, request, symbol):
        from market_data.models import DailyPrice
        from market_serving.models import SymbolSnapshot
        from market_serving.views import (
            _get_materialized_session_fact_buckets,
            _get_materialized_session_facts,
            _parse_trade_date_param,
        )
        from signal_intelligence.models import WhaleAlertCanonical

        symbol = symbol.upper()
        timeframe = str(request.query_params.get('timeframe', 'session') or 'session').strip().lower()
        if timeframe not in _WHALE_ANALYTICS_TIMEFRAMES:
            timeframe = 'session'

        requested_trade_date = _parse_trade_date_param(request)
        explicit_limit = request.query_params.get('limit')
        limit = None
        if explicit_limit not in (None, ''):
            try:
                limit = min(max(int(explicit_limit), 1), 2000)
            except (TypeError, ValueError):
                limit = 200

        facts = _get_materialized_session_facts(symbol, trade_date=requested_trade_date)
        latest_whale_session = (
            WhaleAlertCanonical.objects
            .filter(symbol=symbol)
            .order_by('-session_date')
            .values_list('session_date', flat=True)
            .first()
        )
        resolved_trade_date = requested_trade_date or getattr(facts, 'session_date', None) or latest_whale_session or timezone.localdate()
        if facts is None or facts.session_date != resolved_trade_date:
            facts = _get_materialized_session_facts(symbol, trade_date=resolved_trade_date)

        whale_rows = list(
            WhaleAlertCanonical.objects
            .select_related('alert')
            .filter(symbol=symbol, session_date=resolved_trade_date)
            .order_by('executed_at', 'alert_id')
        )

        preferred_bucket_window = _resolve_whale_bucket_window(timeframe)
        bucket_rows = []
        resolved_bucket_window = preferred_bucket_window
        if facts is not None:
            bucket_rows, resolved_bucket_window = _resolve_bucket_rows_with_fallback(
                facts,
                preferred_bucket_window,
                _get_materialized_session_fact_buckets,
            )

        window_start, window_end = _resolve_whale_time_bounds(
            resolved_trade_date,
            timeframe,
            whale_rows,
            bucket_rows,
        )

        filtered_whale_rows = [
            row for row in whale_rows
            if _datetime_in_bounds(row.executed_at, window_start, window_end)
        ]
        if limit is not None:
            filtered_whale_rows = filtered_whale_rows[-limit:]

        filtered_bucket_rows = [
            row for row in bucket_rows
            if _datetime_in_bounds(row.get('bucket_ts'), window_start, window_end)
        ]

        snapshot_row = (
            SymbolSnapshot.objects
            .filter(symbol=symbol, session_date=resolved_trade_date)
            .order_by('-session_date', '-fetched_at', '-pk')
            .first()
        )
        current_daily = DailyPrice.objects.filter(symbol=symbol, date=resolved_trade_date).order_by('-date').first()
        previous_daily = DailyPrice.objects.filter(symbol=symbol, date__lt=resolved_trade_date).order_by('-date').first()

        reference_price = None
        if snapshot_row is not None and snapshot_row.reference_price is not None:
            reference_price = float(snapshot_row.reference_price)
        elif snapshot_row is not None and snapshot_row.price is not None and snapshot_row.price_change is not None:
            reference_price = float(snapshot_row.price) - float(snapshot_row.price_change)
        elif previous_daily is not None and previous_daily.close is not None:
            reference_price = float(previous_daily.close)
        elif current_daily is not None and current_daily.open is not None:
            reference_price = float(current_daily.open)

        latest_price = None
        if snapshot_row is not None and snapshot_row.price is not None:
            latest_price = float(snapshot_row.price)
        elif current_daily is not None and current_daily.close is not None:
            latest_price = float(current_daily.close)

        price_points = {}
        bubble_series = []
        whale_analytics = []
        for row in filtered_whale_rows:
            occurred_at = _ensure_localized_datetime(row.executed_at)
            if occurred_at is None:
                continue
            occurred_bucket = occurred_at.replace(second=0, microsecond=0)
            alert_metadata = row.alert.metadata if isinstance(row.alert.metadata, dict) else {}
            matched_value = float(row.matched_value or row.alert.value or 0)
            price_value = float(row.price or 0)
            delta_pct = 0.0
            if reference_price not in (None, 0):
                delta_pct = round(((price_value - reference_price) / reference_price) * 100.0, 4)

            bubble_series.append({
                'ts': occurred_at.isoformat(),
                'bucket_ts': occurred_bucket.isoformat(),
                'price': price_value,
                'volume': int(row.volume or 0),
                'matched_value': matched_value,
                'side': str(row.side or '').lower(),
                'is_extreme': matched_value >= 5_000_000_000,
                'is_whale': matched_value >= 1_000_000_000,
                'delta_pct': delta_pct,
                'event_score': alert_metadata.get('event_score'),
                'threshold': float(alert_metadata.get('threshold') or 0.0),
                'matched_value_percentile_10d': alert_metadata.get('session_percentile'),
                'baseline_sample_size': (alert_metadata.get('baseline_context') or {}).get('sample_size'),
            })
            price_points[occurred_bucket.isoformat()] = {
                'bucket_ts': occurred_bucket.isoformat(),
                'price': price_value,
                'reference_price': reference_price,
                'delta_pct': delta_pct,
            }
            whale_analytics.append({
                'id': str(row.alert.alert_id),
                'type': row.alert.alert_type,
                'severity': row.alert.severity,
                'direction': row.alert.direction,
                'value': str(row.alert.value) if row.alert.value is not None else None,
                'triggered_at': _isoformat_local(row.alert.triggered_at),
            })

        if not price_points and latest_price is not None:
            terminal_bucket = window_end.replace(second=0, microsecond=0)
            delta_pct = 0.0
            if reference_price not in (None, 0):
                delta_pct = round(((latest_price - reference_price) / reference_price) * 100.0, 4)
            price_points[terminal_bucket.isoformat()] = {
                'bucket_ts': terminal_bucket.isoformat(),
                'price': latest_price,
                'reference_price': reference_price,
                'delta_pct': delta_pct,
            }

        flow_series = {
            'cvd': [],
            'buy_strength': [],
            'institutional_strength': [],
            'speed': [],
        }
        for bucket_row in filtered_bucket_rows:
            bucket_ts_iso = _isoformat_local(bucket_row.get('bucket_ts'))
            if bucket_ts_iso is None:
                continue
            flow_series['cvd'].append({
                'bucket_ts': bucket_ts_iso,
                'value': float(bucket_row.get('cumulative_cvd') or 0),
            })
            flow_series['buy_strength'].append({
                'bucket_ts': bucket_ts_iso,
                'value': float(bucket_row.get('buy_strength') or 0),
                'confidence': _strength_confidence(bucket_row.get('buy_strength')),
            })
            flow_series['institutional_strength'].append({
                'bucket_ts': bucket_ts_iso,
                'value': float(bucket_row.get('institutional_strength') or 0),
                'confidence': _strength_confidence(bucket_row.get('institutional_strength')),
            })

        # Fallback path: if materialized SessionFacts buckets are missing, reconstruct a
        # minimal CVD series from canonical whale events so the chart can stay functional.
        if not flow_series['cvd'] and bubble_series:
            bucket_delta_map = {}
            for event_row in bubble_series:
                bucket_ts = event_row.get('bucket_ts')
                if not bucket_ts:
                    continue
                matched_value = float(event_row.get('matched_value') or 0)
                side = str(event_row.get('side') or '').lower()
                if side == 'buy':
                    delta_value = matched_value
                elif side == 'sell':
                    delta_value = -matched_value
                else:
                    delta_value = 0.0
                bucket_delta_map[bucket_ts] = bucket_delta_map.get(bucket_ts, 0.0) + delta_value

            running_cvd = 0.0
            for bucket_ts in sorted(bucket_delta_map.keys()):
                running_cvd += bucket_delta_map[bucket_ts]
                flow_series['cvd'].append({
                    'bucket_ts': bucket_ts,
                    'value': running_cvd,
                })

        session_high = None
        session_low = None
        if snapshot_row is not None:
            session_high = float(snapshot_row.high) if snapshot_row.high is not None else None
            session_low = float(snapshot_row.low) if snapshot_row.low is not None else None
        if session_high is None and current_daily is not None and current_daily.high is not None:
            session_high = float(current_daily.high)
        if session_low is None and current_daily is not None and current_daily.low is not None:
            session_low = float(current_daily.low)
        if session_high is None and bubble_series:
            session_high = max(item['price'] for item in bubble_series)
        if session_low is None and bubble_series:
            session_low = min(item['price'] for item in bubble_series)

        has_flow_data = bool(flow_series['cvd'])
        has_bubble_data = bool(bubble_series)
        stale_reason = None
        if not has_flow_data:
            stale_reason = 'missing_session_facts'
        elif reference_price in (None, 0):
            stale_reason = 'missing_reference_price'

        return envelope({
            'symbol': symbol,
            'trade_date': resolved_trade_date.isoformat(),
            'timeframe': timeframe,
            'axis': {
                'window_start': window_start.isoformat(),
                'window_end': window_end.isoformat(),
            },
            'bubble_series': bubble_series,
            'price_series': list(price_points.values()),
            'flow_series': flow_series,
            'flow_compare_series': [],
            'heatmap_series': [],
            'marker_series': [],
            'session_levels': {
                'reference_price': reference_price,
                'high_price': session_high,
                'low_price': session_low,
                'ceiling_price': float(snapshot_row.ceiling) if snapshot_row is not None and snapshot_row.ceiling is not None else None,
                'floor_price': float(snapshot_row.floor) if snapshot_row is not None and snapshot_row.floor is not None else None,
            },
            'summary': {
                'whale_order_count': len(bubble_series),
                'extreme_order_count': sum(1 for item in bubble_series if item.get('is_extreme')),
            },
            'session_context': {
                'default_trade_date': resolved_trade_date.isoformat(),
                'selected_trade_date': resolved_trade_date.isoformat(),
                'latest_valid_trade_date': resolved_trade_date.isoformat(),
                'quality_state': 'READY' if has_flow_data else 'DEGRADED_FLOW_MISSING',
            },
            'quality_flags': {
                'has_flow_data': has_flow_data,
                'has_heatmap_data': False,
                'contract_version': 'core-whale-compat-v1',
                'cache_key_version': 'core-whale-compat-v1',
                'degraded_reason': stale_reason,
            },
            'materialization': {
                'source': 'core_materialized_session_facts' if facts is not None else 'canonical_event_store',
                'read_path': 'facts_first' if facts is not None else 'canonical_fallback',
                'freshness_state': 'stale' if ((facts is not None and facts.stale) or (snapshot_row is not None and snapshot_row.stale)) else 'fresh',
                'session_summary_state': 'complete' if facts is not None else 'empty',
                'raw_fallback_used': facts is None,
                'bucket_count': len(filtered_bucket_rows),
                'bucket_fact_count': len(filtered_bucket_rows),
                'tick_count': len(filtered_whale_rows),
                'bucket_window': resolved_bucket_window,
            },
            'session_summary': {
                'selected_trade_date': resolved_trade_date.isoformat(),
                'session_summary_state': 'complete' if facts is not None else 'empty',
            },
            'whale_analytics': whale_analytics,
        }, meta={
            # B5: provenance đã có sẵn từ trước B5, chuyển lên `meta` của
            # envelope thay vì để lại trong `data`. Nội dung **không đổi**, nên
            # client đọc `meta.is_stale` ở top-level vẫn thấy đúng giá trị cũ.
            'data_state': 'snapshot',
            'degraded_mode': not has_flow_data,
            'is_stale': bool((facts is not None and facts.stale) or (snapshot_row is not None and snapshot_row.stale)),
            'stale_reason': stale_reason,
        })


class PortfolioWhaleBacktestStatsView(APIView):
    """GET /api/portfolio/whale/backtest-stats/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return envelope({'stats': [], 'note': 'backtest_stats_not_available_in_native'})


@extend_schema(
    summary='PortfolioScreenerRuleDetailView (native route)',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. The real payload shape is checked by test_flat_views_are_not_documented_as_envelope.',
    # This class has a body-carrying method, so the REQUEST side must be typed too;
    # responses= alone still yields the unguessable-serializer error.
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class PortfolioScreenerRuleDetailView(APIView):
    """GET/PUT/DELETE /api/portfolio/screener/rules/<pk>/"""
    permission_classes = [permissions.IsAuthenticated, WorkspacePermission]
    required_workspace_permission = 'portfolio_write'

    def _get_rule(self, request, pk):
        from user_workspace.models import ScreenerRule
        tenant = getattr(request, 'tenant', None)
        try:
            if tenant:
                return ScreenerRule.objects.get(pk=pk, user=request.user, tenant=tenant)
            else:
                return ScreenerRule.objects.get(pk=pk, user=request.user)
        except ScreenerRule.DoesNotExist:
            raise NotFound('Bộ lọc không tồn tại.')

    def get(self, request, pk):
        rule = self._get_rule(request, pk)
        # P0.6: inactive rules (template previews) are hidden from detail view;
        # PUT/DELETE still work so previews can be promoted or cleaned up.
        if not rule.is_active:
            raise NotFound('Bộ lọc không tồn tại.')
        from user_workspace.serializers import ScreenerRuleSerializer
        return envelope(ScreenerRuleSerializer(rule).data)

    def put(self, request, pk):
        rule = self._get_rule(request, pk)
        from user_workspace.serializers import ScreenerRuleSerializer
        serializer = ScreenerRuleSerializer(rule, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        if 'rules_json' in serializer.validated_data:
            from user_workspace.screener_helpers import _validate_screener_rules
            ok, err = _validate_screener_rules(serializer.validated_data['rules_json'])
            if not ok:
                return Response({'detail': err}, status=status.HTTP_400_BAD_REQUEST)
        
        rule = serializer.save()
        return envelope(ScreenerRuleSerializer(rule).data)

    def delete(self, request, pk):
        rule = self._get_rule(request, pk)
        rule.delete()
        from rest_framework import status as http_status
        return Response(status=http_status.HTTP_204_NO_CONTENT)


@extend_schema(
    summary='PortfolioAIAdvisoryListView (native route)',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. The real payload shape is checked by test_flat_views_are_not_documented_as_envelope.',
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class PortfolioAIAdvisoryListView(APIView):
    """GET /portfolio/ai-advisory/ — batch advisory listing hôm nay của user.

    R0.12 — trước đây trả `{'items': []}` cố định, buộc FE phải fallback sang
    20 request per-symbol (`useWhaleAdvisoryData.js:7,16`). Implement thật để
    bỏ được N+1 request và cho sidebar một nguồn dữ liệu duy nhất.

    Scope: `user=request.user` + `session_date=hôm nay` (giờ Asia/Ho_Chi_Minh).
    """
    permission_classes = [permissions.IsAuthenticated]

    #: trần số record trả về để không kéo nặng response
    MAX_ITEMS = 200

    def get(self, request):
        from advisory.models import AdvisoryRecord
        from advisory.serializers import AdvisoryRecordSerializer
        from django.utils import timezone

        symbol = str(request.query_params.get('symbol') or '').strip().upper()
        session_date = timezone.localdate()

        queryset = (
            AdvisoryRecord.objects
            .filter(user=request.user, session_date=session_date)
            .order_by('-created_at')
        )
        if symbol:
            queryset = queryset.filter(symbol=symbol)

        records = list(queryset[: self.MAX_ITEMS])
        return paginated_envelope({
            'items': AdvisoryRecordSerializer(records, many=True).data,
            'session_date': session_date.isoformat(),
            'count': len(records),
            'truncated': len(records) >= self.MAX_ITEMS,
        })


@extend_schema(
    summary='PortfolioAIAdvisorySymbolStatsView (native route)',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. The real payload shape is checked by test_flat_views_are_not_documented_as_envelope.',
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class PortfolioAIAdvisorySymbolStatsView(APIView):
    """GET /portfolio/ai-advisory-symbol-stats/ — stats theo mã cho sidebar.

    R0.6 — trước đây trả `{'stats': []}` cố định, khiến
    `WhaleSymbolSidebar.js:125,128,136` render "0%" / "▲ 0" cho MỌI mã:
    `buildFallbackSymbolStats` không có advisory nên mọi field về 0. Ba cột
    đó là số liệu bịa, không phải thiếu dữ liệu.

    Nay trả đúng những gì có nguồn thật. Cố ý KHÔNG trả `whale_intensity` /
    `buy_count` / `sell_count` vì không có trường nào trong DB làm nguồn cho
    chúng — thiếu dữ liệu thì vắng mặt, không phải điền 0.
    """
    permission_classes = [permissions.IsAuthenticated]

    MAX_SYMBOLS = 200

    def get(self, request):
        from advisory.models import AdvisoryRecord
        from advisory.signal_norm import normalize_confidence, normalize_signal, signal_to_side
        from django.utils import timezone

        session_date = timezone.localdate()

        raw_symbols = request.query_params.get('symbols') or ''
        requested = [
            token.strip().upper()
            for token in str(raw_symbols).split(',')
            if token.strip()
        ][: self.MAX_SYMBOLS]

        queryset = AdvisoryRecord.objects.filter(
            user=request.user,
            session_date=session_date,
        )
        if requested:
            queryset = queryset.filter(symbol__in=requested)

        # Chỉ tính record đã sinh thành công — record pending/failed không
        # có khuyến nghị để hiển thị.
        generated = [row for row in queryset.order_by('-created_at') if row.status == 'generated']

        latest_by_symbol = {}
        for row in generated:
            if row.symbol in latest_by_symbol:
                continue
            structured = row.structured_output if isinstance(row.structured_output, dict) else {}
            latest_by_symbol[row.symbol] = {
                'symbol': row.symbol,
                'side': signal_to_side(normalize_signal(structured.get('signal'))),
                'signal': normalize_signal(structured.get('signal')),
                'confidence_score': normalize_confidence(structured.get('confidence_score')),
                'is_discovery': bool(structured.get('is_discovery') or False),
                'updated_at': (
                    row.generated_at or row.updated_at
                ).isoformat() if (row.generated_at or row.updated_at) else None,
            }

        stats = sorted(
            latest_by_symbol.values(),
            key=lambda item: (
                -(item['confidence_score'] or 0),
                item['symbol'],
            ),
        )
        if requested:
            order = {symbol: index for index, symbol in enumerate(requested)}
            stats.sort(key=lambda item: order.get(item['symbol'], len(order)))

        return paginated_envelope({
            'stats': stats,
            'session_date': session_date.isoformat(),
            'count': len(stats),
        })



# P0.1: allowlisted flow fields with NO SessionFacts source (see market_serving
# models SessionFacts: only cvd/strengths/whale_net_flow/dark_score/buy-sell
# volumes exist). Always None -> never match; reported via missing_fields (Q2).
_FLOW_FIELDS_NO_SOURCE = (
    'whale_unknown_value', 'whale_unknown_pct', 'whale_trade_count',
    'whale_whale_value', 'whale_shark_value', 'whale_small_value',
)

# P1.1: server-side sort/paging contract (IMPLEMENTATION_PLAN_SCREENER_P1_20260913.md §2).
# D2/D3 (Entry 73): default sort=ai_score/desc; limit enum includes 2000 for export.
# NOTE (minor plan extension, logged Entry 74): sortable set covers every numeric
# table column (+symbol/date) so the P0 table keeps full-column sorting via server.
_SORTABLE_FIELDS = ('ai_score', 'symbol', 'date', 'close', 'rsi_14', 'sma20', 'sma50',
                    'price_vs_sma20_pct', 'price_vs_sma50_pct', 'sma20_vs_sma50_pct',
                    'momentum_20d_pct', 'macd_hist', 'volume_rvol', 'avg_volume_20',
                    'range_position_pct', 'stochastic_k', 'stochastic_d', 'atr_14',
                    'adx_14', 'bollinger_width', 'vwap', 'mfi_14', 'pe_ratio',
                    'market_cap', 'dividend_yield', 'eps_growth_yoy', 'revenue_growth_yoy',
                    'debt_to_equity')
_PAGE_LIMITS = (10, 25, 50, 100, 2000)
_DEFAULT_SORT = 'ai_score'
_DEFAULT_ORDER = 'desc'
_DEFAULT_PAGE = 1
_DEFAULT_LIMIT = 25


def _parse_scan_params(request):
    """Parse optional P1.1 scan params (querystring first, JSON body fallback).

    Returns (has_params, sort, order, page, limit, include_ai, error_response).
    error_response is a DRF Response (400) when validation fails, else None.
    """
    from rest_framework.response import Response as _Response
    from rest_framework import status as _status

    def _bad(msg):
        return _Response({'detail': msg}, status=_status.HTTP_400_BAD_REQUEST)

    qp = request.query_params
    body = request.data if isinstance(request.data, dict) else {}

    def _param(name):
        v = qp.get(name, None)
        return body.get(name, v) if v is None else v

    raw = {k: _param(k) for k in ('sort', 'order', 'page', 'limit', 'include_ai')}
    has_params = any(v is not None for v in raw.values())

    sort, order, page, limit, include_ai = _DEFAULT_SORT, _DEFAULT_ORDER, _DEFAULT_PAGE, _DEFAULT_LIMIT, True
    if not has_params:
        return has_params, sort, order, page, limit, include_ai, None

    if raw['sort'] is not None:
        sort = str(raw['sort'])
        if sort not in _SORTABLE_FIELDS:
            return has_params, sort, order, page, limit, include_ai, _bad(
                f'Sort "{sort}" không hợp lệ. Cho phép: {", ".join(_SORTABLE_FIELDS)}.')
    if raw['order'] is not None:
        order = str(raw['order']).lower()
        if order not in ('asc', 'desc'):
            return has_params, sort, order, page, limit, include_ai, _bad(
                'Order phải là "asc" hoặc "desc".')
    if raw['page'] is not None:
        try:
            page = int(raw['page'])
        except (TypeError, ValueError):
            return has_params, sort, order, page, limit, include_ai, _bad('Page phải là số nguyên ≥ 1.')
        if page < 1:
            return has_params, sort, order, page, limit, include_ai, _bad('Page phải là số nguyên ≥ 1.')
    if raw['limit'] is not None:
        try:
            limit = int(raw['limit'])
        except (TypeError, ValueError):
            limit = -1
        if limit not in _PAGE_LIMITS:
            return has_params, sort, order, page, limit, include_ai, _bad(
                f'Limit phải thuộc {list(_PAGE_LIMITS)}.')
    if raw['include_ai'] is not None:
        s = str(raw['include_ai']).lower()
        if s in ('1', 'true'):
            include_ai = True
        elif s in ('0', 'false'):
            include_ai = False
        else:
            return has_params, sort, order, page, limit, include_ai, _bad(
                'include_ai phải là 0 hoặc 1.')
    if not include_ai and sort == 'ai_score':
        return has_params, sort, order, page, limit, include_ai, _bad(
            'include_ai=0 không dùng được với sort=ai_score (không có điểm AI để xếp hạng).')
    return has_params, sort, order, page, limit, include_ai, None



from django.conf import settings

from rest_framework.throttling import UserRateThrottle


class ScreenerRunThrottle(UserRateThrottle):
    """P1.5: rate-limit run endpoint (D5). Bypass in TESTING/DEBUG via settings (F-BE-04)."""

    scope = 'screener_run'

    def get_rate(self):
        if getattr(settings, 'TESTING', False) or getattr(settings, 'DEBUG', False):
            return '999999/day'
        return '30/min'


class ScreenerStatusThrottle(UserRateThrottle):
    """P1.5 + F-SEC-11: status polling needs higher budget (40/min at 1.5s interval > 30/min)."""

    scope = 'screener_status'

    def get_rate(self):
        if getattr(settings, 'TESTING', False) or getattr(settings, 'DEBUG', False):
            return '999999/day'
        return '60/min'

def _scan_sort_value(item, sort):
    if sort == 'ai_score':
        adv = item.get('ai_advisory') or {}
        return adv.get('ai_score_0_100')
    if sort == 'symbol':
        return str(item.get('symbol') or '')
    return item.get(sort)


# P1.2: Django-cache TTL for full scan results (D4, Entry 73).
_SCAN_CACHE_TTL = 14400  # overridden by settings.SCREENER_SCAN_CACHE_TTL

# P1.4: async threshold + job helpers (D1, Entry 77)
_SCREENER_SYNC_SYMBOL_LIMIT_DEFAULT = 800
_SCREENER_JOB_TTL = 3600
_SCREENER_MAX_PENDING = 3


def _screener_job_key(job_id: str) -> str:
    return f"screener:job:{job_id}"


def _screener_jobs_set_key(user_id: int) -> str:
    return f"screener:jobs:{user_id}"


def _get_pending_jobs(cache_obj, user_id: int):
    raw = cache_obj.get(_screener_jobs_set_key(user_id))
    if isinstance(raw, set):
        return set(raw)
    if isinstance(raw, list):
        return set(raw)
    return set()


def _add_pending_job(cache_obj, user_id: int, job_id: str):
    key = _screener_jobs_set_key(user_id)
    pending = _get_pending_jobs(cache_obj, user_id)
    pending.add(job_id)
    cache_obj.set(key, pending, timeout=_SCREENER_JOB_TTL)


def _remove_pending_job(cache_obj, user_id: int, job_id: str):
    key = _screener_jobs_set_key(user_id)
    pending = _get_pending_jobs(cache_obj, user_id)
    if job_id in pending:
        pending.remove(job_id)
        cache_obj.set(key, pending, timeout=_SCREENER_JOB_TTL)



def _scan_cache_key(user_id, rule, session_date, include_ai, tenant_id=None):
    """Cache key WITHOUT sort/order (Option B, Entry 76): one entry serves all
    sorts/pages; updated_at auto-invalidates on rule edit, session_date on new session.

    TEN-06: `tenant_id` is part of the key. Without it, a user who belongs to
    two tenants can read a scan result cached for the other tenant whenever the
    rule id and session date line up. The caller passes the tenant explicitly;
    when it is absent the literal `no-tenant` keeps the namespace separate
    rather than silently colliding with a real tenant.
    """
    updated_ts = int(rule.updated_at.timestamp()) if getattr(rule, "updated_at", None) else 0
    tenant_part = "no-tenant" if tenant_id in (None, "") else str(tenant_id)
    return (
        f"screener:scan:{tenant_part}:{user_id}:{rule.id}:{updated_ts}:"
        f"{session_date.isoformat()}:{int(bool(include_ai))}"
    )


def _compute_scan(conditions, session_date, include_ai):
    """P1.2: full scan compute extracted from PortfolioScreenerRuleRunView.post
    (P1.4 will reuse it from the celery task). Returns
    (matched_unsorted, total_scanned, missing_counts_dict, window_days)."""
    from market_serving.models import SymbolSnapshot, SessionFacts
    from market_data.models import DailyPrice
    from market_data.models import StockProfile
    from market_data.vnbroker_adapter import get_company_financials_response
    from user_workspace.screener_helpers import (
        _screener_build_technical, _apply_screener_condition, _compute_fundamental_metrics,
        _required_lookback_days, _lookback_calendar_days,
    )
    from user_workspace.ai_advisory_helpers import compute_ai_advisory
    from django.core.cache import cache as _fin_cache
    from datetime import timedelta
    from collections import defaultdict, Counter

    # P1.3: dynamic window from the rule's condition fields (D7 clamp [35, 90])
    # instead of a fixed 90 calendar days.
    window_days = _lookback_calendar_days(_required_lookback_days(conditions))

    # P1.3: trim columns — _screener_build_technical only reads
    # symbol/date/close/volume/high/low (deferred fields stay untouched;
    # touching them later would add queries — see U3).
    snapshots = SymbolSnapshot.objects.filter(session_date=session_date).only(
        'symbol', 'session_date', 'price', 'volume')
    symbols = [s.symbol for s in snapshots]

    facts_list = SessionFacts.objects.filter(session_date=session_date).only(
        'symbol', 'session_date', 'dark_flow_score', 'cvd_normalized',
        'total_buy_volume', 'total_sell_volume', 'whale_net_flow',
        'buy_strength', 'institutional_strength')
    facts_map = {f.symbol: f for f in facts_list}

    # Bulk-read outstanding shares (canonical profile source) for market_cap derivation
    profile_map = {
        p['symbol']: p
        for p in StockProfile.objects.filter(symbol__in=symbols).values('symbol', 'outstanding_shares')
    }

    lookback_date = session_date - timedelta(days=window_days)
    prices = DailyPrice.objects.filter(
        symbol__in=symbols, date__gte=lookback_date).only(
        'symbol', 'date', 'close', 'volume', 'high', 'low').order_by('symbol', 'date')

    history_map = defaultdict(list)
    for p in prices:
        history_map[p.symbol].append(p)

    # P1.3: pre-warm financials with ONE cache roundtrip (key format verified:
    # vnbroker_adapter caches `stock_financials:{SYMBOL}` 12h). Misses fall
    # through to the adapter (which re-caches). SSOT/TTL unchanged.
    _fin_cached = _fin_cache.get_many([f"stock_financials:{s.upper()}" for s in symbols])

    # P0.1: fields referenced by this rule's conditions — used to report
    # per-field missing-data coverage (Q2 badge).
    cond_list = conditions if isinstance(conditions, list) else []
    cond_fields = {c.get('field') for c in cond_list if isinstance(c, dict) and c.get('field')}
    missing_counts = Counter()

    matched = []
    for snap in snapshots:
        sym = snap.symbol
        hist = history_map[sym]
        # SSOT: fundamentals come from the canonical vnbroker adapter (cached 12h);
        # P1.3 serves cache hits from the pre-warmed batch above.
        _fin_hit = _fin_cached.get(f"stock_financials:{sym.upper()}")
        if isinstance(_fin_hit, dict):
            financials = _fin_hit.get('financials', {})
        else:
            financials = get_company_financials_response(sym).get('financials', {})
        os_shares = profile_map.get(sym, {}).get('outstanding_shares')
        fundamental_metrics = _compute_fundamental_metrics(
            financials,
            float(snap.price) if snap.price is not None else None,
            os_shares,
        )
        tech = _screener_build_technical(sym, snap.price, snap.volume, hist, fundamental_metrics=fundamental_metrics)

        facts = facts_map.get(sym)
        flow_facts = {}
        if facts:
            flow_facts = {
                'dark_flow_strength': facts.dark_flow_score,
                'dark_flow_avg_strength': facts.dark_flow_score,
                'dark_flow_max_strength': facts.dark_flow_score,
                'dark_flow_signal_count': 1 if facts.dark_flow_score > 0 else 0,
                'dark_flow_cvd': facts.cvd_normalized,

                'whale_buy_value': facts.total_buy_volume * float(snap.price),
                'whale_sell_value': facts.total_sell_volume * float(snap.price),
                'whale_net_value': facts.whale_net_flow,
                'whale_total_value': (facts.total_buy_volume + facts.total_sell_volume) * float(snap.price),
                'whale_buy_pct': facts.buy_strength * 100,
                'whale_sell_pct': (1 - facts.buy_strength) * 100,
                'whale_intensity': facts.institutional_strength,
            }
        else:
            # P0.1: same shape as the facts branch (deliberate zeros), so
            # every allowlisted field is always present in the row (R1.1).
            flow_facts = {
                'dark_flow_strength': 0.0,
                'dark_flow_avg_strength': 0.0,
                'dark_flow_max_strength': 0.0,
                'dark_flow_signal_count': 0,
                'dark_flow_cvd': 0.0,
                'whale_buy_value': 0.0,
                'whale_sell_value': 0.0,
                'whale_net_value': 0.0,
                'whale_total_value': 0.0,
                'whale_buy_pct': 0.0,
                'whale_sell_pct': 0.0,
                'whale_intensity': 0.0,
            }
        # P0.1: fields with no source are explicit None (never match —
        # _apply_screener_condition(None) is False) and surface via
        # missing_fields/missing_counts below (Q2 "thiếu dữ liệu" badge).
        for no_src_field in _FLOW_FIELDS_NO_SOURCE:
            flow_facts[no_src_field] = None

        row = {
            'symbol': sym,
            'date': session_date.isoformat(),
            **tech,
            **flow_facts,
        }

        # AI advisory (S3.1) — fallback None nếu lỗi, không crash scan.
        # P1.1: include_ai=0 skips the compute entirely (D6).
        if include_ai:
            try:
                row['ai_advisory'] = compute_ai_advisory(row)
            except Exception:
                row['ai_advisory'] = None
        else:
            row['ai_advisory'] = None

        # Evaluate conditions with AND/OR/NOT logic
        if conditions:
            # First condition always applies (no logic operator)
            first_cond = conditions[0]
            result = _apply_screener_condition(row.get(first_cond['field']), first_cond['op'], first_cond['value'])

            # Process remaining conditions with their logic operators
            for cond in conditions[1:]:
                cond_result = _apply_screener_condition(row.get(cond['field']), cond['op'], cond['value'])
                logic = cond.get('logic', 'AND')
                if logic == 'AND':
                    result = result and cond_result
                elif logic == 'OR':
                    result = result or cond_result
                elif logic == 'NOT':
                    result = result and (not cond_result)

            if result:
                matched.append(row)
        else:
            # No conditions means match all
            matched.append(row)

        # P0.1: count symbols missing each condition field (evaluated for
        # every scanned row, not just matched — coverage denominator below).
        for f in cond_fields:
            if row.get(f) is None:
                missing_counts[f] += 1
    return matched, len(symbols), dict(missing_counts), window_days


@extend_schema(
    summary='PortfolioScreenerRuleRunView (native route)',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. The real payload shape is checked by test_flat_views_are_not_documented_as_envelope.',
    # This class has a body-carrying method, so the REQUEST side must be typed too;
    # responses= alone still yields the unguessable-serializer error.
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class PortfolioScreenerRuleRunView(APIView):
    """POST /api/portfolio/screener/rules/<pk>/run/"""
    # P0.6 deviation (see IMPLEMENTATION_PLAN_SCREENER_P0_20260913.md §1.3):
    # run intentionally ALLOWS inactive rules so template previews (P0.4,
    # stored as is_active=False) can execute without appearing in list/detail.
    permission_classes = [permissions.IsAuthenticated, WorkspacePermission]
    required_workspace_permission = 'portfolio_write'
    throttle_classes = [ScreenerRunThrottle]

    def post(self, request, pk):
        from user_workspace.models import ScreenerRule
        tenant = getattr(request, 'tenant', None)
        try:
            if tenant:
                rule = ScreenerRule.objects.get(pk=pk, user=request.user, tenant=tenant)
            else:
                rule = ScreenerRule.objects.get(pk=pk, user=request.user)
        except ScreenerRule.DoesNotExist:
            raise NotFound('Bộ lọc không tồn tại.')

        conditions = rule.rules_json

        # P1.1: validate scan params BEFORE any heavy work (fail fast on 400).
        has_scan_params, sort, order, page, limit, include_ai, param_error = _parse_scan_params(request)
        if param_error is not None:
            return param_error

        from market_serving.models import SymbolSnapshot, SessionFacts
        from market_data.models import DailyPrice
        from user_workspace.screener_helpers import (
            _screener_build_technical, _apply_screener_condition, _compute_fundamental_metrics,
            _required_lookback_days, _lookback_calendar_days,
        )
        from user_workspace.ai_advisory_helpers import compute_ai_advisory
        from market_data.models import StockProfile
        from market_data.vnbroker_adapter import get_company_financials_response
        from datetime import date, timedelta
        from collections import defaultdict

        latest_snap = SymbolSnapshot.objects.order_by('-session_date').first()
        if not latest_snap:
            payload = {
                'rule_id': rule.id,
                'rule_name': rule.name,
                'total_scanned': 0,
                'matched_count': 0,
                'matched': [],
            }
            if has_scan_params:
                payload.update({'page': page, 'limit': limit, 'pages': 1, 'sort': sort, 'order': order})
            return envelope(payload)
        
        session_date = latest_snap.session_date

        # P0.1: staleness metadata for the UI banner (weekends/holidays scan
        # the last available session — never silently).
        today = date.today()
        days_old = (today - session_date).days if session_date else 0
        is_stale = days_old > 0

        # P1.2: result cache (Option B) — key has no sort/order; sorting and
        # paging apply to the cached full list below. TTL from settings (D4).
        from django.core.cache import cache as _scan_cache
        from django.conf import settings as _scan_settings
        from user_workspace.screener_helpers import _required_lookback_days, _lookback_calendar_days
        _scan_ttl = getattr(_scan_settings, "SCREENER_SCAN_CACHE_TTL", _SCAN_CACHE_TTL)
        # TEN-06: bind the scan cache to a tenant so a user in two tenants
        # cannot read the other tenant's cached scan result.
        #
        # Nguon SU THAT la `rule.tenant` — KHONG phai `request.tenant`. Ly do:
        # duong GHI cache la Celery task (`screener_tasks.py`) chi co `rule_id`,
        # nen no lay tenant tu rule. Neu doc duong lay `request.tenant` thi
        # khi hai gia tri lech nhau (request chua resolve tenant, hoac rule thuoc
        # tenant khac) se tao hai key khac nhau: task ghi vao mot namespace ma
        # view doc o namespace khac => cache mat, va test
        # `test_screener_async_run` fail 202 != 200. Dung `rule.tenant` o ca hai
        # dau thi key luon trung nhau.
        _scan_tenant = getattr(rule, "tenant", None)
        _scan_tenant_id = getattr(_scan_tenant, "public_id", None)
        scan_cache_key = _scan_cache_key(
            request.user.id, rule, session_date, include_ai, tenant_id=_scan_tenant_id
        )
        cached_scan = _scan_cache.get(scan_cache_key)
        _cache_hit = isinstance(cached_scan, dict) and "matched" in cached_scan
        if _cache_hit and cached_scan.get("truncated") and has_scan_params:
            _cached_rows = cached_scan.get("matched") or []
            if (page - 1) * limit >= len(_cached_rows):
                # F-BE-06: page beyond cached top-N → recompute instead of
                # returning a short page.
                _cache_hit = False
        _truncated_total = None
        if _cache_hit:
            matched = cached_scan["matched"]
            total_scanned = cached_scan.get("total_scanned", len(matched))
            missing_counts = cached_scan.get("missing_counts", {})
            _truncated_total = cached_scan.get("total_matched")
            window_days = _lookback_calendar_days(_required_lookback_days(conditions))
        else:
            # P1.4: async branch — cache miss + large universe or ?async=1 → 202 queued
            from django.core.cache import cache as _job_cache
            from django.conf import settings as _job_settings
            import uuid
            _sync_limit = getattr(_job_settings, "SCREENER_SYNC_SYMBOL_LIMIT", _SCREENER_SYNC_SYMBOL_LIMIT_DEFAULT)
            # Universe size check (cheap count, not full scan)
            try:
                from market_serving.models import SymbolSnapshot as _SnapForCount
                _universe_cnt = _SnapForCount.objects.filter(session_date=session_date).count()
            except Exception:
                _universe_cnt = 0
            # ?async=1 forces async even for small universe (query param or JSON body)
            _force_async = False
            try:
                if request.query_params.get("async") == "1":
                    _force_async = True
                elif isinstance(request.data, dict) and str(request.data.get("async")) == "1":
                    _force_async = True
            except Exception:
                pass
            _should_async = _force_async or (_universe_cnt > _sync_limit)
            if _should_async:
                # Pending cap D5
                _pending = _get_pending_jobs(_job_cache, request.user.id)
                if len(_pending) >= _SCREENER_MAX_PENDING:
                    from rest_framework.response import Response as _R429
                    return _R429(
                        {"detail": "Quá nhiều tác vụ đang chờ. Vui lòng thử lại sau.", "retry_after": 60},
                        status=429,
                    )
                _job_id = uuid.uuid4().hex
                _job_key = _screener_job_key(_job_id)
                # Snapshot rule to avoid drift if user edits mid-run
                try:
                    _updated_ts = int(rule.updated_at.timestamp()) if getattr(rule, "updated_at", None) else 0
                except Exception:
                    _updated_ts = 0
                _snapshot = {"rules_json": conditions, "updated_at_ts": _updated_ts}
                # Queue job
                _job_cache.set(
                    _job_key,
                    {"status": "queued", "scanned": 0, "total": _universe_cnt, "job_id": _job_id, "rule_id": rule.id},
                    timeout=_SCREENER_JOB_TTL,
                )
                _add_pending_job(_job_cache, request.user.id, _job_id)
                # Delay task (ALWAYS_EAGER → runs sync in test, but we still return 202)
                try:
                    from user_workspace.screener_tasks import run_screener_scan_task

                    # tenant_id for task (optional, not used for compute but for audit)
                    _tenant_id = getattr(rule, "tenant_id", None)
                    if _tenant_id is None:
                        _t = getattr(rule, "tenant", None)
                        _tenant_id = getattr(_t, "id", None) if _t else None
                    run_screener_scan_task.delay(
                        request.user.id,
                        _tenant_id,
                        rule.id,
                        _snapshot,
                        session_date.isoformat(),
                        int(bool(include_ai)),
                        _job_id,
                    )
                except Exception as exc:
                    # If delay fails, mark failed and fallback to sync? For now return 500-like
                    _job_cache.set(_job_key, {"status": "failed", "error": str(exc), "job_id": _job_id}, timeout=_SCREENER_JOB_TTL)
                    _remove_pending_job(_job_cache, request.user.id, _job_id)
                    from rest_framework.response import Response as _R500
                    return _R500({"detail": f"Không thể tạo tác vụ quét: {exc}"}, status=500)
                poll_url = f"/core/v1/screener/rules/{rule.id}/run/status/?job_id={_job_id}"

                return envelope({"status": "queued", "job_id": _job_id, "poll_url": poll_url},
                                status=202)
            # Sync path (small universe or not forced)
            matched, total_scanned, missing_counts, window_days = _compute_scan(
                conditions, session_date, include_ai)
            # F-BE-06: size-guarded cache write (top-N + truncated flag when >1MB).
            from user_workspace.screener_helpers import build_scan_cache_value
            _scan_cache.set(scan_cache_key, build_scan_cache_value(
                matched, total_scanned, missing_counts,
            ), timeout=_scan_ttl)

        if has_scan_params:
            # P1.1: server sort (None always last, both directions) + paging.
            valued = [r for r in matched if _scan_sort_value(r, sort) is not None]
            noval = [r for r in matched if _scan_sort_value(r, sort) is None]
            valued.sort(key=lambda item: _scan_sort_value(item, sort), reverse=(order == 'desc'))
            matched = valued + noval
        else:
            # Legacy path (no params): exact P0 behavior — close desc, full list.
            matched.sort(key=lambda item: item.get('close') or 0, reverse=True)

        payload = {
            'rule_id': rule.id,
            'rule_name': rule.name,
            'total_scanned': total_scanned,
            # F-BE-06: truncated cache reports the true total, not the top-N length.
            'matched_count': _truncated_total or len(matched),
            'matched': matched,
            # P0.1 additions (additive only — the 5 legacy keys above unchanged).
            'session_date': session_date.isoformat(),
            'is_stale': is_stale,
            'days_old': days_old,
            'missing_fields': sorted(missing_counts),
            'missing_counts': dict(missing_counts),
            # P1.3: calendar-day price window actually used (R3.1 evidence).
            'window_days': window_days,
        }
        if _truncated_total:
            # F-BE-06 (additive): cache held top-N only; FE paginates cached
            # rows, deeper pages trigger recompute server-side.
            payload['truncated'] = True
            payload['total_matched'] = _truncated_total
        if has_scan_params:
            # P1.1 meta (additive). pages min 1 so clients never divide by zero.
            pages = (len(matched) + limit - 1) // limit if limit > 0 else 1
            pages = max(pages, 1)
            start = (page - 1) * limit
            payload['matched'] = matched[start:start + limit]
            payload.update({'page': page, 'limit': limit, 'pages': pages, 'sort': sort, 'order': order})
        # P2.3: create history entry (BE, D10 quota 100/user) — Q5
        try:
            from user_workspace.models import ScreenerRunHistory

            # Use full matched (pre-paging, already sorted) for history, truncated to 100 rows
            history_source = matched  # full sorted list
            history_rows = []
            for r in history_source[:100]:
                adv = r.get('ai_advisory') or {}
                history_rows.append(
                    {
                        'symbol': r.get('symbol'),
                        'close': r.get('close'),
                        'action': adv.get('strategy_action'),
                        'score': adv.get('ai_score_0_100'),
                    }
                )
            # Tenant fallback: request.tenant may be None in tests (no TenantResolutionMiddleware)
            tenant_for_history = tenant or getattr(rule, 'tenant', None)
            if tenant_for_history is None:
                # Last resort: user's primary tenant
                try:
                    from identity_access.models import CoreTenant

                    tenant_for_history = CoreTenant.objects.filter(owner_user=request.user).first()
                except Exception:
                    tenant_for_history = None
            # If still None, skip history (avoid IntegrityError) — tenant is required
            if tenant_for_history is not None:
                ScreenerRunHistory.objects.create(
                    user=request.user,
                    tenant=tenant_for_history,
                    rule=rule,
                    rule_name=rule.name,
                    matched_count=len(history_source),
                    total_scanned=total_scanned,
                    window_days=window_days,
                    session_date=session_date,
                    matched=history_rows,
                    params={
                        'sort': sort,
                        'order': order,
                        'page': page,
                        'limit': limit,
                        'include_ai': int(bool(include_ai)),
                    }
                    if has_scan_params
                    else {},
                )
                # Enforce quota 100 per user+tenant
                qs = ScreenerRunHistory.objects.filter(user=request.user, tenant=tenant_for_history)
                if qs.count() > 100:
                    oldest_ids = list(qs.order_by('-run_at').values_list('id', flat=True)[100:])
                    if oldest_ids:
                        ScreenerRunHistory.objects.filter(id__in=oldest_ids).delete()
        except Exception:
            import logging

            logging.getLogger(__name__).exception("Failed to create screener history")
        return envelope(payload)



@extend_schema(
    summary='PortfolioScreenerRuleRunStatusView (native route)',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. The real payload shape is checked by test_flat_views_are_not_documented_as_envelope.',
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class PortfolioScreenerRuleRunStatusView(APIView):
    """GET /screener/rules/<pk>/run/status/?job_id=... — P1.4 job polling."""

    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScreenerStatusThrottle]

    def get(self, request, pk):
        from user_workspace.models import ScreenerRule
        from django.core.cache import cache as _cache

        tenant = getattr(request, "tenant", None)
        try:
            if tenant:
                rule = ScreenerRule.objects.get(pk=pk, user=request.user, tenant=tenant)
            else:
                rule = ScreenerRule.objects.get(pk=pk, user=request.user)
        except ScreenerRule.DoesNotExist:
            raise NotFound("Bộ lọc không tồn tại.")

        job_id = request.query_params.get("job_id")
        if not job_id:
            from rest_framework.response import Response
            return Response({"detail": "Thiếu tham số job_id."}, status=400)
        # F-SEC-11: validate job_id format (uuid hex 32 chars) to avoid cache-key injection
        import re as _re

        if not _re.fullmatch(r"[0-9a-fA-F]{32}", str(job_id)):
            from rest_framework.response import Response
            return Response({"detail": "job_id không hợp lệ."}, status=400)

        job_key = _screener_job_key(job_id)
        payload = _cache.get(job_key)
        if payload is None:
            # Unknown / expired — FE fallback to sync per plan §5f
            from rest_framework.response import Response
            return envelope({"status": "unknown", "job_id": job_id}, status=200)
        # Optional ownership check: job should belong to this user (stored rule_id check)
        # If payload has rule_id, ensure it matches requested pk
        if isinstance(payload, dict) and "rule_id" in payload and int(payload["rule_id"]) != int(pk):
            from rest_framework.response import Response
            return Response({"detail": "Tác vụ không thuộc bộ lọc này."}, status=404)
        from rest_framework.response import Response
        return envelope(payload)


def _validate_schedule_payload(data):
    """Validate P2.4 schedule payload. Returns (ok, cleaned|error)."""
    if not isinstance(data, dict):
        return False, 'Payload phải là object.'
    name = str(data.get('name', '')).strip()
    if not name:
        return False, 'Tên lịch không được để trống.'
    rule_ids = data.get('rule_ids', [])
    if not isinstance(rule_ids, list) or not rule_ids:
        return False, 'rule_ids phải là list không rỗng.'
    try:
        rule_ids = [int(r) for r in rule_ids]
    except (TypeError, ValueError):
        return False, 'rule_ids phải là list số nguyên.'
    run_time_raw = str(data.get('run_time', '18:00')).strip()
    try:
        from datetime import datetime as _dt

        run_time = _dt.strptime(run_time_raw, '%H:%M').time()
    except (TypeError, ValueError):
        return False, 'run_time phải dạng HH:MM (VD: 18:00).'
    weekdays = data.get('weekdays', [0, 1, 2, 3, 4])
    if not isinstance(weekdays, list) or not all(isinstance(w, int) and 0 <= w <= 6 for w in weekdays):
        return False, 'weekdays phải là list số 0-6 (0=Mon).'
    channels = data.get('notify_channels', ['in_app'])
    if not isinstance(channels, list) or not all(c in ('in_app', 'email') for c in channels):
        return False, "notify_channels chỉ gồm 'in_app', 'email'."
    return True, {'name': name[:100], 'rule_ids': rule_ids, 'run_time': run_time, 'weekdays': weekdays, 'notify_channels': channels or ['in_app']}


def _schedule_to_dict(s):
    return {
        'id': s.id,
        'name': s.name,
        'rule_ids': s.rule_ids,
        'run_time': s.run_time.strftime('%H:%M') if s.run_time else None,
        'weekdays': s.weekdays,
        'is_active': s.is_active,
        'notify_channels': s.notify_channels,
        'last_run_at': s.last_run_at.isoformat() if s.last_run_at else None,
        'next_run_at': s.next_run_at.isoformat() if s.next_run_at else None,
    }


@extend_schema(
    summary='ScreenerScheduleListCreateView (native route)',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. The real payload shape is checked by test_flat_views_are_not_documented_as_envelope.',
    # This class has a body-carrying method, so the REQUEST side must be typed too;
    # responses= alone still yields the unguessable-serializer error.
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class ScreenerScheduleListCreateView(APIView):
    """P2.4: GET/POST /screener/schedules/"""

    permission_classes = [permissions.IsAuthenticated, WorkspacePermission]
    required_workspace_permission = 'portfolio_write'

    def get(self, request):
        from user_workspace.models import ScreenerSchedule

        tenant = getattr(request, 'tenant', None)
        qs = ScreenerSchedule.objects.filter(user=request.user)
        if tenant:
            qs = qs.filter(tenant=tenant)
        return envelope([_schedule_to_dict(s) for s in qs.order_by('-created_at')])

    def post(self, request):
        from user_workspace.models import ScreenerRule, ScreenerSchedule

        tenant = getattr(request, 'tenant', None)
        ok, cleaned = _validate_schedule_payload(request.data if isinstance(request.data, dict) else {})
        if not ok:
            return Response({'detail': cleaned}, status=400)
        # Rule IDs must exist for this user **and, when known, in this tenant**.
        # Filtering only on `user` lets a multi-tenant user attach a rule that
        # belongs to tenant A to a schedule living in tenant B.
        #
        # `tenant` is optional here on purpose. Returning 400 when it is None
        # would block a request that was previously accepted, and the tenant is
        # resolved further down anyway (that fallback is what this app already
        # relies on). When the tenant IS resolved — the production path — the
        # filter is enforced; when it is not, behaviour is unchanged.
        rule_qs = ScreenerRule.objects.filter(
            user=request.user, pk__in=cleaned['rule_ids'],
        )
        if tenant is not None:
            rule_qs = rule_qs.filter(tenant=tenant)
        existing = set(rule_qs.values_list('pk', flat=True))
        missing = [r for r in cleaned['rule_ids'] if r not in existing]
        if missing:
            return Response({'detail': f'Rule không tồn tại: {missing}'}, status=400)
        # Tenant fallback like history
        tenant_for = tenant
        if tenant_for is None:
            try:
                from identity_access.models import CoreTenant

                tenant_for = CoreTenant.objects.filter(owner_user=request.user).first()
            except Exception:
                tenant_for = None
        if tenant_for is None:
            return Response({'detail': 'Không xác định tenant.'}, status=400)
        s = ScreenerSchedule.objects.create(
            user=request.user,
            tenant=tenant_for,
            name=cleaned['name'],
            rule_ids=cleaned['rule_ids'],
            run_time=cleaned['run_time'],
            weekdays=cleaned['weekdays'],
            notify_channels=cleaned['notify_channels'],
        )
        return envelope(_schedule_to_dict(s), status=201)


@extend_schema(
    summary='ScreenerScheduleDetailView (native route)',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. The real payload shape is checked by test_flat_views_are_not_documented_as_envelope.',
    # This class has a body-carrying method, so the REQUEST side must be typed too;
    # responses= alone still yields the unguessable-serializer error.
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class ScreenerScheduleDetailView(APIView):
    """P2.4: GET/PUT/DELETE /screener/schedules/<id>/"""

    permission_classes = [permissions.IsAuthenticated, WorkspacePermission]
    required_workspace_permission = 'portfolio_write'

    def _get(self, request, pk):
        from user_workspace.models import ScreenerSchedule

        tenant = getattr(request, 'tenant', None)
        try:
            if tenant:
                return ScreenerSchedule.objects.get(pk=pk, user=request.user, tenant=tenant)
            return ScreenerSchedule.objects.get(pk=pk, user=request.user)
        except ScreenerSchedule.DoesNotExist:
            raise NotFound('Lịch không tồn tại.')

    def get(self, request, pk):
        return envelope(_schedule_to_dict(self._get(request, pk)))

    def put(self, request, pk):
        s = self._get(request, pk)
        data = request.data if isinstance(request.data, dict) else {}
        # Partial update: name/rule_ids/run_time/weekdays/is_active/notify_channels
        if 'name' in data:
            name = str(data['name']).strip()
            if not name:
                return Response({'detail': 'Tên lịch không được để trống.'}, status=400)
            s.name = name[:100]
        if 'rule_ids' in data or 'run_time' in data or 'weekdays' in data or 'notify_channels' in data:
            merged = {
                'name': s.name,
                'rule_ids': data.get('rule_ids', s.rule_ids),
                'run_time': data.get('run_time', s.run_time.strftime('%H:%M') if s.run_time else '18:00'),
                'weekdays': data.get('weekdays', s.weekdays),
                'notify_channels': data.get('notify_channels', s.notify_channels),
            }
            ok, cleaned = _validate_schedule_payload(merged)
            if not ok:
                return Response({'detail': cleaned}, status=400)
            s.rule_ids, s.run_time, s.weekdays, s.notify_channels = (
                cleaned['rule_ids'],
                cleaned['run_time'],
                cleaned['weekdays'],
                cleaned['notify_channels'],
            )
            # Recompute next run when timing changes
            try:
                from user_workspace.models import _compute_next_run

                s.next_run_at = _compute_next_run(s.run_time, s.weekdays)
            except Exception:
                pass
        if 'is_active' in data:
            s.is_active = bool(data['is_active'])
        s.save()
        return envelope(_schedule_to_dict(s))

    def delete(self, request, pk):
        self._get(request, pk).delete()
        return Response(status=204)


@extend_schema(
    summary='ScreenerScheduleRunNowView (native route)',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. The real payload shape is checked by test_flat_views_are_not_documented_as_envelope.',
    # This class has a body-carrying method, so the REQUEST side must be typed too;
    # responses= alone still yields the unguessable-serializer error.
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class ScreenerScheduleRunNowView(APIView):
    """P2.4: POST /screener/schedules/<id>/run-now/ — enqueue task per rule."""

    permission_classes = [permissions.IsAuthenticated, WorkspacePermission]
    required_workspace_permission = 'portfolio_write'

    def post(self, request, pk):
        from user_workspace.models import ScreenerRule

        tenant = getattr(request, 'tenant', None)
        try:
            from user_workspace.models import ScreenerSchedule

            if tenant:
                sched = ScreenerSchedule.objects.get(pk=pk, user=request.user, tenant=tenant)
            else:
                sched = ScreenerSchedule.objects.get(pk=pk, user=request.user)
        except Exception:
            raise NotFound('Lịch không tồn tại.')
        # Latest session for snapshot
        from datetime import date as _date

        try:
            from market_serving.models import SymbolSnapshot as _Snap

            _latest = _Snap.objects.order_by('-session_date').first()
            session_iso = _latest.session_date.isoformat() if _latest and _latest.session_date else _date.today().isoformat()
        except Exception:
            session_iso = _date.today().isoformat()
        import uuid as _uuid

        from user_workspace.screener_tasks import run_screener_scan_task

        job_ids = []
        for rid in (sched.rule_ids or []):
            try:
                # Scope by the schedule's tenant, not just `user`: a rule from
                # another tenant would otherwise run and write its result into
                # this tenant's run history.
                if sched.tenant_id is None:
                    continue
                rule = ScreenerRule.objects.filter(
                    pk=int(rid), user=request.user, tenant_id=sched.tenant_id,
                ).first()
                if rule is None:
                    continue
                try:
                    uts = int(rule.updated_at.timestamp()) if getattr(rule, 'updated_at', None) else 0
                except Exception:
                    uts = 0
                jid = _uuid.uuid4().hex
                run_screener_scan_task.delay(
                    request.user.id,
                    getattr(rule, 'tenant_id', None),
                    rule.id,
                    {"rules_json": rule.rules_json, "updated_at_ts": uts},
                    session_iso,
                    1,
                    jid,
                    sched.id,
                )
                job_ids.append({'rule_id': rule.id, 'job_id': jid})
            except Exception:
                continue
        # Update last_run_at
        try:
            from django.utils import timezone as _tz

            sched.last_run_at = _tz.now()
            sched.save(update_fields=['last_run_at'])
        except Exception:
            pass
        return envelope({'scheduled': sched.id, 'jobs': job_ids})


@extend_schema(
    summary='ScreenerScheduleAlertsView (native route)',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. The real payload shape is checked by test_flat_views_are_not_documented_as_envelope.',
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class ScreenerScheduleAlertsView(APIView):
    """P2.4: GET /screener/schedules/alerts/ — in_app new_symbols alerts (cache 7d)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.core.cache import cache as _cache

        # TEN-06: scope by tenant — a user in two tenants must not see the
        # other tenant's scheduled-alert payload.
        _alerts_tenant = getattr(getattr(request, "tenant", None), "public_id", None) or "no-tenant"
        alerts = _cache.get(f"screener:sched_alerts:{_alerts_tenant}:{request.user.id}") or []
        if not isinstance(alerts, list):
            alerts = []
        return paginated_envelope({'count': len(alerts), 'results': alerts[:50]})


@extend_schema(
    summary='ScreenerTemplatesView (native route)',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. The real payload shape is checked by test_flat_views_are_not_documented_as_envelope.',
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class ScreenerTemplatesView(APIView):
    """GET /screener/templates/ — pre-built screener template catalog (S2.5)."""

    def get(self, request):
        from .screener_templates import SCREENER_TEMPLATES

        return envelope({'templates': SCREENER_TEMPLATES})


@extend_schema(
    summary='ScreenerHistoryListView (native route)',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. The real payload shape is checked by test_flat_views_are_not_documented_as_envelope.',
    # This class has a body-carrying method, so the REQUEST side must be typed too;
    # responses= alone still yields the unguessable-serializer error.
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class ScreenerHistoryListView(APIView):
    """P2.3: GET /screener/history/?rule_id=&page=&limit= — list + DELETE clear all."""

    permission_classes = [permissions.IsAuthenticated, WorkspacePermission]
    required_workspace_permission = 'portfolio_write'

    def get(self, request):
        from user_workspace.models import ScreenerRunHistory

        tenant = getattr(request, 'tenant', None)
        qs = ScreenerRunHistory.objects.filter(user=request.user)
        if tenant:
            qs = qs.filter(tenant=tenant)
        rule_id = request.query_params.get('rule_id')
        if rule_id:
            try:
                qs = qs.filter(rule_id=int(rule_id))
            except (TypeError, ValueError):
                pass
        # Pagination: page/limit, default 1/20
        try:
            page = int(request.query_params.get('page', '1'))
            limit = int(request.query_params.get('limit', '20'))
        except (TypeError, ValueError):
            page, limit = 1, 20
        page = max(1, page)
        limit = max(1, min(limit, 100))
        total = qs.count()
        pages = (total + limit - 1) // limit if limit else 1
        start = (page - 1) * limit
        items = qs.order_by('-run_at')[start : start + limit]
        data = [
            {
                'id': h.id,
                'rule_id': h.rule_id,
                'rule_name': h.rule_name,
                'run_at': h.run_at.isoformat() if h.run_at else None,
                'matched_count': h.matched_count,
                'total_scanned': h.total_scanned,
                'window_days': h.window_days,
                'session_date': h.session_date.isoformat() if h.session_date else None,
                'matched': h.matched,
                'params': h.params,
            }
            for h in items
        ]
        return paginated_envelope({'count': total, 'page': page, 'limit': limit, 'pages': pages, 'results': data})

    def delete(self, request):
        from user_workspace.models import ScreenerRunHistory

        tenant = getattr(request, 'tenant', None)
        qs = ScreenerRunHistory.objects.filter(user=request.user)
        if tenant:
            qs = qs.filter(tenant=tenant)
        deleted, _ = qs.delete()
        return envelope({'deleted': deleted})


@extend_schema(
    summary='ScreenerHistoryDetailView (native route)',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. The real payload shape is checked by test_flat_views_are_not_documented_as_envelope.',
    # This class has a body-carrying method, so the REQUEST side must be typed too;
    # responses= alone still yields the unguessable-serializer error.
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class ScreenerHistoryDetailView(APIView):
    """P2.3: GET/DELETE /screener/history/<id>/"""

    permission_classes = [permissions.IsAuthenticated, WorkspacePermission]
    required_workspace_permission = 'portfolio_write'

    def get(self, request, pk):
        from user_workspace.models import ScreenerRunHistory

        tenant = getattr(request, 'tenant', None)
        try:
            if tenant:
                h = ScreenerRunHistory.objects.get(pk=pk, user=request.user, tenant=tenant)
            else:
                h = ScreenerRunHistory.objects.get(pk=pk, user=request.user)
        except ScreenerRunHistory.DoesNotExist:
            raise NotFound('Lịch sử không tồn tại.')
        return envelope(
            {
                'id': h.id,
                'rule_id': h.rule_id,
                'rule_name': h.rule_name,
                'run_at': h.run_at.isoformat() if h.run_at else None,
                'matched_count': h.matched_count,
                'total_scanned': h.total_scanned,
                'window_days': h.window_days,
                'session_date': h.session_date.isoformat() if h.session_date else None,
                'matched': h.matched,
                'params': h.params,
            }
        )

    def delete(self, request, pk):
        from user_workspace.models import ScreenerRunHistory

        tenant = getattr(request, 'tenant', None)
        try:
            if tenant:
                h = ScreenerRunHistory.objects.get(pk=pk, user=request.user, tenant=tenant)
            else:
                h = ScreenerRunHistory.objects.get(pk=pk, user=request.user)
        except ScreenerRunHistory.DoesNotExist:
            raise NotFound('Lịch sử không tồn tại.')
        h.delete()
        return Response(status=204)


@extend_schema(
    summary='ScreenerHistoryBacktestView (native route)',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. The real payload shape is checked by test_flat_views_are_not_documented_as_envelope.',
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class ScreenerHistoryBacktestView(APIView):
    """P2.3: GET /screener/history/<id>/backtest/?horizon=5 — server backtest v2."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        from user_workspace.models import ScreenerRunHistory
        from market_data.models import DailyPrice
        from datetime import timedelta

        tenant = getattr(request, 'tenant', None)
        try:
            if tenant:
                h = ScreenerRunHistory.objects.get(pk=pk, user=request.user, tenant=tenant)
            else:
                h = ScreenerRunHistory.objects.get(pk=pk, user=request.user)
        except ScreenerRunHistory.DoesNotExist:
            raise NotFound('Lịch sử không tồn tại.')
        # horizon: 5 or 20 days (default 5)
        try:
            horizon = int(request.query_params.get('horizon', '5'))
        except (TypeError, ValueError):
            horizon = 5
        horizon = max(1, min(horizon, 60))
        # Build trades like screenerHistoryStore.buildTrades but server-side from DailyPrice
        matched = h.matched or []
        # Only BUY/SELL with close
        candidates = [r for r in matched if r.get('action') in ('BUY', 'SELL') and r.get('close') is not None and r.get('symbol')]
        if not candidates:
            return envelope({'winRate': 0, 'wins': 0, 'losses': 0, 'evaluated': 0, 'trades': [], 'horizon': horizon})
        # For each candidate, find exit price after horizon trading days from run_at date
        # Use DailyPrice: for symbol, date > run_at.date, order by date, take horizon-th
        run_date = h.run_at.date() if h.run_at else None
        trades = []
        wins = 0
        for row in candidates:
            sym = row['symbol']
            entry = float(row['close'])
            action = row['action']
            # Find exit: DailyPrice for symbol where date > run_date, limit horizon, take last
            qs = DailyPrice.objects.filter(symbol=sym)
            if run_date:
                qs = qs.filter(date__gt=run_date)
            qs = qs.order_by('date')[:horizon]
            closes = list(qs.values_list('close', flat=True))
            if not closes:
                continue
            exit_price = float(closes[-1])
            win = (exit_price > entry) if action == 'BUY' else (exit_price < entry)
            if win:
                wins += 1
            trades.append({'symbol': sym, 'action': action, 'entry': entry, 'exit': exit_price, 'win': win})
        evaluated = len(trades)
        losses = evaluated - wins
        win_rate = (wins / evaluated * 100) if evaluated else 0
        return envelope(
            {
                'winRate': round(win_rate, 2),
                'wins': wins,
                'losses': losses,
                'evaluated': evaluated,
                'trades': trades[:15],
                'horizon': horizon,
            }
        )

